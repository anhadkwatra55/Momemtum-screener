"use client";

import React, { useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { SFIcon } from "@/components/ui/sf-icon";
import { cn } from "@/lib/utils";
import { API_BASE, SPRING_TRANSITION_PROPS, TRACKING_HEADING_CLASS } from "@/lib/constants";

// ── Types ──
interface TickerWeeklyData {
  ticker: string;
  sector: string;
  dates: string[];
  composites: number[];
  probabilities: number[];
  prices: number[];
  ranks: number[];
  sentiments: string[];
  score_change: number;
  trend: "up" | "down" | "flat";
  latest_composite: number;
  latest_rank: number;
  latest_sentiment: string;
  latest_price: number;
  days_in_top: number;
}

interface WeeklyTopResponse {
  week_start: string;
  week_end: string;
  dates: string[];
  top_tickers: TickerWeeklyData[];
  message?: string;
}

// ── Mini Sparkline ──
// Renders a tiny inline SVG sparkline of composite scores through the week
const MiniSparkline = memo(({ values, trend }: { values: number[]; trend: string }) => {
  if (values.length < 2) return null;

  const width = 64;
  const height = 20;
  const padding = 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 0.01;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const lineColor = trend === "up" ? "#10b981" : trend === "down" ? "#f43f5e" : "#64748b";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot on last point */}
      {(() => {
        const lastPt = points[points.length - 1].split(",");
        return (
          <circle cx={lastPt[0]} cy={lastPt[1]} r="2" fill={lineColor} />
        );
      })()}
    </svg>
  );
});
MiniSparkline.displayName = "MiniSparkline";

// ── Trend Badge ──
const TrendBadge = memo(({ trend, change }: { trend: string; change: number }) => {
  const icon = trend === "up" ? "arrow.up.right" : trend === "down" ? "arrow.down.right" : "arrow.right";
  const color = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-slate-400";
  const bg = trend === "up" ? "bg-emerald-500/10" : trend === "down" ? "bg-rose-500/10" : "bg-slate-500/10";

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md", bg, color)}>
      <SFIcon name={icon} size="text-[9px]" />
      {change > 0 ? "+" : ""}{change.toFixed(2)}
    </span>
  );
});
TrendBadge.displayName = "TrendBadge";

// ── Main Component ──
export const WeeklyMomentumPanel = memo(({ onSelectTicker }: { onSelectTicker?: (ticker: string) => void }) => {
  const [data, setData] = useState<WeeklyTopResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeeklyTop() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/weekly-top-momentum?top_n=5`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWeeklyTop();
    return () => { cancelled = true; };
  }, []);

  // ── Loading State ──
  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-lg bg-cyan-500/20 animate-pulse" />
          <div className="h-4 w-32 rounded bg-white/[0.06] animate-pulse" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  // ── Error State ──
  if (error || !data) {
    return (
      <Card className="p-4 text-center">
        <SFIcon name="exclamationmark.triangle" size="text-xl" className="text-amber-400 mb-2" />
        <p className="text-xs text-muted-foreground">Weekly data unavailable</p>
      </Card>
    );
  }

  // ── Empty State ──
  if (!data.top_tickers || data.top_tickers.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <SFIcon name="flame.fill" size="text-base" className="text-cyan-400" />
          <h3 className={cn("text-sm font-bold", TRACKING_HEADING_CLASS)}>This Week&apos;s Top Momentum</h3>
        </div>
        <p className="text-xs text-muted-foreground/60 leading-relaxed">
          {data.message || "No snapshots yet. Data populates after the pipeline runs."}
        </p>
      </Card>
    );
  }

  const weekLabel = formatWeekLabel(data.week_start, data.week_end);

  return (
    <Card className="p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center">
            <SFIcon name="flame.fill" size="text-xs" className="text-cyan-400" />
          </div>
          <h3 className={cn("text-sm font-bold", TRACKING_HEADING_CLASS)}>
            Weekly Top Momentum
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-wider">
          {data.dates.length}d
        </span>
      </div>

      {/* Week range */}
      <p className="text-[10px] text-muted-foreground/40 mb-3 pl-8">
        {weekLabel}
      </p>

      {/* Ticker list */}
      <div className="space-y-0.5">
        <AnimatePresence mode="popLayout">
          {data.top_tickers.map((t, i) => (
            <motion.div
              key={t.ticker}
              className={cn(
                "flex items-center justify-between py-2 px-2 -mx-2 rounded-lg cursor-pointer",
                "hover:bg-white/[0.04] transition-colors group"
              )}
              onClick={() => onSelectTicker?.(t.ticker)}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING_TRANSITION_PROPS, delay: i * 0.06 }}
            >
              {/* Left: rank + ticker + sector */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-muted-foreground/30 font-mono-data w-3 text-right shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-data font-bold text-cyan-400 text-sm group-hover:text-cyan-300 transition-colors">
                      {t.ticker}
                    </span>
                    <TrendBadge trend={t.trend} change={t.score_change} />
                  </div>
                  <span className="text-[10px] text-muted-foreground/40 truncate block max-w-[100px]">
                    {t.sector}
                  </span>
                </div>
              </div>

              {/* Right: sparkline + composite */}
              <div className="flex items-center gap-2 shrink-0">
                {t.composites.length >= 2 && (
                  <MiniSparkline values={t.composites} trend={t.trend} />
                )}
                <span className={cn(
                  "font-mono-data text-sm font-semibold min-w-[36px] text-right",
                  t.latest_composite > 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {t.latest_composite.toFixed(2)}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Days legend */}
      {data.dates.length > 0 && (
        <div className="mt-3 pt-2 border-t border-white/[0.04]">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground/30 uppercase tracking-wider">Daily snapshots</span>
            <div className="flex gap-1">
              {data.dates.map((d) => {
                const day = new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
                return (
                  <span key={d} className="text-[9px] text-muted-foreground/30 font-mono-data px-1 py-0.5 rounded bg-white/[0.02]">
                    {day}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
});

WeeklyMomentumPanel.displayName = "WeeklyMomentumPanel";

// ── Helpers ──
function formatWeekLabel(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(s)} — ${fmt(e)}`;
}
