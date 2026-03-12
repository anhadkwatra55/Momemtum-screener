"use client";

import React, { memo, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/app-shell";
import { KPIStrip } from "@/components/momentum/kpi-strip";
import { QuoteRotator } from "@/components/momentum/quote-rotator";
import { useProgressiveData } from "@/hooks/use-progressive-data";
import { usePipelineStatus } from "@/hooks/use-pipeline-status";
import { DataReveal, CardReveal } from "@/components/ui/data-reveal";
import { SFIcon } from "@/components/ui/sf-icon";
import {
  COLORS,
  SPRING_TRANSITION_PROPS,
  PAGE_MOTION_VARIANTS,
  CARD_HOVER_MOTION_PROPS,
  LIST_ITEM_HOVER_MOTION_PROPS,
  TRACKING_HEADING_CLASS,
  SHADOW_GLOW_CYAN_VALUE,
  MIN_CHART_HEIGHT_CLASS,
} from "@/lib/constants";
import { cn, getTextColorClass, type PaletteColorKey } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppleButton } from "@/components/ui/apple-button";
import { Card } from "@/components/ui/card";

// ── Lazy-loaded heavy components (code-split per page) ──────────────────────
const LazySignalTable = dynamic(() => import('@/components/momentum/signal-table').then(m => ({ default: m.SignalTable })), { ssr: false });
const LazyStrategyCard = dynamic(() => import('@/components/momentum/strategy-card').then(m => ({ default: m.StrategyCard })), { ssr: false });
const LazyScreenerTable = dynamic(() => import('@/components/momentum/screener-table').then(m => ({ default: m.ScreenerTable })), { ssr: false });
const LazyLeaderboard = dynamic(() => import('@/components/momentum/leaderboard').then(m => ({ default: m.Leaderboard })), { ssr: false });
const LazyTopSignals = dynamic(() => import('@/components/momentum/top-signals').then(m => ({ default: m.TopSignals })), { ssr: false });
const LazyMiniSignalList = dynamic(() => import('@/components/momentum/mini-signal-list').then(m => ({ default: m.MiniSignalList })), { ssr: false });
const LazyTrendingSectors = dynamic(() => import('@/components/momentum/trending-sectors').then(m => ({ default: m.TrendingSectors })), { ssr: false });
const LazyRotationSignals = dynamic(() => import('@/components/momentum/rotation-signals').then(m => ({ default: m.RotationSignals })), { ssr: false });
const LazyTickerSearch = dynamic(() => import('@/components/momentum/ticker-search').then(m => ({ default: m.TickerSearch })), { ssr: false });
const LazyStrategyBuilder = dynamic(() => import('@/components/momentum/strategy-builder').then(m => ({ default: m.StrategyBuilder })), { ssr: false });
const LazyYieldTable = dynamic(() => import('@/components/momentum/yield-table').then(m => ({ default: m.YieldTable })), { ssr: false });
const LazySectorHeatmap = dynamic(() => import('@/components/momentum/sector-heatmap').then(m => ({ default: m.SectorHeatmap })), { ssr: false });
const LazyPortfolioIntelligence = dynamic(() => import('@/components/momentum/portfolio-intelligence').then(m => ({ default: m.PortfolioIntelligence })), { ssr: false });
const LazyCandlestickChart = dynamic(() => import('@/components/charts/candlestick-chart').then(m => ({ default: m.CandlestickChart })), { ssr: false });

const SCREENER_MAP: Record<string, { key: string; title: string; icon: string; info: string }> = {
  fresh: { key: "fresh_momentum", title: "Fresh Momentum", icon: "leaf.fill", info: "Early-stage momentum signals where Stochastic %K has just crossed above %D below the 70 level — catching trends before they become crowded. Scored by our 4-system ensemble (ADX + Elder + Renko + HA/HMA)." },
  exhausting: { key: "exhausting_momentum", title: "Exhausting Momentum", icon: "flame.fill", info: "Late-stage momentum where Stochastic %K is above 80 — overbought conditions that may reverse. Useful for profit-taking or initiating tactical hedges." },
  rotation: { key: "rotation_ideas", title: "Rotation Breakouts", icon: "tornado", info: "Sector rotation signals detected when a ticker's regime shifts from Choppy/Mean-Reverting to Trending (ADX crossing above 25), suggesting institutional capital flows into new sectors." },
  shock: { key: "shock_signals", title: "Momentum Shock Detector", icon: "bolt.slash.fill", info: "Sudden momentum reversals where composite score flips direction with high magnitude — indicates potential trend breaks. Often precedes multi-day moves." },
  gamma: { key: "gamma_signals", title: "Gamma Squeeze Ops", icon: "target", info: "Identifies tickers with conditions favorable for gamma squeezes: high short interest environment combined with strong bullish momentum and rising volatility spikes." },
  "smart-money": { key: "smart_money", title: "Smart Money Accumulation", icon: "dollarsign.circle.fill", info: "Detects institutional accumulation patterns: rising volume with controlled price action, positive composite in a Mean-Reverting regime — the signature of large players building positions quietly." },
  continuation: { key: "continuation", title: "Momentum Continuation", icon: "rocket.fill", info: "Stocks already in Trending regime with sustained high composite scores and probability > 70% — momentum that is likely to persist based on ADX strength and system agreement." },
  clusters: { key: "momentum_clusters", title: "Momentum Clusters", icon: "cube.fill", info: "Groups of stocks within the same sector showing correlated momentum — indicates sector-wide moves rather than idiosyncratic stock stories." },
  "shock-clusters": { key: "shock_clusters", title: "Sector Shock Clusters", icon: "bolt.circle.fill", info: "Multiple momentum shocks occurring simultaneously within a sector — signals sector-level catalysts like earnings season surprises or regulatory changes." },
  "hidden-gems": { key: "hidden_gems", title: "Hidden Gems", icon: "diamond.fill", info: "Mid-cap and small-cap stocks with strong composite scores but low analyst coverage — under-the-radar opportunities with asymmetric risk/reward profiles." },
  "etf-screener": { key: "high_yield_etfs", title: "ETF Screener", icon: "chart.line.uptrend.rectangle.fill", info: "Dedicated ETF screening covering high-yield bonds, dividend equity, REITs, and covered call strategies — sorted by yield with momentum overlay for timing." },
  "ai-stocks": { key: "ai_stocks", title: "AI Stocks", icon: "brain.fill", info: "Curated universe of 30+ AI, semiconductor, and cloud computing leaders (NVDA, AMD, GOOGL, MSFT, META, PLTR, etc.) with full 4-system momentum analysis and regime classification." },
  "bullish-momentum": { key: "bullish_momentum", title: "Bullish Momentum", icon: "arrow.up.right.circle.fill", info: "Comprehensive bullish technical alignment: positive composite score, trending regime (ADX ≥ 25), MACD bullish, and probability confirmation across all 4 indicator systems." },
  "volume-gappers": { key: "high_volume_gappers", title: "High Volume Gappers", icon: "chart.bar.doc.horizontal.fill", info: "Stocks gapping up on significantly above-average volume (RVOL > 1.5x) with bullish momentum — often indicates institutional order flow driving price discovery." },
  "momentum-95": { key: "momentum_95", title: "Momentum Score 95+", icon: "star.fill", info: "The highest-conviction picks: only stocks where all 4 systems produce probability ≥ 95%. Requires unanimous directional agreement across ADX/TRIX/Stoch, Elder Impulse, Renko, and Heikin-Ashi/HMA." },
};

const ChartSkeleton = memo(() => (
  <div className={cn("flex h-full w-full items-center justify-center bg-card rounded-2xl overflow-hidden relative p-5", MIN_CHART_HEIGHT_CLASS)}>
    <div className="absolute inset-0 bg-gradient-to-r from-card to-card-light animate-shimmer" />
    <div className="relative z-10 h-[80%] w-[90%] overflow-hidden rounded-md bg-white/5 p-4 flex flex-col justify-between">
      <div className="flex justify-between items-center w-full mb-3">
        <div className="h-3 w-1/4 rounded-sm bg-white/10" />
        <div className="h-3 w-1/6 rounded-sm bg-white/10" />
      </div>
      <div className="flex-1 w-full bg-white/5 rounded-md relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 border-[3px] border-white/10 border-t-cyan-400 rounded-full animate-spin" />
      </div>
      <div className="flex justify-between items-center w-full mt-3">
        <div className="h-2 w-1/5 rounded-sm bg-white/10" />
        <div className="h-2 w-1/5 rounded-sm bg-white/10" />
      </div>
    </div>
  </div>
));
ChartSkeleton.displayName = "ChartSkeleton";

// ── KPI Skeleton ──
const KPISkeleton = memo(() => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <motion.div
        key={i}
        className="h-20 rounded-2xl bg-card animate-pulse"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: i * 0.05 }}
      />
    ))}
  </div>
));
KPISkeleton.displayName = "KPISkeleton";

// ── Section Skeleton ──
const SectionSkeleton = memo(({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <motion.div
        key={i}
        className="h-14 rounded-xl bg-white/[0.02] animate-pulse"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: i * 0.06 }}
      />
    ))}
  </div>
));
SectionSkeleton.displayName = "SectionSkeleton";

// Lazy load chart components for performance
const LazyPriceChart = dynamic(() => import('@/components/charts/price-chart').then(mod => ({ default: mod.PriceChart })), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const LazyIndicatorChart = dynamic(() => import('@/components/charts/indicator-chart').then(mod => ({ default: mod.IndicatorChart })), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const LazyElderChart = dynamic(() => import('@/components/charts/elder-chart').then(mod => ({ default: mod.ElderChart })), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

interface StatItem {
  label: string;
  value: string;
  color: PaletteColorKey;
  font: "font-mono-data" | "font-inter";
}

const DashboardPage = memo(() => {
  const {
    data,
    tierLoading,
    loading,
    error,
    selectedTicker,
    setSelectedTicker,
    sortedSignals,
    sortBy,
    sortAsc,
    setSortBy,
    refresh,
    fetchChart,
    chartCache,
    chartLoading,
  } = useProgressiveData();

  // Pipeline status — auto-refresh when pipeline completes
  const pipeline = usePipelineStatus(refresh);

  const handleSelectTicker = useCallback((ticker: string) => {
    setSelectedTicker(ticker);
  }, [setSelectedTicker]);

  // All hooks MUST be called before any conditional returns (React Rules of Hooks)
  const dbStatsLabel = useMemo(
    () =>
      data?.db_stats?.total_rows
        ? `${data.db_stats.total_rows.toLocaleString()} rows · ${data.db_stats.db_size_mb} MB`
        : undefined,
    [data?.db_stats]
  );

  const selectedSignal = useMemo(
    () => data?.signals?.find((s) => s.ticker === selectedTicker),
    [data?.signals, selectedTicker]
  );

  // On-demand chart loading for selected ticker
  const selectedChart = useMemo(
    () => (selectedTicker ? chartCache[selectedTicker] ?? null : null),
    [chartCache, selectedTicker]
  );

  // Trigger chart fetch when ticker detail page is active and chart not cached
  useEffect(() => {
    if (selectedTicker && !chartCache[selectedTicker]) {
      fetchChart(selectedTicker);
    }
  }, [selectedTicker, chartCache, fetchChart]);

  const kpiStripItems = useMemo(() => {
    if (!data?.summary) return [];
    return [
      { label: "Universe", value: data.summary.total_screened, color: "cyan" as PaletteColorKey },
      { label: "Bullish", value: data.summary.bullish, color: "emerald" as PaletteColorKey },
      { label: "Bearish", value: data.summary.bearish, color: "rose" as PaletteColorKey },
      { label: "Avg Probability", value: `${data.summary.avg_probability}%`, color: "amber" as PaletteColorKey },
      { label: "Top Bull", value: data.summary.top_bull, color: "emerald" as PaletteColorKey },
      { label: "Top Bear", value: data.summary.top_bear, color: "rose" as PaletteColorKey },
    ];
  }, [data?.summary]);

  const handlePageTickerSelect = useCallback((ticker: string) => {
    handleSelectTicker(ticker);
  }, [handleSelectTicker]);

  // ── Initial full-page loading state ──
  if (loading) {
    return (
      <motion.div
        key="loading-state"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen flex flex-col items-center justify-center p-4 bg-background"
      >
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, ease: "linear", repeat: Infinity }}
          className="w-16 h-16 border-[4px] border-white/10 border-t-cyan-400 rounded-full mb-6"
        />
        <p className={cn("mt-4 text-muted-foreground text-lg font-semibold", TRACKING_HEADING_CLASS)}>Crafting your premium experience...</p>
        <div className="w-full max-w-4xl mt-12 space-y-6">
          <div className="skeleton h-14 w-full rounded-2xl bg-card animate-pulse" />
          <KPISkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="skeleton h-60 rounded-2xl bg-card animate-pulse" />
            <div className="skeleton h-60 rounded-2xl bg-card animate-pulse" />
          </div>
        </div>
      </motion.div>
    );
  }

  if (error || !data) {
    return (
      <motion.div
        key="error-state"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen flex flex-col items-center justify-center text-center p-4 bg-background"
      >
        <SFIcon name="exclamationmark.triangle.fill" size="text-5xl" className="text-amber-400 mb-4 animate-pulse" />
        <p className={cn("text-amber-400 text-xl mb-3 font-semibold", TRACKING_HEADING_CLASS)}>A Critical Error Occurred</p>
        <p className="text-muted-foreground text-base max-w-lg">
          {typeof error === 'string' ? error : error?.message || "Data not ready."} Please ensure the backend server is running and accessible,
          then try refreshing the page.
        </p>
      </motion.div>
    );
  }

  return (
    <AppShell dbStats={dbStatsLabel}>
      {(activePage, setActivePage) => {
        const handlePageTickerSelect = (ticker: string) => {
          handleSelectTicker(ticker);
          setActivePage("ticker-detail");
        };

        return (
          <AnimatePresence mode="wait" initial={false}>
            {/* ══════ INTELLIGENCE ══════ */}
            {activePage === "intelligence" && (
              <motion.div
                key="intelligence"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h1 className={cn("text-2xl font-extrabold md:text-3xl flex items-center gap-3", TRACKING_HEADING_CLASS)}>
                    <SFIcon name="bolt.fill" size="text-3xl md:text-4xl" className="text-cyan-400" />
                    Momentum Intelligence
                  </h1>
                  <div className="flex items-center gap-3">
                    <LazyTickerSearch
                      onSelectTicker={handlePageTickerSelect}
                      onDataRefresh={refresh}
                    />
                    <div className="flex items-center gap-3 bg-cyan-500/10 border border-cyan-500/25 rounded-full px-3 py-1 text-cyan-400 text-xs font-semibold tracking-[0.1em] uppercase">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse-glow" />
                      {pipeline.connected ? "Live" : "Offline"}
                    </div>
                  </div>
                </div>

                {/* Quote — instant, always available */}
                {data.all_quotes?.length > 0 && (
                  <Card className="mb-4 p-3">
                    <QuoteRotator quotes={data.all_quotes} />
                  </Card>
                )}

                {/* KPI Strip — Tier 1 progressive reveal */}
                <DataReveal
                  loading={tierLoading.summary && kpiStripItems.length === 0}
                  skeleton={<KPISkeleton />}
                  className="mb-4"
                >
                  <KPIStrip className="" items={kpiStripItems} />
                </DataReveal>

                {/* Leaderboard + Top Signals — Tier 2 progressive reveal */}
                <DataReveal
                  loading={tierLoading.signals && !data.signals?.length}
                  skeleton={<div className="grid grid-cols-1 lg:grid-cols-2 gap-3"><SectionSkeleton rows={5} /><SectionSkeleton rows={5} /></div>}
                  className="mb-4"
                  delay={100}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <LazyLeaderboard signals={data.signals} onSelectTicker={handlePageTickerSelect} />
                    <LazyTopSignals signals={data.signals} onSelectTicker={handlePageTickerSelect} />
                  </div>
                </DataReveal>

                {/* Fresh + Exhausting mini-cards — staggered reveal */}
                <DataReveal
                  loading={tierLoading.signals && !data.signals?.length}
                  skeleton={<div className="grid grid-cols-1 lg:grid-cols-2 gap-3"><SectionSkeleton rows={3} /><SectionSkeleton rows={3} /></div>}
                  className="mb-4"
                  delay={200}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <LazyMiniSignalList title="Fresh Momentum" icon="leaf.fill" signals={data.fresh_momentum || []} onSelectTicker={handlePageTickerSelect} />
                    <LazyMiniSignalList title="Exhausting Signals" icon="flame.fill" signals={data.exhausting_momentum || []} onSelectTicker={handlePageTickerSelect} />
                  </div>
                </DataReveal>

                {/* Hidden Gems Preview */}
                {(data.hidden_gems || []).length > 0 && (
                  <CardReveal
                    loading={false}
                    className="mb-4"
                    delay={300}
                  >
                    <Card className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className={cn("text-base font-bold md:text-lg flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                          <SFIcon name="diamond.fill" size="text-lg" className="text-cyan-400" /> Hidden Gems — Underrated Picks
                        </h2>
                        <AppleButton
                          variant="ghost"
                          size="sm"
                          className="text-cyan-400 hover:text-cyan-300"
                          onClick={() => setActivePage("hidden-gems")}
                          glowColor="cyan"
                        >
                          View All <span className="ml-1 text-sm font-semibold">→</span>
                        </AppleButton>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4 text-balance">
                        Strong momentum + high probability, but haven&apos;t moved much yet — the market hasn&apos;t priced it in.
                      </p>
                      <div className="space-y-1">
                        {(data.hidden_gems || []).slice(0, 5).map((s: typeof data.signals[0], i: number) => (
                          <motion.div
                            key={s.ticker}
                            className="flex items-center justify-between py-3 cursor-pointer rounded-xl px-2 -mx-2 hover:bg-white/5"
                            onClick={() => handlePageTickerSelect(s.ticker)}
                            whileHover={LIST_ITEM_HOVER_MOTION_PROPS}
                            transition={SPRING_TRANSITION_PROPS}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            // @ts-expect-error framer-motion transition accepts delay
                            transitionDelay={`${i * 60}ms`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-cyan-400 font-mono-data text-base w-14">{s.ticker}</span>
                              <span className="text-xs text-muted-foreground/80 max-w-[120px] truncate">{s.sector}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono-data text-sm font-semibold">{s.composite.toFixed(2)}</span>
                              <span className={cn("font-mono-data text-xs font-semibold", s.probability > 60 ? "text-emerald-400" : "text-amber-400")}>
                                {s.probability}%
                              </span>
                              <span className={cn("font-mono-data text-xs font-semibold", s.daily_change > 0 ? "text-emerald-400" : s.daily_change < 0 ? "text-rose-400" : "text-slate-400")}>
                                {s.daily_change > 0 ? '+' : ''}{s.daily_change}%
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </Card>
                  </CardReveal>
                )}

                {/* Sector Regime Heatmap */}
                <CardReveal loading={!data.sector_regimes} delay={400}>
                  <Card className="p-3">
                    <h2 className={cn("text-base font-bold md:text-lg mb-3 flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                      <SFIcon name="globe.americas.fill" size="text-lg" className="text-cyan-400" /> Sector Regime Heatmap
                    </h2>
                    <LazySectorHeatmap
                      sectors={data.sector_regimes}
                      sentiment={data.sector_sentiment}
                    />
                  </Card>
                </CardReveal>
              </motion.div>
            )}

            {/* ══════ SIGNALS & STRATEGIES ══════ */}
            {activePage === "signals" && (
              <motion.div
                key="signals"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12 overflow-x-hidden"
              >
                <h1 className={cn("text-2xl font-extrabold md:text-3xl mb-4 flex items-center gap-3", TRACKING_HEADING_CLASS)}>
                  <SFIcon name="radar.fill" size="text-3xl md:text-4xl" className="text-cyan-400" />
                  Signals & Strategies
                </h1>

                <DataReveal
                  loading={tierLoading.signals && !data.signals?.length}
                  skeleton={<SectionSkeleton rows={10} />}
                  className="mb-4"
                >
                  <LazySignalTable
                    signals={sortedSignals}
                    sortBy={sortBy}
                    sortAsc={sortAsc}
                    onSort={setSortBy}
                    onSelectTicker={handlePageTickerSelect}
                    selectedTicker={selectedTicker}
                  />
                </DataReveal>

                <h2 className={cn("text-base font-bold md:text-lg mb-3 flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                  <SFIcon name="chess.piece.queen.fill" size="text-lg" className="text-cyan-400" /> Trading Strategies
                </h2>
                <DataReveal
                  loading={!data.strategies?.length}
                  skeleton={<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">{Array.from({length: 6}).map((_, i) => <SectionSkeleton key={i} rows={2} />)}</div>}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                    {data.strategies.map((s) => (
                      <LazyStrategyCard key={s.ticker} strategy={s} />
                    ))}
                  </div>
                </DataReveal>
              </motion.div>
            )}

            {/* ══════ SECTOR INTELLIGENCE ══════ */}
            {activePage === "sector-intel" && (
              <motion.div
                key="sector-intel"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <h1 className={cn("text-2xl font-extrabold md:text-3xl mb-4 flex items-center gap-3", TRACKING_HEADING_CLASS)}>
                  <SFIcon name="antenna.radiowaves.left.and.right" size="text-3xl md:text-4xl" className="text-cyan-400" />
                  Sector Intelligence
                </h1>
                <CardReveal loading={!data.sector_regimes} className="mb-4">
                  <Card className="border-cyan-500/20 shadow-lg shadow-cyan-500/5 p-3">
                    <h2 className={cn("text-base font-bold md:text-lg mb-3 flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                      <SFIcon name="globe.americas.fill" size="text-lg" className="text-cyan-400" /> Sector Regime Heatmap
                      <span className="text-xs text-muted-foreground font-normal tracking-normal ml-2">— Real-time regime classification</span>
                    </h2>
                    <LazySectorHeatmap
                      sectors={data.sector_regimes}
                      sentiment={data.sector_sentiment}
                    />
                  </Card>
                </CardReveal>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <LazyTrendingSectors sectors={data.sector_regimes} sentiment={data.sector_sentiment} />
                  <LazyRotationSignals rotationIdeas={data.rotation_ideas || []} />
                </div>
              </motion.div>
            )}

            {/* ══════ TICKER DETAIL ══════ */}
            {activePage === "ticker-detail" && (
              <motion.div
                key="ticker-detail"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h1 className={cn("text-2xl font-extrabold md:text-3xl flex items-center gap-3", TRACKING_HEADING_CLASS)}>
                    <SFIcon name="chart.bar.fill" size="text-3xl md:text-4xl" className="text-cyan-400" /> Ticker Detail
                    {selectedTicker && <span className="text-cyan-400 font-mono-data text-2xl md:text-3xl tracking-normal ml-1">— {selectedTicker}</span>}
                  </h1>
                  <div className="flex items-center gap-3">
                    <LazyTickerSearch
                      onSelectTicker={handlePageTickerSelect}
                      onDataRefresh={refresh}
                    />
                    <Select onValueChange={handleSelectTicker} value={selectedTicker || ""}>
                      <SelectTrigger className="w-[120px] lg:w-[150px] font-mono-data rounded-xl border border-white/10 bg-card/60 backdrop-blur-md">
                        <SelectValue placeholder="Select Ticker" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border border-white/10 bg-card/80 backdrop-blur-lg">
                        {data.signals.map((s) => (
                          <SelectItem key={s.ticker} value={s.ticker} className="rounded-lg">
                            {s.ticker}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedSignal && (
                  <DataReveal loading={false} className="mb-8">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-3">
                      {([
                        { label: "Price", value: `$${selectedSignal.price.toFixed(2)}`, color: "cyan", font: "font-mono-data" },
                        { label: "Composite", value: selectedSignal.composite.toFixed(2), color: selectedSignal.composite > 0 ? "emerald" : "rose", font: "font-mono-data" },
                        { label: "Probability", value: `${selectedSignal.probability}%`, color: "amber", font: "font-mono-data" },
                        { label: "S1", value: selectedSignal.sys1_score.toFixed(1), color: selectedSignal.sys1_score > 0 ? "emerald" : selectedSignal.sys1_score < 0 ? "rose" : "slate", font: "font-mono-data" },
                        { label: "S2", value: selectedSignal.sys2_score.toFixed(1), color: selectedSignal.sys2_score > 0 ? "emerald" : selectedSignal.sys2_score < 0 ? "rose" : "slate", font: "font-mono-data" },
                        { label: "S3", value: selectedSignal.sys3_score.toFixed(1), color: selectedSignal.sys3_score > 0 ? "emerald" : selectedSignal.sys3_score < 0 ? "rose" : "slate", font: "font-mono-data" },
                        { label: "S4", value: selectedSignal.sys4_score.toFixed(1), color: selectedSignal.sys4_score > 0 ? "emerald" : selectedSignal.sys4_score < 0 ? "rose" : "slate", font: "font-mono-data" },
                        { label: "Regime", value: selectedSignal.regime, color: selectedSignal.regime === "Trending" ? "cyan" : "violet", font: "font-inter" },
                        { label: "Δ Day", value: `${selectedSignal.daily_change > 0 ? "+" : ""}${selectedSignal.daily_change}%`, color: selectedSignal.daily_change > 0 ? "emerald" : "rose", font: "font-mono-data" },
                        { label: "Sector", value: selectedSignal.sector, color: "slate", font: "font-inter" },
                      ] as StatItem[]).map((stat) => (
                        <Card
                          key={stat.label}
                          className="flex flex-col justify-center items-center text-center px-3 py-2 border border-transparent"
                          whileHover={CARD_HOVER_MOTION_PROPS}
                          transition={SPRING_TRANSITION_PROPS}
                        >
                          <div className={cn("text-base font-bold", stat.font, getTextColorClass(stat.color))}>
                            {stat.value}
                          </div>
                          <div className="text-xs text-muted-foreground uppercase tracking-[0.1em] mt-0.5 whitespace-nowrap">{stat.label}</div>
                        </Card>
                      ))}
                    </div>
                  </DataReveal>
                )}

                {/* Charts — loaded on-demand per ticker */}
                {selectedTicker && (
                  <DataReveal
                    loading={chartLoading === selectedTicker || (!selectedChart && !!selectedTicker)}
                    skeleton={
                      <div className="space-y-6">
                        <ChartSkeleton />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <ChartSkeleton />
                          <ChartSkeleton />
                        </div>
                      </div>
                    }
                  >
                    {selectedChart && (
                      <div className="space-y-6">
                        {/* Price + HMA + Candlestick */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <Card className="p-3">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-2">Price + Hull MA</h3>
                            <LazyPriceChart ticker={selectedTicker} data={selectedChart} className="h-[260px]" />
                          </Card>
                          <Card className="p-3">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-2">6M Candlestick</h3>
                            <LazyCandlestickChart ticker={selectedTicker} data={selectedChart} className="h-[260px]" />
                          </Card>
                        </div>

                        {/* ADX + Stochastics row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <Card className="p-5">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-3">ADX / +DI / −DI</h3>
                            <LazyIndicatorChart
                              dates={selectedChart.dates}
                              lines={[
                                { label: "ADX", data: selectedChart.adx, color: COLORS.amber, width: 1.5 },
                                { label: "+DI", data: selectedChart.plus_di, color: COLORS.emerald, width: 1 },
                                { label: "−DI", data: selectedChart.minus_di, color: COLORS.rose, width: 1 },
                              ]}
                              horizontalLines={[{ value: 25, color: "rgba(148,163,184,0.2)" }]}
                              className="h-[260px]"
                            />
                          </Card>
                          <Card className="p-5">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-3">Full Stochastics</h3>
                            <LazyIndicatorChart
                              dates={selectedChart.dates}
                              lines={[
                                { label: "%K", data: selectedChart.stoch_k, color: COLORS.cyan, width: 1.5 },
                                { label: "%D", data: selectedChart.stoch_d, color: COLORS.orange, width: 1.5, dash: true },
                              ]}
                              horizontalLines={[
                                { value: 80, color: "rgba(244,63,94,0.2)" },
                                { value: 20, color: "rgba(16,185,129,0.2)" },
                              ]}
                              className="h-[260px]"
                            />
                          </Card>
                        </div>

                        {/* Elder Impulse + TRIX row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <Card className="p-5">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-3">Elder Impulse</h3>
                            <LazyElderChart
                              dates={selectedChart.dates}
                              macdHist={selectedChart.macd_hist}
                              elderColors={selectedChart.elder_colors}
                              className="h-[260px]"
                            />
                          </Card>
                          <Card className="p-5">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-3">TRIX</h3>
                            <LazyIndicatorChart
                              dates={selectedChart.dates}
                              lines={[
                                { label: "TRIX", data: selectedChart.trix, color: COLORS.violet, width: 1.5 },
                                { label: "Signal", data: selectedChart.trix_signal, color: COLORS.amber, width: 1.5, dash: true },
                              ]}
                              horizontalLines={[{ value: 0, color: "rgba(148,163,184,0.2)" }]}
                              className="h-[260px]"
                            />
                          </Card>
                        </div>
                      </div>
                    )}
                  </DataReveal>
                )}
              </motion.div>
            )}

            {/* ══════ SCREENER PAGES (all 10 + hidden gems) ══════ */}
            {Object.keys(SCREENER_MAP).includes(activePage) && (
              <motion.div
                key={activePage}
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                {/* Research info for this screener */}
                <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-gradient-to-r from-cyan-500/[0.04] to-violet-500/[0.04] border border-white/[0.04] px-4 py-3">
                  <SFIcon icon="info.circle.fill" size={14} className="text-cyan-400/60 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground/60 leading-relaxed">
                    {SCREENER_MAP[activePage].info}
                  </p>
                </div>
                <DataReveal loading={!data.signals?.length} skeleton={<SectionSkeleton rows={8} />}>
                  <LazyScreenerTable
                    data={(data as unknown as Record<string, unknown[]>)[SCREENER_MAP[activePage].key] as typeof data.signals || []}
                    title={SCREENER_MAP[activePage].title}
                    icon={SCREENER_MAP[activePage].icon}
                    onSelectTicker={handlePageTickerSelect}
                  />
                </DataReveal>
              </motion.div>
            )}

            {/* ══════ HIGH YIELD ETFs ══════ */}
            {activePage === "yield-etfs" && (
              <motion.div
                key="yield-etfs"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <DataReveal loading={!data.high_yield_etfs?.length} skeleton={<SectionSkeleton rows={8} />}>
                  <LazyYieldTable
                    data={data.high_yield_etfs || []}
                    title="High Yield ETFs"
                    icon="chart.line.uptrend.rectangle.fill"
                    onSelectTicker={handlePageTickerSelect}
                  />
                </DataReveal>
              </motion.div>
            )}

            {/* ══════ DIVIDEND STOCKS ══════ */}
            {activePage === "dividend-stocks" && (
              <motion.div
                key="dividend-stocks"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <DataReveal loading={!data.dividend_stocks?.length} skeleton={<SectionSkeleton rows={8} />}>
                  <LazyYieldTable
                    data={data.dividend_stocks || []}
                    title="Dividend Stocks — Aristocrats & Kings"
                    icon="dollarsign.square.fill"
                    onSelectTicker={handlePageTickerSelect}
                  />
                </DataReveal>
              </motion.div>
            )}

            {/* ══════ PORTFOLIO INTELLIGENCE ══════ */}
            {activePage === "portfolio-intel" && (
              <motion.div
                key="portfolio-intel"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <LazyPortfolioIntelligence
                  signalTickers={sortedSignals?.map((s: { ticker: string }) => s.ticker) || []}
                />
              </motion.div>
            )}

            {/* ══════ STRATEGY BUILDER ══════ */}
            {activePage === "strategy" && (
              <motion.div
                key="strategy"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <LazyStrategyBuilder />
              </motion.div>
            )}

            {/* ══════ VECTOR MAP ══════ */}
            {activePage === "vector-map" && (
              <motion.div
                key="vector-map"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <Card className="p-6 text-center">
                  <SFIcon name="hand.wave.fill" size="text-4xl" className="text-cyan-400 mb-2" />
                  <p className={cn("text-muted-foreground text-base font-semibold", TRACKING_HEADING_CLASS)}>Coming soon — a visual map of momentum vectors.</p>
                  <p className="text-muted-foreground/60 text-xs mt-1.5 max-w-lg mx-auto">
                    Our team is meticulously crafting an immersive and insightful market visualization. Stay tuned!
                  </p>
                </Card>
              </motion.div>
            )}

            {/* ══════ EARNINGS GROWERS ══════ */}
            {activePage === "earnings-growers" && (
              <motion.div
                key="earnings-growers"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <Card className="p-6 text-center">
                  <SFIcon name="chart.line.uptrend.xyaxis" size="text-4xl" className="text-emerald-400 mb-2" />
                  <p className={cn("text-foreground text-lg font-bold mb-2", TRACKING_HEADING_CLASS)}>Consistent Earnings & Revenue Growth</p>
                  <p className="text-muted-foreground/60 text-sm max-w-lg mx-auto mb-4">
                    This scanner discovers S&P Composite 1500 symbols with 5 consecutive quarters of strong revenue and EBITDA growth — perfect for long-term holds.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mb-4">
                    {["Fundamentals", "Revenue Growth", "EBITDA Growth", "Long Term"].map(t => (
                      <span key={t} className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold uppercase tracking-wider">{t}</span>
                    ))}
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 text-xs font-medium">
                    <SFIcon name="clock.fill" size="text-sm" />
                    Coming Soon — Requires quarterly financials pipeline
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        );
      }}
    </AppShell>
  );
});

DashboardPage.displayName = "DashboardPage";

export default DashboardPage;