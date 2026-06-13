# Logstack SDK Documentation

This guide covers the JavaScript/TypeScript SDK for sending logs to Logstack.

## Installation

```bash
npm install logstack-js
# or
yarn add logstack-js
# or
pnpm add logstack-js
```

## Quick Start

```typescript
import { createLogStack } from "logstack-js";

// Initialize the client
const logstack = createLogStack({
  apiKey: "ls_live_your_api_key_here",
});

// Send logs
logstack.info("User signed up", { userId: "user_123" });
logstack.warn("Rate limit approaching", { current: 90, limit: 100 });
logstack.error("Payment failed", {
  orderId: "order_456",
  error: "Card declined",
});
logstack.critical("Database connection lost", { host: "db.example.com" });
```

---

## Configuration Options

```typescript
const logstack = createLogStack({
  // Required: Your project API key
  apiKey: "ls_live_xxx",

  // Optional: API endpoint host (SDK appends /v1/logs). Defaults to
  // https://api.logstack.tech. For local dev: "http://localhost:8080".
  endpoint: "https://api.logstack.tech",

  // Optional: Number of logs to buffer before sending (default: 100)
  batchSize: 100,

  // Optional: Auto-flush interval in ms (default: 5000)
  flushInterval: 5000,

  // Optional: Max retry attempts for failed requests (default: 3)
  maxRetries: 3,

  // Optional: environment label ("development" | "staging" | "production" |
  // "test"). Auto-detected from NODE_ENV when omitted. Logs are sent to the
  // server in EVERY environment as long as apiKey is set and disabled is false.
  environment: "production",

  // Optional: also log to the console in production/staging. In development and
  // test the console is always on (unless `silent`). Default: false.
  consoleInProduction: false,

  // Optional: disable all console output. Default: false.
  silent: false,

  // Optional: console-only mode — log to the console but never buffer, send, or
  // queue. Use when no API key/endpoint is configured. Default: false.
  disabled: false,

  // Optional: cap on the offline (localStorage) queue; oldest entries are
  // dropped past this. Default: 1000.
  maxOfflineQueueSize: 1000,

  // Optional: Error callback
  onError: (error, logs) => {
    console.error("Failed to send logs:", error);
    // Optionally store logs locally for retry
  },
});
```

> **Console vs. server are independent.** Every log is written to the console
> (per the rules above) regardless of whether it is also shipped to the server.
> A missing API key degrades the client to console-only (`disabled`) — it never
> becomes a silent no-op.

---

## Log Levels

| Level      | Method               | Use Case                                        |
| ---------- | -------------------- | ----------------------------------------------- |
| `debug`    | `logstack.debug()`    | Verbose diagnostic detail (dev/troubleshooting) |
| `info`     | `logstack.info()`     | General information, successful operations      |
| `warn`     | `logstack.warn()`     | Warning conditions, potential issues            |
| `error`    | `logstack.error()`    | Error conditions, failed operations             |
| `critical` | `logstack.critical()` | Critical failures requiring immediate attention |
| `fatal`    | `logstack.fatal()`    | Unrecoverable failures / process-ending errors  |

---

## API Reference

### Basic Logging

```typescript
// Simple message
logstack.info("User logged in");

// With metadata
logstack.info("User logged in", {
  userId: "user_123",
  email: "user@example.com",
  ip: "192.168.1.1",
});
```

### Custom Log Entry

```typescript
logstack.log({
  level: "error",
  message: "Database query failed",
  source: "user-service",
  metadata: {
    query: "SELECT * FROM users",
    error: "Connection timeout",
    duration: 5000,
  },
});
```

### Manual Flush

```typescript
// Force send all buffered logs immediately
await logstack.flush();
```

### Graceful Shutdown

```typescript
// Flush and close the client
await logstack.close();
```

---

## Framework Integrations

### Express.js

```typescript
import express from "express";
import { createLogStack } from "logstack-js";

const app = express();
const logstack = createLogStack({ apiKey: process.env.LOGSTACK_API_KEY! });

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const level =
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logstack.log({
      level,
      message: `${req.method} ${req.path}`,
      source: "http",
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: Date.now() - start,
        userAgent: req.get("user-agent"),
        ip: req.ip,
      },
    });
  });

  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  logstack.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });
  res.status(500).json({ error: "Internal server error" });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await logstack.close();
  process.exit(0);
});
```

### Next.js (App Router)

```typescript
// lib/logstack.ts
import { createLogStack } from "logstack-js";

export const logstack = createLogStack({
  apiKey: process.env.LOGSTACK_API_KEY!,
});

// app/api/users/route.ts
import { logstack } from "@/lib/logstack";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data = await request.json();

    logstack.info("User created", { email: data.email });

    return NextResponse.json({ success: true });
  } catch (error) {
    logstack.error("Failed to create user", { error: error.message });

    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 },
    );
  }
}
```

### Fastify

```typescript
import Fastify from "fastify";
import { createLogStack } from "logstack-js";

const fastify = Fastify();
const logstack = createLogStack({ apiKey: process.env.LOGSTACK_API_KEY! });

fastify.addHook("onResponse", (request, reply, done) => {
  logstack.info(`${request.method} ${request.url}`, {
    statusCode: reply.statusCode,
    responseTime: reply.getResponseTime(),
  });
  done();
});

fastify.addHook("onClose", async () => {
  await logstack.close();
});
```

### NestJS

```typescript
// logstack.service.ts
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createLogStack, LogStackClient } from "logstack-js";

@Injectable()
export class LogStackService implements OnModuleDestroy {
  private client: LogStackClient;

  constructor() {
    this.client = createLogStack({
      apiKey: process.env.LOGSTACK_API_KEY!,
    });
  }

  info(message: string, metadata?: Record<string, unknown>) {
    this.client.info(message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>) {
    this.client.error(message, metadata);
  }

  async onModuleDestroy() {
    await this.client.close();
  }
}
```

---

## Best Practices

### 1. Structured Metadata

Use consistent metadata fields across your application:

```typescript
// Good: Consistent structure
logstack.info("Order placed", {
  orderId: "order_123",
  userId: "user_456",
  amount: 99.99,
  currency: "USD",
});

// Avoid: Inconsistent naming
logstack.info("Order placed", {
  order: "order_123", // vs orderId
  user_id: "user_456", // vs userId
});
```

### 2. Use Source Field

Categorize logs by service or component:

```typescript
logstack.log({
  level: "info",
  message: "Cache miss",
  source: "cache-service", // Helps filter in dashboard
  metadata: { key: "user:123" },
});
```

### 3. Don't Log Sensitive Data

```typescript
// Bad: Logging sensitive data
logstack.info("User authenticated", {
  email: user.email,
  password: user.password, // Never log passwords!
  creditCard: user.creditCard, // Never log payment info!
});

// Good: Log only necessary information
logstack.info("User authenticated", {
  userId: user.id,
  email: user.email, // OK if not sensitive in your context
});
```

### 4. Handle Errors Gracefully

```typescript
const logstack = createLogStack({
  apiKey: process.env.LOGSTACK_API_KEY!,
  onError: (error, logs) => {
    // Store failed logs locally
    console.error(`Failed to send ${logs.length} logs:`, error);

    // Optionally: Store in local file/database for retry
    // fs.appendFileSync('failed-logs.json', JSON.stringify(logs));
  },
});
```

### 5. Flush Before Exit

```typescript
// For CLI scripts
async function main() {
  logstack.info("Script started");

  // ... your code ...

  logstack.info("Script completed");
  await logstack.close(); // Ensure all logs are sent
}
```

---

## Troubleshooting

### Logs Not Appearing

1. Check your API key is correct
2. Ensure network connectivity to LogStack API
3. Check for errors in the `onError` callback
4. Verify the project exists in your dashboard

### High Memory Usage

Reduce batch size if buffering too many logs:

```typescript
const logstack = createLogStack({
  apiKey: "your-key",
  batchSize: 50, // Lower batch size
  flushInterval: 2000, // More frequent flushes
});
```

### Request Timeouts

The SDK automatically retries with exponential backoff. Configure max retries:

```typescript
const logstack = createLogStack({
  apiKey: "your-key",
  maxRetries: 5, // Increase retry attempts
});
```

---

## TypeScript Support

The SDK is fully typed. Import types as needed:

```typescript
import {
  createLogStack,
  LogLevel,
  LogEntry,
  LogStackConfig,
  LogStackClient,
} from "logstack-js";

const entry: LogEntry = {
  level: "error",
  message: "Something failed",
  source: "my-service",
  metadata: { code: 500 },
};

logstack.log(entry);
```
