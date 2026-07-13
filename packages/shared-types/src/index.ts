// Log types
export type LogLevel = 'info' | 'warn' | 'error' | 'critical';

export interface Log {
  id: string;
  projectId: string;
  level: LogLevel;
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface LogInput {
  level: LogLevel;
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface LogsResponse {
  logs: Log[];
  hasMore: boolean;
  offset: number;
}

export interface LogQuery {
  projectId: string;
  level?: LogLevel;
  search?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  offset?: number;
  limit?: number;
}

// User types
export interface User {
  id: string;
  email: string;
  escalationEmail?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
}

// Project types
export interface Project {
  id: string;
  userId: string;
  name: string;
  apiKey: string;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
}

// Alert types
export interface AlertRule {
  id: string;
  projectId: string;
  name: string;
  level: LogLevel;
  threshold: number;
  window: number;
  cooldown: number;
  emailEnabled: boolean;
  pushEnabled: boolean;
  enabled: boolean;
  createdAt: string;
}

export interface CreateAlertInput {
  name: string;
  level: LogLevel;
  threshold: number;
  window: number;
  cooldown: number;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  enabled?: boolean;
}

export interface UpdateAlertInput {
  name?: string;
  level?: LogLevel;
  threshold?: number;
  window?: number;
  cooldown?: number;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  enabled?: boolean;
}

export interface AlertHistory {
  id: string;
  ruleId: string;
  ruleName: string;
  level: LogLevel;
  message: string;
  logCount: number;
  triggeredAt: string;
}

// Push token types
export type PushPlatform = 'ios' | 'android' | 'web';

export interface PushToken {
  id: string;
  userId: string;
  token: string;
  platform: PushPlatform;
  createdAt: string;
}

export interface RegisterPushTokenInput {
  token: string;
  platform: PushPlatform;
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'log' | 'error' | 'connected';
  projectId?: string;
  log?: Log;
  error?: string;
}

// API Response types
export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  offset: number;
  total?: number;
}
