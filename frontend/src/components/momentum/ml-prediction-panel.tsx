"use client";

/**
 * MlPredictionPanel — XGBoost Prediction + Triage Gate Results
 * =============================================================
 * Renders below the legacy stat tiles on the Ticker Detail page.
 *
 * States:
 *   - Loading:  animated pipeline progress indicator
 *   - Complete: XGBoost Bullish Probability gauge + triage breakdown
 *   - Anomaly:  Alpha Alert card (top 5% statistical anomaly)
 *   - Error:    subtle error banner (legacy scores still visible)
 */

import React, { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { SFIcon } from "@/components/ui/sf-icon";
import { cn, getTextColorClass, getBackgroundColorClass, type PaletteColorKey } from "@/lib/utils";
import {
  SPRING_PHYSICS_DEFAULT,
  TRACKING_HEADING_CLASS,
  SHADOW_GLOW_CYAN_VALUE,
  CARD_HOVER_MOTION_PROPS,
  SPRING_TRANSITION_PROPS,
} from "@/lib/constants";
import type { MlResult, PipelineStep } from "@/hooks/use-hybrid-prediction";

// ── Pipeline step order (for progress bar) ──────────────────────────────────

const PIPELINE_STEPS = [
  { key: "fetching_data", label: "Data", icon: "arrow.down.circle.fill" },
  { key: "engineering_features", label: "Features", icon: "function" },
  { key: "xgboost_inference", label: "XGBoost", icon: "brain" },
  { key: "triage_gate", label: "Triage", icon: "target" },
] as const;

function getStepIndex(step: PipelineStep): number {
  const idx = PIPELINE_STEPS.findIndex((s) => s.key === step);
  return idx >= 0 ? idx : -1;
}

// ── Probability → color mapping ─────────────────────────────────────────────

function getProbColor(prob: number): PaletteColorKey {
  if (prob >= 70) return "emerald";
  if (prob >= 55) return "cyan";
  if (prob >= 45) return "amber";
  if (prob >= 30) return "rose";
  return "rose";
}

function getProbLabel(prob: number): string {
  if (prob >= 75) return "Strong Bullish";
  if (prob >= 60) return "Bullish";
  if (prob >= 45) return "Neutral";
  if (prob >= 30) return "Bearish";
  return "Strong Bearish";
}

// ── Sub-components ──────────────────────────────────────────────────────────

/** Animated pipeline progress stepper */
const PipelineStepper = memo(({ currentStep }: { currentStep: PipelineStep }) => {
  const activeIdx = getStepIndex(currentStep);

  return (
    <div className="flex items-center gap-1 w-full">
      {PIPELINE_STEPS.map((s, i) => {
        const isActive = i === activeIdx;
        const isDone = i < activeIdx;
        const isPending = i > activeIdx;

        return (
          <React.Fragment key={s.key}>
            {/* Step dot + label */}
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <motion.div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300",
                  isActive && "bg-cyan-500/20 text-cyan-400 ring-2 ring-cyan-500/30",
                  isDone && "bg-emerald-500/15 text-emerald-400",
                  isPending && "bg-white/[0.04] text-muted-foreground/30"
                )}
                animate={isActive ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                transition={isActive ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : undefined}
              >
                {isDone ? (
                  <SFIcon name="checkmark" size={14} />
                ) : (
                  <SFIcon name={s.icon} size={14} />
                )}
              </motion.div>
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap",
                isActive && "text-cyan-400",
                isDone && "text-emerald-400/60",
                isPending && "text-muted-foreground/25"
              )}>
                {s.label}
              </span>
            </div>
            {/* Connector line */}
            {i < PIPELINE_STEPS.length - 1 && (
              <div className="flex-shrink-0 w-8 h-px relative -mt-4">
                <div className="absolute inset-0 bg-white/[0.06] rounded-full" />
                <motion.div
                  className="absolute inset-y-0 left-0 bg-cyan-500/40 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: isDone ? "100%" : isActive ? "50%" : "0%" }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});
PipelineStepper.displayName = "PipelineStepper";

/** Circular probability gauge */
const ProbabilityGauge = memo(({ probability }: { probability: number }) => {
  const pct = Math.round(probability * 100);
  const color = getProbColor(pct);
  const label = getProbLabel(pct);

  // SVG arc parameters
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          {/* Background ring */}
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="8"
          />
          {/* Progress arc */}
          <motion.circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            className={getTextColorClass(color, "400")}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: [0.32, 0.72, 0, 1] }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={cn("text-3xl font-extrabold font-mono-data tabular-nums", getTextColorClass(color, "400"))}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, ...SPRING_PHYSICS_DEFAULT }}
          >
            {pct}%
          </motion.span>
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-semibold mt-0.5">
            Bullish
          </span>
        </div>
      </div>
      <span className={cn(
        "text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-lg",
        getBackgroundColorClass(color, "500", "10"),
        getTextColorClass(color, "400")
      )}>
        {label}
      </span>
    </div>
  );
});
ProbabilityGauge.displayName = "ProbabilityGauge";

/** Triage breakdown stat */
function TriageStat({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center px-3 py-2">
      <span className="text-lg font-bold font-mono-data text-foreground/90 tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-semibold mt-0.5">{label}</span>
      <span className="text-[10px] text-muted-foreground/30 mt-0.5 max-w-[100px] leading-tight">{description}</span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface MlPredictionPanelProps {
  step: PipelineStep;
  stepLabel: string;
  mlResult: MlResult | null;
  isAnomaly: boolean;
  isComplete: boolean;
  isLoading: boolean;
  isStreaming: boolean;
}

const MlPredictionPanelComponent = ({
  step,
  stepLabel,
  mlResult,
  isAnomaly,
  isComplete,
  isLoading,
  isStreaming,
}: MlPredictionPanelProps) => {

  // Don't render anything if idle
  if (step === "idle") return null;

  return (
    <AnimatePresence mode="wait">
      {/* ── Loading / Streaming State ─────────────────────────────── */}
      {isLoading && (
        <motion.div
          key="ml-loading"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={SPRING_PHYSICS_DEFAULT}
        >
          <Card className="p-5 border border-cyan-500/[0.08]">
            <div className="flex items-center gap-3 mb-5">
              <motion.div
                className="w-2 h-2 rounded-full bg-cyan-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
              <span className={cn("text-sm font-semibold text-cyan-400", TRACKING_HEADING_CLASS)}>
                {stepLabel}
              </span>
              {isStreaming && (
                <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-medium ml-auto">
                  SSE Connected
                </span>
              )}
            </div>
            <PipelineStepper currentStep={step} />
          </Card>
        </motion.div>
      )}

      {/* ── Complete / Anomaly State ──────────────────────────────── */}
      {isComplete && mlResult && mlResult.probability !== null && (
        <motion.div
          key="ml-result"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ ...SPRING_PHYSICS_DEFAULT, delay: 0.1 }}
          className="space-y-3"
        >
          {/* ── Alpha Alert (top 5% anomaly) ─────────────────────── */}
          {isAnomaly && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...SPRING_PHYSICS_DEFAULT, delay: 0.2 }}
            >
              <Card className={cn(
                "p-5 relative overflow-hidden",
                "border border-amber-500/20",
                "bg-gradient-to-r from-amber-500/[0.06] via-orange-500/[0.04] to-rose-500/[0.06]"
              )}>
                {/* Glow overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.03] to-transparent pointer-events-none" />

                <div className="relative flex items-start gap-4">
                  {/* Icon */}
                  <motion.div
                    className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0"
                    animate={{ rotate: [0, -5, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  >
                    <SFIcon name="bolt.fill" size={24} className="text-amber-400" />
                  </motion.div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={cn("text-base font-extrabold text-amber-400", TRACKING_HEADING_CLASS)}>
                        Alpha Alert — Statistical Anomaly
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold uppercase tracking-widest">
                        Top 5%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground/70 leading-relaxed">
                      This ticker ranks in the <strong className="text-amber-400/90">top 5%</strong> of the market today
                      based on combined <strong className="text-foreground/80">Model Conviction</strong> and{" "}
                      <strong className="text-foreground/80">Volume Spikes</strong> cross-sectional ranking.
                    </p>

                    {/* Triage breakdown */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-amber-500/10">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">Triage</span>
                        <span className="text-sm font-bold font-mono-data text-amber-400">
                          {((mlResult.triage_score ?? 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">Conviction</span>
                        <span className="text-sm font-bold font-mono-data text-foreground/80">
                          {((mlResult.ranked_conviction ?? 0) * 100).toFixed(0)}th pctl
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">Volume</span>
                        <span className="text-sm font-bold font-mono-data text-foreground/80">
                          {((mlResult.ranked_volume ?? 0) * 100).toFixed(0)}th pctl
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── Prediction Result Card ───────────────────────────── */}
          <Card className="p-5 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <SFIcon name="brain" size={16} className="text-cyan-400" />
              <h3 className={cn("text-xs font-semibold text-muted-foreground/50 uppercase tracking-widest")}>
                XGBoost Prediction
              </h3>
              {mlResult.elapsed_seconds > 0 && (
                <span className="text-[10px] text-muted-foreground/30 ml-auto font-mono-data">
                  {mlResult.elapsed_seconds.toFixed(1)}s
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Gauge */}
              <ProbabilityGauge probability={mlResult.probability} />

              {/* Triage stats */}
              <div className="flex-1 grid grid-cols-3 gap-2">
                <TriageStat
                  label="Triage Score"
                  value={((mlResult.triage_score ?? 0) * 100).toFixed(1) + "%"}
                  description="Blended gate metric"
                />
                <TriageStat
                  label="Conviction Rank"
                  value={((mlResult.ranked_conviction ?? 0) * 100).toFixed(0) + "th"}
                  description="XGB deviation rank"
                />
                <TriageStat
                  label="Volume Rank"
                  value={((mlResult.ranked_volume ?? 0) * 100).toFixed(0) + "th"}
                  description="Volume Z-score rank"
                />
              </div>
            </div>

            {/* ── Suggested Allocation (Kelly Criterion) ──────────── */}
            {mlResult.suggested_weight != null && mlResult.suggested_weight > 0 && (
              <motion.div
                className="mt-4 pt-4 border-t border-white/[0.04]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, ...SPRING_PHYSICS_DEFAULT }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <SFIcon name="chart.pie.fill" size={16} className="text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-semibold block">
                        Suggested Allocation
                      </span>
                      <span className="text-[10px] text-muted-foreground/25 block mt-0.5">
                        Half-Kelly × Risk Budget
                      </span>
                    </div>
                  </div>
                  <span className={cn(
                    "text-2xl font-extrabold font-mono-data tabular-nums",
                    getTextColorClass("emerald", "400")
                  )}>
                    {(mlResult.suggested_weight * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/30 font-mono-data mt-2 leading-relaxed">
                  w = (0.5 × (2p−1)) × (R_target / NATR₂₀) ={" "}
                  <span className="text-emerald-400/70 font-bold">
                    {(mlResult.suggested_weight * 100).toFixed(1)}%
                  </span>{" "}
                  of portfolio
                </p>
              </motion.div>
            )}

            {/* Formula callout */}
            <div className="mt-4 pt-3 border-t border-white/[0.04]">
              <p className="text-[11px] text-muted-foreground/40 font-mono-data leading-relaxed">
                TriageScore = 0.6 × RankedConviction + 0.4 × RankedVolume ={" "}
                <span className={cn("font-bold", getTextColorClass(
                  (mlResult.triage_score ?? 0) >= 0.95 ? "amber" : "cyan", "400"
                ))}>
                  {((mlResult.triage_score ?? 0) * 100).toFixed(1)}%
                </span>
                {" "}({mlResult.universe_size} tickers ranked)
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Error State ──────────────────────────────────────────── */}
      {step === "error" && (
        <motion.div
          key="ml-error"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={SPRING_PHYSICS_DEFAULT}
        >
          <Card className="p-4 border border-rose-500/10 bg-rose-500/[0.03]">
            <div className="flex items-center gap-3">
              <SFIcon name="exclamationmark.triangle.fill" size={16} className="text-rose-400/60" />
              <div>
                <p className="text-sm text-rose-400/80 font-medium">ML Pipeline Error</p>
                <p className="text-[11px] text-muted-foreground/40 mt-0.5">
                  {mlResult?.error || "The XGBoost pipeline encountered an error. Legacy scores remain available above."}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Timeout State ────────────────────────────────────────── */}
      {step === "timeout" && (
        <motion.div
          key="ml-timeout"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-4 border border-amber-500/10 bg-amber-500/[0.03]">
            <div className="flex items-center gap-3">
              <SFIcon name="clock.fill" size={16} className="text-amber-400/60" />
              <p className="text-sm text-amber-400/80 font-medium">Pipeline timed out — legacy scores are still displayed above.</p>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MlPredictionPanel = memo(MlPredictionPanelComponent);
MlPredictionPanel.displayName = "MlPredictionPanel";
