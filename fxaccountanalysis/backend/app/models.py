from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ConnectionStatus(str, enum.Enum):
    connected = "connected"
    disconnected = "disconnected"
    error = "error"
    syncing = "syncing"


class TradeDirection(str, enum.Enum):
    buy = "buy"
    sell = "sell"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    accounts: Mapped[list["TradingAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class TradingAccount(Base):
    __tablename__ = "trading_accounts"
    __table_args__ = (UniqueConstraint("user_id", "login", "server", name="uq_account_per_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    login: Mapped[str] = mapped_column(String(64))
    server: Mapped[str] = mapped_column(String(120))
    broker: Mapped[str] = mapped_column(String(120), default="Exness")
    provider: Mapped[str] = mapped_column(String(32), default="demo")
    # Encrypted at rest, never returned by the API and never logged.
    encrypted_password: Mapped[str] = mapped_column(Text)
    provider_account_id: Mapped[str | None] = mapped_column(String(120), nullable=True)

    currency: Mapped[str] = mapped_column(String(8), default="USD")
    starting_balance: Mapped[float] = mapped_column(Float, default=0.0)
    balance: Mapped[float] = mapped_column(Float, default=0.0)
    equity: Mapped[float] = mapped_column(Float, default=0.0)

    status: Mapped[ConnectionStatus] = mapped_column(
        Enum(ConnectionStatus), default=ConnectionStatus.disconnected
    )
    status_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="accounts")
    trades: Mapped[list["Trade"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class Trade(Base):
    __tablename__ = "trades"
    __table_args__ = (
        UniqueConstraint("account_id", "ticket", name="uq_trade_ticket"),
        Index("ix_trades_account_close", "account_id", "close_time"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("trading_accounts.id", ondelete="CASCADE"), index=True
    )
    ticket: Mapped[str] = mapped_column(String(64), index=True)
    symbol: Mapped[str] = mapped_column(String(32), index=True)
    direction: Mapped[TradeDirection] = mapped_column(Enum(TradeDirection))
    volume: Mapped[float] = mapped_column(Float)

    open_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    close_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    open_price: Mapped[float] = mapped_column(Float)
    close_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    stop_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    take_profit: Mapped[float | None] = mapped_column(Float, nullable=True)

    profit: Mapped[float] = mapped_column(Float, default=0.0)
    commission: Mapped[float] = mapped_column(Float, default=0.0)
    swap: Mapped[float] = mapped_column(Float, default=0.0)
    pips: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_open: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    comment: Mapped[str | None] = mapped_column(String(255), nullable=True)

    account: Mapped[TradingAccount] = relationship(back_populates="trades")

    @property
    def net_profit(self) -> float:
        return round(self.profit + self.commission + self.swap, 2)

    @property
    def duration_seconds(self) -> int | None:
        if not self.close_time:
            return None
        return int((self.close_time - self.open_time).total_seconds())


class Candle(Base):
    """Cached OHLC market data used for chart rendering."""

    __tablename__ = "candles"
    __table_args__ = (
        UniqueConstraint("symbol", "timeframe", "time", name="uq_candle"),
        Index("ix_candles_lookup", "symbol", "timeframe", "time"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(32))
    timeframe: Mapped[str] = mapped_column(String(8))
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    open: Mapped[float] = mapped_column(Float)
    high: Mapped[float] = mapped_column(Float)
    low: Mapped[float] = mapped_column(Float)
    close: Mapped[float] = mapped_column(Float)
    volume: Mapped[float] = mapped_column(Float, default=0.0)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("trading_accounts.id", ondelete="CASCADE"), index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    trades_synced: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)
