from __future__ import annotations

import math
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.filters import TradeFilters, apply_filters, owned_account_ids
from app.core.db import get_db
from app.models import Trade, TradingAccount, User
from app.providers import ProviderError
from app.schemas import CandleOut, TradeChart, TradeMarker, TradeOut, TradePage
from app.services.analytics import suggest_timeframe
from app.services.market_data import TIMEFRAME_MINUTES, chart_window, get_candles

router = APIRouter(prefix="/trades", tags=["trades"])

SORTABLE = {
    "open_time": Trade.open_time,
    "close_time": Trade.close_time,
    "symbol": Trade.symbol,
    "volume": Trade.volume,
    "profit": Trade.profit,
}


@router.get("", response_model=TradePage)
def list_trades(
    filters: TradeFilters = Depends(),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: str = Query("close_time"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TradePage:
    if sort_by not in SORTABLE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot sort by '{sort_by}'")

    account_ids = owned_account_ids(db, user, filters.account_id)
    base = apply_filters(select(Trade), filters, account_ids)

    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    column = SORTABLE[sort_by]
    ordered = base.order_by(column.desc() if sort_dir == "desc" else column.asc())
    rows = db.scalars(ordered.offset((page - 1) * page_size).limit(page_size)).all()

    return TradePage(
        items=[TradeOut.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(math.ceil(total / page_size), 1),
    )


@router.get("/symbols", response_model=list[str])
def list_symbols(
    account_id: int | None = Query(None, ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[str]:
    account_ids = owned_account_ids(db, user, account_id)
    rows = db.scalars(
        select(Trade.symbol)
        .where(Trade.account_id.in_(account_ids or [-1]))
        .distinct()
        .order_by(Trade.symbol)
    ).all()
    return list(rows)


def _load_trade(db: Session, user: User, trade_id: int) -> tuple[Trade, TradingAccount]:
    trade = db.get(Trade, trade_id)
    if not trade:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trade not found")
    account = db.get(TradingAccount, trade.account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trade not found")
    return trade, account


@router.get("/{trade_id}", response_model=TradeOut)
def get_trade(
    trade_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> TradeOut:
    trade, _ = _load_trade(db, user, trade_id)
    return TradeOut.model_validate(trade)


@router.get("/{trade_id}/chart", response_model=TradeChart)
async def get_trade_chart(
    trade_id: int,
    timeframe: str | None = Query(None, description="M1..D1; auto-selected when omitted"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TradeChart:
    trade, account = _load_trade(db, user, trade_id)

    tf = (timeframe or suggest_timeframe(trade.open_time, trade.close_time)).upper()
    if tf not in TIMEFRAME_MINUTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unsupported timeframe '{tf}'")

    start, end = chart_window(trade.open_time, trade.close_time, tf)
    try:
        candles = await get_candles(db, account, trade.symbol, tf, start, end)
    except ProviderError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    def epoch(value) -> int:
        moment = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return int(moment.timestamp())

    markers = [
        TradeMarker(
            time=epoch(trade.open_time),
            kind="entry",
            price=trade.open_price,
            label=f"{trade.direction.value.upper()} {trade.volume} @ {trade.open_price}",
        )
    ]
    if trade.close_time and trade.close_price is not None:
        markers.append(
            TradeMarker(
                time=epoch(trade.close_time),
                kind="exit",
                price=trade.close_price,
                label=f"EXIT @ {trade.close_price} ({trade.net_profit:+.2f})",
            )
        )

    return TradeChart(
        trade=TradeOut.model_validate(trade),
        timeframe=tf,  # type: ignore[arg-type]
        candles=[
            CandleOut(
                time=epoch(c.time),
                open=c.open,
                high=c.high,
                low=c.low,
                close=c.close,
                volume=c.volume,
            )
            for c in candles
        ],
        markers=markers,
        stop_loss=trade.stop_loss,
        take_profit=trade.take_profit,
    )
