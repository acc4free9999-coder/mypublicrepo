# Visual Trendline Research Engine: Phase 4

Research-only MT5 EA; it never places orders. Phase 4 shows pivots, scored
candidates, the selected candidate, and rejected pairs and candidates. The
selection is for visual research, not a trading signal or recommendation.
Rules are hypotheses to inspect, not a claim about the correct trendline.

## Rules

With the default 3 left and 3 right bars, a high must be strictly higher than
all six neighbors; a low must be strictly lower. Equal highs or lows do not
qualify. All right bars must be closed before the pivot appears. An outside
bar can qualify as both a high and a low.

Deviation uses the more distant of the two neighboring window extremes:
`(high - min(leftHigh,rightHigh))/min(leftHigh,rightHigh)` for highs and
`(max(leftLow,rightLow) - low)/max(leftLow,rightLow)` for lows.
`PivotMinDeviation` is a fraction: `0.0001` means 0.01%. Below it is noise;
at or above it is minor; at or above the threshold times the corresponding
high/low multiplier is major. Each pivot's label and tooltip include the
measured deviation and thresholds.

For each newly confirmed eligible pivot, the EA considers up to
`CandidatePreviousAnchors` most recent eligible pivots of the same direction,
within `CandidateMaxSpacingBars`. It records the result for each considered
pair. Both endpoints must be major, minor or noise as enabled by the anchor
inputs. A pair must meet `CandidateMinSpacingBars`; a bullish line joins two
lows with a strictly higher second low, and a bearish line joins two highs with
a strictly lower second high. Horizontal and opposite-slope pairs, and pairs
closer than the minimum spacing, are shown as rejected segments with their
reasons. The bounded window and anchor limit explicitly exclude older pairs;
neither indicates a quality ranking. Every generated candidate is retained,
including candidates with low scores or incomplete context.

The dashed line is extended to the right. Candidate anchor labels are `C<n>
A` and `C<n> B`; its score label shows the score and rank, and the label and
line tooltips show component values, weights, measurements and ranking rule.
Low-scoring candidates use the rejected layer, selected candidates use the
selected layer, and other candidates use their bullish/bearish layer. Rejected
pair labels use `R` IDs; scored candidates use `C` IDs. Rejected pair lines
are segments; scored candidate lines extend right.

On a normal MT5 chart, the upper-left buttons toggle major, minor, noise,
bullish, bearish, selected, rejected, anchors, pivot labels, scores and state.
The bullish/bearish buttons control alternatives and pending candidates;
selected and rejected have independent buttons. The anchor toggle applies to
visible scored candidates and rejected pairs. Rejection reasons are printed
on rejected pair labels and scored candidate labels/tooltips. The input
`Show...` settings set the initial visibility; changing inputs reinitializes
the EA. Button choices last for the current attachment.

MT5's Strategy Tester does not deliver `OnChartEvent` events, even in visual
mode, so interactive buttons are not shown there. Set the `Show...` inputs
before starting a visual test instead. A crowded chart is possible; hide layers
or reduce the initial history or previous-anchor limit.

On attachment, at most `InitialHistoryBars` candidate pivot bars are scanned,
then newly closed bars are processed in chronological order. Pivots retain
their recorded time, price and classification during that run; a broker history
revision or a reinitialization can change a rebuilt view. Existing historical
markers are plotted at their pivot times but are not available until the final
right bar closes. Scores are frozen at creation using only bars closed at that
decision; a line's rank can change when more candidates are created.
Candidates created at different times therefore reflect different snapshots.
Full replay tooling remains a later phase.

## Selection and rejection

The highest-ranked complete candidate is selected only when its frozen score
is at least `SelectionMinScore`, default **90**. Exact-score ties go to the
earlier candidate ID. If no complete candidate meets the threshold, the state
panel says `selected none`. Incomplete-context candidates remain visible as
pending; they are not silently rejected or selected. Other complete candidates
at or above the threshold are alternatives; those below it are rejected with
their score and threshold shown. Selection changes and candidate evaluations
are logged to CSV.

**Important:** scores are frozen at confirmation. Selection does not expire
old candidates or check for later line breaks. A selected line can therefore
be stale or invalid under current market conditions; inspect it visually. The
threshold is configurable and is not a validated measure of quality.

## Scoring and ranking

Each component is between 0 and 1. Its configurable `Weight...` input defaults
to 1; zero disables that component. Total score is 100 times the weighted mean.
At least one weight must be positive. These defaults are arbitrary research
choices, not validated measures of trendline quality.

| Component | Explicit rule |
|---|---|
| Swing importance | Mean anchor importance: noise 0, minor 0.5, major 1. |
| Trend direction | Compare first anchor candle close to last closed confirmation candle close: aligned 1, equal 0.5, opposite 0. |
| Anchor spacing | `min(1, spacingBars / ScoreTargetSpacingBars)`. |
| Line slope | `min(1, absolutePriceChange / _Point / spacingBars / ScoreTargetSlopePointsPerBar)`. |
| Price interactions | `min(1, touches / ScoreTargetTouches)`. |
| Structural integrity | `1 - min(1, breaks / ScoreBreaksForZero)`. |
| Timeframe context | On the **chart timeframe**, compare the last closed confirmation candle close to the close `ScoreContextBars` bars earlier: aligned 1, equal 0.5, opposite 0. This is not a higher-timeframe analysis. |

Touches and breaks use wicks between the first anchor and the last closed
confirmation bar, excluding both anchor bars. The line is interpolated or
extrapolated by elapsed time, matching the time-anchored chart line. A bullish
touch is a low within `ScoreTouchTolerancePoints * _Point` of the line; a
bearish touch uses the high. A bullish break is a low strictly below the line
by more than `ScoreBreakTolerancePoints * _Point`; a bearish break uses the
high above the line. A candle may count as both a touch and a break when the
configured tolerances overlap.

If the context lookback is unavailable, the context weight is excluded from
the mean. The numeric result is marked `*`/provisional and **unranked**, because
its denominator differs. If context is the only enabled weight, the score is
`N/A`. If the context weight is zero, missing context does not affect ranking.
These snapshots are not automatically rescored when more history arrives.
Complete scores are ranked descending, with earlier candidate IDs breaking
exact ties. The EA does not filter candidates by score or break count.

CSV logging defaults on. The file `GTLR_Phase4_<chart-id>.csv` is in the
terminal's `MQL5/Files` directory, or the tester agent's `MQL5/Files` sandbox.
Rows include configuration, pivot classifications, every considered pair, and
ranking and selection changes and evaluations, with decision time, anchors,
outcome and score breakdown.
The decision time is the open of the bar
following the final confirmation bar, not the pivot timestamp. The Experts
log also reports decisions and failures. Non-positive price histories are
unsupported and explicitly stop processing.

## Visual test in MT5

1. Copy the complete `GonyTrendLineEAVisual.mq5` into `MQL5/Experts`.
   It contains its own rules and does not need `TrendlineRules.mqh`. If using
   a differently named EA file, replace the entire contents of that copy.
   Compile in MetaEditor (F7) and inspect the compiler output.
2. Select the EA in Strategy Tester, choose a symbol and timeframe such as
   EURUSD H1, select a date range and enable **visual mode**. Start the test.
3. Check that the first 3 right-hand candles have closed before a pivot appears,
   that old markers do not move, and that same-bar highs and lows can both appear.
   The initial pre-test history is intentionally drawn on startup.
4. Inspect several dashed lines: blue bullish lines must join higher lows;
   orange bearish lines must join lower highs. Each pair's `C` anchor labels
   should identify its endpoints. No line need appear in unclear structure.
5. Inspect a score label and its tooltip, and check its seven components against
   the rules above. Compare labels and `ranking` rows in the CSV; candidates
   with equal scores should rank in ID order.
6. Set all weights except `WeightSpacing` to zero, restart, and verify a line
   spaced 10 bars with a 20-bar target scores 50. Change the spacing target and
   repeat. Test missing context with a lookback larger than available history:
   affected candidates should be provisional and unranked, not disappear.
7. With `SelectionMinScore=90`, verify the highest complete score at or above
   90 is gold and the state shows its ID. If none meets it, verify `selected
   none`. Lower or raise the threshold and restart to inspect alternatives,
   score rejections and the CSV evaluation/selection reasons.
8. In visual testing, restart with individual `Show...` inputs disabled and
   verify their layers disappear. On a normal chart, test each on-chart button
   without restarting. Turning a layer back on must restore its objects without
   changing ranks or selection. Examine rejected pair labels and tooltips.

Compile and visual testing require an MT5 installation; host-side rule tests do
not verify MT5 chart rendering or runtime behavior.

**Older documentation in this folder describes a previous, unverified Phase 1
implementation and should not be used as a reference for this version.**
