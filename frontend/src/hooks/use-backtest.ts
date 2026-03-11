"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { BacktestResult } from "@/types/momentum";
import { runBacktest, cancelBacktest, type BacktestParams } from "@/services/api";
import {
  BACKTEST_INITIAL_RENDER_DELAY_MS,
  BACKTEST_PRE_API_PROGRESS_SETTLE_DELAY_MS,
  BACKTEST_PROGRESS_INCREMENT_MAX,
  BACKTEST_PROGRESS_INCREMENT_MIN,
  BACKTEST_PROGRESS_INTERVAL_MS,
  BACKTEST_PROGRESS_MAX_SIMULATED,
} from "@/lib/constants";
import { Log } from "@/lib/utils"; // Assuming Log is defined in lib/utils.ts

/**
 * @interface BacktestError
 * @description Defines the structure for errors encountered during a backtest operation.
 */
interface BacktestError {
  type: "api_error" | "network_error" | "validation_error" | "cancelled" | "unknown_error";
  message: string;
  code?: number;
  details?: Record<string, any>;
}

/**
 * @typedef {'idle' | 'initializing' | 'running' | 'cancelling' | 'cancelled' | 'completed' | 'error'} BacktestStatus
 * @description Represents the current status of the backtest process.
 */
type BacktestStatus = "idle" | "initializing" | "running" | "cancelling" | "cancelled" | "completed" | "error";

/**
 * @interface BacktestProgress
 * @description Provides detailed information about the ongoing backtest, including status, message, percentage, and elapsed time.
 */
interface BacktestProgress {
  status: BacktestStatus;
  message: string;
  percentage: number | null; // 0-100 for actual progress
  elapsedTimeMs: number | null;
  backtestId: string | null; // A unique ID for the current backtest run (client-generated)
}

/**
 * @interface UseBacktestReturn
 * @description The return type for the `useBacktest` hook, providing state and actions for backtesting.
 */
interface UseBacktestReturn {
  result: BacktestResult | null;
  progress: BacktestProgress;
  error: BacktestError | null;
  run: (params: BacktestParams) => Promise<void>;
  cancel: () => void;
  isLoading: boolean; // Convenience flag for UI components
}

// Helper for type-guarding API errors (assuming common structure from API clients like axios)
interface ApiErrorResponseData {
  message?: string;
  code?: string | number;
  details?: Record<string, any>;
  // Add other common fields that your API might return in error responses
}

interface ApiClientError extends Error {
  response?: {
    data?: ApiErrorResponseData;
    status: number;
    statusText?: string;
  };
  code?: string; // e.g., 'ECONNABORTED' for network issues, or a custom error code
  isAxiosError?: boolean; // If axios is actually used, this helps
}

function isApiClientError(error: unknown): error is ApiClientError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as ApiClientError).response !== undefined &&
    typeof (error as ApiClientError).response === 'object' &&
    (error as ApiClientError).response !== null &&
    typeof (error as ApiClientError).response.status === 'number'
  );
}

/**
 * @function useBacktest
 * @description A premium React hook for managing the lifecycle of a backtest operation.
 * It provides state for backtest results, real-time progress, error handling,
 * and actions to run and cancel backtests. Adheres to "IQ 300" standards for
 * perceived performance and fluid user experience.
 *
 * This hook simulates a richer progress state by incrementally updating
 * the percentage during the 'running' phase, even if the backend API delivers
 * results in a single batch. It also includes robust cancellation logic,
 * allowing a new backtest to pre-emptively cancel a previous one.
 *
 * @returns {UseBacktestReturn} An object containing the backtest result, progress, error,
 *                              and functions to control the backtest.
 */
export function useBacktest(): UseBacktestReturn {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [progress, setProgress] = useState<BacktestProgress>({
    status: "idle",
    message: "Ready to run backtest.",
    percentage: null,
    elapsedTimeMs: null,
    backtestId: null,
  });
  const [error, setError] = useState<BacktestError | null>(null);

  // Refs for stable callbacks and preventing stale closures
  const progressRef = useRef<BacktestProgress>(progress);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentBacktestIdRef = useRef<string | null>(null); // To accurately track the active backtest ID

  // Update progressRef whenever the progress state changes
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const updateElapsedTime = useCallback((): number | null => {
    if (startTimeRef.current) {
      return Date.now() - startTimeRef.current;
    }
    return null;
  }, []);

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
      Log.debug("[useBacktest Hook] Progress simulation interval cleared.");
    }
  }, []);

  const run = useCallback(async (params: BacktestParams) => {
    const previousBacktestId = currentBacktestIdRef.current;
    const currentProgressStatus = progressRef.current.status;

    // If a backtest is already running or initializing, pre-emptively cancel it before starting a new one.
    if (abortRef.current && (currentProgressStatus === "initializing" || currentProgressStatus === "running")) {
      Log.info(
        `[useBacktest Hook] Pre-emptively cancelling previous backtest (ID: ${previousBacktestId || 'unknown'}) (status: ${currentProgressStatus}).`
      );
      abortRef.current.abort(); // Client-side abort of the previous operation

      if (previousBacktestId) {
        // Attempt to signal backend to cancel the *previous* specific backtest.
        cancelBacktest(previousBacktestId).catch((e) =>
          Log.warn(
            `[useBacktest Hook] Failed to signal backend cancel for previous operation (ID: ${previousBacktestId}):`,
            e
          )
        );
      }
      clearProgressInterval();

      // Update progress for the *previous* backtest to 'cancelled'
      setProgress((prev) => ({
        ...prev,
        status: "cancelled",
        message: `Previous operation cancelled by new backtest (ID: ${previousBacktestId}).`,
        percentage: null,
        elapsedTimeMs: updateElapsedTime(),
      }));
    }

    const newBacktestId = crypto.randomUUID(); // Robust client-generated ID for the new backtest
    currentBacktestIdRef.current = newBacktestId;
    const newAbortController = new AbortController();
    abortRef.current = newAbortController; // Assign the new controller
    startTimeRef.current = Date.now();

    setError(null);
    setResult(null); // Clear previous results
    clearProgressInterval(); // Ensure any stale interval is cleared before starting a new one

    Log.info(`[useBacktest Hook] Starting new backtest with ID: ${newBacktestId}.`);

    // 1. Initializing state
    setProgress({
      status: "initializing",
      message: "Preparing backtest environment...",
      percentage: 0,
      elapsedTimeMs: 0,
      backtestId: newBacktestId,
    });

    try {
      // Small delay to allow initial 0% to render visually, enhancing perceived responsiveness.
      await new Promise((resolve) => setTimeout(resolve, BACKTEST_INITIAL_RENDER_DELAY_MS));

      // 2. Running state with simulated granular progress up to BACKTEST_PROGRESS_MAX_SIMULATED
      setProgress((prev) => ({
        ...prev,
        status: "running",
        message: "Fetching data and executing strategy...",
        percentage: 10, // Jump to initial progress
        elapsedTimeMs: updateElapsedTime(),
      }));

      // Simulate intermediate progress, stopping at BACKTEST_PROGRESS_MAX_SIMULATED
      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          // Only update if the current backtest is running, hasn't hit MAX_SIMULATED,
          // and its ID matches the active operation to prevent stale updates.
          if (
            prev.status !== "running" ||
            prev.percentage === null ||
            prev.percentage >= BACKTEST_PROGRESS_MAX_SIMULATED ||
            prev.backtestId !== newBacktestId
          ) {
            clearProgressInterval();
            return prev;
          }
          const newPercentage = Math.min(
            prev.percentage + BACKTEST_PROGRESS_INCREMENT_MIN + Math.floor(Math.random() * BACKTEST_PROGRESS_INCREMENT_MAX),
            BACKTEST_PROGRESS_MAX_SIMULATED
          );
          Log.debug(
            `[useBacktest Hook] Updating simulated progress for ID ${newBacktestId}: ${newPercentage}%.`
          );
          return {
            ...prev,
            percentage: newPercentage,
            elapsedTimeMs: updateElapsedTime(),
          };
        });
      }, BACKTEST_PROGRESS_INTERVAL_MS);

      // Ensure BACKTEST_PROGRESS_MAX_SIMULATED is displayed before the actual API call.
      await new Promise((resolve) => setTimeout(resolve, BACKTEST_PRE_API_PROGRESS_SETTLE_DELAY_MS));
      setProgress((prev) => {
        clearProgressInterval(); // Stop the simulated interval definitively here
        if (prev.status === "running" && prev.backtestId === newBacktestId) {
          Log.info(
            `[useBacktest Hook] Setting progress to ${BACKTEST_PROGRESS_MAX_SIMULATED}% before API call for ID ${newBacktestId}.`
          );
          return {
            ...prev,
            percentage: BACKTEST_PROGRESS_MAX_SIMULATED,
            message: "Awaiting final results from backend...",
            elapsedTimeMs: updateElapsedTime(),
          };
        }
        return prev;
      });

      const data = await runBacktest(params, newAbortController.signal);
      Log.info(`[useBacktest Hook] Backtest API call successful for ID ${newBacktestId}.`);

      // 3. Completed state
      setResult(data);
      clearProgressInterval(); // Ensure interval is cleared one final time
      setProgress({
        status: "completed",
        message: "Backtest completed successfully.",
        percentage: 100,
        elapsedTimeMs: updateElapsedTime(),
        backtestId: newBacktestId,
      });
      Log.info(`[useBacktest Hook] Backtest ID ${newBacktestId} completed.`);
    } catch (e: unknown) {
      clearProgressInterval(); // Clear interval immediately upon error or cancellation
      let errorType: BacktestError["type"];
      let errorMessage: string;
      let errorDetails: Record<string, any> = {};

      if (newAbortController.signal.aborted) {
        Log.info(
          `[useBacktest Hook] Backtest ID ${newBacktestId} was aborted by user or a new operation.`
        );
        errorType = "cancelled";
        errorMessage = "Backtest operation was cancelled.";
      } else if (isApiClientError(e)) {
        errorDetails = { 
          name: e.name, 
          stack: e.stack, 
          responseStatus: e.response?.status,
          responseData: e.response?.data
        };

        if (e.response?.status === 400) {
          errorType = "validation_error";
          errorMessage = e.response?.data?.message || e.message || "Validation failed. Please check your inputs.";
          Log.warn(`[useBacktest Hook] Backtest ID ${newBacktestId} failed with validation error (HTTP 400):`, errorMessage, errorDetails);
        } else if (e.code === 'ERR_NETWORK' || e.message === 'Failed to fetch') { // Common network error indicators
          errorType = "network_error";
          errorMessage = "Network error: Unable to reach the server. Please check your internet connection.";
          Log.error(`[useBacktest Hook] Backtest ID ${newBacktestId} failed with network error:`, errorMessage, errorDetails);
        } else {
          errorType = "api_error";
          errorMessage = e.response?.data?.message || e.message || "An API error occurred. Please try again.";
          Log.error(`[useBacktest Hook] Backtest ID ${newBacktestId} failed with API error:`, errorMessage, errorDetails);
        }
      } else if (e instanceof Error) {
        // Generic JavaScript Error
        errorType = "unknown_error";
        errorMessage = e.message || "An unexpected error occurred.";
        errorDetails = { name: e.name, stack: e.stack, rawError: e };
        Log.error(`[useBacktest Hook] Backtest ID ${newBacktestId} failed with generic error:`, errorMessage, errorDetails);
      } else {
        // Truly unknown error type
        errorType = "unknown_error";
        errorMessage = "An unexpected error occurred during backtest execution.";
        errorDetails = { rawError: e };
        Log.error(`[useBacktest Hook] Backtest ID ${newBacktestId} failed with unknown error type:`, e);
      }

      setError({
        type: errorType,
        message: errorMessage,
        details: errorDetails,
      });
      setProgress((prev) => ({
        ...prev,
        status: errorType === "cancelled" ? "cancelled" : "error",
        message: errorMessage,
        percentage: null,
        elapsedTimeMs: updateElapsedTime(),
      }));
    } finally {
      // Only clear the global abortRef and currentBacktestIdRef if it corresponds to the *current* operation
      if (abortRef.current === newAbortController) {
        abortRef.current = null;
        currentBacktestIdRef.current = null;
        Log.info(`[useBacktest Hook] Cleared abortRef and currentBacktestIdRef for ID ${newBacktestId}.`);
      }
      clearProgressInterval(); // Ensure interval is always cleared on completion/error/cancel
    }
  }, [clearProgressInterval, updateElapsedTime]); // Depend on stable memoized functions

  const cancel = useCallback(() => {
    const activeBacktestId = currentBacktestIdRef.current;
    const currentProgressStatus = progressRef.current.status;

    // Only allow cancellation if a backtest is actively running or initializing
    if (abortRef.current && (currentProgressStatus === "initializing" || currentProgressStatus === "running")) {
      Log.info(
        `[useBacktest Hook] User initiated cancellation for backtest (ID: ${activeBacktestId || 'unknown'}).`
      );
      setProgress((prev) => ({
        ...prev,
        status: "cancelling",
        message: "Cancelling backtest...",
        elapsedTimeMs: updateElapsedTime(),
      }));

      const currentAbortController = abortRef.current; // Capture current controller
      currentAbortController.abort(); // Client-side abort signal

      if (activeBacktestId) {
        // Backend cancellation signal for the specific backtest
        cancelBacktest(activeBacktestId).catch((e) =>
          Log.error(
            `[useBacktest Hook] Failed to signal backend cancel for ID ${activeBacktestId}:`,
            e
          )
        );
      } else {
        Log.warn(
          "[useBacktest Hook] Attempted to signal backend cancel but no active backtest ID was found in ref."
        );
      }
      clearProgressInterval();
    } else {
      Log.info(
        `[useBacktest Hook] Cancellation requested but no active backtest found (status: ${currentProgressStatus}).`
      );
    }
  }, [updateElapsedTime, clearProgressInterval]); // Depend on stable memoized functions

  useEffect(() => {
    const controllerToAbortOnUnmount = abortRef.current; // Capture the *current* controller for cleanup
    const idToAbortOnUnmount = currentBacktestIdRef.current;

    return () => {
      clearProgressInterval();
      if (controllerToAbortOnUnmount && !controllerToAbortOnUnmount.signal.aborted) {
        Log.info(
          `[useBacktest Hook] Component unmounted. Aborting active backtest (ID: ${idToAbortOnUnmount || "unknown"}).`
        );
        controllerToAbortOnUnmount.abort();
        // For unmount, we don't necessarily need to signal backend cancel,
        // as the server might handle orphaned requests via timeouts.
        // This is a design decision; avoiding unnecessary network calls on unmount.
      }
    };
  }, [clearProgressInterval]); // `abortRef` and `currentBacktestIdRef` are mutable refs, not dependencies.

  const isLoading = progress.status === "initializing" || progress.status === "running" || progress.status === "cancelling";

  return { result, progress, error, run, cancel, isLoading };
}