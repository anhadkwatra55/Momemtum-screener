"use client";

/**
 * CandlestickChart — lightweight-charts CandlestickSeries for OHLC data
 * Matches the Apple-class design of PriceChart
 */

import { useEffect, useRef, memo, useMemo, useCallback } from "react";
import { createChart, CandlestickSeries, type IChartApi, ColorType, LineStyle, CrosshairMode, TickMarkType } from "lightweight-charts";
import { cn, getColorWithAlpha } from "@/lib/utils";
import { COLORS, SPRING_PHYSICS_DEFAULT, CHART_MIN_HEIGHT } from "@/lib/constants";
import { motion } from "framer-motion";
import { SFIcon } from "@/components/ui/sf-icon";

interface CandlestickChartProps {
  ticker: string;
  data: {
    dates: string[];
    open: (number | null)[];
    high: (number | null)[];
    low: (number | null)[];
    close: (number | null)[];
  } | null;
  className?: string;
  isLoading?: boolean;
}

const ChartSkeleton = memo(() => (
  <div className="flex h-full w-full animate-pulse flex-col gap-4 rounded-xl bg-muted/20 p-4">
    <div className="h-4 w-1/3 rounded-lg bg-muted/30" />
    <div className="h-full w-full rounded-lg bg-muted/20" />
  </div>
));
ChartSkeleton.displayName = "CandlestickSkeleton";

function CandlestickChartInner({ ticker, data, className, isLoading }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi['addSeries']> | null>(null);

  const chartOptions = useCallback(() => ({
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: getColorWithAlpha('slate', 0.8),
      fontFamily: "Inter, sans-serif",
      fontSize: 11,
    },
    grid: {
      vertLines: { color: getColorWithAlpha('slate', 0.03) },
      horzLines: { color: getColorWithAlpha('slate', 0.03) },
    },
    crosshair: {
      mode: CrosshairMode.Magnet,
      vertLine: { color: COLORS.cyan, width: 1, style: LineStyle.Dashed, labelBackgroundColor: COLORS.cyan },
      horzLine: { color: COLORS.cyan, width: 1, style: LineStyle.Dashed, labelBackgroundColor: COLORS.cyan },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 2,
      barSpacing: 6,
      tickMarkFormatter: (time: unknown, tickMarkType: TickMarkType) => {
        const date = typeof time === 'string' ? new Date(time + 'T00:00:00') : new Date((time as number) * 1000);
        if (isNaN(date.getTime())) return '';
        if (tickMarkType === TickMarkType.Major) {
          return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        }
        return date.toLocaleDateString('en-US', { day: 'numeric' });
      },
      borderVisible: false,
      lockVisibleTimeRangeOnResize: true,
      fontSize: 11,
      fontFamily: `var(--font-mono), Inter, sans-serif`,
    },
    rightPriceScale: {
      visible: true,
      entireTextOnly: true,
      alignLabels: true,
      borderVisible: false,
      autoScale: true,
      fontSize: 11,
      fontFamily: `var(--font-mono), Inter, sans-serif`,
    },
    handleScroll: { vertTouchDrag: true, horzTouchDrag: true, mouseWheel: true, pressedMouseMove: true },
    handleScale: { axisDoubleClick: true, axisPressedMouseMove: true, mouseWheel: true, pinch: true },
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      ...chartOptions(),
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
      priceScaleId: "right",
      title: ticker,
      lastValueVisible: true,
      priceLineVisible: true,
    });
    seriesRef.current = series;

    // Build OHLC data
    if (data && data.dates.length > 0) {
      const ohlcData = data.dates
        .map((d, i) => ({
          time: d,
          open: data.open[i] ?? data.close[i] ?? 0,
          high: data.high[i] ?? data.close[i] ?? 0,
          low: data.low[i] ?? data.close[i] ?? 0,
          close: data.close[i] ?? 0,
        }))
        .filter(p => p.open !== 0 && p.close !== 0);

      series.setData(ohlcData);
    }

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      if (container && chartRef.current) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [ticker, data, chartOptions]);

  const containerVariants = useMemo(() => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  }), []);

  if (isLoading) {
    return (
      <motion.div initial="initial" animate="animate" transition={{ ...SPRING_PHYSICS_DEFAULT, delay: 0.1 }} className={cn("h-full w-full", className)}>
        <ChartSkeleton />
      </motion.div>
    );
  }

  if (!data || data.dates.length === 0) {
    return (
      <motion.div initial="initial" animate="animate" transition={{ ...SPRING_PHYSICS_DEFAULT, delay: 0.1 }} className={cn("apple-card h-full w-full flex items-center justify-center", className)}>
        <div className="text-center text-muted-foreground p-6">
          <SFIcon name="chart.bar.fill" size={32} className="text-cyan-500 mx-auto mb-3" />
          <p className="text-sm font-medium">No OHLC data for {ticker}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      transition={{ ...SPRING_PHYSICS_DEFAULT, delay: 0.15 }}
      className={cn(
        "relative apple-card h-full w-full p-3 md:p-4 flex flex-col justify-between overflow-hidden",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 px-1 z-10">
        <h3 className="text-sm md:text-base font-bold text-foreground" style={{ letterSpacing: '-0.03em' }}>
          Candlestick — {ticker}
        </h3>
        <span className="text-[10px] text-muted-foreground font-mono-data text-slate-400">
          {data.dates.length > 0 ?
            `${new Date(data.dates[0] + 'T00:00:00').toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' })} – ${new Date(data.dates[data.dates.length - 1] + 'T00:00:00').toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' })}`
            : ''}
        </span>
      </div>
      <div ref={containerRef} className={cn("w-full flex-grow z-10", `min-h-[${CHART_MIN_HEIGHT}]`)} />
    </motion.div>
  );
}

export const CandlestickChart = memo(CandlestickChartInner);
