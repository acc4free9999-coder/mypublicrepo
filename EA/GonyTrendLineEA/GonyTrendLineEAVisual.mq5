// Recent trendline research and opt-in automated trading EA.
#ifndef GTLR_RULES_TEST
#property strict
#property version "6.01"
#property description "Recent trendline research and opt-in trading"
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

enum VirtualReject
{
    VIRTUAL_ACCEPTED = 0,
    VIRTUAL_INVALID_DATA,
    VIRTUAL_INVALID_STOP,
    VIRTUAL_INVALID_TARGET,
    VIRTUAL_LOW_REWARD,
    VIRTUAL_VOLUME_TOO_SMALL
};

struct VirtualSpec
{
    double tickSize;
    double tickValueLoss;
    double tickValueProfit;
    double volumeMin;
    double volumeMax;
    double volumeStep;
    double spread;
    double slippage;
    double commissionPerLot;
    double riskPercent;
};

struct VirtualTrade
{
    bool bullish;
    bool open;
    long entryTime;
    long lastBarTime;
    double entry;
    double stop;
    double target;
    double equity;
    double volume;
    double risk;
    double rewardRisk;
    double mfe;
    double mae;
    double exitPrice;
    double grossProfit;
    double netProfit;
    int outcome;
};

bool VirtualFinite(const double value)
{
#ifdef GTLR_RULES_TEST
    return std::isfinite(value);
#else
    return MathIsValidNumber(value);
#endif
}

double VirtualFloor(const double value)
{
#ifdef GTLR_RULES_TEST
    return std::floor(value);
#else
    return MathFloor(value);
#endif
}

int VirtualPrepare(const bool bullish, const long entryTime, const double bidOpen,
                   const double stop, const double target, const double equity,
                   const VirtualSpec &spec, VirtualTrade &trade)
{
    if(entryTime <= 0 || !VirtualFinite(bidOpen) || bidOpen <= 0 ||
       !VirtualFinite(equity) || equity <= 0 ||
       !VirtualFinite(spec.tickSize) || spec.tickSize <= 0 ||
       !VirtualFinite(spec.tickValueLoss) || spec.tickValueLoss <= 0 ||
       !VirtualFinite(spec.tickValueProfit) || spec.tickValueProfit <= 0 ||
       !VirtualFinite(spec.volumeMin) || spec.volumeMin <= 0 ||
       !VirtualFinite(spec.volumeMax) || spec.volumeMax < spec.volumeMin ||
       !VirtualFinite(spec.volumeStep) || spec.volumeStep <= 0 ||
       !VirtualFinite(spec.spread) || spec.spread < 0 ||
       !VirtualFinite(spec.slippage) || spec.slippage < 0 ||
       !VirtualFinite(spec.commissionPerLot) || spec.commissionPerLot < 0 ||
       !VirtualFinite(spec.riskPercent) || spec.riskPercent <= 0 || spec.riskPercent > 100)
        return VIRTUAL_INVALID_DATA;
    double entry = bullish ? bidOpen + spec.spread + spec.slippage : bidOpen - spec.slippage;
    if(!VirtualFinite(entry) || entry <= 0 || !VirtualFinite(stop) || stop <= 0 ||
       (bullish ? stop >= entry || stop <= spec.slippage : stop <= entry))
        return VIRTUAL_INVALID_STOP;
    if(!VirtualFinite(target) || target <= 0 ||
       (bullish ? target <= entry || target <= spec.slippage : target >= entry))
        return VIRTUAL_INVALID_TARGET;
    double riskDistance = bullish ? entry - stop : stop - entry;
    double rewardDistance = bullish ? target - entry : entry - target;
    double ratio = rewardDistance / riskDistance;
    if(!VirtualFinite(ratio))
        return VIRTUAL_INVALID_DATA;
    trade.rewardRisk = ratio;
    if(ratio + 1e-10 < 3.0)
        return VIRTUAL_LOW_REWARD;
    double riskPerLot = (riskDistance + spec.slippage) / spec.tickSize * spec.tickValueLoss +
                        spec.commissionPerLot;
    double budget = equity * (spec.riskPercent / 100.0);
    if(!VirtualFinite(riskPerLot) || riskPerLot <= 0 || !VirtualFinite(budget) || budget <= 0)
        return VIRTUAL_INVALID_DATA;
    double rawVolume = budget / riskPerLot;
    if(!VirtualFinite(rawVolume))
        return VIRTUAL_INVALID_DATA;
    if(rawVolume > spec.volumeMax)
        rawVolume = spec.volumeMax;
    double volume = VirtualFloor(rawVolume / spec.volumeStep) * spec.volumeStep;
    if(!VirtualFinite(volume) || volume < spec.volumeMin || volume > spec.volumeMax)
        return VIRTUAL_VOLUME_TOO_SMALL;
    double estimatedRisk = volume * riskPerLot;
    if(!VirtualFinite(estimatedRisk) || estimatedRisk > budget)
        return VIRTUAL_INVALID_DATA;
    trade.bullish = bullish;
    trade.open = true;
    trade.entryTime = entryTime;
    trade.lastBarTime = 0;
    trade.entry = entry;
    trade.stop = stop;
    trade.target = target;
    trade.equity = equity;
    trade.volume = volume;
    trade.risk = estimatedRisk;
    trade.rewardRisk = ratio;
    trade.mfe = 0;
    trade.mae = 0;
    trade.exitPrice = 0;
    trade.grossProfit = 0;
    trade.netProfit = 0;
    trade.outcome = 0;
    return VIRTUAL_ACCEPTED;
}

void VirtualExcursion(VirtualTrade &trade, const double price)
{
    double move = trade.bullish ? price - trade.entry : trade.entry - price;
    if(move > trade.mfe)
        trade.mfe = move;
    if(-move > trade.mae)
        trade.mae = -move;
}

// Returns -1 for invalid or out-of-order bars, 0 while open, and 1 on exit.
int VirtualProcessBar(VirtualTrade &trade, const VirtualSpec &spec, const long time,
                      const double bidOpen, const double bidHigh, const double bidLow,
                      const double bidClose)
{
    if(!trade.open || time < trade.entryTime || time <= trade.lastBarTime ||
       !VirtualFinite(bidOpen) || !VirtualFinite(bidHigh) ||
       !VirtualFinite(bidLow) || !VirtualFinite(bidClose) ||
       bidLow <= 0 || bidHigh < bidLow || bidOpen < bidLow || bidOpen > bidHigh ||
       bidClose < bidLow || bidClose > bidHigh)
        return -1;
    double open = bidOpen + (trade.bullish ? 0 : spec.spread);
    double high = bidHigh + (trade.bullish ? 0 : spec.spread);
    double low = bidLow + (trade.bullish ? 0 : spec.spread);
    if(!VirtualFinite(open) || !VirtualFinite(high) || !VirtualFinite(low))
        return -1;
    bool stopHit = trade.bullish ? low <= trade.stop : high >= trade.stop;
    bool targetHit = trade.bullish ? high >= trade.target : low <= trade.target;
    trade.lastBarTime = time;
    VirtualExcursion(trade, open);
    if(!stopHit && !targetHit)
    {
        VirtualExcursion(trade, high);
        VirtualExcursion(trade, low);
        return 0;
    }
    double trigger;
    if(stopHit && (trade.bullish ? open <= trade.stop : open >= trade.stop))
    {
        trade.outcome = -1;
        trigger = open;
    }
    else if(targetHit && (trade.bullish ? open >= trade.target : open <= trade.target))
    {
        trade.outcome = 1;
        trigger = trade.target;
    }
    else if(stopHit)
    {
        trade.outcome = -1;
        trigger = trade.stop;
    }
    else
    {
        trade.outcome = 1;
        trigger = trade.target;
    }
    VirtualExcursion(trade, trigger);
    trade.exitPrice = trade.bullish ? trigger - spec.slippage : trigger + spec.slippage;
    double move = trade.bullish ? trade.exitPrice - trade.entry : trade.entry - trade.exitPrice;
    double tickValue = move >= 0 ? spec.tickValueProfit : spec.tickValueLoss;
    trade.grossProfit = move / spec.tickSize * tickValue * trade.volume;
    trade.netProfit = trade.grossProfit - spec.commissionPerLot * trade.volume;
    if(!VirtualFinite(trade.exitPrice) || trade.exitPrice <= 0 ||
       !VirtualFinite(trade.grossProfit) || !VirtualFinite(trade.netProfit))
        return -1;
    trade.open = false;
    return 1;
}

int AutoBias(const double oldHigh, const double newHigh, const double oldLow, const double newLow)
{
    if(newHigh > oldHigh && newLow > oldLow)
        return 1;
    if(newHigh < oldHigh && newLow < oldLow)
        return -1;
    return 0;
}

bool AutoConfirmation(const bool bullish, const double open, const double high, const double low,
                      const double close, const double line, const double touchTolerance,
                      const double closeBuffer)
{
    double wick = bullish ? low : high;
    return RecentTouch(wick, line, touchTolerance) &&
           (bullish ? close > open && close > line + closeBuffer :
                      close < open && close < line - closeBuffer);
}

bool AutoLevelIntact(const bool resistance, const double close, const double level,
                     const double tolerance)
{
    return resistance ? close <= level + tolerance : close >= level - tolerance;
}

double AutoRewardRisk(const bool bullish, const double entry, const double stop, const double target)
{
    if(!VirtualFinite(entry) || !VirtualFinite(stop) || !VirtualFinite(target) ||
       entry <= 0 || stop <= 0 || target <= 0 ||
       (bullish ? stop >= entry || target <= entry : stop <= entry || target >= entry))
        return -1;
    double risk = bullish ? entry - stop : stop - entry;
    double reward = bullish ? target - entry : entry - target;
    return reward / risk;
}

bool AutoRewardAllowed(const double ratio)
{
    return VirtualFinite(ratio) && ratio + 1e-10 >= 3.0;
}

double AutoVolume(const double equity, const double riskPercent, const double riskPerLot,
                  const double minimum, const double maximum, const double step)
{
    if(!VirtualFinite(equity) || equity <= 0 || !VirtualFinite(riskPercent) ||
       riskPercent <= 0 || riskPercent > 0.5 || !VirtualFinite(riskPerLot) || riskPerLot <= 0 ||
       !VirtualFinite(minimum) || minimum <= 0 || !VirtualFinite(maximum) || maximum < minimum ||
       !VirtualFinite(step) || step <= 0)
        return 0;
    double budget = equity * riskPercent / 100.0;
    double raw = budget / riskPerLot;
    if(!VirtualFinite(budget) || !VirtualFinite(raw) || budget <= 0)
        return 0;
    if(raw > maximum)
        raw = maximum;
    double volume = VirtualFloor(raw / step) * step;
    if(!VirtualFinite(volume) || volume < minimum || volume > maximum ||
       !VirtualFinite(volume * riskPerLot) || volume * riskPerLot > budget)
        return 0;
    return volume;
}

#ifndef GTLR_RULES_TEST
enum VirtualSide
{
    VIRTUAL_BUY,
    VIRTUAL_SELL
};

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
input bool   EnableVirtualSimulation = false;
input datetime VirtualSignalBarTime = D'2020.01.01 00:00';
input VirtualSide VirtualDirection = VIRTUAL_BUY;
input double VirtualStopPrice = 0.0;
input double VirtualTargetPrice = 0.0;
input double VirtualRiskPercent = 0.5;
input double VirtualSpreadPoints = 0.0;
input double VirtualSlippagePoints = 0.0;
input double VirtualCommissionPerLot = 0.0;
input bool   EnableAutoTrading = true;
input bool   AllowRealAccount = true;
input ulong  AutoMagic = 26061901;
input double AutoRiskPercent = 0.5;
input double AutoTouchToleranceATR = 0.15;
input double AutoCloseBufferATR = 0.0;
input double AutoStopBufferATR = 0.20;
input double AutoLevelBreakToleranceATR = 0.0;
input ulong  AutoDeviationPoints = 20;
input double AutoCommissionPerLot = 0.0;

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
VirtualTrade virtualTrade;
VirtualSpec virtualSpec;
bool virtualAttempted = false;
int virtualCsvHandle = INVALID_HANDLE;
string virtualCurrency = "";
string autoLockName = "";
string autoFenceName = "";
string autoFenceFile = "";
string autoLastName = "";
double autoLockOwner = 0;
bool autoLockHeld = false;

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
               WeightReaction + WeightAlignment > 0 &&
           (!EnableVirtualSimulation ||
            (VirtualSignalBarTime > 0 &&
             (VirtualDirection == VIRTUAL_BUY || VirtualDirection == VIRTUAL_SELL) &&
             MathIsValidNumber(VirtualStopPrice) && MathIsValidNumber(VirtualTargetPrice) &&
             MathIsValidNumber(VirtualRiskPercent) && VirtualRiskPercent > 0 && VirtualRiskPercent <= 100 &&
             MathIsValidNumber(VirtualSpreadPoints) && VirtualSpreadPoints >= 0 &&
             MathIsValidNumber(VirtualSlippagePoints) && VirtualSlippagePoints >= 0 &&
             MathIsValidNumber(VirtualCommissionPerLot) && VirtualCommissionPerLot >= 0)) &&
           (!EnableAutoTrading ||
            (WriteResearchCsv && _Period == PERIOD_H1 && MaxTrendlinesToDisplay <= 3 &&
             AutoMagic > 0 && MathIsValidNumber(AutoRiskPercent) && AutoRiskPercent > 0 &&
             AutoRiskPercent <= 0.5 && MathIsValidNumber(AutoTouchToleranceATR) &&
             AutoTouchToleranceATR >= 0 && MathIsValidNumber(AutoCloseBufferATR) &&
             AutoCloseBufferATR >= 0 && MathIsValidNumber(AutoStopBufferATR) &&
             AutoStopBufferATR >= 0 && MathIsValidNumber(AutoLevelBreakToleranceATR) &&
             AutoLevelBreakToleranceATR >= 0 && AutoDeviationPoints <= 1000000 &&
             MathIsValidNumber(AutoCommissionPerLot) && AutoCommissionPerLot >= 0));
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

bool OpenVirtualJournal()
{
    if(!EnableVirtualSimulation)
        return true;
    string filename = "GTLR_Virtual_" + IntegerToString(ChartID()) + ".csv";
    ResetLastError();
    virtualCsvHandle = FileOpen(filename, FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_SHARE_READ, ',');
    if(virtualCsvHandle == INVALID_HANDLE)
    {
        PrintFormat("GTLR cannot open virtual journal %s: %d", filename, GetLastError());
        return false;
    }
    if(FileSize(virtualCsvHandle) == 0 &&
       FileWrite(virtualCsvHandle, "decision_time", "event", "symbol", "timeframe",
                 "h4_bias", "trendline", "confirmation", "signal_bar", "entry_bar",
                 "exit_bar", "direction", "entry", "stop", "target_manual_unverified",
                 "theoretical_rr", "volume_lots", "account_equity", "estimated_stop_risk",
                 "outcome", "mfe_price_lower_bound", "mae_price_lower_bound",
                 "exit_price", "gross_profit", "net_profit", "currency", "risk_percent", "spread_price",
                 "slippage_price_per_fill", "commission_per_lot_round_trip",
                 "tick_size", "tick_value_loss", "tick_value_profit",
                 "volume_min", "volume_max", "volume_step", "reason") == 0)
    {
        PrintFormat("GTLR cannot write virtual journal header: %d", GetLastError());
        FileClose(virtualCsvHandle);
        virtualCsvHandle = INVALID_HANDLE;
        return false;
    }
    if(!FileSeek(virtualCsvHandle, 0, SEEK_END))
    {
        PrintFormat("GTLR cannot seek virtual journal: %d", GetLastError());
        FileClose(virtualCsvHandle);
        virtualCsvHandle = INVALID_HANDLE;
        return false;
    }
    Print("GTLR virtual journal: ", filename, " in the terminal/tester MQL5/Files folder");
    return true;
}

bool VirtualRecord(const datetime when, const string eventType, const string reason)
{
    string outcome = virtualTrade.open ? "open" :
                     virtualTrade.outcome < 0 ? "stop" :
                     virtualTrade.outcome > 0 ? "target" : "none";
    PrintFormat("GTLR virtual %s: %s", eventType, reason);
    ResetLastError();
    if(FileWrite(virtualCsvHandle, TimeToString(when, TIME_DATE|TIME_SECONDS),
                 eventType, _Symbol, EnumToString(_Period),
                 "not_evaluated", "not_evaluated", "manual_unverified",
                 TimeToString(VirtualSignalBarTime, TIME_DATE|TIME_SECONDS),
                 virtualTrade.entryTime > 0 ? TimeToString((datetime)virtualTrade.entryTime, TIME_DATE|TIME_SECONDS) : "",
                 virtualTrade.outcome != 0 ? TimeToString((datetime)virtualTrade.lastBarTime, TIME_DATE|TIME_SECONDS) : "",
                 virtualTrade.bullish ? "buy" : "sell",
                 virtualTrade.entry, virtualTrade.stop, virtualTrade.target, virtualTrade.rewardRisk,
                 virtualTrade.volume, virtualTrade.equity, virtualTrade.risk, outcome,
                 virtualTrade.mfe, virtualTrade.mae, virtualTrade.exitPrice,
                 virtualTrade.grossProfit, virtualTrade.netProfit, virtualCurrency, VirtualRiskPercent,
                 virtualSpec.spread, virtualSpec.slippage, virtualSpec.commissionPerLot,
                 virtualSpec.tickSize, virtualSpec.tickValueLoss, virtualSpec.tickValueProfit,
                 virtualSpec.volumeMin, virtualSpec.volumeMax, virtualSpec.volumeStep, reason) == 0)
    {
        PrintFormat("GTLR virtual journal write failed: %d", GetLastError());
        return false;
    }
    ResetLastError();
    FileFlush(virtualCsvHandle);
    int error = GetLastError();
    if(error != 0)
    {
        PrintFormat("GTLR virtual journal flush failed: %d", error);
        return false;
    }
    return true;
}

string VirtualRejectReason(const int result)
{
    switch(result)
    {
        case VIRTUAL_INVALID_DATA: return "invalid equity, price or symbol specification";
        case VIRTUAL_INVALID_STOP: return "missing or invalid stop";
        case VIRTUAL_INVALID_TARGET: return "missing or invalid manual target";
        case VIRTUAL_LOW_REWARD: return "theoretical price reward/risk below 3";
        case VIRTUAL_VOLUME_TOO_SMALL: return "risk budget cannot fund minimum volume";
    }
    return "unknown rejection";
}

bool LoadVirtualSpec(string &reason)
{
    long chartMode = -1;
    ResetLastError();
    if(!SymbolInfoInteger(_Symbol, SYMBOL_CHART_MODE, chartMode))
    {
        reason = StringFormat("cannot read symbol chart mode: %d", GetLastError());
        return false;
    }
    if(chartMode != SYMBOL_CHART_MODE_BID)
    {
        reason = "only bid-based chart bars are supported by the fixed-spread simulator";
        return false;
    }
    ResetLastError();
    if(!SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE, virtualSpec.tickSize) ||
       !SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE_LOSS, virtualSpec.tickValueLoss) ||
       !SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE_PROFIT, virtualSpec.tickValueProfit) ||
       !SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN, virtualSpec.volumeMin) ||
       !SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX, virtualSpec.volumeMax) ||
       !SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP, virtualSpec.volumeStep))
    {
        reason = StringFormat("cannot read symbol specifications: %d", GetLastError());
        return false;
    }
    virtualSpec.spread = VirtualSpreadPoints * _Point;
    virtualSpec.slippage = VirtualSlippagePoints * _Point;
    virtualSpec.commissionPerLot = VirtualCommissionPerLot;
    virtualSpec.riskPercent = VirtualRiskPercent;
    virtualCurrency = AccountInfoString(ACCOUNT_CURRENCY);
    if(virtualCurrency == "")
    {
        reason = StringFormat("cannot read account currency: %d", GetLastError());
        return false;
    }
    return true;
}

bool ProcessVirtualBar(const MqlRates &bar, const MqlRates &nextBar, const bool timely)
{
    if(!EnableVirtualSimulation)
        return true;
    if(virtualTrade.open)
    {
        int result = VirtualProcessBar(virtualTrade, virtualSpec, (long)bar.time,
                                       bar.open, bar.high, bar.low, bar.close);
        if(result < 0)
        {
            Print("GTLR virtual simulation encountered invalid or out-of-order bar data.");
            return false;
        }
        if(result > 0 && !VirtualRecord(nextBar.time, "exit",
                                        virtualTrade.outcome < 0 ? "stop exit" : "target exit"))
            return false;
    }
    if(virtualAttempted || bar.time < VirtualSignalBarTime)
        return true;
    virtualAttempted = true;
    virtualTrade.bullish = VirtualDirection == VIRTUAL_BUY;
    virtualTrade.stop = VirtualStopPrice;
    virtualTrade.target = VirtualTargetPrice;
    if(bar.time > VirtualSignalBarTime)
        return VirtualRecord(nextBar.time, "rejected", "signal bar unavailable or before simulator start");
    if(!timely || nextBar.tick_volume != 1)
        return VirtualRecord(nextBar.time, "rejected", "signal was not observed at the next bar open");
    virtualTrade.entryTime = (long)nextBar.time;
    string reason = "";
    if(!LoadVirtualSpec(reason))
        return VirtualRecord(nextBar.time, "rejected", reason);
    ResetLastError();
    double equity = AccountInfoDouble(ACCOUNT_EQUITY);
    int equityError = GetLastError();
    if(equityError != 0 || !MathIsValidNumber(equity) || equity <= 0)
        return VirtualRecord(nextBar.time, "rejected",
                             StringFormat("invalid or unavailable account equity: error %d", equityError));
    virtualTrade.equity = equity;
    virtualTrade.entry = virtualTrade.bullish ? nextBar.open + virtualSpec.spread + virtualSpec.slippage :
                                               nextBar.open - virtualSpec.slippage;
    int result = VirtualPrepare(virtualTrade.bullish, (long)nextBar.time, nextBar.open,
                                VirtualStopPrice, VirtualTargetPrice, equity, virtualSpec, virtualTrade);
    if(result != VIRTUAL_ACCEPTED)
        return VirtualRecord(nextBar.time, "rejected", VirtualRejectReason(result));
    return VirtualRecord(nextBar.time, "entry", "manual setup; target is not verified as a key level");
}

bool AutoInitialize()
{
    if(!EnableAutoTrading)
        return true;
    if(AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_REAL && !AllowRealAccount)
    {
        Print("GTLR automatic trading on a real account requires AllowRealAccount=true.");
        return false;
    }
    string base = "GTLRA_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "_" + _Symbol;
    autoLockName = base + "_lock";
    autoFenceName = base + "_fence";
    autoLastName = base + "_last";
    autoFenceFile = autoFenceName + ".txt";
    if(StringLen(autoFenceName) > 63 || StringFind(_Symbol, "/") >= 0 ||
       StringFind(_Symbol, "\\") >= 0 || StringFind(_Symbol, ":") >= 0 ||
       StringFind(_Symbol, "*") >= 0 || StringFind(_Symbol, "?") >= 0 ||
       StringFind(_Symbol, "\"") >= 0 || StringFind(_Symbol, "<") >= 0 ||
       StringFind(_Symbol, ">") >= 0 || StringFind(_Symbol, "|") >= 0)
    {
        Print("GTLR symbol cannot be used in the automatic-trading safety fence name.");
        return false;
    }
    ResetLastError();
    if(!GlobalVariableTemp(autoLockName))
    {
        PrintFormat("GTLR cannot create automatic-trading lock: %d", GetLastError());
        return false;
    }
    autoLockOwner = (double)(ChartID() % 2147483646 + 1);
    if(!GlobalVariableSetOnCondition(autoLockName, autoLockOwner, 0))
    {
        PrintFormat("GTLR another instance holds the symbol lock, or lock failed: %d", GetLastError());
        return false;
    }
    autoLockHeld = true;
    double fence = 0;
    if(GlobalVariableCheck(autoFenceName) && !GlobalVariableGet(autoFenceName, fence))
    {
        PrintFormat("GTLR cannot read automatic-trading safety fence: %d", GetLastError());
        return false;
    }
    if(fence != 0 || FileIsExist(autoFenceFile, FILE_COMMON))
    {
        Alert("GTLR: unresolved previous trade request for ", _Symbol,
              "; reconcile broker orders and positions before clearing the safety fence.");
        return false;
    }
    Print("GTLR automatic trading enabled for ", _Symbol, ". Real losses are possible.");
    return true;
}

int OnInit()
{
    if(!ValidInputs())
    {
        Print("GTLR invalid inputs; see the input ranges in README.md.");
        return INIT_PARAMETERS_INCORRECT;
    }
    if(!OpenResearchLog() || !OpenVirtualJournal() || !AutoInitialize())
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
    if(autoLockHeld && !GlobalVariableSetOnCondition(autoLockName, 0, autoLockOwner))
        PrintFormat("GTLR cannot release automatic-trading lock: %d", GetLastError());
    if(virtualCsvHandle != INVALID_HANDLE)
    {
        if(virtualTrade.open && !VirtualRecord(TimeCurrent(), "open_at_detach", "no exit assumed"))
            Print("GTLR could not journal the open virtual position.");
        FileClose(virtualCsvHandle);
    }
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

bool AutoH4Bias(int &bias, string &reason)
{
    bias = 0;
    MqlRates h4[];
    if(!ArraySetAsSeries(h4, true))
    {
        reason = StringFormat("cannot set H4 array direction: %d", GetLastError());
        return false;
    }
    int needed = RecentBarsLookback + PivotLeftBars;
    ResetLastError();
    int copied = CopyRates(_Symbol, PERIOD_H4, 1, needed, h4);
    if(copied != needed)
    {
        reason = StringFormat("insufficient closed H4 history: %d/%d, error %d",
                              copied, needed, GetLastError());
        return false;
    }
    for(int i = 0; i < copied; ++i)
    {
        if(h4[i].time <= 0 || !MathIsValidNumber(h4[i].high) ||
           !MathIsValidNumber(h4[i].low) || h4[i].low <= 0 || h4[i].high < h4[i].low ||
           (i > 0 && h4[i].time >= h4[i - 1].time))
        {
            reason = "invalid closed H4 history";
            return false;
        }
    }
    RecentPivot pivots[];
    int count = 0;
    if(!FindPivots(h4, 0, pivots, count))
    {
        reason = "cannot allocate H4 pivots";
        return false;
    }
    double highs[2], lows[2];
    int highCount = 0, lowCount = 0;
    for(int i = count - 1; i >= 0 && (highCount < 2 || lowCount < 2); --i)
    {
        if(pivots[i].high && highCount < 2)
            highs[highCount++] = h4[pivots[i].shift].high;
        if(!pivots[i].high && lowCount < 2)
            lows[lowCount++] = h4[pivots[i].shift].low;
    }
    if(highCount < 2 || lowCount < 2)
    {
        reason = "insufficient confirmed H4 swing structure";
        return false;
    }
    bias = AutoBias(highs[1], highs[0], lows[1], lows[0]);
    reason = bias > 0 ? "H4 higher highs and higher lows" :
             bias < 0 ? "H4 lower highs and lower lows" : "H4 structure is neutral";
    return true;
}

bool AutoKeyTarget(const MqlRates &rates[], const int asOf, const bool bullish,
                   const double entry, const double spread, const double atr,
                   double &target, string &reason)
{
    RecentPivot pivots[];
    int count = 0;
    if(!FindPivots(rates, asOf, pivots, count))
    {
        reason = "cannot allocate H1 key levels";
        return false;
    }
    double tolerance = AutoLevelBreakToleranceATR * atr;
    if(!MathIsValidNumber(tolerance))
    {
        reason = "invalid key-level tolerance";
        return false;
    }
    bool found = false;
    for(int p = 0; p < count; ++p)
    {
        if(pivots[p].high != bullish)
            continue;
        double level = bullish ? rates[pivots[p].shift].high : rates[pivots[p].shift].low;
        double executableLevel = bullish ? level : level + spread;
        if(!MathIsValidNumber(executableLevel) ||
           (bullish ? executableLevel <= entry : executableLevel >= entry))
            continue;
        bool intact = true;
        for(int i = pivots[p].shift - 1; i >= asOf; --i)
        {
            if(!AutoLevelIntact(bullish, rates[i].close, level, tolerance))
            {
                intact = false;
                break;
            }
        }
        if(intact && (!found || (bullish ? executableLevel < target : executableLevel > target)))
        {
            target = executableLevel;
            found = true;
        }
    }
    if(!found)
        reason = "no unbroken confirmed H1 key level in the trade direction";
    return found;
}

bool AutoSymbolClear(string &reason)
{
    for(int i = PositionsTotal() - 1; i >= 0; --i)
    {
        if(PositionGetTicket(i) == 0)
        {
            reason = StringFormat("cannot inspect open position: %d", GetLastError());
            return false;
        }
        string positionSymbol = "";
        if(!PositionGetString(POSITION_SYMBOL, positionSymbol) || positionSymbol == "")
        {
            reason = StringFormat("cannot read position symbol: %d", GetLastError());
            return false;
        }
        if(positionSymbol == _Symbol)
        {
            reason = "symbol already has an open position";
            return false;
        }
    }
    for(int i = OrdersTotal() - 1; i >= 0; --i)
    {
        if(OrderGetTicket(i) == 0)
        {
            reason = StringFormat("cannot inspect pending order: %d", GetLastError());
            return false;
        }
        string orderSymbol = "";
        if(!OrderGetString(ORDER_SYMBOL, orderSymbol) || orderSymbol == "")
        {
            reason = StringFormat("cannot read order symbol: %d", GetLastError());
            return false;
        }
        if(orderSymbol == _Symbol)
        {
            reason = "symbol already has an active order";
            return false;
        }
    }
    return true;
}

bool AutoRecord(const datetime when, const string direction, const string detail)
{
    return LogEvent(when, "auto", direction, 0, 0, detail) && FlushResearchLog();
}

bool AutoPersistBeforeSend(const datetime signalTime)
{
    if(FileIsExist(autoFenceFile, FILE_COMMON))
    {
        Print("GTLR persistent trade safety fence already exists.");
        return false;
    }
    ResetLastError();
    int handle = FileOpen(autoFenceFile, FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
    if(handle == INVALID_HANDLE)
    {
        PrintFormat("GTLR cannot create persistent trade safety fence: %d", GetLastError());
        return false;
    }
    if(FileWrite(handle, TimeToString(signalTime, TIME_DATE|TIME_SECONDS)) == 0)
    {
        PrintFormat("GTLR cannot write persistent trade safety fence: %d", GetLastError());
        FileClose(handle);
        return false;
    }
    ResetLastError();
    FileFlush(handle);
    int fileError = GetLastError();
    FileClose(handle);
    if(fileError != 0)
    {
        PrintFormat("GTLR cannot flush persistent trade safety fence: %d", fileError);
        return false;
    }
    ResetLastError();
    if(GlobalVariableSet(autoLastName, (double)signalTime) == 0 ||
       GlobalVariableSet(autoFenceName, (double)signalTime) == 0)
    {
        PrintFormat("GTLR cannot persist trade safety fence: %d", GetLastError());
        return false;
    }
    ResetLastError();
    GlobalVariablesFlush();
    if(GetLastError() != 0)
    {
        PrintFormat("GTLR cannot flush trade safety fence: %d", GetLastError());
        return false;
    }
    return true;
}

bool AutoClearFence()
{
    ResetLastError();
    if(GlobalVariableSet(autoFenceName, 0) == 0)
    {
        PrintFormat("GTLR cannot clear trade safety fence: %d", GetLastError());
        return false;
    }
    ResetLastError();
    GlobalVariablesFlush();
    if(GetLastError() != 0)
    {
        PrintFormat("GTLR cannot flush cleared trade safety fence: %d", GetLastError());
        return false;
    }
    if(!FileDelete(autoFenceFile, FILE_COMMON))
    {
        PrintFormat("GTLR cannot delete resolved trade safety fence: %d", GetLastError());
        return false;
    }
    return true;
}

bool AutoWatchPositions()
{
    if(!EnableAutoTrading)
        return true;
    for(int i = PositionsTotal() - 1; i >= 0; --i)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket == 0)
        {
            PrintFormat("GTLR cannot inspect open position: %d", GetLastError());
            return false;
        }
        string positionSymbol = "";
        long magic = 0;
        if(!PositionGetString(POSITION_SYMBOL, positionSymbol) || positionSymbol == "" ||
           !PositionGetInteger(POSITION_MAGIC, magic))
        {
            PrintFormat("GTLR cannot inspect position details: %d", GetLastError());
            return false;
        }
        if(positionSymbol != _Symbol || magic != (long)AutoMagic)
            continue;
        double stop = 0, target = 0;
        if(!PositionGetDouble(POSITION_SL, stop) || !PositionGetDouble(POSITION_TP, target) ||
           !MathIsValidNumber(stop) || stop <= 0 || !MathIsValidNumber(target) || target <= 0)
        {
            if(!AutoPersistBeforeSend(TimeCurrent()))
                Print("GTLR cannot persist the missing-protection safety fence.");
            Alert("GTLR: position ", ticket, " on ", _Symbol,
                  " has missing SL or TP. Inspect and manage it immediately.");
            return false;
        }
    }
    return true;
}

bool ProcessAutoBar(const MqlRates &rates[], const int asOf, const bool timely)
{
    if(!EnableAutoTrading)
        return true;
    datetime decision = rates[asOf - 1].time;
    if(!timely || rates[asOf - 1].tick_volume != 1)
        return AutoRecord(decision, "", "no order: bar was not observed on its first tick");
    if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED) ||
       !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) || !AccountInfoInteger(ACCOUNT_TRADE_EXPERT))
        return AutoRecord(decision, "", "no order: automatic trading is not permitted");
    double previous = 0;
    if(GlobalVariableCheck(autoLastName) && !GlobalVariableGet(autoLastName, previous))
    {
        PrintFormat("GTLR cannot read last automatic signal: %d", GetLastError());
        return false;
    }
    if(previous >= (double)rates[asOf].time)
        return AutoRecord(decision, "", "no order: signal already attempted");
    string reason = "";
    if(!AutoSymbolClear(reason))
        return AutoRecord(decision, "", "no order: " + reason);
    int bias = 0;
    if(!AutoH4Bias(bias, reason) || bias == 0)
        return AutoRecord(decision, "", "no order: " + reason);
    double atr = 0;
    if(!CalculateATR(rates, asOf, atr))
        return AutoRecord(decision, "", "no order: invalid H1 ATR");
    double touch = AutoTouchToleranceATR * atr;
    double closeBuffer = AutoCloseBufferATR * atr;
    double stopBuffer = AutoStopBufferATR * atr;
    if(!MathIsValidNumber(touch) || !MathIsValidNumber(closeBuffer) || !MathIsValidNumber(stopBuffer))
        return AutoRecord(decision, "", "no order: invalid ATR-scaled confirmation");
    bool bullish = bias > 0;
    int selected = -1;
    for(int i = 0; i < activeCount; ++i)
    {
        if(active[i].bullish != bullish)
            continue;
        double line = RecentLinePrice(active[i], (long)rates[asOf].time);
        if(MathIsValidNumber(line) &&
           AutoConfirmation(bullish, rates[asOf].open, rates[asOf].high, rates[asOf].low,
                            rates[asOf].close, line, touch, closeBuffer))
        {
            selected = i;
            break;
        }
    }
    string direction = bullish ? "buy" : "sell";
    if(selected < 0)
        return AutoRecord(decision, direction, "no order: no confirmed H1 trendline reaction");
    MqlTick tick;
    if(!SymbolInfoTick(_Symbol, tick) || tick.time < decision ||
       !MathIsValidNumber(tick.bid) || !MathIsValidNumber(tick.ask) ||
       tick.bid <= 0 || tick.ask < tick.bid)
        return AutoRecord(decision, direction, "no order: invalid current bid/ask");
    double tickSize = 0, minVolume = 0, maxVolume = 0, volumeStep = 0;
    long chartMode = -1, fillFlags = 0, execution = 0;
    if(!SymbolInfoInteger(_Symbol, SYMBOL_CHART_MODE, chartMode) || chartMode != SYMBOL_CHART_MODE_BID ||
       !SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE, tickSize) ||
       !SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN, minVolume) ||
       !SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX, maxVolume) ||
       !SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP, volumeStep) ||
       !SymbolInfoInteger(_Symbol, SYMBOL_FILLING_MODE, fillFlags) ||
       !SymbolInfoInteger(_Symbol, SYMBOL_TRADE_EXEMODE, execution) ||
       !MathIsValidNumber(tickSize) || tickSize <= 0)
        return AutoRecord(decision, direction, "no order: unsupported chart or unavailable symbol specifications");
    double entry = bullish ? tick.ask : tick.bid;
    double spread = tick.ask - tick.bid;
    double stop = bullish ? rates[asOf].low - stopBuffer : rates[asOf].high + stopBuffer + spread;
    double target = 0;
    if(!AutoKeyTarget(rates, asOf, bullish, entry, spread, atr, target, reason))
        return AutoRecord(decision, direction, "no order: " + reason);
    stop = (bullish ? MathFloor(stop / tickSize) : MathCeil(stop / tickSize)) * tickSize;
    target = (bullish ? MathFloor(target / tickSize) : MathCeil(target / tickSize)) * tickSize;
    stop = NormalizeDouble(stop, _Digits);
    target = NormalizeDouble(target, _Digits);
    if(!MathIsValidNumber(stop) || !MathIsValidNumber(target) || stop <= 0 || target <= 0 ||
       (bullish ? stop >= entry || target <= entry : stop <= entry || target >= entry))
        return AutoRecord(decision, direction, "no order: invalid stop or target");
    double ratio = AutoRewardRisk(bullish, entry, stop, target);
    if(!AutoRewardAllowed(ratio))
        return AutoRecord(decision, direction, StringFormat("no order: theoretical R:R %.8f is below 3", ratio));
    double deviation = (double)AutoDeviationPoints * _Point;
    double worstEntry = bullish ? entry + deviation : entry - deviation;
    double worstExit = bullish ? stop - deviation : stop + deviation;
    if(!MathIsValidNumber(worstEntry) || !MathIsValidNumber(worstExit) ||
       worstEntry <= 0 || worstExit <= 0)
        return AutoRecord(decision, direction, "no order: invalid worst-case price assumptions");
    ENUM_ORDER_TYPE orderType = bullish ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
    double loss = 0;
    ResetLastError();
    if(!OrderCalcProfit(orderType, _Symbol, 1.0, worstEntry, worstExit, loss) ||
       !MathIsValidNumber(loss) || loss >= 0)
        return AutoRecord(decision, direction, StringFormat("no order: cannot estimate stop loss: %d", GetLastError()));
    double equity = AccountInfoDouble(ACCOUNT_EQUITY);
    double riskPerLot = -loss + AutoCommissionPerLot;
    double volume = AutoVolume(equity, AutoRiskPercent, riskPerLot, minVolume, maxVolume, volumeStep);
    if(volume <= 0)
        return AutoRecord(decision, direction, "no order: invalid equity, risk or minimum volume");
    MqlTradeRequest request = {};
    request.action = TRADE_ACTION_DEAL;
    request.symbol = _Symbol;
    request.magic = AutoMagic;
    request.type = orderType;
    request.volume = volume;
    request.price = entry;
    request.sl = stop;
    request.tp = target;
    request.deviation = AutoDeviationPoints;
    request.comment = "GTLR H4 H1";
    if((fillFlags & SYMBOL_FILLING_FOK) != 0)
        request.type_filling = ORDER_FILLING_FOK;
    else if((fillFlags & SYMBOL_FILLING_IOC) != 0)
        request.type_filling = ORDER_FILLING_IOC;
    else if(execution != SYMBOL_TRADE_EXECUTION_MARKET)
        request.type_filling = ORDER_FILLING_RETURN;
    else
        return AutoRecord(decision, direction, "no order: no supported fill policy");
    MqlTradeCheckResult check = {};
    ResetLastError();
    if(!OrderCheck(request, check) || check.retcode != 0)
        return AutoRecord(decision, direction, StringFormat("no order: OrderCheck error=%d retcode=%u %s",
                                                          GetLastError(), check.retcode, check.comment));
    string details = StringFormat("request signal=%s anchors=%I64d/%I64d entry=%.8f stop=%.8f target=%.8f rr=%.6f lots=%.8f equity=%.2f estimatedRisk=%.2f",
                                  TimeToString(rates[asOf].time, TIME_DATE|TIME_SECONDS),
                                  active[selected].firstTime, active[selected].secondTime,
                                  entry, stop, target, ratio, volume, equity, volume * riskPerLot);
    if(!AutoRecord(decision, direction, details) || !AutoPersistBeforeSend(rates[asOf].time))
        return false;
    MqlTradeResult result = {};
    ResetLastError();
    bool sent = OrderSend(request, result);
    int sendError = GetLastError();
    string response = StringFormat("OrderSend sent=%s error=%d retcode=%u order=%I64u deal=%I64u price=%.8f volume=%.8f %s",
                                   sent ? "true" : "false", sendError, result.retcode,
                                   result.order, result.deal, result.price, result.volume, result.comment);
    bool recorded = AutoRecord(decision, direction, response);
    if(!sent || result.retcode != TRADE_RETCODE_DONE || !recorded ||
       !PositionSelect(_Symbol) || PositionGetInteger(POSITION_MAGIC) != (long)AutoMagic ||
       PositionGetInteger(POSITION_TYPE) != (bullish ? POSITION_TYPE_BUY : POSITION_TYPE_SELL) ||
       MathAbs(PositionGetDouble(POSITION_SL) - stop) > tickSize * 0.1 ||
       MathAbs(PositionGetDouble(POSITION_TP) - target) > tickSize * 0.1)
    {
        Alert("GTLR: trade outcome or protective orders require manual reconciliation on ", _Symbol,
              ". Automatic trading stopped; safety fence retained.");
        return false;
    }
    double actualEntry = PositionGetDouble(POSITION_PRICE_OPEN);
    double actualVolume = PositionGetDouble(POSITION_VOLUME);
    double actualLoss = 0;
    double actualRatio = AutoRewardRisk(bullish, actualEntry, stop, target);
    if(!MathIsValidNumber(actualEntry) || !MathIsValidNumber(actualVolume) || actualVolume <= 0 ||
       actualVolume > volume + volumeStep * 0.01 ||
       !AutoRewardAllowed(actualRatio) ||
       !OrderCalcProfit(orderType, _Symbol, actualVolume, actualEntry, worstExit, actualLoss) ||
       !MathIsValidNumber(actualLoss) || actualLoss >= 0 ||
       -actualLoss + AutoCommissionPerLot * actualVolume > equity * AutoRiskPercent / 100.0)
    {
        AutoRecord(decision, direction, "filled position exceeds planned risk or R:R; manual review required");
        Alert("GTLR: filled position exceeds planned risk or R:R on ", _Symbol,
              ". Automatic trading stopped; safety fence retained.");
        return false;
    }
    if(!AutoClearFence())
    {
        Alert("GTLR: could not clear safety fence; automatic trading stopped.");
        return false;
    }
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
           !MathIsValidNumber(rates[i].low) || !MathIsValidNumber(rates[i].open) ||
           !MathIsValidNumber(rates[i].close) ||
           rates[i].low <= 0 || rates[i].close < rates[i].low ||
           rates[i].close > rates[i].high || rates[i].open < rates[i].low ||
           rates[i].open > rates[i].high || rates[i].high < rates[i].low ||
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
    if(!AutoWatchPositions())
    {
        Print("GTLR automatic trading stopped while inspecting open positions.");
        stopped = true;
        return;
    }
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
        if(!ValidHistory(rates, asOf, history) || !ProcessClosedBar(rates, asOf) ||
           !ProcessVirtualBar(rates[asOf], rates[asOf - 1], lastClosedTime != 0 && asOf == 1) ||
           !ProcessAutoBar(rates, asOf, lastClosedTime != 0 && asOf == 1))
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
