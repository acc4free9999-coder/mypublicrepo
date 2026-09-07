from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Candle, TradingAccount
from app.providers import ProviderError, get_provider
from app.services.sync import credentials_for

TIMEFRAME_MINUTES = {"M1": 1, "M5": 5, "M15": 15, "M30": 30, "H1": 60, "H4": 240, "D1": 1440}

# One in-flight upstream fetch per (symbol, timeframe) to avoid stampedes.
_locks: dict[tuple[str, str], asyncio.Lock] = {}


def _lock_for(symbol: str, timeframe: str) -> asyncio.Lock:
    key = (symbol, timeframe)
    if key not in _locks:
        _locks[key] = asyncio.Lock()
    return _locks[key]


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _cached(db: Session, symbol: str, timeframe: str, start: datetime, end: datetime) -> list[Candle]:
    rows = db.scalars(
        select(Candle)
        .where(
            Candle.symbol == symbol,
            Candle.timeframe == timeframe,
            Candle.time >= start,
            Candle.time <= end,
        )
        .order_by(Candle.time)
    ).all()
    if not rows:
        return []
    freshest = max(_as_utc(r.fetched_at) for r in rows)
    if datetime.now(timezone.utc) - freshest > timedelta(seconds=settings.candle_cache_ttl_seconds):
        return []
    return list(rows)


async def get_candles(
    db: Session,
    account: TradingAccount,
    symbol: str,
    timeframe: str,
    start: datetime,
    end: datetime,
) -> list[Candle]:
    """Return OHLC candles, served from the DB cache when fresh."""
    timeframe = timeframe.upper()
    if timeframe not in TIMEFRAME_MINUTES:
        raise ProviderError(f"Unsupported timeframe '{timeframe}'")

    start, end = _as_utc(start), _as_utc(end)
    cached = _cached(db, symbol, timeframe, start, end)
    if cached:
        return cached

    async with _lock_for(symbol, timeframe):
        cached = _cached(db, symbol, timeframe, start, end)
        if cached:
            return cached

        provider = get_provider(account.provider)
        fetched = await provider.fetch_candles(
            credentials_for(account), symbol, timeframe, start, end
        )

        existing = {
            _as_utc(row.time)
            for row in db.scalars(
                select(Candle).where(
                    Candle.symbol == symbol,
                    Candle.timeframe == timeframe,
                    Candle.time >= start,
                    Candle.time <= end,
                )
            ).all()
        }
        now = datetime.now(timezone.utc)
        for candle in fetched:
            time = _as_utc(candle.time)
            if time in existing:
                continue
            db.add(
                Candle(
                    symbol=symbol,
                    timeframe=timeframe,
                    time=time,
                    open=candle.open,
                    high=candle.high,
                    low=candle.low,
                    close=candle.close,
                    volume=candle.volume,
                    fetched_at=now,
                )
            )
        db.commit()

        return db.scalars(
            select(Candle)
            .where(
                Candle.symbol == symbol,
                Candle.timeframe == timeframe,
                Candle.time >= start,
                Candle.time <= end,
            )
            .order_by(Candle.time)
        ).all()


def chart_window(
    open_time: datetime, close_time: datetime | None, timeframe: str
) -> tuple[datetime, datetime]:
    """Pad the trade window with context bars on each side."""
    step = timedelta(minutes=TIMEFRAME_MINUTES[timeframe])
    open_time = _as_utc(open_time)
    end = _as_utc(close_time) if close_time else datetime.now(timezone.utc)
    padding = step * 40
    return open_time - padding, end + padding
