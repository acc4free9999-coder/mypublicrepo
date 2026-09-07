from __future__ import annotations

from collections import OrderedDict
from datetime import datetime, timedelta, timezone

from app.models import Trade
from app.schemas import AnalyticsSummary, EquityPoint, PeriodStats, SymbolStats


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def bucket_bounds(moment: datetime, period: str) -> tuple[datetime, datetime, str]:
    moment = _as_utc(moment)
    day = moment.date()
    if period == "day":
        start = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
        return start, start + timedelta(days=1), day.isoformat()
    if period == "week":
        monday = day - timedelta(days=day.weekday())
        start = datetime.combine(monday, datetime.min.time(), tzinfo=timezone.utc)
        iso_year, iso_week, _ = monday.isocalendar()
        return start, start + timedelta(days=7), f"{iso_year}-W{iso_week:02d}"
    if period == "month":
        start = datetime(day.year, day.month, 1, tzinfo=timezone.utc)
        end = (
            datetime(day.year + 1, 1, 1, tzinfo=timezone.utc)
            if day.month == 12
            else datetime(day.year, day.month + 1, 1, tzinfo=timezone.utc)
        )
        return start, end, f"{day.year}-{day.month:02d}"
    if period == "year":
        start = datetime(day.year, 1, 1, tzinfo=timezone.utc)
        return start, datetime(day.year + 1, 1, 1, tzinfo=timezone.utc), str(day.year)
    raise ValueError(f"Unsupported period '{period}'")


def _net(trade: Trade) -> float:
    return trade.profit + trade.commission + trade.swap


def build_stats(
    label: str, start: datetime, end: datetime, trades: list[Trade]
) -> PeriodStats:
    nets = [_net(t) for t in trades]
    wins = [n for n in nets if n > 0]
    losses = [n for n in nets if n < 0]
    breakeven = len([n for n in nets if n == 0])
    gross_profit = round(sum(wins), 2)
    gross_loss = round(sum(losses), 2)
    decided = len(wins) + len(losses)

    return PeriodStats(
        period=label,
        period_start=start,
        period_end=end,
        total_trades=len(trades),
        wins=len(wins),
        losses=len(losses),
        breakeven=breakeven,
        win_rate=round(len(wins) / decided * 100, 2) if decided else 0.0,
        net_pl=round(sum(nets), 2),
        gross_profit=gross_profit,
        gross_loss=gross_loss,
        average_win=round(gross_profit / len(wins), 2) if wins else 0.0,
        average_loss=round(gross_loss / len(losses), 2) if losses else 0.0,
        profit_factor=round(gross_profit / abs(gross_loss), 2) if gross_loss else None,
        largest_win=round(max(wins), 2) if wins else 0.0,
        largest_loss=round(min(losses), 2) if losses else 0.0,
    )


def build_summary(
    trades: list[Trade], period: str, starting_balance: float = 0.0
) -> AnalyticsSummary:
    closed = sorted(
        [t for t in trades if not t.is_open and t.close_time],
        key=lambda t: _as_utc(t.close_time),
    )

    buckets: "OrderedDict[str, tuple[datetime, datetime, list[Trade]]]" = OrderedDict()
    for trade in closed:
        start, end, label = bucket_bounds(trade.close_time, period)
        buckets.setdefault(label, (start, end, []))[2].append(trade)

    bucket_stats = [
        build_stats(label, start, end, rows) for label, (start, end, rows) in buckets.items()
    ]

    equity = starting_balance
    curve: list[EquityPoint] = []
    for trade in closed:
        equity = round(equity + _net(trade), 2)
        curve.append(EquityPoint(time=_as_utc(trade.close_time), equity=equity))

    by_symbol: dict[str, list[Trade]] = {}
    for trade in closed:
        by_symbol.setdefault(trade.symbol, []).append(trade)

    symbol_stats = sorted(
        (
            SymbolStats(
                symbol=symbol,
                total_trades=stats.total_trades,
                wins=stats.wins,
                losses=stats.losses,
                win_rate=stats.win_rate,
                net_pl=stats.net_pl,
            )
            for symbol, rows in by_symbol.items()
            for stats in [build_stats(symbol, _as_utc(rows[0].close_time), _as_utc(rows[-1].close_time), rows)]
        ),
        key=lambda s: s.net_pl,
        reverse=True,
    )

    now = datetime.now(timezone.utc)
    overall_start = _as_utc(closed[0].close_time) if closed else now
    overall_end = _as_utc(closed[-1].close_time) if closed else now
    overall = build_stats("overall", overall_start, overall_end, closed)

    return AnalyticsSummary(
        period=period,  # type: ignore[arg-type]
        overall=overall,
        buckets=bucket_stats,
        equity_curve=curve,
        by_symbol=symbol_stats,
    )


def suggest_timeframe(open_time: datetime, close_time: datetime | None) -> str:
    """Pick a chart timeframe that renders ~40-200 candles for the trade window."""
    end = close_time or datetime.now(timezone.utc)
    minutes = max((_as_utc(end) - _as_utc(open_time)).total_seconds() / 60, 1)
    if minutes <= 60:
        return "M1"
    if minutes <= 240:
        return "M5"
    if minutes <= 1440:
        return "M15"
    if minutes <= 4320:
        return "H1"
    if minutes <= 20160:
        return "H4"
    return "D1"
