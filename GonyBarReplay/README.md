# GonyBarReplay

A TradingView-style web app: interactive candlestick charts, historical **bar replay**, and a **paper-trading engine** whose orders are matched against each replayed bar.

**Stack:** React 19 + TypeScript · Vite · Lightweight Charts v5 (TradingView) · Zustand · Tailwind CSS v4 · Lucide · Vitest

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine / aggregation / indicator unit tests
npm run build
```

**Symbols:** XAUUSD (default), EURUSD, AUDUSD, BTCUSD, ETHUSD, SPX. Each one has its own price precision (FX pairs use 5 decimals), contract size, default lot size, volatility and trading session (FX, gold and SPX pause at weekends; crypto trades 24/7).

**Timeframes:** 15m · 1H · 4H · 1D · 1W (Monday-aligned) · 1M (calendar months).

**Data:** real OHLC bars only: fetched on demand from Twelve Data, or imported from an MT5 / MT4 / TradingView / Dukascopy / Binance / CSV export. Data is saved in the browser. There is no simulated data and no live stream. See [Real market data](#real-market-data-twelve-data) and [Importing files](#importing-files-mt5-mt4-tradingview-csv).

**Indicators:** EMA (configurable period) and Volume. The on/off state and the EMA period are saved in `localStorage` (`gony-bar-replay:indicators`) and restored on reload.

### Paper account & position sizing

- Size is entered in **lots**. PnL = Δprice × lots × contract size:

  | Symbol | 1 lot = | Example |
  |---|---|---|
  | XAUUSD | 100 oz | 0.01 lot, 4250 → 4260 = **$10** |
  | EURUSD / AUDUSD | 100,000 units | 0.1 lot, +20 pips = $20 |
  | BTCUSD / ETHUSD / SPX | 1 unit | 1 lot, +$10 = $10 |

- **Account settings** (⚙ in the Paper account card) set the starting balance and leverage (1:1 to 1:500; default $100,000 at 1:100). They are saved in `localStorage`. Changing the starting balance resets the paper account.
- **Risk % of balance** sizing: enter a risk percentage and a stop loss. The lot size is chosen so that hitting the stop loses that percentage of the current balance, rounded *down* to the lot step. The SL and TP hints show the dollar amount and the % of balance.

### On-chart paper trading (during replay)

- Positions, pending orders and their SL/TP are drawn as TradingView-style lines, each with a label showing the PnL at that level and a **×** button.
- **Drag a position line** to create a TP (dragged into profit) or an SL (dragged into loss). **Drag an SL/TP line** to move it.
- **Drag a pending order line** to reprice the order; its SL/TP move with it. A limit order dragged through the market becomes a stop order, and the reverse.
- **Order ticket preview:** choosing Limit/Stop or enabling SL/TP in the order panel shows dashed preview lines. Drag them to adjust the ticket (the panel fields stay in sync), then click **✓** on the entry line or the panel button to submit.
- **×** closes a position, cancels an order, or removes an SL/TP.

**Shortcuts:** `Space` play/pause · `→` step one candle · `Esc` cancel the bar selection or drawing tool · `Delete` remove the selected drawing · `Ctrl/⌘+Z` undo a drawing change.

### Drawing tools

These are TradingView-style tools in the left toolbar: trend line (`Alt+T`), ray, extended line, horizontal line (`Alt+H`), horizontal ray (`Alt+J`), vertical line (`Alt+V`), rectangle (`Alt+Shift+R`), Fib retracement (`Alt+F`), price range / measure (`Alt+M`), text (`Alt+X`) and callout (`Alt+C`, a text bubble with a pointer: the first click sets the tip, the second sets the bubble).

- To place a drawing, click twice or click and drag. In cursor mode, select a drawing to drag its handles or move it. Double-click a text or callout drawing to edit it. Right-click cancels the active tool (otherwise it opens the chart menu).
- **Magnet** snaps points to the bar's OHLC. **Stay in drawing mode** keeps the tool active after each drawing. You can also hide all drawings, undo, or remove all.
- The floating properties bar lets you change color, width, line style, font size and text, and lock, clone or delete the drawing.
- **Trend line stats:** a trend line shows a label at its end point with the price change (and %), the number of bars and duration, and the slope angle (∠, measured on screen, so it changes with zoom like TradingView's). It's on by default for trend lines and optional for rays and extended lines. Toggle it with the ruler button in the properties bar or from the right-click menu.
- **Right-click menu** on the chart:
  - On a drawing: lock/unlock, show/hide stats, clone, remove.
  - At the cursor price: copy the price, or add a horizontal line there.
  - During replay: **Buy / Sell limit or stop @ price**. This fills the order ticket and shows the preview lines. Confirm with ✓ or the panel button.
  - Outside replay: **Start replay from this bar**.
  - Always: reset the chart view, scroll to the latest bar, hide/show drawings, and **Remove all drawings** (undo with `Ctrl/⌘+Z`).
- Drawings are stored per symbol in `(time, price)` coordinates and persisted to `localStorage`. They survive timeframe switches and can extend into the future area.
- Drawings are rendered by a native Lightweight Charts series primitive (`src/drawings/DrawingsPrimitive.ts`), so they pan and zoom with the chart and show their prices and times on the axes.

---

## 1. System architecture

```
                   ┌──────────────────────────── Zustand store (single, atomic) ───────────────────────────┐
                   │  market: symbol · timeframe · base[] (fetched bars) · baseTf                           │
 useReplayLoop ──▶ │  replay: status · cutoffIndex · cursor · speed        ◀── ReplayToolbar / shortcuts    │
 (setInterval      │  trading: book{pendingOrders, positions, closedTrades, orderHistory} · account · events│
  1000/speed ms)   │  chart: indicator settings · order-ticket draft        ◀── OrderPanel / BottomPanel    │
                   └─────────────┬───────────────────────────────────────────────────────┬──────────────────┘
                                 │ stepForward()                                         │ cursor, tf
                                 ▼                                                       ▼
          ┌───────────── Replay Engine ─────────────┐                    ┌──────── useChartData ─────────┐
          │ target = nextCandleEndIndex(cursor, tf) │                    │ visibleCandles(base, tf, cur) │
          │ for each base bar in (cursor, target]:  │                    │  (closed buckets memoised +   │
          │     book = processBar(book, bar)  ──────┼──▶ Matching Engine │   partial last bucket rebuilt)│
          │ account = computeAccount(book)          │    (pure fn)       │ ema(visible)                  │
          │ commit { cursor, book, account, events }│                    └───────────────┬───────────────┘
          └─────────────────────────────────────────┘                                    ▼
                                                                          PriceChart (Lightweight Charts)
                                                                          series.update() per tick,
                                                                          setData() on discontinuity,
                                                                          TradeLinesPrimitive (draggable
                                                                          entry/SL/TP/order/preview lines),
                                                                          DrawingsPrimitive, fill markers
```

Key design decisions:

| Decision | Why |
|---|---|
| **One base series per chart; coarser timeframes are derived** | The base is the chart timeframe's native bars (or the nearest finer fetched timeframe). Switching to a coarser timeframe mid-replay aggregates the same base, so the cursor and fills don't change. |
| **Replay cursor is a base-bar index** | "Step 1 candle" = advance to the end of the next chart-timeframe bucket and stream every base bar in between through the engine. |
| **No look-ahead** | The last visible candle is re-aggregated only from bars ≤ cursor; indicators are computed on the visible slice; orders are only tested on bars *after* they were placed. |
| **Pure matching engine** | `processBar(book, bar) → { book, events }` has no React/Zustand dependencies, so it is deterministic and unit-tested. |
| **Atomic tick commit** | Candle reveal, fills, SL/TP exits and mark-to-market happen in one `set()`, so the UI never shows an inconsistent frame. |
| **Incremental chart sync** | Replay ticks call `series.update()` (O(1), keeps the user's zoom/pan); `setData()` only on symbol/TF/period change, reset or seek. |

### Replay state machine

```
   off ──enterReplay──▶ selecting ──click candle / random──▶ paused ⇄ playing
    ▲                     │ Esc (no session)                   │  play/pause
    │                     ▼                                    │ cursor hits end
    └──────exitReplay─────┴──────────── reset ◀──── ended ◀────┘
```

Reset returns the cursor to the cutoff and clears the paper account (positions opened "in the future" would otherwise be inconsistent). Exiting replay does the same.

### Matching engine algorithm (per base bar)

1. Build the intra-bar path: bullish `O → L → H → C`, bearish `O → H → L → C`.
2. Every pending order and every SL/TP is a **trigger** `{ level, dir }`:
   - buy limit / sell stop / long SL / short TP → fires when price ≤ level
   - sell limit / buy stop / long TP / short SL → fires when price ≥ level
3. At the open, fire everything already satisfied (**gap**: stops slip to the open, limits get price improvement). Same-price priority is pessimistic: SL → TP → entries.
4. Walk each segment. Repeatedly fire the trigger nearest to the current price that the segment crosses, filling at the trigger level.
5. A fill opens a position with its bracket, and that bracket is live for the rest of the same bar, so entry and exit can both happen inside one candle.
6. Mark all positions to the bar close.

Positions are independent tickets (hedging-style): each filled order becomes its own position with its own SL/TP. Margin is `price × lots × contract size / leverage` (default 1:100). New orders are rejected if their margin plus the margin reserved by pending orders is more than free margin.

---

## 2. Core interfaces

Defined in [`src/types/index.ts`](src/types/index.ts):

```ts
interface Candle   { time; open; high; low; close; volume }                 // time = unix seconds
interface Order    { id; symbol; side; type: 'market'|'limit'|'stop'; qty /* lots */; contractSize?; price?;
                     stopLoss?; takeProfit?; status; createdAt; filledAt?; fillPrice? }
interface Position { id; symbol; side; qty /* lots */; contractSize?; entryPrice; stopLoss?; takeProfit?;
                     openedAt; orderId; currentPrice; unrealizedPnl }
interface Account  { initialBalance; balance; equity; realizedPnl; unrealizedPnl; marginUsed; leverage }
interface ReplayState { status: 'off'|'selecting'|'paused'|'playing'|'ended';
                        cutoffIndex: number|null; cursor: number; speed: 0.5|1|2|5|10 }
```

---

## 3. Project structure

```
src/
├── types/index.ts                 Domain model: Candle, Order, Position, Account, ReplayState …
├── data/
│   ├── generator.ts               Symbol specs (precision, lot/contract size); the synthetic feed is kept only for tests
│   ├── aggregate.ts               TF aggregation, no-look-ahead visibleCandles(), step targets
│   ├── twelveData.ts              Twelve Data REST client (fetch on demand, 1 request per timeframe)
│   ├── fileImport.ts              MT5 / MT4 / TradingView / Dukascopy / Binance / CSV parser (format + timeframe detection)
│   └── realDataCache.ts           IndexedDB persistence of fetched / imported series
├── indicators/index.ts            EMA
├── engine/
│   ├── matchingEngine.ts          Pure order book + intra-bar matching (limit / stop / SL / TP)
│   └── risk.ts                    Ticket validation, margin checks, account computation, risk-% lot sizing
├── drawings/
│   ├── types.ts                   Drawing model, tool list, Fib levels, palette
│   ├── timeMapper.ts              time ⇄ fractional logical index (interpolates / extrapolates)
│   ├── geometry.ts                Projection, anchors, hit testing
│   ├── DrawingsPrimitive.ts       LWC series primitive: renders drawings + axis labels
│   └── interactions.ts            Pointer handling: create / select / drag / move
├── tradelines/
│   ├── model.ts                   Positions / orders / ticket → chart lines (with live drag preview)
│   ├── TradeLinesPrimitive.ts     LWC primitive: lines, PnL labels, ✓/× buttons, axis labels
│   └── interactions.ts            Drag to move SL/TP/orders/preview, × to close / cancel
├── store/useTradingStore.ts       Zustand store: replay state machine + trading actions
├── store/useDrawingStore.ts       Zustand (persisted): drawings per symbol, tool, undo stack
├── hooks/
│   ├── useReplayLoop.ts           Replay clock (interval = 1000 / speed)
│   ├── useChartData.ts            Memoised visible candles + indicators
│   └── useKeyboardShortcuts.ts
├── components/
│   ├── chart/PriceChart.tsx       Lightweight Charts: candles, volume, EMA, trade lines, markers
│   ├── chart/seriesSync.ts        update()-vs-setData() diffing
│   ├── chart/DrawingToolbar.tsx   Left drawing toolbar
│   ├── chart/DrawingProperties.tsx Floating style editor for the selected drawing
│   ├── chart/ChartContextMenu.tsx Right-click menu (drawing actions, price actions, replay, remove all)
│   ├── replay/ReplayToolbar.tsx   Select bar · random · play/pause · step · reset · speed · exit
│   ├── trading/OrderPanel.tsx     Market / limit / stop ticket with SL/TP and R:R (shared with chart preview)
│   ├── trading/AccountSummary.tsx
│   ├── trading/BottomPanel.tsx    Positions (inline SL/TP edit) · Orders · History · Journal
│   └── layout/{Dashboard,TopBar,DataSourceMenu,ImportPanel}.tsx
tests/                             Vitest: matching engine, aggregation, indicators, drawings, trade lines, data import
mt5/GonyExportBars.mq5             MetaTrader 5 script: export all 6 timeframes as importable CSV
```

## Real market data (Twelve Data)

The **Load data / Market data** button at the right of the top bar opens the *Market data* panel, which has two tabs: **Twelve Data API** and **Import file (MT5…)**. If a symbol has no saved data, the chart shows a **Load ⟨symbol⟩ data** button, and Replay and trading stay disabled until data is loaded.

1. Get a free API key at [twelvedata.com](https://twelvedata.com/pricing) and paste it in. The key is stored only in this browser's `localStorage`.
2. Click **Fetch ⟨symbol⟩ · 6 timeframes**. This sends one request per timeframe (15m, 1H, 4H, 1D, 1W, 1M), 6 API credits in total, each returning up to 5,000 bars. The free plan allows 8 requests/min and 800/day.
3. The bars are saved in IndexedDB and shown straight away after a page reload, with no new request. **Nothing is fetched automatically and nothing streams**; click **Refresh** whenever you want newer bars. The trash icon deletes a symbol's saved data.

Symbols map to `XAU/USD`, `EUR/USD`, `AUD/USD`, `BTC/USD`, `ETH/USD` and `SPX`. Some symbols (e.g. indices) may need a paid plan. The panel shows the API error and keeps whatever timeframes did load.

How real data is used:

- Each chart timeframe shows its **native** bars, so 1D has about 20 years of history while 15m has about 2 months. If a timeframe failed to load, the chart aggregates the nearest finer timeframe.
- In replay, the matching engine checks fills on the bars of the timeframe the replay was started on. For more precise SL/TP fills, start on (or switch down to) a lower timeframe.
- During replay, switching to a **coarser** timeframe aggregates the current bars. Switching to a **finer** timeframe moves onto the finer series at the end of the revealed bar, so nothing from the future is shown. If the finer data doesn't reach back that far, the switch is refused with a message.
- Twelve Data has no volume for forex or gold, so the Volume pane is empty for those symbols.

## Importing files (MT5, MT4, TradingView, CSV)

Open **Market data → Import file (MT5…)**, then drop one or more `.csv`/`.txt` files or click to browse. For each file the panel shows the detected format, the symbol and timeframe, the bar count and the date range. Imported bars are saved in IndexedDB like fetched ones. The saved-data table shows where each timeframe came from.

### Exporting from MetaTrader 5

**Option A: script (all 6 timeframes at once, recommended)**

1. Copy [`mt5/GonyExportBars.mq5`](mt5/GonyExportBars.mq5) to `MQL5/Scripts/` (MT5: *File → Open Data Folder*). Compile it in MetaEditor (F7).
2. Drag the script onto a chart. Inputs:
   - `InpSymbols`: comma list, e.g. `XAUUSD,EURUSD`; empty means the chart symbol.
   - `InpMaxBars`: default 50000.
   - `InpToUtc`: default on.
3. It writes `MQL5/Files/GonyBarReplay/<SYMBOL>_<M15|H1|H4|D1|W1|MN1>.csv` with `time,open,high,low,close,volume`. Import all six files in one go; the symbol is taken from the file name, and broker suffixes such as `XAUUSDm` or `GOLD` are recognised.

With `InpToUtc` on, intraday times are converted from broker server time to UTC using the server's *current* offset. Past DST changes are not corrected, so bars from the other DST season can be off by an hour. D1/W1/MN1 keep their trading date. Volume is real volume when the broker provides it, otherwise tick volume. The history you get is limited by *Tools → Options → Charts → Max bars in chart*.

**Option B: manual export (built in)**

Open *View → Symbols* (Ctrl+U) → **Bars** tab. Pick the symbol, the timeframe and the date range, then click **Request** and then **Export Bars**. Import the tab-separated file directly. MT5 writes broker **server time**, so set *File time* in the import panel to your broker's zone (often UTC+2 in winter and UTC+3 in summer).

### Supported formats (auto-detected)

| Source | Example |
| --- | --- |
| MT5 Bars export | `<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\t<VOL>\t<SPREAD>` (tab separated, `2026.09.25\t20:45:00`) |
| MT4 History Center export | `2026.09.25,20:45,4250.1,4255.0,4249.0,4252.3,812` (no header) |
| GonyExportBars.mq5 / TradingView chart export | `time,open,high,low,close,Volume` with unix seconds or ISO time |
| Dukascopy historical data | `Gmt time,Open,High,Low,Close,Volume` with `25.09.2026 20:45:00.000` |
| Binance klines | no header, first column open time in ms |
| Any CSV/TSV/semicolon file | a date (+ optional time) column and open/high/low/close; volume optional. Decimal commas are accepted in `;` files |

Parsing details:

- **Dates** can be `YYYY-MM-DD`, `YYYY.MM.DD`, `DD.MM.YYYY`, `MM/DD/YYYY` (day/month order is detected per file), `YYYYMMDD`, ISO with a zone, or unix s/ms.
- **Timeframe** is detected from the bar spacing. 1m/5m files are aggregated into 15m, 30m into 1H, 2H into 4H, and 12H into 1D. You can also force a coarser timeframe, e.g. import M15 bars as 1H.
- If you import only one timeframe, the other timeframes are aggregated from it. For example, M15 alone also gives 1H to 1M, and D1 alone gives 1D, 1W and 1M.
- **File time** (UTC−12 … UTC+14) applies only to zone-less intraday timestamps. Unix/ISO-with-zone times and D1+ bars are never shifted.
- Rows are sorted and duplicates removed; unreadable rows are skipped and counted. High and low are widened to include open and close if needed.
- **Merge** keeps the saved bars of that timeframe and adds the file's bars (the file wins on overlap), e.g. to extend history. Otherwise the timeframe is replaced.
