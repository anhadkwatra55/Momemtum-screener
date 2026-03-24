"use client";

import { cn, getBackgroundColorClass, getTextColorClass, getBorderColorClass } from "@/lib/utils";
import { ConvictionBadge, ActionBadge } from "./conviction-badge";
import { RegimeBadge } from "./regime-badge";
import { COLORS, springTransition } from "@/lib/constants";
import type { Signal } from "@/types/momentum";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { usePrevious } from "@/hooks/use-previous";

// --- Constants ---
const COLUMNS: { key: string; label: string; shortLabel?: string; className?: string }[] = [
  { key: "ticker", label: "Ticker", className: "sticky left-0 z-30 bg-card/80 backdrop-blur-sm" },
  { key: "conviction_tier", label: "Conviction" },
  { key: "action_category", label: "Action" },
  { key: "composite", label: "Composite" },
  { key: "probability", label: "Prob%", shortLabel: "Prob" },
  { key: "sys1_score", label: "S1" },
  { key: "sys2_score", label: "S2" },
  { key: "sys3_score", label: "S3" },
  { key: "sys4_score", label: "S4" },
  { key: "regime", label: "Regime" },
  { key: "price", label: "Price" },
  { key: "daily_change", label: "Δ Day" },
  { key: "return_20d", label: "20d" },
  { key: "sector", label: "Sector" },
];

// Framer Motion shared props
const whileHoverRow = {
  y: -2,
  boxShadow: 'var(--shadow-soft)',
  transition: springTransition
};
const whileHoverTh = {
  y: -2,
  boxShadow: 'var(--shadow-soft)',
  transition: springTransition
};

// Flash animation properties for real-time updates (neutral background for general changes)
const flashVariants = {
  flash: {
    backgroundColor: [
      "rgba(30, 41, 59, 0)",
      "rgba(30, 41, 59, 0.15)",
      "rgba(30, 41, 59, 0)"
    ],
    transition: {
      duration: 0.8,
      ease: "easeInOut",
      times: [0, 0.5, 1],
    }
  },
  initial: {
    backgroundColor: "rgba(30, 41, 59, 0)",
  }
};

// Item variants for individual rows (used by CollapsibleTierContent for staggering)
const rowItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { ...springTransition, duration: 0.3 } },
  exit: { opacity: 0, y: -20, transition: { ...springTransition, duration: 0.2 } },
};

// Container variants for the tbody (used by CollapsibleTierContent for staggering children)
const rowContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.1,
      staggerChildren: 0.04,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    }
  }
};

type PaletteColorKey = Parameters<typeof getTextColorClass>[0];

// --- Helper Functions ---
const getScoreColorClass = (v: number) => {
  if (v > 0) return getTextColorClass("emerald", "400");
  if (v < 0) return getTextColorClass("rose", "400");
  return getTextColorClass("slate", "400");
};

const getChangeColorKey = (v: number): PaletteColorKey => {
  if (v > 0) return "emerald";
  if (v < 0) return "rose";
  return "slate";
};

const getProbColorKey = (probability: number): PaletteColorKey => {
  if (probability >= 70) return "emerald";
  if (probability >= 40) return "amber";
  return "rose";
};

// --- RealtimeFlashValue Component ---
interface RealtimeFlashValueProps {
  value: string | number;
  prevValue: string | number | undefined;
  className?: string;
  colorClass?: string;
}

const RealtimeFlashValue = React.memo(function RealtimeFlashValue({ value, prevValue, className, colorClass }: RealtimeFlashValueProps) {
  const controls = useAnimation();

  useEffect(() => {
    if (prevValue !== undefined && String(value) !== String(prevValue)) {
      controls.start("flash");
    }
  }, [value, prevValue, controls]);

  return (
    <motion.span
      className={cn("relative z-0 inline-block", className, colorClass)}
      initial="initial"
      animate={controls}
      variants={flashVariants}
    >
      {value}
    </motion.span>
  );
});

// --- SignalTableRow Component (Memoized) ---
interface SignalTableRowProps {
  signal: Signal;
  onSelectTicker: (ticker: string) => void;
  isSelected: boolean;
  columnClasses: string[];
}

const SignalTableRow = React.memo(function SignalTableRow({
  signal,
  onSelectTicker,
  isSelected,
  columnClasses,
}: SignalTableRowProps) {
  const {
    ticker,
    sentiment,
    composite,
    probability,
    sys1_score,
    sys2_score,
    sys3_score,
    sys4_score,
    regime,
    price,
    daily_change,
    return_20d,
    sector,
  } = signal;

  const prevSignal = usePrevious(signal);

  const handleRowClick = useCallback(() => {
    onSelectTicker(ticker);
  }, [onSelectTicker, ticker]);

  const probColorKey = useMemo(() => getProbColorKey(probability), [probability]);
  const probBarScaleX = useMemo(() => probability / 100, [probability]);
  const dailyChangeColorKey = useMemo(() => getChangeColorKey(daily_change), [daily_change]);
  const return20dColorKey = useMemo(() => getChangeColorKey(return_20d), [return_20d]);

  const renderFlashValue = useCallback((currentValue: string | number, key: keyof Signal, colorClass?: string, defaultClass?: string) => {
    return (
      <RealtimeFlashValue
        value={currentValue}
        prevValue={prevSignal ? prevSignal[key] as string | number : undefined}
        colorClass={colorClass}
        className={defaultClass}
      />
    );
  }, [prevSignal]);

  const cells = [
    <td key="ticker" className={cn("py-3 px-4 font-inter text-base font-semibold", columnClasses[0])}>
      {renderFlashValue(ticker, 'ticker')}
    </td>,
    <td key="conviction_tier" className={cn("py-3 px-4", columnClasses[1])}><ConvictionBadge tier={signal.conviction_tier ?? 'Contrarian'} /></td>,
    <td key="action_category" className={cn("py-3 px-4", columnClasses[2])}><ActionBadge action={signal.action_category ?? 'Hold & Monitor'} /></td>,
    <td key="composite" className={cn("py-3 px-4 font-mono-data text-base font-bold", getScoreColorClass(composite), columnClasses[3])}>
      {renderFlashValue(composite.toFixed(2), 'composite', getScoreColorClass(composite))}
    </td>,
    <td key="probability" className={cn("py-3 px-4", columnClasses[4])}>
      <div className="min-w-[60px]">
        {renderFlashValue(probability + '%', 'probability', getTextColorClass(probColorKey))}
        <div className="w-full h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: probBarScaleX }}
            transition={springTransition}
            className={cn("h-full rounded-full origin-left", getBackgroundColorClass(probColorKey))}
          />
        </div>
      </div>
    </td>,
    <td key="sys1_score" className={cn("py-3 px-4 font-mono-data text-sm", getScoreColorClass(sys1_score), columnClasses[5])}>
      {renderFlashValue(sys1_score.toFixed(1), 'sys1_score', getScoreColorClass(sys1_score))}
    </td>,
    <td key="sys2_score" className={cn("py-3 px-4 font-mono-data text-sm", getScoreColorClass(sys2_score), columnClasses[6])}>
      {renderFlashValue(sys2_score.toFixed(1), 'sys2_score', getScoreColorClass(sys2_score))}
    </td>,
    <td key="sys3_score" className={cn("py-3 px-4 font-mono-data text-sm", getScoreColorClass(sys3_score), columnClasses[7])}>
      {renderFlashValue(sys3_score.toFixed(1), 'sys3_score', getScoreColorClass(sys3_score))}
    </td>,
    <td key="sys4_score" className={cn("py-3 px-4 font-mono-data text-sm", getScoreColorClass(sys4_score), columnClasses[8])}>
      {renderFlashValue(sys4_score.toFixed(1), 'sys4_score', getScoreColorClass(sys4_score))}
    </td>,
    <td key="regime" className={cn("py-3 px-4", columnClasses[9])}><RegimeBadge regime={regime} /></td>,
    <td key="price" className={cn("py-3 px-4 font-mono-data text-base", columnClasses[10])}>
      {renderFlashValue('$' + price.toFixed(2), 'price')}
    </td>,
    <td key="daily_change" className={cn("py-3 px-4 font-mono-data text-base font-semibold", getTextColorClass(dailyChangeColorKey), columnClasses[11])}>
      {renderFlashValue((daily_change > 0 ? "+" : "") + daily_change.toFixed(2) + '%', 'daily_change', getTextColorClass(dailyChangeColorKey))}
    </td>,
    <td key="return_20d" className={cn("py-3 px-4 font-mono-data text-base", getTextColorClass(return20dColorKey), columnClasses[12])}>
      {renderFlashValue((return_20d > 0 ? "+" : "") + return_20d.toFixed(2) + '%', 'return_20d', getTextColorClass(return20dColorKey))}
    </td>,
    <td key="sector" className={cn("py-3 px-4 text-sm text-slate-400 tracking-tight", columnClasses[13])}>
      {renderFlashValue(sector, 'sector')}
    </td>,
  ];

  return (
    <motion.tr
      layout
      variants={rowItemVariants}
      className={cn(
        "cursor-pointer relative z-0",
        "group",
        isSelected
          ? "bg-cyan-500/10 border-l-2 border-l-cyan-400"
          : "hover:bg-cyan-500/5",
        "transition-[background-color,border-color,box-shadow] duration-200 ease-in-out"
      )}
      onClick={handleRowClick}
      whileHover={whileHoverRow}
    >
      {cells}
    </motion.tr>
  );
});

// --- CollapsibleTierContent Component (container for staggered row animations) ---
interface CollapsibleTierContentProps {
  signals: Signal[];
  onSelectTicker: (ticker: string) => void;
  selectedTicker?: string | null;
  columnClasses: string[];
}

const CollapsibleTierContent = React.memo(function CollapsibleTierContent({
  signals,
  onSelectTicker,
  selectedTicker,
  columnClasses,
}: CollapsibleTierContentProps) {
  return (
    <motion.tbody
      variants={rowContainerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout="position"
      className="divide-y divide-white/10"
    >
      {signals.map((s) => (
        <SignalTableRow
          key={s.ticker}
          signal={s}
          onSelectTicker={onSelectTicker}
          isSelected={selectedTicker === s.ticker}
          columnClasses={columnClasses}
        />
      ))}
    </motion.tbody>
  );
});

// --- CollapsibleTier Component ---
interface CollapsibleTierProps {
  label: string;
  count: number;
  tierColorKey: PaletteColorKey;
  signals: Signal[];
  onSelectTicker: (ticker: string) => void;
  selectedTicker?: string | null;
  columnClasses: string[];
}

const CollapsibleTier = React.memo(function CollapsibleTier({
  label,
  count,
  tierColorKey,
  signals,
  onSelectTicker,
  selectedTicker,
  columnClasses,
}: CollapsibleTierProps) {
  const [isOpen, setIsOpen] = useState(true);

  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <React.Fragment>
      <motion.tr
        layout="position"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={springTransition}
        className="cursor-pointer group relative z-20"
        onClick={toggleOpen}
        whileHover={whileHoverRow}
      >
        <td colSpan={COLUMNS.length}>
          <div
            className={cn(
              "py-3 px-4 text-left font-inter font-bold uppercase",
              "letter-spacing-[0.1em]",
              getBackgroundColorClass("slate", "800", "20"),
              "group-hover:bg-opacity-30 transition-all duration-200",
              "flex items-center justify-between text-slate-200",
              "my-3 rounded-2xl border-l-2",
              "shadow-[var(--shadow-card)]",
              getBorderColorClass("cyan", "500"),
            )}
          >
            <span>
              {label} — <span className={cn("font-mono-data text-lg font-bold", getTextColorClass(tierColorKey))}>{count}</span> stocks
            </span>
            <motion.svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-5 h-5 text-slate-300"
              animate={{ rotate: isOpen ? 0 : -90 }}
              transition={springTransition}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </motion.svg>
          </div>
        </td>
      </motion.tr>

      <AnimatePresence>
        {isOpen && (
          <CollapsibleTierContent
            signals={signals}
            onSelectTicker={onSelectTicker}
            selectedTicker={selectedTicker}
            columnClasses={columnClasses}
          />
        )}
      </AnimatePresence>
    </React.Fragment>
  );
});

// --- ShimmeringSkeleton Component for Loading State ---
const ShimmeringSkeleton = React.memo(() => (
  <div className="relative h-6 w-full rounded-md overflow-hidden bg-slate-800">
    <div className="absolute inset-0 z-10 animate-shimmer"></div>
  </div>
));

// --- No Signals Empty State Component ---
const NoSignalsEmptyState = React.memo(() => (
  <tr className="min-h-[200px]">
    <td colSpan={COLUMNS.length} className="py-12 text-center text-slate-500 font-inter text-lg">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="flex flex-col items-center justify-center gap-4 py-8 px-4 rounded-xl bg-card/20 border border-white/5"
      >
        <svg
          className="w-16 h-16 text-slate-600 mb-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-xl font-semibold text-slate-300">No Signals Found</p>
        <p className="text-base text-slate-400 max-w-sm">
          It looks like there are no active signals matching your current criteria.
          Try adjusting your filters or checking back later.
        </p>
      </motion.div>
    </td>
  </tr>
));


// --- Main SignalTable Component ---
interface SignalTableProps {
  signals: Signal[];
  sortBy: string;
  sortAsc: boolean;
  onSort: (col: string) => void;
  onSelectTicker: (ticker: string) => void;
  selectedTicker?: string | null;
  className?: string;
  isLoading?: boolean;
}

export const SignalTable = React.memo(function SignalTable({
  signals,
  sortBy,
  sortAsc,
  onSort,
  onSelectTicker,
  selectedTicker,
  className,
  isLoading = false,
}: SignalTableProps) {
  const handleSort = useCallback((key: string) => onSort(key), [onSort]);
  const handleSelectTicker = useCallback((ticker: string) => onSelectTicker(ticker), [onSelectTicker]);

  const { ultra, high, moderate, low, contrarian } = useMemo(() => {
    const ultra = signals.filter((s) => s.conviction_tier === 'Ultra Conviction');
    const high = signals.filter((s) => s.conviction_tier === 'High Conviction');
    const moderate = signals.filter((s) => s.conviction_tier === 'Moderate Conviction');
    const low = signals.filter((s) => s.conviction_tier === 'Low Conviction');
    const contrarian = signals.filter((s) => !s.conviction_tier || s.conviction_tier === 'Contrarian');
    return { ultra, high, moderate, low, contrarian };
  }, [signals]);

  const columnClasses = useMemo(() => COLUMNS.map(col => col.className || ''), []);

  return (
    <motion.div
      layout
      className={cn(
        "relative rounded-2xl bg-card/45 backdrop-blur-md",
        "overflow-hidden",
        className,
        "max-w-full",
        "shadow-[var(--shadow-card)]"
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springTransition}
    >
      <div className="overflow-x-auto min-h-[200px] max-h-[80vh] custom-scrollbar">
        <table className="w-full text-base border-collapse">
          <thead>
            <motion.tr
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={springTransition}
            >
              {COLUMNS.map((col) => (
                <motion.th
                  key={col.key}
                  className={cn(
                    "py-3 px-4 text-left font-inter text-sm uppercase letter-spacing-[0.1em] text-slate-400",
                    "bg-card/80 backdrop-blur-sm sticky top-0 z-40",
                    "border-b border-[var(--border)]",
                    "cursor-pointer select-none",
                    col.className
                  )}
                  onClick={() => handleSort(col.key)}
                  whileHover={whileHoverTh}
                  transition={springTransition}
                  role="button"
                  aria-sort={sortBy === col.key ? (sortAsc ? "ascending" : "descending") : "none"}
                >
                  <motion.div className="flex items-center gap-1 min-h-[20px]"
                    initial={false}
                    animate={sortBy === col.key ? { color: COLORS.cyan } : {}}
                    transition={springTransition}
                  >
                    <span className="group-hover:text-cyan-400 transition-colors duration-200">
                      {col.shortLabel || col.label}
                    </span>
                    {sortBy === col.key && (
                      <motion.span
                        className="ml-1 text-cyan-400"
                        key={col.key + "-sort-icon"}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 5 }}
                        transition={springTransition}
                      >
                        {sortAsc ? "↑" : "↓"}
                      </motion.span>
                    )}
                  </motion.div>
                </motion.th>
              ))}
            </motion.tr>
          </thead>
          {isLoading ? (
            <motion.tbody
              variants={rowContainerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout="position"
              className="divide-y divide-white/10"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.tr
                  key={`skeleton-${i}`}
                  variants={rowItemVariants}
                  className="transition-[background-color] duration-200 ease-in-out"
                >
                  {COLUMNS.map((_, j) => (
                    <td key={`skeleton-${i}-${j}`} className={cn("py-3 px-4", columnClasses[j])}>
                      <ShimmeringSkeleton />
                    </td>
                  ))}
                </motion.tr>
              ))}
            </motion.tbody>
          ) : (
            <motion.tbody
                layout="position"
            >
              {ultra.length > 0 && (
                <CollapsibleTier
                  label="Ultra Conviction"
                  count={ultra.length}
                  tierColorKey="amber"
                  signals={ultra}
                  onSelectTicker={handleSelectTicker}
                  selectedTicker={selectedTicker}
                  columnClasses={columnClasses}
                />
              )}
              {high.length > 0 && (
                <CollapsibleTier
                  label="High Conviction"
                  count={high.length}
                  tierColorKey="emerald"
                  signals={high}
                  onSelectTicker={handleSelectTicker}
                  selectedTicker={selectedTicker}
                  columnClasses={columnClasses}
                />
              )}
              {moderate.length > 0 && (
                <CollapsibleTier
                  label="Moderate Conviction"
                  count={moderate.length}
                  tierColorKey="cyan"
                  signals={moderate}
                  onSelectTicker={handleSelectTicker}
                  selectedTicker={selectedTicker}
                  columnClasses={columnClasses}
                />
              )}
              {low.length > 0 && (
                <CollapsibleTier
                  label="Low Conviction"
                  count={low.length}
                  tierColorKey="slate"
                  signals={low}
                  onSelectTicker={handleSelectTicker}
                  selectedTicker={selectedTicker}
                  columnClasses={columnClasses}
                />
              )}
              {contrarian.length > 0 && (
                <CollapsibleTier
                  label="Contrarian"
                  count={contrarian.length}
                  tierColorKey="rose"
                  signals={contrarian}
                  onSelectTicker={handleSelectTicker}
                  selectedTicker={selectedTicker}
                  columnClasses={columnClasses}
                />
              )}
              {signals.length === 0 && (
                <NoSignalsEmptyState />
              )}
            </motion.tbody>
          )}
        </table>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none
                      bg-gradient-to-t from-card/80 to-transparent z-40 rounded-b-2xl"></div>
    </motion.div>
  );
});