from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.providers.base import (
    AccountInfo,
    MT5Provider,
    ProviderCandle,
    ProviderCredentials,
    ProviderError,
    ProviderTrade,
)
from app.providers.demo import DemoProvider
from app.providers.manual import ManualProvider

__all__ = [
    "AccountInfo",
    "MT5Provider",
    "ProviderCandle",
    "ProviderCredentials",
    "ProviderError",
    "ProviderTrade",
    "PROVIDER_NAMES",
    "available_providers",
    "get_provider",
]

# All providers are free; "mt5" additionally requires Windows + the MT5 terminal.
PROVIDER_NAMES = ("manual", "demo", "mt5")


@lru_cache
def _demo() -> MT5Provider:
    return DemoProvider()


@lru_cache
def _manual() -> MT5Provider:
    return ManualProvider()


@lru_cache
def _native() -> MT5Provider:
    from app.providers.native_mt5 import NativeMT5Provider

    return NativeMT5Provider()


def get_provider(name: str | None = None) -> MT5Provider:
    provider_name = (name or settings.mt5_provider or "manual").lower()
    if provider_name == "manual":
        return _manual()
    if provider_name == "demo":
        return _demo()
    if provider_name == "mt5":
        return _native()
    raise ProviderError(
        f"Unsupported MT5 provider '{provider_name}'. Choose one of: {', '.join(PROVIDER_NAMES)}"
    )


def available_providers() -> list[str]:
    """Providers usable on this host. "mt5" needs the Windows-only MetaTrader5 package."""
    names = ["manual", "demo"]
    try:
        import MetaTrader5  # noqa: F401
    except Exception:
        return names
    return [*names, "mt5"]
