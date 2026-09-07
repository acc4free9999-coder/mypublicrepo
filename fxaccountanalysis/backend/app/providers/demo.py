from __future__ import annotations

import hashlib
import logging
import random
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

# symbol -> (base price, per-bar volatility, pip size, USD value of 1 pip per lot)
SYMBOLS = {
    "EURUSD": (1.0850, 0.00035, 0.0001, 10.0),
    "GBPUSD": (1.2700, 0.00045, 0.0001, 10.0),
    "USDJPY": (151.20, 0.05, 0.01, 6.6),
    "XAUUSD": (2320.0, 2.5, 0.1, 10.0),
    "BTCUSD": (63000.0, 220.0, 1.0, 1.0),
}

TIMEFRAME_MINUTES = {"M1": 1, "M5": 5, "M15": 15, "M30": 30, "H1": 60, "H4": 240, "D1": 1440}


def _seed(*parts: str) -> int:
    return int(hashlib.sha256("|".join(parts).encode()).hexdigest()[:12], 16)


class DemoProvider(MT5Provider):
    """Deterministic synthetic MT5 bridge.

    Lets the full application run end-to-end without real broker credentials.
    Any non-empty credential set is accepted; data is derived from the login so
    the same account always yields the same history.
    """

    name = "demo"

    async def verify(self, creds: ProviderCredentials) -> AccountInfo:
        # No real broker is contacted, so only an account number is required.
        if not creds.login:
            raise ProviderError("An account number is required")
        if not creds.login.isdigit():
            raise ProviderError("MT5 login must be numeric")
        rng = random.Random(_seed(creds.login, creds.server))
        balance = round(rng.uniform(2_000, 50_000), 2)
        return AccountInfo(
            provider_account_id=f"demo-{creds.login}",
            currency="USD",
            balance=balance,
            equity=round(balance * rng.uniform(0.95, 1.08), 2),
        )

    async def fetch_trades(
        self, creds: ProviderCredentials, since: datetime | None = None
    ) -> list[ProviderTrade]:
        rng = random.Random(_seed(creds.login, creds.server, "trades"))
        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        trades: list[ProviderTrade] = []
        symbols = list(SYMBOLS)

        # ~18 months of history so day/week/month/year buckets are all populated.
        count = 420
        for i in range(count):
            symbol = symbols[rng.randrange(len(symbols))]
            base, vol_step, pip, pip_value = SYMBOLS[symbol]
            open_time = now - timedelta(
                minutes=rng.randint(0, 540 * 24 * 60 // 1)  # spread over ~540 days
            )
            duration = timedelta(minutes=rng.choice([12, 35, 90, 240, 600, 1500, 4300]))
            close_time = open_time + duration
            direction = rng.choice(["buy", "sell"])
            # Keep entries within the same distribution as generated candles so
            # markers always land inside the visible price range.
            open_price = round(base + rng.gauss(0, 1) * vol_step * 6, 5)
            move = rng.gauss(0.12, 1.0) * vol_step * 12
            close_price = round(open_price + (move if direction == "buy" else -move), 5)
            volume = round(rng.choice([0.01, 0.05, 0.1, 0.25, 0.5, 1.0]), 2)
            sign = 1 if direction == "buy" else -1
            raw_pips = (close_price - open_price) * sign / pip
            profit = round(raw_pips * pip_value * volume, 2)
            is_open = close_time > now

            trades.append(
                ProviderTrade(
                    ticket=f"{_seed(creds.login, str(i))%10**9}",
                    symbol=symbol,
                    direction=direction,
                    volume=volume,
                    open_time=open_time,
                    close_time=None if is_open else close_time,
                    open_price=open_price,
                    close_price=None if is_open else close_price,
                    stop_loss=round(open_price - sign * vol_step * 25, 5),
                    take_profit=round(open_price + sign * vol_step * 45, 5),
                    profit=0.0 if is_open else profit,
                    commission=0.0 if is_open else -round(volume * 3.5, 2),
                    swap=0.0 if is_open else round(rng.uniform(-1.5, 0.4), 2),
                    is_open=is_open,
                    comment="demo",
                )
            )

        if since:
            trades = [t for t in trades if (t.close_time or t.open_time) >= since]
        return trades

    async def fetch_candles(
        self,
        creds: ProviderCredentials,
        symbol: str,
        timeframe: str,
        start: datetime,
        end: datetime,
    ) -> list[ProviderCandle]:
        # Prefer real free market data; fall back to synthetic bars when offline
        # or when the instrument has no public feed.
        from app.services.yahoo import fetch_yahoo_candles

        try:
            return await fetch_yahoo_candles(symbol, timeframe, start, end)
        except ProviderError:
            logger.info("Falling back to synthetic candles for %s %s", symbol, timeframe)

        if symbol not in SYMBOLS:
            raise ProviderError(f"Unknown symbol {symbol}")
        step = timedelta(minutes=TIMEFRAME_MINUTES.get(timeframe, 15))
        base, vol_step, _, _ = SYMBOLS[symbol]
        candles: list[ProviderCandle] = []
        cursor = start
        guard = 0
        while cursor <= end and guard < 5000:
            guard += 1
            bucket = int(cursor.timestamp() // step.total_seconds())
            rng = random.Random(_seed(symbol, timeframe, str(bucket)))
            drift = rng.gauss(0, 1) * vol_step * 6
            o = round(base + drift, 5)
            c = round(o + rng.gauss(0, 1) * vol_step * 3, 5)
            h = round(max(o, c) + abs(rng.gauss(0, 1)) * vol_step * 2, 5)
            low = round(min(o, c) - abs(rng.gauss(0, 1)) * vol_step * 2, 5)
            candles.append(
                ProviderCandle(
                    time=cursor,
                    open=o,
                    high=h,
                    low=low,
                    close=c,
                    volume=round(rng.uniform(100, 5000), 2),
                )
            )
            cursor += step
        return candles
