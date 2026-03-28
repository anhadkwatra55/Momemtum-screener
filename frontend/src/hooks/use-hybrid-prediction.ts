"use client";

/**
 * useHybridPrediction — React hook for the Hybrid Prediction pipeline.
 * =====================================================================
 * Manages the full Strangler Fig flow:
 *   1. Instant fetch of legacy scores + job dispatch
 *   2. SSE streaming of ML pipeline progress
 *   3. Cleanup on unmount or ticker change
 *
 * State machine:
 *   idle → loading → streaming → complete | anomaly | error
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE } from "@/lib/constants";
import { getAuthHeaders } from "@/services/api";

// ── Types ───────────────────────────────────────────────────────────────────

export interface LegacyScores {
  ticker: string;
  composite_score: number;
  probability: number;
  regime: string;
  rsi_14: number;
  adx_grade: string;
  macd_signal: string;
  price: number;
  sector: string;
}

export interface MlResult {
  status: string;
  ticker: string;
  probability: number | null;
  triage_score: number | null;
  conviction: number | null;
  ranked_conviction: number | null;
  ranked_volume: number | null;
  trigger_llm: boolean;
  suggested_weight?: number | null;
  elapsed_seconds: number;
  universe_size: number;
  error?: string;
}

export interface HybridResponse {
  legacy_scores: LegacyScores | null;
  job_id: string;
  ml_dispatched: boolean;
  dispatch_error: string | null;
  status: string;
  stream_url: string;
}

export type PipelineStep =
  | "idle"
  | "loading"
  | "pending"
  | "fetching_data"
  | "engineering_features"
  | "xgboost_inference"
  | "triage_gate"
  | "complete"
  | "anomaly"
  | "error"
  | "timeout";

const STEP_LABELS: Record<string, string> = {
  idle: "Waiting…",
  loading: "Connecting to pipeline…",
  pending: "Queuing ML task…",
  fetching_data: "Fetching OHLCV data…",
  engineering_features: "Engineering stationary features…",
  xgboost_inference: "Computing XGBoost probability…",
  triage_gate: "Applying Triage Gate…",
  complete: "Analysis complete",
  anomaly: "Statistical anomaly detected!",
  error: "Pipeline error",
  timeout: "Pipeline timed out",
};

// ── Hook ────────────────────────────────────────────────────────────────────

export function useHybridPrediction(ticker: string | null) {
  const [legacyScores, setLegacyScores] = useState<LegacyScores | null>(null);
  const [mlResult, setMlResult] = useState<MlResult | null>(null);
  const [step, setStep] = useState<PipelineStep>("idle");
  const [isStreaming, setIsStreaming] = useState(false);

  // Ref to the active EventSource (for cleanup)
  const eventSourceRef = useRef<EventSource | null>(null);
  // Track the ticker that initiated the current pipeline
  const activeTicker = useRef<string | null>(null);

  /** Clean up any active SSE connection */
  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  /** Reset all state for a new ticker */
  const reset = useCallback(() => {
    closeStream();
    setLegacyScores(null);
    setMlResult(null);
    setStep("idle");
  }, [closeStream]);

  // ── Main effect: triggered when ticker changes ──
  useEffect(() => {
    // Guard: no ticker or same ticker already running
    if (!ticker) {
      reset();
      return;
    }
    if (ticker === activeTicker.current) return;

    // Reset for new ticker
    reset();
    activeTicker.current = ticker;
    setStep("loading");

    let cancelled = false;

    const run = async () => {
      try {
        // ── Step 1: Fetch hybrid endpoint (instant legacy + job dispatch) ──
        const res = await fetch(`${API_BASE}/api/predict/hybrid/${encodeURIComponent(ticker)}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: HybridResponse = await res.json();
        if (cancelled) return;

        // Immediately render legacy scores (fast path)
        if (data.legacy_scores) {
          setLegacyScores(data.legacy_scores);
        }

        // If ML dispatch failed, report error but keep legacy visible
        if (!data.ml_dispatched) {
          setStep("error");
          setMlResult({
            status: "error",
            ticker,
            probability: null,
            triage_score: null,
            conviction: null,
            ranked_conviction: null,
            ranked_volume: null,
            trigger_llm: false,
            elapsed_seconds: 0,
            universe_size: 0,
            error: data.dispatch_error || "ML pipeline dispatch failed",
          });
          return;
        }

        // ── Step 2: Open SSE stream ──
        setStep("pending");
        setIsStreaming(true);

        const es = new EventSource(`${API_BASE}/api/stream-debate/${data.job_id}`);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          if (cancelled) { es.close(); return; }

          try {
            const msg = JSON.parse(event.data);
            const status = msg.status as string;

            // ── Map SSE status to pipeline step ──
            if (status === "running") {
              const pipelineStep = msg.step as string;
              if (pipelineStep && pipelineStep in STEP_LABELS) {
                setStep(pipelineStep as PipelineStep);
              }
            } else if (status === "pending") {
              setStep("pending");
            } else if (status === "complete") {
              setMlResult(msg as MlResult);
              setStep("complete");
              es.close();
              setIsStreaming(false);
            } else if (status === "trigger_llm_debate") {
              // Top 5% anomaly — repurposed as "Alpha Alert"
              setMlResult(msg as MlResult);
              setStep("anomaly");
              es.close();
              setIsStreaming(false);
            } else if (status === "error") {
              setMlResult(msg as MlResult);
              setStep("error");
              es.close();
              setIsStreaming(false);
            } else if (status === "timeout") {
              setStep("timeout");
              es.close();
              setIsStreaming(false);
            }
          } catch {
            // Ignore parse errors on individual messages
          }
        };

        es.onerror = () => {
          if (cancelled) return;
          // EventSource auto-reconnects; if it truly fails,
          // the stream will timeout server-side and we'll get a timeout event.
          // Only set error if we haven't received any result yet.
          if (!mlResult) {
            setStep("error");
          }
          es.close();
          setIsStreaming(false);
        };
      } catch (err) {
        if (cancelled) return;
        setStep("error");
      }
    };

    run();

    // ── Cleanup on unmount or ticker change ──
    return () => {
      cancelled = true;
      closeStream();
      activeTicker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  return {
    legacyScores,
    mlResult,
    step,
    stepLabel: STEP_LABELS[step] || step,
    isStreaming,
    isAnomaly: step === "anomaly",
    isComplete: step === "complete" || step === "anomaly",
    isLoading: step !== "idle" && step !== "complete" && step !== "anomaly" && step !== "error" && step !== "timeout",
    reset,
  };
}
