"use client";

/**
 * PriceChart — TradingView Lightweight Charts wrapper for price + overlays
 * Compatible with lightweight-charts v5.1
 *
 * Implemented with Apple-class design principles:
 * - Glassmorphic card container with backdrop-blur and subtle shadow depth.
 * - Framer Motion for smooth entry and hover animations.
 * - JetBrains Mono for numeric scales, Inter for general text.
 * - Minimalist grid lines and borders.
 * - Uses constants for colors and styling for consistency.
 * - Handles loading states with a dedicated skeleton loader and premium empty state.
 * - Optimized for performance with incremental series updates and memoization.
 * - Responsive layout.
 * - Real-time updates with subtle flash animation for latest price changes.
 */

import { useEffect, useRef, memo, useState, useCallback, useMemo } from "react";
import { createChart, LineSeries, type IChartApi, ColorType, LineStyle, CrosshairMode, TickMarkType } from "lightweight-charts";
import type { TickerChartData } from "@/types/momentum";
import { cn, getColorWithAlpha } from "@/lib/utils";
import { COLORS, SPRING_PHYSICS_DEFAULT, DATA_UPDATE_FLASH_TRANSITION, COMMON_HOVER_SHADOW, CTA_GLOW_SHADOW, CHART_MIN_HEIGHT } from "@/lib/constants"; // Import CHART_MIN_HEIGHT
import { motion } from "framer-motion";
import { SFIcon } from "@/components/ui/sf-icon";

// --- Sub-component for skeleton loading state ---
const ChartSkeleton = memo(() => (
  <div className="flex h-full w-full animate-pulse flex-col gap-4 rounded-2xl bg-muted/20 p-4 md:p-6 lg:p-8"> {/* Responsive padding */}
    <div className="h-4 w-1/4 rounded-xl bg-muted/30" />
    <div className="h-full w-full rounded-xl bg-muted/20" />
  </div>
));

// --- Sub-component for premium empty state ---
const ChartEmptyState = memo(({ ticker }: { ticker?: string }) => (
  <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
    <SFIcon name="chart.line.uptrend.rectangle.fill" size={48} className="text-cyan-500" />
    <h4 className="mt-4 text-lg font-semibold text-foreground" style={{ letterSpacing: '-0.03em' }}>
      No Data Available {ticker && `for ${ticker}`}
    </h4>
    <p className="mt-2 text-sm max-w-xs leading-relaxed text-slate-400">
      We couldn't retrieve price data for this ticker. Please try again later or select another asset.
    </p>
  </div>
));

interface PriceChartProps {
  ticker: string;
  data: TickerChartData | null; // Allow null for loading state
  className?: string;
  isLoading?: boolean; // Explicit loading state management
}

function PriceChartInner({ ticker, data, className, isLoading }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<{ price?: ReturnType<IChartApi['addSeries']>; hma?: ReturnType<IChartApi['addSeries']> }>({});

  const [isFlashing, setIsFlashing] = useState(false);
  const latestKnownPriceValue = useRef<number | null>(null);

  // Memoize chart options for efficiency and consistent styling
  const chartOptions = useCallback(() => ({
    layout: {
      background: { type: ColorType.Solid, color: "transparent" }, // Allow apple-card blur to show through
      textColor: getColorWithAlpha('slate', 0.8), // Muted foreground for chart labels
      fontFamily: "Inter, sans-serif", // General UI text font
      fontSize: 12,
    },
    grid: {
      vertLines: { color: getColorWithAlpha('slate', 0.03) }, // Very subtle vertical grid
      horzLines: { color: getColorWithAlpha('slate', 0.03) }, // Very subtle horizontal grid
    },
    crosshair: {
      mode: CrosshairMode.Magnet, // Snap crosshair to data points
      vertLine: { 
        color: COLORS.cyan, 
        width: 1, 
        style: LineStyle.Dashed, 
        labelBackgroundColor: COLORS.cyan 
      },
      horzLine: { 
        color: COLORS.cyan, 
        width: 1, 
        style: LineStyle.Dashed, 
        labelBackgroundColor: COLORS.cyan 
      },
    },
    timeScale: {
      timeVisible: true, // Always show time for clear context
      secondsVisible: false, // No seconds in tick marks
      rightOffset: 2, // Small offset from right edge for readability
      barSpacing: 6, // Good spacing for data points
      tickMarkFormatter: (time: unknown, tickMarkType: TickMarkType) => {
        // Dates from API are strings like '2025-03-10'; parse them directly
        const date = typeof time === 'string' ? new Date(time + 'T00:00:00') : new Date((time as number) * 1000);
        if (isNaN(date.getTime())) return '';
        if (tickMarkType === TickMarkType.Major) {
          return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        }
        return date.toLocaleDateString('en-US', { day: 'numeric' });
      },
      // Use JetBrains Mono for time scale labels (numbers as art)
      uniformLocalTextChr: ' ', // Forces consistent char width for monospace font
      borderVisible: false, // Rely on internal grid or general layout borders
      lockVisibleTimeRangeOnResize: true, // Maintain visible range on resize
      fontSize: 12, // Default size
      fontFamily: `var(--font-mono), Inter, sans-serif`, // Use JetBrains Mono from CSS variable
    },
    rightPriceScale: {
      visible: true,
      entireTextOnly: true, // Only show integer prices on the scale
      alignLabels: true,
      // Use JetBrains Mono for price scale labels (numbers as art)
      uniformLocalTextChr: ' ',
      borderVisible: false, // Rely on internal grid or general layout borders
      autoScale: true,
      fontSize: 12, // Default size
      fontFamily: `var(--font-mono), Inter, sans-serif`, // Use JetBrains Mono from CSS variable
    },
    handleScroll: {
      vertTouchDrag: true,
      horzTouchDrag: true,
      mouseWheel: true,
      pressedMouseMove: true,
    },
    handleScale: {
      axisDoubleClick: true,
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
    trackingMode: {
      exitMode: CrosshairMode.Exit, // Crosshair hides when mouse leaves
    }
  }), []);

  // Memoize series options for efficiency and consistent styling
  const seriesOptions = useCallback(() => ({
    price: {
      color: COLORS.cyan,
      lineWidth: 2,
      priceScaleId: "right",
      title: ticker, // Dynamic series title
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineSource: 0, // Last visible bar
      lineStyle: LineStyle.Solid,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: COLORS.cyan,
      crosshairMarkerBackgroundColor: COLORS.cyan,
    },
    hma: {
      color: COLORS.amber,
      lineWidth: 1.5, // Slightly thicker for clarity
      lineStyle: LineStyle.Dashed,
      priceScaleId: "right",
      title: "HMA",
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineSource: 0,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: COLORS.amber,
      crosshairMarkerBackgroundColor: COLORS.amber,
    }
  }), [ticker]);

  useEffect(() => {
    if (!containerRef.current) {
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRefs.current = {};
      return;
    }

    const currentContainer = containerRef.current;
    
    const chartExists = !!chartRef.current;
    const previousTicker = seriesRefs.current.price?.options().title;
    const tickerChanged = chartExists && previousTicker !== ticker;

    if (!chartExists || tickerChanged) {
      chartRef.current?.remove();
      const chart = createChart(currentContainer, {
        width: currentContainer.clientWidth,
        height: currentContainer.clientHeight,
        ...chartOptions(),
      });
      chartRef.current = chart;

      seriesRefs.current.price = chart.addSeries(LineSeries, seriesOptions().price);
      if (data?.hma?.length) {
        seriesRefs.current.hma = chart.addSeries(LineSeries, seriesOptions().hma);
      } else {
        seriesRefs.current.hma = undefined;
      }
    } else {
      chartRef.current.applyOptions(chartOptions());
      seriesRefs.current.price?.applyOptions(seriesOptions().price);
      seriesRefs.current.hma?.applyOptions(seriesOptions().hma);
    }

    // Update Series Data
    const newPriceData = data?.dates.map((d, i) => ({
      time: d,
      value: data.close[i],
    })) || [];

    // Trigger flash animation if the latest price value has changed
    if (newPriceData.length > 0) {
      const currentLatestPrice = newPriceData[newPriceData.length - 1].value;
      if (latestKnownPriceValue.current !== null && latestKnownPriceValue.current !== currentLatestPrice) {
        setIsFlashing(true);
      }
      latestKnownPriceValue.current = currentLatestPrice;
    } else {
      latestKnownPriceValue.current = null; // Reset if no data
    }
    
    seriesRefs.current.price?.setData(newPriceData);

    if (data?.hma?.length) {
      const hmaData = data.dates
        .map((d, i) => ({
          time: d,
          value: data.hma[i],
        }))
        .filter((p) => p.value != null && !isNaN(p.value));

      if (seriesRefs.current.hma) {
        seriesRefs.current.hma.setData(hmaData);
      } else if (chartRef.current) {
        seriesRefs.current.hma = chartRef.current.addSeries(LineSeries, seriesOptions().hma);
        seriesRefs.current.hma.setData(hmaData);
      }
    } else if (seriesRefs.current.hma && chartRef.current) {
      chartRef.current.removeSeries(seriesRefs.current.hma);
      seriesRefs.current.hma = undefined;
    }

    chartRef.current?.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      if (currentContainer && chartRef.current) {
        chartRef.current.applyOptions({
          width: currentContainer.clientWidth,
          height: currentContainer.clientHeight,
        });
      }
    });
    resizeObserver.observe(currentContainer);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRefs.current = {};
      }
    };
  }, [ticker, data, chartOptions, seriesOptions]);

  // Framer Motion variants for the main container
  const containerVariants = useMemo(() => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    hover: {
      y: -2,
      boxShadow: `${COMMON_HOVER_SHADOW}, ${CTA_GLOW_SHADOW}`, // Combine elevated shadow with cyan glow
    },
    // Subtle flash animation on data update (assumes COLORS.card is rgba and DATA_UPDATE_FLASH_TRANSITION is defined for backgroundColor)
    flash: {
      backgroundColor: [
        COLORS.card, // Current card background color (e.g., rgba(15,23,42,0.45))
        getColorWithAlpha('cyan', 0.08), // Brief subtle cyan tint (e.g., rgba(6, 182, 212, 0.08))
        COLORS.card
      ],
      transition: DATA_UPDATE_FLASH_TRANSITION,
    }
  }), []);

  // Render skeleton if loading
  if (isLoading) {
    return (
      <motion.div
        initial="initial"
        animate="animate"
        transition={{ ...SPRING_PHYSICS_DEFAULT, delay: 0.1 }}
        className={cn("h-full w-full", className)}
      >
        <ChartSkeleton />
      </motion.div>
    );
  }

  // Render empty state if no data after loading
  if (!data || data.dates.length === 0) {
    return (
      <motion.div
        initial="initial"
        animate="animate"
        transition={{ ...SPRING_PHYSICS_DEFAULT, delay: 0.1 }}
        className={cn("apple-card h-full w-full", className)} // Ensure apple-card styling for empty state container
      >
        <ChartEmptyState ticker={ticker} />
      </motion.div>
    );
  }

  // Render the actual chart
  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate={isFlashing ? "flash" : "animate"}
      whileHover="hover"
      onAnimationComplete={() => isFlashing && setIsFlashing(false)}
      transition={{ ...SPRING_PHYSICS_DEFAULT, delay: 0.1 }}
      className={cn(
        "relative apple-card h-full w-full p-4 md:p-6 lg:p-8 flex flex-col justify-between overflow-hidden",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 px-2 md:px-0 z-10">
        <h3 className="text-lg md:text-xl font-bold text-foreground" style={{ letterSpacing: '-0.03em' }}>
          Price Performance for {ticker}
        </h3>
        <span className="text-xs text-muted-foreground font-mono-data text-slate-400">
          {data.dates.length > 0 ? 
            `${new Date(data.dates[0] + 'T00:00:00').toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' })} - ${new Date(data.dates[data.dates.length - 1] + 'T00:00:00').toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' })}` 
            : ''}
        </span>
      </div>
      <div ref={containerRef} className={cn("w-full flex-grow z-10", `min-h-[${CHART_MIN_HEIGHT}]`)} />
    </motion.div>
  );
}

export const PriceChart = memo(PriceChartInner);