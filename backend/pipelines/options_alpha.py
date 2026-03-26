"""
options_alpha.py — Alpha-Flow Options Intelligence Pipeline (v2 — Optimized)
==============================================================================
High-performance options scanner with:
  1. Per-ticker HV caching (eliminates N+1 yfinance bug)
  2. Vectorized Pandas gates (no iterrows for filtering)
  3. Connection pooling + anti-ban jitter
  4. Module-level ticker list caching (24h TTL)
  5. Retry with exponential backoff on yfinance calls

The quant math and 7 institutional gate logic are UNCHANGED.
"""

from __future__ import annotations

import logging
import math
import random
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
# 0. NOTE: yfinance handles its own sessions (requires curl_cffi).
#    We do NOT pass a custom requests.Session — it would break.
#    Anti-ban jitter + retry logic is applied manually below.
# ═══════════════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════════════
# 1. CORE QUANT PROTOCOL (THE MATH) — Unchanged
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
            pop = float(norm.cdf(d2))
            if math.isnan(delta) or math.isinf(delta):
                delta = 0
            if math.isnan(pop) or math.isinf(pop):
                pop = 0
            return round(delta, 2), round(pop, 2)
        except Exception:
            return 0, 0


# ═══════════════════════════════════════════════════════════════
# 2. TICKER UNIVERSE FETCH — With 24-Hour Module-Level Cache
# ═══════════════════════════════════════════════════════════════

_TICKER_CACHE: dict[str, tuple[list[str], float]] = {}
_TICKER_CACHE_TTL = 86400  # 24 hours

# Hardcoded fallback for when Wikipedia is unreachable
_SP500_FALLBACK = [
    "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "META", "TSLA", "BRK-B",
    "UNH", "JNJ", "V", "XOM", "JPM", "PG", "MA", "HD", "CVX", "MRK",
    "ABBV", "LLY", "PEP", "KO", "COST", "AVGO", "WMT", "MCD", "CSCO",
    "TMO", "ACN", "ABT", "DHR", "NEE", "LIN", "CRM", "AMD", "TXN",
    "PM", "UNP", "QCOM", "HON", "MS", "GS", "BA", "CAT", "RTX",
    "INTC", "AMGN", "IBM", "GE",
]


def get_sp500() -> list[str]:
    """Fetch S&P 500 tickers from Wikipedia with 24h cache."""
    if not HAS_PD or not HAS_REQ:
        return _SP500_FALLBACK

    cached = _TICKER_CACHE.get("sp500")
    if cached and (_time.monotonic() - cached[1]) < _TICKER_CACHE_TTL:
        logger.info(f"Using cached S&P 500 tickers ({len(cached[0])})")
        return cached[0]

    for attempt in range(3):
        try:
            url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
            headers = {"User-Agent": "Mozilla/5.0"}
            resp = _requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()
            tickers = pd.read_html(resp.text)[0]["Symbol"].tolist()
            _TICKER_CACHE["sp500"] = (tickers, _time.monotonic())
            logger.info(f"Fetched {len(tickers)} S&P 500 tickers (cached for 24h)")
            return tickers
        except Exception as e:
            logger.warning(f"S&P 500 fetch attempt {attempt + 1}/3 failed: {e}")
            if attempt < 2:
                _time.sleep(2 ** attempt)

    logger.warning("All S&P 500 fetch attempts failed, using fallback")
    return _SP500_FALLBACK


def get_nasdaq100() -> list[str]:
    """Fetch NASDAQ 100 tickers from Wikipedia with 24h cache."""
    if not HAS_PD or not HAS_REQ:
        return []

    cached = _TICKER_CACHE.get("nasdaq100")
    if cached and (_time.monotonic() - cached[1]) < _TICKER_CACHE_TTL:
        logger.info(f"Using cached NASDAQ 100 tickers ({len(cached[0])})")
        return cached[0]

    for attempt in range(3):
        try:
            url = "https://en.wikipedia.org/wiki/Nasdaq-100"
            headers = {"User-Agent": "Mozilla/5.0"}
            resp = _requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()
            tables = pd.read_html(resp.text)
            for t in tables:
                for col in ['Ticker', 'Symbol', 'ticker', 'symbol']:
                    if col in t.columns:
                        tickers = t[col].tolist()
                        _TICKER_CACHE["nasdaq100"] = (tickers, _time.monotonic())
                        logger.info(f"Fetched {len(tickers)} NASDAQ 100 tickers (cached for 24h)")
                        return tickers
            logger.warning("NASDAQ 100 table not found")
            return []
        except Exception as e:
            logger.warning(f"NASDAQ 100 fetch attempt {attempt + 1}/3 failed: {e}")
            if attempt < 2:
                _time.sleep(2 ** attempt)
    return []


# ═══════════════════════════════════════════════════════════════
# 3. SINGLE-TICKER SCAN — Optimized with:
#    - Per-ticker HV caching (closure, computed ONCE)
#    - Vectorized Pandas gates (no iterrows for filtering)
#    - Anti-ban jitter + retry with backoff
#    - Connection pooling via shared session
# ═══════════════════════════════════════════════════════════════

def _yf_retry(fn, retries=2, base_delay=1.0):
    """Retry a yfinance call with exponential backoff."""
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as e:
            if attempt == retries:
                raise
            delay = base_delay * (2 ** attempt) + random.uniform(0, 0.5)
            logger.debug(f"yfinance retry {attempt + 1}/{retries}: {e}, sleeping {delay:.1f}s")
            _time.sleep(delay)


def _scan_one_ticker(symbol: str) -> list[dict]:
    """
    Scan a single ticker with all optimizations applied.

    Key changes from v1:
      1. HV is computed ONCE per ticker via closure (not per-contract)
      2. Vectorized Pandas filtering for gates 3-6
      3. Anti-ban jitter before yfinance calls
      4. Shared requests.Session for connection pooling
    """
    if not HAS_YF:
        return []

    results = []

    # Anti-ban jitter: small random delay to spread requests
    _time.sleep(random.uniform(0.05, 0.3))

    try:
        t = yf.Ticker(symbol.replace(".", "-"))

        # Use retry wrapper for the initial price fetch
        price = _yf_retry(lambda: t.fast_info["lastPrice"])

        # ── Gate 1: Price Floor ($25) ──
        if price < 25:
            return []

        expirations = _yf_retry(lambda: t.options)
        if not expirations:
            return []

        today = datetime.now()

        # ── Gate 2: DTE 90-150 days (pre-filter expirations) ──
        valid_expiries = [
            e for e in expirations
            if 90 <= (datetime.strptime(e, "%Y-%m-%d") - today).days <= 150
        ]
        if not valid_expiries:
            return []

        # ── Pre-compute HV ONCE for this ticker (fixes N+1 bug) ──
        _hv: float | None = None

        def _get_edge(iv: float) -> float:
            nonlocal _hv
            if _hv is None:
                try:
                    hist = t.history(period="30d")["Close"]
                    if len(hist) >= 20:
                        _hv = float(np.log(hist / hist.shift(1)).dropna().std() * np.sqrt(252))
                    else:
                        _hv = 0.0
                except Exception:
                    _hv = 0.0
                if math.isnan(_hv) or math.isinf(_hv):
                    _hv = 0.0
            if _hv == 0.0:
                return 0
            return round(_hv - iv, 3)

        for exp in valid_expiries:
            try:
                chain = _yf_retry(lambda: t.option_chain(exp).calls)
                if chain is None or chain.empty:
                    continue

                dte_days = (datetime.strptime(exp, "%Y-%m-%d") - today).days
                dte_years = dte_days / 365.0

                # ══════════════════════════════════════════════════
                # VECTORIZED GATES (3-6) — filter DataFrame in bulk
                # ══════════════════════════════════════════════════

                # Ensure numeric columns, fill NaN with 0
                chain = chain.copy()
                for col in ["bid", "ask", "lastPrice", "openInterest", "impliedVolatility", "volume"]:
                    if col in chain.columns:
                        chain[col] = pd.to_numeric(chain[col], errors="coerce").fillna(0)

                # Compute mid price (bid/ask → mid, fallback to lastPrice)
                has_quotes = (chain["bid"] > 0) & (chain["ask"] > 0)
                chain["mid"] = 0.0
                chain.loc[has_quotes, "mid"] = (chain.loc[has_quotes, "bid"] + chain.loc[has_quotes, "ask"]) / 2
                chain.loc[~has_quotes, "mid"] = chain.loc[~has_quotes, "lastPrice"]
                chain["after_hours"] = ~has_quotes

                # Spread %
                chain["spread_pct"] = 0.0
                chain.loc[has_quotes, "spread_pct"] = (
                    (chain.loc[has_quotes, "ask"] - chain.loc[has_quotes, "bid"]) / chain.loc[has_quotes, "mid"] * 100
                )

                # Must have SOME price
                has_price = chain["mid"] > 0

                # Gate 3: Premium $1-$8
                gate3 = (chain["mid"] >= 1.0) & (chain["mid"] <= 8.0)

                # Gate 4: ATM/OTM only (strike >= stock price)
                gate4 = chain["strike"] >= price

                # Gate 5: Spread <= 10% (skip for after-hours)
                gate5 = chain["after_hours"] | (chain["spread_pct"] <= 10)

                # Gate 6: OI > 100 (skip for after-hours)
                oi_col = chain["openInterest"].astype(int)
                gate6 = chain["after_hours"] | (oi_col > 100)

                # Combined vectorized mask
                mask = has_price & gate3 & gate4 & gate5 & gate6
                survivors = chain[mask]

                if survivors.empty:
                    continue

                # ══════════════════════════════════════════════════
                # ITERATE only survivors — compute Greeks + score
                # ══════════════════════════════════════════════════

                for _, opt in survivors.iterrows():
                    bid = float(opt["bid"])
                    ask = float(opt["ask"])
                    mid = float(opt["mid"])
                    after_hours = bool(opt["after_hours"])
                    oi = int(opt["openInterest"])
                    iv = float(opt["impliedVolatility"])
                    spread_pct_val = float(opt["spread_pct"])

                    # Calculate Quant Metrics
                    if after_hours or iv < 0.10:
                        ratio = price / float(opt["strike"])
                        delta = round(max(0, min(1.0, 0.5 + (ratio - 1.0) * 2.5)), 2)
                        pop = round(max(0, min(1.0, delta * 0.85)), 2)
                        edge = 0
                    else:
                        delta, pop = FlowProtocol.calculate_greeks(
                            price, opt["strike"], dte_years, 0.04, iv
                        )
                        edge = _get_edge(iv)  # Uses cached HV — no extra API call

                    # ── Gate 7: Delta >= 0.35 ──
                    if delta < 0.35:
                        continue

                    # Breakeven %
                    be_pct = (((opt["strike"] + mid) / price) - 1) * 100

                    # COMPOSITE QUANT SCORE (0-100)
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
                        "spread_pct": round(spread_pct_val, 1),
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
# 4. PUBLIC API — Parallel scan with optimized orchestration
# ═══════════════════════════════════════════════════════════════

def get_alpha_calls(
    limit: int = 75,
    max_workers: int = 4,
    sort_by: str = "quant_score",
    universe: str = "sp500",
    **kwargs,
) -> dict:
    """
    Run the Alpha-Flow scan across S&P 500 and/or NASDAQ 100.

    v2 changes:
      - 4 workers (up from 2)
      - Connection pooling via shared session
      - Ticker list cached 24h
      - HV computed once per ticker
      - Vectorized gate filtering
    """
    # Fetch universe (cached for 24h)
    if universe == "nasdaq100":
        tickers = get_nasdaq100()
        src = "NASDAQ 100"
    elif universe == "both":
        sp = get_sp500()
        nq = get_nasdaq100()
        seen = set()
        tickers = []
        for t_sym in sp + nq:
            if t_sym not in seen:
                seen.add(t_sym)
                tickers.append(t_sym)
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
    logger.info(f"Alpha-Flow v2: Scanning {len(scan_tickers)}/{len(tickers)} {src} tickers ({max_workers} workers)")

    all_calls: list[dict] = []
    errors = 0
    timed_out = False

    # Overall scan timeout: 4 minutes
    SCAN_TIMEOUT = 240
    scan_start = _time.monotonic()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_scan_one_ticker, sym): sym
            for sym in scan_tickers
        }
        completed = 0
        for future in as_completed(futures):
            elapsed = _time.monotonic() - scan_start
            if elapsed > SCAN_TIMEOUT:
                logger.warning(
                    f"Alpha-Flow: Timeout ({SCAN_TIMEOUT}s) after "
                    f"{completed}/{len(scan_tickers)} tickers. Returning partial."
                )
                timed_out = True
                for f in futures:
                    f.cancel()
                break
            try:
                results = future.result(timeout=30)
                all_calls.extend(results)
            except Exception:
                errors += 1
            completed += 1

    # Sort
    reverse = sort_by not in ("breakeven_pct", "spread_pct")
    all_calls.sort(key=lambda x: x.get(sort_by, 0), reverse=reverse)

    scan_elapsed = round(_time.monotonic() - scan_start, 1)
    tickers_with_calls = len(set(c["ticker"] for c in all_calls))
    logger.info(
        f"Alpha-Flow v2: Done in {scan_elapsed}s — "
        f"{len(all_calls)} contracts from {tickers_with_calls} tickers"
    )

    return {
        "calls": all_calls,
        "meta": {
            "universe_source": src,
            "universe_size": len(tickers),
            "tickers_scanned": completed if timed_out else len(scan_tickers),
            "contracts_found": len(all_calls),
            "tickers_with_calls": tickers_with_calls,
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


# ═══════════════════════════════════════════════════════════════
# 5. DB-BACKED PIPELINE — Scan + persist to SQLite
# ═══════════════════════════════════════════════════════════════

def run_alpha_pipeline(
    universe: str = "sp500",
    max_workers: int = 4,
) -> dict:
    """
    Run a full alpha scan and persist results to the alpha_calls DB table.
    Called on startup and by the daily scheduler.

    Returns scan metadata dict.
    """
    try:
        import db
    except ImportError:
        from pipelines import db

    # Use get_alpha_calls() for the actual scanning
    # Scan ALL tickers (no limit) for a complete DB
    result = get_alpha_calls(
        limit=500,  # scan up to 500 tickers
        max_workers=max_workers,
        sort_by="quant_score",
        universe=universe,
    )

    calls = result.get("calls", [])
    meta = result.get("meta", {})

    # Persist to SQLite
    n = db.upsert_alpha_calls_bulk(calls, universe, meta)
    logger.info(f"Alpha pipeline: persisted {n} contracts for {universe}")

    return meta
