from __future__ import annotations

import secrets
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "FX Account Analysis API"
    api_prefix: str = "/api"

    # Auth
    jwt_secret: str = secrets.token_urlsafe(48)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12

    # Encryption key (Fernet, urlsafe base64 32 bytes). Generated if absent (dev only).
    credentials_encryption_key: str = ""

    # Database: sqlite by default, set DATABASE_URL for PostgreSQL
    database_url: str = "sqlite:///./fxanalysis.db"

    # MT5 data source (all free):
    #   "manual" - import an MT5 statement file, no credentials required
    #   "mt5"    - native MetaTrader5 terminal (Windows only)
    #   "demo"   - built-in synthetic data for trying the app out
    mt5_provider: str = "manual"

    # Max upload size for statement imports (bytes)
    max_upload_bytes: int = 20 * 1024 * 1024

    # Market data cache TTL (seconds) and rate limiting
    candle_cache_ttl_seconds: int = 300
    rate_limit_requests: int = 120
    rate_limit_window_seconds: int = 60

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    sync_interval_minutes: int = 15

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
