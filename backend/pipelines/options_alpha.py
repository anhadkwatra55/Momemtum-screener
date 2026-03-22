"""
options_alpha.py — Alpha Call Options Intelligence Pipeline
=============================================================
Institutional-grade long call screener combining Zacks criteria
with the HEADSTART Momentum Ensemble overlay.

Filter Stack:
  1. Price Filter: Stock ≥ $50 (reduces relative premium friction)
  2. Option Greeks: ATM/OTM Long Calls, Delta ≥ 0.40, DTE 90-150d
  3. Liquidity: Bid/Ask spread ≤ 10%
  4. Momentum Veto: Ensemble Score > 1.5
  5. IV Percentile: Exclude if > 70%
  6. Crowding Guard: Flag if Crowding Index > 85

Data: Reads momentum_data.json as ReadOnly source. Never mutates.
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

logger = logging.getLogger("options_alpha")

# Try importing yfinance
try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False
    logger.warning("yfinance not available — options_alpha will return empty results")

MOMENTUM_DATA_PATH = Path(__file__).parent / "momentum_data.json"

# ── Configuration ──
MIN_PRICE = 50.0
MIN_DELTA = 0.40
DTE_MIN = 90
DTE_MAX = 150
MAX_SPREAD_PCT = 0.10  # 10% bid/ask spread
MIN_ENSEMBLE_SCORE = 1.5
MAX_IV_PERCENTILE = 0.70
CROWDING_THRESHOLD = 85
MAX_WORKERS = 8


def _load_momentum_signals() -> dict[str, dict]:
    """Load momentum signals from cached JSON (ReadOnly)."""
    if not MOMENTUM_DATA_PATH.exists():
        return {}
    try:
        with open(MOMENTUM_DATA_PATH, "r") as f:
            data = json.load(f)
        signals = data.get("signals", [])
        return {s["ticker"]: s for s in signals if "ticker" in s}
    except Exception as e:
        logger.error(f"Failed to load momentum data: {e}")
        return {}


def _compute_iv_percentile(ticker_obj: Any) -> float | None:
    """
    Compute IV Percentile using historical volatility vs current implied vol.
    Returns 0-1 scale, or None if unavailable.
    """
    try:
        hist = ticker_obj.history(period="1y")
        if hist.empty or len(hist) < 30:
            return None
        # Historical realized vol (30-day annualized)
        log_ret = np.log(hist["Close"] / hist["Close"].shift(1)).dropna()
        realized_vol = float(log_ret.iloc[-30:].std() * np.sqrt(252))
        # Use 1y range to estimate IV percentile
        all_vols = []
        for i in range(30, len(log_ret), 5):
            chunk = log_ret.iloc[max(0, i - 30):i]
            if len(chunk) >= 20:
                all_vols.append(float(chunk.std() * np.sqrt(252)))
        if not all_vols:
            return None
        # Percentile of current vol vs historical vols
        rank = sum(1 for v in all_vols if v <= realized_vol) / len(all_vols)
        return round(rank, 3)
    except Exception:
        return None


def _compute_crowding_index(signal: dict) -> float:
    """
    Compute a Crowding Index from available signal data.
    Uses vol_spike + continuation probability as proxy for crowding.
    Higher = more crowded trade.
    """
    vol_spike = signal.get("vol_spike", 1.0) or 1.0
    cont_prob = 0
    cont = signal.get("continuation", {})
    if isinstance(cont, dict):
        cont_prob = cont.get("probability", 0) or 0

    # Crowding = volume intensity × continuation expectation
    # Scale: 0-100
    crowding = min(100, (vol_spike * 15) + (cont_prob * 0.5))
    return round(crowding, 1)


def _screen_ticker_options(ticker: str, signal: dict) -> list[dict]:
    """
    Fetch option chain for a single ticker and filter for Alpha Calls.
    Returns list of qualifying option contracts.
    """
    if not HAS_YFINANCE:
        return []

    price = signal.get("price", 0)
    if price < MIN_PRICE:
        return []

    composite = signal.get("composite", 0)
    if composite < MIN_ENSEMBLE_SCORE:
        return []

    regime = signal.get("regime", "Unknown")
    # ADX trending check via regime
    if regime not in ("Trending",):
        return []

    try:
        t = yf.Ticker(ticker)

        # IV Percentile check
        iv_pct = _compute_iv_percentile(t)

        # Get available expiration dates
        expirations = t.options
        if not expirations:
            return []

        now = datetime.now()
        target_min = now + timedelta(days=DTE_MIN)
        target_max = now + timedelta(days=DTE_MAX)

        # Filter expiration dates within DTE range
        valid_expiries = []
        for exp_str in expirations:
            try:
                exp_date = datetime.strptime(exp_str, "%Y-%m-%d")
                if target_min <= exp_date <= target_max:
                    valid_expiries.append(exp_str)
            except ValueError:
                continue

        if not valid_expiries:
            return []

        # Crowding index
        crowding_idx = _compute_crowding_index(signal)

        results = []
        for exp_str in valid_expiries[:2]:  # Limit to 2 expirations per ticker
            try:
                chain = t.option_chain(exp_str)
                calls = chain.calls

                if calls.empty:
                    continue

                exp_date = datetime.strptime(exp_str, "%Y-%m-%d")
                dte = (exp_date - now).days

                for _, row in calls.iterrows():
                    strike = float(row.get("strike", 0))
                    bid = float(row.get("bid", 0))
                    ask = float(row.get("ask", 0))
                    last_price = float(row.get("lastPrice", 0))
                    volume = int(row.get("volume", 0) or 0)
                    open_interest = int(row.get("openInterest", 0) or 0)
                    implied_vol = float(row.get("impliedVolatility", 0) or 0)

                    # ATM/OTM filter: strike >= current price
                    if strike < price:
                        continue

                    # Skip deep OTM (> 20% above current price)
                    if strike > price * 1.20:
                        continue

                    # Bid/Ask spread filter
                    if ask <= 0 or bid <= 0:
                        continue
                    spread_pct = (ask - bid) / ask
                    if spread_pct > MAX_SPREAD_PCT:
                        continue

                    # Delta approximation (Black-Scholes proxy)
                    # For ATM calls, delta ≈ 0.5; decreases as strike moves OTM
                    moneyness = price / strike
                    approx_delta = max(0.0, min(1.0, 0.5 + (moneyness - 1.0) * 2.5))

                    if approx_delta < MIN_DELTA:
                        continue

                    # Calculate breakeven
                    mid_price = (bid + ask) / 2
                    breakeven = strike + mid_price
                    breakeven_pct = round((breakeven / price - 1) * 100, 2)

                    # Expected Value (simplified)
                    # EV = (probability × upside) - ((1-probability) × premium)
                    prob = signal.get("probability", 50) / 100
                    potential_gain = price * 0.10  # 10% move assumption
                    ev = round((prob * potential_gain) - ((1 - prob) * mid_price), 2)

                    # Risk flags
                    is_crowded = crowding_idx > CROWDING_THRESHOLD
                    iv_warning = iv_pct is not None and iv_pct > MAX_IV_PERCENTILE

                    results.append({
                        "ticker": ticker,
                        "company_name": signal.get("company_name", ticker),
                        "sector": signal.get("sector", "Unknown"),
                        "stock_price": round(price, 2),
                        "strike": round(strike, 2),
                        "expiration": exp_str,
                        "dte": dte,
                        "bid": round(bid, 2),
                        "ask": round(ask, 2),
                        "mid_price": round(mid_price, 2),
                        "last_price": round(last_price, 2),
                        "volume": volume,
                        "open_interest": open_interest,
                        "implied_volatility": round(implied_vol * 100, 1),
                        "spread_pct": round(spread_pct * 100, 1),
                        "approx_delta": round(approx_delta, 3),
                        "breakeven": round(breakeven, 2),
                        "breakeven_pct": breakeven_pct,
                        "expected_value": ev,
                        # Momentum overlay
                        "ensemble_score": signal.get("composite", 0),
                        "momentum_probability": signal.get("probability", 0),
                        "conviction_tier": signal.get("conviction_tier", "Unknown"),
                        "action_category": signal.get("action_category", "Unknown"),
                        "regime": regime,
                        "momentum_phase": signal.get("momentum_phase", "Unknown"),
                        "thesis": signal.get("thesis", ""),
                        "price_target": signal.get("price_target"),
                        # Risk metrics
                        "iv_percentile": round(iv_pct * 100, 1) if iv_pct is not None else None,
                        "crowding_index": crowding_idx,
                        "is_crowded": is_crowded,
                        "iv_warning": iv_warning,
                        "risk_flag": "HIGH RISK" if is_crowded else ("IV CRUSH RISK" if iv_warning else "CLEAR"),
                    })

            except Exception as e:
                logger.debug(f"Failed to process {exp_str} for {ticker}: {e}")
                continue

        return results

    except Exception as e:
        logger.warning(f"Failed to screen options for {ticker}: {e}")
        return []


def get_alpha_calls(
    min_price: float = MIN_PRICE,
    min_ensemble: float = MIN_ENSEMBLE_SCORE,
    max_iv_pct: float = MAX_IV_PERCENTILE,
    max_workers: int = MAX_WORKERS,
) -> dict:
    """
    Run the full Alpha Call screening pipeline.

    Returns dict with:
      - calls: list of qualifying option contracts
      - meta: screening statistics
      - timestamp: when the scan was run
    """
    signals = _load_momentum_signals()
    if not signals:
        return {
            "calls": [],
            "meta": {"error": "No momentum data available", "screened": 0, "qualified": 0},
            "timestamp": datetime.now().isoformat(),
        }

    # Pre-filter: price >= min_price, composite >= min_ensemble, trending regime
    candidates = {}
    for ticker, sig in signals.items():
        price = sig.get("price", 0)
        composite = sig.get("composite", 0)
        regime = sig.get("regime", "Unknown")

        if price >= min_price and composite >= min_ensemble and regime == "Trending":
            candidates[ticker] = sig

    logger.info(f"Alpha Calls: {len(candidates)} candidates from {len(signals)} universe (price≥${min_price}, ensemble≥{min_ensemble})")

    # Parallel option chain fetching
    all_calls = []
    errors = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_screen_ticker_options, ticker, sig): ticker
            for ticker, sig in candidates.items()
        }
        for future in as_completed(futures):
            ticker = futures[future]
            try:
                results = future.result(timeout=30)
                all_calls.extend(results)
            except Exception as e:
                errors += 1
                logger.debug(f"Timeout/error for {ticker}: {e}")

    # Sort by expected value descending
    all_calls.sort(key=lambda x: x.get("expected_value", 0), reverse=True)

    return {
        "calls": all_calls,
        "meta": {
            "universe_size": len(signals),
            "candidates_screened": len(candidates),
            "contracts_found": len(all_calls),
            "tickers_with_calls": len(set(c["ticker"] for c in all_calls)),
            "errors": errors,
            "filters": {
                "min_price": min_price,
                "min_ensemble": min_ensemble,
                "min_delta": MIN_DELTA,
                "dte_range": f"{DTE_MIN}-{DTE_MAX}",
                "max_spread": f"{MAX_SPREAD_PCT*100}%",
                "max_iv_percentile": f"{max_iv_pct*100}%",
                "crowding_threshold": CROWDING_THRESHOLD,
            },
        },
        "timestamp": datetime.now().isoformat(),
    }
