"""
momentum_data.py — Real-World Market Data via yfinance + SQLite
================================================================
Incremental sync: only downloads missing date ranges from yfinance,
stores everything in SQLite for instant subsequent loads.
"""

from __future__ import annotations

import warnings
from datetime import datetime, timedelta
from typing import Dict, Optional

import numpy as np
import pandas as pd
import yfinance as yf

import db
import momentum_config as cfg

warnings.filterwarnings("ignore")


def smart_fetch(
    tickers: list[str] | None = None,
    start: str | None = None,
    end: str | None = None,
    period: str | None = None,
    progress: bool = True,
) -> Dict[str, pd.DataFrame]:
    """
    Incremental data sync:
    1. Check DB for existing data ranges per ticker
    2. Only download missing date ranges from yfinance
    3. Upsert new rows into DB
    4. Return full requested range from DB

    First run: downloads everything. Subsequent runs: only new days.
    """
    if tickers is None:
        tickers = cfg.ALL_TICKERS

    # Resolve date range
    if end is None:
        end = datetime.now().strftime("%Y-%m-%d")
    if start is None:
        if period:
            days = _period_to_days(period)
        else:
            days = _period_to_days(cfg.DATA_PERIOD)
        start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    # Init DB
    db.init_db()

    # Store ticker metadata
    db.upsert_tickers_bulk(cfg.TICKER_SECTOR)

    # Check what's in DB
    ranges = db.get_data_ranges(tickers)
    to_fetch = []  # (ticker, fetch_start, fetch_end)

    for t in tickers:
        db_min, db_max = ranges.get(t, (None, None))
        if db_min is None:
            # No data at all — full download
            to_fetch.append((t, start, end))
        else:
            # Check if we need earlier data
            if start < db_min:
                to_fetch.append((t, start, db_min))
            # Check if we need newer data
            if end > db_max:
                to_fetch.append((t, db_max, end))

    # Download missing data
    if to_fetch:
        if progress:
            print(f"    Syncing {len(to_fetch)} ticker-ranges (DB has {len(tickers) - len(set(t for t,_,_ in to_fetch))}/{len(tickers)} fully cached) …")
        _download_and_store(to_fetch, progress)
    elif progress:
        print(f"    ✓ All {len(tickers)} tickers served from DB (instant).")

    # Load from DB
    result = db.load_all_ohlcv(tickers, start, end)

    if progress:
        print(f"    ✓ Loaded {len(result)}/{len(tickers)} tickers from DB.")

    return result


def _download_and_store(
    fetch_list: list[tuple[str, str, str]],
    progress: bool = True,
) -> None:
    """Download from yfinance and store in DB."""
    # Group by date range for efficient bulk downloads
    # But often each ticker has the same missing range, so try bulk first
    all_tickers = list(set(t for t, _, _ in fetch_list))

    # Find the widest date range needed
    min_start = min(s for _, s, _ in fetch_list)
    max_end = max(e for _, _, e in fetch_list)

    if progress:
        print(f"    Downloading {len(all_tickers)} tickers ({min_start} → {max_end}) …")

    try:
        raw = yf.download(
            all_tickers,
            start=min_start,
            end=max_end,
            auto_adjust=True,
            progress=progress,
            threads=True,
        )
    except Exception as e:
        if progress:
            print(f"    ⚠ Bulk download failed ({e}). Falling back to individual …")
        raw = None

    stored = 0
    if raw is not None and not raw.empty:
        for ticker in all_tickers:
            try:
                if len(all_tickers) == 1:
                    df = raw.copy()
                else:
                    df = raw[ticker].copy()

                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)

                df = df.dropna(subset=["Close"])
                if len(df) > 0:
                    n = db.upsert_ohlcv(ticker, df)
                    stored += n
            except (KeyError, TypeError):
                pass

    # Fill gaps with individual downloads
    # Check who's still missing
    loaded_tickers = set()
    if raw is not None and not raw.empty:
        for t in all_tickers:
            try:
                if len(all_tickers) == 1:
                    test = raw.dropna(subset=["Close"])
                else:
                    test = raw[t].dropna(subset=["Close"])
                if len(test) > 0:
                    loaded_tickers.add(t)
            except (KeyError, TypeError):
                pass

    missing = [t for t in all_tickers if t not in loaded_tickers]
    if missing:
        if progress:
            print(f"    Re-fetching {len(missing)} missing tickers individually …")
        for t in missing:
            try:
                df = yf.download(t, start=min_start, end=max_end,
                                 auto_adjust=True, progress=False)
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)
                df = df.dropna(subset=["Close"])
                if len(df) > 0:
                    db.upsert_ohlcv(t, df)
                    stored += len(df)
            except Exception:
                pass

    if progress:
        print(f"    ✓ Stored {stored:,} rows in DB.")


def _period_to_days(period: str) -> int:
    """Convert yfinance period string to approximate days."""
    mapping = {
        "1mo": 30, "3mo": 90, "6mo": 180,
        "1y": 365, "2y": 730, "3y": 1095, "5y": 1825,
        "10y": 3650, "max": 7300,
    }
    return mapping.get(period, 365)


# ── Legacy interface (backward compat) ──

def fetch_universe(
    tickers: list[str] | None = None,
    period: str = cfg.DATA_PERIOD,
    progress: bool = True,
    **kwargs,
) -> Dict[str, pd.DataFrame]:
    """Backward-compatible wrapper around smart_fetch."""
    return smart_fetch(tickers=tickers, period=period, progress=progress)
