"""
screener.py — Pipeline Orchestrator
=====================================
Chains: universe filter → preprocessing → signal generation → risk gates
        → correlation pruning → final ranked output.
"""

from __future__ import annotations

import warnings
from typing import Dict, List

import numpy as np
import pandas as pd

import config as cfg
from data_preprocessing import (
    find_optimal_d,
    frac_diff_ffd,
    garman_klass_volatility,
)
from risk import (
    correlation_prune,
    excess_kurtosis,
    information_ratio,
    passes_kurtosis_check,
    passes_liquidity_gate,
    passes_market_cap_filter,
)
from signals import (
    REGIME_NAMES,
    fit_hmm_regime,
    rolling_beta_residual_zscore,
    sliding_hurst,
)

warnings.filterwarnings("ignore")


def screen_universe(
    ohlcv: Dict[str, pd.DataFrame],
    benchmark_data: Dict[str, pd.DataFrame],
    metadata: pd.DataFrame,
) -> pd.DataFrame:
    """
    Run the full screening pipeline.

    Parameters
    ----------
    ohlcv : dict
        {ticker: DataFrame} with columns [Open, High, Low, Close, Volume].
        Index = DatetimeIndex.
    benchmark_data : dict
        {"SPY": DataFrame, "XIU": DataFrame} with at least a "Close" column.
    metadata : pd.DataFrame
        Index = ticker; columns = [exchange, sector, market_cap].

    Returns
    -------
    pd.DataFrame — one row per surviving ticker with signal details.
    """
    results: List[dict] = []

    for ticker, df in ohlcv.items():
        if ticker not in metadata.index:
            continue

        meta = metadata.loc[ticker]
        exchange = meta["exchange"]
        sector = meta["sector"]
        market_cap = meta["market_cap"]

        # ──────────────── 1. Universe Filter ────────────────
        last_close = df["Close"].iloc[-1]
        if not (cfg.PRICE_MIN <= last_close <= cfg.PRICE_MAX):
            continue
        if exchange not in cfg.EXCHANGES:
            continue

        # ──────────────── 2. Risk Gates (early exit) ────────
        avg_vol_20 = df["Volume"].iloc[-cfg.WINDOW_ADV:].mean()
        if not passes_liquidity_gate(last_close, avg_vol_20):
            continue
        if not passes_market_cap_filter(market_cap):
            continue

        # Log-returns
        log_ret = np.log(df["Close"] / df["Close"].shift(1)).dropna()
        if len(log_ret) < cfg.WINDOW_HMM:
            continue

        if not passes_kurtosis_check(log_ret):
            continue

        # ──────────────── 3. Preprocessing ──────────────────
        log_prices = np.log(df["Close"])
        d_star = find_optimal_d(df["Close"])
        _frac = frac_diff_ffd(log_prices, d_star).dropna()

        gk_vol = garman_klass_volatility(
            df["Open"], df["High"], df["Low"], df["Close"]
        )
        last_gk_vol = gk_vol.dropna().iloc[-1] if len(gk_vol.dropna()) > 0 else np.nan

        # ──────────────── 4. Benchmark alignment ────────────
        bench_ticker = cfg.BENCHMARK_MAP.get(exchange, "SPY")
        bench_df = benchmark_data.get(bench_ticker)
        if bench_df is None:
            continue
        bench_ret = np.log(bench_df["Close"] / bench_df["Close"].shift(1)).dropna()

        # ──────────────── 5. Pillar 1 — Z-Score ─────────────
        zscore_df = rolling_beta_residual_zscore(log_ret, bench_ret)
        last_z = zscore_df["residual_zscore"].dropna().iloc[-1] if len(zscore_df["residual_zscore"].dropna()) > 0 else 0.0
        z_signal = zscore_df["zscore_signal"].dropna().iloc[-1] if len(zscore_df["zscore_signal"].dropna()) > 0 else 0
        last_beta = zscore_df["rolling_beta"].dropna().iloc[-1] if len(zscore_df["rolling_beta"].dropna()) > 0 else np.nan

        # ──────────────── 6. Pillar 2 — HMM Regime ─────────
        regime, state_seq, hmm_model = fit_hmm_regime(log_ret, df["Volume"])
        regime_name = REGIME_NAMES.get(regime, "Unknown")

        # Veto long signals in Chaotic regime
        if regime == 2 and z_signal == -1:
            z_signal = 0      # suppress long

        # ──────────────── 7. Pillar 3 — Hurst ──────────────
        hurst_df = sliding_hurst(log_ret)
        last_hurst = hurst_df["hurst"].dropna().iloc[-1] if len(hurst_df["hurst"].dropna()) > 0 else np.nan
        last_hurst_delta = hurst_df["hurst_delta"].dropna().iloc[-1] if len(hurst_df["hurst_delta"].dropna()) > 0 else np.nan
        hurst_sig = hurst_df["hurst_signal"].dropna().iloc[-1] if len(hurst_df["hurst_signal"].dropna()) > 0 else "neutral"

        # Skip random-walk tickers
        if hurst_sig == "neutral":
            continue

        # ──────────────── 8. Signal present? ────────────────
        has_signal = (z_signal != 0) or (hurst_sig != "neutral")
        if not has_signal:
            continue

        # ──────────────── 9. Information Ratio ──────────────
        ir = information_ratio(log_ret, bench_ret)

        # ──────────────── 10. Excess Kurtosis (record) ─────
        ek = excess_kurtosis(log_ret)

        # Composite signal label
        if z_signal == 1:
            signal_label = "SHORT (Z > 2.5)"
        elif z_signal == -1:
            signal_label = "LONG (Z < -2.5)"
        elif hurst_sig == "mean_revert":
            signal_label = "MEAN_REVERT (Hurst)"
        elif hurst_sig == "trending":
            signal_label = "TREND (Hurst)"
        else:
            signal_label = "SIGNAL"

        results.append({
            "Ticker":       ticker,
            "Exchange":     exchange,
            "Sector":       sector,
            "Price":        round(last_close, 2),
            "Signal":       signal_label,
            "Z_Score":      round(last_z, 3),
            "Beta":         round(last_beta, 3) if np.isfinite(last_beta) else np.nan,
            "Hurst":        round(last_hurst, 3) if np.isfinite(last_hurst) else np.nan,
            "Hurst_Delta":  round(last_hurst_delta, 4) if np.isfinite(last_hurst_delta) else np.nan,
            "Regime":       regime_name,
            "GK_Vol":       round(last_gk_vol, 4) if np.isfinite(last_gk_vol) else np.nan,
            "IR":           round(ir, 3),
            "Kurtosis":     round(ek, 2) if np.isfinite(ek) else np.nan,
            "FracDiff_d":   d_star,
            "Liquidity_OK": True,
            "MarketCap":    market_cap,
        })

    if not results:
        return pd.DataFrame()

    out = pd.DataFrame(results).set_index("Ticker")

    # ──────────────── 11. Correlation Pruning ───────────────
    # Build residual-returns matrix for survivors
    surviving_tickers = out.index.tolist()
    if len(surviving_tickers) > 1:
        resid_matrix = pd.DataFrame()
        for t in surviving_tickers:
            if t in ohlcv:
                lr = np.log(ohlcv[t]["Close"] / ohlcv[t]["Close"].shift(1)).dropna()
                resid_matrix[t] = lr

        ir_scores = out["IR"]
        sector_labels = out["Sector"]

        pruned = correlation_prune(resid_matrix, ir_scores, sector_labels)
        out = out.loc[out.index.isin(pruned)]

    # Sort by |IR| descending
    out = out.sort_values("IR", key=abs, ascending=False)

    return out
