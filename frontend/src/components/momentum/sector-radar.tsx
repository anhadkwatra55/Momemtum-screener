"use client";

import React, { useState, useMemo, useCallback, memo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import { cn, getTextColorClass, getBackgroundColorClass } from "@/lib/utils";
import { SFIcon } from "@/components/ui/SFIcon";
import { TRACKING_HEADING_CLASS, SPRING_TRANSITION_PROPS, UPPERCASE_LETTER_SPACING, DEFAULT_ACCENT_COLOR, PAGE_MOTION_VARIANTS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { DataReveal } from "@/components/ui/data-reveal";
import { RegimeBadge } from "./regime-badge";
import { ConvictionBadge } from "./conviction-badge";
import { AppleButton } from "@/components/ui/apple-button";
import type { Signal, SectorRegime, SectorSentiment } from "@/types/momentum";

const LazySectorHeatmap = dynamic(
  () => import("@/components/momentum/sector-heatmap").then((m) => ({ default: m.SectorHeatmap })),
  { ssr: false }
);
const LazyTrendingSectors = dynamic(
  () => import("@/components/momentum/trending-sectors").then((m) => ({ default: m.TrendingSectors })),
  { ssr: false }
);
const LazyRotationSignals = dynamic(
  () => import("@/components/momentum/rotation-signals").then((m) => ({ default: m.RotationSignals })),
  { ssr: false }
);
const LazyScreenerTable = dynamic(
  () => import("@/components/momentum/screener-table").then((m) => ({ default: m.ScreenerTable })),
  { ssr: false }
);

interface Tab {
  id: string;
  label: string;
  icon: string;
  description: string;
}

const RADAR_TABS: Tab[] = [
  {
    id: "regime",
    label: "Regime Map",
    icon: "globe.americas.fill",
    description: "Real-time sector regime classification — which sectors are trending, which are choppy, and where capital is flowing.",
  },
  {
    id: "rotation",
    label: "Rotation",
    icon: "tornado",
    description: "Sector rotation signals detected when tickers shift from Choppy to Trending (ADX > 25) — institutional capital flows into new sectors.",
  },
  {
    id: "shocks",
    label: "Shock Clusters",
    icon: "bolt.circle.fill",
    description: "Multiple momentum shocks in the same sector simultaneously — signals sector-level catalysts like earnings surprises or regulatory changes.",
  },
];

// ── Sector Drilldown Component ──────────────────────────────────────────────

interface SectorDrilldownProps {
  sectorName: string;
  regime: SectorRegime;
  sentiment: SectorSentiment | undefined;
  signals: Signal[];
  onBack: () => void;
  onSelectTicker: (ticker: string) => void;
}

const SectorDrilldown = memo(({ sectorName, regime, sentiment, signals, onBack, onSelectTicker }: SectorDrilldownProps) => {
  const s = sentiment || { bullish: 0, bearish: 0, neutral: 0 };
  const totalSentiment = s.bullish + s.bearish + s.neutral;

  // Compute conviction distribution from signals
  const convictionDist = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const sig of signals) {
      const tier = (sig as any).conviction_tier;
      if (tier) dist[tier] = (dist[tier] || 0) + 1;
    }
    return dist;
  }, [signals]);

  // Compute action distribution from signals
  const actionDist = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const sig of signals) {
      const action = (sig as any).action_category;
      if (action) dist[action] = (dist[action] || 0) + 1;
    }
    return dist;
  }, [signals]);

  // Sentiment distribution
  const sentimentDist = useMemo(() => {
    const dist: Record<string, number> = { bullish: 0, bearish: 0, neutral: 0 };
    for (const sig of signals) {
      const sent = sig.sentiment?.toLowerCase() || "";
      if (sent.includes("bullish")) dist.bullish++;
      else if (sent.includes("bearish")) dist.bearish++;
      else dist.neutral++;
    }
    return dist;
  }, [signals]);

  // Top movers
  const topMovers = useMemo(() => {
    return [...signals]
      .sort((a, b) => Math.abs(b.daily_change) - Math.abs(a.daily_change))
      .slice(0, 5);
  }, [signals]);

  // Average metrics
  const avgMetrics = useMemo(() => {
    if (signals.length === 0) return { avgComposite: 0, avgProb: 0, avgChange: 0, bullishPct: 0 };
    const avgComposite = signals.reduce((sum, s) => sum + (s.composite || 0), 0) / signals.length;
    const avgProb = signals.reduce((sum, s) => sum + (s.probability || 0), 0) / signals.length;
    const avgChange = signals.reduce((sum, s) => sum + (s.daily_change || 0), 0) / signals.length;
    const bullishCount = signals.filter(s => s.sentiment?.toLowerCase().includes("bullish")).length;
    const bullishPct = (bullishCount / signals.length) * 100;
    return { avgComposite, avgProb, avgChange, bullishPct };
  }, [signals]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {/* Back button + header */}
      <div className="flex items-center gap-3 mb-5">
        <AppleButton
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground gap-1.5"
          glowColor="cyan"
        >
          <SFIcon name="chevron.left" size="text-sm" />
          Back to Heatmap
        </AppleButton>
      </div>

      {/* Sector header card */}
      <Card className="border-cyan-500/20 shadow-lg shadow-cyan-500/5 p-5 mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <SFIcon name="building.2.fill" size="text-xl" className="text-cyan-400" />
            </div>
            <div>
              <h2 className={cn("text-xl font-extrabold md:text-2xl text-foreground", TRACKING_HEADING_CLASS)}>
                {sectorName}
              </h2>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {signals.length} ticker{signals.length !== 1 ? "s" : ""} in universe
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RegimeBadge regime={regime.regime} />
            {regime.regime === "Trending" && regime.avg_composite > 0.1 && (
              <span className={cn(
                "text-xs px-1.5 py-[0.1rem] rounded-full font-mono-data font-medium",
                `tracking-[${UPPERCASE_LETTER_SPACING}] uppercase whitespace-nowrap`,
                getTextColorClass(DEFAULT_ACCENT_COLOR, '400'),
                getBackgroundColorClass(DEFAULT_ACCENT_COLOR, '500', '10')
              )}>
                ∞ AURA
              </span>
            )}
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Avg Score", value: avgMetrics.avgComposite.toFixed(2), color: avgMetrics.avgComposite > 0 ? "emerald" : "rose" },
            { label: "Avg Probability", value: `${avgMetrics.avgProb.toFixed(0)}%`, color: "amber" },
            { label: "Avg Δ Day", value: `${avgMetrics.avgChange > 0 ? "+" : ""}${avgMetrics.avgChange.toFixed(2)}%`, color: avgMetrics.avgChange > 0 ? "emerald" : "rose" },
            { label: "Bullish %", value: `${avgMetrics.bullishPct.toFixed(0)}%`, color: avgMetrics.bullishPct > 50 ? "emerald" : "slate" },
            { label: "Tickers", value: `${signals.length}`, color: "cyan" },
            { label: "Regime", value: regime.regime, color: regime.regime === "Trending" ? "cyan" : regime.regime === "Mean-Reverting" ? "amber" : "slate" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center text-center px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
            >
              <div className={cn("text-base font-bold font-mono-data", getTextColorClass(stat.color))}>
                {stat.value}
              </div>
              <div className={cn("text-[10px] text-muted-foreground/60 uppercase mt-0.5 whitespace-nowrap", `tracking-[${UPPERCASE_LETTER_SPACING}]`)}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Two-column layout: sentiment + conviction + top movers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        {/* Sentiment breakdown */}
        <Card className="p-4">
          <h3 className={cn("text-sm font-bold uppercase mb-3 flex items-center gap-2", `tracking-[${UPPERCASE_LETTER_SPACING}]`)}>
            <SFIcon name="chart.pie.fill" size="text-sm" className="text-cyan-400" />
            Signal Sentiment
          </h3>
          <div className="space-y-2.5">
            {[
              { label: "Bullish", count: sentimentDist.bullish, color: "emerald" },
              { label: "Neutral", count: sentimentDist.neutral, color: "slate" },
              { label: "Bearish", count: sentimentDist.bearish, color: "rose" },
            ].map((item) => {
              const pct = signals.length > 0 ? (item.count / signals.length) * 100 : 0;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground/70 w-14 shrink-0">{item.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", getBackgroundColorClass(item.color))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={cn("text-xs font-mono-data font-semibold w-8 text-right", getTextColorClass(item.color))}>
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Conviction distribution */}
        <Card className="p-4">
          <h3 className={cn("text-sm font-bold uppercase mb-3 flex items-center gap-2", `tracking-[${UPPERCASE_LETTER_SPACING}]`)}>
            <SFIcon name="shield.checkered" size="text-sm" className="text-cyan-400" />
            Conviction Tiers
          </h3>
          {Object.keys(convictionDist).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(convictionDist)
                .sort(([, a], [, b]) => b - a)
                .map(([tier, count]) => (
                  <div key={tier} className="flex items-center justify-between gap-2">
                    <ConvictionBadge tier={tier} size="sm" />
                    <span className="text-xs font-mono-data font-semibold text-muted-foreground">{count}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/40 text-center py-4">No conviction data</p>
          )}
        </Card>

        {/* Top movers */}
        <Card className="p-4">
          <h3 className={cn("text-sm font-bold uppercase mb-3 flex items-center gap-2", `tracking-[${UPPERCASE_LETTER_SPACING}]`)}>
            <SFIcon name="flame.fill" size="text-sm" className="text-cyan-400" />
            Top Movers
          </h3>
          <div className="space-y-1">
            {topMovers.map((sig) => (
              <motion.div
                key={sig.ticker}
                className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg cursor-pointer hover:bg-white/[0.03] transition-colors"
                onClick={() => onSelectTicker(sig.ticker)}
                whileHover={{ x: 2 }}
                transition={SPRING_TRANSITION_PROPS}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-cyan-400 font-mono-data text-sm w-12">{sig.ticker}</span>
                  <span className="text-[10px] text-muted-foreground/50 truncate max-w-[80px]">{sig.regime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-data text-xs font-semibold">{sig.composite.toFixed(2)}</span>
                  <span className={cn(
                    "font-mono-data text-xs font-semibold min-w-[50px] text-right",
                    sig.daily_change > 0 ? "text-emerald-400" : sig.daily_change < 0 ? "text-rose-400" : "text-slate-400"
                  )}>
                    {sig.daily_change > 0 ? "+" : ""}{sig.daily_change.toFixed(2)}%
                  </span>
                </div>
              </motion.div>
            ))}
            {topMovers.length === 0 && (
              <p className="text-xs text-muted-foreground/40 text-center py-4">No tickers</p>
            )}
          </div>
        </Card>
      </div>

      {/* Full screener table for the sector */}
      <LazyScreenerTable
        data={signals}
        title={`${sectorName} — All Signals`}
        icon="building.2.fill"
        description={`All ${signals.length} tickers in the ${sectorName} sector, sorted by momentum score.`}
        onSelectTicker={onSelectTicker}
      />
    </motion.div>
  );
});
SectorDrilldown.displayName = "SectorDrilldown";

// ── Main SectorRadar Component ──────────────────────────────────────────────

interface SectorRadarProps {
  sectorRegimes: any;
  sectorSentiment: any;
  rotationIdeas: any[];
  shockClusters: any[];
  signals?: Signal[];
  onSelectTicker: (ticker: string) => void;
}

export const SectorRadar = memo(({ sectorRegimes, sectorSentiment, rotationIdeas, shockClusters, signals, onSelectTicker }: SectorRadarProps) => {
  const [activeTab, setActiveTab] = useState("regime");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const currentTab = RADAR_TABS.find((t) => t.id === activeTab) || RADAR_TABS[0];

  const handleSectorClick = useCallback((sectorName: string) => {
    setSelectedSector(sectorName);
  }, []);

  // Auto-open drilldown when navigated from market-pulse with ?sector=X
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sector = params.get("sector");
    if (sector && sectorRegimes?.[sector]) {
      setSelectedSector(sector);
      // Clean up the sector param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("sector");
      window.history.replaceState({}, "", url.toString());
    }
  }, [sectorRegimes]);

  const handleBack = useCallback(() => {
    setSelectedSector(null);
  }, []);

  // Filter signals for the selected sector
  const sectorSignals = useMemo(() => {
    if (!selectedSector || !signals) return [];
    return signals.filter((s) => s.sector === selectedSector);
  }, [selectedSector, signals]);

  // Get regime + sentiment for selected sector
  const selectedRegime = selectedSector ? sectorRegimes?.[selectedSector] : null;
  const selectedSentiment = selectedSector ? sectorSentiment?.[selectedSector] : undefined;

  return (
    <>
      {/* Hero banner */}
      <div className="relative w-full h-32 md:h-40 rounded-2xl overflow-hidden mb-5">
        <Image src="/heroes/hero_sector_radar.png" alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-4 left-5">
          <h1 className={cn("text-2xl font-extrabold md:text-3xl text-foreground", TRACKING_HEADING_CLASS)}>
            Sector Radar
          </h1>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Money doesn&apos;t appear — it rotates. Understand capital flows before picking stocks.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {RADAR_TABS.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedSector(null); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all",
              activeTab === tab.id
                ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25"
                : "text-muted-foreground/60 hover:text-foreground/80 hover:bg-white/[0.03] border border-transparent"
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={SPRING_TRANSITION_PROPS}
          >
            <SFIcon name={tab.icon} size="text-sm" className={activeTab === tab.id ? "text-cyan-400" : "text-muted-foreground/40"} />
            {tab.label}
          </motion.button>
        ))}
      </div>

      {/* Info banner */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-gradient-to-r from-cyan-500/[0.04] to-violet-500/[0.04] border border-white/[0.04] px-4 py-3">
        <SFIcon icon="info.circle.fill" size={14} className="text-cyan-400/60 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground/60 leading-relaxed">{currentTab.description}</p>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === "regime" && (
          selectedSector && selectedRegime ? (
            <SectorDrilldown
              key={`drilldown-${selectedSector}`}
              sectorName={selectedSector}
              regime={selectedRegime}
              sentiment={selectedSentiment}
              signals={sectorSignals}
              onBack={handleBack}
              onSelectTicker={onSelectTicker}
            />
          ) : (
            <motion.div
              key="regime-heatmap"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <DataReveal loading={!sectorRegimes}>
                <Card className="border-cyan-500/20 shadow-lg shadow-cyan-500/5 p-3 mb-4">
                  <h2 className={cn("text-base font-bold md:text-lg mb-3 flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                    <SFIcon name="globe.americas.fill" size="text-lg" className="text-cyan-400" /> Sector Regime Heatmap
                  </h2>
                  <LazySectorHeatmap
                    sectors={sectorRegimes}
                    sentiment={sectorSentiment}
                    onSectorClick={handleSectorClick}
                  />
                </Card>
              </DataReveal>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <LazyTrendingSectors sectors={sectorRegimes} sentiment={sectorSentiment} />
                <LazyRotationSignals rotationIdeas={rotationIdeas || []} />
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {activeTab === "rotation" && (
        <DataReveal loading={!rotationIdeas?.length}>
          <LazyScreenerTable
            data={rotationIdeas || []}
            title="Rotation Breakouts"
            icon="tornado"
            onSelectTicker={onSelectTicker}
          />
        </DataReveal>
      )}

      {activeTab === "shocks" && (
        <DataReveal loading={!shockClusters?.length}>
          <LazyScreenerTable
            data={shockClusters || []}
            title="Sector Shock Clusters"
            icon="bolt.circle.fill"
            onSelectTicker={onSelectTicker}
          />
        </DataReveal>
      )}
    </>
  );
});

SectorRadar.displayName = "SectorRadar";
