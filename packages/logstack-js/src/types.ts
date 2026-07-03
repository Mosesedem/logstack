export type LogLevel =
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "critical"
  | "fatal";

export type Environment = "development" | "production" | "staging" | "test";

export interface LogContext {
  /** Page URL or API endpoint where the log originated */
  url?: string;
  /** Route path (for framework routing) */
  route?: string;
  /** HTTP method (for API endpoints) */
  method?: string;
  /** User agent string */
  userAgent?: string;
  /** Client IP address */
  ip?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** Component or module name */
  component?: string;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
  /** Contextual information about where the log originated */
  context?: LogContext;
}

export interface LogRecord extends LogEntry {
  id: number;
  projectId: string;
  createdAt: string;
}

export interface LogQueryOptions {
  /** Filter by log level */
  level?: LogLevel;
  /** Search in message content */
  search?: string;
  /** Start time for date range filter (ISO 8601) */
  startTime?: string;
  /** End time for date range filter (ISO 8601) */
  endTime?: string;
  /** Number of records to skip */
  offset?: number;
  /** Maximum number of records to return (max 1000) */
  limit?: number;
}

export interface LogQueryResult {
  logs: LogRecord[];
  total: number;
  offset: number;
  limit: number;
}

export interface LogStackConfig {
  apiKey: string;
  endpoint?: string;
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  onError?: (error: Error, logs: LogEntry[]) => void;
  /**
   * Environment label attached to logs and used for console gating (see
   * `consoleInProduction`). Logs are sent to the server in every environment as
   * long as an `apiKey` is set and `disabled` is not true. Auto-detected from
   * `NODE_ENV` when omitted; defaults to 'production'.
   */
  environment?: Environment;
  /**
   * Whether to log to the console in production/staging mode. In development and
   * test, console output is always on (unless `silent`). Defaults to false, so
   * production stays quiet on the console while still shipping logs to the server.
   */
  consoleInProduction?: boolean;
  /**
   * Disable all console output regardless of environment. Defaults to false.
   */
  silent?: boolean;
  /**
   * Console-only mode: log to the console but never buffer, send, or queue to the
   * server. Use when no API key/endpoint is available (e.g. local dev without a
   * configured project). Defaults to false.
   */
  disabled?: boolean;
  /**
   * Maximum number of logs retained in the offline (localStorage) queue. Oldest
   * entries are dropped past this cap to avoid exceeding storage quota.
   * Defaults to 1000.
   */
  maxOfflineQueueSize?: number;
  /**
   * Auto-capture context like URL, route, user agent.
   * Defaults to true.
   */
  captureContext?: boolean;
  /**
   * Automatically capture calls to the global console (console.log, console.info,
   * console.warn, console.error, console.debug, console.trace, and console.assert)
   * and forward them to Logstack as structured logs (with source: "console").
   *
   * Original console output/behavior is always preserved first.
   * This is the recommended way to get "all my logs" with zero code changes.
   * Defaults to true. Set to false to disable auto-capture.
   */
  captureConsole?: boolean;
  /**
   * Project ID for query operations. Required for getLogs/getLogById.
   */
  projectId?: string;
}

export interface LogStackClient {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  critical(message: string, metadata?: Record<string, unknown>): void;
  fatal(message: string, metadata?: Record<string, unknown>): void;
  log(entry: LogEntry): void;
  flush(): Promise<void>;
  close(): Promise<void>;
  /** Set context that will be included with all subsequent logs */
  setContext(context: LogContext): void;
  /** Clear the current context */
  clearContext(): void;
  /** Query logs from the server (requires projectId in config) */
  getLogs(options?: LogQueryOptions): Promise<LogQueryResult>;
  /** Get a single log by ID (requires projectId in config) */
  getLogById(logId: number): Promise<LogRecord>;
}

/** Structured error from Logstack API */
export interface LogStackErrorResponse {
  code: string;
  message: string;
}

/** Error class for Logstack API errors */
export class LogStackError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "LogStackError";
  }
}
