"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Signal, DashboardData } from "@/types/momentum";
import { ResearchCardGrid } from "@/components/momentum/research-card";
import { DailyMovers } from "@/components/momentum/daily-movers";

// ── Sector Pulse Widget ──
function SectorPulse({ sectorRegimes }: { sectorRegimes: Record<string, any> }) {
  if (!sectorRegimes || Object.keys(sectorRegimes).length === 0) return null;

  const sectors = Object.entries(sectorRegimes)
    .sort((a, b) => Math.abs(b[1].avg_composite) - Math.abs(a[1].avg_composite))
    .slice(0, 8);

  return (
    <div className="p-3 rounded-[4px]" style={{ background: "#111111", border: "1px solid #2A2A2A" }}>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#FFD600]" />
        <h3 className="text-[11px] font-mono-data uppercase tracking-[0.1em] text-[#6B6B6B]">
          Sector Pulse
        </h3>
      </div>
      <div className="space-y-1">
        {sectors.map(([name, regime]) => (
          <div
            key={name}
            className="flex items-center justify-between py-1.5 px-2 rounded-[2px] hover:bg-[#1C1C1C] transition-colors duration-[50ms]"
          >
            <span className="text-[12px] text-[#E8E8E8] font-mono-data">
              {name}
            </span>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-mono-data uppercase px-1.5 py-0.5 rounded-[2px]"
                style={{
                  color: regime.regime === "Trending" ? "#00FF66" : regime.regime === "Mean-Reverting" ? "#FFD600" : "#6B6B6B",
                  background: regime.regime === "Trending" ? "rgba(0,255,102,0.08)" : regime.regime === "Mean-Reverting" ? "rgba(255,214,0,0.08)" : "rgba(107,107,107,0.05)",
                  border: `1px solid ${regime.regime === "Trending" ? "#00FF6640" : regime.regime === "Mean-Reverting" ? "#FFD60040" : "#2A2A2A"}`,
                }}
              >
                {regime.regime}
              </span>
              <span
                className="text-[11px] font-mono-data font-bold"
                style={{
                  color: regime.avg_composite > 0 ? "#00FF66" : regime.avg_composite < 0 ? "#FF3333" : "#6B6B6B",
                }}
              >
                {regime.avg_composite > 0 ? "+" : ""}{regime.avg_composite}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Market Overview Bar ──
function MarketOverview({ data }: { data: DashboardData }) {
  const stats = useMemo(() => {
    if (!data?.summary) return [];
    const s = data.summary;
    const tierDist = s.tier_distribution || {};
    return [
      { label: "Universe", value: String(s.total_screened || 0), color: "#C0C0C0" },
      { label: "High Conv", value: String((tierDist["Ultra Conviction"] || 0) + (tierDist["High Conviction"] || 0)), color: "#00FF66" },
      { label: "Contrarian", value: String(tierDist["Contrarian"] || 0), color: "#FF3333" },
      { label: "Avg Prob", value: `${s.avg_probability || 0}%`, color: "#FFD600" },
    ];
  }, [data?.summary]);

  return (
    <div
      className="flex items-center gap-4 p-2.5 px-4 mb-4 rounded-[4px] overflow-x-auto"
      style={{ background: "#111111", border: "1px solid #2A2A2A" }}
    >
      <span className="text-[10px] font-mono-data uppercase tracking-[0.1em] text-[#6B6B6B] whitespace-nowrap">
        MARKET OVERVIEW
      </span>
      <div className="w-px h-4 bg-[#2A2A2A]" />
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] font-mono-data text-[#6B6B6B]">{s.label}</span>
          <span className="text-[12px] font-mono-data font-bold" style={{ color: s.color }}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Today View Component ──
interface TodayViewProps {
  data: DashboardData;
  onTickerSelect: (ticker: string) => void;
}

export function TodayView({ data, onTickerSelect }: TodayViewProps) {
  // Get latest thesis-equipped picks
  const topPicks = data.top_picks || [];
  const freshMomentum = data.fresh_momentum || [];
  const allPicks = topPicks.length > 0 ? topPicks : freshMomentum;

  return (
    <div className="pt-4 md:pt-6 pb-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[20px] font-bold md:text-[24px] font-mono-data tracking-[0.06em] text-[#E8E8E8] flex items-center gap-2">
          <span className="text-[#00FF66]">◆</span> TODAY
        </h1>
        <span className="text-[10px] font-mono-data text-[#6B6B6B] border border-[#2A2A2A] px-2 py-1 rounded-[2px]">
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>

      {/* Market Overview Bar */}
      <MarketOverview data={data} />

      {/* Research Cards — main focus */}
      {allPicks.length > 0 && (
        <ResearchCardGrid
          signals={allPicks}
          title="TODAY'S TOP PICKS"
          subtitle="Highest conviction signals with machine-generated research thesis and ATR-based price targets"
          maxCards={3}
          onViewChart={onTickerSelect}
          onViewDetail={onTickerSelect}
        />
      )}

      {/* Two column: Daily Movers + Sector Pulse */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
        {/* Daily Movers */}
        {data.signals?.length > 0 && (
          <div>
            <h2 className="text-[13px] font-bold text-[#E8E8E8] font-mono-data tracking-[0.08em] uppercase flex items-center gap-2 mb-3">
              <span className="text-[#FFD600]">◆</span> DAILY MOVERS
            </h2>
            <DailyMovers signals={data.signals} maxItems={5} />
          </div>
        )}

        {/* Sector Pulse */}
        {data.sector_regimes && (
          <div>
            <h2 className="text-[13px] font-bold text-[#E8E8E8] font-mono-data tracking-[0.08em] uppercase flex items-center gap-2 mb-3">
              <span className="text-[#00FF66]">◆</span> SECTOR PULSE
            </h2>
            <SectorPulse sectorRegimes={data.sector_regimes} />
          </div>
        )}
      </div>

      {/* Latest Research Brief */}
      {allPicks.length > 0 && allPicks[0]?.thesis && (
        <div className="mt-4 p-4 rounded-[4px]" style={{ background: "#111111", border: "1px solid #2A2A2A" }}>
          <h2 className="text-[13px] font-bold text-[#E8E8E8] font-mono-data tracking-[0.08em] uppercase flex items-center gap-2 mb-2">
            <span className="text-[#00FF66]">◆</span> LATEST HEADSTART RESEARCH
          </h2>
          <p className="text-[11px] text-[#6B6B6B] mb-3">Auto-generated from multi-system quantitative analysis</p>
          <div className="space-y-2">
            {allPicks.slice(0, 3).filter((s: Signal) => s.thesis).map((s: Signal) => (
              <div
                key={s.ticker}
                className="flex gap-3 p-2.5 rounded-[2px] hover:bg-[#1C1C1C] cursor-pointer transition-colors duration-[50ms]"
                onClick={() => onTickerSelect(s.ticker)}
              >
                <span className="text-[13px] font-mono-data font-bold text-[#00FF66] w-16 shrink-0">{s.ticker}</span>
                <p className="text-[12px] text-[#C0C0C0] leading-[1.5] italic">&ldquo;{s.thesis}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
