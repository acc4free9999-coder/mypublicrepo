> Historical document: superseded by [README.md](./README.md). Claims of
> successful compilation, testing, and Phase 1 correctness were not verified.

# Gony Trendline Visual Research Engine — Phase 1: Swing Detection

## Overview

Phase 1 implements a **modular, transparent swing detection system** for MT5. Every pivot is detected according to explicitly defined rules, visually displayed with detailed classification, and logged with reasons.

**No trendlines are drawn yet.** This phase is purely about understanding where the pivot points are and validating the detection logic.

---

## Architecture

### Core Components

#### 1. **Pivot Detection Engine** (`DetectPivots()` and helpers)
- Scans all historical bars for swing highs and swing lows
- Uses configurable left/right bar windows to identify local extremes
- Never repaints historical pivots (checked on every bar)
- Processes one new bar per tick

#### 2. **Classification System** (`CheckHighPivot()`, `CheckLowPivot()`)
- **Swing High**: Bar is higher than all bars in left and right windows
- **Swing Low**: Bar is lower than all bars in left and right windows
- **Deviation Threshold**: Minimum price deviation from adjacent extremes (configurable)
- **Major vs. Minor**: Classified by deviation magnitude

#### 3. **Visual Layer** (`RedrawAllVisuals()`, drawing functions)
- Draws arrow markers at each detected pivot
- Color-coded: green/red for major, light green/coral for minor, gray for noise
- Optional labels showing classification reason
- Real-time debug panel showing detection state

#### 4. **Data Structure** (`Pivot` struct)
Each pivot stores:
- Bar index and time
- Price level
- Direction (HIGH/LOW)
- Type (MAJOR/MINOR/NOISE)
- Deviation percentage
- Classification reason (for debugging)
- Sequential index

---

## Configuration Parameters

### Detection Sensitivity

| Parameter | Default | Description |
|-----------|---------|-------------|
| `PivotLeftBars` | 3 | Bars to the left to scan for local extremes |
| `PivotRightBars` | 3 | Bars to the right to scan for local extremes |
| `PivotMinDeviation` | 0.0001 | Minimum deviation (as %) for a pivot to be detected |
| `HigherHighThreshold` | 2.0 | Multiple of `PivotMinDeviation` to classify as MAJOR high |
| `LowerLowThreshold` | 2.0 | Multiple of `PivotMinDeviation` to classify as MAJOR low |

**Example**:
- If `PivotMinDeviation = 0.0001` and `HigherHighThreshold = 2.0`
- A swing high with ≥0.0002 deviation is classified as MAJOR
- A swing high with 0.0001-0.0001999 is classified as MINOR

### Display Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `ShowMajorPivots` | true | Display major swing points |
| `ShowMinorPivots` | true | Display minor swing points |
| `ShowNoisePivots` | false | Display potential noise (enable for analysis) |
| `ShowPivotLabels` | true | Label each pivot with index |
| `ShowPivotReason` | true | Show reason for classification |
| `ShowDebugInfo` | true | Display detection state panel |

### Visual Customization

| Parameter | Default | Description |
|-----------|---------|-------------|
| `ColorMajorHigh` | Lime Green | Marker color for major swing high |
| `ColorMajorLow` | Red | Marker color for major swing low |
| `ColorMinorHigh` | Light Green | Marker color for minor swing high |
| `ColorMinorLow` | Light Coral | Marker color for minor swing low |
| `ColorNoise` | Gray | Marker color for noise |
| `PivotMarkerSize` | 5 | Marker size in pixels |
| `LabelFontSize` | 8 | Font size for pivot labels |
| `DebugFontSize` | 10 | Font size for debug panel |

---

## How It Works: Step-by-Step

### OnInit()
1. Allocates array for 1000 pivots (auto-resizes as needed)
2. Logs initialization parameters to Journal

### OnTick() — Main Loop
1. **Guard against repainting**: Skip if no new bars since last scan
2. **Guard against invalid state**: Verify current bar is valid
3. **Call DetectPivots()**: Scan for new swing points
4. **Call RedrawAllVisuals()**: Update chart markers and labels
5. **Call UpdateDebugDisplay()**: Refresh status panel

### DetectPivots() — Core Logic
```
For each bar from PivotLeftBars to Bars-PivotRightBars:
  - Skip if pivot already detected at this bar
  - Check if it's a swing high
    - Find max high in left window
    - Find max high in right window
    - Current bar must be > both windows
    - Calculate deviation: (current - min(windows)) / min(windows)
    - If deviation >= threshold, classify as MAJOR or MINOR
  - Check if it's a swing low
    - Mirror logic for lows
  - Add detected pivot to array
```

### Classification Rules

**High Pivot**:
- Must be strictly higher than ALL bars in left window
- Must be strictly higher than ALL bars in right window
- Deviation must exceed `PivotMinDeviation`
- If deviation ≥ `PivotMinDeviation * HigherHighThreshold` → **MAJOR**
- Otherwise → **MINOR**

**Low Pivot**:
- Must be strictly lower than ALL bars in left window
- Must be strictly lower than ALL bars in right window
- Deviation must exceed `PivotMinDeviation`
- If deviation ≥ `PivotMinDeviation * LowerLowThreshold` → **MAJOR**
- Otherwise → **MINOR**

---

## Testing in MT5 Strategy Tester

### Setup

1. **Compile the EA**:
   - Open MetaEditor (Tools → MetaEditor or F11)
   - File → Open → `GonyTrendLineEAVisual.mq5`
   - Compile (F5) — should produce no errors or warnings

2. **Load in Strategy Tester**:
   - View → Strategy Tester (or Ctrl+R)
   - **Expert Advisor**: Select `GonyTrendLineEAVisual`
   - **Symbol**: Choose EUR/USD or preferred pair
   - **Timeframe**: H1 (1-hour) for clear pivots
   - **Date Range**: 1-2 weeks of recent data
   - **Model**: "Open prices only" or "Every tick" (doesn't matter for research)

3. **Configure Parameters**:
   - In Strategy Tester, go to **Inputs** tab
   - Adjust `PivotLeftBars` and `PivotRightBars` (try 3-5)
   - Adjust `PivotMinDeviation` based on symbol volatility:
     - Crypto: 0.001 (0.1%)
     - Forex: 0.0001 (0.01%)
     - Stocks: 0.001 (0.1%)
   - Set `ShowDebugInfo = true`

4. **Run the Test**:
   - Click **Start**
   - Tester will process historical bars
   - Watch the chart display — arrows and labels should appear

### Interpreting Visual Output

**On the Chart**:
- **Green downward arrows** = Major swing highs
- **Red upward arrows** = Major swing lows
- **Light green downward arrows** = Minor swing highs
- **Light coral upward arrows** = Minor swing lows
- **Labels** show pivot index and classification reason (e.g., "P5\nMajor High | Dev: 0.0152%")

**Debug Panel** (top-left):
```
=== PIVOT DETECTION STATE ===
Total Pivots: 42
Major: 15 | Minor: 18 | Noise: 9
Last Bar Processed: 456
Current Deviation: 0.0245%
Status: Detected 3 new pivot(s) | Total: 42
```

### Validation Checklist

- [ ] Arrows appear on the chart
- [ ] Green downward arrows only appear at obvious swing highs
- [ ] Red upward arrows only appear at obvious swing lows
- [ ] No arrows appear in flat, sideways markets
- [ ] Pivot distribution looks reasonable (not every bar)
- [ ] Debug panel updates as new bars arrive
- [ ] Toggling `ShowMajorPivots` immediately hides/shows major pivots
- [ ] Toggling `ShowNoisePivots` reveals additional low-deviation points

---

## Common Tuning Scenarios

### Too Many Pivots (Too Sensitive)
**Problem**: Every small wiggle is marked as a pivot

**Solution**:
- Increase `PivotLeftBars` and `PivotRightBars` (e.g., 5→7)
- Increase `PivotMinDeviation` (e.g., 0.0001→0.0005)
- Increase `HigherHighThreshold` and `LowerLowThreshold` (e.g., 2.0→3.0)

### Too Few Pivots (Too Insensitive)
**Problem**: Obvious swing points are missed

**Solution**:
- Decrease `PivotLeftBars` and `PivotRightBars` (e.g., 3→2)
- Decrease `PivotMinDeviation` (e.g., 0.0001→0.00005)
- Decrease `HigherHighThreshold` and `LowerLowThreshold` (e.g., 2.0→1.5)

### Major/Minor Balance Wrong
**Problem**: Most pivots are classified as MAJOR when they should be MINOR

**Solution**:
- Increase threshold multipliers (e.g., `HigherHighThreshold` from 2.0 to 4.0)
- Or decrease the base deviation threshold and adjust multipliers proportionally

---

## Limitations & Next Steps

### Phase 1 Limitations
- **No trendline drawing** — just pivot detection
- **No confirmation of pivots** — historical pivots not revisited as price evolves
- **No future look-ahead** — right-window bars can still see unconfirmed pivots
- **No scoring** — all detected pivots are equal (Phase 3)

### What We Validate in Phase 1
✓ Pivot detection logic is transparent  
✓ Rules are explicitly defined and tunable  
✓ Visual feedback is immediate and clear  
✓ Classification reasons are logged  
✓ No hidden decisions  

### Preparing for Phase 2
- Once you're confident pivots are detected correctly, Phase 2 will:
  - Generate trendline **candidates** from eligible swing points
  - Display candidate lines extending forward
  - Distinguish bullish vs. bearish candidates
  - Avoid forcing lines when structure is unclear

---

## Troubleshooting

### No Pivots Appear on Chart
- **Check**: Is `ShowMajorPivots` or `ShowMinorPivots` enabled?
- **Check**: Are `PivotLeftBars` and `PivotRightBars` too large (reducing scan range)?
- **Check**: Is `PivotMinDeviation` too high? (Try 0.0001)
- **Solution**: Enable `ShowDebugInfo` and check "Total Pivots" count

### Pivots Appear in Flat Markets
- **Check**: The market might not be "flat" — small moves still count as swings
- **Solution**: Increase `PivotMinDeviation` and threshold multipliers

### Pivots Disappear When Zooming
- **Issue**: Chart scroll/zoom causes the EA to reset
- **Status**: This is normal in research mode — the EA reprocesses visible bars
- **Future**: Phase 5 will implement proper historical replay for backtesting

### Compilation Errors
- **Check**: MQL5 syntax — ensure `#property strict` is at the top
- **Check**: Function names match definitions
- **Solution**: Compile with F5 and check Error list in MetaEditor

---

## Notes for Developers

### Code Organization
- **Configuration** (lines 1-50): All `input` parameters
- **Data Structures** (lines 51-85): `Pivot` struct, enums
- **Global State** (lines 86-95): Pivot array, counters
- **Initialization** (lines 96-115): `OnInit()`, `OnDeinit()`
- **Main Loop** (lines 116-145): `OnTick()`
- **Detection Logic** (lines 146-320): Core pivot detection
- **Visual Rendering** (lines 321-430): Drawing and labels
- **Utilities** (lines 431-470): Helper functions

### For Future Phases
- `Pivot` struct can be extended with new fields (anchor quality, trend direction, etc.)
- `ColorXxx` inputs allow easy themeing for future debugging views
- `debugMessage` can be extended to log rejection reasons
- Pivot array is dynamic — add filtering functions as needed

---

## Next: Phase 2 Checklist

Before moving to Phase 2, confirm:
- [ ] EA compiles without errors
- [ ] Pivots display on historical chart in Strategy Tester
- [ ] Major and minor classifications look reasonable
- [ ] Debug panel shows correct counts
- [ ] Parameters can be adjusted to control sensitivity
- [ ] No future-looking behavior (all data is confirmed when pivot is detected)
- [ ] I understand why each pivot was classified (reason is logged)

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Status**: Phase 1 — Ready for Visual Testing
