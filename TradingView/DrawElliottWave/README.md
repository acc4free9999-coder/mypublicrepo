# Elliott Wave Structure Detector

`DrawElliottWave.pine` is a standalone TradingView Pine Script v6 overlay indicator. It uses confirmed, alternating swing pivots to identify rule-checked five-wave impulses, diagonal candidates, and post-impulse zigzag, flat, and contracting-triangle corrections. Independent counts can be drawn together from configurable 5m, 15m, 1h, 4h, 1D, and 1W source timeframes (enabled by default). It covers these major patterns; it does not enumerate every degree, alternate count, or Elliott combination. A label is a technical structure candidate, not a buy/sell instruction or a claim about likely returns.

## Detection method

1. `ta.pivothigh()` and `ta.pivotlow()` identify pivots after the selected right-side confirmation bars have elapsed. Simultaneous high/low pivots are skipped as ambiguous.
2. An ATR-, percentage-, or price-unit minimum movement filter suppresses small reversals. More-extreme pivots of the same type replace the latest pivot instead of adding more swing points.
3. Six alternating pivots are checked as Wave 0 through Wave 5. A valid impulse must preserve the Wave 1 origin through Wave 2, advance Wave 3 beyond Wave 1, avoid Wave 1 territory with Wave 4, advance Wave 5 beyond Wave 3, and have Wave 3 no shorter than both Waves 1 and 5. A violation of any of these coded core rules prevents a valid impulse label.
4. A three-pivot correction after a valid impulse is classified as a zigzag when B retraces 38.2% to less than 90% of A and C extends beyond A, or as a flat when B retraces to within 10% of the impulse endpoint and C extends beyond A.
5. Five alternating post-impulse pivots are labelled as a contracting triangle candidate when the A/C/E boundary contracts in one direction and the B/D boundary contracts in the other. Expanding/running triangles and triangles without that pivot geometry are not inferred.
6. A five-leg diagonal candidate is identified separately when it advances in the impulse direction and Wave 4 overlaps Wave 1. Since pivot data cannot confirm the required internal subdivisions, it is deliberately labelled a candidate rather than a validated diagonal.
7. Candidate milestone alerts use confirmed swing pivots. The full Wave 5 alert requires the complete valid impulse. No alert is generated from the provisional live-swing marker.

The pattern label and top-right status table identify the latest detected structure as a **Motive Phase** (strict impulse or diagonal candidate) or a **Corrective Phase** (zigzag, flat, or contracting triangle after the preceding impulse). Corrective structures are labelled opposite their preceding impulse.

## Score (not a probability)

The displayed 0–100 score is a transparent heuristic, not a statistical win probability:

- **40 points:** fixed base for a structure that passed all coded impulse rules. Invalid structures receive no impulse score or label.
- **Up to 25 points:** Fibonacci confluence: Wave 2/Wave 1 contributes up to 7, Wave 3/Wave 1 up to 7, Wave 4/Wave 3 up to 5, and Wave 5/Wave 1 up to 6.
- **15 points:** higher-timeframe trend alignment, when that filter is enabled.
- **10 or 5 points:** swing clarity, based on whether all five impulse legs exceed 1.5 times the selected minimum swing size.
- **10 points:** RSI alignment, when the momentum filter is enabled.

Fibonacci levels improve this score only; no Fibonacci ratio independently validates a wave count. The ratio ranges and points are implemented in `f_fibScore()`.
The score applies only to strict impulse candidates; diagonal, flat, and triangle labels use their stated geometry checks and are not assigned this impulse score.

## Important settings

### Swing detection

- **Pivot left bars / Pivot right bars:** number of bars used on each side of a pivot. A pivot is not known until the right-side bars have elapsed.
- **Wave timeframes:** independently enable/disable 5m, 15m, 1h, 4h, 1D, and 1W. All six are enabled by default. Each source keeps its own confirmed pivot sequence and pattern state; counts from different timeframes are never interleaved. Every completed structure label identifies its source timeframe, and drawings use source-bar timestamps on the current chart. Sources equal to or above the chart use confirmed timeframe requests; enabled sources below the chart use `request.security_lower_tf()` intrabar arrays.
- **Include chart timeframe:** optionally adds an independent chart-timeframe count unless it duplicates an enabled source. Chart-timeframe pivots retain the normal right-bar confirmation delay.
- **Minimum swing filter:** choose ATR, Percent, or Absolute.
- **Minimum swing size:** ATR multiplier, percentage of the previous pivot price, or raw price units, respectively.
- **ATR length:** ATR period for the ATR swing filter.
- **Wave labels:** confirmed pivots only, or confirmed pivots plus a live provisional high/low marker. The provisional marker can move and is not used for alerts.

### Visibility and style

- **Bullish / bearish structures:** show or hide the respective direction.
- **Impulse patterns:** controls strict five-wave impulse drawings.
- **Diagonal candidates:** controls five-wave overlapping diagonal candidate drawings. Diagonals are not treated as strict impulses.
- **Corrective patterns:** controls zigzag and flat A-B-C drawings.
- **Triangle candidates:** controls post-impulse contracting A-B-C-D-E triangle drawings.
- **Fibonacci levels and ratios:** draws Wave 2 retracement levels at 0.382, 0.5, and 0.618 of Wave 1 and adds W2/W1, W3/W1, W4/W3, and W5/W1 ratios to the impulse label.
- **Projected Wave 3 / 5 / C targets:** draws reference levels based on 1.618× Wave 1 for Wave 3, 1× Wave 1 for Wave 5, and an A-length projection for C. These are estimates, not signals.
- **Impulse invalidation level:** draws the Wave 0 origin as the invalidation reference. A close crossing it triggers the invalidation alert for the latest valid impulse.
- **Historical drawing limit:** drawing objects are pruned to stay below TradingView object ceilings. Oldest drawings may be removed first.
- **Line width, label size, bullish color, bearish color, Fibonacci color:** presentation controls.

### Filters, scoring, and alerts

- **Use higher-timeframe context / Higher timeframe / EMA length:** displays a confirmed higher-timeframe close-versus-EMA bias in the chart table and contributes to score when enabled.
- **Use RSI momentum filter / RSI length:** calculates momentum independently on each source timeframe, adds the momentum score component and, if alert filtering is selected, requires RSI above/below 50 for bullish/bearish events.
- **Minimum displayed pattern score:** suppresses impulse drawings and the completed-impulse alert below this threshold. Candidate Wave 2/3/4 alerts remain milestone alerts and can occur before a final score is available.
- **Filter alerts by trend and price action:** requires an aligned HTF bias (when enabled) and a close in the expected direction from the prior bar; RSI is additionally required if its filter is enabled. With the setting off, alerts report structural events only.

## Examples

- **Bullish impulse:** low `0` → high `1` → higher pullback low `2` → higher high `3` → Wave 1 territory-preserving pullback `4` → new high `5`. The wave-2 low must remain above Wave 0.
- **Bearish impulse:** high `0` → low `1` → lower pullback high `2` → lower low `3` → Wave 1 territory-preserving rally `4` → new low `5`. The wave-2 high must remain below Wave 0.
- After either impulse, the indicator can identify an opposite-direction zigzag or flat (A-B-C), or a contracting triangle (A-B-C-D-E), when the confirmed pivots match its configured geometry.
- A diagonal candidate has five impulse-direction swings with Wave 4 overlapping Wave 1. Its internal 3-wave subdivisions cannot be verified from this pivot-only model.

## Repainting and reliability

Confirmed pivots are plotted at their pivot bars, but become available only `Pivot right bars` later. Each enabled source has an independent pivot sequence and pattern count. For sources above the chart timeframe, the script reads the pivot and ATR/RSI from a prior completed source-timeframe bar with `barmerge.lookahead_on` and offset expressions, avoiding unfinished-bar lookahead; this can add up to one source-timeframe bar of latency beyond pivot confirmation. Equal-timeframe sources use chart pivots directly. Sources below the chart timeframe are collected with `request.security_lower_tf()`; only confirmed pivot events are processed, in intrabar order, while all drawings remain anchored to the source pivot timestamps. Lower-timeframe history and intrabar availability are subject to TradingView's limits, so the amount of lower-timeframe history available can vary by plan, symbol, and chart timeframe. Alerts are evaluated only after the pivot data is available, not backdated to the pivot bar.

Higher-timeframe trend values use the prior completed HTF bar (`close[1]` and prior EMA with `barmerge.lookahead_on`), avoiding use of an unfinished HTF candle. This means HTF context intentionally lags by one HTF bar. The script does not use `barstate.isconfirmed` as an HTF lookahead workaround. Provisional swing markers are available only when **Include chart timeframe** is enabled (and not deduplicated against an enabled source timeframe).

Pivot sequences can change as new confirmed pivots replace a less-extreme same-type endpoint or additional pivots create a later possible count. Lower-timeframe events are processed in batches within each chart bar; an alertcondition is therefore evaluated on the chart bar, not independently on each source intrabar. Provisional swing labels are estimates based on the current bar and can move/disappear. They never generate alerts. Flat and triangle classifications use simplified pivot geometry; diagonals require internal subdivisions that this script cannot verify. The script does not search every alternate count, degree, running/expanding triangle, or Elliott combination. Standard Elliott Wave interpretation remains partly subjective; treat these additional structures as candidates.

## Add to TradingView

1. Open a TradingView chart and open **Pine Editor**.
2. Copy all of `DrawElliottWave.pine` into the editor.
3. Select **Save**, then **Add to chart**.
4. Configure the indicator from its gear icon. To receive an event, create a TradingView alert and select one of this indicator's named alert conditions.

## Compilation/debug checklist

- Confirm the editor is set to Pine Script v6 and the first line is `//@version=6`.
- Keep the script as an `indicator()`; do not convert it into a strategy.
- If a drawing-limit error occurs after customization, reduce the historical drawing limit. The script prunes its own lines and labels and requests limits of 500.
- If an array/index error is reported, confirm the script is complete and unmodified; all pattern scans are guarded by minimum pivot counts.
- If pivots appear late or seem absent, reduce pivot lengths or the minimum swing threshold. Confirmed pivots necessarily wait for the selected right bars. Lower-timeframe coverage is limited by the intrabars TradingView provides for the chart; try a lower chart timeframe if an enabled source has too little available history.
- For a meaningful HTF context, choose a timeframe higher than the chart timeframe.
