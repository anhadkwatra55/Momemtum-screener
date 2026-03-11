#!/usr/bin/env python3
"""
momentum_dashboard.py — API Server + Dashboard Backend
========================================================
Serves the dashboard and provides live API endpoints for screening,
backtesting, and data management.

Endpoints:
    GET  /                            → redirect to dashboard
    GET  /momentum_dashboard.html     → dashboard
    GET  /api/screen                  → run screener, return JSON
    POST /api/backtest                → run backtest with params
    POST /api/backtest/cancel         → cancel running backtest
    GET  /api/backtest/history        → list saved backtests
    GET  /api/backtest/<id>           → load a saved backtest
    POST /api/compare                 → compare systems for a ticker
    GET  /api/data/sync               → trigger data sync
    GET  /api/data/status             → DB statistics
    GET  /momentum_data.json          → cached screen data
"""

from __future__ import annotations

import json
import os
import socket
import sys
import threading
import time
import traceback
import warnings
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  IN-MEMORY DATA CACHE (avoid re-fetching per backtest)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_DATA_CACHE: dict[str, dict[str, pd.DataFrame]] = {}
_CACHE_LOCK = threading.Lock()

# Backtest cancellation
_CANCEL_EVENT = threading.Event()
_BACKTEST_LOCK = threading.Lock()

# Pipeline status
_PIPELINE_STATUS = {"state": "idle", "message": ""}


def _cache_key(period, start, end, tickers=None):
    """Build a cache key from fetch params."""
    t = tuple(sorted(tickers)) if tickers else "all"
    return f"{t}|{period}|{start}|{end}"


def _cached_fetch(tickers=None, period=None, start=None, end=None, progress=True):
    """Fetch OHLCV data with in-memory caching."""
    key = _cache_key(period, start, end, tickers)
    with _CACHE_LOCK:
        if key in _DATA_CACHE:
            if progress:
                print(f"    ✓ Using in-memory cache ({len(_DATA_CACHE[key])} tickers).")
            return _DATA_CACHE[key]

    # Not cached — fetch from DB / yfinance
    result = smart_fetch(tickers=tickers, period=period, start=start, end=end, progress=progress)

    with _CACHE_LOCK:
        _DATA_CACHE[key] = result

    return result


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


def json_response(handler, data, status=200):
    """Send a JSON response."""
    body = json.dumps(data, cls=NumpyEncoder).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


class DashboardHandler(SimpleHTTPRequestHandler):
    """Custom handler with API routing."""

    # Suppress logs for static files
    def log_message(self, format, *args):
        path = args[0] if args else ""
        if "/api/" in str(path):
            super().log_message(format, *args)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/index.html")
            self.end_headers()
        elif path == "/api/screen":
            self._handle_screen()
        elif path == "/api/data/status":
            self._handle_data_status()
        elif path == "/api/data/sync":
            self._handle_data_sync(parsed)
        elif path == "/api/pipeline/status":
            self._handle_pipeline_status()
        elif path == "/api/backtest/history":
            self._handle_backtest_history(parsed)
        elif path.startswith("/api/backtest/") and path.split("/")[-1].isdigit():
            bt_id = int(path.split("/")[-1])
            self._handle_backtest_load(bt_id)
        elif path == "/api/indicators":
            self._handle_indicators()
        elif path == "/api/strategy/list":
            self._handle_strategy_list()
        elif path.startswith("/api/strategy/") and path.split("/")[-1].isdigit():
            sid = int(path.split("/")[-1])
            self._handle_strategy_load(sid)
        elif path == "/api/ticker/search":
            self._handle_ticker_search(parsed)
        elif path == "/api/receipts":
            self._handle_receipts(parsed)
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
        try:
            params = json.loads(body)
        except json.JSONDecodeError:
            params = {}

        if path == "/api/backtest":
            self._handle_backtest(params)
        elif path == "/api/backtest/cancel":
            self._handle_backtest_cancel()
        elif path == "/api/compare":
            self._handle_compare(params)
        elif path == "/api/strategy/backtest":
            self._handle_strategy_backtest(params)
        elif path == "/api/strategy/code":
            self._handle_strategy_code(params)
        elif path == "/api/strategy/save":
            self._handle_strategy_save(params)
        elif path == "/api/strategy/compare":
            self._handle_strategy_compare(params)
        elif path.startswith("/api/strategy/") and path.endswith("/delete"):
            sid = int(path.split("/")[-2])
            self._handle_strategy_delete(sid)
        elif path == "/api/ticker/add":
            self._handle_ticker_add(params)
        else:
            json_response(self, {"error": "Unknown endpoint"}, 404)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    # ── API Handlers ──

    def _handle_screen(self):
        """Run the full screener and return results."""
        try:
            data = build_dashboard_data()
            json_response(self, data)
        except Exception as e:
            json_response(self, {"error": str(e)}, 500)

    def _handle_data_status(self):
        """Return DB statistics."""
        try:
            db.init_db()
            stats = db.get_db_stats()
            json_response(self, stats)
        except Exception as e:
            json_response(self, {"error": str(e)}, 500)

    def _handle_data_sync(self, parsed):
        """Trigger data sync with optional period."""
        try:
            params = parse_qs(parsed.query)
            period = params.get("period", [cfg.DATA_PERIOD])[0]
            start = params.get("start", [None])[0]
            end = params.get("end", [None])[0]

            ohlcv = smart_fetch(period=period, start=start, end=end, progress=True)
            stats = db.get_db_stats()
            json_response(self, {
                "synced": len(ohlcv),
                "stats": stats,
            })
        except Exception as e:
            json_response(self, {"error": str(e)}, 500)

    def _handle_pipeline_status(self):
        """Return current pipeline status."""
        json_response(self, _PIPELINE_STATUS)

    def _handle_backtest(self, params):
        """Run backtest with provided parameters."""
        try:
            # Reset cancel event for new run
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

            # Use cached data fetch
            if ticker:
                ohlcv = _cached_fetch(tickers=[ticker], period=period,
                                      start=start, end=end, progress=True)
            else:
                ohlcv = _cached_fetch(period=period, start=start, end=end, progress=True)

            if not ohlcv:
                json_response(self, {"error": "No data available"}, 400)
                return

            if ticker and ticker in ohlcv:
                # Single ticker backtest
                result = run_backtest(
                    ticker, ohlcv[ticker],
                    systems=systems,
                    holding_period=holding,
                    entry_threshold=threshold,
                    ensemble_k=ensemble_k,
                    initial_capital=initial_capital,
                    cancel_event=_CANCEL_EVENT,
                )
                if _CANCEL_EVENT.is_set():
                    json_response(self, {"cancelled": True, "message": "Backtest cancelled by user"})
                    return
                # Save to DB
                bt_id = db.save_backtest(params, result, result["summary"])
                result["backtest_id"] = bt_id
                json_response(self, result)
            else:
                # Universe backtest
                result = backtest_universe(
                    ohlcv,
                    systems=systems,
                    holding_period=holding,
                    entry_threshold=threshold,
                    ensemble_k=ensemble_k,
                    top_n=top_n,
                    progress=True,
                    initial_capital=initial_capital,
                    cancel_event=_CANCEL_EVENT,
                )
                if _CANCEL_EVENT.is_set():
                    json_response(self, {"cancelled": True, "message": "Backtest cancelled by user"})
                    return
                # Save to DB
                bt_id = db.save_backtest(params, {"aggregate": result["aggregate"]}, result["aggregate"])
                result["backtest_id"] = bt_id
                json_response(self, result)

        except Exception as e:
            traceback.print_exc()
            json_response(self, {"error": str(e)}, 500)

    def _handle_backtest_cancel(self):
        """Cancel a running backtest."""
        _CANCEL_EVENT.set()
        json_response(self, {"cancelled": True, "message": "Cancel signal sent"})

    def _handle_compare(self, params):
        """Compare individual systems vs ensemble for a ticker."""
        try:
            ticker = params.get("ticker", "AAPL")
            holding = params.get("holding_period", 5)
            threshold = params.get("entry_threshold", 0.5)
            period = params.get("period", "1y")
            start = params.get("start", None)
            end = params.get("end", None)

            ohlcv = _cached_fetch(tickers=[ticker], period=period,
                                  start=start, end=end, progress=True)

            if ticker not in ohlcv:
                json_response(self, {"error": f"No data for {ticker}"}, 400)
                return

            result = compare_systems(
                ticker, ohlcv[ticker],
                holding_period=holding,
                entry_threshold=threshold,
            )
            json_response(self, result)

        except Exception as e:
            traceback.print_exc()
            json_response(self, {"error": str(e)}, 500)

    def _handle_backtest_history(self, parsed):
        """List saved backtests."""
        try:
            params = parse_qs(parsed.query)
            limit = int(params.get("limit", [20])[0])
            history = db.list_backtests(limit)
            json_response(self, {"history": history})
        except Exception as e:
            json_response(self, {"error": str(e)}, 500)

    def _handle_backtest_load(self, bt_id):
        """Load a saved backtest by ID."""
        try:
            result = db.load_backtest(bt_id)
            if result is None:
                json_response(self, {"error": "Backtest not found"}, 404)
            else:
                json_response(self, result)
        except Exception as e:
            json_response(self, {"error": str(e)}, 500)

    # ── Strategy & Indicator Handlers ──

    def _handle_indicators(self):
        """Return catalog of all available indicators."""
        json_response(self, {"indicators": get_indicator_catalog()})

    def _handle_strategy_backtest(self, params):
        """Run a visual strategy backtest."""
        try:
            _CANCEL_EVENT.clear()
            ticker = params.get("ticker", "AAPL")
            period = params.get("period", "1y")
            start = params.get("start", None)
            end = params.get("end", None)

            ohlcv = _fetch_ticker_data(ticker, period, start, end)
            if ohlcv is None:
                json_response(self, {"error": f"No data for {ticker}"}, 400)
                return

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
                json_response(self, {"cancelled": True})
                return
            # Save
            bt_id = db.save_backtest(params, {"trades": result.get("trades", [])[:50]}, result["summary"])
            result["backtest_id"] = bt_id
            json_response(self, result)
        except Exception as e:
            traceback.print_exc()
            json_response(self, {"error": str(e)}, 500)

    def _handle_strategy_code(self, params):
        """Run a Python code strategy."""
        try:
            _CANCEL_EVENT.clear()
            ticker = params.get("ticker", "AAPL")
            code = params.get("code", "")
            period = params.get("period", "1y")

            if not code.strip():
                json_response(self, {"error": "No strategy code provided"}, 400)
                return

            ohlcv = _fetch_ticker_data(ticker, period)
            if ohlcv is None:
                json_response(self, {"error": f"No data for {ticker}"}, 400)
                return

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
                json_response(self, result, 400)
                return
            bt_id = db.save_backtest(
                {"ticker": ticker, "type": "code"},
                {"trades": result.get("trades", [])[:50]},
                result["summary"],
            )
            result["backtest_id"] = bt_id
            json_response(self, result)
        except Exception as e:
            traceback.print_exc()
            json_response(self, {"error": str(e)}, 500)

    def _handle_strategy_save(self, params):
        """Save or update a strategy."""
        try:
            sid = db.save_strategy(
                name=params.get("name", "Untitled"),
                stype=params.get("type", "visual"),
                config=params.get("config"),
                code=params.get("code", ""),
                description=params.get("description", ""),
                strategy_id=params.get("id"),
            )
            json_response(self, {"id": sid, "saved": True})
        except Exception as e:
            json_response(self, {"error": str(e)}, 500)

    def _handle_strategy_list(self):
        """List saved strategies."""
        try:
            strategies = db.list_strategies()
            json_response(self, {"strategies": strategies})
        except Exception as e:
            json_response(self, {"error": str(e)}, 500)

    def _handle_strategy_load(self, sid):
        """Load a saved strategy."""
        try:
            s = db.load_strategy(sid)
            if s is None:
                json_response(self, {"error": "Strategy not found"}, 404)
            else:
                json_response(self, s)
        except Exception as e:
            json_response(self, {"error": str(e)}, 500)

    def _handle_strategy_delete(self, sid):
        """Delete a strategy."""
        try:
            db.delete_strategy(sid)
            json_response(self, {"deleted": True})
        except Exception as e:
            json_response(self, {"error": str(e)}, 500)

    def _handle_strategy_compare(self, params):
        """Compare multiple strategy results."""
        try:
            results = params.get("results", [])
            comparison = compare_strategy_results(results)
            json_response(self, comparison)
        except Exception as e:
            json_response(self, {"error": str(e)}, 500)

    def _handle_ticker_search(self, parsed):
        """Search for tickers in DB and yfinance."""
        try:
            import yfinance as yf
            params = parse_qs(parsed.query)
            q = params.get("q", [""])[0].upper().strip()
            if not q:
                json_response(self, {"results": []})
                return

            results = []
            # Search DB first
            with db.db_session() as conn:
                rows = conn.execute(
                    "SELECT ticker, name, sector FROM tickers WHERE ticker LIKE ? OR name LIKE ? LIMIT 20",
                    (f"%{q}%", f"%{q}%"),
                ).fetchall()
                for r in rows:
                    results.append({"ticker": r["ticker"], "name": r["name"] or "", "sector": r["sector"] or "", "source": "db"})

            # If few results, try yfinance
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

            json_response(self, {"results": results})
        except Exception as e:
            json_response(self, {"error": str(e)}, 500)

    def _handle_ticker_add(self, params):
        """Add ticker(s) to the universe and fetch data."""
        try:
            tickers = params.get("tickers", [])
            if isinstance(tickers, str):
                tickers = [t.strip().upper() for t in tickers.split(",")]
            period = params.get("period", "2y")

            fetched = []
            for ticker in tickers[:20]:  # Limit to 20 at a time
                ohlcv = _fetch_ticker_data(ticker, period)
                if ohlcv is not None:
                    fetched.append(ticker)
                    
                    # Try to fetch ticker metadata for the dashboard
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

            json_response(self, {"added": fetched, "count": len(fetched)})
        except Exception as e:
            json_response(self, {"error": str(e)}, 500)

    def _handle_receipts(self, parsed):
        """Return formatted receipts ledger from backtest history."""
        try:
            params_qs = parse_qs(parsed.query)
            limit = int(params_qs.get("limit", [50])[0])
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
                    "entry_price": None,
                    "exit_price": None,
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
                
                # Build P&L curve
                equity = equity * (1 + ret / 100)
                pnl_curve.append({"date": receipt["date"], "equity": round(equity)})
            
            total = len(receipts)
            win_rate = round(wins / total * 100) if total else 0
            avg_return = round(sum(all_returns) / len(all_returns), 2) if all_returns else 0
            best = round(max(all_returns), 2) if all_returns else 0
            worst = round(min(all_returns), 2) if all_returns else 0
            avg_sharpe = round(sum(all_sharpes) / len(all_sharpes), 2) if all_sharpes else 0
            
            json_response(self, {
                "receipts": receipts,
                "pnl_curve": pnl_curve,
                "win_rate": win_rate,
                "avg_return": avg_return,
                "best_call": "+{:.1f}%".format(best) if best > 0 else "{:.1f}%".format(best),
                "worst_call": "{:.1f}%".format(worst),
                "total_calls": total,
                "sharpe": avg_sharpe,
            })
        except Exception as e:
            traceback.print_exc()
            json_response(self, {"error": str(e)}, 500)


def _fetch_ticker_data(ticker, period="1y", start=None, end=None):
    """Fetch data for a single ticker, auto-downloading from yfinance if not in DB."""
    try:
        ohlcv = _cached_fetch(tickers=[ticker], period=period, start=start, end=end, progress=False)
        if ticker in ohlcv and len(ohlcv[ticker]) > 10:
            return ohlcv[ticker]
    except Exception:
        pass

    # Try direct yfinance fetch
    try:
        import yfinance as yf
        tk = yf.Ticker(ticker)
        df = tk.history(period=period)
        if df is not None and len(df) > 10:
            df.index = pd.to_datetime(df.index).tz_localize(None)
            # Store in DB for caching
            try:
                db.upsert_ohlcv(ticker, df)
            except Exception:
                pass
            return df
    except Exception:
        pass

    return None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  DASHBOARD DATA BUILDER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def build_dashboard_data() -> dict:
    """Full pipeline: fetch → screen → strategise → package for JSON."""
    global _PIPELINE_STATUS

    _PIPELINE_STATUS = {"state": "running", "message": "Fetching data..."}
    print("=" * 64)
    print("  MOMENTUM TRADING SCREENER — Pipeline")
    print("=" * 64)

    print("\n[1/4] Fetching data (DB-backed incremental sync) …")
    _PIPELINE_STATUS["message"] = "[1/4] Fetching data (DB-backed)…"
    ohlcv = smart_fetch(progress=True)
    if not ohlcv:
        _PIPELINE_STATUS = {"state": "error", "message": "No data fetched"}
        raise RuntimeError("No data fetched")

    print("\n[2/4] Running 4-system momentum screen …")
    _PIPELINE_STATUS["message"] = "[2/4] Running 4-system screen…"
    results = screen_universe(ohlcv, progress=True)

    print("\n[3/4] Computing sector regimes & strategies …")
    _PIPELINE_STATUS["message"] = "[3/4] Computing strategies…"
    sec_regimes = sector_regimes(results)
    strategies = generate_all_strategies(results)

    print("\n[4/4] Packaging dashboard data …")
    _PIPELINE_STATUS["message"] = "[4/4] Packaging data…"

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

    signals_table = []
    for r in results:
        row = {k: v for k, v in r.items() if k not in ("charts", "sys1", "sys2", "sys3", "sys4")}
        signals_table.append(row)

    chart_data = {r["ticker"]: r.get("charts", {}) for r in results}
    actionable = [s for s in strategies if s["direction"] != "NEUTRAL"][:30]

    import random
    quote = random.choice(cfg.QUOTES)

    # DB stats
    try:
        db_stats = db.get_db_stats()
    except Exception:
        db_stats = {}

    # ── Screener Categories ──
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

    # Rotation Breakouts: stocks with regime = Trending + bullish composite
    rotation_ideas = sorted(
        [r for r in results if r.get("regime") == "Trending" and r["composite"] > 0.3],
        key=lambda x: x["composite"], reverse=True
    )[:100]

    # Momentum Clusters: group by sector, find sectors with 3+ bullish stocks
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

    # Sector Shock Clusters: sectors with momentum shock
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

    # Gamma Squeeze Ops: vol_spike > 2x + bullish composite
    gamma_signals = sorted(
        [r for r in results if r.get("vol_spike", 1.0) > 2.0 and r["composite"] > 0],
        key=lambda x: x.get("vol_spike", 0), reverse=True
    )[:100]

    # Strip chart data from screener lists to reduce JSON size
    def slim(recs):
        out = []
        for r in recs:
            row = {k: v for k, v in r.items() if k not in ("charts", "sys1", "sys2", "sys3", "sys4")}
            out.append(row)
        return out

    _PIPELINE_STATUS = {"state": "done", "message": "Pipeline complete"}

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
        "config": {
            "adx_strong": cfg.ADX_STRONG_TREND,
            "adx_weak": cfg.ADX_WEAK_TREND,
            "stoch_ob": cfg.STOCH_OB,
            "stoch_os": cfg.STOCH_OS,
        },
        # Screener categories
        "fresh_momentum": slim(fresh_momentum),
        "exhausting_momentum": slim(exhausting_momentum),
        "rotation_ideas": slim(rotation_ideas),
        "shock_signals": slim(shock_signals),
        "gamma_signals": slim(gamma_signals),
        "smart_money": slim(smart_money_signals),
        "continuation": slim(continuation_signals),
        "momentum_clusters": slim(momentum_clusters),
        "shock_clusters": slim(shock_clusters),
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  BACKGROUND PIPELINE THREAD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _run_pipeline_background():
    """Run the data pipeline in a background thread and write momentum_data.json."""
    global _PIPELINE_STATUS
    try:
        data = build_dashboard_data()
        out_path = Path(__file__).parent / "momentum_data.json"
        with open(out_path, "w") as f:
            json.dump(data, f, cls=NumpyEncoder)
        print(f"\n✓ Data written to {out_path.name}")
        _PIPELINE_STATUS = {"state": "done", "message": "Pipeline complete — data refreshed"}
    except Exception as e:
        traceback.print_exc()
        _PIPELINE_STATUS = {"state": "error", "message": str(e)}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MAIN
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def main() -> None:
    # Init DB
    db.init_db()

    out_path = Path(__file__).parent / "momentum_data.json"
    has_cache = out_path.exists() and out_path.stat().st_size > 100

    if has_cache:
        print(f"✓ Cached data found ({out_path.name}, {out_path.stat().st_size / 1024:.0f} KB)")
        print("  Dashboard will load instantly. Refreshing data in background…")
    else:
        print("⏳ No cached data found. Building initial data (this takes ~60s first time)…")
        print("  Dashboard will show loading spinner until ready.")

    # Start pipeline in background thread (refreshes data even if cache exists)
    pipeline_thread = threading.Thread(target=_run_pipeline_background, daemon=True)
    pipeline_thread.start()

    # If no cache, wait briefly for data to become available
    if not has_cache:
        print("  Waiting for initial data build…")
        pipeline_thread.join()  # Block until first build completes
        print("  ✓ Initial data ready.")

    import os
    port = int(os.environ.get("PORT", 8060))
    host = "0.0.0.0" if os.environ.get("RENDER") else "localhost"
    os.chdir(Path(__file__).parent)

    # Enable SO_REUSEADDR to fix "Address already in use"
    class ReusableHTTPServer(HTTPServer):
        allow_reuse_address = True
        def server_bind(self):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            super().server_bind()

    url = f"http://{host}:{port}/momentum_dashboard.html"
    print(f"✓ Dashboard → {url}")
    print(f"✓ API ready at http://{host}:{port}/api/")
    print("  Press Ctrl+C to stop.\n")

    httpd = ReusableHTTPServer((host, port), DashboardHandler)
    if not os.environ.get("RENDER"):
        try:
            webbrowser.open(url)
        except Exception:
            pass
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n✓ Stopped.")
        httpd.server_close()


if __name__ == "__main__":
    main()
