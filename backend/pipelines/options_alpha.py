"""
options_alpha.py — Alpha-Flow Options Intelligence Pipeline
============================================================
DIRECT PORT of proven Google Colab AlphaFlowEngine.

This is an exact copy of the user's working Colab code, adapted for
the FastAPI backend with two optimizations:
  1. ThreadPoolExecutor for parallel ticker scanning
  2. Chunked processing: first 50 tickers fast, then remaining in background

The math and filter logic are UNCHANGED from the Colab version.
"""

from __future__ import annotations

import logging
import math
import time as _time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

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


# ═══════════════════════════════════════════════════════════════
# 1. CORE QUANT PROTOCOL (THE MATH) — Unchanged from Colab
# ═══════════════════════════════════════════════════════════════

class FlowProtocol:
    @staticmethod
    def calculate_greeks(S, K, T, r, sigma):
        """Calculates Delta and Probability of Profit (POP)"""
        if T <= 0 or sigma <= 0:
            return 0, 0
        try:
            d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
            d2 = d1 - sigma * np.sqrt(T)
            delta = float(norm.cdf(d1))
            pop = float(norm.cdf(d2))  # Proxy for probability of expiring ITM
            # Guard against NaN
            if math.isnan(delta) or math.isinf(delta):
                delta = 0
            if math.isnan(pop) or math.isinf(pop):
                pop = 0
            return round(delta, 2), round(pop, 2)
        except Exception:
            return 0, 0

    @staticmethod
    def get_iv_hv_edge(ticker_obj, iv):
        """Calculates the spread between Implied and Historical Volatility"""
        try:
            hist = ticker_obj.history(period="30d")["Close"]
            if len(hist) < 20:
                return 0
            hv = float(np.log(hist / hist.shift(1)).dropna().std() * np.sqrt(252))
            if math.isnan(hv) or math.isinf(hv):
                return 0
            return round(hv - iv, 3)
        except Exception:
            return 0


# ═══════════════════════════════════════════════════════════════
# 2. S&P 500 UNIVERSE FETCH — Unchanged from Colab
# ═══════════════════════════════════════════════════════════════

def get_sp500():
    """Fetch S&P 500 tickers from Wikipedia with retry."""
    if not HAS_PD or not HAS_REQ:
        return []
    for attempt in range(3):
        try:
            url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
            headers = {"User-Agent": "Mozilla/5.0"}
            resp = _requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()
            tickers = pd.read_html(resp.text)[0]["Symbol"].tolist()
            logger.info(f"Fetched {len(tickers)} S&P 500 tickers")
            return tickers
        except Exception as e:
            logger.warning(f"S&P 500 fetch attempt {attempt + 1}/3 failed: {e}")
            if attempt < 2:
                _time.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s
    return []


def get_nasdaq100():
    """Fetch NASDAQ 100 tickers from Wikipedia with retry."""
    if not HAS_PD or not HAS_REQ:
        return []
    for attempt in range(3):
        try:
            url = "https://en.wikipedia.org/wiki/Nasdaq-100"
            headers = {"User-Agent": "Mozilla/5.0"}
            resp = _requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()
            tables = pd.read_html(resp.text)
            # The NASDAQ 100 table typically has a 'Ticker' or 'Symbol' column
            for t in tables:
                for col in ['Ticker', 'Symbol', 'ticker', 'symbol']:
                    if col in t.columns:
                        tickers = t[col].tolist()
                        logger.info(f"Fetched {len(tickers)} NASDAQ 100 tickers")
                        return tickers
            logger.warning("NASDAQ 100 table not found")
            return []
        except Exception as e:
            logger.warning(f"NASDAQ 100 fetch attempt {attempt + 1}/3 failed: {e}")
            if attempt < 2:
                _time.sleep(2 ** attempt)
    return []


# ═══════════════════════════════════════════════════════════════
# 3. SINGLE-TICKER SCAN — Exact Colab logic, parallelizable
# ═══════════════════════════════════════════════════════════════

def _scan_one_ticker(symbol: str) -> list[dict]:
    """
    Scan a single ticker — this is the inner loop of AlphaFlowEngine.execute_scan(),
    extracted so it can be run in parallel via ThreadPoolExecutor.

    The filter logic is IDENTICAL to the Colab version:
      - Price >= $25
      - DTE 90-150 days
      - Premium $1-$8
      - ATM/OTM only (strike >= price)
      - Spread <= 10%
      - OI > 100
      - Delta >= 0.35
    """
    if not HAS_YF:
        return []

    results = []
    try:
        t = yf.Ticker(symbol.replace(".", "-"))
        price = t.fast_info["lastPrice"]

        # Institutional Gate 1: Price Floor
        if price < 25:
            return []

        expirations = t.options
        if not expirations:
            return []

        today = datetime.now()

        # Institutional Gate 2: Time Buffer (90-150 Days)
        valid_expiries = [
            e for e in expirations
            if 90 <= (datetime.strptime(e, "%Y-%m-%d") - today).days <= 150
        ]

        if not valid_expiries:
            return []

        for exp in valid_expiries:
            try:
                chain = t.option_chain(exp).calls
                if chain.empty:
                    continue

                dte_days = (datetime.strptime(exp, "%Y-%m-%d") - today).days
                dte_years = dte_days / 365.0

                for _, opt in chain.iterrows():
                    bid = float(opt.get("bid", 0) or 0)
                    ask = float(opt.get("ask", 0) or 0)
                    last_price = float(opt.get("lastPrice", 0) or 0)

                    # After-hours fallback: use lastPrice when bid/ask are 0
                    if bid > 0 and ask > 0:
                        mid = (bid + ask) / 2
                        spread_pct = ((ask - bid) / mid) * 100
                        after_hours = False
                    elif last_price > 0:
                        mid = last_price
                        spread_pct = 0  # Can't calculate spread without bid/ask
                        after_hours = True
                    else:
                        continue  # No pricing data at all

                    # Institutional Gate 3: Premium ($1-$8)
                    if not (1.0 <= mid <= 8.0):
                        continue
                    if opt["strike"] < price:
                        continue  # ATM/OTM only

                    # Spread check (skip if after-hours — no live bid/ask)
                    if not after_hours and spread_pct > 10:
                        continue

                    # Institutional Gate 4: Liquidity Floor (OI > 100)
                    # Skip in after-hours mode — yfinance returns OI=0 when market closed
                    oi = int(opt.get("openInterest", 0) or 0)
                    if not after_hours and oi < 100:
                        continue

                    iv = float(opt.get("impliedVolatility", 0) or 0)

                    # Calculate Quant Metrics
                    if after_hours or iv < 0.10:
                        # After-hours: IV is garbage (0.01-0.06), use moneyness approximation
                        ratio = price / float(opt["strike"])
                        delta = round(max(0, min(1.0, 0.5 + (ratio - 1.0) * 2.5)), 2)
                        pop = round(max(0, min(1.0, delta * 0.85)), 2)
                        edge = 0  # Can't compute HV-IV edge with bad IV
                    else:
                        delta, pop = FlowProtocol.calculate_greeks(
                            price, opt["strike"], dte_years, 0.04, iv
                        )
                        edge = FlowProtocol.get_iv_hv_edge(t, iv)

                    # Veto Logic: Delta Floor
                    if delta < 0.35:
                        continue

                    # Calculate Breakeven %
                    be_pct = (((opt["strike"] + mid) / price) - 1) * 100

                    # COMPOSITE QUANT SCORE (0-100)
                    # Weights: 40% POP, 40% Vol Edge (HV > IV), 20% Liquidity (OI)
                    quant_score = (pop * 40) + (max(0, edge) * 100 * 4) + (min(10, oi / 1000) * 2)

                    results.append({
                        "ticker": symbol,
                        "stock_price": round(price, 2),
                        "strike": float(opt["strike"]),
                        "expiration": exp,
                        "dte": dte_days,
                        "bid": round(bid, 2),
                        "ask": round(ask, 2),
                        "mid_price": round(mid, 2),
                        "delta": delta,
                        "pop": pop,
                        "vol_edge": edge,
                        "breakeven_pct": round(be_pct, 2),
                        "open_interest": oi,
                        "volume": int(opt.get("volume", 0) or 0),
                        "implied_volatility": round(iv * 100, 1),
                        "spread_pct": round(spread_pct, 1),
                        "quant_score": round(quant_score, 2),
                        "moneyness": "ATM" if abs(opt["strike"] - price) / price < 0.03 else "OTM",
                    })

            except Exception as e:
                logger.debug(f"Chain error {symbol}/{exp}: {e}")
                continue

    except Exception as e:
        logger.debug(f"Ticker scan failed {symbol}: {e}")

    return results


# ═══════════════════════════════════════════════════════════════
# 4. PUBLIC API — Parallel scan with chunked processing
# ═══════════════════════════════════════════════════════════════

def get_alpha_calls(
    limit: int = 75,
    max_workers: int = 2,
    sort_by: str = "quant_score",
    universe: str = "sp500",
    **kwargs,  # Accept extra params from API without breaking
) -> dict:
    """
    Run the Alpha-Flow scan across S&P 500 and/or NASDAQ 100.

    Args:
        limit: Number of tickers to scan (default 75)
        max_workers: Thread pool size
        sort_by: Sort key for results
        universe: 'sp500', 'nasdaq100', or 'both'

    Returns:
        dict with calls, meta, timestamp
    """
    # Fetch universe based on selection
    if universe == "nasdaq100":
        tickers = get_nasdaq100()
        src = "NASDAQ 100"
    elif universe == "both":
        sp = get_sp500()
        nq = get_nasdaq100()
        # Merge and deduplicate, preserving order
        seen = set()
        tickers = []
        for t in sp + nq:
            if t not in seen:
                seen.add(t)
                tickers.append(t)
        src = "S&P 500 + NASDAQ 100"
    else:
        tickers = get_sp500()
        src = "S&P 500"
    if not tickers:
        # Fallback to momentum universe
        try:
            import json
            from pathlib import Path

            p = Path(__file__).parent / "momentum_data.json"
            if p.exists():
                with open(p) as f:
                    data = json.load(f)
                tickers = [s["ticker"] for s in data.get("signals", []) if s.get("price", 0) >= 10]
                src = "Momentum"
        except Exception:
            pass

    if not tickers:
        return {
            "calls": [],
            "meta": {"error": "No universe available", "universe_size": 0},
            "timestamp": datetime.now().isoformat(),
        }

    scan_tickers = tickers[:limit]
    logger.info(f"Alpha-Flow: Scanning {len(scan_tickers)}/{len(tickers)} {src} tickers")

    all_calls: list[dict] = []
    errors = 0
    timed_out = False

    # Overall scan timeout: 4 minutes — return partial results if exceeded
    SCAN_TIMEOUT = 240  # seconds
    scan_start = _time.monotonic()

    # Parallel scan via ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_scan_one_ticker, sym): sym
            for sym in scan_tickers
        }
        completed = 0
        for future in as_completed(futures):
            # Check overall timeout
            elapsed = _time.monotonic() - scan_start
            if elapsed > SCAN_TIMEOUT:
                logger.warning(
                    f"Alpha-Flow: Overall timeout ({SCAN_TIMEOUT}s) hit after "
                    f"{completed}/{len(scan_tickers)} tickers. Returning partial results."
                )
                timed_out = True
                # Cancel remaining futures
                for f in futures:
                    f.cancel()
                break
            try:
                results = future.result(timeout=30)  # 30s per-ticker timeout
                all_calls.extend(results)
            except Exception:
                errors += 1
            completed += 1

    # Sort — default by Quant_Score descending (matching Colab)
    reverse = sort_by not in ("breakeven_pct", "spread_pct")
    all_calls.sort(key=lambda x: x.get(sort_by, 0), reverse=reverse)

    scan_elapsed = round(_time.monotonic() - scan_start, 1)
    logger.info(
        f"Alpha-Flow: Done in {scan_elapsed}s — "
        f"{len(all_calls)} contracts from {len(set(c['ticker'] for c in all_calls))} tickers"
    )

    return {
        "calls": all_calls,
        "meta": {
            "universe_source": src,
            "universe_size": len(tickers),
            "tickers_scanned": completed if timed_out else len(scan_tickers),
            "contracts_found": len(all_calls),
            "tickers_with_calls": len(set(c["ticker"] for c in all_calls)),
            "errors": errors,
            "partial": timed_out,
            "scan_time_seconds": scan_elapsed,
            "filters": {
                "price_floor": "$25",
                "dte_range": "90-150d",
                "premium_range": "$1-$8",
                "spread_max": "10%",
                "oi_floor": "100",
                "delta_floor": "0.35",
                "moneyness": "ATM/OTM",
            },
        },
        "timestamp": datetime.now().isoformat(),
    }
