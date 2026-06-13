# Logstack Go SDK

A Go SDK for the Logstack logging platform.

## Installation

```bash
go get github.com/mosesedem/logstack-go-sdk
```

## Usage

```go
package main

import (
    "context"
    "log"
    "github.com/mosesedem/logstack-go-sdk"
)

func main() {
    // Create a new client
    client := logstack.NewClient(logstack.Config{
        APIKey:    "your-api-key",
        APIURL:    "https://api.logstack.tech",
        Environment: "production",
    })
    defer client.Close()

    // Send a log
    ctx := context.Background()
    err := client.Info(ctx, "Application started", map[string]interface{}{
        "version": "1.0.0",
        "env": "production",
    })
    if err != nil {
        log.Printf("Failed to send log: %v", err)
    }

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

Creates a new Logstack client.

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
