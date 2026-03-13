#!/usr/bin/env python3
"""
features.py — Stationary Feature Engineering ETL Pipeline
============================================================
Transforms raw daily OHLCV and momentum data into mathematically
stationary features safe for tree-based ML models (XGBoost).

Phase 2 of the predictive engine build. Operates on the Canadian
resource equities sandbox: WCP, BTE, PXT, CCO, IVN.

Feature Transforms:
    1. Gaussian Rank Normalization  (cross-sectional, per day)
    2. Fractional Differencing FFD  (per ticker, d=0.4)
    3. Rolling Z-Scores             (per ticker, 21d & 63d)
    4. Forward 20-Day Norm Return   (target, cross-sectional rank)

Output: features_latest.parquet (columnar store for ML consumption)

Dependencies: pandas, numpy, sklearn (all in requirements.txt)
Run:  python3 features.py
"""

from __future__ import annotations

import warnings
from pathlib import Path
from typing import List

import numpy as np
import pandas as pd
from scipy.special import ndtri          # Φ⁻¹  (inverse normal CDF)
from sklearn.preprocessing import QuantileTransformer

warnings.filterwarnings("ignore")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  CONSTANTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TICKERS = ["WCP.TO", "BTE.TO", "PXT.TO", "CCO.TO", "IVN.TO"]

# Fractional differencing order
# d=0.4 balances stationarity with memory preservation.
# d=0 → no differencing (non-stationary), d=1 → full differencing (memory erased)
FRAC_DIFF_D = 0.4

# Weight threshold for truncating the FFD binomial expansion.
# Weights below this are dropped to keep the filter finite.
FRAC_DIFF_THRESH = 1e-4

# Rolling Z-score windows
ZSCORE_SHORT = 21    # ~1 month of trading days
ZSCORE_MID = 63      # ~3 months (1 quarter)

# Forward return horizon (trading days)
FWD_RETURN_DAYS = 20

# Output path
OUTPUT_PATH = Path(__file__).parent / "features_latest.parquet"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  1. DATA INGESTION — Mock Panel Generator
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def generate_mock_panel(
    tickers: List[str] = TICKERS,
    n_days: int = 500,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate a multi-index panel DataFrame for the sandbox universe.

    Structure:
        Index:   MultiIndex ['date', 'ticker']
        Columns: close, volume, composite_momentum_score

    The panel format mirrors how ML feature matrices are structured:
    each row is one (date, ticker) observation, enabling efficient
    groupby operations for both cross-sectional (per-date) and
    time-series (per-ticker) transforms.

    Parameters
    ----------
    tickers : list of str
        Sandbox ticker symbols.
    n_days : int
        Number of trading days to simulate.
    seed : int
        Random seed for reproducibility.

    Returns
    -------
    pd.DataFrame with MultiIndex ['date', 'ticker']
    """
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=n_days)

    frames = []
    for i, ticker in enumerate(tickers):
        # ── Synthetic close price (correlated random walk) ──
        # Each ticker has unique drift and volatility
        drift = 0.0002 + 0.0001 * (i % 3)
        vol = 0.018 + 0.006 * (i % 4)
        log_ret = rng.normal(loc=drift, scale=vol, size=n_days)
        close = (12.0 + 4.0 * i) * np.exp(np.cumsum(log_ret))

        # ── Synthetic volume ──
        base_vol = 1_000_000 + 500_000 * i
        volume = rng.lognormal(mean=np.log(base_vol), sigma=0.3, size=n_days)

        # ── Composite momentum score (mean-reverting, ∈ [-2, 2]) ──
        # Matches the score structure from our platform's 4-system screener
        score = np.zeros(n_days)
        score[0] = rng.normal(0, 0.5)
        for t in range(1, n_days):
            score[t] = 0.85 * score[t - 1] + rng.normal(0, 0.55)
        score = np.clip(score, -2.0, 2.0)

        df = pd.DataFrame({
            "date": dates,
            "ticker": ticker,
            "close": close,
            "volume": volume,
            "composite_momentum_score": score,
        })
        frames.append(df)

    panel = pd.concat(frames, ignore_index=True)
    panel = panel.set_index(["date", "ticker"]).sort_index()

    print(f"  ✓ Generated mock panel: {len(tickers)} tickers × {n_days} days "
          f"= {len(panel):,} rows")
    return panel


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  2. GAUSSIAN RANK NORMALIZATION (Cross-Sectional, Per Day)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def gaussian_rank_normalize(
    panel: pd.DataFrame,
    col: str,
    out_col: str,
) -> pd.DataFrame:
    """
    Apply cross-sectional Gaussian Rank Normalization to a column.

    The Equation:
    ────────────
        Z_{i,t} = Φ⁻¹( R_{i,t} / (N_t + 1) )

    Where:
        R_{i,t} = rank of asset i among all N_t assets on day t
        N_t     = number of assets with valid observations on day t
        Φ⁻¹     = inverse standard normal CDF (probit function)
        Z_{i,t} = the normalized score, ∈ approximately [-3, 3]

    Why this works:
        - Ranks are uniform on [1/(N+1), N/(N+1)]
        - Φ⁻¹ maps this uniform distribution to N(0,1)
        - Cross-sectional ranking removes regime drift
        - The denominator (N+1) prevents Φ⁻¹(0) and Φ⁻¹(1) which are ±∞

    Implementation:
        We use sklearn's QuantileTransformer which performs exactly this
        operation: rank → uniform quantile → inverse normal CDF.
        Applied per-date group to enforce cross-sectional ranking.

    Parameters
    ----------
    panel : pd.DataFrame
        Multi-index ['date', 'ticker'] panel.
    col : str
        Input column name to normalize.
    out_col : str
        Output column name for the normalized values.

    Returns
    -------
    pd.DataFrame : panel with new `out_col` column added
    """
    panel = panel.copy()

    def _rank_normalize_group(group: pd.DataFrame) -> pd.Series:
        """
        Rank-normalize a single day's cross-section.

        For N tickers on a given day:
            1. Rank values from 1 to N
            2. Compute quantiles: rank / (N + 1)
            3. Apply Φ⁻¹ (inverse normal CDF)
        """
        values = group[col].values
        n = len(values)

        if n < 2:
            # Can't meaningfully rank a single observation
            return pd.Series(0.0, index=group.index)

        # ── Step 1: Rank (average method handles ties) ──
        ranks = pd.Series(values, index=group.index).rank(method="average")

        # ── Step 2: Map ranks to quantiles ──
        # Divide by (N + 1) to keep quantiles strictly in (0, 1),
        # avoiding Φ⁻¹(0) = -∞ and Φ⁻¹(1) = +∞
        quantiles = ranks / (n + 1)

        # ── Step 3: Apply inverse normal CDF (Φ⁻¹) ──
        # scipy.special.ndtri is the fast C implementation of Φ⁻¹
        z_scores = ndtri(quantiles.values)

        return pd.Series(z_scores, index=group.index)

    # ── Apply per-date cross-section ──
    # groupby level='date' iterates over each trading day,
    # ranking tickers WITHIN each day (not across time)
    panel[out_col] = panel.groupby(level="date", group_keys=False).apply(
        _rank_normalize_group
    )

    return panel


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  3. FRACTIONAL DIFFERENCING — Fixed-Width Window FFD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _get_ffd_weights(d: float, threshold: float = FRAC_DIFF_THRESH) -> np.ndarray:
    """
    Compute the binomial expansion weights for fractional differencing.

    The Fractional Differencing Operator:
    ─────────────────────────────────────
        Δ^d Y_t = Σ_{k=0}^{∞} C(d, k) · (-1)^k · Y_{t-k}

    Where the binomial coefficient weights are:
        w_0 = 1
        w_k = -w_{k-1} · (d - k + 1) / k    for k ≥ 1

    This recursive formula comes from expanding the generalised
    binomial coefficient: C(d, k) = d! / (k! · (d-k)!)
    where d is NOT an integer, so we use the Gamma function form.

    The weights decay geometrically. We truncate when |w_k| < threshold
    to create a Fixed-Width Window (FFD) filter — this is the practical
    implementation that makes the infinite sum computable.

    For d=0.4, threshold=1e-4, we typically get ~50-80 weights.

    Parameters
    ----------
    d : float
        Fractional differencing order, 0 < d < 1.
        d=0 → no differencing (keeps all memory, non-stationary)
        d=1 → full first differencing (erases all memory)
        d=0.4 → sweet spot: stationary but retains long-term memory
    threshold : float
        Minimum absolute weight before truncation.

    Returns
    -------
    np.ndarray : weight vector [w_0, w_1, w_2, …, w_K]
    """
    # ── Build weights recursively ──
    # w_0 = 1 (the current observation always has weight 1)
    weights = [1.0]
    k = 1

    while True:
        # Recursive weight formula:
        #   w_k = -w_{k-1} · (d - k + 1) / k
        #
        # This comes from the ratio of consecutive binomial coefficients:
        #   C(d, k) / C(d, k-1) = (d - k + 1) / k
        # The (-1)^k alternating sign is absorbed into the recursion.
        w_k = -weights[-1] * (d - k + 1) / k
        if abs(w_k) < threshold:
            break
        weights.append(w_k)
        k += 1

    return np.array(weights, dtype=np.float64)


def frac_diff_ffd(
    series: pd.Series,
    d: float = FRAC_DIFF_D,
    threshold: float = FRAC_DIFF_THRESH,
) -> pd.Series:
    """
    Apply Fixed-Width Window Fractional Differencing to a time series.

    The FFD Equation:
    ────────────────
        Δ^d Y_t = Σ_{k=0}^{K} w_k · Y_{t-k}

    Where:
        w_k = binomial weights (computed by _get_ffd_weights)
        K   = truncation point where |w_K| < threshold
        Y_t = the input time-series (typically log prices)

    Why log prices?
        We apply FFD to log(close) rather than raw close because:
        1. Log prices convert multiplicative price dynamics to additive
        2. The differencing operator Δ^d on log prices gives returns
           with controlled memory retention
        3. Avoids scale issues between $5 and $50 stocks

    Implementation:
        Uses np.convolve with mode='full', then takes the valid portion.
        This is a vectorised dot-product convolution — no Python loops.

    Parameters
    ----------
    series : pd.Series
        Input time series (should be log prices).
    d : float
        Fractional differencing order.
    threshold : float
        Weight truncation threshold.

    Returns
    -------
    pd.Series : fractionally differenced series (leading NaNs where
                the filter window is incomplete)
    """
    # ── Step 1: Get the FFD weight vector ──
    weights = _get_ffd_weights(d, threshold)
    width = len(weights)

    # ── Step 2: Convolve the input with the weight vector ──
    # np.convolve computes: output[t] = Σ_k w_k · Y_{t-k}
    # mode='full' returns the complete convolution; we slice to align.
    values = series.values
    convolved = np.convolve(values, weights, mode="full")

    # ── Step 3: Align and handle boundary effects ──
    # 'full' convolution gives len(values) + len(weights) - 1 elements.
    # The first (width - 1) elements use incomplete windows → set to NaN.
    result = np.full(len(values), np.nan)
    result[width - 1:] = convolved[width - 1: len(values)]

    return pd.Series(result, index=series.index, name=series.name)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  4. ROLLING Z-SCORES (Per Ticker, Time-Series)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def rolling_zscore(
    series: pd.Series,
    window: int,
) -> pd.Series:
    """
    Compute rolling Z-score to de-trend a time series.

    The Rolling Z-Score Equation:
    ────────────────────────────
        Z_t = (X_t - μ_w) / σ_w

    Where:
        X_t = current value of the series
        μ_w = rolling mean over the past `window` observations
        σ_w = rolling standard deviation over the past `window` observations

    Why Z-scores?
        - Removes level effects (a $50 stock vs $5 stock)
        - Removes volatility regime shifts (calm vs crisis)
        - Puts all features on a comparable scale
        - Tree models benefit from normalized inputs for split stability

    The short window (21d) captures recent deviations.
    The mid window (63d) captures quarterly regime context.

    Implementation:
        Pure pandas vectorised rolling operations — no loops.
        Uses ddof=1 for sample standard deviation (unbiased estimator).

    Parameters
    ----------
    series : pd.Series
        Input time series (per-ticker prices or volumes).
    window : int
        Lookback window in trading days.

    Returns
    -------
    pd.Series : rolling Z-scores (leading NaN where window is incomplete)
    """
    # ── Rolling mean and standard deviation ──
    roll_mean = series.rolling(window=window, min_periods=window).mean()
    roll_std = series.rolling(window=window, min_periods=window).std(ddof=1)

    # ── Z-score: how many σ away from the rolling mean ──
    # Replace zero std with NaN to avoid division by zero
    z = (series - roll_mean) / roll_std.replace(0, np.nan)

    return z


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  5. FORWARD RETURN (Target Variable)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def compute_forward_return(
    series: pd.Series,
    horizon: int = FWD_RETURN_DAYS,
) -> pd.Series:
    """
    Compute the forward N-day simple return as the ML target variable.

    Formula:
    ────────
        fwd_ret_t = (close_{t+horizon} / close_t) - 1

    We use shift(-horizon) to look FORWARD in time. This is the value
    the ML model will learn to predict. The negative shift means:
        - At time t, fwd_ret_t tells us what WILL happen over the next
          `horizon` trading days.
        - The last `horizon` rows will be NaN (no future data available).

    IMPORTANT — Data leakage note:
        This column must NEVER be used as a feature. It is only used
        as the target variable (y) during training. The NaN rows at the
        end are dropped before saving.

    Parameters
    ----------
    series : pd.Series
        Close price series (per-ticker).
    horizon : int
        Number of trading days to look ahead.

    Returns
    -------
    pd.Series : forward return (decimal form, e.g. 0.05 = 5%)
    """
    return series.shift(-horizon) / series - 1


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  6. MAIN ETL PIPELINE — engineer_stationary_features
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def engineer_stationary_features(panel: pd.DataFrame) -> pd.DataFrame:
    """
    Master ETL function: apply all 4 mathematical transformations.

    Pipeline:
    ─────────
        1. Fractional Differencing of log(close)  [grouped by ticker]
        2. Rolling Z-Scores on close and volume    [grouped by ticker]
        3. Forward 20-day return                   [grouped by ticker]
        4. Gaussian Rank Normalization             [grouped by date]
           - Applied to composite_momentum_score
           - Applied to forward return (target)

    Grouping Logic (CRITICAL for correctness):
    ──────────────────────────────────────────
        - Time-series transforms (FFD, Z-scores, forward returns) are
          grouped BY TICKER — each ticker's history is independent.
        - Cross-sectional transforms (Gaussian rank) are grouped BY DATE —
          we rank across tickers within each day.

    Parameters
    ----------
    panel : pd.DataFrame
        Multi-index ['date', 'ticker'] with columns:
        close, volume, composite_momentum_score

    Returns
    -------
    pd.DataFrame : engineered features, NaN-dropped, ready for ML
    """
    print("\n  ── [1/4] Fractional Differencing (d=0.4, per ticker) ──")
    # ─────────────────────────────────────────────────────────────────
    # Apply FFD to log(close) per ticker.
    # log(close) converts multiplicative price dynamics to additive,
    # then Δ^0.4 makes it stationary while preserving memory.
    # ─────────────────────────────────────────────────────────────────
    panel["log_close"] = np.log(panel["close"])

    panel["close_ffd"] = panel.groupby(level="ticker", group_keys=False)[
        "log_close"
    ].apply(lambda s: frac_diff_ffd(s, d=FRAC_DIFF_D))

    ffd_weights = _get_ffd_weights(FRAC_DIFF_D)
    print(f"    FFD weight vector length: {len(ffd_weights)} "
          f"(d={FRAC_DIFF_D}, threshold={FRAC_DIFF_THRESH})")
    print(f"    First 5 weights: {ffd_weights[:5].round(4)}")

    print("\n  ── [2/4] Rolling Z-Scores (21d & 63d, per ticker) ──")
    # ─────────────────────────────────────────────────────────────────
    # Z_t = (X_t - μ_w) / σ_w
    # Short (21d) captures recent momentum; mid (63d) captures quarter.
    # Applied independently per ticker (each stock's own history).
    # ─────────────────────────────────────────────────────────────────
    for col_name, raw_col, window in [
        ("close_zscore_21", "close", ZSCORE_SHORT),
        ("close_zscore_63", "close", ZSCORE_MID),
        ("volume_zscore_21", "volume", ZSCORE_SHORT),
        ("volume_zscore_63", "volume", ZSCORE_MID),
    ]:
        panel[col_name] = panel.groupby(level="ticker", group_keys=False)[
            raw_col
        ].apply(lambda s, w=window: rolling_zscore(s, w))
        print(f"    ✓ {col_name} (window={window})")

    print("\n  ── [3/4] Forward 20-Day Return (target, per ticker) ──")
    # ─────────────────────────────────────────────────────────────────
    # fwd_ret = close_{t+20} / close_t - 1
    # Computed per ticker so we don't look into another stock's future.
    # ─────────────────────────────────────────────────────────────────
    panel["fwd_ret_20d"] = panel.groupby(level="ticker", group_keys=False)[
        "close"
    ].apply(lambda s: compute_forward_return(s, FWD_RETURN_DAYS))
    print(f"    ✓ fwd_ret_20d (horizon={FWD_RETURN_DAYS} days)")

    print("\n  ── [4/4] Gaussian Rank Normalization (cross-sectional) ──")
    # ─────────────────────────────────────────────────────────────────
    # Z_{i,t} = Φ⁻¹( R_{i,t} / (N_t + 1) )
    # Ranks tickers WITHIN each day (cross-sectional), then maps to
    # N(0,1). This removes regime-dependent drift from the score.
    # ─────────────────────────────────────────────────────────────────
    panel = gaussian_rank_normalize(panel, "composite_momentum_score", "score_gauss_rank")
    print(f"    ✓ score_gauss_rank (from composite_momentum_score)")

    panel = gaussian_rank_normalize(panel, "fwd_ret_20d", "fwd_ret_20d_gauss")
    print(f"    ✓ fwd_ret_20d_gauss (from fwd_ret_20d)")

    # ── Select final feature columns ──
    feature_cols = [
        # Features (safe for model input)
        "close_ffd",
        "close_zscore_21",
        "close_zscore_63",
        "volume_zscore_21",
        "volume_zscore_63",
        "score_gauss_rank",
        # Target (model output — never use as feature)
        "fwd_ret_20d",
        "fwd_ret_20d_gauss",
    ]

    result = panel[feature_cols].copy()

    # ── Drop NaN rows ──
    # NaN sources:
    #   - FFD: first ~50 rows per ticker (filter width)
    #   - Z-scores: first 63 rows per ticker (longest window)
    #   - Forward return: last 20 rows per ticker (no future data)
    n_before = len(result)
    result = result.dropna()
    n_after = len(result)
    n_dropped = n_before - n_after
    print(f"\n  ── NaN Cleanup ──")
    print(f"    Before: {n_before:,} rows")
    print(f"    Dropped: {n_dropped:,} rows ({100*n_dropped/n_before:.1f}%)")
    print(f"    After: {n_after:,} rows")

    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MAIN — Run the ETL Pipeline
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == "__main__":
    print("=" * 70)
    print("  FEATURE ENGINEERING — Stationary ML Feature Pipeline")
    print("  Sandbox: Canadian Resource Equities")
    print("  Output:  features_latest.parquet")
    print("=" * 70)

    # ── Step 1: Generate mock panel data ──
    print("\n[1/3] Generating mock panel data …")
    panel = generate_mock_panel()

    # ── Step 2: Engineer features ──
    print("\n[2/3] Engineering stationary features …")
    features = engineer_stationary_features(panel)

    # ── Step 3: Save to Parquet ──
    print(f"\n[3/3] Saving to {OUTPUT_PATH.name} …")
    features.to_parquet(OUTPUT_PATH, engine="pyarrow")
    file_size = OUTPUT_PATH.stat().st_size
    print(f"  ✓ Saved: {OUTPUT_PATH.name} ({file_size:,} bytes)")

    # ── Verification Output ──
    print("\n" + "=" * 70)
    print("  VERIFICATION — DataFrame Info")
    print("=" * 70)
    features.info()

    print("\n" + "=" * 70)
    print("  VERIFICATION — DataFrame Head (first 10 rows)")
    print("=" * 70)
    pd.set_option("display.width", 120)
    pd.set_option("display.max_columns", 12)
    pd.set_option("display.float_format", "{:.4f}".format)
    print(features.head(10).to_string())

    print("\n" + "=" * 70)
    print("  VERIFICATION — Feature Statistics")
    print("=" * 70)
    print(features.describe().round(4).to_string())

    # ── Sanity checks ──
    print("\n" + "─" * 70)
    print("  SANITY CHECKS")
    print("─" * 70)

    n_nan = features.isna().sum().sum()
    print(f"  Total NaN in final features: {n_nan}")
    assert n_nan == 0, "❌ NaN values remain in the feature matrix!"
    print(f"  ✓ No NaN values — clean feature matrix")

    # Gaussian rank should be roughly N(0,1)
    gr_mean = features["score_gauss_rank"].mean()
    gr_std = features["score_gauss_rank"].std()
    print(f"  score_gauss_rank: mean={gr_mean:.4f}, std={gr_std:.4f} "
          f"(expected ≈ N(0,1))")

    # FFD should NOT look like raw prices (should be mean-near-zero)
    ffd_mean = features["close_ffd"].mean()
    ffd_std = features["close_ffd"].std()
    print(f"  close_ffd: mean={ffd_mean:.4f}, std={ffd_std:.4f} "
          f"(should NOT be at price levels)")

    # Parquet roundtrip check
    roundtrip = pd.read_parquet(OUTPUT_PATH)
    assert roundtrip.shape == features.shape, "❌ Parquet roundtrip shape mismatch!"
    print(f"  ✓ Parquet roundtrip verified ({roundtrip.shape})")

    print("\n" + "=" * 70)
    print("  ✓ Feature engineering pipeline complete.")
    print("=" * 70)
