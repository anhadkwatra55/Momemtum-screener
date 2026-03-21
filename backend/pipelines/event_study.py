#!/usr/bin/env python3
"""
event_study.py — Cumulative Abnormal Return (CAR) Event Study
================================================================
Isolated sandbox script for statistically proving edge from two event
types on Canadian resource equities:

    1. Momentum Shock  — composite score flips from < 0 to > 1.0 in 2 days
    2. Insider Buying   — boolean insider_buy flag is True

Methodology (The Market Model):
    Normal Return:     R_it = α_i + β_i · R_mt + ε_it
    Abnormal Return:   ε̂*_i = R*_i − α̂_i − β̂_i · R*_m
    Cumulative AR:     CAR_i(τ₁, τ₂) = γ' · ε̂*_i

Where:
    - Estimation window = 90 trading days before the event
    - Event window      = 20 trading days after the event (τ₁ to τ₂)
    - Market benchmark  = TSX Composite proxy (XIU.TO)

Sandbox tickers: WCP.TO, BTE.TO, PXT.TO, CCO.TO, IVN.TO

Dependencies: pandas, numpy, scipy (all already in requirements.txt)
Run:  python event_study.py
"""

from __future__ import annotations

import warnings
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  CONSTANTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Canadian resource equity sandbox
TICKERS = ["WCP.TO", "BTE.TO", "PXT.TO", "CCO.TO", "IVN.TO"]

# TSX Composite proxy ETF (benchmark)
BENCHMARK = "XIU.TO"

# Market Model estimation window (trading days before event)
ESTIMATION_WINDOW = 90

# Forward event window (trading days after event, inclusive of event day)
EVENT_WINDOW = 20

# Minimum estimation window data requirement (allow some NaN tolerance)
MIN_ESTIMATION_DAYS = 60


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  1. DATA INGESTION — Mock Generator
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def generate_mock_data(
    tickers: List[str] = TICKERS,
    n_days: int = 500,
    seed: int = 42,
) -> Dict[str, pd.DataFrame]:
    """
    Generate realistic mock OHLCV data for Canadian resource equities.

    Each ticker DataFrame contains:
        - Open, High, Low, Close, Volume  (synthetic OHLCV)
        - market_close                     (TSX benchmark close)
        - insider_buy                      (boolean, ~2% random True)
        - composite_momentum_score         (mean-reverting walk ∈ [-2, 2])

    Parameters
    ----------
    tickers : list of str
        Ticker symbols to generate data for.
    n_days : int
        Number of trading days to simulate.
    seed : int
        Random seed for reproducibility.

    Returns
    -------
    dict : {ticker: pd.DataFrame} with DatetimeIndex
    """
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=n_days)

    # ── Generate benchmark (market) series ──
    # Start at 100, random walk with slight upward drift
    market_log_ret = rng.normal(loc=0.0003, scale=0.012, size=n_days)
    market_close = 100.0 * np.exp(np.cumsum(market_log_ret))

    result: Dict[str, pd.DataFrame] = {}

    for i, ticker in enumerate(tickers):
        # Each ticker has its own volatility and drift characteristics
        # Use ticker index to vary parameters
        drift = rng.normal(0.0002, 0.0001)
        vol = 0.015 + 0.005 * (i % 3)  # varies by ticker

        log_ret = rng.normal(loc=drift, scale=vol, size=n_days)
        close = (10.0 + 5.0 * i) * np.exp(np.cumsum(log_ret))

        # Synthetic OHLCV from close
        open_prices = close * (1 + rng.normal(0, 0.005, n_days))
        high = np.maximum(open_prices, close) * (1 + np.abs(rng.normal(0, 0.008, n_days)))
        low = np.minimum(open_prices, close) * (1 - np.abs(rng.normal(0, 0.008, n_days)))
        volume = rng.integers(500_000, 5_000_000, size=n_days).astype(float)

        # ── Composite Momentum Score ──
        # Mean-reverting random walk with high volatility to produce
        # frequent regime flips (negative → strong positive) for
        # momentum shock detection.
        #   score(t) = 0.85 * score(t-1) + noise(σ=0.55)
        # Lower persistence (0.85 vs 0.95) + higher noise → faster
        # mean-reversion and more frequent threshold crossings.
        score = np.zeros(n_days)
        score[0] = rng.normal(0, 0.5)
        for t in range(1, n_days):
            score[t] = 0.85 * score[t - 1] + rng.normal(0, 0.55)
        # Clip to [-2, 2] to match platform composite range
        score = np.clip(score, -2.0, 2.0)

        # ── Insider Buy Events ──
        # ~3% occurrence rate for richer event sample
        insider_buy = rng.random(n_days) < 0.03

        df = pd.DataFrame({
            "Open": open_prices,
            "High": high,
            "Low": low,
            "Close": close,
            "Volume": volume,
            "market_close": market_close,
            "insider_buy": insider_buy,
            "composite_momentum_score": score,
        }, index=dates)

        result[ticker] = df

    print(f"  ✓ Generated mock data: {len(tickers)} tickers × {n_days} days")
    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  1b. DATA INGESTION — Live yfinance Fetcher (optional)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def fetch_live_data(
    tickers: List[str] = TICKERS,
    benchmark: str = BENCHMARK,
    period: str = "2y",
) -> Dict[str, pd.DataFrame]:
    """
    Fetch real daily OHLCV from yfinance for the sandbox tickers + benchmark.

    Merges benchmark close and generates placeholder insider_buy / composite
    score columns (would be replaced with real platform data in production).

    Parameters
    ----------
    tickers : list of str
        Ticker symbols (TSX format, e.g. 'WCP.TO').
    benchmark : str
        Benchmark ETF ticker for market returns.
    period : str
        yfinance period string (e.g. '2y', '3y').

    Returns
    -------
    dict : {ticker: pd.DataFrame} with merged benchmark and signal columns
    """
    import yfinance as yf

    # Fetch benchmark
    print(f"  Fetching benchmark ({benchmark}) …")
    bench_df = yf.download(benchmark, period=period, auto_adjust=True, progress=False)
    if isinstance(bench_df.columns, pd.MultiIndex):
        bench_df.columns = bench_df.columns.get_level_values(0)
    bench_close = bench_df["Close"].rename("market_close")

    # Fetch all tickers
    all_symbols = tickers
    print(f"  Fetching {len(all_symbols)} tickers …")
    raw = yf.download(all_symbols, period=period, auto_adjust=True, progress=False)

    rng = np.random.default_rng(99)
    result: Dict[str, pd.DataFrame] = {}

    for ticker in tickers:
        try:
            if len(all_symbols) == 1:
                df = raw.copy()
            else:
                df = raw[ticker].copy() if isinstance(raw.columns, pd.MultiIndex) else raw.copy()

            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            df = df.dropna(subset=["Close"])
            if len(df) < 120:
                print(f"    ⚠ {ticker}: only {len(df)} rows, skipping")
                continue

            # Merge benchmark
            df = df.join(bench_close, how="left")
            df["market_close"] = df["market_close"].ffill()

            # Placeholder signals (in production, pull from platform pipeline)
            n = len(df)
            df["insider_buy"] = rng.random(n) < 0.02
            score = np.zeros(n)
            score[0] = rng.normal(0, 0.5)
            for t in range(1, n):
                score[t] = 0.95 * score[t - 1] + rng.normal(0, 0.3)
            df["composite_momentum_score"] = np.clip(score, -2.0, 2.0)

            result[ticker] = df
            print(f"    ✓ {ticker}: {len(df)} rows")

        except Exception as e:
            print(f"    ⚠ {ticker} failed: {e}")
            continue

    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  2. MARKET MODEL — OLS Regression (Vectorised)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def compute_log_returns(prices: pd.Series) -> pd.Series:
    """
    Compute daily log returns from a price series.

    Log returns are preferred for the Market Model because they are:
        - Time-additive (can be summed across days)
        - Approximately normally distributed
        - Symmetric for gains and losses

    Formula:  r_t = ln(P_t / P_{t-1})

    Parameters
    ----------
    prices : pd.Series
        Daily closing prices.

    Returns
    -------
    pd.Series : daily log returns (first value is NaN)
    """
    return np.log(prices / prices.shift(1))


def estimate_market_model(
    security_returns: pd.Series,
    market_returns: pd.Series,
) -> Tuple[float, float]:
    """
    Estimate the Market Model parameters (α, β) using OLS.

    The Market Model (equation 3 from the research paper):
    ─────────────────────────────────────────────────────
        R_it = α_i + β_i · R_mt + ε_it

    Where:
        R_it  = return on security i for period t
        R_mt  = return on the market portfolio for period t
        α_i   = intercept (security-specific excess return)
        β_i   = slope (sensitivity to market movements)
        ε_it  = zero-mean disturbance term (what we want to isolate)

    Implementation (vectorised):
    ───────────────────────────
        We construct the regression matrix X and solve via least squares:

        X = [ι, R_m]    where ι is a column of ones (intercept term)
        θ = [α, β]      parameter vector

        Solve: X @ θ ≈ R_i   →   θ = (X'X)^{-1} X'R_i

        We use np.linalg.lstsq which is numerically stable and handles
        rank-deficient matrices gracefully.

    Parameters
    ----------
    security_returns : pd.Series
        Daily log returns for the security (estimation window).
    market_returns : pd.Series
        Daily log returns for the market (estimation window, aligned).

    Returns
    -------
    tuple : (α_hat, β_hat) — OLS parameter estimates
    """
    # ── Align and drop NaN rows ──
    # Both series must have valid observations on the same dates
    combined = pd.concat([security_returns, market_returns], axis=1).dropna()

    if len(combined) < MIN_ESTIMATION_DAYS:
        # Insufficient data for reliable estimation
        return np.nan, np.nan

    R_i = combined.iloc[:, 0].values   # Security returns vector  (N × 1)
    R_m = combined.iloc[:, 1].values   # Market returns vector    (N × 1)

    # ── Build the design matrix X = [ι, R_m] ──
    # Column 0: intercept (ones vector ι)
    # Column 1: market returns R_m
    # Shape: (N, 2)
    X = np.column_stack([np.ones(len(R_m)), R_m])

    # ── Solve OLS via least squares ──
    # np.linalg.lstsq finds θ that minimises ||X @ θ - R_i||²
    # Returns: (solution, residuals, rank, singular_values)
    theta, _, _, _ = np.linalg.lstsq(X, R_i, rcond=None)

    alpha_hat = theta[0]   # α̂_i — intercept
    beta_hat = theta[1]    # β̂_i — market sensitivity

    return alpha_hat, beta_hat


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  3. ABNORMAL RETURN — Residual Calculation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def compute_abnormal_returns(
    security_returns: pd.Series,
    market_returns: pd.Series,
    alpha: float,
    beta: float,
) -> pd.Series:
    """
    Compute abnormal returns during the event window.

    The Abnormal Return Equation (equation 4 from the research paper):
    ──────────────────────────────────────────────────────────────────
        ε̂*_i = R*_i − α̂_i − β̂_i · R*_m

    In matrix notation:
        ε̂*_i = R*_i − X*_i · θ̂_i

    Where:
        R*_i  = vector of event-window security returns
        R*_m  = vector of event-window market returns
        X*_i  = [ι, R*_m]  (design matrix for event window)
        θ̂_i  = [α̂_i, β̂_i]  (estimated from the estimation window)

    The abnormal return isolates the return that CANNOT be explained
    by the market. If the event (momentum shock / insider buy) has
    predictive power, these residuals should be systematically positive.

    Parameters
    ----------
    security_returns : pd.Series
        Daily log returns for the security (event window).
    market_returns : pd.Series
        Daily log returns for the market (event window, aligned).
    alpha : float
        Estimated intercept from the Market Model.
    beta : float
        Estimated market sensitivity from the Market Model.

    Returns
    -------
    pd.Series : daily abnormal returns (ε̂*) over the event window
    """
    # ── Predicted (normal) return using the Market Model ──
    # E[R_it] = α̂_i + β̂_i · R_mt
    predicted_return = alpha + beta * market_returns

    # ── Abnormal return = actual - predicted ──
    # ε̂*_i = R*_i - (α̂_i + β̂_i · R*_m)
    abnormal = security_returns - predicted_return

    return abnormal


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  4. CAR — Cumulative Abnormal Return
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def compute_car(abnormal_returns: pd.Series) -> float:
    """
    Compute the Cumulative Abnormal Return (CAR) over the event window.

    The CAR Equation (equation 5 from the research paper):
    ──────────────────────────────────────────────────────
        CAR_i(τ₁, τ₂) = γ' · ε̂*_i

    Where:
        γ   = selection vector with ones in positions τ₁…τ₂, zeroes elsewhere
        ε̂*_i = vector of daily abnormal returns

    Since we pass ONLY the event-window abnormal returns to this function,
    γ is simply a vector of all ones with length = event window.

    Therefore:  CAR = γ' · ε̂* = Σ ε̂*_t   (sum of daily abnormal returns)

    Implementation:
        CAR = np.ones(len(ar)) @ ar.values
        Which is equivalent to ar.sum(), but expressed as the dot product
        with the γ vector for mathematical consistency with the paper.

    Parameters
    ----------
    abnormal_returns : pd.Series
        Daily abnormal returns over the event window.

    Returns
    -------
    float : CAR value (in decimal form, e.g. 0.05 = 5%)
    """
    # ── Construct the γ selection vector ──
    # All ones because the entire input IS the event window [τ₁, τ₂]
    gamma = np.ones(len(abnormal_returns))

    # ── CAR = γ' · ε̂* (dot product) ──
    # This sums the daily abnormal returns across the event window
    car = gamma @ abnormal_returns.values

    return float(car)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  5. EVENT TRIGGER DETECTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def detect_momentum_shocks(df: pd.DataFrame) -> pd.Series:
    """
    Detect Momentum Shock events using vectorised boolean logic.

    Trigger condition:
    ─────────────────
        The composite_momentum_score transitions from < 0 to > 1.0
        within a 2-day lookback period.

        Formally:
            event_t = True  IFF  score_t > 1.0
                              AND (score_{t-1} < 0  OR  score_{t-2} < 0)

    This captures the case where a ticker's momentum "flips" from
    negative sentiment to strongly positive in a very short window —
    a potential leading indicator of a sustained move.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain 'composite_momentum_score' column.

    Returns
    -------
    pd.Series : boolean mask (True = momentum shock event)
    """
    score = df["composite_momentum_score"]

    # ── Current day: score exceeds +1.0 (strong positive) ──
    current_strong = score > 1.0

    # ── Lookback: score was negative within the prior 2 days ──
    # shift(1) = yesterday, shift(2) = day before yesterday
    was_negative_1d = score.shift(1) < 0
    was_negative_2d = score.shift(2) < 0
    was_recently_negative = was_negative_1d | was_negative_2d

    # ── Trigger: strong today AND recently negative ──
    shock_mask = current_strong & was_recently_negative

    # Fill NaN from shifts with False
    shock_mask = shock_mask.fillna(False).astype(bool)

    return shock_mask


def detect_insider_buys(df: pd.DataFrame) -> pd.Series:
    """
    Detect Insider Buy events.

    Trigger condition:
    ─────────────────
        insider_buy == True

    This is a direct boolean from SEC Form 4 filings (or mock data).

    Parameters
    ----------
    df : pd.DataFrame
        Must contain 'insider_buy' boolean column.

    Returns
    -------
    pd.Series : boolean mask (True = insider buy event)
    """
    return df["insider_buy"].fillna(False).astype(bool)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  6. MAX DRAWDOWN — Event Window Metric
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def compute_max_drawdown(cumulative_returns: np.ndarray) -> float:
    """
    Compute the maximum drawdown from a cumulative return curve.

    Max Drawdown = largest peak-to-trough decline during the event window.

    Formula:
    ────────
        running_max_t = max(cumret_0, cumret_1, …, cumret_t)
        drawdown_t    = cumret_t - running_max_t
        max_drawdown  = min(drawdown_0, drawdown_1, …, drawdown_T)

    Uses np.maximum.accumulate for O(n) vectorised computation.

    Parameters
    ----------
    cumulative_returns : np.ndarray
        Cumulative return series (e.g. [0.01, 0.03, 0.02, -0.01, …])

    Returns
    -------
    float : maximum drawdown (negative number, e.g. -0.05 = -5%)
    """
    if len(cumulative_returns) == 0:
        return 0.0

    # ── Running maximum (high water mark) ──
    running_max = np.maximum.accumulate(cumulative_returns)

    # ── Drawdown at each point = current - peak ──
    drawdown = cumulative_returns - running_max

    # ── Maximum drawdown = worst point ──
    return float(np.min(drawdown))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  7. FULL EVENT STUDY PIPELINE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def run_event_study(
    data: Dict[str, pd.DataFrame],
    estimation_window: int = ESTIMATION_WINDOW,
    event_window: int = EVENT_WINDOW,
) -> pd.DataFrame:
    """
    Execute the full CAR event study across all tickers and both event types.

    Pipeline per event occurrence:
    ──────────────────────────────
        1. Detect event at date t
        2. Extract estimation window [t - estimation_window, t - 1]
        3. Compute log returns for security and market
        4. Estimate Market Model (α̂, β̂) via OLS on estimation window
        5. Extract event window [t, t + event_window - 1]
        6. Compute abnormal returns ε̂* = R* - α̂ - β̂ · R*_m
        7. Aggregate to CAR = γ' · ε̂*
        8. Compute max drawdown over event window
        9. Record: (ticker, event_type, event_date, CAR, max_drawdown)

    Parameters
    ----------
    data : dict
        {ticker: pd.DataFrame} with columns: Close, market_close,
        insider_buy, composite_momentum_score.
    estimation_window : int
        Number of trading days for the Market Model estimation.
    event_window : int
        Number of forward trading days for CAR measurement.

    Returns
    -------
    pd.DataFrame : individual event results with columns:
        ticker, event_type, event_date, alpha, beta, car, max_drawdown
    """
    all_events: List[dict] = []

    for ticker, df in data.items():
        print(f"\n  ── {ticker} ({len(df)} trading days) ──")

        # ── Pre-compute log returns for the entire series ──
        # These are reused for every event on this ticker
        security_returns = compute_log_returns(df["Close"])
        market_returns = compute_log_returns(df["market_close"])

        # Forward-fill any NaN in returns (graceful NaN handling)
        security_returns = security_returns.ffill()
        market_returns = market_returns.ffill()

        # ── Detect both event types ──
        momentum_shocks = detect_momentum_shocks(df)
        insider_buys = detect_insider_buys(df)

        event_map = {
            "Momentum Shock": momentum_shocks,
            "Insider Buy": insider_buys,
        }

        for event_type, event_mask in event_map.items():
            # Get integer positions of event dates
            event_indices = np.where(event_mask.values)[0]
            n_events = len(event_indices)

            if n_events == 0:
                print(f"    {event_type}: 0 events detected")
                continue

            print(f"    {event_type}: {n_events} events detected")

            # ── Process each event ──
            processed = 0
            for idx in event_indices:
                # ── Window boundaries (integer-indexed) ──
                est_start = idx - estimation_window  # estimation window start
                est_end = idx - 1                     # estimation window end (day before event)
                evt_start = idx                       # event window start (event day)
                evt_end = idx + event_window - 1      # event window end

                # ── Boundary checks ──
                if est_start < 0:
                    continue  # not enough history for estimation
                if evt_end >= len(df):
                    continue  # not enough forward data for event window

                # ── Extract estimation window returns ──
                est_sec_ret = security_returns.iloc[est_start:est_end + 1]
                est_mkt_ret = market_returns.iloc[est_start:est_end + 1]

                # ── Step 4: Estimate Market Model (α̂, β̂) ──
                alpha_hat, beta_hat = estimate_market_model(est_sec_ret, est_mkt_ret)

                if np.isnan(alpha_hat) or np.isnan(beta_hat):
                    continue  # insufficient estimation data

                # ── Extract event window returns ──
                evt_sec_ret = security_returns.iloc[evt_start:evt_end + 1]
                evt_mkt_ret = market_returns.iloc[evt_start:evt_end + 1]

                # ── Step 6: Compute abnormal returns ──
                ar = compute_abnormal_returns(evt_sec_ret, evt_mkt_ret, alpha_hat, beta_hat)

                # Drop any NaN in abnormal returns (graceful handling)
                ar = ar.dropna()
                if len(ar) < 5:
                    continue  # too few valid observations

                # ── Step 7: Compute CAR ──
                car = compute_car(ar)

                # ── Step 8: Compute max drawdown from cumulative AR ──
                cum_ar = ar.values.cumsum()
                mdd = compute_max_drawdown(cum_ar)

                all_events.append({
                    "ticker": ticker,
                    "event_type": event_type,
                    "event_date": df.index[idx],
                    "alpha": round(alpha_hat, 6),
                    "beta": round(beta_hat, 4),
                    "car": round(car, 6),
                    "max_drawdown": round(mdd, 6),
                })
                processed += 1

            print(f"    {event_type}: {processed}/{n_events} events processed (valid windows)")

    # ── Build results DataFrame ──
    if not all_events:
        print("\n  ⚠ No valid events found across any tickers.")
        return pd.DataFrame(columns=[
            "ticker", "event_type", "event_date", "alpha", "beta", "car", "max_drawdown"
        ])

    results = pd.DataFrame(all_events)
    print(f"\n  ✓ Total events processed: {len(results)}")

    return results


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  8. SUMMARY STATISTICS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def build_summary(event_results: pd.DataFrame) -> pd.DataFrame:
    """
    Build a clean statistical summary DataFrame from individual event results.

    Output columns per event type:
    ──────────────────────────────
        Total Events       — count of valid event occurrences
        Win Rate (%)       — percentage of events with CAR > 0
        Average CAR (%)    — mean CAR across all events of this type
        Median CAR (%)     — median CAR (robust to outliers)
        Std Dev CAR (%)    — standard deviation of CAR
        Max CAR (%)        — best single-event CAR
        Min CAR (%)        — worst single-event CAR
        Avg Max Drawdown (%) — average max drawdown during event window

    Parameters
    ----------
    event_results : pd.DataFrame
        Output from run_event_study() with columns:
        ticker, event_type, event_date, alpha, beta, car, max_drawdown

    Returns
    -------
    pd.DataFrame : summary table with event types as columns
    """
    if event_results.empty:
        return pd.DataFrame({"No Events": ["N/A"]})

    summary_rows = {}

    for event_type in event_results["event_type"].unique():
        subset = event_results[event_results["event_type"] == event_type]
        cars = subset["car"].values
        mdds = subset["max_drawdown"].values

        # Convert to percentage for readability
        # (log returns are already in decimal form, × 100 for %)
        summary_rows[event_type] = {
            "Total Events": len(subset),
            "Win Rate (%)": round(100.0 * np.mean(cars > 0), 1),
            "Average CAR (%)": round(100.0 * np.mean(cars), 2),
            "Median CAR (%)": round(100.0 * np.median(cars), 2),
            "Std Dev CAR (%)": round(100.0 * np.std(cars), 2),
            "Max CAR (%)": round(100.0 * np.max(cars), 2),
            "Min CAR (%)": round(100.0 * np.min(cars), 2),
            "Avg Max Drawdown (%)": round(100.0 * np.mean(mdds), 2),
        }

    summary_df = pd.DataFrame(summary_rows)
    return summary_df


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MAIN — Run the Event Study
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == "__main__":
    print("=" * 70)
    print("  EVENT STUDY — Cumulative Abnormal Return (CAR) Analysis")
    print("  Sandbox: Canadian Resource Equities")
    print("  Methodology: Market Model → Abnormal Returns → CAR")
    print("=" * 70)

    # ────────────────────────────────────────────────
    #  Run with MOCK data (deterministic, reproducible)
    # ────────────────────────────────────────────────
    print("\n" + "─" * 70)
    print("  PHASE 1: Mock Data Event Study (seed=42)")
    print("─" * 70)

    mock_data = generate_mock_data()
    event_results = run_event_study(mock_data)

    print("\n" + "─" * 70)
    print("  INDIVIDUAL EVENT RESULTS (first 20)")
    print("─" * 70)
    if not event_results.empty:
        display_df = event_results.copy()
        display_df["car_pct"] = (display_df["car"] * 100).round(2)
        display_df["mdd_pct"] = (display_df["max_drawdown"] * 100).round(2)
        print(display_df[["ticker", "event_type", "event_date", "alpha", "beta",
                          "car_pct", "mdd_pct"]].head(20).to_string(index=False))

    print("\n" + "=" * 70)
    print("  SUMMARY STATISTICS")
    print("=" * 70)
    summary = build_summary(event_results)
    print(summary.to_string())

    # ────────────────────────────────────────────────
    #  Run with LIVE data (optional — uncomment to use)
    # ────────────────────────────────────────────────
    # print("\n" + "─" * 70)
    # print("  PHASE 2: Live yfinance Data Event Study")
    # print("─" * 70)
    # live_data = fetch_live_data()
    # if live_data:
    #     live_results = run_event_study(live_data)
    #     print("\n" + "=" * 70)
    #     print("  LIVE DATA SUMMARY")
    #     print("=" * 70)
    #     live_summary = build_summary(live_results)
    #     print(live_summary.to_string())

    print("\n" + "=" * 70)
    print("  ✓ Event study complete.")
    print("=" * 70)
