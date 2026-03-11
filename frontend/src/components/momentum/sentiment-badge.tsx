import { cn, getSentimentClasses, getGlowShadowStyle, appLogger } from "@/lib/utils";
import type { Sentiment } from "@/types/momentum";
import React, { useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  SPRING_TRANSITION_PROPS,
  SHADOW_SOFT,
  SHADOW_CARD_ELEVATED,
  SENTIMENT_STYLES,
} from "@/lib/constants";

interface SentimentBadgeProps {
  sentiment: Sentiment;
  className?: string;
  onClick?: () => void;
}

export const SentimentBadge = React.memo(function SentimentBadge({ sentiment, className, onClick }: SentimentBadgeProps) {
  const style = getSentimentClasses(sentiment);

  const isInteractive = !!onClick;

  const sentimentConfig = SENTIMENT_STYLES[sentiment];
  const sentimentColorKey = sentimentConfig?.colorKey || "amber";
  const sentimentTextShade = sentimentConfig?.textShade || '400';

  const motionProps = useMemo(() => {
    const sentimentGlowShadow = getGlowShadowStyle(sentimentColorKey, sentimentTextShade, 0.7);

    return {
      initial: { y: 0, boxShadow: SHADOW_SOFT, scale: 1 },
      whileHover: isInteractive
        ? { y: -2, boxShadow: `${SHADOW_CARD_ELEVATED}, ${sentimentGlowShadow}` }
        : { boxShadow: SHADOW_CARD_ELEVATED },
      whileFocus: isInteractive
        ? { y: -2, boxShadow: `${SHADOW_CARD_ELEVATED}, ${sentimentGlowShadow}` }
        : { boxShadow: SHADOW_CARD_ELEVATED },
      whileTap: isInteractive
        ? { y: 0, scale: 0.98, boxShadow: SHADOW_CARD_ELEVATED }
        : {},
      transition: SPRING_TRANSITION_PROPS,
    };
  }, [isInteractive, sentimentColorKey, sentimentTextShade]);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  return (
    <motion.span
      {...motionProps}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={`Sentiment: ${sentiment}`}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center",
        "px-3 py-1.5 text-xs font-semibold rounded-lg",
        "glass-subtle",
        "tracking-tight font-inter",
        "whitespace-nowrap",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-background",
        isInteractive ? "cursor-pointer" : "cursor-default",
        "border", // Ensures a consistent border is applied, which will be styled by style.border
        style.bg,
        style.text,
        style.border,
        className,
      )}
    >
      {sentiment}
    </motion.span>
  );
});