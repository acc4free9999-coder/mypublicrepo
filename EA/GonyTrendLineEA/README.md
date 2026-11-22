# Recent Trendline Research EA

This self-contained MT5 Expert Advisor can send **real broker orders** when
explicitly enabled. Automatic trading is enabled by default, but real-account
permission remains disabled by default. Its rules are untested research hypotheses, not a claim
of profitability or a reliable market prediction. Losses can exceed the
estimated risk. The previous Phase 4 buttons and pivot layers are absent.

## Automatic trading: experimental

`EnableAutoTrading=true` and `AllowRealAccount=false` by default. The EA can
send orders on a demo/tester account when trading permissions permit. It will
fail initialization on a real account unless `AllowRealAccount=true` or
`EnableAutoTrading=false` is set. MT5's terminal,
account and EA trading permissions must also be enabled. Attach on an H1
chart, with `WriteResearchCsv=true` and `MaxTrendlinesToDisplay` at most 3;
otherwise initialization fails. Compile and test on a demo account before
considering real money. **This version has not been compiled or run in MT5 in
the current development environment.** Previously saved MT5 inputs can
override source defaults; check the EA's Inputs tab after updating it.

The approved starting rules are:

- H4 bias is bullish when the two latest eligible confirmed H4 swing highs and
  the two latest eligible confirmed H4 swing lows both rise; bearish when
  both fall. Otherwise it is neutral and no order is submitted. The same
  pivot windows, lookback, deviation and noise-anchor settings described below
  are used on closed H4 bars.
- On the most recently closed H1 candle, the EA considers the highest-ranked
  displayed trendline aligned with that bias which meets confirmation. For a
  buy, the low must be within `AutoTouchToleranceATR * ATR` of the line and
  the candle must close above both its open and the line plus
  `AutoCloseBufferATR * ATR`. Sell rules are mirrored. If none qualifies,
  no order is submitted.
- A buy stop is the confirmation candle's low minus `AutoStopBufferATR * ATR`;
  a sell stop is its high plus the buffer and the current spread. Stops are
  rounded away from entry to the symbol tick grid and are never moved by this
  EA. Targets are the nearest eligible confirmed opposing H1 swing level in
  the trade direction that no subsequent closed H1 candle has broken by more
  than `AutoLevelBreakToleranceATR * ATR`. Short targets add the current
  spread to the bid-chart swing low. Targets are rounded toward entry. These
  are explicit swing-level rules, not guarantees that a level will hold.
- A positive stop, target, and theoretical **price** R:R of at least 3 are
  required. The comparison allows `1e-10` for floating-point roundoff.
  Sizing uses actual account equity and `OrderCalcProfit` with adverse entry
  and exit price assumptions of `AutoDeviationPoints` each, plus
  `AutoCommissionPerLot` in account currency. `AutoRiskPercent` defaults to
  0.5 and cannot exceed 0.5. Volume is rounded down to the broker's step and
  rejected if its minimum exceeds the estimated budget. Zero commission
  assumes no commission; set a realistic round-trip value.
- Only a newly closed H1 candle observed on the next bar's first tick is
  considered. Startup snapshots and missed signals are not traded. The model
  requires bid-based chart bars. It blocks a new trade if **any** position or
  active order already exists on the symbol, including manual or other-EA
  orders, to avoid netting interference. Use only one terminal/EA for the
  symbol: the local lock cannot coordinate separate terminals.

The EA runs `OrderCheck`, records the request, persists a safety fence, then
calls `OrderSend` with broker-side SL and TP. A completed response is checked
against the selected position, protective prices, actual fill R:R and estimated
stop risk. An ambiguous response, partial fill, missing protection, excessive
estimated fill risk or other post-send inconsistency raises an alert, stops
the engine and **retains the fence**; the EA does not automatically close or
modify the position. The user must immediately inspect broker orders and
positions, including whether SL/TP actually exist, and manage exposure
manually. On received ticks, the EA also checks that its open positions still
have SL and TP; missing protection raises an alert and stops the engine.
There is no monitoring while the EA is stopped, detached, disconnected or not
receiving ticks. After reconciling, the terminal global variable
`GTLRA_<account-login>_<symbol>_fence` can be set to zero using MT5's Global
Variables dialog, and the matching `GTLRA_<account-login>_<symbol>_fence.txt`
can be removed from the MT5 common `Files` folder. Both must be cleared;
never clear either before reconciliation. The file also preserves the fence
when terminal global variables expire. Auto decisions,
requests and server responses are appended to the research CSV and Experts
log. `AutoMagic` identifies this EA's orders.

The 0.5% figure is an **estimate**, not a loss cap. Market execution may
exceed the requested deviation; gaps, changing spread/conversion, commissions,
financing, and broker behavior can produce a larger loss or worse R:R. SL/TP
execution and account state are controlled by the broker. Disabling or
removing the EA does not close positions or remove existing broker orders.
No profitability is established by the R:R rule.

## Virtual simulation: first increment

The simulator is **disabled by default**. When enabled it evaluates one
manually specified setup per attachment; this is a calculation-validation
step, not automated signal generation. H4 bias, H1-only analysis, automatic
confirmation, key-level identification, a dashboard and aggregate statistics
are **not implemented in the virtual simulator**. The manually entered target is
unverified; the EA does not establish that it is the next valid key level.
Manual settings selected with hindsight can themselves introduce lookahead.
Do not treat their results as a strategy backtest.

Set `VirtualSignalBarTime` to the exact opening timestamp of the signal candle
in the broker's server time,
`VirtualDirection` to buy or sell, and `VirtualStopPrice` and
`VirtualTargetPrice` to fixed absolute prices. The setup is evaluated at the
next bar's open. Start the tester early enough for the trendline engine to
initialize before the signal candle closes. The setup is rejected if its
signal bar was missed, was already closed at initialization, or the next bar was
not observed on its first tick (`tick_volume == 1`). No historical account
equity is reconstructed. The simulator currently requires bid-based chart
bars (`SYMBOL_CHART_MODE_BID`); other chart modes are rejected.

Account equity is read from MT5 at the decision, as requested. It is not a
virtual balance and is **not** adjusted by virtual results. Consequently a
live account's deposits, positions and other changes affect sizing; use an
isolated Strategy Tester account for reproducible research. Symbol tick size,
profit/loss tick values and volume minimum, maximum and step are read and
frozen at entry. The tick values already incorporate the broker's contract
specification and account-currency conversion. This is a linear, frozen-value
approximation: variable conversion rates, broker-specific profit calculations,
financing, and changes to symbol specifications are not simulated.

`VirtualRiskPercent` defaults to 0.5. `VirtualSpreadPoints` and
`VirtualSlippagePoints` are fixed assumptions in `_Point` units, and
`VirtualCommissionPerLot` is a round-trip amount in account currency.
They default to zero and should be set to defensible assumptions. For bid
open `B`, spread `S` and slippage `L`, a long enters at `B + S + L` and a
short at `B - L`. Long exits use bid; short exits use bid plus the fixed spread.
Slippage `L` is applied adversely to both entry and exit. Stop and target
prices are executable exit-side prices: bid for longs, ask for shorts.

A positive stop on the correct side of the entry and a target on the other
side are mandatory. The **theoretical price** reward/risk is
`abs(target - entry) / abs(entry - stop)` and must be at least 3, with a
`1e-10` comparison tolerance for floating-point roundoff. It excludes exit
slippage and commission, and says nothing about profitability. The estimated
stop loss per lot includes adverse exit slippage and round-trip commission:
`((abs(entry - stop) + L) / tickSize) * tickValueLoss + commissionPerLot`.
The equity risk budget is `accountEquity * VirtualRiskPercent / 100`; volume
is rounded **down** to the broker's volume step and capped at its maximum.
If the minimum volume exceeds the budget, the setup is rejected rather than
rounded up. The stop is never moved. Gaps or changed tick values can cause the
actual simulated loss to exceed this estimated budget.

Each bar is processed in chronological order after it closes. If the opening
quote already crosses a stop, the adverse gap-open price is used; a favorable
target gap is conservatively filled at the target. Otherwise, when both levels
occur within the same bar, the stop is assumed first. Exit slippage is then
applied. Net P&L subtracts the configured round-trip commission. Because OHLC
does not reveal intrabar order, MFE and MAE are **price-distance lower bounds**:
completed non-exit bars contribute their extremes, but the exit bar contributes
only its opening quote and exit trigger. They exclude slippage and commission.
No exit is assumed when the EA is detached with a position still open.

The separate `GTLR_Virtual_<chart-id>.csv` journal is enabled with the simulator
regardless of `WriteResearchCsv`. It records the manual setup, direction,
entry/exit bar timestamps, fixed levels, equity, size, theoretical R:R,
assumptions, symbol values, outcome, lower-bound excursions, net/gross results
and rejections. An exit event's decision time is the following bar open; the
exit bar is known, but its exact intrabar exit time is not. Zero-valued fields
on rejected setups may mean information was unavailable. H4 bias and
trendline are explicitly recorded as `not_evaluated`, and confirmation and
target as manual/unverified. The journal appends across attachments. Errors
are reported in the Experts log and stop processing.

### Simulator validation in MT5

1. Compile the self-contained EA in MetaEditor and enable visual Strategy
   Tester with enough pre-signal history. Set realistic nonzero spread,
   slippage and round-trip commission assumptions.
2. Select a signal candle timestamp before it occurs in the replay; enter a
   stop and target on the correct sides of the expected entry. Inspect the
   actual next-bar fill in the journal: slippage and spread can make a
   previously plausible setup fail the 3:1 test.
3. Check `estimated_stop_risk <= account_equity * VirtualRiskPercent / 100`,
   the downward lot-step rounding and the broker minimum. Test missing stops,
   targets below 3:1, and an account balance too small for minimum volume.
4. Test buy and sell outcomes, a candle crossing both levels, and a gap through
   the stop. Confirm stop-first behavior, cost-adjusted P&L and lower-bound
   excursion values. Keep `EnableAutoTrading=false` while testing the simulator.

The host-side simulator tests exercise sizing, both directions, costs, exits,
gaps, chronology, risk/reward and rejection boundaries. They do not compile
MQL5, verify broker tick-value calculations or validate Strategy Tester data.

## Detection and eligibility

The EA evaluates the latest **closed** bar, not the live price, when a new bar
starts. If it missed bars while running, it processes those bars oldest first,
using only information available at each decision. On attachment it evaluates
the current closed-bar snapshot; it does not reconstruct selections from before
attachment. Reinitialization or revised broker history can change the result.

A pivot high must be strictly higher than all `PivotLeftBars` older and
`PivotRightBars` newer bars; a pivot low must be strictly lower. All newer bars
must already be closed. Equal extremes do not qualify; an outside candle can be
both types. The fractional deviation is
`(high - min(leftHigh,rightHigh)) / min(leftHigh,rightHigh)` for highs and
`(max(leftLow,rightLow) - low) / max(leftLow,rightLow)` for lows. A deviation
below `PivotMinDeviation` is noise, one below `PivotMinDeviation *
MajorDeviationMultiplier` is minor, and a larger one is major. Noise anchors
are excluded unless `UseNoiseAnchors` is true. Individual pivot markers and
rejected lines are not drawn.

Pairs of same-type confirmed pivots in `RecentBarsLookback` are considered.
Both anchor ages, measured from the latest closed bar, must not exceed
`MaxAnchorAgeBars`; their bar spacing must be between `MinAnchorSpacing` and
`MaxAnchorSpacing`, inclusive. Bullish lines join strictly higher lows and
bearish lines strictly lower highs. Lines are interpolated and extended by
elapsed time, as on the chart.

ATR is the **simple average** of `ATRPeriod` closed-bar true ranges, each
including the previous close; it is not Wilder's ATR. The absolute distance
between the projected line and the latest closed-bar close must not exceed
`MaxDistanceFromPriceATR` times this ATR.

From the first anchor through the latest closed bar:

- Each anchor counts as a touch. Any other candle counts once when its low
  (bullish) or high (bearish) is within `TouchToleranceATR * ATR` of the line.
  At least `MinimumTrendlineTouches` are required; the default of 2 includes
  the two anchors and does not require an additional retest.
- A bullish close below the line by more than `BreakToleranceATR * ATR`, or a
  bearish close above it by more than that amount, invalidates the line.
- A touch is a positive reaction if the *next closed candle's* close is at
  least `ReactionThresholdATR * ATR` on the valid side of its projected line.
  The current closed bar has no next closed candle at decision time; its touch
  still contributes to the reaction denominator.

No line is forced when none meets these conditions. A zero or invalid ATR
clears selected lines and records a data issue. Missing history clears
unvalidated lines and waits. Invalid/non-positive price history or an object,
allocation, or logging error stops processing and removes the EA's objects;
see the Experts log.

## Ranking and stability

Eligible candidates receive a score of 100 times the weighted mean of these
components. Each weight is configurable; default weights appear in parentheses.
Components are between 0 and 1:

1. **Distance** (`WeightDistance=40`): `1 - distanceATR /
   MaxDistanceFromPriceATR`; when the maximum is zero, an exact match scores 1.
2. **Recency** (`WeightRecency=25`): `1 - (firstAge + secondAge) /
   (2 * MaxAnchorAgeBars)`.
3. **Swing significance** (`WeightSignificance=10`): the mean of noise 0,
   minor 0.5, and major 1 across the anchors.
4. **Validity** (`WeightValidity=10`): the minimum closed-price buffer above a
   bullish line or below a bearish line in ATR units, plus
   `BreakToleranceATR`, clamped to 0..1.
5. **Reaction** (`WeightReaction=10`): positive reactions divided by touches.
6. **Alignment** (`WeightAlignment=5`): compare the latest close to the close
   `AlignmentLookbackBars` earlier: 1 for matching direction, 0.5 for no
   change, 0 otherwise. This uses the chart timeframe, not a higher timeframe.

Higher scores rank first. Exact ties use smaller distance, newer second anchor,
newer first anchor, higher significance, validity, reaction and alignment, then
anchor timestamps and direction. The weights make multiple factors relevant;
distance is not an absolute precedence rule.

Previously displayed anchor pairs remain selected while eligible and
nonduplicate, even if a newer candidate would score higher. Vacant slots are
filled with the highest-scoring eligible nonduplicates; the displayed set is
then ranked by score. Therefore the selected set is not necessarily the
globally highest-scoring set. Lines in the same direction are duplicates when
their projections differ by at most `DuplicateToleranceATR * ATR` at both the
latest closed bar and the `AlignmentLookbackBars` earlier bar.

At most `MaxTrendlinesToDisplay` lines appear (default 3, allowed 1..10); each
rank has a different color. Labels show rank, direction and first/second anchor
ages in bars. Hover over the line or label for score and component details.
Objects are keyed by anchor timestamps and direction, updated in place, and
removed when obsolete. Selection can change only on a newly processed closed
bar, not on every tick.

## Inputs and logs

`PivotLeftBars` and `PivotRightBars` are 1..1000; `RecentBarsLookback` is
2..2000; `MaxAnchorAgeBars` is 1 through lookback minus 1;
`MinAnchorSpacing` is at least 1 and `MaxAnchorSpacing` is between it and
`MaxAnchorAgeBars`. `MinimumTrendlineTouches` is at least 2, `ATRPeriod` is
1..1000, and `AlignmentLookbackBars` is 1 through lookback minus 1. Deviation
must be positive, the major multiplier at least 1, ATR distances and tolerances
nonnegative, and weights finite and nonnegative with a positive finite sum.
Too little history is a waiting condition, not a signal.

`WriteResearchCsv` defaults to true. `GTLR_Recent_<chart-id>.csv` is written in
the terminal's `MQL5/Files` directory, or the tester agent's `MQL5/Files`
sandbox. It records settings, weights, displayed candidates with score
components, removals and no-selection/data events. `DebugMode` additionally
logs reasons for rejected considered pairs, duplicate lines, and candidates
omitted due to the limit or stable retention; they are not drawn. Debug output
can be large. The decision timestamp is the opening time of the bar after the
closed bar used for the calculation. The Experts log also reports events and
errors.

## Visual test

1. Copy the complete `GonyTrendLineEAVisual.mq5` into `MQL5/Experts`. No
   separate include is needed. Compile it in MetaEditor (F7) and inspect the
   actual compiler output. Set `EnableAutoTrading=false` for trendline-only
   testing.
2. In Strategy Tester select the EA, a symbol and timeframe, a sufficiently
   long date range, and visual mode. Start the test; wait for enough history.
3. Verify that bullish lines join confirmed higher lows, bearish lines join
   confirmed lower highs, and neither anchor appears before its configured
   right-hand confirmation bars have closed. Check ranks, ages and tooltips.
4. Run with the defaults and confirm that no more than three lines appear.
   Observe several ticks within a bar: anchors must not change. On subsequent
   bars, check that still-valid pairs remain and that invalid, too-old, or
   too-distant lines disappear.
5. Enable `DebugMode`, restart, and compare rejected reasons and display
   decisions with the CSV and Experts log. Rejected lines must not be drawn.
   Try stricter spacing, distance, break and touch settings and verify their
   boundaries; a requirement above two touches demands additional retests.
6. Manually annotate examples on the chart and compare the selected lines
   against them. The EA does not learn from the annotations or change settings
   automatically.

Host-side C++ rule tests do not compile MQL5 or validate MT5 rendering or
Strategy Tester behavior. MetaEditor and MT5 are required for those checks.
Older documents in this folder describe earlier implementations.

## Changelog

- **6.01:** Enabled automatic trading by default; real-account permission
  remains disabled by default.
- **6.00:** Added explicitly opt-in H4/H1 automatic trading with broker-side
  SL/TP, account-equity sizing, conservative setup filters and a persistent
  unresolved-request fence. Requires MT5 compilation and demo validation.
- **5.10:** Added an opt-in, single-manual-setup virtual trade simulator with
  account-equity sizing, fixed cost assumptions, conservative OHLC exits and
  a separate CSV journal. Automated bias, signals, key levels and dashboard
  remain future work.
- **5.00:** Replaced the all-candidates display with recent, stable trendline
  selection.
