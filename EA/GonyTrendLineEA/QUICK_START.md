> Historical document: use the current visual test in [README.md](./README.md).
> Claims of successful compilation and testing below were not verified.

# Quick Start: Swing Detection Testing

## In 5 Minutes

### Step 1: Compile
1. Open MetaTrader 5
2. Tools → MetaEditor (or F11)
3. File → Open → `GonyTrendLineEAVisual.mq5`
4. Press F5 to compile
   - **Expected**: No errors, possibly a "0 warnings" message

### Step 2: Load Strategy Tester
1. View → Strategy Tester (or Ctrl+R)
2. Select:
   - **Expert Advisor**: `GonyTrendLineEAVisual`
   - **Symbol**: `EURUSD` (or preferred pair)
   - **Period**: `H1` (1-hour)
   - **Date Range**: Last 1-2 weeks
3. Leave Model as "Open prices only"

### Step 3: Adjust One Parameter
In the **Inputs** tab:
- Try different `PivotLeftBars`: 2, 3, or 5
- Watch how detection changes

### Step 4: Run & Observe
1. Click **Start**
2. Watch the chart:
   - Green downward arrows = Major swing highs
   - Red upward arrows = Major swing lows
   - Light colors = Minor swings

### Step 5: Check Debug Info
- Top-left corner shows:
  - Total pivots detected
  - Major / Minor / Noise counts
  - Current detection state

---

## What You Should See

### Good Results ✓
- Arrows only at obvious turning points
- Major and minor pivots are distinct
- No arrows in flat markets
- Reasonable spacing (not every bar)

### Problems ✗
- **Too many arrows?** Increase `PivotMinDeviation` or `PivotLeftBars`
- **Too few arrows?** Decrease `PivotMinDeviation` or `PivotRightBars`
- **Can't see colors?** Toggle `ShowMajorPivots` or `ShowMinorPivots` to refresh

---

## Key Parameters to Experiment With

| Parameter | Effect | Try |
|-----------|--------|-----|
| `PivotLeftBars` | Window size left of potential pivot | 2, 3, 5, 7 |
| `PivotRightBars` | Window size right of potential pivot | 2, 3, 5, 7 |
| `PivotMinDeviation` | Minimum move size for detection | 0.00005, 0.0001, 0.0005 |
| `HigherHighThreshold` | Multiple of MinDeviation for MAJOR | 1.5, 2.0, 3.0 |

---

## Troubleshooting Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| No arrows appear | Toggle `ShowMajorPivots` to `true` and restart |
| Too sensitive (many arrows) | Increase `PivotMinDeviation` and restart |
| Too insensitive (few arrows) | Decrease `PivotMinDeviation` and restart |
| Colors look wrong | Check `ColorMajorHigh`, `ColorMajorLow` settings |
| Compilation error | Ensure file is MQL5 (not MQL4) and compile fresh with F5 |

---

## Next Phase
Once pivots look good, we'll add:
- **Phase 2**: Trendline candidate generation
- **Phase 3**: Candidate scoring system
- **Phase 4**: Enhanced visual debugging
- **Phase 5**: Historical replay and backtesting

---

**Ready?** Compile → Run → Observe → Adjust → Repeat
