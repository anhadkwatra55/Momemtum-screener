"use client";

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useAnimate } from 'framer-motion';
import { cn, getBackgroundColorClass, getSentimentClasses, getTextColorClass } from "@/lib/utils";
import type { Signal } from "@/types/momentum";
import { ConvictionBadge } from "./conviction-badge";
import {
  AURA_LABELS,
  AURA_SCORE_THRESHOLDS,
  COLORS, // Needed for direct color access in Framer Motion, now tokenized in FLASH_TRANSITION.flashColor
  SPRING_PHYSICS_DEFAULT,
  SPRING_PHYSICS_SNAPPY,
  FLASH_TRANSITION,
  LEADERBOARD_SCORE_MULTIPLIER,
  LEADERBOARD_SCORE_OFFSET,
  LEADERBOARD_MIN_PROGRESS_SCALE,
  LEADERBOARD_MAX_PROGRESS_SCALE,
  Z_INDICES,
  INTERACTIVE_HOVER_PROPS,
  INTERACTIVE_FOCUS_PROPS,
  TYPOGRAPHY,
  STAGGER_CHILDREN_DELAY
} from "@/lib/constants";
import type { SentimentType, PaletteColorKey } from "@/lib/utils";
import SFIcon from "@/components/ui/SFIcon";

// --- Design Token Helpers (Internal to LeaderboardItem for cleaner logic) ---
interface AuraStyleResult {
  scoreTextClass: string;
  progressBarBgClass: string;
  auraBgClass: string;
  auraBorderClass: string;
  displayAuraLabel: string;
  progressBarColorKey: PaletteColorKey;
}

const getAuraStyles = (score: number): AuraStyleResult => {
  let auraKey: string;
  let progressBarColorKey: PaletteColorKey;

  if (score >= AURA_SCORE_THRESHOLDS.ultra) {
    auraKey = 'ultra';
    progressBarColorKey = 'emerald';
  } else if (score >= AURA_SCORE_THRESHOLDS.elite) {
    auraKey = 'elite';
    progressBarColorKey = 'emerald';
  } else if (score >= AURA_SCORE_THRESHOLDS.strong) {
    auraKey = 'strong';
    progressBarColorKey = 'cyan';
  } else if (score >= AURA_SCORE_THRESHOLDS.moderate) {
    auraKey = 'moderate';
    progressBarColorKey = 'amber';
  } else if (score >= AURA_SCORE_THRESHOLDS.neutral) {
    auraKey = 'neutral';
    progressBarColorKey = 'amber';
  } else {
    auraKey = 'weak';
    progressBarColorKey = 'rose';
  }

  const displayLabel = AURA_LABELS[auraKey] || auraKey;

  // Map auraKey to sentiment-like style classes directly
  const sentimentColorMap: Record<string, { text: string; bg: string; border: string }> = {
    ultra: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    elite: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    strong: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
    moderate: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    neutral: { text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
    weak: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  };

  const style = sentimentColorMap[auraKey] || sentimentColorMap.neutral;

  return {
    scoreTextClass: style.text,
    progressBarBgClass: getBackgroundColorClass(progressBarColorKey, '500'),
    auraBgClass: style.bg,
    auraBorderClass: style.border,
    displayAuraLabel: displayLabel,
    progressBarColorKey: progressBarColorKey,
  };
};

// --- LeaderboardItem Skeleton Component ---
const LeaderboardItemSkeleton = React.memo(function LeaderboardItemSkeleton() {
  return (
    <div className={cn(
      "flex items-center gap-2 md:gap-4 py-4 px-4 rounded-[var(--radius-2xl)]",
      getBackgroundColorClass('slate', '800', '50'),
      "glass-subtle animate-pulse min-h-[64px]"
    )}>
      <div className={cn("w-6 h-6 md:w-8 rounded-md", getBackgroundColorClass('slate', '700'))} />
      <div className={cn("w-16 h-7 md:w-20 rounded-md", getBackgroundColorClass('slate', '700'))} />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className={cn("w-3/4 h-5 rounded-md", getBackgroundColorClass('slate', '700'))} />
        <div className={cn("w-1/4 h-4 rounded-full", getBackgroundColorClass('slate', '700'))} />
      </div>
      <div className="flex items-center gap-3 min-w-[100px] md:min-w-[120px]">
        <div className={cn("flex-1 h-2 rounded-full", getBackgroundColorClass('slate', '700'))} />
        <div className={cn("w-10 h-7 rounded-md", getBackgroundColorClass('slate', '700'))} />
      </div>
    </div>
  );
});

// Sub-component for each leaderboard item to optimize rendering and encapsulate logic
interface LeaderboardItemProps {
  signal: Signal;
  index: number;
  onSelectTicker?: (ticker: string) => void;
}

const LeaderboardItem = React.memo(function LeaderboardItem({ signal: s, index, onSelectTicker }: LeaderboardItemProps) {
  const [scope, animate] = useAnimate();
  const prevCompositeRef = useRef(s.composite);
  const hasMounted = useRef(false);

  const score = useMemo(() => Math.round(Math.min(LEADERBOARD_MAX_PROGRESS_SCALE * 100, Math.max(0, s.composite * LEADERBOARD_SCORE_MULTIPLIER + LEADERBOARD_SCORE_OFFSET))), [s.composite]);
  const progressScale = useMemo(() => Math.max(LEADERBOARD_MIN_PROGRESS_SCALE, score / 100), [score]);

  const { scoreTextClass, progressBarBgClass, auraBgClass, auraBorderClass, displayAuraLabel } = useMemo(() => {
    return getAuraStyles(score);
  }, [score]);

  const itemMotionVariants = useMemo(() => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  }), []);

  const handleClick = useCallback(() => {
    onSelectTicker?.(s.ticker);
  }, [s.ticker, onSelectTicker]);

  // Flash animation for score updates using opacity of an overlay
  useEffect(() => {
    if (hasMounted.current && prevCompositeRef.current !== s.composite) {
      animate(scope.current, { opacity: [0.7, 0] }, { ...FLASH_TRANSITION, duration: FLASH_TRANSITION.duration / 2 }); // Faster pulse
    }
    prevCompositeRef.current = s.composite;
    hasMounted.current = true;
  }, [s.composite, animate, scope]);

  return (
    <motion.button
      type="button" // Semantically a button
      className={cn(
        "flex items-center gap-2 md:gap-4 py-4 px-4 rounded-[var(--radius-2xl)] relative group",
        "outline-none appearance-none bg-transparent border-none text-left", // Reset button styles
        "[box-shadow:var(--shadow-card)]",
        "transition-all duration-200",
        "bg-card/[0.45] backdrop-blur-xl",
        "min-h-[64px]"
      )}
      variants={itemMotionVariants}
      transition={SPRING_PHYSICS_DEFAULT}
      whileHover={INTERACTIVE_HOVER_PROPS}
      whileFocus={INTERACTIVE_FOCUS_PROPS}
      onClick={handleClick}
    >
      {/* Rank */}
      <div className="text-slate-500 text-base md:text-lg font-bold w-6 md:w-8 text-center font-mono-data">{index + 1}</div>

      {/* Ticker (JetBrains Mono, accent color) */}
      <div className={cn("font-extrabold text-lg md:text-xl w-16 md:w-20 font-mono-data", getTextColorClass('cyan', '400'))}>{s.ticker}</div>

      {/* Company Name / Sector & Conviction Tier */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className={cn("text-base truncate leading-tight", getTextColorClass('slate', '200'))}>{s.company_name || s.sector}</div>
        <motion.div
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="mt-1"
        >
          <ConvictionBadge tier={s.conviction_tier ?? 'Contrarian'} />
        </motion.div>
      </div>

      {/* Progress Bar & Score (JetBrains Mono, color-coded) */}
      <div className="flex items-center gap-3 min-w-[100px] md:min-w-[120px] ml-auto">
        <div className={cn("flex-1 h-2 rounded-full overflow-hidden", getBackgroundColorClass('slate', '700', '20'))}>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progressScale }}
            transition={SPRING_PHYSICS_DEFAULT}
            className={cn("h-full rounded-full transform-origin-left", progressBarBgClass)}
          />
        </div>
        <div className={cn("relative rounded-lg p-1 transition-colors duration-200 min-w-[44px] h-11 flex items-center justify-end", scoreTextClass)}>
          <motion.div
            ref={scope}
            className={cn(
              "absolute inset-0 rounded-lg",
              "bg-cyan-500/20", // Flash overlay color from FLASH_TRANSITION.flashColor
              "z-[5]"
            )}
            initial={{ opacity: 0 }} // Keep initial opacity for consistent state
            aria-hidden="true" // Hide from screen readers as it's purely visual
          />
          <motion.span
            key={score}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING_PHYSICS_SNAPPY}
            className="font-extrabold text-2xl font-mono-data text-right relative z-10" // Ensure score is above flash
          >
            {score}
          </motion.span>
        </div>
      </div>
    </motion.button>
  );
});

// --- LeaderboardEmptyState Component ---
const LeaderboardEmptyState = React.memo(function LeaderboardEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className={cn(
        "mb-6 w-24 h-24 rounded-full flex items-center justify-center",
        getBackgroundColorClass('slate', '800', '50'),
        "[box-shadow:var(--shadow-card)]"
      )}>
        <SFIcon icon="chart.line.uptrend.rectangle.fill" className={getTextColorClass('slate', '600')} size="48" />
      </div>
      <h3 className={cn("text-2xl font-semibold", `tracking-[${TYPOGRAPHY.LETTER_SPACING_TIGHT_HEADING}]`, getTextColorClass('slate', '200'))}>No Momentum Signals Yet</h3>
      <p className={cn("mt-2 text-lg max-w-sm", getTextColorClass('slate', '400'))}>
        The market is quiet, or our algorithms are still processing. Check back soon for the latest shifts!
      </p>
    </div>
  );
});

// Main Leaderboard component
interface LeaderboardProps {
  signals: Signal[] | null;
  onSelectTicker?: (ticker: string) => void;
}

export const Leaderboard = React.memo(function Leaderboard({ signals, onSelectTicker }: LeaderboardProps) {
  const top10 = useMemo(() => {
    if (!signals) return [];
    return [...signals]
      .sort((a, b) => b.composite - a.composite)
      .slice(0, 10);
  }, [signals]);

  const isLoading = !signals;

  return (
    <div className="apple-card p-6 relative flex flex-col">
      {/* Sticky Header */}
      <motion.h2
        className={cn(
          "text-3xl lg:text-4xl font-extrabold mb-6 text-slate-50",
          `tracking-[${TYPOGRAPHY.LETTER_SPACING_TIGHT_HEADING}]`,
          "sticky top-0 pb-4 pt-0 -mx-6 px-6 -mt-6",
          `z-[${Z_INDICES.STICKY_HEADER}]`,
          "bg-card/[0.45] backdrop-blur-xl", // Changed to match apple-card's glassmorphism
          "rounded-t-[var(--radius-2xl)]",
          "after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px",
          "after:bg-gradient-to-r after:from-transparent after:via-white/[0.08] after:to-transparent"
        )}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_PHYSICS_DEFAULT}
      >
        <SFIcon icon="trophy.fill" className={cn("mr-3", getTextColorClass('amber', '400'))} size="28" />
        Momentum Leaderboard
      </motion.h2>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pr-2 -mr-2 flex flex-col gap-y-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <LeaderboardItemSkeleton key={i} />)
        ) : top10.length > 0 ? (
          <motion.div
            initial="initial"
            animate="animate"
            variants={{
              initial: { opacity: 0 },
              animate: {
                opacity: 1,
                transition: { staggerChildren: STAGGER_CHILDREN_DELAY },
              },
            }}
            className="flex flex-col gap-y-3"
          >
            <AnimatePresence>
              {top10.map((s, i) => (
                <LeaderboardItem key={s.ticker} signal={s} index={i} onSelectTicker={onSelectTicker} />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <LeaderboardEmptyState />
        )}
      </div>
    </div>
  );
});