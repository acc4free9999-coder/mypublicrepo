# Elliott Wave: 30-day XAUUSDm practice course

Open [index.html](./index.html) in a modern browser for the **new PDF-based roadmap**: six stages and thirty interactive unit pages. Every unit has an attributed PDF chart excerpt with original bilingual teaching, two endpoint questions directly on the image, six multiple-choice questions with scoring/explanations, four written/drawing tasks and an independent real XAUUSDm lab. No account, installation, or internet connection is needed. The [legacy HTML index](./legacy-index.html) retains access to the earlier chart-lab course and its existing browser workbook.

**Purpose:** learn to describe, draw, invalidate, and test Elliott Wave hypotheses. Thirty days is a foundation, not a promise of professional competence or profit. Elliott Wave is interpretive; a valid count is not evidence of a trading edge. This data supports chart-structure study, not verified trade fills or a performance backtest.

## New PDF-based design / Thiết kế lại theo PDF

Start with the redesigned [Roadmap.md](./Roadmap.md), based on the supplied 105-page [Steve Sinclair PDF](./data/Elliott-waves-made-simple-mast-steve-sinclair.pdf). It maps all 30 units to actual PDF pages, adds source-reading questions and original practice exercises, and explicitly flags simplified rules and unsupported trading assumptions in the source.

Read the [full roadmap in HTML](./roadmap.html), the [daily-unit specification in HTML](./unit-structure.html), and [interactive unit 01](./units/unit-01.html) directly in the browser. [Unit 04](./units/unit-04.html) also links to the [extended sample reading](./units/unit-04-reading.html), with four bilingual principles, two original synthetic SVGs, a real candle chart and ten additional written questions. Editable reading sources are [Roadmap.md](./Roadmap.md), [Unit-structure.md](./Unit-structure.md) and [unit-04.md](./units/unit-04.md).

**Version boundary:** all thirty new units now have topic-specific quizzes and drawing assignments on real candles. Their reading is the roadmap's concise teaching plus linked PDF pages; only unit 04 has the long-form extended reading, so this is not a claim that all thirty full-length bilingual textbook chapters exist. The legacy HTML course below retains its previous topic order and browser storage. Never remap saved records by day number.

### Interactive practice and saving

- Open “Học & thực hành” on the unit card, not only the expandable outline.
- Read the source chart in “Hình PDF + câu hỏi trên chart”. Click the requested price endpoint (not its label) or enter normalized X/Y coordinates, then check to reveal the target region and reasoning. Each question has an independent point; changing a point clears stale feedback. These 60 tasks check annotated image-region recognition, not a unique Elliott count or live prediction.
- Select one answer per multiple-choice question, then **Chấm trắc nghiệm / Grade**. Each question shows the correct option and reasoning, including unanswered items. Changing an answer clears the stale grade.
- Draw directly on the chart or use the accessible candle selector. Endpoints snap to real wick highs/lows. Reveal candles incrementally, undo points, compare synchronized timeframes and measure selected anchors.
- The starter window is not guaranteed to contain the required pattern or the full assignment quota. An honest no-count/search log is allowed. Diagonals, combinations and running/expanding triangles use observational swing mode. Triangle mode screens labels/order and observed legs, not boundary geometry, variants or internals; no mode certifies an Elliott count.
- Unit 22 adds a real RSI(14) Wilder panel using close prices and 200 prior bars for warm-up. It only shows values through the current replay cursor; its drawn SVG includes both panels and its review JSON includes settings/warm-up closes for reproduction. Unit 24 includes a sizing worksheet with no prefilled broker specifications.
- **Lưu trả lời** or **Lưu nhật ký** saves quiz selections, written responses and journal. Drawings/cursor save on each change. Export review JSON captures the current answers and exact visible candle data; send it and the drawn SVG in chat for detailed correction. No upload is automatic.
- New PDF-course work uses schema 3, dataset `xauusd-pdf-v1`, and storage key `elliott-field-school-pdf-v1`. Source identities include curriculum and unit number. New and old backups cannot be imported across curricula; existing old records remain untouched.
- Browser storage failures are explicit; export before leaving if saving fails. File-URL storage varies by browser/origin. Use the same browser and path, and keep exported backups.
- Quiz score is only a checkpoint (5/6). The four drawing/written tasks require the rubric and manual review; completion is self-recorded, never automatically certified by the quiz.

The HTML now uses **19 selected chart/diagram excerpts from the supplied PDF**, reused across 30 units with page/Image attribution, original commentary and 60 original spatial questions. Complete chapters/book text are not republished. These source excerpts retain their author's rights; keep attribution and do not treat them as course-owned artwork or assume permission to redistribute. The original synthetic sketches and local MT5 candle labs remain clearly separate from the book examples. Source labels and projections are not blind exam answers or evidence of fills/profit.

Source-image points use optional answer slots 11–12; existing answers 1–10, window identities, workbook schema and storage keys remain unchanged. Save responses to persist them; review JSON also carries the PDF/asset SHA-256, page/Image/crop, exact question, normalized target and selected point. Review/check results are reconstructed rather than treated as a certification.

### Rebuilding source excerpts

The selected regions are defined in [source-figures.json](./teaching/source-figures.json); their bilingual lessons and questions are in [pdf-source-lessons.mjs](./teaching/pdf-source-lessons.mjs). Recreate PNGs locally on macOS with PDFKit/AppKit (no uploads or third-party dependencies):

```sh
swift scripts/crop-pdf-charts.swift
node scripts/build-roadmap.mjs
node --test tests/pdf-curriculum.test.mjs tests/pdf-runtime.test.cjs
```

The crop manifest uses a 660×854 top-left reference coordinate system; export renders at approximately 3× resolution. [provenance.json](./units/source-figures/provenance.json) records source and image hashes, page numbers, crop bounds and actual pixel dimensions. The builder rejects a changed PDF or crop asset; rerun extraction after changing crop bounds. Browser use does not require Swift. Page numbers count the PDF cover; a missing `#page=` jump can be entered manually.

The earlier all-unit bilingual HTML expansion is incomplete: its three teaching-content modules are absent, so the legacy HTML builder cannot currently resolve those imports. Existing generated legacy HTML can still be opened. The new roadmap builder and focused curriculum checks below are independent of that unfinished build.

## Existing HTML course: study routine

For the redesigned course, allow 90-120 minutes per unit or split it into sessions, following the new specification. The older HTML course uses the routine below. Repeat days you do not pass; do not accelerate by skipping corrections or risk lessons.

1. Read the day's lesson and original schematic.
2. Do the closed-book exercise before opening the answer key.
3. Mark the embedded historical chart, advancing one completed candle at a time.
4. Work on the assigned XAUUSDm candle chart and timeframe. Preserve the source timestamps; the server timezone and executable price basis are not verified.
5. Save a dated screenshot before revealing later bars. Record an alternate count or a defensible no-count.
6. Save the journal and export a backup. Mark the day complete only after meeting its pass gate.

Every day has its own HTML page in [days/](./days/). Use **Print / save PDF** for a daily handout. Keep the entire folder together when copying the course: daily pages share local assets. The individual pages are not self-contained attachments.

## Existing HTML course: six stages

| Days | Focus | Deliverable |
|---|---|---|
| 1-5 | Elliott cycle, swings, impulse rules, corrections | Two directional impulse studies, three impulse audits, five correction comparisons, three possible ABC studies |
| 6-10 | Invalidation, degree, classification, internals, alternatives | Five invalidation audits, one Daily/H4/H1 packet, ten classifications, two subdivision studies, three primary/alternate chart pairs |
| 11-15 | Retracements, extensions, wave relationships, confluence | Five retracement pairs, five projections, five relationship studies, three confluence zones, ten-case measurement exam |
| 16-20 | Zigzags, flats, triangles, combinations, diagonals | Three zigzags, three flats, two triangle/range reviews, two complex-correction studies, two diagonal studies |
| 21-25 | Multi-timeframe analysis and testable planning | Two conflict reviews, five wave-2 and five wave-3 candidates, five sizing worksheets, one frozen plan |
| 26-30 | Replay, regimes, conditional backtest, error review, examination | At least ten replay records, three regimes, 20-setup conditional ledger or structural screen, three prevention rules, capstone |

These stages describe the older generated HTML, not the newly redesigned [Roadmap.md](./Roadmap.md). The new document deliberately reorders topics and adds dedicated extension, diagonal, RSI and wave-C units. Practice quotas never justify inventing examples: use wider MT5 history or document the shortage.

## Gold OHLC data, honestly labeled

The chart uses actual XAUUSDm MT5 OHLC candles from `data/Mt5Data`, covering January 2021 through September 2026. Lessons retain their 2023-2024 study windows. Each day has a generated `windowsByDay` context with up to 96 consecutive candles selected inside that lesson's window (initial view 48). A source-hash-based window identity makes the selected data context reproducible. The synchronized Daily/H4/H1 panes use a lesson focus: H4 by default, Daily for days 7 and 21, and optional H1 execution-analysis focus for days 22-25. All panes are aligned to a common as-of point and show completed candles only, using nominal candle closes; no later-completing higher-timeframe candle may leak future information.

Each unit includes two distinct examples: a confirmed retrospective P-pivot view, and a hindsight-selected candidate. The candidate is the first consecutive-pivot sequence passing the available limited endpoint checks where possible, otherwise the first rejected or incomplete candidate. It is for teaching only: not certified lower-degree structure, predictive or performance evidence, or a trading signal. Examples do not overwrite the separate practice exercise; draw and test your own count there.

The checker provides immediate objective-rule checks in swings, impulse, zigzag, flat, and triangle modes, counting actual intervening candle wicks as well as selected endpoints, with explicit limits. Passing a check does not certify a count, confirm its subdivisions, or demonstrate a trading edge. Use the replay cursor to hide later candles; the chart context shows the data used for the exercise. Preserve the original hypothesis before revealing more bars. Screenshots and interpretation remain your responsibility.

MT5 server timezone, contract size, tick value, account conversion, costs, and executable price basis have not been established. Do not infer UTC, $10 per pip, ounces per lot, or fills from the symbol name or candles. Describe gold moves as USD-per-ounce price distances. Before any hypothetical position-sizing calculation, verify the broker's actual contract size and account-currency conversion: risk per lot = distance × verified contract size × verified conversion + modeled costs. If specifications or price basis are unavailable, keep the exercise structure-only and make no fill or performance claim.

The course does not submit orders. Candle OHLC alone does not prove a fill price or the ordering of prices within a bar.

## Saving your work

- Progress, journal text, labels and replay positions are saved locally in this browser when storage is available; storage errors are shown.
- File-URL storage behavior varies by browser. A stable local HTTP origin is more reliable; changing port, browser, or folder can change access to saved work.
- **Export workbook** saves a schema-3 JSON backup containing currently saved course records. Roadmap progress is isolated under `elliott-field-school-roadmap-v3` with dataset identity `xauusd-roadmap-v3`. The earlier EURUSD and gold workbooks remain preserved and are not imported into the new course. Use **Export previous** only when you need a backup of the previous gold course data; the new course does not migrate old schema-2 records.
- **Export review JSON** and **Export SVG** provide review copies of chart work. Review JSON includes exact OHLC values for visible bars and source-hash window identity for reproducibility. JSON and SVG exports are files; the app does not send them anywhere.
- Export automatically saves the current page's journal into the workbook before downloading. If browser storage fails, the download still contains the in-memory records; the page displays a warning.
- No analytics, cloud upload, account connection, or live orders.
- Browser data can be cleared. Export at the end of every session. Do not enter account passwords or other secrets in the journal.

**Review:** on-screen checks are instant, local rule checks only. For a human/chat review, attach the exported review JSON (and relevant SVG or screenshots) to your message, or provide a shared page. Do not expect the app to send work or invoke an embedded AI.

## Sources and limitations

- Source files: supplied MT5 XAUUSDm Daily/H4/H1 data in [data/Mt5Data/](./data/Mt5Data/), January 2021-September 2026. The course uses the source OHLC values; it does not claim independent price verification or broker execution metadata.
- [Elliott Wave International: impulse reference](https://www.elliottwave.com/waveopedia/impulse/)
- [Elliott Wave International: corrective pattern reference](https://www.elliottwave.com/waveopedia/corrective-waves/)
- [CFTC: learn and protect](https://www.cftc.gov/LearnAndProtect/index.htm)

Lessons, diagrams, exercises, and assessment wording are original. Linked theory references explain the taxonomy; their promotional forecasting claims are not evidence that the method is profitable.

## Rebuild and validate (optional)

Requires Node.js 18+; no packages.

For the PDF-based design and sample:

```sh
node scripts/build-unit-sample.mjs
node scripts/build-roadmap.mjs
node --test tests/pdf-curriculum.test.mjs tests/pdf-runtime.test.cjs
```

The roadmap builder reads the Markdown sources and quiz modules under [teaching/](./teaching/), generating the index, roadmap, specification, 30 interactive unit pages, extended sample reading, concept SVGs and the independent PDF-course candle bundle. On its first run it preserves the old homepage as [legacy-index.html](./legacy-index.html); subsequent runs leave that backup untouched. It never modifies MT5 data, legacy daily lessons or browser records. The sample-only builder writes just the three sample SVGs.

For the earlier full HTML expansion, once its missing teaching modules have been completed:

```sh
node scripts/build.mjs
node --test tests/course.test.mjs
```

The older HTML source [course.mjs](./course.mjs) exports six stages and 30 sequenced lessons. Its unfinished bilingual expansion expects content under [teaching/](./teaching/), rendered by [scripts/teaching-html.mjs](./scripts/teaching-html.mjs). That builder now targets the legacy index rather than overwriting the new homepage; its daily lessons have not been synchronized with the PDF redesign. The browser does not need Node.js to open generated pages.

## Risk boundary

This is general education, not personalized financial advice, a signal service, or a recommendation to trade leveraged products. Gold CFDs and other leveraged products can lose money rapidly; protections, leverage limits, and legal availability vary by jurisdiction. OHLC examples omit executable spread, slippage, financing, and liquidity. Verify contract terms and providers with your local regulator. Passing the course never automatically authorizes live trading.
