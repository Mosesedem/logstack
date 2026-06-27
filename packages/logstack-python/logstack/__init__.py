"""
LogStack Python SDK

A Python SDK for the LogStack logging platform.
"""

from .client import LogStackClient, normalize_api_url
from .middleware import DjangoMiddleware, FastAPIMiddleware, create_fastapi_middleware

__version__ = "1.0.1"
__all__ = [
    "LogStackClient",
    "normalize_api_url",
    "DjangoMiddleware",
    "FastAPIMiddleware",
    "create_fastapi_middleware",
]
