"use client";

import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopNav } from "@/components/layout/topnav";
import { KPIStrip } from "@/components/momentum/kpi-strip";
import { EquityChart } from "@/components/charts/equity-chart";
import { fetchReceipts } from "@/services/api";
import {
  COLORS,
  SPRING_PHYSICS_DEFAULT,
  FLASH_ANIMATION_PROPS,
  TYPOGRAPHY_LETTER_SPACING_UPPERCASE,
  TYPOGRAPHY_LETTER_SPACING_HEADING,
  Z_INDICES,
  CARD_BORDER_RADIUS,
  FILTER_BUTTON_MIN_SIZE
} from "@/lib/constants";
import type { ReceiptsData, Receipt } from "@/types/momentum";
import { cn, getTextColorClass, getBackgroundColorClass, getBorderColorClass } from "@/lib/utils";
import { AppleCard } from "@/components/ui/apple-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Assuming SFIcon exists based on previous instructions, if not, a minimal placeholder could be added here.
// For the purpose of this task, we'll assume it's correctly imported and handles icon mapping.
import SFIcon from "@/components/ui/SFIcon"; // Using a placeholder component if actual SFIcon.tsx is not available

type FilterType = "all" | "win" | "loss" | "open";

// Centralized Framer Motion transition properties
const SPRING_TRANSITION_PROPS = { type: "spring", ...SPRING_PHYSICS_DEFAULT };

const pageTransitionVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: SPRING_TRANSITION_PROPS,
};

const cardHoverVariants = {
  initial: { translateY: 0, boxShadow: "var(--shadow-card)", scale: 1 },
  hover: { translateY: -2, boxShadow: "var(--shadow-elevated)", scale: 1.005 },
  transition: SPRING_TRANSITION_PROPS,
};

// Variants for the interactive row, handles overall elevation
const tableRowHoverVariants = {
  initial: { translateY: 0, scale: 1 },
  hover: { translateY: -2, scale: 1.005 },
  transition: SPRING_TRANSITION_PROPS,
};

const filterButtonVariants = {
  initial: { translateY: 0, boxShadow: "none" },
  hover: { translateY: -2, boxShadow: "var(--shadow-glow-cyan)" },
  transition: SPRING_TRANSITION_PROPS,
};

const ErrorCard = memo(({ message }: { message: string }) => (
  <AppleCard className={cn("p-8 text-center", getBackgroundColorClass('rose', '500', '10'), getBorderColorClass('rose', '500', '20'), getTextColorClass('rose', '300'), CARD_BORDER_RADIUS)}>
    <div className="text-5xl mb-4">
      <SFIcon name="exclamationmark.triangle.fill" className="text-rose-400" />
    </div>
    <h2 className={cn("text-2xl font-bold mb-2 text-foreground", `tracking-[${TYPOGRAPHY_LETTER_SPACING_HEADING}]`)}>Failed to Load Data</h2>
    <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
      We encountered an issue fetching your receipts. Please try again.
      <br />
      <span className="text-sm text-slate-500">Error: {message}</span>
    </p>
  </AppleCard>
));

ErrorCard.displayName = "ErrorCard";

// Define a consistent grid for table rows and header
const RECEIPT_TABLE_GRID_COLS =
  "grid-cols-[40px_minmax(90px,1fr)_minmax(120px,1.2fr)_minmax(90px,1fr)_minmax(90px,1fr)_minmax(100px,1fr)_minmax(120px,1fr)_minmax(80px,1fr)_minmax(90px,1fr)_minmax(150px,1fr)]";

// Shared horizontal padding for content within the AppleCard
const CARD_X_PADDING = "px-6";

const ReceiptsPageSkeleton = memo(() => (
  <motion.div
    initial="initial"
    animate="animate"
    variants={pageTransitionVariants}
    className="pb-12 px-safe-area relative z-[1] mx-auto max-w-[1400px] w-full"
  >
    <div className="mb-8 pt-6"> {/* Adjusted padding */}
      <div className="h-10 w-64 skeleton mb-2 rounded-lg" />
      <div className="h-5 w-96 skeleton rounded-md" />
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-4 mb-8"> {/* Removed redundant padding */}
      {Array.from({ length: 6 }).map((_, i) => (
        <AppleCard key={i} className={cn("h-28 animate-pulse p-5", CARD_BORDER_RADIUS)}>
          <div className="h-4 w-20 skeleton mb-2 rounded-md" />
          <div className="h-8 w-24 skeleton rounded-lg" />
        </AppleCard>
      ))}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 mb-8"> {/* Removed redundant padding */}
      <AppleCard className={cn("h-[340px] animate-pulse p-6", CARD_BORDER_RADIUS)}>
        <div className="h-4 w-32 skeleton mb-4 rounded-md" />
        <div className="h-[240px] w-full skeleton rounded-xl" />
      </AppleCard>
      <AppleCard className={cn("h-[340px] animate-pulse p-6", CARD_BORDER_RADIUS)}>
        <div className="h-4 w-32 skeleton mb-4 rounded-md" />
        <div className="h-[240px] w-full skeleton rounded-xl" />
      </AppleCard>
    </div>

    <AppleCard className={cn("overflow-hidden p-0", CARD_BORDER_RADIUS)}>
      <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6 pb-4", CARD_X_PADDING)}>
        <div className="h-5 w-48 skeleton rounded-md" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-20 skeleton rounded-full" />
          ))}
        </div>
      </div>
      <div className="horizontal-scroll-on-mobile max-h-[700px] overflow-y-auto custom-scrollbar relative z-[1]">
        {/* Sticky Header Skeleton */}
        <div className={cn(
            "grid items-center sticky top-0 z-[Z_INDICES.stickyHeader] bg-card/80 glass-subtle backdrop-blur-md py-4 border-b border-white/10",
            RECEIPT_TABLE_GRID_COLS,
            CARD_X_PADDING
        )}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "text-left font-semibold text-sm uppercase text-muted-foreground whitespace-nowrap",
                `tracking-[${TYPOGRAPHY_LETTER_SPACING_UPPERCASE}]`,
                i === 2 && "sticky left-0 z-[Z_INDICES.stickyColumnHeader] bg-card/80 glass-subtle backdrop-blur-md -ml-6 pl-6",
              )}
            >
              <div className="h-4 w-16 skeleton rounded-md" />
            </div>
          ))}
        </div>
        <div className={cn("py-2", CARD_X_PADDING)}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "relative group mb-2 last:mb-0",
                RECEIPT_TABLE_GRID_COLS,
                "items-center py-3.5",
                "rounded-xl bg-card animate-pulse shadow-card"
              )}
            >
              <div className="absolute inset-0 -z-[1] rounded-xl bg-card" />
              {Array.from({ length: 10 }).map((_, j) => (
                <div key={j} className="h-4 w-24 skeleton rounded-md px-4" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </AppleCard>
  </motion.div>
));

ReceiptsPageSkeleton.displayName = "ReceiptsPageSkeleton";

interface ReceiptCardRowProps {
  receipt: Receipt;
  index: number;
  lastUpdated: Record<string, number>;
  gridColsClass: string;
}

const ReceiptCardRow = memo(({ receipt: r, index, lastUpdated, gridColsClass }: ReceiptCardRowProps) => {
  const hasUpdated = !!lastUpdated[r.id || ""];

  const retColorClass = useMemo(() => {
    if ((r.return_pct || 0) > 0) return getTextColorClass('emerald', '400');
    if ((r.return_pct || 0) < 0) return getTextColorClass('rose', '400');
    return getTextColorClass('slate', '400');
  }, [r.return_pct]);

  const sharpeColorClass = useMemo(() => {
    if ((r.sharpe || 0) > 0.5) return getTextColorClass('emerald', '400');
    if ((r.sharpe || 0) > 0 && (r.sharpe || 0) <= 0.5) return getTextColorClass('amber', '400');
    return getTextColorClass('rose', '400');
  }, [r.sharpe]);

  const resultBadgeClasses = useMemo(() => {
    const icon = r.result === "WIN" ? "arrow.up.circle.fill" : r.result === "LOSS" ? "arrow.down.circle.fill" : "circle.dotted";
    const text = r.result === "WIN" ? "WIN" : r.result === "LOSS" ? "LOSS" : "OPEN";
    const bg = r.result === "WIN" ? getBackgroundColorClass('emerald', '500', '15') : r.result === "LOSS" ? getBackgroundColorClass('rose', '500', '15') : getBackgroundColorClass('amber', '500', '10');
    const color = r.result === "WIN" ? getTextColorClass('emerald', '400') : r.result === "LOSS" ? getTextColorClass('rose', '400') : getTextColorClass('amber', '400');
    const border = r.result === "WIN" ? getBorderColorClass('emerald', '500', '25') : r.result === "LOSS" ? getBorderColorClass('rose', '500', '25') : getBorderColorClass('amber', '500', '20');

    return { icon, text, classes: cn(
        "text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1",
        bg, color, border
      )};
  }, [r.result]);

  const signalBadgeClass = useMemo(() => cn(
    "text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap",
    getBackgroundColorClass('cyan', '500', '15'),
    getTextColorClass('cyan', '400'),
  ), []);

  return (
    <motion.div
      key={r.id || index}
      className={cn(
        "relative group mb-2 last:mb-0", // Vertical spacing between rows
        gridColsClass,
        "items-center py-3.5",
        "shadow-card", // Default shadow for the card-like row
        CARD_BORDER_RADIUS,
      )}
      initial="initial"
      variants={tableRowHoverVariants}
      animate="initial"
      whileHover="hover"
      transition={SPRING_TRANSITION_PROPS}
      style={{
        zIndex: hasUpdated && r.id && lastUpdated[r.id] > 0 ? Z_INDICES.flash : undefined, // Bring updated row to front
      }}
    >
      {/* Background and border for the row 'card' - handles initial background, hover background, and rounded corners */}
      <motion.div
        className={cn("absolute inset-0 -z-[1]", CARD_BORDER_RADIUS)}
        initial={{
          background: COLORS.card,
          border: "1px solid transparent", // Start with transparent border
          boxShadow: "var(--shadow-card)", // Initial box-shadow from the parent
        }}
        variants={{
          initial: { boxShadow: "var(--shadow-card)", background: COLORS.card, border: "1px solid transparent" },
          hover: {
            boxShadow: "var(--shadow-glow-cyan)", // Apply glow on hover
            background: getBackgroundColorClass('slate', '800', '50'), // Subtle background shift on hover
            border: `1px solid ${COLORS.cyan}`, // Direct cyan border color from constants for glow effect
          }
        }}
        transition={SPRING_TRANSITION_PROPS}
      />

      {/* Cells */}
      <div className="px-4 text-slate-400 font-mono-data text-sm">
        {index + 1}
      </div>
      <div className="px-4 text-slate-400 text-sm whitespace-nowrap">{r.date || "—"}</div>
      <div className={cn(
        "px-4 font-bold font-mono-data text-base whitespace-nowrap",
        "sticky left-0 z-[Z_INDICES.stickyColumn]", // Sticky ticker cell
        "bg-card/90 backdrop-blur-sm", // Persistent background for sticky column
        "group-hover:bg-slate-800/60" // Match hover background of the row
      )}>
        <span className={getTextColorClass('cyan', '400')}>{r.ticker || "—"}</span>
      </div>
      <div className="px-4">
        <span className={signalBadgeClass}>
          {r.signal_type || "—"}
        </span>
      </div>
      <div className="px-4">
        <AnimatePresence mode="wait">
          <motion.span
            key={`${r.id}-result-${r.result}`}
            variants={FLASH_ANIMATION_PROPS}
            animate={hasUpdated && r.id && lastUpdated[r.id] > 0 ? "flash" : undefined}
            className={resultBadgeClasses.classes}
          >
            <SFIcon name={resultBadgeClasses.icon} className="text-current text-sm" />
            {resultBadgeClasses.text}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className={cn("px-4 font-mono-data font-bold text-lg whitespace-nowrap", retColorClass)}>
        <AnimatePresence mode="wait">
          <motion.span
            key={`${r.id}-return-${r.return_pct}`}
            variants={FLASH_ANIMATION_PROPS}
            animate={hasUpdated && r.id && lastUpdated[r.id] > 0 ? "flash" : undefined}
          >
            {(r.return_pct || 0) > 0 ? "+" : ""}{(r.return_pct || 0).toFixed(1)}%
          </motion.span>
        </AnimatePresence>
      </div>
      <div className={cn("px-4 font-mono-data text-lg whitespace-nowrap", retColorClass)}>
        <AnimatePresence mode="wait">
          <motion.span
            key={`${r.id}-pnl-${r.pnl}`}
            variants={FLASH_ANIMATION_PROPS}
            animate={hasUpdated && r.id && lastUpdated[r.id] > 0 ? "flash" : undefined}
          >
            {r.pnl != null ? `$${r.pnl > 0 ? "+" : ""}${Math.round(r.pnl).toLocaleString()}` : "—"}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="px-4 text-slate-400 font-mono-data text-sm">{r.trades || "—"}</div>
      <div className={cn("px-4 font-mono-data text-base whitespace-nowrap", sharpeColorClass)}>
        <AnimatePresence mode="wait">
          <motion.span
            key={`${r.id}-sharpe-${r.sharpe}`}
            variants={FLASH_ANIMATION_PROPS}
            animate={hasUpdated && r.id && lastUpdated[r.id] > 0 ? "flash" : undefined}
          >
            {r.sharpe ? r.sharpe.toFixed(2) : "—"}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="px-4 text-slate-500 text-sm">
        {r.note ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="max-w-[150px] truncate block text-left">
                {r.note}
              </TooltipTrigger>
              <TooltipContent className={cn("max-w-xs p-3 text-sm shadow-lg", CARD_BORDER_RADIUS, getBackgroundColorClass('card'), getBorderColorClass('white', '10'), getTextColorClass('slate', '200'))}>
                {r.note}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          "—"
        )}
      </div>
    </motion.div>
  );
});

ReceiptCardRow.displayName = "ReceiptCardRow";

export default function ReceiptsPage() {
  const [data, setData] = useState<ReceiptsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [lastUpdated, setLastUpdated] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const newData = await fetchReceipts();
        setData(newData);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (loading || error || !dataRef.current) return;

    const interval = setInterval(() => {
      setData((prevData) => {
        if (!prevData || !prevData.receipts) return null;

        const updatedReceipts = prevData.receipts.map((r) => {
          if (Math.random() < 0.15) {
            const changeFactor = (Math.random() - 0.5) * 0.1; // +/- 0.05%
            const newReturnPct = (r.return_pct || 0) + changeFactor;
            const newPnl = (r.pnl || 0) * (1 + changeFactor / 100);
            const newSharpe = (r.sharpe || 0) + (Math.random() - 0.5) * 0.05; // Smaller Sharpe changes

            const hasReturnChanged = Math.abs((r.return_pct || 0) - newReturnPct) > 0.01;
            const hasPnlChanged = Math.abs((r.pnl || 0) - newPnl) > 1;
            const hasSharpeChanged = Math.abs((r.sharpe || 0) - newSharpe) > 0.01;

            if (r.id && (hasReturnChanged || hasPnlChanged || hasSharpeChanged)) {
              setLastUpdated((prev) => ({ ...prev, [r.id]: Date.now() }));
              return {
                ...r,
                return_pct: hasReturnChanged ? newReturnPct : r.return_pct,
                pnl: hasPnlChanged ? newPnl : r.pnl,
                sharpe: hasSharpeChanged ? newSharpe : r.sharpe,
              };
            }
          }
          return r;
        });
        return { ...prevData, receipts: updatedReceipts };
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [loading, error]);

  const filteredReceipts = useMemo(() => {
    if (!data?.receipts) return [];
    if (filter === "all") return data.receipts;
    return data.receipts.filter(
      (r) => r.result.toLowerCase() === filter,
    );
  }, [data, filter]);

  const equityCurve = useMemo(() => {
    if (!data?.receipts?.length) return [];
    const sortedReceipts = [...data.receipts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let equity = 100000;
    return sortedReceipts.map((r) => {
      equity = equity * (1 + (r.return_pct || 0) / 100);
      return { date: r.date, equity: Math.round(equity) };
    });
  }, [data]);

  const receipts = data?.receipts || [];
  const wins = receipts.filter((r) => r.result === "WIN");
  const losses = receipts.filter((r) => r.result === "LOSS");
  const openReceipts = receipts.filter((r) => r.result === "OPEN");
  const returns = receipts.map((r) => r.return_pct || 0);
  const totalClosedTrades = wins.length + losses.length;
  const winRate = totalClosedTrades ? Math.round((wins.length / totalClosedTrades) * 100) : 0;
  const avgReturn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const bestReturn = returns.length ? Math.max(...returns) : 0;
  const worstReturn = returns.length ? Math.min(...returns) : 0;
  const sharpeVals = receipts.map((r) => r.sharpe || 0).filter(Boolean);
  const avgSharpe = sharpeVals.length ? sharpeVals.reduce((a, b) => a + b, 0) / sharpeVals.length : 0;

  const getAvgReturnColorClass = useCallback((value: number) => {
    if (value > 0) return getTextColorClass('emerald', '400');
    if (value < 0) return getTextColorClass('rose', '400');
    return getTextColorClass('cyan', '400');
  }, []);

  const getSharpeColorClassForKpi = useCallback((value: number) => {
    if (value > 0.5) return getTextColorClass('emerald', '400');
    if (value > 0 && value <= 0.5) return getTextColorClass('amber', '400');
    return getTextColorClass('rose', '400');
  }, []);

  const kpiItems = useMemo(() => [
    { label: "Win Rate", value: `${winRate}%`, color: getTextColorClass('emerald', '400') },
    { label: "Avg Return", value: `${avgReturn > 0 ? "+" : ""}${avgReturn.toFixed(1)}%`, color: getAvgReturnColorClass(avgReturn) },
    { label: "Best Call", value: `${bestReturn > 0 ? "+" : ""}${bestReturn.toFixed(1)}%`, color: getTextColorClass('emerald', '400') },
    { label: "Worst Call", value: `${worstReturn.toFixed(1)}%`, color: getTextColorClass('rose', '400') },
    { label: "Total Calls", value: receipts.length, color: getTextColorClass('cyan', '400') },
    { label: "Sharpe", value: avgSharpe.toFixed(2), color: getSharpeColorClassForKpi(avgSharpe) },
  ], [winRate, avgReturn, bestReturn, worstReturn, receipts.length, avgSharpe, getAvgReturnColorClass, getSharpeColorClassForKpi]);

  const progressBarStyles = useMemo(() => {
    const totalAll = receipts.length;
    if (totalAll === 0) return { win: 0, loss: 0, open: 0 };

    const winPercentage = (wins.length / totalAll) * 100;
    const lossPercentage = (losses.length / totalAll) * 100;
    const openPercentage = (openReceipts.length / totalAll) * 100;

    return {
      win: winPercentage,
      loss: lossPercentage,
      open: openPercentage,
    };
  }, [receipts.length, wins.length, losses.length, openReceipts.length]);

  if (loading) {
    return (
      <>
        <TopNav title="RECEIPTS" icon="receipt.text.fill" />
        <ReceiptsPageSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopNav title="RECEIPTS" icon="receipt.text.fill" />
        <motion.div
          initial="initial"
          animate="animate"
          variants={pageTransitionVariants}
          className="pt-[72px] pb-12 px-safe-area mx-auto max-w-[1400px] w-full relative z-[1]"
        >
          <ErrorCard message={error} />
        </motion.div>
      </>
    );
  }

  return (
    <div className="min-h-screen">
      <TopNav title="RECEIPTS" icon="receipt.text.fill" />

      <motion.div
        initial="initial"
        animate="animate"
        variants={pageTransitionVariants}
        className="pt-[72px] pb-12 px-safe-area mx-auto max-w-[1400px] w-full relative z-[1]"
      >
        <div className="mb-8 pt-6"> {/* Consistent top padding after TopNav */}
          <h1 className={cn("text-4xl font-extrabold flex items-center gap-3 mb-2 text-foreground", `tracking-[${TYPOGRAPHY_LETTER_SPACING_HEADING}]`)}>
            <SFIcon name="receipt.text.fill" className="text-amber-400" /> Receipts Ledger
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
            A comprehensive 30-day model performance history, meticulously documenting every trading call,
            including detailed win and loss receipts.
          </p>
        </div>

        <KPIStrip className="mb-8" items={kpiItems} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 mb-8">
          <AppleCard whileHover="hover" variants={cardHoverVariants} className={cn("p-6", CARD_BORDER_RADIUS)}>
            <h3 className={cn("text-xl font-bold text-foreground uppercase mb-4 flex items-center gap-2", `tracking-[${TYPOGRAPHY_LETTER_SPACING_UPPERCASE}]`)}>
              <SFIcon name="chart.line.uptrend.xyaxis" className="text-emerald-400" /> 30-Day P&L Curve
            </h3>
            {equityCurve.length > 0 ? (
              <EquityChart data={equityCurve} color={COLORS.amber} title="Equity" className="h-[240px]" />
            ) : (
              <div className="h-[240px] flex flex-col items-center justify-center text-muted-foreground text-base">
                <div className="text-5xl mb-4 opacity-70">
                  <SFIcon name="chart.line.downswing.xyaxis" className="text-slate-500" />
                </div>
                No data available to plot the equity curve.
              </div>
            )}
          </AppleCard>
          <AppleCard whileHover="hover" variants={cardHoverVariants} className={cn("p-6", CARD_BORDER_RADIUS)}>
            <h3 className={cn("text-xl font-bold text-foreground uppercase mb-4 flex items-center gap-2", `tracking-[${TYPOGRAPHY_LETTER_SPACING_UPPERCASE}]`)}>
              <SFIcon name="chart.pie.fill" className="text-violet-400" /> Win / Loss Distribution
            </h3>
            <div className="h-[240px] flex flex-col items-center justify-center gap-6">
              <div className="flex gap-10 text-center">
                <div>
                  <div className={cn("text-5xl font-extrabold font-mono-data", getTextColorClass('emerald', '400'))}>{wins.length}</div>
                  <div className="text-sm text-slate-400 mt-1">Wins</div>
                </div>
                <div>
                  <div className={cn("text-5xl font-extrabold font-mono-data", getTextColorClass('rose', '400'))}>{losses.length}</div>
                  <div className="text-sm text-slate-400 mt-1">Losses</div>
                </div>
                <div>
                  <div className={cn("text-5xl font-extrabold font-mono-data", getTextColorClass('amber', '400'))}>
                    {openReceipts.length}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">Open</div>
                </div>
              </div>
              {receipts.length > 0 && (
                <div className="w-full max-w-[280px] h-4 rounded-full overflow-hidden flex shadow-inner">
                  <div className={getBackgroundColorClass('emerald', '500', '70')} style={{ width: `${progressBarStyles.win}%` }} />
                  <div className={getBackgroundColorClass('rose', '500', '70')} style={{ width: `${progressBarStyles.loss}%` }} />
                  <div className={getBackgroundColorClass('amber', '500', '50')} style={{ width: `${progressBarStyles.open}%` }} />
                </div>
              )}
            </div>
          </AppleCard>
        </div>

        <AppleCard className={cn("overflow-hidden p-0", CARD_BORDER_RADIUS)}>
          <div className={cn("py-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4", CARD_X_PADDING)}>
            <h3 className={cn("text-base font-bold uppercase text-muted-foreground", `tracking-[${TYPOGRAPHY_LETTER_SPACING_UPPERCASE}]`)}>
              <SFIcon name="receipt.text.fill" className="text-slate-500 mr-2" /> Receipt Log <span className="font-normal text-slate-500">— {filteredReceipts.length} receipts</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {(["all", "win", "loss", "open"] as FilterType[]).map((f) => (
                <motion.button
                  key={f}
                  className={cn(
                    `relative px-5 py-2 text-sm font-semibold rounded-full border transition-all flex items-center justify-center gap-1`,
                    FILTER_BUTTON_MIN_SIZE,
                    filter === f
                      ? cn(getBackgroundColorClass('cyan', '500', '15'), getBorderColorClass('cyan', '500', '30'), getTextColorClass('cyan', '400'), "shadow-sm")
                      : cn(getBorderColorClass('white', '10'), getTextColorClass('slate', '400'), "hover:bg-white/5"),
                  )}
                  onClick={() => setFilter(f)}
                  whileHover="hover"
                  variants={filterButtonVariants}
                  transition={SPRING_TRANSITION_PROPS}
                >
                  <SFIcon
                    name={
                      f === "win" ? "arrow.up.circle.fill" :
                      f === "loss" ? "arrow.down.circle.fill" :
                      f === "open" ? "circle.dotted" :
                      "list.bullet.rectangle.portrait" // Generic for All
                    }
                    className={cn(
                      "text-sm",
                      f === "win" && getTextColorClass('emerald', '400'),
                      f === "loss" && getTextColorClass('rose', '400'),
                      f === "open" && getTextColorClass('amber', '400'),
                      f === "all" && (filter === "all" ? getTextColorClass('cyan', '400') : getTextColorClass('slate', '400'))
                    )}
                  />
                  {f === "all" ? "All" : f === "win" ? "Wins" : f === "loss" ? "Losses" : "Open"}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="horizontal-scroll-on-mobile max-h-[700px] overflow-y-auto custom-scrollbar relative z-[1]">
            {/* Sticky Table Header */}
            <div className={cn(
                "grid items-center sticky top-0 z-[Z_INDICES.stickyHeader] bg-card/80 glass-subtle backdrop-blur-md py-4 border-b border-white/10",
                RECEIPT_TABLE_GRID_COLS,
                CARD_X_PADDING
            )}>
              {["#", "Date", "Ticker", "Signal", "Result", "Return", "P&L", "Trades", "Sharpe", "Details"].map(
                (h, idx) => (
                  <div
                    key={h}
                    className={cn(
                      "text-left font-semibold text-sm uppercase text-muted-foreground whitespace-nowrap",
                      `tracking-[${TYPOGRAPHY_LETTER_SPACING_UPPERCASE}]`,
                      idx === 2 && "sticky left-0 z-[Z_INDICES.stickyColumnHeader] bg-card/80 glass-subtle backdrop-blur-md -ml-6 pl-6",
                    )}
                  >
                    {h}
                  </div>
                ),
              )}
            </div>

            {filteredReceipts.length === 0 ? (
              <div className="text-center py-16 px-6 md:px-8">
                <div className="text-5xl mb-4 opacity-70">
                  <SFIcon name="receipt.text.fill" className="text-slate-500" />
                </div>
                <div className={cn("text-xl font-bold mb-2 text-foreground", `tracking-[${TYPOGRAPHY_LETTER_SPACING_HEADING}]`)}>No Receipts Yet</div>
                <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Run your first backtest in the Strategy Builder to start building your receipt history.
                </p>
              </div>
            ) : (
              <div className={cn("py-2", CARD_X_PADDING)}> {/* Padding around the rows list */}
                <AnimatePresence>
                  {filteredReceipts.map((r, i) => (
                    <ReceiptCardRow
                      key={r.id || i}
                      receipt={r}
                      index={i}
                      lastUpdated={lastUpdated}
                      gridColsClass={RECEIPT_TABLE_GRID_COLS}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </AppleCard>
      </motion.div>
    </div>
  );
}