"use client";

import React, { useState, memo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
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
  emoji: string;
  dataKey: string;
  description: string;
}

const HIDDEN_TABS: Tab[] = [
  {
    id: "gems",
    label: "Hidden Gems",
    icon: "diamond.fill",
    emoji: "💎",
    dataKey: "hidden_gems",
    description: "Strong composite + high probability, but haven't moved much yet — the market hasn't priced it in. Under-the-radar asymmetric plays.",
  },
  {
    id: "smart-money",
    label: "Smart Money",
    icon: "dollarsign.circle.fill",
    emoji: "🏦",
    dataKey: "smart_money",
    description: "Institutional accumulation patterns — rising volume with controlled price action, positive composite in Mean-Reverting regime. Large players building positions quietly.",
  },
  {
    id: "clusters",
    label: "Clusters",
    icon: "cube.fill",
    emoji: "🔬",
    dataKey: "momentum_clusters",
    description: "Groups of stocks within the same sector showing correlated momentum — sector-wide moves the crowd hasn't noticed yet.",
  },
];

interface HiddenAlphaProps {
  data: Record<string, Signal[]>;
  onSelectTicker: (ticker: string) => void;
}

export const HiddenAlpha = memo(({ data, onSelectTicker }: HiddenAlphaProps) => {
  const [activeTab, setActiveTab] = useState("gems");
  const currentTab = HIDDEN_TABS.find((t) => t.id === activeTab) || HIDDEN_TABS[0];
  const currentData = (data[currentTab.dataKey] as Signal[]) || [];

  return (
    <>
      <h1 className={cn("text-2xl font-extrabold md:text-3xl mb-1 flex items-center gap-3", TRACKING_HEADING_CLASS)}>
        <SFIcon name="diamond.fill" size="text-3xl md:text-4xl" className="text-cyan-400" />
        Hidden Alpha
      </h1>
      <p className="text-sm text-muted-foreground/60 mb-5">
        The best trades are the ones nobody&apos;s talking about.
      </p>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {HIDDEN_TABS.map((tab) => (
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
            <span className="text-base">{tab.emoji}</span>
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

      {/* Info banner */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500/[0.04] to-cyan-500/[0.04] border border-white/[0.04] px-4 py-3">
        <SFIcon icon="info.circle.fill" size={14} className="text-emerald-400/60 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground/60 leading-relaxed">{currentTab.description}</p>
      </div>

      <LazyScreenerTable
        data={currentData}
        title={`${currentTab.emoji} ${currentTab.label}`}
        icon={currentTab.icon}
        onSelectTicker={onSelectTicker}
      />
    </>
  );
});

HiddenAlpha.displayName = "HiddenAlpha";
