# HEADSTART Momentum Screener — 5-Phase Architectural Upgrade Roadmap

## TASK 1: SYSTEM AUDIT & DEPENDENCY MAPPING

### 1.1 SQLite Interaction Map (13 files touch `db.py`)

| File | Import Pattern | DB Operations Used |
|------|---------------|-------------------|
| [`backend/main.py`](backend/main.py:59) | `import db` | `init_db()`, `upsert_ohlcv()`, `persist_all_indicators()`, `upsert_daily_top()`, `load_alpha_calls()`, `has_alpha_data()`, `get_alpha_scan_age()`, `load_signals()`, `load_signal()`, `get_signals_count()`, `load_weekly_top()`, `get_db_stats()` |
| [`backend/pipelines/momentum_data.py`](backend/pipelines/momentum_data.py:21) | `import db` | `init_db()`, `upsert_tickers_bulk()`, `get_data_ranges()`, `load_all_ohlcv()` |
| [`backend/pipelines/engine.py`](backend/pipelines/engine.py:34) | `import db` | `persist_all_indicators()`, `upsert_daily_top()` |
| [`backend/pipelines/backtester.py`](backend/pipelines/backtester.py:26) | `import db` | OHLCV reads, backtest persistence |
| [`backend/pipelines/options_alpha.py`](backend/pipelines/options_alpha.py:287) | `import db as _db` | `persist_alpha_calls()`, `persist_alpha_meta()` |
| [`backend/pipelines/options_alpha_v3.py`](backend/pipelines/options_alpha_v3.py:1019) | `import db` | Alpha calls persistence |
| [`backend/pipelines/image_gen.py`](backend/pipelines/image_gen.py:14) | `import db` | `intel_images` table reads/writes |
| [`backend/pipelines/agents/market_pulse.py`](backend/pipelines/agents/market_pulse.py:34) | `import db as _db` | `alpha_calls` reads, `get_historical_performance_7d()`, `get_weekly_radar_tickers()` |
| [`backend/pipelines/agents/claude_picks.py`](backend/pipelines/agents/claude_picks.py:32) | `import db as _db` | Signal reads for AI picks |

### 1.2 Celery Task Map

| File | Role |
|------|------|
| [`backend/pipelines/celery_app.py`](backend/pipelines/celery_app.py) | Celery app singleton (`momentum_ml`). Redis broker/backend. JSON serialization. |
| [`backend/pipelines/worker.py`](backend/pipelines/worker.py) | Single task: `run_ml_pipeline(ticker, job_id)`. XGBoost inference + Triage Gate. |
| [`backend/main.py`](backend/main.py:2773) | Dispatcher: `run_ml_pipeline.delay(ticker, job_id)` at line 2774. Status reader: `get_job_status` at line 2832. |

### 1.3 Momentum Indicators Dependency Chain

```
momentum_indicators.py  ←  momentum_screener.py  ←  engine.py  ←  main.py
         ↑                        ↑                      ↑
    backtester.py            verify_spy.py          (pipeline orchestration)
    test_indicators.py       test_screener.py
```

### 1.4 Breaking Points — Where Changes Cascade

| Change In | Breaks These Files | Reason |
|-----------|-------------------|--------|
| `db.py` (SQLite → PostgreSQL) | **13 files** (see §1.1) | All `import db` consumers must switch to async sessions |
| `momentum_indicators.py` (O(N)→O(1)) | `momentum_screener.py`, `backtester.py`, `test_indicators.py`, `test_screener.py`, `verify_spy.py` | Function signatures change; tests must validate new stateful math |
| `celery_app.py` (sequential → parallel) | `main.py` (line 2773), `worker.py` | Task dispatch changes from `.delay()` to `.group()`/`.chord()` |
| `engine.py` (pipeline orchestration) | `main.py` (line 539) | `run_pipeline_progressive()` call signature may change |
| `redis_cache.py` (add Streams) | `main.py` (22 references), `engine.py`, `worker.py` | New Stream keys and write-behind pattern |

---

## TASK 2: THE 5-PHASE ARCHITECTURAL UPGRADE

---

### PHASE 1: Database Migration (SQLite → PostgreSQL + asyncpg)

#### Technical Specification
**What changes:** Replace the synchronous SQLite layer in [`db.py`](backend/pipelines/db.py) with PostgreSQL accessed via `asyncpg` and SQLAlchemy 2.0 async sessions. All 13 consumer files must be updated to use `async/await` patterns.

**Why:** SQLite's single-writer limitation causes write contention during high-frequency tick ingestion (SPY/TSLA can generate 100+ ticks/sec). PostgreSQL supports concurrent writers natively. `asyncpg` provides non-blocking I/O, freeing the FastAPI event loop during DB operations.

**Schema changes:** All 13 tables migrate 1:1. Add `SERIAL`/`BIGSERIAL` for auto-increment PKs. Replace `INTEGER` with `BOOLEAN` for flag columns. Add `TIMESTAMPTZ` for timezone-aware timestamps.

#### Gemini Flash Directive

```
TASK: Migrate backend/pipelines/db.py from SQLite to PostgreSQL with asyncpg

CONTEXT:
- Current file: backend/pipelines/db.py (1501 lines, SQLite via sqlite3 module)
- Target: PostgreSQL accessed via asyncpg + SQLAlchemy 2.0 async sessions
- All 13 consumer files must be updated (see dependency map below)

FILES TO MODIFY:
1. backend/pipelines/db.py — COMPLETE REWRITE
   - Replace `import sqlite3` with `import asyncpg` and `from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker`
   - Replace `get_connection()` with `create_async_engine(DATABASE_URL)` where DATABASE_URL = postgresql+asyncpg://user:pass@host:5432/headstart
   - Replace `db_session()` context manager with `async with AsyncSessionFactory() as session:`
   - Replace all `conn.execute()` calls with `await session.execute(text(...))`
   - Replace `conn.executemany()` with `await session.execute(text(...), rows)` using PostgreSQL INSERT ON CONFLICT
   - Replace `conn.commit()` / `conn.rollback()` with `await session.commit()` / `await session.rollback()`
   - Replace `conn.row_factory = sqlite3.Row` with SQLAlchemy `mappings()` result
   - Replace `PRAGMA journal_mode=WAL` etc. with PostgreSQL connection pool settings (pool_size=20, max_overflow=10)
   - Keep ALL function names identical (upsert_ohlcv, load_ohlcv, persist_all_indicators, etc.) but make them async
   - Add `async def init_db()` that runs CREATE TABLE IF NOT EXISTS for all 13 tables
   - Use `SERIAL PRIMARY KEY` instead of `INTEGER PRIMARY KEY AUTOINCREMENT`
   - Use `BOOLEAN` instead of `INTEGER` for is_etf, is_ai, shock_trigger, sm_trigger
   - Use `TIMESTAMPTZ DEFAULT NOW()` instead of `TEXT DEFAULT (datetime('now'))`
   - Add connection pool: `pool_size=20, max_overflow=10, pool_recycle=3600`

2. backend/main.py — UPDATE ALL DB CALLS TO ASYNC
   - Lines 59, 165, 251, 401-414, 617-633, 806, 1210, 1214, 1290, 1343-1352, 1362, 1395, 1441-1660
   - Change `db.init_db()` → `await db.init_db()`
   - Change `db.upsert_ohlcv(ticker, df)` → `await db.upsert_ohlcv(ticker, df)`
   - Change `db.load_alpha_calls(...)` → `await db.load_alpha_calls(...)`
   - Change ALL synchronous db.* calls to `await db.*`
   - In lifespan handler (line 802): make the startup section async-compatible
   - In background threads: use `asyncio.run()` or `loop.run_until_complete()` wrappers

3. backend/pipelines/momentum_data.py — UPDATE TO ASYNC
   - Lines 57-93: Change `db.init_db()`, `db.upsert_tickers_bulk()`, `db.get_data_ranges()`, `db.load_all_ohlcv()` to await
   - Make `smart_fetch()` an async function

4. backend/pipelines/engine.py — UPDATE TO ASYNC
   - Lines 34, 401-414: Change `db.persist_all_indicators()`, `db.upsert_daily_top()` to await
   - Make `run_pipeline_progressive()` async-compatible

5. backend/pipelines/backtester.py — UPDATE TO ASYNC
   - Line 26: Change all db calls to await

6. backend/pipelines/options_alpha.py — UPDATE TO ASYNC
   - Lines 287-502: Change `db.persist_alpha_calls()`, `db.persist_alpha_meta()` to await

7. backend/pipelines/options_alpha_v3.py — UPDATE TO ASYNC
   - Line 1019: Change db calls to await

8. backend/pipelines/image_gen.py — UPDATE TO ASYNC
   - Line 14: Change db calls to await

9. backend/pipelines/agents/market_pulse.py — UPDATE TO ASYNC
   - Lines 34-309: Change all `_db.*` calls to await

10. backend/pipelines/agents/claude_picks.py — UPDATE TO ASYNC
    - Line 32: Change db calls to await

CODE PATTERNS TO USE:
- SQLAlchemy 2.0 async: `from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker`
- Engine: `engine = create_async_engine(DATABASE_URL, pool_size=20, max_overflow=10, pool_recycle=3600)`
- Session factory: `AsyncSessionFactory = async_sessionmaker(engine, expire_on_commit=False)`
- Query pattern: `async with AsyncSessionFactory() as session: result = await session.execute(text("SELECT ..."), params); rows = result.mappings().all()`
- Insert pattern: `await session.execute(text("INSERT INTO ... VALUES (...) ON CONFLICT (pk) DO UPDATE SET ..."), rows)`
- Environment variable: `DATABASE_URL` from os.environ with fallback to `postgresql+asyncpg://postgres:postgres@localhost:5432/headstart`

DEFINITION OF DONE:
1. `python -c "import asyncio; from pipelines import db; asyncio.run(db.init_db())"` creates all 13 tables in PostgreSQL
2. All existing test files pass after updating their db calls to async
3. `uvicorn main:app` starts without import errors
4. `GET /api/health` returns `{"status": "ok"}` with DB connected
5. `GET /api/db/signals?limit=5` returns signals from PostgreSQL

WATCH OUT:
- DO NOT change function names or signatures beyond adding `async`/`await`
- DO NOT remove the `_migrate_alpha_calls_table()` logic — port it to PostgreSQL ALTER TABLE
- The `db_session()` context manager pattern must be preserved but made async
- All existing indexes must be recreated in PostgreSQL
- The `DATA_DIR` / `DB_PATH` constants should be replaced with `DATABASE_URL`
```

#### Risk Mitigation
- **Watch Out:** The `_run_pipeline_background()` function in [`main.py:535`](backend/main.py:535) runs in a `threading.Thread`. PostgreSQL connections are NOT thread-safe with asyncpg. Wrap DB calls in `asyncio.run()` within the thread, or refactor to use `asyncio.create_task()` on the main event loop instead of `threading.Thread`.

---

### PHASE 2: Redis Stream & Write-Behind Buffer

#### Technical Specification
**What changes:** Add a Redis Stream (`momentum:ticks:raw`) as the primary ingestion point for real-time tick data. Implement a Write-Behind pattern: data lands in Redis Stream first (sub-ms latency), then a background consumer flushes batches to PostgreSQL every 500ms or when the batch reaches 1000 messages.

**Why:** During market hours, yfinance polling can return 100+ ticks/sec for high-volume tickers. Writing each tick synchronously to PostgreSQL creates backpressure. Redis Streams absorb the burst, and batched writes reduce PostgreSQL transaction overhead by ~100x.

**New files:**
- [`backend/pipelines/stream_ingest.py`](backend/pipelines/stream_ingest.py) — Redis Stream producer
- [`backend/pipelines/stream_consumer.py`](backend/pipelines/stream_consumer.py) — Write-behind flush worker

#### Gemini Flash Directive

```
TASK: Implement Redis Stream ingestion with Write-Behind buffer pattern

CONTEXT:
- Current ingestion: yfinance → smart_fetch() → SQLite (synchronous, per-ticker)
- Target: yfinance → Redis Stream → batched PostgreSQL writes
- Redis already used for caching (redis_cache.py) and Celery broker

FILES TO CREATE:
1. backend/pipelines/stream_ingest.py — NEW FILE
   - Class `TickStreamProducer` with methods:
     - `async def push_tick(ticker: str, price: float, volume: int, timestamp: float) -> str` — adds to Redis Stream `momentum:ticks:raw` using `XADD`
     - `async def push_batch(ticks: list[dict]) -> list[str]` — pipelines multiple XADD commands
     - Stream key: `momentum:ticks:raw`
     - Max stream length: 100,000 (auto-trim with `MAXLEN ~ 100000`)
   - Use the existing Redis connection from `redis_cache.get_cache()._redis`
   - Each tick message: `{"ticker": "SPY", "price": 450.25, "volume": 1000, "ts": 1715400000.123}`

2. backend/pipelines/stream_consumer.py — NEW FILE
   - Class `WriteBehindConsumer` with:
     - `async def start()` — enters infinite loop reading from Redis Stream via `XREADGROUP`
     - Consumer group: `momentum_consumers`, consumer name: `writer-{hostname}`
     - Batch size: 1000 messages or 500ms timeout (whichever comes first)
     - `async def _flush_batch(messages: list)` — bulk INSERT into PostgreSQL ohlcv table
     - Uses `await db.upsert_ohlcv_batch(rows)` (new method to add to db.py)
     - Acknowledges messages with `XACK` after successful PostgreSQL write
     - On failure: does NOT ack → messages retried by next consumer loop
     - Runs as an asyncio background task, not a separate process

FILES TO MODIFY:
3. backend/pipelines/db.py — ADD BATCH UPSERT METHOD
   - Add `async def upsert_ohlcv_batch(rows: list[tuple]) -> int`
   - Use `INSERT INTO ohlcv (...) VALUES (...) ON CONFLICT (ticker, date) DO UPDATE SET ...`
   - Return number of rows written

4. backend/pipelines/momentum_data.py — ADD STREAM PATH
   - In `smart_fetch()`: after downloading from yfinance, also push to Redis Stream via `TickStreamProducer.push_batch()`
   - Add feature flag: `USE_REDIS_STREAM = os.environ.get("USE_REDIS_STREAM", "false").lower() == "true"`
   - When flag is false, use existing direct-to-DB path (backward compatible)

5. backend/main.py — START CONSUMER ON LIFESPAN
   - In lifespan startup (after line 806): if `USE_REDIS_STREAM` is true, start `WriteBehindConsumer` as background task
   - `asyncio.create_task(consumer.start())`
   - Store task reference for graceful shutdown

CODE PATTERNS TO USE:
- Redis Stream commands: `XADD`, `XREADGROUP`, `XACK`, `XGROUP CREATE`
- Consumer group creation (idempotent): `try: redis.xgroup_create(...) except: pass`
- Batch read: `redis.xreadgroup(groupname, consumername, {stream_key: '>'}, count=1000, block=500)`
- PostgreSQL batch insert: `INSERT INTO ohlcv (ticker, date, open, high, low, close, volume) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (ticker, date) DO UPDATE SET open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low, close=EXCLUDED.close, volume=EXCLUDED.volume`

DEFINITION OF DONE:
1. Set `USE_REDIS_STREAM=true`, restart server
2. Trigger a pipeline refresh — verify ticks appear in Redis: `redis-cli XLEN momentum:ticks:raw` > 0
3. Within 500ms, verify PostgreSQL has the data: `SELECT count(*) FROM ohlcv` increases
4. Kill the consumer process mid-batch — restart and verify no duplicate rows (ON CONFLICT handles this)
5. Set `USE_REDIS_STREAM=false` — verify system falls back to direct DB writes

WATCH OUT:
- The consumer group name must be created before first read. Use try/except for idempotent creation.
- If Redis is unavailable, the system must fall back to direct DB writes (no data loss).
- The `MAXLEN ~ 100000` trim is approximate — Redis may keep slightly more. Monitor memory.
- Consumer must handle PostgreSQL connection drops gracefully (reconnect, retry batch).
```

#### Risk Mitigation
- **Watch Out:** If the Write-Behind consumer crashes, unacknowledged messages remain in the Redis Stream and will be re-delivered on restart. Ensure the batch upsert is idempotent (`ON CONFLICT DO UPDATE`) to prevent duplicate rows. Monitor the Redis Stream length — if it grows unbounded, it indicates the consumer is dead and data is piling up.

---

### PHASE 3: Asynchronous Pipeline Parallelization

#### Technical Specification
**What changes:** Refactor the sequential pipeline execution in [`main.py:535-553`](backend/main.py:535) and [`engine.py`](backend/pipelines/engine.py) to run Momentum and Alpha pipelines in parallel using Celery's `group` primitive. Decouple the Whale Tracker and ML pipelines as independent Celery tasks.

**Why:** Currently, Alpha waits for Momentum to complete (line 547: "Start alpha AFTER momentum finishes"). This serial dependency adds 10s+ latency. Momentum and Alpha use different data sources (OHLCV vs options chains) and can run concurrently. Celery `group` runs them in parallel and `chord` provides a callback when both complete.

#### Gemini Flash Directive

```
TASK: Parallelize Momentum and Alpha pipelines using Celery group/chord

CONTEXT:
- Current flow (main.py:535-553): run_pipeline_progressive() → then _refresh_alpha_cache_background() (SEQUENTIAL)
- Target: Both pipelines run in parallel via Celery tasks, with a chord callback for cache refresh
- Celery already configured in celery_app.py with Redis broker

FILES TO CREATE:
1. backend/pipelines/pipeline_tasks.py — NEW FILE
   - Celery task: `@celery_app.task(name="run_momentum_pipeline")`
     - Wraps `engine.run_pipeline_progressive(publish_callback=None, use_parallel=True)`
     - Returns: `{"tickers_screened": N, "bullish": N, "bearish": N, "elapsed": seconds}`
   - Celery task: `@celery_app.task(name="run_alpha_pipeline")`
     - Wraps `options_alpha.run_alpha_pipeline(universe="sp500", max_workers=4)`
     - Returns: `{"contracts_found": N, "tickers_scanned": N, "elapsed": seconds}`
   - Celery task: `@celery_app.task(name="run_whale_pipeline")`
     - Wraps `whale_tracker.get_whale_signals()`
     - Returns: `{"signals": N, "elapsed": seconds}`
   - Celery task: `@celery_app.task(name="on_pipelines_complete")`
     - Chord callback: receives results from all parallel tasks
     - Calls `redis_cache.get_cache().set_dashboard(merged_data)`
     - Fires webhooks via `_dispatch_webhooks()`
     - Updates `_engine_status` to "done"

FILES TO MODIFY:
2. backend/main.py — REPLACE SEQUENTIAL WITH PARALLEL DISPATCH
   - Lines 535-553: Replace `_run_pipeline_background()` body with:
     ```python
     from celery import group, chord
     from pipeline_tasks import run_momentum_pipeline, run_alpha_pipeline, run_whale_pipeline, on_pipelines_complete
     
     parallel_tasks = group(
         run_momentum_pipeline.s(),
         run_alpha_pipeline.s(),
         run_whale_pipeline.s(),
     )
     workflow = chord(parallel_tasks)(on_pipelines_complete.s())
     ```
   - Remove the sequential "Start alpha AFTER momentum" comment and logic
   - Keep the `_scheduled_pipeline_run()` function but update it to dispatch the chord
   - Add environment variable: `PIPELINE_MODE` with values `"celery_parallel"` (new) or `"sequential"` (legacy fallback)

3. backend/pipelines/engine.py — MAKE PICKLABLE FOR CELERY
   - Ensure `run_pipeline_progressive()` can be called without the `publish_callback` (make it optional)
   - The callback-based progressive publishing won't work across Celery workers
   - Instead: the Celery task runs the full pipeline synchronously and returns the complete result
   - Add `run_pipeline_sync()` wrapper that calls the full pipeline and returns the dashboard dict

4. backend/pipelines/celery_app.py — REGISTER NEW TASKS
   - Add `celery_app.autodiscover_tasks(["worker", "pipeline_tasks"])`

CODE PATTERNS TO USE:
- Celery group: `from celery import group; job = group(task1.s(), task2.s())()`
- Celery chord: `from celery import chord; result = chord([task1.s(), task2.s()])(callback.s())`
- Task signature: `.s()` creates a signature, `.delay()` executes immediately
- Result retrieval: `result.get(timeout=300)` for synchronous waiting

DEFINITION OF DONE:
1. Set `PIPELINE_MODE=celery_parallel`, restart server + Celery worker
2. Trigger pipeline refresh — verify Momentum, Alpha, and Whale tasks start simultaneously in Celery logs
3. Verify chord callback fires after ALL tasks complete
4. Verify dashboard data is cached in Redis after callback
5. Set `PIPELINE_MODE=sequential` — verify legacy sequential path still works
6. Total pipeline time should be ~max(momentum_time, alpha_time) instead of momentum_time + alpha_time

WATCH OUT:
- Celery tasks must be picklable. DataFrames are NOT picklable across workers. The momentum task must serialize results to JSON before returning.
- The `publish_callback` pattern in engine.py won't work across Celery workers. Replace with chord callback.
- Redis memory: parallel pipelines may double peak memory. Monitor with `redis-cli INFO memory`.
- If one task in the group fails, the chord callback still fires. Handle partial failures in the callback.
```

#### Risk Mitigation
- **Watch Out:** Celery tasks cannot pass DataFrames between workers (not picklable). The momentum pipeline returns large dicts (~2MB). Ensure tasks serialize to JSON before returning. If the result payload exceeds Redis's `result_expires` TTL (1 hour), the chord callback will receive `None`. Set `result_expires=7200` for safety.

---

### PHASE 4: Stateful O(1) Rolling Indicators

#### Technical Specification
**What changes:** Refactor the indicator math in [`momentum_indicators.py`](backend/pipelines/momentum_indicators.py) from O(N) full-array recalculations to O(1) stateful updates. Each indicator maintains a running state (cumulative sums, EMA values, previous candles) and updates incrementally when a new tick arrives.

**Why:** Currently, every new tick triggers a full recalculation of the entire price history array (e.g., 252-day ADX, 20-day VWAP). For 1500 tickers, this is ~1500 × 252 = 378,000 operations per tick. Stateful updates reduce this to O(1) per tick — a ~90% CPU reduction during peak market hours.

**Key formulas:**

VWAP (Volume-Weighted Average Price):
```
CPV_next = CPV_prev + (Price_new × Volume_new)
TotalVol_next = TotalVol_prev + Volume_new
VWAP_next = CPV_next / TotalVol_next
```

EMA (Exponential Moving Average):
```
EMA_next = Price_new × α + EMA_prev × (1 - α)
where α = 2 / (period + 1)
```

Rolling Z-Score (Welford's online algorithm):
```
count_next = count_prev + 1
delta = x_new - mean_prev
mean_next = mean_prev + delta / count_next
M2_next = M2_prev + delta × (x_new - mean_next)
variance_next = M2_next / (count_next - 1)
zscore = (x_new - mean_next) / sqrt(variance_next)
```

#### Gemini Flash Directive

```
TASK: Refactor momentum_indicators.py from O(N) array math to O(1) stateful updates

CONTEXT:
- Current file: backend/pipelines/momentum_indicators.py (629 lines)
- Current pattern: Every indicator recomputes the full price array on each call
- Target: Stateful classes that maintain running state and update in O(1) per tick
- Must maintain backward compatibility: existing function signatures should still work

FILES TO CREATE:
1. backend/pipelines/indicator_state.py — NEW FILE
   - Dataclass `IndicatorState` with fields:
     ```python
     @dataclass
     class VWAPState:
         cumulative_pv: float = 0.0
         total_volume: float = 0.0
     
     @dataclass
     class EMAState:
         value: float = 0.0
         initialized: bool = False
     
     @dataclass
     class WelfordState:
         count: int = 0
         mean: float = 0.0
         m2: float = 0.0
     
     @dataclass
     class ADXState:
         prev_high: float = 0.0
         prev_low: float = 0.0
         prev_close: float = 0.0
         smoothed_tr: float = 0.0
         smoothed_plus_dm: float = 0.0
         smoothed_minus_dm: float = 0.0
         dx_values: list = field(default_factory=list)  # rolling window of DX
     
     @dataclass
     class IndicatorSnapshot:
         """All state for one ticker at one point in time."""
         ticker: str
         vwap: VWAPState = field(default_factory=VWAPState)
         ema_12: EMAState = field(default_factory=EMAState)
         ema_26: EMAState = field(default_factory=EMAState)
         adx: ADXState = field(default_factory=ADXState)
         zscore_close: WelfordState = field(default_factory=WelfordState)
         zscore_volume: WelfordState = field(default_factory=WelfordState)
         last_price: float = 0.0
         last_volume: int = 0
         last_updated: float = 0.0  # monotonic timestamp
     ```

2. backend/pipelines/stateful_indicators.py — NEW FILE
   - Class `StatefulIndicatorEngine`:
     - `__init__(self)`: creates empty dict `self._states: dict[str, IndicatorSnapshot]`
     - `async def update(ticker: str, price: float, volume: int, high: float, low: float, timestamp: float) -> IndicatorSnapshot`:
       - Retrieves or creates state for ticker
       - Updates VWAP: `state.vwap.cumulative_pv += price * volume; state.vwap.total_volume += volume`
       - Updates EMA(12): `state.ema_12.value = price * 0.1538 + state.ema_12.value * 0.8462` (α = 2/13)
       - Updates EMA(26): `state.ema_26.value = price * 0.0741 + state.ema_26.value * 0.9259` (α = 2/27)
       - Updates ADX: computes TR, +DM, -DM from (high, low, prev_high, prev_low, prev_close), applies Wilder smoothing
       - Updates Z-Score via Welford: `count += 1; delta = price - mean; mean += delta/count; m2 += delta*(price - mean)`
       - Returns the updated snapshot
     - `def get_state(ticker: str) -> IndicatorSnapshot | None`: returns current state
     - `def get_all_states() -> dict[str, IndicatorSnapshot]`: returns all states
     - `def reset_ticker(ticker: str)`: removes state (for new trading day)
     - `def warm_start(ticker: str, df: pd.DataFrame)`: initializes state from historical DataFrame (for cold start)

FILES TO MODIFY:
3. backend/pipelines/momentum_indicators.py — ADD O(1) WRAPPERS
   - Keep ALL existing functions (compute_adx, compute_trix, etc.) for backward compatibility
   - Add new O(1) functions alongside them:
     - `def update_vwap_stateful(state: VWAPState, price: float, volume: int) -> float` — returns new VWAP
     - `def update_ema_stateful(state: EMAState, price: float, period: int) -> float` — returns new EMA
     - `def update_adx_stateful(state: ADXState, high: float, low: float, close: float, period: int) -> float` — returns new ADX
     - `def update_zscore_welford(state: WelfordState, value: float) -> float` — returns new Z-Score
   - Each function is pure (no side effects beyond state mutation) and returns the new indicator value

4. backend/pipelines/momentum_screener.py — ADD STATEFUL PATH
   - Add `def screen_ticker_stateful(snapshot: IndicatorSnapshot) -> dict`:
     - Uses pre-computed indicator values from the snapshot instead of recomputing
     - Returns the same dict format as `screen_ticker()`
   - Keep existing `screen_ticker()` for backward compatibility

5. backend/main.py — INTEGRATE STATEFUL ENGINE
   - In lifespan startup: instantiate `StatefulIndicatorEngine` as a module-level singleton
   - Add feature flag: `USE_STATEFUL_INDICATORS = os.environ.get("USE_STATEFUL_INDICATORS", "false").lower() == "true"`
   - When flag is true: the tick ingestion path updates the stateful engine instead of triggering full recalculations
   - Add endpoint: `GET /api/indicator-state/{ticker}` — returns current O(1) indicator snapshot for debugging

CODE PATTERNS TO USE:
- Dataclasses for state: `from dataclasses import dataclass, field`
- Welford's online algorithm for running mean/variance
- Wilder smoothing: `smoothed = (prev_smoothed * (period - 1) + new_value) / period`
- EMA: `ema = price * alpha + prev_ema * (1 - alpha)` where `alpha = 2 / (period + 1)`

DEFINITION OF DONE:
1. Unit test: create VWAPState, feed 100 ticks, verify VWAP matches pandas `.rolling(20).mean()` within 0.01%
2. Unit test: create WelfordState, feed 1000 random values, verify mean and std match numpy within 0.001%
3. Unit test: create ADXState, feed 252 candles from SPY CSV, verify ADX matches original `compute_adx()` within 0.1%
4. Integration test: run `screen_ticker_stateful()` on 10 tickers, verify results match `screen_ticker()` within 1%
5. Performance test: time 10,000 stateful updates vs 10,000 full recalculations — stateful should be >90% faster
6. Set `USE_STATEFUL_INDICATORS=true` — verify dashboard still renders correctly

WATCH OUT:
- Floating-point drift: O(1) algorithms accumulate small errors over millions of updates. Add a periodic "reset from full recalculation" every 10,000 ticks or at market close.
- The Welford algorithm for variance uses `count - 1` (sample variance). Ensure this matches the existing rolling window behavior.
- ADX state requires a rolling window of DX values. Use `collections.deque(maxlen=period)` for O(1) append/pop.
- Stateful indicators are NOT thread-safe. Use `asyncio.Lock` per ticker if concurrent updates are possible.
```

#### Risk Mitigation
- **Watch Out:** O(1) algorithms accumulate floating-point drift over time. The EMA formula `ema = price * α + prev_ema * (1 - α)` loses precision after ~10^6 updates for float32. Use `float64` throughout. Add a "recalibration" trigger: every 10,000 ticks or at market close, recompute from the full array and compare. If drift exceeds 0.1%, reset the state from the full calculation.

---

### PHASE 5: MCP & Agent Sandboxing

#### Technical Specification
**What changes:** Create an `mcp_config.json` that defines directory-level access boundaries for AI agents (Gemini Flash). The config specifies which directories are read-only, which are read-write, and which are completely blocked. This allows Gemini Flash to safely run tests and edit code in `pipelines/` without touching `auth/`, `config/`, or production data.

**Why:** As we move toward AI-assisted development, we need guardrails to prevent agents from modifying security-critical files (API keys, CORS config, rate limits) or corrupting the production database. MCP (Model Context Protocol) provides a standardized way to define these boundaries.

#### Gemini Flash Directive

```
TASK: Create MCP configuration and agent sandboxing for the HEADSTART backend

CONTEXT:
- Workspace root: /Users/shashwat/Desktop/Momemtum-screener
- AI agents (Gemini Flash) need safe access to edit pipeline code and run tests
- Must prevent agents from touching auth, config, or production data

FILES TO CREATE:
1. mcp_config.json — NEW FILE (workspace root)
   ```json
   {
     "version": "1.0",
     "name": "HEADSTART Momentum Screener",
     "description": "MCP boundaries for AI agent access",
     "boundaries": {
       "read_only": [
         {
           "path": "backend/pipelines/config.py",
           "reason": "Hyper-parameters — changing these alters signal behavior globally"
         },
         {
           "path": "backend/pipelines/momentum_config.py",
           "reason": "Stock universe definitions — changing these alters screening scope"
         },
         {
           "path": "backend/main.py",
           "reason": "Security middleware, CORS, rate limiting, API key validation (lines 890-992)"
         },
         {
           "path": "backend/pipelines/celery_app.py",
           "reason": "Celery broker config — changing this breaks task routing"
         },
         {
           "path": "backend/pipelines/validators.py",
           "reason": "Pydantic validation models — changing these alters data integrity checks"
         },
         {
           "path": "backend/pipelines/flow_protocol.py",
           "reason": "Institutional guardrails — changing these alters risk validation"
         },
         {
           "path": "backend/tests/",
           "reason": "Test files — agents can read but must not modify existing tests"
         },
         {
           "path": "frontend/",
           "reason": "Frontend code — backend agents should not modify UI"
         }
       ],
       "read_write": [
         {
           "path": "backend/pipelines/db.py",
           "reason": "Database layer — agents can refactor but must preserve all function signatures"
         },
         {
           "path": "backend/pipelines/engine.py",
           "reason": "Pipeline orchestration — agents can optimize parallelism"
         },
         {
           "path": "backend/pipelines/momentum_indicators.py",
           "reason": "Indicator math — agents can add O(1) stateful variants"
         },
         {
           "path": "backend/pipelines/momentum_screener.py",
           "reason": "Screening logic — agents can add stateful screening path"
         },
         {
           "path": "backend/pipelines/momentum_data.py",
           "reason": "Data ingestion — agents can add Redis Stream path"
         },
         {
           "path": "backend/pipelines/options_alpha.py",
           "reason": "Options pipeline — agents can optimize chain fetching"
         },
         {
           "path": "backend/pipelines/whale_tracker.py",
           "reason": "Whale tracker — agents can optimize signal detection"
         },
         {
           "path": "backend/pipelines/worker.py",
           "reason": "ML worker — agents can add new Celery tasks"
         },
         {
           "path": "backend/pipelines/redis_cache.py",
           "reason": "Cache layer — agents can add Stream support"
         },
         {
           "path": "backend/pipelines/agents/",
           "reason": "AI agents — agents can improve Claude/Gemini prompt engineering"
         },
         {
           "path": "backend/pipelines/stream_ingest.py",
           "reason": "Stream ingestion — new file for Phase 2"
         },
         {
           "path": "backend/pipelines/stream_consumer.py",
           "reason": "Stream consumer — new file for Phase 2"
         },
         {
           "path": "backend/pipelines/pipeline_tasks.py",
           "reason": "Celery pipeline tasks — new file for Phase 3"
         },
         {
           "path": "backend/pipelines/indicator_state.py",
           "reason": "Indicator state dataclasses — new file for Phase 4"
         },
         {
           "path": "backend/pipelines/stateful_indicators.py",
           "reason": "Stateful indicator engine — new file for Phase 4"
         },
         {
           "path": "plans/",
           "reason": "Planning documents — agents can create and update plans"
         }
       ],
       "blocked": [
         {
           "path": "backend/quant_screener.db",
           "reason": "Production database — never modify directly"
         },
         {
           "path": "backend/pipelines/momentum_data.json",
           "reason": "Production cache file — never modify directly"
         },
         {
           "path": "backend/pipelines/data/flow_audit_ledger.csv",
           "reason": "Audit ledger — append-only, never modify"
         },
         {
           "path": ".env",
           "reason": "Environment secrets — contains API keys"
         },
         {
           "path": ".git/",
           "reason": "Git history — never modify"
         },
         {
           "path": "Dockerfile",
           "reason": "Deployment config — changing this breaks production"
         },
         {
           "path": "railway.toml",
           "reason": "Deployment config — changing this breaks production"
         },
         {
           "path": "backend/requirements.txt",
           "reason": "Dependencies — changing this breaks builds"
         }
       ]
     },
     "agent_permissions": {
       "can_execute_tests": true,
       "test_command": "cd backend && python -m pytest tests/ -v --tb=short",
       "can_restart_server": false,
       "can_modify_db_schema": false,
       "can_access_network": true,
       "max_file_size_bytes": 1048576,
       "require_approval_for": [
         "backend/main.py",
         "backend/pipelines/config.py",
         "backend/pipelines/momentum_config.py"
       ]
     },
     "validation_rules": {
       "before_edit": [
         "Read the file first to confirm current content",
         "Ensure changes don't break existing function signatures",
         "Check that imports remain valid"
       ],
       "after_edit": [
         "Run affected test files",
         "Verify no import errors with `python -c 'import pipelines.affected_module'`",
         "Report any breaking changes to the human"
       ]
     }
   }
   ```

2. backend/tests/test_mcp_boundaries.py — NEW FILE
   - Test that verifies the MCP config is valid JSON
   - Test that all paths in the config exist on disk
   - Test that blocked paths are not writable by the test process
   - Test that read_only paths can be read but the test cannot confirm write protection (OS-level)

FILES TO MODIFY:
3. .gitignore — ADD SANDBOX ENTRIES
   - Add `mcp_config.json` to .gitignore (or not — decide if it should be versioned)
   - Add `*.sandbox` to .gitignore for agent test artifacts

DEFINITION OF DONE:
1. `python -c "import json; json.load(open('mcp_config.json'))"` succeeds (valid JSON)
2. All paths in mcp_config.json exist on disk
3. Agent can read files in `read_only` and `read_write` directories
4. Agent receives error when attempting to write to `blocked` paths
5. Agent can run `cd backend && python -m pytest tests/ -v --tb=short` successfully

WATCH OUT:
- MCP boundaries are advisory, not enforced at the OS level. They rely on the agent respecting the config.
- For true sandboxing, run the agent in a Docker container with volume mounts matching the MCP config.
- The `require_approval_for` list means the agent must ask the human before editing those files.
- If adding new files to the project, update mcp_config.json to include them in the appropriate boundary.
```

#### Risk Mitigation
- **Watch Out:** MCP boundaries are configuration-level, not OS-level enforcement. A malicious or buggy agent could ignore them. For production use, run agents in a Docker container with read-only volume mounts for `blocked` paths. The `require_approval_for` mechanism adds a human-in-the-loop gate for critical files.

---

## TASK 3: EXECUTION ORDER & DEPENDENCIES

```
Phase 1 (DB Migration)
    │
    ├── Must complete first — all other phases depend on PostgreSQL
    │
    ├──► Phase 2 (Redis Stream) — depends on Phase 1's async db.py
    │
    ├──► Phase 3 (Parallel Pipelines) — depends on Phase 1's async db.py
    │         │
    │         └──► Phase 5 (MCP Sandbox) — can run anytime after Phase 1
    │
    └──► Phase 4 (Stateful Indicators) — independent of Phases 2 & 3
              │
              └── Can run in parallel with Phases 2 & 3
```

**Recommended execution order:** Phase 1 → Phase 2 + Phase 4 (parallel) → Phase 3 → Phase 5

---

## ROLLBACK STRATEGY

Every phase includes a feature flag (`USE_REDIS_STREAM`, `PIPELINE_MODE`, `USE_STATEFUL_INDICATORS`). Setting the flag to `false` or `"sequential"` reverts to the legacy behavior. This allows phased rollout with instant rollback if issues arise in production.