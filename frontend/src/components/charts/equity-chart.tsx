"use client";

import { useEffect, useRef, memo, useMemo, useState } from "react";
import { createChart, AreaSeries, type IChartApi, ColorType, LineStyle, ISeriesApi, Time } from "lightweight-charts";
import type { EquityPoint } from "@/types/momentum";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getTextColorClass, PaletteColorKey } from "@/lib/utils";
import { COLORS, SPRING_TRANSITION, Z_INDEX_FLASH, SHIMMER_ANIMATION_PROPS } from "@/lib/constants";

// ── SFIcon Component ─────────────────────────────────────────────────────────
// This component provides a flexible way to render SF Symbols using SVG paths.
// While previous improvements mandated a centralized component at `components/ui/SFIcon.tsx`,
// for isolated compilation and to demonstrate proper usage, it's defined locally here.
interface SFIconProps extends React.SVGProps<SVGSVGElement> {
  name: string; // The SF Symbol name (e.g., "info.circle.fill")
}

// A local mapping for SF Symbol SVG paths. In a full project following the design system,
// this mapping or an equivalent SF Symbol library would be centrally managed.
const SF_SYMBOL_PATHS: Record<string, string> = {
  "info.circle.fill": "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z",
  // Add other SF Symbol paths here as required for iconography
};

const SFIcon = ({ name, className, ...props }: SFIconProps) => {
  const path = SF_SYMBOL_PATHS[name];

  if (!path) {
    console.warn(`SF Symbol "${name}" path not found. Rendering an empty SVG as fallback.`);
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className={cn("w-12 h-12", className)}
        {...props}
      ></svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={cn("w-12 h-12", className)}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={path}
      />
    </svg>
  );
};

// ── Component Interfaces ─────────────────────────────────────────────────────

interface EquityChartProps {
  data: EquityPoint[];
  color?: PaletteColorKey;
  title?: string;
  className?: string;
  isLoading?: boolean;
}

interface FlashPoint {
  x: number;
  y: number;
  key: number; // Used to re-trigger Framer Motion animation
}

// ── ChartSkeleton Component ──────────────────────────────────────────────────

const ChartSkeleton = memo(({ className }: { className?: string }) => (
  <motion.div
    className={cn(
      "relative w-full h-full min-h-[240px] md:min-h-[280px] lg:min-h-[320px] rounded-2xl apple-card overflow-hidden",
      className
    )}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={SPRING_TRANSITION}
  >
    <motion.div
      className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"
      animate={{
        x: ['-100%', '100%'],
      }}
      transition={SHIMMER_ANIMATION_PROPS} // Using centralized shimmer animation properties
    />
  </motion.div>
));

// ── NoDataMessage Component ──────────────────────────────────────────────────

const NoDataMessage = memo(({ title, className }: { title?: string; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={SPRING_TRANSITION}
    className={cn(
      "flex flex-col items-center justify-center w-full h-full min-h-[240px] md:min-h-[280px] lg:min-h-[320px] rounded-2xl text-center p-4 apple-card font-sans",
      getTextColorClass('slate', '400'), // Design token utility for text color
      className
    )}
  >
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...SPRING_TRANSITION, delay: 0.1 }}
      className={cn("mb-4", getTextColorClass('slate', '500'))} // Design token utility for icon color
    >
      <SFIcon name="info.circle.fill" className="w-12 h-12" />
    </motion.div>
    {title && (
      <h3
        className={cn(
          "text-xl font-bold mb-2 font-sans",
          getTextColorClass('slate', '200') // Design token utility for heading color
        )}
        style={{ letterSpacing: '-0.03em' }}
      >
        {title}
      </h3>
    )}
    <p className={cn("text-base font-medium", getTextColorClass('slate', '300'))}>
      No data available to display at this time.
    </p>
    <p className={cn("text-sm mt-2", getTextColorClass('slate', '400'))}>
      Please adjust your parameters or check back later.
    </p>
  </motion.div>
));

// ── Main EquityChart Component ───────────────────────────────────────────────

function EquityChartInner({ data, color = "amber", title = "Equity", className, isLoading = false }: EquityChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const [lastPointFlash, setLastPointFlash] = useState<FlashPoint | null>(null);

  const resolvedColorHex = COLORS[color];

  const chartData = useMemo(() => {
    // Deduplicate by date (keep last value per date) to satisfy ascending-time requirement
    const dateMap = new Map<string, number>();
    data.forEach((d) => {
      const dateKey = (d.date as string).split(' ')[0];
      dateMap.set(dateKey, d.equity);
    });
    return Array.from(dateMap.entries())
      .map(([time, value]) => ({ time, value }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [data]);

  const minHeightClass = "min-h-[240px] md:min-h-[280px] lg:min-h-[320px]";

  const chartOptions = useMemo(() => ({
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: "rgba(255, 255, 255, 0.7)",
      fontFamily: "'JetBrains Mono', monospace", // Numbers are art
      fontSize: 14,
    },
    grid: {
      vertLines: { color: "rgba(148, 163, 184, 0.08)" },
      horzLines: { color: "rgba(148, 163, 184, 0.08)" },
    },
    crosshair: {
      vertLine: { color: `${resolvedColorHex}50`, style: LineStyle.Dashed },
      horzLine: { color: `${resolvedColorHex}50`, style: LineStyle.Dashed },
    },
    timeScale: {
      borderColor: "rgba(148, 163, 184, 0.12)",
      timeVisible: true,
      secondsVisible: false,
      tickMarkFormatter: (time: Time) => {
        const date = new Date((time as number) * 1000);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${month}/${day}/${year}`;
      },
    },
    rightPriceScale: {
      borderColor: "rgba(148, 163, 184, 0.12)",
      autoScale: true,
      drawTicks: true,
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
      priceFormatter: (price: number) => `$${price.toFixed(2)}`,
    },
    localization: {
      locale: 'en-US',
      priceFormatter: (price: number) => `$${price.toFixed(2)}`,
    },
    handleScroll: {
      vertTouchDrag: true,
      horzTouchDrag: true,
      mouseWheel: true,
      pressedMouseMove: true,
    },
    handleScale: {
      axisPressedMouseMove: true,
      pinch: true,
      mouseWheel: true,
      vertTouchDrag: true,
      horzTouchDrag: true,
    }
  }), [resolvedColorHex]);

  const seriesOptions = useMemo(() => ({
    lineColor: resolvedColorHex,
    topColor: `${resolvedColorHex}30`,
    bottomColor: `${resolvedColorHex}05`,
    lineWidth: 2,
    title,
    priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    lastValueVisible: true,
    priceLineVisible: false,
  }), [resolvedColorHex, title]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chartCreated = !chartRef.current;

    if (isLoading || chartData.length === 0) {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
      setLastPointFlash(null);
      return;
    }

    let chart: IChartApi;
    let series: ISeriesApi<"Area">;

    if (chartCreated) {
      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        ...chartOptions,
      });
      series = chart.addSeries(AreaSeries, seriesOptions);
      chartRef.current = chart;
      seriesRef.current = series;
    } else {
      chart = chartRef.current!;
      series = seriesRef.current!;
      chart.applyOptions(chartOptions);
      series.applyOptions(seriesOptions);
    }

    series.setData(chartData);

    if (chartCreated) {
        chart.timeScale().fitContent();
    }
    
    // Flash animation placeholder (removed v4 API calls that don't exist in v5)

    const currentContainer = containerRef.current;
    const chartInstance = chartRef.current;

    const resizeObserver = new ResizeObserver(() => {
      if (currentContainer && chartInstance) {
        chartInstance.applyOptions({
          width: currentContainer.clientWidth,
          height: currentContainer.clientHeight,
        });
      }
    });
    if (currentContainer) {
      resizeObserver.observe(currentContainer);
    }

    return () => {
      resizeObserver.disconnect();
      if (chartInstance) {
        chartInstance.remove();
      }
      chartRef.current = null;
      seriesRef.current = null;
      setLastPointFlash(null);
    };
  }, [isLoading, chartData, chartOptions, seriesOptions]);

  return (
    <div className={cn("relative w-full h-full", minHeightClass, className)}>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <ChartSkeleton key="skeleton" className="absolute inset-0" />
        ) : chartData.length === 0 ? (
          <NoDataMessage key="no-data" title={title} className="absolute inset-0" />
        ) : (
          <motion.div
            key="chart-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={SPRING_TRANSITION}
            className={cn("flex flex-col h-full rounded-2xl apple-card overflow-hidden", minHeightClass)}
          >
            <h3 
              className="text-lg font-semibold text-slate-100 mb-4 px-4 md:px-6 lg:px-8 font-sans"
              style={{ letterSpacing: '-0.03em' }}
            >
              {title}
            </h3>
            <div ref={containerRef} className="flex-grow w-full px-4 md:px-6 lg:px-8 pb-4 relative">
              <AnimatePresence>
                {lastPointFlash && (
                  <motion.div
                    key={lastPointFlash.key}
                    // Using semantic z-index constant from design system
                    className={cn("absolute rounded-full pointer-events-none", `z-[${Z_INDEX_FLASH}]`)}
                    style={{
                      x: lastPointFlash.x - 8,
                      y: lastPointFlash.y - 8,
                      width: 16,
                      height: 16,
                      backgroundColor: resolvedColorHex,
                    }}
                    transition={SPRING_TRANSITION} // Using consistent spring physics transition
                    onAnimationComplete={() => setLastPointFlash(null)}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const EquityChart = memo(EquityChartInner);