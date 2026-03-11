"use client";

/**
 * useStrategy — Business logic hook for strategy builder
 * Manages backtest state, indicator catalog, and saved strategies.
 * Provides a premium, robust interface for interacting with strategy execution
 * and management, focusing on clear state, error handling, performance,
 * and real-time feedback.
 *
 * This version refactors state management for clearer loading/error states,
 * introduces structured error types, enforces stricter TypeScript
 * definitions for API interactions, and adds refined real-time backtest progress simulation.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  runBacktest,
  cancelBacktest,
  getBacktestHistory,
  getIndicators,
  runStrategyBacktest,
  runCodeStrategy,
  saveStrategy,
  listStrategies,
  loadStrategy,
  deleteStrategy,
  type BacktestParams,
} from "@/services/api";
import { BACKTEST_HISTORY_LIMIT } from "@/lib/constants";
import type { BacktestResult, IndicatorMeta, SavedStrategy } from "@/types/momentum";

// ── Conceptual Constants (Should be moved to lib/constants.ts) ────────────────
const BACKTEST_SIMULATION_DURATION_MS = 7000; // Simulate 7 seconds for a backtest
const BACKTEST_PROGRESS_INTERVAL_MS = 100; // Update progress every 100ms
const BACKTEST_PROGRESS_STEPS = [
  "Initializing data...",
  "Fetching historical data...",
  "Applying indicators...",
  "Evaluating conditions...",
  "Simulating trades...",
  "Calculating metrics...",
  "Generating report...",
];

// ── Refined Type Definitions ──────────────────────────────────────────────

/**
 * Defines the possible states of a backtest execution.
 * 'idle': No backtest is currently running or has completed/failed.
 * 'running': A backtest is in progress.
 * 'success': The last backtest completed successfully.
 * 'error': The last backtest failed due to an error.
 * 'cancelled': The last backtest was explicitly cancelled by the user.
 */
type BacktestStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

/**
 * Defines the progress details for a running backtest.
 */
interface BacktestProgress {
  percentage: number;
  currentStep: string;
  estimatedTimeRemaining: string; // e.g., "2m 30s"
}

/**
 * Structured error type for consistent error handling and UI feedback.
 * Aligns with the "IQ 300" standard for robustness and granular error messages.
 */
interface BacktestError {
  code: 'API_ERROR' | 'NETWORK_ERROR' | 'ABORTED' | 'VALIDATION_ERROR' | 'INITIAL_LOAD_ERROR' |
        'HISTORY_LOAD_ERROR' | 'STRATEGIES_LOAD_ERROR' | 'CANCELLATION_FAILED' | 'SAVE_STRATEGY_ERROR' |
        'LOAD_STRATEGY_ERROR' | 'DELETE_STRATEGY_ERROR' | 'UNKNOWN_ERROR';
  message: string;
  details?: Record<string, unknown> | string; // General purpose details
  validationErrors?: Record<string, string[]>; // Specific for 'VALIDATION_ERROR'
}

/**
 * Defines the expected parameters for a strategy built via the visual builder.
 */
export interface StrategyBuilderParams {
  strategy_id?: number;
  name?: string;
  conditions: Condition[];
  assets: string[];
  timeframe: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
}

/**
 * Defines the expected parameters for a code-based strategy.
 */
export interface CodeStrategyParams {
  strategy_id?: number;
  name?: string;
  code: string;
  timeframe: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
}

/**
 * Refined API response type for backtest execution.
 * This type aligns with what `services/api.ts` *should* return for a backtest,
 * including potential cancellation or error flags.
 * Assuming `BacktestResult` comes from `types/momentum`.
 */
interface BacktestRawApiResponse extends BacktestResult {
  cancelled?: boolean;
  error?: string; // High-level error message from backend
  traceback?: string; // Detailed error traceback
  validation_errors?: Record<string, string[]>; // Specific validation error details
}

/**
 * Defines the structure for a backtest summary entry, improving type safety for history.
 */
interface BacktestSummary {
  pnl_percent: number;
  sharpe_ratio: number;
  max_drawdown: number;
  total_trades: number;
  win_rate: number;
  [key: string]: unknown; // Allow for future backend additions without immediate type errors
}

/**
 * Defines the structure for a single entry in the backtest history.
 */
interface BacktestHistoryEntry {
  id: number;
  run_time: string;
  params: BacktestParams;
  summary: BacktestSummary;
}

/**
 * Defines the expected response structure from `getBacktestHistory`.
 */
interface BacktestHistoryApiResponse {
  history: BacktestHistoryEntry[];
}

/**
 * Defines the state for CRUD operations on strategies.
 */
type CrudStatus = 'idle' | 'loading' | 'success' | 'error';

// ── Existing Types ────────────────────────────────────────────────────────

export interface Condition {
  left: { type: "indicator" | "price"; name?: string; output?: string; field?: string };
  op: string;
  right: { type: "constant" | "indicator" | "price"; value?: number; name?: string; output?: string; field?: string };
}

/**
 * Defines parameters for saving a strategy using a discriminated union.
 * This enforces that `config` is present for 'visual' strategies and `code` for 'code' strategies.
 */
type SaveStrategyParams = {
  name: string;
  id?: number;
} & (
  | { type: "visual"; config: StrategyBuilderParams; code?: never; }
  | { type: "code"; code: string; config?: never; }
);

/**
 * Interface representing a structured API error that `services/api.ts` might throw.
 * This allows the hook to differentiate between network errors and API-specific errors,
 * including validation errors (HTTP 400).
 */
interface ApiError {
  message: string;
  statusCode: number;
  responseBody?: {
    detail?: string;
    errors?: Record<string, string[]>; // For validation errors (HTTP 400)
    [key: string]: unknown; // Allow for other fields
  };
}


// ── Utility Functions ─────────────────────────────────────────────────────

/**
 * A centralized logging utility, replacing direct console.error calls.
 * In a production Apple environment, this would integrate with sophisticated telemetry.
 */
const logError = (code: BacktestError['code'], message: string, e: unknown, details?: Record<string, unknown> | string) => {
  // Enhanced console output for development/debugging.
  // In a real Apple setup, this would funnel into a telemetry system (e.g., Splunk, custom analytics)
  console.error(`[useStrategy] Error (${code}): ${message}`, { originalError: e, details });
};

// ── useStrategy Hook Implementation ───────────────────────────────────────

export function useStrategy() {
  const [status, setStatus] = useState<BacktestStatus>('idle');
  const [progress, setProgress] = useState<BacktestProgress | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [history, setHistory] = useState<BacktestHistoryEntry[]>([]);
  const [indicators, setIndicators] = useState<IndicatorMeta[]>([]);
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
  const [error, setError] = useState<BacktestError | null>(null);
  const [initialLoadError, setInitialLoadError] = useState<BacktestError | null>(null);
  const [saveStrategyStatus, setSaveStrategyStatus] = useState<CrudStatus>('idle');
  const [loadStrategyStatus, setLoadStrategyStatus] = useState<CrudStatus>('idle');
  const [deleteStrategyStatus, setDeleteStrategyStatus] = useState<CrudStatus>('idle');

  const controllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressStartTimeRef = useRef<number | null>(null);

  /**
   * Clears any active progress interval.
   */
  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    progressStartTimeRef.current = null;
  }, []);

  /**
   * Clears all backtest-related state (status, result, error, progress).
   */
  const resetBacktestState = useCallback(() => {
    clearProgressInterval();
    setStatus('idle');
    setResult(null);
    setError(null);
    setProgress(null);
  }, [clearProgressInterval]);

  /**
   * Loads the recent backtest history from the API.
   * Updates `error` state if loading fails.
   */
  const loadHistory = useCallback(async () => {
    try {
      // Assuming getBacktestHistory correctly returns Promise<BacktestHistoryApiResponse>
      const data = await getBacktestHistory(BACKTEST_HISTORY_LIMIT);
      setHistory(data.history || []);
      setError(null);
    } catch (e: unknown) {
      logError('HISTORY_LOAD_ERROR', "Failed to load backtest history. Please check your connection or try again.", e, e instanceof Error ? e.message : String(e));
      setError({
        code: 'HISTORY_LOAD_ERROR',
        message: "Failed to load backtest history. Please check your connection or try again.",
        details: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  /**
   * Loads the list of saved strategies from the API.
   * Updates `error` state if loading fails.
   */
  const loadStrategies = useCallback(async () => {
    try {
      const strats = await listStrategies();
      setSavedStrategies(strats);
      setError(null);
    } catch (e: unknown) {
      logError('STRATEGIES_LOAD_ERROR', "Failed to load saved strategies. Please try again.", e, e instanceof Error ? e.message : String(e));
      setError({
        code: 'STRATEGIES_LOAD_ERROR',
        message: "Failed to load saved strategies. Please try again.",
        details: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  /**
   * Helper function to encapsulate common backtest execution logic and error handling.
   * Centralizes status updates, AbortController management, and structured error reporting.
   * Also handles real-time progress updates (simulated for front-end feedback).
   *
   * @param apiCall The API function to execute (e.g., `runBacktest`, `runStrategyBacktest`).
   * @param name A human-readable name for the backtest type (e.g., "4-System backtest").
   */
  const executeBacktest = useCallback(async (
    apiCall: (signal: AbortSignal) => Promise<BacktestRawApiResponse>,
    name: string,
  ) => {
    resetBacktestState(); // Reset previous backtest state
    setStatus('running');
    controllerRef.current = new AbortController();

    // --- Simulated Real-time Progress (Refined) ---
    progressStartTimeRef.current = Date.now();

    clearProgressInterval(); // Ensure any old interval is cleared
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - (progressStartTimeRef.current || Date.now());
      let percentage = Math.min((elapsed / BACKTEST_SIMULATION_DURATION_MS) * 90, 90); // Cap simulation at 90%

      let stepIndex = Math.floor(percentage / (90 / BACKTEST_PROGRESS_STEPS.length));
      stepIndex = Math.min(stepIndex, BACKTEST_PROGRESS_STEPS.length - 1); // Ensure index is within bounds

      const remainingMs = Math.max(0, BACKTEST_SIMULATION_DURATION_MS - elapsed);
      const remainingMinutes = Math.floor(remainingMs / 60000);
      const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
      const estimatedTimeRemaining = remainingMinutes > 0
        ? `${remainingMinutes}m ${remainingSeconds}s`
        : `${remainingSeconds}s`;

      setProgress({
        percentage: Math.floor(percentage),
        currentStep: BACKTEST_PROGRESS_STEPS[stepIndex],
        estimatedTimeRemaining: estimatedTimeRemaining,
      });
    }, BACKTEST_PROGRESS_INTERVAL_MS); // Update progress more frequently for smoothness

    try {
      const response = await apiCall(controllerRef.current.signal);

      // Successfully resolved, now set to 100% and complete message
      setProgress({ percentage: 100, currentStep: "Complete!", estimatedTimeRemaining: "0s" });

      if (response.cancelled) {
        setError({ code: 'ABORTED', message: `${name} operation was cancelled by the user.` });
        setStatus('cancelled');
        setResult(null);
        setProgress(null);
      } else if (response.error) {
        // Backend indicated an error in the response body
        setError({
          code: 'API_ERROR',
          message: `${name} failed: ${response.error}`,
          details: response.traceback,
        });
        setStatus('error');
        setProgress(null);
      } else {
        setResult(response);
        setStatus('success');
        loadHistory(); // Reload history on successful backtest
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        setError({ code: 'ABORTED', message: `${name} operation was aborted locally.` });
        setStatus('cancelled');
        setResult(null);
        setProgress(null);
      } else if (typeof e === 'object' && e !== null && 'statusCode' in e && typeof (e as ApiError).statusCode === 'number') {
        // Handle structured API errors
        const apiError = e as ApiError;
        if (apiError.statusCode === 400 && apiError.responseBody && apiError.responseBody.errors) {
          setError({
            code: 'VALIDATION_ERROR',
            message: apiError.responseBody.detail || 'Validation failed. Please check your inputs.',
            details: apiError.message, // Fallback to general message if detail is missing
            validationErrors: apiError.responseBody.errors,
          });
          setStatus('error');
          setProgress(null);
        } else {
          // General API error with status code
          logError('API_ERROR', `Failed to run ${name}: API error ${apiError.statusCode} - ${apiError.message}`, e, apiError.responseBody);
          setError({
            code: 'API_ERROR',
            message: `Failed to run ${name}: ${apiError.responseBody?.detail || apiError.message}`,
            details: apiError.responseBody,
          });
          setStatus('error');
          setProgress(null);
        }
      } else if (e instanceof Error) {
        logError('NETWORK_ERROR', `Failed to run ${name}: ${e.message}`, e, e.stack);
        setError({
          code: 'NETWORK_ERROR',
          message: `Failed to run ${name}: ${e.message}`,
          details: e.stack,
        });
        setStatus('error');
        setProgress(null);
      } else {
        logError('UNKNOWN_ERROR', `An unexpected error occurred during the ${name} execution.`, e, String(e));
        setError({
          code: 'UNKNOWN_ERROR',
          message: `An unexpected error occurred during the ${name} execution.`,
          details: String(e),
        });
        setStatus('error');
        setProgress(null);
      }
    } finally {
      clearProgressInterval(); // Ensure interval is cleared in all cases
      controllerRef.current = null;
    }
  }, [loadHistory, resetBacktestState, clearProgressInterval]);

  // Load essential data on mount: indicators, history, and saved strategies
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [indicatorsData, historyData, strategiesData] = await Promise.all([
          getIndicators(),
          getBacktestHistory(BACKTEST_HISTORY_LIMIT), // Removed 'as Promise<BacktestHistoryApiResponse>'
          listStrategies(),
        ]);
        setIndicators(indicatorsData);
        setHistory(historyData.history || []);
        setSavedStrategies(strategiesData);
        setInitialLoadError(null);
      } catch (e: unknown) {
        logError('INITIAL_LOAD_ERROR', "Failed to load essential strategy data. Some features may not be available. Please try refreshing.", e, e instanceof Error ? e.message : String(e));
        setInitialLoadError({
          code: 'INITIAL_LOAD_ERROR',
          message: "Failed to load essential strategy data. Some features may not be available. Please try refreshing.",
          details: e instanceof Error ? e.message : String(e),
        });
      }
    };
    fetchInitialData();
  }, [clearProgressInterval]);

  /**
   * Runs a 4-system backtest with the given parameters.
   */
  const run4System = useCallback(async (params: BacktestParams) => {
    // Relying on `runBacktest` from `services/api` to return `Promise<BacktestRawApiResponse>`
    await executeBacktest(
      (signal) => runBacktest(params, signal),
      "4-System backtest"
    );
  }, [executeBacktest]);

  /**
   * Runs a strategy builder backtest with the given configuration.
   */
  const runBuilder = useCallback(async (params: StrategyBuilderParams) => {
    // Relying on `runStrategyBacktest` from `services/api` to return `Promise<BacktestRawApiResponse>`
    await executeBacktest(
      (signal) => runStrategyBacktest(params, signal),
      "Strategy builder backtest"
    );
  }, [executeBacktest]);

  /**
   * Runs a code-based strategy backtest.
   */
  const runCode = useCallback(async (params: CodeStrategyParams) => {
    // Relying on `runCodeStrategy` from `services/api` to return `Promise<BacktestRawApiResponse>`
    await executeBacktest(
      (signal) => runCodeStrategy(params, signal),
      "Code strategy"
    );
  }, [executeBacktest]);

  /**
   * Attempts to cancel the currently running backtest.
   * It aborts the local signal and sends a cancellation request to the API.
   */
  const cancel = useCallback(async () => {
    // Immediately clear local progress interval and update UI for responsiveness
    clearProgressInterval();
    controllerRef.current?.abort(); // Abort local fetch immediately
    setStatus('running'); // Briefly show 'running' while cancellation is processed
    setError(null);
    setProgress({ percentage: progress?.percentage || 0, currentStep: "Cancelling...", estimatedTimeRemaining: "0s" });

    try {
      await cancelBacktest(); // Assuming `cancelBacktest` internally handles the `backtestId` as per previous improvement notes.
      setError({ code: 'ABORTED', message: "Backtest process was successfully cancelled." });
      setStatus('cancelled');
      setResult(null);
      setProgress(null);
    } catch (e: unknown) {
      logError('CANCELLATION_FAILED', "Failed to fully cancel backtest (local abortion applied).", e, e instanceof Error ? e.message : String(e));
      setError({
        code: 'CANCELLATION_FAILED',
        message: "Failed to fully cancel backtest (local abortion applied).",
        details: e instanceof Error ? e.message : String(e),
      });
      setStatus('error');
      setProgress(null);
    } finally {
      // Ensure controller is cleared regardless of API cancellation success/failure
      controllerRef.current = null;
    }
  }, [progress, clearProgressInterval]);

  /**
   * Saves a new strategy or updates an existing one.
   * Reloads the list of strategies upon success.
   */
  const save = useCallback(async (params: SaveStrategyParams) => { // Updated type here
    setSaveStrategyStatus('loading');
    setError(null);
    try {
      await saveStrategy(params); // The API function needs to handle the discriminated union properly
      loadStrategies();
      setSaveStrategyStatus('success');
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'statusCode' in e && typeof (e as ApiError).statusCode === 'number') {
        const apiError = e as ApiError;
        if (apiError.statusCode === 400 && apiError.responseBody && apiError.responseBody.errors) {
          logError('SAVE_STRATEGY_ERROR', `Validation failed for saving strategy: ${apiError.responseBody.detail || apiError.message}`, e, apiError.responseBody.errors);
          setError({
            code: 'VALIDATION_ERROR',
            message: apiError.responseBody.detail || 'Validation failed. Please check your strategy configuration.',
            details: apiError.message,
            validationErrors: apiError.responseBody.errors,
          });
        } else {
          logError('SAVE_STRATEGY_ERROR', `API Error (${apiError.statusCode}) saving strategy: ${apiError.message}`, e, apiError.responseBody);
          setError({
            code: 'SAVE_STRATEGY_ERROR',
            message: apiError.responseBody?.detail || apiError.message,
            details: apiError.responseBody,
          });
        }
      } else if (e instanceof Error) {
        logError('SAVE_STRATEGY_ERROR', `Failed to save strategy: ${e.message}`, e, e.stack);
        setError({
          code: 'SAVE_STRATEGY_ERROR',
          message: `Failed to save strategy: ${e.message}`,
          details: e.stack,
        });
      } else {
        logError('SAVE_STRATEGY_ERROR', `An unexpected error occurred while saving strategy.`, e, String(e));
        setError({
          code: 'SAVE_STRATEGY_ERROR',
          message: `An unexpected error occurred while saving strategy.`,
          details: String(e),
        });
      }
      setSaveStrategyStatus('error');
    }
  }, [loadStrategies]);

  /**
   * Loads a specific saved strategy by its ID.
   * @param id The ID of the strategy to load.
   * @returns The loaded strategy data, or null if an error occurs.
   */
  const load = useCallback(async (id: number) => {
    setLoadStrategyStatus('loading');
    setError(null);
    try {
      const loadedStrategy = await loadStrategy(id);
      setLoadStrategyStatus('success');
      return loadedStrategy;
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'statusCode' in e && typeof (e as ApiError).statusCode === 'number') {
        const apiError = e as ApiError;
        logError('LOAD_STRATEGY_ERROR', `API Error (${apiError.statusCode}) loading strategy ${id}: ${apiError.message}`, e, apiError.responseBody);
        setError({
          code: 'LOAD_STRATEGY_ERROR',
          message: apiError.responseBody?.detail || apiError.message,
          details: apiError.responseBody,
        });
      } else if (e instanceof Error) {
        logError('LOAD_STRATEGY_ERROR', `Failed to load strategy ${id}: ${e.message}`, e, e.stack);
        setError({
          code: 'LOAD_STRATEGY_ERROR',
          message: `Failed to load strategy ${id}: ${e.message}`,
          details: e.stack,
        });
      } else {
        logError('LOAD_STRATEGY_ERROR', `An unexpected error occurred while loading strategy ${id}.`, e, String(e));
        setError({
          code: 'LOAD_STRATEGY_ERROR',
          message: `An unexpected error occurred while loading strategy ${id}.`,
          details: String(e),
        });
      }
      setLoadStrategyStatus('error');
      return null;
    }
  }, []);

  /**
   * Deletes a saved strategy by its ID.
   * Reloads the list of strategies upon success.
   * @param id The ID of the strategy to delete.
   */
  const remove = useCallback(async (id: number) => {
    setDeleteStrategyStatus('loading');
    setError(null);
    try {
      await deleteStrategy(id);
      loadStrategies();
      setDeleteStrategyStatus('success');
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'statusCode' in e && typeof (e as ApiError).statusCode === 'number') {
        const apiError = e as ApiError;
        logError('DELETE_STRATEGY_ERROR', `API Error (${apiError.statusCode}) deleting strategy ${id}: ${apiError.message}`, e, apiError.responseBody);
        setError({
          code: 'DELETE_STRATEGY_ERROR',
          message: apiError.responseBody?.detail || apiError.message,
          details: apiError.responseBody,
        });
      } else if (e instanceof Error) {
        logError('DELETE_STRATEGY_ERROR', `Failed to delete strategy ${id}: ${e.message}`, e, e.stack);
        setError({
          code: 'DELETE_STRATEGY_ERROR',
          message: `Failed to delete strategy ${id}: ${e.message}`,
          details: e.stack,
        });
      } else {
        logError('DELETE_STRATEGY_ERROR', `An unexpected error occurred while deleting strategy ${id}.`, e, String(e));
        setError({
          code: 'DELETE_STRATEGY_ERROR',
          message: `An unexpected error occurred while deleting strategy ${id}.`,
          details: String(e),
        });
      }
      setDeleteStrategyStatus('error');
    }
  }, [loadStrategies]);

  return {
    status,
    progress,
    result,
    history,
    indicators,
    savedStrategies,
    error,
    initialLoadError,
    saveStrategyStatus,
    loadStrategyStatus,
    deleteStrategyStatus,
    run4System,
    runBuilder,
    runCode,
    cancel,
    save,
    load,
    remove,
    loadHistory,
    loadStrategies,
    resetBacktestState,
  };
}