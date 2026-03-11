"use client";

import React, { memo, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePortfolio, type HoldingAnalysis, type MissingSector, type AlphaAlert, type RotationSuggestion } from "@/hooks/use-portfolio";
import { Card } from "@/components/ui/card";
import { AppleButton } from "@/components/ui/apple-button";
import { SFIcon } from "@/components/ui/SFIcon";
import { DataReveal, CardReveal } from "@/components/ui/data-reveal";
import {
  SPRING_TRANSITION_PROPS,
  CARD_HOVER_MOTION_PROPS,
  TRACKING_HEADING_CLASS,
} from "@/lib/constants";
import { cn, getTextColorClass, type PaletteColorKey } from "@/lib/utils";

// ── Aura Gauge (SVG ring) ──

const AURA_COLORS: Record<string, { stroke: string; glow: string; text: string }> = {
  "Ultra Instinct": { stroke: "#06b6d4", glow: "0 0 40px rgba(6,182,212,0.4)", text: "text-cyan-400" },
  "Strong": { stroke: "#10b981", glow: "0 0 40px rgba(16,185,129,0.4)", text: "text-emerald-400" },
  "Moderate": { stroke: "#f59e0b", glow: "0 0 40px rgba(245,158,11,0.4)", text: "text-amber-400" },
  "Weak": { stroke: "#f97316", glow: "0 0 30px rgba(249,115,22,0.3)", text: "text-orange-400" },
  "Critical": { stroke: "#f43f5e", glow: "0 0 30px rgba(244,63,94,0.3)", text: "text-rose-400" },
};

const AuraGauge = memo(({ score, label }: { score: number; label: string }) => {
  const colors = AURA_COLORS[label] || AURA_COLORS["Moderate"];
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-[200px] h-[200px]">
        <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90">
          {/* Background track */}
          <circle
            cx="80" cy="80" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <motion.circle
            cx="80" cy="80" r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.2, ease: [0.33, 1, 0.68, 1] }}
            style={{ filter: `drop-shadow(${colors.glow})` }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={cn("text-4xl font-extrabold font-mono-data", colors.text)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-xs text-muted-foreground uppercase tracking-[0.15em] mt-1 font-semibold">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
});
AuraGauge.displayName = "AuraGauge";

// ── Holdings Input Form ──

const HoldingInput = memo(({
  onAdd,
  signalTickers,
}: {
  onAdd: (ticker: string, shares: number, avgCost: number) => void;
  signalTickers: string[];
}) => {
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = useMemo(() => {
    if (!ticker || ticker.length < 1) return [];
    const upper = ticker.toUpperCase();
    return signalTickers.filter(t => t.startsWith(upper)).slice(0, 8);
  }, [ticker, signalTickers]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const t = ticker.trim().toUpperCase();
    const s = parseFloat(shares);
    const c = parseFloat(avgCost);
    if (t && s > 0 && c > 0) {
      onAdd(t, s, c);
      setTicker("");
      setShares("");
      setAvgCost("");
    }
  }, [ticker, shares, avgCost, onAdd]);

  const selectSuggestion = useCallback((t: string) => {
    setTicker(t);
    setShowSuggestions(false);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="relative flex-1 min-w-[120px]">
        <label className="text-xs text-muted-foreground uppercase tracking-[0.1em] font-semibold mb-1.5 block">Ticker</label>
        <input
          type="text"
          value={ticker}
          onChange={(e) => { setTicker(e.target.value.toUpperCase()); setShowSuggestions(true); }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onFocus={() => setShowSuggestions(true)}
          placeholder="AAPL"
          className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-foreground font-mono-data text-sm focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-colors"
        />
        {/* Autocomplete dropdown */}
        <AnimatePresence>
          {showSuggestions && filteredSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute z-50 left-0 right-0 mt-1 bg-card/95 backdrop-blur-lg border border-white/10 rounded-xl shadow-xl overflow-hidden"
            >
              {filteredSuggestions.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm font-mono-data hover:bg-white/[0.06] transition-colors text-cyan-400"
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(t); }}
                >
                  {t}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="min-w-[90px]">
        <label className="text-xs text-muted-foreground uppercase tracking-[0.1em] font-semibold mb-1.5 block">Shares</label>
        <input
          type="number"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          placeholder="100"
          min="0"
          step="any"
          className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-foreground font-mono-data text-sm focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-colors"
        />
      </div>
      <div className="min-w-[100px]">
        <label className="text-xs text-muted-foreground uppercase tracking-[0.1em] font-semibold mb-1.5 block">Avg Cost</label>
        <input
          type="number"
          value={avgCost}
          onChange={(e) => setAvgCost(e.target.value)}
          placeholder="150.00"
          min="0"
          step="0.01"
          className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-foreground font-mono-data text-sm focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-colors"
        />
      </div>
      <AppleButton type="submit" variant="primary" size="sm" disabled={!ticker || !shares || !avgCost}>
        <SFIcon name="plus.circle.fill" size="text-base" className="mr-1" />
        Add
      </AppleButton>
    </form>
  );
});
HoldingInput.displayName = "HoldingInput";

// ── Holdings Table ──

const HoldingsTable = memo(({
  holdings,
  onRemove,
}: {
  holdings: HoldingAnalysis[];
  onRemove: (ticker: string) => void;
}) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-[0.1em] text-muted-foreground/60">
          <th className="pb-3 pl-3">Ticker</th>
          <th className="pb-3">Shares</th>
          <th className="pb-3">Avg Cost</th>
          <th className="pb-3">Price</th>
          <th className="pb-3">P&L</th>
          <th className="pb-3">Weight</th>
          <th className="pb-3">Composite</th>
          <th className="pb-3">Sentiment</th>
          <th className="pb-3">Sector</th>
          <th className="pb-3 pr-3"></th>
        </tr>
      </thead>
      <tbody>
        {holdings.map((h, i) => (
          <motion.tr
            key={h.ticker}
            className="group hover:bg-white/[0.03] transition-colors"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, ...SPRING_TRANSITION_PROPS }}
          >
            <td className="py-3 pl-3">
              <div className="flex items-center gap-2">
                <span className="font-mono-data font-bold text-cyan-400">{h.ticker}</span>
                {h.alert && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Alert" />
                )}
              </div>
            </td>
            <td className="py-3 font-mono-data">{h.shares}</td>
            <td className="py-3 font-mono-data">${h.avg_cost.toFixed(2)}</td>
            <td className="py-3 font-mono-data">${h.current_price.toFixed(2)}</td>
            <td className="py-3">
              <span className={cn("font-mono-data font-semibold", h.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(2)}
                <span className="text-xs ml-1 opacity-60">({h.pnl_pct > 0 ? "+" : ""}{h.pnl_pct.toFixed(1)}%)</span>
              </span>
            </td>
            <td className="py-3 font-mono-data">{h.weight_pct.toFixed(1)}%</td>
            <td className="py-3">
              {h.composite !== null ? (
                <span className={cn("font-mono-data font-semibold", h.composite > 0 ? "text-emerald-400" : h.composite < 0 ? "text-rose-400" : "text-slate-400")}>
                  {h.composite.toFixed(2)}
                </span>
              ) : (
                <span className="text-muted-foreground/40">N/A</span>
              )}
            </td>
            <td className="py-3">
              <span className={cn(
                "text-xs font-semibold px-2 py-1 rounded-lg",
                h.sentiment.includes("Bullish") ? "bg-emerald-500/10 text-emerald-400" :
                h.sentiment.includes("Bearish") ? "bg-rose-500/10 text-rose-400" :
                "bg-white/[0.04] text-muted-foreground"
              )}>
                {h.sentiment}
              </span>
            </td>
            <td className="py-3 text-muted-foreground/60 text-xs">{h.sector}</td>
            <td className="py-3 pr-3">
              <button
                onClick={() => onRemove(h.ticker)}
                className="text-muted-foreground/40 hover:text-rose-400 transition-colors p-1 rounded-lg hover:bg-rose-500/10"
                title="Remove"
              >
                <SFIcon name="xmark.circle.fill" size="text-base" />
              </button>
            </td>
          </motion.tr>
        ))}
      </tbody>
    </table>
  </div>
));
HoldingsTable.displayName = "HoldingsTable";

// ── Sector Exposure Bar ──

const SectorExposureBar = memo(({ sectors }: { sectors: Record<string, { weight_pct: number; regime: string; avg_composite: number; count: number }> }) => {
  const sorted = useMemo(() =>
    Object.entries(sectors).sort(([, a], [, b]) => b.weight_pct - a.weight_pct),
    [sectors]
  );

  return (
    <div className="space-y-3">
      {sorted.map(([sector, data], i) => (
        <motion.div
          key={sector}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06, ...SPRING_TRANSITION_PROPS }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground/80">{sector}</span>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-lg font-medium",
                data.regime === "Trending" ? "bg-emerald-500/10 text-emerald-400" :
                data.regime === "Mean Reverting" ? "bg-amber-500/10 text-amber-400" :
                "bg-white/[0.04] text-muted-foreground/60"
              )}>
                {data.regime}
              </span>
            </div>
            <span className="font-mono-data text-sm text-muted-foreground">{data.weight_pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: data.avg_composite > 0.3
                  ? "linear-gradient(90deg, #06b6d4, #10b981)"
                  : data.avg_composite > 0
                  ? "linear-gradient(90deg, #06b6d4, #f59e0b)"
                  : "linear-gradient(90deg, #f97316, #f43f5e)",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, data.weight_pct)}%` }}
              transition={{ duration: 0.8, delay: i * 0.06, ease: [0.33, 1, 0.68, 1] }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
});
SectorExposureBar.displayName = "SectorExposureBar";

// ── Missing Sectors Cards ──

const MissingSectorCard = memo(({ sector, i }: { sector: MissingSector; i: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.06, ...SPRING_TRANSITION_PROPS }}
  >
    <Card className="p-4 hover:border-cyan-500/20 transition-colors" whileHover={CARD_HOVER_MOTION_PROPS}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <SFIcon name="exclamationmark.triangle.fill" size="text-sm" className={cn(
            sector.priority === "high" ? "text-amber-400" : sector.priority === "medium" ? "text-orange-400" : "text-muted-foreground/40"
          )} />
          <span className="font-semibold text-sm">{sector.sector}</span>
        </div>
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-lg font-semibold uppercase tracking-[0.1em]",
          sector.priority === "high" ? "bg-amber-500/10 text-amber-400" :
          sector.priority === "medium" ? "bg-orange-500/10 text-orange-400" :
          "bg-white/[0.04] text-muted-foreground/60"
        )}>
          {sector.priority}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Regime: <span className={cn("font-semibold", sector.regime === "Trending" ? "text-emerald-400" : "text-muted-foreground")}>{sector.regime}</span>
        </span>
        {sector.top_pick && (
          <span className="text-xs">
            Top: <span className="font-mono-data font-bold text-cyan-400">{sector.top_pick}</span>
            {sector.top_pick_composite !== null && (
              <span className={cn("ml-1 font-mono-data", sector.top_pick_composite > 0 ? "text-emerald-400" : "text-rose-400")}>
                {sector.top_pick_composite.toFixed(2)}
              </span>
            )}
          </span>
        )}
      </div>
    </Card>
  </motion.div>
));
MissingSectorCard.displayName = "MissingSectorCard";

// ── Alpha Alert Card ──

const AlertCard = memo(({ alert, i }: { alert: AlphaAlert; i: number }) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: i * 0.08, ...SPRING_TRANSITION_PROPS }}
  >
    <Card className="p-4 border-l-2 border-l-amber-500/40">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <SFIcon name="bell.badge.fill" size="text-base" className="text-amber-400" />
          <span className="font-mono-data font-bold text-amber-400">{alert.ticker}</span>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-lg font-medium",
            alert.alert_type.includes("exhausting") ? "bg-orange-500/10 text-orange-400" : "bg-rose-500/10 text-rose-400"
          )}>
            {alert.alert_type.replace(/_/g, " ")}
          </span>
        </div>
        {alert.composite !== null && (
          <span className={cn("font-mono-data text-sm font-semibold", alert.composite > 0 ? "text-emerald-400" : "text-rose-400")}>
            {alert.composite.toFixed(2)}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground/80 mb-2">{alert.message}</p>
      <div className="flex items-center gap-2 text-xs">
        <SFIcon name="arrow.right.circle.fill" size="text-sm" className="text-cyan-400" />
        <span className="text-foreground/80 font-medium">{alert.action}</span>
      </div>
    </Card>
  </motion.div>
));
AlertCard.displayName = "AlertCard";

// ── Rotation Suggestion Card ──

const RotationCard = memo(({ suggestion, i }: { suggestion: RotationSuggestion; i: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.08, ...SPRING_TRANSITION_PROPS }}
  >
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-2">
        {/* Sell side */}
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-rose-400">
            <SFIcon name="arrow.down.circle.fill" size="text-base" />
          </span>
          <span className="font-mono-data font-bold text-rose-400">{suggestion.sell_ticker}</span>
          <span className="text-xs text-muted-foreground/60">({suggestion.sell_sentiment})</span>
        </div>
        {/* Arrow */}
        <div className="text-muted-foreground/40">
          <SFIcon name="arrow.right" size="text-base" />
        </div>
        {/* Buy side */}
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-emerald-400">
            <SFIcon name="arrow.up.circle.fill" size="text-base" />
          </span>
          <span className="font-mono-data font-bold text-emerald-400">{suggestion.buy_ticker}</span>
          <span className="text-xs text-muted-foreground/60">({suggestion.buy_sentiment})</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground/70">{suggestion.rationale}</p>
    </Card>
  </motion.div>
));
RotationCard.displayName = "RotationCard";

// ── Empty State ──

const EmptyState = memo(() => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-16"
  >
    <div className="w-20 h-20 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-5">
      <SFIcon name="briefcase.fill" size="text-3xl" className="text-cyan-400/60" />
    </div>
    <h3 className={cn("text-xl font-bold mb-2", TRACKING_HEADING_CLASS)}>No Holdings Yet</h3>
    <p className="text-muted-foreground/60 text-sm max-w-md mx-auto">
      Add your portfolio positions above. Our quant engine will instantly score your portfolio health,
      expose blind spots, and surface alpha-generating rotation opportunities.
    </p>
  </motion.div>
));
EmptyState.displayName = "EmptyState";

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

interface PortfolioIntelligenceProps {
  signalTickers?: string[];
}

export const PortfolioIntelligence = memo(({ signalTickers = [] }: PortfolioIntelligenceProps) => {
  const {
    holdings,
    addHolding,
    removeHolding,
    clearHoldings,
    analysis,
    analyzing,
    hasHoldings,
  } = usePortfolio();

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className={cn("text-4xl font-extrabold md:text-5xl flex items-center gap-4", TRACKING_HEADING_CLASS)}>
          <SFIcon name="briefcase.fill" size="text-5xl md:text-6xl" className="text-violet-400" />
          Portfolio Intelligence
        </h1>
        {hasHoldings && (
          <AppleButton variant="ghost" size="sm" onClick={clearHoldings}>
            <SFIcon name="trash.fill" size="text-sm" className="mr-1" />
            Clear All
          </AppleButton>
        )}
      </div>

      {/* ── Holdings Input ── */}
      <Card className="p-5">
        <h2 className={cn("text-lg font-bold mb-4 flex items-center gap-2", TRACKING_HEADING_CLASS)}>
          <SFIcon name="plus.circle.fill" size="text-xl" className="text-cyan-400" />
          Add Holdings
        </h2>
        <HoldingInput onAdd={addHolding} signalTickers={signalTickers} />
      </Card>

      {/* ── Analysis Results ── */}
      {!hasHoldings && <EmptyState />}

      {hasHoldings && (
        <AnimatePresence mode="wait">
          <motion.div
            key="analysis"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* ── Aura + KPIs Row ── */}
            <DataReveal loading={analyzing && !analysis} delay={0}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Aura Gauge */}
                <Card className="p-6 flex flex-col items-center justify-center">
                  <h3 className="text-xs text-muted-foreground uppercase tracking-[0.15em] font-semibold mb-4">Portfolio Aura</h3>
                  {analysis ? (
                    <AuraGauge score={analysis.aura_score} label={analysis.aura_label} />
                  ) : (
                    <div className="w-[200px] h-[200px] rounded-full bg-white/[0.03] animate-pulse" />
                  )}
                </Card>

                {/* Portfolio KPIs */}
                <Card className="p-6 lg:col-span-2">
                  <h3 className="text-xs text-muted-foreground uppercase tracking-[0.15em] font-semibold mb-4">Portfolio Summary</h3>
                  {analysis ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: "Total Value", value: `$${analysis.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "cyan" },
                        { label: "Total P&L", value: `${analysis.total_pnl >= 0 ? "+" : ""}$${analysis.total_pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: analysis.total_pnl >= 0 ? "emerald" : "rose" },
                        { label: "P&L %", value: `${analysis.total_pnl_pct >= 0 ? "+" : ""}${analysis.total_pnl_pct.toFixed(2)}%`, color: analysis.total_pnl_pct >= 0 ? "emerald" : "rose" },
                        { label: "Positions", value: analysis.holdings_count.toString(), color: "violet" },
                      ].map((kpi) => (
                        <div key={kpi.label} className="text-center">
                          <div className={cn("text-2xl font-bold font-mono-data mb-1", getTextColorClass(kpi.color as PaletteColorKey))}>{kpi.value}</div>
                          <div className="text-xs text-muted-foreground/60 uppercase tracking-[0.1em]">{kpi.label}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </DataReveal>

            {/* ── Holdings Table ── */}
            {analysis && analysis.holdings_analysis.length > 0 && (
              <CardReveal loading={false} delay={100}>
                <Card className="p-5">
                  <h2 className={cn("text-lg font-bold mb-4 flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                    <SFIcon name="tablecells.fill" size="text-xl" className="text-cyan-400" />
                    Holdings Analysis
                    <span className="text-xs text-muted-foreground/60 font-normal tracking-normal ml-2">
                      {analysis.holdings_count} position{analysis.holdings_count !== 1 ? "s" : ""}
                    </span>
                  </h2>
                  <HoldingsTable holdings={analysis.holdings_analysis} onRemove={removeHolding} />
                </Card>
              </CardReveal>
            )}

            {/* ── Sector Exposure + Missing Sectors Row ── */}
            {analysis && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sector Exposure */}
                <CardReveal loading={false} delay={200}>
                  <Card className="p-5">
                    <h2 className={cn("text-lg font-bold mb-4 flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                      <SFIcon name="chart.pie.fill" size="text-xl" className="text-cyan-400" />
                      Sector Exposure
                    </h2>
                    <SectorExposureBar sectors={analysis.sector_exposure} />
                  </Card>
                </CardReveal>

                {/* Missing Sectors */}
                <CardReveal loading={false} delay={300}>
                  <Card className="p-5">
                    <h2 className={cn("text-lg font-bold mb-4 flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                      <SFIcon name="exclamationmark.triangle.fill" size="text-xl" className="text-amber-400" />
                      Diversification Gaps
                      <span className="text-xs text-muted-foreground/60 font-normal tracking-normal ml-2">
                        {analysis.missing_sectors.length} sector{analysis.missing_sectors.length !== 1 ? "s" : ""} uncovered
                      </span>
                    </h2>
                    {analysis.missing_sectors.length > 0 ? (
                      <div className="space-y-3">
                        {analysis.missing_sectors.map((s, i) => (
                          <MissingSectorCard key={s.sector} sector={s} i={i} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-emerald-400 font-medium">All major sectors covered. Diversification is strong.</p>
                    )}
                  </Card>
                </CardReveal>
              </div>
            )}

            {/* ── Alpha Alerts ── */}
            {analysis && analysis.alpha_alerts.length > 0 && (
              <CardReveal loading={false} delay={400}>
                <Card className="p-5">
                  <h2 className={cn("text-lg font-bold mb-4 flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                    <SFIcon name="bell.badge.fill" size="text-xl" className="text-amber-400" />
                    Alpha Alerts
                    <span className="text-xs bg-amber-500/10 text-amber-400 font-semibold px-2 py-0.5 rounded-lg ml-2">
                      {analysis.alpha_alerts.length}
                    </span>
                  </h2>
                  <div className="space-y-3">
                    {analysis.alpha_alerts.map((a, i) => (
                      <AlertCard key={a.ticker} alert={a} i={i} />
                    ))}
                  </div>
                </Card>
              </CardReveal>
            )}

            {/* ── Rotation Suggestions ── */}
            {analysis && analysis.rotation_suggestions.length > 0 && (
              <CardReveal loading={false} delay={500}>
                <Card className="p-5">
                  <h2 className={cn("text-lg font-bold mb-4 flex items-center gap-2", TRACKING_HEADING_CLASS)}>
                    <SFIcon name="arrow.triangle.2.circlepath" size="text-xl" className="text-violet-400" />
                    Rotation Suggestions
                    <span className="text-xs text-muted-foreground/60 font-normal tracking-normal ml-2">
                      AI-powered position swaps
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysis.rotation_suggestions.map((s, i) => (
                      <RotationCard key={`${s.sell_ticker}-${s.buy_ticker}`} suggestion={s} i={i} />
                    ))}
                  </div>
                </Card>
              </CardReveal>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
});

PortfolioIntelligence.displayName = "PortfolioIntelligence";
