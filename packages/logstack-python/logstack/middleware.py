"""
LogStack middleware for Django and FastAPI.
"""

import traceback
from typing import Any, Callable, Optional

from .client import LogStackClient


class DjangoMiddleware:
    """
    Django middleware to automatically log unhandled exceptions.
    """

    def __init__(self, get_response: Callable, client: Optional[LogStackClient] = None):
        self.get_response = get_response
        self.client = client

    def __call__(self, request):
        try:
            return self.get_response(request)
        except Exception:
            self._log_exception(request)
            raise

    def _log_exception(self, request) -> None:
        if not self.client:
            return

        exc_type, exc_value, exc_traceback = traceback.exc_info()
        traceback_str = "".join(
            traceback.format_exception(exc_type, exc_value, exc_traceback)
        )

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
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")


def create_fastapi_middleware(client: LogStackClient):
    """
    Return a Starlette-compatible middleware class that logs unhandled exceptions.
    """

    try:
        from starlette.middleware.base import BaseHTTPMiddleware
        from starlette.requests import Request
        from starlette.responses import Response
    except ImportError as exc:
        raise ImportError(
            "FastAPI/Starlette is required for create_fastapi_middleware. "
            "Install with: pip install logstack-py[fastapi]"
        ) from exc

    class LogStackExceptionMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next: Callable) -> Response:
            try:
                return await call_next(request)
            except Exception as exc:
                metadata = {
                    "path": request.url.path,
                    "method": request.method,
                    "traceback": str(exc),
                }
                client.error(
                    f"Unhandled exception in {request.url.path}",
                    metadata=metadata,
                )
                raise

    return LogStackExceptionMiddleware


class FastAPIMiddleware:
    """
    Deprecated alias — use create_fastapi_middleware(client) instead.
    """

    def __init__(self, app, client: Optional[LogStackClient] = None):
        if client is None:
            raise ValueError("client is required for FastAPIMiddleware")
        middleware_cls = create_fastapi_middleware(client)
        self.app = middleware_cls(app)

    async def __call__(self, scope, receive, send):
        await self.app(scope, receive, send)