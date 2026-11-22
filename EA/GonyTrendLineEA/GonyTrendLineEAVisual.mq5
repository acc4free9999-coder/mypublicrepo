// Gony Trendline Visual Research Engine: Phase 4, research only.
#ifndef GTLR_RULES_TEST
#property strict
#property version "4.00"
#property description "Visual debugging of trendline candidates"
#endif

// Returns 0 for no extremum, 1 noise, 2 minor, 3 major.
int PivotRule(const bool high, const double price, const double left,
              const double right, const double minimum, const double multiplier,
              double &deviation)
{
    if(high ? (price <= left || price <= right) : (price >= left || price >= right))
        return 0;
    double reference = high ? (left < right ? left : right) : (left > right ? left : right);
    if(reference <= 0)
        return 0;
    deviation = high ? (price - reference) / reference : (reference - price) / reference;
    if(deviation < minimum)
        return 1;
    return deviation >= minimum * multiplier ? 3 : 2;
}

// Returns 0 for spacing, 1 for slope, 2 for a candidate.
int CandidateRule(const bool bullish, const double firstPrice, const double secondPrice,
                  const long spacing, const int minimum, const int maximum)
{
    if(spacing < minimum || spacing > maximum)
        return 0;
    if(bullish ? secondPrice <= firstPrice : secondPrice >= firstPrice)
        return 1;
    return 2;
}

struct ScoreFactors
{
    double swing;
    double trend;
    double spacing;
    double slope;
    double interactions;
    double integrity;
    double context;
};

double ScoreRatio(const double value, const double target)
{
    if(value <= 0)
        return 0;
    return value >= target ? 1 : value / target;
}

double DirectionScore(const bool bullish, const double before, const double after)
{
    if(after == before)
        return 0.5;
    return (bullish ? after > before : after < before) ? 1.0 : 0.0;
}

// Bit 1 is a touch; bit 2 is a structural break.
int InteractionFlags(const bool bullish, const double wick, const double line,
                     const double touchTolerance, const double breakTolerance)
{
    double distance = wick - line;
    int flags = distance >= -touchTolerance && distance <= touchTolerance ? 1 : 0;
    if(bullish ? distance < -breakTolerance : distance > breakTolerance)
        flags += 2;
    return flags;
}

bool RankBefore(const double score, const int id, const double otherScore, const int otherId)
{
    return score > otherScore || (score == otherScore && id < otherId);
}

// 0: incomplete, 1: below threshold, 2: alternative, 3: selected.
int CandidateState(const bool complete, const double score, const double minimum, const bool selected)
{
    if(!complete)
        return 0;
    if(score < minimum)
        return 1;
    return selected ? 3 : 2;
}

int SelectBestCandidate(const int best, const bool complete, const double score, const double minimum)
{
    return best >= 0 && CandidateState(complete, score, minimum, true) == 3 ? best : -1;
}

// Missing context is excluded from the denominator, never treated as zero.
double WeightedScore(const ScoreFactors &values, const ScoreFactors &weights,
                     const bool contextAvailable)
{
    double numerator = values.swing * weights.swing + values.trend * weights.trend +
                       values.spacing * weights.spacing + values.slope * weights.slope +
                       values.interactions * weights.interactions +
                       values.integrity * weights.integrity;
    double denominator = weights.swing + weights.trend + weights.spacing + weights.slope +
                         weights.interactions + weights.integrity;
    if(contextAvailable)
    {
        numerator += values.context * weights.context;
        denominator += weights.context;
    }
    return denominator > 0 ? 100.0 * (numerator / denominator) : -1;
}

#ifndef GTLR_RULES_TEST

input int    PivotLeftBars = 3;
input int    PivotRightBars = 3;
input double PivotMinDeviation = 0.0001; // Fraction of price, not percent
input double HigherHighThreshold = 2.0;
input double LowerLowThreshold = 2.0;
input int    InitialHistoryBars = 500;    // Maximum initial pivot bars to inspect

input bool   UseMajorAnchors = true;
input bool   UseMinorAnchors = true;
input bool   UseNoiseAnchors = false;
input int    CandidateMinSpacingBars = 3;
input int    CandidateMaxSpacingBars = 100;
input int    CandidatePreviousAnchors = 5; // Most recent eligible anchors per direction
input bool   ShowBullishCandidates = true;
input bool   ShowBearishCandidates = true;
input bool   ShowCandidateAnchors = true;
input color  ColorBullishCandidate = clrDeepSkyBlue;
input color  ColorBearishCandidate = clrOrangeRed;
input bool   ShowSelectedCandidate = true;
input bool   ShowRejectedCandidates = true;
input color  ColorSelectedCandidate = clrGold;
input color  ColorRejectedCandidate = clrGray;
input double SelectionMinScore = 90.0;

input bool   ShowCandidateScores = true;
input double WeightSwing = 1.0;
input double WeightTrend = 1.0;
input double WeightSpacing = 1.0;
input double WeightSlope = 1.0;
input double WeightInteractions = 1.0;
input double WeightIntegrity = 1.0;
input double WeightTimeframeContext = 1.0;
input int    ScoreTargetSpacingBars = 20;
input double ScoreTargetSlopePointsPerBar = 10.0;
input double ScoreTouchTolerancePoints = 20.0;
input double ScoreBreakTolerancePoints = 30.0;
input int    ScoreTargetTouches = 2;
input int    ScoreBreaksForZero = 3;
input int    ScoreContextBars = 10; // Earlier completed bars on chart timeframe

input bool   ShowMajorPivots = true;
input bool   ShowMinorPivots = true;
input bool   ShowNoisePivots = true;
input bool   ShowPivotLabels = true;
input bool   ShowPivotReason = true;
input bool   ShowDebugInfo = true;
input color  ColorMajorHigh = clrLimeGreen;
input color  ColorMajorLow = clrRed;
input color  ColorMinorHigh = clrLightGreen;
input color  ColorMinorLow = clrLightCoral;
input color  ColorNoise = clrGray;
input color  ColorDebugText = clrWhite;
input int    PivotMarkerSize = 3;
input int    LabelFontSize = 8;
input int    DebugFontSize = 10;
input bool   WriteResearchCsv = true;

enum PivotType { PIVOT_NOISE = 1, PIVOT_MINOR = 2, PIVOT_MAJOR = 3 };
enum PivotDirection { DIR_HIGH = 1, DIR_LOW = 2 };

struct Pivot
{
    datetime time;
    double price;
    PivotDirection direction;
    PivotType type;
    double deviation;
    long sequence;
    string reason;
};

struct Candidate
{
    int first;
    int second;
    bool bullish;
    bool complete;
    double score;
    int rank;
    string explanation;
};

struct RejectedPair
{
    int first;
    int second;
    string reason;
};

Pivot pivots[];
Candidate candidates[];
RejectedPair rejectedPairs[];
int rankedCandidates[];
int rankedCount = 0;
int totalPivots = 0;
int candidateCount = 0;
int rejectedPairCount = 0;
int selectedCandidate = -1;
long barSequence = 0;
datetime lastClosedTime = 0;
int csvHandle = INVALID_HANDLE;
bool failed = false;
bool configLogged = false;
bool interactiveControls = false;
string state = "Waiting for closed bars";
const string PREFIX = "GTLR_P4_";
bool layerMajor, layerMinor, layerNoise, layerBull, layerBear;
bool layerSelected, layerRejected, layerAnchors, layerLabels, layerScores, layerState;

bool LogDecision(const string eventType, const datetime decisionTime,
                 const datetime firstTime, const double firstPrice,
                 const datetime secondTime, const double secondPrice,
                 const string direction, const string outcome, const string reason)
{
    PrintFormat("GTLR %s %s: %s (%s)", eventType, direction, outcome, reason);
    if(!WriteResearchCsv)
        return true;
    ResetLastError();
    if(FileWrite(csvHandle, TimeToString(decisionTime, TIME_DATE|TIME_MINUTES),
                 eventType, _Symbol, EnumToString(_Period),
                 TimeToString(firstTime, TIME_DATE|TIME_MINUTES),
                 DoubleToString(firstPrice, _Digits),
                 TimeToString(secondTime, TIME_DATE|TIME_MINUTES),
                 DoubleToString(secondPrice, _Digits), direction, outcome, reason) == 0)
    {
        PrintFormat("GTLR CSV write failed: %d", GetLastError());
        return false;
    }
    return true;
}

bool SetupLog()
{
    if(!WriteResearchCsv)
        return true;
    string filename = "GTLR_Phase4_" + IntegerToString(ChartID()) + ".csv";
    ResetLastError();
    csvHandle = FileOpen(filename, FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_SHARE_READ, ',');
    if(csvHandle == INVALID_HANDLE)
    {
        PrintFormat("GTLR cannot open CSV %s: %d", filename, GetLastError());
        return false;
    }
    if(FileSize(csvHandle) == 0 &&
       FileWrite(csvHandle, "decision_time", "event", "symbol", "timeframe",
                 "anchor1_time", "anchor1_price", "anchor2_time", "anchor2_price",
                 "direction", "outcome", "reason") == 0)
    {
        PrintFormat("GTLR cannot write CSV header: %d", GetLastError());
        FileClose(csvHandle);
        csvHandle = INVALID_HANDLE;
        return false;
    }
    if(!FileSeek(csvHandle, 0, SEEK_END))
    {
        PrintFormat("GTLR cannot seek CSV: %d", GetLastError());
        FileClose(csvHandle);
        csvHandle = INVALID_HANDLE;
        return false;
    }
    Print("GTLR research CSV: ", filename, " (terminal/tester MQL5/Files)");
    return true;
}

int OnInit()
{
    if(PivotLeftBars < 1 || PivotRightBars < 1 || InitialHistoryBars < 1 ||
       !MathIsValidNumber(PivotMinDeviation) || PivotMinDeviation <= 0 ||
       !MathIsValidNumber(HigherHighThreshold) || HigherHighThreshold < 1 ||
       !MathIsValidNumber(LowerLowThreshold) || LowerLowThreshold < 1 ||
       CandidateMinSpacingBars < 1 || CandidateMaxSpacingBars < CandidateMinSpacingBars ||
       CandidatePreviousAnchors < 1 || PivotMarkerSize < 1 || PivotMarkerSize > 5 ||
       LabelFontSize < 1 || DebugFontSize < 1 ||
       PivotLeftBars > 10000 || PivotRightBars > 10000 || InitialHistoryBars > 100000 ||
       CandidateMaxSpacingBars > 100000 || ScoreContextBars < 1 || ScoreContextBars > 100000 ||
       ScoreTargetSpacingBars < 1 || ScoreTargetTouches < 1 || ScoreBreaksForZero < 1 ||
       !MathIsValidNumber(ScoreTargetSlopePointsPerBar) || ScoreTargetSlopePointsPerBar <= 0 ||
       !MathIsValidNumber(ScoreTouchTolerancePoints) || ScoreTouchTolerancePoints < 0 ||
       !MathIsValidNumber(ScoreBreakTolerancePoints) || ScoreBreakTolerancePoints < 0 ||
       !MathIsValidNumber(WeightSwing) || WeightSwing < 0 ||
       !MathIsValidNumber(WeightTrend) || WeightTrend < 0 ||
       !MathIsValidNumber(WeightSpacing) || WeightSpacing < 0 ||
       !MathIsValidNumber(WeightSlope) || WeightSlope < 0 ||
       !MathIsValidNumber(WeightInteractions) || WeightInteractions < 0 ||
       !MathIsValidNumber(WeightIntegrity) || WeightIntegrity < 0 ||
       !MathIsValidNumber(WeightTimeframeContext) || WeightTimeframeContext < 0 ||
       !MathIsValidNumber(WeightSwing + WeightTrend + WeightSpacing + WeightSlope +
                          WeightInteractions + WeightIntegrity + WeightTimeframeContext) ||
       WeightSwing + WeightTrend + WeightSpacing + WeightSlope + WeightInteractions +
           WeightIntegrity + WeightTimeframeContext <= 0 ||
       !MathIsValidNumber(SelectionMinScore) || SelectionMinScore < 0 || SelectionMinScore > 100 ||
       !MathIsValidNumber(_Point) || _Point <= 0 ||
       !MathIsValidNumber(ScoreTouchTolerancePoints * _Point) ||
       !MathIsValidNumber(ScoreBreakTolerancePoints * _Point))
    {
        Print("GTLR invalid inputs: check pivot, candidate, scoring and display settings.");
        return INIT_PARAMETERS_INCORRECT;
    }
    if(!SetupLog())
        return INIT_FAILED;
    layerMajor = ShowMajorPivots;
    layerMinor = ShowMinorPivots;
    layerNoise = ShowNoisePivots;
    layerBull = ShowBullishCandidates;
    layerBear = ShowBearishCandidates;
    layerSelected = ShowSelectedCandidate;
    layerRejected = ShowRejectedCandidates;
    layerAnchors = ShowCandidateAnchors;
    layerLabels = ShowPivotLabels;
    layerScores = ShowCandidateScores;
    layerState = ShowDebugInfo;
    interactiveControls = !MQLInfoInteger(MQL_TESTER);
    if(interactiveControls && !DrawControls())
    {
        PrintFormat("GTLR controls creation failed: %d", GetLastError());
        return INIT_FAILED;
    }
    PrintFormat("GTLR rules: left=%d right=%d history=%d deviation=%.8f highMultiplier=%.4f lowMultiplier=%.4f spacing=%d..%d previous=%d major=%s minor=%s noise=%s",
                PivotLeftBars, PivotRightBars, InitialHistoryBars, PivotMinDeviation,
                HigherHighThreshold, LowerLowThreshold, CandidateMinSpacingBars,
                CandidateMaxSpacingBars, CandidatePreviousAnchors,
                UseMajorAnchors ? "yes" : "no", UseMinorAnchors ? "yes" : "no",
                UseNoiseAnchors ? "yes" : "no");
    return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
    ObjectsDeleteAll(0, PREFIX);
    if(csvHandle != INVALID_HANDLE)
        FileClose(csvHandle);
}

bool SetText(const string name, const string text, const color textColor, const int size)
{
    return ObjectSetString(0, name, OBJPROP_TEXT, text) &&
           ObjectSetInteger(0, name, OBJPROP_COLOR, textColor) &&
           ObjectSetInteger(0, name, OBJPROP_FONTSIZE, size);
}

bool DrawPivot(const int index)
{
    bool visible = (pivots[index].type == PIVOT_MAJOR && layerMajor) ||
                   (pivots[index].type == PIVOT_MINOR && layerMinor) ||
                   (pivots[index].type == PIVOT_NOISE && layerNoise);
    if(!visible)
        return true;
    color c = ColorNoise;
    if(pivots[index].type == PIVOT_MAJOR)
        c = pivots[index].direction == DIR_HIGH ? ColorMajorHigh : ColorMajorLow;
    if(pivots[index].type == PIVOT_MINOR)
        c = pivots[index].direction == DIR_HIGH ? ColorMinorHigh : ColorMinorLow;
    string id = IntegerToString(index + 1);
    string marker = PREFIX + "P_" + id;
    ENUM_OBJECT type = pivots[index].direction == DIR_HIGH ? OBJ_ARROW_DOWN : OBJ_ARROW_UP;
    if(!ObjectCreate(0, marker, type, 0, pivots[index].time, pivots[index].price) ||
       !ObjectSetInteger(0, marker, OBJPROP_COLOR, c) ||
       !ObjectSetInteger(0, marker, OBJPROP_WIDTH, PivotMarkerSize) ||
       !ObjectSetString(0, marker, OBJPROP_TOOLTIP, pivots[index].reason))
        return false;
    if(layerLabels)
    {
        string label = PREFIX + "PL_" + id;
        string text = "P" + id;
        if(ShowPivotReason)
            text += " " + pivots[index].reason;
        if(!ObjectCreate(0, label, OBJ_TEXT, 0, pivots[index].time, pivots[index].price) ||
           !SetText(label, text, c, LabelFontSize))
            return false;
    }
    return true;
}

bool DrawAnchor(const string id, const int index, const string label, const color c)
{
    string marker = PREFIX + "A_" + id;
    string text = PREFIX + "AL_" + id;
    if(!ObjectCreate(0, marker, OBJ_ARROW, 0, pivots[index].time, pivots[index].price) ||
       !ObjectSetInteger(0, marker, OBJPROP_ARROWCODE, 159) ||
       !ObjectSetInteger(0, marker, OBJPROP_COLOR, c) ||
       !ObjectCreate(0, text, OBJ_TEXT, 0, pivots[index].time, pivots[index].price) ||
       !SetText(text, label, c, LabelFontSize))
        return false;
    return true;
}

int StatusOfCandidate(const int index)
{
    return CandidateState(candidates[index].complete, candidates[index].score,
                          SelectionMinScore, index == selectedCandidate);
}

string CandidateReason(const int index)
{
    int status = StatusOfCandidate(index);
    if(status == 0)
        return "pending: context unavailable";
    if(status == 1)
        return StringFormat("rejected: score %.10f below minimum %.10f",
                            candidates[index].score, SelectionMinScore);
    if(status == 3)
        return StringFormat("selected: highest complete score >= %.10f", SelectionMinScore);
    return "alternative: another candidate ranks higher";
}

bool CandidateVisible(const int index)
{
    int status = StatusOfCandidate(index);
    if(status == 3)
        return layerSelected;
    if(status == 1)
        return layerRejected;
    return candidates[index].bullish ? layerBull : layerBear;
}

bool DrawCandidate(const int index)
{
    if(!CandidateVisible(index))
        return true;
    int first = candidates[index].first;
    int second = candidates[index].second;
    bool bullish = candidates[index].bullish;
    int id = index + 1;
    int status = StatusOfCandidate(index);
    string name = PREFIX + "C_" + IntegerToString(id);
    color c = status == 3 ? ColorSelectedCandidate :
              status == 1 ? ColorRejectedCandidate :
              bullish ? ColorBullishCandidate : ColorBearishCandidate;
    string info = StringFormat("C%d %s: P%d to P%d; scoring",
                               id, bullish ? "bullish" : "bearish", first + 1, second + 1);
    if(!ObjectCreate(0, name, OBJ_TREND, 0, pivots[first].time, pivots[first].price,
                     pivots[second].time, pivots[second].price) ||
       !ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, true) ||
       !ObjectSetInteger(0, name, OBJPROP_COLOR, c) ||
       !ObjectSetInteger(0, name, OBJPROP_WIDTH, status == 3 ? 3 : 1) ||
       !ObjectSetInteger(0, name, OBJPROP_STYLE, status == 3 ? STYLE_SOLID :
                         status == 1 ? STYLE_DOT : STYLE_DASH) ||
       !ObjectSetString(0, name, OBJPROP_TOOLTIP, info))
        return false;
    if(layerAnchors &&
       (!DrawAnchor(IntegerToString(id) + "_1", first, "C" + IntegerToString(id) + " A", c) ||
        !DrawAnchor(IntegerToString(id) + "_2", second, "C" + IntegerToString(id) + " B", c)))
        return false;
    return true;
}

bool RenderScore(const int index)
{
    if(!CandidateVisible(index))
        return true;
    int id = index + 1;
    string rank = candidates[index].complete
                  ? StringFormat("rank #%d", candidates[index].rank)
                  : "unranked: context unavailable";
    string score = candidates[index].score >= 0
                   ? DoubleToString(candidates[index].score, 2)
                   : "N/A";
    string summary = StringFormat("C%d score %s%s; %s; %s; unrounded score %.10f; %s", id, score,
                                  candidates[index].complete ? "" : " provisional",
                                  rank, CandidateReason(index), candidates[index].score,
                                  candidates[index].explanation);
    string line = PREFIX + "C_" + IntegerToString(id);
    if(!ObjectSetString(0, line, OBJPROP_TOOLTIP, summary))
        return false;
    if(layerScores)
    {
        string name = PREFIX + "S_" + IntegerToString(id);
        if(ObjectFind(0, name) < 0 &&
           !ObjectCreate(0, name, OBJ_TEXT, 0,
                         pivots[candidates[index].second].time,
                         pivots[candidates[index].second].price))
            return false;
        int status = StatusOfCandidate(index);
        color c = status == 3 ? ColorSelectedCandidate : status == 1 ? ColorRejectedCandidate :
                  candidates[index].bullish ? ColorBullishCandidate : ColorBearishCandidate;
        string label = StringFormat("C%d %s%s %s %s", id, score,
                                    candidates[index].complete ? "" : "*", rank,
                                    CandidateReason(index));
        if(!SetText(name, label, c, LabelFontSize) ||
           !ObjectSetString(0, name, OBJPROP_TOOLTIP, summary))
            return false;
    }
    return true;
}

bool LogRank(const int index, const datetime decisionTime)
{
    int first = candidates[index].first;
    int second = candidates[index].second;
    string outcome = candidates[index].complete
                     ? StringFormat("C%d rank %d score %.10f", index + 1,
                                    candidates[index].rank, candidates[index].score)
                     : StringFormat("C%d unranked score %s", index + 1,
                                    candidates[index].score >= 0
                                    ? DoubleToString(candidates[index].score, 10) + " provisional"
                                    : "N/A");
    return LogDecision("ranking", decisionTime, pivots[first].time, pivots[first].price,
                       pivots[second].time, pivots[second].price,
                       candidates[index].bullish ? "bullish" : "bearish",
                       outcome, candidates[index].explanation);
}

bool InsertRanking(const int index, const datetime decisionTime)
{
    if(!candidates[index].complete)
        return RenderScore(index) && LogRank(index, decisionTime);
    if(ArrayResize(rankedCandidates, rankedCount + 1, 128) < 0)
    {
        PrintFormat("GTLR ranking allocation failed: %d", GetLastError());
        return false;
    }
    int position = rankedCount;
    while(position > 0 &&
          RankBefore(candidates[index].score, index,
                     candidates[rankedCandidates[position - 1]].score, rankedCandidates[position - 1]))
    {
        rankedCandidates[position] = rankedCandidates[position - 1];
        position--;
    }
    rankedCandidates[position] = index;
    rankedCount++;
    // Earlier candidate IDs keep priority on an exact score tie.
    for(int i = position; i < rankedCount; ++i)
    {
        int affected = rankedCandidates[i];
        candidates[affected].rank = i + 1;
        if(!RenderScore(affected) || !LogRank(affected, decisionTime))
            return false;
    }
    return true;
}

bool DeleteIfPresent(const string name)
{
    return ObjectFind(0, name) < 0 || ObjectDelete(0, name);
}

bool RefreshCandidate(const int index)
{
    string id = IntegerToString(index + 1);
    if(!DeleteIfPresent(PREFIX + "C_" + id) ||
       !DeleteIfPresent(PREFIX + "S_" + id) ||
       !DeleteIfPresent(PREFIX + "A_" + id + "_1") ||
       !DeleteIfPresent(PREFIX + "A_" + id + "_2") ||
       !DeleteIfPresent(PREFIX + "AL_" + id + "_1") ||
       !DeleteIfPresent(PREFIX + "AL_" + id + "_2"))
        return false;
    return DrawCandidate(index) && RenderScore(index);
}

bool UpdateSelection(const datetime decisionTime)
{
    int next = -1;
    if(rankedCount > 0)
    {
        int best = rankedCandidates[0];
        next = SelectBestCandidate(best, candidates[best].complete,
                                   candidates[best].score, SelectionMinScore);
    }
    int previous = selectedCandidate;
    selectedCandidate = next;
    if(previous != next)
    {
        if(previous >= 0 && !RefreshCandidate(previous))
            return false;
        if(next >= 0 && !RefreshCandidate(next))
            return false;
    }
    string outcome = next < 0 ? "none" : "C" + IntegerToString(next + 1);
    string reason = next < 0 ? StringFormat("no complete score >= %.10f", SelectionMinScore) :
                               CandidateReason(next);
    datetime firstTime = 0, secondTime = 0;
    double firstPrice = 0, secondPrice = 0;
    string direction = "";
    if(next >= 0)
    {
        int first = candidates[next].first;
        int second = candidates[next].second;
        firstTime = pivots[first].time;
        firstPrice = pivots[first].price;
        secondTime = pivots[second].time;
        secondPrice = pivots[second].price;
        direction = candidates[next].bullish ? "bullish" : "bearish";
    }
    return LogDecision("selection", decisionTime, firstTime, firstPrice, secondTime,
                       secondPrice, direction, outcome, reason);
}

bool DrawRejectedPair(const int index)
{
    if(!layerRejected)
        return true;
    int first = rejectedPairs[index].first;
    int second = rejectedPairs[index].second;
    string id = IntegerToString(index + 1);
    string name = PREFIX + "R_" + id;
    string label = PREFIX + "RL_" + id;
    string reason = "R" + id + " rejected: " + rejectedPairs[index].reason;
    if(!ObjectCreate(0, name, OBJ_TREND, 0, pivots[first].time, pivots[first].price,
                     pivots[second].time, pivots[second].price) ||
       !ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false) ||
       !ObjectSetInteger(0, name, OBJPROP_COLOR, ColorRejectedCandidate) ||
       !ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DOT) ||
       !ObjectSetString(0, name, OBJPROP_TOOLTIP, reason) ||
       !ObjectCreate(0, label, OBJ_TEXT, 0, pivots[second].time, pivots[second].price) ||
       !SetText(label, reason, ColorRejectedCandidate, LabelFontSize) ||
       !ObjectSetString(0, label, OBJPROP_TOOLTIP, reason))
        return false;
    if(layerAnchors &&
       (!DrawAnchor("R" + id + "_1", first, "R" + id + " A", ColorRejectedCandidate) ||
        !DrawAnchor("R" + id + "_2", second, "R" + id + " B", ColorRejectedCandidate)))
        return false;
    return true;
}

bool AddRejectedPair(const int first, const int second, const string reason)
{
    if(ArrayResize(rejectedPairs, rejectedPairCount + 1, 128) < 0)
    {
        PrintFormat("GTLR rejected-pair allocation failed: %d", GetLastError());
        return false;
    }
    int index = rejectedPairCount++;
    rejectedPairs[index].first = first;
    rejectedPairs[index].second = second;
    rejectedPairs[index].reason = reason;
    return DrawRejectedPair(index);
}

bool ScoreCandidate(const int first, const int second, const MqlRates &rates[],
                    const int secondShift, const datetime decisionTime)
{
    long spacing = pivots[second].sequence - pivots[first].sequence;
    int firstShift = secondShift + (int)spacing;
    int finalShift = secondShift - PivotRightBars;
    if(firstShift >= ArraySize(rates) || rates[firstShift].time != pivots[first].time ||
       finalShift < 1)
    {
        Print("GTLR scoring stopped: anchor history is missing or changed.");
        return false;
    }
    bool bullish = pivots[second].direction == DIR_LOW;
    int touches = 0, breaks = 0;
    double seconds = (double)(pivots[second].time - pivots[first].time);
    if(seconds <= 0)
    {
        Print("GTLR scoring stopped: anchor timestamps are not increasing.");
        return false;
    }
    for(int i = firstShift - 1; i >= finalShift; --i)
    {
        if(i == secondShift)
            continue;
        double progress = (double)(rates[i].time - pivots[first].time) / seconds;
        double line = pivots[first].price + (pivots[second].price - pivots[first].price) * progress;
        if(!MathIsValidNumber(line))
        {
            Print("GTLR scoring stopped: line projection is not finite.");
            return false;
        }
        double wick = bullish ? rates[i].low : rates[i].high;
        int flags = InteractionFlags(bullish, wick, line, ScoreTouchTolerancePoints * _Point,
                                     ScoreBreakTolerancePoints * _Point);
        if((flags & 1) != 0)
            touches++;
        if((flags & 2) != 0)
            breaks++;
    }
    ScoreFactors values, weights;
    values.swing = ((double)(pivots[first].type - 1) + (double)(pivots[second].type - 1)) / 4.0;
    values.trend = DirectionScore(bullish, rates[firstShift].close, rates[finalShift].close);
    values.spacing = ScoreRatio((double)spacing, (double)ScoreTargetSpacingBars);
    double slope = MathAbs(pivots[second].price - pivots[first].price) / _Point / (double)spacing;
    if(!MathIsValidNumber(slope))
    {
        Print("GTLR scoring stopped: slope is not finite.");
        return false;
    }
    values.slope = ScoreRatio(slope, ScoreTargetSlopePointsPerBar);
    values.interactions = ScoreRatio((double)touches, (double)ScoreTargetTouches);
    values.integrity = 1.0 - ScoreRatio((double)breaks, (double)ScoreBreaksForZero);
    int contextShift = finalShift + ScoreContextBars;
    bool hasContext = contextShift < ArraySize(rates);
    values.context = hasContext ? DirectionScore(bullish, rates[contextShift].close,
                                                  rates[finalShift].close) : 0;
    weights.swing = WeightSwing;
    weights.trend = WeightTrend;
    weights.spacing = WeightSpacing;
    weights.slope = WeightSlope;
    weights.interactions = WeightInteractions;
    weights.integrity = WeightIntegrity;
    weights.context = WeightTimeframeContext;
    bool complete = hasContext || WeightTimeframeContext == 0;
    double score = WeightedScore(values, weights, hasContext);
    if(ArrayResize(candidates, candidateCount + 1, 128) < 0)
    {
        PrintFormat("GTLR candidate allocation failed: %d", GetLastError());
        return false;
    }
    int index = candidateCount++;
    candidates[index].first = first;
    candidates[index].second = second;
    candidates[index].bullish = bullish;
    candidates[index].complete = complete;
    candidates[index].score = score;
    candidates[index].rank = 0;
    string context = WeightTimeframeContext == 0 ? "disabled" :
                     hasContext ? DoubleToString(values.context, 6) : "unavailable";
    candidates[index].explanation =
        StringFormat("P%d-P%d; swing=%.6f*%.8g trend=%.6f*%.8g spacing=%.6f*%.8g (%I64d bars) slope=%.6f*%.8g (%.6f points/bar) touches=%.6f*%.8g (%d) integrity=%.6f*%.8g (%d breaks) context=%s*%.8g (%s %d bars); rank: unrounded score descending, earlier ID wins exact ties",
                     first + 1, second + 1, values.swing, weights.swing, values.trend,
                     weights.trend, values.spacing, weights.spacing, spacing, values.slope,
                     weights.slope, slope, values.interactions, weights.interactions, touches,
                     values.integrity, weights.integrity, breaks, context, weights.context,
                     EnumToString(_Period), ScoreContextBars);
    if(!DrawCandidate(index) || !InsertRanking(index, decisionTime) ||
       !UpdateSelection(decisionTime) ||
       !LogDecision("evaluation", decisionTime, pivots[first].time, pivots[first].price,
                    pivots[second].time, pivots[second].price,
                    bullish ? "bullish" : "bearish", "C" + IntegerToString(index + 1),
                    CandidateReason(index)))
        return false;
    return true;
}

bool Eligible(const PivotType type)
{
    return (type == PIVOT_MAJOR && UseMajorAnchors) ||
           (type == PIVOT_MINOR && UseMinorAnchors) ||
           (type == PIVOT_NOISE && UseNoiseAnchors);
}

bool GenerateCandidates(const int second, const datetime decisionTime,
                        const MqlRates &rates[], const int secondShift)
{
    if(!Eligible(pivots[second].type))
        return true;
    int considered = 0;
    bool bullish = pivots[second].direction == DIR_LOW;
    for(int first = second - 1; first >= 0; --first)
    {
        long spacing = pivots[second].sequence - pivots[first].sequence;
        if(spacing > CandidateMaxSpacingBars)
            break;
        if(pivots[first].direction != pivots[second].direction || !Eligible(pivots[first].type))
            continue;
        if(considered >= CandidatePreviousAnchors)
            break;
        considered++;
        int result = CandidateRule(bullish, pivots[first].price, pivots[second].price,
                                   spacing, CandidateMinSpacingBars, CandidateMaxSpacingBars);
        string why = result == 0 ? "spacing below minimum" :
                     result == 1 ? "slope does not match direction" :
                                   "eligible same-direction anchors; directional slope";
        why += StringFormat("; spacing=%I64d bars; range=%d..%d", spacing,
                            CandidateMinSpacingBars, CandidateMaxSpacingBars);
        string direction = bullish ? "bullish" : "bearish";
        string outcome = result == 2 ? "candidate C" + IntegerToString(candidateCount + 1) :
                                       "rejected pair R" + IntegerToString(rejectedPairCount + 1);
        if(!LogDecision("pair", decisionTime, pivots[first].time, pivots[first].price,
                        pivots[second].time, pivots[second].price, direction, outcome, why))
            return false;
        if(result == 2)
        {
            if(!ScoreCandidate(first, second, rates, secondShift, decisionTime))
                return false;
        }
        else if(!AddRejectedPair(first, second, why))
            return false;
    }
    return true;
}

bool AddPivot(const MqlRates &rates[], const int shift, const PivotDirection direction,
              const double deviation, const int classification, const datetime decisionTime)
{
    if(ArrayResize(pivots, totalPivots + 1, 128) < 0)
    {
        PrintFormat("GTLR pivot allocation failed: %d", GetLastError());
        return false;
    }
    int index = totalPivots++;
    pivots[index].time = rates[shift].time;
    pivots[index].price = direction == DIR_HIGH ? rates[shift].high : rates[shift].low;
    pivots[index].direction = direction;
    pivots[index].type = (PivotType)classification;
    pivots[index].deviation = deviation;
    pivots[index].sequence = barSequence;
    string category = classification == 3 ? "major" : classification == 2 ? "minor" : "noise";
    string side = direction == DIR_HIGH ? "high" : "low";
    double major = PivotMinDeviation * (direction == DIR_HIGH ? HigherHighThreshold : LowerLowThreshold);
    pivots[index].reason = StringFormat("%s %s: deviation %.6f%%; minor >= %.6f%%; major >= %.6f%%",
                                        category, side, deviation * 100, PivotMinDeviation * 100, major * 100);
    if(!LogDecision("pivot", decisionTime, pivots[index].time, pivots[index].price,
                    pivots[index].time, pivots[index].price, side, category, pivots[index].reason) ||
       !DrawPivot(index) || !GenerateCandidates(index, decisionTime, rates, shift))
        return false;
    return true;
}

bool ProcessBar(const MqlRates &rates[], const int shift)
{
    barSequence++;
    double leftHigh = rates[shift + 1].high, rightHigh = rates[shift - 1].high;
    double leftLow = rates[shift + 1].low, rightLow = rates[shift - 1].low;
    for(int i = 2; i <= PivotLeftBars; ++i)
    {
        leftHigh = MathMax(leftHigh, rates[shift + i].high);
        leftLow = MathMin(leftLow, rates[shift + i].low);
    }
    for(int i = 2; i <= PivotRightBars; ++i)
    {
        rightHigh = MathMax(rightHigh, rates[shift - i].high);
        rightLow = MathMin(rightLow, rates[shift - i].low);
    }
    // The final right-hand bar is closed only when its successor opens.
    datetime confirmation = rates[shift - PivotRightBars - 1].time;
    double deviation = 0;
    int type = PivotRule(true, rates[shift].high, leftHigh, rightHigh,
                         PivotMinDeviation, HigherHighThreshold, deviation);
    if(type > 0 && !AddPivot(rates, shift, DIR_HIGH, deviation, type, confirmation))
        return false;
    type = PivotRule(false, rates[shift].low, leftLow, rightLow,
                     PivotMinDeviation, LowerLowThreshold, deviation);
    if(type > 0 && !AddPivot(rates, shift, DIR_LOW, deviation, type, confirmation))
        return false;
    return true;
}

string LayerName(const int index)
{
    switch(index)
    {
        case 0: return "Major";
        case 1: return "Minor";
        case 2: return "Noise";
        case 3: return "Bull";
        case 4: return "Bear";
        case 5: return "Selected";
        case 6: return "Rejected";
        case 7: return "Anchors";
        case 8: return "Labels";
        case 9: return "Scores";
        case 10: return "State";
    }
    return "";
}

bool LayerEnabled(const int index)
{
    switch(index)
    {
        case 0: return layerMajor;
        case 1: return layerMinor;
        case 2: return layerNoise;
        case 3: return layerBull;
        case 4: return layerBear;
        case 5: return layerSelected;
        case 6: return layerRejected;
        case 7: return layerAnchors;
        case 8: return layerLabels;
        case 9: return layerScores;
        case 10: return layerState;
    }
    return false;
}

void ToggleLayer(const int index)
{
    switch(index)
    {
        case 0: layerMajor = !layerMajor; break;
        case 1: layerMinor = !layerMinor; break;
        case 2: layerNoise = !layerNoise; break;
        case 3: layerBull = !layerBull; break;
        case 4: layerBear = !layerBear; break;
        case 5: layerSelected = !layerSelected; break;
        case 6: layerRejected = !layerRejected; break;
        case 7: layerAnchors = !layerAnchors; break;
        case 8: layerLabels = !layerLabels; break;
        case 9: layerScores = !layerScores; break;
        case 10: layerState = !layerState; break;
    }
}

bool DrawControls()
{
    for(int i = 0; i < 11; ++i)
    {
        string name = PREFIX + "BTN_" + IntegerToString(i);
        if(ObjectFind(0, name) < 0 && !ObjectCreate(0, name, OBJ_BUTTON, 0, 0, 0))
            return false;
        string text = LayerName(i) + (LayerEnabled(i) ? " ON" : " OFF");
        if(!ObjectSetInteger(0, name, OBJPROP_XDISTANCE, 10 + (i % 4) * 92) ||
           !ObjectSetInteger(0, name, OBJPROP_YDISTANCE, 10 + (i / 4) * 24) ||
           !ObjectSetInteger(0, name, OBJPROP_XSIZE, 88) ||
           !ObjectSetInteger(0, name, OBJPROP_YSIZE, 20) ||
           !ObjectSetInteger(0, name, OBJPROP_COLOR, clrWhite) ||
           !ObjectSetInteger(0, name, OBJPROP_BGCOLOR, LayerEnabled(i) ? clrDarkGreen : clrDimGray) ||
           !ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 8) ||
           !ObjectSetInteger(0, name, OBJPROP_STATE, false) ||
           !ObjectSetString(0, name, OBJPROP_TEXT, text))
            return false;
    }
    return true;
}

bool RebuildVisualLayers()
{
    string groups[] = {"P_", "PL_", "C_", "S_", "A_", "AL_", "R_", "RL_"};
    for(int i = 0; i < ArraySize(groups); ++i)
    {
        if(ObjectsDeleteAll(0, PREFIX + groups[i]) < 0)
            return false;
    }
    for(int i = 0; i < totalPivots; ++i)
        if(!DrawPivot(i))
            return false;
    for(int i = 0; i < candidateCount; ++i)
        if(!DrawCandidate(i) || !RenderScore(i))
            return false;
    for(int i = 0; i < rejectedPairCount; ++i)
        if(!DrawRejectedPair(i))
            return false;
    return true;
}

void UpdateState()
{
    string name = PREFIX + "STATE";
    if(!layerState)
    {
        if(!DeleteIfPresent(name))
            PrintFormat("GTLR state panel removal failed: %d", GetLastError());
        return;
    }
    if(ObjectFind(0, name) < 0 && !ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0))
    {
        PrintFormat("GTLR state panel creation failed: %d", GetLastError());
        return;
    }
    string selected = selectedCandidate < 0 ? "none" : "C" + IntegerToString(selectedCandidate + 1);
    string text = StringFormat("Phase 4 | pivots %d | candidates %d | rejected pairs %d | selected %s | min %.2f | %s",
                               totalPivots, candidateCount, rejectedPairCount,
                               selected, SelectionMinScore, state);
    if(!ObjectSetInteger(0, name, OBJPROP_XDISTANCE, 10) ||
       !ObjectSetInteger(0, name, OBJPROP_YDISTANCE, interactiveControls ? 84 : 10) ||
       !SetText(name, text, ColorDebugText, DebugFontSize))
        PrintFormat("GTLR state panel update failed: %d", GetLastError());
}

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
    if(id != CHARTEVENT_OBJECT_CLICK)
        return;
    for(int i = 0; i < 11; ++i)
    {
        if(sparam != PREFIX + "BTN_" + IntegerToString(i))
            continue;
        ToggleLayer(i);
        ResetLastError();
        if(!DrawControls() || !RebuildVisualLayers())
        {
            failed = true;
            state = "Visual error; see Experts log";
            PrintFormat("GTLR layer update failed: %d", GetLastError());
        }
        UpdateState();
        ChartRedraw();
        return;
    }
}

void OnTick()
{
    if(failed)
        return;
    datetime closed = iTime(_Symbol, _Period, 1);
    if(closed == 0 || closed == lastClosedTime)
        return;
    int available = Bars(_Symbol, _Period);
    int required = PivotLeftBars + PivotRightBars + 2;
    if(available < required)
    {
        state = "Waiting for sufficient history";
        UpdateState();
        return;
    }
    int count;
    int baseCount;
    if(lastClosedTime == 0)
    {
        baseCount = InitialHistoryBars + PivotLeftBars + PivotRightBars + 1;
        count = (int)MathMin(available, baseCount + ScoreContextBars);
    }
    else
    {
        int previousShift = iBarShift(_Symbol, _Period, lastClosedTime, true);
        if(previousShift < 1)
        {
            failed = true;
            state = "History changed; reattach EA";
            Print("GTLR cannot locate previously processed bar; stopped to avoid missing bars.");
            UpdateState();
            return;
        }
        baseCount = previousShift + PivotLeftBars + PivotRightBars + 1;
        if(baseCount > available)
        {
            state = "Waiting for history synchronization";
            UpdateState();
            return;
        }
        count = (int)MathMin(available, baseCount + MathMax(CandidateMaxSpacingBars, ScoreContextBars));
    }
    MqlRates rates[];
    ArraySetAsSeries(rates, true);
    ResetLastError();
    int copied = CopyRates(_Symbol, _Period, 0, count, rates);
    if(copied != count)
    {
        state = "Waiting for price history";
        PrintFormat("GTLR CopyRates returned %d of %d bars: %d", copied, count, GetLastError());
        UpdateState();
        return;
    }
    for(int i = 0; i < copied; ++i)
    {
        if(rates[i].time <= 0 || !MathIsValidNumber(rates[i].high) ||
           !MathIsValidNumber(rates[i].low) || !MathIsValidNumber(rates[i].close) ||
           rates[i].low <= 0 || rates[i].close <= 0 ||
           rates[i].high < rates[i].low)
        {
            failed = true;
            state = "Invalid or non-positive price history";
            PrintFormat("GTLR unsupported or invalid prices at shift %d; stopped.", i);
            UpdateState();
            return;
        }
    }
    if(!configLogged)
    {
        string settings = StringFormat("left=%d right=%d history=%d deviation=%.8f highMultiplier=%.4f lowMultiplier=%.4f spacing=%d..%d previous=%d major=%s minor=%s noise=%s",
                                       PivotLeftBars, PivotRightBars, InitialHistoryBars,
                                       PivotMinDeviation, HigherHighThreshold, LowerLowThreshold,
                                       CandidateMinSpacingBars, CandidateMaxSpacingBars,
                                       CandidatePreviousAnchors, UseMajorAnchors ? "yes" : "no",
                                       UseMinorAnchors ? "yes" : "no", UseNoiseAnchors ? "yes" : "no");
        if(!LogDecision("configuration", rates[0].time, 0, 0, 0, 0, "", "active", settings))
        {
            failed = true;
            state = "CSV error; see Experts log";
            UpdateState();
            return;
        }
        string scoring = StringFormat("weights swing=%.10g trend=%.10g spacing=%.10g slope=%.10g interactions=%.10g integrity=%.10g context=%.10g; spacingTarget=%d slopeTargetPoints=%.10g touchTolerancePoints=%.10g breakTolerancePoints=%.10g touchTarget=%d breaksForZero=%d contextBars=%d timeframe=%s selectionMinimum=%.10g",
                                      WeightSwing, WeightTrend, WeightSpacing, WeightSlope,
                                      WeightInteractions, WeightIntegrity, WeightTimeframeContext,
                                      ScoreTargetSpacingBars, ScoreTargetSlopePointsPerBar,
                                      ScoreTouchTolerancePoints, ScoreBreakTolerancePoints,
                                      ScoreTargetTouches, ScoreBreaksForZero, ScoreContextBars,
                                      EnumToString(_Period), SelectionMinScore);
        if(!LogDecision("score_configuration", rates[0].time, 0, 0, 0, 0, "", "active", scoring))
        {
            failed = true;
            state = "CSV error; see Experts log";
            UpdateState();
            return;
        }
        configLogged = true;
    }
    int oldest = copied - PivotLeftBars - 1;
    if(lastClosedTime == 0)
        oldest = (int)MathMin(oldest, InitialHistoryBars + PivotRightBars);
    for(int shift = oldest; shift >= PivotRightBars + 1; --shift)
    {
        datetime confirmation = rates[shift - PivotRightBars].time;
        if(confirmation <= lastClosedTime)
            continue;
        if(!ProcessBar(rates, shift))
        {
            failed = true;
            state = "Processing error; see Experts log";
            PrintFormat("GTLR processing stopped: %d", GetLastError());
            UpdateState();
            return;
        }
        lastClosedTime = confirmation;
    }
    if(csvHandle != INVALID_HANDLE)
        FileFlush(csvHandle);
    state = "Frozen scores; incomplete context pending";
    UpdateState();
    ChartRedraw();
}
#endif
