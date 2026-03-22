"use client";

import React from "react";
import { Signal, ConvictionTier, ActionCategory } from "@/types/momentum";
import { motion } from "framer-motion";

// ── Conviction tier colors (Carbon Terminal signal palette) ──
const TIER_COLORS: Record<string, { border: string; text: string; bg: string }> = {
  "Ultra Conviction": { border: "#FFD600", text: "#FFD600", bg: "rgba(255, 214, 0, 0.08)" },
  "High Conviction": { border: "#00FF66", text: "#00FF66", bg: "rgba(0, 255, 102, 0.08)" },
  "Moderate Conviction": { border: "#C0C0C0", text: "#C0C0C0", bg: "rgba(192, 192, 192, 0.05)" },
  "Low Conviction": { border: "#6B6B6B", text: "#6B6B6B", bg: "rgba(107, 107, 107, 0.05)" },
  "Contrarian": { border: "#FF3333", text: "#FF3333", bg: "rgba(255, 51, 51, 0.08)" },
};

const ACTION_COLORS: Record<string, string> = {
  "Top Pick": "#FFD600",
  "Accumulate": "#00FF66",
  "Hold & Monitor": "#C0C0C0",
  "Caution": "#FFD600",
  "Reduce Exposure": "#FF3333",
  "Avoid": "#FF3333",
};

interface ResearchCardProps {
  signal: Signal;
  onViewChart?: (ticker: string) => void;
  onViewDetail?: (ticker: string) => void;
  compact?: boolean;
}

export const ResearchCard = React.memo(function ResearchCard({
  signal,
  onViewChart,
  onViewDetail,
  compact = false,
}: ResearchCardProps) {
  const tier = signal.conviction_tier || "Contrarian";
  const action = signal.action_category || "Hold & Monitor";
  const tierColor = TIER_COLORS[tier] || TIER_COLORS["Contrarian"];
  const actionColor = ACTION_COLORS[action] || "#C0C0C0";

  const priceTarget = signal.price_target;
  const upsidePct = signal.upside_pct;
  const riskReward = signal.risk_reward;
  const thesis = signal.thesis;

  return (
    <motion.div
      className="relative overflow-hidden"
      style={{
        background: "#111111",
        border: `1px solid ${tierColor.border}`,
        borderRadius: "4px",
        padding: compact ? "12px" : "16px",
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      whileHover={{ borderColor: "#00FF66" }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: tierColor.border }}
      />

      {/* Header: Ticker + Sector */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-bold text-[#E8E8E8] font-mono-data tracking-wider">
            {signal.ticker}
          </span>
          {signal.company_name && signal.company_name !== signal.ticker && (
            <span className="text-[11px] text-[#6B6B6B] truncate max-w-[140px]">
              {signal.company_name}
            </span>
          )}
        </div>
        <span className="text-[10px] text-[#6B6B6B] font-mono-data uppercase tracking-[0.1em]">
          {signal.sector}
        </span>
      </div>

      {/* Badges: Conviction + Action */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[10px] font-mono-data uppercase tracking-[0.06em] px-2 py-0.5"
          style={{
            color: tierColor.text,
            background: tierColor.bg,
            border: `1px solid ${tierColor.border}`,
            borderRadius: "2px",
          }}
        >
          {tier}
        </span>
        <span
          className="text-[10px] font-mono-data uppercase tracking-[0.06em] px-2 py-0.5"
          style={{
            color: actionColor,
            background: `${actionColor}12`,
            border: `1px solid ${actionColor}40`,
            borderRadius: "2px",
          }}
        >
          {action}
        </span>
        <span
          className="text-[10px] font-mono-data uppercase tracking-[0.06em] px-2 py-0.5"
          style={{
            color: signal.regime === "Trending" ? "#00FF66" : signal.regime === "Choppy" ? "#FF3333" : "#FFD600",
            background: "rgba(42, 42, 42, 0.5)",
            border: "1px solid #2A2A2A",
            borderRadius: "2px",
          }}
        >
          {signal.regime}
        </span>
      </div>

      {/* Price + Target Row */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-[10px] text-[#6B6B6B] font-mono-data uppercase mb-0.5">Current Price</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[18px] font-bold text-[#E8E8E8] font-mono-data">
              ${(signal.price as number)?.toFixed(2)}
            </span>
            <span
              className="text-[11px] font-mono-data"
              style={{
                color: (signal.daily_change as number) >= 0 ? "#00FF66" : "#FF3333",
              }}
            >
              {(signal.daily_change as number) >= 0 ? "+" : ""}
              {(signal.daily_change as number)?.toFixed(2)}%
            </span>
          </div>
        </div>
        {priceTarget != null && (
          <div>
            <div className="text-[10px] text-[#6B6B6B] font-mono-data uppercase mb-0.5">Price Target</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[18px] font-bold font-mono-data" style={{ color: tierColor.text }}>
                ${priceTarget.toFixed(2)}
              </span>
              {upsidePct != null && (
                <span
                  className="text-[11px] font-mono-data"
                  style={{ color: upsidePct >= 0 ? "#00FF66" : "#FF3333" }}
                >
                  {upsidePct >= 0 ? "↑" : "↓"}{Math.abs(upsidePct).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Score Strip */}
      <div className="flex items-center gap-3 mb-3 text-[10px] font-mono-data text-[#6B6B6B]">
        <span>
          COMPOSITE <span className="text-[#C0C0C0] ml-1">{(signal.composite as number)?.toFixed(2)}</span>
        </span>
        <span className="text-[#2A2A2A]">│</span>
        <span>
          CONF <span className="text-[#C0C0C0] ml-1">{(signal.probability as number)?.toFixed(1)}%</span>
        </span>
        {riskReward != null && (
          <>
            <span className="text-[#2A2A2A]">│</span>
            <span>
              R:R <span className="text-[#C0C0C0] ml-1">1:{riskReward.toFixed(1)}</span>
            </span>
          </>
        )}
        <span className="text-[#2A2A2A]">│</span>
        <span>
          PHASE <span className="text-[#C0C0C0] ml-1">{signal.momentum_phase}</span>
        </span>
      </div>

      {/* Thesis */}
      {thesis && !compact && (
        <div className="mb-3 px-3 py-2 rounded-[2px]" style={{ background: "#0A0A0A", borderLeft: `2px solid ${tierColor.border}` }}>
          <p className="text-[12px] text-[#C0C0C0] leading-[1.5] italic">
            &ldquo;{thesis}&rdquo;
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onViewDetail && (
          <button
            onClick={() => onViewDetail(signal.ticker)}
            className="text-[10px] font-mono-data uppercase tracking-[0.08em] px-3 py-1.5 bg-[#0A0A0A] border border-[#2A2A2A] rounded-[2px] text-[#C0C0C0] hover:text-[#00FF66] hover:border-[#00FF66] transition-all duration-[50ms]"
          >
            Full Analysis →
          </button>
        )}
        {onViewChart && (
          <button
            onClick={() => onViewChart(signal.ticker)}
            className="text-[10px] font-mono-data uppercase tracking-[0.08em] px-3 py-1.5 bg-[#0A0A0A] border border-[#2A2A2A] rounded-[2px] text-[#C0C0C0] hover:text-[#00FF66] hover:border-[#00FF66] transition-all duration-[50ms]"
          >
            View Chart
          </button>
        )}
      </div>
    </motion.div>
  );
});

// ── Research Card Grid ──
interface ResearchCardGridProps {
  signals: Signal[];
  title?: string;
  subtitle?: string;
  maxCards?: number;
  onViewChart?: (ticker: string) => void;
  onViewDetail?: (ticker: string) => void;
}

export function ResearchCardGrid({
  signals,
  title = "HEADSTART RESEARCH",
  subtitle = "Highest conviction signals — multi-system agreement, trending regime, confirmed fresh momentum",
  maxCards = 6,
  onViewChart,
  onViewDetail,
}: ResearchCardGridProps) {
  const displaySignals = signals.slice(0, maxCards);

  if (displaySignals.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[14px] font-bold text-[#E8E8E8] font-mono-data tracking-[0.08em] uppercase flex items-center gap-2">
            <span className="text-[#00FF66]">◆</span> {title}
          </h2>
          <p className="text-[11px] text-[#6B6B6B] mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[10px] font-mono-data text-[#6B6B6B] border border-[#2A2A2A] px-2 py-1 rounded-[2px]">
          {displaySignals.length} PICKS
        </span>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {displaySignals.map((signal) => (
          <ResearchCard
            key={signal.ticker}
            signal={signal}
            onViewChart={onViewChart}
            onViewDetail={onViewDetail}
          />
        ))}
      </div>
    </div>
  );
}
