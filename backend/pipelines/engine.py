"""
engine.py — High-Performance Concurrent Pipeline Engine
==========================================================
Replaces the serial build_dashboard_data() flow with a parallelized
architecture:

    ProcessPoolExecutor  → CPU-bound indicator math (bypasses GIL)
    ThreadPoolExecutor   → I/O-bound yfinance / yield data fetches
    asyncio orchestrator → coordinates everything without blocking FastAPI

Design constraints:
    - screen_ticker() must be a module-level function (picklable for multiprocessing)
    - DataFrames are serialized via shared memory when crossing process boundaries
    - Graceful degradation: falls back to serial if process pool fails
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import time
import traceback
import warnings
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

import momentum_config as cfg
import db
from momentum_data import smart_fetch
from momentum_screener import screen_ticker, screen_universe, sector_regimes
from momentum_strategies import generate_all_strategies
from redis_cache import get_cache
from validators import validate_universe

warnings.filterwarnings("ignore")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  CONFIGURATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# CPU workers for indicator math (leave 1 core for the event loop)
# In cloud mode, cap at 2 — Railway/Render report many shared CPUs but have limited RAM
_is_cloud = bool(os.environ.get("DEPLOY_TICKER_LIMIT") or os.environ.get("RAILWAY_ENVIRONMENT"))
CPU_WORKERS = 2 if _is_cloud else max(1, (os.cpu_count() or 4) - 1)

# I/O workers for network requests — reduce in cloud to avoid thread exhaustion
IO_WORKERS = 5 if _is_cloud else 20

# Chunk size for batched screening (controls peak memory)
SCREEN_CHUNK_SIZE = 50

# Retry configuration for yfinance rate limits
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 1.5  # seconds


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PROCESS-SAFE SCREENING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _screen_single(args: Tuple[str, pd.DataFrame]) -> Optional[dict]:
    """
    Wrapper for screen_ticker that's safe for ProcessPoolExecutor.
    Takes a (ticker, dataframe) tuple — picklable across processes.
    """
    ticker, df = args
    try:
        return screen_ticker(ticker, df)
    except Exception:
        return None


def screen_universe_parallel(
    ohlcv: Dict[str, pd.DataFrame],
    max_workers: Optional[int] = None,
    progress: bool = True,
) -> List[dict]:
    """
    Screen the full universe using ProcessPoolExecutor.
    Each worker runs screen_ticker() in a separate process,
    bypassing the GIL for true parallel CPU execution.

    Falls back to serial screening if multiprocessing fails.
    """
    workers = max_workers or CPU_WORKERS
    tickers = sorted(ohlcv.keys())
    results: List[dict] = []
    completed = 0
    start_time = time.perf_counter()

    if progress:
        print(f"    ⚡ Parallel screening: {len(tickers)} tickers across {workers} processes …")

    try:
        with ProcessPoolExecutor(max_workers=workers) as pool:
            # Submit all tickers as (ticker, df) tuples
            future_to_ticker = {
                pool.submit(_screen_single, (ticker, ohlcv[ticker])): ticker
                for ticker in tickers
            }

            for future in as_completed(future_to_ticker):
                completed += 1
                if progress and completed % 50 == 0:
                    elapsed = time.perf_counter() - start_time
                    rate = completed / elapsed if elapsed > 0 else 0
                    print(f"    Processed {completed}/{len(tickers)} ({rate:.0f} tickers/sec) …")

                result = future.result()
                if result is not None:
                    results.append(result)

    except Exception as e:
        if progress:
            print(f"    ⚠ ProcessPool failed ({e}). Falling back to serial …")
        # Fallback to serial screening
        return screen_universe(ohlcv, progress=progress)

    # Sort by |composite| descending (same as serial version)
    results.sort(key=lambda x: abs(x["composite"]), reverse=True)

    elapsed = time.perf_counter() - start_time
    if progress:
        print(f"    ✓ Screened {len(results)} tickers in {elapsed:.1f}s "
              f"({len(results) / elapsed:.0f} tickers/sec)")

    return results


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PARALLEL YIELD DATA FETCHING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _fetch_single_yield(
    ticker: str,
    results: List[dict],
) -> Optional[dict]:
    """
    Fetch dividend yield info for a single ticker via yfinance.
    Thread-safe — called from ThreadPoolExecutor.
    """
    import yfinance as yf

    for attempt in range(MAX_RETRIES):
        try:
            tk = yf.Ticker(ticker)
            info = tk.info or {}

            div_yield = info.get("dividendYield") or info.get("yield") or 0
            annual_div = info.get("dividendRate") or info.get("trailingAnnualDividendRate") or 0
            price = (info.get("regularMarketPrice")
                     or info.get("currentPrice")
                     or info.get("previousClose") or 0)
            name = info.get("shortName") or info.get("longName") or ticker
            ex_date = info.get("exDividendDate")
            sector_info = info.get("sector") or cfg.TICKER_SECTOR.get(ticker, "Unknown")
            category = info.get("category") or ""

            # Find matching screened result for momentum data
            matched = next((r for r in results if r["ticker"] == ticker), None)

            return {
                "ticker": ticker,
                "company_name": name[:40],
                "sector": sector_info,
                "category": category,
                "price": round(price, 2) if price else 0,
                "dividend_yield": round(div_yield * 100, 2) if div_yield else 0,
                "annual_dividend": round(annual_div, 2) if annual_div else 0,
                "ex_dividend_date": ex_date if ex_date else None,
                "composite": matched["composite"] if matched else 0,
                "probability": matched["probability"] if matched else 0,
                "daily_change": matched["daily_change"] if matched else 0,
                "sentiment": matched.get("sentiment", "Neutral") if matched else "Neutral",
                "regime": matched.get("regime", "Choppy") if matched else "Choppy",
                "sys1_score": matched.get("sys1_score", 0) if matched else 0,
                "sys2_score": matched.get("sys2_score", 0) if matched else 0,
                "sys3_score": matched.get("sys3_score", 0) if matched else 0,
                "sys4_score": matched.get("sys4_score", 0) if matched else 0,
                "momentum_phase": matched.get("momentum_phase", "Neutral") if matched else "Neutral",
                "return_20d": matched.get("return_20d", 0) if matched else 0,
                "vol_spike": matched.get("vol_spike", 1.0) if matched else 1.0,
            }

        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_BACKOFF_BASE * (2 ** attempt))
                continue
            return None


def fetch_yield_data_parallel(
    ticker_list: List[str],
    results: List[dict],
    max_workers: int = IO_WORKERS,
    progress: bool = True,
) -> List[dict]:
    """
    Fetch yield data for a list of tickers using ThreadPoolExecutor.
    ~20 concurrent HTTP calls vs sequential — typically 10-20× faster.
    """
    yield_data: List[dict] = []
    start_time = time.perf_counter()

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(_fetch_single_yield, ticker, results): ticker
            for ticker in ticker_list
        }
        for future in as_completed(futures):
            result = future.result()
            if result is not None:
                yield_data.append(result)

    yield_data.sort(key=lambda x: x["dividend_yield"], reverse=True)

    if progress:
        elapsed = time.perf_counter() - start_time
        print(f"    ✓ Fetched yield for {len(yield_data)} tickers in {elapsed:.1f}s")

    return yield_data


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  POST-PROCESSING (unchanged logic, extracted for clarity)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _slim(recs: List[dict]) -> List[dict]:
    """Remove bulky chart/system detail data from records."""
    return [{k: v for k, v in r.items()
             if k not in ("charts", "sys1", "sys2", "sys3", "sys4")}
            for r in recs]


def _compute_derived_lists(results: List[dict]) -> dict:
    """
    Compute all derived signal lists from screened results.
    This is the same logic as build_dashboard_data() but extracted
    into a pure function for testability.
    """
    # Fresh / Exhausting Momentum
    fresh_momentum = sorted(
        [r for r in results if r.get("momentum_phase") == "Fresh" and r["composite"] > 0],
        key=lambda x: x["composite"], reverse=True
    )[:100]

    exhausting_momentum = sorted(
        [r for r in results if r.get("momentum_phase") == "Exhausting"],
        key=lambda x: x["composite"], reverse=True
    )[:100]

    # Shock Signals
    shock_signals = sorted(
        [r for r in results if r.get("momentum_shock", {}).get("trigger", False)],
        key=lambda x: abs(x.get("momentum_shock", {}).get("shock_strength", 0)), reverse=True
    )[:100]

    # Smart Money
    smart_money_signals = sorted(
        [r for r in results if r.get("smart_money", {}).get("trigger", False)],
        key=lambda x: x.get("smart_money", {}).get("score", 0), reverse=True
    )[:100]

    # Continuation
    continuation_signals = sorted(
        [r for r in results if r.get("continuation", {}).get("probability", 0) > 30],
        key=lambda x: x.get("continuation", {}).get("probability", 0), reverse=True
    )[:100]

    # Rotation Ideas
    rotation_ideas = sorted(
        [r for r in results if r.get("regime") == "Trending" and r["composite"] > 0.3],
        key=lambda x: x["composite"], reverse=True
    )[:100]

    # Momentum Clusters
    sector_bull_counts: Dict[str, List[dict]] = {}
    for r in results:
        if r["composite"] > 0.1:
            sec = r.get("sector", "Unknown")
            sector_bull_counts.setdefault(sec, []).append(r)

    cluster_list = []
    for sec, stocks in sorted(sector_bull_counts.items(), key=lambda x: len(x[1]), reverse=True):
        if len(stocks) >= 3:
            for s in sorted(stocks, key=lambda x: x["composite"], reverse=True)[:5]:
                s_copy = dict(s)
                s_copy["cluster_size"] = len(stocks)
                cluster_list.append(s_copy)
    momentum_clusters = cluster_list[:100]

    # Shock Clusters
    shock_sector_counts: Dict[str, List[dict]] = {}
    for r in shock_signals:
        sec = r.get("sector", "Unknown")
        shock_sector_counts.setdefault(sec, []).append(r)

    sector_shock_list = []
    for sec, stocks in sorted(shock_sector_counts.items(), key=lambda x: len(x[1]), reverse=True):
        for s in stocks[:5]:
            s_copy = dict(s)
            s_copy["cluster_size"] = len(stocks)
            sector_shock_list.append(s_copy)
    shock_clusters = sector_shock_list[:100]

    # Gamma Signals
    gamma_signals = sorted(
        [r for r in results if r.get("vol_spike", 1.0) > 2.0 and r["composite"] > 0],
        key=lambda x: x.get("vol_spike", 0), reverse=True
    )[:100]

    # Hidden Gems
    hidden_gems = []
    for r in results:
        comp = r.get("composite", 0)
        prob = r.get("probability", 0)
        daily = abs(r.get("daily_change", 0))
        sent = r.get("sentiment", "")
        if comp > 0.3 and "bull" in sent.lower():
            gem_score = comp * (prob / 100) * (1 / (1 + daily))
            r_copy = dict(r)
            r_copy["gem_score"] = round(gem_score, 3)
            hidden_gems.append(r_copy)
    hidden_gems.sort(key=lambda x: x["gem_score"], reverse=True)
    hidden_gems = hidden_gems[:100]

    return {
        "fresh_momentum": _slim(fresh_momentum),
        "exhausting_momentum": _slim(exhausting_momentum),
        "shock_signals": _slim(shock_signals),
        "smart_money": _slim(smart_money_signals),
        "continuation": _slim(continuation_signals),
        "rotation_ideas": _slim(rotation_ideas),
        "momentum_clusters": _slim(momentum_clusters),
        "shock_clusters": _slim(shock_clusters),
        "gamma_signals": _slim(gamma_signals),
        "hidden_gems": _slim(hidden_gems),
        # ── Thematic Derived Lists ──
        "ai_stocks": _slim(sorted(
            [r for r in results if r["ticker"] in set(cfg.AI_STOCKS)],
            key=lambda x: x["composite"], reverse=True
        )),
        "bullish_momentum": _slim(sorted(
            [r for r in results if r["composite"] > 0.15 and r["daily_change"] > 0
             and r.get("regime") in ("Trending", "Choppy")
             and r["probability"] > 45
             and r["ticker"] not in set(cfg.ETF_TICKERS)],
            key=lambda x: x["composite"], reverse=True
        )[:100]),
        "high_volume_gappers": _slim(sorted(
            [r for r in results if r["daily_change"] > 1.0
             and r.get("vol_spike", 1.0) > 1.2 and r["composite"] > 0
             and r["ticker"] not in set(cfg.ETF_TICKERS)],
            key=lambda x: x["daily_change"], reverse=True
        )[:100]),
        "earnings_growers": [],  # Phase 2: requires quarterly financials pipeline
        "momentum_95": _slim(sorted(
            [r for r in results if r["probability"] >= 95],
            key=lambda x: x["probability"], reverse=True
        )),
    }


def _compute_summary(results: List[dict]) -> dict:
    """Compute dashboard summary statistics."""
    composites = [r["composite"] for r in results]
    n_bull = sum(1 for r in results if r["composite"] > 0.1)
    n_bear = sum(1 for r in results if r["composite"] < -0.1)
    n_neutral = len(results) - n_bull - n_bear
    avg_prob = float(np.mean([r["probability"] for r in results])) if results else 0

    bull_results = [r for r in results if r["composite"] > 0.1]
    bear_results = [r for r in results if r["composite"] < -0.1]
    top_bull = max(bull_results, key=lambda x: x["composite"]) if bull_results else None
    top_bear = min(bear_results, key=lambda x: x["composite"]) if bear_results else None

    return {
        "total_screened": len(results),
        "total_universe": len(cfg.ALL_TICKERS),
        "bullish": n_bull,
        "bearish": n_bear,
        "neutral": n_neutral,
        "avg_probability": round(avg_prob, 1),
        "avg_composite": round(float(np.mean(composites)), 2) if composites else 0,
        "top_bull": top_bull["ticker"] if top_bull else "—",
        "top_bear": top_bear["ticker"] if top_bear else "—",
    }


def _compute_sector_sentiment(results: List[dict]) -> dict:
    """Compute sector sentiment breakdown."""
    sector_sentiment: Dict[str, dict] = {}
    for r in results:
        s = r["sector"]
        if s not in sector_sentiment:
            sector_sentiment[s] = {"bullish": 0, "bearish": 0, "neutral": 0}
        if "Bull" in r["sentiment"]:
            sector_sentiment[s]["bullish"] += 1
        elif "Bear" in r["sentiment"]:
            sector_sentiment[s]["bearish"] += 1
        else:
            sector_sentiment[s]["neutral"] += 1
    return sector_sentiment


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PIPELINE STATUS MANAGER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class PipelineStatus:
    """Thread-safe pipeline status with optional WebSocket broadcast."""

    def __init__(self):
        self._state = "idle"
        self._message = ""
        self._subscribers: List[asyncio.Queue] = []

    @property
    def state(self) -> str:
        return self._state

    @property
    def message(self) -> str:
        return self._message

    def to_dict(self) -> dict:
        return {"state": self._state, "message": self._message}

    def update(self, state: str, message: str) -> None:
        self._state = state
        self._message = message

        # Push to Redis
        try:
            cache = get_cache()
            cache.set_pipeline_status(self.to_dict())
        except Exception:
            pass

        # Push to WebSocket subscribers (non-blocking)
        for q in self._subscribers:
            try:
                q.put_nowait(self.to_dict())
            except asyncio.QueueFull:
                pass

        print(f"  📊 Pipeline: {state} — {message}")

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        if q in self._subscribers:
            self._subscribers.remove(q)


# Global status singleton
pipeline_status = PipelineStatus()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MAIN PIPELINE ORCHESTRATOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def run_pipeline_sync(use_parallel: bool = True) -> dict:
    """
    Full pipeline: fetch → validate → screen → strategize → package.

    This is the synchronous version that runs in a background thread/process.
    Same output format as the original build_dashboard_data() for
    full backward compatibility with the serving layer.
    """
    total_start = time.perf_counter()

    pipeline_status.update("running", "[1/6] Fetching data (DB-backed incremental sync)…")
    print("=" * 64)
    print("  MOMENTUM TRADING SCREENER — Pipeline (Parallel Engine)")
    print("=" * 64)

    # ── Step 1: Fetch data ──
    print("\n[1/6] Fetching data (DB-backed incremental sync) …")
    ohlcv = smart_fetch(progress=True)
    if not ohlcv:
        pipeline_status.update("error", "No data fetched")
        raise RuntimeError("No data fetched")

    # ── Step 2: Validate ──
    pipeline_status.update("running", "[2/6] Validating OHLCV data…")
    print("\n[2/6] Validating OHLCV data (Pydantic) …")
    ohlcv, diags = validate_universe(ohlcv, progress=True)
    invalid_tickers = [d.ticker for d in diags if not d.is_valid]
    if invalid_tickers:
        print(f"    ⚠ Dropped {len(invalid_tickers)} invalid tickers: {invalid_tickers[:5]}…")

    # ── Step 3: Screen (PARALLEL) ──
    pipeline_status.update("running", f"[3/6] Screening {len(ohlcv)} tickers ({CPU_WORKERS} workers)…")
    print(f"\n[3/6] Running 4-system momentum screen ({CPU_WORKERS} workers) …")

    if use_parallel:
        results = screen_universe_parallel(ohlcv, progress=True)
    else:
        results = screen_universe(ohlcv, progress=True)

    # ── Step 4: Sector regimes & strategies ──
    pipeline_status.update("running", "[4/6] Computing sector regimes & strategies…")
    print("\n[4/6] Computing sector regimes & strategies …")
    sec_regimes = sector_regimes(results)
    strategies = generate_all_strategies(results)

    # ── Step 5: Yield data (PARALLEL I/O) ──
    pipeline_status.update("running", "[5/6] Fetching yield data (parallel)…")
    print("\n[5/6] Fetching yield data for ETFs & dividend stocks (parallel) …")

    etf_yield_data = fetch_yield_data_parallel(
        cfg.HIGH_YIELD_ETFS, results, progress=True
    )
    div_stock_data = fetch_yield_data_parallel(
        cfg.HIGH_DIVIDEND_STOCKS, results, progress=True
    )

    # ── Step 6: Package ──
    pipeline_status.update("running", "[6/6] Packaging dashboard data…")
    print("\n[6/6] Packaging dashboard data …")

    summary = _compute_summary(results)
    sector_sentiment = _compute_sector_sentiment(results)
    derived = _compute_derived_lists(results)

    signals_table = [{k: v for k, v in r.items()
                      if k not in ("charts", "sys1", "sys2", "sys3", "sys4")}
                     for r in results]
    chart_data = {r["ticker"]: r.get("charts", {}) for r in results}
    actionable = [s for s in strategies if s["direction"] != "NEUTRAL"][:30]
    quote = random.choice(cfg.QUOTES)

    try:
        db_stats = db.get_db_stats()
    except Exception:
        db_stats = {}

    # ── Snapshot daily top momentum for weekly tracking ──
    try:
        top_count = db.upsert_daily_top(results)
        print(f"    ✓ Snapshotted top {top_count} daily momentum leaders")
    except Exception as e:
        print(f"    ⚠ Daily top snapshot failed: {e}")

    elapsed = time.perf_counter() - total_start

    dashboard_data = {
        "quote": quote,
        "summary": summary,
        "signals": signals_table,
        "charts": chart_data,
        "strategies": actionable,
        "sector_regimes": sec_regimes,
        "sector_sentiment": sector_sentiment,
        "all_quotes": cfg.QUOTES,
        "db_stats": db_stats,
        "high_yield_etfs": etf_yield_data,
        "dividend_stocks": div_stock_data,
        **derived,
        "_meta": {
            "pipeline_time_sec": round(elapsed, 1),
            "parallel_workers": CPU_WORKERS,
            "tickers_screened": len(results),
            "tickers_universe": len(cfg.ALL_TICKERS),
        },
    }

    pipeline_status.update("done", f"Pipeline complete — {len(results)} tickers in {elapsed:.1f}s")
    print(f"\n✓ Pipeline complete: {len(results)} tickers screened in {elapsed:.1f}s")
    print(f"  Workers: {CPU_WORKERS} CPU / {IO_WORKERS} I/O")

    return dashboard_data


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PROGRESSIVE PIPELINE — INSTANT DASHBOARD RENDER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Priority tickers: most-watched names that should render first
PRIORITY_TICKERS = [
    # Mega-cap tech
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO",
    "ORCL", "CRM", "AMD", "ADBE", "NFLX", "INTC", "CSCO", "QCOM",
    # Financials
    "JPM", "V", "MA", "BAC", "GS", "BRK-B", "WFC", "MS",
    # Healthcare
    "UNH", "LLY", "JNJ", "ABBV", "MRK", "PFE", "TMO",
    # Consumer / Industrials
    "AMZN", "HD", "MCD", "NKE", "COST", "WMT", "CAT", "BA", "GE",
    # Energy / Materials
    "XOM", "CVX", "LIN",
    # ETFs
    "SPY", "QQQ", "IWM", "DIA",
]

# Global wave version — incremented each time dashboard cache is updated
_wave_version: int = 0


def get_wave_version() -> int:
    """Return the current wave version counter."""
    return _wave_version


def _package_dashboard(
    results: List[dict],
    etf_yield_data: List[dict] | None = None,
    div_stock_data: List[dict] | None = None,
    elapsed: float = 0.0,
    wave: int = 0,
    total_waves: int = 3,
    is_complete: bool = False,
) -> dict:
    """
    Package screened results into the dashboard JSON format.
    Reusable across progressive waves.
    """
    sec_regimes = sector_regimes(results)
    strategies = generate_all_strategies(results)

    summary = _compute_summary(results)
    sector_sentiment = _compute_sector_sentiment(results)
    derived = _compute_derived_lists(results)

    signals_table = [{k: v for k, v in r.items()
                      if k not in ("charts", "sys1", "sys2", "sys3", "sys4")}
                     for r in results]
    chart_data = {r["ticker"]: r.get("charts", {}) for r in results}
    actionable = [s for s in strategies if s["direction"] != "NEUTRAL"][:30]
    quote = random.choice(cfg.QUOTES)

    try:
        db_stats = db.get_db_stats()
    except Exception:
        db_stats = {}

    return {
        "quote": quote,
        "summary": summary,
        "signals": signals_table,
        "charts": chart_data,
        "strategies": actionable,
        "sector_regimes": sec_regimes,
        "sector_sentiment": sector_sentiment,
        "all_quotes": cfg.QUOTES,
        "db_stats": db_stats,
        "high_yield_etfs": etf_yield_data or [],
        "dividend_stocks": div_stock_data or [],
        **derived,
        "_meta": {
            "pipeline_time_sec": round(elapsed, 1),
            "parallel_workers": CPU_WORKERS,
            "tickers_screened": len(results),
            "tickers_universe": len(cfg.ALL_TICKERS),
            "wave": wave,
            "total_waves": total_waves,
            "is_complete": is_complete,
        },
    }


def run_pipeline_progressive(
    publish_callback,
    use_parallel: bool = True,
) -> dict:
    """
    Progressive pipeline: fetch → screen → publish in 3 waves.

    Wave 1: ~50 priority tickers (instant dashboard render, ~15-30s)
    Wave 2: Remaining S&P 500 (~450 tickers)
    Wave 3: Full universe (~1000+ remaining tickers) + yield data

    After each wave, calls publish_callback(dashboard_data) so the
    serving layer can cache partial results for the frontend.

    Returns the final complete dashboard data dict.
    """
    global _wave_version
    total_start = time.perf_counter()

    pipeline_status.update("running", "Wave 1/3 — Fetching priority tickers…")
    print("=" * 64)
    print("  MOMENTUM TRADING SCREENER — Progressive Pipeline")
    print("=" * 64)

    # ── Build wave ticker lists ──
    all_tickers = list(cfg.ALL_TICKERS)
    priority_set = set(PRIORITY_TICKERS)
    all_set = set(all_tickers)

    # Wave 1: priority tickers that exist in our universe
    wave1_tickers = [t for t in PRIORITY_TICKERS if t in all_set]
    # Deduplicate
    wave1_set = set(wave1_tickers)

    # Wave 2: S&P 500 constituents not in wave 1 (first ~500 from main sectors)
    _sp500_tickers = []
    for sector in ["Technology", "Healthcare", "Financials",
                    "Consumer Discretionary", "Industrials",
                    "Communication Services", "Consumer Staples", "Energy",
                    "Materials", "Real Estate", "Utilities"]:
        _sp500_tickers.extend(cfg.UNIVERSE.get(sector, [])[:60])
    wave2_tickers = [t for t in _sp500_tickers if t not in wave1_set and t in all_set]
    wave2_set = wave1_set | set(wave2_tickers)

    # Wave 3: everything else
    wave3_tickers = [t for t in all_tickers if t not in wave2_set]

    print(f"  Wave plan: {len(wave1_tickers)} → +{len(wave2_tickers)} → +{len(wave3_tickers)} tickers")

    # Accumulated results across waves
    all_results: List[dict] = []
    all_ohlcv: Dict[str, pd.DataFrame] = {}

    # ━━━━━━━━━━━ WAVE 1 — Priority tickers (instant render) ━━━━━━━━━━━
    print(f"\n[Wave 1/3] Fetching {len(wave1_tickers)} priority tickers …")
    pipeline_status.update("running", f"Wave 1/3 — Fetching {len(wave1_tickers)} priority tickers…")

    try:
        ohlcv1 = smart_fetch(tickers=wave1_tickers, progress=True)
        ohlcv1, _ = validate_universe(ohlcv1, progress=False)
        all_ohlcv.update(ohlcv1)

        if use_parallel:
            results1 = screen_universe_parallel(ohlcv1, progress=True)
        else:
            results1 = screen_universe(ohlcv1, progress=True)

        all_results.extend(results1)
        all_results.sort(key=lambda x: abs(x["composite"]), reverse=True)

        elapsed1 = time.perf_counter() - total_start
        print(f"  ✓ Wave 1 complete: {len(results1)} tickers in {elapsed1:.1f}s")

        # Publish wave 1
        data1 = _package_dashboard(all_results, elapsed=elapsed1, wave=1, total_waves=3)
        _wave_version += 1
        pipeline_status.update("running", f"Wave 1/3 done — {len(all_results)} tickers served. Loading more…")
        publish_callback(data1)
    except Exception as e:
        print(f"  ⚠ Wave 1 failed: {e}")
        traceback.print_exc()

    # ━━━━━━━━━━━ WAVE 2 — S&P 500 core ━━━━━━━━━━━
    print(f"\n[Wave 2/3] Fetching {len(wave2_tickers)} S&P 500 tickers …")
    pipeline_status.update("running", f"Wave 2/3 — Screening {len(wave2_tickers)} S&P 500 tickers…")

    try:
        ohlcv2 = smart_fetch(tickers=wave2_tickers, progress=True)
        ohlcv2, _ = validate_universe(ohlcv2, progress=False)
        all_ohlcv.update(ohlcv2)

        if use_parallel:
            results2 = screen_universe_parallel(ohlcv2, progress=True)
        else:
            results2 = screen_universe(ohlcv2, progress=True)

        all_results.extend(results2)
        all_results.sort(key=lambda x: abs(x["composite"]), reverse=True)

        elapsed2 = time.perf_counter() - total_start
        print(f"  ✓ Wave 2 complete: {len(all_results)} total tickers in {elapsed2:.1f}s")

        # Publish wave 2
        data2 = _package_dashboard(all_results, elapsed=elapsed2, wave=2, total_waves=3)
        _wave_version += 1
        pipeline_status.update("running", f"Wave 2/3 done — {len(all_results)} tickers. Loading full universe…")
        publish_callback(data2)
    except Exception as e:
        print(f"  ⚠ Wave 2 failed: {e}")
        traceback.print_exc()

    # ━━━━━━━━━━━ WAVE 3 — Full universe + yield data ━━━━━━━━━━━
    print(f"\n[Wave 3/3] Fetching {len(wave3_tickers)} remaining tickers + yield data …")
    pipeline_status.update("running", f"Wave 3/3 — Screening {len(wave3_tickers)} remaining tickers…")

    try:
        ohlcv3 = smart_fetch(tickers=wave3_tickers, progress=True)
        ohlcv3, _ = validate_universe(ohlcv3, progress=False)
        all_ohlcv.update(ohlcv3)

        if use_parallel:
            results3 = screen_universe_parallel(ohlcv3, progress=True)
        else:
            results3 = screen_universe(ohlcv3, progress=True)

        all_results.extend(results3)
        all_results.sort(key=lambda x: abs(x["composite"]), reverse=True)
    except Exception as e:
        print(f"  ⚠ Wave 3 screening failed: {e}")
        traceback.print_exc()

    # Yield data (runs alongside wave 3 results)
    print("\n  Fetching yield data for ETFs & dividend stocks …")
    try:
        etf_yield_data = fetch_yield_data_parallel(
            cfg.HIGH_YIELD_ETFS, all_results, progress=True
        )
        div_stock_data = fetch_yield_data_parallel(
            cfg.HIGH_DIVIDEND_STOCKS, all_results, progress=True
        )
    except Exception as e:
        print(f"  ⚠ Yield data failed: {e}")
        etf_yield_data = []
        div_stock_data = []

    # Snapshot daily top
    try:
        top_count = db.upsert_daily_top(all_results)
        print(f"    ✓ Snapshotted top {top_count} daily momentum leaders")
    except Exception as e:
        print(f"    ⚠ Daily top snapshot failed: {e}")

    # Final publish
    elapsed_total = time.perf_counter() - total_start
    final_data = _package_dashboard(
        all_results,
        etf_yield_data=etf_yield_data,
        div_stock_data=div_stock_data,
        elapsed=elapsed_total,
        wave=3,
        total_waves=3,
        is_complete=True,
    )
    _wave_version += 1
    publish_callback(final_data)

    pipeline_status.update("done", f"Pipeline complete — {len(all_results)} tickers in {elapsed_total:.1f}s")
    print(f"\n✓ Progressive pipeline complete: {len(all_results)} tickers in {elapsed_total:.1f}s")
    print(f"  Workers: {CPU_WORKERS} CPU / {IO_WORKERS} I/O")

    return final_data
