# Multi-timeframe bias, structure and strength

Paste the complete [indicator](./MultitimeframeBiasTrend.pine) into TradingView's
Pine Editor, save, and select **Add to chart**. Pine Script v6 is required. The
default dashboard is fixed at the top right; scrolling and zooming do not move it.
Use standard time-based candlestick charts for the clearest interpretation.

This is directional analysis, not a trading strategy, entry generator, forecast,
or guarantee. Seven agreeing timeframes do not establish a profitable trade.
Spreads, news, sessions, execution costs and risk management remain outside scope.

## Calculation

Each enabled timeframe calculates its own indicators on its own OHLC history:

- **EMA alignment E:** +1 if fast > middle > slow; -1 for the inverse; otherwise 0.
- **Slope S:** +1 if all three EMAs rise by more than the configured minimum;
  -1 if all fall; otherwise 0. Each slope is
  `(EMA - EMA[lookback]) / (ATR * lookback)`, in ATR units per source bar.
- **Structure P:** the latest two confirmed highs and latest two confirmed lows.
  HH + HL gives +1; LH + LL gives -1; equal or conflicting swings give 0.
  A close below the current HL invalidates bullish structure; a close above the
  current LH invalidates bearish structure. No alternating-pivot assumption is
  imposed; this is a transparent two-high/two-low model, not a Zig Zag.
- **RSI R:** +1 above `50 + band`, -1 below `50 - band`, otherwise 0.
  The default neutral band is 48-52. Disable RSI to remove both its scoring weight
  and its direction gate; the numeric RSI can still be displayed.

With defaults:

```text
score = 100 * (2*E + S + 2*P + R) / 6
```

The general denominator is the sum of active component weights. RSI's weight is
excluded when its filter is disabled. A score is clamped to [-100, +100].
Component weights may be zero, but at least one active weight must be positive.
Score precision is not rounded before classification; displayed scores have one
decimal place.

The directional threshold defaults to 20 and the strong threshold to 60.
Positive/negative directional scores classify bullish/bearish. Scores strictly
between the directional thresholds are neutral. **RSI confirmation, when enabled,
is also a hard direction gate**: positive scores need bullish RSI, negative scores
need bearish RSI. The optional price filter similarly requires price above/below
the slow EMA. A veto leaves the raw displayed score unchanged but the bias neutral.

Strong bias additionally requires ADX >= threshold, matching EMA alignment, all
three EMA slopes, and matching confirmed directional structure. A high score with
weak ADX or conflicting structure is capped at ordinary bullish/bearish, never
promoted based on EMA alignment alone. Strong structure confirmation is required
even if structure's *scoring weight* is zero.

ADX comes from `ta.dmi(DI length, ADX smoothing)`. ADX never supplies direction.
Default threshold: 25. A timeframe is:

- **Trending:** ADX at/above threshold with nonzero, matching EMA and structure.
- **Ranging:** ADX below threshold and structure neutral.
- **Mixed:** neither.

ATR is Wilder ATR, used for slope normalization and the optional volatility
column. EMA distance is `(source close - EMA) / EMA * 100`, not pips.

## Readiness and missing data

A row needs at least `slow EMA length + slope lookback` source bars, numeric EMA
slopes/ATR and ADX, numeric RSI if enabled, and two confirmed highs plus two
confirmed lows if structure has positive scoring weight. This explicit warmup
avoids treating Pine's early EMA seed as a mature long-term trend. With defaults,
monthly readiness requires at least 203 monthly bars **plus any extra history
needed to find the pivots**. Broker history can be insufficient, especially for
young symbols or short intrabar datasets.

Unavailable rows show **N/A**, not neutral, and do not contribute to aggregates,
counts or alignment. Available component values may still be displayed while a
row builds history. Enabled but unavailable rows produce **PARTIAL DATA** and
`ready/enabled` coverage. Partial summary scores are descriptive only: aggregate
alerts and directional BUY/SELL/PULLBACK context require all enabled rows ready.
Disabled timeframes are hidden and excluded entirely.

## Aggregates and context

Default timeframe weights, in order M/W/D/4H/1H/15M/5M:
**5, 4, 3, 2, 1.5, 1, 0.5**. Higher timeframes have more total weight by default.
Weights are independently configurable and positive; disable a timeframe with
its checkbox rather than a zero weight. Overrides can intentionally change that
hierarchy.

For each group (and overall):

```text
effective row score = raw score if classified directional, otherwise 0
aggregate score = sum(timeframe weight * effective row score)
                  / sum(ready, enabled timeframe weights)
```

Neutral rows retain their denominator weight; missing rows do not. Aggregate
direction uses the same score thresholds. A strong aggregate also requires at
least the configured consensus percentage (default 60%) of valid weight in
**strong** rows pointing that way. Thus weak ADX cannot indirectly produce a
strong summary through high raw scores.

- **Higher:** M/W/D. **Medium:** 4H/1H. **Lower:** 15M/5M.
- **Bull/Bear/Neutral counts:** unweighted counts of ready, enabled rows, including
  strong states in their corresponding direction.
- **Directional alignment:** `100 * max(bullish weight, bearish weight) / valid
  weight`. Neutral rows do not count as agreement. All-neutral means 0%, not 100%.
- **Market condition:** Trending/Ranging if the corresponding weighted share
  meets consensus (default 60%); Mixed otherwise. No ready rows means N/A.
  A market can have strong trends in opposite directions, so "Trending" does not
  imply directional agreement.
- **HTF alignment:** at least two enabled HTFs, all enabled HTFs ready, and every
  one bullish or every one bearish. An isolated enabled monthly row is not
  described as multi-timeframe alignment.
- **PULLBACK WATCH:** aligned HTFs and opposite directional lower-group bias;
  takes precedence over BUY/SELL.
- **BUY/SELL BIAS:** HTF alignment, matching overall direction, and no opposing
  medium/lower group direction.
- **RANGE:** weighted ranging consensus.
- **WAIT / MIXED:** insufficient coverage or conflicting/nonaligned conditions.

The optional LTF conflict warning follows HTF alignment versus the weighted lower
group; a single dissenting 5M row need not outweigh a bullish 15M row. These are
contexts to investigate, **not entries or instructions to execute trades**.

## Dashboard columns

| Column | Meaning |
| --- | --- |
| TF | Source timeframe. `*` means below chart timeframe; `<` and accent text mark the current chart timeframe. Hover for source candle close in UTC and readiness notes. |
| Bias | Gated classification with strong-state ADX/slope/structure requirements. |
| EMA / slope | Bull/Bear/Mixed EMA ordering; `+`, `-`, or `flat` is the all-three slope assessment. Flat includes conflicting slopes. |
| Structure | HH/HL, LH/LL, conflicting pairs or EH/EL (equal high/low). `mixed` means no valid directional structure. Building means insufficient pivots. |
| ADX | Source timeframe's numeric ADX. Compare with the configured threshold. |
| RSI | Source RSI, also displayed when disabled; `(off)` means it neither scores nor gates. |
| Score | Raw normalized component score, before classification gates. |
| Price / EMA | Source close above/below/at the configurable slow EMA (200 by default). |
| Distance % | `F`: distance to fast EMA (20 default); `M`: distance to middle EMA (50 default). |
| ATR % | `100 * ATR / source close`, useful for scale-independent volatility context. |

Each optional column can be hidden. TF remains visible for identification. Colors,
text size, background transparency, position, timeframes and dashboard visibility
are configurable. Darker green/red identifies strong states; neutral is gray.

## Confirmation, repainting and timeframe limitations

**Confirmed mode is enabled by default.**

1. For source timeframes at or above the chart timeframe, every returned field is
   shifted by one **source** bar. The request uses `barmerge.lookahead_on` only
   with that shift. It delivers the previous closed source candle from the start
   of the next source interval, with no future-data leak. On an equal-timeframe
   chart it still uses the previous candle, including at the current chart close.
2. Higher/equal timeframes and live mode use `request.security()`. For lower-than-chart
   timeframes, confirmed mode uses `request.security_lower_tf()` instead and
   selects the latest available closed intrabar. If a new chart candle has no
   closed intrabar yet, it retains the last genuinely closed source snapshot;
   without any known closed snapshot it shows N/A, not a security-filled value.
   The source-close tooltip identifies the retained candle. No one-bar LTF offset
   is necessary.
   Array data and its availability depend on TradingView's intrabar history
   limits, subscription, feed and sessions. Old chart bars can have no intrabars.
3. Lower rows can update as source candles close *inside* a larger chart candle.
   Their intrabar evolution cannot be reconstructed from one chart-close state.
   Feed revisions and intrabar availability can change sampled history. This is
   not a claim of perfectly invariant lower-timeframe history.
4. In **live mode**, all rows use unshifted `request.security()` with
   `lookahead_off`. Developing source candles can change before closing and
   differ after reload; a single sampled lower-timeframe candle is not a complete
   intrabar history. Closing the chart candle does **not** confirm an open HTF.
5. Pivots require `right bars` following candles to close before confirmation.
   With right=3, the swing is known three source bars after its location.
   Confirmed HTF sampling makes it available at the next interval. Chart labels
   are deliberately drawn on the **confirmation bar**, never retrospectively on
   the pivot candle as though the signal were known earlier.
6. Standard exchange/feed OHLC is used for dashboard requests, even on Heikin
   Ashi or other synthetic charts. Optional overlays and chart-structure alerts
   use the actual chart's OHLC; a warning identifies synthetic charts. Time-based
   standard charts are recommended. Tick charts are not converted to seconds or
   falsely highlighted as matching a time-based row; all seven requests use the
   at/above-chart sampling path. On non-time-based charts, elapsed candle timing
   and alert behavior have additional platform limitations.

Each enabled row executes one data request: security for higher/equal timeframes
or live mode, lower-TF for confirmed intrabars. No discarded duplicate security
request is made. Counting both possible branches for seven bias rows gives
14 unique contexts. Elliott adds at most another 14 possible contexts, keeping
the combined total at or below 28, below the standard 40-request limit.
Security requests return scalar-field UDTs; bias lower-TF requests return 11
primitive arrays, not arrays of 25-field objects. Direction fields are packed
losslessly into one integer. Elliott lower-TF requests use five primitive arrays.
The conservative tuple budget is `7 * (11 + 5) = 112`, below the combined
127-element limit. Only the selected intrabar is reconstructed as a dashboard
snapshot; all closed Elliott pivot events are processed chronologically.
Calculations run throughout history; persistent tables update only on the last
chart bar. No external data, dependencies or imported libraries are needed.

### Bar Replay and memory budgets

The original implementation copied arrays of large snapshots for every intrabar,
made a second unused security request for confirmed lower rows, and forced a
3,000-bar history buffer onto every series. These are removed to reduce replay
memory consumption. Pine now sizes series buffers automatically.

Both request paths have explicit `calc_bars_count` budgets under **Data and
indicators**: **Security history budget** defaults to 3,000 source bars and
**Lower-timeframe history budget** defaults to 10,000 source bars. These are
source-history limits across the dataset, not chart bars or a per-candle limit.
This bounds request work but does not guarantee a specific number of megabytes:
TradingView does not expose an indicator memory meter or a configurable memory
limit.

The tradeoff is limited old-history coverage. Earlier replay rows may show N/A
or PARTIAL DATA, and aggregate alerts remain disabled until all enabled rows
are ready. Each request explicitly counts the source bars actually evaluated
for EMA warmup; an absolute source bar index cannot bypass that check.
Changing budgets can change EMA initialization and which older pivots are known.
The score formula, pivot rules, and confirmed/live sampling rules are unchanged.
Intrabar selection is bounded by the chart candle's close as well as wall-clock
time; it does not use wall-clock time alone as a replay cutoff.

After installing this update, restart replay with a fresh indicator instance.
If memory remains constrained, try a lower intrabar budget (for example 5,000)
and/or a 5M chart, where all seven rows use security rather than intrabar arrays.
The Elliott module has its own **Wave source history budget** (5,000 by default),
which can also be lowered when memory is constrained. Increase a budget only
when the older coverage is needed. Check monthly warmup
and source-close tooltips after moving the replay start point.

## Optional chart modules

Swing levels, slow EMA, confirmation labels and BOS/CHoCH labels are off by
default. Labels are bounded by a configurable retained-label limit.

A **BOS** is the first closing break of an unbroken confirmed swing in the same
direction as the previous break, or the first break without prior direction.
**CHoCH** is a break opposite the previous break direction. Wicks do not qualify.
Levels known before the breaking candle are tested; each new confirmed swing
re-arms its own level. This is a mechanical break-direction model, not a claim to
identify discretionary institutional structure. The structure alert does not
depend on chart labels being visible.

## Integrated Elliott Wave candidates

**Draw Elliott candidates** is enabled by default under **Elliott candidates
(all enabled timeframes)**. Monthly, weekly, daily, 4H, 1H, 15M and 5M have
independent pivot histories and can all draw simultaneously. Use the separate
**1M / 1W / 1D / 4H / 1H / 15M / 5M** switches in the Elliott group to show or
hide each timeframe's waves. These switches are independent of **Timeframes and
aggregate weights**: hiding a wave does not remove its dashboard row or change
bias scores, and a hidden dashboard timeframe can still draw Elliott waves.
Disabled Elliott timeframes skip wave requests, processing and drawing. All seven
wave switches default to on. Turning all off is allowed and displays
**All Elliott timeframes disabled**. Settings changes restart Pine execution,
clearing drawings from disabled timeframes. Disable the global Elliott toggle
to hide all wave drawings and restore a dashboard-only view.

This module is independent of MTF scores and their RSI/ADX filters. It uses
standard source OHLC, including when the chart is synthetic. Each enabled
timeframe adds one request path, without adding new alert conditions.

- At/above-chart sources use previous-candle pivot events with
  `lookahead_on` and a one-source-bar offset.
- Below-chart sources use bounded `request.security_lower_tf()` arrays of price,
  type, pivot timestamp, ATR reversal threshold and confirmation timestamp.
  **Every closed event** is consumed in order, not just the final pivot inside
  the chart candle. Source confirmation timestamps deduplicate repeated values.
- Elliott state is committed only at chart close; drawings update on the last
  chart bar. On a 1D chart the latest 5M patterns therefore reflect the latest
  processed daily close, not a live sequence during the open daily candle.
- This mode is always confirmed, even if dashboard live mode is selected.
- An independent **Wave source history budget** limits each source to 5,000
  bars by default (500-20,000 configurable). Below-chart history can be sparse
  or unavailable on large chart intervals. **N/A** means no closed source data
  has been processed; **Building pivots** means fewer than four accepted pivots.
  No complete historical wave count is claimed outside the available budget.
  A previously known closed state is retained when a new chart bar has no
  closed intrabars yet.

The alternating-pivot construction follows the same approach as the sibling
[standalone detector](../DrawElliottWave/DrawElliottWave.pine): skip simultaneous
high/low pivots with unknown ordering, replace a same-type endpoint only with a
more extreme confirmed pivot, and filter reversals by ATR. This integrated
implementation adds the geometric families below, without the standalone
indicator's separate table or projections.

### Supported families and exact checks

All checks are mirrored automatically for rising and falling patterns.

| Family | Implemented candidate checks |
| --- | --- |
| Impulse 1-5 | Wave 2 stays inside Wave 1, Wave 3 exceeds Wave 1, Wave 4 stays outside Wave 1 territory and beyond Wave 2, and Wave 3 is not shorter than both 1 and 5. |
| Extended impulse | Valid impulse where leg 1, 3 or 5 exceeds 1.618 times both other motive legs. This is a length heuristic, not proof of internal extension subdivisions. |
| Truncated fifth | Otherwise valid impulse whose Wave 5 fails to exceed Wave 3 but progresses beyond Wave 4. Equality at Wave 3 is included. |
| Contracting diagonal | Wave 4 overlaps Wave 1, Wave 2 stays above/below origin, Wave 3 and 5 progress; motive legs 1 > 3 > 5 and corrective legs 2 > 4 in absolute length. |
| Expanding diagonal | Same overlap/progression checks, with 1 < 3 < 5 and 2 < 4. |
| Zigzag ABC | B retraces less than 90% of A without passing the origin; C exceeds A's endpoint. |
| Regular flat ABC | B retraces 90-110% of A; C finishes within the equality tolerance of A's endpoint. |
| Expanded flat ABC | B exceeds A's origin and C exceeds A's endpoint by more than the tolerance. |
| Running flat ABC | B exceeds A's origin; C reverses B but fails to reach A's endpoint by more than the tolerance. |
| Contracting triangle ABCDE | A/C/E endpoints retreat, B/D endpoints advance inward, and B stays inside the origin/A interval. |
| Barrier triangle ABCDE | One boundary is equal within tolerance and the other moves inward; both orientations are supported. |
| Expanding triangle ABCDE | A/C/E endpoints advance outward and B/D endpoints move outward in the opposite direction. |
| WXY | Nine legs: W, X and Y must each independently pass the three-leg ABC classifier. Endpoints are shared; alternating component directions follow from alternating pivots. |
| WXYXZ | Fifteen legs: W, first X, Y, second X and Z each pass the ABC classifier. Preferred over WXY when both match. |

These are **geometric candidates**, not an exhaustive Elliott grammar. Internal
5-3-5, 3-3-5, 3-3-3-3-3 subdivisions are NOT recursively verified. The module
cannot distinguish leading from ending diagonal without larger-degree context,
confirm triangle placement in Wave 4/B/X, or recognize every combination of
flats, triangles, double/triple zigzags and nested degrees. Combination support
here specifically covers ABC components, not arbitrary corrective components.
An ABC candidate can appear without a preceding recognized impulse and is not
claimed to be a confirmed correction of one. Multiple family interpretations
can be displayed simultaneously rather than hiding ambiguity.

### Display, timing and resource limits

- **Wave pivot left/right:** separate from dashboard structure pivots; defaults
  5/5. Each pivot is processed only when its confirmation candle closes.
- **Minimum reversal:** default 0.5 ATR, using each source's ATR at confirmation. A
  zero setting still requires a strictly positive alternating price movement.
- **Equality / barrier tolerance:** default 0.03 of the first leg, not 3% of
  instrument price. Used for flat endpoints and triangle barriers.
- Independent toggles control impulse, diagonal, ABC, triangle and combination
  families. **Color waves by timeframe** is enabled by default: 1M purple,
  1W blue, 1D teal, 4H green, 1H gold, 15M orange and 5M red. Each timeframe
  color is independently configurable and applies to every family's segments,
  pivot-label backgrounds and confirmation-label backgrounds. Pivot labels
  retain their existing 25% transparency and configured text color. Disable
  this option to restore the configurable motive/corrective color scheme.
- Segments join source pivot timestamps. Labels `0-5`, `A-C`, `A-E`, or
  `W.A/W.B/W.C ... Z.C` identify the tested endpoints/components. Every label
  includes its timeframe, such as `4H 3` or `15M B`.
- Pivot labels are **back-positioned annotations**: they did not exist at those
  earlier candles. Hover for the source confirmation time in UTC. A separate
  label at the source confirmation close says "Source confirmed here; not an
  entry". The pattern only becomes visible after the source offset and the
  chart-close processing delay; the source confirmation is not an entry time.
- The dashboard context row reports candidates or data status for every enabled
  timeframe.
  It does not change BUY/SELL/PULLBACK context or the eight existing alerts.
- Counts are rendered from each timeframe's accepted confirmed pivot sequence.
  A more extreme same-type endpoint can replace the last pivot and
  change/remove a count. These drawings are mutable interpretations, not
  permanently locked historical signals.
- Only candidates ending at each timeframe's latest accepted pivot are drawn,
  at most one per family per timeframe. A sequence without a match clears that
  timeframe's old drawings, not other timeframes' drawings. This is not
  a full historical Elliott-pattern scanner.
- Storage is capped at **32 pivots, 33 segments and 43 labels per timeframe**:
  at most **224 pivots, 231 lines and 301 Elliott labels** across seven frames.
  Together with the chart-label maximum of 150, at most 451 labels are owned,
  within the 500-label limit; lines stay below the 250-line limit. Old drawings
  are explicitly deleted before redraw. There are no intrabar wave object arrays.

An apparent match may already be invalidated by price action after its final
pivot; the module reports geometry, not ongoing validity or a projected next
wave. Always inspect the confirmation delay, market structure and higher
timeframes. Elliott interpretation remains subjective and is not an entry signal.

Local checks for the Elliott module:
`node --test tests/model.test.mjs tests/elliott.test.mjs`.
These fixtures validate arithmetic/oracles and source resource invariants, not
execution in TradingView. Compile in Pine Editor and inspect Bar Replay with
each family enabled; pay particular attention to same-type endpoint replacement.

## Alerts

After adding the indicator, choose **Create alert**, select this indicator and
one named condition, and choose **Once Per Bar Close**:

- Overall turns bullish / bearish.
- HTF bullish / bearish alignment.
- LTF pullback against HTF.
- Ranging to trending.
- Chart bullish / bearish structure break (BOS or CHoCH).

The corresponding settings checkbox must be enabled. Make one alert per desired
condition. TradingView snapshots the script and settings when an alert is created;
recreate alerts after editing code or changing settings.

All alerts are explicitly chart-close gated. Repeated unchanged conditions do
not trigger repeatedly. Overall reversals compare with the previous *nonneutral*
direction, allowing intervening neutral bars; initial direction does not count
as a reversal. New HTF alignment and pullback alert once on entry/re-entry.
Ranging-to-trending remembers the previous nonmixed regime, so an intervening
Mixed phase is permitted. Missing enabled data resets aggregate alert memory;
chart structure alerts remain independently available.

On a 1D chart, aggregate alerts can only observe daily-close snapshots. A 5M
pullback that begins and ends inside that day may never alert. Use a 5M or smaller
chart for better monitoring of all seven timeframes. Monthly/weekly confirmations
are necessarily slow. In live mode even chart-close alerts can repaint due to
still-open higher-timeframe candles; confirmed mode is recommended.

## Troubleshooting and validation

- **Version or unknown-function errors:** use the complete file beginning with
  `//@version=6`. Do not paste Markdown fences or prose. ADX uses
  `ta.dmi(diLen, adxLen)`, not an unsupported standalone `ta.adx()` call.
- **Invalid timeframe:** Pine uses `"240"` and `"60"` for hours, `"15"`/`"5"` for
  minutes, and `"1M"` for monthly. Do not replace these with `"4H"`/`"1H"` or
  confuse monthly M with a minute timeframe.
- **Tuple limit:** retain the `Snapshot` UDT. Replacing it with many tuples can
  exceed Pine's combined request tuple limit. Keep the lower-TF payload at its
  existing 11 primitive fields plus the five-field Elliott payload
  (`7 * (11 + 5) = 112` across seven rows).
- **Memory limits exceeded in Bar Replay:** replace the old script with the
  current version, remove/re-add it, and restart replay. Reduce the lower-timeframe
  history budget to 5,000 and/or the wave source history budget to 2,000 if
  necessary. A 5M chart avoids intrabar-array requests in both modules.
  This is a request-memory issue, not a reason to disable confirmed mode.
- **Table out of bounds:** retain the dynamic column and row calculations.
  There are 10 possible columns and `13 + enabled timeframe count` rows.
- **Input runtime errors:** keep fast < middle < slow, strong threshold >
  directional threshold, one active positive scoring weight, and at least one
  enabled timeframe.
- **N/A / partial data:** load more source history, use a symbol with a longer
  history, or disable unavailable timeframes. A shorter slow EMA or smaller pivot
  length changes the model; it is not merely a cosmetic fix. On large chart
  timeframes, lower arrays can be empty because of intrabar limits.
- **No strong states despite high scores:** check ADX, EMA slopes, confirmed
  structure, RSI gate and price gate. Raw score alone is intentionally insufficient.
- **No current-row highlight:** only an exact timeframe-duration match is
  highlighted. A 30M chart has no matching row among these seven.
- **No labels or alerts:** chart modules are opt-in; aggregate alerts also need
  full enabled coverage. Alerts execute on chart close, not every source close.

Local validation: `node --test tests/model.test.mjs` exercises a JavaScript oracle
of the documented arithmetic and source invariants. These are not executions of
Pine. TradingView's proprietary Pine compiler/runtime is not available locally;
**final compilation and feed-specific visual/replay/alert checks must be done in
Pine Editor**. Test 1M, 1D, 4H and 5M charts, partial history, disabled RSI and
columns, and confirmed versus live mode before relying on the dashboard.

Official references:
[data requests](https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/),
[repainting](https://www.tradingview.com/pine-script-docs/concepts/repainting/),
[objects](https://www.tradingview.com/pine-script-docs/language/objects/).
