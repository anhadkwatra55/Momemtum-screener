"use client";

import React, { useState, memo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { SFIcon } from "@/components/ui/SFIcon";
import { TRACKING_HEADING_CLASS, SPRING_TRANSITION_PROPS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { DataReveal } from "@/components/ui/data-reveal";

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

interface SectorRadarProps {
  sectorRegimes: any;
  sectorSentiment: any;
  rotationIdeas: any[];
  shockClusters: any[];
  onSelectTicker: (ticker: string) => void;
}

export const SectorRadar = memo(({ sectorRegimes, sectorSentiment, rotationIdeas, shockClusters, onSelectTicker }: SectorRadarProps) => {
  const [activeTab, setActiveTab] = useState("regime");
  const currentTab = RADAR_TABS.find((t) => t.id === activeTab) || RADAR_TABS[0];

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
            onClick={() => setActiveTab(tab.id)}
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
      {activeTab === "regime" && (
        <>
          <DataReveal loading={!sectorRegimes}>
            <Card className="border-cyan-500/20 shadow-lg shadow-cyan-500/5 p-3 mb-4">
              <h2 className={cn("text-base font-bold md:text-lg mb-3 flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                <SFIcon name="globe.americas.fill" size="text-lg" className="text-cyan-400" /> Sector Regime Heatmap
              </h2>
              <LazySectorHeatmap sectors={sectorRegimes} sentiment={sectorSentiment} />
            </Card>
          </DataReveal>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <LazyTrendingSectors sectors={sectorRegimes} sentiment={sectorSentiment} />
            <LazyRotationSignals rotationIdeas={rotationIdeas || []} />
          </div>
        </>
      )}

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
