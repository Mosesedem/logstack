# Logstack SDK Documentation

Official clients for sending logs to Logstack. All SDKs POST to `{host}/v1/logs` with a project API key.

| Language | Package | Import / module | Docs (web) |
| --- | --- | --- | --- |
| **JavaScript / TypeScript** | [`logstack-js`](https://www.npmjs.com/package/logstack-js) | `import { createLogStack } from "logstack-js"` | [JS SDK](https://logstack.tech/docs/sdk/javascript) |
| **Go** | [`logstack-go-sdk`](https://pkg.go.dev/github.com/mosesedem/logstack/packages/logstack-go-sdk) | `github.com/mosesedem/logstack/packages/logstack-go-sdk` | [Go SDK](https://logstack.tech/docs/sdk/go) |
| **Python** | [`logstack-py`](https://pypi.org/project/logstack-py/) | `from logstack import LogStackClient` | [Python SDK](https://logstack.tech/docs/sdk/python) |

Monorepo sources: `packages/logstack-js`, `packages/logstack-go-sdk`, `packages/logstack-python`.

---

## Shared concepts

- **API key** — project key from the dashboard (`ls_live_…`)
- **Endpoint** — host only (e.g. `https://api.logstack.tech` or `http://localhost:8080`); SDKs append `/v1/logs` and strip a redundant trailing `/v1`
- **Levels** — `debug`, `info`, `warn`, `error`, `critical`, `fatal`
- **Metadata** — JSON object, searchable in the dashboard
- **Batching** — buffer + interval flush (typically 100 entries / ~5s)
- **Environment** — label on each batch (`production` | `staging` | `development` | `test`)
- **Auto-capture** — JS `console.*` · Go stdlib `log` · Python stdlib `logging` (all default **on**)

---

## JavaScript / TypeScript (`logstack-js`)

### Install

```bash
npm install logstack-js
```

### Quick start

```typescript
import { createLogStack } from "logstack-js";

const logstack = createLogStack({
  apiKey: "ls_live_xxx",
  // endpoint: "http://localhost:8080",
  // captureConsole: true (default)
});

logstack.info("User signed up", { userId: "user_123" });
logstack.error("Payment failed", { orderId: "ord_456" });
await logstack.close();
```

### Configuration (highlights)

| Option | Default | Notes |
| --- | --- | --- |
| `apiKey` | — | Required for shipping |
| `endpoint` | `https://api.logstack.tech` | Host only |
| `batchSize` | `100` | Auto-flush threshold |
| `flushInterval` | `5000` | ms |
| `captureConsole` | `true` | Forward `console.*` as `source: "console"` |
| `environment` | auto (`import.meta.env` → `NODE_ENV` → localhost → `production`) | Batch label + console gating |
| `disabled` | `false` | Console-only, no network |
| `onError` | — | `(error, logs) => void` |

Full guide: [apps/web content `sdk/javascript` + `sdk/configuration`](../apps/web/content/docs/sdk/javascript.mdx) or the live docs site.

---

## Go (`logstack-go-sdk`)

### Install

```bash
go get github.com/mosesedem/logstack/packages/logstack-go-sdk@v1.0.3
```

Tags are monorepo-style: `packages/logstack-go-sdk/vX.Y.Z`. Current version constant: `logstack.Version` (`1.0.3`).

### Quick start

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
		// APIURL: "http://localhost:8080",
		Environment: "production",
		// CaptureStdLog defaults to true
	})
	defer client.Close()

	ctx := context.Background()
	_ = client.Info(ctx, "Application started", map[string]interface{}{
		"version": "1.0.0",
	})

	// Auto-captured (source: "go-log")
	log.Printf("legacy log.Printf is shipped too")
}
```

### Configuration

| Field | Default | Notes |
| --- | --- | --- |
| `APIKey` | — | Required |
| `APIURL` | `https://api.logstack.tech` | Host only |
| `Environment` | `production` | Batch label |
| `BatchSize` | `100` | |
| `FlushInterval` | `5s` | |
| `CaptureStdLog` | `true` | Use `logstack.Bool(false)` to disable |
| `OnError` | `nil` | `func(err error, logs []LogEntry)` |

### Methods

`Info`, `Debug`, `Warn`, `Error`, `Critical`, `Fatal` (all take `context.Context` + optional metadata map), plus `Flush`, `FlushContext`, `Close` (idempotent).

Explicit calls use `source: "go-sdk"`. Package source: `packages/logstack-go-sdk`.

---

## Python (`logstack-py`)

### Install

```bash
pip install logstack-py
pip install "logstack-py[django]"    # optional
pip install "logstack-py[fastapi]"   # optional
```

Import name is **`logstack`** (not `logstack_py`).

### Quick start

```python
from logstack import LogStackClient

with LogStackClient(
    api_key="ls_live_xxx",
    environment="production",
    # capture_logging=True by default
) as client:
    client.info("Application started", metadata={"version": "1.0.0"})
    client.error("Payment failed", metadata={"orderId": "ord_123"})
```

### Configuration

| Parameter | Default | Notes |
| --- | --- | --- |
| `api_key` | — | Required |
| `api_url` | `https://api.logstack.tech` | Host only |
| `environment` | `production` | Batch label |
| `flush_interval` | `5.0` | seconds |
| `batch_size` | `100` | |
| `capture_logging` | `True` | Root logger handler |
| `on_error` | `None` | `Callable[[Exception, list], None]` |

### Methods

`debug`, `info`, `warn`, `error`, `critical`, `fatal` (fatal flushes), `flush`, `close`. Context manager supported (`with` → auto-close).

Explicit calls use `source: "python-sdk"`. Captured stdlib logs use `source: "python-logging"`.

### Django

```python
MIDDLEWARE = [
    # …
    "logstack.middleware.DjangoMiddleware",
]
```

Logs unhandled exceptions (path, method, user, IP, traceback).

### FastAPI

```python
from logstack import LogStackClient, create_fastapi_middleware

client = LogStackClient(api_key="…")
app.add_middleware(create_fastapi_middleware(client))
```

Package source: `packages/logstack-python`.

---

## Best practices (all languages)

1. **Structured metadata** — consistent keys (`userId`, `orderId`, not mixed styles)
2. **Source tagging** — use `source` / service name when the SDK allows custom entries
3. **Never log secrets** — passwords, tokens, full card numbers
4. **Flush on shutdown** — `close()` / `Close()` / context manager
5. **Handle flush errors** — `onError` / `OnError` / `on_error`

---

## Troubleshooting

| Issue | What to check |
| --- | --- |
| Logs missing | API key, network to host, error callback |
| Double `/v1` | Pass host only; SDKs normalize trailing `/v1` |
| Only some levels | Logger root level (Python capture); console filters (JS) |
| Memory pressure | Lower `batchSize` / faster flush interval |

---

## Related reference

- [API.md](./API.md) — REST ingest and query
- [BACKEND.md](./BACKEND.md) — Go server architecture
- Live docs: https://logstack.tech/docs/sdk/overview
