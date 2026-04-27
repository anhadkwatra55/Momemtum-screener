"""
validators.py — Pydantic Data Validation for Financial Data
=============================================================
Compliance-grade validation layer for yfinance OHLCV data. Catches NaN values,
missing splits, dividend anomalies, and structural issues before they can
corrupt the 4-system momentum indicators.

All validation is non-destructive: it flags problems and optionally cleans them,
but never silently mutates the original math.
"""

from __future__ import annotations

import warnings
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field, field_validator, model_validator


# ═══════════════════════════════════════════════════════════
#  SINGLE-BAR VALIDATION
# ═══════════════════════════════════════════════════════════

class OHLCVBar(BaseModel):
    """Validates a single OHLCV bar (one trading day)."""

    date: str = Field(..., description="Trading date (YYYY-MM-DD)")
    open: float = Field(..., gt=0, description="Opening price (must be > 0)")
    high: float = Field(..., gt=0, description="High of day (must be > 0)")
    low: float = Field(..., gt=0, description="Low of day (must be > 0)")
    close: float = Field(..., gt=0, description="Closing price (must be > 0)")
    volume: int = Field(..., ge=0, description="Trading volume (must be ≥ 0)")

    @model_validator(mode="after")
    def validate_hloc_relationships(self):
        """High must be >= Low, and both must bound Open and Close."""
        if self.high < self.low:
            raise ValueError(
                f"High ({self.high}) < Low ({self.low}) on {self.date}"
            )
        if self.high < max(self.open, self.close):
            raise ValueError(
                f"High ({self.high}) < max(Open, Close) on {self.date}"
            )
        if self.low > min(self.open, self.close):
            raise ValueError(
                f"Low ({self.low}) > min(Open, Close) on {self.date}"
            )
        return self


class OHLCVSeriesConfig(BaseModel):
    """Configuration for series-level validation thresholds."""

    max_nan_ratio: float = Field(
        default=0.05, ge=0, le=1,
        description="Maximum allowable NaN ratio (default 5%)"
    )
    max_gap_pct: float = Field(
        default=50.0, gt=0,
        description="Maximum single-day price change % before flagging as split anomaly"
    )
    min_rows: int = Field(
        default=50, gt=0,
        description="Minimum rows required for valid analysis"
    )
    max_zero_volume_ratio: float = Field(
        default=0.30, ge=0, le=1,
        description="Maximum ratio of zero-volume days"
    )


# ═══════════════════════════════════════════════════════════
#  VALIDATION DIAGNOSTICS
# ═══════════════════════════════════════════════════════════

class ValidationDiagnostics(BaseModel):
    """Report from validating an OHLCV DataFrame."""

    ticker: str
    is_valid: bool
    rows_input: int
    rows_output: int
    rows_dropped: int = 0
    nan_count: int = 0
    nan_ratio: float = 0.0
    zero_volume_count: int = 0
    negative_price_count: int = 0
    high_lt_low_count: int = 0
    split_anomaly_count: int = 0
    split_anomaly_dates: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


# ═══════════════════════════════════════════════════════════
#  DATAFRAME-LEVEL VALIDATION
# ═══════════════════════════════════════════════════════════

def validate_ohlcv_dataframe(
    ticker: str,
    df: pd.DataFrame,
    config: Optional[OHLCVSeriesConfig] = None,
    clean: bool = True,
) -> tuple[pd.DataFrame, ValidationDiagnostics]:
    """
    Validate and optionally clean an OHLCV DataFrame.

    Parameters
    ----------
    ticker : str
        Ticker symbol (for diagnostics reporting).
    df : pd.DataFrame
        Raw OHLCV DataFrame with columns: Open, High, Low, Close, Volume.
    config : OHLCVSeriesConfig, optional
        Validation thresholds. Uses defaults if not provided.
    clean : bool
        If True, drops invalid rows and returns a cleaned DataFrame.
        If False, returns the original DataFrame with diagnostics only.

    Returns
    -------
    (cleaned_df, diagnostics)
    """
    if config is None:
        config = OHLCVSeriesConfig()

    diag = ValidationDiagnostics(
        ticker=ticker,
        is_valid=True,
        rows_input=len(df),
        rows_output=len(df),
    )

    if df.empty:
        diag.is_valid = False
        diag.errors.append("Empty DataFrame")
        return df, diag

    # Ensure required columns exist
    required_cols = {"Open", "High", "Low", "Close", "Volume"}
    missing = required_cols - set(df.columns)
    if missing:
        diag.is_valid = False
        diag.errors.append(f"Missing columns: {missing}")
        return df, diag

    working_df = df.copy()

    # ── 1. NaN detection ──
    price_cols = ["Open", "High", "Low", "Close"]
    nan_mask = working_df[price_cols].isna().any(axis=1)
    diag.nan_count = int(nan_mask.sum())
    diag.nan_ratio = round(diag.nan_count / len(working_df), 4)

    if diag.nan_ratio > config.max_nan_ratio:
        diag.is_valid = False
        diag.errors.append(
            f"NaN ratio ({diag.nan_ratio:.1%}) exceeds threshold ({config.max_nan_ratio:.1%})"
        )

    if clean and diag.nan_count > 0:
        working_df = working_df.dropna(subset=price_cols)
        diag.warnings.append(f"Dropped {diag.nan_count} NaN rows")

    # ── 2. Negative/zero price detection ──
    if not working_df.empty:
        neg_mask = (working_df[price_cols] <= 0).any(axis=1)
        diag.negative_price_count = int(neg_mask.sum())
        if diag.negative_price_count > 0:
            diag.warnings.append(f"Found {diag.negative_price_count} rows with price ≤ 0")
            if clean:
                working_df = working_df[~neg_mask]

    # ── 3. High < Low check ──
    if not working_df.empty:
        hl_mask = working_df["High"] < working_df["Low"]
        diag.high_lt_low_count = int(hl_mask.sum())
        if diag.high_lt_low_count > 0:
            diag.warnings.append(f"Found {diag.high_lt_low_count} rows where High < Low")
            if clean:
                # Swap High and Low
                swap_idx = working_df[hl_mask].index
                working_df.loc[swap_idx, ["High", "Low"]] = (
                    working_df.loc[swap_idx, ["Low", "High"]].values
                )

    # ── 4. Zero volume detection ──
    if not working_df.empty:
        zero_vol = (working_df["Volume"] == 0) | working_df["Volume"].isna()
        diag.zero_volume_count = int(zero_vol.sum())
        zero_vol_ratio = diag.zero_volume_count / len(working_df)
        if zero_vol_ratio > config.max_zero_volume_ratio:
            diag.warnings.append(
                f"Zero-volume ratio ({zero_vol_ratio:.1%}) exceeds threshold ({config.max_zero_volume_ratio:.1%})"
            )
        if clean:
            working_df["Volume"] = working_df["Volume"].fillna(0).astype(int)

    # ── 5. Stock split / dividend anomaly detection ──
    if not working_df.empty and len(working_df) > 1:
        close = working_df["Close"]
        pct_change = close.pct_change().abs() * 100
        anomaly_mask = pct_change > config.max_gap_pct
        anomaly_dates = working_df.index[anomaly_mask]
        diag.split_anomaly_count = len(anomaly_dates)

        if diag.split_anomaly_count > 0:
            diag.split_anomaly_dates = [
                str(d)[:10] for d in anomaly_dates[:10]  # Cap at 10
            ]
            diag.warnings.append(
                f"Detected {diag.split_anomaly_count} potential split/dividend anomalies "
                f"(>{config.max_gap_pct}% gap). Dates: {diag.split_anomaly_dates[:3]}"
            )

    # ── 6. Minimum rows check ──
    if len(working_df) < config.min_rows:
        diag.is_valid = False
        diag.errors.append(
            f"Only {len(working_df)} rows after cleaning (minimum: {config.min_rows})"
        )

    # ── 7. Date continuity check ──
    if not working_df.empty and hasattr(working_df.index, "to_series"):
        try:
            date_diffs = working_df.index.to_series().diff().dt.days
            large_gaps = date_diffs[date_diffs > 5]  # > 5 calendar days = suspicious
            if len(large_gaps) > 3:
                diag.warnings.append(
                    f"Found {len(large_gaps)} gaps > 5 calendar days (possible missing data)"
                )
        except Exception:
            pass

    # ── Final stats ──
    diag.rows_output = len(working_df)
    diag.rows_dropped = diag.rows_input - diag.rows_output

    return working_df, diag


def validate_universe(
    ohlcv: dict[str, pd.DataFrame],
    config: Optional[OHLCVSeriesConfig] = None,
    progress: bool = True,
) -> tuple[dict[str, pd.DataFrame], list[ValidationDiagnostics]]:
    """
    Validate all tickers in a universe dict.

    Returns (cleaned_universe, all_diagnostics).
    """
    cleaned = {}
    all_diags = []
    invalid_count = 0

    for ticker, df in sorted(ohlcv.items()):
        clean_df, diag = validate_ohlcv_dataframe(ticker, df, config)
        all_diags.append(diag)

        if diag.is_valid:
            cleaned[ticker] = clean_df
        else:
            invalid_count += 1

    if progress:
        print(
            f"    ✓ Validated {len(ohlcv)} tickers: "
            f"{len(cleaned)} passed, {invalid_count} failed"
        )

    return cleaned, all_diags

# ═══════════════════════════════════════════════════════════
#  YIELD VALIDATION
# ═══════════════════════════════════════════════════════════

def validate_yield(ticker: str, yield_val: float) -> float:
    """
    Validates dividend yield to catch "Impossible Yields".
    - Caps all yield displays at 100%.
    - Flags anything over 15% as 'High Risk' via a WARNING log.
    
    Returns the validated yield.
    """
    import logging
    
    if yield_val > 15.0:
        logging.warning(f"High Risk Yield detected for {ticker}: {yield_val:.2f}% (> 15%). Potential Dividend Trap or data error.")
        
    if yield_val > 100.0:
        return 100.0
        
    return yield_val

