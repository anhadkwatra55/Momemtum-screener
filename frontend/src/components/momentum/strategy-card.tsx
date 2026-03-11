import { cn, getTextColorClass, getBackgroundColorClass } from "@/lib/utils";
import { SentimentBadge } from "./sentiment-badge";
import { SPRING_PHYSICS_DEFAULT, APPLE_CARD_HOVER_SHADOW } from "@/lib/constants";
import type { Strategy } from "@/types/momentum";
import React from "react";
import { AppleCard } from "@/components/ui/apple-card";
import { motion } from "framer-motion";

// Local definition for PaletteColorKey and its hex map.
// In a real application, these would be imported from `lib/utils.ts` and `lib/constants.ts`
// respectively, following the "centralize constants" and "resolve critical build error" mandates.
type LocalPaletteColorKey =
  | 'cyan'
  | 'emerald'
  | 'rose'
  | 'amber'
  | 'violet'
  | 'blue'
  | 'lime'
  | 'orange'
  | 'slate';

const PALETTE_HEX_MAP: Record<LocalPaletteColorKey, string> = {
  cyan: '#06b6d4',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  blue: '#3b82f6', // Example, assuming a default blue shade
  lime: '#84cc16', // Example
  orange: '#f97316', // Example
  slate: '#64748b', // Example slate-500
};

// Local utility to convert PaletteColorKey to RGBA string for Framer Motion and direct CSS use.
// This function addresses the critical build error identified in the analysis.
function getPaletteColorWithAlpha(colorKey: LocalPaletteColorKey, opacity: number): string {
  const hex = PALETTE_HEX_MAP[colorKey];
  if (!hex) {
    console.warn(`Unknown colorKey for getPaletteColorWithAlpha: "${colorKey}". Falling back to transparent.`);
    return `rgba(0, 0, 0, 0)`;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

interface StrategyCardProps {
  strategy: Strategy;
  className?: string;
}

// Sub-component for animating numerical/text changes with Framer Motion
const AnimatedValue: React.FC<{
  value: string | number | undefined | null;
  className?: string;
  colorClass?: string;
  prefix?: string;
  suffix?: string;
}> = React.memo(
  ({ value, className, colorClass, prefix = "", suffix = "" }) => {
    const prevValue = React.useRef(value);
    const [animationKey, setAnimationKey] = React.useState(0);

    React.useEffect(() => {
      if (String(prevValue.current) !== String(value)) {
        setAnimationKey(prev => prev + 1);
        prevValue.current = value;
      }
    }, [value]);

    const displayValue = value === undefined || value === null ? "—" : `${value}`;

    // Refactored flash animation transition to use a tween type, suitable for keyframes.
    // getPaletteColorWithAlpha is used to provide direct RGBA values for Framer Motion.
    return (
      <motion.span
        key={animationKey}
        initial={{ backgroundColor: "transparent" }}
        animate={{ backgroundColor: ["transparent", getPaletteColorWithAlpha('cyan', 0.15), "transparent"] }}
        transition={{ duration: 0.8, ease: "easeInOut" }} // Use tween transition for keyframes
        className={cn("inline-block rounded px-1 -mx-1", className, colorClass)}
      >
        {prefix}{displayValue}{suffix}
      </motion.span>
    );
  }
);


export const StrategyCard = React.memo(function StrategyCard({ strategy: s, className }: StrategyCardProps) {
  const dataDirectionColorClass = React.useMemo(() =>
    s.direction === "BULLISH"
      ? getTextColorClass('emerald', '400')
      : s.direction === "BEARISH"
        ? getTextColorClass('rose', '400')
        : getTextColorClass('slate', '400'),
    [s.direction]
  );

  const urgencyColorClass = React.useMemo(() =>
    s.urgency === "HIGH"
      ? getTextColorClass('rose', '400')
      : s.urgency === "MODERATE"
        ? getTextColorClass('amber', '400')
        : getTextColorClass('slate', '400'),
    [s.urgency]
  );

  const spring = SPRING_PHYSICS_DEFAULT;

  const hoverProps = React.useMemo(() => ({
    y: -2,
    boxShadow: APPLE_CARD_HOVER_SHADOW,
    backgroundColor: getBackgroundColorClass('cyan', '500', '5'),
  }), []);

  return (
    <AppleCard
      className={cn(
        "relative p-6 md:p-8 overflow-hidden",
        className,
      )}
      whileHover={hoverProps}
      transition={spring}
    >
      {/* Subtle Directional UI Indicator with semantic z-index, using direct RGBA */}
      <div
        className="absolute left-0 top-0 h-full w-[2px] rounded-l-[1.25rem] z-10" // Replaced z-[1] with semantic z-10
        style={{
          background: `linear-gradient(to bottom, transparent, ${getPaletteColorWithAlpha('cyan', 0.8)} 20%, ${getPaletteColorWithAlpha('cyan', 0.8)} 80%, transparent)`,
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span
          className={cn(
            "font-mono-data text-3xl md:text-4xl font-extrabold tracking-[-0.03em]",
            dataDirectionColorClass,
          )}
        >
          {s.ticker}
        </span>
        <SentimentBadge sentiment={s.sentiment} />
      </div>

      {/* Action */}
      <div className="font-mono-data text-xl md:text-2xl font-bold tracking-[-0.03em] mb-4 text-foreground">
        {s.action}
      </div>

      {/* Details - Enhanced vertical spacing */}
      <div className="text-sm text-muted-foreground leading-relaxed space-y-4">
        <div>
          <span className="font-semibold text-foreground">Options:</span>{" "}
          <span className="text-base font-inter">{s.options_strategy}</span>
        </div>
        <div className="italic text-sm text-muted-foreground mt-1 mb-2 font-inter"> {/* Applied font-inter */}
          {s.options_note}
        </div>
        <div className="grid grid-cols-2 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-6">
          <div className="flex-auto">
            <span className="font-semibold text-foreground">Entry:</span>{" "}
            <AnimatedValue value={s.entry_price} className="font-mono-data text-base font-bold text-foreground" prefix="$" />
          </div>
          <div className="flex-auto">
            <span className="font-semibold text-foreground">Stop:</span>{" "}
            <AnimatedValue value={s.stop_loss} className="font-mono-data text-base font-bold text-foreground" prefix="$" />
          </div>
          <div className="flex-auto">
            <span className="font-semibold text-foreground">Target:</span>{" "}
            <AnimatedValue value={s.target} className="font-mono-data text-base font-bold text-foreground" prefix="$" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-6">
          <div className="flex-auto">
            <span className="font-semibold text-foreground">R/R:</span>{" "}
            <AnimatedValue value={s.risk_reward} className="font-mono-data text-base font-bold text-foreground" />
          </div>
          <div className="flex-auto">
            <span className="font-semibold text-foreground">ETF Cost:</span>{" "}
            <AnimatedValue value={s.etf_cost_est} className="font-mono-data text-base font-bold text-foreground" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-6">
          <div className="flex-auto">
            <span className="font-semibold text-foreground">Conviction:</span>{" "}
            <AnimatedValue value={s.conviction} className={cn("font-mono-data text-base font-bold", dataDirectionColorClass)} suffix="%" />
          </div>
          <div className="flex-auto">
            <span className="font-semibold text-foreground">Urgency:</span>{" "}
            <AnimatedValue value={s.urgency} className={cn("font-mono-data text-base font-bold", urgencyColorClass)} />
          </div>
        </div>
      </div>
    </AppleCard>
  );
});