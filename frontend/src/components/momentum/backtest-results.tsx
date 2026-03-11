"use client";

import { cn, getBackgroundColorClass, getTextColorClass } from "@/lib/utils";
import { COLORS } from "@/lib/constants"; // Assuming Z_INDEX_STICKY_HEADER is here
import { SFIcon } from "@/components/ui/SFIcon";
import type { BacktestResult } from "@/types/momentum";
import dynamic from "next/dynamic";
import React, { useMemo, memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Use the refined AppleCard for consistent premium styling
import { AppleCard } from "@/components/ui/apple-card";

// Reusable Framer Motion animation properties for consistent UI
const SPRING_TRANSITION = { type: "spring", stiffness: 300, damping: 30 };
const HOVER_SPRING = { type: "spring", stiffness: 400, damping: 25 };

const fadeInVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { ...SPRING_TRANSITION, duration: 0.3 } },
  exit: { opacity: 0, y: -20, transition: { ...SPRING_TRANSITION, duration: 0.3 } },
};

// Local Z-index constant, should ideally be imported from lib/constants.ts
const Z_INDEX_STICKY_HEADER = 10;

// Lazy load charts with appropriate loading states
const LazyEquityChart = dynamic(
  () => import("@/components/charts/equity-chart").then((mod) => mod.EquityChart),
  {
    ssr: false,
    loading: () => (
      <AppleCard className="flex flex-col items-center justify-center p-4 min-h-[16rem]"> {/* Replaced fixed height with min-h */}
        <div className="skeleton h-6 w-3/4 mb-4" />
        <div className="skeleton h-4 w-1/2" />
      </AppleCard>
    ),
  }
);

// Simplified placeholder for a future DrawdownChart, following the design philosophy
const PlaceholderDrawdownChart = ({ className }: { className?: string }) => (
  <AppleCard
    className={cn(
      "flex flex-col items-center justify-center text-center space-y-2 p-6 min-h-[16rem]", // Use min-h here
      className
    )}
  >
    <SFIcon name="chart.line.downswing.xyaxis" size={36} className="text-cyan-500 mb-2" />
    <p className="text-base font-semibold text-foreground tracking-tight">Drawdown Analysis</p>
    <p className="text-sm text-muted-foreground/80 max-w-[80%] mx-auto">
      Advanced visualization of peak-to-trough equity movements.
    </p>
    <p className="text-sm font-medium text-cyan-500 mt-2 text-label-uppercase">
      Coming Soon
    </p>
  </AppleCard>
);

const LazyDrawdownChart = dynamic(
  () =>
    Promise.resolve({
      DrawdownChart: PlaceholderDrawdownChart,
    }).then((mod) => mod.DrawdownChart),
  {
    ssr: false,
    loading: () => (
      <AppleCard className="flex flex-col items-center justify-center p-4 min-h-[16rem]">
        <div className="skeleton h-6 w-3/4 mb-4" />
        <div className="skeleton h-4 w-1/2" />
      </AppleCard>
    ),
  }
);

interface BacktestResultsProps {
  result: BacktestResult;
}

// Helper to determine color key based on value for use with design token helpers
const getValueColorKey = (value: number, thresholdPositive = 0, thresholdNegative = 0): 'emerald' | 'rose' | 'slate' | 'amber' => {
  if (value > thresholdPositive) return "emerald";
  if (value < thresholdNegative) return "rose";
  if (value === 0 && thresholdPositive === 0) return "slate"; // special case for 0 when neutral allowed
  return "amber"; // Default for warnings/neutral if not bullish/bearish
};

// Memoized component for individual table rows to prevent re-renders
const TradeRow = memo(function TradeRow({ t, i }: { t: BacktestResult["trades"][0]; i: number }) {
  const pnlColorKey = useMemo(() => getValueColorKey(t.pnl), [t.pnl]);
  const returnColorKey = useMemo(() => getValueColorKey(t.return_pct), [t.return_pct]);

  const rowHoverProps = useMemo(() => ({
    backgroundColor: "rgba(15,23,42,0.6)", // Consistent with bg-card, slightly darker on hover
    y: -1,
    boxShadow: "var(--shadow-soft)",
  }), []);

  const rowClassName = useMemo(() => cn(
    "relative group",
    i % 2 === 0 ? getBackgroundColorClass("slate", "800", "30") : getBackgroundColorClass("slate", "800", "20"), // Subtle alternating row backgrounds
    i === 0 ? "mt-2" : "", // Margin for first row inside tbody
    i === 99 ? "mb-2" : "" // Margin for last row inside tbody if 100 trades displayed
  ), [i]);

  return (
    <motion.tr
      key={i}
      className={rowClassName}
      whileHover={rowHoverProps}
      transition={SPRING_TRANSITION}
    >
      <td className="px-3 py-2 font-mono-data text-xs lg:text-sm text-foreground/90">{t.entry_date}</td>
      <td className="px-3 py-2 font-mono-data text-xs lg:text-sm text-foreground/90">{t.exit_date}</td>
      <td className="px-3 py-2">
        <span className={cn(
          "px-2 py-1 rounded-full text-[0.68rem] font-semibold tracking-wide",
          getBackgroundColorClass(t.direction === "LONG" ? "emerald" : "rose", '500', '20'),
          getTextColorClass(t.direction === "LONG" ? "emerald" : "rose", '400')
        )}>
          {t.direction}
        </span>
      </td>
      <td className="px-3 py-2 font-mono-data text-xs lg:text-sm text-foreground/90">${t.entry_price}</td>
      <td className="px-3 py-2 font-mono-data text-xs lg:text-sm text-foreground/90">${t.exit_price}</td>
      <td className="px-3 py-2 font-mono-data text-xs lg:text-sm text-foreground/90">{t.shares}</td>
      <td className={cn("px-3 py-2 font-bold font-mono-data text-xs lg:text-sm", getTextColorClass(pnlColorKey, '400'))}>
        {t.pnl > 0 ? "+" : ""}{t.pnl.toFixed(0)}
      </td>
      <td className={cn("px-3 py-2 font-mono-data text-xs lg:text-sm", getTextColorClass(returnColorKey, '400'))}>
        {t.return_pct > 0 ? "+" : ""}{t.return_pct}%
      </td>
      <td className="px-3 py-2 text-muted-foreground text-[0.65rem] lg:text-xs">
        {t.composite_at_entry || "N/A"}
      </td>
    </motion.tr>
  );
});


export const BacktestResults = memo(function BacktestResults({ result }: BacktestResultsProps) {
  const s = result.summary || ({} as Record<string, number>);
  const ic = s.initial_capital || 100000;
  const fe = s.final_equity || ic + (s.total_return || 0);

  // Memoize metrics array for performance and prevent unnecessary re-creations
  const metrics = useMemo(
    () => [
      { l: "Initial Capital", v: "$" + ic.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }), colorKey: "cyan" },
      { l: "Final Equity", v: "$" + Math.round(fe).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }), colorKey: getValueColorKey(fe - ic, 0) },
      { l: "Total Return", v: (s.total_return_pct || 0).toFixed(1) + "%", colorKey: getValueColorKey(s.total_return_pct || 0, 0) },
      { l: "Ann. Return", v: (s.annualised_return || 0).toFixed(1) + "%", colorKey: getValueColorKey(s.annualised_return || 0, 0) },
      { l: "Max Peak Profit", v: "$" + (s.max_peak_profit || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }), colorKey: "emerald" },
      { l: "Max Drawdown $", v: "$" + Math.abs(s.max_drawdown || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }), colorKey: "rose" },
      { l: "Max Drawdown %", v: (s.max_drawdown_pct || 0).toFixed(1) + "%", colorKey: "rose" },
      { l: "Sharpe Ratio", v: (s.sharpe_ratio || 0).toFixed(2), colorKey: getValueColorKey(s.sharpe_ratio || 0, 0.5, 0.2) },
      { l: "Sortino Ratio", v: (s.sortino_ratio || 0).toFixed(2), colorKey: getValueColorKey(s.sortino_ratio || 0, 1, 0.5) },
      { l: "Win Rate", v: (s.win_rate || 0).toFixed(0) + "%", colorKey: getValueColorKey(s.win_rate || 0, 50, 30) },
      { l: "Profit Factor", v: (s.profit_factor || 0).toFixed(2), colorKey: getValueColorKey(s.profit_factor || 0, 1.5, 0.8) },
      { l: "Total Trades", v: String(s.total_trades || 0), colorKey: "cyan" },
      { l: "Best Trade", v: "$" + (s.best_trade || 0).toFixed(0), colorKey: "emerald" },
      { l: "Worst Trade", v: "$" + (s.worst_trade || 0).toFixed(0), colorKey: "rose" },
      { l: "Consec Wins", v: String(s.max_consec_wins || 0), colorKey: "emerald" },
      { l: "Consec Losses", v: String(s.max_consec_losses || 0), colorKey: "rose" },
      { l: "Avg Hold Days", v: (s.avg_holding_days || 0).toFixed(1), colorKey: "slate" },
      { l: "Elapsed", v: (s.elapsed_ms || 0).toFixed(0) + "ms", colorKey: "slate" },
    ],
    [s, ic, fe]
  );

  const trades = result.trades || [];
  const displayedTrades = trades.slice(0, 100); // Display max 100 trades for performance, with indication

  // Monthly returns heatmap logic
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyReturns = result.monthly_returns || [];
  const byYM: Record<string, number> = {};
  monthlyReturns.forEach((m) => (byYM[m.month] = m.pnl));
  const years = useMemo(() => {
    return [...new Set(monthlyReturns.map((m) => m.month.slice(0, 4)))].sort();
  }, [monthlyReturns]);

  const getMonthlyReturnBgColorClass = useCallback((pnl: number | undefined) => {
    if (pnl === undefined) return "bg-transparent";
    const absPnl = Math.abs(pnl || 0);
    const intensity = Math.min(80, Math.max(5, absPnl / (pnl > 0 ? 30 : 15))); // Scale for Tailwind opacity classes (5-80)
    const opacityString = `${Math.floor(intensity)}`;

    if (pnl > 0) return getBackgroundColorClass("emerald", "500", opacityString);
    if (pnl < 0) return getBackgroundColorClass("rose", "500", opacityString);
    return getBackgroundColorClass("slate", "500", opacityString); // Neutral color for zero PNL
  }, []);

  const getMonthlyReturnTextColorClass = useCallback((pnl: number | undefined) => {
    if (pnl === undefined) return "text-muted-foreground opacity-50";
    if (pnl > 0) return getTextColorClass("emerald", "400");
    if (pnl < 0) return getTextColorClass("rose", "400");
    return getTextColorClass("slate", "400");
  }, []);

  return (
    <motion.div
      className="mt-8 space-y-8 lg:space-y-12"
      initial={fadeInVariants.initial}
      animate={fadeInVariants.animate}
      transition={{ delay: 0.05, ...SPRING_TRANSITION, duration: 0.5 }}
    >
      {/* Metrics Grid */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6 letter-spacing-heading">Key Performance Indicators</h2>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.08, // Stagger children for entrance
              },
            },
          }}
          initial="hidden"
          animate="show"
        >
          {metrics.map((m) => (
            <AppleCard
              key={m.l}
              className="flex flex-col items-center justify-center p-4 md:p-5" // Removed fixed height
              glowColor={m.colorKey} // Using colorKey directly
              whileHover={{ y: -2, boxShadow: `var(--shadow-elevated), var(--shadow-glow-${m.colorKey})`, transition: HOVER_SPRING }}
            >
              <div
                className={cn(
                  "text-2xl md:text-3xl font-extrabold font-mono-data mb-1 leading-none tracking-[-0.02em]",
                  getTextColorClass(m.colorKey, '400') // Using colorKey with helper
                )}
              >
                {m.v}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground text-label-uppercase text-center">
                {m.l}
              </div>
            </AppleCard>
          ))}
        </motion.div>
      </div>

      {/* Equity Curve & Drawdown */}
      {(result.equity_curve?.length > 0 || result.drawdown?.length > 0) && (
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6 letter-spacing-heading">Performance Visuals</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <motion.div {...fadeInVariants} transition={{ delay: 0.1, ...fadeInVariants.animate.transition }}>
              <div className="text-sm font-semibold text-muted-foreground text-label-uppercase mb-3 ml-2">Equity Curve</div>
              <LazyEquityChart data={result.equity_curve} className="min-h-[16rem] p-4" /> {/* Replaced fixed height with min-h */}
            </motion.div>
            <motion.div {...fadeInVariants} transition={{ delay: 0.2, ...fadeInVariants.animate.transition }}>
              <div className="text-sm font-semibold text-muted-foreground text-label-uppercase mb-3 ml-2">Drawdown Analysis</div>
              <LazyDrawdownChart className="min-h-[16rem] p-4" /> {/* Replaced fixed height with min-h */}
            </motion.div>
          </div>
        </div>
      )}

      {/* Monthly Returns Heatmap */}
      {monthlyReturns.length > 0 && (
        <motion.div {...fadeInVariants} transition={{ delay: 0.3, ...fadeInVariants.animate.transition }}>
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6 letter-spacing-heading">Monthly Performance Overview</h2>
          <AppleCard className="p-4 md:p-6">
            {years.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-2 mb-3 md:mb-4">
                {years.map((y) => (
                  <span key={y} className="text-sm font-semibold text-foreground/80">{y}</span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-13 gap-1 md:gap-1.5 font-mono-data text-[0.62rem] md:text-xs">
              {/* Empty cell for year label alignment */}
              <div className="col-span-1"></div>
              {months.map((m) => (
                <div key={m} className="text-center font-semibold text-muted-foreground text-xs md:text-sm">
                  {m}
                </div>
              ))}
              {years.map((y) => (
                <React.Fragment key={y}>
                  <div className="col-span-1 text-center font-bold text-muted-foreground text-sm flex items-center justify-center">
                    {y}
                  </div>
                  {Array.from({ length: 12 }, (_, m) => {
                    const key = y + "-" + String(m + 1).padStart(2, "0");
                    const pnl = byYM[key];

                    const bgColorClass = getMonthlyReturnBgColorClass(pnl);
                    const textColorClass = getMonthlyReturnTextColorClass(pnl);

                    const absPnl = Math.abs(pnl || 0);

                    const hoverGlow = pnl !== undefined
                      ? (pnl > 0 ? "var(--shadow-glow-emerald)" : pnl < 0 ? "var(--shadow-glow-rose)" : "var(--shadow-soft)")
                      : "var(--shadow-soft)";

                    return (
                      <motion.div
                        key={key}
                        className={cn(
                          "text-center py-2 rounded-lg font-semibold cursor-default select-none transition-all duration-200 ease-out",
                          bgColorClass,
                          textColorClass
                        )}
                        title={pnl !== undefined ? `${months[m]} ${y}: $${pnl.toFixed(0)}` : `${months[m]} ${y}: No Data`}
                        whileHover={{ scale: 1.05, boxShadow: hoverGlow }}
                        transition={HOVER_SPRING}
                      >
                        {pnl !== undefined
                          ? (absPnl > 999 ? (pnl / 1000).toFixed(1) + "k" : (pnl > 0 ? "+" : "") + pnl.toFixed(0))
                          : "—"}
                      </motion.div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </AppleCard>
        </motion.div>
      )}

      {/* Trade Log */}
      {trades.length > 0 && (
        <motion.div {...fadeInVariants} transition={{ delay: 0.4, ...fadeInVariants.animate.transition }}>
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-6 letter-spacing-heading">Detailed Trade Log</h2>
          <AppleCard className="p-0.5 overflow-hidden"> {/* AppleCard wrapper for the table, p-0.5 for subtle inner border */}
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto horizontal-scroll-on-mobile">
              <table className="w-full text-sm lg:text-base border-collapse">
                <thead className={cn("sticky top-0 z-[--z-index-sticky-header] bg-card/90 backdrop-blur-lg border-b border-border")}> {/* Using Z_INDEX_STICKY_HEADER */}
                  <tr>
                    <th className="text-left px-3 py-3 text-muted-foreground font-semibold text-xs lg:text-sm uppercase tracking-wider min-w-[100px]">Entry</th>
                    <th className="text-left px-3 py-3 text-muted-foreground font-semibold text-xs lg:text-sm uppercase tracking-wider min-w-[100px]">Exit</th>
                    <th className="text-left px-3 py-3 text-muted-foreground font-semibold text-xs lg:text-sm uppercase tracking-wider min-w-[70px]">Dir</th>
                    <th className="text-left px-3 py-3 text-muted-foreground font-semibold text-xs lg:text-sm uppercase tracking-wider min-w-[90px]">Entry $</th>
                    <th className="text-left px-3 py-3 text-muted-foreground font-semibold text-xs lg:text-sm uppercase tracking-wider min-w-[90px]">Exit $</th>
                    <th className="text-left px-3 py-3 text-muted-foreground font-semibold text-xs lg:text-sm uppercase tracking-wider min-w-[80px]">Shares</th>
                    <th className="text-left px-3 py-3 text-muted-foreground font-semibold text-xs lg:text-sm uppercase tracking-wider min-w-[80px]">P&L</th>
                    <th className="text-left px-3 py-3 text-muted-foreground font-semibold text-xs lg:text-sm uppercase tracking-wider min-w-[80px]">Return</th>
                    <th className="text-left px-3 py-3 text-muted-foreground font-semibold text-xs lg:text-sm uppercase tracking-wider min-w-[150px]">Signal</th>
                  </tr>
                </thead>
                <AnimatePresence>
                  <tbody className="divide-y divide-border/50">
                    {displayedTrades.map((t, i) => (
                      <TradeRow key={i} t={t} i={i} />
                    ))}
                  </tbody>
                </AnimatePresence>
              </table>
            </div>
            {trades.length > 100 && (
              <div className="sticky bottom-0 bg-card/90 backdrop-blur-lg p-3 text-center text-muted-foreground text-sm border-t border-border"> {/* Removed hardcoded bottom radius, relies on AppleCard */}
                Showing {displayedTrades.length} of {trades.length} trades. Scroll for more or explore full history.
              </div>
            )}
            {trades.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-base">
                No trades recorded for this backtest strategy.
              </div>
            )}
          </AppleCard>
        </motion.div>
      )}
    </motion.div>
  );
});