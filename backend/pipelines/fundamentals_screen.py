"""
fundamentals_screen.py — Zacks-Inspired Fundamental Quality Screener
=====================================================================
Small module used ONLY by LEAPS category in options_alpha.py.
Sources data from yfinance .info endpoint (free, no API key).

Returns quality tiers: HIGH / MODERATE / LOW based on:
  - P/E ratio (trailing)
  - Market cap
  - Revenue growth (if available)
  - Analyst recommendation

24-hour per-ticker cache to avoid redundant API calls.
Thread-safe for use with ThreadPoolExecutor.
"""

from __future__ import annotations

import logging
import threading
import time as _time

logger = logging.getLogger("fundamentals_screen")

try:
    import yfinance as yf
    HAS_YF = True
except ImportError:
    HAS_YF = False

# ═══════════════════════════════════════════════════════════════
#  CACHE — 24h per-ticker, thread-safe
# ═══════════════════════════════════════════════════════════════

_cache: dict[str, tuple[dict, float]] = {}
_cache_lock = threading.Lock()
_CACHE_TTL = 86400  # 24 hours


def _get_cached(ticker: str) -> dict | None:
    with _cache_lock:
        entry = _cache.get(ticker)
        if entry and (_time.monotonic() - entry[1]) < _CACHE_TTL:
            return entry[0]
    return None


def _set_cached(ticker: str, data: dict):
    with _cache_lock:
        _cache[ticker] = (data, _time.monotonic())


# ═══════════════════════════════════════════════════════════════
#  QUALITY SCORING
# ═══════════════════════════════════════════════════════════════

_DEFAULT = {
    "pe_ratio": None,
    "forward_pe": None,
    "market_cap": None,
    "market_cap_label": "Unknown",
    "revenue_growth": None,
    "analyst_recommendation": None,
    "institutional_pct": None,
    "quality_tier": "LOW",
    "quality_score": 0.0,
}


def get_quality(ticker: str) -> dict:
    """
    Return fundamental quality signals for a single ticker.

    Returns dict with:
      pe_ratio          - trailing P/E (float or None)
      forward_pe        - forward P/E (float or None)
      market_cap        - raw market cap in dollars (int or None)
      market_cap_label  - "Mega" / "Large" / "Mid" / "Small" / "Unknown"
      revenue_growth    - YoY revenue growth % (float or None)
      analyst_recommendation - mean score 1-5 (1=Strong Buy, 5=Sell)
      institutional_pct - institutional ownership % (float or None)
      quality_tier      - "HIGH" / "MODERATE" / "LOW"
      quality_score     - 0.0 to 1.0 (used in LEAPS quant score)
    """
    # Check cache
    cached = _get_cached(ticker)
    if cached is not None:
        return cached

    if not HAS_YF:
        return _DEFAULT.copy()

    try:
        info = yf.Ticker(ticker.replace(".", "-")).info or {}
    except Exception as e:
        logger.debug(f"Fundamental fetch failed for {ticker}: {e}")
        return _DEFAULT.copy()

    # Extract metrics
    pe = info.get("trailingPE")
    fwd_pe = info.get("forwardPE")
    mkt_cap = info.get("marketCap")
    rev_growth = info.get("revenueGrowth")  # Decimal, e.g., 0.15 = 15%
    analyst = info.get("recommendationMean")  # 1-5
    inst_pct = info.get("heldPercentInstitutions")  # Decimal

    # Market cap label
    if mkt_cap and mkt_cap > 200_000_000_000:
        mc_label = "Mega"
    elif mkt_cap and mkt_cap > 10_000_000_000:
        mc_label = "Large"
    elif mkt_cap and mkt_cap > 2_000_000_000:
        mc_label = "Mid"
    elif mkt_cap:
        mc_label = "Small"
    else:
        mc_label = "Unknown"

    # ── Quality tier logic ──
    # HIGH: P/E < 30 AND market_cap > $20B
    # MODERATE: P/E < 50 AND market_cap > $5B
    # LOW: everything else
    tier = "LOW"
    score = 0.3  # default

    if pe and mkt_cap:
        if pe < 30 and mkt_cap > 20_000_000_000:
            tier = "HIGH"
            score = 1.0
        elif pe < 50 and mkt_cap > 5_000_000_000:
            tier = "MODERATE"
            score = 0.7
        elif pe < 50:
            tier = "MODERATE"
            score = 0.5
    elif mkt_cap and mkt_cap > 20_000_000_000:
        # No P/E (e.g., negative earnings) but mega-cap
        tier = "MODERATE"
        score = 0.5

    # Bonus for revenue growth
    if rev_growth and rev_growth > 0.10:
        score = min(1.0, score + 0.1)
    # Bonus for strong analyst consensus
    if analyst and analyst < 2.0:
        score = min(1.0, score + 0.05)

    result = {
        "pe_ratio": round(pe, 1) if pe else None,
        "forward_pe": round(fwd_pe, 1) if fwd_pe else None,
        "market_cap": mkt_cap,
        "market_cap_label": mc_label,
        "revenue_growth": round(rev_growth * 100, 1) if rev_growth else None,
        "analyst_recommendation": round(analyst, 1) if analyst else None,
        "institutional_pct": round(inst_pct * 100, 1) if inst_pct else None,
        "quality_tier": tier,
        "quality_score": round(score, 2),
    }

    _set_cached(ticker, result)
    return result


def batch_screen(tickers: list[str], max_workers: int = 4) -> dict[str, dict]:
    """
    Batch fundamental screen with ThreadPoolExecutor.
    Returns {ticker: quality_dict}.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    results = {}

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(get_quality, t): t for t in tickers}
        for future in as_completed(futures):
            ticker = futures[future]
            try:
                results[ticker] = future.result(timeout=10)
            except Exception:
                results[ticker] = _DEFAULT.copy()

    return results
