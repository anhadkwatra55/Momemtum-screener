"""
signals.py — The Three Pillars of Signal Generation
=====================================================
1. Beta-Neutral Residual Z-Score   (idiosyncratic mean-reversion)
2. Volume-Augmented HMM Regime     (market-state filter)
3. Sliding-Window Hurst Exponent   (memory / persistence measure)
"""

from __future__ import annotations

import warnings
from typing import Tuple

import numpy as np
import pandas as pd
from hmmlearn.hmm import GaussianHMM
from scipy.stats import zscore as sp_zscore

import config as cfg

warnings.filterwarnings("ignore", category=DeprecationWarning)


# ═══════════════════════════════════════════════
#  PILLAR 1 — Beta-Neutral Residual Z-Score
# ═══════════════════════════════════════════════

def rolling_beta_residual_zscore(
    returns: pd.Series,
    benchmark_returns: pd.Series,
    window_beta: int = cfg.WINDOW_BETA,
    window_zscore: int = cfg.WINDOW_ZSCORE,
    threshold: float = cfg.ZSCORE_THRESHOLD,
) -> pd.DataFrame:
    """
    Compute the **beta-neutral residual Z-Score** for a single ticker.

    Methodology
    -----------
    1. Estimate a **rolling OLS beta** of ticker vs benchmark over
       *window_beta* days.
    2. Compute the **residual return**: r_resid = r_ticker - beta * r_benchmark.
       This strips out the portion of return explained by the market factor.
    3. Compute a rolling Z-Score of the residual returns over *window_zscore*
       days.
    4. Flag signals where |Z| > *threshold*.

    Returns
    -------
    pd.DataFrame with columns:
        - rolling_beta
        - residual_return
        - residual_zscore
        - zscore_signal   (1 = short signal, -1 = long signal, 0 = no signal)
    """
    # Align
    aligned = pd.DataFrame({"ticker": returns, "bench": benchmark_returns}).dropna()

    # --- Rolling Beta via vectorised rolling cov / var ---
    rolling_cov = aligned["ticker"].rolling(window_beta).cov(aligned["bench"])
    rolling_var = aligned["bench"].rolling(window_beta).var()
    rolling_beta = rolling_cov / rolling_var
    rolling_beta.name = "rolling_beta"

    # --- Residual returns ---
    residual = aligned["ticker"] - rolling_beta * aligned["bench"]
    residual.name = "residual_return"

    # --- Rolling Z-Score of residuals ---
    roll_mean = residual.rolling(window_zscore).mean()
    roll_std = residual.rolling(window_zscore).std()
    z = (residual - roll_mean) / roll_std.replace(0, np.nan)
    z.name = "residual_zscore"

    # --- Signal classification ---
    signal = pd.Series(0, index=z.index, name="zscore_signal")
    signal[z > threshold] = 1       # over-extended UP → short signal
    signal[z < -threshold] = -1     # over-extended DOWN → long signal

    return pd.concat([rolling_beta, residual, z, signal], axis=1)


# ═══════════════════════════════════════════════
#  PILLAR 2 — Volume-Augmented HMM Regime Filter
# ═══════════════════════════════════════════════

def _label_hmm_states(model: GaussianHMM) -> np.ndarray:
    """
    Sort HMM states by increasing variance of the *returns* dimension
    (column 0 of the 2-D observation matrix).

    Returns an index array mapping raw state → labelled state:
        0 → "Low Volatility / Trend"
        1 → "High Volatility / Mean-Reverting"
        2 → "Chaotic / No Signal"
    """
    # Variance of each state for dimension 0 (returns)
    variances = model.covars_[:, 0, 0] if model.covars_.ndim == 3 else model.covars_[:, 0]
    return np.argsort(variances)   # ascending vol order


def fit_hmm_regime(
    returns: pd.Series,
    volume: pd.Series,
    window: int = cfg.WINDOW_HMM,
    n_states: int = cfg.HMM_N_STATES,
    n_iter: int = cfg.HMM_N_ITER,
) -> Tuple[int, np.ndarray, GaussianHMM]:
    """
    Fit a 2-D Gaussian HMM on (log-returns, volume-force) over the trailing
    *window* days.

    Volume Force is defined as:
        VF_t = (V_t / V̄₂₀) − 1
    normalised so it is scale-free and comparable across tickers.

    Returns
    -------
    current_regime : int
        0 = Low-Vol/Trend, 1 = High-Vol/Mean-Reverting, 2 = Chaotic
    state_sequence : np.ndarray of shape (window,)
        Full labelled state sequence.
    model          : GaussianHMM
        The fitted model (for inspection / serialisation).
    """
    # Trim to trailing window
    ret = returns.iloc[-window:].values.reshape(-1, 1)
    vol = volume.iloc[-window:].values.astype(float)

    # Volume force: relative deviation from rolling average
    vol_mean = pd.Series(vol.flatten()).rolling(cfg.WINDOW_ADV, min_periods=1).mean().values
    vol_force = ((vol / vol_mean) - 1).reshape(-1, 1)

    # Stack into 2-D observations  [returns, volume_force]
    observations = np.hstack([ret, vol_force])

    # Remove any rows with NaN/Inf
    mask = np.isfinite(observations).all(axis=1)
    observations_clean = observations[mask]

    if len(observations_clean) < 60:
        # Not enough data — default to "Chaotic" (conservative)
        return 2, np.full(window, 2), None

    model = GaussianHMM(
        n_components=n_states,
        covariance_type=cfg.HMM_COVARIANCE_TYPE,
        n_iter=n_iter,
        random_state=42,
    )
    model.fit(observations_clean)

    raw_states = model.predict(observations_clean)
    label_order = _label_hmm_states(model)

    # Map raw states → labelled states
    labelled = np.zeros_like(raw_states)
    for new_label, old_label in enumerate(label_order):
        labelled[raw_states == old_label] = new_label

    current_regime = int(labelled[-1])

    # Pad back to original window length
    full_states = np.full(window, 2)  # default chaotic
    full_states[mask] = labelled

    return current_regime, full_states, model


REGIME_NAMES = {0: "LowVol_Trend", 1: "HighVol_MR", 2: "Chaotic"}


# ═══════════════════════════════════════════════
#  PILLAR 3 — Sliding-Window Hurst Exponent
# ═══════════════════════════════════════════════

def _rs_hurst(ts: np.ndarray) -> float:
    """
    Classical Rescaled-Range (R/S) Hurst exponent estimation.

    For a series of length N, we split into sub-series of increasing
    lengths and regress log(R/S) on log(n).
    """
    N = len(ts)
    if N < 20:
        return np.nan

    max_k = N // 2
    lag_sizes = []
    rs_values = []

    for lag in range(10, max_k + 1):
        n_sub = N // lag
        if n_sub < 1:
            continue
        rs_list = []
        for i in range(n_sub):
            sub = ts[i * lag: (i + 1) * lag]
            mean_sub = np.mean(sub)
            dev = np.cumsum(sub - mean_sub)
            R = np.max(dev) - np.min(dev)
            S = np.std(sub, ddof=1) if np.std(sub, ddof=1) > 0 else np.nan
            if np.isfinite(R) and np.isfinite(S) and S > 0:
                rs_list.append(R / S)
        if rs_list:
            lag_sizes.append(lag)
            rs_values.append(np.mean(rs_list))

    if len(lag_sizes) < 3:
        return np.nan

    log_lags = np.log(lag_sizes)
    log_rs = np.log(rs_values)

    # OLS: log(R/S) = H * log(n) + c
    coeffs = np.polyfit(log_lags, log_rs, 1)
    return coeffs[0]


def sliding_hurst(
    log_returns: pd.Series,
    window: int = cfg.WINDOW_HURST,
) -> pd.DataFrame:
    """
    Compute the Hurst exponent over a sliding window and detect **Hurst
    acceleration** — i.e. a shift from random-walk (H ≈ 0.5) toward
    trending (H > 0.6) or mean-reverting (H < 0.4).

    Returns
    -------
    pd.DataFrame with columns:
        - hurst        : rolling Hurst exponent
        - hurst_delta  : change in H over last 21 days (≈ 1 month)
        - hurst_signal : 'mean_revert', 'trending', or 'neutral'
    """
    hurst_vals = pd.Series(np.nan, index=log_returns.index, name="hurst")

    for i in range(window, len(log_returns) + 1):
        segment = log_returns.iloc[i - window: i].dropna().values
        if len(segment) >= 50:
            hurst_vals.iloc[i - 1] = _rs_hurst(segment)

    # Hurst acceleration (Δ over trailing month)
    hurst_delta = hurst_vals.diff(21)
    hurst_delta.name = "hurst_delta"

    # Classification
    signal = pd.Series("neutral", index=log_returns.index, name="hurst_signal")
    signal[hurst_vals < cfg.HURST_MEAN_REV] = "mean_revert"
    signal[hurst_vals > cfg.HURST_TRENDING] = "trending"

    return pd.concat([hurst_vals, hurst_delta, signal], axis=1)
