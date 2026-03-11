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

SCHEMA_VERSION = 1

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
"""


def init_db(db_path=None) -> None:
    """Create all tables if they don't exist."""
    with db_session(db_path) as conn:
        conn.executescript(SCHEMA_SQL)
        # Record schema version
        existing = conn.execute(
            "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO schema_version (version) VALUES (?)",
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
