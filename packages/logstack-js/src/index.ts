import {
  LogEntry,
  LogStackConfig,
  LogStackClient,
  LogLevel,
  LogContext,
  Environment,
  LogQueryOptions,
  LogQueryResult,
  LogRecord,
  LogStackError,
  LogStackErrorResponse,
} from "./types";

/** SDK release version (matches npm package version). */
export const VERSION = "1.0.2";

const DEFAULT_ENDPOINT = "https://api.logstack.tech";

/** Strip trailing slashes and a redundant /v1 suffix from the API host. */
function normalizeEndpoint(raw: string): string {
  let url = raw.replace(/\/+$/, "");
  if (url.endsWith("/v1")) {
    url = url.slice(0, -3);
  }
  return url.replace(/\/+$/, "");
}

function parseApiErrorBody(
  data: unknown,
  fallback: LogStackErrorResponse,
): LogStackErrorResponse {
  if (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    "message" in data &&
    typeof (data as LogStackErrorResponse).code === "string" &&
    typeof (data as LogStackErrorResponse).message === "string"
  ) {
    return data as LogStackErrorResponse;
  }
  return fallback;
}
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_FLUSH_INTERVAL = 5000; // 5 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_OFFLINE_QUEUE = 1000;
const RETRY_BASE_DELAY = 1000; // 1 second
const OFFLINE_STORAGE_KEY = "logstack_offline_queue";
const OFFLINE_STORAGE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Console colors for development mode
const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[35m", // Magenta
  info: "\x1b[36m", // Cyan
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
  critical: "\x1b[41m\x1b[37m", // White on Red background
  fatal: "\x1b[45m\x1b[37m", // White on Magenta background
};
const RESET_COLOR = "\x1b[0m";

// Browser-safe console styling
const BROWSER_STYLES: Record<LogLevel, string> = {
  debug: "color: #a371f7; font-weight: bold",
  info: "color: #58a6ff; font-weight: bold",
  warn: "color: #d29922; font-weight: bold",
  error: "color: #f85149; font-weight: bold",
  critical:
    "background: #da3633; color: white; font-weight: bold; padding: 2px 6px; border-radius: 2px",
  fatal:
    "background: #8957e5; color: white; font-weight: bold; padding: 2px 6px; border-radius: 2px",
};

// Type-safe browser detection
function isBrowserEnvironment(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as Record<string, unknown>).window !== "undefined"
  );
}

type BrowserLocationLike = {
  href: string;
  pathname: string;
};

type BrowserNavigatorLike = {
  onLine: boolean;
  userAgent?: string;
};

type BrowserWindowLike = {
  location?: BrowserLocationLike;
  navigator?: BrowserNavigatorLike;
  addEventListener?: (event: string, listener: () => void) => void;
};

type BrowserStorageLike = {
  setItem: (key: string, value: string) => void;
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
};

function getBrowserWindow(): BrowserWindowLike | undefined {
  if (!isBrowserEnvironment()) {
    return undefined;
  }

  const win = (globalThis as Record<string, unknown>).window;
  if (typeof win !== "object" || win === null) {
    return undefined;
  }

  return win as BrowserWindowLike;
}

function getBrowserStorage(): BrowserStorageLike | undefined {
  if (!isBrowserEnvironment()) {
    return undefined;
  }

  const storage = (globalThis as Record<string, unknown>).localStorage;
  if (typeof storage !== "object" || storage === null) {
    return undefined;
  }

  return storage as BrowserStorageLike;
}

function getBrowserContext(): LogContext {
  const win = getBrowserWindow();
  if (!win) {
    return {};
  }

  return {
    url: win.location?.href,
    route: win.location?.pathname,
    userAgent: win.navigator?.userAgent,
  };
}

class LogStack implements LogStackClient {
  private config: Required<Omit<LogStackConfig, "onError" | "projectId">> &
    Pick<LogStackConfig, "onError" | "projectId">;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private isClosing = false;
  private globalContext: LogContext = {};
  private isBrowser: boolean;
  private isOnline: boolean = true;
  private offlineQueue: LogEntry[] = [];
  private offlineRetryTimer: ReturnType<typeof setInterval> | null = null;

  // For captureConsole support (auto-forwarding of native console.* by default)
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
    trace: typeof console.trace;
    assert: typeof console.assert;
  } | null = null;
  private consoleCaptureInstalled = false;
  private isCapturingConsole = false; // re-entrancy guard

  constructor(config: LogStackConfig) {
    this.isBrowser = isBrowserEnvironment();

    // Auto-detect environment if not specified
    const detectedEnvironment = this.detectEnvironment();

    this.config = {
      apiKey: config.apiKey,
      endpoint: normalizeEndpoint(config.endpoint || DEFAULT_ENDPOINT),
      batchSize: config.batchSize || DEFAULT_BATCH_SIZE,
      flushInterval: config.flushInterval || DEFAULT_FLUSH_INTERVAL,
      maxRetries: config.maxRetries || DEFAULT_MAX_RETRIES,
      environment: config.environment || detectedEnvironment,
      consoleInProduction: config.consoleInProduction || false,
      silent: config.silent || false,
      disabled: config.disabled || false,
      maxOfflineQueueSize:
        config.maxOfflineQueueSize ?? DEFAULT_MAX_OFFLINE_QUEUE,
      captureContext: config.captureContext !== false,
      captureConsole: config.captureConsole !== false,
      onError: config.onError,
      projectId: config.projectId,
    };

    // Start the flush timer whenever sending is enabled (any environment).
    if (!this.config.disabled) {
      this.startFlushTimer();
    }

    // Auto-capture browser context
    if (this.config.captureContext && this.isBrowser) {
      this.captureDefaultContext();
    }

    // Setup offline detection in browser (only relevant when sending is enabled)
    if (this.isBrowser && !this.config.disabled) {
      this.setupOfflineDetection();
      this.restoreOfflineQueue();
    }

    // Opt-in: capture native console calls and forward them (in addition to SDK calls)
    if (this.config.captureConsole) {
      this.installConsoleCapture();
    }
  }

  private detectEnvironment(): Environment {
    // Check common environment variables
    if (typeof process !== "undefined" && process.env) {
      const nodeEnv = process.env.NODE_ENV;
      if (nodeEnv === "development" || nodeEnv === "dev") return "development";
      if (nodeEnv === "test") return "test";
      if (nodeEnv === "staging") return "staging";
    }
    // Default to production for safety
    return "production";
  }

  private setupOfflineDetection(): void {
    const win = getBrowserWindow();
    if (!win) return;

    // Initial online status
    this.isOnline = win.navigator?.onLine ?? true;

    // Listen for online/offline events
    win.addEventListener?.("online", () => {
      this.isOnline = true;
      // Try to flush pending logs when coming back online
      this.flushOfflineQueue().catch(() => {});
    });

    win.addEventListener?.("offline", () => {
      this.isOnline = false;
    });
  }

  private async flushOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) {
      return;
    }

    const logsToSend = [...this.offlineQueue];
    this.offlineQueue = [];
    this.saveOfflineQueue();

    try {
      await this.sendLogs(logsToSend);
    } catch (error) {
      // Put logs back in queue if send fails
      this.offlineQueue = [...logsToSend, ...this.offlineQueue];
      this.saveOfflineQueue();
      throw error;
    }
  }

  private saveOfflineQueue(): void {
    if (!this.isBrowser) return;

    const storage = getBrowserStorage();
    if (!storage) return;

    try {
      const dataToStore = this.offlineQueue.map((log) => ({
        ...log,
        timestamp: log.timestamp || new Date().toISOString(),
        savedAt: new Date().getTime(),
      }));
      storage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(dataToStore));
    } catch (error) {
      // Silently fail if localStorage is not available
      if (this.config.onError && error instanceof Error) {
        this.config.onError(error, []);
      }
    }
  }

  private restoreOfflineQueue(): void {
    if (!this.isBrowser) return;

    const storage = getBrowserStorage();
    if (!storage) return;

    try {
      const stored = storage.getItem(OFFLINE_STORAGE_KEY);
      if (stored) {
        const logs = JSON.parse(stored) as Array<
          LogEntry & { savedAt: number }
        >;
        const now = new Date().getTime();

        // Filter out expired logs (older than 24 hours)
        this.offlineQueue = logs
          .filter((log) => now - log.savedAt < OFFLINE_STORAGE_TTL)
          .map(({ savedAt, ...log }) => log);

        this.saveOfflineQueue();
      }
    } catch (error) {
      // Silently fail if localStorage is not available
      storage.removeItem(OFFLINE_STORAGE_KEY);
    }
  }

  private isProductionMode(): boolean {
    return (
      this.config.environment === "production" ||
      this.config.environment === "staging"
    );
  }

  /**
   * Whether this log should be written to the console. Always on in
   * development/test; in production/staging only when consoleInProduction is set.
   * `silent` disables console output entirely.
   */
  private shouldLogToConsole(): boolean {
    if (this.config.silent) {
      return false;
    }
    if (this.isProductionMode()) {
      return this.config.consoleInProduction;
    }
    return true;
  }

  /**
   * Append logs to the offline queue, dropping the oldest entries past the
   * configured cap to avoid exceeding localStorage quota.
   */
  private enqueueOffline(logs: LogEntry[]): void {
    this.offlineQueue.push(...logs);
    const max = this.config.maxOfflineQueueSize;
    if (this.offlineQueue.length > max) {
      this.offlineQueue = this.offlineQueue.slice(-max);
    }
    this.saveOfflineQueue();
  }

  private captureDefaultContext(): void {
    this.globalContext = getBrowserContext();
  }

  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toISOString().replace("T", " ").slice(0, 23);
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = this.formatTimestamp(
      entry.timestamp || new Date().toISOString(),
    );
    const level = entry.level.toUpperCase().padEnd(8);

    // Use saved originals (if we are capturing console) so that SDK pretty-printing
    // never re-enters the capture wrappers and avoids double output / recursion.
    const c = this.originalConsole || console;

    if (this.isBrowser) {
      // Browser console with styling
      const style = BROWSER_STYLES[entry.level];
      const contextStr = entry.context?.url ? ` [${entry.context.url}]` : "";
      c.log(
        `%c${level}%c ${timestamp}${contextStr} - ${entry.message}`,
        style,
        "color: inherit",
        entry.metadata || "",
      );
    } else {
      // Node.js console with ANSI colors
      const color = LEVEL_COLORS[entry.level];
      const contextStr = entry.context?.url
        ? ` [${entry.context.url}]`
        : entry.context?.route
          ? ` [${entry.context.route}]`
          : "";
      const metaStr = entry.metadata
        ? ` ${JSON.stringify(entry.metadata)}`
        : "";
      c.log(
        `${color}${level}${RESET_COLOR} ${timestamp}${contextStr} - ${entry.message}${metaStr}`,
      );
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0 && !this.isFlushing) {
        this.flush().catch(() => {});
      }
    }, this.config.flushInterval);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  setContext(context: LogContext): void {
    this.globalContext = { ...this.globalContext, ...context };
  }

  clearContext(): void {
    this.globalContext = {};
    if (this.config.captureContext && this.isBrowser) {
      this.captureDefaultContext();
    }
  }

  /**
   * Install wrappers around global console methods so that calls like
   * console.log("foo") are also sent to Logstack (with source: "console").
   * Safe: ALWAYS calls the original first (output is never lost).
   * Re-entrancy guard prevents recursion. Uses originals for SDK pretty prints.
   */
  private installConsoleCapture(): void {
    if (typeof console === "undefined" || this.consoleCaptureInstalled) return;

    // Snapshot the real methods *before* we override anything. Store raw refs for clean restore + identity.
    this.originalConsole = {
      log: console.log,
      info: console.info || console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug || console.log,
      trace: console.trace || console.log,
      assert: (console.assert || console.log) as typeof console.assert,
    };

    const self = this;

    const formatArgs = (args: unknown[]) => {
      if (args.length === 0) return { message: "" };
      const [head, ...rest] = args;
      let message: string;
      const metadata: Record<string, unknown> = {};

      if (typeof head === "string") {
        message = head;
      } else {
        try {
          message = JSON.stringify(head);
        } catch {
          message = String(head);
        }
      }

      rest.forEach((arg, idx) => {
        if (arg != null && typeof arg === "object" && !Array.isArray(arg)) {
          Object.assign(metadata, arg as Record<string, unknown>);
        } else if (arg !== undefined) {
          metadata[`arg${idx + 1}`] = arg;
        }
      });

      return {
        message: message || "",
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      };
    };

    const capture = (
      level: LogLevel,
      args: unknown[],
      isAssertFail = false
    ) => {
      if (self.isCapturingConsole) return;
      self.isCapturingConsole = true;
      try {
        const { message, metadata } = formatArgs(args);
        const finalMessage = isAssertFail ? `Assertion failed: ${message}` : message;
        self.ingest(
          { level, message: finalMessage || message || "", metadata, source: "console" },
          true
        );
      } finally {
        self.isCapturingConsole = false;
      }
    };

    // Always call original FIRST, then capture. Guarded.
    console.log = function (...args: unknown[]) {
      self.originalConsole!.log.apply(console, args);
      capture("info", args);
    };

    console.info = function (...args: unknown[]) {
      self.originalConsole!.info.apply(console, args);
      capture("info", args);
    };

    console.warn = function (...args: unknown[]) {
      self.originalConsole!.warn.apply(console, args);
      capture("warn", args);
    };

    console.error = function (...args: unknown[]) {
      self.originalConsole!.error.apply(console, args);
      capture("error", args);
    };

    console.debug = function (...args: unknown[]) {
      self.originalConsole!.debug.apply(console, args);
      capture("debug", args);
    };

    console.trace = function (...args: unknown[]) {
      self.originalConsole!.trace.apply(console, args);
      // trace typically includes stack; forward as debug with source console
      capture("debug", args);
    };

    console.assert = function (condition?: unknown, ...args: unknown[]) {
      // Call original (which does nothing if true, prints if false in most envs)
      (self.originalConsole!.assert as any).apply(console, [condition, ...args]);
      if (!condition) {
        capture("error", args.length ? args : ["Assertion failed"], true);
      }
    };

    this.consoleCaptureInstalled = true;
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: "debug", message, metadata });
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: "info", message, metadata });
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: "warn", message, metadata });
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: "error", message, metadata });
  }

  critical(message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: "critical", message, metadata });
  }

  fatal(message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: "fatal", message, metadata });
  }

  log(entry: LogEntry): void {
    this.ingest(entry, false);
  }

  /**
   * Core ingest path. `fromConsoleCapture=true` means this came from a hijacked
   * console.* call: we still ship it, but skip our pretty-printer (the original
   * console call already produced output) to avoid duplicate lines.
   */
  private ingest(entry: LogEntry, fromConsoleCapture: boolean): void {
    if (this.isClosing) {
      // Use original if available to avoid any wrapper during shutdown
      const c = this.originalConsole || console;
      c.warn("Logstack: Cannot log after close() has been called");
      return;
    }

    const timestamp = entry.timestamp || new Date().toISOString();

    // Merge global context with entry context
    const context: LogContext = {
      ...this.globalContext,
      ...entry.context,
    };

    const logEntry: LogEntry = {
      ...entry,
      timestamp,
      context: Object.keys(context).length > 0 ? context : undefined,
    };

    // For normal SDK calls: optionally pretty-print to console (gated).
    // For captured console calls we skip this — the original call already showed it.
    if (!fromConsoleCapture && this.shouldLogToConsole()) {
      this.logToConsole(logEntry);
    }

    // Console-only mode: never buffer, send, or queue.
    if (this.config.disabled) {
      return;
    }

    // Offline: queue the log (bounded) for later delivery.
    if (!this.isOnline) {
      this.enqueueOffline([logEntry]);
      return;
    }

    // Online: buffer and ship to the server.
    this.buffer.push(logEntry);

    // Auto-flush if buffer reaches batch size
    if (this.buffer.length >= this.config.batchSize && !this.isFlushing) {
      this.flush().catch(() => {});
    }
  }

  async flush(): Promise<void> {
    // Nothing to ship in console-only mode.
    if (this.config.disabled) {
      return;
    }

    if (this.buffer.length === 0 || this.isFlushing) {
      return;
    }

    this.isFlushing = true;
    const logsToSend = [...this.buffer];
    this.buffer = [];

    try {
      await this.sendLogs(logsToSend);
    } catch (error) {
      // Auth failures are terminal — do not re-queue (avoids infinite 401 spam,
      // especially with captureConsole + console.error feedback loops).
      const authFailed =
        error instanceof LogStackError &&
        (error.status === 401 || error.status === 403);

      if (!authFailed) {
        this.buffer = [...logsToSend, ...this.buffer];
      }

      if (this.config.onError && error instanceof Error) {
        this.config.onError(error, logsToSend);
      }

      throw error;
    } finally {
      this.isFlushing = false;
    }
  }

  private async sendLogs(logs: LogEntry[], attempt = 1): Promise<void> {
    try {
      const response = await fetch(`${this.config.endpoint}/v1/logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          logs,
          environment: this.config.environment,
        }),
      });

      if (!response.ok) {
        // 401/403: invalid/revoked API key — stop shipping permanently.
        if (response.status === 401 || response.status === 403) {
          this.config.disabled = true;
          this.stopFlushTimer();
          let errorData: LogStackErrorResponse = {
            code: "INVALID_API_KEY",
            message: `Log ingest unauthorized (${response.status}) — shipping disabled`,
          };
          try {
            errorData = parseApiErrorBody(await response.json(), errorData);
          } catch {
            // keep default
          }
          throw new LogStackError(
            errorData.code,
            errorData.message,
            response.status,
          );
        }

        if (response.status >= 500 && attempt < this.config.maxRetries) {
          // Exponential backoff with jitter for server errors
          const delay =
            RETRY_BASE_DELAY * Math.pow(2, attempt - 1) + Math.random() * 100;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.sendLogs(logs, attempt + 1);
        }

        // Try to parse structured error response
        let errorData: LogStackErrorResponse = {
          code: "SEND_ERROR",
          message: `Failed to send logs: ${response.status}`,
        };

        try {
          errorData = parseApiErrorBody(await response.json(), errorData);
        } catch {
          // Use default error
        }

        throw new LogStackError(
          errorData.code,
          errorData.message,
          response.status,
        );
      }
    } catch (error) {
      if (error instanceof LogStackError) {
        throw error;
      }
      // Network error while online — queue for later (not for 4xx auth).
      if (this.isOnline && error instanceof Error) {
        this.enqueueOffline(logs);
        this.isOnline = false;
        throw error;
      }
      throw error;
    }
  }

  async getLogs(options: LogQueryOptions = {}): Promise<LogQueryResult> {
    if (!this.config.projectId) {
      throw new LogStackError(
        "MISSING_PROJECT_ID",
        "projectId is required in config for query operations",
        400,
      );
    }

    const params = new URLSearchParams();
    params.set("projectId", this.config.projectId);

    if (options.level) params.set("level", options.level);
    if (options.search) params.set("search", options.search);
    if (options.startTime) params.set("startTime", options.startTime);
    if (options.endTime) params.set("endTime", options.endTime);
    if (options.offset !== undefined)
      params.set("offset", String(options.offset));
    if (options.limit !== undefined) params.set("limit", String(options.limit));

    const response = await this.fetchWithRetry(
      `${this.config.endpoint}/v1/logs?${params.toString()}`,
      { method: "GET" },
    );

    // cast to expected result type
    return (await response.json()) as LogQueryResult;
  }

  async getLogById(logId: number): Promise<LogRecord> {
    if (!this.config.projectId) {
      throw new LogStackError(
        "MISSING_PROJECT_ID",
        "projectId is required in config for query operations",
        400,
      );
    }

    const params = new URLSearchParams();
    params.set("projectId", this.config.projectId);

    const response = await this.fetchWithRetry(
      `${this.config.endpoint}/v1/logs/${logId}?${params.toString()}`,
      { method: "GET" },
    );

    return (await response.json()) as LogRecord;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempt = 1,
  ): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status >= 500 && attempt < this.config.maxRetries) {
        // Exponential backoff with jitter
        const delay =
          RETRY_BASE_DELAY * Math.pow(2, attempt - 1) + Math.random() * 100;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, attempt + 1);
      }

      // Try to parse structured error response
      let errorData: LogStackErrorResponse = {
        code: "REQUEST_ERROR",
        message: `Request failed: ${response.status}`,
      };

      try {
        errorData = parseApiErrorBody(await response.json(), errorData);
      } catch {
        // Use default error
      }

      throw new LogStackError(
        errorData.code,
        errorData.message,
        response.status,
      );
    }

    return response;
  }

  async close(): Promise<void> {
    this.isClosing = true;
    this.stopFlushTimer();

    if (this.offlineRetryTimer) {
      clearInterval(this.offlineRetryTimer);
      this.offlineRetryTimer = null;
    }

    // Restore any captured console methods so the app returns to pristine state.
    if (this.consoleCaptureInstalled && this.originalConsole) {
      console.log = this.originalConsole.log;
      console.info = this.originalConsole.info;
      console.warn = this.originalConsole.warn;
      console.error = this.originalConsole.error;
      console.debug = this.originalConsole.debug;
      console.trace = this.originalConsole.trace;
      console.assert = this.originalConsole.assert;
      this.consoleCaptureInstalled = false;
      this.isCapturingConsole = false;
    }

    // Final flush of any buffered logs (no-op in console-only mode).
    if (!this.config.disabled && this.buffer.length > 0) {
      await this.flush();
    }

    // Try to flush offline queue if online
    if (this.isOnline && this.offlineQueue.length > 0) {
      try {
        await this.flushOfflineQueue();
      } catch {
        // Silently fail, logs are persisted in localStorage
      }
    }
  }
}

export function createLogStack(config: LogStackConfig): LogStackClient {
  return new LogStack(config);
}

export {
  LogLevel,
  LogEntry,
  LogStackConfig,
  LogStackClient,
  LogContext,
  Environment,
  LogQueryOptions,
  LogQueryResult,
  LogRecord,
  LogStackError,
  LogStackErrorResponse,
};
