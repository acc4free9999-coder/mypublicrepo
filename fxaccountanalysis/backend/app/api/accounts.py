from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owned_account
from app.core.config import settings
from app.core.db import get_db
from app.core.security import encrypt_secret
from app.models import ConnectionStatus, Trade, TradingAccount, User
from app.providers import ProviderCredentials, ProviderError, get_provider
from app.schemas import AccountCreate, AccountOut, AccountUpdate, ImportResult, SyncResult
from app.services.statement import parse_statement
from app.services.sync import recalculate_balance, sync_account, upsert_trades

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
def list_accounts(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[AccountOut]:
    rows = db.scalars(
        select(TradingAccount)
        .where(TradingAccount.user_id == user.id)
        .order_by(TradingAccount.created_at)
    ).all()
    return [AccountOut.model_validate(row) for row in rows]


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountOut:
    duplicate = db.scalar(
        select(TradingAccount).where(
            TradingAccount.user_id == user.id,
            TradingAccount.login == payload.login,
            TradingAccount.server == payload.server,
        )
    )
    if duplicate:
        raise HTTPException(status.HTTP_409_CONFLICT, "That account is already linked")

    provider_name = payload.provider or settings.mt5_provider
    # Only the native MT5 terminal bridge actually authenticates against a broker.
    if provider_name == "mt5" and not payload.password:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "The native MT5 provider requires the account password.",
        )

    try:
        provider = get_provider(provider_name)
        info = await provider.verify(
            ProviderCredentials(
                login=payload.login,
                password=payload.password or "",
                server=payload.server,
                broker=payload.broker,
            )
        )
    except ProviderError as exc:
        # Credentials are never echoed back or logged.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    account = TradingAccount(
        user_id=user.id,
        name=payload.name,
        login=payload.login,
        server=payload.server,
        broker=payload.broker,
        provider=provider_name,
        # Manual accounts hold no credential; store an empty encrypted blob.
        encrypted_password=encrypt_secret(payload.password or ""),
        provider_account_id=info.provider_account_id,
        currency=info.currency,
        starting_balance=payload.starting_balance,
        balance=info.balance or payload.starting_balance,
        equity=info.equity or payload.starting_balance,
        status=ConnectionStatus.connected,
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    if provider_name != "manual":
        await sync_account(db, account)
    return AccountOut.model_validate(account)


@router.post("/{account_id}/import", response_model=ImportResult)
async def import_statement(
    file: UploadFile = File(..., description="MT5 statement export (.html or .xlsx)"),
    account: TradingAccount = Depends(get_owned_account),
    db: Session = Depends(get_db),
) -> ImportResult:
    """Import trade history from an MT5 statement file - no credentials needed."""
    payload = await file.read()
    if len(payload) > settings.max_upload_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File is larger than {settings.max_upload_bytes // (1024 * 1024)} MB",
        )

    try:
        trades = parse_statement(payload, file.filename or "")
    except ProviderError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    before = db.scalar(
        select(func.count()).select_from(Trade).where(Trade.account_id == account.id)
    ) or 0

    upsert_trades(db, account, trades)
    db.flush()
    recalculate_balance(db, account)

    account.status = ConnectionStatus.connected
    account.status_message = None
    account.last_synced_at = datetime.now(timezone.utc)
    db.add(account)
    db.commit()
    db.refresh(account)

    after = db.scalar(
        select(func.count()).select_from(Trade).where(Trade.account_id == account.id)
    ) or 0
    added = after - before

    return ImportResult(
        account_id=account.id,
        filename=file.filename or "statement",
        trades_found=len(trades),
        trades_imported=added,
        message=(
            f"Imported {added} new trades ({len(trades) - added} already present)."
            if added != len(trades)
            else f"Imported {added} trades."
        ),
    )


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(
    payload: AccountUpdate,
    account: TradingAccount = Depends(get_owned_account),
    db: Session = Depends(get_db),
) -> AccountOut:
    if payload.name is not None:
        account.name = payload.name
    if payload.server is not None:
        account.server = payload.server
    if payload.password is not None:
        account.encrypted_password = encrypt_secret(payload.password)
    if payload.starting_balance is not None:
        account.starting_balance = payload.starting_balance
        if account.provider == "manual":
            recalculate_balance(db, account)
    db.add(account)
    db.commit()
    db.refresh(account)
    return AccountOut.model_validate(account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_account(
    account: TradingAccount = Depends(get_owned_account), db: Session = Depends(get_db)
) -> Response:
    db.delete(account)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{account_id}/sync", response_model=SyncResult)
async def sync_now(
    account: TradingAccount = Depends(get_owned_account), db: Session = Depends(get_db)
) -> SyncResult:
    log = await sync_account(db, account)
    return SyncResult(
        account_id=account.id,
        success=log.success,
        trades_synced=log.trades_synced,
        message=log.message or "",
        status=account.status.value,
    )
