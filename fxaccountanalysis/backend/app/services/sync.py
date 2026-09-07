from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decrypt_secret
from app.models import ConnectionStatus, SyncLog, Trade, TradeDirection, TradingAccount
from app.providers import ProviderCredentials, ProviderError, ProviderTrade, get_provider
logger = logging.getLogger(__name__)

PIP_SIZE = {"JPY": 0.01, "XAU": 0.1, "BTC": 1.0, "ETH": 0.1}


def pip_size_for(symbol: str) -> float:
    upper = symbol.upper()
    for key, size in PIP_SIZE.items():
        if key in upper:
            return size
    return 0.0001


def compute_pips(trade: ProviderTrade) -> float | None:
    if trade.close_price is None:
        return None
    sign = 1 if trade.direction == "buy" else -1
    return round((trade.close_price - trade.open_price) * sign / pip_size_for(trade.symbol), 1)


def credentials_for(account: TradingAccount) -> ProviderCredentials:
    return ProviderCredentials(
        login=account.login,
        password=decrypt_secret(account.encrypted_password),
        server=account.server,
        broker=account.broker,
        provider_account_id=account.provider_account_id,
    )


def upsert_trades(db: Session, account: TradingAccount, incoming: list[ProviderTrade]) -> int:
    """Insert or update trades for an account, keyed on ticket. Returns the count."""
    existing = {
        row.ticket: row
        for row in db.scalars(select(Trade).where(Trade.account_id == account.id)).all()
    }

    synced = 0
    for remote in incoming:
        row = existing.get(remote.ticket) or Trade(account_id=account.id, ticket=remote.ticket)
        row.symbol = remote.symbol
        row.direction = TradeDirection(remote.direction)
        row.volume = remote.volume
        row.open_time = remote.open_time
        row.close_time = remote.close_time
        row.open_price = remote.open_price
        row.close_price = remote.close_price
        row.stop_loss = remote.stop_loss
        row.take_profit = remote.take_profit
        row.profit = remote.profit
        row.commission = remote.commission
        row.swap = remote.swap
        row.is_open = remote.is_open
        row.pips = compute_pips(remote)
        row.comment = remote.comment
        db.add(row)
        synced += 1
    return synced


def recalculate_balance(db: Session, account: TradingAccount) -> None:
    """Derive balance/equity from stored trades.

    Used for the credential-free 'manual' provider, where no live broker figure
    is available: realised P/L defines the balance and floating P/L the equity.
    """
    rows = db.scalars(select(Trade).where(Trade.account_id == account.id)).all()
    realised = sum(t.profit + t.commission + t.swap for t in rows if not t.is_open)
    floating = sum(t.profit + t.commission + t.swap for t in rows if t.is_open)
    account.balance = round(account.starting_balance + realised, 2)
    account.equity = round(account.balance + floating, 2)


async def sync_account(db: Session, account: TradingAccount) -> SyncLog:
    """Pull closed trades and open positions from the provider into the DB."""
    log = SyncLog(account_id=account.id, started_at=datetime.now(timezone.utc))
    db.add(log)
    db.commit()

    try:
        provider = get_provider(account.provider)
        creds = credentials_for(account)
        info = await provider.verify(creds)
        account.provider_account_id = info.provider_account_id

        remote_trades = await provider.fetch_trades(creds)
        synced = upsert_trades(db, account, remote_trades)
        db.flush()

        if account.provider == "manual":
            # No live broker figures; derive them from the imported history.
            account.currency = account.currency or info.currency
            recalculate_balance(db, account)
            message = (
                f"Refreshed {synced} trades"
                if synced
                else "Up to date. Import an MT5 statement to add more history."
            )
        else:
            account.currency = info.currency
            account.balance = info.balance
            account.equity = info.equity
            message = f"Synced {synced} trades"

        account.status = ConnectionStatus.connected
        account.status_message = None
        account.last_synced_at = datetime.now(timezone.utc)

        log.success = True
        log.trades_synced = synced
        log.message = message
    except (ProviderError, ValueError) as exc:
        db.rollback()
        account.status = ConnectionStatus.error
        account.status_message = str(exc)[:500]
        log.success = False
        log.message = str(exc)[:500]
        db.add(account)
        logger.warning("Sync failed for account %s: %s", account.id, exc)
    except Exception as exc:  # pragma: no cover - unexpected upstream failure
        db.rollback()
        account.status = ConnectionStatus.error
        account.status_message = "Unexpected sync failure"
        log.success = False
        log.message = f"Unexpected error: {exc.__class__.__name__}"
        db.add(account)
        logger.exception("Unexpected sync failure for account %s", account.id)

    log.finished_at = datetime.now(timezone.utc)
    db.add(log)
    db.commit()
    db.refresh(account)
    return log
