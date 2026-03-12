# HEADSTART — Quantitative Momentum Research Platform

> **4-System Momentum Analysis · SQLite-Backed · Real-Time Screener · Strategy Builder & Backtester**

A full-stack quantitative momentum research platform that screens **1,500+ US equities** (S&P 1500: S&P 500 + S&P MidCap 400 + S&P SmallCap 600, plus 30 ETFs) across **11 GICS sectors** using four proprietary technical indicator systems, classifies market regimes, generates actionable trade strategies (leveraged ETFs & options), and includes a comprehensive backtesting engine with a visual strategy builder.

**Architecture**: Next.js 16 frontend (TypeScript, Tailwind CSS, Framer Motion) + FastAPI backend (Python 3.11+) + SQLite (WAL mode, per-indicator tables).

---

## Quantitative Research Methodology

HEADSTART is built on the thesis that **no single technical indicator is reliable in isolation** — but a multi-system ensemble, weighted by regime context, produces statistically significant alpha signals. Our research combines momentum, mean-reversion, and volatility analysis across four independent indicator systems.

### The Ensemble Approach

Each ticker in the S&P 1500 universe is scored independently by four systems that capture different facets of price momentum:

| System | Indicators | What It Captures |
|--------|-----------|-----------------|
| **System 1** | ADX + TRIX + Full Stochastics | Trend strength × momentum direction × mean-reversion timing |
| **System 2** | Elder Impulse (EMA-13 + MACD-Hist) | Institutional buying/selling pressure via consecutive impulse bars |
| **System 3** | Renko (ATR-based) + Full Stochastics | Noise-filtered trend via brick aggregation + oscillator timing |
| **System 4** | Heikin-Ashi + Hull Moving Average | Smoothed candle trend quality (wick analysis) + low-lag MA direction |

Each system produces a score from **-2 to +2**. The composite score is the arithmetic mean of all four, giving equal weight to trend (S1), impulse (S2), structure (S3), and smoothed momentum (S4).

### Regime Classification

Market regime determines **which strategies work**. Momentum strategies excel in trending markets but fail in choppy ones. We classify each ticker into:

- **Trending** (ADX ≥ 25): Momentum strategies have the highest edge
- **Mean-Reverting** (ADX 15–25, Stochastics 30–70): Oscillator-based contrarian plays
- **Choppy** (ADX < 15): Reduced position sizing, wider stops

### Probability Engine

Signal confidence (0–98%) isn't just composite magnitude — it factors in **directional agreement** across all 4 systems. When systems unanimously agree on direction, probability gets a 1.2x multiplier. This penalises ambiguous signals where systems disagree.

### Persisted Indicator Database (v2)

All computed indicators are persisted to SQLite in **5 separate tables** for fast querying:

```
signals            → 25-column flat table (price, composite, probability, regime, sector)
indicator_system1  → ADX, TRIX, Stochastics per ticker
indicator_system2  → Elder Impulse colors, MACD histogram
indicator_system3  → Renko brick direction, brick size, Stochastics
indicator_system4  → Heikin-Ashi trend, wick quality, HMA direction
```

This enables fast filtered queries (e.g., all Technology tickers with probability > 90%) and eliminates the need to recompute 1,500 tickers from scratch on every restart.

### Thematic Screeners & Research Lists

Beyond the core 10 momentum screeners, we generate thematic research lists:

- **Momentum 95+**: Stocks with signal probability ≥ 95% — the highest-conviction picks
- **AI Stocks**: Curated universe of AI/semiconductor/cloud tickers with momentum overlay
- **Bullish Momentum**: Positive composite + positive regime + relaxed probability filters
- **High Volume Gappers**: Unusual volume + significant daily price change
- **Earnings Growers**: Fundamental overlay (planned: 5 consecutive quarters of revenue + EBITDA growth)

### API-First Architecture

All research data is accessible via typed REST endpoints:

```bash
# Filtered signal query from DB
GET /api/db/signals?sector=Technology&min_probability=95&order_by=composite%20DESC

# Single ticker with full 4-system breakdown
GET /api/db/signal/NVDA

# Derived screener lists (momentum_95, ai_stocks, etc.)
GET /api/derived
```

---

## Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Pages & UI](#pages--ui)
  - [Command Center (index.html)](#1-command-center--indexhtml)
  - [Intelligence Dashboard (momentum\_dashboard.html)](#2-intelligence-dashboard--momentum_dashboardhtml)
  - [Receipts Ledger (receipts.html)](#3-receipts-ledger--receiptshtml)
- [Features (Detailed Breakdown)](#features-detailed-breakdown)
- [The 4 Indicator Systems](#the-4-indicator-systems)
- [Signal Screeners](#signal-screeners)
- [Backtesting Engine](#backtesting-engine)
- [Strategy Engine (15 Indicators)](#strategy-engine-15-built-in-indicators)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Configuration](#configuration)
- [Tech Stack & Dependencies](#tech-stack--dependencies)

---

## Developer Quickstart

> **For AI agents / new developers**: This section tells you everything you need to run the entire stack locally in under 5 minutes. Read this first.

### Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Python | 3.11+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| pip | Latest | `pip --version` |
| Git | Any | `git --version` |

**Optional**: Redis (falls back to in-memory dict if unavailable)

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

**What happens on first run**: The backend fetches ~507 tickers from yfinance (takes ~60s). Subsequent runs load instantly from the SQLite cache at `backend/pipelines/quant_screener.db`.

**Verify**: Open `http://localhost:8060/docs` → you should see the Swagger API explorer.

### Step 3: Start the Frontend (Next.js — Port 3000)

```bash
# In a NEW terminal
cd frontend

npm install       # First time only
npm run dev       # Starts dev server on http://localhost:3000
```

**Verify**: Open `http://localhost:3000` → you should see the Command Center.

### Step 4: Run Tests

```bash
cd backend
source venv/bin/activate
python -m pytest tests/ -v        # 89 tests, ~15s
```

### Access Points

| Page | URL | Description |
|------|-----|-------------|
| Command Center | `http://localhost:3000/` | Landing page with KPIs, sector heatmap, signal feed |
| Intelligence Dashboard | `http://localhost:3000/dashboard` | Full screener with 11 sidebar pages |
| Receipts Ledger | `http://localhost:3000/receipts` | Backtest performance tracking |
| API Explorer (Swagger) | `http://localhost:8060/docs` | Interactive API documentation |

### Environment Variables

Create `.env.local` in `frontend/` if you need to override defaults:

```bash
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8060    # Backend API base URL (default)

# Backend (shell env or .env)
PORT=8060                                    # API server port
DATA_DIR=backend/pipelines/                  # SQLite database directory
```

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Backend won't start | Ensure Python 3.11+, check `pip install -r requirements.txt` succeeded |
| Frontend "fetch failed" | Ensure backend is running on port 8060 first |
| "No data available" on charts | Wait ~60s for initial yfinance data fetch to complete |
| `quant_screener.db` missing | Normal on first run — auto-created by the backend pipeline |
| Redis connection errors | Safe to ignore — falls back to in-memory cache automatically |
| Port already in use | Kill existing process: `lsof -ti:8060 \| xargs kill` or `lsof -ti:3000 \| xargs kill` |

### Cloud Deployment

The project includes a `legacy/render.yaml` for Render.com deployment:
- Backend binds to `0.0.0.0` when `RENDER` env var is set
- SQLite DB is auto-copied to persistent disk on first deploy
- Set `NEXT_PUBLIC_API_URL` to your deployed backend URL for the frontend

---

## Project Structure

```
quant_screener/
├── backend/
│   ├── main.py                    # FastAPI server (22 REST endpoints, CORS, caching)
│   ├── requirements.txt           # Python dependencies (FastAPI, uvicorn, etc.)
│   ├── pipelines/
│   │   ├── momentum_indicators.py # 4 indicator systems (ADX/TRIX/Stoch, Elder, Renko, HA/HMA)
│   │   ├── momentum_screener.py   # Signal combination, regime & sentiment engine
│   │   ├── momentum_config.py     # Universe (~120 legacy tickers), indicator params, quotes
│   │   ├── universe.py            # S&P 500 + NASDAQ 100 merged universe (507 tickers)
│   │   ├── momentum_data.py       # Data fetcher via yfinance + SQLite sync
│   │   ├── momentum_strategies.py # Actionable trade strategy generator (ETF + options)
│   │   ├── backtester.py          # Vectorized backtesting engine + Monte Carlo projection
│   │   ├── strategy_engine.py     # 15 built-in indicators + visual/code strategy engine
│   │   ├── db.py                  # SQLite database layer (schema, CRUD, migrations)
│   │   ├── config.py              # Quant parameters (fractional diff, HMM, etc.)
│   │   ├── signals.py             # Signal analysis helpers
│   │   ├── risk.py                # Risk management utilities
│   │   ├── data_preprocessing.py  # Data preprocessing utilities
│   │   ├── quant_screener.db      # SQLite database (auto-generated)
│   │   └── momentum_data.json     # Cached pipeline output (auto-generated)
│   └── tests/
│       ├── conftest.py            # Pytest fixtures (frozen OHLCV data)
│       ├── test_indicators.py     # Math verification for all 4 indicator systems (22 tests)
│       ├── test_screener.py       # Regime, sentiment, probability tests (17 tests)
│       ├── test_backtester.py     # Equity curve, metrics, determinism tests (17 tests)
│       ├── test_api.py            # FastAPI endpoint smoke tests (11 tests)
│       └── fixtures/
│           └── aapl_200d.csv      # Frozen 200-day AAPL OHLCV for deterministic tests
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Command Center (Apple-style Bento Grid)
│   │   │   ├── dashboard/page.tsx # Intelligence Dashboard (11 sidebar pages)
│   │   │   ├── receipts/page.tsx  # Receipts Ledger
│   │   │   ├── layout.tsx         # Root layout (Inter + JetBrains Mono)
│   │   │   └── globals.css        # Apple design system (glassmorphism, shadows, bento)
│   │   ├── components/
│   │   │   ├── ui/                # Reusable primitives (AppleCard, AppleButton, shadcn)
│   │   │   ├── layout/            # TopNav, app-sidebar
│   │   │   ├── momentum/          # Domain components (ScreenerTable, Leaderboard, etc.)
│   │   │   └── charts/            # TradingView-powered charts (price, equity, indicator)
│   │   ├── hooks/                 # useSignals, useStrategy, useSectors
│   │   ├── services/api.ts        # API client (all backend endpoints)
│   │   ├── types/momentum.ts      # TypeScript types (Signal, DashboardData)
│   │   └── lib/                   # Constants, utilities
│   ├── package.json
│   └── next.config.ts
│
├── legacy/                        # Original vanilla JS/HTML (reference only)
│   ├── momentum_dashboard.py      # Legacy HTTP server
│   ├── momentum_dashboard.html    # Legacy dashboard UI
│   ├── index.html                 # Legacy Command Center
│   └── receipts.html              # Legacy Receipts
│
└── README.md
```

---

## Frontend Component Architecture

> **For AI agents**: This section maps every file in `frontend/src/` with its purpose, props, and dependencies. Use this to understand where to make changes.

### Design System

| Token | Value | Usage |
|-------|-------|-------|
| **Fonts** | Inter (sans), JetBrains Mono (mono) | Headings / Data |
| **Theme** | True Black (`#000`) with `white/[0.03-0.06]` overlays | Glassmorphism |
| **Border radius** | `rounded-xl` (cards), `rounded-2xl` (modals) | Apple aesthetic |
| **Shadows** | CSS custom properties (`--shadow-soft`, `--shadow-elevated`) | Depth layers |
| **Colors** | Palette keys: `cyan`, `emerald`, `rose`, `amber`, `violet` | Via `getTextColorClass()` / `getBackgroundColorClass()` from `lib/utils.ts` |
| **Z-index** | `Z_INDEX` object in `lib/constants.ts` (10-100 range) | Layered UI |
| **Icons** | `lucide-react` via `SFIcon.tsx` — **zero emojis** | 45 icon mappings |

### Pages (`src/app/`)

| File | Route | Type | Description |
|------|-------|------|-------------|
| `layout.tsx` | Global | Server | Root layout — Inter + JetBrains Mono fonts, global CSS |
| `page.tsx` | `/` | Client | **Command Center** — KPI strip, Main Character hero, sector heatmap, signal feed, rotating quotes |
| `dashboard/layout.tsx` | `/dashboard` | Server | Dashboard metadata (SEO title/description), wraps the client page |
| `dashboard/page.tsx` | `/dashboard` | Client | **Intelligence Dashboard** — sidebar + 11 sub-pages (screeners, charts, backtest) |
| `receipts/page.tsx` | `/receipts` | Client | **Receipts Ledger** — backtest performance history, win/loss tracking |
| `globals.css` | — | CSS | Full Apple design system: glassmorphism tokens, skeleton animations, bento grid, scrollbar styling |

### UI Components (`src/components/ui/`)

| Component | File | Key Props | Description |
|-----------|------|-----------|-------------|
| **SFIcon** | `SFIcon.tsx` | `name`, `size`, `className` | Central icon system. Maps SF Symbol names → `lucide-react` SVGs. All icons flow through here |
| **BentoCard** | `bento-card.tsx` | `span`, `rowSpan`, `interactive`, `glowColor` | Glassmorphic card with CSS Grid span, hover lift, press scale, keyboard a11y |
| **DataTable** | `data-table.tsx` | `data`, `columns`, `selectedKey`, `onRowClick` | Virtualized (500+ rows) via `@tanstack/react-virtual`. Sortable, sticky header |
| **AppleCard** | `apple-card.tsx` | `className`, `glowColor`, `whileHover` | Framer Motion card with glassmorphic backdrop |
| **AppleButton** | `apple-button.tsx` | `variant`, `size` | Premium button with gradient, glow, spring hover |

### Domain Components (`src/components/momentum/`)

| Component | File | Data Source | Description |
|-----------|------|-------------|-------------|
| **ScreenerTable** | `screener-table.tsx` | `Signal[]` | Full signal table with tier dividers (High/Med/Developing conviction) |
| **SignalTable** | `signal-table.tsx` | `Signal[]` | Compact signal list for screener pages |
| **Leaderboard** | `leaderboard.tsx` | `Signal[]` | Top tickers ranked by composite score |
| **TickerModal** | `ticker-modal.tsx` | `Signal` | Full detail modal: 4-system breakdown, alerts, score calculation |
| **TickerSearch** | `ticker-search.tsx` | API | Search local DB + yfinance, auto-add tickers |
| **SectorHeatmap** | `sector-heatmap.tsx` | `SectorSummary[]` | 11-sector regime grid with bull/bear bars |
| **StrategyBuilder** | `strategy-builder.tsx` | API | Visual condition builder + code editor + 4-system backtester |
| **BacktestResults** | `backtest-results.tsx` | `BacktestResult` | Metrics grid, equity chart, monthly heatmap, trade log |
| **SentimentBadge** | `sentiment-badge.tsx` | `Sentiment` | Color-coded label (Strong Bullish → Strong Bearish) |
| **RegimeBadge** | `regime-badge.tsx` | `Regime` | Regime label (Trending / Mean-Reverting / Choppy) |
| **KPIStrip** | `kpi-strip.tsx` | `DashboardData` | Animated counter row for key metrics |

### Chart Components (`src/components/charts/`)

All charts use **TradingView Lightweight Charts** with dark theme integration.

| Component | File | Description |
|-----------|------|-------------|
| **PriceChart** | `price-chart.tsx` | Candlestick + HMA overlay |
| **IndicatorChart** | `indicator-chart.tsx` | Multi-line chart for ADX, Stochastics, TRIX |
| **ElderChart** | `elder-chart.tsx` | MACD histogram with Elder Impulse coloring |
| **EquityChart** | `equity-chart.tsx` | Equity curve for backtest results |

### Custom Hooks (`src/hooks/`)

All hooks marked "RN Safe" contain no DOM logic and are portable to React Native.

| Hook | File | RN Safe | Description |
|------|------|---------|-------------|
| `useSignals` | `use-signals.ts` | Yes | Fetches + caches dashboard signals from API |
| `useSectors` | `use-sectors.ts` | Yes | Sector summary data with regime info |
| `useBacktest` | `use-backtest.ts` | Yes | Backtest execution, cancellation, history |
| `useStrategy` | `use-strategy.ts` | Yes | Strategy save/load/delete/execute |
| `useDataTable` | `use-data-table.ts` | Yes | Generic sort state + sorted data output |
| `useMediaQuery` | `use-media-query.ts` | No | Responsive breakpoint detection (DOM) |

### Services & Types

| File | Purpose |
|------|---------|
| `services/api.ts` | Typed API client — wraps all 22 backend endpoints. Uses `fetch` with `NEXT_PUBLIC_API_URL` |
| `types/momentum.ts` | Core TypeScript interfaces: `Signal`, `DashboardData`, `BacktestResult`, `Strategy`, `SectorSummary`, branded primitives (`Ticker`, `Composite`) |
| `lib/constants.ts` | Design tokens (`COLORS`, `Z_INDEX`, `SHADOW_*`), `SIDEBAR_NAV`, `SF_SYMBOLS` map, spring configs |
| `lib/utils.ts` | `cn()` class merger, `getTextColorClass()`, `getBackgroundColorClass()`, color helpers |

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
│  momentum_indicators.py              │
│   → System 1: ADX + TRIX + Stoch    │
│   → System 2: Elder Impulse         │
│   → System 3: Renko + Stochastic    │
│   → System 4: Heikin-Ashi + HMA     │
│                    ↓                 │
│  momentum_screener.py                │
│   → Composite scoring (mean of 4)   │
│   → Regime classification           │
│   → Sentiment labeling              │
│   → Probability calculation          │
│   → Advanced signals (shock, smart   │
│     money, continuation, gamma)      │
│                    ↓                 │
│  momentum_strategies.py              │
│   → Leveraged ETF recommendations   │
│   → Options strategy generation      │
│   → Entry/stop/target levels         │
│                    ↓                 │
│  universe.py                         │
│   → S&P 500 + NASDAQ 100 (507)      │
│   → Deduplication + sector mapping   │
└───────────────────┬──────────────────┘
                    │
┌──────────[API LAYER]─────────────────┐
│  FastAPI (main.py, port 8060)        │
│   → 22 REST API endpoints           │
│   → CORS enabled for Next.js        │
│   → In-memory data cache            │
│   → Background pipeline thread      │
│   → Backtest cancellation support    │
│   → Swagger docs at /docs           │
└───────────────────┬──────────────────┘
                    │
┌──────────[FRONTEND LAYER]────────────┐
│  Next.js 16 (TypeScript, port 3000)  │
│   /           (Command Center)       │
│   /dashboard  (Intelligence)         │
│   /receipts   (Performance)          │
│                                      │
│  Theme: Apple-style Glassmorphism    │
│  Fonts: Inter + JetBrains Mono       │
│  Charts: TradingView Lightweight     │
│  Animations: Framer Motion           │
└──────────────────────────────────────┘
                    │
┌──────────[TEST LAYER]────────────────┐
│  pytest (89 tests, 15s)              │
│   → Indicator math verification      │
│   → Regime/sentiment/probability    │
│   → Backtester equity curves         │
│   → API endpoint smoke tests         │
│   → Frozen OHLCV fixture (no drift) │
└──────────────────────────────────────┘
```

---

## Pages & UI

### 1. Command Center — `index.html`

The landing page and entry point of the platform.

```json
{
  "page": "Command Center",
  "route": "/index.html",
  "purpose": "Executive overview and navigation hub",
  "theme": "Cyberpunk Dark with animated radial gradient background + grid overlay",
  "fonts": ["Inter (300-900)", "JetBrains Mono (400-600)"],
  "sections": {
    "top_nav": {
      "logo": "MOMENTUM — Command Center",
      "links": ["Intelligence Dashboard", "Receipts Ledger"],
      "status_badge": "Live (green pulsing dot)"
    },
    "hero": {
      "eyebrow": "4-System Momentum Analysis · SQLite-Backed · Strategy Backtesting",
      "headline": "Your Alpha Edge Starts Here",
      "subtitle": "Real-time momentum screening across 400+ tickers...",
      "cta_buttons": [
        "Open Intelligence Dashboard (primary, gradient)",
        "View Receipts Ledger (ghost/outline)"
      ]
    },
    "kpi_strip": {
      "metrics": [
        "Universe Screened (cyan, animated counter)",
        "Bullish Signals (emerald)",
        "Bearish Signals (rose)",
        "Avg Confidence (amber, percentage)",
        "Top Bull Signal (ticker name, emerald)",
        "Top Bear Signal (ticker name, rose)"
      ],
      "style": "Glassmorphism cards with 1px gap separator"
    },
    "main_character": {
      "purpose": "Highlights today's #1 triple-threat signal",
      "displays": [
        "Ticker symbol (large, cyan glow)",
        "Current price",
        "Company name",
        "Sentiment badges (STRONG BULL, AURA LEVEL, FRESH MO)",
        "Stats row: Composite, Confidence, Day Change, 20-Day Return"
      ],
      "cta": ["See Full Signal →", "Fresh Momentum"]
    },
    "market_heat": {
      "purpose": "Sector-level regime heatmap",
      "card_contents": [
        "Sector name (with ∞ AURA badge for top trending)",
        "Regime label (Trending / Mean-Reverting / Choppy)",
        "Bull/Neutral/Bear sentiment bar",
        "Score and ticker count",
        "Hover CTA: View Signals →"
      ],
      "includes_whale_alert": true,
      "whale_alert_description": "Notification when a sector has strong trending + high composite (whale rotation)"
    },
    "platform_modules": {
      "cards": [
        {
          "name": "Momentum Intelligence",
          "tag": "Core",
          "color": "cyan",
          "stats": ["Bullish count", "Bearish count", "Fresh signals count"]
        },
        {
          "name": "Fresh Momentum",
          "tag": "Screener",
          "color": "emerald",
          "stats": ["Signal count", "Top pick ticker"]
        },
        {
          "name": "Sector Intelligence",
          "tag": "Intelligence",
          "color": "violet",
          "stats": ["Trending sectors count", "Aura sector name"]
        },
        {
          "name": "Receipts Ledger",
          "tag": "History",
          "color": "amber",
          "stats": ["Win rate %", "Avg return %"]
        }
      ]
    },
    "live_signal_feed": {
      "purpose": "Mini table of top 8 bullish aura picks",
      "columns": ["Ticker", "Company", "Sentiment", "Composite", "Confidence (with bar)", "Δ Day", "20D", "Price", "Sector"]
    },
    "rotating_quotes": {
      "source": "30 curated quant/finance quotes from Buffett, Simons, Taleb, etc.",
      "rotation_interval": "15 seconds"
    }
  },
  "animations": ["bgPulse (background opacity)", "pulse (status dot)", "fadeUp (sections)", "counter animation (KPIs)"],
  "responsive": "Mobile breakpoint at 768px (stacked layout)"
}
```

---

### 2. Intelligence Dashboard — `momentum_dashboard.html`

The main analysis and strategy platform — a single-page app with sidebar navigation.

```json
{
  "page": "Intelligence Dashboard",
  "route": "/momentum_dashboard.html",
  "purpose": "Full screener, analysis, charting, and backtesting platform",
  "layout": "Fixed sidebar (190px) + scrollable main content",
  "sidebar_navigation": {
    "platform": [
      "⚡ Intelligence (main screener view)",
      "🗺️ Vector Market Map (coming soon placeholder)",
      "📡 Sector Intelligence (regime analysis)",
      "📊 Ticker Detail (per-ticker charts)"
    ],
    "signal_screeners": [
      "🌱 Fresh Momentum",
      "🔥 Exhausting Momentum",
      "🌪️ Rotation Breakouts",
      "⚡ Momentum Shock Detector",
      "🎯 Gamma Squeeze Ops",
      "🐋 Smart Money Accumulation",
      "🚀 Momentum Continuation",
      "📦 Momentum Clusters",
      "💥 Sector Shock Clusters"
    ],
    "research": ["📡 Signals & Strategies"],
    "strategy": ["🧪 Strategy Builder"],
    "footer": ["Pipeline Active status", "DB size badge"]
  },
  "pages": {
    "intelligence": {
      "header": "Ticker search bar (searches DB + yfinance live) + Live status badge",
      "quote_banner": "Rotating quotes with 15s interval",
      "kpi_grid": ["Universe screened", "Bullish", "Bearish", "Avg Probability", "Top Bull", "Top Bear"],
      "momentum_leaderboard": "Top tickers sorted by composite score",
      "top_momentum_signals": "Highest probability signals",
      "fresh_momentum_widget": "Early-stage momentum plays (Stoch_K > Stoch_D, K < 70)",
      "exhausting_signals_widget": "Tickers where momentum is overbought (Stoch_K > 80)",
      "sector_regime_heatmap": "11 sectors with regime classification + bull/bear bars + AURA labels"
    },
    "sector_intelligence": {
      "hero_heatmap": "Large sector heatmap with regime + composite + probability",
      "top_trending_sectors": "Ranking of trending sectors",
      "sector_rotation_signals": "Rotation analysis"
    },
    "ticker_detail": {
      "selector": "Dropdown of all screened tickers",
      "detail_stats": ["Price", "Composite", "Probability", "S1-S4 scores", "Regime", "Δ Day", "Sector"],
      "charts": [
        "Price + Hull Moving Average (line, cyan with gradient fill)",
        "ADX + DI+ / DI- (line, 25-level reference)",
        "Full Stochastics %K/%D (line, 80/20 reference lines)",
        "Elder Impulse MACD-Histogram (bar, green/red/blue)",
        "TRIX + Signal (line + zero reference)"
      ]
    },
    "signals_and_strategies": {
      "full_signal_table": {
        "columns": ["Ticker", "Sentiment", "Composite", "Prob%", "S1", "S2", "S3", "S4", "Regime", "Price", "Δ Day", "20d", "Vol", "Sector"],
        "tiers": [
          "🟢 High Conviction (≥70%) — green divider",
          "🟡 Medium Conviction (40-70%) — amber divider",
          "⚪ Developing (<40%) — gray divider"
        ],
        "features": ["Sortable columns (click header)", "Click row → navigates to Ticker Detail"]
      },
      "strategy_cards": {
        "per_card": ["Ticker", "Sentiment badge", "Action (BUY ETF)", "Options strategy + note",
                     "Entry / Stop / Target", "R/R ratio", "ETF cost est.", "Conviction %", "Urgency level"],
        "max_displayed": 30
      }
    },
    "strategy_builder": {
      "sub_tabs": ["📊 4-System", "🔧 Strategy Builder", "💻 Code Editor", "💾 Saved Strategies"],
      "four_system_backtest": {
        "inputs": {
          "ticker": "Single ticker or blank for universe-wide",
          "initial_capital": "Starting capital ($, default 100000)",
          "holding_period": "1, 3, 5, 10, 20, or 60 days",
          "entry_threshold": "Composite score threshold (0.3 loose → 1.0 very strict)",
          "date_range": "6mo, 1y, 2y, 3y, 5y",
          "systems": "Checkboxes for S1 (ADX), S2 (Elder), S3 (Renko), S4 (HA)",
          "ensemble_k": "Off (composite) / 2-of-N / 3-of-N / 4-of-4"
        },
        "features": ["Cancel button mid-run", "Results saved to DB"]
      },
      "visual_strategy_builder": {
        "description": "Drag-and-drop style condition builder using 15 indicators",
        "inputs": {
          "ticker": "Default AAPL",
          "capital": "$100k default",
          "position_size_pct": "10% default",
          "stop_loss_pct": "Optional",
          "take_profit_pct": "Optional",
          "max_holding_days": "Optional",
          "date_range": "6mo-5y"
        },
        "conditions": {
          "entry": "All must be true (AND logic)",
          "exit": "Any triggers exit (OR logic)",
          "per_condition": {
            "left_operand": "Indicator output OR Price field",
            "operator": [">", "<", ">=", "<=", "==", "crosses_above", "crosses_below"],
            "right_operand": "Constant value OR Indicator output OR Price field"
          }
        },
        "features": ["Save strategy by name", "Load saved strategies"]
      },
      "code_editor": {
        "description": "Write Python strategy code directly in the browser",
        "available_in_sandbox": {
          "df": "OHLCV DataFrame (Open, High, Low, Close, Volume)",
          "ind": "IndicatorHelper with 15 shortcut methods",
          "pd": "pandas",
          "np": "numpy"
        },
        "user_must_set": ["entries (bool Series)", "exits (bool Series)"],
        "example": "RSI mean-reversion: entries = (rsi < 30) & (Close > sma200), exits = (rsi > 70)",
        "safety": "Blocked dangerous builtins (no file I/O, no imports, no exec)"
      },
      "backtest_results": {
        "metrics_grid": ["Total Return", "Annualised Return", "Max Drawdown", "Sharpe Ratio",
                        "Sortino Ratio", "Win Rate", "Profit Factor", "Total Trades",
                        "Best Trade", "Worst Trade", "Max Consec Wins", "Max Consec Losses",
                        "Avg Holding Days"],
        "charts": [
          "Equity Curve (line chart with gradient)",
          "Drawdown (area chart, red)",
          "Projected P&L — Monte Carlo (500 simulations, confidence interval)",
          "Monthly Returns Heatmap"
        ],
        "trade_log_table": ["Entry Date", "Exit Date", "Direction", "Entry $", "Exit $", "Shares", "P&L", "Return %", "Reason"]
      },
      "backtest_history": {
        "columns": ["ID", "Time", "Ticker", "Systems", "Return", "Trades", "Sharpe", "Load button"],
        "stored_in": "SQLite backtests table"
      }
    }
  },
  "ticker_search": {
    "searches": ["Local SQLite database first", "yfinance API for new tickers"],
    "auto_add": "Clicking a yfinance result fetches data + adds to universe + refreshes screener"
  }
}
```

---

### 3. Receipts Ledger — `receipts.html`

Performance tracking and accountability page.

```json
{
  "page": "Receipts Ledger",
  "route": "/receipts.html",
  "purpose": "30-day model performance history — every call documented",
  "nav": ["🏠 Command Center", "⚡ Intelligence", "🧾 Receipts (active)"],
  "kpi_strip": ["Win Rate %", "Avg Return %", "Best Call", "Worst Call", "Total Calls", "Sharpe"],
  "charts": {
    "pnl_curve": {
      "type": "line",
      "color": "amber gradient",
      "description": "30-day equity curve built from backtest history"
    },
    "win_loss_distribution": {
      "type": "doughnut",
      "segments": ["Wins (emerald)", "Losses (rose)", "Open (amber)"]
    }
  },
  "receipts_table": {
    "columns": ["#", "Date", "Ticker", "Signal Type", "Result (WIN/LOSS/OPEN)", "Return %", "P&L", "Trades", "Sharpe", "Details"],
    "filter_bar": ["All", "✅ Wins", "❌ Losses", "🟡 Open"],
    "max_height": "600px scrollable"
  },
  "data_source": "Fetches from /api/receipts (builds from backtest history)",
  "empty_state": "Shows CTA to Strategy Builder if no backtests exist"
}
```

---

## Features (Detailed Breakdown)

```json
{
  "features": [
    {
      "id": "F01",
      "name": "4-System Momentum Screening",
      "description": "Screens 400+ US equities using 4 independent technical indicator systems, producing a composite score (-2 to +2) and probability (0-98%)",
      "modules": ["momentum_indicators.py", "momentum_screener.py"],
      "ui_location": "Intelligence page — full signal table + leaderboard"
    },
    {
      "id": "F02",
      "name": "Market Regime Classification",
      "description": "Classifies each ticker and sector into Trending, Mean-Reverting, or Choppy based on ADX + Stochastic range analysis",
      "thresholds": {
        "trending": "ADX ≥ 25",
        "mean_reverting": "ADX 15-25 with Stoch 30-70",
        "choppy": "ADX < 15"
      },
      "ui_location": "Sector Regime Heatmap on Intelligence + Sector Intelligence pages"
    },
    {
      "id": "F03",
      "name": "Probability Engine",
      "description": "Computes signal confidence (0-98%) based on directional agreement across 4 systems × average magnitude. Unanimous agreement gets 1.2x bonus",
      "ui_location": "Probability column in all signal tables + KPI strip"
    },
    {
      "id": "F04",
      "name": "Sentiment Classification",
      "description": "Labels each ticker: Strong Bullish (≥1.5), Bullish (≥0.5), Neutral, Bearish (≤-0.5), Strong Bearish (≤-1.5)",
      "ui_location": "Color-coded badges throughout the platform"
    },
    {
      "id": "F05",
      "name": "9 Signal Screeners",
      "description": "Specialized screens that filter the universe into actionable categories",
      "screeners": "See Signal Screeners section below",
      "ui_location": "Sidebar → Signal Screeners section — each has its own page"
    },
    {
      "id": "F06",
      "name": "Sector Intelligence",
      "description": "Macro-level analysis: sector regime classification, rotation signals, top trending sectors, bull/bear sentiment distribution per sector",
      "ui_location": "Sector Intelligence page + Market Heat section on Command Center"
    },
    {
      "id": "F07",
      "name": "Trade Strategy Generator",
      "description": "Auto-generates actionable strategies per ticker: leveraged ETF recommendation (bull/bear by sector), options strategy (ATM calls, spreads, iron condors), entry/stop/target levels, cost estimates, conviction score",
      "modules": ["momentum_strategies.py", "momentum_config.py (LEVERAGED_ETFS)"],
      "ui_location": "Signals & Strategies page — strategy cards"
    },
    {
      "id": "F08",
      "name": "4-System Backtester",
      "description": "Vectorized backtesting engine for single-ticker or universe-wide. Configurable systems, holding period, entry threshold, ensemble K-of-N mode. Produces equity curves, trade logs, Sharpe/Sortino ratios, drawdown analysis, and Monte Carlo forward projections",
      "modules": ["backtester.py"],
      "ui_location": "Strategy Builder → 4-System sub-tab"
    },
    {
      "id": "F09",
      "name": "Visual Strategy Builder",
      "description": "Build strategies using drop-down condition rows with 15 indicators. Entry conditions (AND logic) and exit conditions (OR logic) with stop-loss, take-profit, and max holding constraints",
      "modules": ["strategy_engine.py"],
      "ui_location": "Strategy Builder → Strategy Builder sub-tab"
    },
    {
      "id": "F10",
      "name": "Python Code Editor",
      "description": "Write custom strategies in Python directly in the browser. Sandboxed execution with access to df (OHLCV), ind (15-indicator helper), pd, np. Blocked dangerous builtins for safety",
      "modules": ["strategy_engine.py (run_code_strategy, _IndicatorHelper)"],
      "ui_location": "Strategy Builder → Code Editor sub-tab"
    },
    {
      "id": "F11",
      "name": "Strategy Save/Load/Delete",
      "description": "Persist visual or code strategies to SQLite. Load and re-run, or delete",
      "modules": ["db.py (strategies table)"],
      "ui_location": "Strategy Builder → Saved Strategies sub-tab"
    },
    {
      "id": "F12",
      "name": "Ticker Search & Auto-Add",
      "description": "Search for tickers across local DB and yfinance. Clicking a yfinance result auto-downloads historical data, adds to the universe, and refreshes the screener",
      "api_endpoints": ["/api/ticker/search", "/api/ticker/add"],
      "ui_location": "Search bar on Intelligence page header"
    },
    {
      "id": "F13",
      "name": "Incremental Data Sync",
      "description": "Smart data fetching: checks SQLite for existing date ranges, only downloads missing days from yfinance. First run fetches everything; subsequent runs are near-instant",
      "modules": ["momentum_data.py (smart_fetch)"],
      "ui_location": "Background process, status shown in pipeline badge"
    },
    {
      "id": "F14",
      "name": "In-Memory Data Cache",
      "description": "Thread-safe caching of OHLCV data fetches to avoid redundant DB reads during backtest runs",
      "modules": ["momentum_dashboard.py (_DATA_CACHE, _cached_fetch)"]
    },
    {
      "id": "F15",
      "name": "Receipts Ledger",
      "description": "30-day model performance tracker. Shows every backtest as a 'receipt' with win/loss tracking, P&L curves, and aggregate statistics",
      "ui_location": "receipts.html page"
    },
    {
      "id": "F16",
      "name": "Background Pipeline",
      "description": "On server start, full pipeline runs in background thread: fetch → screen → strategise → write momentum_data.json. Dashboard loads instantly from cached JSON if available",
      "modules": ["momentum_dashboard.py (_run_pipeline_background)"]
    },
    {
      "id": "F17",
      "name": "Backtest Cancellation",
      "description": "Cancel running backtests via thread event + AbortController on frontend",
      "api_endpoint": "POST /api/backtest/cancel"
    },
    {
      "id": "F18",
      "name": "Chart.js Interactive Charts",
      "description": "All charts use Chart.js 4.4.7 with dark theme, gradient fills, custom tooltips, cross-hair interaction, and responsive sizing",
      "chart_types": ["Line (price, ADX, stochastics, TRIX, equity)", "Bar (Elder impulse)", "Doughnut (win/loss)", "Area (drawdown, projection)"]
    },
    {
      "id": "F19",
      "name": "Rotating Quotes",
      "description": "30 curated quant/finance quotes from Buffett, Simons, Taleb, Graham, Lynch, etc. Rotate every 15 seconds",
      "ui_location": "Command Center quote bar + Intelligence page quote banner"
    },
    {
      "id": "F20",
      "name": "Whale Watch Alerts",
      "description": "When a sector has strong trending regime + high composite score, a Whale Watch alert shows on the Command Center indicating institutional rotation",
      "ui_location": "Command Center → Whale Alert banner"
    },
    {
      "id": "F21",
      "name": "Cloud Deployment Ready",
      "description": "render.yaml config for Render.com deployment. Auto-copies seed DB to persistent disk. Binds to 0.0.0.0 when RENDER env var is set",
      "files": ["render.yaml", "db.py (seed DB copy logic)"]
    }
  ]
}
```

---

## The 4 Indicator Systems

All indicators are implemented **from scratch** (no TA-Lib dependency). Each system scores from **-2 to +2**.

```json
{
  "systems": [
    {
      "id": "S1",
      "name": "ADX + TRIX + Full Stochastics",
      "indicators": {
        "ADX": {
          "description": "Average Directional Index (Welles Wilder)",
          "period": 14,
          "outputs": ["ADX", "Plus_DI", "Minus_DI"],
          "role": "Determines IF there is a trend"
        },
        "TRIX": {
          "description": "Triple Exponential Average rate-of-change",
          "period": 14,
          "signal_period": 9,
          "outputs": ["TRIX", "TRIX_Signal"],
          "role": "Determines trend direction & momentum"
        },
        "Full_Stochastics": {
          "description": "Full Stochastic Oscillator (%K smoothed, %D)",
          "k_period": 14,
          "d_period": 3,
          "smooth": 3,
          "outputs": ["Stoch_K", "Stoch_D"],
          "role": "Determines timing (oversold/overbought)"
        }
      },
      "scoring_logic": [
        "+2.0: Trending + DI bullish + TRIX bullish + Stoch oversold",
        "+1.5: Strong trend + DI bullish + TRIX bullish",
        "+1.0: Weak trend + DI bullish + TRIX bullish",
        "+0.8: TRIX cross up",
        "+0.3: TRIX bullish (mild)",
        "Mirrored negative for bearish"
      ],
      "additional_outputs": ["ta_branch", "stoch_k", "stoch_d"]
    },
    {
      "id": "S2",
      "name": "Elder Impulse System",
      "indicators": {
        "EMA": { "period": 13 },
        "MACD": { "fast": 12, "slow": 26, "signal": 9 }
      },
      "color_coding": {
        "Green": "EMA rising AND MACD-Histogram rising → Bullish impulse",
        "Red": "EMA falling AND MACD-Histogram falling → Bearish impulse",
        "Blue": "Mixed → Neutral"
      },
      "scoring_logic": [
        "+2.0: 10+ consecutive green bars",
        "+1.5: 5+ consecutive green bars",
        "+1.0: Green bar + moderate MACD momentum",
        "Blue: 0.1 × MACD-hist Z-score (mild lean)",
        "Also tracks 10-day green/red distribution"
      ]
    },
    {
      "id": "S3",
      "name": "Renko Chart + Full Stochastics",
      "indicators": {
        "Renko": {
          "description": "ATR-based Renko bricks (non-time-based charting)",
          "atr_period": 14,
          "role": "Filters noise, shows clean trend direction"
        },
        "Full_Stochastics": "(same as S1)"
      },
      "scoring_logic": [
        "Base score from brick direction + consecutive count",
        "Stoch oversold + up bricks = bonus up to +2.0",
        "Stoch overbought + up bricks = reduced (exhaustion)",
        "Also tracks recent brick velocity (bricks in last 20 bars)"
      ]
    },
    {
      "id": "S4",
      "name": "Heikin-Ashi + Hull Moving Average",
      "indicators": {
        "Heikin_Ashi": {
          "description": "Smoothed candlesticks (HA)",
          "candle_quality": "Wick analysis — no opposite wick = strongest signal"
        },
        "HMA": {
          "description": "Hull Moving Average — reduces lag while maintaining smoothness",
          "formula": "WMA( 2·WMA(n/2) − WMA(n), √n )",
          "period": 20
        }
      },
      "scoring_logic": [
        "Base from consecutive HA candles × wick quality",
        "HMA direction confirms/contradicts (±0.5 adjustment)",
        "Divergence (HA bullish + HMA falling) = score × 0.4",
        "Also tracks 10-day HA bull distribution"
      ]
    }
  ],
  "composite_score": "Mean of all 4 system scores → -2 to +2",
  "probability": "Agreement ratio × avg magnitude × 100, with 1.2x bonus for unanimous agreement"
}
```

---

## Signal Screeners

Nine specialized screeners, each with its own dedicated page:

```json
{
  "screeners": [
    {
      "id": "SCR01",
      "name": "🌱 Fresh Momentum",
      "criteria": "Composite > 0 AND momentum_phase == 'Fresh' (Stoch_K > Stoch_D AND Stoch_K < 70)",
      "purpose": "Early-stage momentum plays — maximum upside potential before the crowd",
      "sort_by": "Composite descending",
      "max_results": 100
    },
    {
      "id": "SCR02",
      "name": "🔥 Exhausting Momentum",
      "criteria": "momentum_phase == 'Exhausting' (Composite > 0 AND Stoch_K > 80)",
      "purpose": "Tickers where momentum may be overextended — watch for reversal",
      "sort_by": "Composite descending",
      "max_results": 100
    },
    {
      "id": "SCR03",
      "name": "🌪️ Rotation Breakouts",
      "criteria": "regime == 'Trending' AND composite > 0.3",
      "purpose": "Trending-regime stocks with strong bullish momentum — sector rotation plays",
      "sort_by": "Composite descending",
      "max_results": 100
    },
    {
      "id": "SCR04",
      "name": "⚡ Momentum Shock Detector",
      "criteria": "Price > 2 standard deviations from 20-day mean (momentum_shock.trigger == true)",
      "purpose": "Detect sudden price movements (shocks) — potential breakout or breakdown",
      "sort_by": "Absolute shock strength descending",
      "max_results": 100
    },
    {
      "id": "SCR05",
      "name": "🎯 Gamma Squeeze Ops",
      "criteria": "Volume spike > 2x 20-day avg AND composite > 0",
      "purpose": "High-volume bullish setups — potential gamma squeeze candidates",
      "sort_by": "Volume spike descending",
      "max_results": 100
    },
    {
      "id": "SCR06",
      "name": "🐋 Smart Money Accumulation",
      "criteria": "Price trending up AND recent 5-day volume > 1.3x 20-day avg (smart_money.trigger == true)",
      "purpose": "Detect institutional accumulation — higher volume on up moves with low volatility",
      "sort_by": "Smart money score descending",
      "max_results": 100
    },
    {
      "id": "SCR07",
      "name": "🚀 Momentum Continuation",
      "criteria": "Composite > 0 AND probability > 50 (continuation probability > 30)",
      "purpose": "Tickers likely to sustain their momentum — trend continuation plays",
      "sort_by": "Continuation probability descending",
      "max_results": 100
    },
    {
      "id": "SCR08",
      "name": "📦 Momentum Clusters",
      "criteria": "Sectors with 3+ bullish stocks (composite > 0.1), top 5 per sector",
      "purpose": "Identify sectors with broad-based momentum — strength in numbers",
      "sort_by": "Cluster size descending, then composite",
      "max_results": 100
    },
    {
      "id": "SCR09",
      "name": "💥 Sector Shock Clusters",
      "criteria": "Sectors with multiple momentum shock signals, top 5 per sector",
      "purpose": "Detect sector-wide shocks — systemic events affecting multiple stocks",
      "sort_by": "Cluster size descending",
      "max_results": 100
    }
  ]
}
```

---

## Backtesting Engine

```json
{
  "modes": [
    {
      "name": "4-System Backtest",
      "module": "backtester.py",
      "approach": "Vectorized signal generation via rolling window (lookback=100)",
      "entry_modes": {
        "composite": "Enter when composite score > threshold",
        "ensemble": "Enter when K-of-N systems agree on direction"
      },
      "features": [
        "Single-ticker or universe-wide (top N by return)",
        "Configurable holding period, entry threshold, date range",
        "Cancel mid-run via threading.Event",
        "Auto-save results to SQLite",
        "Forward P&L projection via Monte Carlo (500 simulations)"
      ]
    },
    {
      "name": "Visual Strategy Backtest",
      "module": "strategy_engine.py (run_strategy_backtest)",
      "approach": "Evaluate entry/exit conditions using 15-indicator library",
      "features": [
        "Stop-loss, take-profit, max-holding constraints",
        "Entry: AND logic, Exit: OR logic",
        "Cross-based operators (crosses_above, crosses_below)",
        "Monthly returns heatmap",
        "Drawdown series"
      ]
    },
    {
      "name": "Code Strategy Backtest",
      "module": "strategy_engine.py (run_code_strategy)",
      "approach": "Execute user Python code in sandboxed namespace",
      "sandbox": {
        "available": ["df", "ind", "pd", "np"],
        "blocked": "All dangerous builtins (no file I/O, no imports)",
        "user_sets": "entries (bool Series), exits (bool Series)"
      }
    }
  ],
  "metrics_computed": [
    "Total Return ($, %)",
    "Annualised Return",
    "Max Drawdown ($, %)",
    "Max Peak Profit",
    "Sharpe Ratio (annualised)",
    "Sortino Ratio",
    "Win Rate",
    "Profit Factor",
    "Avg Win / Avg Loss",
    "Total Trades",
    "Best / Worst Trade",
    "Max Consecutive Wins / Losses",
    "Avg Holding Days",
    "Monthly P&L Aggregation"
  ]
}
```

---

## Strategy Engine (15 Built-In Indicators)

```json
{
  "indicators": [
    { "name": "RSI",            "category": "Momentum",   "params": ["period=14"],                       "outputs": ["rsi"] },
    { "name": "MACD",           "category": "Momentum",   "params": ["fast=12", "slow=26", "signal=9"],  "outputs": ["macd", "macd_signal", "macd_hist"] },
    { "name": "Bollinger Bands","category": "Volatility",  "params": ["period=20", "std=2.0"],            "outputs": ["bb_upper", "bb_mid", "bb_lower", "bb_pct_b"] },
    { "name": "EMA",            "category": "Trend",      "params": ["period=20"],                       "outputs": ["ema"] },
    { "name": "SMA",            "category": "Trend",      "params": ["period=20"],                       "outputs": ["sma"] },
    { "name": "Stochastic",     "category": "Momentum",   "params": ["k=14", "d=3", "smooth=3"],         "outputs": ["stoch_k", "stoch_d"] },
    { "name": "ATR",            "category": "Volatility",  "params": ["period=14"],                       "outputs": ["atr"] },
    { "name": "ADX",            "category": "Trend",      "params": ["period=14"],                       "outputs": ["adx", "plus_di", "minus_di"] },
    { "name": "VWAP",           "category": "Volume",     "params": [],                                  "outputs": ["vwap"] },
    { "name": "OBV",            "category": "Volume",     "params": [],                                  "outputs": ["obv"] },
    { "name": "CCI",            "category": "Momentum",   "params": ["period=20"],                       "outputs": ["cci"] },
    { "name": "Williams %R",    "category": "Momentum",   "params": ["period=14"],                       "outputs": ["willr"] },
    { "name": "Ichimoku",       "category": "Trend",      "params": ["tenkan=9", "kijun=26", "senkou_b=52"], "outputs": ["tenkan", "kijun", "senkou_a", "senkou_b", "chikou"] },
    { "name": "Supertrend",     "category": "Trend",      "params": ["period=10", "multiplier=3.0"],      "outputs": ["supertrend", "supertrend_dir"] },
    { "name": "Parabolic SAR",  "category": "Trend",      "params": ["af_start=0.02", "af_max=0.2"],      "outputs": ["psar", "psar_dir"] }
  ],
  "available_via": [
    "API: GET /api/indicators → full catalog with metadata",
    "Code Editor: ind.rsi(), ind.macd(), ind.bbands(), etc.",
    "Visual Builder: dropdown selection in condition rows"
  ]
}
```

---

## API Reference

### Screening & Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Redirect to `/index.html` |
| `GET` | `/api/screen` | Run full screener pipeline, return JSON |
| `GET` | `/api/data/status` | DB statistics (rows, tickers, date range, size) |
| `GET` | `/api/data/sync?period=1y` | Trigger data sync from yfinance |
| `GET` | `/api/pipeline/status` | Current pipeline state (`idle`/`running`/`done`/`error`) |
| `GET` | `/momentum_data.json` | Cached screen data (static file) |

### Backtesting

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/backtest` | Run 4-system backtest (params: systems, holding_period, ticker, etc.) |
| `POST` | `/api/backtest/cancel` | Cancel running backtest |
| `GET` | `/api/backtest/history?limit=20` | List saved backtests |
| `GET` | `/api/backtest/<id>` | Load saved backtest by ID |
| `POST` | `/api/compare` | Compare individual systems vs ensemble for a ticker |

### Strategy Engine

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/indicators` | Catalog of all 15 available indicators |
| `POST` | `/api/strategy/backtest` | Run visual strategy backtest |
| `POST` | `/api/strategy/code` | Run Python code strategy |
| `POST` | `/api/strategy/save` | Save/update a strategy |
| `GET` | `/api/strategy/list` | List saved strategies |
| `GET` | `/api/strategy/<id>` | Load a saved strategy |
| `POST` | `/api/strategy/<id>/delete` | Delete a strategy |
| `POST` | `/api/strategy/compare` | Compare multiple strategy results |

### Ticker Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ticker/search?q=AAPL` | Search tickers (DB + yfinance) |
| `POST` | `/api/ticker/add` | Add ticker(s) to universe + fetch data |

### Receipts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/receipts?limit=50` | Formatted receipts ledger from backtest history |

### Cache & Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cache/stats` | Cache backend diagnostics (Redis vs memory, keys, version) |
| `POST` | `/api/webhook/register` | Register callback URL for pipeline completion events |
| `POST` | `/api/webhook/unregister` | Remove a registered webhook URL |
| `GET` | `/api/pipeline/status` | Pipeline state (reads from Redis if available) |

---

## Data Architecture

### Redis Caching Layer (`redis_cache.py`)

Primary read-layer for the Next.js dashboard. Falls back to in-memory dict if Redis is unavailable.

| Key | TTL | Purpose |
|-----|-----|--------|
| `momentum:dashboard` | 5 min | Full dashboard JSON (~2MB) |
| `momentum:chart:{ticker}` | 10 min | Per-ticker chart data (granular reads) |
| `momentum:pipeline:status` | 1 min | Pipeline state (idle/running/done) |
| `momentum:dashboard:version` | — | Pipeline run Unix timestamp |

**Read priority chain**: Redis → In-memory dict → `momentum_data.json` file → 202 (pipeline not ready)

### Pydantic Data Validation (`validators.py`)

7-check validation pipeline runs before screening (step 2/5):
1. **NaN detection** — drops rows exceeding 5% NaN ratio
2. **Negative/zero prices** — removes impossible price values
3. **High < Low swap** — auto-corrects inverted H/L
4. **Zero volume filtering** — flags days with no trading activity
5. **Split anomaly detection** — flags >50% price gaps (dividends/splits)
6. **Minimum rows check** — rejects tickers with <50 days of data
7. **Date continuity** — flags gaps >5 calendar days

### Webhook Cache Invalidation

```
Pipeline completes → POST to registered URLs:
{
  "event": "pipeline_complete",
  "timestamp": 1710042100,
  "summary": { "total_screened": 507, "bullish": 120, ... }
}

Next.js receives → calls revalidateTag("dashboard") → instant refresh
```

### Mathematical Verification (`verify_spy.py`)

5-suite verification script:
- **Determinism**: All 4 systems produce identical output on identical input
- **Score Ranges**: All scores within [-2, +2]
- **Indicator Math**: ADX ∈ [0,100], HA_Close = (O+H+L+C)/4, HMA < SMA lag
- **Full Pipeline**: Composite = mean(S1..S4), probability ∈ [1,98]
- **Pinned Values**: All scores finite, non-None

Run: `python tests/verify_spy.py`

### Vector DB Assessment (Future)

See [`backend/docs/vector_db_assessment.md`](file:///Users/anhadkwatra/Desktop/quant_screener/backend/docs/vector_db_assessment.md) for pgvector integration plan — chart pattern similarity, regime matching, and strategy pattern search.

---

## Configuration

### `momentum_config.py` — Universe & Indicator Parameters

- **120 legacy tickers** across 11 GICS sectors (used as default universe)
- **`universe.py`** — expanded S&P 500 + NASDAQ 100 universe (**507 tickers**, deduplicated)
- **Leveraged ETF mapping** per sector (bull ETF, bear ETF, leverage factor, sector ETF)
- **Indicator parameters**: ADX (period=14, strong=25, weak=20), TRIX (14/9), Stochastics (14/3/3, OB=80, OS=20), Elder (EMA=13, MACD 12/26/9), Renko ATR (14), HMA (20)
- **Scoring thresholds**: Strong Bull=1.5, Bull=0.5, Bear=-0.5, Strong Bear=-1.5
- **30 curated quotes** from finance legends

### `config.py` — Quant Parameters

- **Universe constraints**: Price $5-$50, exchanges NYSE/NASDAQ/TSX
- **Fractional differentiation**: d range 0.05-0.95, ADF p-value target 0.05
- **Rolling windows**: Z-Score=20, Volatility=20, Beta=60, Hurst=126, ADV=20, HMM=252
- **Signal thresholds**: |Z| > 2.5, Hurst mean-rev < 0.40, trending > 0.60
- **Risk gates**: Liquidity floor $10M ADV, market cap floor $300M, kurtosis ceiling 10.0

---

## Tech Stack & Dependencies

| Component | Technology |
|-----------|-----------|
| **Backend** | Python 3.11+ · FastAPI · uvicorn |
| **Frontend** | Next.js 16 · TypeScript · Tailwind CSS v4 |
| **UI Components** | shadcn/ui · Framer Motion · TradingView Lightweight Charts |
| **Design System** | Apple-style glassmorphism · Bento Grid · Spring animations |
| **Database** | SQLite (single file, WAL mode) |
| **Data Source** | yfinance (real-time market data) |
| **Testing** | pytest (89 tests) · frozen OHLCV fixtures |
| **Fonts** | Google Fonts — Inter + JetBrains Mono |

### Backend Python Dependencies

| Package | Purpose |
|---------|--------|
| `fastapi` + `uvicorn` | REST API server |
| `yfinance` | Market data fetching |
| `pandas` + `numpy` | DataFrames & numerical computation |
| `scipy` | Statistical functions |
| `pytest` + `httpx` | Test suite |

### Frontend Node Dependencies

| Package | Purpose |
|---------|--------|
| `next` (v16) | React framework (App Router) |
| `framer-motion` | Spring-physics animations |
| `lightweight-charts` | TradingView charting |
| `tailwindcss` (v4) | Utility-first CSS |
| `tailwind-merge` | Conditional class merging |

---

## License

This project is for educational and personal use.

---

> *"We look for patterns. We look for ways to reduce risk. We don't predict markets. We just look for slightly wrong prices."* — **Jim Simons**
