import { cn, getSentimentClasses, getBackgroundColorClass, getTextColorClass, getAccentRgba, getCardBgRgba } from "@/lib/utils";
import { COLORS, SPRING_TRANSITION_PROPS, COLOR_RGB_COMPONENTS, CARD_BORDER_RADIUS_REM } from "@/lib/constants";
import type { SectorRegime, SectorSentiment } from "@/types/momentum";
import { motion } from "framer-motion";
import React, { useMemo } from "react";
import { Separator } from "../ui/separator";

// Placeholder SFIcon component within the same file as per rules.
// In a real Apple project, this would integrate with SF Symbols directly
// via a custom font, SVG sprite, or dedicated library.
// For this task, it provides a minimal visual representation for the required icon.
interface SFIconProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string; // SF Symbol name, e.g., "bolt.fill", "chart.bar.fill"
}

// Generic Question Mark Icon for fallback, aligning with visual quality standards
const QuestionMarkIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

function SFIcon({ name, className, ...props }: SFIconProps) {
  return (
    <div
      className={cn(
        "sf-icon", // Base class for SF Icons if global styles are defined
        "inline-flex items-center justify-center", // For basic alignment
        "text-lg", // Default size, can be overridden by className
        className
      )}
      aria-label={name.replace(/[-.]/g, ' ')} // Accessible label
      {...props}
    >
      {/* Specific SVG for 'chart.bar.fill' as it was used directly before. */}
      {name === "chart.bar.fill" && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="20" x2="12" y2="10"></line>
          <line x1="18" y1="20" x2="18" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="16"></line>
        </svg>
      )}
      {/* For other icons, use a generic placeholder icon */}
      {name !== "chart.bar.fill" && (
        <QuestionMarkIcon className="text-muted-foreground/50" />
      )}
    </div>
  );
}

// Helper function to map bullPct to a sentiment text color class,
// ensuring consistency with the centralized design token system.
const getBullPctSentimentTextClass = (bullPct: number): string => {
  if (bullPct >= 75) return getSentimentClasses("Strong Bullish").text;
  if (bullPct >= 55) return getSentimentClasses("Bullish").text;
  if (bullPct > 45 && bullPct < 55) return getSentimentClasses("Neutral").text;
  if (bullPct >= 25) return getSentimentClasses("Bearish").text;
  return getSentimentClasses("Strong Bearish").text;
};

interface TrendingSectorItemProps {
  sec: string;
  regime: SectorRegime;
  sentiment: SectorSentiment;
  bullPct: number;
  isAura: boolean;
  onClick: (sec: string) => void;
}

const TrendingSectorItem = React.memo(function TrendingSectorItem({
  sec,
  regime,
  sentiment,
  bullPct,
  isAura,
  onClick,
}: TrendingSectorItemProps) {
  const { count, avg_composite, avg_probability } = regime;

  const bullPctColorClass = getBullPctSentimentTextClass(bullPct);

  // Framer Motion props for hover and transition, adhering to design principles.
  const whileHoverProps = useMemo(() => ({
    y: -3, // Subtle lift for elevation.
    // Elevated shadow with a subtle cyan border glow, leveraging getAccentRgba for consistency.
    boxShadow: `0 10px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px ${getAccentRgba(0.5)}`,
    zIndex: 10, // Ensure hover effect is on top of adjacent items.
    // Make the card slightly more opaque on hover, preserving the backdrop-blur effect.
    backgroundColor: getCardBgRgba(0.65), // Original opacity was 0.45, subtly increased to 0.65.
  }), []);

  // Use the extracted SPRING_TRANSITION_PROPS constant for consistent animation physics.
  const transitionProps = SPRING_TRANSITION_PROPS;

  return (
    <motion.button
      className={cn(
        "flex flex-col md:flex-row items-start md:items-center justify-between p-5 md:p-6",
        "bg-card/45 backdrop-blur-md", // Premium card appearance with translucency.
        `rounded-[${CARD_BORDER_RADIUS_REM}]`, // Use shared constant for generous rounding.
        "relative overflow-hidden group w-full text-left", // Ensures button takes full width, text aligns left.
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cyan-500/80 focus-visible:ring-offset-background", // A11y focus ring with accent color.
        "min-h-[44px]" // Ensure touch target minimum size.
      )}
      whileHover={whileHoverProps}
      whileFocus={whileHoverProps} // Mirror hover effect for keyboard focus.
      transition={transitionProps}
      onClick={() => onClick(sec)} // Handle click action.
    >
      <div className="flex flex-col gap-1.5 mb-3 md:mb-0 md:pr-4">
        <div className="font-bold text-xl tracking-tight text-foreground flex items-center gap-2">
          {sec}
          {isAura && (
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full font-bold leading-none",
                // Using utility functions for consistent color tokenization of the badge.
                getBackgroundColorClass('amber', '500', '15'),
                getTextColorClass('amber', '400'),
                "tracking-uppercase-label" // Apply custom 0.1em letter-spacing for uppercase labels.
              )}
            >
              <span className="font-mono">∞</span> AURA
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2 text-sm text-muted-foreground font-inter">
          <span className="font-mono text-base text-cyan-400">{count}</span>
          <span className="text-xs">tickers</span>
          <Separator orientation="vertical" className="h-4 bg-foreground/10 mx-1" /> {/* Use tokenized color */}
          <span className="text-xs">Avg Score:</span>
          <span className="font-mono text-base text-cyan-400">{avg_composite.toFixed(2)}</span>
        </div>
      </div>
      <div className="text-right flex flex-col gap-1 items-start md:items-end w-full md:w-auto">
        <div className={cn("font-extrabold text-2xl font-mono tracking-tighter", bullPctColorClass)}>
          {bullPct}% bull
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          Prob: {avg_probability.toFixed(0)}%
        </div>
      </div>
    </motion.button>
  );
});

interface TrendingSectorsSkeletonProps {
  count?: number;
}

const TrendingSectorsSkeleton = ({ count = 3 }: TrendingSectorsSkeletonProps) => (
  <div className="space-y-4"> {/* Consistent gap between skeleton cards. */}
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={cn(
          "flex flex-col md:flex-row items-start md:items-center justify-between p-5 md:p-6 animate-pulse",
          "bg-card/45 backdrop-blur-md",
          `rounded-[${CARD_BORDER_RADIUS_REM}]` // Consistent rounded corners for skeleton container.
        )}
      >
        <div className="flex flex-col gap-2 mb-3 md:mb-0">
          <div className="h-6 w-32 bg-gray-700/50 rounded-[0.5rem]"></div> {/* Consistent rounded corners for skeletons. */}
          <div className="h-4 w-48 bg-gray-800/50 rounded-[0.5rem]"></div>
        </div>
        <div className="flex flex-col gap-2 items-start md:items-end">
          <div className="h-7 w-24 bg-gray-700/50 rounded-[0.5rem]"></div>
          <div className="h-4 w-20 bg-gray-800/50 rounded-[0.5rem]"></div>
        </div>
      </div>
    ))}
  </div>
);

interface TrendingSectorsProps {
  sectors: Record<string, SectorRegime> | undefined;
  sentiment: Record<string, SectorSentiment> | undefined;
  onSectorClick?: (sector: string) => void;
}

// Framer Motion variants for staggered list entry animation
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08, // 80ms delay between items
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      ...SPRING_TRANSITION_PROPS, // Use the spring physics for item animation
      delay: 0.05 // A small delay to make it feel responsive but not instant
    },
  },
};

export function TrendingSectors({ sectors, sentiment, onSectorClick }: TrendingSectorsProps) {
  const isLoading = !sectors || !sentiment;

  const trending = React.useMemo(() => {
    if (isLoading) return [];
    return Object.entries(sectors)
      .filter(([, v]) => v.regime === "Trending")
      .sort((a, b) => b[1].avg_composite - a[1].avg_composite);
  }, [sectors, isLoading]);

  const handleItemClick = React.useCallback((sec: string) => {
    onSectorClick?.(sec);
  }, [onSectorClick]);

  return (
    <div className={cn(
      `rounded-[${CARD_BORDER_RADIUS_REM}]`, // Use shared constant for container rounding.
      "bg-card/45 backdrop-blur-md shadow-lg p-6 lg:p-8"
    )}>
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6 flex items-center gap-3 text-foreground">
        {/* Replaced inline SVG with the SFIcon component for a standardized icon system. */}
        <SFIcon name="chart.bar.fill" className="text-cyan-400 flex-shrink-0" />
        Top Trending Sectors
      </h2>
      {isLoading ? (
        <TrendingSectorsSkeleton />
      ) : trending.length === 0 ? (
        <p className="text-muted-foreground text-base py-6 text-center">No trending sectors detected at this time.</p>
      ) : (
        <motion.div
          className="flex flex-col space-y-4" // Uses consistent space for card separation.
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {trending.map(([sec, r]) => {
            const s = sentiment[sec] || { bullish: 0, bearish: 0, neutral: 0 };
            const total = s.bullish + s.bearish + s.neutral || 1;
            const bullPct = Math.round((s.bullish / total) * 100);
            const isAura = r.avg_composite > 0.1;

            return (
              <motion.div key={sec} variants={itemVariants}>
                <TrendingSectorItem
                  sec={sec}
                  regime={r}
                  sentiment={s}
                  bullPct={bullPct}
                  isAura={isAura}
                  onClick={handleItemClick}
                />
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}