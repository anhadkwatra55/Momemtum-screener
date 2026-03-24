"""
insider_signals.py — Insider Buying Signal Scanner
====================================================
Identifies stocks where corporate insiders (C-suite, directors, 10%+ owners)
are actively buying shares — a strong alpha signal.

Data source: yfinance insider_transactions (from SEC Form 4 filings)

Scoring:
  - # of unique insiders buying in last 90 days
  - Total $ value of purchases
  - Recency (more recent = higher score)
  - Insider seniority (CEO/CFO/COO > Director > VP)
"""

from __future__ import annotations

import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd


# ── Seniority weights ──
SENIORITY_WEIGHTS: Dict[str, float] = {
    "CEO": 3.0,
    "Chief Executive Officer": 3.0,
    "CFO": 2.5,
    "Chief Financial Officer": 2.5,
    "COO": 2.5,
    "Chief Operating Officer": 2.5,
    "CTO": 2.0,
    "President": 2.5,
    "Chairman": 2.0,
    "Director": 1.5,
    "EVP": 1.5,
    "SVP": 1.3,
    "VP": 1.2,
    "General Counsel": 1.5,
    "10% Owner": 2.0,
}


def _seniority_score(position: str) -> float:
    """Map insider position/title to a seniority weight."""
    if not position:
        return 1.0
    pos_upper = position.upper()
    for key, weight in SENIORITY_WEIGHTS.items():
        if key.upper() in pos_upper:
            return weight
    return 1.0


def _is_purchase(row: dict) -> bool:
    """Determine if an insider transaction row is a purchase (not gift, sale, or exercise)."""
    text = str(row.get("Text", "")).lower()
    transaction = str(row.get("Transaction", "")).lower()

    # Explicit buys
    if "purchase" in text or "purchase" in transaction:
        return True
    if "buy" in text or "buy" in transaction:
        return True
    # "acquisition" that isn't option exercise or award
    if ("acquisition" in text or "acquisition" in transaction) and \
       "option" not in text and "award" not in text and "grant" not in text:
        return True

    # Exclude these explicitly
    if any(x in text for x in ["sale", "gift", "exercise", "conversion",
                                "disposed", "forfeited", "award", "grant",
                                "automatic", "10b5-1"]):
        return False

    # Check if value > 0 and it's marked as an acquisition
    value = row.get("Value", 0) or 0
    shares = row.get("Shares", 0) or 0
    if value > 0 and shares > 0 and "sale" not in text:
        return True

    return False


def fetch_insider_buys_single(ticker: str, lookback_days: int = 90) -> Optional[dict]:
    """
    Fetch insider buying activity for a single ticker.
    Returns a summary dict or None if no recent insider buys.
    """
    import yfinance as yf

    try:
        tk = yf.Ticker(ticker)
        txns = tk.insider_transactions
        if txns is None or len(txns) == 0:
            return None

        cutoff = datetime.now() - timedelta(days=lookback_days)
        buys = []

        for _, row in txns.iterrows():
            row_dict = row.to_dict()

            # Parse date
            start_date = row_dict.get("Start Date")
            if pd.isna(start_date):
                continue
            if isinstance(start_date, str):
                try:
                    start_date = datetime.strptime(start_date, "%Y-%m-%d")
                except ValueError:
                    continue
            elif hasattr(start_date, "to_pydatetime"):
                start_date = start_date.to_pydatetime()
                if hasattr(start_date, "tzinfo") and start_date.tzinfo:
                    start_date = start_date.replace(tzinfo=None)

            # Filter by date and purchase type
            if start_date < cutoff:
                continue
            if not _is_purchase(row_dict):
                continue

            shares = float(row_dict.get("Shares", 0) or 0)
            value = float(row_dict.get("Value", 0) or 0)
            insider = str(row_dict.get("Insider", "Unknown"))
            position = str(row_dict.get("Position", ""))

            buys.append({
                "date": start_date.strftime("%Y-%m-%d"),
                "insider": insider.title(),
                "position": position,
                "shares": int(shares),
                "value": round(value, 2),
                "seniority_weight": _seniority_score(position),
                "days_ago": (datetime.now() - start_date).days,
            })

        if not buys:
            return None

        # Sort by date (most recent first)
        buys.sort(key=lambda x: x["days_ago"])

        # Compute scores
        unique_insiders = len(set(b["insider"] for b in buys))
        total_value = sum(b["value"] for b in buys)
        total_shares = sum(b["shares"] for b in buys)
        avg_seniority = sum(b["seniority_weight"] for b in buys) / len(buys)

        # Recency boost: more recent buys score higher
        recency_scores = [max(0, 1 - (b["days_ago"] / lookback_days)) for b in buys]
        avg_recency = sum(recency_scores) / len(recency_scores) if recency_scores else 0

        # Composite insider score (0-100)
        # Factors: unique insiders, $ value, seniority, recency
        score = min(100, (
            unique_insiders * 15 +                    # More insiders = stronger signal
            min(total_value / 100_000, 30) +          # Up to 30 pts for $3M+
            avg_seniority * 10 +                       # Seniority matters
            avg_recency * 20 +                         # Recent is better
            len(buys) * 3                              # More transactions = conviction
        ))

        # Get current price info
        info = tk.info or {}
        price = (info.get("regularMarketPrice")
                 or info.get("currentPrice")
                 or info.get("previousClose") or 0)
        company_name = info.get("shortName") or info.get("longName") or ticker
        sector = info.get("sector") or "Unknown"

        return {
            "ticker": ticker,
            "company_name": company_name[:40],
            "sector": sector,
            "price": round(price, 2),
            "insider_score": round(score, 1),
            "total_value": round(total_value, 2),
            "total_shares": total_shares,
            "unique_insiders": unique_insiders,
            "transaction_count": len(buys),
            "avg_seniority": round(avg_seniority, 2),
            "avg_recency": round(avg_recency, 2),
            "most_recent_date": buys[0]["date"],
            "most_recent_insider": buys[0]["insider"],
            "most_recent_position": buys[0]["position"],
            "top_transactions": buys[:5],  # Top 5 most recent
        }

    except Exception as e:
        return None


def fetch_insider_buys_parallel(
    tickers: List[str],
    lookback_days: int = 90,
    max_workers: int = 10,
    progress: bool = True,
) -> List[dict]:
    """
    Fetch insider buying data for multiple tickers in parallel.
    Returns list sorted by insider_score descending.
    """
    results: List[dict] = []
    completed = 0
    start_time = time.perf_counter()

    if progress:
        print(f"    Scanning {len(tickers)} tickers for insider buys ({max_workers} workers)…")

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(fetch_insider_buys_single, ticker, lookback_days): ticker
            for ticker in tickers
        }
        for future in as_completed(futures):
            completed += 1
            if progress and completed % 50 == 0:
                elapsed = time.perf_counter() - start_time
                rate = completed / elapsed if elapsed > 0 else 0
                print(f"    Processed {completed}/{len(tickers)} ({rate:.0f}/sec)…")

            result = future.result()
            if result is not None:
                results.append(result)

    # Sort by insider score descending
    results.sort(key=lambda x: x["insider_score"], reverse=True)

    if progress:
        elapsed = time.perf_counter() - start_time
        print(f"    ✓ Found {len(results)} stocks with insider buys in {elapsed:.1f}s")

    return results


# Quick test
if __name__ == "__main__":
    # Test with a few well-known stocks
    test_tickers = ["AAPL", "NVDA", "MSFT", "GOOGL", "META", "AMZN", "JPM", "GS",
                     "BAC", "WMT", "JNJ", "PFE", "UNH", "XOM", "CVX"]
    results = fetch_insider_buys_parallel(test_tickers, lookback_days=180, max_workers=5)

    print(f"\nTop insider buys:")
    for r in results[:5]:
        print(f"  {r['ticker']:6s} score={r['insider_score']:5.1f}  "
              f"${r['total_value']:>12,.0f}  {r['unique_insiders']} insiders  "
              f"last={r['most_recent_date']}  {r['most_recent_insider']}")
