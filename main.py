#!/usr/bin/env python3
"""
main.py — Entry Point & Synthetic Data Demo
=============================================
Generates realistic synthetic OHLCV data for US and Canadian tickers,
runs the full screening pipeline, and prints the results.

Usage:
    python main.py
"""

from __future__ import annotations

import sys
import warnings

import numpy as np
import pandas as pd

import config as cfg
from screener import screen_universe

warnings.filterwarnings("ignore")

np.random.seed(42)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  SYNTHETIC DATA GENERATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TICKERS_US = [
    ("ACME",  "NYSE",   "Industrials",      800_000_000),
    ("BOLT",  "NASDAQ", "Technology",        1_200_000_000),
    ("CRUX",  "NYSE",   "Technology",        650_000_000),
    ("DYNA",  "NASDAQ", "Healthcare",        2_100_000_000),
    ("ECHO",  "NYSE",   "Financials",        900_000_000),
    ("FLUX",  "NASDAQ", "Industrials",       500_000_000),
    ("GRIT",  "NYSE",   "Energy",            1_600_000_000),
    ("HALO",  "NASDAQ", "Technology",        3_000_000_000),
    ("IOTA",  "NYSE",   "Consumer_Disc",     750_000_000),
    ("JADE",  "NASDAQ", "Healthcare",        420_000_000),
    # Penny-stock trap (should be filtered out)
    ("PNNY",  "NYSE",   "Financials",        100_000_000),
    # Illiquid ticker (should be filtered out)
    ("THIN",  "NASDAQ", "Industrials",       350_000_000),
]

TICKERS_CAD = [
    ("NORD", "TSX", "Materials",    1_400_000_000),
    ("PINE", "TSX", "Energy",       900_000_000),
    ("QUBE", "TSX", "Technology",   600_000_000),
]

ALL_TICKERS = TICKERS_US + TICKERS_CAD
BENCHMARKS = ["SPY", "XIU"]

N_DAYS = 504   # ~2 years of trading days


def _generate_ohlcv(
    ticker: str,
    n_days: int,
    start_price: float,
    drift: float = 0.0002,
    vol: float = 0.02,
    mean_vol: float = 500_000,
    behaviour: str = "random",
) -> pd.DataFrame:
    """
    Generate synthetic OHLCV data with controlled statistical properties.

    behaviour:
        "random"       — Brownian motion (H ≈ 0.5)
        "mean_revert"  — Ornstein-Uhlenbeck process (H < 0.5)
        "trending"     — Fractional BM approximation (H > 0.5)
        "chaotic"      — Regime-shifting volatility
    """
    dates = pd.bdate_range(end="2026-03-06", periods=n_days)
    closes = np.zeros(n_days)
    closes[0] = start_price

    if behaviour == "mean_revert":
        # Ornstein-Uhlenbeck: dx = θ(μ - x)dt + σ dW
        theta, mu = 0.15, np.log(start_price)
        log_p = mu
        for i in range(1, n_days):
            log_p += theta * (mu - log_p) + vol * np.random.randn()
            closes[i] = np.exp(log_p)
    elif behaviour == "trending":
        # Persistent increments (auto-correlated)
        innovations = np.random.randn(n_days)
        smooth = pd.Series(innovations).ewm(span=5).mean().values
        log_p = np.log(start_price)
        for i in range(1, n_days):
            log_p += drift + vol * 0.7 * smooth[i] + vol * 0.3 * innovations[i]
            closes[i] = np.exp(log_p)
    elif behaviour == "chaotic":
        log_p = np.log(start_price)
        for i in range(1, n_days):
            # Switch vol regime
            if i % 80 < 40:
                local_vol = vol * 3
            else:
                local_vol = vol * 0.5
            log_p += drift * 0.5 + local_vol * np.random.randn()
            closes[i] = np.exp(log_p)
    else:
        # Pure random walk
        log_p = np.log(start_price)
        for i in range(1, n_days):
            log_p += drift + vol * np.random.randn()
            closes[i] = np.exp(log_p)

    # Synthesise OHLC from closes
    daily_range = np.abs(np.random.randn(n_days)) * vol * closes * 0.5
    highs = closes + daily_range
    lows = closes - daily_range
    lows = np.maximum(lows, closes * 0.95)
    opens = closes + np.random.randn(n_days) * vol * closes * 0.3

    # Volume: log-normal with mild auto-correlation
    raw_vol = np.random.lognormal(mean=np.log(mean_vol), sigma=0.4, size=n_days)
    volume = pd.Series(raw_vol).ewm(span=5).mean().values.astype(int)

    return pd.DataFrame({
        "Open": opens, "High": highs, "Low": lows, "Close": closes,
        "Volume": volume,
    }, index=dates)


def build_synthetic_universe() -> tuple:
    """Build OHLCV dict, benchmark dict, and metadata DataFrame."""

    # Assign statistical behaviours to make the demo interesting
    behaviour_map = {
        "ACME": ("mean_revert", 22.0, 0.0001, 0.025, 800_000),
        "BOLT": ("trending",    35.0, 0.0004, 0.018, 1_500_000),
        "CRUX": ("trending",    18.0, 0.0003, 0.020, 600_000),
        "DYNA": ("mean_revert", 42.0, 0.0001, 0.030, 2_000_000),
        "ECHO": ("random",      28.0, 0.0002, 0.022, 1_000_000),
        "FLUX": ("chaotic",     12.0, 0.0001, 0.035, 400_000),
        "GRIT": ("trending",    38.0, 0.0005, 0.028, 1_200_000),
        "HALO": ("random",      45.0, 0.0003, 0.015, 3_000_000),
        "IOTA": ("mean_revert", 15.0, 0.0001, 0.028, 500_000),
        "JADE": ("random",      32.0, 0.0002, 0.020, 700_000),
        "PNNY": ("random",       2.5, 0.0001, 0.050, 200_000),   # penny stock
        "THIN": ("random",      25.0, 0.0001, 0.020,  20_000),   # illiquid
        "NORD": ("mean_revert", 30.0, 0.0001, 0.022, 900_000),
        "PINE": ("trending",    20.0, 0.0004, 0.025, 600_000),
        "QUBE": ("random",      40.0, 0.0002, 0.018, 500_000),
    }

    ohlcv = {}
    for ticker, exchange, sector, mcap in ALL_TICKERS:
        beh, price, drift, vol, mvol = behaviour_map[ticker]
        ohlcv[ticker] = _generate_ohlcv(
            ticker, N_DAYS, start_price=price, drift=drift, vol=vol,
            mean_vol=mvol, behaviour=beh,
        )

    # Benchmarks
    bench = {}
    bench["SPY"] = _generate_ohlcv("SPY", N_DAYS, 450.0, 0.0003, 0.012, 50_000_000)
    bench["XIU"] = _generate_ohlcv("XIU", N_DAYS, 32.0, 0.0002, 0.010, 5_000_000)

    # Metadata
    meta_rows = []
    for ticker, exchange, sector, mcap in ALL_TICKERS:
        meta_rows.append({"ticker": ticker, "exchange": exchange,
                          "sector": sector, "market_cap": mcap})
    metadata = pd.DataFrame(meta_rows).set_index("ticker")

    return ohlcv, bench, metadata


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MAIN
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def main() -> None:
    print("=" * 78)
    print("  NORTH AMERICAN QUANTITATIVE SCREENER  —  Renaissance-Grade Pipeline")
    print("=" * 78)
    print()

    print("[1/2] Generating synthetic OHLCV universe (~2 yrs, 15 tickers + 2 benchmarks)...")
    ohlcv, benchmarks, metadata = build_synthetic_universe()

    print(f"      Universe: {list(ohlcv.keys())}")
    print(f"      Benchmarks: {list(benchmarks.keys())}")
    print(f"      Date range: {list(ohlcv.values())[0].index[0].date()} → "
          f"{list(ohlcv.values())[0].index[-1].date()}")
    print()

    print("[2/2] Running screening pipeline...")
    print("      → Universe filter ($5–$50, NYSE/NASDAQ/TSX)")
    print("      → Risk gates (liquidity, market-cap, kurtosis)")
    print("      → Fractional differentiation (optimal d*)")
    print("      → Pillar 1: Beta-Neutral Residual Z-Score")
    print("      → Pillar 2: Volume-Augmented HMM Regime Filter")
    print("      → Pillar 3: Sliding-Window Hurst Exponent")
    print("      → Correlation pruning (highest IR per sector)")
    print()

    results = screen_universe(ohlcv, benchmarks, metadata)

    if results.empty:
        print("  ⚠  No tickers survived all filters.")
        print("     (This can happen with synthetic data — adjust parameters or re-run.)")
    else:
        # Display columns
        display_cols = [
            "Exchange", "Sector", "Price", "Signal", "Z_Score", "Beta",
            "Hurst", "Hurst_Delta", "Regime", "GK_Vol", "IR", "Kurtosis",
            "FracDiff_d",
        ]
        cols = [c for c in display_cols if c in results.columns]

        print("─" * 78)
        print("  SCREENED SIGNALS  (sorted by |Information Ratio|)")
        print("─" * 78)
        with pd.option_context("display.max_columns", 20, "display.width", 120,
                               "display.float_format", "{:.4f}".format):
            print(results[cols].to_string())
        print("─" * 78)
        print(f"  Total signals: {len(results)}")

    print()
    print("Pipeline complete. See backtest_notes.md for validation methodology.")


if __name__ == "__main__":
    main()
