"""
LogStack middleware for Django and FastAPI.
"""

import json
import traceback
from typing import Any, Dict, Optional


class DjangoMiddleware:
    """
    Django middleware to automatically log unhandled exceptions.
    """

    def __init__(self, get_response, client=None):
        """
        Initialize the middleware.

        Args:
            get_response: The next middleware or view in the chain
            client: LogStackClient instance (optional, creates one if not provided)
        """
        self.get_response = get_response
        self.client = client

    def __call__(self, request):
        """Handle the request."""
        try:
            return self.get_response(request)
        except Exception:
            self._log_exception(request)
            raise

    def _log_exception(self, request) -> None:
        """Log an exception with context."""
        if not self.client:
            return

        # Get exception info
        exc_type, exc_value, exc_traceback = traceback.exc_info()
        traceback_str = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))

        # Build metadata
        metadata = {
            "path": request.path,
            "method": request.method,
            "user": str(request.user) if hasattr(request, "user") else "anonymous",
            "ip": self._get_client_ip(request),
            "traceback": traceback_str,
        }

        self.client.error(
            f"Unhandled exception in {request.path}",
            metadata=metadata,
        )

    def _get_client_ip(self, request) -> str:
        """Get client IP address."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")


class FastAPIMiddleware:
    """
    FastAPI middleware to automatically log unhandled exceptions.
    """

    def __init__(self, app, client=None):
        """
        Initialize the middleware.

        Args:
            app: The FastAPI application
            client: LogStackClient instance (optional, creates one if not provided)
        """
        self.app = app
        self.client = client

        # Register exception handler
        async def exception_handler(request, exc):
            self._log_exception(request, exc)
            return await self.app.default_exception_handler(request, exc)

        app.add_exception_handler(Exception, exception_handler)

    async def __call__(self, scope, receive, send):
        """Handle the request."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        try:
            await self.app(scope, receive, send)
        except Exception as exc:
            self._log_exception(scope, exc)
            raise

    def _log_exception(self, scope, exc) -> None:
        """Log an exception with context."""
        if not self.client:
            return

        # Get request info
        path = scope.get("path", "/")
        method = scope.get("method", "GET")

        # Build metadata
        metadata = {
            "path": path,
            "method": method,
            "traceback": str(exc),
        }

        self.client.error(
            f"Unhandled exception in {path}",
            metadata=metadata,
        )
