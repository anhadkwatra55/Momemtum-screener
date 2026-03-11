#!/usr/bin/env python3
"""
dashboard.py — Interactive Web Dashboard for the Quant Screener
================================================================
Runs the full screening pipeline, extracts detailed per-ticker analytics
(price, Z-Score, Hurst, regime, etc.), serialises everything to JSON,
and serves a local dashboard on http://localhost:8050.

Usage:
    python dashboard.py
"""

from __future__ import annotations

import json
import os
import sys
import warnings
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# Pipeline imports
from main import build_synthetic_universe
from screener import screen_universe
from data_preprocessing import find_optimal_d, garman_klass_volatility
from signals import (
    rolling_beta_residual_zscore,
    fit_hmm_regime,
    sliding_hurst,
    REGIME_NAMES,
)
from risk import (
    passes_liquidity_gate,
    passes_market_cap_filter,
    passes_kurtosis_check,
    excess_kurtosis,
    information_ratio,
)
import config as cfg


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  JSON HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class NumpyEncoder(json.JSONEncoder):
    """Handle numpy / pandas types during JSON serialization."""
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            v = float(obj)
            if np.isnan(v) or np.isinf(v):
                return None
            return v
        if isinstance(obj, np.ndarray):
            return [None if (isinstance(x, float) and (np.isnan(x) or np.isinf(x))) else x for x in obj.tolist()]
        if isinstance(obj, pd.Timestamp):
            return obj.strftime("%Y-%m-%d")
        return super().default(obj)


def _safe_float(v, decimals=3):
    """Convert to rounded float; return None for NaN/Inf."""
    try:
        f = float(v)
        if np.isnan(f) or np.isinf(f):
            return None
        return round(f, decimals)
    except (TypeError, ValueError):
        return None


def _subsample(series, n_points=120):
    """Take evenly-spaced points from a series for charting efficiency."""
    step = max(1, len(series) // n_points)
    return series.iloc[::step]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  DETAILED DATA EXTRACTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def extract_dashboard_data() -> dict:
    """Run the full pipeline and extract per-ticker detail for the dashboard."""

    print("[1/3] Generating synthetic universe …")
    ohlcv, benchmarks, metadata = build_synthetic_universe()

    print("[2/3] Running screening pipeline …")
    results = screen_universe(ohlcv, benchmarks, metadata)

    # ── Structures ──
    tickers_detail: dict = {}
    filter_log: list[dict] = []

    funnel_stages = [
        "Universe",
        "Price Filter",
        "Exchange Filter",
        "Liquidity Gate",
        "Market Cap",
        "Kurtosis",
        "Data Length",
        "Hurst Neutral",
        "No Signal",
        "Corr. Pruned",
    ]
    # Track cumulative remaining
    stage_remaining: dict[str, int] = {s: 0 for s in funnel_stages}
    stage_remaining["Universe"] = len(ohlcv)
    removed_at: dict[str, int] = {s: 0 for s in funnel_stages}

    # ── Process each ticker ──────────────────────────
    for ticker, df in ohlcv.items():
        if ticker not in metadata.index:
            continue

        meta = metadata.loc[ticker]
        exchange = str(meta["exchange"])
        sector = str(meta["sector"])
        market_cap = float(meta["market_cap"])
        last_close = float(df["Close"].iloc[-1])

        # Subsampled price / volume for charts
        sub_close = _subsample(df["Close"])
        sub_vol = _subsample(df["Volume"])

        info: dict = {
            "exchange": exchange,
            "sector": sector,
            "market_cap": market_cap,
            "last_price": round(last_close, 2),
            "dates": sub_close.index.strftime("%Y-%m-%d").tolist(),
            "close": [round(float(x), 2) for x in sub_close],
            "volume": [int(x) for x in sub_vol],
            "status": "filtered",
            "filter_reason": "",
        }

        # ── Stage 1: Price ──
        if not (cfg.PRICE_MIN <= last_close <= cfg.PRICE_MAX):
            reason = f"Price ${last_close:.2f} outside ${cfg.PRICE_MIN}–${cfg.PRICE_MAX}"
            info["filter_reason"] = reason
            removed_at["Price Filter"] += 1
            filter_log.append({"ticker": ticker, "stage": "Price Filter", "reason": reason})
            tickers_detail[ticker] = info
            continue

        # ── Stage 2: Exchange ──
        if exchange not in cfg.EXCHANGES:
            reason = f"Exchange '{exchange}' not in allowed list"
            info["filter_reason"] = reason
            removed_at["Exchange Filter"] += 1
            filter_log.append({"ticker": ticker, "stage": "Exchange Filter", "reason": reason})
            tickers_detail[ticker] = info
            continue

        # ── Stage 3: Liquidity ──
        avg_vol_20 = float(df["Volume"].iloc[-cfg.WINDOW_ADV:].mean())
        if not passes_liquidity_gate(last_close, avg_vol_20):
            notional = last_close * avg_vol_20
            reason = f"Notional ${notional:,.0f} < ${cfg.LIQUIDITY_FLOOR:,} floor"
            info["filter_reason"] = reason
            removed_at["Liquidity Gate"] += 1
            filter_log.append({"ticker": ticker, "stage": "Liquidity Gate", "reason": reason})
            tickers_detail[ticker] = info
            continue

        # ── Stage 4: Market Cap ──
        if not passes_market_cap_filter(market_cap):
            reason = f"Mkt Cap ${market_cap/1e6:.0f}M < ${cfg.MARKET_CAP_FLOOR/1e6:.0f}M"
            info["filter_reason"] = reason
            removed_at["Market Cap"] += 1
            filter_log.append({"ticker": ticker, "stage": "Market Cap", "reason": reason})
            tickers_detail[ticker] = info
            continue

        # ── Stage 5: Data length ──
        log_ret = np.log(df["Close"] / df["Close"].shift(1)).dropna()
        if len(log_ret) < cfg.WINDOW_HMM:
            reason = "Insufficient data history"
            info["filter_reason"] = reason
            removed_at["Data Length"] += 1
            tickers_detail[ticker] = info
            continue

        # ── Stage 6: Kurtosis ──
        if not passes_kurtosis_check(log_ret):
            ek = excess_kurtosis(log_ret)
            reason = f"Kurtosis {ek:.1f} > {cfg.KURTOSIS_CEILING} ceiling"
            info["filter_reason"] = reason
            removed_at["Kurtosis"] += 1
            filter_log.append({"ticker": ticker, "stage": "Kurtosis", "reason": reason})
            tickers_detail[ticker] = info
            continue

        # ── Ticker passed risk gates — compute full signals ──
        info["status"] = "analyzed"

        # Benchmark returns
        bench_ticker = cfg.BENCHMARK_MAP.get(exchange, "SPY")
        bench_df = benchmarks.get(bench_ticker)
        if bench_df is None:
            continue
        bench_ret = np.log(bench_df["Close"] / bench_df["Close"].shift(1)).dropna()

        # — Z-Score series —
        zscore_df = rolling_beta_residual_zscore(log_ret, bench_ret)
        z_clean = zscore_df["residual_zscore"].dropna()
        beta_clean = zscore_df["rolling_beta"].dropna()
        z_sub = _subsample(z_clean)
        beta_sub = _subsample(beta_clean)

        info["zscore_dates"] = z_sub.index.strftime("%Y-%m-%d").tolist()
        info["zscore"] = [_safe_float(x) for x in z_sub]
        info["beta_series"] = [_safe_float(x) for x in beta_sub]
        info["last_zscore"] = _safe_float(z_clean.iloc[-1]) if len(z_clean) else None
        info["last_beta"] = _safe_float(beta_clean.iloc[-1]) if len(beta_clean) else None

        # — HMM Regime —
        regime, state_seq, _ = fit_hmm_regime(log_ret, df["Volume"])
        info["regime"] = REGIME_NAMES.get(regime, "Unknown")
        info["regime_id"] = int(regime)
        unique, counts = np.unique(state_seq, return_counts=True)
        info["regime_dist"] = {
            REGIME_NAMES.get(int(u), "Unknown"): int(c)
            for u, c in zip(unique, counts)
        }

        # — Hurst series —
        hurst_df = sliding_hurst(log_ret)
        h_clean = hurst_df["hurst"].dropna()
        h_sub = _subsample(h_clean)
        info["hurst_dates"] = h_sub.index.strftime("%Y-%m-%d").tolist()
        info["hurst_series"] = [_safe_float(x) for x in h_sub]
        info["last_hurst"] = _safe_float(h_clean.iloc[-1]) if len(h_clean) else None
        hd_clean = hurst_df["hurst_delta"].dropna()
        info["last_hurst_delta"] = _safe_float(hd_clean.iloc[-1], 4) if len(hd_clean) else None
        hurst_sig = hurst_df["hurst_signal"].dropna().iloc[-1] if len(hurst_df["hurst_signal"].dropna()) else "neutral"
        info["hurst_signal"] = str(hurst_sig)

        # — GK Vol —
        gk = garman_klass_volatility(df["Open"], df["High"], df["Low"], df["Close"])
        gk_last = gk.dropna().iloc[-1] if len(gk.dropna()) else np.nan
        info["gk_vol"] = _safe_float(gk_last, 4)

        # — FracDiff d* —
        info["fracdiff_d"] = find_optimal_d(df["Close"])

        # — IR —
        info["ir"] = _safe_float(information_ratio(log_ret, bench_ret))

        # — Kurtosis —
        info["kurtosis"] = _safe_float(excess_kurtosis(log_ret), 2)

        # Check final survival
        if ticker in results.index:
            info["status"] = "survived"
            info["signal_label"] = str(results.loc[ticker, "Signal"])
        else:
            if str(hurst_sig) == "neutral":
                info["filter_reason"] = "Hurst ≈ 0.5 (random walk)"
                removed_at["Hurst Neutral"] += 1
            else:
                # Either no Z-Score signal or correlation-pruned
                z_signal = zscore_df["zscore_signal"].dropna()
                last_z_sig = int(z_signal.iloc[-1]) if len(z_signal) else 0
                if last_z_sig == 0 and str(hurst_sig) == "neutral":
                    info["filter_reason"] = "No actionable signal"
                    removed_at["No Signal"] += 1
                else:
                    info["filter_reason"] = "Removed by sector-correlation pruning"
                    removed_at["Corr. Pruned"] += 1

        tickers_detail[ticker] = info

    # ── Build cumulative funnel ──────────────────────
    remaining = stage_remaining["Universe"]
    funnel_data = [{"stage": "Universe", "count": remaining}]
    for s in funnel_stages[1:]:
        remaining -= removed_at[s]
        if removed_at[s] > 0 or s in ("Universe",):
            funnel_data.append({"stage": s, "count": max(remaining, 0), "removed": removed_at[s]})

    # ── Signals table ────────────────────────────────
    signals_list = []
    if not results.empty:
        for ticker in results.index:
            r = results.loc[ticker]
            signals_list.append({
                "ticker": ticker,
                "exchange": str(r.get("Exchange", "")),
                "sector": str(r.get("Sector", "")),
                "price": _safe_float(r.get("Price"), 2),
                "signal": str(r.get("Signal", "")),
                "z_score": _safe_float(r.get("Z_Score")),
                "beta": _safe_float(r.get("Beta")),
                "hurst": _safe_float(r.get("Hurst")),
                "hurst_delta": _safe_float(r.get("Hurst_Delta"), 4),
                "regime": str(r.get("Regime", "")),
                "gk_vol": _safe_float(r.get("GK_Vol"), 4),
                "ir": _safe_float(r.get("IR")),
                "kurtosis": _safe_float(r.get("Kurtosis"), 2),
                "fracdiff_d": _safe_float(r.get("FracDiff_d"), 2),
            })

    # ── Regime distribution (survived tickers) ──────
    regime_counts = {"LowVol_Trend": 0, "HighVol_MR": 0, "Chaotic": 0}
    for s in signals_list:
        r = s["regime"]
        if r in regime_counts:
            regime_counts[r] += 1

    # ── Sector breakdown ─────────────────────────────
    sector_counts = {}
    for s in signals_list:
        sec = s["sector"]
        sector_counts[sec] = sector_counts.get(sec, 0) + 1

    # ── Summary ──────────────────────────────────────
    first_dates = list(ohlcv.values())[0].index
    summary = {
        "total_universe": len(ohlcv),
        "total_survived": len(results),
        "avg_ir": _safe_float(results["IR"].mean()) if len(results) else 0,
        "max_ir": _safe_float(results["IR"].max()) if len(results) else 0,
        "best_ticker": str(results["IR"].abs().idxmax()) if len(results) else "—",
        "date_start": first_dates[0].strftime("%Y-%m-%d"),
        "date_end": first_dates[-1].strftime("%Y-%m-%d"),
    }

    return {
        "summary": summary,
        "signals": signals_list,
        "tickers": tickers_detail,
        "funnel": funnel_data,
        "filter_log": filter_log,
        "regime_distribution": regime_counts,
        "sector_distribution": sector_counts,
        "config": {
            "price_min": cfg.PRICE_MIN,
            "price_max": cfg.PRICE_MAX,
            "zscore_threshold": cfg.ZSCORE_THRESHOLD,
            "hurst_mean_rev": cfg.HURST_MEAN_REV,
            "hurst_trending": cfg.HURST_TRENDING,
            "kurtosis_ceiling": cfg.KURTOSIS_CEILING,
            "liquidity_floor": cfg.LIQUIDITY_FLOOR,
            "market_cap_floor": cfg.MARKET_CAP_FLOOR,
        },
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  SERVE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def main() -> None:
    print("=" * 60)
    print("  QUANT SCREENER — INTERACTIVE DASHBOARD")
    print("=" * 60)
    print()

    data = extract_dashboard_data()

    data_path = Path(__file__).parent / "dashboard_data.json"
    with open(data_path, "w") as f:
        json.dump(data, f, cls=NumpyEncoder)
    print(f"\n✓ Data written to {data_path.name}")

    port = 8050
    os.chdir(Path(__file__).parent)

    url = f"http://localhost:{port}/dashboard.html"
    print(f"✓ Dashboard available at {url}")
    print("  Press Ctrl+C to stop.\n")

    handler = SimpleHTTPRequestHandler
    httpd = HTTPServer(("", port), handler)

    webbrowser.open(url)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n✓ Dashboard stopped.")
        httpd.server_close()


if __name__ == "__main__":
    main()
