"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/services/api";

/* ── Types ── */
interface SystemBreakdown {
  score: number;
  label: string;
  simple_question: string;
  status: "bullish" | "bearish" | "neutral";
  detail: Record<string, unknown>;
}

interface BriefingData {
  ticker: string;
  name: string;
  price: number;
  daily_change: number;
  sector: string;
  regime: string;
  verdict: string;
  verdict_emoji: string;
  verdict_explanation: string;
  composite: number;
  probability: number;
  sentiment: string;
  systems: Record<string, SystemBreakdown>;
  thesis: string;
  momentum_phase: string;
  is_fresh_momentum: boolean;
  is_exhausting: boolean;
  strategy: {
    entry: number | null;
    stop_loss: number | null;
    target: number | null;
    leveraged_etf: string | null;
    rationale: string | null;
  };
  sector_context: {
    sector_regime: string;
    sector_avg_composite: number;
    rank_in_sector: number;
    sector_peer_count: number;
  };
  return_20d: number;
  vol_spike: number;
}

/* ── Animation ── */
const ease = [0.33, 1, 0.68, 1] as const;
const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

/* ── Score Bar ── */
function ScoreBar({ score, label, question, status }: {
  score: number; label: string; question: string; status: string;
}) {
  const pct = Math.min(100, Math.max(0, (score + 2) / 4 * 100));
  const color = status === "bullish" ? "var(--color-mo-emerald, #34d399)"
    : status === "bearish" ? "var(--color-mo-rose, #fb7185)"
    : "var(--color-mo-amber, #fbbf24)";

  return (
    <motion.div variants={fadeIn} className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-foreground/80">{question}</span>
        <span className="text-xs font-mono" style={{ color }}>
          {score > 0 ? "+" : ""}{score.toFixed(2)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/50 font-mono">{label}</p>
    </motion.div>
  );
}

/* ── Main Component ── */
export default function TickerBriefing({ ticker, onClose, onNavigate }: {
  ticker: string;
  onClose?: () => void;
  onNavigate?: (view: string, params?: Record<string, string>) => void;
}) {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);

    apiFetch<BriefingData>(`/api/ticker/briefing/${ticker.toUpperCase()}`)
      .then(setData)
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground/60 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground font-mono">Loading {ticker}...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-lg font-mono text-foreground/60">⚠</p>
          <p className="text-sm text-muted-foreground">{error || `No data for ${ticker}`}</p>
          <p className="text-xs text-muted-foreground/60">
            The momentum pipeline may still be loading. Try again in a moment.
          </p>
        </div>
      </div>
    );
  }

  const d = data;
  const verdictColors: Record<string, string> = {
    "Strong Buy": "#34d399", "Accumulate": "#fbbf24",
    "Hold / Watch": "#94a3b8", "Caution": "#fb923c", "Avoid / Reduce": "#fb7185",
  };
  const verdictColor = verdictColors[d.verdict] || "#94a3b8";
  const changeColor = d.daily_change >= 0 ? "var(--color-mo-emerald, #34d399)" : "var(--color-mo-rose, #fb7185)";

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={stagger}
      className="max-w-3xl mx-auto space-y-6 py-6 px-4"
    >
      {/* ── Header ── */}
      <motion.div variants={fadeIn} className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight font-mono">{d.ticker}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/5 text-muted-foreground font-mono">
              {d.sector}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{d.name}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-semibold">${d.price?.toFixed(2)}</p>
          <p className="text-sm font-mono" style={{ color: changeColor }}>
            {d.daily_change >= 0 ? "▲" : "▼"} {Math.abs(d.daily_change || 0).toFixed(2)}%
          </p>
        </div>
      </motion.div>

      {/* ── Verdict Card ── */}
      <motion.div
        variants={fadeIn}
        className="rounded-xl border border-foreground/10 p-5"
        style={{ background: `${verdictColor}08`, borderColor: `${verdictColor}30` }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{d.verdict_emoji}</span>
            <div>
              <p className="text-lg font-bold tracking-tight" style={{ color: verdictColor }}>
                {d.verdict}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                Probability: {d.probability?.toFixed(0)}% · Composite: {d.composite > 0 ? "+" : ""}{d.composite?.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Regime</p>
            <p className="text-sm font-mono font-medium">{d.regime}</p>
          </div>
        </div>
        <p className="text-sm text-foreground/70 leading-relaxed">{d.verdict_explanation}</p>
        {d.is_fresh_momentum && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
            <span>⚡</span> Fresh Momentum — Early-stage trend
          </div>
        )}
        {d.is_exhausting && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 font-medium">
            <span>⚠</span> Exhausting — Consider taking profits
          </div>
        )}
      </motion.div>

      {/* ── 4-System Breakdown (consumer-friendly) ── */}
      <motion.div variants={fadeIn} className="rounded-xl border border-foreground/10 p-5 space-y-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold tracking-tight">Momentum Health Check</h3>
          <span className="text-[10px] font-mono text-muted-foreground/50">4 SYSTEMS</span>
        </div>
        <p className="text-xs text-muted-foreground/60 -mt-2">
          Each system asks a different question about the stock&apos;s momentum. More green bars = stronger trend.
        </p>
        {Object.entries(d.systems || {}).map(([key, sys]) => (
          <ScoreBar key={key} score={sys.score} label={sys.label}
            question={sys.simple_question} status={sys.status} />
        ))}
      </motion.div>

      {/* ── Strategy Card ── */}
      {d.strategy?.entry && (
        <motion.div variants={fadeIn} className="rounded-xl border border-foreground/10 p-5">
          <h3 className="text-sm font-bold tracking-tight mb-3">Trade Strategy</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-foreground/[0.02]">
              <p className="text-[10px] text-muted-foreground/60 font-mono mb-1">ENTRY</p>
              <p className="text-lg font-mono font-semibold">${d.strategy.entry?.toFixed(2)}</p>
            </div>
            {d.strategy.stop_loss && (
              <div className="text-center p-3 rounded-lg bg-rose-500/5">
                <p className="text-[10px] text-muted-foreground/60 font-mono mb-1">STOP LOSS</p>
                <p className="text-lg font-mono font-semibold text-rose-400">${d.strategy.stop_loss.toFixed(2)}</p>
                <p className="text-[10px] text-rose-400/60 font-mono">
                  {((d.strategy.stop_loss - d.strategy.entry!) / d.strategy.entry! * 100).toFixed(1)}%
                </p>
              </div>
            )}
            {d.strategy.target && (
              <div className="text-center p-3 rounded-lg bg-emerald-500/5">
                <p className="text-[10px] text-muted-foreground/60 font-mono mb-1">TARGET</p>
                <p className="text-lg font-mono font-semibold text-emerald-400">${d.strategy.target.toFixed(2)}</p>
                <p className="text-[10px] text-emerald-400/60 font-mono">
                  +{((d.strategy.target - d.strategy.entry!) / d.strategy.entry! * 100).toFixed(1)}%
                </p>
              </div>
            )}
          </div>
          {d.strategy.rationale && (
            <p className="text-xs text-muted-foreground/60 mt-3 leading-relaxed">{d.strategy.rationale}</p>
          )}
        </motion.div>
      )}

      {/* ── Sector Context ── */}
      <motion.div variants={fadeIn} className="rounded-xl border border-foreground/10 p-5">
        <h3 className="text-sm font-bold tracking-tight mb-3">Sector Context</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground/60 font-mono mb-1">SECTOR</p>
            <p className="text-sm font-medium">{d.sector}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground/60 font-mono mb-1">SECTOR REGIME</p>
            <p className="text-sm font-medium">{d.sector_context?.sector_regime}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground/60 font-mono mb-1">RANK IN SECTOR</p>
            <p className="text-sm font-mono font-medium">
              #{d.sector_context?.rank_in_sector} <span className="text-muted-foreground/40">/ {d.sector_context?.sector_peer_count}</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground/60 font-mono mb-1">20D RETURN</p>
            <p className="text-sm font-mono font-medium" style={{
              color: (d.return_20d || 0) >= 0 ? "var(--color-mo-emerald)" : "var(--color-mo-rose)"
            }}>
              {(d.return_20d || 0) >= 0 ? "+" : ""}{((d.return_20d || 0) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Quick Actions ── */}
      <motion.div variants={fadeIn} className="flex flex-wrap gap-2">
        <button
          onClick={() => onNavigate?.("ticker-detail", { ticker: d.ticker })}
          className="text-xs font-mono px-4 py-2 rounded-lg border border-foreground/10 hover:border-foreground/20 transition-colors"
        >
          📊 Full Charts
        </button>
        <button
          onClick={() => window.open(`/options`, "_self")}
          className="text-xs font-mono px-4 py-2 rounded-lg border border-foreground/10 hover:border-foreground/20 transition-colors"
        >
          🔬 Options Flow
        </button>
        <button
          onClick={() => onNavigate?.("alpha-calls")}
          className="text-xs font-mono px-4 py-2 rounded-lg border border-foreground/10 hover:border-foreground/20 transition-colors"
        >
          ⚡ Alpha Calls
        </button>
      </motion.div>
    </motion.div>
  );
}
