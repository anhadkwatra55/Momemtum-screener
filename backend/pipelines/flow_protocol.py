"""
flow_protocol.py — Institutional Guardrails for Flow Intelligence
==================================================================
Standalone quant validator. No momentum, no ensemble, no sentiment.
Only cares about the Mathematics of the Contract.

Four Gates:
  1. Liquidity Floor: Bid/Ask Spread ≤ 10%
  2. Volatility Ceiling: IV Percentile ≤ 70%
  3. Time Buffer: DTE ≥ 30 days
  4. Magnitude Check: Order Value ≥ $100k
"""

from __future__ import annotations

import math
from typing import Any


class FlowProtocol:
    """
    Institutional Guardrails for Vertical 3: Flow Intelligence.
    Ensures 'Asymmetric' trades meet liquidity and volatility standards.
    """

    def __init__(self, ticker_data: dict, option_data: dict):
        self.ticker = ticker_data.get("symbol", ticker_data.get("ticker", ""))
        self.stock_price = float(ticker_data.get("price", 0))
        self.option = option_data

    def check_liquidity_floor(self, max_spread_pct: float = 10.0) -> bool:
        """Guardrail 1: Bid/Ask Spread must be tight."""
        bid = float(self.option.get("bid", 0) or 0)
        ask = float(self.option.get("ask", 0) or 0)
        if ask <= 0 or bid <= 0:
            return False
        midpoint = (ask + bid) / 2
        if midpoint <= 0:
            return False
        spread_pct = ((ask - bid) / midpoint) * 100
        return spread_pct <= max_spread_pct

    def check_volatility_ceiling(self, iv_percentile_limit: float = 70.0) -> bool:
        """Guardrail 2: Prevent buying overpriced 'Fear Premium'."""
        iv_pct = self.option.get("iv_percentile")
        if iv_pct is None:
            return True  # Pass if unknown — don't veto on missing data
        return float(iv_pct) <= iv_percentile_limit

    def check_time_buffer(self, min_dte: int = 30) -> bool:
        """Guardrail 3: Filter out short-term 'Lotto' gambles."""
        dte = int(self.option.get("dte", 0) or 0)
        return dte >= min_dte

    def check_magnitude(self, min_order_value: float = 100_000) -> bool:
        """Guardrail 4: Only track institutional 'Whale' capital."""
        bid = float(self.option.get("bid", 0) or 0)
        ask = float(self.option.get("ask", 0) or 0)
        volume = int(self.option.get("volume", 0) or 0)
        midpoint = (ask + bid) / 2
        total_value = midpoint * volume * 100  # standard contract size
        return total_value >= min_order_value

    def get_order_value(self) -> float:
        """Calculate total order value in USD."""
        bid = float(self.option.get("bid", 0) or 0)
        ask = float(self.option.get("ask", 0) or 0)
        volume = int(self.option.get("volume", 0) or 0)
        midpoint = (ask + bid) / 2
        return round(midpoint * volume * 100, 2)

    def get_vol_oi_ratio(self) -> float:
        """Calculate Volume / OI ratio (UOA indicator)."""
        volume = int(self.option.get("volume", 0) or 0)
        oi = int(self.option.get("open_interest", 0) or 0)
        if oi <= 0:
            return 0.0
        return round(volume / oi, 2)

    def validate_sync_signal(self) -> tuple[bool, dict]:
        """Runs the full 'FlowProtocol' gauntlet."""
        results = {
            "liquid": self.check_liquidity_floor(),
            "low_vol": self.check_volatility_ceiling(),
            "stable_time": self.check_time_buffer(),
            "is_whale": self.check_magnitude(),
        }
        is_verified = all(results.values())
        return is_verified, results

    def get_risk_tier(self) -> str:
        """Classify the signal risk tier based on guardrail results."""
        is_verified, results = self.validate_sync_signal()
        if is_verified:
            return "S-TIER SYNC"
        if not results["low_vol"]:
            return "HIGH-IV RISK"
        if not results["liquid"]:
            return "LOW LIQUIDITY"
        if not results["is_whale"]:
            return "SUB-INSTITUTIONAL"
        if not results["stable_time"]:
            return "SHORT-TERM LOTTO"
        return "UNVERIFIED"
