# HEADSTART — Quantitative Momentum Research Platform

> **4-System Momentum Analysis · XGBoost ML Predictions · Portfolio Intelligence · Full Backtesting Engine**

![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776ab?style=flat-square&logo=python&logoColor=white)
![Next.js 16](https://img.shields.io/badge/Next.js-16-000?style=flat-square&logo=next.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-v3.0-009688?style=flat-square&logo=fastapi&logoColor=white)
![XGBoost](https://img.shields.io/badge/XGBoost-ML-FF6600?style=flat-square)
![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?style=flat-square&logo=sqlite&logoColor=white)

A full-stack quantitative momentum research platform that screens **1,500+ US equities** (S&P 500 + NASDAQ 100, plus 30 ETFs) across **11 GICS sectors** using four proprietary technical indicator systems, **XGBoost ML predictions** with Purged K-Fold cross-validation, **insider buying signal detection**, actionable trade strategies (leveraged ETFs & options), a **Portfolio Intelligence engine**, and a comprehensive backtesting framework with a visual strategy builder.

**Architecture**: Next.js 16 frontend (TypeScript, Tailwind CSS v4, Framer Motion) + FastAPI v3 backend (Python 3.11+, parallel engine) + SQLite (WAL mode) + Redis (optional) + Celery (async ML).

---

## Table of Contents

- [Quick Start](#quick-start)
- [Key Features](#-key-features)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Quantitative Research Methodology](#quantitative-research-methodology)
- [ML Predictive Engine](#ml-predictive-engine)
- [Dashboard Pages](#dashboard-pages)
- [Signal Screeners](#signal-screeners)
- [Backtesting Engine](#backtesting-engine)
- [Strategy Engine (15 Built-In Indicators)](#strategy-engine-15-built-in-indicators)
- [API Reference](#api-reference)
- [Data Architecture](#data-architecture)
- [Configuration](#configuration)
- [Tech Stack & Dependencies](#tech-stack--dependencies)
- [Roadmap](#roadmap--future-updates)

---

## Quick Start

> **For AI agents / new developers**: This section tells you everything you need to run the entire stack locally in under 5 minutes.

### Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Python | 3.11+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| pip | Latest | `pip --version` |
| Git | Any | `git --version` |

**Optional**: Redis (for Celery ML pipeline — falls back to sync inference if unavailable)

### Step 1: Clone & Navigate

```bash
git clone https://github.com/anhadkwatra55/Momemtum-screener.git
cd Momemtum-screener
```

### Step 2: Start the Backend (FastAPI — Port 8060)

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate          # macOS/Linux
# venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Start the API server
python3 -m uvicorn main:app --host 0.0.0.0 --port 8060 --reload
```

**What happens on first run**: The progressive pipeline fetches data in 3 waves — priority tickers render within ~30s, full universe within ~5 min. Subsequent runs load from SQLite cache.

**Verify**: Open `http://localhost:8060/docs` → Swagger API explorer.

### Step 3: Start the Frontend (Next.js — Port 3000)

```bash
# In a NEW terminal
cd frontend

npm install       # First time only
npm run dev       # Starts dev server on http://localhost:3000
```

**Verify**: Open `http://localhost:3000` → Command Center.

### Step 4: (Optional) ML Pipeline Setup

```bash
# Train the XGBoost model (one-time)
cd backend/pipelines
python3 features.py         # Generate feature store → features_latest.parquet
python3 train_model.py      # Train XGBoost → xgb_model.json

# If Redis is available, start the Celery worker
celery -A celery_app worker --loglevel=info
```

### Step 5: Run Tests

```bash
cd backend
source venv/bin/activate
python -m pytest tests/ -v        # 89 tests, ~15s
```

### Access Points

| Page | URL | Description |
|------|-----|-------------|
| Command Center | `http://localhost:3000/` | Landing page with KPIs, sector heatmap, signal feed |
| Intelligence Dashboard | `http://localhost:3000/dashboard` | Full screener with 12 sidebar pages |
| Receipts Ledger | `http://localhost:3000/receipts` | Backtest performance tracking |
| API Explorer (Swagger) | `http://localhost:8060/docs` | Interactive API documentation |

### Environment Variables

```bash
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8060    # Backend API base URL (default)

# Backend (shell env or .env)
PORT=8060                                    # API server port
DATA_DIR=backend/pipelines/                  # SQLite database directory
PIPELINE_SCHEDULE_HOUR=17                    # Daily auto-refresh hour (ET)
PIPELINE_SCHEDULE_MINUTE=0                   # Daily auto-refresh minute
PIPELINE_SCHEDULE_TZ=America/New_York        # Timezone for scheduler
```

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Backend won't start | Ensure Python 3.11+, check `pip install -r requirements.txt` succeeded |
| Frontend "fetch failed" | Ensure backend is running on port 8060 first |
| "No data available" on charts | Wait ~30s for Wave 1 of the progressive pipeline to complete |
| `quant_screener.db` missing | Normal on first run — auto-created by the backend pipeline |
| Redis connection errors | Safe to ignore — falls back to in-memory cache and sync ML inference |
| XGBoost `libomp` error (macOS) | `brew install libomp` — or run without ML features |
| Port already in use | Kill existing process: `lsof -ti:8060 \| xargs kill` |

---

## ✨ Key Features

### Momentum Analysis
- **4-System Ensemble Screening** — ADX+TRIX+Stochastics, Elder Impulse, Renko+Stochastics, Heikin-Ashi+HMA — each scoring -2 to +2, combined into a composite score with probability engine (0–98%)
- **Market Regime Classification** — Trending (ADX ≥ 25), Mean-Reverting (ADX 15–25), Choppy (ADX < 15) per ticker and sector
- **9 Signal Screeners** — Fresh Momentum, Exhausting Momentum, Rotation Breakouts, Momentum Shock Detector, Gamma Squeeze Ops, Smart Money Accumulation, Momentum Continuation, Momentum Clusters, Sector Shock Clusters
- **Quant Research Categories** — Top Pick, Accumulate, Hold & Monitor, Reduce, Contrarian (replacing simple Bullish/Bearish labels)
- **Hidden Gems Detection** — High momentum + high probability + low daily movement = under-the-radar alpha

### Machine Learning Pipeline
- **XGBoost Predictions** — Trained on stationary features (Fractional Differencing, Gaussian Rank Normalization, Rolling Z-Scores) with Purged K-Fold Cross-Validation to prevent label leakage
- **Triage Gate** — Cross-sectional rank-based anomaly filter: only top 5% trigger deep analysis
- **Kelly Criterion Position Sizing** — Half-Kelly with ATR-normalised volatility for optimal portfolio weighting
- **CAR Event Study** — Market Model OLS regression measuring abnormal returns from momentum shocks and insider buying events

### Portfolio Intelligence
- **Portfolio X-Ray** — Concentration risk alerts, sector exposure analysis, momentum scoring per holding
- **Correlation-Aware Recommendations** — Rotation suggestions factoring in inter-holding correlations
- **Income Engine** — High-yield ETF and high-dividend stock screening with momentum overlay

### Signal Intelligence
- **Insider Buying Scanner** — SEC Form 4 data via yfinance, scored by insider seniority (CEO > Director > VP), $ value, recency, and unique insider count
- **Weekly Momentum Tracking** — Daily snapshots of top momentum leaders for weekly trend analysis
- **Trade Strategy Generator** — Auto-generated leveraged ETF recommendations, options strategies, entry/stop/target levels

### Backtesting & Strategy
- **4-System Backtester** — Vectorized backtesting with configurable systems, holding periods, entry thresholds, K-of-N ensemble modes
- **Visual Strategy Builder** — Drop-down condition builder with 15 indicators, AND/OR logic, stop-loss/take-profit
- **Python Code Editor** — Write custom strategies in a sandboxed environment with access to `df`, `ind`, `pd`, `np`
- **Monte Carlo Projections** — 500-simulation forward P&L confidence intervals

### Infrastructure
- **Progressive 3-Wave Pipeline** — Priority tickers render in ~30s, full universe in 3 waves for instant dashboard rendering
- **Parallel Engine** — `ProcessPoolExecutor` for CPU-bound indicator math (bypasses GIL), `ThreadPoolExecutor` for I/O-bound fetches
- **Daily Auto-Refresh Scheduler** — Configurable post-market pipeline re-run (default 17:00 ET)
- **Segmented Redis Caching** — Signals, summary, charts cached separately to avoid deserializing 10MB+ payloads
- **ETag Conditional Responses** — Sub-1ms 304 Not Modified for unchanged data
- **WebSocket Pipeline Status** — Real-time progress push to frontend via `/ws/pipeline`
- **`orjson` Serialization** — 3–5x faster JSON encoding

---

## Architecture Overview

```
┌─────────────[DATA LAYER]─────────────┐
│  yfinance API  ←→  momentum_data.py  │
│                 ↕                    │
│           quant_screener.db (SQLite) │
│   (WAL mode, 64MB cache, OHLCV      │
│    + tickers + backtests + strats)   │
└───────────────────┬──────────────────┘
                    │
┌─────────[ANALYSIS PIPELINE]──────────┐
│  engine.py (Parallel Orchestrator)   │
│   → ProcessPool: CPU-bound math      │
│   → ThreadPool: I/O-bound fetches    │
│   → 3-Wave Progressive Rendering     │
│                    ↓                 │
│  momentum_indicators.py              │
│   → System 1: ADX + TRIX + Stoch    │
│   → System 2: Elder Impulse         │
│   → System 3: Renko + Stochastic    │
│   → System 4: Heikin-Ashi + HMA     │
│                    ↓                 │
│  momentum_screener.py                │
│   → Composite scoring (mean of 4)   │
│   → Regime classification           │
│   → Quant research categories        │
│   → Probability engine               │
│                    ↓                 │
│  momentum_strategies.py              │
│   → Leveraged ETF recs + Options     │
│   → Entry / Stop / Target levels     │
└───────────────────┬──────────────────┘
                    │
┌──────────[ML LAYER]──────────────────┐
│  features.py (Feature Engineering)   │
│   → Fractional Differencing (d=0.4)  │
│   → Gaussian Rank Normalization      │
│   → Rolling Z-Scores (21d, 63d)     │
│                    ↓                 │
│  train_model.py (XGBoost Training)   │
│   → Purged K-Fold CV (5-fold)        │
│   → Embargo 5 days (anti-leakage)    │
│   → Model artifact: xgb_model.json  │
│                    ↓                 │
│  worker.py (Celery Async Inference)  │
│   → XGBoost prediction → sigmoid     │
│   → Triage Gate (top 5% anomalies)   │
│   → Kelly Criterion position sizing  │
│                    ↓                 │
│  event_study.py (CAR Analysis)       │
│   → Market Model OLS regression      │
│   → Momentum shock + insider events  │
│                    ↓                 │
│  insider_signals.py (Form 4 Scanner) │
│   → Seniority-weighted scoring       │
│   → Parallel multi-ticker fetch      │
└───────────────────┬──────────────────┘
                    │
┌──────────[API LAYER]─────────────────┐
│  FastAPI v3 (main.py, port 8060)     │
│   → 40+ REST API endpoints          │
│   → WebSocket pipeline status        │
│   → SSE stream for ML results        │
│   → ETag conditional responses       │
│   → Segmented Redis caching          │
│   → GZip compression + orjson        │
│   → Daily auto-refresh scheduler     │
│   → Swagger docs at /docs           │
└───────────────────┬──────────────────┘
                    │
┌──────────[FRONTEND LAYER]────────────┐
│  Next.js 16 (TypeScript, port 3000)  │
│   /           (Command Center)       │
│   /dashboard  (Intelligence — 12 pg) │
│   /receipts   (Performance)          │
│                                      │
│  Theme: Carbon Terminal (F1/Bloomberg) │
│  Fonts: Inter + JetBrains Mono       │
│  Charts: TradingView Lightweight     │
│  Animations: Framer Motion           │
│  Icons: lucide-react (zero emojis)   │
└──────────────────────────────────────┘
```

---

## Project Structure

```
quant_screener/
├── backend/
│   ├── main.py                    # FastAPI v3 server (40+ endpoints, parallel engine, WebSocket)
│   ├── requirements.txt           # Python dependencies
│   ├── pipelines/
│   │   ├── engine.py              # Parallel pipeline (ProcessPool + ThreadPool + progressive 3-wave)
│   │   ├── momentum_indicators.py # 4 indicator systems (ADX/TRIX/Stoch, Elder, Renko, HA/HMA)
│   │   ├── momentum_screener.py   # Signal scoring, regime, quant research categories, probability
│   │   ├── momentum_strategies.py # Actionable trade strategy generator (ETF + options)
│   │   ├── momentum_config.py     # Universe, indicator params, leveraged ETFs, quotes
│   │   ├── universe.py            # S&P 500 + NASDAQ 100 merged universe (1,500+ tickers)
│   │   ├── momentum_data.py       # Data fetcher via yfinance + SQLite incremental sync
│   │   ├── features.py            # ML feature engineering (FFD, Gaussian rank, Z-scores)
│   │   ├── train_model.py         # XGBoost training with Purged K-Fold CV
│   │   ├── worker.py              # Celery worker: XGBoost inference + Triage Gate + Kelly
│   │   ├── celery_app.py          # Celery + Redis broker configuration
│   │   ├── event_study.py         # CAR event study (Market Model OLS)
│   │   ├── insider_signals.py     # Insider buying scanner (SEC Form 4)
│   │   ├── backtester.py          # Vectorized backtesting engine + Monte Carlo
│   │   ├── strategy_engine.py     # 15 built-in indicators + visual/code strategy engine
│   │   ├── db.py                  # SQLite database layer (schema, CRUD, migrations)
│   │   ├── redis_cache.py         # Segmented Redis cache with ETag support
│   │   ├── validators.py          # Pydantic data validation (7-check pipeline)
│   │   ├── config.py              # Quant parameters (fractional diff, HMM, etc.)
│   │   ├── signals.py             # Signal analysis helpers
│   │   ├── risk.py                # Risk management utilities
│   │   ├── data_preprocessing.py  # Data preprocessing utilities
│   │   ├── xgb_model.json         # Pre-trained XGBoost model artifact
│   │   ├── features_latest.parquet # Feature store (auto-generated)
│   │   ├── quant_screener.db      # SQLite database (auto-generated)
│   │   └── momentum_data.json     # Cached pipeline output (auto-generated)
│   └── tests/
│       ├── conftest.py            # Pytest fixtures (frozen OHLCV data)
│       ├── test_indicators.py     # Math verification for all 4 indicator systems
│       ├── test_screener.py       # Regime, sentiment, probability tests
│       ├── test_backtester.py     # Equity curve, metrics, determinism tests
│       ├── test_api.py            # FastAPI endpoint smoke tests
│       └── fixtures/
│           └── aapl_200d.csv      # Frozen 200-day AAPL OHLCV for deterministic tests
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Command Center (KPI strip, hero, sector heatmap, signal feed)
│   │   │   ├── dashboard/page.tsx # Intelligence Dashboard (12 sidebar pages)
│   │   │   ├── receipts/page.tsx  # Receipts Ledger (backtest performance history)
│   │   │   ├── layout.tsx         # Root layout (Inter + JetBrains Mono)
│   │   │   └── globals.css        # Design system (Carbon Terminal, carbon-weave)
│   │   ├── components/
│   │   │   ├── ui/                # Primitives (AppleCard, AppleButton, DataTable, SFIcon)
│   │   │   ├── layout/            # TopNav, app-sidebar
│   │   │   ├── momentum/          # Domain components (28 files — see below)
│   │   │   └── charts/            # TradingView-powered charts
│   │   ├── hooks/                 # useSignals, useStrategy, useSectors, useBacktest, etc.
│   │   ├── services/api.ts        # Typed API client (all backend endpoints)
│   │   ├── types/momentum.ts      # TypeScript interfaces (Signal, DashboardData, etc.)
│   │   └── lib/
│   │       ├── constants.ts       # Design tokens, sidebar nav, spring configs, color palette
│   │       └── utils.ts           # cn() class merger, color helpers
│   ├── package.json
│   └── next.config.ts
│
├── Dockerfile                     # Container deployment
├── railway.toml                   # Railway deployment config
└── README.md
```

---

## Quantitative Research Methodology

HEADSTART is built on the thesis that **no single technical indicator is reliable in isolation** — but a multi-system ensemble, weighted by regime context, produces statistically significant alpha signals.

### The 4 Indicator Systems

Each ticker is scored independently by four systems that capture different facets of price momentum. Every system produces a score from **-2 to +2**. The composite is the arithmetic mean of all four.

| System | Indicators | What It Captures |
|--------|-----------|-----------------|
| **S1** | ADX (14) + TRIX (14/9) + Full Stochastics (14/3/3) | Trend strength × momentum direction × mean-reversion timing |
| **S2** | Elder Impulse (EMA-13 + MACD-Hist 12/26/9) | Institutional buying/selling pressure via consecutive impulse bars |
| **S3** | Renko (ATR-14) + Full Stochastics | Noise-filtered trend via brick aggregation + oscillator timing |
| **S4** | Heikin-Ashi + Hull Moving Average (20) | Smoothed candle trend quality (wick analysis) + low-lag MA direction |

### Probability Engine

Signal confidence (0–98%) factors in **directional agreement** across all 4 systems. When systems unanimously agree on direction, probability gets a 1.2× multiplier.

### Regime Classification

| Regime | Condition | Strategy Implication |
|--------|-----------|---------------------|
| **Trending** | ADX ≥ 25 | Momentum strategies have the highest edge |
| **Mean-Reverting** | ADX 15–25, Stochastics 30–70 | Oscillator-based contrarian plays |
| **Choppy** | ADX < 15 | Reduced position sizing, wider stops |

### Quant Research Categories

Stocks are classified into research-driven action categories (replacing simple Bullish/Bearish labels):

| Category | Criteria | Action |
|----------|----------|--------|
| **Top Pick** | Highest composite + trending regime + high probability | Core portfolio position |
| **Accumulate** | Strong composite + favorable regime | Add on pullbacks |
| **Hold & Monitor** | Neutral-to-mild positive signals | Maintain existing positions |
| **Reduce** | Weakening momentum + exhausting phase | Trim exposure |
| **Contrarian** | Strong bearish signals | Potential short / hedge |

### Persisted Indicator Database

All computed indicators are persisted to SQLite in **5 separate tables**:

```
signals            → 25-column flat table (price, composite, probability, regime, sector)
indicator_system1  → ADX, TRIX, Stochastics per ticker
indicator_system2  → Elder Impulse colors, MACD histogram
indicator_system3  → Renko brick direction, brick size, Stochastics
indicator_system4  → Heikin-Ashi trend, wick quality, HMA direction
```

---

## ML Predictive Engine

A 4-phase machine learning pipeline that operates alongside the core 4-system screener:

### Phase 1 — Feature Engineering (`features.py`)

Transforms raw OHLCV data into mathematically stationary features safe for tree-based models:

| Transform | Equation | Purpose |
|-----------|----------|---------|
| **Fractional Differencing (FFD)** | Δ^d Y_t = Σ w_k · Y_{t-k} (d=0.4) | Stationary series that retains long-term memory |
| **Gaussian Rank Normalization** | Z = Φ⁻¹(Rank / (N+1)) | Cross-sectional ranking → N(0,1), removes regime drift |
| **Rolling Z-Scores** | Z_t = (X_t - μ_w) / σ_w | Removes level effects and volatility regimes (21d & 63d windows) |
| **Forward 20-Day Return** | fwd_ret = close_{t+20} / close_t - 1 | Target variable (never used as feature) |

### Phase 2 — XGBoost Training (`train_model.py`)

| Parameter | Value |
|-----------|-------|
| Model | XGBRegressor |
| Features | close_ffd, close_zscore_21/63, volume_zscore_21/63, score_gauss_rank |
| Target | fwd_ret_20d_gauss (Gaussian-rank normalized 20-day forward return) |
| CV | **Purged K-Fold** (5-fold, 20-day label span, 5-day embargo) |
| Hyperparameters | n_estimators=200, max_depth=4, lr=0.05, subsample=0.8 |

**Purged K-Fold** prevents data leakage by removing any training row whose 20-day label window overlaps with any test row, plus embargoing 5 days after the test set to block serial autocorrelation.

### Phase 3 — Triage Gate (`worker.py`)

Cross-sectional anomaly filter that identifies the top 5% of the universe for deep analysis:

```
Conviction        = |probability - 0.5|
RankedConviction  = Rank(Conviction) / N        → uniform [0, 1]
RankedVolume      = Rank(VolumeZScore21) / N     → uniform [0, 1]
TriageScore       = 0.6 × RankedConviction + 0.4 × RankedVolume
Gate              = TriageScore ≥ 0.95 → trigger LLM debate
```

### Phase 4 — Kelly Criterion Position Sizing

```
Raw Edge:       K = 2p - 1              (p > 0.5 required)
NATR_20:        ATR_20 / close          (normalised volatility)
Final Weight:   w = (0.5 × K) × (0.01 / NATR_20)
```

Half-Kelly with 1% daily risk budget, clamped to [0, 1].

### CAR Event Study (`event_study.py`)

Market Model OLS regression measuring Cumulative Abnormal Returns from two event types:

- **Momentum Shock** — Composite score flips from < 0 to > 1.0 within 2 days
- **Insider Buying** — SEC Form 4 purchase flag

Estimation window: 90 trading days. Event window: 20 trading days. Benchmark: TSX Composite proxy (XIU.TO).

---

## Dashboard Pages

### Command Center (`/`)

Landing page and executive overview:
- **KPI Strip** — Universe screened, bullish/bearish counts, avg confidence, top bull/bear
- **Main Character Hero** — Today's #1 triple-threat signal with composite, confidence, day change
- **Market Heat** — 11-sector regime heatmap with bull/bear sentiment bars + whale watch alerts
- **Platform Modules** — Navigation cards to Momentum Intelligence, Fresh Momentum, Sector Intelligence, Receipts
- **Live Signal Feed** — Mini table of top 8 bullish aura picks
- **Rotating Quotes** — 30 curated quant/finance quotes, 15s rotation

### Intelligence Dashboard (`/dashboard`)

Full analysis platform with **12 sidebar pages** organized into 5 workflow sections:

#### ORIENTATION — "What's happening right now?"

| Page | Description |
|------|-------------|
| **Market Pulse** | Full signal table with tier dividers (High/Medium/Developing conviction), KPI grid, momentum leaderboard, sector heatmap |
| **Sector Radar** | Sector regime analysis, trending sector rankings, rotation signals |

#### DISCOVERY — "What should I be watching?"

| Page | Description |
|------|-------------|
| **Momentum Lifecycle** | Fresh vs Exhausting momentum phases — early-stage plays vs overbought warnings |
| **Anomaly Detector** | Momentum shocks, gamma squeeze candidates, unusual volume signals |
| **Hidden Alpha** | Under-the-radar stocks: high composite + high probability + low daily movement |

#### CONSTRUCTION — "How do I build a portfolio?"

| Page | Description |
|------|-------------|
| **Portfolio X-Ray** | Upload holdings → get concentration risk, sector exposure, momentum scoring, rotation suggestions, correlation-aware recommendations |
| **Income Engine** | High-yield ETFs and high-dividend stocks screener with yield, momentum overlay, and sector data |

#### RIGOR — "Can I prove this works?"

| Page | Description |
|------|-------------|
| **Strategy Lab** | 4-system backtester, visual strategy builder (15 indicators), Python code editor, saved strategies, Monte Carlo projections |
| **Signals & Evidence** | Full signal table with conviction tiers + actionable strategy cards (ETF, options, entry/stop/target) |

#### EDGE CASES — "What am I missing?"

| Page | Description |
|------|-------------|
| **Insider & Institutional** | SEC Form 4 insider buying scanner with seniority-weighted scoring |
| **Ticker Deep Dive** | Per-ticker charts: Price+HMA, ADX+DI, Stochastics, Elder Impulse MACD, TRIX |
| **Earnings & Growth** | Earnings growers (planned: 5 consecutive quarters of revenue + EBITDA growth) |

### Receipts Ledger (`/receipts`)

- **KPI Strip** — Win rate, avg return, best/worst call, total calls, Sharpe
- **P&L Curve** — 30-day equity curve from backtest history
- **Win/Loss Distribution** — Doughnut chart (wins/losses/open)
- **Receipts Table** — Filterable table with date, ticker, signal type, result, return, P&L, Sharpe

---

## Frontend Component Architecture

### Domain Components (`src/components/momentum/` — 28 files)

| Component | Description |
|-----------|-------------|
| **`ml-prediction-panel.tsx`** | XGBoost prediction UI with SSE streaming, Triage Gate visualization, Kelly weight |
| **`portfolio-intelligence.tsx`** | Portfolio analysis: sector exposure, momentum scoring, rotation suggestions |
| **`insider-buying.tsx`** | Insider buying signal table with seniority badges and transaction details |
| **`hidden-alpha.tsx`** | Hidden Gems / under-the-radar signals view |
| **`income-engine.tsx`** | High-yield ETF and dividend stock views |
| **`yield-table.tsx`** | Dedicated yield/dividend screener table |
| **`anomaly-detector.tsx`** | Anomaly detection: shocks, gamma, smart money |
| **`conviction-badge.tsx`** | Quant research category badges (Top Pick, Accumulate, etc.) |
| **`momentum-lifecycle.tsx`** | Fresh vs Exhausting momentum visualization |
| **`weekly-momentum-panel.tsx`** | Weekly top momentum tracking with daily snapshots |
| **`screener-table.tsx`** | Full signal table with tier dividers |
| **`signal-table.tsx`** | Detailed signal list for screener pages |
| **`leaderboard.tsx`** | Top tickers ranked by composite with aura scoring |
| **`ticker-modal.tsx`** | Full detail modal: 4-system breakdown, alerts, score calculation |
| **`ticker-search.tsx`** | Search DB + yfinance, auto-add tickers to universe |
| **`sector-heatmap.tsx`** | 11-sector regime grid with bull/bear bars |
| **`sector-radar.tsx`** | Sector intelligence deep dive |
| **`strategy-builder.tsx`** | Visual condition builder + code editor + backtester |
| **`strategy-card.tsx`** | Strategy recommendation cards |
| **`backtest-results.tsx`** | Metrics grid, equity chart, monthly heatmap, trade log |
| **`top-signals.tsx`** | Enhanced top signals display |
| **`rotation-signals.tsx`** | Sector rotation signal cards |
| **`trending-sectors.tsx`** | Trending sector rankings |
| **`mini-signal-list.tsx`** | Compact signal previews for dashboard widgets |
| **`kpi-strip.tsx`** | Animated counter row for key metrics |
| **`sentiment-badge.tsx`** | Color-coded sentiment label |
| **`regime-badge.tsx`** | Regime label (Trending/Mean-Reverting/Choppy) |
| **`quote-rotator.tsx`** | Rotating finance quotes |

### Design System — Carbon Terminal

| Token | Value |
|-------|-------|
| **Fonts** | Inter (UI), JetBrains Mono (data/numbers) |
| **Theme** | Pure black (#000000) with carbon-weave grid texture |
| **Card surfaces** | Opaque #111111 with 1px #2A2A2A borders |
| **Border radius** | 2–4px (chamfered, no rounded-full) |
| **Shadows** | None — border-only depth system |
| **Signal colors** | Green (#00FF66) · Red (#FF3333) · Yellow (#FFD600) — 3 only |
| **Neutral grays** | #0A0A0A · #111111 · #1C1C1C · #2A2A2A · #6B6B6B · #C0C0C0 · #E8E8E8 |
| **Transitions** | 50–100ms ease-out (mechanical, no spring physics) |
| **Icons** | `lucide-react` via `SFIcon.tsx` — zero emojis |
| **Aesthetic** | F1 telemetry / Bloomberg terminal — data-dense, mechanical, no glassmorphism |

---

## Signal Screeners

Nine specialized screeners, each with its own dedicated page:

| Screener | Criteria | Purpose |
|----------|----------|---------|
| **Fresh Momentum** | Composite > 0 AND Stoch_K > Stoch_D AND Stoch_K < 70 | Early-stage momentum — maximum upside before the crowd |
| **Exhausting Momentum** | Composite > 0 AND Stoch_K > 80 | Overextended momentum — reversal watch |
| **Rotation Breakouts** | Trending regime AND composite > 0.3 | Sector rotation plays |
| **Momentum Shock** | Price > 2σ from 20-day mean | Sudden price movements — breakout or breakdown |
| **Gamma Squeeze Ops** | Volume > 2x 20-day avg AND composite > 0 | High-volume bullish setups |
| **Smart Money Accumulation** | Price trending up AND 5-day vol > 1.3x 20-day avg | Institutional accumulation detection |
| **Momentum Continuation** | Composite > 0 AND probability > 50 AND continuation prob > 30 | Sustained trend plays |
| **Momentum Clusters** | Sectors with 3+ bullish stocks (composite > 0.1) | Broad-based sector momentum |
| **Sector Shock Clusters** | Sectors with multiple momentum shock signals | Systemic sector events |

**Additional thematic lists**: Momentum 95+, AI Stocks, Bullish Momentum, High Volume Gappers, Hidden Gems, Top Picks.

---

## Backtesting Engine

### Three Backtesting Modes

| Mode | Module | Approach |
|------|--------|----------|
| **4-System** | `backtester.py` | Vectorized signal generation, configurable systems/holding/threshold, K-of-N ensemble |
| **Visual Strategy** | `strategy_engine.py` | Drop-down conditions with 15 indicators, AND entry / OR exit logic |
| **Code Strategy** | `strategy_engine.py` | Python in sandbox (`df`, `ind`, `pd`, `np`), blocked dangerous builtins |

### Metrics Computed

Total Return, Annualised Return, Max Drawdown, Sharpe Ratio, Sortino Ratio, Win Rate, Profit Factor, Best/Worst Trade, Max Consecutive Wins/Losses, Avg Holding Days, Monthly P&L.

### Visualizations

- Equity Curve (line with gradient fill)
- Drawdown (area chart, red)
- Monte Carlo Projected P&L (500 simulations, confidence interval)
- Monthly Returns Heatmap
- Trade Log Table

---

## Strategy Engine (15 Built-In Indicators)

| Indicator | Category | Outputs |
|-----------|----------|---------|
| RSI | Momentum | rsi |
| MACD | Momentum | macd, macd_signal, macd_hist |
| Bollinger Bands | Volatility | bb_upper, bb_mid, bb_lower, bb_pct_b |
| EMA | Trend | ema |
| SMA | Trend | sma |
| Stochastic | Momentum | stoch_k, stoch_d |
| ATR | Volatility | atr |
| ADX | Trend | adx, plus_di, minus_di |
| VWAP | Volume | vwap |
| OBV | Volume | obv |
| CCI | Momentum | cci |
| Williams %R | Momentum | willr |
| Ichimoku | Trend | tenkan, kijun, senkou_a, senkou_b, chikou |
| Supertrend | Trend | supertrend, supertrend_dir |
| Parabolic SAR | Trend | psar, psar_dir |

Available via: API (`GET /api/indicators`), Code Editor (`ind.rsi()`, `ind.macd()`, etc.), Visual Builder (dropdown selection).

---

## API Reference

### Dashboard & Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check (pipeline status, cache state) |
| `GET` | `/momentum_data.json` | Full dashboard data (ETag support, Redis → memory → file fallback) |
| `GET` | `/api/signals` | Segmented signals table only |
| `GET` | `/api/summary` | Segmented summary statistics only |
| `GET` | `/api/charts/{ticker}` | Per-ticker chart data (individually cached) |
| `GET` | `/api/derived` | Derived signal lists (hidden gems, clusters, etc.) |
| `GET` | `/api/screen` | Run full screener pipeline, return JSON |

### Signal Intelligence

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/insider-buys` | Insider buying scanner results (scored, sorted) |
| `GET` | `/api/weekly-top-momentum` | Weekly momentum leaders |
| `GET` | `/api/db/signals` | Filtered signal query from DB (sector, probability, sort) |
| `GET` | `/api/db/signal/{ticker}` | Single ticker with full 4-system breakdown |

### ML Prediction

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/predict/hybrid/{ticker}` | Hybrid prediction: instant legacy scores + async XGBoost inference |
| `GET` | `/api/stream-debate/{job_id}` | SSE stream for ML pipeline progress (step-by-step updates) |

### Portfolio Intelligence

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/portfolio/analyze` | Portfolio X-Ray: holdings → sector exposure, risk, rotation suggestions |

### Pipeline Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/pipeline/status` | Current state, wave info, schedule |
| `POST` | `/api/pipeline/trigger` | Manually trigger full pipeline refresh |
| `GET` | `/api/pipeline/schedule` | Auto-refresh schedule configuration |
| `WS` | `/ws/pipeline` | WebSocket real-time pipeline status push |

### Backtesting

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/backtest` | Run 4-system backtest |
| `POST` | `/api/backtest/cancel` | Cancel running backtest |
| `GET` | `/api/backtest/history` | List saved backtests |
| `GET` | `/api/backtest/{id}` | Load saved backtest by ID |
| `POST` | `/api/compare` | Compare individual systems vs ensemble |

### Strategy Engine

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/indicators` | Catalog of all 15 indicators |
| `POST` | `/api/strategy/backtest` | Run visual strategy backtest |
| `POST` | `/api/strategy/code` | Run Python code strategy |
| `POST` | `/api/strategy/save` | Save/update a strategy |
| `GET` | `/api/strategy/list` | List saved strategies |
| `GET` | `/api/strategy/{id}` | Load a saved strategy |
| `POST` | `/api/strategy/{id}/delete` | Delete a strategy |
| `POST` | `/api/strategy/compare` | Compare multiple strategies |

### Ticker Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ticker/search` | Search tickers (DB + yfinance) |
| `POST` | `/api/ticker/add` | Add ticker(s) to universe + fetch data |

### Infrastructure

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/data/status` | DB statistics (rows, tickers, date range, size) |
| `GET` | `/api/data/sync` | Trigger data sync from yfinance |
| `GET` | `/api/cache/stats` | Cache backend diagnostics |
| `GET` | `/api/receipts` | Formatted receipts ledger |
| `POST` | `/api/webhook/register` | Register webhook URL for pipeline events |
| `POST` | `/api/webhook/unregister` | Remove registered webhook |

---

## Data Architecture

### Redis Caching Layer (`redis_cache.py`)

Segmented cache design — avoids deserializing the full 10MB+ dashboard payload:

| Key | TTL | Purpose |
|-----|-----|---------|
| `momentum:dashboard` | 5 min | Full dashboard JSON |
| `momentum:signals` | 5 min | Signals table only |
| `momentum:summary` | 5 min | Summary statistics only |
| `momentum:derived` | 5 min | Derived signal lists |
| `momentum:chart:{ticker}` | 10 min | Per-ticker chart data |
| `momentum:pipeline:status` | 1 min | Pipeline state |
| `momentum:dashboard:version` | — | ETag version for conditional responses |

**Read priority chain**: Redis → In-memory dict → `momentum_data.json` file → 202 (pipeline not ready)

### Pydantic Data Validation (`validators.py`)

7-check validation pipeline:
1. **NaN detection** — drops rows exceeding 5% NaN ratio
2. **Negative/zero prices** — removes impossible values
3. **High < Low swap** — auto-corrects inverted H/L
4. **Zero volume filtering** — flags days with no trading
5. **Split anomaly detection** — flags >50% price gaps
6. **Minimum rows check** — rejects tickers with <50 days
7. **Date continuity** — flags gaps >5 calendar days

### Progressive Pipeline (`engine.py`)

3-wave rendering for instant dashboard availability:

| Wave | Tickers | Expected Time |
|------|---------|--------------|
| **Wave 1** | ~50 priority tickers (AAPL, NVDA, MSFT, etc.) | ~15–30s |
| **Wave 2** | Remaining S&P 500 (~450 tickers) | ~2–3 min |
| **Wave 3** | Full universe (~1,000+ remaining) + yield data | ~5 min |

Each wave publishes partial results to Redis + in-memory cache → frontend renders immediately.

---

## Configuration

### `momentum_config.py` — Universe & Indicator Parameters

- **1,500+ tickers** across 11 GICS sectors (S&P 500 + NASDAQ 100 + ETFs)
- **Leveraged ETF mapping** per sector (bull ETF, bear ETF, leverage factor)
- **High-yield ETF list** and **high-dividend stock list** for income screening
- **AI stock universe** (curated AI/semiconductor/cloud tickers)
- **Indicator parameters**: ADX (14, strong=25), TRIX (14/9), Stochastics (14/3/3, OB=80, OS=20), Elder (EMA=13, MACD 12/26/9), Renko ATR (14), HMA (20)
- **Scoring thresholds**: Strong Bull=1.5, Bull=0.5, Bear=-0.5, Strong Bear=-1.5
- **30 curated quotes** from finance legends (Buffett, Simons, Taleb, Graham, Lynch)

### `config.py` — Quant Parameters

- **Universe constraints**: Price $5–$50, exchanges NYSE/NASDAQ/TSX
- **Fractional differencing**: d range 0.05–0.95, ADF p-value target 0.05
- **Rolling windows**: Z-Score=20, Volatility=20, Beta=60, Hurst=126, ADV=20, HMM=252
- **Signal thresholds**: |Z| > 2.5, Hurst mean-rev < 0.40, trending > 0.60
- **Risk gates**: Liquidity floor $10M ADV, market cap floor $300M, kurtosis ceiling 10.0

---

## Tech Stack & Dependencies

| Component | Technology |
|-----------|-----------|
| **Backend** | Python 3.11+ · FastAPI v3 · uvicorn · orjson |
| **Frontend** | Next.js 16 · TypeScript · Tailwind CSS v4 |
| **UI Components** | shadcn/ui · Framer Motion · TradingView Lightweight Charts |
| **Design System** | Carbon Terminal (F1/Bloomberg) · Monochrome · JetBrains Mono |
| **Database** | SQLite (single file, WAL mode) |
| **Cache** | Redis (optional — falls back to in-memory) |
| **ML** | XGBoost · scikit-learn · scipy |
| **Async Tasks** | Celery + Redis broker |
| **Data Source** | yfinance (market data + insider transactions) |
| **Testing** | pytest (89 tests) · frozen OHLCV fixtures |
| **Fonts** | Google Fonts — Inter + JetBrains Mono |
| **Deployment** | Railway · Docker · Render |

### Backend Python Dependencies

| Package | Purpose |
|---------|--------|
| `fastapi` + `uvicorn` | REST API server |
| `yfinance` | Market data + insider transaction fetching |
| `pandas` + `numpy` | DataFrames & numerical computation |
| `scipy` + `scikit-learn` | Statistical functions + ML preprocessing |
| `xgboost` | Gradient boosted tree predictions |
| `celery` + `redis` | Async ML task queue |
| `orjson` | Fast JSON serialization (3–5x) |
| `pydantic` | Data validation |
| `pytest` + `httpx` | Test suite |

### Frontend Node Dependencies

| Package | Purpose |
|---------|--------|
| `next` (v16) | React framework (App Router) |
| `framer-motion` | Spring-physics animations |
| `lightweight-charts` | TradingView charting |
| `tailwindcss` (v4) | Utility-first CSS |
| `@tanstack/react-virtual` | Virtualized tables (500+ rows) |

---

## Research Papers & References

This section documents the academic research underpinning every quantitative method implemented in HEADSTART. These links are designed for ingestion into **NotebookLLM** and similar research tools for deeper study.

### Momentum & Technical Analysis

| Paper | Authors | Year | Relevance to HEADSTART |
|-------|---------|------|-----------------------|
| [Returns to Buying Winners and Selling Losers](https://doi.org/10.1111/j.1540-6261.1993.tb04702.x) | Jegadeesh & Titman | 1993 | Foundation for cross-sectional momentum — our 4-system ensemble is built on this thesis |
| [Momentum Strategies](https://doi.org/10.1111/0022-1082.00349) | Chan, Jegadeesh & Lakonishok | 1996 | Earnings momentum vs price momentum decomposition |
| [Price Momentum and Trading Volume](https://doi.org/10.1111/0022-1082.00280) | Lee & Swaminathan | 2000 | Volume-momentum interaction — basis for our "Smart Money Accumulation" screener |
| [The 52-Week High and Momentum Investing](https://doi.org/10.1111/j.1540-6261.2004.00695.x) | George & Hwang | 2004 | Anchor-based momentum that explains return predictability |
| [Momentum Crashes](https://doi.org/10.1016/j.jfineco.2015.12.002) | Daniel & Moskowitz | 2016 | Momentum crash risk and regime-dependent performance — our regime classification addresses this |
| [Time Series Momentum](https://doi.org/10.1016/j.jfineco.2011.11.003) | Moskowitz, Ooi & Pedersen | 2012 | Time-series vs cross-sectional momentum — relevant to our per-ticker composite scores |
| [Fact, Fiction, and Momentum Investing](https://doi.org/10.3905/jpm.2014.40.5.075) | Asness, Frazzini & Pedersen | 2014 | Clearing up common misconceptions about momentum |

### Regime Classification & Market States

| Paper | Authors | Year | Relevance to HEADSTART |
|-------|---------|------|-----------------------|
| [New Concepts in Technical Trading Systems](https://archive.org/details/newconceptsintec00wild) | Welles Wilder Jr. | 1978 | Original ADX paper — basis for our Trending/Mean-Reverting/Choppy regime classification |
| [Regime Switching Models](https://doi.org/10.1002/jae.764) | Hamilton | 2005 | HMM regime detection theory — config.py HMM window parameter foundation |
| [Detecting Mean Reversion in Financial Markets](https://doi.org/10.1016/S0927-5398(98)00011-8) | Bali & Demirtas | 2008 | Statistical tests for mean-reversion detection used in regime classification |

### Machine Learning in Finance

| Paper | Authors | Year | Relevance to HEADSTART |
|-------|---------|------|-----------------------|
| [Advances in Financial Machine Learning](https://www.wiley.com/en-us/Advances+in+Financial+Machine+Learning-p-9781119482109) | Marcos López de Prado | 2018 | **Primary ML reference** — Purged K-Fold, fractional differencing, triple barrier, feature importance |
| [XGBoost: A Scalable Tree Boosting System](https://doi.org/10.1145/2939672.2939785) | Chen & Guestrin | 2016 | XGBoost algorithm — our ML predictor |
| [Fractional Differencing — Balancing Memory and Stationarity](https://doi.org/10.2139/ssrn.3104816) | López de Prado | 2018 | Fractional differencing (d=0.4) — retains long-memory while achieving stationarity |
| [The Dangers of Overfitting in Financial ML](https://doi.org/10.1080/14697688.2015.1070960) | Bailey, Borwein, López de Prado & Zhu | 2015 | Why purged cross-validation is essential — standard k-fold leaks information |
| [Cross-Validation in Finance: Problems and Solutions](https://doi.org/10.2139/ssrn.3257420) | de Prado & Lewis | 2018 | Detailed treatment of purged k-fold with embargo — exact method in `train_model.py` |

### Feature Engineering

| Paper | Authors | Year | Relevance to HEADSTART |
|-------|---------|------|-----------------------|
| [Gaussian Rank Transformation](https://doi.org/10.1016/j.csda.2009.09.005) | Conover & Iman | 1981 | Rank-based normalization — our cross-sectional Gaussian rank in `features.py` |
| [Fractionally Differenced ARFIMA Models](https://doi.org/10.1111/j.1467-9892.1980.tb00297.x) | Granger & Joyeux | 1980 | Original ARFIMA / fractional integration theory |
| [Long Memory in Stock Market Returns](https://doi.org/10.1016/0304-405X(93)90023-5) | Lo | 1991 | Evidence for long-memory in financial time series — motivation for FFD |

### Position Sizing & Risk Management

| Paper | Authors | Year | Relevance to HEADSTART |
|-------|---------|------|-----------------------|
| [A New Interpretation of Information Rate](https://doi.org/10.1002/j.1538-7305.1956.tb03809.x) | Kelly | 1956 | Kelly Criterion — our Half-Kelly position sizing |
| [The Kelly Criterion in Practice](https://doi.org/10.3905/jpm.2007.681826) | Thorp | 2006 | Practical Kelly including Half-Kelly and risk budget — our implementation |
| [Optimal Position Sizing for Momentum Strategies](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3425736) | Clenow | 2019 | ATR-normalized sizing similar to our NATR-20 volatility adjustment |

### Event Studies & Abnormal Returns

| Paper | Authors | Year | Relevance to HEADSTART |
|-------|---------|------|-----------------------|
| [Event Studies in Economics and Finance](https://doi.org/10.1257/jel.35.1.13) | MacKinlay | 1997 | Standard event study methodology — basis for our CAR analysis in `event_study.py` |
| [Using Daily Stock Returns in Event Studies](https://doi.org/10.1016/0304-405X(85)90042-X) | Brown & Warner | 1985 | Daily return event study design — estimation + event window approach |

### Insider Trading Signals

| Paper | Authors | Year | Relevance to HEADSTART |
|-------|---------|------|-----------------------|
| [Insider Trading, Earnings Quality, and Accrual Mispricing](https://doi.org/10.2308/accr.2005.80.4.1131) | Beneish & Vargus | 2002 | Insider trade informativeness — basis for our seniority-weighted scoring |
| [Are Insider Trades Informative?](https://doi.org/10.1093/rfs/hhn054) | Cohen, Malloy & Pomorski | 2012 | "Routine" vs "opportunistic" insider trades — supports filtering by transaction type |
| [Aggregate Insider Trading and Market Returns](https://doi.org/10.2307/j.ctt7t0n6) | Seyhun | 1998 | Comprehensive study on insider trading predictive power |

### Backtesting Methodology

| Paper | Authors | Year | Relevance to HEADSTART |
|-------|---------|------|-----------------------|
| [Backtesting](https://doi.org/10.3905/jpm.2019.1.092) | Harvey & Liu | 2015 | False discovery rate in backtesting — why robust methodology matters |
| [The Probability of Backtest Overfitting](https://doi.org/10.1515/jtse-2013-0010) | Bailey, Borwein, López de Prado & Zhu | 2017 | Combinatorial purged cross-validation for strategy testing |
| [Monte Carlo Methods in Financial Engineering](https://doi.org/10.1007/978-0-387-21617-1) | Glasserman | 2003 | Monte Carlo simulation theory — our 500-sim forward P&L projections |

### Sector Rotation & Factor Investing

| Paper | Authors | Year | Relevance to HEADSTART |
|-------|---------|------|-----------------------|
| [Industry Momentum](https://doi.org/10.1111/0022-1082.00146) | Moskowitz & Grinblatt | 1999 | Sector-level momentum — basis for our sector rotation signals |
| [Value and Momentum Everywhere](https://doi.org/10.1111/jofi.12021) | Asness, Moskowitz & Pedersen | 2013 | Value-momentum interaction across asset classes |

### Additional Resources for NotebookLLM

**Books** (recommended for deep dives):
- López de Prado, M. (2018). *[Advances in Financial Machine Learning](https://www.wiley.com/en-us/Advances+in+Financial+Machine+Learning-p-9781119482109)*. Wiley. — **Essential** for Purged K-Fold, FFD, triple barrier method
- Jansen, S. (2020). *[Machine Learning for Algorithmic Trading](https://www.packtpub.com/product/machine-learning-for-algorithmic-trading-second-edition/9781839217715)*. Packt. — Feature engineering, XGBoost for alpha signals
- Chan, E. (2013). *[Algorithmic Trading](https://www.wiley.com/en-us/Algorithmic+Trading%3A+Winning+Strategies+and+Their+Rationale-p-9781118460146)*. Wiley. — Mean-reversion vs momentum strategy selection by regime
- Clenow, A. (2015). *[Stocks on the Move](https://www.followingthetrend.com/stocks-on-the-move/)*. — Practical momentum screening methodology
- Narang, R. (2013). *[Inside the Black Box](https://www.wiley.com/en-us/Inside+the+Black+Box%3A+A+Simple+Guide+to+Quantitative+and+High+Frequency+Trading%2C+2nd+Edition-p-9781118362419)*. Wiley. — Systematic trading system architecture

**Online Courses**:
- [Computational Investing (Georgia Tech)](https://www.coursera.org/learn/computational-investing) — Factor models, alpha signal construction
- [Machine Learning for Trading (Georgia Tech)](https://www.udacity.com/course/machine-learning-for-trading--ud501) — ML in portfolio management
- [Quantitative Finance & Algorithmic Trading (WorldQuant)](https://www.worldquant.com/mscfe/) — Professional quant finance curriculum

**Data Sources**:
- [yfinance Python library](https://github.com/ranaroussi/yfinance) — Our primary market data source
- [SEC EDGAR](https://www.sec.gov/edgar) — Insider transaction filings (Form 4)
- [FRED (Federal Reserve Economic Data)](https://fred.stlouisfed.org/) — Macro data for regime analysis

## Roadmap / Future Updates

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 5 | **Multi-Agent LLM Debate** — Triage Gate triggers bull/bear/devil's advocate debate | Planned |
| Phase 6 | **Vector DB Integration** — pgvector for chart pattern similarity and strategy pattern search | Planned |
| — | **Earnings Growers** — 5 consecutive quarters of revenue + EBITDA growth screening | Planned |
| — | **Full Universe ML** — Expand XGBoost to full 1,500+ ticker universe (currently sandbox) | Planned |
| — | **React Native App** — All hooks marked "RN Safe" for mobile port | Planned |

---

## License

This project is for educational and personal use.

---

> *"We look for patterns. We look for ways to reduce risk. We don't predict markets. We just look for slightly wrong prices."* — **Jim Simons**
