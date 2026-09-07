"""Native MetaTrader 5 terminal provider (free, Windows only).

Uses the official ``MetaTrader5`` package, which talks to a locally installed
MT5 terminal. This is completely free but only runs on Windows; on other
platforms the provider raises a clear error at construction time.

The MT5 package is not thread-safe and keeps global terminal state, so all
calls are serialised behind a lock and executed in a worker thread to avoid
blocking the event loop.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.providers.base import (
    AccountInfo,
    MT5Provider,
    ProviderCandle,
    ProviderCredentials,
    ProviderError,
    ProviderTrade,
)

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()


def _import_mt5():
    try:
        import MetaTrader5 as mt5  # type: ignore[import-not-found]
    except ImportError as exc:
        raise ProviderError(
            "The MetaTrader5 package is not installed. It is free but only runs "
            "on Windows with the MT5 terminal installed: pip install MetaTrader5. "
            "On macOS/Linux use the 'manual' provider and import an MT5 statement file."
        ) from exc
    return mt5


TIMEFRAME_ATTR = {
    "M1": "TIMEFRAME_M1",
    "M5": "TIMEFRAME_M5",
    "M15": "TIMEFRAME_M15",
    "M30": "TIMEFRAME_M30",
    "H1": "TIMEFRAME_H1",
    "H4": "TIMEFRAME_H4",
    "D1": "TIMEFRAME_D1",
}


class NativeMT5Provider(MT5Provider):
    """Reads directly from a locally running MT5 terminal."""

    name = "mt5"

    def __init__(self) -> None:
        # Fail fast with a helpful message rather than at first request.
        _import_mt5()

    # -- helpers -------------------------------------------------------
    @staticmethod
    def _connect(mt5, creds: ProviderCredentials) -> None:
        if not mt5.initialize():
            raise ProviderError(f"Could not start the MT5 terminal: {mt5.last_error()}")
        authorised = mt5.login(
            int(creds.login), password=creds.password, server=creds.server
        )
        if not authorised:
            mt5.shutdown()
            # Never include the password in the error surface.
            raise ProviderError(
                f"MT5 rejected the login for account {creds.login} on {creds.server}"
            )

    @staticmethod
    def _utc(value: float) -> datetime:
        return datetime.fromtimestamp(value, tz=timezone.utc)

    async def _run(self, func, creds: ProviderCredentials):
        async with _lock:
            return await asyncio.to_thread(func, _import_mt5(), creds)

    # -- interface -----------------------------------------------------
    async def verify(self, creds: ProviderCredentials) -> AccountInfo:
        def task(mt5, credentials: ProviderCredentials) -> AccountInfo:
            self._connect(mt5, credentials)
            try:
                info = mt5.account_info()
                if info is None:
                    raise ProviderError("MT5 did not return account information")
                return AccountInfo(
                    provider_account_id=str(info.login),
                    currency=info.currency or "USD",
                    balance=float(info.balance),
                    equity=float(info.equity),
                )
            finally:
                mt5.shutdown()

        return await self._run(task, creds)

    async def fetch_trades(
        self, creds: ProviderCredentials, since: datetime | None = None
    ) -> list[ProviderTrade]:
        def task(mt5, credentials: ProviderCredentials) -> list[ProviderTrade]:
            self._connect(mt5, credentials)
            try:
                start = since or datetime(2000, 1, 1, tzinfo=timezone.utc)
                end = datetime.now(timezone.utc) + timedelta(days=1)

                trades: list[ProviderTrade] = []
                deals = mt5.history_deals_get(start, end) or []

                # Group deals by position so entry and exit legs form one trade.
                positions: dict[int, list] = {}
                for deal in deals:
                    if getattr(deal, "position_id", 0):
                        positions.setdefault(deal.position_id, []).append(deal)

                for position_id, legs in positions.items():
                    legs.sort(key=lambda d: d.time)
                    entry = legs[0]
                    exits = [d for d in legs[1:] if d.entry == mt5.DEAL_ENTRY_OUT]
                    if not entry.symbol:
                        continue
                    close_leg = exits[-1] if exits else None
                    trades.append(
                        ProviderTrade(
                            ticket=str(position_id),
                            symbol=entry.symbol,
                            direction="buy" if entry.type == mt5.DEAL_TYPE_BUY else "sell",
                            volume=float(entry.volume),
                            open_time=self._utc(entry.time),
                            close_time=self._utc(close_leg.time) if close_leg else None,
                            open_price=float(entry.price),
                            close_price=float(close_leg.price) if close_leg else None,
                            stop_loss=None,
                            take_profit=None,
                            profit=float(sum(d.profit for d in legs)),
                            commission=float(sum(d.commission for d in legs)),
                            swap=float(sum(d.swap for d in legs)),
                            is_open=close_leg is None,
                            comment=entry.comment or None,
                        )
                    )

                for position in mt5.positions_get() or []:
                    trades.append(
                        ProviderTrade(
                            ticket=str(position.ticket),
                            symbol=position.symbol,
                            direction="buy"
                            if position.type == mt5.POSITION_TYPE_BUY
                            else "sell",
                            volume=float(position.volume),
                            open_time=self._utc(position.time),
                            close_time=None,
                            open_price=float(position.price_open),
                            close_price=None,
                            stop_loss=float(position.sl) or None,
                            take_profit=float(position.tp) or None,
                            profit=float(position.profit),
                            commission=0.0,
                            swap=float(position.swap),
                            is_open=True,
                            comment=position.comment or None,
                        )
                    )
                return trades
            finally:
                mt5.shutdown()

        return await self._run(task, creds)

    async def fetch_candles(
        self,
        creds: ProviderCredentials,
        symbol: str,
        timeframe: str,
        start: datetime,
        end: datetime,
    ) -> list[ProviderCandle]:
        def task(mt5, credentials: ProviderCredentials) -> list[ProviderCandle]:
            self._connect(mt5, credentials)
            try:
                attr = TIMEFRAME_ATTR.get(timeframe)
                if attr is None:
                    raise ProviderError(f"Unsupported timeframe '{timeframe}'")
                rates = mt5.copy_rates_range(symbol, getattr(mt5, attr), start, end)
                if rates is None or len(rates) == 0:
                    return []
                return [
                    ProviderCandle(
                        time=self._utc(row["time"]),
                        open=float(row["open"]),
                        high=float(row["high"]),
                        low=float(row["low"]),
                        close=float(row["close"]),
                        volume=float(row["tick_volume"]),
                    )
                    for row in rates
                ]
            finally:
                mt5.shutdown()

        candles = await self._run(task, creds)
        if not candles:
            # Fall back to the free web source when the terminal has no history.
            from app.services.yahoo import fetch_yahoo_candles

            return await fetch_yahoo_candles(symbol, timeframe, start, end)
        return candles
