# Logstack Python SDK

A Python SDK for the Logstack logging platform.

## Installation

```bash
pip install logstack-py
```

The import name is still `logstack` (e.g. `from logstack import LogStackClient`).

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
client = LogStackClient(
    api_key="your-api-key",
    environment="production",
)

# Send logs
client.info("Application started", metadata={"version": "1.0.0"})
client.error("Database connection failed", metadata={"error": "connection refused"})

# Flush and close
client.close()
```

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

### `LogStackClient(api_key, api_url="https://api.logstack.tech", environment="production", flush_interval=5.0, batch_size=100)`

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
