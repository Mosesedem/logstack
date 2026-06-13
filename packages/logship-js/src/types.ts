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
   * Environment mode. In 'development' mode, logs are only output to console.
   * In 'production' mode, logs are sent to the server.
   * Defaults to 'production' if not specified.
   */
  environment?: Environment;
  /**
   * Whether to also log to console in production mode.
   * Defaults to false.
   */
  consoleInProduction?: boolean;
  /**
   * Auto-capture context like URL, route, user agent.
   * Defaults to true.
   */
  captureContext?: boolean;
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
