"""
options_alpha.py — Alpha Call Options Intelligence Pipeline (v2)
================================================================
Standalone institutional-grade long call screener.
NO momentum, ensemble, or sentiment dependencies.
Uses ONLY: Option Greeks, Liquidity Metrics, Price Action.

Filter Stack:
  1. Underlying Price ≥ $50
  2. DTE ≤ 180 days (6-month cap)
  3. Delta ≥ 0.40
  4. Bid/Ask Spread ≤ 10%
  5. Volume > 50, Open Interest > 100
  6. Moneyness mode: ITM/ATM or ATM/OTM

Breakeven: (Strike + Premium - StockPrice) / StockPrice
"""

from __future__ import annotations

import json
import logging
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Literal

logger = logging.getLogger("options_alpha")

try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False
    logger.warning("yfinance not available — options_alpha disabled")

try:
    from pydantic import BaseModel, validator, ValidationError
    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False

MOMENTUM_DATA_PATH = Path(__file__).parent / "momentum_data.json"

# ── Defaults ──
MIN_PRICE = 50.0
MIN_DELTA = 0.40
MAX_DTE = 180
MAX_SPREAD_PCT = 0.10
MIN_VOLUME = 50
MIN_OI = 100
MAX_WORKERS = 10


# ── Pydantic Validation Model ──
if HAS_PYDANTIC:
    class OptionContract(BaseModel):
        ticker: str
        stock_price: float
        strike: float
        expiration: str
        dte: int
        bid: float
        ask: float
        mid_price: float
        last_price: float
        volume: int
        open_interest: int
        implied_volatility: float
        spread_pct: float
        delta: float
        theta: float
        gamma: float
        vega: float
        breakeven: float
        breakeven_pct: float
        moneyness: str  # ITM, ATM, OTM
        intrinsic_value: float

        @validator("bid", "ask", "mid_price", "stock_price", "strike", pre=True)
        def clean_price(cls, v):
            if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
                return 0.0
            return round(float(v), 2)

        @validator("volume", "open_interest", pre=True)
        def clean_int(cls, v):
            if v is None:
                return 0
            return max(0, int(v))

        @validator("delta", "theta", "gamma", "vega", "implied_volatility", pre=True)
        def clean_greek(cls, v):
            if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
                return 0.0
            return round(float(v), 4)

        @validator("spread_pct", "breakeven_pct", pre=True)
        def clean_pct(cls, v):
            if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
                return 0.0
            return round(float(v), 2)


def _get_ticker_universe() -> list[dict]:
    """
    Load ticker universe from momentum_data.json (ReadOnly).
    Only extracts ticker + price — no momentum data used.
    """
    if not MOMENTUM_DATA_PATH.exists():
        return []
    try:
        with open(MOMENTUM_DATA_PATH, "r") as f:
            data = json.load(f)
        signals = data.get("signals", [])
        return [
            {"ticker": s["ticker"], "price": s.get("price", 0), "sector": s.get("sector", "Unknown")}
            for s in signals
            if s.get("price", 0) >= MIN_PRICE
        ]
    except Exception as e:
        logger.error(f"Failed to load universe: {e}")
        return []


def _classify_moneyness(strike: float, stock_price: float) -> str:
    """Classify a strike as ITM, ATM, or OTM relative to stock price (for calls)."""
    ratio = strike / stock_price
    if ratio < 0.97:
        return "ITM"
    elif ratio <= 1.03:
        return "ATM"
    else:
        return "OTM"


def _validate_contract(raw: dict) -> dict | None:
    """Run contract through Pydantic validation. Returns clean dict or None."""
    if HAS_PYDANTIC:
        try:
            validated = OptionContract(**raw)
            return validated.dict()
        except (ValidationError, Exception):
            return None
    # Fallback: basic cleaning
    for key in ["bid", "ask", "mid_price", "stock_price", "strike"]:
        v = raw.get(key, 0)
        if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
            raw[key] = 0.0
    for key in ["volume", "open_interest"]:
        v = raw.get(key, 0)
        if v is None:
            raw[key] = 0
    return raw


def _scan_ticker(
    ticker: str,
    stock_price: float,
    mode: str = "atm_otm",
    min_volume: int = MIN_VOLUME,
    min_oi: int = MIN_OI,
) -> list[dict]:
    """
    Fetch and filter option chains for a single ticker.
    Pure Greeks + Liquidity + Price Action — no momentum.
    """
    if not HAS_YFINANCE:
        return []

    try:
        t = yf.Ticker(ticker)
        expirations = t.options
        if not expirations:
            return []

        now = datetime.now()
        max_exp = now + timedelta(days=MAX_DTE)

        # Filter expirations within DTE cap
        valid_expiries = []
        for exp_str in expirations:
            try:
                exp_date = datetime.strptime(exp_str, "%Y-%m-%d")
                dte = (exp_date - now).days
                if 1 <= dte <= MAX_DTE:
                    valid_expiries.append((exp_str, dte))
            except ValueError:
                continue

        if not valid_expiries:
            return []

        results = []

        for exp_str, dte in valid_expiries[:4]:  # Cap at 4 expirations per ticker for speed
            try:
                chain = t.option_chain(exp_str)
                calls = chain.calls
                if calls.empty:
                    continue

                for _, row in calls.iterrows():
                    strike = float(row.get("strike", 0))
                    bid = float(row.get("bid", 0) or 0)
                    ask = float(row.get("ask", 0) or 0)
                    last_price = float(row.get("lastPrice", 0) or 0)
                    volume = int(row.get("volume", 0) or 0)
                    oi = int(row.get("openInterest", 0) or 0)
                    iv = float(row.get("impliedVolatility", 0) or 0)

                    # ── Moneyness filter ──
                    moneyness = _classify_moneyness(strike, stock_price)
                    if mode == "itm_atm" and moneyness == "OTM":
                        continue
                    if mode == "atm_otm" and moneyness == "ITM":
                        continue

                    # Skip deep OTM/ITM (>25% away)
                    if abs(strike - stock_price) / stock_price > 0.25:
                        continue

                    # ── Bid/Ask guard ──
                    if ask <= 0 or bid <= 0:
                        continue
                    spread_pct = (ask - bid) / ask
                    if spread_pct > MAX_SPREAD_PCT:
                        continue

                    # ── Liquidity floor ──
                    if volume < min_volume:
                        continue
                    if oi < min_oi:
                        continue

                    # ── Greeks ──
                    # yfinance provides impliedVolatility; delta/theta/gamma/vega
                    # may not always be available, so we approximate delta
                    delta_val = 0.0
                    theta_val = 0.0
                    gamma_val = 0.0
                    vega_val = 0.0

                    # Check if greeks are available directly
                    if "delta" in row and row.get("delta") is not None:
                        delta_val = float(row["delta"])
                    else:
                        # Approximate delta from moneyness
                        ratio = stock_price / strike
                        delta_val = max(0.0, min(1.0, 0.5 + (ratio - 1.0) * 2.5))

                    if "theta" in row and row.get("theta") is not None:
                        theta_val = float(row["theta"])
                    if "gamma" in row and row.get("gamma") is not None:
                        gamma_val = float(row["gamma"])
                    if "vega" in row and row.get("vega") is not None:
                        vega_val = float(row["vega"])

                    # ── Delta filter ──
                    if delta_val < MIN_DELTA:
                        continue

                    # ── Breakeven calculation ──
                    mid_price = round((bid + ask) / 2, 2)
                    breakeven = round(strike + mid_price, 2)
                    breakeven_pct = round(((breakeven - stock_price) / stock_price) * 100, 2)

                    # Intrinsic value (for calls)
                    intrinsic = max(0, stock_price - strike)

                    raw_contract = {
                        "ticker": ticker,
                        "stock_price": round(stock_price, 2),
                        "strike": round(strike, 2),
                        "expiration": exp_str,
                        "dte": dte,
                        "bid": round(bid, 2),
                        "ask": round(ask, 2),
                        "mid_price": mid_price,
                        "last_price": round(last_price, 2),
                        "volume": volume,
                        "open_interest": oi,
                        "implied_volatility": round(iv * 100, 1),
                        "spread_pct": round(spread_pct * 100, 1),
                        "delta": round(delta_val, 3),
                        "theta": round(theta_val, 4),
                        "gamma": round(gamma_val, 4),
                        "vega": round(vega_val, 4),
                        "breakeven": breakeven,
                        "breakeven_pct": breakeven_pct,
                        "moneyness": moneyness,
                        "intrinsic_value": round(intrinsic, 2),
                    }

                    # Pydantic validation
                    validated = _validate_contract(raw_contract)
                    if validated:
                        results.append(validated)

            except Exception as e:
                logger.debug(f"Chain error {ticker}/{exp_str}: {e}")
                continue

        return results

    except Exception as e:
        logger.warning(f"Ticker scan failed {ticker}: {e}")
        return []


def get_alpha_calls(
    mode: str = "atm_otm",
    min_volume: int = MIN_VOLUME,
    min_oi: int = MIN_OI,
    sort_by: str = "open_interest",
    max_workers: int = MAX_WORKERS,
) -> dict:
    """
    Run the Alpha Call screening pipeline.
    Pure Greeks + Liquidity + Price Action.

    Args:
        mode: "itm_atm" (Wealth Protection) or "atm_otm" (Tactical Leverage)
        min_volume: Minimum contract volume
        min_oi: Minimum open interest
        sort_by: Sort key for results
        max_workers: Thread pool size

    Returns:
        dict with calls, meta, timestamp
    """
    universe = _get_ticker_universe()
    if not universe:
        return {
            "calls": [],
            "meta": {"error": "No ticker universe available", "universe_size": 0},
            "timestamp": datetime.now().isoformat(),
        }

    logger.info(f"Alpha Calls v2: Scanning {len(universe)} tickers (mode={mode}, vol>{min_volume}, oi>{min_oi})")

    all_calls: list[dict] = []
    errors = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(
                _scan_ticker,
                t["ticker"],
                t["price"],
                mode,
                min_volume,
                min_oi,
            ): t["ticker"]
            for t in universe
        }
        for future in as_completed(futures):
            try:
                results = future.result(timeout=30)
                all_calls.extend(results)
            except Exception:
                errors += 1

    # Sort
    sort_map = {
        "open_interest": lambda x: x.get("open_interest", 0),
        "volume": lambda x: x.get("volume", 0),
        "delta": lambda x: x.get("delta", 0),
        "breakeven_pct": lambda x: x.get("breakeven_pct", 999),
        "implied_volatility": lambda x: x.get("implied_volatility", 0),
        "spread_pct": lambda x: x.get("spread_pct", 100),
    }
    sort_fn = sort_map.get(sort_by, sort_map["open_interest"])
    reverse = sort_by != "breakeven_pct" and sort_by != "spread_pct"
    all_calls.sort(key=sort_fn, reverse=reverse)

    return {
        "calls": all_calls,
        "meta": {
            "universe_size": len(universe),
            "contracts_found": len(all_calls),
            "tickers_with_calls": len(set(c["ticker"] for c in all_calls)),
            "errors": errors,
            "mode": mode,
            "mode_label": "Wealth Protection (ITM/ATM)" if mode == "itm_atm" else "Tactical Leverage (ATM/OTM)",
            "filters": {
                "min_price": MIN_PRICE,
                "min_delta": MIN_DELTA,
                "max_dte": MAX_DTE,
                "max_spread_pct": f"{MAX_SPREAD_PCT*100}%",
                "min_volume": min_volume,
                "min_oi": min_oi,
            },
        },
        "timestamp": datetime.now().isoformat(),
    }
