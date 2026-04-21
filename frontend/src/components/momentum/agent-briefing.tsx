"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { SFIcon } from "@/components/ui/sf-icon";
import { SPRING_TRANSITION_PROPS } from "@/lib/constants";
import { getAuthHeaders } from "@/services/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8060";

interface StockInsight {
  ticker: string;
  price: number;
  daily_change: number;
  composite: number;
  probability: number;
  sentiment: string;
  phase: string;
  regime: string;
  sector: string;
  grade: string;
  insight: string;
}

interface Briefing {
  timestamp: string;
  type: string;
  stocks: StockInsight[];
  // backward compat
  bullets?: string[];
}

/* ── Tokens ── */
const C = {
  green: "#34d399",
  greenDim: "rgba(52,211,153,0.10)",
  red: "#f87171",
  redDim: "rgba(248,113,113,0.10)",
  gold: "#fbbf24",
  goldDim: "rgba(251,191,36,0.10)",
  cyan: "#22d3ee",
  cyanDim: "rgba(34,211,238,0.08)",
  textPrimary: "#e5e5e5",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  border: "#27272a",
  surface: "#18181b",
};

function GradeBadge({ grade }: { grade: string }) {
  const style =
    grade === "A"
      ? { color: C.green, bg: C.greenDim, border: `${C.green}40` }
      : grade === "B"
      ? { color: C.gold, bg: C.goldDim, border: `${C.gold}40` }
      : { color: C.textMuted, bg: C.surface, border: C.border };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "var(--font-mono, monospace)",
        padding: "2px 8px",
        borderRadius: 6,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        letterSpacing: "0.04em",
      }}
    >
      {grade}
    </span>
  );
}

function StockCard({ stock, index }: { stock: StockInsight; index: number }) {
  const isUp = stock.daily_change >= 0;
  const changeColor = isUp ? C.green : C.red;
  const changeBg = isUp ? C.greenDim : C.redDim;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_TRANSITION_PROPS, delay: index * 0.08 }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${C.border}`,
        transition: "border-color 0.2s ease",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = `${C.cyan}40`)
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = C.border)
      }
    >
      {/* Left: Ticker + Price */}
      <div style={{ minWidth: 72 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 15,
              fontWeight: 700,
              color: C.textPrimary,
              letterSpacing: "-0.01em",
            }}
          >
            {stock.ticker}
          </span>
          <GradeBadge grade={stock.grade} />
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
            color: C.textMuted,
          }}
        >
          ${stock.price.toFixed(2)}
        </span>
      </div>

      {/* Center: Insight */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            color: C.textSecondary,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {stock.insight}
        </p>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 6,
            fontSize: 10,
            color: C.textMuted,
          }}
        >
          <span>{stock.sector}</span>
          <span>·</span>
          <span style={{ color: C.cyan }}>{stock.regime}</span>
          <span>·</span>
          <span>
            {stock.probability}% conf
          </span>
        </div>
      </div>

      {/* Right: Daily Change */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 13,
            fontWeight: 600,
            color: changeColor,
            padding: "2px 8px",
            borderRadius: 6,
            background: changeBg,
          }}
        >
          {isUp ? "+" : ""}
          {stock.daily_change.toFixed(2)}%
        </span>
        <span
          style={{
            fontSize: 10,
            color: C.textMuted,
            marginTop: 4,
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          {stock.composite > 0 ? "+" : ""}
          {stock.composite.toFixed(2)} score
        </span>
      </div>
    </motion.div>
  );
}

export function AgentBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBriefing() {
      try {
        const res = await fetch(`${API_URL}/api/agent/morning-brief`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setBriefing(data);
        }
      } catch (err) {
        console.error("Failed to load morning brief:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBriefing();
  }, []);

  if (loading) return null;

  // No data at all
  const hasStocks = briefing?.stocks && briefing.stocks.length > 0;
  if (!hasStocks) return null;

  return (
    <Card className="px-5 py-5 border border-cyan-500/20 bg-[#0A0A0A]/80 backdrop-blur-md relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-3 mb-4">
        <div className="p-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
          <SFIcon name="sparkles" size={14} />
        </div>
        <h2 className="text-sm font-bold text-gray-100 uppercase tracking-widest">
          Top Momentum Stocks
        </h2>
        <div className="flex-1" />
        <span className="text-[10px] text-gray-500 font-mono">
          {briefing?.timestamp
            ? new Date(briefing.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </span>
      </div>

      <div className="space-y-2 relative z-10">
        <AnimatePresence>
          {briefing!.stocks.map((stock, idx) => (
            <StockCard key={stock.ticker} stock={stock} index={idx} />
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}
