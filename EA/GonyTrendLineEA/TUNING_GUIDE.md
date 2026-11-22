> Historical document: superseded by [README.md](./README.md). The settings and
> numerical results below were not verified for this version.

# Tuning Guide: Finding the Right Settings

## Principle: One Change at a Time

Always adjust one parameter, run a test, observe results, then adjust the next. This helps you understand cause-and-effect.

---

## Parameter Relationship Map

```
┌──────────────────────────────────────────────────────────────┐
│                    Detection Sensitivity                      │
├──────────────────────────────────────────────────────────────┤
│  Affects: How many pivots are detected, and their quality     │
│                                                               │
│  Primary Drivers:                                            │
│  • PivotMinDeviation      (↑ = fewer pivots)                │
│  • PivotLeftBars, PivotRightBars  (↑ = fewer pivots)       │
│  • HigherHighThreshold, LowerLowThreshold  (↑ = more minor) │
└──────────────────────────────────────────────────────────────┘
```

---

## Tuning Workflows

### Workflow A: Starting Fresh

**Goal**: Find settings that work for your chart and timeframe

**Steps**:
1. Load your preferred symbol and timeframe in Strategy Tester
2. Use default settings as baseline
3. Run test and observe pivot distribution
4. Adjust per scenarios below
5. Document the final settings

**Default Baseline**:
```
PivotLeftBars       = 3
PivotRightBars     = 3
PivotMinDeviation   = 0.0001
HigherHighThreshold = 2.0
LowerLowThreshold   = 2.0
```

---

### Workflow B: Too Many Pivots

**Symptoms**:
- Every small wiggle is marked
- Major and minor are indistinguishable
- Chart is "noisy"

**Root Causes & Fixes**:

#### Fix 1: Raise the Deviation Threshold
**What it does**: Requires larger price moves to trigger detection

```
Before:  PivotMinDeviation = 0.0001  (0.01% move required)
After:   PivotMinDeviation = 0.0005  (0.05% move required)
Result:  ~50-70% fewer pivots (depends on volatility)
```

**When to use**: Most common first fix; works for all markets

**Side effect**: May miss subtle structure

---

#### Fix 2: Widen the Pivot Window
**What it does**: Requires pivot to exceed bars further away

```
Before:  PivotLeftBars = 3, PivotRightBars = 3
After:   PivotLeftBars = 5, PivotRightBars = 5
Result:  Fewer local extremes qualify; broader pivots only
```

**When to use**: When you want fewer, more "significant" pivots

**Side effect**: Slower to detect pivots (waits for more bars)

---

#### Fix 3: Raise Major Threshold
**What it does**: Makes it harder to classify as MAJOR

```
Before:  HigherHighThreshold = 2.0
After:   HigherHighThreshold = 3.0
Result:  More pivots classified as MINOR instead of MAJOR
```

**When to use**: Major/minor ratio is imbalanced (too many major)

**Side effect**: Changes classification, doesn't reduce total count

---

#### Recommended Tuning Sequence (Too Many Pivots)

1. **Increase `PivotMinDeviation`**:
   - 0.0001 → 0.0002
   - Observe → still too many?
   
2. **Increase again**:
   - 0.0002 → 0.0005
   - Observe → better?
   
3. **If still noisy, widen window**:
   - PivotLeftBars/PivotRightBars: 3 → 4 or 5
   
4. **Fine-tune major threshold if needed**:
   - HigherHighThreshold: 2.0 → 2.5 or 3.0

**Example Result**:
```
TOO MANY (default):
- 85 total pivots
- 42 major, 43 minor
- Dense coverage, hard to see structure

TUNED (after steps above):
- PivotMinDeviation = 0.0005
- PivotLeftBars/Right = 4
- HigherHighThreshold = 2.5
- Result: 28 total pivots (12 major, 16 minor)
- Much clearer structure visible
```

---

### Workflow C: Too Few Pivots

**Symptoms**:
- Obvious swing points are missing
- Chart looks "empty"
- Visible turning points have no arrows

**Root Causes & Fixes**:

#### Fix 1: Lower the Deviation Threshold
**What it does**: Accepts smaller price moves as pivots

```
Before:  PivotMinDeviation = 0.0001  (0.01% move required)
After:   PivotMinDeviation = 0.00005 (0.005% move required)
Result:  ~100-150% more pivots
```

**When to use**: Most common first fix; works for all markets

**Side effect**: May detect noise

---

#### Fix 2: Tighten the Pivot Window
**What it does**: Accepts closer-range pivots

```
Before:  PivotLeftBars = 3, PivotRightBars = 3
After:   PivotLeftBars = 2, PivotRightBars = 2
Result:  More local extremes qualify; faster detection
```

**When to use**: When you want to catch all visible turning points

**Side effect**: More noise, needs tuning of deviation threshold

---

#### Recommended Tuning Sequence (Too Few Pivots)

1. **Decrease `PivotMinDeviation`**:
   - 0.0001 → 0.00005
   - Observe → better coverage?
   
2. **If still missing pivots, tighten window**:
   - PivotLeftBars/PivotRightBars: 3 → 2
   
3. **May need to lower deviation further**:
   - 0.00005 → 0.00001

**Example Result**:
```
TOO FEW (conservative settings):
- PivotMinDeviation = 0.0005
- PivotLeftBars/Right = 5
- Result: 8 total pivots
- Many obvious swings missed

TUNED (after steps above):
- PivotMinDeviation = 0.00005
- PivotLeftBars/Right = 2
- Result: 42 total pivots
- Catches all visible structure
```

---

### Workflow D: Major/Minor Distribution Wrong

**Symptoms**:
- Too many MAJOR classifications
- Too many MINOR classifications
- Major/minor ratio doesn't match eye test

**Solution**: Adjust threshold multipliers only

```
Current state:
- Seeing: 50 major, 10 minor
- Want: 15 major, 45 minor
- Action: Increase HigherHighThreshold (2.0 → 3.5)

Result:
- 15 major, 45 minor
- Same total pivot count, better distribution
```

**Guidelines**:
- `HigherHighThreshold = 2.0`: Moderate majority
- `HigherHighThreshold = 2.5`: More minor than major
- `HigherHighThreshold = 3.0`: Significant bias toward minor
- `HigherHighThreshold = 4.0`: Very few major pivots

---

## Market-Specific Tuning

### EURUSD (Forex, H1)
**Volatility**: Low-medium  
**Recommended Settings**:
```
PivotLeftBars       = 3
PivotRightBars     = 3
PivotMinDeviation   = 0.0001
HigherHighThreshold = 2.0
LowerLowThreshold   = 2.0
```
**Result**: ~20-30 pivots per week

### GBPUSD (Forex, H1)
**Volatility**: Medium-high  
**Recommended Settings**:
```
PivotLeftBars       = 3
PivotRightBars     = 3
PivotMinDeviation   = 0.0002  ← Higher due to volatility
HigherHighThreshold = 2.0
LowerLowThreshold   = 2.0
```
**Result**: ~15-25 pivots per week

### BTCUSD (Crypto, 4H)
**Volatility**: High  
**Recommended Settings**:
```
PivotLeftBars       = 4       ← Wider to filter noise
PivotRightBars     = 4
PivotMinDeviation   = 0.001   ← Higher due to high volatility
HigherHighThreshold = 2.0
LowerLowThreshold   = 2.0
```
**Result**: ~10-20 pivots per week

### GOLD (Commodity, H1)
**Volatility**: Medium  
**Recommended Settings**:
```
PivotLeftBars       = 3
PivotRightBars     = 3
PivotMinDeviation   = 0.0002
HigherHighThreshold = 2.0
LowerLowThreshold   = 2.0
```
**Result**: ~20-30 pivots per week

### AAPL (Stock, Daily)
**Volatility**: Low-medium  
**Recommended Settings**:
```
PivotLeftBars       = 3
PivotRightBars     = 3
PivotMinDeviation   = 0.001   ← Higher due to larger point values
HigherHighThreshold = 2.0
LowerLowThreshold   = 2.0
```
**Result**: ~5-10 pivots per month

---

## Testing Methodology

### Quick Test (5 min)
1. Load chart in Strategy Tester
2. Run with default settings
3. Visual inspection on chart
4. Adjust one parameter
5. Run again
6. Repeat step 4-5 as needed

### Detailed Test (20 min)
1. Same as Quick Test
2. Run on 2-3 different timeframes
3. Run on 2-3 different symbols
4. Document settings for each
5. Identify patterns

### Validation Test (1 hour)
1. Set final parameters
2. Run on 1 month of data
3. Visual inspection for:
   - False positives (pivots in flat markets)
   - False negatives (missed obvious turns)
   - Major/minor balance
4. Document findings
5. Adjust if needed
6. Run again on different month
7. Compare results

---

## Tuning Checklist

### Before Tuning
- [ ] EA compiles (F5 in MetaEditor)
- [ ] Strategy Tester opens
- [ ] Can load EA and select symbol/timeframe
- [ ] Chart renders with historical bars

### During Tuning
- [ ] Change ONE parameter at a time
- [ ] Run test after each change
- [ ] Record old value, new value, and result
- [ ] Stop changing after 3-4 iterations
- [ ] If lost, reset to defaults and restart

### After Tuning
- [ ] Pivot distribution looks reasonable
- [ ] No obvious false positives
- [ ] No obvious false negatives
- [ ] Major and minor are distinguishable
- [ ] Debug panel shows realistic counts
- [ ] Settings document with final values
- [ ] Ready to move to Phase 2

---

## Common Mistakes to Avoid

### ❌ Changing Multiple Parameters at Once
**Problem**: Can't tell which change caused the effect

**Fix**: Always change one parameter, run test, observe, adjust next

### ❌ Using Same Settings for All Markets
**Problem**: Crypto needs different settings than Forex; daily charts need different settings than hourly

**Fix**: Tune per symbol/timeframe; document the final settings for each

### ❌ Recompiling After Every Change
**Problem**: Slow; not necessary

**Fix**: Parameters are `input` → change them in Strategy Tester without recompiling

### ❌ Assuming Default Settings are Optimal
**Problem**: They work for EURUSD H1 but not your chart

**Fix**: Always test on your preferred symbol/timeframe and tune as needed

### ❌ Tuning to Remove All Noise
**Problem**: Impossible; some ambiguity is inherent

**Fix**: Accept a small amount of noise; tune to reasonable threshold

---

## Tips for Success

### Tip 1: Pivot Density Target
Aim for a "goldilocks" density:
- **Too sparse** (< 1 pivot per 10 bars): Increasing sensitivity
- **Sparse** (1 pivot per 5-10 bars): Good for major structure
- **Normal** (1 pivot per 2-5 bars): Good balance
- **Dense** (1 pivot per bar or more): Decreasing sensitivity
- **Very dense** (many per bar): Too sensitive; increase thresholds

### Tip 2: Use Noise Layer for Testing
1. Set `ShowNoisePivots = true`
2. Set `PivotMinDeviation` to very low (0.00001)
3. Run test → see ALL potential pivots
4. Watch where noise appears → understand the threshold
5. Set `PivotMinDeviation` to exclude that noise
6. Set `ShowNoisePivots = false`

### Tip 3: Document Your Findings
Keep a log:
```
Symbol: EURUSD, Timeframe: H1
Test Date: 2024-01-15
Default Settings: 42 pivots (28 major, 14 minor)
  Problem: Too many major pivots

Attempt 1: HigherHighThreshold 2.0 → 2.5
  Result: 42 pivots (18 major, 24 minor) ✓ Better balance

Attempt 2: Keep this setting
  Final: Use HigherHighThreshold = 2.5 for EURUSD H1
```

### Tip 4: Save Configuration Presets
Once tuned, write down the exact settings:
```
EURUSD H1 — Balanced Setting:
  PivotLeftBars       = 3
  PivotRightBars     = 3
  PivotMinDeviation   = 0.0001
  HigherHighThreshold = 2.5
  LowerLowThreshold   = 2.5
```

Then if you want to test a different symbol, start from known-good settings and adjust from there.

---

## Example Tuning Session

### Initial Run
```
Symbol: EURUSD H1 (1 week data)
Settings: Default (all)
Result: 56 pivots (35 major, 21 minor)
Observation: Too many major pivots; chart looks crowded
Action: Increase HigherHighThreshold
```

### Attempt 1
```
HigherHighThreshold = 2.0 → 3.0
Result: 56 pivots (15 major, 41 minor)
Observation: Better! But now too few major
Action: Try middle ground
```

### Attempt 2
```
HigherHighThreshold = 2.0 → 2.5
Result: 56 pivots (22 major, 34 minor)
Observation: Good balance. Still lots of pivots though.
Action: Increase PivotMinDeviation to filter noise
```

### Attempt 3
```
PivotMinDeviation = 0.0001 → 0.0002
Result: 32 pivots (8 major, 24 minor)
Observation: Too many minor, too few major
Action: Revert and try different approach
```

### Attempt 4
```
Revert PivotMinDeviation to 0.0001
Increase PivotLeftBars/PivotRightBars: 3 → 4
HigherHighThreshold: 2.5
Result: 38 pivots (12 major, 26 minor)
Observation: Good structure, reasonable density
Decision: Use these settings
```

### Final Configuration
```
PivotLeftBars       = 4
PivotRightBars     = 4
PivotMinDeviation   = 0.0001
HigherHighThreshold = 2.5
LowerLowThreshold   = 2.5
Result: 38 pivots over 1 week = healthy distribution
Status: APPROVED for use on EURUSD H1
```

---

## Next Steps

1. Choose your preferred symbol and timeframe
2. Load 1-2 weeks of data in Strategy Tester
3. Run with default settings
4. Observe and decide: too many or too few pivots?
5. Follow Workflow A/B/C above to tune
6. Document final settings
7. Validate on a different time period
8. Ready for Phase 2 development

---

**Happy tuning! Questions?** See [PHASE_1_DOCUMENTATION.md](./PHASE_1_DOCUMENTATION.md) for detailed parameter reference.
