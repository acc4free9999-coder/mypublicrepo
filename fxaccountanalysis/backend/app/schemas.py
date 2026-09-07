from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Period = Literal["day", "week", "month", "year"]
Timeframe = Literal["M1", "M5", "M15", "M30", "H1", "H4", "D1"]


# ---------- Auth ----------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    full_name: str | None
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Accounts ----------
class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    login: str = Field(min_length=1, max_length=64)
    server: str = Field(default="", max_length=120, examples=["Exness-MT5Real"])
    broker: str = "Exness"
    provider: Literal["manual", "demo", "mt5"] | None = None
    starting_balance: float = Field(
        default=0.0, description="Opening balance used to anchor the equity curve"
    )
    password: str | None = Field(
        default=None,
        max_length=256,
        description=(
            "Only required for the 'mt5' and 'demo' providers. The credential-free "
            "'manual' provider ignores this field."
        ),
    )


class AccountUpdate(BaseModel):
    name: str | None = None
    password: str | None = None
    server: str | None = None
    starting_balance: float | None = None


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    login: str
    server: str
    broker: str
    provider: str
    currency: str
    starting_balance: float
    balance: float
    equity: float
    status: str
    status_message: str | None
    last_synced_at: datetime | None
    created_at: datetime


class ImportResult(BaseModel):
    account_id: int
    filename: str
    trades_found: int
    trades_imported: int
    message: str


class SyncResult(BaseModel):
    account_id: int
    success: bool
    trades_synced: int
    message: str
    status: str


# ---------- Trades ----------
class TradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    ticket: str
    symbol: str
    direction: str
    volume: float
    open_time: datetime
    close_time: datetime | None
    open_price: float
    close_price: float | None
    stop_loss: float | None
    take_profit: float | None
    profit: float
    commission: float
    swap: float
    net_profit: float
    pips: float | None
    duration_seconds: int | None
    is_open: bool
    comment: str | None


class TradePage(BaseModel):
    items: list[TradeOut]
    total: int
    page: int
    page_size: int
    pages: int


# ---------- Analytics ----------
class PeriodStats(BaseModel):
    period: str
    period_start: datetime
    period_end: datetime
    total_trades: int
    wins: int
    losses: int
    breakeven: int
    win_rate: float
    net_pl: float
    gross_profit: float
    gross_loss: float
    average_win: float
    average_loss: float
    profit_factor: float | None
    largest_win: float
    largest_loss: float


class EquityPoint(BaseModel):
    time: datetime
    equity: float


class SymbolStats(BaseModel):
    symbol: str
    total_trades: int
    wins: int
    losses: int
    win_rate: float
    net_pl: float


class AnalyticsSummary(BaseModel):
    period: Period
    overall: PeriodStats
    buckets: list[PeriodStats]
    equity_curve: list[EquityPoint]
    by_symbol: list[SymbolStats]


# ---------- Chart ----------
class CandleOut(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class TradeMarker(BaseModel):
    time: int
    kind: Literal["entry", "exit"]
    price: float
    label: str


class TradeChart(BaseModel):
    trade: TradeOut
    timeframe: Timeframe
    candles: list[CandleOut]
    markers: list[TradeMarker]
    stop_loss: float | None
    take_profit: float | None
