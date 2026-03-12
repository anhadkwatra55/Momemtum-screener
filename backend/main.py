#!/usr/bin/env python3
"""
MOMENTUM — FastAPI Backend Server (v3.0 — Parallel Engine)
============================================================
High-performance async serving layer for the MOMENTUM quantitative
trading screener. Uses the parallel pipeline engine for CPU-bound
indicator math and I/O-bound data fetching.

Key upgrades over v2:
  - ProcessPoolExecutor for 4-system screening (bypasses GIL)
  - Segmented Redis cache (don't deserialize full 10MB payload)
  - ETag conditional responses (sub-1ms 304 Not Modified)
  - WebSocket endpoint for real-time pipeline status push
  - orjson for 3-5x faster JSON serialization

Run:  cd backend && uvicorn main:app --host 0.0.0.0 --port 8060 --reload
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import threading
import traceback
import warnings
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

# Try orjson for fast serialization; fall back to stdlib json
try:
    import orjson
    HAS_ORJSON = True
except ImportError:
    HAS_ORJSON = False

warnings.filterwarnings("ignore")

# Add pipelines/ to sys.path so legacy imports work unmodified
PIPELINES_DIR = Path(__file__).parent / "pipelines"
sys.path.insert(0, str(PIPELINES_DIR))

# ── Pipeline imports ──
import momentum_config as cfg
import db
from backtester import backtest_universe, compare_systems, run_backtest
from momentum_data import smart_fetch, fetch_universe
from momentum_screener import screen_universe, sector_regimes
from momentum_strategies import generate_all_strategies
from strategy_engine import (
    get_indicator_catalog, run_strategy_backtest, run_code_strategy,
    compare_strategies as compare_strategy_results,
)
from redis_cache import get_cache, RedisCache
from validators import validate_universe, validate_ohlcv_dataframe
from engine import run_pipeline_sync, pipeline_status as _engine_status

# ── JSON Encoder for numpy types (fallback when orjson unavailable) ──

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            v = float(obj)
            return None if (np.isnan(v) or np.isinf(v)) else v
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, pd.Timestamp):
            return obj.strftime("%Y-%m-%d")
        return super().default(obj)


def _orjson_default(obj: Any) -> Any:
    """Custom serializer for orjson — handles remaining edge cases."""
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if (np.isnan(v) or np.isinf(v)) else v
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, pd.Timestamp):
        return obj.strftime("%Y-%m-%d")
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def encode_response(data: Any) -> Response:
    """Return JSON with fast encoding. Uses orjson if available."""
    if HAS_ORJSON:
        body = orjson.dumps(data, default=_orjson_default,
                           option=orjson.OPT_NON_STR_KEYS | orjson.OPT_SERIALIZE_NUMPY)
        return Response(content=body, media_type="application/json")
    body = json.loads(json.dumps(data, cls=NumpyEncoder))
    return JSONResponse(content=body)


# ── In-memory caches ──

_DATA_CACHE: dict[str, dict[str, pd.DataFrame]] = {}
_CACHE_LOCK = threading.Lock()
_CANCEL_EVENT = threading.Event()
_BACKTEST_LOCK = threading.Lock()

# ── Webhook registry ──
_WEBHOOK_URLS: list[str] = []
_WEBHOOK_LOCK = threading.Lock()


def _cache_key(period, start, end, tickers=None):
    t = tuple(sorted(tickers)) if tickers else "all"
    return f"{t}|{period}|{start}|{end}"


def _cached_fetch(tickers=None, period=None, start=None, end=None, progress=True):
    key = _cache_key(period, start, end, tickers)
    with _CACHE_LOCK:
        if key in _DATA_CACHE:
            if progress:
                print(f"    ✓ Using in-memory cache ({len(_DATA_CACHE[key])} tickers).")
            return _DATA_CACHE[key]
    result = smart_fetch(tickers=tickers, period=period, start=start, end=end, progress=progress)
    with _CACHE_LOCK:
        _DATA_CACHE[key] = result
    return result


def _fetch_ticker_data(ticker, period="1y", start=None, end=None):
    try:
        ohlcv = _cached_fetch(tickers=[ticker], period=period, start=start, end=end, progress=False)
        if ticker in ohlcv and len(ohlcv[ticker]) > 10:
            return ohlcv[ticker]
    except Exception:
        pass
    try:
        import yfinance as yf
        tk = yf.Ticker(ticker)
        df = tk.history(period=period)
        if df is not None and len(df) > 10:
            df.index = pd.to_datetime(df.index).tz_localize(None)
            try:
                db.upsert_ohlcv(ticker, df)
            except Exception:
                pass
            return df
    except Exception:
        pass
    return None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  DASHBOARD DATA BUILDER (legacy — kept for /api/screen)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def build_dashboard_data() -> dict:
    """Full pipeline: fetch → validate → screen → strategise → package for JSON."""
    _ps = _engine_status  # shorthand
    import random

    cache = get_cache()
    _ps.update("running", "Fetching data...")
    print("=" * 64)
    print("  MOMENTUM TRADING SCREENER — Pipeline")
    print("=" * 64)

    print("\n[1/5] Fetching data (DB-backed incremental sync) …")
    _ps.update("running", "[1/5] Fetching data (DB-backed)…")
    ohlcv = smart_fetch(progress=True)
    if not ohlcv:
        _ps.update("error", "No data fetched")
        raise RuntimeError("No data fetched")

    print("\n[2/5] Validating OHLCV data (Pydantic) …")
    _ps.update("running", "[2/5] Validating data…")
    ohlcv, diags = validate_universe(ohlcv, progress=True)
    invalid_tickers = [d.ticker for d in diags if not d.is_valid]
    if invalid_tickers:
        print(f"    ⚠ Dropped {len(invalid_tickers)} invalid tickers: {invalid_tickers[:5]}…")

    print("\n[3/5] Running 4-system momentum screen …")
    _ps.update("running", "[3/5] Running 4-system screen…")
    results = screen_universe(ohlcv, progress=True)

    print("\n[4/5] Computing sector regimes & strategies …")
    _ps.update("running", "[4/5] Computing strategies…")
    sec_regimes = sector_regimes(results)
    strategies = generate_all_strategies(results)

    print("\n[5/5] Packaging dashboard data …")
    _ps.update("running", "[5/5] Packaging data…")

    composites = [r["composite"] for r in results]
    n_bull = sum(1 for r in results if r["composite"] > 0.1)
    n_bear = sum(1 for r in results if r["composite"] < -0.1)
    n_neutral = len(results) - n_bull - n_bear
    avg_prob = float(np.mean([r["probability"] for r in results])) if results else 0

    bull_results = [r for r in results if r["composite"] > 0.1]
    bear_results = [r for r in results if r["composite"] < -0.1]
    top_bull = max(bull_results, key=lambda x: x["composite"]) if bull_results else None
    top_bear = min(bear_results, key=lambda x: x["composite"]) if bear_results else None

    sector_sentiment = {}
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

    _etf_set = set(cfg.ETF_TICKERS)
    _ai_set = set(cfg.AI_STOCKS)
    signals_table = []
    for r in results:
        row = {k: v for k, v in r.items() if k not in ("charts", "sys1", "sys2", "sys3", "sys4")}
        row["is_etf"] = r["ticker"] in _etf_set
        row["is_ai"] = r["ticker"] in _ai_set
        signals_table.append(row)

    chart_data = {r["ticker"]: r.get("charts", {}) for r in results}
    actionable = [s for s in strategies if s["direction"] != "NEUTRAL"][:30]
    quote = random.choice(cfg.QUOTES)

    try:
        db_stats = db.get_db_stats()
    except Exception:
        db_stats = {}

    fresh_momentum = sorted(
        [r for r in results if r.get("momentum_phase") == "Fresh" and r["composite"] > 0],
        key=lambda x: x["composite"], reverse=True
    )[:100]
    exhausting_momentum = sorted(
        [r for r in results if r.get("momentum_phase") == "Exhausting"],
        key=lambda x: x["composite"], reverse=True
    )[:100]
    shock_signals = sorted(
        [r for r in results if r.get("momentum_shock", {}).get("trigger", False)],
        key=lambda x: abs(x.get("momentum_shock", {}).get("shock_strength", 0)), reverse=True
    )[:100]
    smart_money_signals = sorted(
        [r for r in results if r.get("smart_money", {}).get("trigger", False)],
        key=lambda x: x.get("smart_money", {}).get("score", 0), reverse=True
    )[:100]
    continuation_signals = sorted(
        [r for r in results if r.get("continuation", {}).get("probability", 0) > 30],
        key=lambda x: x.get("continuation", {}).get("probability", 0), reverse=True
    )[:100]
    rotation_ideas = sorted(
        [r for r in results if r.get("regime") == "Trending" and r["composite"] > 0.3],
        key=lambda x: x["composite"], reverse=True
    )[:100]

    sector_bull_counts = {}
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

    shock_sector_counts = {}
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

    gamma_signals = sorted(
        [r for r in results if r.get("vol_spike", 1.0) > 2.0 and r["composite"] > 0],
        key=lambda x: x.get("vol_spike", 0), reverse=True
    )[:100]

    # Hidden Gems — high momentum + high probability + low daily movement (underrated)
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

    # ── High-Yield ETFs & Dividend Stocks ──
    print("\n[5.5/5] Fetching yield data for ETFs & dividend stocks …")
    _ps.update("running", "[5.5/5] Fetching yield data…")

    def _fetch_yield_info(ticker_list, label=""):
        """Fetch dividend yield info for a list of tickers via yfinance."""
        import yfinance as yf
        yield_data = []
        for ticker in ticker_list:
            try:
                tk = yf.Ticker(ticker)
                info = tk.info or {}
                div_yield = info.get("dividendYield") or info.get("yield") or 0
                annual_div = info.get("dividendRate") or info.get("trailingAnnualDividendRate") or 0
                price = info.get("regularMarketPrice") or info.get("currentPrice") or info.get("previousClose") or 0
                name = info.get("shortName") or info.get("longName") or ticker
                ex_date = info.get("exDividendDate")
                sector_info = info.get("sector") or cfg.TICKER_SECTOR.get(ticker, "Unknown")
                category = info.get("category") or ""

                # Find matching screened result for momentum data
                matched = next((r for r in results if r["ticker"] == ticker), None)

                entry = {
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
                yield_data.append(entry)
            except Exception as e:
                print(f"    ⚠ Yield fetch failed for {ticker}: {e}")
                continue
        return yield_data

    etf_yield_data = _fetch_yield_info(cfg.HIGH_YIELD_ETFS, "ETF")
    etf_yield_data.sort(key=lambda x: x["dividend_yield"], reverse=True)
    print(f"    ✓ Fetched yield for {len(etf_yield_data)} ETFs")

    div_stock_data = _fetch_yield_info(cfg.HIGH_DIVIDEND_STOCKS, "Stock")
    div_stock_data.sort(key=lambda x: x["dividend_yield"], reverse=True)
    print(f"    ✓ Fetched yield for {len(div_stock_data)} dividend stocks")

    def slim(recs):
        return [{k: v for k, v in r.items() if k not in ("charts", "sys1", "sys2", "sys3", "sys4")} for r in recs]

    # ── Persist all indicators to DB ──
    try:
        _etf_set_db = set(cfg.ETF_TICKERS)
        _ai_set_db = set(cfg.AI_STOCKS)
        persist_counts = db.persist_all_indicators(results, _etf_set_db, _ai_set_db)
        print(f"    ✓ Persisted to DB: {persist_counts}")
    except Exception as e:
        print(f"    ⚠ DB persist failed: {e}")

    _ps.update("done", "Pipeline complete")

    return {
        "quote": quote,
        "summary": {
            "total_screened": len(results),
            "total_universe": len(cfg.ALL_TICKERS),
            "bullish": n_bull,
            "bearish": n_bear,
            "neutral": n_neutral,
            "avg_probability": round(avg_prob, 1),
            "avg_composite": round(float(np.mean(composites)), 2) if composites else 0,
            "top_bull": top_bull["ticker"] if top_bull else "—",
            "top_bear": top_bear["ticker"] if top_bear else "—",
        },
        "signals": signals_table,
        "charts": chart_data,
        "strategies": actionable,
        "sector_regimes": sec_regimes,
        "sector_sentiment": sector_sentiment,
        "all_quotes": cfg.QUOTES,
        "db_stats": db_stats,
        "fresh_momentum": slim(fresh_momentum),
        "exhausting_momentum": slim(exhausting_momentum),
        "rotation_ideas": slim(rotation_ideas),
        "shock_signals": slim(shock_signals),
        "gamma_signals": slim(gamma_signals),
        "smart_money": slim(smart_money_signals),
        "continuation": slim(continuation_signals),
        "momentum_clusters": slim(momentum_clusters),
        "shock_clusters": slim(shock_clusters),
        "hidden_gems": slim(hidden_gems),
        "high_yield_etfs": etf_yield_data,
        "dividend_stocks": div_stock_data,
        # ── Thematic Derived Lists ──
        "ai_stocks": slim(sorted(
            [r for r in results if r["ticker"] in _ai_set],
            key=lambda x: x["composite"], reverse=True
        )),
        "bullish_momentum": slim(sorted(
            [r for r in results if r["composite"] > 0.15 and r["daily_change"] > 0
             and r.get("regime") in ("Trending", "Choppy")
             and r["probability"] > 45
             and r["ticker"] not in _etf_set],
            key=lambda x: x["composite"], reverse=True
        )[:100]),
        "high_volume_gappers": slim(sorted(
            [r for r in results if r["daily_change"] > 1.0
             and r.get("vol_spike", 1.0) > 1.2 and r["composite"] > 0
             and r["ticker"] not in _etf_set],
            key=lambda x: x["daily_change"], reverse=True
        )[:100]),
        "earnings_growers": [],  # TODO: Phase 2 — requires quarterly financials pipeline
        # ── Momentum Score 95+ ──
        "momentum_95": slim(sorted(
            [r for r in results if r["probability"] >= 95],
            key=lambda x: x["probability"], reverse=True
        )),
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  BACKGROUND PIPELINE (v3 — Engine-based)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_CACHED_DASHBOARD_DATA: dict | None = None


def _run_pipeline_background():
    """Run the parallel pipeline engine and cache results across all layers."""
    global _CACHED_DASHBOARD_DATA
    try:
        data = run_pipeline_sync(use_parallel=True)

        # Serialise once for all caches
        if HAS_ORJSON:
            raw = orjson.dumps(data, default=_orjson_default,
                              option=orjson.OPT_NON_STR_KEYS | orjson.OPT_SERIALIZE_NUMPY)
            serialised = orjson.loads(raw)
        else:
            serialised = json.loads(json.dumps(data, cls=NumpyEncoder))

        # 1. In-memory cache
        _CACHED_DASHBOARD_DATA = serialised

        # 2. Redis cache (primary read layer + segmented keys)
        cache = get_cache()
        cache.set_dashboard(serialised)

        # Cache per-ticker chart data granularly
        charts = serialised.get("charts", {})
        if charts:
            stored = cache.set_charts_bulk(charts)
            print(f"  ✓ Cached {stored} ticker charts in Redis")

        # 3. File fallback
        out_path = PIPELINES_DIR / "momentum_data.json"
        if HAS_ORJSON:
            with open(out_path, "wb") as f:
                f.write(orjson.dumps(data, default=_orjson_default,
                                    option=orjson.OPT_NON_STR_KEYS | orjson.OPT_SERIALIZE_NUMPY
                                           | orjson.OPT_INDENT_2))
        else:
            with open(out_path, "w") as f:
                json.dump(data, f, cls=NumpyEncoder)
        print(f"\n✓ Data written to {out_path.name}")

        # 4. Fire webhooks to invalidate frontend cache
        _dispatch_webhooks(serialised)

    except Exception as e:
        traceback.print_exc()
        _engine_status.update("error", str(e))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  DAILY AUTO-REFRESH SCHEDULER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import datetime as _dt

# Configurable: run daily at 17:00 ET (after US market close)
_SCHEDULE_HOUR = int(os.environ.get("PIPELINE_SCHEDULE_HOUR", "17"))
_SCHEDULE_MINUTE = int(os.environ.get("PIPELINE_SCHEDULE_MINUTE", "0"))
_SCHEDULE_TZ = os.environ.get("PIPELINE_SCHEDULE_TZ", "America/New_York")
_scheduler_timer: Optional[threading.Timer] = None
_last_pipeline_run: Optional[str] = None
_next_pipeline_run: Optional[str] = None


def _seconds_until_next_run() -> float:
    """Calculate seconds until the next scheduled run time."""
    try:
        import zoneinfo
        tz = zoneinfo.ZoneInfo(_SCHEDULE_TZ)
        now = _dt.datetime.now(tz)
    except Exception:
        now = _dt.datetime.now()

    target = now.replace(hour=_SCHEDULE_HOUR, minute=_SCHEDULE_MINUTE, second=0, microsecond=0)
    if target <= now:
        target += _dt.timedelta(days=1)
    return (target - now).total_seconds()


def _scheduled_pipeline_run():
    """Called by the scheduler timer to re-run the pipeline."""
    global _last_pipeline_run, _DATA_CACHE
    print("\n" + "═" * 64)
    print("  ⏰ SCHEDULED DAILY REFRESH — Starting pipeline …")
    print("═" * 64)

    with _CACHE_LOCK:
        _DATA_CACHE.clear()
    print("  ✓ Cleared stale data cache")

    _last_pipeline_run = _dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _run_pipeline_background()

    _schedule_next_run()


def _schedule_next_run():
    """Schedule the next daily pipeline run."""
    global _scheduler_timer, _next_pipeline_run
    delay = _seconds_until_next_run()
    hours = delay / 3600

    try:
        import zoneinfo
        tz = zoneinfo.ZoneInfo(_SCHEDULE_TZ)
        next_time = _dt.datetime.now(tz) + _dt.timedelta(seconds=delay)
        _next_pipeline_run = next_time.strftime("%Y-%m-%d %H:%M %Z")
    except Exception:
        next_time = _dt.datetime.now() + _dt.timedelta(seconds=delay)
        _next_pipeline_run = next_time.strftime("%Y-%m-%d %H:%M (local)")

    print(f"  📅 Next scheduled pipeline run: {_next_pipeline_run} ({hours:.1f}h from now)")

    _scheduler_timer = threading.Timer(delay, _scheduled_pipeline_run)
    _scheduler_timer.daemon = True
    _scheduler_timer.start()


def _dispatch_webhooks(data: dict) -> None:
    """POST to all registered webhook URLs when pipeline completes."""
    import urllib.request
    with _WEBHOOK_LOCK:
        urls = list(_WEBHOOK_URLS)
    if not urls:
        return

    payload = json.dumps({
        "event": "pipeline_complete",
        "timestamp": int(__import__("time").time()),
        "summary": data.get("summary", {}),
    }).encode()

    for url in urls:
        try:
            req = urllib.request.Request(
                url, data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=5)
            print(f"  ✓ Webhook dispatched → {url}")
        except Exception as e:
            print(f"  ⚠ Webhook failed → {url}: {e}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  FASTAPI APP (v3 — async + lifespan)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern lifespan handler — replaces deprecated @app.on_event."""
    # ── Startup ──
    os.chdir(PIPELINES_DIR)
    db.init_db()

    cache = get_cache()
    print(f"  Cache backend: {cache.stats()['backend']}")

    # Start background pipeline in thread (engine handles its own parallelism)
    pipeline_thread = threading.Thread(target=_run_pipeline_background, daemon=True)
    pipeline_thread.start()

    # Schedule daily auto-refresh
    _schedule_next_run()
    print(f"  ⏰ Daily auto-refresh enabled: every day at {_SCHEDULE_HOUR:02d}:{_SCHEDULE_MINUTE:02d} {_SCHEDULE_TZ}")

    yield  # ← App runs here

    # ── Shutdown ──
    if _scheduler_timer:
        _scheduler_timer.cancel()
    print("  ⏹ Scheduler stopped.")


app = FastAPI(
    title="MOMENTUM API",
    description="Quantitative Trading Screener — FastAPI Backend (v3 Parallel Engine)",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=500)


# ── Dashboard Data ──

@app.get("/momentum_data.json")
async def get_momentum_data(request: Request):
    """Return cached dashboard data. Priority: Redis → in-memory → file.
    Supports ETag conditional responses for sub-1ms 304 Not Modified."""
    global _CACHED_DASHBOARD_DATA

    # ETag check — if client has current data, return 304 instantly
    cache = get_cache()
    etag = cache.get_etag()
    if etag:
        client_etag = request.headers.get("if-none-match", "").strip('"')
        if client_etag == etag:
            return Response(status_code=304)

    # 1. Redis (sub-50ms)
    redis_data = cache.get_dashboard()
    if redis_data:
        resp = JSONResponse(content=redis_data)
        if etag:
            resp.headers["ETag"] = f'"{etag}"'
            resp.headers["Cache-Control"] = "private, max-age=60, stale-while-revalidate=300"
        return resp
    # 2. In-memory fallback
    if _CACHED_DASHBOARD_DATA:
        resp = JSONResponse(content=_CACHED_DASHBOARD_DATA)
        if etag:
            resp.headers["ETag"] = f'"{etag}"'
        return resp
    # 3. File fallback
    path = PIPELINES_DIR / "momentum_data.json"
    if path.exists():
        return FileResponse(path, media_type="application/json")
    return JSONResponse(content={"error": "Pipeline not yet complete. Please wait..."}, status_code=202)


# ── Segmented Endpoints (avoid deserializing full 10MB payload) ──

@app.get("/api/signals")
async def get_signals():
    """Return only the signals table from cached data."""
    cache = get_cache()
    data = cache.get_segment(RedisCache.KEY_SIGNALS)
    if data:
        return encode_response({"signals": data})
    # Fallback: extract from full cache
    if _CACHED_DASHBOARD_DATA:
        return encode_response({"signals": _CACHED_DASHBOARD_DATA.get("signals", [])})
    return JSONResponse(content={"error": "Pipeline not yet complete"}, status_code=202)


@app.get("/api/summary")
async def get_summary():
    """Return only the dashboard summary statistics."""
    cache = get_cache()
    data = cache.get_segment(RedisCache.KEY_SUMMARY)
    if data:
        return encode_response({"summary": data})
    if _CACHED_DASHBOARD_DATA:
        return encode_response({"summary": _CACHED_DASHBOARD_DATA.get("summary", {})})
    return JSONResponse(content={"error": "Pipeline not yet complete"}, status_code=202)


@app.get("/api/charts/{ticker}")
async def get_ticker_chart(ticker: str):
    """Return chart data for a specific ticker (cached individually)."""
    cache = get_cache()
    chart = cache.get_chart(ticker.upper())
    if chart:
        return encode_response({"ticker": ticker.upper(), "charts": chart})
    # Fallback: extract from full cache
    if _CACHED_DASHBOARD_DATA:
        charts = _CACHED_DASHBOARD_DATA.get("charts", {})
        if ticker.upper() in charts:
            return encode_response({"ticker": ticker.upper(), "charts": charts[ticker.upper()]})
    return JSONResponse(content={"error": f"No chart data for {ticker}"}, status_code=404)


@app.get("/api/derived")
async def get_derived():
    """Return derived signal lists (hidden gems, momentum clusters, etc)."""
    cache = get_cache()
    data = cache.get_segment(RedisCache.KEY_DERIVED)
    if data:
        return encode_response(data)
    if _CACHED_DASHBOARD_DATA:
        keys = ["fresh_momentum", "exhausting_momentum", "rotation_ideas",
                "shock_signals", "gamma_signals", "smart_money",
                "continuation", "momentum_clusters", "shock_clusters", "hidden_gems",
                "ai_stocks", "bullish_momentum", "high_volume_gappers", "earnings_growers",
                "momentum_95"]
        return encode_response({k: _CACHED_DASHBOARD_DATA.get(k, []) for k in keys})
    return JSONResponse(content={"error": "Pipeline not yet complete"}, status_code=202)


@app.get("/api/db/signals")
async def get_db_signals(
    sector: str | None = None,
    regime: str | None = None,
    min_probability: float | None = None,
    min_composite: float | None = None,
    is_etf: bool | None = None,
    is_ai: bool | None = None,
    limit: int = 200,
    order_by: str = "probability DESC",
):
    """Query persisted signals from DB with optional filters."""
    try:
        signals = db.load_signals(
            sector=sector, regime=regime,
            min_probability=min_probability, min_composite=min_composite,
            is_etf=is_etf, is_ai=is_ai,
            limit=min(limit, 1000), order_by=order_by,
        )
        return encode_response({
            "signals": signals,
            "count": len(signals),
            "persisted_total": db.get_signals_count(),
        })
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.get("/api/db/signal/{ticker}")
async def get_db_signal(ticker: str):
    """Get a single ticker with full indicator detail from DB."""
    try:
        signal = db.load_signal(ticker.upper())
        if not signal:
            return JSONResponse(content={"error": f"No signal data for {ticker}"}, status_code=404)
        return encode_response(signal)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


# ── Portfolio Intelligence Engine ──

# All 11 GICS sectors for gap analysis
_ALL_SECTORS = [
    "Technology", "Healthcare", "Financials", "Consumer Cyclical",
    "Industrials", "Energy", "Consumer Defensive", "Utilities",
    "Real Estate", "Basic Materials", "Communication Services",
]


def _compute_portfolio_analysis(holdings: list[dict]) -> dict:
    """
    Cross-reference user holdings against in-memory pipeline data.
    Returns aura score, sector exposure, alpha alerts, rotation suggestions.
    All in-memory lookups — sub-10ms execution.
    """
    data = _CACHED_DASHBOARD_DATA
    if not data or not data.get("signals"):
        return {"error": "Pipeline data not available yet"}

    # Build signal lookup: ticker -> signal dict
    signal_map = {s["ticker"]: s for s in data.get("signals", [])}
    sector_regimes = data.get("sector_regimes", {})

    # Build exhausting set for alert flagging
    exhausting_tickers = {s["ticker"] for s in data.get("exhausting_momentum", [])}

    holdings_analysis = []
    total_value = 0.0
    total_cost = 0.0
    sector_values: dict[str, float] = {}
    sector_composites: dict[str, list[float]] = {}
    weighted_score_sum = 0.0

    for h in holdings:
        ticker = str(h.get("ticker", "")).upper().strip()
        shares = float(h.get("shares", 0))
        avg_cost = float(h.get("avg_cost", 0))
        if not ticker or shares <= 0:
            continue

        sig = signal_map.get(ticker)
        current_price = sig["price"] if sig else avg_cost
        position_value = shares * current_price
        cost_basis = shares * avg_cost
        pnl = position_value - cost_basis
        pnl_pct = ((current_price - avg_cost) / avg_cost * 100) if avg_cost > 0 else 0.0

        total_value += position_value
        total_cost += cost_basis

        sector = sig["sector"] if sig else "Unknown"
        composite = sig["composite"] if sig else 0.0
        sentiment = sig["sentiment"] if sig else "Neutral"
        regime = sig["regime"] if sig else "Choppy"
        phase = sig.get("momentum_phase", "Neutral") if sig else "Neutral"

        # Accumulate sector data
        sector_values[sector] = sector_values.get(sector, 0.0) + position_value
        if sector not in sector_composites:
            sector_composites[sector] = []
        sector_composites[sector].append(composite)

        # Weighted score for aura
        # Normalize composite: map [-2, 2] -> [0, 100]
        norm_score = max(0, min(100, (composite + 2) / 4 * 100))
        weighted_score_sum += norm_score * position_value

        # Detect alerts
        alert = None
        alert_type = None
        action = None
        if sig:
            if ticker in exhausting_tickers:
                alert = f"{ticker} is showing exhausting momentum — trend may be losing steam"
                alert_type = "exhausting_momentum"
                action = "Consider taking profits or tightening stops"
            elif sentiment in ("Bearish", "Strong Bearish") and composite < -0.5:
                alert = f"{ticker} is bearish with composite {composite:.2f} — downside risk elevated"
                alert_type = "bearish_impulse"
                action = "Evaluate stop-loss or reduce position size"
            elif phase == "Exhausting":
                alert = f"{ticker} momentum phase is exhausting — move may be overextended"
                alert_type = "exhausting_phase"
                action = "Monitor closely for reversal signals"

        entry = {
            "ticker": ticker,
            "shares": shares,
            "avg_cost": round(avg_cost, 2),
            "current_price": round(current_price, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "composite": round(composite, 2) if sig else None,
            "sentiment": sentiment,
            "regime": regime,
            "momentum_phase": phase,
            "sector": sector,
            "weight_pct": 0.0,  # filled below
            "alert": alert,
            "alert_type": alert_type,
            "action": action,
            "in_universe": sig is not None,
        }
        holdings_analysis.append(entry)

    # Calculate weight percentages
    for entry in holdings_analysis:
        if total_value > 0:
            val = entry["shares"] * entry["current_price"]
            entry["weight_pct"] = round(val / total_value * 100, 2)

    # ── Aura Score (0-100) ──
    aura_score = round(weighted_score_sum / total_value, 1) if total_value > 0 else 50.0
    # Bonus for diversification (up to +10)
    unique_sectors = len([s for s in sector_values if s != "Unknown"])
    diversification_bonus = min(10, unique_sectors * 1.5)
    aura_score = round(min(100, max(0, aura_score + diversification_bonus)), 1)

    if aura_score >= 80:
        aura_label = "Ultra Instinct"
    elif aura_score >= 65:
        aura_label = "Strong"
    elif aura_score >= 50:
        aura_label = "Moderate"
    elif aura_score >= 35:
        aura_label = "Weak"
    else:
        aura_label = "Critical"

    # ── Sector Exposure ──
    sector_exposure = {}
    for sector, value in sector_values.items():
        comps = sector_composites.get(sector, [])
        regime_info = sector_regimes.get(sector, {})
        sector_exposure[sector] = {
            "weight_pct": round(value / total_value * 100, 2) if total_value > 0 else 0,
            "regime": regime_info.get("regime", "Unknown"),
            "avg_composite": round(sum(comps) / len(comps), 2) if comps else 0,
            "count": len(comps),
        }

    # ── Missing Sectors (gap analysis) ──
    held_sectors = set(sector_values.keys()) - {"Unknown"}
    missing_sectors = []
    for sector in _ALL_SECTORS:
        if sector in held_sectors:
            continue
        regime_info = sector_regimes.get(sector, {})
        regime = regime_info.get("regime", "Unknown")
        avg_comp = regime_info.get("avg_composite", 0)
        # Find top pick in this sector
        sector_signals = [s for s in data.get("signals", []) if s.get("sector") == sector]
        sector_signals.sort(key=lambda s: s.get("composite", 0), reverse=True)
        top = sector_signals[0] if sector_signals else None
        missing_sectors.append({
            "sector": sector,
            "regime": regime,
            "avg_composite": round(avg_comp, 2) if isinstance(avg_comp, (int, float)) else 0,
            "top_pick": top["ticker"] if top else None,
            "top_pick_composite": round(top["composite"], 2) if top else None,
            "top_pick_sentiment": top.get("sentiment") if top else None,
            "priority": "high" if regime == "Trending" and avg_comp > 0.3 else "medium" if regime == "Trending" else "low",
        })
    # Sort: trending sectors with high composites first
    missing_sectors.sort(key=lambda x: (
        0 if x["priority"] == "high" else 1 if x["priority"] == "medium" else 2,
        -(x["avg_composite"] or 0),
    ))

    # ── Alpha Alerts ──
    alpha_alerts = [
        {
            "ticker": e["ticker"],
            "alert_type": e["alert_type"],
            "message": e["alert"],
            "composite": e["composite"],
            "sentiment": e["sentiment"],
            "action": e["action"],
        }
        for e in holdings_analysis if e["alert"]
    ]

    # ── Rotation Suggestions ──
    rotation_suggestions = []
    # For each alerted holding, suggest a replacement from the same or trending sector
    for alert_entry in alpha_alerts[:5]:  # Max 5 suggestions
        ticker = alert_entry["ticker"]
        holding_entry = next((h for h in holdings_analysis if h["ticker"] == ticker), None)
        if not holding_entry:
            continue
        # Find best replacement: fresh momentum in same sector or top trending sector
        candidates = [
            s for s in data.get("fresh_momentum", [])
            if s["ticker"] != ticker and s.get("composite", 0) > 0.5
        ]
        if not candidates:
            candidates = [
                s for s in data.get("signals", [])
                if s["ticker"] != ticker and s.get("composite", 0) > 0.8
                and s.get("sentiment") in ("Bullish", "Strong Bullish")
            ]
        if candidates:
            candidates.sort(key=lambda s: s.get("composite", 0), reverse=True)
            best = candidates[0]
            rotation_suggestions.append({
                "sell_ticker": ticker,
                "sell_composite": alert_entry["composite"],
                "sell_sentiment": alert_entry["sentiment"],
                "buy_ticker": best["ticker"],
                "buy_composite": round(best.get("composite", 0), 2),
                "buy_sentiment": best.get("sentiment", "Neutral"),
                "buy_sector": best.get("sector", "Unknown"),
                "rationale": f"Rotate out of {alert_entry['alert_type'].replace('_', ' ')} "
                             f"into {best.get('momentum_phase', 'fresh')} momentum in {best.get('sector', 'N/A')}",
            })

    total_pnl = total_value - total_cost
    total_pnl_pct = round((total_pnl / total_cost * 100), 2) if total_cost > 0 else 0.0

    return {
        "aura_score": aura_score,
        "aura_label": aura_label,
        "total_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
        "total_pnl": round(total_pnl, 2),
        "total_pnl_pct": total_pnl_pct,
        "holdings_count": len(holdings_analysis),
        "holdings_analysis": holdings_analysis,
        "sector_exposure": sector_exposure,
        "missing_sectors": missing_sectors,
        "alpha_alerts": alpha_alerts,
        "rotation_suggestions": rotation_suggestions,
    }


@app.post("/api/portfolio/analyze")
async def portfolio_analyze(request: Request):
    """
    Portfolio Intelligence endpoint.
    Accepts: { "holdings": [{ "ticker": "AAPL", "shares": 50, "avg_cost": 170.0 }] }
    Returns aura score, sector exposure, alpha alerts, rotation suggestions.
    """
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(content={"error": "Invalid JSON body"}, status_code=400)

    holdings = body.get("holdings", [])
    if not holdings or not isinstance(holdings, list):
        return JSONResponse(
            content={"error": "Request body must include a non-empty 'holdings' array"},
            status_code=400,
        )

    result = _compute_portfolio_analysis(holdings)
    if "error" in result:
        return JSONResponse(content=result, status_code=503)

    return encode_response(result)


# ── WebSocket for real-time pipeline status ──

@app.websocket("/ws/pipeline")
async def ws_pipeline(websocket: WebSocket):
    """WebSocket endpoint for real-time pipeline status push."""
    await websocket.accept()
    queue = _engine_status.subscribe()
    try:
        # Send current status immediately
        await websocket.send_json(_engine_status.to_dict())
        while True:
            try:
                status = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_json(status)
            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                await websocket.send_json({"heartbeat": True, **_engine_status.to_dict()})
    except WebSocketDisconnect:
        pass
    finally:
        _engine_status.unsubscribe(queue)


@app.get("/api/screen")
async def run_screen():
    try:
        data = build_dashboard_data()
        return encode_response(data)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.get("/api/pipeline/status")
async def pipeline_status():
    cache = get_cache()
    cached_status = cache.get_pipeline_status()
    status = cached_status if cached_status else _engine_status.to_dict()
    return {**status, "next_run": _next_pipeline_run, "last_run": _last_pipeline_run}


@app.post("/api/pipeline/trigger")
async def pipeline_trigger():
    """Manually trigger a full pipeline refresh."""
    if _engine_status.state == "running":
        return JSONResponse(content={"error": "Pipeline already running"}, status_code=409)
    t = threading.Thread(target=_scheduled_pipeline_run, daemon=True)
    t.start()
    return {"message": "Pipeline refresh triggered", "state": "running"}


@app.get("/api/pipeline/schedule")
async def pipeline_schedule():
    """Return the current auto-refresh schedule."""
    return {
        "enabled": True,
        "schedule": f"{_SCHEDULE_HOUR:02d}:{_SCHEDULE_MINUTE:02d} {_SCHEDULE_TZ}",
        "next_run": _next_pipeline_run,
        "last_run": _last_pipeline_run,
        "config": {
            "hour": _SCHEDULE_HOUR,
            "minute": _SCHEDULE_MINUTE,
            "timezone": _SCHEDULE_TZ,
        },
    }

# ── Webhook Management ──

@app.post("/api/webhook/register")
async def webhook_register(request: Request):
    """Register a URL to receive POST when pipeline completes."""
    body = await request.json()
    url = body.get("url", "")
    if not url:
        return JSONResponse(content={"error": "url required"}, status_code=400)
    with _WEBHOOK_LOCK:
        if url not in _WEBHOOK_URLS:
            _WEBHOOK_URLS.append(url)
    return {"registered": url, "total_hooks": len(_WEBHOOK_URLS)}


@app.post("/api/webhook/unregister")
async def webhook_unregister(request: Request):
    """Remove a registered webhook URL."""
    body = await request.json()
    url = body.get("url", "")
    with _WEBHOOK_LOCK:
        if url in _WEBHOOK_URLS:
            _WEBHOOK_URLS.remove(url)
    return {"unregistered": url, "total_hooks": len(_WEBHOOK_URLS)}


@app.get("/api/cache/stats")
async def cache_stats():
    """Return cache backend diagnostics."""
    return get_cache().stats()


@app.get("/api/data/status")
async def data_status():
    try:
        stats = db.get_db_stats()
        return encode_response({"stats": stats})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.get("/api/data/sync")
async def data_sync(period: str = "1y", start: Optional[str] = None, end: Optional[str] = None):
    try:
        ohlcv = smart_fetch(period=period, start=start, end=end, progress=True)
        stats = db.get_db_stats()
        return encode_response({"synced": len(ohlcv), "stats": stats})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


# ── Backtesting ──

@app.post("/api/backtest")
async def run_backtest_endpoint(request: Request):
    try:
        params = await request.json()
        _CANCEL_EVENT.clear()

        systems = params.get("systems", [1, 2, 3, 4])
        holding = params.get("holding_period", 5)
        threshold = params.get("entry_threshold", 0.5)
        ensemble_k = params.get("ensemble_k", None)
        period = params.get("period", "1y")
        start = params.get("start", None)
        end = params.get("end", None)
        ticker = params.get("ticker", None)
        top_n = params.get("top_n", 20)
        initial_capital = params.get("initial_capital", 100000.0)

        if ticker:
            ohlcv = _cached_fetch(tickers=[ticker], period=period, start=start, end=end, progress=True)
        else:
            ohlcv = _cached_fetch(period=period, start=start, end=end, progress=True)

        if not ohlcv:
            return JSONResponse(content={"error": "No data available"}, status_code=400)

        if ticker and ticker in ohlcv:
            result = run_backtest(
                ticker, ohlcv[ticker],
                systems=systems, holding_period=holding,
                entry_threshold=threshold, ensemble_k=ensemble_k,
                initial_capital=initial_capital, cancel_event=_CANCEL_EVENT,
            )
            if _CANCEL_EVENT.is_set():
                return {"cancelled": True, "message": "Backtest cancelled by user"}
            bt_id = db.save_backtest(params, result, result["summary"])
            result["backtest_id"] = bt_id
            return encode_response(result)
        else:
            result = backtest_universe(
                ohlcv, systems=systems, holding_period=holding,
                entry_threshold=threshold, ensemble_k=ensemble_k,
                top_n=top_n, progress=True, initial_capital=initial_capital,
                cancel_event=_CANCEL_EVENT,
            )
            if _CANCEL_EVENT.is_set():
                return {"cancelled": True, "message": "Backtest cancelled by user"}
            bt_id = db.save_backtest(params, {"aggregate": result["aggregate"]}, result["aggregate"])
            result["backtest_id"] = bt_id
            return encode_response(result)

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.post("/api/backtest/cancel")
async def cancel_backtest():
    _CANCEL_EVENT.set()
    return {"cancelled": True, "message": "Cancel signal sent"}


@app.get("/api/backtest/history")
async def backtest_history(limit: int = 20):
    try:
        history = db.list_backtests(limit)
        return encode_response({"history": history})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.get("/api/backtest/{bt_id}")
async def load_backtest(bt_id: int):
    try:
        result = db.load_backtest(bt_id)
        if result is None:
            return JSONResponse(content={"error": "Backtest not found"}, status_code=404)
        return encode_response(result)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.post("/api/compare")
async def compare_endpoint(request: Request):
    try:
        params = await request.json()
        ticker = params.get("ticker", "AAPL")
        holding = params.get("holding_period", 5)
        threshold = params.get("entry_threshold", 0.5)
        period = params.get("period", "1y")
        start = params.get("start", None)
        end = params.get("end", None)

        ohlcv = _cached_fetch(tickers=[ticker], period=period, start=start, end=end, progress=True)
        if ticker not in ohlcv:
            return JSONResponse(content={"error": f"No data for {ticker}"}, status_code=400)

        result = compare_systems(ticker, ohlcv[ticker], holding_period=holding, entry_threshold=threshold)
        return encode_response(result)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(content={"error": str(e)}, status_code=500)


# ── Strategy Engine ──

@app.get("/api/indicators")
async def get_indicators():
    return encode_response({"indicators": get_indicator_catalog()})


@app.post("/api/strategy/backtest")
async def strategy_backtest(request: Request):
    try:
        params = await request.json()
        _CANCEL_EVENT.clear()
        ticker = params.get("ticker", "AAPL")
        period = params.get("period", "1y")
        start = params.get("start", None)
        end = params.get("end", None)

        ohlcv = _fetch_ticker_data(ticker, period, start, end)
        if ohlcv is None:
            return JSONResponse(content={"error": f"No data for {ticker}"}, status_code=400)

        result = run_strategy_backtest(
            ohlcv,
            entry_conditions=params.get("entry_conditions", []),
            exit_conditions=params.get("exit_conditions", []),
            entry_logic=params.get("entry_logic", "AND"),
            exit_logic=params.get("exit_logic", "OR"),
            direction=params.get("direction", "long"),
            initial_capital=float(params.get("initial_capital", 100000)),
            position_size_pct=float(params.get("position_size_pct", 10)),
            stop_loss_pct=float(params["stop_loss_pct"]) if params.get("stop_loss_pct") else None,
            take_profit_pct=float(params["take_profit_pct"]) if params.get("take_profit_pct") else None,
            max_holding_days=int(params["max_holding_days"]) if params.get("max_holding_days") else None,
            cancel_event=_CANCEL_EVENT,
        )
        if _CANCEL_EVENT.is_set():
            return {"cancelled": True}
        bt_id = db.save_backtest(params, {"trades": result.get("trades", [])[:50]}, result["summary"])
        result["backtest_id"] = bt_id
        return encode_response(result)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.post("/api/strategy/code")
async def strategy_code(request: Request):
    try:
        params = await request.json()
        _CANCEL_EVENT.clear()
        ticker = params.get("ticker", "AAPL")
        code = params.get("code", "")
        period = params.get("period", "1y")

        if not code.strip():
            return JSONResponse(content={"error": "No strategy code provided"}, status_code=400)

        ohlcv = _fetch_ticker_data(ticker, period)
        if ohlcv is None:
            return JSONResponse(content={"error": f"No data for {ticker}"}, status_code=400)

        result = run_code_strategy(
            ohlcv, code,
            initial_capital=float(params.get("initial_capital", 100000)),
            position_size_pct=float(params.get("position_size_pct", 10)),
            stop_loss_pct=float(params["stop_loss_pct"]) if params.get("stop_loss_pct") else None,
            take_profit_pct=float(params["take_profit_pct"]) if params.get("take_profit_pct") else None,
            max_holding_days=int(params["max_holding_days"]) if params.get("max_holding_days") else None,
            cancel_event=_CANCEL_EVENT,
        )
        if "error" in result:
            return JSONResponse(content=result, status_code=400)
        bt_id = db.save_backtest(
            {"ticker": ticker, "type": "code"},
            {"trades": result.get("trades", [])[:50]},
            result["summary"],
        )
        result["backtest_id"] = bt_id
        return encode_response(result)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.post("/api/strategy/save")
async def save_strategy(request: Request):
    try:
        params = await request.json()
        sid = db.save_strategy(
            name=params.get("name", "Untitled"),
            stype=params.get("type", "visual"),
            config=params.get("config"),
            code=params.get("code", ""),
            description=params.get("description", ""),
            strategy_id=params.get("id"),
        )
        return {"id": sid, "saved": True}
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.get("/api/strategy/list")
async def list_strategies():
    try:
        strategies = db.list_strategies()
        return encode_response({"strategies": strategies})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.get("/api/strategy/{sid}")
async def load_strategy(sid: int):
    try:
        s = db.load_strategy(sid)
        if s is None:
            return JSONResponse(content={"error": "Strategy not found"}, status_code=404)
        return encode_response(s)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.post("/api/strategy/{sid}/delete")
async def delete_strategy(sid: int):
    try:
        db.delete_strategy(sid)
        return {"deleted": True}
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.post("/api/strategy/compare")
async def compare_strategies(request: Request):
    try:
        params = await request.json()
        results = params.get("results", [])
        comparison = compare_strategy_results(results)
        return encode_response(comparison)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


# ── Ticker Search & Add ──

@app.get("/api/ticker/search")
async def search_ticker(q: str = ""):
    try:
        import yfinance as yf
        q = q.upper().strip()
        if not q:
            return {"results": []}

        results = []
        with db.db_session() as conn:
            rows = conn.execute(
                "SELECT ticker, name, sector FROM tickers WHERE ticker LIKE ? OR name LIKE ? LIMIT 20",
                (f"%{q}%", f"%{q}%"),
            ).fetchall()
            for r in rows:
                results.append({"ticker": r["ticker"], "name": r["name"] or "", "sector": r["sector"] or "", "source": "db"})

        if len(results) < 5:
            try:
                tk = yf.Ticker(q)
                info = tk.info or {}
                if info.get("symbol"):
                    exists = any(r["ticker"] == info["symbol"] for r in results)
                    if not exists:
                        results.insert(0, {
                            "ticker": info.get("symbol", q),
                            "name": info.get("shortName", info.get("longName", "")),
                            "sector": info.get("sector", ""),
                            "source": "yfinance",
                        })
            except Exception:
                pass

        return {"results": results}
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.post("/api/ticker/add")
async def add_ticker(request: Request):
    try:
        params = await request.json()
        tickers = params.get("tickers", [])
        if isinstance(tickers, str):
            tickers = [t.strip().upper() for t in tickers.split(",")]
        period = params.get("period", "2y")

        fetched = []
        for ticker in tickers[:20]:
            ohlcv = _fetch_ticker_data(ticker, period)
            if ohlcv is not None:
                fetched.append(ticker)
                try:
                    import yfinance as yf
                    tk = yf.Ticker(ticker)
                    info = tk.info
                    name = info.get("shortName", info.get("longName", ticker))
                    sector = info.get("sector", "Custom")
                except Exception:
                    name = ticker
                    sector = "Custom"
                db.upsert_ticker(ticker, sector, name)

        return {"added": fetched, "count": len(fetched)}
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


# ── Receipts ──

@app.get("/api/receipts")
async def get_receipts(limit: int = 50):
    try:
        history = db.list_backtests(limit)

        receipts = []
        pnl_curve = []
        equity = 100000.0
        wins = 0
        all_returns = []
        all_sharpes = []

        for h in history:
            p = h.get("params") or {}
            s = h.get("summary") or {}
            ret = float(s.get("total_return_pct") or s.get("avg_return_pct") or 0)
            pnl = float(s.get("total_return") or 0)
            sharpe = float(s.get("sharpe_ratio") or s.get("avg_sharpe") or 0)
            win = ret > 0

            ticker = p.get("ticker") or "Universe"
            systems = p.get("systems", [])
            sig_type = "S" + "+S".join(str(x) for x in systems) + " Backtest" if systems else "Backtest"

            receipt = {
                "id": h.get("id"),
                "date": (h.get("run_time") or "").replace("T", " ")[:16],
                "ticker": ticker,
                "return_pct": round(ret, 2),
                "pnl": round(pnl, 2),
                "signal_type": sig_type,
                "result": "WIN" if win else ("LOSS" if ret < 0 else "OPEN"),
                "trades": int(s.get("total_trades") or 0),
                "sharpe": round(sharpe, 2),
                "holding": int(p.get("holding_period") or 5),
                "note": "Win rate: {:.0f}% · Sharpe: {:.2f} · {} trades".format(
                    s.get("win_rate", 0), sharpe, s.get("total_trades", 0)
                ),
            }
            receipts.append(receipt)
            all_returns.append(ret)
            all_sharpes.append(sharpe)
            if win:
                wins += 1

            equity = equity * (1 + ret / 100)
            pnl_curve.append({"date": receipt["date"], "equity": round(equity)})

        total = len(receipts)
        win_rate = round(wins / total * 100) if total else 0
        avg_return = round(sum(all_returns) / len(all_returns), 2) if all_returns else 0
        best = round(max(all_returns), 2) if all_returns else 0
        worst = round(min(all_returns), 2) if all_returns else 0
        avg_sharpe = round(sum(all_sharpes) / len(all_sharpes), 2) if all_sharpes else 0

        return encode_response({
            "receipts": receipts,
            "pnl_curve": pnl_curve,
            "win_rate": win_rate,
            "avg_return": avg_return,
            "best_call": f"+{best:.1f}%" if best > 0 else f"{best:.1f}%",
            "worst_call": f"{worst:.1f}%",
            "total_calls": total,
            "sharpe": avg_sharpe,
        })
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(content={"error": str(e)}, status_code=500)


# ── Root redirect ──

@app.get("/")
async def root():
    return {"status": "ok", "message": "MOMENTUM API v3.0 — Use /docs for API explorer"}
