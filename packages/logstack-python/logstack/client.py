"""
LogStack Client module.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any, Callable, Dict, List, Optional

import requests

logger = logging.getLogger("logstack")

OnErrorCallback = Callable[[Exception, List[Dict[str, Any]]], None]


class _LogStackHandler(logging.Handler):
    """Internal handler that forwards stdlib logging records to Logstack client."""

    def __init__(self, client: "LogStackClient") -> None:
        super().__init__()
        self._client = client

    def emit(self, record: logging.LogRecord) -> None:
        # Avoid capturing our own internal logger messages (prevents potential loops)
        if record.name.startswith("logstack"):
            return
        try:
            msg = self.format(record)
        except Exception:
            msg = str(record.getMessage())

        level = self._map_level(record.levelno)

        metadata: Dict[str, Any] = {
            "logger": record.name,
        }
        if record.pathname:
            metadata["pathname"] = record.pathname
        if record.lineno:
            metadata["lineno"] = record.lineno
        if record.funcName:
            metadata["funcName"] = record.funcName
        if record.exc_text:
            metadata["exc_text"] = record.exc_text

        # Forward using the client's batching with special source for auto-captured
        self._client._add_to_batch(
            level=level,
            message=msg,
            metadata=metadata,
            source="python-logging",
        )

    @staticmethod
    def _map_level(levelno: int) -> str:
        if levelno >= logging.CRITICAL:
            return "critical"
        if levelno >= logging.ERROR:
            return "error"
        if levelno >= logging.WARNING:
            return "warn"
        if levelno >= logging.INFO:
            return "info"
        return "debug"


def normalize_api_url(raw: str) -> str:
    """Strip trailing slashes and a redundant /v1 suffix."""
    url = raw.rstrip("/")
    if url.endswith("/v1"):
        url = url[:-3]
    return url.rstrip("/")


class LogStackClient:
    """
    Main LogStack client for sending logs to the LogStack API.
    """

    def __init__(
        self,
        api_key: str,
        api_url: str = "https://api.logstack.tech",
        environment: str = "production",
        flush_interval: float = 5.0,
        batch_size: int = 100,
        on_error: Optional[OnErrorCallback] = None,
        # capture_logging: when True (default), automatically capture logs from
        # Python's stdlib logging module (any logger.info, root, etc). Captured
        # entries use source="python-logging". Original logging behavior is preserved.
        # Set False to only use explicit client calls.
        capture_logging: bool = True,
    ):
        self.api_key = api_key
        self.api_url = normalize_api_url(api_url)
        self.environment = environment
        self.flush_interval = flush_interval
        self.batch_size = batch_size
        self.on_error = on_error
        self._capture_logging = capture_logging

        self._batch: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._flush_timer: Optional[threading.Timer] = None
        self._running = True
        self._closed = False
        self._log_handler: Optional["_LogStackHandler"] = None

        self._start_flush_timer()

        if capture_logging:
            self._install_logging_capture()

    def _install_logging_capture(self) -> None:
        """Install a logging.Handler on the root logger to auto-capture stdlib logs."""
        handler = _LogStackHandler(self)
        self._log_handler = handler

        handler.setLevel(logging.DEBUG)

        # Add to root so that all loggers (unless they disable propagate) are captured.
        root_logger = logging.getLogger()
        # Idempotent: don't add duplicates
        if not any(isinstance(h, _LogStackHandler) for h in root_logger.handlers):
            root_logger.addHandler(handler)
            # Root defaults to WARNING; lower it so info/debug records reach handlers.
            if root_logger.getEffectiveLevel() > logging.INFO:
                root_logger.setLevel(logging.INFO)

    def _start_flush_timer(self) -> None:
        if not self._running:
            return
        if self._flush_timer:
            self._flush_timer.cancel()

        self._flush_timer = threading.Timer(self.flush_interval, self._flush_callback)
        self._flush_timer.daemon = True
        self._flush_timer.start()

    def _flush_callback(self) -> None:
        if self._running:
            self.flush()
            self._start_flush_timer()

    def _add_to_batch(
        self,
        level: str,
        message: str,
        metadata: Optional[Dict[str, Any]] = None,
        source: Optional[str] = None,
    ) -> None:
        entry = {
            "level": level,
            "message": message,
            "metadata": metadata or {},
            "source": source or "python-sdk",
        }

        batch_to_send: Optional[List[Dict[str, Any]]] = None
        with self._lock:
            if self._closed:
                return
            self._batch.append(entry)
            if len(self._batch) >= self.batch_size:
                batch_to_send = self._batch.copy()
                self._batch.clear()

        if batch_to_send:
            self._send_batch(batch_to_send)

    def info(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._add_to_batch("info", message, metadata)

    def debug(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._add_to_batch("debug", message, metadata)

    def warn(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._add_to_batch("warn", message, metadata)

    def error(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._add_to_batch("error", message, metadata)

    def critical(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._add_to_batch("critical", message, metadata)

    def fatal(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._add_to_batch("fatal", message, metadata)
        self.flush()

    def flush(self) -> None:
        with self._lock:
            if not self._batch:
                return
            batch = self._batch.copy()
            self._batch.clear()

        self._send_batch(batch)

    def _send_batch(self, batch: List[Dict[str, Any]]) -> None:
        if not batch:
            return

        payload = {
            "logs": batch,
            "environment": self.environment,
        }

        try:
            response = requests.post(
                f"{self.api_url}/v1/logs",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}",
                },
                timeout=10,
            )
            if response.status_code not in (200, 201):
                err = requests.HTTPError(
                    f"Logstack API error ({response.status_code}): {response.text}",
                    response=response,
                )
                raise err
        except requests.RequestException as exc:
            logger.error("Failed to send logs to Logstack: %s", exc)
            if self.on_error:
                self.on_error(exc, batch)

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
            self._running = False
        if self._flush_timer:
            self._flush_timer.cancel()

        # Remove our logging handler so we don't leak on root logger
        if self._log_handler:
            try:
                root = logging.getLogger()
                root.removeHandler(self._log_handler)
            except Exception:
                pass

        self.flush()

    def __enter__(self) -> "LogStackClient":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()