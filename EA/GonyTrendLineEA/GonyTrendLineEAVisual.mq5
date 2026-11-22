//+------------------------------------------------------------------+
//| Gony Trendline Visual Research Engine - Phase 1: Swing Detection |
//| Purpose: Identify and visualize swing highs and lows             |
//| Version: 1.0.0                                                   |
//| Status: Development - Research Mode Only                         |
//+------------------------------------------------------------------+

#property strict
#property version   "1.0.0"
#property description "Visual Trendline Research Engine - Phase 1"

//+------------------------------------------------------------------+
// CONFIGURATION SECTION
//+------------------------------------------------------------------+

// Pivot Detection Parameters
input int    PivotLeftBars       = 3;      // Bars to left of potential pivot
input int    PivotRightBars      = 3;      // Bars to right of potential pivot
input double PivotMinDeviation   = 0.0001; // Min deviation from adjacent bars (%)
input double HigherHighThreshold = 2.0;    // Multiple of minor deviation for major high
input double LowerLowThreshold   = 2.0;    // Multiple of minor deviation for major low

// Visual Display Parameters
input bool   ShowMajorPivots      = true;  // Display major swing points
input bool   ShowMinorPivots      = true;  // Display minor swing points
input bool   ShowNoisePivots      = false; // Display potential noise
input bool   ShowPivotLabels      = true;  // Label each pivot with index
input bool   ShowPivotReason      = true;  // Show reason for classification
input bool   ShowDebugInfo        = true;  // Display detection state on chart

// Color Scheme (ARGB format)
input color  ColorMajorHigh       = clrLimeGreen;  // Major swing high
input color  ColorMajorLow        = clrRed;        // Major swing low
input color  ColorMinorHigh       = clrLightGreen; // Minor swing high
input color  ColorMinorLow        = clrLightCoral; // Minor swing low
input color  ColorNoise           = clrGray;       // Noise pivot
input color  ColorDebugText       = clrWhite;      // Debug display text

// Size Parameters
input int    PivotMarkerSize      = 5;    // Marker size (pixels)
input int    LabelFontSize        = 8;    // Font size for labels
input int    DebugFontSize        = 10;   // Font size for debug info

//+------------------------------------------------------------------+
// DATA STRUCTURES & ENUMS
//+------------------------------------------------------------------+

enum PivotType
{
    PIVOT_NONE   = 0,  // Not a pivot
    PIVOT_NOISE  = 1,  // Potential noise level
    PIVOT_MINOR  = 2,  // Minor swing
    PIVOT_MAJOR  = 3   // Major swing
};

enum PivotDirection
{
    DIR_NONE = 0,
    DIR_HIGH = 1,
    DIR_LOW  = 2
};

struct Pivot
{
    int            barIndex;        // Bar where pivot occurs
    datetime       time;            // Time of pivot
    double         price;           // Price of pivot
    PivotDirection direction;       // HIGH or LOW
    PivotType      type;            // Classification (NOISE, MINOR, MAJOR)
    double         deviation;       // Price deviation from adjacent bars
    string         reason;          // Why this was classified (for debugging)
    int            pivotIndex;      // Sequential index of this pivot
};

//+------------------------------------------------------------------+
// GLOBAL STATE
//+------------------------------------------------------------------+

Pivot         pivots[];                    // Array of detected pivots
int           totalPivots = 0;             // Count of pivots found
double        lastMajorHighPrice = 0;      // For deviation calculations
double        lastMajorLowPrice  = DBL_MAX;// For deviation calculations
int           lastDetectionBar   = 0;      // Last bar where detection ran
string        debugMessage       = "";     // Current debug state
double        currentDeviation   = 0;      // Last calculated deviation

//+------------------------------------------------------------------+
// INITIALIZATION & CLEANUP
//+------------------------------------------------------------------+

int OnInit()
{
    ArrayResize(pivots, 1000, 100);
    totalPivots = 0;
    lastDetectionBar = -1;
    
    Print("=" + StringFill("=", 60));
    Print("Gony Trendline Visual Research Engine - Phase 1");
    Print("Swing Detection Mode Initialized");
    Print("Symbol: ", Symbol(), " | Timeframe: ", Period(), "min");
    Print("LeftBars=", PivotLeftBars, " RightBars=", PivotRightBars);
    Print("=" + StringFill("=", 60));
    
    return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
    ClearAllVisuals();
    Print("Gony Trendline EA Deinitialized");
}

//+------------------------------------------------------------------+
// MAIN TICK HANDLER
//+------------------------------------------------------------------+

void OnTick()
{
    // Process new bars only (avoid repainting)
    if (Bars(_Symbol, _Period) <= lastDetectionBar)
        return;
    
    // Reset detection if chart zoomed/scrolled significantly
    int currentBar = iBarShift(_Symbol, _Period, TimeCurrent());
    if (currentBar < 0 || currentBar > 500)
        return;
    
    // Run detection on latest completed bar
    DetectPivots();
    
    // Redraw all visuals
    RedrawAllVisuals();
    
    // Update debug display
    UpdateDebugDisplay();
}

//+------------------------------------------------------------------+
// PHASE 1: PIVOT DETECTION ENGINE
//+------------------------------------------------------------------+

void DetectPivots()
{
    int barsToProcess = Bars(_Symbol, _Period);
    
    // Clear previous pivots (but keep history for reference)
    int previousCount = totalPivots;
    
    // Scan all bars for potential pivots
    for (int bar = PivotLeftBars; bar < barsToProcess - PivotRightBars - 1; bar++)
    {
        // Skip if we already detected a pivot at this bar
        if (IsPivotDetected(bar))
            continue;
        
        // Check for high pivot
        PivotType highType = CheckHighPivot(bar);
        if (highType != PIVOT_NONE)
        {
            CreateAndAddHighPivot(bar, highType);
        }
        
        // Check for low pivot
        PivotType lowType = CheckLowPivot(bar);
        if (lowType != PIVOT_NONE)
        {
            CreateAndAddLowPivot(bar, lowType);
        }
    }
    
    lastDetectionBar = barsToProcess - PivotRightBars - 1;
    
    if (totalPivots > previousCount && ShowDebugInfo)
    {
        int newCount = totalPivots - previousCount;
        debugMessage = StringFormat("Detected %d new pivot(s) | Total: %d", 
                                    newCount, totalPivots);
    }
}

PivotType CheckHighPivot(int barIndex)
{
    double high = High(barIndex);
    double leftHigh = 0, rightHigh = 0;
    
    // Find maximum high in left window
    for (int i = 1; i <= PivotLeftBars; i++)
    {
        if (High(barIndex + i) > leftHigh)
            leftHigh = High(barIndex + i);
    }
    
    // Find maximum high in right window
    for (int i = 1; i <= PivotRightBars; i++)
    {
        if (High(barIndex - i) > rightHigh)
            rightHigh = High(barIndex - i);
    }
    
    // Current bar must be higher than left and right windows
    if (high <= leftHigh || high <= rightHigh)
        return PIVOT_NONE;
    
    // Calculate deviation
    double minAdjacent = MathMin(leftHigh, rightHigh);
    double deviation = (high - minAdjacent) / minAdjacent;
    currentDeviation = deviation;
    
    if (deviation < PivotMinDeviation)
        return PIVOT_NONE;
    
    // Classify based on deviation magnitude
    double majorThreshold = PivotMinDeviation * HigherHighThreshold;
    
    if (deviation >= majorThreshold)
        return PIVOT_MAJOR;
    else
        return PIVOT_MINOR;
}

PivotType CheckLowPivot(int barIndex)
{
    double low = Low(barIndex);
    double leftLow = DBL_MAX, rightLow = DBL_MAX;
    
    // Find minimum low in left window
    for (int i = 1; i <= PivotLeftBars; i++)
    {
        if (Low(barIndex + i) < leftLow)
            leftLow = Low(barIndex + i);
    }
    
    // Find minimum low in right window
    for (int i = 1; i <= PivotRightBars; i++)
    {
        if (Low(barIndex - i) < rightLow)
            rightLow = Low(barIndex - i);
    }
    
    // Current bar must be lower than left and right windows
    if (low >= leftLow || low >= rightLow)
        return PIVOT_NONE;
    
    // Calculate deviation
    double maxAdjacent = MathMax(leftLow, rightLow);
    double deviation = (maxAdjacent - low) / maxAdjacent;
    currentDeviation = deviation;
    
    if (deviation < PivotMinDeviation)
        return PIVOT_NONE;
    
    // Classify based on deviation magnitude
    double majorThreshold = PivotMinDeviation * LowerLowThreshold;
    
    if (deviation >= majorThreshold)
        return PIVOT_MAJOR;
    else
        return PIVOT_MINOR;
}

void CreateAndAddHighPivot(int barIndex, PivotType type)
{
    if (totalPivots >= ArraySize(pivots))
        ArrayResize(pivots, totalPivots + 100, 100);
    
    pivots[totalPivots].barIndex = barIndex;
    pivots[totalPivots].time = Time(barIndex);
    pivots[totalPivots].price = High(barIndex);
    pivots[totalPivots].direction = DIR_HIGH;
    pivots[totalPivots].type = type;
    pivots[totalPivots].deviation = currentDeviation;
    pivots[totalPivots].pivotIndex = CountPivotsOfType(type);
    
    switch (type)
    {
        case PIVOT_MAJOR:
            pivots[totalPivots].reason = StringFormat("Major High | Dev: %.4f%%", currentDeviation * 100);
            lastMajorHighPrice = pivots[totalPivots].price;
            break;
        case PIVOT_MINOR:
            pivots[totalPivots].reason = StringFormat("Minor High | Dev: %.4f%%", currentDeviation * 100);
            break;
        case PIVOT_NOISE:
            pivots[totalPivots].reason = StringFormat("Noise High | Dev: %.4f%%", currentDeviation * 100);
            break;
        default:
            pivots[totalPivots].reason = "Unknown High";
    }
    
    totalPivots++;
}

void CreateAndAddLowPivot(int barIndex, PivotType type)
{
    if (totalPivots >= ArraySize(pivots))
        ArrayResize(pivots, totalPivots + 100, 100);
    
    pivots[totalPivots].barIndex = barIndex;
    pivots[totalPivots].time = Time(barIndex);
    pivots[totalPivots].price = Low(barIndex);
    pivots[totalPivots].direction = DIR_LOW;
    pivots[totalPivots].type = type;
    pivots[totalPivots].deviation = currentDeviation;
    pivots[totalPivots].pivotIndex = CountPivotsOfType(type);
    
    switch (type)
    {
        case PIVOT_MAJOR:
            pivots[totalPivots].reason = StringFormat("Major Low | Dev: %.4f%%", currentDeviation * 100);
            lastMajorLowPrice = pivots[totalPivots].price;
            break;
        case PIVOT_MINOR:
            pivots[totalPivots].reason = StringFormat("Minor Low | Dev: %.4f%%", currentDeviation * 100);
            break;
        case PIVOT_NOISE:
            pivots[totalPivots].reason = StringFormat("Noise Low | Dev: %.4f%%", currentDeviation * 100);
            break;
        default:
            pivots[totalPivots].reason = "Unknown Low";
    }
    
    totalPivots++;
}

bool IsPivotDetected(int barIndex)
{
    for (int i = 0; i < totalPivots; i++)
    {
        if (pivots[i].barIndex == barIndex)
            return true;
    }
    return false;
}

int CountPivotsOfType(PivotType type)
{
    int count = 0;
    for (int i = 0; i < totalPivots; i++)
    {
        if (pivots[i].type == type)
            count++;
    }
    return count;
}

//+------------------------------------------------------------------+
// VISUAL RENDERING
//+------------------------------------------------------------------+

void RedrawAllVisuals()
{
    // Remove old pivot markers
    for (int i = 0; i < totalPivots; i++)
    {
        RemovePivotVisuals(i);
    }
    
    // Redraw all pivots based on current settings
    for (int i = 0; i < totalPivots; i++)
    {
        bool shouldDraw = false;
        color pivotColor = clrNONE;
        
        switch (pivots[i].type)
        {
            case PIVOT_MAJOR:
                shouldDraw = ShowMajorPivots;
                pivotColor = (pivots[i].direction == DIR_HIGH) ? ColorMajorHigh : ColorMajorLow;
                break;
            case PIVOT_MINOR:
                shouldDraw = ShowMinorPivots;
                pivotColor = (pivots[i].direction == DIR_HIGH) ? ColorMinorHigh : ColorMinorLow;
                break;
            case PIVOT_NOISE:
                shouldDraw = ShowNoisePivots;
                pivotColor = ColorNoise;
                break;
        }
        
        if (!shouldDraw)
            continue;
        
        DrawPivotMarker(i, pivotColor);
        
        if (ShowPivotLabels)
            DrawPivotLabel(i);
    }
}

void DrawPivotMarker(int pivotIndex, color markerColor)
{
    string objName = "PIVOT_MARKER_" + IntegerToString(pivotIndex);
    
    // Remove old object if exists
    ObjectDelete(_Symbol, objName);
    
    if (pivots[pivotIndex].direction == DIR_HIGH)
    {
        ObjectCreate(_Symbol, objName, OBJ_ARROW_DOWN, 0, pivots[pivotIndex].time, pivots[pivotIndex].price);
    }
    else
    {
        ObjectCreate(_Symbol, objName, OBJ_ARROW_UP, 0, pivots[pivotIndex].time, pivots[pivotIndex].price);
    }
    
    ObjectSetInteger(_Symbol, objName, OBJPROP_COLOR, markerColor);
    ObjectSetInteger(_Symbol, objName, OBJPROP_WIDTH, PivotMarkerSize);
    ObjectSetInteger(_Symbol, objName, OBJPROP_BACK, false);
}

void DrawPivotLabel(int pivotIndex)
{
    string objName = "PIVOT_LABEL_" + IntegerToString(pivotIndex);
    ObjectDelete(_Symbol, objName);
    
    string label = StringFormat("P%d", pivots[pivotIndex].pivotIndex);
    
    if (ShowPivotReason)
        label += "\n" + pivots[pivotIndex].reason;
    
    ObjectCreate(_Symbol, objName, OBJ_TEXT, 0, pivots[pivotIndex].time, pivots[pivotIndex].price);
    ObjectSetString(_Symbol, objName, OBJPROP_TEXT, label);
    ObjectSetInteger(_Symbol, objName, OBJPROP_COLOR, ColorDebugText);
    ObjectSetInteger(_Symbol, objName, OBJPROP_FONTSIZE, LabelFontSize);
}

void RemovePivotVisuals(int pivotIndex)
{
    ObjectDelete(_Symbol, "PIVOT_MARKER_" + IntegerToString(pivotIndex));
    ObjectDelete(_Symbol, "PIVOT_LABEL_" + IntegerToString(pivotIndex));
}

void UpdateDebugDisplay()
{
    if (!ShowDebugInfo)
        return;
    
    string objName = "DEBUG_INFO_PANEL";
    ObjectDelete(_Symbol, objName);
    
    int majorHighCount = CountPivotsOfType(PIVOT_MAJOR);
    int minorHighCount = CountPivotsOfType(PIVOT_MINOR);
    int noiseHighCount = CountPivotsOfType(PIVOT_NOISE);
    
    string info = StringFormat(
        "=== PIVOT DETECTION STATE ===\n"
        "Total Pivots: %d\n"
        "Major: %d | Minor: %d | Noise: %d\n"
        "Last Bar Processed: %d\n"
        "Current Deviation: %.4f%%\n"
        "Status: %s",
        totalPivots,
        majorHighCount + minorHighCount + noiseHighCount,
        minorHighCount,
        noiseHighCount,
        lastDetectionBar,
        currentDeviation * 100,
        debugMessage
    );
    
    ObjectCreate(_Symbol, objName, OBJ_LABEL, 0, 0, 0);
    ObjectSetString(_Symbol, objName, OBJPROP_TEXT, info);
    ObjectSetInteger(_Symbol, objName, OBJPROP_XDISTANCE, 10);
    ObjectSetInteger(_Symbol, objName, OBJPROP_YDISTANCE, 10);
    ObjectSetInteger(_Symbol, objName, OBJPROP_COLOR, ColorDebugText);
    ObjectSetInteger(_Symbol, objName, OBJPROP_FONTSIZE, DebugFontSize);
    ObjectSetInteger(_Symbol, objName, OBJPROP_BACK, false);
}

//+------------------------------------------------------------------+
// UTILITY FUNCTIONS
//+------------------------------------------------------------------+

double High(int barIndex)
{
    return iHigh(_Symbol, _Period, barIndex);
}

double Low(int barIndex)
{
    return iLow(_Symbol, _Period, barIndex);
}

datetime Time(int barIndex)
{
    return iTime(_Symbol, _Period, barIndex);
}

void ClearAllVisuals()
{
    // Remove all pivot markers and labels
    for (int i = 0; i < totalPivots; i++)
    {
        ObjectDelete(_Symbol, "PIVOT_MARKER_" + IntegerToString(i));
        ObjectDelete(_Symbol, "PIVOT_LABEL_" + IntegerToString(i));
    }
    
    // Remove debug panel
    ObjectDelete(_Symbol, "DEBUG_INFO_PANEL");
}

string StringFill(string character, int count)
{
    string result = "";
    for (int i = 0; i < count; i++)
        result += character;
    return result;
}

//+------------------------------------------------------------------+
// END OF PHASE 1
//+------------------------------------------------------------------+
