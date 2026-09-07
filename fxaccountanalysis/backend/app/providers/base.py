from __future__ import annotations

import abc
from dataclasses import dataclass
from datetime import datetime


class ProviderError(RuntimeError):
    """Raised when the upstream MT5 bridge fails or credentials are invalid."""


@dataclass(slots=True)
class ProviderCredentials:
    login: str
    password: str
    server: str
    broker: str = "Exness"
    provider_account_id: str | None = None


@dataclass(slots=True)
class AccountInfo:
    provider_account_id: str
    currency: str
    balance: float
    equity: float


@dataclass(slots=True)
class ProviderTrade:
    ticket: str
    symbol: str
    direction: str  # "buy" | "sell"
    volume: float
    open_time: datetime
    close_time: datetime | None
    open_price: float
    close_price: float | None
    stop_loss: float | None
    take_profit: float | None
    profit: float
    commission: float
    swap: float
    is_open: bool
    comment: str | None = None


@dataclass(slots=True)
class ProviderCandle:
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class MT5Provider(abc.ABC):
    """Abstraction over an MT5 data source (statement import, native terminal, mock)."""

    name: str = "base"

    @abc.abstractmethod
    async def verify(self, creds: ProviderCredentials) -> AccountInfo:
        """Validate credentials and return account information."""

    @abc.abstractmethod
    async def fetch_trades(
        self, creds: ProviderCredentials, since: datetime | None = None
    ) -> list[ProviderTrade]:
        """Return closed deals plus currently open positions."""

    @abc.abstractmethod
    async def fetch_candles(
        self,
        creds: ProviderCredentials,
        symbol: str,
        timeframe: str,
        start: datetime,
        end: datetime,
    ) -> list[ProviderCandle]:
        """Return OHLC data for the requested window."""
