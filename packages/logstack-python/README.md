# Logstack Python SDK

Official Python client for [Logstack](https://github.com/mosesedem/logstack) — structured
ingest, batching, stdlib `logging` capture, Django and FastAPI middleware.

**PyPI:** [`logstack-py`](https://pypi.org/project/logstack-py/) · **Import:** `logstack`  
**Docs:** [logstack.tech/docs/sdk/python](https://logstack.tech/docs/sdk/python) · monorepo guide [docs/SDK.md](../../docs/SDK.md)

## Installation

```bash
pip install logstack-py

# Optional
pip install "logstack-py[django]"
pip install "logstack-py[fastapi]"
```

## Quick start

```python
from logstack import LogStackClient

# capture_logging=True (default): stdlib logging is forwarded (source="python-logging")
client = LogStackClient(
    api_key="ls_live_xxx",
    environment="production",
    # api_url="http://localhost:8080",  # self-hosted / local
)

client.info("Application started", metadata={"version": "1.0.0"})
client.error("Database connection failed", metadata={"error": "connection refused"})
client.close()
```

Context manager:

```python
with LogStackClient(api_key="ls_live_xxx") as client:
    client.info("job started")
```

### Stdlib logging capture

```python
import logging
from logstack import LogStackClient

client = LogStackClient(api_key="…")  # capture on by default

log = logging.getLogger(__name__)
log.info("User action")   # shipped automatically
log.error("Failed job")
```

Disable with `capture_logging=False`.

## Django

```python
# settings.py
MIDDLEWARE = [
    # …
    "logstack.middleware.DjangoMiddleware",
]
```

Logs unhandled exceptions. See the [Python docs](https://logstack.tech/docs/sdk/python#django-integration).

## FastAPI

```python
from fastapi import FastAPI
from logstack import LogStackClient, create_fastapi_middleware

app = FastAPI()
client = LogStackClient(api_key="…")
app.add_middleware(create_fastapi_middleware(client))
```

## Configuration

| Parameter | Default | Description |
| --- | --- | --- |
| `api_key` | — | Project key |
| `api_url` | `https://api.logstack.tech` | Host only |
| `environment` | `production` | Batch label |
| `flush_interval` | `5.0` | Seconds |
| `batch_size` | `100` | Auto-flush size |
| `capture_logging` | `True` | Root logger handler |
| `on_error` | `None` | Failure callback |

## API

- `debug` / `info` / `warn` / `error` / `critical` / `fatal` (fatal flushes)
- `flush` / `close` (removes capture handler + final flush)
- Context manager: `__enter__` / `__exit__`

Explicit calls use `source: "python-sdk"`.

## v1.0.2

- `capture_logging` default on; root level adjustment; skip internal logger loops

## v1.0.1

- Batch-flush deadlock fix; URL normalize; `on_error`; `create_fastapi_middleware`

## License

MIT
