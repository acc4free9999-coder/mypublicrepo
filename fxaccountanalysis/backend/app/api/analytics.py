from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.filters import TradeFilters, apply_filters, owned_account_ids
from app.core.db import get_db
from app.models import Trade, TradingAccount, User
from app.schemas import AnalyticsSummary, Period
from app.services.analytics import build_summary

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def summary(
    period: Period = Query("month"),
    filters: TradeFilters = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalyticsSummary:
    account_ids = owned_account_ids(db, user, filters.account_id)
    filters.include_open = False
    trades = db.scalars(apply_filters(select(Trade), filters, account_ids)).all()

    starting_balance = 0.0
    if len(account_ids) == 1:
        account = db.get(TradingAccount, account_ids[0])
        if account:
            closed_net = sum(t.profit + t.commission + t.swap for t in trades)
            starting_balance = round(account.balance - closed_net, 2)

    return build_summary(list(trades), period, starting_balance)
