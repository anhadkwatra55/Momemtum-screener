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
}

export const QuoteRotator = memo(function QuoteRotator({ quotes, intervalMs = 15000 }: QuoteRotatorProps) {
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
          "text-center p-8 md:p-12 lg:p-16",
          "min-h-[200px] md:min-h-[240px] flex flex-col justify-center items-center",
          "touch-manipulation"
        )}
      >
        <div className="max-w-3xl mx-auto flex flex-col items-center" aria-live="polite">
          <p
            className={cn(
              "font-inter text-xl md:text-2xl lg:text-3xl italic leading-relaxed tracking-hero",
              getTextColorClass('slate', '500')
            )}
          >
            &ldquo;No profound wisdom to share right now. Check back later!&rdquo;
          </p>
          <p
            className={cn(
              "mt-4 font-inter text-base md:text-lg lg:text-xl font-medium tracking-hero",
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
        "text-center p-8 md:p-12 lg:p-16",
        "min-h-[200px] md:min-h-[240px] flex flex-col justify-center items-center",
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
              "font-inter text-xl md:text-2xl lg:text-3xl italic leading-relaxed tracking-hero",
              getTextColorClass('slate', '300')
            )}
          >
            &ldquo;{q.text}&rdquo;
          </p>
          <p
            className={cn(
              "mt-4 font-inter text-base md:text-lg lg:text-xl font-semibold tracking-hero",
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