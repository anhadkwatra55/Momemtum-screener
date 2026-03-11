import React, { useMemo, useCallback } from 'react';
import type { Signal } from "@/types/momentum";
import { motion } from "framer-motion";
import { AppleCard } from "@/components/ui/apple-card";
import { SFIcon } from "@/components/ui/sf-icon";
import { cn, getTextColorClass, getBackgroundColorClass, PaletteColorKey } from "@/lib/utils";
import {
  SPRING_TRANSITION,
  STAGGER_CHILDREN_DELAY,
  CARD_HOVER_BACKGROUND,
  SF_SYMBOLS
} from "@/lib/constants";

// ── Framer Motion Variants ──
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: STAGGER_CHILDREN_DELAY,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: SPRING_TRANSITION,
  },
};

// Define explicit hover, focus, and tap states for interactive items
const interactiveItemHoverFocusProps = {
  y: -3, // Subtle lift on hover/focus
  boxShadow: 'var(--shadow-elevated), var(--shadow-glow-cyan)', // Elevated shadow and primary accent glow
  backgroundColor: CARD_HOVER_BACKGROUND, // Subtle background tint for hover/focus state
  transition: SPRING_TRANSITION, // Apply spring transition for hover/focus
};

const interactiveItemTapProps = {
  scale: 0.98, // Slight scale down on tap for a pressed feel
  transition: { duration: 0.1, ease: "easeOut" }, // Shorter, snappier transition for tap
};

// ── FlashValue Component ──
interface FlashValueProps {
  value: string | number;
  className?: string;
  flashColorKey?: PaletteColorKey;
}

const FlashValue = React.memo(({ value, className, flashColorKey = "cyan" }: FlashValueProps) => {
  const flashBgClass = useMemo(() => {
    return getBackgroundColorClass(flashColorKey, '500', '20');
  }, [flashColorKey]);

  return (
    <motion.span
      key={value as React.Key} // Ensure key is of type React.Key
      initial={{ backgroundColor: "transparent" }}
      animate={{ backgroundColor: [flashBgClass, "transparent"] }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={cn("inline-block", className)}
    >
      {value}
    </motion.span>
  );
});
FlashValue.displayName = 'FlashValue';

// ── EmptyState Component ──
const EmptyState = React.memo(() => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...SPRING_TRANSITION, delay: 0.1 }}
    className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-4"
  >
    <SFIcon name={SF_SYMBOLS.SEARCH} className={cn("mb-2", getTextColorClass('cyan'))} size="lg" />
    <h3 className="text-xl md:text-2xl font-semibold tracking-[-0.03em] text-foreground/80">
      No Active Sector Rotation Signals
    </h3>
    <p className="text-sm text-muted-foreground/70 max-w-sm px-4">
      The market appears to be in a calm phase, or we&apos;re anticipating new trends to unfold.
      Stay tuned for fresh opportunities and market shifts.
    </p>
  </motion.div>
));
EmptyState.displayName = 'EmptyState';

// ── Main Component ──
interface RotationSignalsProps {
  rotationIdeas: Signal[];
}

export const RotationSignals = React.memo(function RotationSignals({ rotationIdeas }: RotationSignalsProps) {
  const bySector = useMemo(() => {
    const result: Record<string, { count: number; tickers: string[]; avgComp: number }> = {};
    rotationIdeas.forEach((s) => {
      const sec = s.sector || "Unknown";
      if (!result[sec]) result[sec] = { count: 0, tickers: [], avgComp: 0 };
      result[sec].count++;
      result[sec].tickers.push(s.ticker);
      result[sec].avgComp += s.composite || 0;
    });
    return result;
  }, [rotationIdeas]);

  const sorted = useMemo(() => {
    return Object.entries(bySector)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);
  }, [bySector]);

  // Callback for item interaction - kept simple as no specific action prop was provided
  const handleItemInteraction = useCallback((sector: string) => {
    console.log(`Sector rotation item clicked/activated: ${sector}`);
    // In a real application, this would trigger navigation or open a modal with more details.
  }, []);

  return (
    <AppleCard className="p-6">
      <h2 className="text-xl font-bold tracking-[-0.03em] mb-6 flex items-center gap-2 text-foreground">
        <SFIcon name={SF_SYMBOLS.ROTATION} className={getTextColorClass('cyan')} size="md" /> Sector Rotation Signals
      </h2>
      {sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <motion.div
          className="space-y-4"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {sorted.map(([sec, d]) => {
            const avg = (d.avgComp / d.count).toFixed(2);
            const top3 = d.tickers.slice(0, 3).join(", ");

            return (
              <motion.div
                key={sec}
                className={cn(
                  "relative p-4 cursor-pointer outline-none",
                  "rounded-2xl", // Standardized to 1rem (rounded-2xl) for consistency
                  "focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
                variants={itemVariants}
                whileHover={interactiveItemHoverFocusProps}
                whileFocus={interactiveItemHoverFocusProps} // Mirror hover for focus state
                whileTap={interactiveItemTapProps} // Tap state for immediate feedback
                role="button" // Semantic role for accessibility
                tabIndex={0} // Makes the element focusable
                onClick={() => handleItemInteraction(sec)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Space') {
                    e.preventDefault();
                    handleItemInteraction(sec);
                  }
                }}
              >
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-base text-foreground">{sec}</div>
                  <span className={cn(
                    getBackgroundColorClass('cyan', '500', '12'),
                    getTextColorClass('cyan'),
                    "px-3 py-1 rounded-full text-xs font-medium uppercase tracking-[0.1em] whitespace-nowrap"
                  )}>
                    <FlashValue value={d.count} className="font-mono-data" flashColorKey="cyan" /> breakouts
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Leaders: <span className={cn("font-mono-data", "text-muted-foreground")}>{top3}</span> · Avg Comp:{" "}
                  <FlashValue value={avg} className={cn("font-mono-data", getTextColorClass('emerald'))} flashColorKey="emerald" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </AppleCard>
  );
});