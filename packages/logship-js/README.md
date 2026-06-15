# logstack-js

The JavaScript/TypeScript SDK for [Logstack](https://github.com/Mosesedem/logstack) — log
ingestion, real-time streaming, and querying.

## Installation

```bash
npm install logstack-js
# or: pnpm add logstack-js / yarn add logstack-js
```

## Quick start

```ts
import { createLogStack } from "logstack-js";

const logstack = createLogStack({
  apiKey: "ls_live_xxx",
  // endpoint host (SDK appends /v1/logs); defaults to https://api.logstack.tech
  // endpoint: "http://localhost:8080",
});

logstack.info("Application started", { version: "1.0.0" });
logstack.error("Payment failed", { orderId: "ord_123", code: 402 });

// flush + stop timers on shutdown
await logstack.close();
```

## Behavior

- **Console and server are independent.** Every log is written to the console (always in
  development/test; in production only when `consoleInProduction: true`, unless `silent`),
  and is *also* shipped to the server whenever an `apiKey` is set and `disabled` is false —
  in **all** environments.
- A missing API key should degrade the client to console-only (`disabled: true`); it must
  never become a silent no-op.
- Browser logs are queued to `localStorage` while offline (bounded by `maxOfflineQueueSize`,
  default 1000) and flushed on reconnect.

## Configuration

| Option | Default | Description |
| ------ | ------- | ----------- |
| `apiKey` | — | **Required.** Project API key (`ls_...`). |
| `endpoint` | `https://api.logstack.tech` | API host; the SDK appends `/v1/logs`. |
| `environment` | auto (`NODE_ENV`) | `development` \| `staging` \| `production` \| `test`. |
| `batchSize` | `100` | Logs buffered before an auto-flush. |
| `flushInterval` | `5000` | Auto-flush interval (ms). |
| `maxRetries` | `3` | Retry attempts for `5xx` responses. |
| `consoleInProduction` | `false` | Also log to console in production/staging. |
| `silent` | `false` | Disable all console output. |
| `disabled` | `false` | Console-only mode: never buffer, send, or queue. |
| `maxOfflineQueueSize` | `1000` | Cap on the offline (localStorage) queue. |
| `captureContext` | `true` | Auto-capture URL/route/user-agent in the browser. |
| `onError` | — | `(error, logs) => void` callback for send failures. |

## Log levels

`debug` · `info` · `warn` · `error` · `critical` · `fatal` — each available as a method, e.g.
`logstack.debug(message, metadata?)`.

## Querying

With `projectId` in the config you can read logs back:

```ts
const result = await logstack.getLogs({ level: "error", limit: 50 });
const one = await logstack.getLogById(12345);
```

Full reference: [docs/SDK.md](https://github.com/Mosesedem/logstack/blob/main/docs/SDK.md).

## License

MIT
