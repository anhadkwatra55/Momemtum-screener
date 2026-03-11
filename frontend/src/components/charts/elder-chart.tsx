"use client";

import { useEffect, useRef, memo, useMemo, useCallback } from "react";
import { createChart, HistogramSeries, type IChartApi, ColorType, LineStyle } from "lightweight-charts";
import { COLORS, springTransition } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";

// Helper function to get CSS variable values safely
function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ── SFIcon Component ────────────────────────────────────────────────────────
// This is a simplified internal SFIcon component for demonstration.
// In a full application, this would be a centralized component mapping
// SF Symbol-like names to a comprehensive icon set (e.g., SVG sprites, icon font).
interface SFIconProps extends React.SVGProps<SVGSVGElement> {
  name: string; // e.g., "chart.bar.fill.slash"
  className?: string;
}

const SFIcon = ({ name, className, ...props }: SFIconProps) => {
  if (name === "chart.bar.fill.slash") {
    return (
      <svg
        className={cn("w-12 h-12", className)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <path d="M12 20V10M18 20V4M6 20v-4" />
        <line x1="3" y1="3" x2="21" y2="21" strokeWidth="1.8" />
      </svg>
    );
  }
  return <div className={cn("inline-flex items-center justify-center", className)}>[{name}]</div>;
};

// ── Sub-components for Skeleton and No Data states ──────────────────────────

const ChartSkeleton = memo(() => (
  <motion.div
    key="elder-chart-skeleton"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={springTransition}
    className="relative w-full h-full min-h-[220px] skeleton rounded-2xl"
  />
));

const NoDataPlaceholder = memo(() => (
  <motion.div
    key="elder-chart-no-data"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={springTransition}
    // Apply font-sans here to avoid repetition on children
    className="flex flex-col items-center justify-center text-center text-muted-foreground h-full w-full rounded-2xl p-6 font-sans"
  >
    {/* Using SFIcon for consistent icon system integration */}
    <SFIcon name="chart.bar.fill.slash" className="text-muted-foreground/50 mb-4" />
    <p className="text-base tracking-tight font-medium text-muted-foreground">No historical data yet.</p>
    <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs px-4">
      Data for this chart is currently unavailable. Please check again later.
    </p>
  </motion.div>
));

// ── Main ElderChart Component ───────────────────────────────────────────────

interface ElderChartProps {
  title?: string;
  dates: string[];
  macdHist: number[];
  elderColors: string[];
  className?: string;
  isLoading?: boolean;
}

const CHART_COLOR_MAP: Record<string, string> = {
  Green: COLORS.emerald,
  Red: COLORS.rose,
  Blue: COLORS.blue,
};

function ElderChartInner({ title, dates, macdHist, elderColors, className, isLoading }: ElderChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<HistogramSeries | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const controls = useAnimationControls();

  const chartData = useMemo(() => {
    return dates
      .map((dt, i) => ({
        time: dt,
        value: macdHist[i],
        color: CHART_COLOR_MAP[elderColors[i]] || COLORS.blue,
      }))
      .filter((p) => p.value != null && !isNaN(p.value));
  }, [dates, macdHist, elderColors]);

  const getChartFontSize = useCallback(() => {
    if (typeof window === 'undefined') return 12;
    if (window.innerWidth >= 1024) return 16;
    if (window.innerWidth >= 768) return 14;
    return 12;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const textColor = getCssVar('--muted-foreground') || "#94a3b8";
    const gridAndBorderColor = getCssVar('--border') || "rgba(148, 163, 184, 0.06)";
    const primaryAccentColor = COLORS.cyan;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: textColor,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: getChartFontSize(),
        paddingTop: 16,
        paddingBottom: 16,
      },
      grid: {
        vertLines: { color: gridAndBorderColor },
        horzLines: { color: gridAndBorderColor },
      },
      crosshair: {
        vertLine: { color: `${primaryAccentColor}4D`, style: LineStyle.Dashed },
        horzLine: { color: `${primaryAccentColor}4D`, style: LineStyle.Dashed },
      },
      timeScale: {
        borderColor: gridAndBorderColor,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: unknown) => {
          const date = typeof time === 'string' ? new Date(time + 'T00:00:00') : new Date((time as number) * 1000);
          if (isNaN(date.getTime())) return '';
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        },
        rightOffset: 2,
      },
      rightPriceScale: {
        borderColor: gridAndBorderColor,
        entireTextOnly: true,
        scaleMargins: {
          top: 0.15,
          bottom: 0.15,
        },
      },
    });
    chartRef.current = chart;

    const series = chart.addSeries(HistogramSeries, {
      priceScaleId: "right",
      base: 0,
    });
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
          layout: {
            fontSize: getChartFontSize(),
          }
        });
      }
    });
    ro.observe(containerRef.current);
    resizeObserverRef.current = ro;

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
      }
      chartRef.current = null;
      seriesRef.current = null;
      resizeObserverRef.current = null;
    };
  }, [getChartFontSize]);

  useEffect(() => {
    if (seriesRef.current && chartData.length > 0) {
      seriesRef.current.setData(chartData);
      chartRef.current?.timeScale().fitContent();
      controls.start("flash");
    }
  }, [chartData, controls]);

  const wrapperClasses = cn(
    "apple-card relative flex flex-col p-4 md:p-6",
    className
  );

  const wrapperVariants = useMemo(() => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    // Subtle data pulse shadow using primary accent color with opacity
    flash: {
      boxShadow: ['var(--shadow-card)', `0 0 0 2px ${COLORS.cyan}4D, var(--shadow-card)`, 'var(--shadow-card)'], 
      transition: {
        boxShadow: {
          duration: 0.12,
          ease: "easeOut"
        }
      }
    },
  }), []);

  return (
    <motion.div
      variants={wrapperVariants}
      initial="initial"
      animate="animate"
      transition={springTransition}
      className={wrapperClasses}
    >
      {title && (
        <h2 className="mb-4 text-lg sm:text-xl font-bold tracking-tight text-foreground font-sans">
          {title}
        </h2>
      )}

      <AnimatePresence mode="wait">
        {isLoading ? (
          <ChartSkeleton key="loading" />
        ) : chartData.length === 0 ? (
          <div className="flex-grow flex items-center justify-center min-h-[220px]">
            <NoDataPlaceholder key="no-data" />
          </div>
        ) : (
          <motion.div
            key="chart-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={springTransition}
            ref={containerRef}
            className="w-full h-full min-h-[220px] flex-grow overflow-hidden"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const ElderChart = memo(ElderChartInner);