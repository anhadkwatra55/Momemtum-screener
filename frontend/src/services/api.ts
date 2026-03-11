/**
 * api.ts — MOMENTUM API Service Layer
 * ====================================
 * All HTTP calls to the Python backend.
 * This service aims for resilience, performance, and clear error handling,
 * reflecting Apple's reliability, Wealthsimple's perceived speed, and TradingView's data integrity.
 */

import type {
  DashboardData,
  BacktestResult,
  ReceiptsData,
  IndicatorMeta,
  SavedStrategy,
  DBStats,
  Signal,
  KPISummary,
  TickerChartData,
} from "@/types/momentum";
import {
  API_BASE,
  WS_BASE,
  API_MAX_RETRIES,
  API_RETRY_DELAY_MS,
  API_RETRY_BACKOFF_FACTOR, // Using this for WS as per existing usage, though ideally separate
  API_RETRYABLE_STATUS_CODES,
  API_DEFAULT_CACHE_TTL_SECONDS,
  WS_RECONNECT_INTERVAL_MS,
  WS_MAX_RECONNECT_ATTEMPTS,
  WS_HEARTBEAT_INTERVAL_MS,
  WS_HEARTBEAT_TIMEOUT_MS,
} from "@/lib/constants";

// Simple in-memory cache for GET requests. In a larger app, this would be a dedicated library (e.g., SWR, React Query).
const requestCache = new Map<string, { data: unknown; timestamp: number }>();

// ETag store — maps URL to { etag, cachedData } for conditional 304 responses
const etagStore = new Map<string, { etag: string; data: unknown }>();

// ── Centralized Telemetry & Error Logging Utility ──
// A production-grade telemetry service would integrate here to capture errors,
// user actions, and performance metrics. For this premium platform,
// robust error tracking is critical for reliability and user experience.
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function logTelemetry(level: LogLevel, message: string, error?: unknown, context?: Record<string, unknown>) {
  const logDetails = {
    timestamp: new Date().toISOString(),
    level,
    message,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    context,
  };

  // In development, log to console for immediate visibility.
  if (process.env.NODE_ENV === 'development') {
    if (level === 'error') console.error(`[Telemetry - ${level.toUpperCase()}]`, logDetails);
    else if (level === 'warn') console.warn(`[Telemetry - ${level.toUpperCase()}]`, logDetails);
    else console.log(`[Telemetry - ${level.toUpperCase()}]`, logDetails);
  }

  // In a production premium application, this would integrate with a robust observability stack:
  // - For 'error' and 'warn': Dedicated error tracking (e.g., Sentry, Datadog RUM, Splunk On-Call)
  //   Example: Sentry.captureException(error, { extra: { message, context, level } });
  // - For 'info' (important user actions, lifecycle events): Analytics platform (e.g., Amplitude, Google Analytics 4)
  //   Example: Analytics.track('API Call Success', { message, context, path: context?.url });
  // - For 'debug' (detailed logs): Centralized logging service (e.g., ELK Stack, Loggly, New Relic Logs)
  //   Example: Logger.debug(message, { ...context, error });
  // - For performance monitoring: APM tools (e.g., New Relic, Datadog APM, Prometheus)
  //   Example: APM.startSpan('apiFetch', { tags: { path, method } }).end();
}

// Wrapper for direct API service error logging, defaulting to 'error' level
function logServiceError(message: string, error?: unknown, context?: Record<string, unknown>) {
  logTelemetry('error', message, error, context);
}

// ── Custom API Error Class ──
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly statusText: string;
  public readonly body: unknown;

  constructor(statusCode: number, statusText: string, message: string, body: unknown = "") {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.statusText = statusText;
    this.body = body;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

// ── Extended Fetch Options for Resilience and Caching ──
interface ApiFetchOptions extends RequestInit {
  maxRetries?: number;
  retryDelayMs?: number;
  retryStatusCodes?: number[];
  cache?: boolean; // Enable simple in-memory caching for GET requests
  cacheTTLSeconds?: number; // Time-to-live for cache entry
  isIdempotent?: boolean; // Explicitly mark a POST/PUT/DELETE as idempotent for retries
}

/**
 * A generic API fetch wrapper with built-in resilience (retry mechanism with exponential backoff)
 * and optional client-side caching for GET requests. It ensures consistent error handling
 * and robust network operations for a premium trading platform experience.
 *
 * @template T The expected type of the JSON response.
 * @param {string} path The API endpoint path (e.g., "/api/data").
 * @param {ApiFetchOptions} [options] Extended `fetch` options, including retry and caching configurations.
 * @returns {Promise<T>} A promise that resolves with the parsed JSON response of type `T`.
 * @throws {ApiError} Throws a custom `ApiError` if the server responds with a non-OK status after all retries.
 * @throws {Error} Throws a generic `Error` for network issues or unexpected errors during the fetch operation.
 */
async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const url = `${API_BASE}${path}`;
  const method = options?.method?.toUpperCase() || "GET";
  const {
    maxRetries = API_MAX_RETRIES,
    retryDelayMs = API_RETRY_DELAY_MS,
    retryStatusCodes = API_RETRYABLE_STATUS_CODES,
    cache = false,
    cacheTTLSeconds = API_DEFAULT_CACHE_TTL_SECONDS,
    isIdempotent = false,
    ...fetchOptions
  } = options || {};

  const defaultHeaders = {
    "Content-Type": "application/json",
  };

  const currentHeaders = {
    ...defaultHeaders,
    ...fetchOptions.headers,
  };

  // ── Simple In-Memory Caching for GET Requests ──
  // Note: For a truly premium, scalable application, consider a dedicated library
  // like SWR or React Query for more advanced caching features (e.g., revalidation, UI integration).
  if (method === "GET" && cache) {
    const cachedEntry = requestCache.get(url);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < cacheTTLSeconds * 1000) {
      logTelemetry('debug', `[API Service] Cache hit for ${url}`);
      return cachedEntry.data as T;
    }
  }

  // ── Retry Logic ──
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Build headers — inject ETag If-None-Match for conditional requests
      const requestHeaders: Record<string, string> = { ...(currentHeaders as Record<string, string>) };
      if (method === "GET") {
        const stored = etagStore.get(url);
        if (stored?.etag) {
          requestHeaders["If-None-Match"] = `"${stored.etag}"`;
        }
      }

      const res = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
      });

      // ── ETag 304 Not Modified — return cached data instantly ──
      if (res.status === 304) {
        const stored = etagStore.get(url);
        if (stored?.data) {
          logTelemetry('debug', `[API Service] ETag 304 cache hit for ${url}`);
          return stored.data as T;
        }
      }

      if (!res.ok) {
        let errorBody: unknown;
        try {
          errorBody = await res.json();
        } catch (jsonError) {
          errorBody = await res.text();
          logServiceError(
            `Failed to parse API error response as JSON for ${path}. Falling back to text.`,
            jsonError,
            { url, status: res.status, statusText: res.statusText, attempt },
          );
        }

        // Determine if the request can be retried.
        // GET/HEAD are implicitly idempotent. For other methods, `isIdempotent` must be explicitly true.
        const canRetryMethod = ["GET", "HEAD"].includes(method) || (isIdempotent && ["POST", "PUT", "DELETE", "PATCH"].includes(method));
        const isRetryable = retryStatusCodes.includes(res.status) && canRetryMethod;

        if (isRetryable && attempt < maxRetries) {
          const delay = retryDelayMs * Math.pow(API_RETRY_BACKOFF_FACTOR, attempt);
          logTelemetry(
            'warn',
            `API Call to ${path} failed with status ${res.status}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}).`,
            null,
            { url, status: res.status, statusText: res.statusText, errorBody, attempt },
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue; // Continue to the next attempt
        }

        const errorMessage = `API Call to ${path} failed after ${attempt + 1} attempt(s) with status ${res.status} (${res.statusText}).`;
        logServiceError(errorMessage, null, { url, status: res.status, statusText: res.statusText, errorBody });
        throw new ApiError(res.status, res.statusText, errorMessage, errorBody);
      }

      if (res.status === 204 || res.headers.get("Content-Length") === "0") {
        return {} as T; // Return empty object for No Content
      }

      const data = await res.json();

      // Store ETag for future conditional requests
      const responseEtag = res.headers.get("etag")?.replace(/"/g, "");
      if (method === "GET" && responseEtag) {
        etagStore.set(url, { etag: responseEtag, data });
      }

      // Store in cache for GET requests
      if (method === "GET" && cache) {
        requestCache.set(url, { data, timestamp: Date.now() });
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error; // Re-throw custom API errors directly without additional logging, as it's already logged.
      }

      // Check if it's a network error (e.g., 'TypeError: Network request failed' in browsers)
      const isNetworkError = (error instanceof TypeError && error.message.includes("Network")) || (error instanceof Error && error.message.includes("Failed to fetch"));
      
      if (isNetworkError && attempt < maxRetries) {
        const delay = retryDelayMs * Math.pow(API_RETRY_BACKOFF_FACTOR, attempt);
        logTelemetry(
          'warn',
          `Network error during fetch to ${url}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}).`,
          error,
          { url, attempt },
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      const errorMessage = `Network or unexpected error during fetch to ${url} after ${attempt + 1} attempt(s): ${
        (error as Error).message
      }`;
      logServiceError(errorMessage, error, { url });
      throw new Error(errorMessage);
    }
  }
  logServiceError("API fetch failed after maximum retries. This code path should ideally be unreachable.", null, { path, options });
  throw new Error("Failed to fetch after multiple retries."); // Should not be reached if maxRetries is honored.
}


// ── Real-time Data Service (WebSockets) ──
// Inspired by TradingView's real-time updates, this service provides a robust
// interface for WebSocket communication, including automatic reconnection logic,
// message queuing, heartbeat mechanisms, and explicit subscription management.

// Define WebSocket Message Types for structured communication
interface BaseWebSocketMessage {
  type: string;
  requestId?: string; // For tracking request-response cycles
  timestamp?: number;
}

interface SubscribeMessage extends BaseWebSocketMessage {
  type: "subscribe";
  channel: string; // e.g., "ticker/AAPL", "chart/BTCUSD"
  params?: Record<string, unknown>; // Additional subscription parameters
}

interface UnsubscribeMessage extends BaseWebSocketMessage {
  type: "unsubscribe";
  channel: string;
}

interface HeartbeatPingMessage extends BaseWebSocketMessage {
  type: "ping";
  sequence: number;
}

interface HeartbeatPongMessage extends BaseWebSocketMessage {
  type: "pong";
  sequence: number;
}

interface DataUpdateMessage<T = unknown> extends BaseWebSocketMessage {
  type: "data_update";
  channel: string; // The channel this update belongs to
  payload: T;
}

interface ErrorMessage extends BaseWebSocketMessage {
  type: "error";
  code: number;
  message: string;
  details?: unknown;
}

type OutgoingWebSocketMessage = SubscribeMessage | UnsubscribeMessage | HeartbeatPingMessage | BaseWebSocketMessage;
type IncomingWebSocketMessage = DataUpdateMessage | HeartbeatPongMessage | ErrorMessage | BaseWebSocketMessage;

interface WebSocketServiceConfig {
  url: string;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
}

// A custom EventEmitter to allow components to subscribe to specific message types or channels.
// Uses `Set` for listeners to prevent duplicates and ensure efficient management.
class ChannelEventEmitter {
  private events: Map<string, Set<Function>> = new Map();

  // Overloads for known events without payload or with specific payload types
  on(event: 'open', listener: () => void): () => void;
  on(event: 'close', listener: (event: CloseEvent) => void): () => void;
  on(event: 'error', listener: (error: Event | Error) => void): () => void;
  on(event: 'message', listener: (message: IncomingWebSocketMessage) => void): () => void;
  on(event: 'pong', listener: (message: HeartbeatPongMessage) => void): () => void;
  // Generic overload for channel/type specific data updates
  on<T = unknown>(event: string, listener: (payload: T) => void): () => void;

  on(event: string, listener: Function): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(listener);
    return () => this.off(event, listener); // Return unsubscribe function
  }

  off(event: string, listener: Function): void {
    if (!this.events.has(event)) return;
    const listeners = this.events.get(event)!;
    listeners.delete(listener);
    if (listeners.size === 0) {
      this.events.delete(event);
    }
  }

  // Overloads for emit matching on()
  emit(event: 'open'): void;
  emit(event: 'close', closeEvent: CloseEvent): void;
  emit(event: 'error', error: Event | Error): void;
  emit(event: 'message', message: IncomingWebSocketMessage): void;
  emit(event: 'pong', message: HeartbeatPongMessage): void;
  emit<T>(event: string, payload: T): void; // For data_update channel/type or other specific payloads

  emit(event: string, ...args: unknown[]): void {
    if (this.events.has(event)) {
      this.events.get(event)!.forEach((listener) => listener(...args));
    }
  }
}

class RealtimeService {
  private ws: WebSocket | null = null;
  private config: WebSocketServiceConfig;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private eventEmitter: ChannelEventEmitter = new ChannelEventEmitter();
  private messageQueue: OutgoingWebSocketMessage[] = []; // Queue for messages sent before connection is open
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatSequence: number = 0;
  private subscriptions: Map<string, number> = new Map(); // channel -> refCount for managing server subscriptions

  // Promise for external awaiters of connection lifecycle, resolves on success or rejects on max retries
  private connectionAttemptPromise: Promise<void> | null = null;
  private connectionAttemptResolve: (() => void) | null = null;
  private connectionAttemptReject: ((reason?: any) => void) | null = null;

  constructor(config: WebSocketServiceConfig) {
    this.config = {
      reconnectIntervalMs: WS_RECONNECT_INTERVAL_MS,
      maxReconnectAttempts: WS_MAX_RECONNECT_ATTEMPTS,
      ...config,
    };
  }

  /**
   * Initializes the connection process. If already connecting or open, returns the existing promise.
   * Returns a promise that resolves when the connection is successfully established or rejects after max retries.
   */
  public async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve(); // Already connected
    }
    if (this.isConnecting && this.connectionAttemptPromise) {
      return this.connectionAttemptPromise; // Return existing connection promise
    }

    // If not connecting and no promise exists, create one
    if (!this.connectionAttemptPromise) {
      this.connectionAttemptPromise = new Promise<void>((resolve, reject) => {
        this.connectionAttemptResolve = resolve;
        this.connectionAttemptReject = reject;
      });
    }

    // Start or continue the connection attempt process
    this.attemptConnect();

    return this.connectionAttemptPromise;
  }

  /**
   * Internal method to actually attempt establishing a WebSocket connection.
   * Manages reconnection attempts and maximum retry limits.
   */
  private async attemptConnect(): Promise<void> {
    // If already connected or connecting via another path, exit.
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // Check if max reconnect attempts have been reached for this connection cycle
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || WS_MAX_RECONNECT_ATTEMPTS) && this.reconnectAttempts > 0) {
      logServiceError(`[RealtimeService] Max reconnect attempts reached for ${this.config.url}. Giving up.`);
      this.eventEmitter.emit("error", new Error("Max reconnect attempts reached."));
      this.clearAllTimeouts();
      this.isConnecting = false;
      this.connectionAttemptReject?.(new Error("Max reconnect attempts reached.")); // Reject the promise
      this.resetConnectionPromise();
      return;
    }

    this.isConnecting = true;
    this.clearReconnectTimeout(); // Clear any pending reconnection timer to avoid duplicates

    logTelemetry('info', `[RealtimeService] Attempting to connect to ${this.config.url}... (Attempt ${this.reconnectAttempts + 1})`);

    try {
      this.ws = new WebSocket(this.config.url);
      this.ws.onopen = this.onOpen.bind(this);
      this.ws.onmessage = this.onMessage.bind(this);
      this.ws.onclose = this.onClose.bind(this);
      this.ws.onerror = this.onError.bind(this);
    } catch (error) {
      logServiceError(`[RealtimeService] Failed to initialize WebSocket connection for ${this.config.url}`, error);
      this.handleConnectionFailure(error); // Handle immediate failure during WebSocket construction
    }
  }

  /**
   * Handles a connection failure, increments retry attempts, and schedules a new attempt with backoff.
   * Rejects the main connection promise if max attempts are reached.
   */
  private handleConnectionFailure(reason?: any): void {
    this.isConnecting = false;
    this.stopHeartbeat();
    this.reconnectAttempts++;

    const maxAttempts = (this.config.maxReconnectAttempts || WS_MAX_RECONNECT_ATTEMPTS);
    if (this.reconnectAttempts <= maxAttempts) {
      const delay = (this.config.reconnectIntervalMs || WS_RECONNECT_INTERVAL_MS) * Math.pow(API_RETRY_BACKOFF_FACTOR, this.reconnectAttempts - 1);
      this.reconnectTimeout = setTimeout(() => this.attemptConnect(), delay);
      logTelemetry('warn', `[RealtimeService] Connection failed. Retrying in ${delay}ms... (Attempt ${this.reconnectAttempts}/${maxAttempts})`);
    } else {
      logServiceError(`[RealtimeService] Max reconnect attempts reached for ${this.config.url}. Giving up.`);
      this.eventEmitter.emit("error", new Error("Max reconnect attempts reached."));
      this.clearAllTimeouts();
      this.ws = null;
      this.connectionAttemptReject?.(reason || new Error("Connection failed after multiple retries."));
      this.resetConnectionPromise();
    }
  }

  /**
   * Resets the internal promise tracking a connection attempt.
   */
  private resetConnectionPromise(): void {
    this.connectionAttemptPromise = null;
    this.connectionAttemptResolve = null;
    this.connectionAttemptReject = null;
  }

  private onOpen(): void {
    logTelemetry('info', `[RealtimeService] Connected to ${this.config.url}`);
    this.isConnecting = false;
    this.reconnectAttempts = 0; // Reset attempts on successful connection
    this.clearReconnectTimeout();
    this.startHeartbeat();
    this.flushQueue(); // Send any queued messages
    this.resubscribeToChannels(); // Re-subscribe to active channels
    this.eventEmitter.emit("open");
    this.connectionAttemptResolve?.(); // Resolve the main connection promise
    this.resetConnectionPromise();
  }

  private onMessage(event: MessageEvent): void {
    try {
      const message: IncomingWebSocketMessage = JSON.parse(event.data);
      if (message.type === "pong") {
        this.clearHeartbeatTimeout();
        logTelemetry('debug', `[RealtimeService] Received pong: ${message.sequence}`);
        this.eventEmitter.emit("pong", message as HeartbeatPongMessage);
      } else if (message.type === "data_update" && message.channel) {
        this.eventEmitter.emit(message.channel, message.payload); // Emit to specific channel listeners
      } else {
        // Fallback for generic messages or types not explicitly routed by channel
        this.eventEmitter.emit("message", message); // Emit generic 'message' for all raw incoming messages
        if (message.type) {
          this.eventEmitter.emit(message.type, message.payload); // Also emit specific message type events (e.g. 'auth_success')
        }
      }
    } catch (e) {
      logServiceError("[RealtimeService] Failed to parse WebSocket message:", e, { data: event.data });
      this.eventEmitter.emit("error", new Error("Failed to parse message"));
    }
  }

  private onClose(event: CloseEvent): void {
    logTelemetry(
      'info',
      `[RealtimeService] Disconnected from ${this.config.url}. Code: ${event.code}, Reason: ${event.reason}. Was clean: ${event.wasClean}`
    );
    this.isConnecting = false;
    this.stopHeartbeat();
    this.eventEmitter.emit("close", event);

    // If connection was not cleanly closed (e.g., server dropped, network issue)
    if (!event.wasClean) {
      this.handleConnectionFailure(new Error(`WebSocket closed uncleanly: Code ${event.code}, Reason: ${event.reason}`));
    } else {
      // Clean close (e.g., client initiated disconnect), reset state
      this.reconnectAttempts = 0;
      this.clearAllTimeouts();
      this.ws = null;
      this.resetConnectionPromise(); // Ensure promise is cleared if pending from a connect() call
    }
  }

  private onError(event: Event): void {
    logServiceError("[RealtimeService] WebSocket error:", event);
    this.eventEmitter.emit("error", event);

    // Force close to trigger onClose handler, which will then handle reconnection logic.
    // This ensures consistent failure handling through `handleConnectionFailure`.
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(4001, "WebSocket error occurred"); // Use a custom code for internal errors
    } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      // If error occurs during connection, but before onopen/onclose, close it to trigger onclose.
      this.ws.close(4001, "WebSocket connection error");
    } else {
      // If WebSocket is already closed or null, onclose won't fire. Handle failure directly.
      this.handleConnectionFailure(event);
    }
  }

  /**
   * Disconnects from the WebSocket server and stops all retry/heartbeat logic.
   * @param code A numeric status code indicating the reason for closing.
   * @param reason A human-readable string explaining why the connection is closing.
   */
  public disconnect(code: number = 1000, reason: string = "Client initiated disconnect"): void {
    logTelemetry('info', `[RealtimeService] Client initiated disconnect from ${this.config.url}`);
    this.clearAllTimeouts();
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.ws.close(code, reason);
    } else {
      logTelemetry('info', `[RealtimeService] Already disconnected or not connected to ${this.config.url}`);
    }
    this.ws = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.subscriptions.clear(); // Clear all subscriptions on explicit disconnect
    this.messageQueue = []; // Clear message queue
    this.resetConnectionPromise(); // Ensure any pending promise is cleared.
  }

  /**
   * Sends a message to the WebSocket server. Queues if not connected.
   * @param message The message object to send.
   */
  public send(message: OutgoingWebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (e) {
        logServiceError("[RealtimeService] Failed to send message:", e, { message });
        this.eventEmitter.emit("error", new Error("Failed to send message"));
      }
    } else {
      logTelemetry('warn', "[RealtimeService] WebSocket is not open. Queueing message.", null, { message });
      this.messageQueue.push(message);
      // Ensure a connection attempt is in progress if not already.
      if (!this.isConnecting && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
        this.connect();
      }
    }
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message); // `send` will now bypass queue if connected
      }
    }
  }

  /**
   * Subscribes to a specific real-time data channel. Manages reference counts for subscriptions.
   * Sends a `subscribe` message to the server if it's the first listener for this channel.
   *
   * @param channel The channel name (e.g., "ticker/AAPL", "chart/ETHUSD").
   * @param listener The callback function to invoke with data updates for this channel.
   * @param params Optional parameters to send with the subscribe message to the server.
   * @returns An unsubscribe function.
   */
  public subscribe<T = unknown>(channel: string, listener: (data: T) => void, params?: Record<string, unknown>): () => void {
    logTelemetry('debug', `[RealtimeService] Subscribing to channel: ${channel}`);
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, 0); // Initialize ref count
    }
    const refCount = this.subscriptions.get(channel)! + 1;
    this.subscriptions.set(channel, refCount);

    // If this is the first subscription for this channel and we are connected, send subscribe message
    if (refCount === 1 && this.isConnected()) {
      this.send({ type: "subscribe", channel, params, requestId: `sub-${channel}-${Date.now()}` });
    }

    const unsubscribeFromEmitter = this.eventEmitter.on(channel, listener);

    return () => this.unsubscribe(channel, listener, unsubscribeFromEmitter);
  }

  /**
   * Unsubscribes a listener from a channel. If no more listeners for the channel,
   * sends an `unsubscribe` message to the server.
   *
   * @param channel The channel name.
   * @param listener The listener function to remove.
   * @param eventEmitterUnsubscribe The unsubscribe function returned by the event emitter.
   */
  private unsubscribe(channel: string, listener: Function, eventEmitterUnsubscribe: () => void): void {
    logTelemetry('debug', `[RealtimeService] Unsubscribing from channel: ${channel}`);
    eventEmitterUnsubscribe(); // Remove from EventEmitter first

    if (this.subscriptions.has(channel)) {
      const refCount = this.subscriptions.get(channel)! - 1;
      this.subscriptions.set(channel, refCount);

      if (refCount <= 0) {
        this.subscriptions.delete(channel); // No more active listeners for this channel
        if (this.isConnected()) {
          this.send({ type: "unsubscribe", channel, requestId: `unsub-${channel}-${Date.now()}` });
        }
      }
    }
  }

  /**
   * Called on successful reconnection to resubscribe to all channels that still have active listeners.
   */
  private resubscribeToChannels(): void {
    logTelemetry('info', `[RealtimeService] Resubscribing to ${this.subscriptions.size} active channels.`);
    this.subscriptions.forEach((_refCount, channel) => {
      this.send({ type: "subscribe", channel, requestId: `resub-${channel}-${Date.now()}` });
    });
  }

  /**
   * Starts sending periodic ping messages to keep the connection alive and detect dead connections.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Ensure no duplicate intervals
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.heartbeatSequence++;
        this.send({ type: "ping", sequence: this.heartbeatSequence });
        logTelemetry('debug', `[RealtimeService] Sent ping: ${this.heartbeatSequence}`);

        this.heartbeatTimeout = setTimeout(() => {
          logServiceError(`[RealtimeService] Heartbeat timeout. No pong received for sequence ${this.heartbeatSequence}. Forcing disconnect.`);
          this.ws?.close(4000, "Heartbeat timeout"); // Force close if no pong, triggering reconnect
        }, WS_HEARTBEAT_TIMEOUT_MS);
      }
    }, WS_HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stops the heartbeat interval and timeout.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clearHeartbeatTimeout();
  }

  /**
   * Clears the pending heartbeat timeout.
   */
  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Clears the pending reconnection timeout.
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Clears all internal timers and timeouts used for reconnection and heartbeat.
   */
  private clearAllTimeouts(): void {
    this.clearReconnectTimeout();
    this.stopHeartbeat();
  }

  /**
   * Checks if the WebSocket connection is currently open.
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Event listener for general connection status or specific message types not routed by channel.
   * Use `subscribe` for channel-based data streams.
   *
   * @param event The event name ('open', 'close', 'error', 'message' for raw messages, 'pong', or a specific `type` from `BaseWebSocketMessage.type`).
   * @param listener The callback function.
   * @returns An unsubscribe function.
   */
  public on<T = unknown>(event: string, listener: (payload: T) => void): () => void {
    // Rely on the overloads in ChannelEventEmitter for specific types
    return this.eventEmitter.on(event, listener);
  }

  /**
   * Removes a general event listener.
   * @param event The event name.
   * @param listener The listener function to remove.
   */
  public off(event: string, listener: Function): void {
    this.eventEmitter.off(event, listener);
  }
}

// Instantiate the RealtimeService as a singleton.
export const realtimeService = new RealtimeService({ url: WS_BASE });


// ── API Endpoints ───────────────────────────────────────────────────────────
// All specific API calls leverage the enhanced apiFetch wrapper.

/**
 * Fetches core dashboard data from the API.
 *
 * @returns {Promise<DashboardData>} A promise that resolves with the dashboard's primary data.
 */
export async function fetchDashboardData(): Promise<DashboardData> {
  return apiFetch<DashboardData>("/momentum_data.json", { cache: true });
}

// ── Segmented Endpoints (progressive loading — avoid 10MB monolithic fetch) ──

/**
 * Fetches only the dashboard summary stats (~1KB). Tier 1 — instant render.
 */
export async function fetchSummary(): Promise<{ summary: KPISummary }> {
  return apiFetch<{ summary: KPISummary }>("/api/summary", { cache: true, cacheTTLSeconds: 60 });
}

/**
 * Fetches only the signals table (~1MB). Tier 2 — fast table render.
 */
export async function fetchSignals(): Promise<{ signals: Signal[] }> {
  return apiFetch<{ signals: Signal[] }>("/api/signals", { cache: true, cacheTTLSeconds: 60 });
}

/**
 * Fetches chart data for a single ticker on demand (~50KB). Tier 4 — lazy.
 */
export async function fetchTickerChart(ticker: string): Promise<{ ticker: string; charts: TickerChartData }> {
  return apiFetch<{ ticker: string; charts: TickerChartData }>(`/api/charts/${ticker.toUpperCase()}`, { cache: true, cacheTTLSeconds: 120 });
}

/**
 * Fetches derived signal lists (hidden gems, clusters, etc., ~500KB). Tier 3 — on demand.
 */
export async function fetchDerived(): Promise<Record<string, Signal[]>> {
  return apiFetch<Record<string, Signal[]>>("/api/derived", { cache: true, cacheTTLSeconds: 60 });
}

/**
 * Runs a market screener based on predefined criteria.
 *
 * @returns {Promise<DashboardData>} A promise that resolves with data representing the screened market view.
 */
export async function runScreen(): Promise<DashboardData> {
  return apiFetch<DashboardData>("/api/screen");
}

// ── Pipeline ──

/**
 * Retrieves the current status of the data processing pipeline.
 *
 * @returns {Promise<{ status: string; message?: string }>} A promise that resolves with the pipeline's status and an optional message.
 */
export async function getPipelineStatus(): Promise<{ status: string; message?: string }> {
  return apiFetch<{ status: string; message?: string }>("/api/pipeline/status", { cache: true, cacheTTLSeconds: 5 }); // Cache briefly
}

// ── Data Sync ──

/**
 * Initiates a data synchronization process for a specified period.
 *
 * @param {string} [period="1y"] The period for which to sync data (e.g., "1y", "5y", "max").
 * @returns {Promise<{ status: string; message: string }>} A promise that resolves with the status and message of the sync operation.
 */
export async function syncData(period = "1y"): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(`/api/data/sync?period=${period}`, { method: "POST", isIdempotent: true }); // Assume sync is idempotent
}

/**
 * Retrieves statistics about the current state of the database.
 *
 * @returns {Promise<DBStats>} A promise that resolves with database statistics.
 */
export async function getDataStatus(): Promise<DBStats> {
  const data = await apiFetch<{ stats: DBStats }>("/api/data/status", { cache: true, cacheTTLSeconds: 10 }); // Cache briefly
  return data.stats;
}

// ── Backtesting ──

/**
 * Parameters required to run a backtest.
 */
export interface BacktestParams {
  ticker?: string | null;
  systems?: number[];
  holding_period?: number;
  entry_threshold?: number;
  ensemble_k?: number | null;
  period?: string;
  initial_capital?: number;
  top_n?: number;
}

/**
 * Runs a backtest with the specified parameters.
 *
 * @param {BacktestParams} params The parameters for the backtest.
 * @param {AbortSignal} [signal] An AbortSignal to cancel the request.
 * @returns {Promise<BacktestResult>} A promise that resolves with the results of the backtest.
 */
export async function runBacktest(
  params: BacktestParams,
  signal?: AbortSignal,
): Promise<BacktestResult> {
  return apiFetch<BacktestResult>("/api/backtest", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
    isIdempotent: false, // Backtest is typically not idempotent; avoid retries on 5xx for POST
  });
}

/**
 * Cancels a specific currently running backtest identified by its ID.
 *
 * @param {string | number} backtestId The unique identifier of the backtest process to cancel.
 * @returns {Promise<void>} A promise that resolves when the cancellation request is successfully sent.
 */
export async function cancelBacktest(backtestId: string | number): Promise<void> {
  await apiFetch<void>(`/api/backtest/cancel/${backtestId}`, { method: "POST", isIdempotent: true }); // Cancellation can be idempotent
}

/**
 * Summary interface for backtest history items.
 * Enhances type safety by defining the structure of the summary field.
 */
export interface BacktestHistoryItemSummary {
  CAGR?: number;
  sharpe_ratio?: number;
  max_drawdown?: number;
  equity_peak?: number;
  equity_final?: number;
  [key: string]: unknown;
}

/**
 * Retrieves a history of past backtest runs.
 *
 * @param {number} [limit=20] The maximum number of history items to retrieve.
 * @returns {Promise<{ history: Array<{ id: number; run_time: string; params: BacktestParams; summary: BacktestHistoryItemSummary }> }>}
 *          A promise that resolves with an array of backtest history items, each containing ID, run time, parameters, and a summary.
 */
export async function getBacktestHistory(
  limit = 20,
): Promise<{
  history: Array<{ id: number; run_time: string; params: BacktestParams; summary: BacktestHistoryItemSummary }>;
}> {
  return apiFetch<{
    history: Array<{ id: number; run_time: string; params: BacktestParams; summary: BacktestHistoryItemSummary }>;
  }>(`/api/backtest/history?limit=${limit}`, { cache: true, cacheTTLSeconds: 30 });
}

/**
 * Retrieves the details and results of a specific backtest by its ID.
 *
 * @param {number} id The ID of the backtest to retrieve.
 * @returns {Promise<{ params: BacktestParams; results: BacktestResult }>} A promise that resolves with the backtest's parameters and results.
 */
export async function getBacktestById(
  id: number,
): Promise<{ params: BacktestParams; results: BacktestResult }> {
  return apiFetch<{ params: BacktestParams; results: BacktestResult }>(`/api/backtest/${id}`, { cache: true, cacheTTLSeconds: 30 });
}

// ── Strategy Engine ──

/**
 * Retrieves a list of available indicators and their metadata.
 *
 * @returns {Promise<IndicatorMeta[]>} A promise that resolves with an array of indicator metadata.
 */
export async function getIndicators(): Promise<IndicatorMeta[]> {
  const data = await apiFetch<{ indicators: IndicatorMeta[] }>("/api/indicators", { cache: true, cacheTTLSeconds: 3600 }); // Cache indicators for a long time
  return data.indicators;
}

/**
 * Parameters for running a strategy backtest, either visual or code-based.
 */
export interface StrategyEngineParams {
  strategy_id?: number;
  type: "visual" | "code";
  config?: Record<string, unknown>;
  code?: string;
  initial_capital?: number;
  period?: string;
  [key: string]: unknown;
}

/**
 * Runs a strategy backtest based on visual configuration.
 *
 * @param {StrategyEngineParams} params The parameters defining the strategy and backtest.
 * @param {AbortSignal} [signal] An AbortSignal to cancel the request.
 * @returns {Promise<BacktestResult>} A promise that resolves with the results of the strategy backtest.
 */
export async function runStrategyBacktest(
  params: StrategyEngineParams,
  signal?: AbortSignal,
): Promise<BacktestResult> {
  return apiFetch<BacktestResult>("/api/strategy/backtest", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
    isIdempotent: false,
  });
}

/**
 * Runs a strategy defined by custom code.
 *
 * @param {StrategyEngineParams} params The parameters including the strategy code to execute.
 * @param {AbortSignal} [signal] An AbortSignal to cancel the request.
 * @returns {Promise<BacktestResult & { error?: string; traceback?: string }>} A promise that resolves with the results of the code strategy, including potential error/traceback.
 */
export async function runCodeStrategy(
  params: StrategyEngineParams,
  signal?: AbortSignal,
): Promise<BacktestResult & { error?: string; traceback?: string }> {
  return apiFetch<BacktestResult & { error?: string; traceback?: string }>("/api/strategy/code", {
    method: "POST",
    body: JSON.stringify(params),
    signal,
    isIdempotent: false,
  });
}

/**
 * Parameters for saving a strategy.
 */
export interface SaveStrategyParams {
  name: string;
  type: "visual" | "code";
  config?: Record<string, unknown>;
  code?: string;
  description?: string;
  id?: number;
}

/**
 * Saves a new strategy or updates an existing one.
 *
 * @param {SaveStrategyParams} params The parameters for the strategy to be saved or updated.
 * @returns {Promise<{ id: number }>} A promise that resolves with the ID of the saved strategy.
 */
export async function saveStrategy(params: SaveStrategyParams): Promise<{ id: number }> {
  return apiFetch<{ id: number }>("/api/strategy/save", {
    method: "POST",
    body: JSON.stringify(params),
    isIdempotent: true, // Saving/updating a strategy can be considered idempotent if ID is provided
  });
}

/**
 * Lists all saved strategies.
 *
 * @returns {Promise<SavedStrategy[]>} A promise that resolves with an array of saved strategies.
 */
export async function listStrategies(): Promise<SavedStrategy[]> {
  const data = await apiFetch<{ strategies: SavedStrategy[] }>("/api/strategy/list", { cache: true, cacheTTLSeconds: 60 });
  return data.strategies;
}

/**
 * Loads a specific saved strategy by its ID.
 *
 * @param {number} id The ID of the strategy to load.
 * @returns {Promise<SavedStrategy>} A promise that resolves with the loaded strategy details.
 */
export async function loadStrategy(id: number): Promise<SavedStrategy> {
  return apiFetch<SavedStrategy>(`/api/strategy/${id}`, { cache: true, cacheTTLSeconds: 60 });
}

/**
 * Deletes a specific saved strategy by its ID.
 *
 * @param {number} id The ID of the strategy to delete.
 * @returns {Promise<void>} A promise that resolves when the deletion is successful.
 */
export async function deleteStrategy(id: number): Promise<void> {
  await apiFetch<void>(`/api/strategy/${id}/delete`, { method: "POST", isIdempotent: true }); // Deletion can be idempotent
}

// ── Ticker Search ──

/**
 * The structure of a single ticker search result.
 */
export interface TickerSearchResult {
  ticker: string;
  name: string;
  source: "db" | "yfinance";
}

/**
 * Searches for tickers based on a query string.
 *
 * @param {string} query The search query (e.g., "AAPL", "Apple").
 * @returns {Promise<TickerSearchResult[]>} A promise that resolves with an array of matching ticker results.
 */
export async function searchTicker(query: string): Promise<TickerSearchResult[]> {
  // Disabling caching for search results as they can be highly dynamic or short-lived data.
  // Real-world search often benefits from debounce and client-side filtering over caching API results.
  const data = await apiFetch<{ results: TickerSearchResult[] }>(
    `/api/ticker/search?q=${encodeURIComponent(query)}`,
    { cache: false }
  );
  return data.results;
}

/**
 * Adds one or more tickers to the platform's watchlist or internal database.
 *
 * @param {string[]} tickers An array of ticker symbols to add.
 * @returns {Promise<{ status: string }>} A promise that resolves with the status of the add operation.
 */
export async function addTicker(tickers: string[]): Promise<{ status: string }> {
  return apiFetch<{ status: string }>("/api/ticker/add", {
    method: "POST",
    body: JSON.stringify({ tickers }),
    isIdempotent: true, // Adding the same ticker multiple times might be idempotent on the backend
  });
}

// ── Receipts ──

/**
 * Fetches a list of transaction receipts.
 *
 * @param {number} [limit=50] The maximum number of receipts to retrieve.
 * @returns {Promise<ReceiptsData>} A promise that resolves with the receipts data.
 */
export async function fetchReceipts(limit = 50): Promise<ReceiptsData> {
  // Receipts are transactional, usually not cached at this layer, but a short cache might be useful for pagination.
  return apiFetch<ReceiptsData>(`/api/receipts?limit=${limit}`, { cache: true, cacheTTLSeconds: 10 });
}