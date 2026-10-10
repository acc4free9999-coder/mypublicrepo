#ifndef GONY_BOUNCE_BREAK_CORE_MQH
#define GONY_BOUNCE_BREAK_CORE_MQH

double GBBPipSize(const double point,const int digits)
  {
   return point*((digits==3 || digits==5) ? 10.0 : 1.0);
  }

// The caller supplies a series array: index zero is the forming candle.
bool GBBBuildRange(const MqlRates &rates[],const int count,
                   const double max_height,double &support,double &resistance)
  {
   if(count<1 || ArraySize(rates)<count+1 || max_height<=0.0)
      return false;
   support=rates[1].low;
   resistance=rates[1].high;
   for(int i=1;i<=count;i++)
     {
      if(rates[i].low<=0.0 || rates[i].high<rates[i].low)
         return false;
      support=MathMin(support,rates[i].low);
      resistance=MathMax(resistance,rates[i].high);
     }
   double height=resistance-support;
   return height>0.0 && height<=max_height+1e-12;
  }

bool GBBRetestTouch(const int direction,const double previous_bid,
                    const double bid,const double level,const double tolerance)
  {
   if(tolerance<0.0 || bid<level-tolerance || bid>level+tolerance)
      return false;
   if(direction==1)
      return previous_bid>=level && bid<previous_bid;
   if(direction==-1)
      return previous_bid<=level && bid>previous_bid;
   return false;
  }

int GBBBreakoutDirection(const double close,const double support,const double resistance)
  {
   if(close>resistance)
      return 1;
   if(close<support)
      return -1;
   return 0;
  }

// At breakout confirmation the breakout candle is shift 1. The first
// retest candle is forming; expiry starts when that candle window closes.
bool GBBRetestExpired(const int breakout_shift,const int max_wait_bars)
  {
   return breakout_shift>max_wait_bars;
  }

double GBBFloorVolume(const double requested,const double step)
  {
   if(requested<=0.0 || step<=0.0)
      return 0.0;
   return NormalizeDouble(MathFloor(requested/step+1e-9)*step,8);
  }

double GBBTickPrice(const double price,const double tick_size,const int digits)
  {
   if(tick_size<=0.0)
      return 0.0;
   return NormalizeDouble(MathRound(price/tick_size)*tick_size,digits);
  }

#endif
