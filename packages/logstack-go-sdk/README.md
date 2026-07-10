# Logstack Go SDK

Official Go client for [Logstack](https://github.com/mosesedem/logstack) — structured
ingest, batching, and optional stdlib `log` capture.

**Docs:** [logstack.tech/docs/sdk/go](https://logstack.tech/docs/sdk/go) · monorepo guide [docs/SDK.md](../../docs/SDK.md)

## Installation

```bash
go get github.com/mosesedem/logstack/packages/logstack-go-sdk@v1.0.3
```

> Module tags are monorepo-style: `packages/logstack-go-sdk/vX.Y.Z`.

## Quick start

```go
package main

import (
	"context"
	"log"
	"os"

	logstack "github.com/mosesedem/logstack/packages/logstack-go-sdk"
)

func main() {
	client := logstack.NewClient(logstack.Config{
		APIKey:      os.Getenv("LOGSTACK_API_KEY"),
		// APIURL:  "http://localhost:8080", // self-hosted / local
		Environment: "production",
		// CaptureStdLog defaults to true
	})
	defer client.Close()

	ctx := context.Background()

	_ = client.Info(ctx, "Application started", map[string]interface{}{
		"version": "1.0.0",
	})
	_ = client.Error(ctx, "Database connection failed", map[string]interface{}{
		"host": "localhost:5432",
	})

	// Stdlib log package is auto-captured (source: "go-log")
	log.Printf("legacy log.Printf is shipped automatically")
}
```

## Configuration

| Field | Default | Description |
| --- | --- | --- |
| `APIKey` | — | Project key (`ls_live_…`) |
| `APIURL` | `https://api.logstack.tech` | Host only (SDK appends `/v1/logs`) |
| `Environment` | `production` | Batch environment label |
| `BatchSize` | `100` | Auto-flush size |
| `FlushInterval` | `5s` | Background flush |
| `CaptureStdLog` | `true` | Forward `log.Print*` — disable with `logstack.Bool(false)` |
| `OnError` | `nil` | Flush failure callback |

## API

- `Info` / `Debug` / `Warn` / `Error` / `Critical` / `Fatal` — all take `context.Context` + optional metadata
- `Flush` / `FlushContext` — send the buffer now
- `Close` — flush, stop ticker, restore stdlib log writer (idempotent)
- `Version` — SDK version string

Explicit calls use `source: "go-sdk"`. Captured stdlib lines use `source: "go-log"`.

## v1.0.3

- Automatic stdlib log capture (default on), re-entrancy guard, `Close()` restores writer

## v1.0.2

- Lowercase module path for pkg.go.dev

## v1.0.1

- Normalize API URL; idempotent `Close`; `FlushContext`; optional `OnError`

## License

MIT
