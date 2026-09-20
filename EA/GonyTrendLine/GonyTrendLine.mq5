//+------------------------------------------------------------------+
//|                                             GonyTrendLine.mq5     |
//|  Multi-timeframe, ranked swing-point trendline detector.         |
//|  This indicator draws chart objects only; it never trades.        |
//+------------------------------------------------------------------+
#property copyright "Smart Trendline Detector"
#property version   "1.00"
#property strict
#property indicator_chart_window
#property indicator_plots 0

input group "=== Analysis ==="
input ENUM_TIMEFRAMES InpTimeframe = PERIOD_CURRENT; // Analysis timeframe
input int             InpLeftBars = 5;              // Bars to the left of a swing
input int             InpRightBars = 5;             // Bars to the right of a swing
input int             InpBarsToCheck = 500;          // Historical bars to scan
input double          EqualTolerancePoints = 100;     // Equality tolerance (points)
input double          InpTouchPoints = 20;           // Touch tolerance (points)
input bool            UseSmartFilter = true;         // Filter closely-spaced swings
input int             MinBarsBetweenSwings = 8;      // Minimum anchor separation
input int             MaxAllowedHistoricalViolations = 0; // Allowed violations
input int             MaxAnchorSpanBars = 120;        // Maximum bars between anchors
input double          MinSlopePointsPerBar = 1.5;      // Minimum slope (points/bar) to count as a trendline
input bool            DrawAllStandardTimeframes = true; // Draw lines from standard timeframes

input group "=== Trendline Limits ==="
input int MaxTrendlinesOnChart = 4;                  // Maximum active lines
input int MaxUpwardTrendlines = 2;                   // Maximum rising supports
input int MaxDownwardTrendlines = 2;                 // Maximum falling resistances
input bool RequireDirectionalSlope = true;           // Require rising/falling slope

input group "=== Display ==="
input int  FutureBars = 7;                            // Projection bars
input bool ShowSwingDots = false;                     // Show swing anchors
input bool ShowTouchMarkers = true;                  // Show line touches
input bool ShowBrokenLines = true;                   // Retain broken lines
input int  MaxBrokenLinesToShow = 20;                 // Retained broken lines
input bool ShowBreakMarkers = true;                  // Show break markers

input group "=== Ranking ==="
input bool UseRanking = true;                         // Rank candidates
input double RankTouchWeight = 3.0;                  // Touch score weight
input double RankSpanWeight = 1.0;                   // Compactness weight (favors short spans)
input double RankRecencyWeight = 1.0;                // Recency score weight
input double RankViolationPenalty = 5.0;             // Violation penalty

input group "=== Style ==="
input color UpTrendlineColor = clrLimeGreen;          // Rising support color
input color DownTrendlineColor = clrTomato;           // Falling resistance color
input color TouchMarkerColor = clrGold;               // Touch marker color
input color BrokenColor = clrSlateGray;              // Broken line color
input int ActiveLineWidth = 2;                        // Active line width
input int BrokenLineWidth = 1;                        // Broken line width
input ENUM_LINE_STYLE BrokenLineStyle = STYLE_DASH;  // Broken line style

string g_prefix;
ENUM_TIMEFRAMES g_timeframe;
datetime g_lastCalculation = 0;

struct SwingPoint
  {
   int      index;
   datetime time;
   double   price;
   bool     high;
  };

struct TrendCandidate
  {
   int      older;
   int      newer;
   int      olderIndex;
   int      newerIndex;
   datetime olderTime;
   datetime newerTime;
   double   olderPrice;
   double   newerPrice;
   bool     support;
   int      touches;
   int      violations;
   int      span;
   int      breakIndex;
   double   score;
  };

//+------------------------------------------------------------------+
int OnInit()
  {
   g_prefix = "STD_" + IntegerToString(ChartID()) + "_";
   g_timeframe = InpTimeframe == PERIOD_CURRENT ? (ENUM_TIMEFRAMES)_Period : InpTimeframe;
   IndicatorSetString(INDICATOR_SHORTNAME, "GonyTrendLine");
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   DeleteObjects();
  }

//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
  {
   if(rates_total < 2 || InpBarsToCheck < 10)
      return rates_total;

   ENUM_TIMEFRAMES watchTimeframe = DrawAllStandardTimeframes ? PERIOD_M1 : g_timeframe;
   datetime newest = iTime(_Symbol, watchTimeframe, 0);
   if(newest == 0)
      newest = iTime(_Symbol, _Period, 0);
   if(prev_calculated > 0 && newest == g_lastCalculation)
      return rates_total;
   g_lastCalculation = newest;

   DeleteObjects();

   if(DrawAllStandardTimeframes)
     {
      ENUM_TIMEFRAMES timeframes[9] =
        {
         PERIOD_M1, PERIOD_M5, PERIOD_M15, PERIOD_M30,
         PERIOD_H1, PERIOD_H4, PERIOD_D1, PERIOD_W1, PERIOD_MN1
        };
      for(int i = 0; i < ArraySize(timeframes); i++)
         ProcessTimeframe(timeframes[i]);
     }
   else
      ProcessTimeframe(g_timeframe);

   ChartRedraw();
   return rates_total;
  }

//+------------------------------------------------------------------+
void ProcessTimeframe(const ENUM_TIMEFRAMES timeframe)
  {
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int requested = MathMax(InpBarsToCheck, InpLeftBars + InpRightBars + 10);
   int copied = CopyRates(_Symbol, timeframe, 0, requested, rates);
   if(copied <= InpLeftBars + InpRightBars + 2)
      return;

   SwingPoint swings[];
   FindSwings(rates, copied, swings);
   if(ArraySize(swings) < 2)
      return;

   string scope = IntegerToString((int)timeframe) + "_";
   if(ShowSwingDots)
      DrawSwingDots(swings, scope);

   TrendCandidate candidates[];
   BuildCandidates(rates, copied, swings, candidates);
   DrawCandidates(rates, copied, candidates, timeframe, scope);
  }

//+------------------------------------------------------------------+
void FindSwings(const MqlRates &rates[], const int count, SwingPoint &swings[])
  {
   ArrayResize(swings, 0);
   int first = InpRightBars;
   int last = count - InpLeftBars - 1;
   for(int i = first; i <= last; i++)
     {
      bool swingHigh = true;
      bool swingLow = true;
      for(int j = 1; j <= InpLeftBars && (swingHigh || swingLow); j++)
        {
         if(rates[i].high <= rates[i + j].high)
            swingHigh = false;
         if(rates[i].low >= rates[i + j].low)
            swingLow = false;
        }
      for(int j = 1; j <= InpRightBars && (swingHigh || swingLow); j++)
        {
         if(rates[i].high <= rates[i - j].high)
            swingHigh = false;
         if(rates[i].low >= rates[i - j].low)
            swingLow = false;
        }

      if(swingHigh)
         AddSwing(swings, i, rates[i].time, rates[i].high, true);
      if(swingLow)
         AddSwing(swings, i, rates[i].time, rates[i].low, false);
     }
  }

//+------------------------------------------------------------------+
void AddSwing(SwingPoint &swings[], const int index, const datetime time,
              const double price, const bool high)
  {
   int size = ArraySize(swings);
   if(UseSmartFilter && size > 0)
     {
      SwingPoint previous = swings[size - 1];
      if(previous.high == high && MathAbs(previous.index - index) < MinBarsBetweenSwings)
        {
         bool replace = high ? price > previous.price : price < previous.price;
         if(replace)
           {
            swings[size - 1].index = index;
            swings[size - 1].time = time;
            swings[size - 1].price = price;
           }
         return;
        }
     }
   ArrayResize(swings, size + 1);
   swings[size].index = index;
   swings[size].time = time;
   swings[size].price = price;
   swings[size].high = high;
  }

//+------------------------------------------------------------------+
void BuildCandidates(const MqlRates &rates[], const int count,
                     const SwingPoint &swings[], TrendCandidate &candidates[])
  {
   ArrayResize(candidates, 0);
   double tolerance = MathMax(EqualTolerancePoints, 0.0) * _Point;
   for(int newer = 0; newer < ArraySize(swings); newer++)
     {
      for(int older = newer + 1; older < ArraySize(swings); older++)
        {
         if(swings[older].high != swings[newer].high)
            continue;
         int span = MathAbs(swings[older].index - swings[newer].index);
         if(span < MathMax(1, MinBarsBetweenSwings))
            continue;
         if(MaxAnchorSpanBars > 0 && span > MaxAnchorSpanBars)
            continue;

         double slope = (swings[newer].price - swings[older].price) /
                        (double)(swings[older].index - swings[newer].index);
         bool support = !swings[newer].high;
         // Series indexes decrease toward the present, so a rising support
         // has a positive price change from older to newer anchor.
         if(RequireDirectionalSlope &&
            ((support && swings[newer].price <= swings[older].price) ||
             (!support && swings[newer].price >= swings[older].price)))
            continue;
         if(MathAbs(slope) < 1.0e-12)
            continue;
         double minSlope = MathMax(0.0, MinSlopePointsPerBar) * _Point;
         if(MathAbs(slope) < minSlope)
            continue;

         TrendCandidate candidate;
         candidate.older = older;
         candidate.newer = newer;
         candidate.olderIndex = swings[older].index;
         candidate.newerIndex = swings[newer].index;
         candidate.olderTime = swings[older].time;
         candidate.newerTime = swings[newer].time;
         candidate.olderPrice = swings[older].price;
         candidate.newerPrice = swings[newer].price;
         candidate.support = support;
         candidate.span = span;
         candidate.touches = 2;
         candidate.violations = 0;
         candidate.breakIndex = -1;

         for(int k = newer - 1; k >= 0; k--)
           {
            double linePrice = LinePrice(candidate, swings[k].index);
            double distance = MathAbs(swings[k].price - linePrice);
            if(distance <= MathMax(InpTouchPoints, EqualTolerancePoints) * _Point)
               candidate.touches++;
           }

         int start = swings[newer].index + 1;
         int end = swings[older].index;
         for(int bar = start; bar < end; bar++)
           {
            double linePrice = LinePrice(candidate, bar);
            bool violation = support ? rates[bar].low < linePrice - tolerance
                                     : rates[bar].high > linePrice + tolerance;
            if(violation)
              {
               candidate.violations++;
               if(candidate.breakIndex < 0)
                  candidate.breakIndex = bar;
              }
           }
         // A break after the newer anchor is confirmed by a closed candle.
         for(int bar = swings[newer].index - 1; bar >= 1; bar--)
           {
            double linePrice = LinePrice(candidate, bar);
            bool broken = support ? rates[bar].close < linePrice - tolerance
                                  : rates[bar].close > linePrice + tolerance;
            if(broken)
              {
               candidate.breakIndex = bar;
               break;
              }
           }
         if(candidate.violations > MathMax(0, MaxAllowedHistoricalViolations))
            continue;

         candidate.score = ScoreCandidate(candidate);
         AddCandidate(candidates, candidate);
        }
     }
   SortCandidates(candidates);
  }

//+------------------------------------------------------------------+
double LinePrice(const TrendCandidate &candidate, const int index)
  {
   double indexSpan = (double)(candidate.olderIndex - candidate.newerIndex);
   if(indexSpan == 0.0)
      return candidate.newerPrice;
   return candidate.newerPrice +
          (candidate.olderPrice - candidate.newerPrice) *
          ((double)(index - candidate.newerIndex) / indexSpan);
  }

//+------------------------------------------------------------------+
double ScoreCandidate(const TrendCandidate &candidate)
  {
   if(!UseRanking)
      return 0.0;
   double recency = 1.0 / (1.0 + candidate.newer);
   double compactness = 1.0 / (1.0 + candidate.span);
   return RankTouchWeight * candidate.touches +
          RankSpanWeight * compactness +
          RankRecencyWeight * recency -
          RankViolationPenalty * candidate.violations;
  }

//+------------------------------------------------------------------+
void AddCandidate(TrendCandidate &candidates[], const TrendCandidate &candidate)
  {
   int size = ArraySize(candidates);
   ArrayResize(candidates, size + 1);
   candidates[size] = candidate;
  }

//+------------------------------------------------------------------+
void SortCandidates(TrendCandidate &candidates[])
  {
   for(int i = 0; i < ArraySize(candidates) - 1; i++)
      for(int j = i + 1; j < ArraySize(candidates); j++)
         if(candidates[j].score > candidates[i].score)
           {
            TrendCandidate temporary = candidates[i];
            candidates[i] = candidates[j];
            candidates[j] = temporary;
           }
  }

//+------------------------------------------------------------------+
void DrawCandidates(const MqlRates &rates[], const int count,
                    const TrendCandidate &candidates[],
                    const ENUM_TIMEFRAMES timeframe, const string scope)
  {
   int displayed = 0;
   int upward = 0;
   int downward = 0;
   int broken = 0;
   int maxTotal = MathMax(0, MaxTrendlinesOnChart);
   int maxUp = MathMax(0, MaxUpwardTrendlines);
   int maxDown = MathMax(0, MaxDownwardTrendlines);
   for(int i = 0; i < ArraySize(candidates) && displayed < maxTotal; i++)
     {
      const TrendCandidate candidate = candidates[i];
      if(candidate.support && upward >= maxUp)
         continue;
      if(!candidate.support && downward >= maxDown)
         continue;

      if(candidate.breakIndex >= 0)
        {
         if(!ShowBrokenLines || broken >= MathMax(0, MaxBrokenLinesToShow))
            continue;
         DrawLine(candidate, rates[candidate.breakIndex].time,
                  LinePrice(candidate, candidate.breakIndex), true, i, scope);
         if(ShowBreakMarkers)
            DrawMarker(scope + "break_" + IntegerToString(i), rates[candidate.breakIndex].time,
                       LinePrice(candidate, candidate.breakIndex), 251, BrokenColor);
         broken++;
         displayed++;
         continue;
        }

      int seconds = PeriodSeconds(timeframe);
      if(seconds <= 0)
         seconds = PeriodSeconds(_Period);
      int futureBars = MathMax(0, FutureBars);
      datetime endTime = rates[0].time + (datetime)(futureBars * seconds);
      DrawLine(candidate, endTime, LinePrice(candidate, -futureBars), false, i, scope);
      DrawTouches(candidate, rates, count, i, scope);
      displayed++;
      if(candidate.support)
         upward++;
      else
         downward++;
     }
  }

//+------------------------------------------------------------------+
void DrawLine(const TrendCandidate &candidate, const datetime endTime,
              const double endPrice, const bool broken, const int id,
              const string scope)
  {
   string name = g_prefix + scope + (broken ? "broken_" : "active_") + IntegerToString(id);
   if(!ObjectCreate(0, name, OBJ_TREND, 0, candidate.olderTime, candidate.olderPrice,
                    endTime, endPrice))
      return;
   ObjectSetInteger(0, name, OBJPROP_COLOR, broken ? BrokenColor :
                    (candidate.support ? UpTrendlineColor : DownTrendlineColor));
   ObjectSetInteger(0, name, OBJPROP_WIDTH, broken ? BrokenLineWidth : ActiveLineWidth);
   ObjectSetInteger(0, name, OBJPROP_STYLE, broken ? BrokenLineStyle : STYLE_SOLID);
   ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false);
   ObjectSetInteger(0, name, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
  }

//+------------------------------------------------------------------+
void DrawTouches(const TrendCandidate &candidate, const MqlRates &rates[],
                 const int count, const int id, const string scope)
  {
   if(!ShowTouchMarkers)
      return;
   double tolerance = MathMax(InpTouchPoints, EqualTolerancePoints) * _Point;
   int marker = 0;
   for(int bar = candidate.newerIndex - 1; bar >= 0 && bar < count; bar--)
     {
      double linePrice = LinePrice(candidate, bar);
      bool touched = candidate.support ? MathAbs(rates[bar].low - linePrice) <= tolerance
                                       : MathAbs(rates[bar].high - linePrice) <= tolerance;
      if(touched)
        {
         DrawMarker(scope + "touch_" + IntegerToString(id) + "_" + IntegerToString(marker++),
                    rates[bar].time, linePrice, 159, TouchMarkerColor);
        }
     }
  }

//+------------------------------------------------------------------+
void DrawSwingDots(const SwingPoint &swings[], const string scope)
  {
   for(int i = 0; i < ArraySize(swings); i++)
      DrawMarker(scope + "swing_" + IntegerToString(i), swings[i].time, swings[i].price,
                 swings[i].high ? 217 : 218,
                 swings[i].high ? DownTrendlineColor : UpTrendlineColor);
  }

//+------------------------------------------------------------------+
void DrawMarker(const string suffix, const datetime time, const double price,
                const int arrowCode, const color markerColor)
  {
   string name = g_prefix + suffix;
   if(!ObjectCreate(0, name, OBJ_ARROW, 0, time, price))
      return;
   ObjectSetInteger(0, name, OBJPROP_ARROWCODE, arrowCode);
   ObjectSetInteger(0, name, OBJPROP_COLOR, markerColor);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, name, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
  }

//+------------------------------------------------------------------+
void DeleteObjects()
  {
   for(int i = ObjectsTotal(0, 0, -1) - 1; i >= 0; i--)
     {
      string name = ObjectName(0, i, 0, -1);
      if(StringFind(name, g_prefix) == 0)
         ObjectDelete(0, name);
     }
  }
