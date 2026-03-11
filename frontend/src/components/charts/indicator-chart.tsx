"use client";

import { useEffect, useRef, memo, useMemo, useState, useCallback } from "react";
import { createChart, LineSeries, type IChartApi, ColorType, LineStyle, CrosshairMode, ISeriesApi, PriceLineOptions } from "lightweight-charts";
import { cn } from "@/lib/utils";
import { COLORS, FRAMER_MOTION_SPRING_TRANSITION, INTERNAL_SERIES_ID_HORIZONTAL_LINES } from "@/lib/constants";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";

import { SFIcon } from "@/components/ui/SFIcon";


// Helper function to get CSS variable values for lightweight-charts
const getCssVariable = (name: string) => {
  if (typeof window === "undefined") return ""; // Server-side check
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!value) {
      // For a premium experience, silently fallback in production, warn in development for configuration issues
      if (process.env.NODE_ENV === 'development') {
        console.warn(`CSS variable '${name}' is empty or not found. Falling back to default.`);
      }
      return "";
    }
    return value;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Failed to get CSS variable '${name}':`, error);
    }
    return "";
  }
};

/**
 * @interface DataLine
 * Represents a single line series in the indicator chart.
 * @property {string} label - The label for this line, displayed in the legend.
 * @property {(number | null)[]} data - Array of data points for the line. Null values create gaps.
 * @property {string} color - The color of the line. Should be one of the `COLORS` from `lib/constants.ts` (e.g., `COLORS.cyan`).
 * @property {number} [width=1.5] - The width of the line. Recommended values for premium design are 1, 1.5, 2.
 * @property {boolean} [dash=false] - If true, the line will be dashed.
 */
interface DataLine {
  label: string;
  data: (number | null)[];
  color: string;
  width?: number;
  dash?: boolean;
}

/**
 * @interface HorizontalLine
 * Represents a horizontal reference line in the indicator chart.
 * @property {number} value - The price value at which the horizontal line should be drawn.
 * @property {string} color - The color of the horizontal line. Should be one of the `COLORS` from `lib/constants.ts` (e.g., `COLORS.rose`).
 * @property {string} [label] - An optional label to display on the price scale next to the line.
 */
interface HorizontalLine {
  value: number;
  color: string;
  label?: string;
}

/**
 * @interface IndicatorChartProps
 * Props for the IndicatorChart component.
 * @property {string} title - The title of the chart, displayed prominently.
 * @property {string[]} dates - Array of date strings (e.g., 'YYYY-MM-DD') for the time axis.
 * @property {DataLine[]} lines - Array of data lines to be displayed.
 *   Note: For performance, ensure `lines` is memoized in the parent component using `useMemo`
 *   to prevent unnecessary chart re-initializations if its content is not deeply immutable.
 * @property {HorizontalLine[]} [horizontalLines] - Optional array of horizontal reference lines.
 *   Note: For performance, ensure `horizontalLines` is memoized in the parent component using `useMemo`
 *   to prevent unnecessary chart re-initializations if its content is not deeply immutable.
 * @property {string} [className] - Optional Tailwind CSS class names for the chart container.
 * @property {boolean} [isLoading=false] - If true, displays a skeleton loader.
 */
interface IndicatorChartProps {
  title: string;
  dates: string[];
  lines: DataLine[];
  horizontalLines?: HorizontalLine[];
  className?: string;
  isLoading?: boolean;
}

// Skeleton component for the chart
const ChartSkeleton = memo(() => (
  <div className="flex flex-col gap-3 p-6 w-full h-full">
    {/* Title skeleton */}
    <div className="h-6 w-1/3 skeleton rounded-md" />
    {/* Chart area skeleton - Standardized rounded corners to match `apple-card` */}
    <div className="flex-1 w-full h-full min-h-[220px] skeleton rounded-xl" />
  </div>
));
ChartSkeleton.displayName = "ChartSkeleton";


function IndicatorChartInner({
  title,
  dates,
  lines,
  horizontalLines,
  className,
  isLoading = false,
}: IndicatorChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<"Line">>>(new Map()); // To manage series APIs by label
  const flashControls = useAnimationControls(); // For real-time data flash animation

  // Memoize chart options that rely on CSS variables for stability and performance
  const chartOptions = useMemo(() => {
    // Dynamically fetch theme colors from CSS variables for full theme integration
    const textColor = getCssVariable("--muted-foreground") || "#94a3b8";
    const gridLineColor = getCssVariable("--border") || "rgba(148, 163, 184, 0.06)";
    const scaleBorderColor = getCssVariable("--border") || "rgba(148, 163, 184, 0.06)";
    const crosshairColor = COLORS.cyan;

    return {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" }, // Transparent to show underlying `apple-card` background
        textColor: textColor,
        fontFamily: "var(--font-sans), sans-serif", // Inter for general UI text
        fontSize: 12,
      },
      grid: {
        vertLines: { color: gridLineColor },
        horzLines: { color: gridLineColor },
      },
      crosshair: {
        mode: CrosshairMode.Magnet, // Precise crosshair for trading data interaction
        vertLine: { color: crosshairColor, width: 1, style: LineStyle.Dashed, labelVisible: false },
        horzLine: { color: crosshairColor, width: 1, style: LineStyle.Dashed, labelVisible: false },
      },
      timeScale: {
        borderColor: scaleBorderColor,
        timeVisible: true,
        secondsVisible: false,
        minBarSpacing: 0.1,
        axisLabelVisible: true,
        borderVisible: false, // Minimal borders, Apple design philosophy
        tickMarkVisible: false, // Hide minor ticks for cleaner display
        uniformLocalize: false, // Allows flexible label formatting
        barSpacing: 2.5, // Denser bar spacing for information-heavy charts
        rightOffset: 2, // Small offset for visual breathing room
        axisLabelLayout: {
          fontFamily: "var(--font-mono), monospace", // JetBrains Mono for numeric time labels
        },
      },
      rightPriceScale: {
        borderColor: scaleBorderColor,
        autoScale: true,
        entireTextOnly: true, // Prevents partial labels, ensuring a cleaner look
        visible: true,
        borderVisible: false, // Minimal borders
        tickMarkVisible: false, // Hide minor ticks
        axisLabelLayout: {
          fontFamily: "var(--font-mono), monospace", // JetBrains Mono for numeric price labels
        },
      },
      localization: {
        locale: 'en-US', // Ensures consistent number formatting
      },
    };
  }, []);

  // Function to trigger the Framer Motion flash animation for real-time data updates
  const triggerFlashAnimation = useCallback(() => {
    flashControls.start({
      boxShadow: `0 0 10px 2px ${COLORS.cyan}40`, // Subtle cyan glow
      transition: { duration: 0.1, ease: "easeOut" }
    });
    flashControls.start({
      boxShadow: `0 0 0px 0px ${COLORS.cyan}00`, // Transparent shadow, reverting after a short delay
      transition: { duration: 0.4, ease: "easeIn", delay: 0.1 }
    });
  }, [flashControls]);


  // Function to create or update series and horizontal lines
  const updateChartContent = useCallback((chart: IChartApi) => {
    const newSeriesMap = new Map<string, ISeriesApi<"Line">>();

    lines.forEach((line) => {
      let series = seriesRefs.current.get(line.label);

      if (!series) {
        // If series doesn't exist, create it with specified options
        series = chart.addSeries(LineSeries, {
          color: line.color,
          lineWidth: line.width || 1.5,
          title: line.label,
          priceScaleId: "right",
          lineStyle: line.dash ? LineStyle.Dashed : LineStyle.Solid,
        });
        seriesRefs.current.set(line.label, series);
      } else {
        // If series exists, update its options (e.g., color, width, style)
        series.applyOptions({
          color: line.color,
          lineWidth: line.width || 1.5,
          lineStyle: line.dash ? LineStyle.Dashed : LineStyle.Solid,
        });
      }

      // Format data with date strings for the time axis
      const formattedData = dates
        .map((dt, i) => ({ time: dt as string, value: line.data[i] }))
        .filter((p) => p.value != null && !isNaN(p.value));

      series.setData(formattedData); // Update data for the series
      newSeriesMap.set(line.label, series);
    });

    // Remove any series that are no longer present in the `lines` prop
    seriesRefs.current.forEach((series, label) => {
      // Exclude the dedicated horizontal lines series and currently active series from removal
      if (!newSeriesMap.has(label) && label !== INTERNAL_SERIES_ID_HORIZONTAL_LINES) {
        chart.removeSeries(series);
        seriesRefs.current.delete(label);
      }
    });

    // Manage horizontal reference lines using an invisible series to host price lines
    // Remove old horizontal lines series and create a fresh one
    let priceLineSeries = seriesRefs.current.get(INTERNAL_SERIES_ID_HORIZONTAL_LINES);
    if (priceLineSeries) {
        chart.removeSeries(priceLineSeries);
        seriesRefs.current.delete(INTERNAL_SERIES_ID_HORIZONTAL_LINES);
    }
    priceLineSeries = chart.addSeries(LineSeries, {
        visible: false,
        priceScaleId: "right",
    });
    seriesRefs.current.set(INTERNAL_SERIES_ID_HORIZONTAL_LINES, priceLineSeries);

    horizontalLines?.forEach((hl) => {
      // Fetch --radius-sm for consistent rounded corners on labels
      const radiusSm = parseInt(getCssVariable("--radius-sm")) || 8;
      const priceLineOptions: PriceLineOptions = {
          price: hl.value,
          color: hl.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: hl.label || '',
          axisLabelTextColor: hl.color,
          axisLabelBackgroundColor: getCssVariable("--card") || COLORS.card,
          axisLabelBorderRadius: radiusSm,
      };
      priceLineSeries?.createPriceLine(priceLineOptions);
    });

    chart.timeScale().fitContent(); // Adjust time scale to fit all data points
    triggerFlashAnimation(); // Trigger Framer Motion flash animation on data update
  }, [dates, lines, horizontalLines, triggerFlashAnimation]); // Dependencies for `useCallback`

  useEffect(() => {
    // If loading or container reference is not available, ensure chart is cleaned up
    if (isLoading || !containerRef.current) {
        chartRef.current?.remove();
        chartRef.current = null;
        seriesRefs.current.clear(); // Also clear series references
        return;
    }

    let chart: IChartApi;
    // Create chart if it doesn't exist, otherwise apply new options to the existing chart
    if (chartRef.current) {
        chart = chartRef.current;
        chart.applyOptions(chartOptions);
    } else {
        chart = createChart(containerRef.current, chartOptions);
        chartRef.current = chart;
    }

    updateChartContent(chart);

    // Resize observer to dynamically adjust chart dimensions to its container
    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    });
    ro.observe(containerRef.current);

    // Cleanup function: disconnect observer and remove chart on component unmount or dependency change
    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRefs.current.clear();
      }
    };
  }, [isLoading, chartOptions, updateChartContent]); // Dependencies for effect re-run

  // Determine if "No data" message should be displayed
  const hasData = dates.length > 0 && lines.some(line => line.data.length > 0);
  const showNoData = !isLoading && !hasData;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Chart Title: Bold typography, clear hierarchy (SF Pro weights, tight tracking) */}
      <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-4 font-sans tracking-[-0.03em]">
        {title}
      </h3>
      <div className="flex-1 min-h-[220px] relative w-full h-full">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FRAMER_MOTION_SPRING_TRANSITION}
              className="absolute inset-0 flex items-center justify-center apple-card p-0 overflow-hidden" // `apple-card` applies glassmorphic styling and rounded corners
            >
              <ChartSkeleton />
            </motion.div>
          ) : showNoData ? (
            <motion.div
              key="no-data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FRAMER_MOTION_SPRING_TRANSITION}
              // `apple-card` for consistent styling, `rounded-xl` for consistent corners
              className="absolute inset-0 flex flex-col items-center justify-center apple-card text-muted-foreground text-base p-6 rounded-xl gap-3"
            >
              <SFIcon name="chart.line.uptrend.rectangle.slash" className="text-muted-foreground/60" />
              <p className="font-sans text-lg font-medium text-muted-foreground">
                No data available for this period.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="chart"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={FRAMER_MOTION_SPRING_TRANSITION}
              className="w-full h-full apple-card p-0 overflow-hidden"
              whileTap={{ scale: 0.99 }}
            >
              {/* This inner div is the target for Lightweight Charts' canvas, with responsive internal padding */}
              <div
                ref={containerRef}
                className="w-full h-full p-4 md:p-6 lg:p-7"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export const IndicatorChart = memo(IndicatorChartInner);