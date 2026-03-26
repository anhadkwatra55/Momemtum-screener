"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { TickerModal } from "./ticker-modal";
import type { Signal } from "@/types/momentum";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getTextColorClass, getRgbaString } from "@/lib/utils";
import { AppleCard } from "@/components/ui/apple-card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"; // Import ui/table primitives
import { SFIcon } from "@/components/ui/SFIcon"; // Use the centralized SFIcon component
import { SENTIMENT_STYLES, SPRING_TRANSITION_DEFAULTS, FLASH_COLORS, INTERACTIVE_GLOW_CYAN, Z_INDICES } from "@/lib/constants";
import React from "react";

// ─── Framer Motion Constants ──────────────────────────────────────────────────
const SPRING_TRANSITION = SPRING_TRANSITION_DEFAULTS; // Use centralized spring physics

// Staggered animation for header items
const headerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08, // 80ms delay between items
      delayChildren: 0.1,
    },
  },
};

const headerItemVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: SPRING_TRANSITION },
};

// Staggered animation for table rows
const rowVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: SPRING_TRANSITION },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

// ─── Helper for Flash Animation (Real-time updates) ───────────────────────────
interface FlashCellProps {
  value: string | number;
  className?: string;
  isPositive?: boolean;
  isNegative?: boolean;
}

const FlashCell: React.FC<FlashCellProps> = React.memo(({ value, className, isPositive, isNegative }) => {
  const prevValueRef = useRef(value);
  const [animate, setAnimate] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      setAnimate(true);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      animationTimeoutRef.current = setTimeout(() => {
        setAnimate(false);
      }, 500);
    }
    prevValueRef.current = value;
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [value]);

  const flashVariants = useMemo(() => ({
    initial: { backgroundColor: "transparent" },
    flash: {
      backgroundColor: isPositive
        ? getRgbaString(FLASH_COLORS.positive)
        : isNegative
        ? getRgbaString(FLASH_COLORS.negative)
        : getRgbaString(FLASH_COLORS.neutral),
      transition: { duration: 0.15, ease: "easeOut" }
    },
    idle: { backgroundColor: "transparent", transition: { delay: 0.35, duration: 0.15, ease: "easeOut" } }
  }), [isPositive, isNegative]);

  return (
    <motion.span
      className={cn("inline-block w-full h-full", className)}
      variants={flashVariants}
      initial="initial"
      animate={animate ? "flash" : "idle"}
    >
      {value}
    </motion.span>
  );
});

FlashCell.displayName = "FlashCell";

// ─── Helper to map strength to sentiment key ──────────────────────────────────
const getSentimentKey = (strength: number): keyof typeof SENTIMENT_STYLES => {
  if (strength > 80) return "Strong Bullish";
  if (strength > 60) return "Bullish";
  if (strength > 40) return "Neutral";
  if (strength > 20) return "Bearish";
  return "Strong Bearish";
};

// ─── Main Component Props ─────────────────────────────────────────────────────
interface ScreenerTableProps {
  data: Signal[];
  title: string;
  icon: string; // Now expects an SF Symbol name string (e.g., "bolt.fill")
  description?: string;
  onSelectTicker?: (ticker: string) => void;
  isLoading?: boolean;
}

// ─── Sub-component for Skeleton Loading state ─────────────────────────────────
const ScreenerTableSkeleton = React.memo(() => (
  <div className="p-4 sm:p-6 lg:p-8 space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="skeleton shimmer h-10 w-48 sm:w-64 rounded-[var(--radius-2xl)]" />
      <div className="flex flex-wrap gap-3">
        <div className="skeleton shimmer h-11 w-full sm:w-48 rounded-[var(--radius-2xl)]" />
        <div className="skeleton shimmer h-11 w-full sm:w-40 rounded-[var(--radius-2xl)]" />
      </div>
    </div>
    <div className="skeleton shimmer h-4 w-56 rounded-[var(--radius-lg)]" />

    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[10%] min-w-[70px]">
            <div className="skeleton shimmer h-4 w-full rounded-[var(--radius-sm)]" />
          </TableHead>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableHead key={i} className="w-[15%] min-w-[100px]">
              <div className="skeleton shimmer h-4 w-full rounded-[var(--radius-sm)]" />
            </TableHead>
          ))}
          <TableHead className="w-[10%] min-w-[70px]">
            <div className="skeleton shimmer h-4 w-full rounded-[var(--radius-sm)]" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 10 }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            <TableCell>
              <div className="skeleton shimmer h-4 w-[40px] rounded-[var(--radius-sm)]" />
            </TableCell>
            <TableCell>
              <div className="skeleton shimmer h-4 w-[120px] rounded-[var(--radius-sm)]" />
            </TableCell>
            <TableCell>
              <div className="skeleton shimmer h-4 w-[80px] rounded-[var(--radius-sm)]" />
            </TableCell>
            <TableCell>
              <div className="skeleton shimmer h-4 w-[60px] rounded-[var(--radius-sm)]" />
            </TableCell>
            <TableCell>
              <div className="skeleton shimmer h-4 w-[80px] rounded-[var(--radius-sm)]" />
            </TableCell>
            <TableCell>
              <div className="skeleton shimmer h-4 w-[40px] rounded-[var(--radius-sm)]" />
            </TableCell>
            <TableCell>
              <div className="skeleton shimmer h-4 w-[50px] rounded-[var(--radius-sm)]" />
            </TableCell>
            <TableCell>
              <div className="skeleton shimmer h-4 w-[60px] rounded-[var(--radius-sm)]" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
));

ScreenerTableSkeleton.displayName = "ScreenerTableSkeleton";

// ─── Main ScreenerTable Component ─────────────────────────────────────────────
const ScreenerTableComponent = ({ data, title, icon, description, onSelectTicker, isLoading }: ScreenerTableProps) => {
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [modalSignal, setModalSignal] = useState<Signal | null>(null);

  const sectors = useMemo(() => {
    const s = new Set(data.map((d) => d.sector).filter(Boolean));
    return ["ALL", ...Array.from(s).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((s) => {
      if (search && !s.ticker.toUpperCase().includes(search.toUpperCase())) return false;
      if (sectorFilter !== "ALL" && s.sector !== sectorFilter) return false;
      return true;
    });
  }, [data, search, sectorFilter]);

  const handleRowClick = useCallback((signal: Signal) => {
    setModalSignal(signal);
  }, []);

  const inputInteractiveProps = useMemo(() => ({
    whileHover: INTERACTIVE_GLOW_CYAN,
    whileFocus: INTERACTIVE_GLOW_CYAN,
    transition: SPRING_TRANSITION
  }), []);

  if (isLoading) {
    return (
      <AppleCard whileHover={false}>
        <ScreenerTableSkeleton />
      </AppleCard>
    );
  }

  return (
    <AppleCard className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 flex-wrap gap-4">
        <h1 className={cn("text-3xl lg:text-4xl font-bold tracking-tight text-foreground", description ? "mb-2" : "mb-0")}>
          <SFIcon name={icon} size="lg" className="mr-3 inline-block align-middle text-cyan-400" />
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <motion.div
            className="relative flex-grow sm:flex-grow-0"
            {...inputInteractiveProps}
          >
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
              <SFIcon name="magnifyingglass" size="sm" />
            </span>
            <input
              type="text"
              placeholder="Search ticker…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "h-11 bg-muted/30 border border-transparent rounded-[var(--radius-2xl)] pl-10 pr-4 py-3 text-sm font-mono-data text-foreground placeholder:text-muted-foreground w-full sm:w-48 outline-none",
                "shadow-soft"
              )}
            />
          </motion.div>
          <motion.select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className={cn(
              "h-11 appearance-none bg-muted/30 border border-transparent rounded-[var(--radius-2xl)] pl-4 pr-10 py-3 text-sm font-mono-data text-foreground w-full sm:w-40 outline-none",
              "shadow-soft",
              "bg-no-repeat bg-[right_0.75rem_center] bg-[length:1em_1em]",
              "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]"
            )}
            {...inputInteractiveProps}
          >
            {sectors.map((s) => (
              <option key={s} value={s}>{s === "ALL" ? "All Sectors" : s}</option>
            ))}
          </motion.select>
        </div>
      </div>

      {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
      <p className="text-sm text-muted-foreground mb-4">{filtered.length} results found · Click any row for details</p>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm p-6 text-center">No signals detected for this screener with the current filters.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[10%] min-w-[70px]">
                Ticker
              </TableHead>
              <TableHead className="w-[15%] min-w-[100px]">Company</TableHead>
              <TableHead className="w-[15%] min-w-[100px]">Sector</TableHead>
              <TableHead className="w-[10%] min-w-[80px]">Mom. Score</TableHead>
              <TableHead className="w-[15%] min-w-[100px]">Strength</TableHead>
              <TableHead className="w-[10%] min-w-[70px]">Δ Day</TableHead>
              <TableHead className="w-[10%] min-w-[70px]">Vol Ratio</TableHead>
              <TableHead className="w-[15%] min-w-[100px]">Price</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            <AnimatePresence mode="popLayout">
              {filtered.map((s, index) => {
                const strength = Math.round(s.probability || 0);
                const sentimentKey = getSentimentKey(strength);
                const sentimentStyle = SENTIMENT_STYLES[sentimentKey];

                const dTextClass = cn({
                  [getTextColorClass('emerald', '400')]: s.daily_change > 0,
                  [getTextColorClass('rose', '400')]: s.daily_change < 0,
                  [getTextColorClass('slate', '400')]: s.daily_change === 0,
                });
                const probW = Math.min(100, Math.max(5, strength));

                const isLastRow = index === filtered.length - 1;

                return (
                  <TableRow
                    key={s.ticker}
                    onClick={() => handleRowClick(s)}
                  >
                    <TableCell>
                      <FlashCell value={s.ticker} />
                    </TableCell>
                    <TableCell>
                      <FlashCell value={s.company_name || ""} />
                    </TableCell>
                    <TableCell>
                      <FlashCell value={s.sector || ""} />
                    </TableCell>
                    <TableCell className="font-bold font-mono-data">
                      <FlashCell value={(s.composite || 0).toFixed(2)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 w-full">
                        <div className="w-16 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", sentimentStyle.bg)}
                            style={{ width: `${probW}%` }}
                          />
                        </div>
                        <span className={cn("font-semibold font-mono-data text-sm", sentimentStyle.text)}>
                          {strength}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={cn("font-semibold font-mono-data", dTextClass)}>
                      <FlashCell
                        value={`${s.daily_change > 0 ? "+" : ""}${s.daily_change}%`}
                        isPositive={s.daily_change > 0}
                        isNegative={s.daily_change < 0}
                      />
                    </TableCell>
                    <TableCell className="font-mono-data">
                      <FlashCell value={(s.vol_spike || 1).toFixed(2)} />
                    </TableCell>
                    <TableCell className="font-semibold font-mono-data">
                      <FlashCell
                        value={`$${(s.price || 0).toFixed(2)}`}
                        isPositive={s.daily_change > 0}
                        isNegative={s.daily_change < 0}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </AnimatePresence>
          </TableBody>
        </Table>
      )}

      {/* TickerModal renders via portal — always above all stacking contexts */}
      <TickerModal
        signal={modalSignal}
        onClose={() => setModalSignal(null)}
        onViewDetail={(ticker) => {
          onSelectTicker?.(ticker);
          setModalSignal(null);
        }}
      />
    </AppleCard>
  );
};

export const ScreenerTable = React.memo(ScreenerTableComponent);