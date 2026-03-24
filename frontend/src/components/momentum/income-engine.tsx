"use client";

import React, { useState, memo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { YieldSignal } from "@/types/momentum";
import { cn } from "@/lib/utils";
import { SFIcon } from "@/components/ui/SFIcon";
import { TRACKING_HEADING_CLASS, SPRING_TRANSITION_PROPS } from "@/lib/constants";

const LazyYieldTable = dynamic(
  () => import("@/components/momentum/yield-table").then((m) => ({ default: m.YieldTable })),
  { ssr: false }
);

interface Tab {
  id: string;
  label: string;
  icon: string;
  dataKey: string;
  description: string;
}

const INCOME_TABS: Tab[] = [
  {
    id: "etfs",
    label: "High Yield ETFs",
    icon: "chart.line.uptrend.rectangle.fill",
    dataKey: "high_yield_etfs",
    description: "High-yield bond, dividend equity, REIT, and covered call ETFs — sorted by yield with momentum overlay for timing.",
  },
  {
    id: "dividends",
    label: "Dividend Stocks",
    icon: "dollarsign.square.fill",
    dataKey: "dividend_stocks",
    description: "Dividend aristocrats and kings — companies with decades of consecutive dividend increases. Cash flow that isn't an opinion.",
  },
];

interface IncomeEngineProps {
  data: Record<string, YieldSignal[]>;
  onSelectTicker: (ticker: string) => void;
}

export const IncomeEngine = memo(({ data, onSelectTicker }: IncomeEngineProps) => {
  const [activeTab, setActiveTab] = useState("etfs");
  const currentTab = INCOME_TABS.find((t) => t.id === activeTab) || INCOME_TABS[0];
  const currentData = (data[currentTab.dataKey] as YieldSignal[]) || [];

  return (
    <>
      {/* Hero banner */}
      <div className="relative w-full h-32 md:h-40 rounded-2xl overflow-hidden mb-5">
        <Image src="/heroes/hero_income.png" alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-4 left-5">
          <h1 className={cn("text-2xl font-extrabold md:text-3xl text-foreground", TRACKING_HEADING_CLASS)}>
            Income Engine
          </h1>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Cash flow is the only thing that isn&apos;t an opinion.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {INCOME_TABS.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all",
              activeTab === tab.id
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                : "text-muted-foreground/60 hover:text-foreground/80 hover:bg-white/[0.03] border border-transparent"
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={SPRING_TRANSITION_PROPS}
          >
            <SFIcon name={tab.icon} size="text-sm" className={activeTab === tab.id ? "text-amber-400" : "text-muted-foreground/40"} />
            {tab.label}
            {(data[tab.dataKey] as YieldSignal[] || []).length > 0 && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-mono-data",
                activeTab === tab.id ? "bg-amber-500/20 text-amber-400" : "bg-white/[0.05] text-muted-foreground/40"
              )}>
                {(data[tab.dataKey] as YieldSignal[] || []).length}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Info banner */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-gradient-to-r from-amber-500/[0.04] to-emerald-500/[0.04] border border-white/[0.04] px-4 py-3">
        <SFIcon icon="info.circle.fill" size={14} className="text-amber-400/60 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground/60 leading-relaxed">{currentTab.description}</p>
      </div>

      <LazyYieldTable
        data={currentData}
        title={currentTab.label}
        icon={currentTab.icon}
        onSelectTicker={onSelectTicker}
      />
    </>
  );
});

IncomeEngine.displayName = "IncomeEngine";
