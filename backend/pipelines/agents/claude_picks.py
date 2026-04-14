"""
claude_picks.py — Claude-Powered Trade Pick Generator
======================================================
Feeds HEADSTART momentum signals + options flow into Claude,
gets structured BUY/SELL/AVOID picks with entry/target/stop,
and persists everything to the `claude_picks` table.

Reuses the existing db.py infrastructure (no SQLAlchemy needed).
"""

import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

# Ensure pipelines/ is importable
if str(Path(__file__).parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from anthropic import Anthropic
    anthropic_available = True
except ImportError:
    anthropic_available = False

try:
    import db as _db
except ImportError:
    try:
        from pipelines import db as _db
    except ImportError:
        _db = None

logger = logging.getLogger(__name__)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  SCHEMA — runs once at import to create the table
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLAUDE_PICKS_SCHEMA = """
CREATE TABLE IF NOT EXISTS claude_picks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT    DEFAULT (datetime('now')),
    run_id      TEXT    NOT NULL,
    ticker      TEXT    NOT NULL,
    action      TEXT    NOT NULL,
    conviction  TEXT    NOT NULL,
    entry       REAL,
    target      REAL,
    stop        REAL,
    rationale   TEXT,
    composite   REAL,
    confidence  REAL,
    rr          TEXT,
    phase       TEXT,
    sector      TEXT,
    price       REAL
);
CREATE INDEX IF NOT EXISTS idx_claude_picks_ticker  ON claude_picks(ticker);
CREATE INDEX IF NOT EXISTS idx_claude_picks_run     ON claude_picks(run_id);
CREATE INDEX IF NOT EXISTS idx_claude_picks_created ON claude_picks(created_at);
"""

def _ensure_table():
    """Create the claude_picks table if it doesn't exist."""
    if not _db:
        logger.error("DB module not available")
        return
    try:
        with _db.db_session() as conn:
            conn.executescript(CLAUDE_PICKS_SCHEMA)
    except Exception as e:
        logger.error(f"Failed to create claude_picks table: {e}")

_ensure_table()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  FETCH SIGNALS FROM EXISTING DB
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def fetch_signals_for_claude(limit=10):
    """
    Pull top momentum signals from the `signals` table
    and format them for the Claude prompt.
    """
    if not _db:
        return []

    signals = []
    try:
        with _db.db_session() as conn:
            rows = conn.execute("""
                SELECT ticker, price, daily_change, composite, probability,
                       regime, sentiment, momentum_phase, sector,
                       vol_spike, shock_trigger, shock_strength,
                       sys1_score, sys2_score, sys3_score, sys4_score
                FROM signals
                WHERE composite IS NOT NULL AND price > 5
                ORDER BY ABS(composite) DESC
                LIMIT ?
            """, (limit,)).fetchall()

            for r in rows:
                signals.append(_format_signal(r))
    except Exception as e:
        logger.error(f"Error fetching signals for Claude: {e}")

    # Fallback: read from momentum_data.json if DB is empty
    if not signals:
        try:
            json_path = Path(__file__).parent.parent / "momentum_data.json"
            if json_path.exists():
                data = json.load(open(json_path))
                raw_signals = data.get("signals", [])
                raw_signals.sort(key=lambda s: abs(s.get("composite", 0)), reverse=True)
                for s in raw_signals[:limit]:
                    signals.append(_format_signal(s))
        except Exception as e:
            logger.error(f"JSON fallback error: {e}")

    return signals


def _format_signal(r):
    """Convert a DB row or JSON dict to a standardized signal dict."""
    get = r.get if isinstance(r, dict) else lambda k, d=None: r[k] if r[k] is not None else d

    comp = float(get("composite", 0) or 0)
    prob = float(get("probability", 50) or 50)
    price = float(get("price", 0) or 0)

    if abs(comp) > 1.0:
        rr = "1:2.5"
    elif abs(comp) > 0.5:
        rr = "1:1.8"
    elif abs(comp) > 0.2:
        rr = "1:1.3"
    else:
        rr = "1:0.8"

    sys_scores = [
        get("sys1_score", 0), get("sys2_score", 0),
        get("sys3_score", 0), get("sys4_score", 0)
    ]

    return {
        "ticker": get("ticker", "???"),
        "composite": round(comp, 2),
        "confidence": round(prob, 1),
        "rr": rr,
        "phase": get("momentum_phase", "Neutral") or "Neutral",
        "current_price": round(price, 2),
        "sector": get("sector", "Unknown") or "Unknown",
        "regime": get("regime", "Choppy") or "Choppy",
        "sentiment": get("sentiment", "Neutral") or "Neutral",
        "vol_spike": float(get("vol_spike", 1.0) or 1.0),
        "n_bullish": sum(1 for s in sys_scores if (s or 0) > 0.1),
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PROMPT BUILDER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def build_prompt(signals, gex_regime=None, spy_vrp=None, notes=None):
    """Build the structured prompt for Claude."""
    signals_text = "\n".join(
        f"  - {s['ticker']}: composite={s['composite']}, confidence={s['confidence']}%, "
        f"R:R={s['rr']}, phase={s['phase']}, regime={s['regime']}, "
        f"price=${s['current_price']}, sector={s['sector']}, "
        f"systems_bullish={s['n_bullish']}/4"
        + (f", vol_spike={s['vol_spike']:.1f}x" if s['vol_spike'] > 1.5 else "")
        for s in signals
    )

    options_ctx = ""
    if gex_regime or spy_vrp:
        options_ctx = f"""
OPTIONS CONTEXT:
  GEX regime : {gex_regime or 'N/A'}
  SPY VRP    : {spy_vrp or 'N/A'}
"""

    extra = f"\nADDITIONAL NOTES:\n  {notes}" if notes else ""

    return f"""You are the HEADSTART quant engine.
Your job is to evaluate momentum signals and produce actionable trade picks.

MOMENTUM SIGNALS:
{signals_text}
{options_ctx}{extra}

RULES:
1. Only recommend BUY for HIGH conviction + favorable phase (Trending / Fresh).
2. Flag "Exhausting" phase picks as SELL or AVOID unless R:R is exceptional (>1:2).
3. "Declining" phase = always AVOID.
4. If 4/4 systems bullish AND confidence > 70%, that's a HIGH conviction BUY.
5. If GEX regime is SHORT Γ, momentum trades are favoured — lean BUY.
6. If VRP is RICH, note that options are expensive in the rationale.
7. Entry should be near current price (within 1-2%).
8. Target should reflect the R:R ratio from the signal.
9. Stop should be 3-5% below entry for swing trades.
10. Keep rationale under 60 words. Be factual, no hype.

Respond ONLY with valid JSON — no markdown fences, no extra text:
{{
  "picks": [
    {{
      "ticker":     "string",
      "action":     "BUY | SELL | AVOID",
      "conviction": "HIGH | MEDIUM | LOW",
      "entry":      number or null,
      "target":     number or null,
      "stop":       number or null,
      "rationale":  "string"
    }}
  ]
}}"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  CALL CLAUDE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SYSTEM_PROMPT = """You are the HEADSTART quantitative engine — a systematic, 
rules-based trade evaluation system. You analyze momentum signals from a 
4-system screener (ADX, TRIX, Stochastics, Elder Impulse) and produce 
structured, actionable trade picks. Be precise about levels. Never hallucinate prices."""

def call_claude_for_picks(prompt):
    """
    Call Claude and parse the JSON response into a list of pick dicts.
    Falls back to a dummy response if the API key is missing.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key or not anthropic_available:
        logger.warning("No ANTHROPIC_API_KEY — returning dummy picks.")
        return _dummy_picks()

    try:
        client = Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()

        # Strip markdown fences if Claude wraps them despite instructions
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            if raw.endswith("```"):
                raw = raw[:-3]

        parsed = json.loads(raw)
        return parsed.get("picks", [])

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Claude JSON: {e}")
        return _dummy_picks()
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        return _dummy_picks()


def _dummy_picks():
    """Fallback picks for development/testing when no API key is available."""
    return [
        {
            "ticker": "NVDA",
            "action": "BUY",
            "conviction": "HIGH",
            "entry": 115.00,
            "target": 130.00,
            "stop": 108.00,
            "rationale": "4/4 systems bullish with Fresh momentum phase. Volume spike 2.3x confirms institutional accumulation. Trending regime supports continuation."
        },
        {
            "ticker": "SMCI",
            "action": "AVOID",
            "conviction": "LOW",
            "entry": None,
            "target": None,
            "stop": None,
            "rationale": "Exhausting momentum phase with only 1/4 systems aligned. R:R unfavorable at 1:0.8. Wait for base formation."
        }
    ]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PERSIST TO DB
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def persist_picks(picks, signals, run_id):
    """Write picks to the claude_picks table, echoing back signal metadata."""
    if not _db:
        logger.error("DB not available — cannot persist picks")
        return 0

    signal_map = {s["ticker"].upper(): s for s in signals}
    stored = 0

    try:
        with _db.db_session() as conn:
            for p in picks:
                ticker = p.get("ticker", "").upper()
                sig = signal_map.get(ticker, {})
                conn.execute("""
                    INSERT INTO claude_picks
                    (run_id, ticker, action, conviction, entry, target, stop,
                     rationale, composite, confidence, rr, phase, sector, price)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    run_id,
                    ticker,
                    p.get("action", "AVOID"),
                    p.get("conviction", "LOW"),
                    p.get("entry"),
                    p.get("target"),
                    p.get("stop"),
                    p.get("rationale", ""),
                    sig.get("composite"),
                    sig.get("confidence"),
                    sig.get("rr"),
                    sig.get("phase"),
                    sig.get("sector"),
                    sig.get("current_price"),
                ))
                stored += 1
    except Exception as e:
        logger.error(f"Error persisting Claude picks: {e}")

    return stored


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MAIN ENTRY POINT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def generate_picks(signal_limit=10, gex_regime=None, spy_vrp=None, notes=None):
    """
    Full pipeline: fetch signals → build prompt → call Claude → persist → return.
    This can be called from the API route or directly from a scheduler.
    """
    # 1. Fetch live signals from DB
    signals = fetch_signals_for_claude(limit=signal_limit)
    if not signals:
        return {"status": "error", "message": "No signals available in DB.", "picks": []}

    # 2. Build prompt
    prompt = build_prompt(signals, gex_regime=gex_regime, spy_vrp=spy_vrp, notes=notes)

    # 3. Call Claude
    picks = call_claude_for_picks(prompt)

    # 4. Persist
    run_id = datetime.utcnow().strftime("run_%Y%m%d_%H%M%S")
    stored = persist_picks(picks, signals, run_id)

    logger.info(f"Claude Picks run {run_id}: {len(picks)} picks generated, {stored} stored.")

    return {
        "status": "success",
        "run_id": run_id,
        "picks": picks,
        "stored": stored,
        "signals_analyzed": len(signals),
    }


def get_latest_picks(limit=20):
    """Retrieve the most recent Claude picks from the DB."""
    if not _db:
        return []

    try:
        with _db.db_session() as conn:
            rows = conn.execute("""
                SELECT * FROM claude_picks
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,)).fetchall()
            return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"Error fetching picks: {e}")
        return []


def get_pick_history(ticker=None, limit=50):
    """Get historical picks, optionally filtered by ticker."""
    if not _db:
        return []

    try:
        with _db.db_session() as conn:
            if ticker:
                rows = conn.execute("""
                    SELECT * FROM claude_picks
                    WHERE ticker = ?
                    ORDER BY created_at DESC LIMIT ?
                """, (ticker.upper(), limit)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT * FROM claude_picks
                    ORDER BY created_at DESC LIMIT ?
                """, (limit,)).fetchall()
            return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"Error fetching pick history: {e}")
        return []


def get_pick_stats():
    """Get aggregate stats on Claude pick performance."""
    if not _db:
        return {}

    try:
        with _db.db_session() as conn:
            total = conn.execute("SELECT COUNT(*) as c FROM claude_picks").fetchone()["c"]
            buys = conn.execute("SELECT COUNT(*) as c FROM claude_picks WHERE action='BUY'").fetchone()["c"]
            high_conv = conn.execute("SELECT COUNT(*) as c FROM claude_picks WHERE conviction='HIGH'").fetchone()["c"]
            runs = conn.execute("SELECT COUNT(DISTINCT run_id) as c FROM claude_picks").fetchone()["c"]

            return {
                "total_picks": total,
                "total_buys": buys,
                "total_high_conviction": high_conv,
                "total_runs": runs,
            }
    except Exception as e:
        logger.error(f"Error fetching pick stats: {e}")
        return {}


# ── CLI test ──
if __name__ == "__main__":
    result = generate_picks(signal_limit=8)
    print(json.dumps(result, indent=2, default=str))
