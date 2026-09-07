# API Reference

Base URL: `http://localhost:8000/api` · Interactive docs: `http://localhost:8000/docs` (Swagger) and `/redoc`.

All endpoints except `/auth/register`, `/auth/login` and `/health` require a bearer token:

```
Authorization: Bearer <access_token>
```

Errors use the standard shape `{"detail": "..."}`. Rate limiting returns `429`; upstream data-source outages return `503`.

---

## System

### `GET /health`
Liveness probe. Returns the configured default trade-history source and everything available on this host.

```json
{ "status": "ok", "provider": "manual", "available_providers": ["manual", "demo"] }
```

`mt5` only appears in `available_providers` when the backend runs on Windows with the free `MetaTrader5` package installed.

---

## Auth

### `POST /api/auth/register` → `201`
```json
{ "email": "you@example.com", "password": "min-8-chars", "full_name": "Jane Trader" }
```
Returns `{ access_token, token_type, user }`. `409` if the email is taken.

### `POST /api/auth/login`
```json
{ "email": "you@example.com", "password": "..." }
```
Returns `{ access_token, token_type, user }`. `401` on bad credentials.

### `GET /api/auth/me`
Returns the current `user`.

---

## Accounts

### `GET /api/accounts`
List all linked MT5 accounts for the current user. Passwords are never included.

```json
[{
  "id": 1, "name": "Exness Real", "login": "87654321",
  "server": "Exness-MT5Real", "broker": "Exness", "provider": "manual",
  "currency": "USD", "starting_balance": 10000.0,
  "balance": 28064.35, "equity": 29453.33,
  "status": "connected", "status_message": null,
  "last_synced_at": "2026-09-06T14:07:11Z", "created_at": "2026-09-06T14:07:05Z"
}]
```

`status` is one of `connected` · `disconnected` · `error` · `syncing`.

### `POST /api/accounts` → `201`
Creates a tracked account. For `manual` and `demo` no credential is needed; for `mt5` the password is verified against the local terminal, encrypted and saved, then an initial sync runs.

```json
{
  "name": "Exness Real",
  "login": "87654321",
  "server": "Exness-MT5Real",
  "broker": "Exness",
  "provider": "manual",
  "starting_balance": 10000
}
```

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Display name |
| `login` | yes | MT5 account number |
| `provider` | no | `manual` (default) · `mt5` · `demo`; falls back to the server's `MT5_PROVIDER` |
| `password` | only for `mt5` | Investor (read-only) password. Encrypted at rest, never returned |
| `server` | no | e.g. `Exness-MT5Real` |
| `broker` | yes | e.g. `Exness` |
| `starting_balance` | no | Baseline used to derive balance/equity for imported history |

Returns the created account. `400` if the provider rejects the details, `409` if already linked.

### `POST /api/accounts/{account_id}/import`
Imports trade history from an MT5 statement export — the free, credential-free path.

`multipart/form-data` with a single `file` field containing an MT5 **HTML** or **XLSX** report (MT5 → History tab → right-click → Report). Max size `MAX_UPLOAD_BYTES` (default 20 MB).

```json
{
  "account_id": 1,
  "filename": "ReportHistory-87654321.html",
  "trades_found": 420,
  "trades_imported": 37,
  "message": "Imported 37 new trades (383 already present)."
}
```

Trades are upserted on their MT5 ticket, so re-uploading an overlapping report updates rather than duplicates. Account balance and equity are recalculated from `starting_balance` plus realised (and floating) P/L.

`422` if the file cannot be parsed as an MT5 statement, `413` if it exceeds the size limit.

### `PATCH /api/accounts/{account_id}`
Update `name`, `server`, `starting_balance` and/or `password` (re-encrypted). Changing `starting_balance` on a `manual` account recalculates balance and equity. Returns the account.

### `DELETE /api/accounts/{account_id}` → `204`
Unlinks the account and cascades to its trades.

### `POST /api/accounts/{account_id}/sync`
Triggers an immediate sync of closed trades and open positions. Only meaningful for the `mt5` and `demo` providers — `manual` accounts are updated via the import endpoint instead.

```json
{ "account_id": 1, "success": true, "trades_synced": 420, "message": "Synced 420 trades", "status": "connected" }
```

---

## Trades

### `GET /api/trades`
Paginated, sortable, filterable trade history.

| Query param | Type | Notes |
|---|---|---|
| `account_id` | int | Restrict to one account; omit for all of the user's accounts |
| `symbol` | string | e.g. `EURUSD` |
| `direction` | `buy` \| `sell` | |
| `result` | `win` \| `loss` | Based on net P/L (profit + commission + swap) |
| `from` / `to` | ISO datetime | Filters on open time |
| `search` | string | Matches symbol or ticket |
| `include_open` | bool | Default `false` (closed trades only) |
| `page` | int ≥ 1 | Default `1` |
| `page_size` | int 1–500 | Default `50` |
| `sort_by` | `open_time` \| `close_time` \| `symbol` \| `volume` \| `profit` | Default `close_time` |
| `sort_dir` | `asc` \| `desc` | Default `desc` |

```json
{
  "items": [{
    "id": 320, "account_id": 1, "ticket": "384059755",
    "symbol": "XAUUSD", "direction": "buy", "volume": 1.0,
    "open_time": "2026-09-05T04:09:00Z", "close_time": "2026-09-05T04:44:00Z",
    "open_price": 2340.80581, "close_price": 2380.42226,
    "stop_loss": 2278.30581, "take_profit": 2453.30581,
    "profit": 3961.64, "commission": -3.5, "swap": -0.2,
    "net_profit": 3957.94, "pips": 396.2, "duration_seconds": 2100,
    "is_open": false, "comment": "demo"
  }],
  "total": 420, "page": 1, "page_size": 50, "pages": 9
}
```

### `GET /api/trades/symbols`
Distinct traded symbols (optionally scoped by `account_id`). Used to populate filter dropdowns.

```json
["BTCUSD", "EURUSD", "GBPUSD", "USDJPY", "XAUUSD"]
```

### `GET /api/trades/{trade_id}`
A single trade object (same shape as an `items[]` entry).

### `GET /api/trades/{trade_id}/chart`
OHLC data plus entry/exit markers for rendering the trade on a candlestick chart.

Query param `timeframe` is optional (`M1`, `M5`, `M15`, `M30`, `H1`, `H4`, `D1`). When omitted the server picks a sensible timeframe from the trade duration:

| Trade duration | Timeframe |
|---|---|
| ≤ 1 hour | `M1` |
| ≤ 4 hours | `M5` |
| ≤ 1 day | `M15` |
| ≤ 3 days | `H1` |
| ≤ 14 days | `H4` |
| longer | `D1` |

The window is padded by 40 bars either side of the trade. Candle `time` values are UNIX seconds (as required by Lightweight Charts).

```json
{
  "trade": { "...": "trade object" },
  "timeframe": "M1",
  "candles": [{ "time": 1788657000, "open": 2338.1, "high": 2342.0, "low": 2336.4, "close": 2340.2, "volume": 1204.5 }],
  "markers": [
    { "time": 1788660540, "kind": "entry", "price": 2340.80581, "label": "BUY 1.0 @ 2340.80581" },
    { "time": 1788662640, "kind": "exit",  "price": 2380.42226, "label": "EXIT @ 2380.42226 (+3957.94)" }
  ],
  "stop_loss": 2278.30581,
  "take_profit": 2453.30581
}
```

Candles are sourced from Yahoo Finance (free, no API key) and cached. Returns `503` if the market-data source is unavailable.

---

## Analytics

### `GET /api/analytics/summary`
Win/loss aggregation bucketed by period, plus an equity curve and per-symbol breakdown.

Accepts `period` (`day` \| `week` \| `month` \| `year`, default `month`) plus every filter from `GET /api/trades` except pagination. Only closed trades are considered.

```json
{
  "period": "month",
  "overall": {
    "period": "overall",
    "period_start": "2025-03-14T00:00:00Z",
    "period_end": "2026-09-06T00:00:00Z",
    "total_trades": 420, "wins": 234, "losses": 186, "breakeven": 0,
    "win_rate": 55.71, "net_pl": 29383.52,
    "gross_profit": 97732.44, "gross_loss": -68348.92,
    "average_win": 417.66, "average_loss": -367.47,
    "profit_factor": 1.43, "largest_win": 4775.57, "largest_loss": -9920.9
  },
  "buckets": [{ "period": "2026-09", "...": "same shape as overall" }],
  "equity_curve": [{ "time": "2025-03-14T09:00:00Z", "equity": 1250.4 }],
  "by_symbol": [{ "symbol": "XAUUSD", "total_trades": 88, "wins": 51, "losses": 37, "win_rate": 57.95, "net_pl": 12045.2 }]
}
```

Bucket labels: `YYYY-MM-DD` (day), `YYYY-Www` (week, ISO), `YYYY-MM` (month), `YYYY` (year). `profit_factor` is `null` when there are no losses (an infinite factor).

When exactly one account is selected, the equity curve is anchored so that it ends at the account's current balance.
