"use client";

import React, { useMemo } from "react";
import { TradeCardData, useWatchlist } from "@/hooks/use-watchlist";
import { SFIcon } from "@/components/ui/SFIcon";

/* ── Tokens ── */
const T = {
  bg: "#0d0d0d",
  card: "#18181b", // zinc-900
  cardHover: "#27272a", // zinc-800
  surface: "#27272a",
  border: "#27272a",
  borderLight: "#3f3f46", // zinc-700
  text: "#ffffff",
  textSec: "#a1a1aa", // zinc-400
  textMuted: "#71717a", // zinc-500
  textDim: "#52525b",
  gold: "#fbbf24", // amber-400
  goldDim: "rgba(251, 191, 36, 0.12)",
  green: "#34d399", // emerald-400
  greenBase: "#10b981", // emerald-500
  greenDim: "rgba(16, 185, 129, 0.10)",
  red: "#f87171", // red-400
  redDim: "rgba(248, 113, 113, 0.10)",
  cyan: "#22d3ee",
};

interface TradeCardProps {
  data: TradeCardData;
}

export function TradeCard({ data }: TradeCardProps) {
  const { entries, addTrade, getStatusMessage, getStatusColor } = useWatchlist();

  const watchlistEntry = useMemo(
    () => entries.find((e) => e.ticker === data.ticker),
    [entries, data.ticker]
  );
  const isInWatchlist = !!watchlistEntry;

  const handleAddToWatchlist = () => {
    if (!isInWatchlist) {
      addTrade(data);
    }
  };

  const getGradeStyle = (grade: string) => {
    switch (grade) {
      case "A":
        return { color: T.greenBase, bg: T.greenDim };
      case "B":
        return { color: T.gold, bg: T.goldDim };
      default:
        return { color: T.textSec, bg: T.surface };
    }
  };

  const gradeStyle = getGradeStyle(data.grade);

  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        maxWidth: "450px",
        fontFamily: "var(--font-sans)",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Dynamic Glow based on watchlist status element could go here */}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 700, color: T.text, margin: 0, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>
            {data.ticker}
          </h2>
          <span style={{ fontSize: "12px", color: T.textMuted }}>| {data.sector}</span>
        </div>
        <div
          style={{
            background: gradeStyle.bg,
            color: gradeStyle.color,
            padding: "4px 12px",
            borderRadius: "9999px",
            fontSize: "13px",
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            border: `1px solid ${gradeStyle.color}40`, // 25% opacity border
          }}
        >
          Grade: {data.grade}
        </div>
      </div>

      {/* LLM Briefing */}
      <p style={{ color: T.textSec, fontSize: "14px", lineHeight: 1.6, marginBottom: "24px", fontFamily: "var(--font-serif), Georgia, serif" }}>
        {data.summary}
      </p>

      {/* Execution Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <div style={{ background: T.surface, padding: "12px", borderRadius: "10px", border: `1px solid ${T.borderLight}` }}>
          <p style={{ fontSize: "10px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px 0", fontWeight: 600 }}>
            Entry Zone
          </p>
          <p style={{ fontSize: "16px", fontWeight: 600, color: T.text, margin: 0, fontFamily: "var(--font-mono)" }}>
            ${data.entry_low.toFixed(2)} - ${data.entry_high.toFixed(2)}
          </p>
        </div>
        <div style={{ background: T.surface, padding: "12px", borderRadius: "10px", border: `1px solid ${T.borderLight}` }}>
          <p style={{ fontSize: "10px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px 0", fontWeight: 600 }}>
            Target
          </p>
          <p style={{ fontSize: "16px", fontWeight: 600, color: T.green, margin: 0, fontFamily: "var(--font-mono)" }}>
            ${data.target.toFixed(2)}
          </p>
        </div>
        <div style={{ background: T.surface, padding: "12px", borderRadius: "10px", border: `1px solid ${T.borderLight}` }}>
          <p style={{ fontSize: "10px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px 0", fontWeight: 600 }}>
            Stop Loss
          </p>
          <p style={{ fontSize: "16px", fontWeight: 600, color: T.red, margin: 0, fontFamily: "var(--font-mono)" }}>
            ${data.stop_loss.toFixed(2)}
          </p>
        </div>
        <div style={{ background: T.surface, padding: "12px", borderRadius: "10px", border: `1px solid ${T.borderLight}` }}>
          <p style={{ fontSize: "10px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px 0", fontWeight: 600 }}>
            Ideal Hold
          </p>
          <p style={{ fontSize: "16px", fontWeight: 600, color: T.text, margin: 0, fontFamily: "var(--font-mono)" }}>
            {data.hold_min}-{data.hold_max} Days
          </p>
        </div>
      </div>

      {/* Alpha Clock / Confidence */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: T.textSec, marginBottom: "8px", fontWeight: 500 }}>
          <span>Confidence Meter</span>
          <span>{data.confidence.toFixed(1)}%</span>
        </div>
        <div style={{ width: "100%", height: "6px", background: T.surface, borderRadius: "9999px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              background: data.confidence >= 70 ? T.greenBase : data.confidence >= 50 ? T.gold : T.red,
              width: `${Math.min(100, Math.max(0, data.confidence))}%`,
              borderRadius: "9999px",
              transition: "width 1s ease-in-out"
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", fontSize: "11px" }}>
           <span style={{ color: T.textDim }}>Phase: <span style={{ color: T.cyan, fontWeight: 500 }}>{data.momentum_phase}</span></span>
           <span style={{ color: T.textDim }}>Action: <span style={{ color: T.textSec, fontWeight: 500 }}>{data.action_category}</span></span>
        </div>
      </div>

      {/* Post-Trade Tracker Info */}
      {isInWatchlist && watchlistEntry && (
          <div style={{ 
            marginBottom: "16px", 
            padding: "10px", 
            borderRadius: "8px",
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${T.border}`,
            fontSize: "12px",
            textAlign: "center"
          }}>
            <SFIcon name="eye.fill" size={12} className="inline-block mr-2 text-zinc-500" />
            <span className={getStatusColor(watchlistEntry.status)}>
              {getStatusMessage(watchlistEntry.status)}
            </span>
          </div>
      )}

      {/* Action Button */}
      {!isInWatchlist ? (
        <button
          onClick={handleAddToWatchlist}
          style={{
            width: "100%",
            background: T.greenBase,
            color: "#ffffff",
            fontWeight: 600,
            padding: "14px 0",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
            transition: "all 0.2s ease",
            boxShadow: `0 4px 14px ${T.greenDim}`,
            outline: "none",
          }}
          onMouseEnter={(e) => {
             e.currentTarget.style.background = "#059669"; // emerald-600
             e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
             e.currentTarget.style.background = T.greenBase;
             e.currentTarget.style.transform = "translateY(0)";
          }}
          onMouseDown={(e) => {
             e.currentTarget.style.transform = "translateY(1px)";
          }}
        >
          Add to Watchlist
        </button>
      ) : (
        <button
          disabled
          style={{
            width: "100%",
            background: T.surface,
            color: T.textSec,
            fontWeight: 600,
            padding: "14px 0",
            borderRadius: "10px",
            border: `1px solid ${T.borderLight}`,
            cursor: "not-allowed",
            fontSize: "14px",
          }}
        >
          Tracking Trade
        </button>
      )}

      {/* Strategy Hint */}
      {data.options_strategy && (
        <div style={{ marginTop: "16px", textAlign: "center", fontSize: "11px", color: T.textMuted }}>
           Options Idea: <span style={{ color: T.textSec }}>{data.options_strategy}</span>
           {data.options_cost && <span> · {data.options_cost}</span>}
        </div>
      )}
    </div>
  );
}
