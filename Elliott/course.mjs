export const stages = [
  {
    id: "foundations",
    title: "Foundations: recognize the cycle",
    days: [1, 5],
    goal: "Describe swings, impulse rules, corrective behavior, and a possible ABC without treating any count as certain.",
    milestone: "Two annotated directional impulse hypotheses, three impulse audits, five correction comparisons, three ABC candidates, and uncertainty preserved."
  },
  {
    id: "accurate-counting",
    title: "Correct wave counting",
    days: [6, 10],
    goal: "Invalidate impossible counts, compare degrees, inspect subdivisions, and maintain alternatives.",
    milestone: "Five invalidation audits, one multi-timeframe packet, ten classifications, two subdivision reviews, and three primary/alternate chart pairs."
  },
  {
    id: "measurements",
    title: "Fibonacci and wave relationships",
    days: [11, 15],
    goal: "Measure retracements and projections consistently while keeping ratios subordinate to structure.",
    milestone: "Five measured wave-1/wave-2 pairs, five projections, five completed-wave comparisons, three confluence zones, and a ten-case measurement exam."
  },
  {
    id: "advanced-structures",
    title: "Advanced wave structures",
    days: [16, 20],
    goal: "Distinguish common corrective structures and recognize when the evidence does not justify a complex label.",
    milestone: "Three zigzag and three flat reviews, two triangle reviews, two complex-correction studies, and two diagonal studies with explicit uncertainty."
  },
  {
    id: "testable-planning",
    title: "Apply wave analysis to testable planning",
    days: [21, 25],
    goal: "Translate multi-timeframe analysis into falsifiable, risk-aware hypothetical plans without claiming unsupported executions.",
    milestone: "Two multi-timeframe conflict reviews, five wave-2 candidates, five wave-3 candidates, five specification-aware sizing worksheets, and one frozen plan."
  },
  {
    id: "chart-mastery",
    title: "Real-chart mastery",
    days: [26, 30],
    goal: "Reduce hindsight bias, compare regimes, conditionally test rules, audit mistakes, and complete an independent examination.",
    milestone: "Ten replay records, three regime studies, a conditional 20-setup audit when execution data permits, three preventive rules, and a complete capstone packet."
  }
];

const windows = [
  ["2023-01-02", "2023-03-31"], ["2023-02-01", "2023-04-28"],
  ["2023-03-01", "2023-05-31"], ["2023-04-03", "2023-06-30"],
  ["2023-05-02", "2023-07-31"], ["2023-06-01", "2023-08-31"],
  ["2023-07-03", "2023-09-29"], ["2023-08-01", "2023-10-31"],
  ["2023-09-01", "2023-11-30"], ["2023-10-02", "2023-12-29"],
  ["2023-11-01", "2024-01-31"], ["2023-12-01", "2024-02-29"],
  ["2024-01-02", "2024-03-28"], ["2024-02-01", "2024-04-30"],
  ["2023-01-02", "2023-03-31"], ["2023-02-01", "2023-04-28"],
  ["2023-03-01", "2023-05-31"], ["2023-04-03", "2023-06-30"],
  ["2023-05-02", "2023-07-31"], ["2023-06-01", "2023-08-31"],
  ["2023-07-03", "2023-09-29"], ["2024-01-02", "2024-03-28"],
  ["2024-02-01", "2024-04-30"], ["2024-03-01", "2024-05-31"],
  ["2024-04-02", "2024-06-28"], ["2024-06-03", "2024-08-30"],
  ["2024-07-01", "2024-09-30"], ["2024-08-01", "2024-10-31"],
  ["2024-09-02", "2024-11-29"], ["2024-10-01", "2024-12-31"]
];

const lessonData = [
  {
    title: "Understand the Elliott Wave Cycle",
    goal: "Recognize impulse and correction as competing descriptions of price structure, not forecasts.",
    learn: [
      "A motive sequence is commonly labeled 1-2-3-4-5 and a correction A-B-C; direction alone does not identify either pattern.",
      "Counts are hypotheses nested across degrees. No neat drawing proves what the next candle will do or supplies a profitable edge.",
      "Use actual XAUUSDm candle highs and lows. Preserve source timestamps; server timezone and executable prices are unverified."
    ],
    draw: ["Mark major highs and lows before assigning labels.", "On a separate layer, propose one bullish or bearish five-leg sequence and a possible following ABC.", "Distinguish observed pivots from inferred labels."],
    exercise: "Find two potential impulse patterns in the assigned historical context: one bullish and one bearish if available. Annotate each, explain what supports its five-wave hypothesis, and save two screenshots. If one direction is absent, document the search and do not invent it.",
    quiz: "Does a plausible five-wave sequence guarantee that price will continue in that direction?",
    answer: "No. It is an interpretation of past structure, not a guaranteed continuation or evidence of a trading edge.",
    gate: "Two annotated candidates or a documented directional shortage; observations and hypotheses distinguished; no trade claim.",
    prompt: "Which part of your count is directly visible, and which part is interpretation?",
    deliverable: "Two annotated chart studies, bullish and bearish where available.",
    exampleFocus: "Contrast motive and corrective-looking structure using observed gold candles.",
    labTimeframe: "H4",
    checkMode: "swings",
    measurement: "none",
    exampleKind: "pivots"
  },
  {
    title: "Identify Swing Highs and Swing Lows",
    goal: "Select meaningful turning points consistently before naming waves.",
    learn: [
      "A swing high is a local peak and a swing low a local trough, but both depend on scale and confirmation convention.",
      "A two-completed-bar filter on either side is a useful training convention, not an Elliott rule. A pivot is only confirmed after the right-side bars close.",
      "Use the synchronized H4 and H1 panes to distinguish a parent swing from smaller internal movement; do not label every candle."
    ],
    draw: ["Mark alternating major highs and lows on H4 without Elliott numbers.", "Use a second color for lower-timeframe swings.", "Mark provisional endpoints distinctly from confirmed pivots."],
    exercise: "Study 50-100 historical H4 candles. Mark major swing highs/lows, dominant direction, and important corrections. Compare the same section with H1 and submit one chart showing major structure without Elliott labels.",
    quiz: "A candidate pivot occurs at candle t and your convention requires two completed candles on its right. When is it knowable?",
    answer: "After the second right-hand candle has completed and the pivot condition still holds; not at candle t.",
    gate: "A 50-100-candle H4 chart has unlabeled major structure, alternating pivots, trend, and corrections; no pivot is used before confirmation.",
    prompt: "What changed when you stopped labeling each small fluctuation?",
    deliverable: "One H4 chart of major market structure without Elliott labels.",
    exampleFocus: "Confirmed pivots versus smaller swings and provisional endpoints.",
    labTimeframe: "H4",
    checkMode: "swings",
    measurement: "none",
    exampleKind: "pivots"
  },
  {
    title: "Count Waves 1–5",
    goal: "Test a proposed standard impulse against its three hard price rules.",
    learn: [
      "In a standard impulse, wave 2 cannot pass the origin of wave 1; wave 3 must progress beyond wave 1 and cannot be the shortest of waves 1, 3, and 5; wave 4 does not overlap wave-1 price territory.",
      "Compare absolute price distances in the same units. Wave 3 need not be the longest. The shortest-wave comparison requires wave 5 to be complete.",
      "Test intrabar extremes, not only closes. A possible diagonal is a separate hypothesis, not a rescue label for an invalid standard impulse."
    ],
    draw: ["Mark 0-1-2-3-4-5 on three candidates.", "Add the wave-2-origin and wave-1/wave-4 boundaries.", "Record each rule as pass, fail, or not yet decidable."],
    exercise: "For three possible historical impulses, mark all six endpoints and check wave-2 origin, wave-3 progress/length, and wave-4 overlap. Reject or qualify each without assuming subdivisions are confirmed.",
    quiz: "Hypothetical bullish endpoints are 0=$2,300, 1=$2,310, 2=$2,303, 3=$2,325, 4=$2,308, 5=$2,325. Is this a valid standard impulse?",
    answer: "No. Wave 4 at $2,308 overlaps wave-1 territory ($2,300-$2,310). Wave lengths are $10, $22, and $17, so wave 3 is not shortest; that does not fix the overlap.",
    gate: "Three endpoint audits completed and numerical quiz identifies wave-4 overlap; uncertain subdivisions remain provisional.",
    prompt: "Which hard rule rejected a visually appealing candidate?",
    deliverable: "Three annotated counts with a written rule audit for each.",
    exampleFocus: "Endpoint rule checks and the difference between a plausible shape and a valid standard impulse.",
    labTimeframe: "H4",
    checkMode: "impulse",
    measurement: "none",
    exampleKind: "impulse"
  },
  {
    title: "Understand Wave 2 and Wave 4",
    goal: "Describe corrective structure and alternation without turning guidelines into rules.",
    learn: [
      "Wave 2 can be sharp/deep or complex; wave 4 is often more sideways, but neither tendency is mandatory.",
      "Alternation may appear in depth, duration, or form. It is a guideline and cannot invalidate a count by itself.",
      "Measure a retracement from the full preceding motive leg to the correction endpoint, using consistent wick endpoints."
    ],
    draw: ["Mark wave-1 and wave-3 spans and their following corrections.", "Compare correction duration in bars and price depth.", "Label alternation present, absent, or indeterminate."],
    exercise: "Find five impulse candidates. For each, measure wave-2 and wave-4 retracements, compare shapes and elapsed bars, and note whether alternation is apparent. Describe one sharp/deep wave 2 with a sideways wave 4 if found; otherwise record the shortage.",
    quiz: "If wave 2 is sharp and wave 4 is also sharp, does that alone invalidate a standard impulse?",
    answer: "No. Alternation is a guideline, not a hard rule. Check the impulse rules and internal structure separately.",
    gate: "Five comparison records include depth, duration, and form; no count rejected solely for lack of alternation.",
    prompt: "Did alternation help describe evidence or tempt you to force a pattern?",
    deliverable: "Five examples of corrective behavior with measured comparisons.",
    exampleFocus: "Two corrections can differ, resemble each other, or remain unclear.",
    labTimeframe: "H4",
    checkMode: "impulse",
    measurement: "relationships",
    exampleKind: "correction"
  },
  {
    title: "Identify ABC Corrections",
    goal: "Label a possible three-part correction while keeping its completion provisional.",
    learn: [
      "A correction may contain A-B-C, but the letters do not establish the internal structure or prove the correction is complete.",
      "A zigzag commonly has 5-3-5 internals; other corrections have different structures. A directional move against the prior trend may be corrective, but context matters.",
      "A later price extreme can change the interpretation. Preserve the first hypothesis and record what would falsify it."
    ],
    draw: ["Select a completed motive-looking segment and mark a possible following A-B-C.", "Show A's start/end and B/C endpoints.", "Add an alternate or 'incomplete/unclear' note."],
    exercise: "Find three possible ABC corrections. For each, record the start and end of A, end of B, end of C, whether the move is complete, and one plausible alternate. Do not force three examples if the window does not support them.",
    quiz: "Does finding three turning points after an impulse prove that A-B-C is complete?",
    answer: "No. The labels and endpoint geometry alone do not establish internal structure or completion.",
    gate: "Three correction studies or documented shortage; endpoints and completion uncertainty recorded.",
    prompt: "What evidence would make you reconsider the proposed C endpoint?",
    deliverable: "Three possible ABC corrections with endpoints and uncertainty notes.",
    exampleFocus: "Observed corrective pivots and the boundary between A-B-C hypothesis and proof.",
    labTimeframe: "H4",
    checkMode: "zigzag",
    measurement: "none",
    exampleKind: "correction"
  },
  {
    title: "Learn Wave Invalidation",
    goal: "Reject a count at its predeclared invalidation rather than move the boundary.",
    learn: [
      "A proposed standard impulse has structural falsification conditions; in particular, wave 2 may not cross the origin of wave 1.",
      "State price boundaries and structural conditions before revealing more candles. A rule failure rejects that interpretation, not every possible count.",
      "Wicks can cross a level even when the close does not. Where precision is ambiguous, label the test uncertain rather than rounding it into a pass."
    ],
    draw: ["Mark wave-1 origin and end on five candidates.", "Draw the wave-2 invalidation and list other rule violations.", "Make a fresh alternate only on a separate layer."],
    exercise: "Audit five proposed impulses. For each, mark wave-1 origin/end, wave-2 invalidation, other rule violations, and the action if crossed. Include one written response to a bullish count whose price falls below its origin.",
    quiz: "A proposed bullish standard impulse begins at $2,300 and the proposed wave 2 falls to $2,299.50. What follows?",
    answer: "That particular standard-impulse count is invalid under the wave-2 origin rule. Reassess without moving the origin; another structure may still be possible.",
    gate: "Five audits identify invalidation and response; no invalidation is moved to preserve a forecast.",
    prompt: "Did you reject the specific count or overgeneralize the rule failure?",
    deliverable: "Five invalidation audits and a documented reassessment rule.",
    exampleFocus: "Wave-2 origin invalidation and precise scope of a rejection.",
    labTimeframe: "H4",
    checkMode: "impulse",
    measurement: "none",
    exampleKind: "impulse"
  },
  {
    title: "Understand Elliott Wave Degrees",
    goal: "Relate parent and child structures without equating timeframe and degree.",
    learn: [
      "Waves are nested; daily, H4, and H1 offer different views but do not automatically define wave degrees.",
      "The higher-timeframe pane is context; lower panes can show candidate subdivisions only from candles available by the same cutoff.",
      "A missing or contradictory child structure keeps the parent hypothesis provisional; do not promote visual similarity into confirmation."
    ],
    draw: ["On Daily, mark a possible parent movement.", "On H4 and H1, align the same dated interval and show candidate child pivots.", "Use consistent parent/child notation and mark any mismatch."],
    exercise: "Find one larger potential wave. Deliver one Daily chart and two corresponding lower-timeframe charts (H4 and H1), with the same parent boundaries, at least three candidate child movements, and a note on whether lower structure supports or weakens the parent.",
    quiz: "Is every H4 swing exactly one degree below every Daily swing?",
    answer: "No. Degree is relative to nested structure, not determined by the timeframe menu.",
    gate: "One Daily plus corresponding H4/H1 views share parent boundaries; conflicts and incomplete bars are disclosed.",
    prompt: "Which apparent child wave disappeared when you aligned the timeframes?",
    deliverable: "One Daily chart and two corresponding lower-timeframe charts.",
    exampleFocus: "Nested structure across synchronized panes with a common as-of cutoff.",
    labTimeframe: "Daily",
    checkMode: "swings",
    measurement: "none",
    exampleKind: "degree"
  },
  {
    title: "Distinguish Impulses from Corrections",
    goal: "Classify price movements without forcing every directional move into an impulse.",
    learn: [
      "Test whether a candidate fits five motive/corrective legs and applicable impulse rules; assess whether a correction or unclear structure better fits.",
      "A rule screen tests selected price conditions, not all subdivisions. Even a screen pass is not a certified Elliott count.",
      "Maintain 'unclear' when evidence is insufficient; it is a valid analytical result."
    ],
    draw: ["Prepare three labels: potential impulse, potential correction, unclear.", "Mark the evidence that supports and contradicts each classification.", "Keep endpoint screens separate from internal-structure claims."],
    exercise: "Collect and classify ten historical movements as potential impulse, potential correction, or unclear. Include a movement that first looks impulsive but becomes questionable under closer structural review, and explain why.",
    quiz: "A directional move has five visible turns but wave 4 overlaps wave 1 in a proposed standard impulse. Must you classify it as a valid impulse?",
    answer: "No. The proposed standard impulse fails its overlap rule; consider another supported structure or mark it unclear.",
    gate: "Ten classifications and one detailed reconsideration; no forced category or certification claim.",
    prompt: "Which observation changed your initial classification?",
    deliverable: "Ten classified movements and one reconsidered candidate.",
    exampleFocus: "Impulse/correction alternatives and a defensible unclear classification.",
    labTimeframe: "H4",
    checkMode: "impulse",
    measurement: "none",
    exampleKind: "alternates"
  },
  {
    title: "Learn Internal Wave Structure",
    goal: "Use lower-timeframe evidence to assess, not certify, a proposed parent impulse.",
    learn: [
      "In a standard impulse, waves 1, 3, and 5 are motive; their internals often show five-wave organization. Waves 2 and 4 are corrective and often show three-wave organization.",
      "These are structural expectations, not claims that every subdivision will be visible in a 96-bar window.",
      "Ambiguous lower-degree labels keep the larger count provisional; do not fill gaps with imagined subwaves."
    ],
    draw: ["Select a candidate H4 wave 3.", "Inspect its synchronized H1 segment and label only visible candidate subwaves.", "Record missing, conflicting, and supportive evidence."],
    exercise: "Find two potential wave-3 movements. For each, inspect H1 for a possible five-wave subdivision, mark candidate subwaves, and explain whether the lower-timeframe evidence supports the larger count or remains ambiguous.",
    quiz: "If the H1 subdivision of a proposed H4 wave 3 is unclear, should you call the larger count confirmed?",
    answer: "No. Keep the parent hypothesis provisional and record the unresolved internal structure.",
    gate: "Two candidate wave-3 reviews or documented shortage; no invented subdivisions; parent confidence stated.",
    prompt: "What is missing before the lower-degree structure could support your parent count?",
    deliverable: "Two wave-3 subdivision studies with uncertainty notes.",
    exampleFocus: "H4 motive leg and synchronized H1 candidate internal structure.",
    labTimeframe: "H4",
    checkMode: "impulse",
    measurement: "none",
    exampleKind: "degree"
  },
  {
    title: "Develop Primary and Alternative Counts",
    goal: "Represent uncertainty with competing hypotheses and explicit discriminating evidence.",
    learn: [
      "A primary count is currently better supported, not certain. An alternative is a plausible competitor, not a straw man.",
      "Each count needs independent invalidation conditions and a statement of future evidence that would favor it.",
      "Keep originals frozen. Revising labels after revealing bars is an update, not a reason to erase the earlier analysis."
    ],
    draw: ["For each chart, use separate primary and alternate layers.", "Mark the invalidation for both.", "List one observable event that would distinguish them."],
    exercise: "Choose three historical charts. For each, draw a primary and plausible alternate, mark separate invalidations, and state what price behavior would support one over the other. Include a case where both bullish and bearish hypotheses initially remain possible.",
    quiz: "If two counts remain plausible on current evidence, must you choose one?",
    answer: "No. Preserve both or record no-count; explain what evidence would distinguish them.",
    gate: "Three paired hypotheses with distinct falsification and discrimination conditions.",
    prompt: "Is your alternate independently plausible, or merely a fallback with no test?",
    deliverable: "Three primary/alternate chart pairs with discriminating conditions.",
    exampleFocus: "Same candles, competing counts and falsifiable alternatives.",
    labTimeframe: "H4",
    checkMode: "swings",
    measurement: "none",
    exampleKind: "alternates"
  },
  {
    title: "Fibonacci Retracement",
    goal: "Calculate retracement prices from fixed anchors without treating ratios as turning-point rules.",
    learn: [
      "Common study ratios include 38.2%, 50%, 61.8%, and 78.6%; 50% is a conventional level, not a Fibonacci ratio.",
      "For an upward leg from L to H, the downward retracement at r is H - r(H-L). A level is a measurement reference, not proof that a correction ends there.",
      "Use XAUUSDm price units as shown, conventionally discussed here as USD per ounce only when the supplied price basis supports that description; do not infer contract size."
    ],
    draw: ["Fix and record wave-1 low/high before revealing the correction.", "Mark each calculated retracement.", "Compare the observed correction endpoint without relabeling the anchor."],
    exercise: "Measure five historical wave-1/wave-2 pairs. For each, record endpoints, leg size, four retracement levels, and the observed wave-2 endpoint; note when no reliable pair is available.",
    quiz: "A hypothetical gold-price leg rises from $2,300/oz to $2,310/oz. Calculate downward 38.2%, 50%, and 61.8% retracement prices.",
    answer: "The leg is $10/oz. Prices are $2,306.18/oz, $2,305.00/oz, and $2,303.82/oz respectively: high minus ratio times $10.",
    gate: "Five measured pairs or documented shortages; all anchors and arithmetic visible; ratios not treated as rules.",
    prompt: "Did you select your anchors before seeing which ratio looked attractive?",
    deliverable: "Five measured wave-1/wave-2 pairs.",
    exampleFocus: "Fixed-anchor Fibonacci retracement arithmetic on gold-price distances.",
    labTimeframe: "H4",
    checkMode: "swings",
    measurement: "retracement",
    exampleKind: "measurement"
  },
  {
    title: "Fibonacci Extensions and Wave 3",
    goal: "Calculate illustrative wave-3 projections and distinguish them from forecasts.",
    learn: [
      "A common upward projection from the wave-2 endpoint P2 is P2 + k|P1-P0|; reverse the sign for a downward structure.",
      "Multiples such as 1.0, 1.618, and 2.618 are reference measurements, not reliable targets by themselves.",
      "Fix all anchors before revealing later candles. A projection never overrides invalidation or confirms wave count."
    ],
    draw: ["Record wave-1 start/end and wave-2 endpoint.", "Project the three ratios in the proposed direction.", "Mark later price only after the calculation is frozen."],
    exercise: "Find five potential wave-3 measurement cases. Record wave-1 distance, wave-2 endpoint, projected levels, later observed response, and whether structure was independently plausible.",
    quiz: "Hypothetical wave 1 rises $10/oz and wave 2 ends at $2,305/oz. What are upward 1.0, 1.618, and 2.618 projections?",
    answer: "$2,315.00/oz, $2,321.18/oz, and $2,331.18/oz respectively. These are arithmetic projections, not promised destinations or trade targets.",
    gate: "Five projections or shortages documented; quiz correct; no ratio promoted to a prediction.",
    prompt: "What would invalidate the count before any projected level mattered?",
    deliverable: "Five potential wave-3 measurements.",
    exampleFocus: "Wave-1 distance projected from a fixed wave-2 endpoint.",
    labTimeframe: "H4",
    checkMode: "impulse",
    measurement: "extension",
    exampleKind: "measurement"
  },
  {
    title: "Wave 5 Relationships",
    goal: "Compare motive-wave lengths while treating truncation as a structural possibility, not a convenient exception.",
    learn: [
      "Wave 5 may resemble wave 1, extend beyond it, or fail to exceed wave 3's extreme (a possible truncation). Relationships are tendencies, not guarantees.",
      "The hard shortest-wave rule compares the lengths of waves 1, 3, and 5; it does not by itself establish internal subdivisions or make every truncated fifth valid.",
      "Measure endpoints consistently and record the direction and exact price distances."
    ],
    draw: ["For each completed candidate, label 0-1-2-3-4-5.", "Compare absolute lengths of waves 1, 3, and 5.", "Separately mark whether wave 5 passes wave-3 extreme."],
    exercise: "Find five completed impulse candidates. Measure waves 1, 3, and 5, compare relationships, and identify a candidate whose wave 5 is shorter than wave 3. Test the shortest-wave rule and whether price passed the wave-3 extreme; keep truncation provisional without internal evidence.",
    quiz: "A hypothetical candidate has wave lengths W1=$12/oz, W3=$18/oz, W5=$14/oz, but wave 5 does not exceed wave 3's extreme. Is it automatically invalid because W5<W3?",
    answer: "No. Wave 3 need not be the longest, and W1 is the shortest here. Failure to exceed wave 3 may suggest truncation, but the complete subdivisions and remaining rules still need assessment.",
    gate: "Five comparisons include lengths and extreme test; no automatic truncation certification.",
    prompt: "What evidence separates a possible truncated fifth from a mislabeled or incomplete structure?",
    deliverable: "Five completed-impulse relationship records.",
    exampleFocus: "Wave-length arithmetic versus whether wave 5 makes a new extreme.",
    labTimeframe: "H4",
    checkMode: "impulse",
    measurement: "relationships",
    exampleKind: "measurement"
  },
  {
    title: "Fibonacci Confluence",
    goal: "Combine independent context carefully and expose conflicting evidence.",
    learn: [
      "Potential confluence can include retracement, extension, prior support/resistance, and a proposed wave boundary.",
      "Several tools may describe the same price movement and are not necessarily independent evidence; overlap does not multiply probability.",
      "An invalidation boundary remains a rule test, not a level moved to make confluence look stronger."
    ],
    draw: ["Choose three possible wave-2 or wave-4 zones.", "Mark retracement, nearby prior structure, and invalidation separately.", "Classify factors as supportive, conflicting, or unavailable."],
    exercise: "Review three candidate zones. Find one with multiple agreeing factors and one with conflicting factors if available; explain which is easier to analyze and why. Record the primary rejection or no-count reason rather than forcing a setup.",
    quiz: "Two Fibonacci levels and prior support overlap near a proposed wave-2 low. Does that prove the low or guarantee reversal?",
    answer: "No. The overlap is contextual confluence, not confirmation. Structure, invalidation, and subsequent evidence remain necessary.",
    gate: "Three zones reviewed with invalidation explicit; one agreement/conflict comparison or documented shortage.",
    prompt: "Are your supporting factors independent, or repeated measurements of one fact?",
    deliverable: "Three wave-2/wave-4 zone assessments.",
    exampleFocus: "Confluence alongside explicit invalidation and contrary evidence.",
    labTimeframe: "H4",
    checkMode: "swings",
    measurement: "confluence",
    exampleKind: "measurement"
  },
  {
    title: "Fibonacci Review and Measurement Test",
    goal: "Demonstrate measurement fluency without allowing ratios to substitute for structure.",
    learn: [
      "Retracement, extension, and wave-length comparison answer different questions; their anchors must be specified.",
      "Measurement is conditional on the selected count. If anchors change, record a revised hypothesis rather than silently recalculating.",
      "Fibonacci levels are neither hard Elliott rules nor proof of a profitable edge."
    ],
    draw: ["Build a one-page formula card from memory.", "Keep a separate invalidation line on each example.", "Annotate any estimate or unavailable anchor."],
    exercise: "Use ten historical examples. For each, measure wave 1, wave-2 retracement, possible wave-3 extensions, wave 4, and wave 5 against waves 1/3. Then take the closed-book test: explain retracement, extension, why ratios cannot determine count, and how to combine measurement with invalidation.",
    quiz: "If a 61.8% retracement aligns with a proposed wave-2 endpoint but the endpoint crosses wave 1's origin, what controls?",
    answer: "The hard invalidation controls: that proposed standard impulse fails. A Fibonacci alignment cannot rescue it.",
    gate: "Ten records or documented shortages; four test answers include formula, limitations, and invalidation priority.",
    prompt: "Which formula is easiest to misuse by moving its anchor after the outcome?",
    deliverable: "Ten-example measurement review and closed-book measurement test.",
    exampleFocus: "Retracement, projection, relationships, and a rule-first review.",
    labTimeframe: "H4",
    checkMode: "impulse",
    measurement: "relationships",
    exampleKind: "exam"
  },
  {
    title: "Zigzag Corrections",
    goal: "Assess a possible 5-3-5 zigzag without inferring internals from three endpoints alone.",
    learn: [
      "A typical zigzag has A and C motive legs and a corrective B, often summarized as 5-3-5.",
      "In the standard zigzag guideline, B does not pass A's start and C normally passes A's end; endpoints alone do not verify subdivisions.",
      "A five-wave-looking A can be only the first part of a correction. Keep completion provisional."
    ],
    draw: ["Mark candidate A-B-C endpoints on three corrections.", "Inspect H1 children for potential 5-3-5 organization.", "Record endpoint tests separately from internal evidence."],
    exercise: "Find three potential H4 zigzags. Examine their H1 internals for possible 5-3-5 organization. Focus on one directional-looking C leg and explain whether its lower-timeframe structure supports the zigzag hypothesis.",
    quiz: "A has five candidate subwaves, B is a three-part correction, and C has only two visible swings. Is 5-3-5 established?",
    answer: "No. The C subdivision is incomplete or unclear; retain the zigzag as provisional rather than calling its internal pattern confirmed.",
    gate: "Three candidates or shortage documented; one C-focused review; no certification from endpoints alone.",
    prompt: "What would distinguish a possible completed zigzag from an unfinished A leg?",
    deliverable: "Three zigzag studies with internal-structure assessment.",
    exampleFocus: "Possible 5-3-5 structure and incomplete-C uncertainty.",
    labTimeframe: "H4",
    checkMode: "zigzag",
    measurement: "none",
    exampleKind: "correction"
  },
  {
    title: "Flat Corrections",
    goal: "Compare regular, expanded, and running flat hypotheses with the zigzag alternative.",
    learn: [
      "A flat is commonly summarized as 3-3-5. In an expanded flat B exceeds A's start and C exceeds A's end; running-flat descriptions are uncommon and require careful source-specific conventions.",
      "A substantial B retracement is characteristic; the often-used roughly 90% threshold is a taxonomy guideline, not a universal price law.",
      "A new extreme can occur inside a correction. Geometry alone does not verify internals or parent position."
    ],
    draw: ["Mark A/B/C endpoints and A's origin/end.", "Record whether candidate B and C overshoot.", "Compare one candidate flat with one zigzag using subdivisions."],
    exercise: "Find three possible flats. For each, label A-B-C, assess candidate 3-3-5 internals and classify regular/expanded/running/unclear only where evidence supports it. Compare one possible flat with one zigzag and explain the structural difference.",
    quiz: "Hypothetical A falls from $2,310 to $2,300; B rises to $2,312; C falls to $2,298. What endpoint pattern is suggested, and what remains unproven?",
    answer: "B exceeds A's start and C passes A's end, suggesting an expanded-flat endpoint pattern. The 3-3-5 internal organization and valid larger context remain unproven.",
    gate: "Three reviews or shortage; one flat/zigzag comparison; no subtype assigned from geometry alone.",
    prompt: "Which label depends on internals you cannot yet see?",
    deliverable: "Three candidate-flat reviews and one comparison with a zigzag.",
    exampleFocus: "Flat endpoint variants and the role of internal subdivision.",
    labTimeframe: "H4",
    checkMode: "flat",
    measurement: "none",
    exampleKind: "correction"
  },
  {
    title: "Triangles",
    goal: "Distinguish a possible five-leg corrective triangle from ordinary consolidation.",
    learn: [
      "Triangles have five overlapping segments A-B-C-D-E, commonly with corrective internal legs; a five-turn silhouette is not sufficient.",
      "Contracting, expanding, ascending, and descending descriptions depend on boundary behavior. Parent position matters and varies by Elliott convention.",
      "Common placements include wave 4 and B; do not automatically label every narrowing range or assume it completes a whole wave 2."
    ],
    draw: ["Inspect two H4 or H1 consolidations.", "Mark boundary lines and possible A-E pivots.", "Record internal visibility and candidate parent position."],
    exercise: "Find two potential triangle candidates on H4 or H1. Mark boundaries and five segments. For each, decide whether evidence supports a triangle or only ordinary consolidation, and state what remains unverified.",
    quiz: "A narrow range contains five alternating swings. Is it necessarily an Elliott triangle?",
    answer: "No. The five legs, corrective internals, boundaries, and permitted larger-wave position all need support.",
    gate: "Two range reviews; A-E labels and parent context assessed; consolidation accepted when evidence is insufficient.",
    prompt: "What evidence makes the triangle hypothesis more than a geometric resemblance?",
    deliverable: "Two triangle-or-consolidation assessments.",
    exampleFocus: "A-E geometry, corrective uncertainty, and parent position.",
    labTimeframe: "H4",
    checkMode: "triangle",
    measurement: "none",
    exampleKind: "correction"
  },
  {
    title: "Double and Triple Corrections",
    goal: "Recognize W-X-Y combinations without using complexity to explain every unclear chart.",
    learn: [
      "Complex corrections may connect corrective structures as W-X-Y or W-X-Y-X-Z.",
      "First test whether a simpler correction or separate market movements explain the evidence; added labels need independent structural support.",
      "The chart checker does not certify combination internals. 'Unclear' is preferable to indefinite relabeling."
    ],
    draw: ["Find two prolonged sideways/corrective passages.", "Write the simplest candidate first.", "Only add W/X/Y/Z when each segment has a reasoned role."],
    exercise: "Study two historical examples of prolonged sideways or corrective price action. Try a simple corrective count first; consider a complex count only if supported. For each, explain why an analyst should not label every confusing sequence a combination.",
    quiz: "A chart is difficult to count. Is that alone evidence for W-X-Y-X-Z?",
    answer: "No. Complexity is not a license to add labels; require structural evidence or keep the passage unclear.",
    gate: "Two cases reviewed; simple alternative considered first; unsupported complexity explicitly rejected.",
    prompt: "What observation supports each connecting X wave in your candidate?",
    deliverable: "Two complex-correction studies with simpler alternatives.",
    exampleFocus: "Simple-first analysis and justified W-X-Y notation.",
    labTimeframe: "H4",
    checkMode: "zigzag",
    measurement: "none",
    exampleKind: "complex"
  },
  {
    title: "Leading and Ending Diagonals",
    goal: "Recognize the diagonal exception without applying standard-impulse rules indiscriminately.",
    learn: [
      "Diagonals are motive structures with characteristic wave-1/wave-4 overlap and different internal/geometry expectations from standard impulses.",
      "Leading diagonals commonly occupy wave 1 or A; ending diagonals commonly occupy wave 5 or C. Position and internals matter.",
      "Diagonal conventions can differ in internal labeling; this course uses recognition only and does not certify or trade diagonal counts."
    ],
    draw: ["Study two potential diagonal structures.", "Mark parent position, overlap, geometry, and candidate subdivisions.", "Compare one possible ending diagonal with a standard impulse."],
    exercise: "Find two potential diagonal structures. Check location, geometry, and internal subdivisions. Compare a possible ending diagonal with a standard five-wave impulse and explain why wave-4 overlap has different implications.",
    quiz: "Wave 4 overlaps wave 1 in a proposed standard impulse. Does that prove it is a diagonal?",
    answer: "No. Overlap is only one feature; the appropriate parent position, five motive legs, geometry, and internal organization also need evidence.",
    gate: "Two candidates or shortage documented; comparison distinguishes exception from automatic rescue; recognition-only boundary stated.",
    prompt: "Which diagonal criterion is least supported by your chart evidence?",
    deliverable: "Two diagonal reviews and an impulse comparison.",
    exampleFocus: "Overlap interpreted in parent context rather than as an automatic diagonal.",
    labTimeframe: "H4",
    checkMode: "impulse",
    measurement: "none",
    exampleKind: "diagonal"
  },
  {
    title: "Multi-Timeframe Analysis",
    goal: "Assign a clear purpose to Daily, H4, and H1 while respecting synchronized as-of evidence.",
    learn: [
      "Use Daily for larger context, H4 for a main candidate count, and H1 for possible internal support; no timeframe alone defines wave degree.",
      "All panes must share an as-of cutoff. Do not let a later-completing Daily candle or future H1 data leak into the earlier decision.",
      "Contradiction is evidence to document, not noise to erase. M15 is optional and not required for this chart-only course."
    ],
    draw: ["Start with Daily context.", "Propose an H4 count and inspect H1 for support or conflict.", "Mark the same cutoff and completed/forming status on each pane."],
    exercise: "Analyze two situations where lower-timeframe structure appears to conflict with the higher-timeframe count. Explain the conflict and whether you keep, revise, or suspend the larger hypothesis. Optional H1 is for structural comparison only, not assumed execution.",
    quiz: "Can a completed later Daily high be used in an H1 analysis frozen before that Daily bar closed?",
    answer: "No. Use only evidence available at the common as-of cutoff; the later high is future information.",
    gate: "Two multi-timeframe conflict records have aligned cutoff, candle status, and a reasoned response.",
    prompt: "Did the lower timeframe support the parent, contradict it, or simply add noise?",
    deliverable: "Two synchronized multi-timeframe conflict studies.",
    exampleFocus: "Daily parent context, H4 candidate count, H1 support/conflict without lookahead.",
    labTimeframe: "Daily",
    checkMode: "swings",
    measurement: "none",
    exampleKind: "degree"
  },
  {
    title: "Build a Wave 2 Trading Setup",
    goal: "Specify a falsifiable wave-2 research scenario without equating an analysis with an order.",
    learn: [
      "A candidate needs a plausible wave 1, corrective wave 2, clear count invalidation, and evidence of possible trend resumption; a Fibonacci touch alone is insufficient.",
      "Record potential trigger, stop, target, and reward/risk as hypothetical price levels. OHLC does not establish bid/ask, a tradable open, spread, or fills.",
      "If instrument specifications and costs are unknown, mark monetary sizing and payoff unknown; no setup is an acceptable outcome."
    ],
    draw: ["For each of five candidates, record wave-1 start/end and wave-2 retracement.", "Write a hypothetical trigger, structural invalidation, and target.", "Mark which required evidence or specification is unavailable."],
    exercise: "Find five historical wave-2 candidates. Record wave-1 start/end, retracement, hypothetical trigger, stop, target, and whether written structural criteria pass. Do not claim a trade, executable fill, position size, or risk/reward in cash from the chart alone.",
    quiz: "A proposed wave 2 reaches a 61.8% retracement but has no confirmed resumption signal. Is that sufficient for an entry?",
    answer: "No. The ratio is not a signal; wait for the predeclared structural confirmation or record no setup.",
    gate: "Five candidate worksheets or documented shortages; hypothetical levels separate from observed candles; no asserted fills.",
    prompt: "Which independent evidence would you require beyond a retracement ratio?",
    deliverable: "Five hypothetical wave-2 research worksheets.",
    exampleFocus: "Wave-2 structure, invalidation, and explicitly hypothetical confirmation levels.",
    labTimeframe: "H1",
    checkMode: "zigzag",
    measurement: "retracement",
    exampleKind: "trade"
  },
  {
    title: "Build a Wave 3 Trading Setup",
    goal: "Compare early and confirmed wave-3 hypotheses using criteria frozen before reveal.",
    learn: [
      "A possible wave-3 scenario depends on a plausible wave 1, completed corrective wave 2, and independently defined evidence; it is not identifiable with certainty in advance.",
      "An early hypothesis may offer more theoretical distance but weaker confirmation; a later condition may reduce uncertainty while occurring at a less favorable price. Neither guarantees an outcome.",
      "Keep proposed entry levels hypothetical unless execution specifications and price basis are verified."
    ],
    draw: ["For five candidates mark wave-1 and wave-2 boundaries.", "Freeze one potential confirmation condition before revealing later candles.", "Compare early and later hypothetical price levels without recording fills."],
    exercise: "Find five potential wave-3 candidates. State the rule before observing the subsequent outcome. Compare an early post-wave-2 hypothesis with a later confirmed hypothesis and discuss the trade-off without asserting execution or profitability.",
    quiz: "Does waiting for an H1 close beyond a confirmed reaction pivot guarantee the move is wave 3?",
    answer: "No. It is a predefined price-action condition, not proof of Elliott structure or a guaranteed trade result.",
    gate: "Five candidates or shortage; criteria are timestamped before reveal; early/later comparison separates confirmation from certainty.",
    prompt: "What information did later confirmation add, and what uncertainty remained?",
    deliverable: "Five wave-3 candidate reviews and an early/later comparison.",
    exampleFocus: "Frozen trigger hypothesis and confirmation trade-offs on H1.",
    labTimeframe: "H1",
    checkMode: "impulse",
    measurement: "relationships",
    exampleKind: "trade"
  },
  {
    title: "Stop-Loss, Position Sizing, and Risk Management",
    goal: "Understand how a price-distance risk budget depends on verified contract and account specifications.",
    learn: [
      "A stop should follow a defined invalidation and market structure, not an arbitrary pip count. Express chart distance in USD/oz only if the source price basis supports that convention.",
      "For XAUUSDm, risk per lot = stop distance (USD/oz) × verified contract size (oz/lot) × verified account-currency conversion + modeled costs per lot. Size = risk budget / risk per lot.",
      "The OHLC dataset does not establish contract size, conversion, tick value, lot increment, costs, or executable price basis. Leave size uncalculated when any required specification is missing."
    ],
    draw: ["Prepare five hypothetical sizing forms with blank inputs; do not prefill example or assumed broker values.", "For each, enter account equity and currency, risk fraction, USD/oz stop distance, verified quote basis, verified contract size (oz/lot), verified account-currency conversion, cost per lot, tick size/value, lot step, and minimum size.", "Record the source and verification date for each instrument term; leave unknowns blank and size unavailable rather than assuming a default."],
    exercise: "Create five hypothetical worksheets using independently verified broker specifications where available; otherwise label size unavailable. Exercise: a $5,000 account risks 0.5%. Calculate the dollar budget. If stop distance doubles with all contract/conversion/cost assumptions otherwise constant, what happens to size?",
    quiz: "A $5,000 hypothetical account risks 0.5%. What is its risk budget, and how does size change if stop distance doubles under the same verified linear contract and costs are ignored?",
    answer: "Budget = $5,000 × 0.005 = $25. With a linear per-unit loss and no costs, doubling stop distance halves size for the same budget. This does not provide an XAUUSDm lot size without verified specifications.",
    gate: "Five worksheets or explicit missing-specification notes; quiz correct; no assumed ounces-per-lot, conversion, or fill.",
    prompt: "Which exact broker specification would change your monetary risk calculation?",
    deliverable: "Five hypothetical sizing worksheets and a specification checklist.",
    exampleFocus: "USD/oz risk formula with contract and conversion explicitly gated.",
    labTimeframe: "H1",
    checkMode: "swings",
    measurement: "none",
    exampleKind: "trade"
  },
  {
    title: "Create a Complete Trading Plan",
    goal: "Freeze a complete testable analysis plan, including no-trade conditions and unknown-data limits.",
    learn: [
      "Specify instrument, feed, timeframes, cutoff, count prerequisites, confirmation, invalidation, hypothetical stop/target, cost assumptions, and risk limits before reviewing outcomes.",
      "No-trade conditions include unclear count, rule violation, missing invalidation, inadequate hypothetical payoff, unknown costs, and missing contract or timezone information where relevant.",
      "This is a research hypothesis, not a proven profitable strategy. Do not use the roadmap as a directive to trade."
    ],
    draw: ["Create a one-page flow from Daily context through H4 count to optional H1 condition.", "Write entry hypothesis, stop, target, size formula, time eligibility, costs, and invalidation.", "List explicit conditions that force a no-trade/no-sizing conclusion."],
    exercise: "Write and freeze a complete plan before testing. Include all fields above and a version/date. If broker specifications or timestamps are unknown, mark monetary risk, session filters, and fills unavailable rather than inventing them.",
    quiz: "If your count is unclear or contract size is unknown, must your plan produce a position?",
    answer: "No. A valid plan can explicitly prohibit sizing or conclude no-trade/no-analysis until the missing evidence is supplied.",
    gate: "Plan is reproducible by another reviewer; unknowns and no-trade conditions explicit; version frozen before replay.",
    prompt: "Could another analyst follow your written criteria without guessing?",
    deliverable: "One frozen, complete research and risk plan.",
    exampleFocus: "Complete checklist with explicit no-trade and no-sizing paths.",
    labTimeframe: "H1",
    checkMode: "impulse",
    measurement: "none",
    exampleKind: "trade"
  },
  {
    title: "Historical Chart Replay",
    goal: "Preserve what was knowable at each cutoff and update counts without erasing the original.",
    learn: [
      "A completed chart makes a pattern appear easier than it was in real time. Hide later candles before forming a hypothesis.",
      "Record primary, alternative, invalidation, and expectation at each cutoff; reveal only subsequent candles and retain the original.",
      "An outcome does not make the original reasoning valid or invalid by itself. The data does not support claimed executions."
    ],
    draw: ["Set a cutoff before viewing the right-hand side.", "Freeze primary and alternative layers.", "Advance candles in small steps and log each revision."],
    exercise: "Complete at least ten historical replay examples. For each, record expectation, primary/alternate, invalidation, what happened after reveal, whether the original count remained structurally possible, and one learning point.",
    quiz: "After reveal, price moves in your predicted direction. Does that prove the count was valid or predictive?",
    answer: "No. A favorable outcome alone validates neither the structural count nor predictive performance; review the predeclared rules and evidence.",
    gate: "Ten replay logs completed or exact shortfall documented; originals preserved; no hindsight fill claims.",
    prompt: "What did you know at the cutoff that was not obvious after reveal?",
    deliverable: "Ten historical replay records.",
    exampleFocus: "Cutoff discipline, unchanged original record, and evidence-led revision.",
    labTimeframe: "H4",
    checkMode: "swings",
    measurement: "none",
    exampleKind: "replay"
  },
  {
    title: "Practice in Different Market Conditions",
    goal: "Apply one counting procedure to trending, sideways, and sharply reversing periods.",
    learn: [
      "Trends may show clearer directional swings; choppy ranges and sharp reversals can make degree and correction boundaries less clear.",
      "Describe regime from evidence available at the cutoff, not from the full-window outcome.",
      "Use the same structural criteria in all three regimes and record ambiguity rather than lowering the standard."
    ],
    draw: ["Select one trending segment, one sideways segment, and one sharp-reversal segment.", "Use the same pivot convention and labels.", "Mark the easiest and most ambiguous cases with reasons."],
    exercise: "Analyze one trending market, one sideways market, and one sharp reversal on XAUUSDm. Use the same counting rules. Identify which was easiest and most ambiguous and explain why.",
    quiz: "May you change the pivot rule only for the sideways sample so that it produces a cleaner count?",
    answer: "Not within the same comparison. Preserve the frozen rule; a changed rule requires a separate version and should be reported as such.",
    gate: "Three regimes reviewed under consistent criteria; easiest/most ambiguous justified.",
    prompt: "Which regime most tempted you to relax the evidence standard?",
    deliverable: "Three regime studies and a comparative note.",
    exampleFocus: "Consistent analysis through trend, range, and abrupt reversal.",
    labTimeframe: "H4",
    checkMode: "swings",
    measurement: "none",
    exampleKind: "replay"
  },
  {
    title: "Backtest Your Trading Rules",
    goal: "Separate structural chart review from performance testing that requires execution-quality inputs.",
    learn: [
      "A backtest needs frozen entry, stop, target, position-size, and cost rules plus enough data to model them. Visual plausibility alone is not an edge.",
      "At least 20 historical setups is a practice target only if time and valid data permit; count every candidate and preserve rule versions.",
      "MT5 OHLC alone does not establish bid/ask, fill sequence, contract terms, slippage, or commissions. If these are unavailable, make a structural audit, not a trade-performance claim."
    ],
    draw: ["Freeze one strategy version before any review.", "Prepare a ledger with date/time, instrument, timeframe, count, hypothetical/verified entry, stop, target, outcome, R, costs, and compliance.", "Mark each field as verified, modeled, or unavailable."],
    exercise: "If valid contract, timestamp, executable-price, and cost data are independently available, review at least 20 historical setups under frozen rules and log every ledger field. Otherwise complete a 20-candidate structural screening without invented fills, size, wins/losses, or R. Do not change rules mid-test; version any revision.",
    quiz: "If only candle OHLC is available and no verified spread or price basis exists, can you report a 20-trade realized expectancy?",
    answer: "No. You may report a structural candidate audit, but not realized trades or expectancy without defensible fills, contract and cost assumptions.",
    gate: "At least 20 eligible records when the required execution evidence exists; otherwise 20 structural screens or documented data shortage, with no fabricated performance statistics.",
    prompt: "Which missing input most limits a defensible performance claim?",
    deliverable: "A conditional 20-setup ledger or a clearly labeled structural-only screening.",
    exampleFocus: "Frozen methodology and explicit gate between OHLC study and backtest.",
    labTimeframe: "H4",
    checkMode: "impulse",
    measurement: "relationships",
    exampleKind: "audit"
  },
  {
    title: "Review Your Errors",
    goal: "Identify recurring process errors and make each prevention rule observable.",
    learn: [
      "Common errors include swing misidentification, invalid impulses, corrective misclassification, ignored invalidation, forced directional bias, unconfirmed triggers, unsupported sizing, and retrospective rule changes.",
      "Review original records, not memory. Separate analysis error from an eventual price outcome.",
      "A useful preventive rule says what evidence must be checked and what action follows a failure."
    ],
    draw: ["Review the complete journal and exported records.", "Tag each error by category and retain evidence.", "Write one observable prevention rule for each of the three most common errors."],
    exercise: "Review all journal entries. Classify mistakes across the eight roadmap categories. Identify your three most common and write one preventive rule for each; for example, verify wave 1, wave 2, and relevant internals before labeling a strong move wave 3.",
    quiz: "You notice you label every strong rally as wave 3. Give a preventive rule that can be checked before assigning the label.",
    answer: "Before labeling wave 3, record a plausible wave 1 and corrective wave 2, test the wave-2 origin, and assess required internal structure; if the evidence is missing, leave it provisional or unclear.",
    gate: "All journal entries reviewed; top three errors ranked; each has an observable preventive rule.",
    prompt: "Which error repeated despite your existing checklist, and what must change?",
    deliverable: "Ranked error audit and three preventive rules.",
    exampleFocus: "Evidence-based process audit rather than outcome-driven self-assessment.",
    labTimeframe: "H4",
    checkMode: "swings",
    measurement: "none",
    exampleKind: "audit"
  },
  {
    title: "Final Elliott Wave Examination",
    goal: "Produce an independent multi-timeframe analysis with a defensible conclusion and clear limits.",
    learn: [
      "Work a new historical chart without prior notes; freeze the as-of timestamp before interpretation.",
      "Complete higher-timeframe context, H4 count, rule checks, alternative, measurement, and review. An optional hypothesis is not a required trade.",
      "No trade/no-size is the correct result when count, execution basis, contract specifications, or costs are insufficient."
    ],
    draw: ["Create a clean annotated chart and preserve the original cutoff.", "Show Daily context, H4 structure, and optional H1 details without future-bar leakage.", "Add rule audit, alternate, measurements, and explicit invalidations."],
    exercise: "On a new historical interval without previous notes: (1) identify Daily trend/structure, (2) propose an H4 count, (3) validate applicable rules, (4) add a plausible alternate if evidence permits, (5) measure relevant retracements/extensions, (6) provide an optional hypothetical plan only if specifications permit—or state NO TRADE/NO SIZE, and (7) reveal later bars and review without rewriting. Deliver one complete analysis, annotated chart, and written plan or explicit no-trade decision.",
    quiz: "A count is plausible but XAUUSDm contract size, execution basis, and costs are unverified. What belongs in the final plan?",
    answer: "Give the structural analysis and its invalidation, but state NO TRADE/NO SIZE for monetary planning; do not invent a position size or fill. Later price movement does not retroactively prove the count.",
    gate: "All seven examination tasks addressed; complete annotated packet exported; unknown execution inputs explicitly block monetary claims.",
    prompt: "Which claims in your packet are observations, hypotheses, or unknowable from this dataset?",
    deliverable: "One complete Elliott Wave analysis, annotated chart, and written plan or explicit no-trade/no-size decision.",
    exampleFocus: "Independent capstone with synchronized panes, measurements, alternatives, and evidence boundaries.",
    labTimeframe: "H4",
    checkMode: "impulse",
    measurement: "relationships",
    exampleKind: "exam"
  }
];

export const lessons = lessonData.map((lesson, index) => {
  const day = index + 1;
  const stage = stages[Math.floor(index / 5)];
  const timeframe = lesson.labTimeframe;
  return {
    ...lesson,
    day,
    stage: stage.title,
    stageId: stage.id,
    window: windows[index],
    timeframe
  };
});
