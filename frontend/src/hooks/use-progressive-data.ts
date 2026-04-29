"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { DashboardData, Signal, KPISummary, TickerChartData } from "@/types/momentum";
import {
  fetchDashboardData,
  fetchSummary,
  fetchSignals,
  fetchTickerChart,
  fetchDerived,
  fetchIntelImages,
  getPipelineStatus,
} from "@/services/api";
import { SORTABLE_SIGNAL_KEYS, ValidSignalSortKey, DEFAULT_SIGNAL_REFRESH_INTERVAL_MS } from "@/lib/constants";

// Wave polling interval (ms) — how often to check for new pipeline waves
const WAVE_POLL_INTERVAL_MS = 8_000;

// ── Loading state per data tier ──
interface TierLoadingState {
  summary: boolean;
  signals: boolean;
  intel: boolean;
  derived: boolean;
  full: boolean;
}

interface AppError {
  message: string;
  code?: string | number;
  details?: unknown;
}

export interface UseProgressiveDataReturn {
  // Full dashboard data (merged from all tiers)
  data: DashboardData | null;
  // Per-tier loading states for progressive UI
  tierLoading: TierLoadingState;
  // Overall loading (true only on very first load)
  loading: boolean;
  error: AppError | null;
  refresh: () => Promise<void>;
  // Chart data fetched on demand
  fetchChart: (ticker: string) => Promise<TickerChartData | null>;
  chartCache: Record<string, TickerChartData>;
  chartLoading: string | null; // ticker currently loading, or null
  // Signal sorting
  selectedTicker: string | null;
  setSelectedTicker: (ticker: string | null) => void;
  sortedSignals: Signal[];
  sortBy: ValidSignalSortKey;
  sortAsc: boolean;
  setSortBy: (col: ValidSignalSortKey) => void;
  initialLoadComplete: boolean;
}

/**
 * Progressive data loading hook — fetches data in priority tiers:
 *  Tier 1: Summary (~1KB) → instant KPI render
 *  Tier 2: Signals (~1MB) → signal tables
 *  Tier 3: Derived (on-demand) → screener pages
 *  Tier 4: Charts (on-demand) → ticker detail
 * 
 * Falls back to full monolithic fetch if segmented endpoints fail.
 */
export function useProgressiveData(options?: { refreshInterval?: number }): UseProgressiveDataReturn {
  const { refreshInterval = DEFAULT_SIGNAL_REFRESH_INTERVAL_MS } = options || {};

  const [data, setData] = useState<DashboardData | null>(null);
  const [tierLoading, setTierLoading] = useState<TierLoadingState>({
    summary: true,
    signals: true,
    intel: true,
    derived: true,
    full: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [selectedTickerState, setSelectedTickerState] = useState<string | null>(null);
  const [sortBy, setSortByState] = useState<ValidSignalSortKey>("probability");
  const [sortAsc, setSortAsc] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [chartCache, setChartCache] = useState<Record<string, TickerChartData>>({});
  const [chartLoading, setChartLoading] = useState<string | null>(null);
  const hasFetchedOnce = useRef(false);

  const setSelectedTicker = useCallback((ticker: string | null) => {
    setSelectedTickerState(ticker);
  }, []);

  // ── Progressive fetch: summary → signals → (derived on-demand) ──
  const loadProgressively = useCallback(async () => {
    try {
      if (!hasFetchedOnce.current) {
        setLoading(true);
      }
      setError(null);

      // Tier 1: Summary (instant ~1KB)
      setTierLoading(prev => ({ ...prev, summary: true }));
      let summaryData: KPISummary | null = null;
      try {
        const res = await fetchSummary();
        summaryData = res.summary;
        // Partially update data with just summary
        setData(prev => prev
          ? { ...prev, summary: summaryData! }
          : { summary: summaryData! } as DashboardData
        );
        setTierLoading(prev => ({ ...prev, summary: false }));
      } catch {
        // Summary endpoint failed — will fall back to full fetch
      }

      // Tier 2: Signals (~1MB)
      setTierLoading(prev => ({ ...prev, signals: true }));
      let signalsData: Signal[] | null = null;
      try {
        const res = await fetchSignals();
        signalsData = res.signals;
        setData(prev => prev
          ? { ...prev, signals: signalsData! }
          : { signals: signalsData!, summary: summaryData! } as DashboardData
        );
        setTierLoading(prev => ({ ...prev, signals: false }));
      } catch {
        // Signals endpoint failed — will fall back to full fetch
      }

      // Tier 3: Intel Images
      setTierLoading(prev => ({ ...prev, intel: true }));
      try {
        const res = await fetchIntelImages(50);
        setData(prev => prev ? { ...prev, intel_images: res.images } : prev);
        setTierLoading(prev => ({ ...prev, intel: false }));
      } catch {
        // Failed
      }

      // Tier 4: Full data (keeps everything in sync: charts, strategies, etc.)
      setTierLoading(prev => ({ ...prev, full: true }));
      const fullData = await fetchDashboardData();
      // Merge full data but PRESERVE intel_images from Tier 3 (not in momentum_data.json)
      setData(prev => ({
        ...fullData,
        intel_images: fullData.intel_images || prev?.intel_images || [],
      }));
      // Merge any chart data into cache
      if (fullData.charts) {
        setChartCache(prev => ({ ...prev, ...fullData.charts }));
      }
      setTierLoading({ summary: false, signals: false, intel: false, derived: false, full: false });
      hasFetchedOnce.current = true;
    } catch (e) {
      console.error("Failed to load dashboard data", e);
      if (!hasFetchedOnce.current) {
        setError({
          message: "An unexpected error occurred while fetching data. Please try refreshing.",
          details: e,
        });
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── On-demand chart fetch (Tier 4) ──
  const chartFailedRef = useRef<Set<string>>(new Set());

  const fetchChart = useCallback(async (ticker: string): Promise<TickerChartData | null> => {
    const upper = ticker.toUpperCase();
    // Return from cache if available (including failed placeholders)
    if (chartCache[upper]) return chartCache[upper];
    // Don't retry failed tickers
    if (chartFailedRef.current.has(upper)) return null;

    setChartLoading(upper);
    try {
      const res = await fetchTickerChart(upper);
      const chart = res.charts;
      setChartCache(prev => ({ ...prev, [upper]: chart }));
      // Also merge into main data object
      setData(prev => prev ? {
        ...prev,
        charts: { ...prev.charts, [upper]: chart },
      } : prev);
      return chart;
    } catch (e) {
      console.warn(`Chart unavailable for ${upper} (likely not in screener universe)`);
      // Mark as failed so we don't retry
      chartFailedRef.current.add(upper);
      // Cache an empty placeholder so the UI shows "no data" instead of looping
      const emptyChart = { price: [], hull_ma: [], candlestick: [] } as unknown as TickerChartData;
      setChartCache(prev => ({ ...prev, [upper]: emptyChart }));
      return null;
    } finally {
      setChartLoading(null);
    }
  }, [chartCache]);

  // Initial load
  useEffect(() => {
    const performInitialLoad = async () => {
      await loadProgressively();
      setInitialLoadComplete(true);
    };
    performInitialLoad();
  }, [loadProgressively]);

  // Background refresh — wave-aware polling
  // When the pipeline is actively running, poll /api/pipeline/status every 8s.
  // When wave_version increments (new wave published), re-fetch dashboard data.
  // After pipeline completes, fall back to the standard refresh interval.
  const lastWaveVersionRef = useRef<number>(0);

  useEffect(() => {
    let active = true;

    const pollForWaves = async () => {
      if (!active) return;
      try {
        const status = await getPipelineStatus();
        const serverWave = (status as Record<string, unknown>)?.wave_version as number | undefined;
        const isComplete = (status as Record<string, unknown>)?.is_complete as boolean | undefined;

        if (serverWave !== undefined && serverWave > lastWaveVersionRef.current) {
          lastWaveVersionRef.current = serverWave;
          // New wave published — silently re-fetch data
          await loadProgressively();
        }

        // If pipeline is still running, keep polling fast
        if (!isComplete && active) {
          setTimeout(pollForWaves, WAVE_POLL_INTERVAL_MS);
        }
      } catch {
        // Pipeline status endpoint may not be available yet, retry
        if (active) {
          setTimeout(pollForWaves, WAVE_POLL_INTERVAL_MS);
        }
      }
    };

    // Start wave polling after initial load
    if (initialLoadComplete) {
      const startTimer = setTimeout(pollForWaves, WAVE_POLL_INTERVAL_MS);
      return () => {
        active = false;
        clearTimeout(startTimer);
      };
    }
    return () => { active = false; };
  }, [initialLoadComplete, loadProgressively]);

  // Standard slow refresh after pipeline completes (60s default)
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0 && initialLoadComplete) {
      const intervalId = setInterval(() => {
        loadProgressively();
      }, refreshInterval);
      return () => clearInterval(intervalId);
    }
    return undefined;
  }, [refreshInterval, loadProgressively, initialLoadComplete]);

  // Auto-select first ticker when signals load
  useEffect(() => {
    if (!data?.signals) {
      setSelectedTickerState(null);
      return;
    }
    const signals = data.signals;
    const tickersInCurrentData = new Set(signals.map(s => s.ticker));

    setSelectedTickerState(prevSelectedTicker => {
      if (!prevSelectedTicker && signals.length > 0) {
        return signals[0].ticker;
      }
      if (prevSelectedTicker && !tickersInCurrentData.has(prevSelectedTicker)) {
        return signals.length > 0 ? signals[0].ticker : null;
      }
      return prevSelectedTicker;
    });
  }, [data?.signals]);

  const setSortBy = useCallback(
    (col: ValidSignalSortKey) => {
      if (sortBy === col) {
        setSortAsc((prev) => !prev);
      } else {
        setSortByState(col);
        setSortAsc(false);
      }
    },
    [sortBy],
  );

  const sortedSignals = useMemo(() => {
    if (!data?.signals || data.signals.length === 0) return [];
    const sigs = [...data.signals];
    sigs.sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      const aIsNullish = valA === undefined || valA === null;
      const bIsNullish = valB === undefined || valB === null;
      if (aIsNullish && bIsNullish) return 0;
      if (aIsNullish) return 1;
      if (bIsNullish) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return 0;
    });
    return sigs;
  }, [data?.signals, sortBy, sortAsc]);

  return {
    data,
    tierLoading,
    loading,
    error,
    refresh: loadProgressively,
    fetchChart,
    chartCache,
    chartLoading,
    selectedTicker: selectedTickerState,
    setSelectedTicker,
    sortedSignals,
    sortBy,
    sortAsc,
    setSortBy,
    initialLoadComplete,
  };
}
