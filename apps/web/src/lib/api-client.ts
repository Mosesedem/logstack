import { getSession, signOut } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/v1";
const isDev = process.env.NODE_ENV === "development";

// Structured API error matching backend ErrorResponse
export interface ApiError {
  code: string;
  message: string;
}

export class ApiClientError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "ApiClientError";
  }
}

// Environment-aware logging
const logger = {
  error: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.error(`[API Client] ${message}`, ...args);
    }
    // In production, you could send to an error tracking service
  },
  warn: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.warn(`[API Client] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.info(`[API Client] ${message}`, ...args);
    }
  },
  debug: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.debug(`[API Client] ${message}`, ...args);
    }
  },
};

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const session = await getSession();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (session?.accessToken) {
      headers["Authorization"] = `Bearer ${session.accessToken}`;
    }
    return headers;
  }

  private async handleResponse<T>(
    response: Response,
    path: string,
    options: RequestInit,
    retryCount = 0,
  ): Promise<T> {
    // Handle 401 Unauthorized - attempt token refresh
    if (response.status === 401 && retryCount < 1) {
      logger.warn("Received 401, attempting token refresh");

      try {
        await this.refreshSession();

        // Retry the request with new token
        const newHeaders = await this.getHeaders();
        const retryResponse = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers: newHeaders,
        });

        return this.handleResponse<T>(
          retryResponse,
          path,
          options,
          retryCount + 1,
        );
      } catch (refreshError) {
        logger.error("Token refresh failed, signing out", refreshError);
        // Force sign out on refresh failure
        await signOut({ redirect: true, callbackUrl: "/login" });
        throw new ApiClientError(
          "SESSION_EXPIRED",
          "Your session has expired. Please log in again.",
          401,
        );
      }
    }

    if (!response.ok) {
      let errorData: ApiError = {
        code: "UNKNOWN_ERROR",
        message: `HTTP error ${response.status}`,
      };

      try {
        const data = await response.json();
        // Handle both {code, message} and legacy {error} formats
        if (data.code && data.message) {
          errorData = data;
        } else if (data.error) {
          errorData = {
            code: "API_ERROR",
            message: data.error,
          };
        }
      } catch {
        // JSON parse failed, use default error
      }

      logger.error(`API Error [${response.status}]:`, errorData);
      throw new ApiClientError(
        errorData.code,
        errorData.message,
        response.status,
      );
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();
    logger.debug(`API Response [${path}]:`, data);
    return data;
  }

  private async refreshSession(): Promise<void> {
    // Deduplicate concurrent refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        // Force session refresh via NextAuth
        // This triggers the JWT callback which handles refresh
        const session = await getSession();
        if (session?.error === "RefreshAccessTokenError") {
          throw new Error("Refresh token expired");
        }
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async get<T>(path: string): Promise<T> {
    logger.debug(`GET ${path}`);
    const headers = await this.getHeaders();
    const options: RequestInit = { method: "GET", headers };
    const response = await fetch(`${this.baseUrl}${path}`, options);
    return this.handleResponse<T>(response, path, options);
  }

  async post<T>(path: string, data: unknown): Promise<T> {
    logger.debug(`POST ${path}`, data);
    const headers = await this.getHeaders();
    const options: RequestInit = {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    };
    const response = await fetch(`${this.baseUrl}${path}`, options);
    return this.handleResponse<T>(response, path, options);
  }

  async put<T>(path: string, data: unknown): Promise<T> {
    logger.debug(`PUT ${path}`, data);
    const headers = await this.getHeaders();
    const options: RequestInit = {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    };
    const response = await fetch(`${this.baseUrl}${path}`, options);
    return this.handleResponse<T>(response, path, options);
  }

  async patch<T>(path: string, data: unknown): Promise<T> {
    logger.debug(`PATCH ${path}`, data);
    const headers = await this.getHeaders();
    const options: RequestInit = {
      method: "PATCH",
      headers,
      body: JSON.stringify(data),
    };
    const response = await fetch(`${this.baseUrl}${path}`, options);
    return this.handleResponse<T>(response, path, options);
  }

  async delete<T>(path: string): Promise<T> {
    logger.debug(`DELETE ${path}`);
    const headers = await this.getHeaders();
    const options: RequestInit = { method: "DELETE", headers };
    const response = await fetch(`${this.baseUrl}${path}`, options);
    return this.handleResponse<T>(response, path, options);
  }
}

export const api = new ApiClient(API_URL);
export const apiClient = api;
