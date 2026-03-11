import { cn, getBackgroundColorClass, getTextColorClass, getHoverAccentShadow } from "@/lib/utils";
import { RegimeBadge } from "./regime-badge";
import type { SectorRegime, SectorSentiment } from "@/types/momentum";
import { motion } from "framer-motion";
import React from "react";
import { SPRING_TRANSITION, STAGGER_CHILDREN_DELAY_MS, HEADING_LETTER_SPACING, UPPERCASE_LETTER_SPACING, DEFAULT_ACCENT_COLOR } from "@/lib/constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SectorHeatmapProps {
  sectors: Record<string, SectorRegime>;
  sentiment: Record<string, SectorSentiment>;
  className?: string;
  onSectorClick?: (sectorName: string) => void;
  isLoading?: boolean;
}

const SectorHeatmapSkeleton = React.memo(() => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
      {Array.from({ length: 8 }).map((_, index) => (
        <motion.div
          key={index}
          className={cn(
            "relative flex flex-col justify-between overflow-hidden",
            "apple-card",
            getBackgroundColorClass('slate', '800', '40'),
            "p-4 sm:p-5 h-[200px] animate-pulse-slow-fade"
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_TRANSITION, delay: index * (STAGGER_CHILDREN_DELAY_MS / 1000) }}
        >
          <div className="flex flex-col items-center justify-center text-center">
            <div className={cn("h-6 w-3/4 rounded-md mb-3", getBackgroundColorClass('slate', '700', '50'))} />
            <div className={cn("h-5 w-1/3 rounded-full mb-4", getBackgroundColorClass('slate', '700', '50'))} />
          </div>

          <div className={cn("flex h-2 rounded-full overflow-hidden mb-4", getBackgroundColorClass('slate', '700', '50'))} />

          <div className="grid grid-cols-3 text-center gap-x-2">
            <div>
              <div className={cn("h-3 w-1/2 mx-auto rounded-full mb-1", getBackgroundColorClass('slate', '700', '50'))} />
              <div className={cn("h-5 w-2/3 mx-auto rounded-md", getBackgroundColorClass('slate', '700', '50'))} />
            </div>
            <div>
              <div className={cn("h-3 w-1/2 mx-auto rounded-full mb-1", getBackgroundColorClass('slate', '700', '50'))} />
              <div className={cn("h-5 w-2/3 mx-auto rounded-md", getBackgroundColorClass('slate', '700', '50'))} />
            </div>
            <div>
              <div className={cn("h-3 w-1/2 mx-auto rounded-full mb-1", getBackgroundColorClass('slate', '700', '50'))} />
              <div className={cn("h-5 w-2/3 mx-auto rounded-md", getBackgroundColorClass('slate', '700', '50'))} />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
});

const SectorHeatmapComponent = React.memo(
  ({ sectors, sentiment, className, onSectorClick, isLoading }: SectorHeatmapProps) => {
    if (isLoading || Object.keys(sectors).length === 0) {
      return <SectorHeatmapSkeleton />;
    }

    return (
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", "gap-3 sm:gap-5 lg:gap-6", className)}>
        {Object.entries(sectors).map(([name, regime], index) => {
          const s = sentiment[name] || { bullish: 0, bearish: 0, neutral: 0 };
          const totalSentimentPoints = s.bullish + s.bearish + s.neutral;
          const hasSentimentData = totalSentimentPoints > 0;

          const bullPct = hasSentimentData ? (s.bullish / totalSentimentPoints) * 100 : 0;
          const bearPct = hasSentimentData ? (s.bearish / totalSentimentPoints) * 100 : 0;
          const neutPct = hasSentimentData ? (s.neutral / totalSentimentPoints) * 100 : 100;

          const hasAura = regime.regime === "Trending" && regime.avg_composite > 0.1;

          return (
            <motion.button
              key={name}
              type="button"
              className={cn(
                "relative flex flex-col justify-between overflow-hidden",
                "apple-card",
                "p-4 sm:p-5",
                "w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_TRANSITION, delay: index * (STAGGER_CHILDREN_DELAY_MS / 1000) }}
              whileHover={{
                y: -4,
                boxShadow: getHoverAccentShadow(DEFAULT_ACCENT_COLOR),
              }}
              onClick={() => onSectorClick?.(name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSectorClick?.(name);
                }
              }}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={cn("text-xl sm:text-2xl font-bold text-slate-50 leading-tight", `tracking-[${HEADING_LETTER_SPACING}]`)}>
                    {name}
                  </h3>
                  {hasAura && (
                    <span className={cn(
                      "text-xs px-1.5 py-[0.1rem] rounded-full font-mono-data font-medium",
                      `tracking-[${UPPERCASE_LETTER_SPACING}] uppercase whitespace-nowrap`,
                      getTextColorClass(DEFAULT_ACCENT_COLOR, '400'),
                      getBackgroundColorClass(DEFAULT_ACCENT_COLOR, '500', '10')
                    )}>
                      ∞ AURA
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <RegimeBadge regime={regime.regime} />
                </div>
              </div>

              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex h-2 rounded-full overflow-hidden mb-4 relative",
                      hasSentimentData ? getBackgroundColorClass('slate', '900') : getBackgroundColorClass('slate', '800', '60')
                    )}>
                      {hasSentimentData ? (
                        <>
                          <div style={{ width: `${bullPct}%` }} className={cn("h-full", getBackgroundColorClass('emerald'))} />
                          <div style={{ width: `${neutPct}%` }} className={cn("h-full", getBackgroundColorClass('slate'))} />
                          <div style={{ width: `${bearPct}%` }} className={cn("h-full", getBackgroundColorClass('rose'))} />
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 font-medium">
                          N/A
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  {!hasSentimentData && (
                    <TooltipContent className="text-sm text-slate-200 bg-card border-none shadow-lg backdrop-blur-md">
                      No sentiment data available for this sector.
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              <div className="grid grid-cols-3 text-center gap-x-2">
                <div>
                  <div className={cn("text-xs text-slate-400 uppercase mb-1", `tracking-[${UPPERCASE_LETTER_SPACING}]`)}>Score</div>
                  <div className={cn("text-base sm:text-lg font-bold font-mono-data", getTextColorClass(DEFAULT_ACCENT_COLOR))}>
                    {regime.avg_composite.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className={cn("text-xs text-slate-400 uppercase mb-1", `tracking-[${UPPERCASE_LETTER_SPACING}]`)}>Prob</div>
                  <div className={cn("text-base sm:text-lg font-bold font-mono-data", getTextColorClass(DEFAULT_ACCENT_COLOR))}>
                    {regime.avg_probability.toFixed(0)}%
                  </div>
                </div>
                <div>
                  <div className={cn("text-xs text-slate-400 uppercase mb-1", `tracking-[${UPPERCASE_LETTER_SPACING}]`)}>Tickers</div>
                  <div className="text-base sm:text-lg font-bold text-slate-50 font-mono-data">
                    {regime.count}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    );
  }
);

export const SectorHeatmap = SectorHeatmapComponent;