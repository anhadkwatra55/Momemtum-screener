"use client";

import React, { useEffect, useCallback, useMemo } from "react";
import { cn, getTextColorClass, formatValue, PaletteColorKey } from "@/lib/utils";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { AppleCard } from "@/components/ui/apple-card";
import { SPRING_TRANSITION, STAGGER_CHILDREN_DELAY } from "@/lib/constants";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  colorKey?: PaletteColorKey;
  animateCount?: boolean;
}

const AnimatedNumber = ({ value, prefix = "", suffix = "", className, colorKey = "cyan", animateCount = true }: AnimatedNumberProps) => {
  const count = useMotionValue(value);
  const formattedText = useTransform(count, (latest) => formatValue(latest, prefix, suffix));

  useEffect(() => {
    if (animateCount) {
      const animation = animate(count, value, SPRING_TRANSITION);
      return animation.stop;
    } else {
      count.set(value);
    }
  }, [count, value, animateCount]);

  return (
    <motion.span className={cn("font-mono-data", className, getTextColorClass(colorKey))}>
      {formattedText}
    </motion.span>
  );
};

interface KPICardProps {
  label: string;
  value: number | string;
  colorKey?: PaletteColorKey;
  prefix?: string;
  suffix?: string;
  animate?: boolean;
}

const KPICard = React.memo(function KPICard({ label, value, colorKey = "cyan", prefix = "", suffix = "", animate = true }: KPICardProps) {
  // Memoize common hover props to avoid inline object literals.
  // AppleCard's native hover effect will handle the shadow and glow based on glowColorKey.
  const whileHoverProps = useMemo(() => ({
    y: -2,
  }), []);

  return (
    <motion.div variants={itemVariants}>
      <AppleCard
        className="p-5 text-center rounded-2xl border-0"
        whileHover={whileHoverProps}
        transition={SPRING_TRANSITION}
        glowColor="cyan" // Enforce primary accent glow for consistency within the KPI strip section
      >
        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2">
          {label}
        </div>
        {typeof value === "number" ? (
          <AnimatedNumber
            value={value}
            prefix={prefix}
            suffix={suffix}
            className="text-2xl font-extrabold leading-none"
            colorKey={colorKey}
            animateCount={animate}
          />
        ) : (
          <div className={cn("text-2xl font-extrabold font-mono-data leading-none", getTextColorClass(colorKey))}>
            {prefix}{value}{suffix}
          </div>
        )}
      </AppleCard>
    </motion.div>
  );
});

// Stagger variants for the KPIStrip container
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: STAGGER_CHILDREN_DELAY,
      staggerChildren: STAGGER_CHILDREN_DELAY,
    },
  },
};

// Variants for individual KPICard items
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: SPRING_TRANSITION,
  },
};

interface KPIStripProps {
  items: Array<{
    label: string;
    value: number | string;
    colorKey?: PaletteColorKey;
    prefix?: string;
    suffix?: string;
  }>;
  className?: string;
}

export function KPIStrip({ items, className }: KPIStripProps) {
  return (
    <motion.div
      className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-5 lg:gap-6", className)}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {items.map((item) => (
        <KPICard key={item.label} {...item} />
      ))}
    </motion.div>
  );
}