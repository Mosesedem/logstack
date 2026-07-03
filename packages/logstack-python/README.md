# Logstack Python SDK

A Python SDK for the Logstack logging platform.

## Installation

```bash
pip install logstack-py
```

The import name is still `logstack` (e.g. `from logstack import LogStackClient`).

## v1.0.2

- **`capture_logging` default on.** Automatically forwards stdlib `logging` calls with
  `source: "python-logging"`. Original handlers (console, etc.) are preserved.
- Lowers root logger level when needed so `info` / `debug` records reach the capture handler.
- Skips re-entrant capture from the internal Logstack logger.

## v1.0.1

- Fix batch-flush deadlock when `batch_size` is reached
- Normalize API URL (strips redundant `/v1` suffix)
- Optional `on_error` callback; accepts HTTP 201 from ingest API
- `create_fastapi_middleware(client)` for proper FastAPI/Starlette integration

## Usage

### Basic Usage

```python
from logstack import LogStackClient

# Create a client
# capture_logging=True (default): any logging.getLogger(...).info / error etc.
# is automatically captured and sent with source="python-logging".
# Your normal logging configuration (console handlers etc.) continues to work.
client = LogStackClient(
    api_key="your-api-key",
    environment="production",
)

# Explicit structured logs
client.info("Application started", metadata={"version": "1.0.0"})
client.error("Database connection failed", metadata={"error": "connection refused"})

# Flush and close
client.close()
```

### Automatic stdlib logging capture

By default `capture_logging=True`. All Python `logging` calls across your app (including libraries) are forwarded:

```python
import logging
from logstack import LogStackClient

client = LogStackClient(api_key="...")  # capture_logging=True by default

log = logging.getLogger(__name__)
log.info("User action", extra={"user_id": 123})   # <- captured automatically
log.error("Failed to process")                    # <- captured as error level
```

The original log records still go to any handlers you have configured (StreamHandler, etc.).

Disable with `capture_logging=False` if you only want explicit `client.xxx()` calls.

### Using Context Manager

```python
from logstack import LogStackClient

with LogStackClient(api_key="your-api-key") as client:
    client.info("Application started")
    client.error("Something went wrong")
```

### Django Integration

```python
# settings.py
MIDDLEWARE = [
    # ...
    'logstack.middleware.DjangoMiddleware',
    # ...
]

# Or with custom client
MIDDLEWARE = [
    # ...
    'logstack.middleware.DjangoMiddleware',
    # ...
]

# In your code
from logstack import DjangoMiddleware, LogStackClient

client = LogStackClient(api_key="your-api-key")
middleware = DjangoMiddleware(get_response, client=client)
```

### FastAPI Integration

```python
from fastapi import FastAPI
from logstack import LogStackClient, FastAPIMiddleware

app = FastAPI()
client = LogStackClient(api_key="your-api-key")
FastAPIMiddleware(app, client=client)
```

## API Reference

### `LogStackClient(api_key, ..., capture_logging=True)`

Create a new Logstack client.

### `info(message, metadata=None)`

Send an info level log.

### `debug(message, metadata=None)`

Send a debug level log.

### `warn(message, metadata=None)`

Send a warn level log.

### `error(message, metadata=None)`

Send an error level log.

### `critical(message, metadata=None)`

Send a critical level log.

### `fatal(message, metadata=None)`

Send a fatal level log and flush immediately.

### `flush()`

Manually flush the batch of logs.

### `close()`

Close the client and flush any pending logs.

## License

MIT
