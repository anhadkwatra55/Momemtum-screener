"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { DashboardData, Signal } from "@/types/momentum";
import { fetchDashboardData } from "@/services/api";
import { SORTABLE_SIGNAL_KEYS, ValidSignalSortKey, DEFAULT_SIGNAL_REFRESH_INTERVAL_MS } from "@/lib/constants";

interface AppError {
  message: string;
  code?: string | number;
  details?: unknown;
}

interface UseSignalsReturn {
  data: DashboardData | null;
  loading: boolean;
  error: AppError | null;
  refresh: () => Promise<void>;
  selectedTicker: string | null;
  setSelectedTicker: (ticker: string | null) => void;
  sortedSignals: Signal[];
  sortBy: ValidSignalSortKey;
  sortAsc: boolean;
  setSortBy: (col: ValidSignalSortKey) => void;
  initialLoadComplete: boolean;
}

export function useSignals(options?: { refreshInterval?: number }): UseSignalsReturn {
  const { refreshInterval = DEFAULT_SIGNAL_REFRESH_INTERVAL_MS } = options || {};

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [selectedTickerState, setSelectedTickerState] = useState<string | null>(null);
  const [sortBy, setSortByState] = useState<ValidSignalSortKey>("probability");
  const [sortAsc, setSortAsc] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const hasFetchedOnce = useRef(false);

  const setSelectedTicker = useCallback((ticker: string | null) => {
    setSelectedTickerState(ticker);
  }, []);

  // ── Stale-While-Revalidate fetch ──────────────────────────────────────────
  // Only show loading spinner on first load (data === null).
  // On subsequent refreshes, keep showing stale data while fetching new data.
  const loadData = useCallback(async () => {
    try {
      // Only show loading on first fetch (no data yet)
      if (!hasFetchedOnce.current) {
        setLoading(true);
      }
      setError(null);

      const result = await fetchDashboardData();
      setData(result);
      setError(null);
      hasFetchedOnce.current = true;
    } catch (e) {
      console.error("Failed to load dashboard data", e);
      // Only set error if we have no stale data to show
      if (!hasFetchedOnce.current) {
        setError({
          message: "An unexpected error occurred while fetching data. Please try refreshing.",
          details: e,
        });
        setData(null);
      }
      // If we already have data, silently fail and keep showing stale data
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const performInitialLoad = async () => {
      await loadData();
      setInitialLoadComplete(true);
    };
    performInitialLoad();
  }, [loadData]);

  // Background refresh — no loading spinner, silent update
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(() => {
        loadData();
      }, refreshInterval);
      return () => clearInterval(intervalId);
    }
    return undefined;
  }, [refreshInterval, loadData]);

  // Auto-select first ticker when data loads
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

    const currentSortKey = sortBy;
    const sigs = [...data.signals];

    sigs.sort((a, b) => {
      const valA = a[currentSortKey];
      const valB = b[currentSortKey];

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
    loading,
    error,
    refresh: loadData,
    selectedTicker: selectedTickerState,
    setSelectedTicker,
    sortedSignals,
    sortBy,
    sortAsc,
    setSortBy,
    initialLoadComplete,
  };
}