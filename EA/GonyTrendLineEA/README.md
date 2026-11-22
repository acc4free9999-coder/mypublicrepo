# Recent Trendline Research EA

This self-contained MT5 Expert Advisor is for research and visual simulation
only. It never submits orders. Its rules and weights are configurable hypotheses,
not trading advice or a claim that the selected lines are correct. This version
replaces the previous Phase 4 buttons, pivot layers, and score threshold.

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
   actual compiler output.
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
