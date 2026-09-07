from __future__ import annotations

from fastapi import Depends, HTTPException, Path, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import decode_access_token
from app.models import TradingAccount, User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    subject = decode_access_token(credentials.credentials)
    if not subject:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, int(subject))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
    return user


def get_owned_account(
    account_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TradingAccount:
    account = db.get(TradingAccount, account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    return account
