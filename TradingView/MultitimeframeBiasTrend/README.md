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

## Elliott waves (adapted from elliott.pine)

The Elliott module replaces the earlier multi-timeframe candidate engine with the
supplied `elliott.pine` approach, on the **chart timeframe only**. Three zigzag
lengths (defaults 4 / 8 / 16, each with its own on/off and color) build swing
sequences from pivots that confirm one bar after the swing. For each zigzag:
- **1-2-3-4-5** motive waves are drawn when wave 3 is not the shortest and the
  swings step in the trend direction; the fifth leg follows the live swing until
  the next swing forms and a wave is dotted when invalidated.
- **(a)(b)(c)** correction is drawn after a motive wave when the geometry stays
  inside the 0.854 retracement limit, with a projection box and a red cross when
  the box is broken.
- A **Fibonacci zone** (0.5 / 0.618 / 0.764 / 0.854, configurable) from the end of
  the latest motive wave; it turns red/dotted once price breaks the last level.
- A circle marks a possible new wave 1 after a completed correction.
- Optional swing high/low sources and zigzag lines. Older wave sets are deleted
  (`Max wave sets kept per zigzag`).
These are candidates, not forecasts or entry signals. The elliott.pine file states
no licence, so use it accordingly. The dashboard no longer shows an Elliott status
line and the Elliott lower-timeframe request payload is gone.

## Supply and demand zones

Enable **Draw supply / demand zones** under **Supply and demand zones (chart
timeframe)**; it is off by default. Zones use chart OHLC and are evaluated only
at chart-candle close.

- **Base:** one to three consecutive candles before the displacement, each with
  a body at most 0.6 ATR (configurable).
- **Demand:** bullish displacement body of at least 1.5 ATR closing above the
  base high. Zone: base low (or lowest body if wicks are off) to highest base body.
- **Supply:** mirrored; bearish displacement closing below the base low. Zone:
  lowest base body to base high (or highest body if wicks are off).
- **Tests:** a later candle trading into a zone increments its `xN` label.
  Tests do not remove zones.
- **Mitigation:** a close beyond the far edge (below demand, above supply)
  deletes the zone. A same-direction overlapping zone is not duplicated.
- **Limits:** the newest 10 active zones are retained (2-40 configurable);
  the oldest is deleted first. The script allows 100 boxes. Zones extend right
  and are not recomputed after creation.
- **Alerts:** "Price tests demand zone" and "Price tests supply zone" fire at
  chart close when an active zone was touched. They are context, not entries.

This is an objective rule-based approximation of supply/demand, not discretionary
institutional order-flow detection. Zones are not guarantees of reaction; the
displacement candle's zone is created only after it closes, so it is not known
earlier. They are drawn only on the chart timeframe, not the other six.

## Trendlines

A port of `draw()` from `trendline.pine` (LuxAlgo Trendline Breakout Navigator),
run per enabled timeframe and per swing length (Long solid, Medium dashed,
Short dotted; defaults 30 / 10 / 5, each can be switched off). A higher high
starts an up-trendline at the previous swing low, a lower low starts a
down-trendline at the previous swing high; later swings re-fit the slope and
move the anchor so no close lies beyond the line; `●` marks wick breaks. Broken
lines stay on the chart, stopped at the break, so several lines accumulate.
Shorter swing lengths give more, smaller lines like hand-drawn ones. Each
timeframe has its own toggle and color; only timeframes equal to or higher than
the chart timeframe are drawn. Lines are not extended right. TradingView keeps
at most 500 lines, oldest dropped first. This is a reference, not an entry signal.

## Fair value gaps and order blocks

Chart-timeframe zones, written from the general FVG / order block concepts (the
supplied `fgv_oderblock.pine` is all-rights-reserved, so its code is not reused).
- **FVG**: bullish when candle 3 low > candle 1 high, bearish when candle 3 high <
  candle 1 low, at least `Minimum gap size` x ATR; created on confirmed bars.
  Mitigation: touch, 50% fill or full fill.
- **Order block**: a confirmed swing (`OB swing length`, confirmed that many bars
  late) broken by a close/wick with an optional displacement candle. The last
  bearish candle before an upward break is a bullish OB; the last bullish candle
  before a downward break is a bearish OB. Mitigated by a wick or close through it.
- Active zones extend right; mitigated zones freeze and fade (or are deleted).
  Each of the four types keeps at most `Max zones per type` (oldest removed).
  Zones are context, not entry signals.

## Liquidity sweeps

Adapted from *Liquidity Sweeps* by LuxAlgo (CC BY-NC-SA 4.0; this adaptation is
shared under the same licence). Confirmed swings (`Sweep swing length`) are
liquidity pools. **Wick sweep**: a wick pierces the level but the candle closes
back (dotted level, shaded area, dot). **Outbreak and retest**: a close through
the level, then a later wick back through it that closes on the original side
(dashed level). Choose either or both with `Sweep type`. Sweep areas extend right
until a close beyond them or `Sweep area max bars`; at most `Max sweep areas kept`
are shown. Sweeps are context, not entry signals.

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

## Volume profile

Adapted from `volume_profile.pine`. Settings group **Volume profile (chart
timeframe)** draws a horizontal volume-by-price histogram over the last N bars
(default 500) with a dotted Point of Control line. Rows use the shared 500-line
budget (default 60, max 200). It is drawn on the last bar only; the optional
rolling POC plot recomputes every bar and is slower. Forex uses tick volume. The
profile describes past activity and shifts as the window moves; it is context,
not a signal.

## Swing highs/lows with candle patterns

Adapted from `swing_h_l_candle.pine` (settings group **Swing H/L + candle
patterns**). Each confirmed swing (default length 21) is labelled HH/LH or HL/LL
with the candle pattern on the swing candle: Hammer / Inverted Hammer at lows,
Hanging Man / Shooting Star at highs, or a Bullish / Bearish Engulfing. Labels
appear `length` bars after the swing (confirmation delay). The source's bearish
engulfing test duplicated the bullish one; it is corrected here. Patterns are
context, not entry signals.

## Sessions

Adapted from `session.pine` (group **Sessions**). Shades the background while the
London, New York, Tokyo (and optionally Sydney) sessions are open, or, with
**High/Low view**, fills the band between each session's running high and low.
Hours and colors are editable and evaluated in the chosen time zone (default
America/New_York, as in the source; hours are the source's defaults, not
daylight-saving adjusted for you). On timeframes of 1D or higher no session
shading appears. Sessions are context only.

## ICT price action tools

Adapted from `ict_price_action.pine` (no licence stated in the file). Two groups:
**ICT market structure** (BOS / MSS on short, intermediate or long-term swings,
drawn on the last bar from stored events so the shared 500-object limit does not
evict them) and **ICT buyside & sellside liquidity** (three or more swings at
nearly the same price). The source's swing dots, order/breaker blocks and
liquidity voids were removed because they duplicate the Swing H/L labels, the
FVG / order block module and the FVG module. Output is structural context, not
an entry signal.

## Shared style and settings

Bullish / bearish colors and zone transparency are set once in **Chart module
style (shared)** and used by supply/demand, FVG, liquidity sweeps, swing labels
and ICT. Per-module color, width and cap inputs that rarely change (trendline and
Elliott colors, volume profile colors, session colors, ICT limits) are now fixed
constants near the top of their blocks. Label and line pool clean-up uses the
shared helpers `f_trimLabels`, `f_clearLabels` and `f_clearLines`.

## Pullback reference checklist

A compact table at **bottom right** summarizes
[the quality trendline pullback rubric](./quality_trendline_pullback_scoring_system.md).
The **Panels** group at the top of Inputs has independent **Show market bias
panel** and **Show pullback checklist panel** switches, both enabled by default.
The checklist adds no plots, alerts or drawing objects. The empty `[ ]` boxes
are reference text, not clickable controls or automatically evaluated results.
Hover a check or its points for the detailed criteria.

The five category caps are 25 + 15 + 15 + 20 + 25 = 100; the descending-triangle
bonus adds five points, capped at 100 overall. The checklist includes the HTF,
breakdown, risk/reward and news disqualification rules, which override the total
to zero, plus the A+/A/B/Invalid score bands. It does not calculate a live score,
inspect manually drawn lines, check news, recommend entries or size positions.
The rubric leaves some slope/spacing intervals unspecified; the reference awards
points only in its stated qualifying bands.

Bottom right is reserved for this checklist. If the existing bias dashboard's
Position is set to Bottom Right, it is placed at Top Right instead to avoid
two tables occupying the same anchor. Other dashboard positions are unchanged.

## RSI momentum divergence: chart and full pane

Adapted from [rsi_divergence.pine](./rsi_divergence.pine). The main indicator
shows bullish/bearish price labels, pivot-to-pivot price lines and horizontal
divergence zones. **RSI momentum divergence** settings control detection, zones
and retention. It reuses **Data and indicators → RSI length**, independently of
the bias engine's RSI filter.

**One indicator now shows both surfaces.** Its own lower pane shows the RSI
curve, midline, 30/70 bands, gradient fills, Bull/Bear pivot labels and connecting
oscillator lines. RSI uses the reference's thin green-to-purple curve, green
bullish and purple bearish fills/labels/lines, independent of the shared chart
colors, with dashed 30/70 guides and a solid 50 midline. All existing price plots, trendlines, Elliott drawings, zones,
session shading and both dashboards use `force_overlay = true` to remain on the
price chart. Session high/low fills follow their chart-overlay boundary plots.
No companion indicator is required; the previously supplied companion was removed.
The existing alert conditions are unchanged.

After updating, **remove the old instance and add the indicator again** so
TradingView applies the new `overlay = false` pane placement. Do not move the
entire script onto the main price chart: that would put the RSI on the price
scale. The divergence switch controls the signals, while the RSI curve remains
visible in the lower pane.

The oscillator is **RSI of `ta.mom(close, 10)`**, not conventional RSI of close.
Regular bullish divergence is price LL / oscillator HL; bearish is price HH /
oscillator LH. Pivots use five left and five right bars. The source spacing rule
is retained: `ta.barssince(pivotFound[1])` between 5 and 50, equivalent to
6–51 bars between pivot centers. Computations run on every bar, but signals and
zone updates are committed only on confirmed chart candles. Labels are placed
five bars back at the pivot **only after confirmation**; they were not available
at the pivot candle. The live oscillator curve can still change until close.

Zones preserve the source's lifecycle: a bullish level extends while the bar
high is above it; a bearish level extends while the bar low is below it.
Otherwise the zone stops, turns dashed and loses its glow. Unlike the source,
stopped lines remain tracked and count toward the per-side retention cap, so
historical objects do not accumulate without bounds. Recent connecting lines
and price labels are capped separately at twice the retention setting. In the
main indicator they share its existing 500-line/500-label budget and may still
be evicted by other modules. Synthetic charts use chart OHLC for this module.
Divergence is context, not an entry signal or guarantee.

## Full ICT dealing range

Adapted from [dealing_range.pine](./dealing_range.pine) into the main indicator;
no second indicator is required. All its boxes and lines use `force_overlay`
to stay on the **price chart**, not the RSI pane.

The **DR | ...** settings groups retain the source controls and defaults:

- **Range:** master switch, 50-bar rolling high/low box, upper/lower lines,
  optional dashed 50% equilibrium, 15-bar right extension and colors.
- **FVG / IFVG:** three-candle gaps at least 0.1 ATR(14), optional range/window
  filter, extensions and separate colors for original and inverted gaps.
- **Order blocks:** confirmed pivots (10 bars left/right by default), liquidity
  sweeps followed by structural closes, and the last opposite candle found in
  the preceding 20 bars.
- **Breaker blocks:** H-L-H / L-H-L patterns, ATR-based duplicate suppression,
  range filtering and an 80-bar maximum age.
- **Style / retention:** zone labels, optional fading of invalidated zones,
  faded opacity and a per-side/category retention cap (eight by default).

The rolling range updates live; pivot, sweep, structure and zone state changes
are committed only at chart candle close. Pivot confirmation is delayed by the
pivot length. Like the reference, structure scanning skips the newest pivot and
tests the first older unshifted pivot; sweep flags remain pending until the
matching structural close consumes them. Filters require the zone's full price
range and origin bar to fit the current dealing range/window when enabled.
Zones expire on an opposite close beyond their boundary, not on a simple touch.

Safety differences from the reference: the OB scan does not run on empty
history, faded zones stay owned by their capped arrays, and only original FVGs
invert (IFVGs do not repeatedly flip back into FVGs). The range drawings are
refreshed on the last bar. This module adds no plots or alert conditions.

The older **Fair value gaps and order blocks** module is unchanged. Disable its
FVG/OB switches if you want only the dealing-range versions; their detection
rules differ. The full DR module can retain up to six capped arrays of zones,
plus its range box and three lines. All modules still share TradingView's
500-box/line/label limits, so objects can be evicted under heavy use. No trading
signals or guaranteed outcomes are implied.

## Sideways phase boxes

**Sideways phase (chart timeframe)** adds a chart-overlay box with a show/hide
switch, method selector, thresholds, confirmation count, fill and retention cap.
It does not change the dashboard's existing market-condition classification.

| Method | Qualification |
| --- | --- |
| ADX | ADX <= 20 by default; uses the existing DI/ADX lengths |
| Bollinger Band Width | 100 × band width / absolute SMA <= 1% (two-standard-deviation bands) |
| ATR-normalized range | Window high minus low <= 4 ATR by default |
| EMA compression | Fast/middle EMA spread and each EMA's one-bar movement <= 0.5 ATR |
| Choppiness Index | 100 × log10(sum(true range) / window range) / log10(window length) >= 61.8 |
| All methods | All five qualify (default, strict) |
| Any method | At least one qualifies (permissive) |

Defaults use a 20-bar measurement window and three consecutive qualifying
closes. All modes wait for valid common data including positive ATR. A box
becomes available **only at the confirming close**, but its left edge covers
the measured window retrospectively; this is not an earlier signal.
High/low boundaries freeze at creation. The right edge advances until a close
outside those boundaries or a failed method test ends the phase. The exiting
candle is excluded, no replacement starts on that candle, and confirmation
must build again. Wicks outside the fixed boundaries alone do not end the phase.
Recent boxes are kept (10 by default), sharing the script's 500-box budget.

Thresholds need adjustment for instrument and timeframe; particularly Bollinger
width is a percentage, not an absolute price distance. Low ADX alone indicates
weak trend, not necessarily consolidation. No method guarantees a breakout or
trade opportunity. No plots, requests or alerts are added.
