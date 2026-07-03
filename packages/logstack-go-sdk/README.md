# Logstack Go SDK

A Go SDK for the Logstack logging platform.

## Installation

```bash
go get github.com/mosesedem/logstack/packages/logstack-go-sdk@v1.0.3
```

> Go modules in a monorepo subdir are tagged `packages/logstack-go-sdk/vX.Y.Z`.

## v1.0.3

- **Automatic stdlib log capture (default on).** `CaptureStdLog` (default `true`) forwards
  `log.Print*` / `log.Printf` output to Logstack with `source: "go-log"`. Original output is
  preserved. Set `CaptureStdLog: logstack.Bool(false)` to disable.
- Re-entrancy guard, idempotent install, and `Close()` restores the original `log` writer.

## v1.0.2

- Lowercase module path (`github.com/mosesedem/...`) so pkg.go.dev can index the package

## v1.0.1

- Normalize API URL (strips redundant `/v1` suffix)
- Idempotent `Close()`; `FlushContext(ctx)` for cancellable flushes
- Optional `OnError` callback; timed background flush

Access the release version via `logstack.Version`.

## Usage

```go
package main

import (
    "context"
    "log"

    logstack "github.com/mosesedem/logstack/packages/logstack-go-sdk"
)

func main() {
    // Create a new client (CaptureStdLog defaults to true)
    client := logstack.NewClient(logstack.Config{
        APIKey:      "your-api-key",
        APIURL:      "https://api.logstack.tech",
        Environment: "production",
    })
    defer client.Close()

    ctx := context.Background()

    // Explicit structured logs
    err := client.Info(ctx, "Application started", map[string]interface{}{
        "version": "1.0.0",
        "env":     "production",
    })
    if err != nil {
        log.Printf("Failed to send log: %v", err)
    }

    // Stdlib log package calls are auto-captured (source: "go-log") — like JS captureConsole
    log.Printf("Legacy log.Printf output is shipped automatically")

    // Send an error log
    err = client.Error(ctx, "Database connection failed", map[string]interface{}{
        "error": "connection refused",
        "host": "localhost:5432",
    })
    if err != nil {
        log.Printf("Failed to send log: %v", err)
    }
}
```

## API Reference

### `NewClient(config Config) *Client`

Creates a new Logstack client. With default `CaptureStdLog: true`, stdlib `log.Print*`
calls are forwarded automatically (`source: "go-log"`).

### `CaptureStdLog`

When `true` (default), redirects the Go stdlib `log` package output to Logstack while
preserving the original writer. Disable with `CaptureStdLog: logstack.Bool(false)`.

### `Info(ctx context.Context, message string, metadata ...map[string]interface{}) error`

Sends an info level log.

### `Debug(ctx context.Context, message string, metadata ...map[string]interface{}) error`

Sends a debug level log.

### `Warn(ctx context.Context, message string, metadata ...map[string]interface{}) error`

Sends a warn level log.

### `Error(ctx context.Context, message string, metadata ...map[string]interface{}) error`

Sends an error level log.

### `Critical(ctx context.Context, message string, metadata ...map[string]interface{}) error`

Sends a critical level log.

### `Fatal(ctx context.Context, message string, metadata ...map[string]interface{}) error`

Sends a fatal level log and immediately flushes.

### `Flush() error`

Manually flushes any pending logs.

### `Close() error`

Closes the client and flushes any pending logs.

## License

MIT
