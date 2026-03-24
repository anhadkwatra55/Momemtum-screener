import { cn, getTextColorClass, getBackgroundColorClass } from "@/lib/utils";
import { SentimentBadge } from "./sentiment-badge";
import { SPRING_PHYSICS_DEFAULT, APPLE_CARD_HOVER_SHADOW } from "@/lib/constants";
import type { Strategy } from "@/types/momentum";
import React from "react";
import { AppleCard } from "@/components/ui/apple-card";
import { motion } from "framer-motion";

// Local palette hex map for Framer Motion direct CSS use
type LocalPaletteColorKey = 'cyan' | 'emerald' | 'rose' | 'amber' | 'violet' | 'blue' | 'lime' | 'orange' | 'slate';

const PALETTE_HEX_MAP: Record<LocalPaletteColorKey, string> = {
  cyan: '#06b6d4', emerald: '#10b981', rose: '#f43f5e', amber: '#f59e0b',
  violet: '#8b5cf6', blue: '#3b82f6', lime: '#84cc16', orange: '#f97316', slate: '#64748b',
};

function getPaletteColorWithAlpha(colorKey: LocalPaletteColorKey, opacity: number): string {
  const hex = PALETTE_HEX_MAP[colorKey];
  if (!hex) return `rgba(0, 0, 0, 0)`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** Generate a concise one-line trade context summary */
function getTradeContext(s: Strategy): string {
  const dirLabel = s.direction === "BULLISH" ? "Bullish" : s.direction === "BEARISH" ? "Bearish" : "Neutral";
  const actionMap: Record<string, string> = {
    OPEN_LONG: "Go long", OPEN_SHORT: "Go short", CLOSE_LONG: "Close long", CLOSE_SHORT: "Close short",
    HOLD: "Hold position", MONITOR: "Watch for entry",
  };
  const action = actionMap[s.action] || s.action;
  const conviction = typeof s.conviction === "number" ? `${s.conviction}% conviction` : "";
  const urgencyLabel = s.urgency === "HIGH" ? "act now" : s.urgency === "MODERATE" ? "near-term" : "low urgency";
  return `${dirLabel} setup — ${action} with ${conviction}, ${urgencyLabel}.`;
}

interface StrategyCardProps {
  strategy: Strategy;
  className?: string;
}

export const StrategyCard = React.memo(function StrategyCard({ strategy: s, className }: StrategyCardProps) {
  const dirColor: LocalPaletteColorKey = s.direction === "BULLISH" ? "emerald" : s.direction === "BEARISH" ? "rose" : "slate";
  const urgColor: LocalPaletteColorKey = s.urgency === "HIGH" ? "rose" : s.urgency === "MODERATE" ? "amber" : "slate";
  const spring = SPRING_PHYSICS_DEFAULT;

  const hoverProps = React.useMemo(() => ({
    y: -2,
    boxShadow: APPLE_CARD_HOVER_SHADOW,
    backgroundColor: getBackgroundColorClass('cyan', '500', '5'),
  }), []);

  return (
    <AppleCard
      className={cn("relative p-5 overflow-hidden", className)}
      whileHover={hoverProps}
      transition={spring}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 h-full w-[2px] rounded-l-[1.25rem] z-10"
        style={{
          background: `linear-gradient(to bottom, transparent, ${getPaletteColorWithAlpha(dirColor, 0.8)} 20%, ${getPaletteColorWithAlpha(dirColor, 0.8)} 80%, transparent)`,
        }}
      />

      {/* Row 1: Ticker + Sentiment */}
      <div className="flex items-center justify-between mb-2">
        <span className={cn("font-mono-data text-2xl font-extrabold tracking-[-0.03em]", getTextColorClass(dirColor, '400'))}>
          {s.ticker}
        </span>
        <SentimentBadge sentiment={s.sentiment} />
      </div>

      {/* Row 2: Trade context summary */}
      <p className="text-xs text-muted-foreground/70 leading-relaxed mb-3">
        {getTradeContext(s)}
      </p>

      {/* Row 3: Key numbers — compact single row */}
      <div className="flex items-center gap-4 text-xs mb-2">
        <div><span className="text-muted-foreground/50">Entry</span> <span className="font-mono-data font-bold text-foreground">${s.entry_price}</span></div>
        <div><span className="text-muted-foreground/50">Stop</span> <span className="font-mono-data font-bold text-foreground">${s.stop_loss ?? "—"}</span></div>
        <div><span className="text-muted-foreground/50">Target</span> <span className="font-mono-data font-bold text-foreground">${s.target ?? "—"}</span></div>
      </div>

      {/* Row 4: Conviction + Urgency + Options — compact */}
      <div className="flex items-center gap-3 text-xs">
        <span className={cn("font-mono-data font-bold", getTextColorClass(dirColor, '400'))}>
          {typeof s.conviction === "number" ? `${s.conviction}%` : s.conviction}
        </span>
        <span className={cn("font-mono-data font-semibold", getTextColorClass(urgColor, '400'))}>
          {s.urgency}
        </span>
        {s.options_strategy && s.options_strategy !== "NONE" && (
          <span className="text-muted-foreground/50 truncate max-w-[120px]" title={s.options_note}>
            {s.options_strategy.replace(/_/g, " ")}
          </span>
        )}
      </div>
    </AppleCard>
  );
});