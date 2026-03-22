"use client";

import React, { memo, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/app-shell";
import { KPIStrip } from "@/components/momentum/kpi-strip";
import { QuoteRotator } from "@/components/momentum/quote-rotator";
import { useProgressiveData } from "@/hooks/use-progressive-data";
import { usePipelineStatus } from "@/hooks/use-pipeline-status";
import { useHybridPrediction } from "@/hooks/use-hybrid-prediction";
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
import { ConvictionBadge, ActionBadge, getTierConfig } from "@/components/momentum/conviction-badge";

// ── Lazy-loaded heavy components (code-split per page) ──────────────────────
const LazySignalTable = dynamic(() => import('@/components/momentum/signal-table').then(m => ({ default: m.SignalTable })), { ssr: false });
const LazyStrategyCard = dynamic(() => import('@/components/momentum/strategy-card').then(m => ({ default: m.StrategyCard })), { ssr: false });
const LazyLeaderboard = dynamic(() => import('@/components/momentum/leaderboard').then(m => ({ default: m.Leaderboard })), { ssr: false });
const LazyTopSignals = dynamic(() => import('@/components/momentum/top-signals').then(m => ({ default: m.TopSignals })), { ssr: false });
const LazyMiniSignalList = dynamic(() => import('@/components/momentum/mini-signal-list').then(m => ({ default: m.MiniSignalList })), { ssr: false });
const LazyTickerSearch = dynamic(() => import('@/components/momentum/ticker-search').then(m => ({ default: m.TickerSearch })), { ssr: false });
const LazyStrategyBuilder = dynamic(() => import('@/components/momentum/strategy-builder').then(m => ({ default: m.StrategyBuilder })), { ssr: false });
const LazySectorHeatmap = dynamic(() => import('@/components/momentum/sector-heatmap').then(m => ({ default: m.SectorHeatmap })), { ssr: false });
const LazyPortfolioIntelligence = dynamic(() => import('@/components/momentum/portfolio-intelligence').then(m => ({ default: m.PortfolioIntelligence })), { ssr: false });
const LazyInsiderBuying = dynamic(() => import('@/components/momentum/insider-buying').then(m => ({ default: m.InsiderBuying })), { ssr: false });
const LazyCandlestickChart = dynamic(() => import('@/components/charts/candlestick-chart').then(m => ({ default: m.CandlestickChart })), { ssr: false });
// New consolidated tabbed components
const LazyMomentumLifecycle = dynamic(() => import('@/components/momentum/momentum-lifecycle').then(m => ({ default: m.MomentumLifecycle })), { ssr: false });
const LazyAnomalyDetector = dynamic(() => import('@/components/momentum/anomaly-detector').then(m => ({ default: m.AnomalyDetector })), { ssr: false });
const LazyHiddenAlpha = dynamic(() => import('@/components/momentum/hidden-alpha').then(m => ({ default: m.HiddenAlpha })), { ssr: false });
const LazySectorRadar = dynamic(() => import('@/components/momentum/sector-radar').then(m => ({ default: m.SectorRadar })), { ssr: false });
const LazyIncomeEngine = dynamic(() => import('@/components/momentum/income-engine').then(m => ({ default: m.IncomeEngine })), { ssr: false });
const LazyMlPredictionPanel = dynamic(() => import('@/components/momentum/ml-prediction-panel').then(m => ({ default: m.MlPredictionPanel })), { ssr: false });
const LazyWeeklyMomentumPanel = dynamic(() => import('@/components/momentum/weekly-momentum-panel').then(m => ({ default: m.WeeklyMomentumPanel })), { ssr: false });
import { ResearchCardGrid } from "@/components/momentum/research-card";
import { DailyMovers } from "@/components/momentum/daily-movers";

// ML Pipeline Sandbox — only these tickers have trained XGBoost predictions
const ML_SANDBOX_TICKERS = new Set(["WCP.TO", "BTE.TO", "PXT.TO", "CCO.TO", "IVN.TO"]);

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

  // Hybrid prediction — SSE streaming for XGBoost + Triage Gate
  // Only runs for tickers in the ML sandbox (5 tickers with trained model)
  const mlTicker = selectedTicker && ML_SANDBOX_TICKERS.has(selectedTicker) ? selectedTicker : null;
  const hybridPrediction = useHybridPrediction(mlTicker);

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
    let tierDist = data.summary.tier_distribution;

    // Fallback: compute tier counts from signals if tier_distribution is absent or all zeros
    if (!tierDist || Object.values(tierDist).every(v => !v)) {
      if (data.signals?.length) {
        const computed: Record<string, number> = {};
        for (const s of data.signals) {
          const tier = (s as any).conviction_tier;
          if (tier) computed[tier] = (computed[tier] || 0) + 1;
        }
        if (Object.keys(computed).length > 0) {
          tierDist = computed as any;
        }
      }
    }

    const td = tierDist ?? {};
    return [
      { label: "Universe", value: data.summary.total_screened, colorKey: "cyan" as PaletteColorKey },
      { label: "Ultra Conviction", value: td["Ultra Conviction"] ?? 0, colorKey: "amber" as PaletteColorKey },
      { label: "High Conviction", value: td["High Conviction"] ?? 0, colorKey: "emerald" as PaletteColorKey },
      { label: "Moderate", value: td["Moderate Conviction"] ?? 0, colorKey: "cyan" as PaletteColorKey },
      { label: "Low Conviction", value: td["Low Conviction"] ?? 0, colorKey: "slate" as PaletteColorKey },
      { label: "Contrarian", value: td["Contrarian"] ?? 0, colorKey: "rose" as PaletteColorKey },
    ];
  }, [data?.summary, data?.signals]);

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
            {/* ══════ MARKET PULSE (was Intelligence) ══════ */}
            {activePage === "market-pulse" && (
              <motion.div
                key="market-pulse"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h1 className="text-[20px] font-bold md:text-[24px] flex items-center gap-3 font-mono-data tracking-[0.06em] text-[#E8E8E8]">
                    <span className="text-[#00FF66]">⚡</span>
                    Market Pulse
                  </h1>
                  <div className="flex items-center gap-3">
                    <LazyTickerSearch
                      onSelectTicker={handlePageTickerSelect}
                      onDataRefresh={refresh}
                    />
                    <div className="flex items-center gap-2 bg-[#111111] border border-[#2A2A2A] rounded-[2px] px-2.5 py-1 text-[#00FF66] text-[10px] font-mono-data tracking-[0.1em] uppercase">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00FF66] ct-pulse" />
                      {pipeline.connected ? "LIVE" : "OFFLINE"}
                    </div>
                  </div>
                </div>

                {data.all_quotes?.length > 0 && (
                  <Card className="mb-4 p-3">
                    <QuoteRotator quotes={data.all_quotes} />
                  </Card>
                )}

                <DataReveal
                  loading={tierLoading.summary && kpiStripItems.length === 0}
                  skeleton={<KPISkeleton />}
                  className="mb-4"
                >
                  <KPIStrip className="" items={kpiStripItems} />
                </DataReveal>

                {/* ── Research Cards (Moby.invest-style) ── */}
                {(data.top_picks?.length > 0) && (
                  <div className="mb-4">
                    <ResearchCardGrid
                      signals={data.top_picks || []}
                      title="HEADSTART RESEARCH"
                      subtitle="Highest conviction signals — multi-system agreement, trending regime, confirmed fresh momentum"
                      maxCards={6}
                      onViewChart={handlePageTickerSelect}
                      onViewDetail={handlePageTickerSelect}
                    />
                  </div>
                )}

                {/* ── Daily Movers ── */}
                {data.signals?.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-[13px] font-bold text-[#E8E8E8] font-mono-data tracking-[0.08em] uppercase flex items-center gap-2 mb-3">
                      <span className="text-[#FFD600]">◆</span> DAILY MOVERS
                    </h2>
                    <DailyMovers signals={data.signals} maxItems={5} />
                  </div>
                )}

                {/* Two-column layout: main content + weekly panel */}
                <div className="flex flex-col xl:flex-row gap-4">
                  {/* Left: main Market Pulse content */}
                  <div className="flex-1 min-w-0 space-y-4">
                    <DataReveal
                      loading={tierLoading.signals && !data.signals?.length}
                      skeleton={<div className="grid grid-cols-1 lg:grid-cols-2 gap-3"><SectionSkeleton rows={5} /><SectionSkeleton rows={5} /></div>}
                      delay={100}
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <LazyLeaderboard signals={data.signals} onSelectTicker={handlePageTickerSelect} />
                        <LazyTopSignals signals={data.signals} onSelectTicker={handlePageTickerSelect} />
                      </div>
                    </DataReveal>

                    <DataReveal
                      loading={tierLoading.signals && !data.signals?.length}
                      skeleton={<div className="grid grid-cols-1 lg:grid-cols-2 gap-3"><SectionSkeleton rows={3} /><SectionSkeleton rows={3} /></div>}
                      delay={200}
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <LazyMiniSignalList title="Fresh Momentum" icon="leaf.fill" signals={data.fresh_momentum || []} onSelectTicker={handlePageTickerSelect} />
                        <LazyMiniSignalList title="Exhausting Signals" icon="flame.fill" signals={data.exhausting_momentum || []} onSelectTicker={handlePageTickerSelect} />
                      </div>
                    </DataReveal>

                    {(data.hidden_gems || []).length > 0 && (
                      <CardReveal loading={false} delay={300}>
                        <Card className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h2 className={cn("text-base font-bold md:text-lg flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                              <SFIcon name="diamond.fill" size="text-lg" className="text-cyan-400" /> Hidden Gems — Underrated Picks
                            </h2>
                            <AppleButton variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300" onClick={() => setActivePage("hidden-alpha")} glowColor="cyan">
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
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ ...SPRING_TRANSITION_PROPS, delay: i * 0.06 }}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-bold text-cyan-400 font-mono-data text-base w-14">{s.ticker}</span>
                                  <span className="text-xs text-muted-foreground/80 max-w-[120px] truncate">{s.sector}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono-data text-sm font-semibold">{s.composite.toFixed(2)}</span>
                                  <span className={cn("font-mono-data text-xs font-semibold", s.probability > 60 ? "text-emerald-400" : "text-amber-400")}>{s.probability}%</span>
                                  <span className={cn("font-mono-data text-xs font-semibold", s.daily_change > 0 ? "text-emerald-400" : s.daily_change < 0 ? "text-rose-400" : "text-slate-400")}>{s.daily_change > 0 ? '+' : ''}{s.daily_change}%</span>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </Card>
                      </CardReveal>
                    )}

                    <CardReveal loading={!data.sector_regimes} delay={400}>
                      <Card className="p-3">
                        <h2 className={cn("text-base font-bold md:text-lg mb-3 flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                          <SFIcon name="globe.americas.fill" size="text-lg" className="text-cyan-400" /> Sector Regime Heatmap
                        </h2>
                        <LazySectorHeatmap sectors={data.sector_regimes} sentiment={data.sector_sentiment} />
                      </Card>
                    </CardReveal>
                  </div>

                  {/* Right: Weekly Top Momentum Panel (sticky on desktop) */}
                  <div className="xl:w-[300px] xl:shrink-0">
                    <div className="xl:sticky xl:top-[90px]">
                      <LazyWeeklyMomentumPanel onSelectTicker={handlePageTickerSelect} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══════ SIGNALS & EVIDENCE ══════ */}
            {activePage === "signals" && (
              <motion.div
                key="signals"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12 overflow-x-hidden"
              >
                <h1 className={cn("text-2xl font-extrabold md:text-3xl mb-1 flex items-center gap-3", TRACKING_HEADING_CLASS)}>
                  <SFIcon name="radar.fill" size="text-3xl md:text-4xl" className="text-cyan-400" />
                  Signals & Evidence
                </h1>
                <p className="text-sm text-muted-foreground/60 mb-5">
                  Every signal, ranked by conviction. Click any row for the deep dive.
                </p>

                <DataReveal
                  loading={tierLoading.signals && !data.signals?.length}
                  skeleton={<SectionSkeleton rows={10} />}
                  className="mb-6"
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

                {/* Minimal divider */}
                <div className="border-t border-white/[0.04] my-6" />

                <h2 className={cn("text-lg font-bold mb-1 flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                  <SFIcon name="chess.piece.queen.fill" size="text-lg" className="text-cyan-400" /> Trade Ideas
                </h2>
                <p className="text-xs text-muted-foreground/50 mb-4">Actionable setups with context, entries, and risk levels.</p>
                <DataReveal
                  loading={!data.strategies?.length}
                  skeleton={<div className="grid grid-cols-1 md:grid-cols-2 gap-2">{Array.from({length: 4}).map((_, i) => <SectionSkeleton key={i} rows={2} />)}</div>}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {data.strategies.map((s) => (
                      <LazyStrategyCard key={s.ticker} strategy={s} />
                    ))}
                  </div>
                </DataReveal>
              </motion.div>
            )}

            {/* ══════ SECTOR RADAR ══════ */}
            {activePage === "sector-radar" && (
              <motion.div
                key="sector-radar"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <LazySectorRadar
                  sectorRegimes={data.sector_regimes}
                  sectorSentiment={data.sector_sentiment}
                  rotationIdeas={data.rotation_ideas || []}
                  shockClusters={(data as any).shock_clusters || []}
                  onSelectTicker={handlePageTickerSelect}
                />
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

                {/* ML Prediction Panel — XGBoost + Triage Gate (sandbox tickers only) */}
                {selectedTicker && ML_SANDBOX_TICKERS.has(selectedTicker) && (
                  <div className="mb-6">
                    <LazyMlPredictionPanel
                      step={hybridPrediction.step}
                      stepLabel={hybridPrediction.stepLabel}
                      mlResult={hybridPrediction.mlResult}
                      isAnomaly={hybridPrediction.isAnomaly}
                      isComplete={hybridPrediction.isComplete}
                      isLoading={hybridPrediction.isLoading}
                      isStreaming={hybridPrediction.isStreaming}
                    />
                  </div>
                )}

                {/* Charts — loaded on-demand per ticker */}
                {selectedTicker && (() => {
                  const isChartLoading = chartLoading === selectedTicker;
                  const hasChartData = selectedChart && selectedChart.dates && selectedChart.dates.length > 0;
                  const chartFailed = selectedChart && (!selectedChart.dates || selectedChart.dates.length === 0);

                  if (isChartLoading) {
                    return (
                      <div className="space-y-6">
                        <ChartSkeleton />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <ChartSkeleton />
                          <ChartSkeleton />
                        </div>
                      </div>
                    );
                  }

                  if (chartFailed) {
                    return (
                      <Card className="p-8 text-center border border-white/[0.04]">
                        <SFIcon name="chart.line.downtrend.xyaxis" size={24} className="text-muted-foreground/20 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground/40 font-medium">Chart data unavailable for {selectedTicker}</p>
                        <p className="text-xs text-muted-foreground/25 mt-1">This ticker may not be in the screener universe yet.</p>
                      </Card>
                    );
                  }

                  if (!hasChartData) return null;

                  return (
                    <DataReveal loading={false} skeleton={<ChartSkeleton />}>
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
                    </DataReveal>
                  );
                })()}
              </motion.div>
            )}

            {/* ══════ MOMENTUM LIFECYCLE ══════ */}
            {activePage === "momentum-lifecycle" && (
              <motion.div
                key="momentum-lifecycle"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <LazyMomentumLifecycle data={data as any} onSelectTicker={handlePageTickerSelect} />
              </motion.div>
            )}

            {/* ══════ ANOMALY DETECTOR ══════ */}
            {activePage === "anomaly-detector" && (
              <motion.div
                key="anomaly-detector"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <LazyAnomalyDetector data={data as any} onSelectTicker={handlePageTickerSelect} />
              </motion.div>
            )}

            {/* ══════ HIDDEN ALPHA ══════ */}
            {activePage === "hidden-alpha" && (
              <motion.div
                key="hidden-alpha"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <LazyHiddenAlpha data={data as any} onSelectTicker={handlePageTickerSelect} />
              </motion.div>
            )}

            {/* ══════ INCOME ENGINE ══════ */}
            {activePage === "income-engine" && (
              <motion.div
                key="income-engine"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <LazyIncomeEngine data={data as any} onSelectTicker={handlePageTickerSelect} />
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

            {/* ══════ INSIDER BUYING ══════ */}
            {activePage === "insider-buys" && (
              <motion.div
                key="insider-buys"
                {...PAGE_MOTION_VARIANTS}
                className="pt-4 md:pt-6 pb-8 md:pb-12"
              >
                <LazyInsiderBuying onSelectTicker={handlePageTickerSelect} />
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