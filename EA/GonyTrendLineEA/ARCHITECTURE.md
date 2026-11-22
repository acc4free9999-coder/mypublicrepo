# Technical Architecture: Gony Trendline Visual Research Engine

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MT5 Expert Advisor                        │
│              GonyTrendLineEAVisual.mq5 (Phase 1)             │
└─────────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
         ┌──────────▼──────────┐   ┌──────────▼──────────┐
         │  OnTick() — Main    │   │  OnInit/OnDeinit()  │
         │  Execution Loop     │   │  Lifecycle          │
         └──────────┬──────────┘   └─────────────────────┘
                    │
         ┌──────────▼──────────┐
         │  DetectPivots()     │
         │  - Scan bars        │
         │  - Check high/low   │
         │  - Classify pivot   │
         │  - Add to array     │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  RedrawAllVisuals() │
         │  - Draw markers     │
         │  - Add labels       │
         │  - Update panel     │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  UpdateDebugDisplay │
         │  - Count pivots     │
         │  - Show state       │
         └──────────────────────┘
```

---

## Module: Pivot Detection

### Function: `DetectPivots()`
**Responsibility**: Orchestrate bar scanning and pivot creation  
**Called by**: `OnTick()`  
**Frequency**: Once per new bar  

**Algorithm**:
```
Input:  Current bar count
Output: Updated pivot array

1. Record previous pivot count
2. For each bar from PivotLeftBars to Bars-PivotRightBars-1:
   a. Skip if pivot already detected at this bar
   b. Call CheckHighPivot(bar)
      - If returns non-NONE type, create and add high pivot
   c. Call CheckLowPivot(bar)
      - If returns non-NONE type, create and add low pivot
3. Update lastDetectionBar
4. Log count of new pivots to debugMessage
```

**Guard Conditions**:
- Must not reprocess already-detected pivots
- Must not use future data (lookahead)
- Must handle bar count changes gracefully

---

### Function: `CheckHighPivot(barIndex)`
**Responsibility**: Determine if bar is a swing high and classify  
**Input**: Bar index to test  
**Output**: `PivotType` (NONE, MINOR, MAJOR)  

**Step-by-Step**:
```
1. Get current high: H = High(barIndex)
2. Get max high in left window [barIndex+1 to barIndex+PivotLeftBars]:
   leftMax = max(High[barIndex+1..barIndex+PivotLeftBars])
3. Get max high in right window [barIndex-PivotRightBars to barIndex-1]:
   rightMax = max(High[barIndex-PivotRightBars..barIndex-1])
4. Test: H > leftMax AND H > rightMax
   - If false → return PIVOT_NONE
5. Calculate deviation:
   minAdjacent = min(leftMax, rightMax)
   deviation = (H - minAdjacent) / minAdjacent
6. Test: deviation >= PivotMinDeviation
   - If false → return PIVOT_NONE
7. Classify:
   majorThreshold = PivotMinDeviation * HigherHighThreshold
   if deviation >= majorThreshold → return PIVOT_MAJOR
   else                           → return PIVOT_MINOR
```

**Example** (H1 chart):
```
Bar: 100  101  102  103  104  105  106
High: 1.095 1.093 1.098 1.100 1.097 1.096 1.092
         ▲    ▲    ▲    ▲    ▲    ▲    ▲
         L3   L2   L1  [103] R1   R2   R3

Is bar 103 (1.100) a high pivot?
- Left max: max(1.093, 1.098, 1.100) = 1.100 → FAIL (not > left)
  
Let's try bar 102 (1.098):
- Left max: max(1.093, 1.098, 1.100) = 1.100 → FAIL (not > left)

Let's try bar 105 (1.096):
- Left max: max(1.093, 1.098, 1.100) = 1.100 → FAIL (not > left)

Conclusion: No high pivot in this window (103 is local high but not extremal)
```

---

### Function: `CheckLowPivot(barIndex)`
**Responsibility**: Determine if bar is a swing low and classify  
**Input**: Bar index to test  
**Output**: `PivotType` (NONE, MINOR, MAJOR)  

**Algorithm**: Mirror of `CheckHighPivot()` but for lows

```
1. Get current low: L = Low(barIndex)
2. Get min low in left window:
   leftMin = min(Low[barIndex+1..barIndex+PivotLeftBars])
3. Get min low in right window:
   rightMin = min(Low[barIndex-PivotRightBars..barIndex-1])
4. Test: L < leftMin AND L < rightMin
5. Calculate deviation:
   maxAdjacent = max(leftMin, rightMin)
   deviation = (maxAdjacent - L) / maxAdjacent
6. Classify as MAJOR or MINOR based on deviation
```

---

### Function: `CreateHighPivot(barIndex, type)`
**Responsibility**: Build a Pivot struct for a swing high  
**Input**: Bar index, classification type  
**Output**: Fully populated `Pivot` struct  

**Fields Set**:
- `barIndex` ← argument
- `time` ← High[barIndex]'s timestamp
- `price` ← High[barIndex]
- `direction` ← DIR_HIGH
- `type` ← argument (MAJOR/MINOR/NOISE)
- `deviation` ← calculated deviation percentage
- `reason` ← formatted string: "Major High | Dev: 0.0152%"
- `pivotIndex` ← count of existing pivots of same type

---

### Function: `CreateLowPivot(barIndex, type)`
**Responsibility**: Build a Pivot struct for a swing low  
**Input**: Bar index, classification type  
**Output**: Fully populated `Pivot` struct  

**Identical to `CreateHighPivot()` except**:
- `direction` ← DIR_LOW
- `reason` ← "Major Low | Dev: X%" or "Minor Low | Dev: X%"

---

### Function: `AddPivot(pivot)`
**Responsibility**: Store pivot in dynamic array  
**Input**: Pivot struct  

**Logic**:
```
1. If totalPivots >= ArraySize(pivots):
   - ArrayResize(pivots, totalPivots + 100, 100)
2. pivots[totalPivots] = pivot
3. totalPivots++
```

**Array Growth**: Preallocated by 100 each time to minimize reallocations

---

### Function: `IsPivotDetected(barIndex)`
**Responsibility**: Check if pivot already exists at a bar  
**Input**: Bar index  
**Output**: `bool` (true if detected, false otherwise)  

**Use Case**: Prevents duplicate detection on same bar during multiple scans

---

### Function: `CountPivotsOfType(type)`
**Responsibility**: Return count of pivots with given classification  
**Input**: PivotType (MAJOR, MINOR, NOISE)  
**Output**: Integer count  

**Use Case**: For statistics in debug display

---

## Module: Visual Rendering

### Function: `RedrawAllVisuals()`
**Responsibility**: Render all pivots according to display settings  
**Called by**: `OnTick()`  
**Frequency**: Every tick (or every bar)  

**Algorithm**:
```
1. For each pivot i in array:
   - Call RemovePivotVisuals(i)
2. For each pivot i:
   a. Determine if it should be drawn based on type and settings:
      - ShowMajorPivots && type == MAJOR → draw
      - ShowMinorPivots && type == MINOR → draw
      - ShowNoisePivots && type == NOISE → draw
   b. If should draw:
      - Choose color based on type and direction
      - Call DrawPivotMarker(i, color)
      - If ShowPivotLabels: Call DrawPivotLabel(i)
```

**Separation of Concerns**:
- Visual layer doesn't modify detection logic
- Toggling display options requires no recomputation
- Redraw can be called many times without state change

---

### Function: `DrawPivotMarker(pivotIndex, color)`
**Responsibility**: Create arrow object at pivot location  
**Input**: Pivot array index, marker color  

**Implementation**:
```
1. Build unique name: "PIVOT_MARKER_" + pivotIndex
2. Delete any existing object with same name
3. If direction == DIR_HIGH:
   - Create OBJ_ARROW_DOWN at time, price
4. Else:
   - Create OBJ_ARROW_UP at time, price
5. Set properties:
   - OBJPROP_COLOR ← color
   - OBJPROP_WIDTH ← PivotMarkerSize
   - OBJPROP_BACK ← false (in front of price bars)
```

**Visual Grammar**:
- **Downward arrow** = High (peak)
- **Upward arrow** = Low (trough)
- **Color** = Classification (major/minor/noise)

---

### Function: `DrawPivotLabel(pivotIndex)`
**Responsibility**: Create text label with pivot info  
**Input**: Pivot array index  

**Implementation**:
```
1. Build unique name: "PIVOT_LABEL_" + pivotIndex
2. Delete any existing object with same name
3. Build label text:
   - Base: "P" + pivotIndex
   - If ShowPivotReason: append newline + reason
4. Create OBJ_TEXT at time, price
5. Set properties:
   - OBJPROP_TEXT ← label
   - OBJPROP_COLOR ← ColorDebugText
   - OBJPROP_FONTSIZE ← LabelFontSize
```

**Example Label**:
```
P7
Major High | Dev: 0.0152%
```

---

### Function: `RemovePivotVisuals(pivotIndex)`
**Responsibility**: Clean up old chart objects before redraw  
**Input**: Pivot array index  

**Implementation**:
```
1. ObjectDelete(_Symbol, "PIVOT_MARKER_" + pivotIndex)
2. ObjectDelete(_Symbol, "PIVOT_LABEL_" + pivotIndex)
```

**Note**: ObjectDelete() silently succeeds if object doesn't exist

---

### Function: `UpdateDebugDisplay()`
**Responsibility**: Render status panel showing detection state  
**Called by**: `OnTick()`  

**Information Displayed**:
- Total pivots detected
- Count by type (Major, Minor, Noise)
- Last bar processed
- Current deviation of latest check
- Status message (e.g., "Detected 3 new pivots")

**Position**: Fixed at top-left of chart (10px from edges)

---

## Module: Data Structures

### Struct: `Pivot`
```cpp
struct Pivot
{
    int            barIndex;        // 0-based index from most recent
    datetime       time;            // Timestamp of pivot bar
    double         price;           // Price at pivot (High or Low)
    PivotDirection direction;       // DIR_HIGH or DIR_LOW
    PivotType      type;            // MAJOR, MINOR, NOISE
    double         deviation;       // Deviation percentage
    string         reason;          // Human-readable classification reason
    int            pivotIndex;      // Sequential ID within type
};
```

**Size**: ~64 bytes (string is reference, not inline)  
**Array**: Global array `pivots[]` with dynamic growth  
**Capacity**: Starts at 1000, grows by 100 when needed  

---

### Enum: `PivotType`
```cpp
enum PivotType
{
    PIVOT_NONE   = 0,  // Not a pivot
    PIVOT_NOISE  = 1,  // Low-deviation pivot
    PIVOT_MINOR  = 2,  // Medium-deviation pivot
    PIVOT_MAJOR  = 3   // High-deviation pivot
};
```

---

### Enum: `PivotDirection`
```cpp
enum PivotDirection
{
    DIR_NONE = 0,
    DIR_HIGH = 1,  // Swing high
    DIR_LOW  = 2   // Swing low
};
```

---

## Execution Flow Diagram

```
┌─────────────────┐
│   OnInit()      │
│ Allocate array  │
│ Log params      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│          OnTick() — Every Tick               │
├─────────────────────────────────────────────┤
│ 1. Guard: New bar?                          │
│    └─ If not new → return                   │
│                                              │
│ 2. Guard: Valid state?                      │
│    └─ If invalid → return                   │
│                                              │
│ 3. Call DetectPivots()                      │
│    └─ Scan bars                             │
│    └─ Classify pivots                       │
│    └─ Add to array                          │
│                                              │
│ 4. Call RedrawAllVisuals()                  │
│    └─ Remove old markers                    │
│    └─ Draw new markers                      │
│    └─ Draw labels                           │
│                                              │
│ 5. Call UpdateDebugDisplay()                │
│    └─ Refresh status panel                  │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│   OnDeinit()    │
│ Clear visuals   │
│ Log farewell    │
└─────────────────┘
```

---

## State Management

### Global Variables
- `pivots[]` — Dynamic array of detected Pivot structs
- `totalPivots` — Count of pivots in array
- `lastMajorHighPrice` — Price of most recent major high (for future phases)
- `lastMajorLowPrice` — Price of most recent major low (for future phases)
- `lastDetectionBar` — Index of bar where detection last ran
- `debugMessage` — String for status panel
- `currentDeviation` — Deviation of most recent pivot check

### Invariants
- `0 <= totalPivots <= ArraySize(pivots)`
- `lastDetectionBar < current bar index` (monotonically increasing)
- Each `Pivot.barIndex` is unique in the array
- `Pivot.direction` is never DIR_NONE for added pivots
- `Pivot.type` is never PIVOT_NONE for added pivots

---

## Configuration Propagation

**Parameters → Input Filter → Display Logic**

```
Input Parameters (extern)
    ↓
OnInit() — Stored as global inputs
    ↓
DetectPivots() — Read PivotLeftBars, PivotRightBars, PivotMinDeviation
    ↓
Pivot Classification — Uses thresholds
    ↓
RedrawAllVisuals() — Reads ShowMajorPivots, ShowMinorPivots, etc.
    ↓
Chart Display — Uses ColorXxx, SizeXxx parameters
```

**Key Design**: No re-detection when display settings change — just redraw

---

## Error Handling

### Strategy
- **Compile-time safety**: `#property strict` enforces type checking
- **Array bounds**: `ArrayResize()` with growth strategy prevents overflow
- **Null checks**: None needed (structures, not pointers)
- **Division by zero**: Protected in `CheckHighPivot()` and `CheckLowPivot()` by pre-check
- **Bar access**: `iHigh()`, `iLow()`, `iTime()` handle invalid indices

### Future Improvements
- Logging of rejected pivots (Phase 3)
- Error recovery on chart clear
- Validation of parameter ranges at OnInit()

---

## Performance Characteristics

### Time Complexity
- **DetectPivots()**: O(n × w) where n = bars to scan, w = window size
  - For each bar: scan left and right windows (constant time)
  - Typical: O(500 × 10) per tick on first run
  - Subsequent: O(1) per new bar
  
- **RedrawAllVisuals()**: O(p) where p = total pivots
  - Redraw all pivots every tick
  - Typical: O(50-100) pivots on chart

### Space Complexity
- **Pivot array**: O(p) where p = total pivots
  - Preallocated by 100 to amortize growth
  - Typical: 100-1000 pivots in memory

### Optimization Notes
- Array resize grows by 100 → amortized O(1) insertion
- Chart objects (arrows, text) are native MT5 handles — efficient
- No string concatenation in tight loops (only in debug functions)

---

## Extension Points for Future Phases

### Phase 2 — Trendline Candidates
- Add `Candidate` struct (line, anchor points, direction)
- Implement `GenerateCandidates()` using pivot array
- Extend visual layer to draw candidate lines

### Phase 3 — Scoring
- Add `Score` struct (component scores, reasons)
- Implement `ScoreCandidate()` for each candidate
- Extend debug display to show scores

### Phase 4 — Advanced Visuals
- Layer system for toggling candidate visibility
- Heatmaps for candidate strength
- Hover tooltips for details

### Phase 5 — Historical Replay
- Implement `ReplayBar()` to process bars in sequence
- Track "confirmed" vs. "tentative" pivots
- Logging to CSV for analysis

---

**Architecture Version**: 1.0  
**Last Updated**: 2024  
**Frozen Until**: Phase 2 approval
