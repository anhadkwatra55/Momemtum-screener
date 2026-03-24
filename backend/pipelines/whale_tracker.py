"""
whale_tracker.py — Whale Flow Intelligence Pipeline (Vertical 3)
=================================================================
Standalone institutional order flow engine. Completely independent
from Momentum and Alpha Options verticals.

Logic:
  1. UOA Scan: Call options where Vol/OI > 2.0 (primary driver)
  2. Insider Enrichment: If SEC Form 4 insider buy exists, enrich the signal
  3. FlowProtocol: 4 institutional guardrails on every candidate
  NOTE: Insider data is OPTIONAL enrichment, not a hard requirement.

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
MIN_INSIDER_VALUE = 25_000       # $25k minimum insider purchase (relaxed)
UOA_VOL_OI_THRESHOLD = 2.0      # Vol/OI ratio for unusual activity (relaxed from 2.5)
MIN_WHALE_ORDER_VALUE = 50_000   # $50k minimum whale option value (relaxed from 100k)
MAX_IV_PERCENTILE = 70           # IV ceiling
MIN_DTE = 7                      # Minimum days to expiration (relaxed from 30)
MAX_DTE = 365                    # Cap expiration (expanded from 180)
MAX_SPREAD_PCT = 15              # Bid/Ask spread cap (relaxed from 10)
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
    Core logic for a single ticker:
    1. Scan for UOA on call options (primary — always runs)
    2. Optionally fetch insider buys for enrichment
    3. Run FlowProtocol guardrails
    No sync-window gate — UOA alone is enough to surface signals.
    """
    # UOA is the primary driver — scan first
    uoa_options = _scan_unusual_options(ticker, stock_price)
    if not uoa_options:
        return []

    # Insider data is optional enrichment
    insider_buys = _fetch_insider_buys(ticker)
    best_insider = None
    if insider_buys:
        # Pick the largest insider purchase
        best_insider = max(insider_buys, key=lambda x: x.get("value", 0))

    auditor = FlowAuditLogger()
    results = []

    for opt in uoa_options:
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
        whale_value = protocol.get_order_value()

        # Risk tier: S-TIER if protocol passes AND insider data exists
        if is_verified and best_insider:
            risk_tier = "S-TIER SYNC"
        elif is_verified:
            risk_tier = "WHALE VERIFIED"
        elif best_insider:
            risk_tier = protocol.get_risk_tier()  # Has insider but fails some guard
        else:
            risk_tier = protocol.get_risk_tier()

        # Days since insider (0 if no insider)
        days_apart = 0
        if best_insider:
            try:
                insider_date = datetime.strptime(best_insider.get("date", ""), "%Y-%m-%d")
                days_apart = (datetime.now() - insider_date).days
            except ValueError:
                pass

        signal = {
            "ticker": ticker,
            "stock_price": round(stock_price, 2),
            "insider_name": best_insider["name"] if best_insider else "—",
            "insider_title": best_insider.get("title", "—") if best_insider else "—",
            "insider_shares": best_insider["shares"] if best_insider else 0,
            "insider_value": best_insider["value"] if best_insider else 0,
            "insider_date": best_insider.get("date", "—") if best_insider else "—",
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
            "days_apart": days_apart,
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
        if risk_tier == "S-TIER SYNC":
            try:
                auditor.log_verified_signal(
                    ticker=ticker,
                    price=stock_price,
                    option_data=option_data,
                    insider_name=best_insider["name"] if best_insider else "",
                    insider_value=best_insider["value"] if best_insider else 0,
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

    # Sort: S-Tier first, then Whale Verified, then by whale value
    tier_order = {"S-TIER SYNC": 0, "WHALE VERIFIED": 1, "HIGH-IV RISK": 2, "LOW LIQUIDITY": 3, "SUB-INSTITUTIONAL": 4, "SHORT-TERM LOTTO": 5, "UNVERIFIED": 6}
    all_signals.sort(key=lambda x: (tier_order.get(x["risk_tier"], 6), -x.get("whale_value_usd", 0)))

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
