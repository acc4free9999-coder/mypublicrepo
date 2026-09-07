from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, Query, status
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models import Trade, TradeDirection, TradingAccount, User


class TradeFilters:
    """Shared query filters for trade/analytics endpoints."""

    def __init__(
        self,
        account_id: int | None = Query(None, ge=1, description="Restrict to one linked account"),
        symbol: str | None = Query(None, description="Instrument, e.g. EURUSD"),
        direction: str | None = Query(None, pattern="^(buy|sell)$"),
        result: str | None = Query(None, pattern="^(win|loss)$"),
        date_from: datetime | None = Query(None, alias="from"),
        date_to: datetime | None = Query(None, alias="to"),
        search: str | None = Query(None, description="Free text match on symbol or ticket"),
        include_open: bool = Query(False),
    ) -> None:
        self.account_id = account_id
        self.symbol = symbol.upper() if symbol else None
        self.direction = direction
        self.result = result
        self.date_from = date_from
        self.date_to = date_to
        self.search = search
        self.include_open = include_open


def owned_account_ids(db: Session, user: User, account_id: int | None) -> list[int]:
    ids = list(
        db.scalars(
            select(TradingAccount.id).where(TradingAccount.user_id == user.id)
        ).all()
    )
    if account_id is None:
        return ids
    if account_id not in ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    return [account_id]


def apply_filters(stmt: Select, filters: TradeFilters, account_ids: list[int]) -> Select:
    stmt = stmt.where(Trade.account_id.in_(account_ids or [-1]))
    if filters.symbol:
        stmt = stmt.where(Trade.symbol == filters.symbol)
    if filters.direction:
        stmt = stmt.where(Trade.direction == TradeDirection(filters.direction))
    if not filters.include_open:
        stmt = stmt.where(Trade.is_open.is_(False))
    if filters.date_from:
        stmt = stmt.where(Trade.open_time >= _utc(filters.date_from))
    if filters.date_to:
        stmt = stmt.where(Trade.open_time <= _utc(filters.date_to))
    if filters.result == "win":
        stmt = stmt.where(Trade.profit + Trade.commission + Trade.swap > 0)
    elif filters.result == "loss":
        stmt = stmt.where(Trade.profit + Trade.commission + Trade.swap < 0)
    if filters.search:
        pattern = f"%{filters.search.strip()}%"
        stmt = stmt.where(Trade.symbol.ilike(pattern) | Trade.ticket.ilike(pattern))
    return stmt


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
