# FX Account Analysis

A web app that connects to an MT5 (MetaTrader 5) trading account hosted on Exness, analyses trading performance, and lets you inspect any individual trade on a candlestick chart with entry and exit marked.

![stack](https://img.shields.io/badge/backend-FastAPI-009688) ![stack](https://img.shields.io/badge/frontend-React%20%2B%20TS-61dafb) ![stack](https://img.shields.io/badge/charts-Lightweight%20Charts-2962ff)

## Features

- **100% free** — no paid bridge, no API keys, no signup with any third party. Trade history comes from your own MT5 statement export (or the free native MT5 package on Windows), and chart candles come from Yahoo Finance.
- **Account linking** — track one or more MT5/Exness accounts. Upload a statement with no password at all, or use the native MT5 terminal on Windows (credentials are encrypted at rest and verified before storage).
- **Win/loss analysis** — day / week / month / year toggle showing total trades, wins, losses, win rate, net P/L, average win/loss, profit factor and largest win/loss.
- **Charts** — net P/L bar chart per period and a cumulative equity curve, plus a per-symbol performance breakdown.
- **Trade history** — sortable, filterable, paginated table colour-coded by result. Filter by symbol, direction, date range, win/loss, or free-text search.
- **Trade detail** — click any row to open a candlestick chart of that instrument with entry/exit arrows, SL/TP price lines, and a details panel. Timeframe is auto-selected from trade duration and can be switched manually.
- **Account switcher** with live connection status and a manual "Sync now" button; a background job re-syncs every account on an interval.

## Architecture

```
frontend (React + TS + Tailwind + Lightweight Charts)
    │  REST, JWT bearer
    ▼
backend (FastAPI)
    ├── auth ─────────── JWT, bcrypt password hashing
    ├── accounts ─────── credentials encrypted at rest (Fernet)
    ├── sync service ─── APScheduler background job + manual trigger
    ├── analytics ────── period bucketing, equity curve, per-symbol stats
    ├── market data ──── OHLC fetch + DB cache + per-symbol request coalescing
    ├── statement ────── MT5 HTML/XLSX report parser (free import path)
    └── provider layer ─ pluggable MT5 source
             ├── manual  (statement upload — any OS, no credentials)
             ├── mt5     (native MetaTrader5 package — free, Windows only)
             └── demo    (generated sample data, no credentials needed)

market data: Yahoo Finance (free, no API key)
    │
    ▼
database (SQLite by default, PostgreSQL supported)
```

### Why a provider layer?

The official `MetaTrader5` Python package is free but only runs on Windows, which is a poor fit for a hosted web product. The backend therefore talks to an abstract `MT5Provider` interface ([backend/app/providers/base.py](backend/app/providers/base.py)) with three free implementations:

| Provider | When to use |
|---|---|
| `manual` (default) | **Recommended.** You export a statement from MT5 and upload it. Works on any OS, needs no password and no third-party service. |
| `mt5` | Live sync using the free official `MetaTrader5` package. Requires the MT5 terminal running on the same **Windows** machine as the backend. |
| `demo` | Local development and demos. Generates deterministic synthetic trade history so the whole app works end-to-end without a broker account. |

Adding another source means implementing `verify`, `fetch_trades` and `fetch_candles`, then registering it in `get_provider`.

### Market data

Candlestick data is fetched from Yahoo Finance's public chart endpoint — free, no API key and no signup. MT5 symbols are mapped to Yahoo tickers automatically, including Exness broker suffixes (`EURUSDm` → `EURUSD=X`, `XAUUSD.raw` → `GC=F`, `BTCUSD` → `BTC-USD`). Responses are cached in the database and rate-limited. Yahoo has no 4-hour interval, so H4 candles are resampled from hourly bars; for older trades the interval is automatically coarsened to stay inside Yahoo's intraday history limits.

## Quick start

Requirements: Python 3.11+, Node 18+.

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # defaults work out of the box (demo provider + SQLite)
uvicorn app.main:app --reload --port 8000
```

API docs are then live at http://localhost:8000/docs.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the backend, so no CORS setup is needed in dev.

### 3. Try it

1. Create an account on the login page.
2. Go to **Accounts**, keep the default **Statement upload** source, enter any display name / MT5 account number, and click **Add account**.
3. Click **Import statement** on the new account and pick your MT5 report file (see below). To explore without any real data, pick the **Demo data** source instead — roughly 18 months of synthetic history is generated so every period bucket is populated.
4. Explore the **Dashboard**, then click any row in **Trade History** to open its chart.

## Importing a real Exness account (free, any OS)

1. Open the MetaTrader 5 terminal and go to the **History** tab (Toolbox).
2. Right-click anywhere in the history, choose the period you want (e.g. *All History*), then **Report → HTML** (or **XLSX**).
3. In the web app, add an account with the **Statement upload** source and set your **starting balance**.
4. Click **Import statement** and choose the exported file.

Re-importing is safe: trades are matched on their MT5 ticket, so uploading an overlapping report updates existing rows instead of duplicating them. Balance and equity are derived from your starting balance plus realised (and floating) P/L.

The parser handles MT5's localised headers, UTF-16 HTML exports, and the space/comma thousands separators used in non-English builds.

## Live sync with the native MT5 package (Windows only)

If the backend runs on Windows with the MetaTrader 5 terminal installed:

```
MT5_PROVIDER=mt5
```

```bash
pip install MetaTrader5
```

Then add an account with the **Native MT5 terminal** source and your MT5 account number, **investor (read-only) password** and server name (e.g. `Exness-MT5Real`). The background job then syncs closed trades and open positions automatically. The package is imported lazily, so non-Windows machines are unaffected.

### PostgreSQL

```
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/fxanalysis
```
Tables are created automatically on startup.

## Security

- The default `manual` flow stores **no broker credential at all**. When a password is supplied (native MT5), it is encrypted with **Fernet (AES-128-CBC + HMAC)** before being written to the database, and is never returned by the API or written to logs. Broker errors are sanitised before being surfaced.
- User passwords are hashed with **bcrypt**; sessions use signed **JWT** bearer tokens.
- Every account/trade/chart query is scoped to the authenticated owner, so trade IDs cannot be enumerated across users.
- In production **you must set** `CREDENTIALS_ENCRYPTION_KEY` and `JWT_SECRET`. In development a Fernet key is generated and persisted to `.fernet.key` (gitignored) so encrypted data survives restarts.
- All requests are rate-limited per client IP (`RATE_LIMIT_REQUESTS` per `RATE_LIMIT_WINDOW_SECONDS`).

## Performance & resilience

- OHLC candles are cached in the database with a TTL (`CANDLE_CACHE_TTL_SECONDS`, default 5 min); concurrent requests for the same symbol/timeframe are coalesced behind a lock so the upstream is hit once.
- Sync failures never crash the app: the account is flagged `error` with a message, surfaced as a status badge in the UI, and the next scheduled sync retries.
- The frontend renders explicit loading, empty and error states with retry buttons for every data view.

## Testing

```bash
cd backend
.venv/bin/python -m pytest tests/ -q   # statement parser + symbol mapping unit tests
.venv/bin/python smoke_test.py         # full in-process end-to-end flow
```

The smoke test covers the whole free flow: register → create a credential-free `manual` account → upload a generated MT5 statement → verify re-import is idempotent and garbage files are rejected → paginate trades → all four analytics periods → live Yahoo chart data → filters → demo provider sync.

```bash
cd frontend
npm run build     # type-checks with tsc and builds
```

## Project layout

```
backend/
  app/
    api/          auth, accounts, trades, analytics routers + shared filters
    core/         config, database, security (JWT + encryption)
    providers/    MT5 source abstraction: manual, native mt5 and demo
    services/     sync, analytics, market data caching, statement parser, yahoo
    models.py     SQLAlchemy models
    schemas.py    Pydantic request/response models
    main.py       app wiring, rate limiting, background scheduler
  smoke_test.py
  tests/          statement parser and symbol mapping tests
frontend/
  src/
    components/   Layout, FilterBar, CandleChart, UI primitives
    pages/        Login, Dashboard, Trades, TradeDetail, Accounts
    lib/          API client, auth/account context, formatters, types
API.md            full endpoint reference
```

## Documentation

- [API.md](API.md) — complete REST endpoint reference with request/response examples.
- Swagger UI at `/docs`, ReDoc at `/redoc` when the backend is running.
