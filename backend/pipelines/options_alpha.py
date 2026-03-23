"""
options_alpha.py — Alpha-Flow Options Intelligence Pipeline (v4)
================================================================
Unified Alpha-Flow Engine: S&P 500 + Black-Scholes Greeks + Quant Score.
Derived from proven AlphaFlowEngine class pattern.

Institutional Gates:
  1. Price Floor: ≥ $25
  2. Time Buffer: DTE 90–150 days (adjustable)
  3. Premium: $1–$8 range (adjustable)
  4. Spread: ≤ 10% (adjustable)
  5. Liquidity: OI > 100 (adjustable)
  6. Delta: ≥ 0.35 (adjustable)

Quant Metrics:
  - Black-Scholes Delta + POP (Probability of Profit)
  - IV-HV Vol Edge (realized vs implied)
  - Composite Quant Score (0-100)

Breakeven: ((Strike + Premium) / Price - 1) × 100
"""

from __future__ import annotations

import json
import logging
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import numpy as np

logger = logging.getLogger("options_alpha")

try:
    import yfinance as yf
    HAS_YF = True
except ImportError:
    HAS_YF = False

try:
    from scipy.stats import norm
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

try:
    import pandas as pd
    HAS_PD = True
except ImportError:
    HAS_PD = False

try:
    import requests as _requests
    HAS_REQ = True
except ImportError:
    HAS_REQ = False

MOMENTUM_PATH = Path(__file__).parent / "momentum_data.json"

# ── Default Filter Config ──
DEFAULTS = {
    "min_price": 25.0,
    "min_delta": 0.35,
    "dte_min": 90,
    "dte_max": 150,
    "max_spread": 10.0,
    "prem_min": 1.0,
    "prem_max": 8.0,
    "min_oi": 100,
    "r": 0.04,
}
MAX_WORKERS = 10


# ── FlowProtocol (Core Math) ──

def _bs_greeks(S: float, K: float, T: float, r: float, sigma: float) -> tuple[float, float]:
    """Black-Scholes: returns (delta, pop)."""
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return 0.0, 0.0
    try:
        d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
        d2 = d1 - sigma * np.sqrt(T)
        if HAS_SCIPY:
            delta = float(norm.cdf(d1))
            pop = float(norm.cdf(d2))
        else:
            delta = float(max(0, min(1, 0.5 + d1 * 0.3)))
            pop = float(max(0, min(1, 0.5 + d2 * 0.3)))
        return (
            round(delta, 2) if not (math.isnan(delta) or math.isinf(delta)) else 0.0,
            round(pop, 2) if not (math.isnan(pop) or math.isinf(pop)) else 0.0,
        )
    except Exception:
        return 0.0, 0.0


def _iv_hv_edge(ticker_obj, iv: float) -> float:
    """HV-IV spread using t.history() (fast — reuses existing Ticker object)."""
    try:
        hist = ticker_obj.history(period="30d")["Close"]
        if len(hist) < 15:
            return 0.0
        hv = float(np.log(hist / hist.shift(1)).dropna().std() * np.sqrt(252))
        edge = hv - iv
        return round(edge, 3) if not (math.isnan(edge) or math.isinf(edge)) else 0.0
    except Exception:
        return 0.0


def _quant_score(pop: float, edge: float, oi: int) -> float:
    """Composite Quant Score (0-100): 40% POP, 40% Vol Edge, 20% Liquidity."""
    s = (pop * 40) + (max(0, edge) * 100 * 4) + (min(10, oi / 1000) * 2)
    return round(min(100, max(0, s)), 1)


# ── Universe ──

def _get_sp500() -> list[str]:
    """Fetch S&P 500 from Wikipedia with User-Agent."""
    if not HAS_PD or not HAS_REQ:
        return []
    try:
        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        resp = _requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        tickers = pd.read_html(resp.text)[0]["Symbol"].tolist()
        logger.info(f"Fetched {len(tickers)} S&P 500 tickers")
        return tickers
    except Exception as e:
        logger.warning(f"S&P 500 fetch failed: {e}")
        return []


def _get_momentum_tickers() -> list[str]:
    """Fallback universe from momentum_data.json."""
    if not MOMENTUM_PATH.exists():
        return []
    try:
        with open(MOMENTUM_PATH) as f:
            data = json.load(f)
        return [s["ticker"] for s in data.get("signals", []) if s.get("price", 0) >= 10]
    except Exception:
        return []


# ── Scan Logic ──

def _scan_ticker(
    symbol: str,
    min_price: float,
    min_delta: float,
    dte_min: int,
    dte_max: int,
    max_spread: float,
    prem_min: float,
    prem_max: float,
    min_oi: int,
    mode: str,
    r: float,
) -> list[dict]:
    """Scan a single ticker — proven AlphaFlowEngine logic."""
    if not HAS_YF:
        return []
    try:
        sym = symbol.replace(".", "-")
        t = yf.Ticker(sym)

        try:
            price = t.fast_info["lastPrice"]
        except Exception:
            try:
                price = (t.info or {}).get("currentPrice") or (t.info or {}).get("regularMarketPrice", 0)
            except Exception:
                return []

        if price < min_price:
            return []

        exps = t.options
        if not exps:
            return []

        today = datetime.now()
        valid = [(e, (datetime.strptime(e, "%Y-%m-%d") - today).days) for e in exps]
        valid = [(e, d) for e, d in valid if dte_min <= d <= dte_max]
        if not valid:
            return []

        # Fetch HV once per ticker (fast via t.history)
        _hv_cache = [None]

        def _get_hv():
            if _hv_cache[0] is None:
                try:
                    hist = t.history(period="30d")["Close"]
                    if len(hist) < 15:
                        _hv_cache[0] = 0.0
                    else:
                        val = float(np.log(hist / hist.shift(1)).dropna().std() * np.sqrt(252))
                        _hv_cache[0] = round(val, 4) if not (math.isnan(val) or math.isinf(val)) else 0.0
                except Exception:
                    _hv_cache[0] = 0.0
            return _hv_cache[0]

        results = []

        for exp, dte in valid:
            try:
                chain = t.option_chain(exp).calls
                if chain.empty:
                    continue
                dte_years = dte / 365.0

                for _, opt in chain.iterrows():
                    strike = float(opt.get("strike", 0))
                    bid = float(opt.get("bid", 0) or 0)
                    ask = float(opt.get("ask", 0) or 0)
                    iv = float(opt.get("impliedVolatility", 0) or 0)
                    oi = int(opt.get("openInterest", 0) or 0)
                    vol = int(opt.get("volume", 0) or 0)
                    last = float(opt.get("lastPrice", 0) or 0)

                    mid = (bid + ask) / 2
                    if mid <= 0:
                        continue

                    # Gate: Premium range
                    if mid < prem_min or mid > prem_max:
                        continue

                    # Gate: Moneyness
                    if mode == "atm_otm" and strike < price:
                        continue
                    if mode == "itm_atm" and strike > price:
                        continue

                    # Gate: Spread
                    spread = ((ask - bid) / mid) * 100
                    if spread > max_spread:
                        continue

                    # Gate: Liquidity (OI floor)
                    if oi < min_oi:
                        continue

                    # Black-Scholes Greeks
                    delta, pop = _bs_greeks(price, strike, dte_years, r, iv)

                    # Gate: Delta floor
                    if delta < min_delta:
                        continue

                    # HV-IV Edge (lazy fetch)
                    hv = _get_hv()
                    edge = round(hv - iv, 3) if hv > 0 else 0.0

                    # Quant Score
                    score = _quant_score(pop, edge, oi)

                    # Breakeven
                    be = ((strike + mid) / price - 1) * 100

                    results.append({
                        "ticker": symbol,
                        "stock_price": round(price, 2),
                        "strike": round(strike, 2),
                        "expiration": exp,
                        "dte": dte,
                        "bid": round(bid, 2),
                        "ask": round(ask, 2),
                        "mid_price": round(mid, 2),
                        "last_price": round(last, 2),
                        "volume": vol,
                        "open_interest": oi,
                        "implied_volatility": round(iv * 100, 1),
                        "spread_pct": round(spread, 1),
                        "delta": delta,
                        "pop": round(pop * 100, 1),
                        "hv": round(hv * 100, 1),
                        "vol_edge": round(edge * 100, 1),
                        "quant_score": score,
                        "theta": round(-mid / dte, 4) if dte > 0 else 0,
                        "breakeven": round(strike + mid, 2),
                        "breakeven_pct": round(be, 2),
                        "moneyness": "ATM" if abs(strike - price) / price < 0.03 else ("ITM" if strike < price else "OTM"),
                        "intrinsic_value": round(max(0, price - strike), 2),
                    })

            except Exception as e:
                logger.debug(f"Chain err {symbol}/{exp}: {e}")
                continue

        return results
    except Exception as e:
        logger.debug(f"Scan fail {symbol}: {e}")
        return []


# ── Public API ──

def get_alpha_calls(
    mode: str = "atm_otm",
    min_price: float = DEFAULTS["min_price"],
    min_delta: float = DEFAULTS["min_delta"],
    dte_min: int = DEFAULTS["dte_min"],
    dte_max: int = DEFAULTS["dte_max"],
    max_spread_pct: float = DEFAULTS["max_spread"],
    premium_min: float = DEFAULTS["prem_min"],
    premium_max: float = DEFAULTS["prem_max"],
    min_oi: int = DEFAULTS["min_oi"],
    sort_by: str = "quant_score",
    limit: int = 100,
    max_workers: int = MAX_WORKERS,
) -> dict:
    """
    Run the Alpha-Flow scan.
    Uses S&P 500 universe, Black-Scholes delta+POP, IV-HV edge, composite score.
    """
    tickers = _get_sp500()
    src = "S&P 500"
    if not tickers:
        tickers = _get_momentum_tickers()
        src = "Momentum"
    if not tickers:
        return {"calls": [], "meta": {"error": "No universe", "universe_size": 0}, "timestamp": datetime.now().isoformat()}

    scan = tickers[:limit]
    logger.info(f"Alpha-Flow v4: {len(scan)}/{len(tickers)} {src} tickers (mode={mode})")

    calls: list[dict] = []
    errs = 0

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futs = {
            pool.submit(
                _scan_ticker, t, min_price, min_delta,
                dte_min, dte_max, max_spread_pct,
                premium_min, premium_max, min_oi, mode, DEFAULTS["r"],
            ): t for t in scan
        }
        for f in as_completed(futs):
            try:
                calls.extend(f.result(timeout=30))
            except Exception:
                errs += 1

    # Sort
    rev = sort_by not in ("breakeven_pct", "spread_pct")
    calls.sort(key=lambda x: x.get(sort_by, 0), reverse=rev)

    return {
        "calls": calls,
        "meta": {
            "universe_source": src,
            "universe_size": len(tickers),
            "tickers_scanned": len(scan),
            "contracts_found": len(calls),
            "tickers_with_calls": len(set(c["ticker"] for c in calls)),
            "errors": errs,
            "mode": mode,
            "mode_label": "Wealth Protection (ITM/ATM)" if mode == "itm_atm" else "Tactical Leverage (ATM/OTM)",
            "filters": {
                "min_price": f"${min_price}",
                "min_delta": min_delta,
                "dte_range": f"{dte_min}-{dte_max}d",
                "max_spread": f"{max_spread_pct}%",
                "premium": f"${premium_min}-${premium_max}",
                "min_oi": min_oi,
            },
        },
        "timestamp": datetime.now().isoformat(),
    }
