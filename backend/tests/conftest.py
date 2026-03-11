"""
conftest.py — Pytest fixtures for the MOMENTUM backend test suite
==================================================================
Provides frozen OHLCV data loaded from CSV to prevent test drift.
All tests use deterministic, static data — no live yfinance calls.
"""

import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Add pipelines to path so we can import the quant modules directly
BACKEND_DIR = Path(__file__).parent.parent
PIPELINES_DIR = BACKEND_DIR / "pipelines"
sys.path.insert(0, str(PIPELINES_DIR))

# Set CWD for DB path resolution (some modules use relative paths)
os.chdir(PIPELINES_DIR)


@pytest.fixture(scope="session")
def aapl_ohlcv() -> pd.DataFrame:
    """
    Load frozen 200-day AAPL OHLCV data.
    This fixture is session-scoped (loaded once per test run).
    """
    csv_path = Path(__file__).parent / "fixtures" / "aapl_200d.csv"
    assert csv_path.exists(), f"Test fixture not found: {csv_path}"

    df = pd.read_csv(csv_path, parse_dates=["Date"], index_col="Date")
    # Normalise column names to match yfinance output
    df.columns = ["Open", "High", "Low", "Close", "Volume"]
    df = df.sort_index()

    assert len(df) == 200, f"Expected 200 rows, got {len(df)}"
    assert not df.isnull().any().any(), "Fixture contains NaN values"
    return df


@pytest.fixture(scope="session")
def aapl_ohlcv_short(aapl_ohlcv) -> pd.DataFrame:
    """First 50 rows — too short for screening (< 100 rows)."""
    return aapl_ohlcv.iloc[:50]


@pytest.fixture(scope="session")
def aapl_ohlcv_full(aapl_ohlcv) -> pd.DataFrame:
    """Full 200 rows — sufficient for all indicators."""
    return aapl_ohlcv
