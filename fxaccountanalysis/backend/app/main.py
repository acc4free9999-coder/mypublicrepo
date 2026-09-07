from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.api import accounts, analytics, auth, trades
from app.core.config import settings
from app.core.db import SessionLocal, init_db
from app.models import TradingAccount
from app.providers import ProviderError, available_providers

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_requests: dict[str, deque[float]] = defaultdict(deque)


async def sync_all_accounts() -> None:
    """Background job that refreshes every linked account."""
    from app.services.sync import sync_account

    db = SessionLocal()
    try:
        for account in db.scalars(select(TradingAccount)).all():
            try:
                await sync_account(db, account)
            except Exception:  # pragma: no cover - job must never die
                logger.exception("Scheduled sync failed for account %s", account.id)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        sync_all_accounts,
        "interval",
        minutes=settings.sync_interval_minutes,
        id="sync_accounts",
        max_instances=1,
    )
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "REST API for MT5/Exness account analysis: account linking, trade sync, "
        "win/loss analytics by period, and per-trade candlestick chart data."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window = _requests[client]
    while window and now - window[0] > settings.rate_limit_window_seconds:
        window.popleft()
    if len(window) >= settings.rate_limit_requests:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Rate limit exceeded, please retry shortly."},
        )
    window.append(now)
    return await call_next(request)


@app.exception_handler(ProviderError)
async def provider_error_handler(_: Request, exc: ProviderError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": f"Broker connection problem: {exc}"},
    )


@app.get("/health", tags=["system"])
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "provider": settings.mt5_provider,
        "available_providers": available_providers(),
    }


for router in (auth.router, accounts.router, trades.router, analytics.router):
    app.include_router(router, prefix=settings.api_prefix)
