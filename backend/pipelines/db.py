"""
db.py — SQLite Database Layer
================================
Migration-friendly schema. Single-file DB, zero external deps.
Can be copied to any machine or migrated to PostgreSQL/MySQL.

Tables:
    ohlcv     — daily OHLCV per ticker (primary data store)
    tickers   — metadata (sector, name)
    backtests — saved backtest runs
"""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

import shutil

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent))
DB_PATH = DATA_DIR / "quant_screener.db"

# For cloud deployment (Render): if persistent disk doesn't have the DB yet, copy the seeded one over.
if str(DATA_DIR) != str(Path(__file__).parent):
    seed_db = Path(__file__).parent / "quant_screener.db"
    if not DB_PATH.exists() and seed_db.exists():
        print(f"Copying seed database to persistent disk: {DB_PATH}")
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(seed_db, DB_PATH)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  CONNECTION HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def get_connection(db_path: Path | str | None = None) -> sqlite3.Connection:
    path = str(db_path or DB_PATH)
    conn = sqlite3.connect(path, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")       # better concurrent reads
    conn.execute("PRAGMA synchronous=NORMAL")      # faster writes, safe enough
    conn.execute("PRAGMA cache_size=-64000")        # 64 MB cache
    conn.execute("PRAGMA temp_store=MEMORY")
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def db_session(db_path=None):
    """Context manager for safe transactions."""
    conn = get_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  SCHEMA INIT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCHEMA_VERSION = 2

SCHEMA_SQL = """
-- OHLCV daily bars
CREATE TABLE IF NOT EXISTS ohlcv (
    ticker  TEXT    NOT NULL,
    date    TEXT    NOT NULL,
    open    REAL,
    high    REAL,
    low     REAL,
    close   REAL,
    volume  INTEGER,
    PRIMARY KEY (ticker, date)
);
CREATE INDEX IF NOT EXISTS idx_ohlcv_ticker ON ohlcv(ticker);
CREATE INDEX IF NOT EXISTS idx_ohlcv_date   ON ohlcv(date);

-- Ticker metadata
CREATE TABLE IF NOT EXISTS tickers (
    ticker   TEXT PRIMARY KEY,
    sector   TEXT,
    industry TEXT,
    name     TEXT,
    added    TEXT DEFAULT (datetime('now'))
);

-- Backtest results
CREATE TABLE IF NOT EXISTS backtests (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    run_time  TEXT DEFAULT (datetime('now')),
    params    TEXT,    -- JSON: systems, holding_period, date_range, etc.
    results   TEXT,    -- JSON: equity_curve, trades, etc.
    summary   TEXT     -- JSON: return, sharpe, max_dd, etc.
);

-- Schema version tracking (for future migrations)
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied TEXT DEFAULT (datetime('now'))
);

-- Saved strategies
CREATE TABLE IF NOT EXISTS strategies (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    type        TEXT DEFAULT 'visual',
    config      TEXT,
    code        TEXT,
    created     TEXT DEFAULT (datetime('now')),
    updated     TEXT DEFAULT (datetime('now'))
);

-- ══════════════════════════════════════════════════════════
--  INDICATOR TABLES  (persisted across restarts)
-- ══════════════════════════════════════════════════════════

-- Final screened signal per ticker (flat, queryable)
CREATE TABLE IF NOT EXISTS signals (
    ticker         TEXT PRIMARY KEY,
    company_name   TEXT,
    sector         TEXT,
    price          REAL,
    daily_change   REAL,
    return_20d     REAL,
    volatility_20d REAL,
    vol_spike      REAL,
    ta_branch      TEXT,
    momentum_phase TEXT,
    sys1_score     REAL,
    sys2_score     REAL,
    sys3_score     REAL,
    sys4_score     REAL,
    composite      REAL,
    regime         TEXT,
    sentiment      TEXT,
    probability    REAL,
    shock_trigger  INTEGER DEFAULT 0,
    shock_strength REAL,
    sm_trigger     INTEGER DEFAULT 0,
    sm_score       REAL,
    cont_prob      REAL,
    is_etf         INTEGER DEFAULT 0,
    is_ai          INTEGER DEFAULT 0,
    updated_at     TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_signals_sector      ON signals(sector);
CREATE INDEX IF NOT EXISTS idx_signals_probability  ON signals(probability);
CREATE INDEX IF NOT EXISTS idx_signals_composite    ON signals(composite);
CREATE INDEX IF NOT EXISTS idx_signals_regime       ON signals(regime);

-- System 1: ADX + TRIX + Full Stochastics
CREATE TABLE IF NOT EXISTS indicator_system1 (
    ticker     TEXT PRIMARY KEY,
    score      REAL,
    adx        REAL,
    plus_di    REAL,
    minus_di   REAL,
    trix       REAL,
    trix_signal REAL,
    stoch_k    REAL,
    stoch_d    REAL,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- System 2: Elder Impulse System
CREATE TABLE IF NOT EXISTS indicator_system2 (
    ticker        TEXT PRIMARY KEY,
    score         REAL,
    last_color    TEXT,
    consecutive   INTEGER,
    macd_hist     REAL,
    green_pct_10d REAL,
    red_pct_10d   REAL,
    updated_at    TEXT DEFAULT (datetime('now'))
);

-- System 3: Renko + Stochastics
CREATE TABLE IF NOT EXISTS indicator_system3 (
    ticker            TEXT PRIMARY KEY,
    score             REAL,
    renko_direction   INTEGER,
    consecutive_bricks INTEGER,
    brick_size        REAL,
    recent_up         INTEGER,
    recent_dn         INTEGER,
    stoch_k           REAL,
    stoch_d           REAL,
    updated_at        TEXT DEFAULT (datetime('now'))
);

-- System 4: Heikin-Ashi + Hull Moving Average
CREATE TABLE IF NOT EXISTS indicator_system4 (
    ticker              TEXT PRIMARY KEY,
    score               REAL,
    ha_bullish          INTEGER,
    consecutive_candles  INTEGER,
    wick_quality        REAL,
    hma_value           REAL,
    hma_rising          INTEGER,
    bull_pct_10d        REAL,
    updated_at          TEXT DEFAULT (datetime('now'))
);
"""


def init_db(db_path=None) -> None:
    """Create all tables if they don't exist."""
    with db_session(db_path) as conn:
        conn.executescript(SCHEMA_SQL)
        # Record schema version
        existing = conn.execute(
            "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
        ).fetchone()
        current = existing["version"] if existing else 0
        if current < SCHEMA_VERSION:
            conn.execute(
                "INSERT OR REPLACE INTO schema_version (version) VALUES (?)",
                (SCHEMA_VERSION,),
            )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  OHLCV OPERATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def upsert_ohlcv(ticker: str, df: pd.DataFrame, conn: sqlite3.Connection | None = None) -> int:
    """
    Bulk upsert OHLCV data for a ticker.
    Returns number of rows written.
    """
    if df.empty:
        return 0

    rows = []
    for idx, row in df.iterrows():
        date_str = idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)
        rows.append((
            ticker, date_str,
            float(row.get("Open", 0)), float(row.get("High", 0)),
            float(row.get("Low", 0)),  float(row.get("Close", 0)),
            int(row.get("Volume", 0)),
        ))

    def _do(c):
        c.executemany(
            """INSERT OR REPLACE INTO ohlcv (ticker, date, open, high, low, close, volume)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            rows,
        )

    if conn:
        _do(conn)
    else:
        with db_session() as c:
            _do(c)

    return len(rows)


def load_ohlcv(
    ticker: str,
    start: str | None = None,
    end: str | None = None,
    conn: sqlite3.Connection | None = None,
) -> pd.DataFrame:
    """Load OHLCV data from DB as a DataFrame."""
    query = "SELECT date, open, high, low, close, volume FROM ohlcv WHERE ticker = ?"
    params: list = [ticker]

    if start:
        query += " AND date >= ?"
        params.append(start)
    if end:
        query += " AND date <= ?"
        params.append(end)

    query += " ORDER BY date ASC"

    def _do(c):
        rows = c.execute(query, params).fetchall()
        if not rows:
            return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])
        data = [{
            "Date": r["date"], "Open": r["open"], "High": r["high"],
            "Low": r["low"], "Close": r["close"], "Volume": r["volume"],
        } for r in rows]
        df = pd.DataFrame(data)
        df["Date"] = pd.to_datetime(df["Date"])
        df.set_index("Date", inplace=True)
        return df

    if conn:
        return _do(conn)
    with db_session() as c:
        return _do(c)


def load_all_ohlcv(
    tickers: list[str],
    start: str | None = None,
    end: str | None = None,
) -> Dict[str, pd.DataFrame]:
    """Load OHLCV for all tickers from DB."""
    result = {}
    with db_session() as conn:
        for t in tickers:
            df = load_ohlcv(t, start, end, conn)
            if len(df) >= 50:
                result[t] = df
    return result


def get_data_range(ticker: str, conn: sqlite3.Connection | None = None) -> Tuple[Optional[str], Optional[str]]:
    """Get (min_date, max_date) for a ticker in DB."""
    q = "SELECT MIN(date) as mn, MAX(date) as mx FROM ohlcv WHERE ticker = ?"

    def _do(c):
        row = c.execute(q, (ticker,)).fetchone()
        if row and row["mn"]:
            return row["mn"], row["mx"]
        return None, None

    if conn:
        return _do(conn)
    with db_session() as c:
        return _do(c)


def get_data_ranges(tickers: list[str]) -> Dict[str, Tuple[Optional[str], Optional[str]]]:
    """Get data ranges for multiple tickers efficiently."""
    result = {}
    with db_session() as conn:
        for t in tickers:
            result[t] = get_data_range(t, conn)
    return result


def get_row_count() -> int:
    """Total rows in ohlcv table."""
    with db_session() as conn:
        row = conn.execute("SELECT COUNT(*) as c FROM ohlcv").fetchone()
        return row["c"] if row else 0


def get_ticker_count() -> int:
    """Distinct tickers in ohlcv table."""
    with db_session() as conn:
        row = conn.execute("SELECT COUNT(DISTINCT ticker) as c FROM ohlcv").fetchone()
        return row["c"] if row else 0


def get_db_stats() -> dict:
    """Return DB statistics for dashboard."""
    db_size = DB_PATH.stat().st_size if DB_PATH.exists() else 0
    with db_session() as conn:
        rows = conn.execute("SELECT COUNT(*) as c FROM ohlcv").fetchone()["c"]
        tickers = conn.execute("SELECT COUNT(DISTINCT ticker) as c FROM ohlcv").fetchone()["c"]
        dates = conn.execute("SELECT MIN(date) as mn, MAX(date) as mx FROM ohlcv").fetchone()
        bt_count = conn.execute("SELECT COUNT(*) as c FROM backtests").fetchone()["c"]

    return {
        "db_size_mb": round(db_size / 1048576, 2),
        "total_rows": rows,
        "total_tickers": tickers,
        "date_min": dates["mn"] if dates else None,
        "date_max": dates["mx"] if dates else None,
        "backtest_count": bt_count,
        "db_path": str(DB_PATH),
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  TICKER METADATA
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def upsert_ticker(ticker: str, sector: str, name: str = "",
                  conn: sqlite3.Connection | None = None) -> None:
    def _do(c):
        c.execute(
            """INSERT OR REPLACE INTO tickers (ticker, sector, name)
               VALUES (?, ?, ?)""",
            (ticker, sector, name),
        )
    if conn:
        _do(conn)
    else:
        with db_session() as c:
            _do(c)


def upsert_tickers_bulk(ticker_sector: Dict[str, str]) -> None:
    """Bulk insert ticker metadata."""
    with db_session() as conn:
        conn.executemany(
            "INSERT OR REPLACE INTO tickers (ticker, sector) VALUES (?, ?)",
            [(t, s) for t, s in ticker_sector.items()],
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  BACKTEST STORAGE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def save_backtest(params: dict, results: dict, summary: dict) -> int:
    """Save a backtest run, return its ID."""
    with db_session() as conn:
        cursor = conn.execute(
            "INSERT INTO backtests (params, results, summary) VALUES (?, ?, ?)",
            (json.dumps(params), json.dumps(results), json.dumps(summary)),
        )
        return cursor.lastrowid


def load_backtest(bt_id: int) -> dict | None:
    with db_session() as conn:
        row = conn.execute("SELECT * FROM backtests WHERE id = ?", (bt_id,)).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "run_time": row["run_time"],
            "params": json.loads(row["params"]),
            "results": json.loads(row["results"]),
            "summary": json.loads(row["summary"]),
        }


def list_backtests(limit: int = 20) -> list[dict]:
    with db_session() as conn:
        rows = conn.execute(
            "SELECT id, run_time, params, summary FROM backtests ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [{
            "id": r["id"],
            "run_time": r["run_time"],
            "params": json.loads(r["params"]),
            "summary": json.loads(r["summary"]),
        } for r in rows]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  STRATEGY STORAGE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def save_strategy(name: str, stype: str = "visual", config: dict | None = None,
                  code: str = "", description: str = "", strategy_id: int | None = None) -> int:
    """Save or update a strategy. Returns its ID."""
    with db_session() as conn:
        if strategy_id:
            conn.execute(
                """UPDATE strategies SET name=?, description=?, type=?, config=?, code=?,
                   updated=datetime('now') WHERE id=?""",
                (name, description, stype, json.dumps(config) if config else None, code, strategy_id),
            )
            return strategy_id
        else:
            cursor = conn.execute(
                "INSERT INTO strategies (name, description, type, config, code) VALUES (?,?,?,?,?)",
                (name, description, stype, json.dumps(config) if config else None, code),
            )
            return cursor.lastrowid


def list_strategies(limit: int = 50) -> list[dict]:
    with db_session() as conn:
        rows = conn.execute(
            "SELECT id, name, description, type, created, updated FROM strategies ORDER BY updated DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [{"id": r["id"], "name": r["name"], "description": r["description"],
                 "type": r["type"], "created": r["created"], "updated": r["updated"]} for r in rows]


def load_strategy(sid: int) -> dict | None:
    with db_session() as conn:
        row = conn.execute("SELECT * FROM strategies WHERE id = ?", (sid,)).fetchone()
        if not row:
            return None
        return {
            "id": row["id"], "name": row["name"], "description": row["description"],
            "type": row["type"],
            "config": json.loads(row["config"]) if row["config"] else None,
            "code": row["code"] or "",
            "created": row["created"], "updated": row["updated"],
        }


def delete_strategy(sid: int) -> bool:
    with db_session() as conn:
        conn.execute("DELETE FROM strategies WHERE id = ?", (sid,))
        return True


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  SIGNALS TABLE  (persisted screener results)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_SIGNALS_COLS = [
    "ticker", "company_name", "sector", "price", "daily_change", "return_20d",
    "volatility_20d", "vol_spike", "ta_branch", "momentum_phase",
    "sys1_score", "sys2_score", "sys3_score", "sys4_score", "composite",
    "regime", "sentiment", "probability",
    "shock_trigger", "shock_strength", "sm_trigger", "sm_score", "cont_prob",
    "is_etf", "is_ai",
]


def _flatten_signal(r: dict, etf_set: set, ai_set: set) -> tuple:
    """Flatten a screen_ticker result dict into a signals table row."""
    shock = r.get("momentum_shock", {})
    sm = r.get("smart_money", {})
    cont = r.get("continuation", {})
    return (
        r["ticker"], r.get("company_name", r["ticker"]), r.get("sector", "Unknown"),
        r.get("price"), r.get("daily_change"), r.get("return_20d"),
        r.get("volatility_20d"), r.get("vol_spike"),
        r.get("ta_branch"), r.get("momentum_phase"),
        r.get("sys1_score"), r.get("sys2_score"), r.get("sys3_score"), r.get("sys4_score"),
        r.get("composite"),
        r.get("regime"), r.get("sentiment"), r.get("probability"),
        int(shock.get("trigger", False)), shock.get("shock_strength", 0),
        int(sm.get("trigger", False)), sm.get("score", 0),
        cont.get("probability", 0),
        int(r["ticker"] in etf_set), int(r["ticker"] in ai_set),
    )


def upsert_signals_bulk(results: List[dict], etf_set: set, ai_set: set) -> int:
    """Bulk write all screened signals to the signals table. Returns count."""
    placeholders = ", ".join(["?"] * len(_SIGNALS_COLS))
    cols = ", ".join(_SIGNALS_COLS)
    sql = f"INSERT OR REPLACE INTO signals ({cols}) VALUES ({placeholders})"
    rows = [_flatten_signal(r, etf_set, ai_set) for r in results]
    with db_session() as conn:
        conn.executemany(sql, rows)
    return len(rows)


def upsert_indicator_system1_bulk(results: List[dict]) -> int:
    """Bulk write indicator_system1 from screen results."""
    sql = """INSERT OR REPLACE INTO indicator_system1
             (ticker, score, adx, plus_di, minus_di, trix, trix_signal, stoch_k, stoch_d)
             VALUES (?,?,?,?,?,?,?,?,?)"""
    rows = []
    for r in results:
        s = r.get("sys1", {})
        rows.append((
            r["ticker"], s.get("score"), s.get("adx"), s.get("plus_di"), s.get("minus_di"),
            s.get("trix"), s.get("trix_signal"), s.get("stoch_k"), s.get("stoch_d"),
        ))
    with db_session() as conn:
        conn.executemany(sql, rows)
    return len(rows)


def upsert_indicator_system2_bulk(results: List[dict]) -> int:
    """Bulk write indicator_system2 from screen results."""
    sql = """INSERT OR REPLACE INTO indicator_system2
             (ticker, score, last_color, consecutive, macd_hist, green_pct_10d, red_pct_10d)
             VALUES (?,?,?,?,?,?,?)"""
    rows = []
    for r in results:
        s = r.get("sys2", {})
        rows.append((
            r["ticker"], s.get("score"), s.get("last_color"), s.get("consecutive"),
            s.get("macd_hist"), s.get("green_pct_10d"), s.get("red_pct_10d"),
        ))
    with db_session() as conn:
        conn.executemany(sql, rows)
    return len(rows)


def upsert_indicator_system3_bulk(results: List[dict]) -> int:
    """Bulk write indicator_system3 from screen results."""
    sql = """INSERT OR REPLACE INTO indicator_system3
             (ticker, score, renko_direction, consecutive_bricks, brick_size,
              recent_up, recent_dn, stoch_k, stoch_d)
             VALUES (?,?,?,?,?,?,?,?,?)"""
    rows = []
    for r in results:
        s = r.get("sys3", {})
        rows.append((
            r["ticker"], s.get("score"), s.get("renko_direction"), s.get("consecutive_bricks"),
            s.get("brick_size"), s.get("recent_up"), s.get("recent_dn"),
            s.get("stoch_k"), s.get("stoch_d"),
        ))
    with db_session() as conn:
        conn.executemany(sql, rows)
    return len(rows)


def upsert_indicator_system4_bulk(results: List[dict]) -> int:
    """Bulk write indicator_system4 from screen results."""
    sql = """INSERT OR REPLACE INTO indicator_system4
             (ticker, score, ha_bullish, consecutive_candles, wick_quality,
              hma_value, hma_rising, bull_pct_10d)
             VALUES (?,?,?,?,?,?,?,?)"""
    rows = []
    for r in results:
        s = r.get("sys4", {})
        rows.append((
            r["ticker"], s.get("score"), int(s.get("ha_bullish", False)),
            s.get("consecutive_candles"), s.get("wick_quality"),
            s.get("hma_value"), int(s.get("hma_rising", False)) if s.get("hma_rising") is not None else None,
            s.get("bull_pct_10d"),
        ))
    with db_session() as conn:
        conn.executemany(sql, rows)
    return len(rows)


def persist_all_indicators(results: List[dict], etf_set: set, ai_set: set) -> dict:
    """
    Persist all pipeline results to DB in one shot.
    Returns counts per table for logging.
    """
    counts = {}
    counts["signals"] = upsert_signals_bulk(results, etf_set, ai_set)
    counts["system1"] = upsert_indicator_system1_bulk(results)
    counts["system2"] = upsert_indicator_system2_bulk(results)
    counts["system3"] = upsert_indicator_system3_bulk(results)
    counts["system4"] = upsert_indicator_system4_bulk(results)
    return counts


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  SIGNAL QUERIES  (fast per-ticker or filtered)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def load_signals(
    sector: Optional[str] = None,
    regime: Optional[str] = None,
    min_probability: Optional[float] = None,
    min_composite: Optional[float] = None,
    is_etf: Optional[bool] = None,
    is_ai: Optional[bool] = None,
    limit: int = 500,
    order_by: str = "probability DESC",
) -> List[dict]:
    """Query signals table with optional filters. Fast indexed queries."""
    clauses = []
    params: list = []

    if sector:
        clauses.append("sector = ?")
        params.append(sector)
    if regime:
        clauses.append("regime = ?")
        params.append(regime)
    if min_probability is not None:
        clauses.append("probability >= ?")
        params.append(min_probability)
    if min_composite is not None:
        clauses.append("composite >= ?")
        params.append(min_composite)
    if is_etf is not None:
        clauses.append("is_etf = ?")
        params.append(int(is_etf))
    if is_ai is not None:
        clauses.append("is_ai = ?")
        params.append(int(is_ai))

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    # Sanitise order_by to prevent injection
    allowed_cols = {"probability", "composite", "daily_change", "return_20d", "price",
                    "vol_spike", "sys1_score", "sys2_score", "sys3_score", "sys4_score"}
    order_col = order_by.split()[0] if order_by else "probability"
    order_dir = "DESC" if "DESC" in order_by.upper() else "ASC"
    if order_col not in allowed_cols:
        order_col, order_dir = "probability", "DESC"

    sql = f"SELECT * FROM signals{where} ORDER BY {order_col} {order_dir} LIMIT ?"
    params.append(limit)

    with db_session() as conn:
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]


def load_signal(ticker: str) -> Optional[dict]:
    """Load a single signal with all 4 system indicator details joined."""
    with db_session() as conn:
        sig = conn.execute("SELECT * FROM signals WHERE ticker = ?", (ticker,)).fetchone()
        if not sig:
            return None
        result = dict(sig)

        # Join indicator details from each system
        for sys_num in range(1, 5):
            table = f"indicator_system{sys_num}"
            ind = conn.execute(f"SELECT * FROM {table} WHERE ticker = ?", (ticker,)).fetchone()
            if ind:
                result[f"sys{sys_num}"] = {k: ind[k] for k in ind.keys() if k not in ("ticker", "updated_at")}
            else:
                result[f"sys{sys_num}"] = {}

    return result


def get_signals_count() -> int:
    """Count rows in signals table."""
    with db_session() as conn:
        row = conn.execute("SELECT COUNT(*) as c FROM signals").fetchone()
        return row["c"] if row else 0
