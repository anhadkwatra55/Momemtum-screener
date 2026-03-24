"use client";

import React, { useState, memo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { Signal } from "@/types/momentum";
import { cn } from "@/lib/utils";
import { SFIcon } from "@/components/ui/SFIcon";
import { TRACKING_HEADING_CLASS, SPRING_TRANSITION_PROPS } from "@/lib/constants";

const LazyScreenerTable = dynamic(
  () => import("@/components/momentum/screener-table").then((m) => ({ default: m.ScreenerTable })),
  { ssr: false }
);

interface Tab {
  id: string;
  label: string;
  icon: string;
  dataKey: string;
  description: string;
}

const LIFECYCLE_TABS: Tab[] = [
  {
    id: "fresh",
    label: "Birth",
    icon: "leaf.fill",
    dataKey: "fresh_momentum",
    description: "Early-stage momentum — Stochastic %K just crossed above %D below 70. Catching trends before they become crowded.",
  },
  {
    id: "continuation",
    label: "Growth",
    icon: "rocket.fill",
    dataKey: "continuation",
    description: "Sustained momentum — ADX strong, trending regime, all systems aligned with probability > 70%. Momentum that persists.",
  },
  {
    id: "bullish",
    label: "Bullish",
    icon: "arrow.up.right.circle.fill",
    dataKey: "bullish_momentum",
    description: "Full bullish alignment — positive composite, trending regime, MACD bullish, probability confirmation across all 4 systems.",
  },
  {
    id: "elite",
    label: "Elite",
    icon: "star.fill",
    dataKey: "momentum_95",
    description: "Highest-conviction picks — only stocks where all 4 systems produce probability ≥ 95%. Unanimous directional agreement.",
  },
  {
    id: "exhausting",
    label: "Exhaustion",
    icon: "flame.fill",
    dataKey: "exhausting_momentum",
    description: "Late-stage momentum — Stochastic %K above 80, overbought conditions that may reverse. Useful for profit-taking or hedging.",
  },
];

interface MomentumLifecycleProps {
  data: Record<string, Signal[]>;
  onSelectTicker: (ticker: string) => void;
}

export const MomentumLifecycle = memo(({ data, onSelectTicker }: MomentumLifecycleProps) => {
  const [activeTab, setActiveTab] = useState("fresh");
  const currentTab = LIFECYCLE_TABS.find((t) => t.id === activeTab) || LIFECYCLE_TABS[0];
  const currentData = (data[currentTab.dataKey] as Signal[]) || [];

  return (
    <>
      {/* Hero banner */}
      <div className="relative w-full h-32 md:h-40 rounded-2xl overflow-hidden mb-5">
        <Image src="/heroes/hero_momentum.png" alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-4 left-5">
          <h1 className={cn("text-2xl font-extrabold md:text-3xl text-foreground", TRACKING_HEADING_CLASS)}>
            Momentum Lifecycle
          </h1>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Every trend is born, lives, and dies. Know which phase you&apos;re in.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {LIFECYCLE_TABS.map((tab) => (
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
            {(data[tab.dataKey] as Signal[] || []).length > 0 && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-mono-data",
                activeTab === tab.id ? "bg-cyan-500/20 text-cyan-400" : "bg-white/[0.05] text-muted-foreground/40"
              )}>
                {(data[tab.dataKey] as Signal[] || []).length}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Phase description */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-gradient-to-r from-cyan-500/[0.04] to-violet-500/[0.04] border border-white/[0.04] px-4 py-3">
        <SFIcon icon="info.circle.fill" size={14} className="text-cyan-400/60 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground/60 leading-relaxed">{currentTab.description}</p>
      </div>

      <LazyScreenerTable
        data={currentData}
        title={currentTab.label}
        icon={currentTab.icon}
        onSelectTicker={onSelectTicker}
      />
    </>
  );
});

MomentumLifecycle.displayName = "MomentumLifecycle";
