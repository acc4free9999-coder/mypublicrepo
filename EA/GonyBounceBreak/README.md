# GonyBounceBreak

MetaTrader 5 Expert Advisor for a closed-candle consolidation range, horizontal
breakout and retest on the attached chart's current timeframe. No indicators,
DLLs, external services or third-party libraries are required.

**Validation status:** native MetaEditor compilation, broker integration and
Strategy Tester runs must be performed before live use. This repository does not
include a compiled EX5 or a claim of profitability.

## Installation

1. Copy this folder into `MQL5/Experts/GonyBounceBreak` in the MT5 data folder.
2. Open [GonyBounceBreak.mq5](./GonyBounceBreak.mq5) in MetaEditor and compile.
   Keep [GonyBounceBreakCore.mqh](./GonyBounceBreakCore.mqh) alongside it.
3. Attach the EA to the desired symbol and timeframe. Enable algorithmic trading
   in MT5 and in the EA's permissions.
4. Use a **unique symbol/magic pair**. Live duplicate instances in the same
   terminal are rejected, including instances on different timeframes.

## Strategy and lifecycle

- On attachment, scan immediately for a range (without entering a trade).
  If chart history is not loaded yet, retry at most once per second using ticks
  or the lifecycle timer. Then, at a new chart bar, inspect exactly
  `InpBuildUpCandles` **closed candles**,
  using their wick highs and lows. A positive range no taller than
  `InpMaxRangePips` becomes the frozen support/resistance pair. The forming
  candle is excluded.
- If no range qualifies, the Experts Journal reports the measured range height
  and configured maximum. No lines are drawn in that case. Lines are foreground,
  solid objects visible in MT5's Objects List; their names end in `.Support`
  and `.Resistance`. `OBJPROP_HIDDEN` controls the Objects List, not chart drawing.
- The EA stays in `STATE_SEARCHING_BUILDUP` with these lines fixed until a
  subsequent candle closes **strictly** above resistance or below support.
  Equality is not a breakout. The breakout candle cannot be included in the
  range used to detect its own breakout. There is no range-age timeout.
- Record that candle's opening time and enter `STATE_WAITING_RETEST`. The first
  retest candle is the candle immediately after the breakout candle.
- `ENTRY_LIMIT_ORDER`: submit one Buy Limit/Sell Limit at the broken line,
  immediately when that breakout close is confirmed. If that line cannot be a
  valid pending price at the current quote, skip the setup; do not substitute a
  market order. Tolerance does not move the pending price.
- `ENTRY_MARKET_TOUCH`: chart Bid must return toward the line from the breakout
  side and enter the inclusive `level +/- tolerance` band. A buy requires a
  downward Bid movement with the preceding Bid at/above the line; a sell requires
  upward movement with the preceding Bid at/below it. A gap completely through
  the band, an unchanged quote, or an approach from the opposite side is not a
  touch. Buy execution uses Ask, sell execution uses Bid.
- Allow exactly `InpMaxWaitBars` chart candles after the breakout. If the breakout
  candle's current shift exceeds that number, cancel pending orders and reset.
  For 12 bars, shifts 1 through 12 are eligible; shift 13 expires the setup.
  Missing breakout history also invalidates the setup.
- Once filled, `STATE_IN_TRADE` prevents further submissions. SL and TP are
  server-side. Partial positions remain managed until fully closed; any pending
  remainder is cancelled. The EA does not trail, scale in or close positions on
  retest timeout.
- On closure, manual pending cancellation or failed validation, delete the
  lines and reset. A fresh build-up is considered at the next new bar. Each
  breakout permits **one request**, with no automatic retry of rejected orders.
  Timeouts/uncertain responses are quarantined until exposure is observed or the
  retest window expires; they are never blindly resubmitted.

## Inputs

The requested build-up, execution, risk and visualization inputs are provided
with their specified defaults. Three additional inputs select the requested
alternative exit methods:

| Input | Default | Meaning |
| --- | --- | --- |
| `InpStopMode` | `STOP_FIXED_PIPS` | Fixed distance from expected entry, or `STOP_OPPOSITE_RANGE` at the other frozen range bound |
| `InpTargetMode` | `TARGET_FIXED_PIPS` | Fixed distance, or `TARGET_RISK_REWARD` based on entry-to-SL distance |
| `InpRiskRewardRatio` | `2.0` | Target reward/risk multiple in RR mode |

Only parameters used by the selected sizing/exit modes must be positive.
`InpRiskPercent` must be in `(0, 100]`; tolerance and slippage may be zero;
build-up candles must be in `[2, 10000]`, wait bars at least 1, and line width
in `[1, 5]`. These are validity bounds, not recommendations for sensible risk.

### Broker and risk behavior

- A pip is 10 points on 3/5-digit symbols and one point otherwise. On metals,
  indices or other instruments, verify this convention against your broker.
- Prices are rounded to `SYMBOL_TRADE_TICK_SIZE`, not merely decimal digits.
  Stop distances, order capabilities, permissions, directional volume limits
  and `OrderCheck` margin/validity checks are enforced. An invalid setup is
  logged and skipped, not silently widened or sent without SL/TP.
  Symbols configured to remove SL/TP automatically at day change are rejected.
- Risk sizing uses `OrderCalcProfit` to convert entry-to-SL loss for one lot into
  **account currency**, then uses current equity. Market sizing includes the
  requested adverse slippage allowance. Round volume **down** to the broker's
  step; never round a below-minimum risk size up to the minimum lot.
- Risk-based lots are capped by broker maximum/directional limits; fixed lots
  are rounded down to step but rejected if outside permitted limits.
- RR and fixed-pip exits use the expected entry and tick-rounded stops; actual
  market fills can change distances/RR. Commission, swap, gaps and price
  improvement/slippage are not exact-risk guarantees. Deviation is a broker
  request and is not enforced under all execution modes.
- On netting accounts, do not share the symbol with manual trading or other
  EAs. Entries are blocked while any symbol position exists, and pending orders
  are cancelled if an unrelated symbol position appears. A broker can still
  merge simultaneous fills before the EA can intervene. Hedging accounts
  isolate positions by symbol and magic.

## Recovery and removal

Live snapshots use terminal globals keyed by account, server/symbol hash and
magic. Consumption is flushed before sending an order. Broker exposure is the
source of truth on restart; a closed trade is not resubmitted. Tester runs do
not use live snapshots or instance locks.
An offline terminal's exposure cache does not trigger a closure/reset; lifecycle
reconciliation waits for a connection.

Reinitialization reuses the existing instance-lock variable without recreating
or overwriting it. Error 4502 (`ERR_GLOBALVARIABLE_EXISTS`) is not a fatal lock
creation error when another chart creates the variable concurrently. Ownership
is still acquired atomically; an active owner remains protected.

Reinitialization restores the frozen range and waiting state. Timeframe changes
invalidate the old pending setup; existing positions retain their server-side
exits. Parameter changes keep the signal but use the new entry/management
settings for subsequent decisions; existing orders' SL/TP are not modified.
Market-touch recovery starts with the latest Bid, so an offline touch is not
replayed. Offline breakout candles are not backfilled.

Every deinitialization removes this EA's two chart lines only. Manual removal,
chart closure or template replacement attempts to cancel its pending orders;
**open positions are never forcibly closed**. Recompilation, input changes and
terminal shutdown preserve recoverable broker exposure. If a deletion fails
(including freeze-level or permission restrictions), it is logged; reattach the
EA or cancel the order manually.

Pending orders use GTC because expiry is defined in **chart bars**, not seconds.
The EA must remain connected and running to enforce bar-based cancellation.
Timers perform lifecycle cleanup and retry the initial range scan, but never
enter from stale quotes. No client EA
can prevent a server-side fill during disconnection, a freeze restriction or a
cancellation race. Monitor outstanding orders when stopping MT5.

## Verification

Compile and run [GonyBounceBreakCoreTests.mq5](./tests/GonyBounceBreakCoreTests.mq5)
as an MT5 script (it may be compiled in this folder and its EX5 copied to
`MQL5/Scripts`). Its Journal summary must show **36 checks, 0 failures**. The
script exercises pip conversion, closed-bar range bounds, strict breakouts, tolerance/direction,
expiry boundaries, volume rounding and tick-size rounding.

On macOS/Linux, the same core assertions can also be run with Python 3 and an
existing C++17 compiler:

```sh
python3 tests/run_portable_core_tests.py
python3 tests/run_portable_lock_tests.py
python3 -B tests/run_portable_startup_tests.py
```

This adapter compiles the actual shared core and test assertions, adapting only
MQL array syntax, basic math and logging. It does **not** compile the EA or test
MT5's series-storage semantics, event loop, persistence, orders or broker APIs.
Native MetaEditor compilation and the integration scenarios below are still
required.

The lock regression runner compiles the EA's actual `AcquireLock` function
against mocked terminal APIs. Its 10 scenarios cover fresh/released locks,
active/stale owners, concurrent creation, creation/read/reclaim failures and
tester bypass. It does not replace testing reattachment and duplicate-instance
protection inside MT5.

The startup regression runner exercises the actual range-establishment/startup
functions with mocked history/chart APIs: immediate qualifying and oversized
ranges, unloaded history, retry throttling/recovery and draw/persistence failure.
It does not verify visual rendering in MT5.

Backtest the EA with **Every tick based on real ticks**, then forward-test on a
demo account. Test both breakout directions and entry methods, all SL/TP/lot
modes, strict-close equality, wide spreads, insufficient margin, below-minimum
risk size, expiry with no touch, partial fills, manual cancellation, trade
closure, restart recovery, timeframe changes, disabled algo trading, and
duplicate-instance rejection. Check both 3/5-digit FX and non-point tick-size
symbols supported by your broker. OHLC-only modeling is not sufficient to verify
tick-touch entries or pending-order cancellation timing.
