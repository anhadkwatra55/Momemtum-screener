import React, { memo, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence, useAnimate } from "framer-motion";
import { cn, getTextColorClass, getBackgroundColorClass, hexToRgba } from "@/lib/utils";
import { COLORS, SPRING_TRANSITION_DEFAULTS, FLASH_ANIMATION_DURATION_IN, FLASH_ANIMATION_DELAY_OUT, FLASH_ANIMATION_DURATION_OUT } from "@/lib/constants";
import type { Signal } from "@/types/momentum";
import { AppleCard } from "@/components/ui/apple-card";
import { SFIcon } from "@/components/ui/sf-icon";

// --- FlashValue component for real-time updates with subtle visual feedback ---
interface FlashValueProps {
  value: number | string;
  className?: string;
  prefix?: string;
  suffix?: string;
}

const FlashValue = memo(({ value, className, prefix = "", suffix = "" }: FlashValueProps) => {
  const [scope, animate] = useAnimate();
  const prevValueRef = useRef(value);

  // Pre-calculate RGB values from the accent color for efficient animation
  const { r, g, b } = useMemo(() => {
    const hex = COLORS.cyan.slice(1); // Get hex without '#'
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }, []);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      const initialTextColor = window.getComputedStyle(scope.current).color;
      const sequence = [
        // Flash in with accent background
        [scope.current, {
          backgroundColor: `rgba(${r}, ${g}, ${b}, 0.1)`,
          color: initialTextColor
        }, { duration: FLASH_ANIMATION_DURATION_IN, ease: "easeOut" }],
        // Fade out background, retaining text color
        [scope.current, {
          backgroundColor: "transparent",
          color: initialTextColor
        }, { delay: FLASH_ANIMATION_DELAY_OUT, duration: FLASH_ANIMATION_DURATION_OUT, ease: "easeIn" }]
      ];
      animate(sequence);
    }
    prevValueRef.current = value;
  }, [value, scope, animate, r, g, b]);

  return (
    <motion.span
      ref={scope}
      className={cn(
        "inline-block rounded-[var(--radius-lg)] transition-colors duration-400 ease-in-out",
        className
      )}
    >
      {prefix}{value}{suffix}
    </motion.span>
  );
});
FlashValue.displayName = "FlashValue";

// --- DailyChangeDisplay sub-component for price changes, styled as art ---
interface DailyChangeDisplayProps {
  value: number;
}

const DailyChangeDisplay = memo(
  ({ value }: DailyChangeDisplayProps) => {
    const dailyChangeTextColorClass = useMemo(() => {
      return value > 0
        ? getTextColorClass('emerald', '400')
        : value < 0
        ? getTextColorClass('rose', '400')
        : getTextColorClass('slate', '400');
    }, [value]);

    return (
      <FlashValue
        value={value.toFixed(2)}
        prefix={value > 0 ? "+" : ""}
        suffix="%"
        className={cn("font-bold font-mono-data text-lg sm:text-xl md:text-2xl", dailyChangeTextColorClass)}
      />
    );
  }
);
DailyChangeDisplay.displayName = "DailyChangeDisplay";

// --- MiniSignalListItem component: a card for each signal with interactive hover ---
interface MiniSignalListItemProps {
  signal: Signal;
  onSelectTicker?: (ticker: string) => void;
}

const MiniSignalListItem = memo(
  ({ signal, onSelectTicker }: MiniSignalListItemProps) => {
    const handleClick = useCallback(() => {
      onSelectTicker?.(signal.ticker);
    }, [onSelectTicker, signal.ticker]);

    // Consistent hover styles: subtle elevated shadow + cyan border glow + background tint
    const cyanHexWithoutHash = COLORS.cyan.slice(1);
    const hoverBoxShadow = useMemo(() => `0 4px 12px rgba(0,0,0,0.2), 0 0 0 1px ${hexToRgba(cyanHexWithoutHash, 0.4)}`, [cyanHexWithoutHash]);
    const hoverBackgroundColor = useMemo(() => hexToRgba(cyanHexWithoutHash, 0.1), [cyanHexWithoutHash]);

    const whileHoverProps = useMemo(() => ({
      y: -2,
      boxShadow: hoverBoxShadow,
      backgroundColor: hoverBackgroundColor,
      backdropFilter: 'blur(12px) saturate(1.15)',
      WebkitBackdropFilter: 'blur(12px) saturate(1.15)',
    }), [hoverBoxShadow, hoverBackgroundColor]);

    return (
      <motion.div
        layout // Enable smooth layout transitions
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={SPRING_TRANSITION_DEFAULTS}
        whileHover={whileHoverProps}
        className={cn(
          "relative flex items-center justify-between py-3 px-4 rounded-2xl cursor-pointer",
          "group min-h-[44px]", // Minimum touch target size
          "bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`View details for ${signal.ticker}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { // Allow activation with Enter and Spacebar for accessibility
            handleClick();
            e.preventDefault();
          }
        }}
      >
        <div className="flex flex-col flex-grow min-w-0 pr-2">
          <span className="font-bold font-mono-data text-lg sm:text-xl md:text-2xl text-cyan-400 truncate">
            {signal.ticker}
          </span>
          <span className="text-muted-foreground text-xs truncate">
            {signal.company_name || signal.sector || "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <DailyChangeDisplay value={signal.daily_change} />
          <FlashValue
            value={signal.price?.toFixed(2) || "—"}
            prefix="$"
            className="text-muted-foreground font-mono-data text-sm sm:text-base"
          />
        </div>
      </motion.div>
    );
  }
);
MiniSignalListItem.displayName = "MiniSignalListItem";

// --- Skeleton Loader for MiniSignalList, mirroring live component structure ---
const MiniSignalListSkeleton = memo(() => {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between py-3 px-4 rounded-2xl h-[44px] skeleton"
        >
          <div className="flex flex-col flex-grow min-w-0 pr-2 gap-1">
            <div className="h-4 w-20 rounded-md skeleton" />
            <div className="h-3 w-32 rounded-md skeleton" />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <div className="h-4 w-16 rounded-md skeleton" />
            <div className="h-3 w-12 rounded-md skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
});
MiniSignalListSkeleton.displayName = "MiniSignalListSkeleton";

// --- MiniSignalList component: main container for a list of signals ---
interface MiniSignalListProps {
  title: string;
  icon: string;
  signals: Signal[];
  limit?: number;
  onSelectTicker?: (ticker: string) => void;
  isLoading?: boolean;
}

export const MiniSignalList = memo(
  ({ title, icon, signals, limit = 5, onSelectTicker, isLoading = false }: MiniSignalListProps) => {
    const handleSelectTicker = useCallback(
      (ticker: string) => {
        onSelectTicker?.(ticker);
      },
      [onSelectTicker]
    );

    return (
      <AppleCard className="p-6">
        <h2
          className={cn(
            "text-2xl font-bold tracking-[-0.03em] mb-4 flex items-center gap-3", // Applied precise letter-spacing
          )}
        >
          <SFIcon name={icon} className="text-xl sm:text-2xl text-cyan-500" />
          {title}
          { (signals.length > 0 || isLoading) && (
            <span
              className={cn(
                "text-xs text-slate-400 font-normal ml-auto px-2 py-1 rounded-full",
                getBackgroundColorClass('slate', '800', '40')
              )}
            >
              {isLoading && signals.length === 0 ? 'Loading...' : `${signals.length} signals`}
            </span>
          )}
        </h2>
        {isLoading && signals.length === 0 ? (
          <MiniSignalListSkeleton />
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-card/20 rounded-2xl mt-4 mx-2">
            {/* Replaced custom SVG with SFIcon for consistency */}
            <SFIcon name="magnifyingglass.slash" className="w-12 h-12 text-muted-foreground mb-4 opacity-70" />
            <p className="text-lg font-semibold text-foreground/80 mb-2">
              No Active Signals
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              The market is quiet, or your filters might be too restrictive.
              Check back later or adjust your criteria.
            </p>
          </div>
        ) : (
          <motion.div
            layout // Enable layout animations for list items
            className="space-y-3"
          >
            <AnimatePresence>
              {signals.slice(0, limit).map((s) => (
                <MiniSignalListItem
                  key={s.ticker}
                  signal={s}
                  onSelectTicker={handleSelectTicker}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AppleCard>
    );
  }
);

MiniSignalList.displayName = "MiniSignalList";