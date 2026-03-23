"""
whale_tracker.py — Whale Flow Intelligence Pipeline (Vertical 3)
=================================================================
Standalone institutional order flow engine. Completely independent
from Momentum and Alpha Options verticals.

Logic:
  1. Insider Scan: SEC Form 4 open-market purchases
  2. UOA Trigger: Call options where Vol/OI > 2.5
  3. Fusion Gate: Insider buy ≥$50k within 7 days of whale option activity
  4. FlowProtocol: 4 institutional guardrails on every candidate

Data Sources: yfinance (option chains), insider_signals.py (SEC Form 4)
"""

from __future__ import annotations

import json
import logging
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger("whale_tracker")

try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False

try:
    from pydantic import BaseModel, validator, ValidationError
    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False

from flow_protocol import FlowProtocol
from flow_audit import FlowAuditLogger

MOMENTUM_DATA_PATH = Path(__file__).parent / "momentum_data.json"

# ── Configuration ──
MIN_INSIDER_VALUE = 50_000       # $50k minimum insider purchase
SYNC_WINDOW_DAYS = 7             # 7 trading day sync window
UOA_VOL_OI_THRESHOLD = 2.5      # Vol/OI ratio for unusual activity
MIN_WHALE_ORDER_VALUE = 100_000  # $100k minimum whale option value
MAX_IV_PERCENTILE = 70           # IV ceiling
MIN_DTE = 30                     # Minimum days to expiration
MAX_DTE = 180                    # Cap expiration
MAX_SPREAD_PCT = 10              # Bid/Ask spread cap
MAX_WORKERS = 8


# ── Pydantic Models ──
if HAS_PYDANTIC:
    class WhaleSignal(BaseModel):
        ticker: str
        stock_price: float
        # Insider data
        insider_name: str
        insider_title: str
        insider_shares: int
        insider_value: float
        insider_date: str
        # Option data
        option_strike: float
        option_expiry: str
        option_dte: int
        option_bid: float
        option_ask: float
        option_mid: float
        option_volume: int
        option_oi: int
        option_iv: float
        option_delta: float
        option_spread_pct: float
        # Computed
        vol_oi_ratio: float
        whale_value_usd: float
        breakeven: float
        breakeven_pct: float
        # FlowProtocol results
        risk_tier: str
        guardrail_liquid: bool
        guardrail_low_vol: bool
        guardrail_stable_time: bool
        guardrail_is_whale: bool
        days_apart: int

        @validator("stock_price", "option_strike", "option_bid", "option_ask", "option_mid", pre=True)
        def clean_float(cls, v):
            if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
                return 0.0
            return round(float(v), 2)

        @validator("option_volume", "option_oi", "insider_shares", pre=True)
        def clean_int(cls, v):
            return max(0, int(v or 0))

        @validator("option_delta", "option_iv", "vol_oi_ratio", pre=True)
        def clean_metric(cls, v):
            if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
                return 0.0
            return round(float(v), 4)


def _get_universe() -> list[dict]:
    """Load ticker universe (only ticker + price, no momentum data used)."""
    if not MOMENTUM_DATA_PATH.exists():
        return []
    try:
        with open(MOMENTUM_DATA_PATH, "r") as f:
            data = json.load(f)
        return [
            {"ticker": s["ticker"], "price": s.get("price", 0)}
            for s in data.get("signals", [])
            if s.get("price", 0) >= 10  # Lower threshold for whale tracking
        ]
    except Exception as e:
        logger.error(f"Failed to load universe: {e}")
        return []


def _fetch_insider_buys(ticker: str) -> list[dict]:
    """Fetch recent insider purchases from yfinance."""
    try:
        t = yf.Ticker(ticker)
        insider = t.insider_purchases
        if insider is None or insider.empty:
            return []

        buys = []
        for _, row in insider.iterrows():
            shares = int(row.get("Shares", 0) or 0)
            value = float(row.get("Value", 0) or 0)
            if value < MIN_INSIDER_VALUE:
                continue
            buys.append({
                "name": str(row.get("Insider Trading", row.get("Insider", "Unknown"))),
                "title": str(row.get("Relationship", row.get("Title", "Unknown"))),
                "shares": shares,
                "value": value,
                "date": str(row.get("Start Date", row.get("Date", "")))[:10],
            })
        return buys
    except Exception as e:
        logger.debug(f"Insider fetch failed {ticker}: {e}")
        return []


def _scan_unusual_options(ticker: str, stock_price: float) -> list[dict]:
    """
    Scan option chains for Unusual Options Activity (UOA).
    UOA defined as: Vol/OI > 2.5 on call options.
    """
    if not HAS_YFINANCE:
        return []

    try:
        t = yf.Ticker(ticker)
        expirations = t.options
        if not expirations:
            return []

        now = datetime.now()
        results = []

        for exp_str in expirations[:6]:  # Cap at 6 expirations for speed
            try:
                exp_date = datetime.strptime(exp_str, "%Y-%m-%d")
                dte = (exp_date - now).days
                if dte < MIN_DTE or dte > MAX_DTE:
                    continue

                chain = t.option_chain(exp_str)
                calls = chain.calls
                if calls.empty:
                    continue

                for _, row in calls.iterrows():
                    volume = int(row.get("volume", 0) or 0)
                    oi = int(row.get("openInterest", 0) or 0)
                    bid = float(row.get("bid", 0) or 0)
                    ask = float(row.get("ask", 0) or 0)
                    strike = float(row.get("strike", 0))
                    iv = float(row.get("impliedVolatility", 0) or 0)

                    # Skip zero-volume or zero-OI
                    if volume <= 0 or oi <= 0:
                        continue

                    vol_oi = volume / oi

                    # UOA trigger
                    if vol_oi < UOA_VOL_OI_THRESHOLD:
                        continue

                    # Basic spread check
                    if ask <= 0 or bid <= 0:
                        continue
                    spread_pct = ((ask - bid) / ((ask + bid) / 2)) * 100
                    if spread_pct > MAX_SPREAD_PCT:
                        continue

                    # Delta approximation
                    ratio = stock_price / strike
                    approx_delta = max(0.0, min(1.0, 0.5 + (ratio - 1.0) * 2.5))

                    mid = (bid + ask) / 2
                    whale_value = mid * volume * 100
                    breakeven = strike + mid
                    breakeven_pct = ((breakeven - stock_price) / stock_price) * 100

                    results.append({
                        "strike": strike,
                        "expiration": exp_str,
                        "dte": dte,
                        "bid": bid,
                        "ask": ask,
                        "mid": mid,
                        "volume": volume,
                        "open_interest": oi,
                        "iv": round(iv * 100, 1),
                        "iv_percentile": None,  # Computed separately if needed
                        "delta": round(approx_delta, 3),
                        "vol_oi_ratio": round(vol_oi, 2),
                        "whale_value": round(whale_value, 2),
                        "spread_pct": round(spread_pct, 1),
                        "breakeven": round(breakeven, 2),
                        "breakeven_pct": round(breakeven_pct, 2),
                    })

            except Exception as e:
                logger.debug(f"Chain error {ticker}/{exp_str}: {e}")
                continue

        return results

    except Exception as e:
        logger.warning(f"UOA scan failed {ticker}: {e}")
        return []


def _fuse_ticker(ticker: str, stock_price: float) -> list[dict]:
    """
    Core fusion logic for a single ticker:
    1. Fetch insider buys
    2. Scan for UOA on call options
    3. Check 7-day sync window
    4. Run FlowProtocol guardrails
    """
    insider_buys = _fetch_insider_buys(ticker)
    if not insider_buys:
        return []

    uoa_options = _scan_unusual_options(ticker, stock_price)
    if not uoa_options:
        return []

    auditor = FlowAuditLogger()
    results = []

    for insider in insider_buys:
        insider_date_str = insider.get("date", "")
        try:
            insider_date = datetime.strptime(insider_date_str, "%Y-%m-%d")
        except ValueError:
            continue

        for opt in uoa_options:
            # Check sync window — UOA within 7 days of insider buy
            # Since we can't know exact UOA date, we use current date proximity
            now = datetime.now()
            days_since_insider = (now - insider_date).days
            if days_since_insider > SYNC_WINDOW_DAYS:
                continue

            # Run FlowProtocol
            ticker_data = {"symbol": ticker, "price": stock_price}
            option_data = {
                "bid": opt["bid"],
                "ask": opt["ask"],
                "volume": opt["volume"],
                "open_interest": opt["open_interest"],
                "dte": opt["dte"],
                "iv_percentile": opt.get("iv_percentile"),
                "delta": opt["delta"],
                "strike": opt["strike"],
                "expiration": opt["expiration"],
            }

            protocol = FlowProtocol(ticker_data, option_data)
            is_verified, guardrails = protocol.validate_sync_signal()
            risk_tier = protocol.get_risk_tier()
            whale_value = protocol.get_order_value()

            signal = {
                "ticker": ticker,
                "stock_price": round(stock_price, 2),
                "insider_name": insider["name"],
                "insider_title": insider.get("title", "Unknown"),
                "insider_shares": insider["shares"],
                "insider_value": insider["value"],
                "insider_date": insider_date_str,
                "option_strike": opt["strike"],
                "option_expiry": opt["expiration"],
                "option_dte": opt["dte"],
                "option_bid": opt["bid"],
                "option_ask": opt["ask"],
                "option_mid": opt["mid"],
                "option_volume": opt["volume"],
                "option_oi": opt["open_interest"],
                "option_iv": opt["iv"],
                "option_delta": opt["delta"],
                "option_spread_pct": opt["spread_pct"],
                "vol_oi_ratio": opt["vol_oi_ratio"],
                "whale_value_usd": whale_value,
                "breakeven": opt["breakeven"],
                "breakeven_pct": opt["breakeven_pct"],
                "risk_tier": risk_tier,
                "guardrail_liquid": guardrails["liquid"],
                "guardrail_low_vol": guardrails["low_vol"],
                "guardrail_stable_time": guardrails["stable_time"],
                "guardrail_is_whale": guardrails["is_whale"],
                "days_apart": days_since_insider,
            }

            # Pydantic validation
            if HAS_PYDANTIC:
                try:
                    validated = WhaleSignal(**signal)
                    signal = validated.dict()
                except (ValidationError, Exception) as e:
                    logger.debug(f"Validation failed for {ticker}: {e}")
                    continue

            results.append(signal)

            # Log S-Tier to audit ledger
            if is_verified:
                try:
                    auditor.log_verified_signal(
                        ticker=ticker,
                        price=stock_price,
                        option_data=option_data,
                        insider_name=insider["name"],
                        insider_value=insider["value"],
                        risk_tier=risk_tier,
                    )
                except Exception:
                    pass

    return results


def get_whale_signals(max_workers: int = MAX_WORKERS) -> dict:
    """
    Run the full Whale Flow Intelligence scan.

    Returns:
        dict with signals, meta, audit_history, timestamp
    """
    universe = _get_universe()
    if not universe:
        return {
            "signals": [],
            "meta": {"error": "No universe", "universe_size": 0},
            "audit_history": [],
            "timestamp": datetime.now().isoformat(),
        }

    logger.info(f"Whale Tracker: Scanning {len(universe)} tickers for Flow Intelligence")

    all_signals: list[dict] = []
    errors = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_fuse_ticker, t["ticker"], t["price"]): t["ticker"]
            for t in universe
        }
        for future in as_completed(futures):
            try:
                results = future.result(timeout=45)
                all_signals.extend(results)
            except Exception:
                errors += 1

    # Sort: S-Tier first, then by whale value
    tier_order = {"S-TIER SYNC": 0, "HIGH-IV RISK": 1, "LOW LIQUIDITY": 2, "SUB-INSTITUTIONAL": 3, "SHORT-TERM LOTTO": 4, "UNVERIFIED": 5}
    all_signals.sort(key=lambda x: (tier_order.get(x["risk_tier"], 5), -x.get("whale_value_usd", 0)))

    s_tier_count = sum(1 for s in all_signals if s["risk_tier"] == "S-TIER SYNC")

    # Get audit history
    try:
        auditor = FlowAuditLogger()
        audit_history = auditor.get_history(limit=20)
    except Exception:
        audit_history = []

    return {
        "signals": all_signals,
        "meta": {
            "universe_size": len(universe),
            "signals_found": len(all_signals),
            "s_tier_count": s_tier_count,
            "tickers_flagged": len(set(s["ticker"] for s in all_signals)),
            "errors": errors,
            "guardrails": {
                "min_insider_value": f"${MIN_INSIDER_VALUE:,}",
                "sync_window": f"{SYNC_WINDOW_DAYS} days",
                "uoa_threshold": f"Vol/OI > {UOA_VOL_OI_THRESHOLD}",
                "min_whale_order": f"${MIN_WHALE_ORDER_VALUE:,}",
                "max_iv_pct": f"{MAX_IV_PERCENTILE}%",
                "min_dte": MIN_DTE,
                "max_spread": f"{MAX_SPREAD_PCT}%",
            },
        },
        "audit_history": audit_history,
        "timestamp": datetime.now().isoformat(),
    }
