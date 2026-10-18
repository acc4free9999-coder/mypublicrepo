export const referenceHtml = `
<section class="notice">
  <h2>Education, not a promise</h2>
  <p>This course studies XAUUSDm OHLC candles for structure practice; it does not establish executable trades or a performance backtest. There is no unique objectively correct Elliott count on every chart, no proven edge supplied here, and no automatic path from day 30 to live trading. Leveraged gold products can produce rapid losses. Stop orders do not guarantee the planned exit price.</p>
</section>
<section>
  <h2>Your repeatable counting workflow</h2>
  <ol>
    <li><strong>Freeze the evidence:</strong> XAUUSDm source, timeframe, source timestamp, last visible candle, and complete versus forming candles. Do not label source timestamps UTC unless verified.</li>
    <li><strong>Start with context:</strong> daily major swings; do not hunt a small-timeframe entry first.</li>
    <li><strong>Select pivots consistently:</strong> the training convention needs two completed bars to each side. Endpoint time and confirmation time differ.</li>
    <li><strong>Assign one parent degree:</strong> (1)-(5) or (A)-(C). Inspect child structure on the assigned chart context; do not mix ripple labels with multi-month legs.</li>
    <li><strong>Test structure:</strong> number of legs, subdivisions, price boundaries, directional lengths, and permitted parent position.</li>
    <li><strong>Separate rules from guidelines:</strong> alternation, Fibonacci, channeling, and momentum cannot rescue an invalid count.</li>
    <li><strong>Write one alternate or no-count:</strong> use the same evidence and explicit falsification conditions.</li>
    <li><strong>Conclude:</strong> document a primary, alternate, or no-count with explicit invalidation. A count is not an entry.</li>
    <li><strong>Preserve the original:</strong> screenshot before revealing bars. Add later observations on a new copy.</li>
  </ol>
</section>
<section>
  <h2>Pattern desk card</h2>
  <div class="table-wrap"><table>
    <thead><tr><th>Pattern</th><th>Structure / position</th><th>Common mistake</th></tr></thead>
    <tbody>
      <tr><td>Standard impulse</td><td>5-3-5-3-5; 2 stays within 1's origin; 3 exceeds 1 and is not shortest of 1/3/5; 4 does not overlap 1 territory.</td><td>Calling 3 always longest; ignoring wicks; pretending an unfinished fifth validates all lengths.</td></tr>
      <tr><td>Zigzag</td><td>A-B-C, 5-3-5; B does not exceed A's start; C normally exceeds A's end.</td><td>Calling the first five-wave A a complete correction.</td></tr>
      <tr><td>Flat</td><td>A-B-C, 3-3-5; B substantially retraces A (conventionally at least about 90%). Expanded B and C overshoot.</td><td>Calling every new extreme a directional breakout.</td></tr>
      <tr><td>Triangle</td><td>A-B-C-D-E, corrective legs; typically 4, B, or the final part of a combination.</td><td>Labeling it a standard impulse or the entirety of wave 2.</td></tr>
      <tr><td>Diagonal</td><td>Five motive legs with characteristic 1/4 overlap; leading in 1/A, ending in 5/C. Verify internals separately.</td><td>Using a wedge to excuse any invalid impulse. Recognition only here.</td></tr>
      <tr><td>Combination</td><td>W-X-Y (or W-X-Y-X-Z); corrective blocks linked by X.</td><td>Adding labels indefinitely instead of admitting uncertainty.</td></tr>
    </tbody>
  </table></div>
  <p>Mirror bullish price tests for bearish counts. Test candle extremes on one consistent feed. If a boundary touch is ambiguous at the feed's precision, skip rather than exploit rounding. These are taxonomy checks, not a trading signal.</p>
</section>
<section>
  <h2>Worked numerical impulse: generic price units, deliberately hypothetical</h2>
  <p>These invented endpoints teach arithmetic; they are not market data, XAUUSDm price history, or a recommendation. Even a passing skeleton needs lower-degree structural verification.</p>
  <div class="table-wrap"><table>
    <thead><tr><th>Point</th><th>Bullish example</th><th>Bearish mirror</th></tr></thead>
    <tbody>
      <tr><td>0</td><td>0</td><td>400</td></tr>
      <tr><td>1</td><td>100</td><td>300</td></tr>
      <tr><td>2</td><td>40</td><td>360</td></tr>
      <tr><td>3</td><td>220</td><td>180</td></tr>
      <tr><td>4</td><td>150</td><td>250</td></tr>
      <tr><td>5</td><td>260</td><td>140</td></tr>
    </tbody>
  </table></div>
  <ol>
    <li>Wave 2 retraces 60 of 100 generic price units: 60%. It does not cross point 0.</li>
    <li>Directional lengths are 100, 180, and 110 generic price units. Wave 3 is not shortest and passes wave 1's endpoint.</li>
    <li>Bullish wave 4 stays above 100; bearish wave 4 stays below 300. No wave-1/4 overlap.</li>
    <li>Now change bullish point 4 to 90. This fails the standard-impulse overlap test, even though the overall shape still rises.</li>
    <li>Before point 5 completes, label the fifth provisional. Do not use its later length to certify a trade made earlier.</li>
  </ol>
</section>
<section>
  <h2>Worked XAUUSDm chart examples: evidence, not certified answers</h2>
  <p>Each lesson's generated chart context contains up to 96 consecutive actual MT5 OHLC candles selected inside that lesson's 2023-2024 study window (initially 48 visible). Its source-hash-based window identity identifies the selected data context. Each unit provides two distinct examples: a confirmed retrospective P-pivot view, then a hindsight-selected candidate with a rule audit. The candidate is the first consecutive-pivot sequence passing the available limited endpoint checks where possible, otherwise the first rejected or incomplete candidate. It is <strong>for teaching only, not certified lower-degree structure, predictive or performance evidence, an answer key, or a trading signal</strong>. The separate practice exercise remains independent; examples do not overwrite it, and learners draw and test their own count there.</p>
  <p>Read the exact timeframe and candle timestamps shown with each chart. Synchronized Daily/H4/H1 panes use a common as-of point and completed candles only, based on nominal candle closes; later-completing higher-timeframe candles must not leak into the view. Review JSON exports exact OHLC values for visible bars and source-hash window identity so a reviewer can reproduce the evidence shown. The source server timezone and executable price basis are unknown, so do not infer UTC or treat OHLC prices as available bid/ask fills. Preserve observed pivots separately from your labels, and record "unclear" where structure is insufficient.</p>
</section>
<section>
  <h2>How to draw on a real candle chart</h2>
  <ol>
    <li>Use standard candles and wicks. Record the supplied source and timestamp exactly; mark timezone unknown until verified.</li>
    <li>With a trendline tool, connect confirmed alternating swing endpoints. Do not smooth away inconvenient extremes.</li>
    <li>With the Elliott impulse tool or text labels, place 0 at the proposed origin and 1-5 at endpoints. Corrective labels are A-C or A-E, not extra impulse numbers.</li>
    <li>Place horizontal lines at count invalidations, and separately at any trade stop and trigger.</li>
    <li>For retracements, anchor the start and end of the measured leg. For extensions, add the correction endpoint as the third anchor.</li>
    <li>If you use a parallel channel, state all three anchors. A drawn guide is not an Elliott rule or a substitute for the price-structure checks.</li>
    <li>Capture the chart before revealing the future. Name images with day, XAUUSDm, source, timeframe, cutoff, and primary/alternate.</li>
  </ol>
  <p>The embedded chart is a candle-based practice surface. Its retrospective confirmed pivots and mechanical candidate audit are observed-data illustrations only. Instant checker results count actual intervening candle wicks as well as selected endpoints and remain limited to the selected objective-rule mode; they cannot certify subjective Elliott interpretation.</p>
</section>
<section>
  <h2>Optional research hypothesis: no asserted trades</h2>
  <p>This is optional research guidance, not a strategy prescribed by the 30-day Roadmap. The course's required outcome is a defensible structure analysis; no trade or no-size is acceptable.</p>
  <ul>
    <li><strong>Instrument/data:</strong> supplied XAUUSDm MT5 OHLC candles. H4 is the standard lesson focus; Daily focus on days 7 and 21; optional H1 analysis on days 22-25. Study windows are historical chart contexts, not executable broker sessions.</li>
    <li><strong>Analysis:</strong> describe a plausible wave 1 and corrective wave 2 inside its origin; do not promote a diagonal, complex, or unclear count to a trade setup. Keep one primary and at most one alternate.</li>
    <li><strong>Confirmation:</strong> use the two-bars-each-side pivot convention and note when each pivot becomes knowable. A completed H1 close beyond a later confirmed reaction pivot may be recorded as a structural condition, not an order trigger or fill.</li>
    <li><strong>Hypothetical levels:</strong> any entry, stop, or target drawn for teaching must be explicitly hypothetical and separate from observed OHLC. The dataset does not establish executable bid/ask, spread, slippage, or a tradable open.</li>
    <li><strong>Timezone and eligibility:</strong> record source timestamps exactly. Server timezone and mapping are unknown; do not claim UTC or apply a clock-based session/news rule without verifying the mapping.</li>
    <li><strong>Risk:</strong> use percentage limits only as abstract education until demo equity, instrument specifications, account-currency conversion, costs, and lot constraints are verified. Do not infer exposure or size from the symbol name.</li>
    <li><strong>Ambiguity:</strong> OHLC bars do not show the intrabar price sequence or prove execution. If a hypothetical stop and target are both within one bar, label the sequence unknown; do not report a fill or numerical performance result.</li>
  </ul>
  <p>Contract size (ounces per lot), tick value, account-currency conversion, price basis, lot step, spread/slippage, commissions, financing, minimum size, and margin specifications are not established here. Verify them independently before any hypothetical sizing or execution study. Until then, this is an analysis-only chart course, not a trading backtest. Day 28's 20-setup performance review is conditional on broader terminal history and verified execution inputs; otherwise screen candidates structurally and report the limits.</p>
</section>
<section>
  <h2>Gold price-distance and risk arithmetic</h2>
  <p>Describe chart movement as a USD-per-ounce price distance, but verify that the broker's XAUUSDm quote and contract actually use that convention. The symbol and candles do not specify ounces per lot or account-currency value.</p>
  <p><code>Budget = account equity x chosen risk fraction<br>Risk per lot = stop distance (USD/oz) x verified contract size (oz/lot) x verified account-currency conversion + modeled costs per lot<br>Lots = budget / risk per lot<br>Net reward/risk = (target-distance value - win-side costs) / (stop-distance value + loss-side costs)</code></p>
  <p>Do not substitute an assumed $10/pip, standard-lot size, tick value, or conversion rate. If any contract term, price basis, or cost input is unavailable, do not calculate a size or claim a fill. Planned risk is not maximum possible loss; gaps and execution conditions can exceed it.</p>
  <p>Margin is not the risk budget. Verify both; size down or skip if either constraint fails. Do not add spread twice if the verified price basis already includes it.</p>
</section>
<section>
  <h2>Journal and historical fill ledger</h2>
  <p>Use one row per screened chart candidate. The app provides a freeform journal and local rule checks, not a broker-grade backtester. Keep screenshots separately; workbook exports contain saved course records and chart annotations, not image attachments.</p>
  <p><code>Source timestamp | XAUUSDm/feed | verified timezone or unknown | timeframe/cutoff | primary/alternate | rule checks | observed pivots | hypothetical trigger/invalidation/stop | price basis/specifications status | cost assumptions or unknown | skip reason | review notes | screenshot names</code></p>
  <p>Keep actual candle observations separate from hypothetical levels. Without verified price basis, contract and execution specifications, leave fill, position size, and performance fields not applicable. A move through a hypothetical level is not a simulated fill or stopped-out trade.</p>
</section>
<section>
  <h2>Instant checks and manual review</h2>
  <p>The chart checker provides immediate, local objective checks for swings, impulse, zigzag, flat, and triangle modes, within each mode's stated limits. A passing check is not a certified Elliott count and does not replace structural interpretation. There is no embedded AI and no automatic message or order sending.</p>
  <p>Export a review JSON and/or SVG for human feedback. Attach the exported file to a chat or provide a shared page when requesting manual review. Instant in-app feedback is distinct from a person reviewing your exported work.</p>
</section>
<section>
  <h2>Day 30 capstone rubric: 20 points</h2>
  <p>Award one point for each evidenced item, not for correct directional hindsight.</p>
  <ol class="rubric">
    <li>New historical interval selected without prior notes (Day 30).</li>
    <li>XAUUSDm source, focus timeframe, and source timestamp recorded.</li>
    <li>As-of cutoff and completed/forming candles distinguished; no future-bar leak.</li>
    <li>Daily context and larger-degree hypothesis documented (Day 21).</li>
    <li>H4 candidate count and observed pivots shown.</li>
    <li>Optional H1 evidence supports, contradicts, or remains inconclusive (Days 21-25).</li>
    <li>Pivot-selection convention stated; pivots are not used before confirmation.</li>
    <li>Parent/child degree notation is consistent.</li>
    <li>Wave-2 origin rule checked, or marked not applicable with reason.</li>
    <li>Wave-3 progress and shortest-wave test addressed, including completeness limits.</li>
    <li>Wave-4 overlap test addressed, or marked not applicable with reason.</li>
    <li>Corrective structure and lower-degree evidence assessed, not assumed.</li>
    <li>One plausible alternate or a defensible no-count is included.</li>
    <li>Primary and alternate invalidation conditions are explicit.</li>
    <li>Retracement anchors and levels are measured consistently (Day 11).</li>
    <li>Extension or wave-length relationship is measured with stated anchors (Days 12-13).</li>
    <li>Confluence and conflicting evidence are distinguished (Day 14).</li>
    <li>Conclusion follows the applicable structure rules; no trade/no-count is allowed.</li>
    <li>Later evidence is reviewed without rewriting the frozen analysis.</li>
    <li>Unknown timezone, contract, execution basis, costs, and fill limits are disclosed; no unsupported monetary claim is made.</li>
  </ol>
  <p><strong>Pass:</strong> at least 16/20 and no critical failure. Critical failures: presenting a known hard-rule violation as valid, leaking future candles into the frozen analysis, or inventing a contract size, fill, or performance result from OHLC alone. A well-supported unclear/no-count/no-trade/no-size conclusion can pass; do not fill not-applicable items with invented claims.</p>
</section>
<section>
  <h2>Sources, data rights, and limitations</h2>
  <p>All instructional prose and schematics are original. Schematics are teaching drawings, not screenshots. Embedded market data is the supplied XAUUSDm MT5 Daily/H4/H1 OHLC in <code>data/Mt5Data</code>, covering January 2021-September 2026. The course uses generated windows of up to 96 candles (initially 48 visible) inside each lesson's 2023-2024 study window. Some roadmap quotas exceed one displayed slice; use wider source history where available or report a shortage. Day 28's target of 20 setups is conditional on verified contract, timestamp, price-basis, and cost data; otherwise do a structural-only screen without performance claims. Source server timezone, contract size, account conversion, and executable price basis are unknown; the OHLC is not represented as verified fills.</p>
  <ul>
    <li><a href="https://www.elliottwave.com/waveopedia/impulse/">Elliott Wave International: impulse taxonomy</a> and <a href="https://www.elliottwave.com/waveopedia/corrective-waves/">corrective taxonomy</a>. These sources explain the framework, not a verified trading edge.</li>
    <li><a href="https://www.cftc.gov/LearnAndProtect/index.htm">CFTC investor education</a>. Check the regulator and product rules in your own jurisdiction.</li>
  </ul>
  <p>The lesson windows and generated chart windows overlap. Repeated exposure is useful practice but contaminates an unseen test. Only a separately reserved, genuinely unviewed holdout can serve that role. No live price service, brokerage connection, financial recommendation, or automatic trading is provided.</p>
</section>`;
