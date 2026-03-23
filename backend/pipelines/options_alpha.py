"""
options_alpha.py — Alpha Call Options Intelligence Pipeline (v3)
================================================================
Standalone institutional-grade long call screener.
Uses PROVEN logic: S&P 500 universe + Black-Scholes delta + Zacks filters.

Filter Stack (matching Zacks screener):
  1. Universe: S&P 500 (auto-fetched from Wikipedia)
  2. Strike Price ≥ $25
  3. Moneyness: ATM & OTM (Strike ≥ Price)
  4. Delta ≥ 0.35 (Black-Scholes calculated)
  5. Premium: $1 – $5 range
  6. DTE: 90–150 days
  7. Bid/Ask Spread ≤ 13%

Breakeven: ((Strike + Premium) / Price - 1) × 100
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

try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False

try:
    from scipy.stats import norm
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

MOMENTUM_DATA_PATH = Path(__file__).parent / "momentum_data.json"

# ── Default filter configuration ──
DEFAULT_MIN_PRICE = 25.0
DEFAULT_MIN_DELTA = 0.35
DEFAULT_DTE_MIN = 90
DEFAULT_DTE_MAX = 150
DEFAULT_MAX_SPREAD_PCT = 13.0
DEFAULT_PREMIUM_MIN = 1.0
DEFAULT_PREMIUM_MAX = 5.0
RISK_FREE_RATE = 0.04
MAX_WORKERS = 10


def _calculate_delta(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Black-Scholes call delta calculation."""
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return 0.0
    try:
        d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
        if HAS_SCIPY:
            return float(norm.cdf(d1))
        else:
            # Fallback approximation
            return float(max(0.0, min(1.0, 0.5 + d1 * 0.3)))
    except Exception:
        return 0.0


def _get_sp500_tickers() -> list[str]:
    """Fetch S&P 500 ticker list from Wikipedia."""
    if not HAS_PANDAS:
        return []
    try:
        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        tables = pd.read_html(url)
        tickers = tables[0]["Symbol"].tolist()
        logger.info(f"Fetched {len(tickers)} S&P 500 tickers")
        return tickers
    except Exception as e:
        logger.warning(f"Failed to fetch S&P 500 list: {e}")
        return []


def _get_momentum_tickers() -> list[str]:
    """Fallback: load tickers from momentum_data.json."""
    if not MOMENTUM_DATA_PATH.exists():
        return []
    try:
        with open(MOMENTUM_DATA_PATH, "r") as f:
            data = json.load(f)
        return [s["ticker"] for s in data.get("signals", []) if s.get("price", 0) >= 10]
    except Exception:
        return []


def _scan_ticker(
    symbol: str,
    min_price: float,
    min_delta: float,
    dte_min: int,
    dte_max: int,
    max_spread_pct: float,
    premium_min: float,
    premium_max: float,
    mode: str,
) -> list[dict]:
    """
    Scan a single ticker's option chain using the proven Zacks logic.
    """
    if not HAS_YFINANCE:
        return []

    try:
        symbol_clean = symbol.replace(".", "-")  # BRK.B → BRK-B
        t = yf.Ticker(symbol_clean)

        try:
            price = t.fast_info["lastPrice"]
        except Exception:
            try:
                info = t.info
                price = info.get("currentPrice") or info.get("regularMarketPrice", 0)
            except Exception:
                return []

        if price < min_price:
            return []

        expirations = t.options
        if not expirations:
            return []

        today = datetime.now()
        results = []

        # Filter expirations by DTE window
        valid_expiries = []
        for exp_str in expirations:
            try:
                exp_date = datetime.strptime(exp_str, "%Y-%m-%d")
                dte = (exp_date - today).days
                if dte_min <= dte <= dte_max:
                    valid_expiries.append((exp_str, dte, dte / 365.0))
            except ValueError:
                continue

        for exp_str, dte, dte_years in valid_expiries:
            try:
                chain = t.option_chain(exp_str).calls
                if chain.empty:
                    continue

                for _, opt in chain.iterrows():
                    strike = float(opt.get("strike", 0))
                    bid = float(opt.get("bid", 0) or 0)
                    ask = float(opt.get("ask", 0) or 0)
                    iv = float(opt.get("impliedVolatility", 0) or 0)
                    volume = int(opt.get("volume", 0) or 0)
                    oi = int(opt.get("openInterest", 0) or 0)
                    last_price = float(opt.get("lastPrice", 0) or 0)

                    # Midpoint premium
                    mid = (bid + ask) / 2
                    if mid <= 0:
                        continue

                    # Premium range filter
                    if mid < premium_min or mid > premium_max:
                        continue

                    # Moneyness filter
                    if mode == "atm_otm" and strike < price:
                        continue  # ATM/OTM only
                    if mode == "itm_atm" and strike > price:
                        continue  # ITM/ATM only

                    # Bid/Ask spread filter
                    spread_pct = ((ask - bid) / mid) * 100 if mid > 0 else 100
                    if spread_pct > max_spread_pct:
                        continue

                    # Black-Scholes Delta
                    delta = _calculate_delta(price, strike, dte_years, RISK_FREE_RATE, iv)
                    if delta < min_delta:
                        continue

                    # Breakeven calculation
                    breakeven_price = strike + mid
                    breakeven_pct = ((breakeven_price / price) - 1) * 100

                    # Theta approximation (daily decay)
                    theta = 0.0
                    if dte > 0:
                        theta = round(-mid / dte, 4)

                    results.append({
                        "ticker": symbol,
                        "stock_price": round(price, 2),
                        "strike": round(strike, 2),
                        "expiration": exp_str,
                        "dte": dte,
                        "bid": round(bid, 2),
                        "ask": round(ask, 2),
                        "mid_price": round(mid, 2),
                        "last_price": round(last_price, 2),
                        "volume": volume,
                        "open_interest": oi,
                        "implied_volatility": round(iv * 100, 1),
                        "spread_pct": round(spread_pct, 1),
                        "delta": round(delta, 2),
                        "theta": theta,
                        "breakeven": round(breakeven_price, 2),
                        "breakeven_pct": round(breakeven_pct, 2),
                        "moneyness": "ATM" if abs(strike - price) / price < 0.03 else ("ITM" if strike < price else "OTM"),
                        "intrinsic_value": round(max(0, price - strike), 2),
                    })

            except Exception as e:
                logger.debug(f"Chain error {symbol}/{exp_str}: {e}")
                continue

        return results

    except Exception as e:
        logger.debug(f"Ticker scan failed {symbol}: {e}")
        return []


def get_alpha_calls(
    mode: str = "atm_otm",
    min_price: float = DEFAULT_MIN_PRICE,
    min_delta: float = DEFAULT_MIN_DELTA,
    dte_min: int = DEFAULT_DTE_MIN,
    dte_max: int = DEFAULT_DTE_MAX,
    max_spread_pct: float = DEFAULT_MAX_SPREAD_PCT,
    premium_min: float = DEFAULT_PREMIUM_MIN,
    premium_max: float = DEFAULT_PREMIUM_MAX,
    sort_by: str = "breakeven_pct",
    limit: int = 200,
    max_workers: int = MAX_WORKERS,
) -> dict:
    """
    Run the Alpha Call screening pipeline.
    Uses S&P 500 universe with Black-Scholes delta.
    """
    # Try S&P 500 first, fallback to momentum universe
    tickers = _get_sp500_tickers()
    universe_source = "S&P 500"
    if not tickers:
        tickers = _get_momentum_tickers()
        universe_source = "Momentum Universe"

    if not tickers:
        return {
            "calls": [],
            "meta": {"error": "No ticker universe available", "universe_size": 0},
            "timestamp": datetime.now().isoformat(),
        }

    # Cap tickers for speed
    scan_tickers = tickers[:limit]

    logger.info(f"Alpha Calls v3: Scanning {len(scan_tickers)}/{len(tickers)} {universe_source} tickers")

    all_calls: list[dict] = []
    errors = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(
                _scan_ticker, t, min_price, min_delta,
                dte_min, dte_max, max_spread_pct,
                premium_min, premium_max, mode,
            ): t
            for t in scan_tickers
        }
        for future in as_completed(futures):
            try:
                results = future.result(timeout=30)
                all_calls.extend(results)
            except Exception:
                errors += 1

    # Sort
    sort_map = {
        "breakeven_pct": lambda x: x.get("breakeven_pct", 999),
        "open_interest": lambda x: -x.get("open_interest", 0),
        "volume": lambda x: -x.get("volume", 0),
        "delta": lambda x: -x.get("delta", 0),
        "implied_volatility": lambda x: x.get("implied_volatility", 0),
        "spread_pct": lambda x: x.get("spread_pct", 100),
        "mid_price": lambda x: x.get("mid_price", 0),
    }
    sort_fn = sort_map.get(sort_by, sort_map["breakeven_pct"])
    all_calls.sort(key=sort_fn)

    return {
        "calls": all_calls,
        "meta": {
            "universe_source": universe_source,
            "universe_size": len(tickers),
            "tickers_scanned": len(scan_tickers),
            "contracts_found": len(all_calls),
            "tickers_with_calls": len(set(c["ticker"] for c in all_calls)),
            "errors": errors,
            "mode": mode,
            "mode_label": "Wealth Protection (ITM/ATM)" if mode == "itm_atm" else "Tactical Leverage (ATM/OTM)",
            "filters": {
                "min_price": f"${min_price}",
                "min_delta": min_delta,
                "dte_range": f"{dte_min}-{dte_max}d",
                "max_spread": f"{max_spread_pct}%",
                "premium_range": f"${premium_min}-${premium_max}",
            },
        },
        "timestamp": datetime.now().isoformat(),
    }
