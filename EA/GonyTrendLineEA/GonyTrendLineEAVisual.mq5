// Recent trendline research EA. It never submits orders.
#ifndef GTLR_RULES_TEST
#property strict
#property version "5.00"
#property description "Recent confirmed trendline research"
#endif

// These pure rules are also exercised by the host-side tests.
struct RecentCandidate
{
    long firstTime;
    long secondTime;
    double firstPrice;
    double secondPrice;
    bool bullish;
    int firstAge;
    int secondAge;
    int importance;
    int touches;
    double score;
    double distance;
    double validity;
    double reaction;
    double alignment;
};

struct RecentWeights
{
    double distance;
    double recency;
    double significance;
    double validity;
    double reaction;
    double alignment;
};

double RecentScore(const double distance, const double recency, const double significance,
                   const double validity, const double reaction, const double alignment,
                   const RecentWeights &weights)
{
    double total = weights.distance + weights.recency + weights.significance +
                   weights.validity + weights.reaction + weights.alignment;
    if(total <= 0)
        return -1;
    return 100.0 * ((distance * weights.distance + recency * weights.recency +
                     significance * weights.significance + validity * weights.validity +
                     reaction * weights.reaction + alignment * weights.alignment) / total);
}

int RecentPivotImportance(const bool high, const double price,
                          const double left, const double right,
                          const double threshold, const double majorMultiplier)
{
    if(high ? (price <= left || price <= right) : (price >= left || price >= right))
        return 0;
    double reference = high ? (left < right ? left : right) : (left > right ? left : right);
    double deviation = high ? (price - reference) / reference : (reference - price) / reference;
    return deviation < threshold ? 1 : deviation < threshold * majorMultiplier ? 2 : 3;
}

double RecentLinePrice(const RecentCandidate &line, const long time)
{
    return line.firstPrice + (line.secondPrice - line.firstPrice) *
           ((double)(time - line.firstTime) / (double)(line.secondTime - line.firstTime));
}

bool RecentPairAllowed(const bool bullish, const double first, const double second,
                       const int spacing, const int minimum, const int maximum)
{
    if(spacing < minimum || spacing > maximum)
        return false;
    return bullish ? second > first : second < first;
}

bool RecentCloseValid(const bool bullish, const double close, const double line,
                      const double tolerance)
{
    return bullish ? close >= line - tolerance : close <= line + tolerance;
}

bool RecentTouch(const double wick, const double line, const double tolerance)
{
    double difference = wick - line;
    return difference >= -tolerance && difference <= tolerance;
}

bool RecentSamePair(const RecentCandidate &a, const RecentCandidate &b)
{
    return a.firstTime == b.firstTime && a.secondTime == b.secondTime &&
           a.bullish == b.bullish;
}

bool RecentBetter(const RecentCandidate &a, const RecentCandidate &b)
{
    if(a.score != b.score) return a.score > b.score;
    if(a.distance != b.distance) return a.distance < b.distance;
    if(a.secondAge != b.secondAge) return a.secondAge < b.secondAge;
    if(a.firstAge != b.firstAge) return a.firstAge < b.firstAge;
    if(a.importance != b.importance) return a.importance > b.importance;
    if(a.validity != b.validity) return a.validity > b.validity;
    if(a.reaction != b.reaction) return a.reaction > b.reaction;
    if(a.alignment != b.alignment) return a.alignment > b.alignment;
    if(a.secondTime != b.secondTime) return a.secondTime > b.secondTime;
    if(a.firstTime != b.firstTime) return a.firstTime > b.firstTime;
    return a.bullish && !b.bullish;
}

bool RecentDuplicate(const RecentCandidate &a, const RecentCandidate &b,
                     const long now, const long earlier, const double tolerance)
{
    if(a.bullish != b.bullish)
        return false;
    double nowDiff = RecentLinePrice(a, now) - RecentLinePrice(b, now);
    double earlierDiff = RecentLinePrice(a, earlier) - RecentLinePrice(b, earlier);
    return nowDiff >= -tolerance && nowDiff <= tolerance &&
           earlierDiff >= -tolerance && earlierDiff <= tolerance;
}

#ifdef GTLR_RULES_TEST
bool RecentAlreadySelected(const RecentCandidate &candidate, const RecentCandidate chosen[],
                           const int count, const long now, const long earlier, const double tolerance)
#else
bool RecentAlreadySelected(const RecentCandidate &candidate, const RecentCandidate &chosen[],
                           const int count, const long now, const long earlier, const double tolerance)
#endif
{
    for(int i = 0; i < count; ++i)
        if(RecentSamePair(candidate, chosen[i]) ||
           RecentDuplicate(candidate, chosen[i], now, earlier, tolerance))
            return true;
    return false;
}

#ifdef GTLR_RULES_TEST
int RecentChoose(const RecentCandidate candidates[], const int count,
                 const RecentCandidate previous[], const int previousCount,
                 RecentCandidate chosen[], const int limit,
                 const long now, const long earlier, const double tolerance)
#else
int RecentChoose(const RecentCandidate &candidates[], const int count,
                 const RecentCandidate &previous[], const int previousCount,
                 RecentCandidate &chosen[], const int limit,
                 const long now, const long earlier, const double tolerance)
#endif
{
    int chosenCount = 0;
    for(int i = 0; i < previousCount && chosenCount < limit; ++i)
    {
        for(int j = 0; j < count; ++j)
        {
            if(!RecentSamePair(previous[i], candidates[j]))
                continue;
            if(!RecentAlreadySelected(candidates[j], chosen, chosenCount, now, earlier, tolerance))
                chosen[chosenCount++] = candidates[j];
            break;
        }
    }
    while(chosenCount < limit)
    {
        int best = -1;
        for(int i = 0; i < count; ++i)
        {
            if(RecentAlreadySelected(candidates[i], chosen, chosenCount, now, earlier, tolerance))
                continue;
            if(best < 0 || RecentBetter(candidates[i], candidates[best]))
                best = i;
        }
        if(best < 0)
            break;
        chosen[chosenCount++] = candidates[best];
    }
    for(int i = 1; i < chosenCount; ++i)
    {
        RecentCandidate item;
        item = chosen[i];
        int j = i;
        while(j > 0 && RecentBetter(item, chosen[j - 1]))
        {
            chosen[j] = chosen[j - 1];
            --j;
        }
        chosen[j] = item;
    }
    return chosenCount;
}

#ifndef GTLR_RULES_TEST
input int    PivotLeftBars = 3;
input int    PivotRightBars = 3;
input double PivotMinDeviation = 0.0001; // Fraction of reference price
input double MajorDeviationMultiplier = 2.0;
input bool   UseNoiseAnchors = false;
input int    RecentBarsLookback = 150;
input int    MaxAnchorAgeBars = 100;
input int    MaxTrendlinesToDisplay = 3;
input double MaxDistanceFromPriceATR = 2.0;
input int    MinAnchorSpacing = 3;
input int    MaxAnchorSpacing = 80;
input int    MinimumTrendlineTouches = 2;
input int    ATRPeriod = 14;
input double TouchToleranceATR = 0.15;
input double BreakToleranceATR = 0.20;
input double ReactionThresholdATR = 0.10;
input double DuplicateToleranceATR = 0.05;
input int    AlignmentLookbackBars = 10;
input double WeightDistance = 40.0;
input double WeightRecency = 25.0;
input double WeightSignificance = 10.0;
input double WeightValidity = 10.0;
input double WeightReaction = 10.0;
input double WeightAlignment = 5.0;
input bool   DebugMode = false;
input bool   WriteResearchCsv = true;

struct RecentPivot
{
    int shift;
    int importance;
    bool high;
};

RecentCandidate active[];
int activeCount = 0;
datetime lastClosedTime = 0;
int csvHandle = INVALID_HANDLE;
bool stopped = false;
bool configLogged = false;
string lastWait = "";
const string PREFIX = "GTLR_REC_";

bool ValidInputs()
{
    return PivotLeftBars >= 1 && PivotLeftBars <= 1000 &&
           PivotRightBars >= 1 && PivotRightBars <= 1000 &&
           MathIsValidNumber(PivotMinDeviation) && PivotMinDeviation > 0 &&
           MathIsValidNumber(MajorDeviationMultiplier) && MajorDeviationMultiplier >= 1 &&
           MathIsValidNumber(PivotMinDeviation * MajorDeviationMultiplier) &&
           RecentBarsLookback >= 2 && RecentBarsLookback <= 2000 &&
           MaxAnchorAgeBars >= 1 && MaxAnchorAgeBars < RecentBarsLookback &&
           MaxTrendlinesToDisplay >= 1 && MaxTrendlinesToDisplay <= 10 &&
           MathIsValidNumber(MaxDistanceFromPriceATR) && MaxDistanceFromPriceATR >= 0 &&
           MinAnchorSpacing >= 1 && MaxAnchorSpacing >= MinAnchorSpacing &&
           MaxAnchorSpacing <= MaxAnchorAgeBars &&
           MinimumTrendlineTouches >= 2 && ATRPeriod >= 1 && ATRPeriod <= 1000 &&
           MathIsValidNumber(TouchToleranceATR) && TouchToleranceATR >= 0 &&
           MathIsValidNumber(BreakToleranceATR) && BreakToleranceATR >= 0 &&
           MathIsValidNumber(ReactionThresholdATR) && ReactionThresholdATR >= 0 &&
           MathIsValidNumber(DuplicateToleranceATR) && DuplicateToleranceATR >= 0 &&
           AlignmentLookbackBars >= 1 && AlignmentLookbackBars < RecentBarsLookback &&
           MathIsValidNumber(WeightDistance) && WeightDistance >= 0 &&
           MathIsValidNumber(WeightRecency) && WeightRecency >= 0 &&
           MathIsValidNumber(WeightSignificance) && WeightSignificance >= 0 &&
           MathIsValidNumber(WeightValidity) && WeightValidity >= 0 &&
           MathIsValidNumber(WeightReaction) && WeightReaction >= 0 &&
           MathIsValidNumber(WeightAlignment) && WeightAlignment >= 0 &&
           MathIsValidNumber(WeightDistance + WeightRecency + WeightSignificance +
                             WeightValidity + WeightReaction + WeightAlignment) &&
           WeightDistance + WeightRecency + WeightSignificance + WeightValidity +
               WeightReaction + WeightAlignment > 0;
}

bool LogEvent(const datetime decisionTime, const string eventType,
              const string direction, const datetime firstTime, const datetime secondTime,
              const string detail)
{
    if(eventType == "rejected" && !DebugMode)
        return true;
    PrintFormat("GTLR %s %s: %s", eventType, direction, detail);
    if(!WriteResearchCsv)
        return true;
    ResetLastError();
    if(FileWrite(csvHandle, TimeToString(decisionTime, TIME_DATE|TIME_SECONDS),
                 eventType, _Symbol, EnumToString(_Period), direction,
                 TimeToString(firstTime, TIME_DATE|TIME_SECONDS),
                 TimeToString(secondTime, TIME_DATE|TIME_SECONDS), detail) == 0)
    {
        PrintFormat("GTLR CSV write failed: %d", GetLastError());
        return false;
    }
    return true;
}

bool OpenResearchLog()
{
    if(!WriteResearchCsv)
        return true;
    string filename = "GTLR_Recent_" + IntegerToString(ChartID()) + ".csv";
    ResetLastError();
    csvHandle = FileOpen(filename, FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_SHARE_READ, ',');
    if(csvHandle == INVALID_HANDLE)
    {
        PrintFormat("GTLR cannot open %s: %d", filename, GetLastError());
        return false;
    }
    if(FileSize(csvHandle) == 0 &&
       FileWrite(csvHandle, "decision_time", "event", "symbol", "timeframe",
                 "direction", "first_anchor", "second_anchor", "detail") == 0)
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
    Print("GTLR CSV: ", filename, " in the terminal/tester MQL5/Files folder");
    return true;
}

bool FlushResearchLog()
{
    if(csvHandle == INVALID_HANDLE)
        return true;
    ResetLastError();
    FileFlush(csvHandle);
    int error = GetLastError();
    if(error != 0)
    {
        PrintFormat("GTLR CSV flush failed: %d", error);
        return false;
    }
    return true;
}

int OnInit()
{
    if(!ValidInputs())
    {
        Print("GTLR invalid inputs; see the input ranges in README.md.");
        return INIT_PARAMETERS_INCORRECT;
    }
    if(!OpenResearchLog())
        return INIT_FAILED;
    if(ObjectsDeleteAll(0, PREFIX) < 0)
    {
        PrintFormat("GTLR cannot clear old research objects: %d", GetLastError());
        return INIT_FAILED;
    }
    return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
    if(ObjectsDeleteAll(0, PREFIX) < 0)
        PrintFormat("GTLR cannot remove research objects: %d", GetLastError());
    if(csvHandle != INVALID_HANDLE)
        FileClose(csvHandle);
}

bool AddPivot(RecentPivot &pivots[], int &count, const int shift,
              const int importance, const bool high)
{
    if(ArrayResize(pivots, count + 1, 128) < 0)
    {
        PrintFormat("GTLR pivot allocation failed: %d", GetLastError());
        return false;
    }
    pivots[count].shift = shift;
    pivots[count].importance = importance;
    pivots[count].high = high;
    count++;
    return true;
}

bool FindPivots(const MqlRates &rates[], const int asOf, RecentPivot &pivots[], int &count)
{
    count = 0;
    int oldest = (int)MathMin(asOf + RecentBarsLookback - 1,
                              ArraySize(rates) - PivotLeftBars - 1);
    for(int shift = oldest; shift >= asOf + PivotRightBars; --shift)
    {
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
        int highImportance = RecentPivotImportance(true, rates[shift].high, leftHigh, rightHigh,
                                                   PivotMinDeviation, MajorDeviationMultiplier);
        if(highImportance > 0 && (highImportance > 1 || UseNoiseAnchors) &&
           !AddPivot(pivots, count, shift, highImportance, true))
            return false;
        int lowImportance = RecentPivotImportance(false, rates[shift].low, leftLow, rightLow,
                                                  PivotMinDeviation, MajorDeviationMultiplier);
        if(lowImportance > 0 && (lowImportance > 1 || UseNoiseAnchors) &&
           !AddPivot(pivots, count, shift, lowImportance, false))
            return false;
    }
    return true;
}

bool CalculateATR(const MqlRates &rates[], const int asOf, double &atr)
{
    double sum = 0;
    for(int i = asOf; i < asOf + ATRPeriod; ++i)
    {
        double range = rates[i].high - rates[i].low;
        range = MathMax(range, MathAbs(rates[i].high - rates[i + 1].close));
        range = MathMax(range, MathAbs(rates[i].low - rates[i + 1].close));
        sum += range;
    }
    atr = sum / ATRPeriod;
    return MathIsValidNumber(atr) && atr > 0;
}

bool EvaluatePair(const MqlRates &rates[], const int asOf, const double atr,
                  const RecentPivot &first, const RecentPivot &second,
                  RecentCandidate &candidate, string &reason)
{
    candidate.bullish = !first.high;
    candidate.firstTime = (long)rates[first.shift].time;
    candidate.secondTime = (long)rates[second.shift].time;
    candidate.firstPrice = first.high ? rates[first.shift].high : rates[first.shift].low;
    candidate.secondPrice = second.high ? rates[second.shift].high : rates[second.shift].low;
    candidate.firstAge = first.shift - asOf;
    candidate.secondAge = second.shift - asOf;
    candidate.importance = first.importance + second.importance;
    int spacing = first.shift - second.shift;
    if(candidate.firstAge > MaxAnchorAgeBars || candidate.secondAge > MaxAnchorAgeBars)
    {
        reason = "anchor exceeds maximum age";
        return false;
    }
    if(!RecentPairAllowed(candidate.bullish, candidate.firstPrice, candidate.secondPrice,
                          spacing, MinAnchorSpacing, MaxAnchorSpacing))
    {
        reason = "anchor spacing or directional slope failed";
        return false;
    }
    if(candidate.secondTime <= candidate.firstTime)
    {
        reason = "anchor timestamps are not increasing";
        return false;
    }
    double currentLine = RecentLinePrice(candidate, (long)rates[asOf].time);
    if(!MathIsValidNumber(currentLine))
    {
        reason = "non-finite line projection";
        return false;
    }
    candidate.distance = MathAbs(rates[asOf].close - currentLine) / atr;
    if(!MathIsValidNumber(candidate.distance) || candidate.distance > MaxDistanceFromPriceATR)
    {
        reason = StringFormat("distance %.4f ATR exceeds %.4f", candidate.distance,
                              MaxDistanceFromPriceATR);
        return false;
    }
    int touches = 0, reactions = 0;
    double minimumBuffer = DBL_MAX;
    for(int i = first.shift; i >= asOf; --i)
    {
        double line = RecentLinePrice(candidate, (long)rates[i].time);
        if(!MathIsValidNumber(line))
        {
            reason = "non-finite line projection";
            return false;
        }
        double buffer = candidate.bullish ? rates[i].close - line : line - rates[i].close;
        if(!RecentCloseValid(candidate.bullish, rates[i].close, line, BreakToleranceATR * atr))
        {
            reason = StringFormat("closed-bar break at %s", TimeToString(rates[i].time));
            return false;
        }
        double normalizedBuffer = buffer / atr;
        if(!MathIsValidNumber(normalizedBuffer))
        {
            reason = "non-finite structural buffer";
            return false;
        }
        minimumBuffer = MathMin(minimumBuffer, normalizedBuffer);
        double wick = candidate.bullish ? rates[i].low : rates[i].high;
        if(i == first.shift || i == second.shift ||
           RecentTouch(wick, line, TouchToleranceATR * atr))
        {
            touches++;
            if(i > asOf)
            {
                double nextLine = RecentLinePrice(candidate, (long)rates[i - 1].time);
                double reaction = candidate.bullish ? rates[i - 1].close - nextLine :
                                                     nextLine - rates[i - 1].close;
                if(reaction >= ReactionThresholdATR * atr)
                    reactions++;
            }
        }
    }
    if(touches < MinimumTrendlineTouches)
    {
        reason = StringFormat("touches %d below minimum %d", touches, MinimumTrendlineTouches);
        return false;
    }
    candidate.touches = touches;
    candidate.validity = MathMin(1.0, MathMax(0.0, minimumBuffer + BreakToleranceATR));
    candidate.reaction = (double)reactions / touches;
    double move = rates[asOf].close - rates[asOf + AlignmentLookbackBars].close;
    candidate.alignment = move == 0 ? 0.5 :
                          (candidate.bullish ? move > 0 : move < 0) ? 1.0 : 0.0;
    RecentWeights weights;
    weights.distance = WeightDistance;
    weights.recency = WeightRecency;
    weights.significance = WeightSignificance;
    weights.validity = WeightValidity;
    weights.reaction = WeightReaction;
    weights.alignment = WeightAlignment;
    double distanceScore = MaxDistanceFromPriceATR > 0
                           ? 1.0 - candidate.distance / MaxDistanceFromPriceATR : 1.0;
    double recencyScore = 1.0 - (double)(candidate.firstAge + candidate.secondAge) /
                          (2.0 * MaxAnchorAgeBars);
    double significanceScore = (candidate.importance - 2.0) / 4.0;
    candidate.score = RecentScore(distanceScore, recencyScore, significanceScore,
                                  candidate.validity, candidate.reaction, candidate.alignment, weights);
    if(!MathIsValidNumber(candidate.validity) || !MathIsValidNumber(candidate.reaction) ||
       !MathIsValidNumber(candidate.score))
    {
        reason = "non-finite candidate quality";
        return false;
    }
    return true;
}

bool AddCandidate(RecentCandidate &candidates[], int &count, const RecentCandidate &candidate)
{
    if(ArrayResize(candidates, count + 1, 128) < 0)
    {
        PrintFormat("GTLR candidate allocation failed: %d", GetLastError());
        return false;
    }
    candidates[count] = candidate;
    count++;
    return true;
}

bool BuildCandidates(const MqlRates &rates[], const int asOf, const double atr,
                     const RecentPivot &pivots[], const int pivotCount,
                     RecentCandidate &candidates[], int &count)
{
    count = 0;
    datetime decisionTime = rates[asOf - 1].time;
    for(int first = 0; first < pivotCount; ++first)
    {
        for(int second = first + 1; second < pivotCount; ++second)
        {
            if(!DebugMode && pivots[first].shift - pivots[second].shift > MaxAnchorSpacing)
                break;
            if(pivots[first].high != pivots[second].high ||
               pivots[first].shift == pivots[second].shift)
                continue;
            RecentCandidate candidate;
            string reason = "";
            if(!EvaluatePair(rates, asOf, atr, pivots[first], pivots[second], candidate, reason))
            {
                if(!LogEvent(decisionTime, "rejected", pivots[first].high ? "bearish" : "bullish",
                             rates[pivots[first].shift].time, rates[pivots[second].shift].time, reason))
                    return false;
                continue;
            }
            if(!AddCandidate(candidates, count, candidate))
                return false;
        }
    }
    return true;
}

string LineName(const RecentCandidate &candidate)
{
    return PREFIX + (candidate.bullish ? "B_" : "S_") +
           IntegerToString(candidate.firstTime) + "_" + IntegerToString(candidate.secondTime);
}

color RankColor(const int rank)
{
    color colors[10] = {clrDeepSkyBlue, clrOrangeRed, clrGold, clrLimeGreen, clrMagenta,
                        clrDodgerBlue, clrTomato, clrViolet, clrAqua, clrYellow};
    return colors[rank];
}

bool DeleteLine(const RecentCandidate &candidate)
{
    string name = LineName(candidate);
    if(ObjectFind(0, name) >= 0 && !ObjectDelete(0, name))
        return false;
    if(ObjectFind(0, name + "_label") >= 0 && !ObjectDelete(0, name + "_label"))
        return false;
    return true;
}

bool DrawLine(const RecentCandidate &candidate, const int rank, const MqlRates &bar)
{
    string name = LineName(candidate);
    datetime firstTime = (datetime)candidate.firstTime;
    datetime secondTime = (datetime)candidate.secondTime;
    double currentLine = RecentLinePrice(candidate, (long)bar.time);
    if(ObjectFind(0, name) < 0 &&
       !ObjectCreate(0, name, OBJ_TREND, 0, firstTime, candidate.firstPrice,
                     secondTime, candidate.secondPrice))
        return false;
    if(!ObjectMove(0, name, 0, firstTime, candidate.firstPrice) ||
       !ObjectMove(0, name, 1, secondTime, candidate.secondPrice) ||
       !ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, true) ||
       !ObjectSetInteger(0, name, OBJPROP_COLOR, RankColor(rank)) ||
       !ObjectSetInteger(0, name, OBJPROP_WIDTH, 2))
        return false;
    string label = name + "_label";
    if(ObjectFind(0, label) < 0 && !ObjectCreate(0, label, OBJ_TEXT, 0, bar.time, currentLine))
        return false;
    string text = StringFormat("#%d %s age %d/%d bars", rank + 1,
                               candidate.bullish ? "bull" : "bear",
                               candidate.firstAge, candidate.secondAge);
    string detail = StringFormat("%s; score %.4f; distance %.4f ATR; touches %d; importance %d; validity %.4f; reaction %.4f; alignment %.1f",
                                 text, candidate.score, candidate.distance, candidate.touches, candidate.importance,
                                 candidate.validity, candidate.reaction, candidate.alignment);
    return ObjectMove(0, label, 0, bar.time, currentLine) &&
           ObjectSetString(0, label, OBJPROP_TEXT, text) &&
           ObjectSetString(0, label, OBJPROP_TOOLTIP, detail) &&
           ObjectSetInteger(0, label, OBJPROP_COLOR, RankColor(rank)) &&
           ObjectSetInteger(0, label, OBJPROP_FONTSIZE, 9) &&
           ObjectSetString(0, name, OBJPROP_TOOLTIP, detail);
}

bool SelectAndDraw(const MqlRates &rates[], const int asOf, const double atr,
                   const RecentCandidate &candidates[], const int count)
{
    RecentCandidate chosen[];
    if(ArrayResize(chosen, MaxTrendlinesToDisplay) < 0)
    {
        PrintFormat("GTLR selection allocation failed: %d", GetLastError());
        return false;
    }
    long now = (long)rates[asOf].time;
    long earlier = (long)rates[asOf + AlignmentLookbackBars].time;
    double tolerance = DuplicateToleranceATR * atr;
    datetime decisionTime = rates[asOf - 1].time;
    int chosenCount = RecentChoose(candidates, count, active, activeCount, chosen,
                                   MaxTrendlinesToDisplay, now, earlier, tolerance);
    if(DebugMode)
    {
        for(int i = 0; i < count; ++i)
        {
            bool selected = false;
            for(int j = 0; j < chosenCount; ++j)
                if(RecentSamePair(candidates[i], chosen[j]))
                    selected = true;
            if(selected)
                continue;
            string reason = RecentAlreadySelected(candidates[i], chosen, chosenCount, now, earlier, tolerance)
                            ? "duplicates a displayed line" : "display limit or stable retention";
            if(!LogEvent(decisionTime, "rejected", candidates[i].bullish ? "bullish" : "bearish",
                         (datetime)candidates[i].firstTime, (datetime)candidates[i].secondTime, reason))
                return false;
        }
    }
    for(int i = 0; i < activeCount; ++i)
    {
        bool retained = false;
        for(int j = 0; j < chosenCount; ++j)
            if(RecentSamePair(active[i], chosen[j]))
                retained = true;
        if(!retained &&
           (!DeleteLine(active[i]) ||
            !LogEvent(decisionTime, "removed", active[i].bullish ? "bullish" : "bearish",
                      (datetime)active[i].firstTime, (datetime)active[i].secondTime,
                      "no longer eligible or duplicates a retained line")))
            return false;
    }
    if(ArrayResize(active, chosenCount, 10) < 0)
    {
        PrintFormat("GTLR active-line allocation failed: %d", GetLastError());
        return false;
    }
    activeCount = chosenCount;
    for(int i = 0; i < chosenCount; ++i)
    {
        active[i] = chosen[i];
        string detail = StringFormat("rank=%d score=%.8f ages=%d/%d distance=%.6f ATR touches=%d importance=%d validity=%.6f reaction=%.6f alignment=%.1f",
                                     i + 1, chosen[i].score, chosen[i].firstAge, chosen[i].secondAge,
                                     chosen[i].distance, chosen[i].touches, chosen[i].importance,
                                     chosen[i].validity, chosen[i].reaction, chosen[i].alignment);
        if(!DrawLine(chosen[i], i, rates[asOf]) ||
           !LogEvent(decisionTime, "display", chosen[i].bullish ? "bullish" : "bearish",
                     (datetime)chosen[i].firstTime, (datetime)chosen[i].secondTime, detail))
            return false;
    }
    if(chosenCount == 0 && !LogEvent(decisionTime, "selection", "", 0, 0, "no eligible lines"))
        return false;
    return true;
}

bool ProcessClosedBar(const MqlRates &rates[], const int asOf)
{
    double atr = 0;
    if(!CalculateATR(rates, asOf, atr))
    {
        if(!LogEvent(rates[asOf - 1].time, "data_issue", "", 0, 0,
                     "ATR is zero or invalid; no lines can be validated"))
            return false;
        RecentCandidate none[];
        return SelectAndDraw(rates, asOf, 0, none, 0) && FlushResearchLog();
    }
    if(!MathIsValidNumber(TouchToleranceATR * atr) ||
       !MathIsValidNumber(BreakToleranceATR * atr) ||
       !MathIsValidNumber(ReactionThresholdATR * atr) ||
       !MathIsValidNumber(DuplicateToleranceATR * atr))
    {
        Print("GTLR ATR-scaled tolerance is not finite.");
        return false;
    }
    RecentPivot pivots[];
    int pivotCount = 0;
    if(!FindPivots(rates, asOf, pivots, pivotCount))
        return false;
    RecentCandidate candidates[];
    int candidateCount = 0;
    if(!BuildCandidates(rates, asOf, atr, pivots, pivotCount, candidates, candidateCount) ||
       !SelectAndDraw(rates, asOf, atr, candidates, candidateCount))
        return false;
    return FlushResearchLog();
}

bool ValidHistory(const MqlRates &rates[], const int asOf, const int history)
{
    if(rates[asOf - 1].time <= rates[asOf].time)
    {
        PrintFormat("GTLR invalid decision timestamp at shift %d.", asOf - 1);
        return false;
    }
    for(int i = asOf; i < asOf + history; ++i)
    {
        if(rates[i].time <= 0 || !MathIsValidNumber(rates[i].high) ||
           !MathIsValidNumber(rates[i].low) || !MathIsValidNumber(rates[i].close) ||
           rates[i].low <= 0 || rates[i].close < rates[i].low ||
           rates[i].close > rates[i].high || rates[i].high < rates[i].low ||
           (i > asOf && rates[i].time >= rates[i - 1].time))
        {
            PrintFormat("GTLR invalid or non-positive history at shift %d.", i);
            return false;
        }
    }
    return true;
}

void WaitForHistory(const string reason)
{
    if(lastWait != reason)
    {
        Print("GTLR waiting: ", reason);
        lastWait = reason;
    }
    if(activeCount > 0)
    {
        for(int i = 0; i < activeCount; ++i)
        {
            if(!DeleteLine(active[i]) ||
               !LogEvent(TimeCurrent(), "removed", active[i].bullish ? "bullish" : "bearish",
                         (datetime)active[i].firstTime, (datetime)active[i].secondTime,
                         "history unavailable; line cannot be validated"))
            {
                PrintFormat("GTLR cannot clear unvalidated lines: %d", GetLastError());
                stopped = true;
                if(ObjectsDeleteAll(0, PREFIX) < 0)
                    PrintFormat("GTLR cannot remove research objects: %d", GetLastError());
                return;
            }
        }
        activeCount = 0;
        ArrayResize(active, 0);
        ChartRedraw();
    }
}

void OnTick()
{
    if(stopped)
        return;
    datetime closed = iTime(_Symbol, _Period, 1);
    if(closed == 0)
    {
        WaitForHistory("last closed bar is unavailable");
        return;
    }
    if(closed == lastClosedTime)
        return;
    int oldestAsOf = 1;
    if(lastClosedTime != 0)
    {
        int previousShift = iBarShift(_Symbol, _Period, lastClosedTime, true);
        if(previousShift < 2)
        {
            Print("GTLR previously processed bar is unavailable; stopping.");
            stopped = true;
            if(ObjectsDeleteAll(0, PREFIX) < 0)
                PrintFormat("GTLR cannot remove research objects: %d", GetLastError());
            return;
        }
        oldestAsOf = previousShift - 1;
    }
    int history = (int)MathMax(RecentBarsLookback + PivotLeftBars, ATRPeriod + 1);
    history = (int)MathMax(history, AlignmentLookbackBars + 1);
    int count = oldestAsOf + history;
    if(Bars(_Symbol, _Period) < count)
    {
        WaitForHistory("insufficient bars for recent lookback, pivot windows and ATR");
        return;
    }
    MqlRates rates[];
    if(!ArraySetAsSeries(rates, true))
    {
        PrintFormat("GTLR cannot set rates array direction: %d", GetLastError());
        stopped = true;
        if(ObjectsDeleteAll(0, PREFIX) < 0)
            PrintFormat("GTLR cannot remove research objects: %d", GetLastError());
        return;
    }
    ResetLastError();
    int copied = CopyRates(_Symbol, _Period, 0, count, rates);
    if(copied != count)
    {
        WaitForHistory(StringFormat("CopyRates returned %d of %d bars, error %d",
                                    copied, count, GetLastError()));
        return;
    }
    lastWait = "";
    if(!configLogged)
    {
        string configuration = StringFormat("lookback=%d maxAge=%d maxLines=%d maxDistanceATR=%.8g spacing=%d..%d touches=%d atrPeriod=%d touchATR=%.8g breakATR=%.8g reactionATR=%.8g duplicateATR=%.8g alignmentBars=%d left=%d right=%d deviation=%.8g majorMultiplier=%.8g noise=%s",
                                            RecentBarsLookback, MaxAnchorAgeBars, MaxTrendlinesToDisplay,
                                            MaxDistanceFromPriceATR, MinAnchorSpacing, MaxAnchorSpacing,
                                            MinimumTrendlineTouches, ATRPeriod, TouchToleranceATR,
                                            BreakToleranceATR, ReactionThresholdATR, DuplicateToleranceATR,
                                            AlignmentLookbackBars, PivotLeftBars, PivotRightBars,
                                            PivotMinDeviation, MajorDeviationMultiplier,
                                            UseNoiseAnchors ? "yes" : "no");
        if(!LogEvent(rates[oldestAsOf - 1].time, "configuration", "", 0, 0, configuration))
        {
            stopped = true;
            if(ObjectsDeleteAll(0, PREFIX) < 0)
                PrintFormat("GTLR cannot remove research objects: %d", GetLastError());
            return;
        }
        string ranking = StringFormat("ranking weights distance=%.8g recency=%.8g significance=%.8g validity=%.8g reaction=%.8g alignment=%.8g",
                                      WeightDistance, WeightRecency, WeightSignificance,
                                      WeightValidity, WeightReaction, WeightAlignment);
        if(!LogEvent(rates[oldestAsOf - 1].time, "ranking_configuration", "", 0, 0, ranking))
        {
            stopped = true;
            if(ObjectsDeleteAll(0, PREFIX) < 0)
                PrintFormat("GTLR cannot remove research objects: %d", GetLastError());
            return;
        }
        configLogged = true;
    }
    for(int asOf = oldestAsOf; asOf >= 1; --asOf)
    {
        ResetLastError();
        if(!ValidHistory(rates, asOf, history) || !ProcessClosedBar(rates, asOf))
        {
            PrintFormat("GTLR processing failed at %s: %d",
                        TimeToString(rates[asOf].time), GetLastError());
            stopped = true;
            if(ObjectsDeleteAll(0, PREFIX) < 0)
                PrintFormat("GTLR cannot remove research objects: %d", GetLastError());
            return;
        }
        lastClosedTime = rates[asOf].time;
    }
    ChartRedraw();
}
#endif
