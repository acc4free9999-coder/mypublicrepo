# GonyBreakout

Standalone MetaTrader 5 Expert Advisor for confirmed M15 key-level breakouts.
The implementation is in [GonyBreakout.mq5](./GonyBreakout.mq5) and has no
external libraries or DLL dependencies.

> **Validation warning:** this environment does not provide MetaEditor or an MT5
> Strategy Tester. The source has not been natively compiled or backtested here;
> zero compiler warnings, broker compatibility, and performance are therefore
> not claimed. Compile and test on the target MT5 build before any live use.

## Strategy behavior and assumptions

- Attach to an **M15 chart**. Initialization fails on other chart periods.
  Detection uses only completed candles; the current candle is never a signal.
- By default, simple candle mode checks the **previous completed M15 candle**
  (or the configured prior-candle range) and buys when the current completed
  candle closes above its high, or sells when it closes below its low, plus the
  configured buffer. The breakout candle is not included in the reference
  range. In direct mode, entry follows on the next available tick after that
  candle closes.
- The default simple test profile uses zero buffer/minimum body/minimum
  distance/body-range ratio, disables session/trend/ATR/news filters, and caps
  candle body at 40 pips. The spread filter is disabled by default to avoid
  blocking cross-symbol tests; configure `InpMaxSpreadPips` before live use.
- Set `InpUseSimpleCandleBreakout=false` to use the configurable key-level
  mode: previous D1 high/low/open/close, previous W1 high/low, highest/lowest
  price across the completed M15 lookback, and optional comma-separated
  absolute prices. The lookback extrema are a simple recent-swing proxy, not a
  pivot/fractal detector.
- In either mode, breakout candle body-size, body/range, optional ATR/trend,
  session, spread, and risk filters still apply. The selected level must be
  crossed from the prior candle close and cleared by the configured buffer.
- Direct mode enters after the qualifying candle closes. Retest mode requires a
  later completed candle to touch the tolerance band and close back outside the
  level in the breakout direction. A close back inside invalidates the setup;
  a setup also expires after the configured number of subsequent M15 candles.
- Stop distance is configured in pips. Take profit is either fixed pips or the
  selected risk/reward multiple. Distances are widened to at least the broker's
  stop-level minimum plus current spread/tick buffer; all prices are rounded to
  the symbol tick size.
- Pip convention is 10 points on 3/5-digit symbols and one point otherwise.
  This convention may not match metals, indices, or unusual broker symbols.
- M15 EMA and closed H1 close-vs-EMA filters are optional. ATR bounds and
  server-time session filtering are optional. There is deliberately no built-in
  news feed; enabling the news filter blocks all entries until an external
  provider is implemented in `NewsAllowsTrading()`.
- A maximum of one position belonging to this EA's symbol/magic pair is allowed.
  Positions belonging to other EAs or manual trades are not included. Do not
  share a symbol/magic pair between EA instances; a terminal-global instance
  lock rejects a second live chart using that pair. Netting accounts require
  particular care with other strategies trading the same symbol.
- A breakout candle is consumed once even when spread, risk, margin, or order
  checks reject the order. The EA does not retry the same signal on later ticks.
  It retries once only for explicit requote/price-changed/price-off responses;
  ambiguous timeouts are not retried.

## Lot sequence and closed-trade accounting

The sequence is driven by closed positions, not floating P/L:

| Closed trade result | Next lot |
| --- | ---: |
| Initial trade wins or breaks even | `InpFirstLot` |
| First consecutive loss | `InpSecondLot` |
| Second consecutive loss | `InpRecoveryLot` |
| Recovery trade wins or breaks even | `InpFirstLot` |
| Recovery trade loses | `InpFirstLot` (no escalation) |

Deals are grouped by MT5 position identifier, so partial exits are not separate
trades. The final result sums profit, swap, commission, and fee for the
position's EA-magic deals. Progression and the consecutive-loss safety streak
are persisted in terminal global variables, and closed history is reconciled on
initialization and trade events. Persistence is disabled in Strategy Tester
runs so separate test passes do not contaminate one another.

Before any order, estimated stop-loss cash risk is calculated with
`OrderCalcProfit`. If the recovery order exceeds the per-trade risk cap or would
breach the daily loss budget, it is skipped; `InpResetAfterSkippedRecovery`
controls whether the progression then resets to the normal lot. Volume is
rounded down to the broker's minimum/step grid. If the configured lot is below
the minimum, the EA skips it rather than rounding up and increasing risk.
Risk estimates exclude future commissions and cannot guarantee the loss at a
gapped stop.

## Inputs

Inputs are grouped in MetaTrader's EA properties:

| Group | Parameters and meaning |
| --- | --- |
| General Settings | `InpMagicNumber` uniquely identifies trades; `InpMaxSlippagePoints` is requested deviation in points; `InpUseNewsFilter` safely blocks entries because no news data provider is bundled. |
| Key Level Settings | `InpUseSimpleCandleBreakout` selects the simple prior-candle/range trigger by default; `InpSimpleBreakoutLookback` sets how many prior closed M15 bars define that range. Turn simple mode off to use key-level mode: `InpUsePreviousDayHigh`, `InpUsePreviousDayLow`, `InpUsePreviousDayOpen`, and `InpUsePreviousDayClose` toggle previous-day levels; `InpUsePreviousWeekHigh` and `InpUsePreviousWeekLow` toggle previous-week levels; `InpUseRecentSwingHigh` and `InpUseRecentSwingLow` toggle lookback extrema; `InpSwingLookbackBars` sets the M15 extrema window; `InpManualLevels` is a comma-separated price list. |
| Breakout Settings | `InpBreakoutBufferPips` is the required close-through distance; `InpMinBodyPips`/`InpMaxBodyPips` bound body size; `InpMinDistancePips` sets minimum close distance; `InpMinBodyRangeRatio` rejects weak candles; `InpATRPeriod`, `InpMinATRPips`, and `InpMaxATRPips` configure optional volatility bounds (zero bound disables it). |
| Entry Confirmation | `InpEntryMode` chooses direct or retest; `InpRetestTolerancePips` is the touch band; `InpMaxRetestBars` is the retest expiry. |
| Lot Progression | `InpFirstLot`, `InpSecondLot`, and `InpRecoveryLot` set the three sequence sizes; `InpResetAfterSkippedRecovery` resets progression if recovery is blocked by risk safety. |
| Stop Loss / Take Profit | `InpStopLossPips` sets stop distance; `InpUseRiskReward` selects RR vs fixed TP; `InpTakeProfitPips` applies in fixed mode; `InpRiskRewardRatio` applies in RR mode; `InpUseBreakEven`, `InpBreakEvenTriggerPips`, and `InpBreakEvenLockPips` configure break-even; `InpUseTrailingStop`, `InpTrailingStartPips`, and `InpTrailingDistancePips` configure trailing. |
| Risk Management | `InpMaxRiskPerTradePercent` is the equity risk cap; `InpMaxDailyLossPercent` is the daily loss cap relative to inferred day-start balance; `InpMaxConsecutiveLosses` is the maximum loss streak; `InpMaxTradesPerDay` counts unique EA positions opened since server midnight; `InpMaxSpreadPips` blocks wide spreads; `InpDailyProfitTargetPercent` optionally stops entries at a daily profit target. Zero disables the daily loss, trade-count, spread, or profit-target limit where applicable. |
| Trend Filters | `InpUseEMAFilter` and `InpEMAPeriod` enable/configure M15 EMA direction; `InpUseH1TrendFilter` and `InpH1EMAPeriod` enable/configure H1 confirmation. |
| Trading Sessions | `InpUseSessionFilter` enables a server-time session; `InpSessionStartHour` and `InpSessionStartMinute` set the start; `InpSessionEndHour` and `InpSessionEndMinute` set the end. Equal start/end means all day; an end earlier than start spans midnight. |
| Dashboard | `InpShowDashboard` toggles the panel; `InpDashboardCorner`, `InpDashboardX`, `InpDashboardY`, and `InpDashboardFontSize` set its placement and appearance. |

The dashboard reports status, symbol/timeframe, selected level and direction,
lot sequence, loss count, trades and P/L today, open EA position, daily
drawdown, and trading mode. Its STOPPED state includes account permissions,
session/spread/news filters, and configured risk gates.

## Installation

1. In MT5 choose **File → Open Data Folder**.
2. Copy `GonyBreakout.mq5` into `MQL5/Experts/GonyBreakout/`.
3. Open it in MetaEditor and compile. Resolve any build-specific compiler
   diagnostics before proceeding.
4. Attach it to an M15 chart, set a unique magic number, review every input, and
   enable Algo Trading. Check the Experts and Journal tabs for initialization
   or broker execution errors.
5. Start with a demo account. Never assume a backtest or configured risk cap
   guarantees live results.

## Backtesting and required validation

Use MT5 Strategy Tester, select **GonyBreakout**, a symbol with adequate history,
M15, and **Every tick based on real ticks** where available. Run BUY and SELL
scenarios separately by selecting periods/symbols that produce the desired
breakouts or by disabling irrelevant levels. Record the broker build, symbol,
date range, spread/model, and all input values.

Explicitly test:

1. The loss sequence `0.01 → 0.01 → 0.05`, recovery win reset, recovery loss
   reset, and restart between closed trades.
2. Partial closes, commission/swap/fee aggregation, and no counting of a partial
   close as a separate trade.
3. Direct and retest entries, close back inside, retest expiry, duplicate signal
   prevention, and closed-candle-only behavior.
4. Risk and daily-loss block of an oversized recovery lot; maximum daily trades,
   consecutive-loss stop, profit target, spread spikes, and session boundaries.
5. Broker minimum/step variations, stop-level restrictions, insufficient margin,
   execution rejections, and both 3/5-digit and non-FX tick-size symbols.
6. Break-even/trailing, restart persistence, and operation with the news filter
   enabled (which should block all entries without an integration).

Performance statistics requested for any deployment—total trades, win rate,
profit factor, maximum drawdown, average R:R, maximum consecutive losses, net
profit, and recovery factor—must be taken from actual Strategy Tester output
for the selected broker, symbol, date range, and settings. No results are
reported here because no MT5 tester was available.

## Known limitations

- Native MetaEditor compilation, warning count, broker integration and Strategy
  Tester results are unverified in this environment.
- “Recent swing” means lookback high/low, not structure-aware swing pivots.
- The news filter is only a fail-closed interface; no calendar/source is
  provided.
- Daily P/L is calculated from this EA's symbol/magic deals since server
  midnight plus current floating P/L. The inferred opening balance can be
  affected by deposits, withdrawals, or other account activity during the day.
- Max risk is based on the configured stop and `OrderCalcProfit`; it does not
  include commissions, gaps, or execution slippage. Broker stop rules may force
  a wider stop distance than configured.
- The dashboard uses chart objects and its STOPPED status represents strategy
  entry eligibility; it does not close an existing position when entries stop.
- Terminal global variables normally persist across restarts but MT5 may remove
  variables not accessed for four weeks. Keep the EA/terminal active or verify
  progression from available trade history after a long shutdown.
