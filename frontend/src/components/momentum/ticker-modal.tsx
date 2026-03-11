"use client";

import { useEffect, useCallback, useMemo, useState } from "react";
import { SFIcon } from "@/components/ui/SFIcon";
import {
  SPRING_PHYSICS_DEFAULT,
  Z_INDEX,
  SHADOW_CTA_GLOW,
  TEXT_GLOW_CYAN,
  LETTER_SPACING,
} from "@/lib/constants";
import { SentimentBadge } from "./sentiment-badge";
import { RegimeBadge } from "./regime-badge";
import type { Signal } from "@/types/momentum";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getTextColorClass, getBackgroundColorClass, PaletteColorKey } from "@/lib/utils";

interface TickerModalProps {
  signal: Signal | null;
  onClose: () => void;
  onViewDetail: (ticker: string) => void;
}

const useIsMobile = (breakpoint = 640) => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
};

const useScrollLock = (locked: boolean) => {
  useEffect(() => {
    const orig = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
    };
    if (locked) {
      const w = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${w}px`;
    } else {
      document.body.style.overflow = orig.overflow;
      document.body.style.paddingRight = orig.paddingRight;
    }
    return () => {
      document.body.style.overflow = orig.overflow;
      document.body.style.paddingRight = orig.paddingRight;
    };
  }, [locked]);
};

/* ── Stat Tile ───────────────────────────────────────────────────────────────── */
function StatTile({ label, value, colorKey, large }: { label: string; value: string; colorKey: PaletteColorKey; large?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl px-4 py-3 flex flex-col items-center justify-center text-center bg-white/[0.03] border border-white/[0.04]",
      large && "col-span-2 sm:col-span-1"
    )}>
      <span className={cn(
        "font-bold font-mono leading-none",
        large ? "text-2xl" : "text-lg",
        getTextColorClass(colorKey)
      )}>
        {value}
      </span>
      <span
        className="text-[10px] text-muted-foreground/50 uppercase font-semibold mt-1.5 tracking-widest"
      >
        {label}
      </span>
    </div>
  );
}

/* ── System Score Row ────────────────────────────────────────────────────────── */
function SystemRow({ label, desc, score }: { label: string; desc: string; score: number }) {
  const barPct = Math.min(100, Math.max(2, ((score + 2) / 4) * 100));
  const colorKey: PaletteColorKey =
    score > 0.5 ? "emerald" : score > 0 ? "lime" : score < -0.5 ? "rose" : score < 0 ? "orange" : "slate";
  const labelText = score > 1 ? "Strong Bull" : score > 0.3 ? "Bullish" : score < -1 ? "Strong Bear" : score < -0.3 ? "Bearish" : "Neutral";

  return (
    <div className="flex items-center gap-4 py-2.5">
      {/* Left: label + desc */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground/90 truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground/40 truncate">{desc}</div>
      </div>
      {/* Progress bar */}
      <div className="w-24 sm:w-32 h-1.5 bg-white/5 rounded-full overflow-hidden flex-shrink-0">
        <motion.div
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: barPct / 100 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={cn("h-full rounded-full", getBackgroundColorClass(colorKey))}
        />
      </div>
      {/* Score + label */}
      <div className="flex items-center gap-2 flex-shrink-0 w-28 justify-end">
        <span className="text-[11px] text-muted-foreground/40">{labelText}</span>
        <span className={cn("font-bold font-mono text-sm tabular-nums w-12 text-right", getTextColorClass(colorKey))}>
          {score > 0 ? "+" : ""}{score.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

/* ── Main Modal ──────────────────────────────────────────────────────────────── */
export function TickerModal({ signal, onClose, onViewDetail }: TickerModalProps) {
  const isMobile = useIsMobile();
  useScrollLock(!!signal);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!signal) return;
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [signal, handleKey]);

  const s = signal;
  if (!s) return null;

  const compositeColor: PaletteColorKey = s.composite > 0 ? "emerald" : s.composite < 0 ? "rose" : "slate";
  const dayColor: PaletteColorKey = s.daily_change > 0 ? "emerald" : s.daily_change < 0 ? "rose" : "slate";
  const r20Color: PaletteColorKey = s.return_20d > 0 ? "emerald" : s.return_20d < 0 ? "rose" : "slate";

  const systems = [
    { label: "System 1 — ADX/TRIX", desc: "Trend strength + momentum oscillator", score: s.sys1_score ?? 0 },
    { label: "System 2 — Stochastics", desc: "Overbought/oversold + %K/%D crossovers", score: s.sys2_score ?? 0 },
    { label: "System 3 — Elder Impulse", desc: "EMA slope + MACD histogram direction", score: s.sys3_score ?? 0 },
    { label: "System 4 — Renko/HMA", desc: "Noise-filtered price action + Hull MA", score: s.sys4_score ?? 0 },
  ];

  const alerts = [
    s.momentum_shock?.trigger && { icon: "bolt.fill", label: "Momentum Shock", detail: s.momentum_shock.strength ? `${s.momentum_shock.strength.toFixed(1)}x` : "", color: "amber" as PaletteColorKey },
    s.smart_money?.trigger && { icon: "dollarsign.circle.fill", label: "Smart Money", detail: s.smart_money.score ? `${s.smart_money.score.toFixed(0)}` : "", color: "violet" as PaletteColorKey },
    s.gamma_squeeze?.trigger && { icon: "target", label: "Gamma Squeeze", detail: s.gamma_squeeze.volume_spike ? `${s.gamma_squeeze.volume_spike.toFixed(1)}x vol` : "", color: "rose" as PaletteColorKey },
    s.continuation?.trigger && { icon: "rocket.fill", label: "Continuation", detail: s.continuation.probability ? `${s.continuation.probability.toFixed(0)}%` : "", color: "emerald" as PaletteColorKey },
  ].filter(Boolean) as { icon: string; label: string; detail: string; color: PaletteColorKey }[];

  const modalVariants = isMobile
    ? { hidden: { y: "100%", opacity: 0 }, visible: { y: 0, opacity: 1 }, exit: { y: "100%", opacity: 0 } }
    : { hidden: { scale: 0.92, opacity: 0 }, visible: { scale: 1, opacity: 1 }, exit: { scale: 0.92, opacity: 0 } };

  return (
    <AnimatePresence>
      {signal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          style={{ zIndex: Z_INDEX.MODAL_BACKDROP }}
          onClick={onClose}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={SPRING_PHYSICS_DEFAULT}
            className={cn(
              "relative bg-card/95 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden w-full",
              "sm:w-[560px] sm:max-w-[92vw] sm:rounded-2xl",
              "rounded-t-2xl sm:rounded-2xl",
              "max-h-[90vh] flex flex-col"
            )}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticker-modal-title"
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <h2
                  id="ticker-modal-title"
                  className="text-3xl sm:text-4xl font-extrabold font-mono text-cyan-400"
                  style={{ textShadow: TEXT_GLOW_CYAN, letterSpacing: LETTER_SPACING.HEADINGS }}
                >
                  {s.ticker}
                </h2>
                <SentimentBadge sentiment={s.sentiment} />
                <RegimeBadge regime={s.regime} />
                {s.momentum_phase === "Fresh" && (
                  <span className={cn(
                    "text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-widest",
                    getBackgroundColorClass("emerald", "500", "12"),
                    getTextColorClass("emerald", "400")
                  )}>
                    <SFIcon name="leaf.fill" size={10} className="mr-0.5 inline-block" /> Fresh
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground/60 hover:text-foreground transition-colors text-lg w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08]"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* ── Scrollable body ────────────────────────────────────── */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

              {/* Quick Stats — 2 rows of 4 */}
              <div>
                <h3 className="text-xs uppercase text-muted-foreground/50 font-semibold tracking-widest mb-3">
                  Overview
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatTile label="Price" value={`$${s.price.toFixed(2)}`} colorKey="cyan" large />
                  <StatTile label="Composite" value={s.composite.toFixed(2)} colorKey={compositeColor} />
                  <StatTile label="Confidence" value={`${s.probability}%`} colorKey={s.probability > 60 ? "emerald" : "amber"} />
                  <StatTile label="Δ Day" value={`${s.daily_change > 0 ? "+" : ""}${s.daily_change}%`} colorKey={dayColor} />
                  <StatTile label="20-Day" value={`${s.return_20d > 0 ? "+" : ""}${s.return_20d}%`} colorKey={r20Color} />
                  <StatTile label="Sector" value={s.sector} colorKey="slate" />
                  <StatTile label="Regime" value={s.regime} colorKey={s.regime === "Trending" ? "cyan" : "violet"} />
                  <StatTile label="Phase" value={s.momentum_phase || "—"} colorKey={s.momentum_phase === "Fresh" ? "emerald" : "amber"} />
                </div>
              </div>

              {/* 4-System Breakdown — compact rows */}
              <div>
                <h3 className="text-xs uppercase text-muted-foreground/50 font-semibold tracking-widest mb-1">
                  4-System Breakdown
                </h3>
                <p className="text-[11px] text-muted-foreground/40 mb-3">
                  Each system scores −2 (Strong Bear) to +2 (Strong Bull). Composite is the average.
                </p>
                <div className="divide-y divide-white/[0.04]">
                  {systems.map((sys, i) => (
                    <SystemRow key={i} {...sys} />
                  ))}
                </div>
              </div>

              {/* Composite callout */}
              <div className="rounded-xl p-4 bg-cyan-500/[0.04] border border-cyan-500/[0.08]">
                <div className="text-[11px] uppercase text-cyan-400/60 font-semibold tracking-widest mb-2">
                  Score Calculation
                </div>
                <p className="text-sm text-muted-foreground/70 leading-relaxed">
                  <span className="text-foreground/80 font-medium">Composite</span> = (
                  <span className="font-mono text-xs">{s.sys1_score.toFixed(1)}</span> +{" "}
                  <span className="font-mono text-xs">{s.sys2_score.toFixed(1)}</span> +{" "}
                  <span className="font-mono text-xs">{s.sys3_score.toFixed(1)}</span> +{" "}
                  <span className="font-mono text-xs">{s.sys4_score.toFixed(1)}</span>) ÷ 4 ={" "}
                  <strong className={cn("font-mono", getTextColorClass(compositeColor))}>{s.composite.toFixed(2)}</strong>
                  {" "}· Confidence{" "}
                  <strong className={cn("font-mono", getTextColorClass(s.probability > 60 ? "emerald" : "amber"))}>{s.probability}%</strong>
                </p>
              </div>

              {/* Active Alerts */}
              {alerts.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase text-muted-foreground/50 font-semibold tracking-widest mb-3">
                    Active Alerts
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {alerts.map((a) => (
                      <span
                        key={a.label}
                        className={cn(
                          "text-xs px-3 py-1.5 rounded-lg font-semibold uppercase tracking-wider",
                          getBackgroundColorClass(a.color, "500", "10"),
                          getTextColorClass(a.color, "400")
                        )}
                      >
                        <SFIcon name={a.icon} size={12} className="mr-1 inline-block" /> {a.label} {a.detail && `(${a.detail})`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ─────────────────────────────────────────────── */}
            <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between flex-shrink-0 gap-3">
              <button
                onClick={onClose}
                className="text-muted-foreground/60 hover:text-foreground text-sm font-medium transition-colors h-10 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08]"
              >
                Close
              </button>
              <motion.button
                onClick={() => { onClose(); onViewDetail(s.ticker); }}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold text-sm rounded-xl h-10"
                whileHover={{ translateY: -1, boxShadow: SHADOW_CTA_GLOW }}
                transition={SPRING_PHYSICS_DEFAULT}
              >
                View Full Detail →
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}