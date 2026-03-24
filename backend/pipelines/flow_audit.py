"""
flow_audit.py — Persistence Layer for Flow Intelligence
========================================================
Saves verified S-Tier Sync signals to a standalone audit ledger.
Zero overwrite — concat pattern ensures no historical data loss.
"""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path

import pandas as pd


class FlowAuditLogger:
    """
    Persistence engine for Vertical 3: Flow Intelligence.
    Saves verified 'S-Tier Sync' signals to a standalone audit ledger.
    """

    HEADERS = [
        "signal_timestamp", "ticker", "stock_price",
        "option_strike", "option_expiry", "option_premium",
        "delta", "iv_percentile", "vol_oi_ratio", "whale_value_usd",
        "insider_name", "insider_value", "risk_tier",
    ]

    def __init__(self, file_path: str | None = None):
        if file_path is None:
            file_path = str(Path(__file__).parent / "data" / "flow_audit_ledger.csv")
        self.file_path = file_path
        self._initialize_ledger()

    def _initialize_ledger(self):
        """Creates the CSV with institutional headers if it doesn't exist."""
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
        if not os.path.exists(self.file_path):
            df = pd.DataFrame(columns=self.HEADERS)
            df.to_csv(self.file_path, index=False)

    def log_verified_signal(
        self,
        ticker: str,
        price: float,
        option_data: dict,
        insider_name: str = "",
        insider_value: float = 0,
        risk_tier: str = "S-TIER SYNC",
    ):
        """Appends a high-conviction sync signal to the audit file."""
        bid = float(option_data.get("bid", 0) or 0)
        ask = float(option_data.get("ask", 0) or 0)
        mid = (bid + ask) / 2
        vol = int(option_data.get("volume", 0) or 0)
        oi = int(option_data.get("open_interest", 0) or 0)

        new_entry = {
            "signal_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "ticker": ticker,
            "stock_price": round(price, 2),
            "option_strike": option_data.get("strike", 0),
            "option_expiry": option_data.get("expiration", ""),
            "option_premium": round(mid, 2),
            "delta": option_data.get("delta", 0),
            "iv_percentile": option_data.get("iv_percentile"),
            "vol_oi_ratio": round(vol / oi, 2) if oi > 0 else 0,
            "whale_value_usd": round(mid * vol * 100, 2),
            "insider_name": insider_name,
            "insider_value": insider_value,
            "risk_tier": risk_tier,
        }

        df = pd.read_csv(self.file_path)
        df = pd.concat([df, pd.DataFrame([new_entry])], ignore_index=True)
        df.to_csv(self.file_path, index=False)

    def get_history(self, limit: int = 50) -> list[dict]:
        """Return recent audit entries."""
        if not os.path.exists(self.file_path):
            return []
        df = pd.read_csv(self.file_path)
        return df.tail(limit).to_dict("records")
