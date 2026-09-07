"""Free OHLC market data via Yahoo Finance's public chart endpoint.

No API key or signup is required. MT5 broker symbols (which carry suffixes such
as ``EURUSDm`` or ``XAUUSD.raw`` on Exness) are normalised to Yahoo tickers.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

import httpx

from app.providers.base import ProviderCandle, ProviderError

logger = logging.getLogger(__name__)

BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart"

# Yahoo has no FX-style ticker for metals, so map them to the futures contract.
EXPLICIT_SYMBOLS = {
    "XAUUSD": "GC=F",
    "GOLD": "GC=F",
    "XAGUSD": "SI=F",
    "SILVER": "SI=F",
    "XTIUSD": "CL=F",
    "USOIL": "CL=F",
    "UKOIL": "BZ=F",
    "US30": "^DJI",
    "US500": "^GSPC",
    "SPX500": "^GSPC",
    "NAS100": "^NDC",
    "USTEC": "^IXIC",
    "GER40": "^GDAXI",
    "UK100": "^FTSE",
    "JP225": "^N225",
}

CRYPTO_BASES = {"BTC", "ETH", "XRP", "LTC", "BCH", "ADA", "SOL", "DOGE", "DOT"}
FIAT = {"USD", "EUR", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD", "SEK", "NOK", "ZAR", "MXN", "SGD"}

# MT5 timeframe -> (Yahoo interval, Yahoo range, max history days for that interval)
INTERVALS = {
    "M1": ("1m", 7),
    "M5": ("5m", 59),
    "M15": ("15m", 59),
    "M30": ("30m", 59),
    "H1": ("1h", 729),
    "H4": ("1h", 729),
    "D1": ("1d", 10000),
}

SUFFIX_RE = re.compile(r"[._\-]?(m|c|z|raw|pro|ecn|micro|std|s|\d+)$", re.IGNORECASE)


def normalise_symbol(symbol: str) -> str:
    """Strip broker-specific decorations from an MT5 symbol (EURUSDm -> EURUSD)."""
    cleaned = symbol.strip().upper()
    cleaned = re.sub(r"[^A-Z0-9._\-]", "", cleaned)
    if cleaned in EXPLICIT_SYMBOLS:
        return cleaned
    stripped = SUFFIX_RE.sub("", cleaned)
    # Only accept the strip if it leaves a plausible pair/instrument.
    if len(stripped) >= 6:
        return stripped
    return cleaned


def to_yahoo_symbol(symbol: str) -> str:
    """Map an MT5 symbol to its Yahoo Finance ticker."""
    base = normalise_symbol(symbol)
    if base in EXPLICIT_SYMBOLS:
        return EXPLICIT_SYMBOLS[base]
    if len(base) == 6:
        left, right = base[:3], base[3:]
        if left in CRYPTO_BASES and right in FIAT:
            return f"{left}-{right}"
        if left in FIAT and right in FIAT:
            return f"{base}=X"
    if base.endswith("USD") and base[:-3] in CRYPTO_BASES:
        return f"{base[:-3]}-USD"
    return base


def _pick_interval(timeframe: str, start: datetime) -> tuple[str, str]:
    """Choose a Yahoo interval/range pair, coarsening if history is too old."""
    interval, max_days = INTERVALS.get(timeframe, INTERVALS["M15"])
    age_days = (datetime.now(timezone.utc) - start).days

    # Yahoo only serves fine-grained intraday data for recent windows; fall back
    # to progressively coarser intervals for older trades instead of failing.
    if age_days > max_days:
        for candidate in ("5m", "15m", "30m", "1h", "1d"):
            candidate_max = {"5m": 59, "15m": 59, "30m": 59, "1h": 729, "1d": 10000}[candidate]
            if age_days <= candidate_max:
                interval = candidate
                break
        else:
            interval = "1d"
    return interval, str(interval)


async def fetch_yahoo_candles(
    symbol: str, timeframe: str, start: datetime, end: datetime
) -> list[ProviderCandle]:
    """Fetch OHLC candles covering [start, end]. Raises ProviderError on failure."""
    ticker = to_yahoo_symbol(symbol)
    interval, _ = _pick_interval(timeframe, start)

    # Pad the request window so the requested range is fully covered.
    params = {
        "interval": interval,
        "period1": str(int(start.timestamp())),
        "period2": str(int(end.timestamp())),
        "includePrePost": "false",
    }

    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            response = await client.get(
                f"{BASE_URL}/{ticker}",
                params=params,
                headers={"User-Agent": "Mozilla/5.0 (compatible; fxaccountanalysis/1.0)"},
            )
    except httpx.HTTPError as exc:
        raise ProviderError(
            f"Market data provider unreachable ({exc.__class__.__name__})"
        ) from exc

    if response.status_code == 429:
        raise ProviderError("Market data provider is rate limiting requests; try again shortly.")
    if response.status_code >= 400:
        raise ProviderError(
            f"Market data provider returned {response.status_code} for {ticker}"
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise ProviderError("Market data provider returned an invalid response") from exc

    chart = payload.get("chart") or {}
    if chart.get("error"):
        message = (chart["error"] or {}).get("description", "unknown error")
        raise ProviderError(f"No market data for {symbol} ({ticker}): {message}")

    results = chart.get("result") or []
    if not results:
        raise ProviderError(f"No market data available for {symbol} ({ticker})")

    result = results[0]
    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    opens, highs = quote.get("open") or [], quote.get("high") or []
    lows, closes = quote.get("low") or [], quote.get("close") or []
    volumes = quote.get("volume") or []

    candles: list[ProviderCandle] = []
    for index, ts in enumerate(timestamps):
        try:
            o, h, low, c = opens[index], highs[index], lows[index], closes[index]
        except IndexError:
            continue
        if None in (o, h, low, c):
            continue
        volume = volumes[index] if index < len(volumes) and volumes[index] is not None else 0.0
        candles.append(
            ProviderCandle(
                time=datetime.fromtimestamp(ts, tz=timezone.utc),
                open=float(o),
                high=float(h),
                low=float(low),
                close=float(c),
                volume=float(volume),
            )
        )

    if not candles:
        raise ProviderError(f"No market data returned for {symbol} ({ticker}) in that window")

    if timeframe == "H4":
        candles = _resample_to_h4(candles)
    return candles


def _resample_to_h4(candles: list[ProviderCandle]) -> list[ProviderCandle]:
    """Yahoo has no 4h interval; build it from hourly bars."""
    buckets: dict[int, list[ProviderCandle]] = {}
    for candle in candles:
        key = int(candle.time.timestamp() // 14400)
        buckets.setdefault(key, []).append(candle)

    resampled: list[ProviderCandle] = []
    for key in sorted(buckets):
        group = sorted(buckets[key], key=lambda c: c.time)
        resampled.append(
            ProviderCandle(
                time=datetime.fromtimestamp(key * 14400, tz=timezone.utc),
                open=group[0].open,
                high=max(c.high for c in group),
                low=min(c.low for c in group),
                close=group[-1].close,
                volume=sum(c.volume for c in group),
            )
        )
    return resampled
