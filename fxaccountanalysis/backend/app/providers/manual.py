"""Credential-free provider backed by imported MT5 statement files.

Trade history arrives via ``POST /accounts/{id}/import`` rather than a live
broker connection, so no password or paid bridge is needed. Market data comes
from the free Yahoo Finance endpoint.
"""
from __future__ import annotations

from datetime import datetime

from app.providers.base import (
    AccountInfo,
    MT5Provider,
    ProviderCandle,
    ProviderCredentials,
    ProviderTrade,
)
from app.services.yahoo import fetch_yahoo_candles


class ManualProvider(MT5Provider):
    """No-op connection provider; history is supplied by file import."""

    name = "manual"

    async def verify(self, creds: ProviderCredentials) -> AccountInfo:
        # Nothing to authenticate against - the account is a local container for
        # imported trades. Balance/equity are derived from imported P/L later.
        return AccountInfo(
            provider_account_id=f"manual-{creds.login}",
            currency="USD",
            balance=0.0,
            equity=0.0,
        )

    async def fetch_trades(
        self, creds: ProviderCredentials, since: datetime | None = None
    ) -> list[ProviderTrade]:
        # A sync must not wipe imported history, so report "nothing new".
        return []

    async def fetch_candles(
        self,
        creds: ProviderCredentials,
        symbol: str,
        timeframe: str,
        start: datetime,
        end: datetime,
    ) -> list[ProviderCandle]:
        return await fetch_yahoo_candles(symbol, timeframe, start, end)
