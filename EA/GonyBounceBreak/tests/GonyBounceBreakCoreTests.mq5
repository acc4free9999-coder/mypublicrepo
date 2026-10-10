#property strict
#property script_show_inputs

#include "../GonyBounceBreakCore.mqh"

int g_failures=0;
int g_checks=0;

void Check(const bool condition,const string description)
  {
   g_checks++;
   if(!condition)
     {
      g_failures++;
      Print("FAIL: ",description);
     }
  }

bool Near(const double actual,const double expected)
  {
   return MathAbs(actual-expected)<1e-10;
  }

void OnStart()
  {
   Check(Near(GBBPipSize(0.00001,5),0.0001),"5-digit FX pip");
   Check(Near(GBBPipSize(0.001,3),0.01),"3-digit JPY pip");
   Check(Near(GBBPipSize(0.0001,4),0.0001),"4-digit FX pip");
   Check(Near(GBBPipSize(0.01,2),0.01),"2-digit point-as-pip");

   MqlRates rates[];
   ArrayResize(rates,4);
   ArraySetAsSeries(rates,true);
   rates[0].low=0.5;
   rates[0].high=2.0; // Forming candle must not contaminate the range.
   rates[1].low=1.1000;
   rates[1].high=1.1010;
   rates[2].low=1.0995;
   rates[2].high=1.1015;
   rates[3].low=1.1001;
   rates[3].high=1.1009;
   double support=0.0,resistance=0.0;
   Check(GBBBuildRange(rates,3,0.0020,support,resistance),"exact maximum range accepted");
   Check(Near(support,1.0995) && Near(resistance,1.1015),"wick-based closed-bar bounds");
   Check(!GBBBuildRange(rates,3,0.0019,support,resistance),"oversized range rejected");
   Check(!GBBBuildRange(rates,4,0.0030,support,resistance),"insufficient history rejected");
   for(int i=1;i<=3;i++)
     {
      rates[i].low=1.1;
      rates[i].high=1.1;
     }
   Check(!GBBBuildRange(rates,3,0.0030,support,resistance),"zero-width range rejected");

   Check(GBBBreakoutDirection(1.1011,1.1000,1.1010)==1,"strict bullish close");
   Check(GBBBreakoutDirection(1.0999,1.1000,1.1010)==-1,"strict bearish close");
   Check(GBBBreakoutDirection(1.1010,1.1000,1.1010)==0,"resistance equality is not a breakout");
   Check(GBBBreakoutDirection(1.1000,1.1000,1.1010)==0,"support equality is not a breakout");
   Check(GBBBreakoutDirection(1.1005,1.1000,1.1010)==0,"inside close is not a breakout");

   Check(GBBRetestTouch(1,1.1010,1.1001,1.1000,0.0002),"buy approaches from above");
   Check(GBBRetestTouch(1,1.1003,1.1000,1.1000,0.0),"zero-tolerance exact buy touch");
   Check(!GBBRetestTouch(1,1.1010,1.0997,1.1000,0.0002),"buy gap through band rejected");
   Check(!GBBRetestTouch(1,1.0999,1.1001,1.1000,0.0002),"buy approaching from below rejected");
   Check(!GBBRetestTouch(1,1.1001,1.1001,1.1000,0.0002),"stationary quote is not a return");
   Check(GBBRetestTouch(-1,1.0990,1.0999,1.1000,0.0002),"sell approaches from below");
   Check(GBBRetestTouch(-1,1.0997,1.1000,1.1000,0.0),"zero-tolerance exact sell touch");
   Check(!GBBRetestTouch(-1,1.0990,1.1003,1.1000,0.0002),"sell gap through band rejected");
   Check(!GBBRetestTouch(-1,1.1001,1.0999,1.1000,0.0002),"sell approaching from above rejected");
   Check(!GBBRetestTouch(0,1.1010,1.1000,1.1000,0.0002),"invalid direction rejected");
   Check(!GBBRetestTouch(1,1.1010,1.1000,1.1000,-0.0002),"negative tolerance rejected");

   Check(!GBBRetestExpired(1,12),"breakout confirmation starts window");
   Check(!GBBRetestExpired(12,12),"twelfth retest candle remains eligible");
   Check(GBBRetestExpired(13,12),"expires after twelve retest candles close");
   Check(!GBBRetestExpired(1,1) && GBBRetestExpired(2,1),"one-bar window boundary");
   Check(Near(GBBFloorVolume(0.129,0.01),0.12),"volume never rounds risk upward");
   Check(Near(GBBFloorVolume(0.01,0.1),0.0),"below-step volume is not inflated");
   Check(Near(GBBFloorVolume(0.74,0.25),0.50),"non-power-of-ten volume step");
   Check(Near(GBBFloorVolume(0.3,0.1),0.3),"floating-point step boundary");
   Check(GBBFloorVolume(1.0,0.0)==0.0,"invalid volume step rejected");
   Check(Near(GBBTickPrice(100.13,0.25,2),100.25),"non-point tick grid");
   Check(GBBTickPrice(1.1,0.0,5)==0.0,"invalid tick size rejected");
   PrintFormat("GBB core tests: %d checks, %d failures.",g_checks,g_failures);
  }
