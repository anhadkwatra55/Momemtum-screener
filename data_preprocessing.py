"""
data_preprocessing.py — Stationarity & Volatility Estimation
=============================================================
1. Log-price transform → Fixed-Width Fractional Differentiation (FFD).
2. Garman-Klass volatility from OHLC data.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller

import config as cfg


# ═══════════════════════════════════════════════
#  FRACTIONAL DIFFERENTIATION (FFD)
# ═══════════════════════════════════════════════

def _get_weights_ffd(d: float, thresh: float = cfg.FRACDIFF_WEIGHT_THRESH) -> np.ndarray:
    """
    Compute the weights for the fixed-width-window fractional differencing
    operator of order *d*.

    The binomial-series weights are:
        w_0 = 1
        w_k = -w_{k-1} * (d - k + 1) / k     for k ≥ 1

    We truncate when |w_k| < *thresh* to keep a finite window.

    Returns
    -------
    np.ndarray of shape (K, 1) — the vector of weights (newest → oldest).
    """
    weights: list[float] = [1.0]
    k = 1
    while True:
        w = -weights[-1] * (d - k + 1) / k
        if abs(w) < thresh:
            break
        weights.append(w)
        k += 1
    return np.array(weights[::-1]).reshape(-1, 1)   # oldest-first


def frac_diff_ffd(series: pd.Series, d: float,
                  thresh: float = cfg.FRACDIFF_WEIGHT_THRESH) -> pd.Series:
    """
    Apply fixed-width fractional differentiation of order *d* to a (log-)price
    series.

    Parameters
    ----------
    series : pd.Series
        The input time series (should already be log-transformed).
    d      : float in (0, 1)
        The fractional differencing order.
    thresh : float
        Weight truncation threshold.

    Returns
    -------
    pd.Series — the fractionally differenced series, NaN-padded at the start.
    """
    weights = _get_weights_ffd(d, thresh)
    width = len(weights)
    result = pd.Series(index=series.index, dtype=float)
    # Apply convolution of weights with the log-price window
    for i in range(width - 1, len(series)):
        window = series.iloc[i - width + 1: i + 1].values
        result.iloc[i] = np.dot(weights.T, window).item()
    return result


def find_optimal_d(series: pd.Series,
                   d_min: float = cfg.FRACDIFF_D_MIN,
                   d_max: float = cfg.FRACDIFF_D_MAX,
                   d_step: float = cfg.FRACDIFF_D_STEP,
                   p_thresh: float = cfg.FRACDIFF_ADF_PVALUE) -> float:
    """
    Grid-search for the smallest *d* that makes the fractionally-differenced
    series stationary (ADF p-value ≤ *p_thresh*).

    We want to preserve as much **memory** (auto-correlation with the original
    price level) as possible, hence we pick the *minimum* d that achieves
    stationarity.

    Returns
    -------
    float — the optimal differencing order d*.
    """
    log_series = np.log(series.replace(0, np.nan)).dropna()

    for d in np.arange(d_min, d_max + d_step, d_step):
        fd = frac_diff_ffd(log_series, d).dropna()
        if len(fd) < 30:
            continue
        adf_pvalue = adfuller(fd, maxlag=1, regression="c", autolag=None)[1]
        if adf_pvalue <= p_thresh:
            return round(d, 2)

    # Fallback: full first-difference is always stationary
    return 1.0


# ═══════════════════════════════════════════════
#  GARMAN-KLASS VOLATILITY
# ═══════════════════════════════════════════════

def garman_klass_volatility(
    open_: pd.Series,
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    window: int = cfg.WINDOW_VOL,
) -> pd.Series:
    """
    Compute rolling Garman-Klass volatility.

    σ² = (1/n) Σ [ ½·(ln H/L)² − (2·ln2 − 1)·(ln C/O)² ]

    This estimator is superior to close-to-close variance because it captures
    intra-day range *and* accounts for overnight gaps via the Open.

    Parameters
    ----------
    open_, high, low, close : pd.Series  — OHLC price series.
    window : int — rolling window size.

    Returns
    -------
    pd.Series — rolling annualised Garman-Klass volatility (σ, not σ²).
    """
    log_hl = np.log(high / low)
    log_co = np.log(close / open_)

    gk_var = 0.5 * log_hl ** 2 - (2 * np.log(2) - 1) * log_co ** 2

    rolling_var = gk_var.rolling(window=window).mean()

    # Annualise: multiply variance by trading days, then take √
    annualised_vol = np.sqrt(rolling_var * cfg.TRADING_DAYS_PER_YEAR)
    annualised_vol.name = "GK_Vol"
    return annualised_vol
