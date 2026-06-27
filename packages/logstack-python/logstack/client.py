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
    ):
        self.api_key = api_key
        self.api_url = normalize_api_url(api_url)
        self.environment = environment
        self.flush_interval = flush_interval
        self.batch_size = batch_size
        self.on_error = on_error

        self._batch: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._flush_timer: Optional[threading.Timer] = None
        self._running = True
        self._closed = False

        self._start_flush_timer()

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

    def _add_to_batch(self, level: str, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        entry = {
            "level": level,
            "message": message,
            "metadata": metadata or {},
            "source": "python-sdk",
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
        self.flush()

    def __enter__(self) -> "LogStackClient":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()