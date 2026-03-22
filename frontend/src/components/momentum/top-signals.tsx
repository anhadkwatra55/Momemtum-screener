"use client";

import { memo, useMemo, useCallback, useState, useEffect, useRef } from "react";
import { COLORS, FLASH_VARIANTS, ITEM_WHILE_HOVER, SPRING_TRANSITION, PAGE_TRANSITION_INITIAL, PAGE_TRANSITION_ANIMATE } from "@/lib/constants";
import { ConvictionBadge, ActionBadge } from "./conviction-badge";
import type { Signal } from "@/types/momentum";
import { AppleCard } from "@/components/ui/apple-card";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getTextColorClass, formatNumber } from "@/lib/utils";
import type { PaletteColorKey } from "@/lib/utils";
import { SFIcon } from "@/components/ui/sf-icon";

// Defines the allowed string values for `flashColor` to ensure type safety and adherence to the design system's palette.
type AccentColorValue = typeof COLORS[keyof typeof COLORS];

interface TopSignalsProps {
  signals: Signal[] | undefined;
  onSelectTicker?: (ticker: string) => void;
  isLoading?: boolean;
}

// Reusable FlashOnChange component for subtle real-time updates with a robust background highlight.
// Memoized to prevent unnecessary re-renders when value or flashColor do not change.
interface FlashOnChangeProps {
  value: string | number;
  flashColor?: AccentColorValue; // Now strictly typed to our defined accent colors
  children: React.ReactNode; // The actual content with its own styling
}

const FlashOnChange = memo(function FlashOnChange({ value, flashColor = COLORS.cyan, children }: FlashOnChangeProps) {
  const [key, setKey] = useState(0);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      setKey((prev) => prev + 1); // Increment key to re-mount and trigger animation
      prevValue.current = value;
    }
  }, [value]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={key}
        className="relative inline-flex items-center justify-center rounded-2xl" // Use inline-flex for robust sizing and centering
        aria-live="polite" // Announce dynamic changes for accessibility
      >
        {/* This motion.span serves as the animating background, perfectly contained and rounded. */}
        <motion.span
          variants={FLASH_VARIANTS} // Uses the centralized variants object.
          initial="initial"
          animate="animate"
          custom={flashColor} // Passes flashColor as a custom prop for the dynamic variant.
          className="absolute inset-0 rounded-2xl z-0" // The animating background, perfectly contained within the parent's padding box.
          style={{ backgroundColor: 'transparent' }} // Default, will be overridden by custom prop during animation.
        />
        {/* The actual content with its own padding, positioned above the background. */}
        <span className="relative z-10 px-3 py-1"> {/* Expanded padding to match previous visual effect */}
          {children}
        </span>
      </motion.span>
    </AnimatePresence>
  );
});

// Sub-component for skeleton loading with shimmer effect.
const TopSignalsSkeleton = memo(function TopSignalsSkeleton() {
  return (
    <div className="space-y-4 pt-2 pb-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-4 px-4">
          <div className="flex items-center gap-3">
            {/* Adjusted skeleton sizes to visually align with the new, larger typography of the actual content */}
            <div className="h-7 w-20 rounded-xl bg-card/50 shimmer" /> {/* Ticker placeholder */}
            <div className="h-7 w-28 rounded-xl bg-card/50 shimmer" /> {/* Sentiment Badge placeholder */}
          </div>
          <div className="flex items-center gap-3">
            <div className="h-7 w-16 rounded-xl bg-card/50 shimmer" /> {/* Probability placeholder */}
            <div className="h-7 w-20 rounded-xl bg-card/50 shimmer" /> {/* Daily Change placeholder */}
          </div>
        </div>
      ))}
    </div>
  );
});

// Premium empty state component for when no signals are found.
// Features clear iconography, refined typography, and subtle glassmorphic styling.
const NoSignalsPlaceholder = memo(function NoSignalsPlaceholder() {
  return (
    <motion.div
      initial={PAGE_TRANSITION_INITIAL}
      animate={PAGE_TRANSITION_ANIMATE}
      transition={{ ...SPRING_TRANSITION, delay: 0.1 }}
      className="flex flex-col items-center justify-center p-8 text-center bg-card/30 rounded-2xl shadow-[var(--shadow-soft)] glass-subtle min-h-[200px]" // Added min-h for consistent presence
    >
      <SFIcon name="no-data" size="4xl" color="text-slate-500" />
      <h3 className="text-xl font-semibold text-foreground mb-2 mt-4 tracking-[-0.03em]">No High Conviction Signals</h3>
      <p className="text-muted-foreground text-base max-w-xs leading-relaxed">
        No ultra or high conviction momentum signals in the current scan. Check back when market conditions shift.
      </p>
    </motion.div>
  );
});

export const TopSignals = memo(function TopSignals({ signals, onSelectTicker, isLoading }: TopSignalsProps) {
  const topConviction = useMemo(() => {
    if (!signals) return [];
    const HIGH_TIERS = new Set(["Ultra Conviction", "High Conviction", "Moderate Conviction"]);
    return [...signals]
      .filter((s) => HIGH_TIERS.has(s.conviction_tier ?? ""))
      .sort((a, b) => b.composite - a.composite)
      .slice(0, 10);
  }, [signals]);

  const handleTickerClick = useCallback((ticker: string) => {
    onSelectTicker?.(ticker);
  }, [onSelectTicker]);

  return (
    <AppleCard className="p-6">
      <h2 className="text-lg md:text-xl font-bold mb-5 flex items-center gap-2 tracking-[-0.03em]">
        <SFIcon name="top.signals" size="base" color="text-cyan-400" />
        Top Momentum Signals
      </h2>
      {/* Removed max-h-80 overflow-y-auto to allow the AppleCard to expand dynamically. */}
      {/* This ensures a seamless scroll experience managed by the page, consistent with Apple's design philosophy. */}
      <div className="space-y-3">
        {isLoading ? (
          <TopSignalsSkeleton />
        ) : (
          <AnimatePresence mode="sync">
            {topConviction.length === 0 ? (
              <NoSignalsPlaceholder key="no-signals" />
            ) : (
              topConviction.map((s) => {
                let dailyChangeColorKey: PaletteColorKey;
                if (s.daily_change > 0) {
                  dailyChangeColorKey = 'emerald';
                } else if (s.daily_change < 0) {
                  dailyChangeColorKey = 'rose';
                } else {
                  dailyChangeColorKey = 'slate';
                }

                const dailyChangeTextColorClass = getTextColorClass(dailyChangeColorKey);
                // Ensure flashColor is correctly typed as AccentColorValue
                const flashColorForDailyChange: AccentColorValue = s.daily_change > 0 ? COLORS.emerald : s.daily_change < 0 ? COLORS.rose : COLORS.slate;

                const prob = s.probability || 0;
                const aura = prob >= 70 ? (
                  <SFIcon name="probability.high" size="sm" color="text-cyan-400" aria-label="High Probability Signal" />
                ) : prob >= 50 ? (
                  <SFIcon name="probability.medium" size="sm" color="text-cyan-400" aria-label="Medium Probability Signal" />
                ) : null;

                return (
                  <motion.div
                    key={s.ticker}
                    layout // Retain layout animation for smooth list changes (add/remove/reorder)
                    initial={PAGE_TRANSITION_INITIAL}
                    animate={PAGE_TRANSITION_ANIMATE}
                    exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
                    className="flex items-center justify-between py-4 px-4 rounded-2xl cursor-pointer bg-card/10 shadow-sm"
                    onClick={() => handleTickerClick(s.ticker)}
                    whileHover={ITEM_WHILE_HOVER}
                    transition={SPRING_TRANSITION}
                    role="listitem"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTickerClick(s.ticker);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-base text-cyan-400 font-mono-data">{s.ticker}</div>
                      <ConvictionBadge tier={s.conviction_tier ?? 'Contrarian'} />
                      {aura}
                    </div>
                    <div className="flex items-center gap-3">
                      <FlashOnChange value={prob} flashColor={COLORS.cyan}>
                        {/* Probability: Elevated to text-lg, font-bold, per "numbers are art" principle */}
                        <span className="text-lg font-bold text-muted-foreground font-mono-data">{formatNumber(prob)}%</span>
                      </FlashOnChange>
                      <FlashOnChange value={s.daily_change} flashColor={flashColorForDailyChange}>
                        {/* Daily Change: Elevated to text-lg, font-bold, per "numbers are art" principle */}
                        <span className={cn("font-bold text-lg font-mono-data", dailyChangeTextColorClass)}>
                          {s.daily_change > 0 ? "+" : ""}{formatNumber(s.daily_change)}%
                        </span>
                      </FlashOnChange>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        )}
      </div>
    </AppleCard>
  );
});