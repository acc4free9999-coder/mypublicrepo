# Gony Trendline Visual Research Engine

A modular, transparent MT5 Expert Advisor for research-based visual trendline identification. Built with explicit rule definitions, real-time visual feedback, and no hidden decisions.

**Current Status**: Phase 1 — Swing Detection ✓

---

## Overview

This research engine breaks trendline analysis into distinct, debuggable phases:

1. **Phase 1 — Swing Detection** ✓ (Current)
   - Detect swing highs and lows with configurable rules
   - Classify pivots as MAJOR, MINOR, or NOISE
   - Display every pivot with classification reason
   - Validate detection logic before proceeding

2. **Phase 2 — Trendline Candidates** (Coming Next)
   - Generate multiple candidate lines from eligible pivots
   - Display candidate lines extending forward
   - Distinguish bullish and bearish structures
   - Avoid forcing lines in unclear conditions

3. **Phase 3 — Candidate Scoring** (Future)
   - Implement configurable scoring system
   - Score by swing importance, trend, anchor quality, slope, interactions
   - Display reasons for rejection
   - Rank candidates transparently

4. **Phase 4 — Visual Debugging** (Future)
   - Interactive toggles for each visualization layer
   - Display all rejected candidates and reasons
   - Anchor point inspection
   - Current detection state dashboard

5. **Phase 5 — Historical Replay** (Future)
   - Support Strategy Tester backtest visualization
   - Process bars chronologically without future-looking
   - Log all candidates and decisions to CSV
   - Replay research against manually annotated examples

6. **Phase 6 — Feedback & Refinement** (Future)
   - Compare EA selection vs. manual annotations
   - Understand divergence patterns
   - Non-automatic strategy improvement

---

## Quick Start

### Prerequisites
- MetaTrader 5 (build 2000+)
- Text editor or MetaEditor (included with MT5)
- 15 minutes

### Setup

1. **Place the EA file**:
   ```
   Copy GonyTrendLineEAVisual.mq5 to:
   C:\Users\<YourUsername>\AppData\Roaming\MetaQuotes\Terminal\<TerminalID>\MQL5\Experts\
   ```

2. **Compile**:
   - Open MetaEditor (Tools → MetaEditor or F11)
   - File → Open → `GonyTrendLineEAVisual.mq5`
   - Press F5 to compile
   - Expected: "0 errors, 0 warnings"

3. **Run Strategy Tester**:
   - View → Strategy Tester (Ctrl+R)
   - Select Expert Advisor: `GonyTrendLineEAVisual`
   - Choose Symbol: `EURUSD` (or preferred pair)
   - Timeframe: `H1` (1-hour)
   - Date Range: Last 1-2 weeks
   - Click **Start**

4. **Observe**:
   - Green downward arrows = Major swing highs
   - Red upward arrows = Major swing lows
   - Light green/coral = Minor swings
   - Debug panel (top-left) shows detection state

For detailed setup, see [QUICK_START.md](./QUICK_START.md).

---

## Documentation

### For Users
- **[QUICK_START.md](./QUICK_START.md)** — 5-minute setup and first test
- **[PHASE_1_DOCUMENTATION.md](./PHASE_1_DOCUMENTATION.md)** — Complete Phase 1 reference
  - Configuration parameters explained
  - Testing methodology
  - Tuning guide for different market conditions
  - Troubleshooting

### For Developers
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Technical deep dive
  - System design and module breakdown
  - Function-by-function reference
  - Data structures and execution flow
  - Performance characteristics
  - Extension points for future phases
- **[CODE.md](./CODE.md)** — Implementation notes (if created)

---

## Key Features

### Phase 1: Swing Detection ✓

#### Transparent Rules
- **High Pivot**: Bar is higher than all bars in left and right windows
- **Low Pivot**: Bar is lower than all bars in left and right windows
- **Deviation Check**: Minimum price movement required for detection
- **Classification**: MAJOR (high deviation), MINOR (medium), NOISE (low)

**All rules are configurable via input parameters.**

#### Visual Feedback
- Real-time marker arrows on detected pivots
- Color-coded by type (major/minor) and direction (high/low)
- Labels show pivot index and classification reason
- Debug panel displays detection state

#### No Hidden Decisions
- Every pivot includes reason for classification
- Deviation percentage shown for transparency
- Configuration changes apply instantly
- All parameters logged at startup

#### Configurable Sensitivity
Adjust detection via inputs:
- `PivotLeftBars`, `PivotRightBars` — Window size
- `PivotMinDeviation` — Minimum move threshold
- `HigherHighThreshold`, `LowerLowThreshold` — Major/minor boundary

#### No Repainting
- Checks prevent duplicate detection at same bar
- Processes each new bar exactly once
- Guards against lookahead

---

## Configuration Quick Reference

### Detection Sensitivity
| Parameter | Default | Range | Effect |
|-----------|---------|-------|--------|
| `PivotLeftBars` | 3 | 1-10 | Bars left of pivot to scan |
| `PivotRightBars` | 3 | 1-10 | Bars right of pivot to scan |
| `PivotMinDeviation` | 0.0001 | 0.00001-0.01 | Min move % for detection |
| `HigherHighThreshold` | 2.0 | 1.0-10.0 | Multiplier for MAJOR high |
| `LowerLowThreshold` | 2.0 | 1.0-10.0 | Multiplier for MAJOR low |

### Display Options
| Parameter | Default | Description |
|-----------|---------|-------------|
| `ShowMajorPivots` | true | Display major swing points |
| `ShowMinorPivots` | true | Display minor swing points |
| `ShowNoisePivots` | false | Display low-deviation points |
| `ShowPivotLabels` | true | Label each pivot |
| `ShowPivotReason` | true | Show classification reason |
| `ShowDebugInfo` | true | Display status panel |

### Colors & Sizes
- `ColorMajorHigh`, `ColorMajorLow`, `ColorMinorHigh`, `ColorMinorLow`, `ColorNoise`
- `PivotMarkerSize`, `LabelFontSize`, `DebugFontSize`

See [PHASE_1_DOCUMENTATION.md](./PHASE_1_DOCUMENTATION.md) for detailed parameter guide.

---

## Usage Examples

### Scenario 1: "My chart has too many pivots"
1. Increase `PivotMinDeviation` (e.g., 0.0001 → 0.0005)
2. Increase `PivotLeftBars` and `PivotRightBars` (e.g., 3 → 5)
3. Restart test → fewer, higher-quality pivots

### Scenario 2: "I'm missing obvious swing points"
1. Decrease `PivotMinDeviation` (e.g., 0.0001 → 0.00005)
2. Decrease `PivotLeftBars` and `PivotRightBars` (e.g., 3 → 2)
3. Restart test → more sensitive detection

### Scenario 3: "Major and minor balance is off"
1. Increase `HigherHighThreshold` and `LowerLowThreshold` (e.g., 2.0 → 3.0)
2. This raises the bar for MAJOR classification
3. More pivots will be classified as MINOR

### Scenario 4: "I want to see all pivots, even noise"
1. Set `ShowNoisePivots = true`
2. Set `ShowMinorPivots = true`
3. Set `ShowMajorPivots = true`
4. Adjust `PivotMinDeviation` down to catch tiny moves

---

## Technical Details

### No Real-Money Execution
- This is a **research EA** — no trading, no order execution
- Safe to run on live accounts (no positions opened)
- Designed for backtesting and visual inspection

### Efficient Chart Management
- Dynamic array for pivots (grows by 100 when needed)
- Unique object naming prevents conflicts
- Redraw optimized to only process visible pivots
- No continuous polling — event-driven updates

### Robust Error Handling
- MQL5 strict type checking (`#property strict`)
- Array bounds protection
- Guard clauses prevent invalid bar access
- Graceful degradation on chart zoom/scroll

---

## File Structure

```
GonyTrendLineEA/
├── GonyTrendLineEAVisual.mq5           ← Main EA source code
├── README.md                           ← This file
├── QUICK_START.md                      ← 5-minute setup guide
├── PHASE_1_DOCUMENTATION.md            ← Full Phase 1 reference
├── ARCHITECTURE.md                     ← Technical deep dive
└── (Future phases will add new files)
```

---

## Validation Checklist

Before declaring Phase 1 complete, verify:

- [ ] EA compiles without errors (F5 in MetaEditor)
- [ ] Pivots display on chart in Strategy Tester
- [ ] Green downward arrows appear only at swing highs
- [ ] Red upward arrows appear only at swing lows
- [ ] Major and minor classifications are reasonable
- [ ] Debug panel shows correct pivot counts
- [ ] Toggling `ShowMajorPivots` immediately affects display
- [ ] Increasing `PivotMinDeviation` reduces pivot count
- [ ] Decreasing `PivotLeftBars` increases pivot detection
- [ ] No pivots appear in flat/sideways markets (expected behavior)
- [ ] Labels show classification reason (if enabled)
- [ ] Code contains no lookahead (all data is confirmed at detection)

---

## Next Steps

### After Phase 1 Validation
Once pivots look correct, Phase 2 will:
1. Generate trendline candidates from eligible swing points
2. Display candidate lines extending forward
3. Distinguish bullish vs. bearish structures
4. Avoid forcing lines when structure is unclear

### To Request Phase 2
Provide feedback:
- Do pivot detections look correct on your preferred chart/timeframe?
- Are there false positives (noise) or false negatives (missed pivots)?
- What parameter tuning worked best?
- Ready to proceed to trendline candidates?

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| **No pivots appear** | Display setting off or detection too sensitive | Enable `ShowMajorPivots`; decrease `PivotMinDeviation` |
| **Too many pivots** | Settings too sensitive | Increase `PivotMinDeviation` or `PivotLeftBars` |
| **Compilation error** | MQL4 file or syntax issue | Ensure file is MQL5; recompile with F5 |
| **Pivots change after bar closes** | Lookahead bug | Should never happen; report with chart/settings |
| **Chart objects don't clear** | MT5 chart refresh needed | Zoom or scroll chart to force refresh |
| **Debug panel not showing** | Display disabled | Set `ShowDebugInfo = true` |

For more help, see [PHASE_1_DOCUMENTATION.md — Troubleshooting](./PHASE_1_DOCUMENTATION.md#troubleshooting).

---

## Design Philosophy

### Transparency Over Automation
- Rules are explicit, not learned
- Every decision is visible and explainable
- No machine learning or black boxes
- Researcher remains in control

### Visual Inspection First
- Humans can quickly spot issues on chart
- Numerical metrics come later
- Display is the primary debugging tool
- Research happens visually before coding

### Configuration Over Hardcoding
- All thresholds are `input` parameters
- Change settings without recompiling
- Test multiple configurations in rapid succession
- Find the right tuning for each market

### No Assumptions
- Rules define what a "trendline" is
- Researcher chooses the definition
- System implements it faithfully
- Results are reproducible

---

## License & Attribution

**Author**: Gony Trendline Research Project  
**Version**: 1.0.0 (Phase 1)  
**Status**: Development / Research Use Only  
**Repository**: acc4free9999-coder/mypublicrepo/EA/GonyTrendLineEA  

---

## Support

For questions, issues, or feedback:
1. Check [QUICK_START.md](./QUICK_START.md) for immediate help
2. Review [PHASE_1_DOCUMENTATION.md](./PHASE_1_DOCUMENTATION.md) for detailed reference
3. Consult [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
4. Report bugs with: chart screenshot, settings used, expected vs. actual behavior

---

**Ready to test Phase 1?** See [QUICK_START.md](./QUICK_START.md).

**Want the full reference?** See [PHASE_1_DOCUMENTATION.md](./PHASE_1_DOCUMENTATION.md).

**Need technical details?** See [ARCHITECTURE.md](./ARCHITECTURE.md).
