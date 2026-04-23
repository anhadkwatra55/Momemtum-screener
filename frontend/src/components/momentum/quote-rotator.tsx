"use client";

import { useState, useEffect, useCallback, memo } from "react";
import type { Quote } from "@/types/momentum";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getTextColorClass } from "@/lib/utils";
import { AppleCard } from "@/components/ui/apple-card";
import { SPRING_MOTION_CONFIG } from "@/lib/constants";

// Assuming `tracking-hero` is defined in `globals.css` or Tailwind config as:
// .tracking-hero { letter-spacing: -0.03em; }

const QUOTE_TRANSITION_VARIANTS = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: SPRING_MOTION_CONFIG,
};

interface QuoteRotatorProps {
  quotes: Quote[];
  intervalMs?: number;
  compact?: boolean;
}

export const QuoteRotator = memo(function QuoteRotator({ quotes, intervalMs = 15000, compact = false }: QuoteRotatorProps) {
  const [idx, setIdx] = useState(0);

  const rotate = useCallback(() => {
    setIdx((prev) => (prev + 1) % quotes.length);
  }, [quotes.length]);

  useEffect(() => {
    if (quotes.length <= 1) return;
    const iv = setInterval(rotate, intervalMs);
    return () => clearInterval(iv);
  }, [quotes.length, intervalMs, rotate]);

  if (!quotes.length) {
    return (
      <AppleCard
        className={cn(
          "relative overflow-hidden",
          compact ? "text-center p-6 md:p-8" : "text-center p-8 md:p-12 lg:p-16",
          compact ? "min-h-[160px] flex flex-col justify-center items-center" : "min-h-[200px] md:min-h-[240px] flex flex-col justify-center items-center",
          "touch-manipulation"
        )}
      >
        <div className="max-w-3xl mx-auto flex flex-col items-center" aria-live="polite">
          <p
            className={cn(
              "font-inter italic leading-relaxed tracking-hero",
              compact ? "text-lg md:text-xl" : "text-xl md:text-2xl lg:text-3xl",
              getTextColorClass('slate', '500')
            )}
          >
            &ldquo;No profound wisdom to share right now. Check back later!&rdquo;
          </p>
          <p
            className={cn(
              "mt-4 font-inter font-medium tracking-hero",
              compact ? "text-sm md:text-base" : "text-base md:text-lg lg:text-xl",
              getTextColorClass('slate', '600')
            )}
          >
            — The Oracle
          </p>
        </div>
      </AppleCard>
    );
  }

  const q = quotes[idx];

  return (
    <AppleCard
      className={cn(
        "relative overflow-hidden",
        compact ? "text-center p-6 md:p-8" : "text-center p-8 md:p-12 lg:p-16",
        compact ? "min-h-[160px] flex flex-col justify-center items-center" : "min-h-[200px] md:min-h-[240px] flex flex-col justify-center items-center",
        "touch-manipulation"
      )}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={q.text + q.author}
          {...QUOTE_TRANSITION_VARIANTS}
          className="max-w-3xl mx-auto"
          aria-live="polite"
        >
          <p
            className={cn(
              "font-inter italic leading-relaxed tracking-hero",
              compact ? "text-lg md:text-xl" : "text-xl md:text-2xl lg:text-3xl",
              getTextColorClass('slate', '300')
            )}
          >
            &ldquo;{q.text}&rdquo;
          </p>
          <p
            className={cn(
              "mt-4 font-inter font-semibold tracking-hero",
              compact ? "text-sm md:text-base" : "text-base md:text-lg lg:text-xl",
              getTextColorClass('cyan', '400')
            )}
          >
            — {q.author}
          </p>
        </motion.div>
      </AnimatePresence>
    </AppleCard>
  );
});