"""
LogStack Client module.
"""

import json
import logging
import threading
import time
from typing import Any, Dict, List, Optional
import requests

logger = logging.getLogger("logstack")


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
    ):
        """
        Initialize the LogStack client.

        Args:
            api_key: Your LogStack API key
            api_url: The LogStack API URL
            environment: The environment name (e.g., "production", "development")
            flush_interval: How often to flush the batch (in seconds)
            batch_size: Maximum number of logs to batch before sending
        """
        self.api_key = api_key
        self.api_url = api_url.rstrip("/")
        self.environment = environment
        self.flush_interval = flush_interval
        self.batch_size = batch_size

        self._batch: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._flush_timer: Optional[threading.Timer] = None
        self._running = True

        # Start background flusher
        self._start_flush_timer()

    def _start_flush_timer(self) -> None:
        """Start the background flush timer."""
        if self._flush_timer:
            self._flush_timer.cancel()

        self._flush_timer = threading.Timer(self.flush_interval, self._flush_callback)
        self._flush_timer.daemon = True
        self._flush_timer.start()

    def _flush_callback(self) -> None:
        """Callback for the flush timer."""
        if self._running:
            self.flush()
            self._start_flush_timer()

    def _add_to_batch(self, level: str, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Add a log entry to the batch."""
        entry = {
            "level": level,
            "message": message,
            "metadata": metadata or {},
            "source": "python-sdk",
        }

        with self._lock:
            self._batch.append(entry)

            if len(self._batch) >= self.batch_size:
                self.flush()

    def info(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Send an info level log."""
        self._add_to_batch("info", message, metadata)

    def debug(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Send a debug level log."""
        self._add_to_batch("debug", message, metadata)

    def warn(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Send a warn level log."""
        self._add_to_batch("warn", message, metadata)

    def error(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Send an error level log."""
        self._add_to_batch("error", message, metadata)

    def critical(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Send a critical level log."""
        self._add_to_batch("critical", message, metadata)

    def fatal(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Send a fatal level log and flush immediately."""
        self._add_to_batch("fatal", message, metadata)
        self.flush()

    def flush(self) -> None:
        """Manually flush the batch of logs."""
        with self._lock:
            if not self._batch:
                return

            batch = self._batch.copy()
            self._batch.clear()

        self._send_batch(batch)

    def _send_batch(self, batch: List[Dict[str, Any]]) -> None:
        """Send a batch of logs to the API."""
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
            response.raise_for_status()
        except requests.RequestException as e:
            logger.error("Failed to send logs to Logstack: %s", e)

    def close(self) -> None:
        """Close the client and flush any pending logs."""
        self._running = False
        if self._flush_timer:
            self._flush_timer.cancel()
        self.flush()

    def __enter__(self) -> "LogStackClient":
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Context manager exit."""
        self.close()
