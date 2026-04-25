"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PipelineStatus } from "@/types/momentum";
import { API_BASE } from "@/lib/constants";

const _apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || API_BASE;
const WS_PIPELINE_URL = _apiBase.replace(/^http/, "ws") + "/ws/pipeline";

interface PipelineState {
  state: PipelineStatus;
  message: string;
  progress: number; // 0-100
}

interface UsePipelineStatusReturn extends PipelineState {
  connected: boolean;
}

/**
 * Connects to the backend WebSocket endpoint for real-time pipeline status.
 * Auto-reconnects on disconnect. When pipeline transitions running → done,
 * the consumer can trigger a data refresh.
 */
export function usePipelineStatus(
  onPipelineComplete?: () => void,
): UsePipelineStatusReturn {
  const [state, setState] = useState<PipelineState>({
    state: "idle",
    message: "",
    progress: 0,
  });
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStateRef = useRef<PipelineStatus>("idle");
  const onCompleteRef = useRef(onPipelineComplete);
  onCompleteRef.current = onPipelineComplete;

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const ws = new WebSocket(WS_PIPELINE_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "status" || msg.state) {
            const newState: PipelineStatus = msg.state || msg.status || "idle";
            setState({
              state: newState,
              message: msg.message || "",
              progress: msg.progress ?? 0,
            });
            // Detect running → done transition
            if (prevStateRef.current === "running" && newState === "done") {
              onCompleteRef.current?.();
            }
            prevStateRef.current = newState;
          }
        } catch {
          // Ignore non-JSON messages (heartbeats etc.)
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 5s
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket not available — silently fail
      reconnectTimeoutRef.current = setTimeout(connect, 10000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { ...state, connected };
}
