//+------------------------------------------------------------------+
//| GonyBreakout: configurable M15 key-level breakout Expert Advisor |
//+------------------------------------------------------------------+
#property copyright "GonyBreakout"
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>

enum ENUM_KLB_ENTRY_MODE
  {
   KLB_DIRECT=0,                         // Enter after breakout close
   KLB_RETEST=1                          // Enter after a closed retest candle
  };

input group "--- General Settings ---"
input ulong InpMagicNumber=9182401;      // Unique EA identifier
input int   InpMaxSlippagePoints=20;     // Maximum requested execution deviation
input bool  InpUseNewsFilter=false;      // Blocks entries until an external news provider is integrated

input group "--- Key Level Settings ---"
input bool   InpUsePreviousDayHigh=true; // Include previous day high
input bool   InpUsePreviousDayLow=true;  // Include previous day low
input bool   InpUsePreviousDayOpen=true; // Include previous day open
input bool   InpUsePreviousDayClose=true;// Include previous day close
input bool   InpUsePreviousWeekHigh=true;// Include previous week high
input bool   InpUsePreviousWeekLow=true; // Include previous week low
input bool   InpUseRecentSwingHigh=true; // Include recent M15 range high
input bool   InpUseRecentSwingLow=true;  // Include recent M15 range low
input int    InpSwingLookbackBars=48;    // Completed M15 candles for swing extrema
input string InpManualLevels="";         // Comma-separated absolute price levels
input bool   InpUseSimpleCandleBreakout=true; // Default: break prior M15 candle range
input int    InpSimpleBreakoutLookback=1; // Prior closed candles defining breakout range

input group "--- Breakout Settings ---"
input double InpBreakoutBufferPips=0.0;  // Close must clear the level by this amount
input double InpMinBodyPips=0.0;         // Minimum breakout candle body
input double InpMaxBodyPips=40.0;        // Maximum body; rejects oversized candles
input double InpMinDistancePips=0.0;     // Minimum close-to-level distance
input double InpMinBodyRangeRatio=0.0;   // Minimum body/range ratio (0..1)
input int    InpATRPeriod=14;            // ATR period on M15
input double InpMinATRPips=0.0;          // Minimum ATR; zero disables this bound
input double InpMaxATRPips=0.0;          // Maximum ATR; zero disables this bound

input group "--- Entry Confirmation ---"
input ENUM_KLB_ENTRY_MODE InpEntryMode=KLB_DIRECT; // Direct breakout or breakout+retest
input double InpRetestTolerancePips=2.0; // Retest touch tolerance around broken level
input int    InpMaxRetestBars=8;         // Retest bars allowed after breakout

input group "--- Lot Progression ---"
input double InpFirstLot=0.01;           // First trade and normal sequence lot
input double InpSecondLot=0.01;          // Lot after one consecutive loss
input double InpRecoveryLot=0.05;        // Lot after two consecutive losses
input bool   InpResetAfterSkippedRecovery=true; // Clear recovery state if safety blocks it

input group "--- Stop Loss / Take Profit ---"
input double InpStopLossPips=20.0;       // Initial stop distance from entry
input bool   InpUseRiskReward=true;      // If true, TP = SL distance * RR
input double InpTakeProfitPips=40.0;     // Fixed TP when RR mode is disabled
input double InpRiskRewardRatio=2.0;     // Reward/risk ratio when enabled
input bool   InpUseBreakEven=false;      // Move stop to entry after trigger
input double InpBreakEvenTriggerPips=15.0; // Profit needed to move to break-even
input double InpBreakEvenLockPips=0.5;   // Lock-in beyond entry (zero = exact entry)
input bool   InpUseTrailingStop=false;   // Trail stop after trigger
input double InpTrailingStartPips=20.0;  // Profit needed to start trailing
input double InpTrailingDistancePips=12.0;// Distance of trailing stop from price

input group "--- Risk Management ---"
input double InpMaxRiskPerTradePercent=1.0; // Equity risk cap for every trade
input double InpMaxDailyLossPercent=3.0; // Daily loss limit as % of inferred day-start balance; zero disables
input int    InpMaxConsecutiveLosses=5;  // Stop entries at this loss streak; zero disables
input int    InpMaxTradesPerDay=5;       // Count unique EA positions opened today; zero disables
input double InpMaxSpreadPips=0.0;       // Maximum spread; zero disables
input double InpDailyProfitTargetPercent=0.0; // Daily profit target %; zero disables

input group "--- Trend Filters ---"
input bool InpUseEMAFilter=false;        // Confirm direction using M15 EMA
input int  InpEMAPeriod=50;              // M15 EMA period
input bool InpUseH1TrendFilter=false;    // Confirm direction using H1 close and EMA
input int  InpH1EMAPeriod=50;            // H1 EMA period

input group "--- Trading Sessions ---"
input bool InpUseSessionFilter=false;    // Limit entries to server-time session
input int  InpSessionStartHour=7;        // Session start hour (server time)
input int  InpSessionStartMinute=0;      // Session start minute
input int  InpSessionEndHour=20;         // Session end hour (server time)
input int  InpSessionEndMinute=0;        // Session end minute

input group "--- Dashboard ---"
input bool InpShowDashboard=true;        // Show on-chart status panel
input ENUM_BASE_CORNER InpDashboardCorner=CORNER_LEFT_UPPER;
input int InpDashboardX=12;              // Dashboard horizontal offset
input int InpDashboardY=18;              // Dashboard vertical offset
input int InpDashboardFontSize=10;       // Dashboard font size

CTrade g_trade;
int g_emaHandle=INVALID_HANDLE;
int g_h1EmaHandle=INVALID_HANDLE;
int g_atrHandle=INVALID_HANDLE;
double g_pip=0.0;
string g_globalPrefix="";
string g_lockName="";
string g_objectPrefix="";
datetime g_lastBarTime=0;
datetime g_lastSignalTime=0;
int g_progressionLosses=0;              // Capped at two: the third losing trade resets the sequence
int g_consecutiveLosses=0;              // Independent risk-management streak
datetime g_lastProcessedCloseTime=0;
ulong g_lastProcessedCloseTicket=0;
ulong g_recoveryPositionId=0;
bool g_persistent=false;
bool g_lockOwned=false;
bool g_pendingRetest=false;
int g_pendingDirection=0;
double g_pendingLevel=0.0;
string g_pendingLevelName="";
datetime g_pendingBreakoutTime=0;
int g_pendingAge=0;
double g_currentLevel=0.0;
string g_currentLevelName="n/a";
int g_currentDirection=0;
bool g_dailyStatsValid=false;
double g_dailyPnl=0.0;
double g_dayStartBalance=0.0;
double g_dailyLossLimit=0.0;
int g_tradesToday=0;
uint g_lastDailyRefreshTick=0;
bool g_newsWarningPrinted=false;

struct PositionLedger
  {
   ulong id;
   double openedVolume;
   double closedVolume;
   double netResult;
   datetime closeTime;
   ulong closeTicket;
   bool recovery;
   bool handled;
  };

bool IsFinite(const double value)
  {
   return MathIsValidNumber(value);
  }

bool IsPositive(const double value)
  {
   return IsFinite(value) && value>0.0;
  }

int VolumeDigits(const double step)
  {
   for(int digits=0;digits<=8;digits++)
      if(MathAbs(NormalizeDouble(step,digits)-step)<1e-10)
         return digits;
   return 8;
  }

long SymbolKeyHash(const string symbol)
  {
   long hash=0;
   for(int i=0;i<StringLen(symbol);i++)
      hash=(hash*131+(long)StringGetCharacter(symbol,i))%2147483647;
   return hash;
  }

double NormalizePrice(const double price)
  {
   double tick=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
   if(tick<=0.0)
      tick=_Point;
   return NormalizeDouble(MathRound(price/tick)*tick,_Digits);
  }

double NormalizeVolume(const double requested)
  {
   double minimum=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double maximum=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   if(!IsPositive(minimum) || !IsPositive(maximum) || !IsPositive(step) ||
      requested<minimum-1e-10)
      return 0.0;
   double volume=MathMin(requested,maximum);
   volume=minimum+MathFloor((volume-minimum)/step+1e-9)*step;
   volume=NormalizeDouble(volume,VolumeDigits(step));
   if(volume<minimum-1e-10)
      return 0.0;
   return volume;
  }

bool StoreValue(const string suffix,const double value)
  {
   if(!g_persistent)
      return true;
   ResetLastError();
   if(GlobalVariableSet(g_globalPrefix+suffix,value)==0)
     {
      PrintFormat("KLB: failed to persist %s (error %d)",suffix,GetLastError());
      return false;
     }
   return true;
  }

bool AcquireInstanceLock()
  {
   if(!g_persistent)
      return true;
   g_lockName=g_globalPrefix+".lock";
   if(!GlobalVariableCheck(g_lockName))
     {
      ResetLastError();
      if(!GlobalVariableTemp(g_lockName) && !GlobalVariableCheck(g_lockName))
        {
         PrintFormat("KLB: cannot create instance lock (error %d)",GetLastError());
         return false;
        }
     }
   double owner=0.0;
   if(!GlobalVariableGet(g_lockName,owner))
     {
      PrintFormat("KLB: cannot read instance lock (error %d)",GetLastError());
      return false;
     }
   if(owner!=0.0 && owner!=(double)ChartID())
     {
      bool chartExists=false;
      for(long chart=ChartFirst();chart!=-1;chart=ChartNext(chart))
         if((double)chart==owner)
            chartExists=true;
      if(chartExists)
        {
         Print("KLB: another chart already owns this symbol/magic instance.");
         return false;
        }
      if(!GlobalVariableSetOnCondition(g_lockName,0.0,owner))
        {
         PrintFormat("KLB: cannot reclaim stale instance lock (error %d)",GetLastError());
         return false;
        }
      owner=0.0;
     }
   if(!GlobalVariableSetOnCondition(g_lockName,(double)ChartID(),owner))
     {
      PrintFormat("KLB: instance lock acquisition failed (error %d)",GetLastError());
      return false;
     }
   g_lockOwned=true;
   return true;
  }

void ReleaseInstanceLock()
  {
   if(!g_lockOwned || !g_persistent || g_lockName=="" ||
      !GlobalVariableCheck(g_lockName))
      return;
   if(!GlobalVariableSetOnCondition(g_lockName,0.0,(double)ChartID()))
      PrintFormat("KLB: failed to release instance lock (error %d)",GetLastError());
  }

void SaveState()
  {
   if(!g_persistent)
      return;
   bool ok=true;
   if(!StoreValue(".progress",(double)g_progressionLosses)) ok=false;
   if(!StoreValue(".streak",(double)g_consecutiveLosses)) ok=false;
   if(!StoreValue(".close_time",(double)g_lastProcessedCloseTime)) ok=false;
   if(!StoreValue(".close_ticket",(double)g_lastProcessedCloseTicket)) ok=false;
   if(!StoreValue(".recovery_pos",(double)g_recoveryPositionId)) ok=false;
   if(!StoreValue(".signal_time",(double)g_lastSignalTime)) ok=false;
   if(!StoreValue(".pending",(g_pendingRetest ? 1.0 : 0.0))) ok=false;
   if(!StoreValue(".pending_dir",(double)g_pendingDirection)) ok=false;
   if(!StoreValue(".pending_level",g_pendingLevel)) ok=false;
   if(!StoreValue(".pending_time",(double)g_pendingBreakoutTime)) ok=false;
   if(!StoreValue(".pending_age",(double)g_pendingAge)) ok=false;
   if(ok)
      GlobalVariablesFlush();
  }

void RestoreState()
  {
   if(!g_persistent)
      return;
   double value=0.0;
   if(GlobalVariableGet(g_globalPrefix+".progress",value) && value>=0 && value<=2)
      g_progressionLosses=(int)value;
   if(GlobalVariableGet(g_globalPrefix+".streak",value) && value>=0)
      g_consecutiveLosses=(int)value;
   if(GlobalVariableGet(g_globalPrefix+".close_time",value) && value>=0)
      g_lastProcessedCloseTime=(datetime)value;
   if(GlobalVariableGet(g_globalPrefix+".close_ticket",value) && value>=0)
      g_lastProcessedCloseTicket=(ulong)value;
   if(GlobalVariableGet(g_globalPrefix+".recovery_pos",value) && value>=0)
      g_recoveryPositionId=(ulong)value;
   if(GlobalVariableGet(g_globalPrefix+".signal_time",value) && value>=0)
      g_lastSignalTime=(datetime)value;
   if(GlobalVariableGet(g_globalPrefix+".pending",value) && value==1.0)
     {
      double direction=0.0,level=0.0,time=0.0,age=0.0;
      if(GlobalVariableGet(g_globalPrefix+".pending_dir",direction) &&
         GlobalVariableGet(g_globalPrefix+".pending_level",level) &&
         GlobalVariableGet(g_globalPrefix+".pending_time",time) &&
         GlobalVariableGet(g_globalPrefix+".pending_age",age) &&
         (direction==1.0 || direction==-1.0) && IsPositive(level) &&
         time>0.0 && age>=0.0)
        {
         g_pendingRetest=true;
         g_pendingDirection=(int)direction;
         g_pendingLevel=level;
         g_pendingBreakoutTime=(datetime)time;
         g_pendingAge=(int)age;
         g_pendingLevelName="restored level";
         g_currentLevel=level;
         g_currentLevelName=g_pendingLevelName;
         g_currentDirection=g_pendingDirection;
        }
     }
  }

datetime ServerDayStart()
  {
   MqlDateTime parts;
   TimeToStruct(TimeCurrent(),parts);
   parts.hour=0;
   parts.min=0;
   parts.sec=0;
   return StructToTime(parts);
  }

bool IsEaPositionOpen(ulong &positionId)
  {
   positionId=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0)
         continue;
      if(PositionGetString(POSITION_SYMBOL)==_Symbol &&
         (ulong)PositionGetInteger(POSITION_MAGIC)==InpMagicNumber)
        {
         positionId=(ulong)PositionGetInteger(POSITION_IDENTIFIER);
         return true;
        }
     }
   return false;
  }

bool HasEaExposure(ulong &exposureId)
  {
   if(IsEaPositionOpen(exposureId))
      return true;
   for(int i=OrdersTotal()-1;i>=0;i--)
     {
      ulong ticket=OrderGetTicket(i);
      if(ticket==0)
         continue;
      if(OrderGetString(ORDER_SYMBOL)==_Symbol &&
         (ulong)OrderGetInteger(ORDER_MAGIC)==InpMagicNumber)
        {
         exposureId=ticket;
         return true;
        }
     }
   exposureId=0;
   return false;
  }

bool AddUniqueId(ulong &ids[],const ulong id)
  {
   for(int i=0;i<ArraySize(ids);i++)
      if(ids[i]==id)
         return true;
   int size=ArraySize(ids);
   if(ArrayResize(ids,size+1)!=size+1)
      return false;
   ids[size]=id;
   return true;
  }

bool RefreshDailyStats(const bool force=false)
  {
   uint nowTick=GetTickCount();
   if(!force && g_dailyStatsValid && (uint)(nowTick-g_lastDailyRefreshTick)<1000)
      return true;
   g_lastDailyRefreshTick=nowTick;
   g_dailyStatsValid=false;
   datetime now=TimeCurrent();
   datetime start=ServerDayStart();
   if(!HistorySelect(start,now))
     {
      PrintFormat("KLB: cannot read daily history (error %d)",GetLastError());
      return false;
     }
   double realized=0.0;
   int tradeCount=0;
   ulong entryIds[];
   int total=HistoryDealsTotal();
   for(int i=0;i<total;i++)
     {
      ulong deal=HistoryDealGetTicket(i);
      if(deal==0)
        {
         PrintFormat("KLB: cannot read daily deal %d (error %d)",i,GetLastError());
         return false;
        }
      if(HistoryDealGetString(deal,DEAL_SYMBOL)!=_Symbol ||
         (ulong)HistoryDealGetInteger(deal,DEAL_MAGIC)!=InpMagicNumber)
         continue;
      realized+=HistoryDealGetDouble(deal,DEAL_PROFIT);
      realized+=HistoryDealGetDouble(deal,DEAL_SWAP);
      realized+=HistoryDealGetDouble(deal,DEAL_COMMISSION);
      realized+=HistoryDealGetDouble(deal,DEAL_FEE);
      long entry=HistoryDealGetInteger(deal,DEAL_ENTRY);
      if(entry==DEAL_ENTRY_IN || entry==DEAL_ENTRY_INOUT)
        {
         ulong id=(ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
         int before=ArraySize(entryIds);
         if(!AddUniqueId(entryIds,id))
           {
            Print("KLB: cannot allocate daily trade counter.");
            return false;
           }
         if(ArraySize(entryIds)>before)
            tradeCount++;
        }
     }
   double floating=0.0;
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      if(PositionGetTicket(i)==0)
         continue;
      if(PositionGetString(POSITION_SYMBOL)==_Symbol &&
         (ulong)PositionGetInteger(POSITION_MAGIC)==InpMagicNumber)
         floating+=PositionGetDouble(POSITION_PROFIT)+PositionGetDouble(POSITION_SWAP);
     }
   g_dailyPnl=realized+floating;
   g_dayStartBalance=MathMax(0.0,AccountInfoDouble(ACCOUNT_BALANCE)-realized);
   g_dailyLossLimit=(InpMaxDailyLossPercent>0.0 ?
                     g_dayStartBalance*InpMaxDailyLossPercent/100.0 : 0.0);
   g_tradesToday=tradeCount;
   g_dailyStatsValid=true;
   return true;
  }

bool DailyRiskHalted()
  {
   if(!RefreshDailyStats())
      return true;
   if(InpMaxDailyLossPercent>0.0 && g_dailyPnl<=-g_dailyLossLimit)
      return true;
   if(InpDailyProfitTargetPercent>0.0 &&
      g_dailyPnl>=g_dayStartBalance*InpDailyProfitTargetPercent/100.0)
      return true;
   if(InpMaxTradesPerDay>0 && g_tradesToday>=InpMaxTradesPerDay)
      return true;
   if(InpMaxConsecutiveLosses>0 && g_consecutiveLosses>=InpMaxConsecutiveLosses)
      return true;
   return false;
  }

bool SessionAllowsTrading()
  {
   if(!InpUseSessionFilter)
      return true;
   MqlDateTime now;
   TimeToStruct(TimeCurrent(),now);
   int minuteOfDay=now.hour*60+now.min;
   int start=InpSessionStartHour*60+InpSessionStartMinute;
   int finish=InpSessionEndHour*60+InpSessionEndMinute;
   if(start==finish)
      return true;
   if(start<finish)
      return minuteOfDay>=start && minuteOfDay<finish;
   return minuteOfDay>=start || minuteOfDay<finish;
  }

bool SpreadAllowsTrading()
  {
   if(InpMaxSpreadPips<=0.0)
      return true;
   MqlTick tick;
   if(!SymbolInfoTick(_Symbol,tick) || tick.ask<=0.0 || tick.bid<=0.0)
      return false;
   return (tick.ask-tick.bid)/g_pip<=InpMaxSpreadPips;
  }

bool NewsAllowsTrading()
  {
   if(!InpUseNewsFilter)
      return true;
   if(!g_newsWarningPrinted)
     {
      Print("KLB: news filter is enabled but no external news provider is integrated; entries are blocked.");
      g_newsWarningPrinted=true;
     }
   return false;
  }

bool IsTradingAllowed()
  {
   if((!MQLInfoInteger(MQL_TESTER) && !TerminalInfoInteger(TERMINAL_CONNECTED)) ||
      !TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) ||
      !MQLInfoInteger(MQL_TRADE_ALLOWED) ||
      !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))
     {
      Print("KLB: entry blocked by connection or trading permissions.");
      return false;
     }
   if(!SessionAllowsTrading())
     {
      Print("KLB: entry blocked by the trading-session filter.");
      return false;
     }
   if(!SpreadAllowsTrading())
     {
      MqlTick tick;
      double spread=0.0;
      if(SymbolInfoTick(_Symbol,tick) && g_pip>0.0)
         spread=(tick.ask-tick.bid)/g_pip;
      PrintFormat("KLB: entry blocked by spread filter (%.2f pips, maximum %.2f).",
                  spread,InpMaxSpreadPips);
      return false;
     }
   if(!NewsAllowsTrading())
      return false;
   if(DailyRiskHalted())
     {
      Print("KLB: entry blocked by a daily or consecutive-loss risk limit.");
      return false;
     }
   return true;
  }

double CurrentSequenceLot()
  {
   if(g_progressionLosses>=2)
      return InpRecoveryLot;
   if(g_progressionLosses==1)
      return InpSecondLot;
   return InpFirstLot;
  }

int FindLedger(PositionLedger &items[],const ulong id)
  {
   for(int i=0;i<ArraySize(items);i++)
      if(items[i].id==id)
         return i;
   return -1;
  }

bool AddLedger(PositionLedger &items[],const ulong id,int &index)
  {
   index=FindLedger(items,id);
   if(index>=0)
      return true;
   index=ArraySize(items);
   if(ArrayResize(items,index+1)!=index+1)
      return false;
   items[index].id=id;
   items[index].openedVolume=0.0;
   items[index].closedVolume=0.0;
   items[index].netResult=0.0;
   items[index].closeTime=0;
   items[index].closeTicket=0;
   items[index].recovery=false;
   items[index].handled=false;
   return true;
  }

void ApplyClosedResult(const PositionLedger &item)
  {
   if(item.netResult<0.0)
     {
      g_consecutiveLosses++;
      if(item.recovery)
         g_progressionLosses=0;           // Never escalate after the recovery attempt
      else if(g_progressionLosses<2)
         g_progressionLosses++;
      PrintFormat("KLB: closed loss %.2f; streak=%d progression=%d recovery=%s",
                  item.netResult,g_consecutiveLosses,g_progressionLosses,
                  (item.recovery ? "yes" : "no"));
     }
   else
     {
      g_consecutiveLosses=0;
      g_progressionLosses=0;
      PrintFormat("KLB: closed non-loss %.2f; progression and loss streak reset.",
                  item.netResult);
     }
   g_lastProcessedCloseTime=item.closeTime;
   g_lastProcessedCloseTicket=item.closeTicket;
   g_recoveryPositionId=0;
   SaveState();
  }

void ReconcileClosedTrades()
  {
   if(!HistorySelect(0,TimeCurrent()))
     {
      PrintFormat("KLB: cannot reconcile closed trades (error %d)",GetLastError());
      return;
     }
   PositionLedger ledger[];
   int total=HistoryDealsTotal();
   for(int i=0;i<total;i++)
     {
      ulong deal=HistoryDealGetTicket(i);
      if(deal==0)
         continue;
      if(HistoryDealGetString(deal,DEAL_SYMBOL)!=_Symbol ||
         (ulong)HistoryDealGetInteger(deal,DEAL_MAGIC)!=InpMagicNumber)
         continue;
      ulong id=(ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
      if(id==0)
         continue;
      int at=-1;
      if(!AddLedger(ledger,id,at))
        {
         Print("KLB: cannot allocate closed-trade reconciliation ledger.");
         return;
        }
      long entry=HistoryDealGetInteger(deal,DEAL_ENTRY);
      double volume=HistoryDealGetDouble(deal,DEAL_VOLUME);
      if(entry==DEAL_ENTRY_IN || entry==DEAL_ENTRY_INOUT)
        {
         ledger[at].openedVolume+=volume;
         string comment=HistoryDealGetString(deal,DEAL_COMMENT);
         if(StringFind(comment,"KLB_R")>=0 || id==g_recoveryPositionId)
            ledger[at].recovery=true;
        }
      if(entry==DEAL_ENTRY_OUT || entry==DEAL_ENTRY_OUT_BY || entry==DEAL_ENTRY_INOUT)
        {
         ledger[at].closedVolume+=volume;
         datetime closeTime=(datetime)HistoryDealGetInteger(deal,DEAL_TIME);
         if(closeTime>ledger[at].closeTime ||
            (closeTime==ledger[at].closeTime && deal>ledger[at].closeTicket))
           {
            ledger[at].closeTime=closeTime;
            ledger[at].closeTicket=deal;
           }
        }
      ledger[at].netResult+=HistoryDealGetDouble(deal,DEAL_PROFIT);
      ledger[at].netResult+=HistoryDealGetDouble(deal,DEAL_SWAP);
      ledger[at].netResult+=HistoryDealGetDouble(deal,DEAL_COMMISSION);
      ledger[at].netResult+=HistoryDealGetDouble(deal,DEAL_FEE);
     }

   while(true)
     {
      int next=-1;
      for(int i=0;i<ArraySize(ledger);i++)
        {
         if(ledger[i].handled || ledger[i].openedVolume<=0.0 ||
            ledger[i].closedVolume+1e-8<ledger[i].openedVolume ||
            ledger[i].closeTime<=0)
            continue;
         if(ledger[i].closeTime<g_lastProcessedCloseTime ||
            (ledger[i].closeTime==g_lastProcessedCloseTime &&
             ledger[i].closeTicket<=g_lastProcessedCloseTicket))
            continue;
         if(next<0 || ledger[i].closeTime<ledger[next].closeTime ||
            (ledger[i].closeTime==ledger[next].closeTime &&
             ledger[i].closeTicket<ledger[next].closeTicket))
            next=i;
        }
      if(next<0)
         break;
      ledger[next].handled=true;
      double recoveryVolume=NormalizeVolume(InpRecoveryLot);
      double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
      if(!ledger[next].recovery && g_progressionLosses>=2 &&
         recoveryVolume>0.0 && step>0.0 &&
         MathAbs(ledger[next].openedVolume-recoveryVolume)<=step*0.5)
         ledger[next].recovery=true;
      ApplyClosedResult(ledger[next]);
     }
  }

double ComputeRiskMoney(const ENUM_ORDER_TYPE type,const double volume,
                        const double entry,const double stop)
  {
   double result=0.0;
   if(!OrderCalcProfit(type,_Symbol,volume,entry,stop,result))
     {
      PrintFormat("KLB: OrderCalcProfit failed for risk check (error %d)",GetLastError());
      return -1.0;
     }
   return MathAbs(result);
  }

bool ValidateTradeRisk(const double riskMoney,const bool recovery)
  {
   double equity=AccountInfoDouble(ACCOUNT_EQUITY);
   double maxRisk=equity*InpMaxRiskPerTradePercent/100.0;
   if(riskMoney>maxRisk+1e-8)
     {
      PrintFormat("KLB: proposed risk %.2f exceeds per-trade cap %.2f%s",
                  riskMoney,maxRisk,(recovery ? " for recovery lot" : ""));
      return false;
     }
   if(!RefreshDailyStats(true))
      return false;
   if(InpMaxDailyLossPercent>0.0 &&
      g_dailyPnl-riskMoney < -g_dailyLossLimit)
     {
      PrintFormat("KLB: projected daily P/L %.2f breaches daily loss limit -%.2f",
                  g_dailyPnl-riskMoney,g_dailyLossLimit);
      return false;
     }
   return true;
  }

bool HasMargin(const ENUM_ORDER_TYPE type,const double volume,const double price)
  {
   double margin=0.0;
   if(!OrderCalcMargin(type,_Symbol,volume,price,margin))
     {
      PrintFormat("KLB: margin calculation failed (error %d)",GetLastError());
      return false;
     }
   if(margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE))
     {
      PrintFormat("KLB: insufficient free margin (required %.2f, free %.2f)",
                  margin,AccountInfoDouble(ACCOUNT_MARGIN_FREE));
      return false;
     }
   return true;
  }

bool SendMarketOrder(const int direction,const double volume,const double sl,
                     const double tp,const bool recovery)
  {
   g_trade.SetExpertMagicNumber(InpMagicNumber);
   g_trade.SetDeviationInPoints((ulong)InpMaxSlippagePoints);
   g_trade.SetAsyncMode(false);
   g_trade.SetTypeFillingBySymbol(_Symbol);
   string comment=(recovery ? "KLB_R" : "KLB_N");
   for(int attempt=0;attempt<2;attempt++)
     {
      ResetLastError();
      bool sent=(direction>0 ?
                 g_trade.Buy(volume,_Symbol,0.0,sl,tp,comment) :
                 g_trade.Sell(volume,_Symbol,0.0,sl,tp,comment));
      uint retcode=g_trade.ResultRetcode();
      if(sent && (retcode==TRADE_RETCODE_DONE ||
                  retcode==TRADE_RETCODE_DONE_PARTIAL ||
                  retcode==TRADE_RETCODE_PLACED))
        {
         PrintFormat("KLB: %s opened, volume %.2f, SL %.5f, TP %.5f",
                     (direction>0 ? "BUY" : "SELL"),volume,sl,tp);
         return true;
        }
      PrintFormat("KLB: order attempt %d failed, retcode=%u (%s), error=%d",
                  attempt+1,retcode,g_trade.ResultRetcodeDescription(),GetLastError());
      // Only retry explicit price/requote responses. Timeouts are ambiguous.
      if(attempt==0 && (retcode==TRADE_RETCODE_REQUOTE ||
                        retcode==TRADE_RETCODE_PRICE_CHANGED ||
                        retcode==TRADE_RETCODE_PRICE_OFF))
         continue;
      return false;
     }
   return false;
  }

bool TryOpenTrade(const int direction,const double level,const string levelName,
                  const datetime signalTime)
  {
   if(!IsTradingAllowed())
     {
      if(g_progressionLosses>=2 && InpResetAfterSkippedRecovery &&
         InpMaxDailyLossPercent>0.0 && RefreshDailyStats(true) &&
         g_dailyPnl<=-g_dailyLossLimit)
        {
         g_progressionLosses=0;
         SaveState();
         Print("KLB: recovery setup skipped at daily loss limit; progression reset by policy.");
        }
      return false;
     }
   ulong openId=0;
   if(HasEaExposure(openId))
     {
      PrintFormat("KLB: entry skipped; EA position/order %I64u is already active.",openId);
      return false;
     }
   MqlTick tick;
   if(!SymbolInfoTick(_Symbol,tick) || tick.ask<=0.0 || tick.bid<=0.0)
      return false;
   ENUM_ORDER_TYPE type=(direction>0 ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);
   double entry=(direction>0 ? tick.ask : tick.bid);
   double stopDistance=InpStopLossPips*g_pip;
   double minimumStop=(double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*_Point;
   double tickSize=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
   if(tickSize<=0.0)
      tickSize=_Point;
   double minimumDistance=minimumStop+tickSize+(tick.ask-tick.bid);
   stopDistance=MathMax(stopDistance,minimumDistance);
   double targetDistance=(InpUseRiskReward ?
                          stopDistance*InpRiskRewardRatio :
                          InpTakeProfitPips*g_pip);
   targetDistance=MathMax(targetDistance,minimumDistance);
   double sl=NormalizePrice(entry+(direction>0 ? -stopDistance : stopDistance));
   double tp=NormalizePrice(entry+(direction>0 ? targetDistance : -targetDistance));
   if(sl<=0.0 || tp<=0.0)
      return false;

   double requested=CurrentSequenceLot();
   bool recovery=(g_progressionLosses>=2);
   double volume=NormalizeVolume(requested);
   if(volume<=0.0)
     {
      PrintFormat("KLB: requested %.4f lot is below broker minimum/step; no order sent.",requested);
      return false;
     }
   double risk=ComputeRiskMoney(type,volume,entry,sl);
   if(risk<0.0 || !ValidateTradeRisk(risk,recovery))
     {
      if(recovery && InpResetAfterSkippedRecovery)
        {
         g_progressionLosses=0;
         SaveState();
         Print("KLB: recovery setup skipped; progression reset to the normal lot by policy.");
        }
      return false;
     }
   if(!HasMargin(type,volume,entry))
      return false;
   if(!SendMarketOrder(direction,volume,sl,tp,recovery))
      return false;
   g_currentLevel=level;
   g_currentLevelName=levelName;
   g_currentDirection=direction;
   g_lastSignalTime=signalTime;
   SaveState();
   return true;
  }

bool AddLevel(double &levels[],string &names[],const double price,const string name)
  {
   if(!IsPositive(price))
      return true;
   int size=ArraySize(levels);
   if(ArrayResize(levels,size+1)!=size+1 ||
      ArrayResize(names,size+1)!=size+1)
     {
      Print("KLB: failed to allocate key-level list.");
      return false;
     }
   levels[size]=price;
   names[size]=name;
   return true;
  }

bool BuildKeyLevels(double &levels[],string &names[])
  {
   ArrayResize(levels,0);
   ArrayResize(names,0);
   if(InpUsePreviousDayHigh && !AddLevel(levels,names,iHigh(_Symbol,PERIOD_D1,1),"PDH")) return false;
   if(InpUsePreviousDayLow && !AddLevel(levels,names,iLow(_Symbol,PERIOD_D1,1),"PDL")) return false;
   if(InpUsePreviousDayOpen && !AddLevel(levels,names,iOpen(_Symbol,PERIOD_D1,1),"PDO")) return false;
   if(InpUsePreviousDayClose && !AddLevel(levels,names,iClose(_Symbol,PERIOD_D1,1),"PDC")) return false;
   if(InpUsePreviousWeekHigh && !AddLevel(levels,names,iHigh(_Symbol,PERIOD_W1,1),"PWH")) return false;
   if(InpUsePreviousWeekLow && !AddLevel(levels,names,iLow(_Symbol,PERIOD_W1,1),"PWL")) return false;

   if(InpUseRecentSwingHigh || InpUseRecentSwingLow)
     {
      MqlRates bars[];
      ArraySetAsSeries(bars,true);
      int copied=CopyRates(_Symbol,PERIOD_M15,2,InpSwingLookbackBars,bars);
      if(copied==InpSwingLookbackBars && copied>0)
        {
         double high=bars[0].high,low=bars[0].low;
         for(int i=1;i<copied;i++)
           {
            high=MathMax(high,bars[i].high);
            low=MathMin(low,bars[i].low);
           }
         if(InpUseRecentSwingHigh && !AddLevel(levels,names,high,"Swing High")) return false;
         if(InpUseRecentSwingLow && !AddLevel(levels,names,low,"Swing Low")) return false;
        }
     }
   if(StringLen(InpManualLevels)>0)
     {
      string values[];
      int count=StringSplit(InpManualLevels,',',values);
      for(int i=0;i<count;i++)
        {
         string token=values[i];
         StringTrimLeft(token);
         StringTrimRight(token);
         double level=StringToDouble(token);
         if(!IsPositive(level))
           {
            PrintFormat("KLB: ignoring invalid manual level '%s'.",token);
            continue;
           }
         if(!AddLevel(levels,names,level,"Manual"))
            return false;
        }
     }
   return true;
  }

bool ReadIndicator(const int handle,const int shift,double &value)
  {
   if(handle==INVALID_HANDLE)
      return false;
   double buffer[];
   ArraySetAsSeries(buffer,true);
   if(CopyBuffer(handle,0,shift,1,buffer)!=1)
      return false;
   value=buffer[0];
   return IsPositive(value);
  }

bool TrendAllows(const int direction)
  {
   double value=0.0;
   if(InpUseEMAFilter)
     {
      if(!ReadIndicator(g_emaHandle,1,value))
         return false;
      double close=iClose(_Symbol,PERIOD_M15,1);
      if((direction>0 && close<=value) || (direction<0 && close>=value))
         return false;
     }
   if(InpUseH1TrendFilter)
     {
      if(!ReadIndicator(g_h1EmaHandle,1,value))
         return false;
      double close=iClose(_Symbol,PERIOD_H1,1);
      if(close<=0.0 || (direction>0 && close<=value) ||
         (direction<0 && close>=value))
         return false;
     }
   return true;
  }

bool CandleAndVolatilityAllow(const MqlRates &bar)
  {
   double body=MathAbs(bar.close-bar.open)/g_pip;
   double range=(bar.high-bar.low)/g_pip;
   if(range<=0.0 || body<InpMinBodyPips || body>InpMaxBodyPips)
      return false;
   if(body/range<InpMinBodyRangeRatio)
      return false;
   if(InpMinATRPips>0.0 || InpMaxATRPips>0.0)
     {
      double atr=0.0;
      if(!ReadIndicator(g_atrHandle,1,atr))
         return false;
      double atrPips=atr/g_pip;
      if(InpMinATRPips>0.0 && atrPips<InpMinATRPips)
         return false;
      if(InpMaxATRPips>0.0 && atrPips>InpMaxATRPips)
         return false;
     }
   return true;
  }

bool FindBreakout(const MqlRates &bar,const MqlRates &previous,
                  int &direction,double &level,string &name)
  {
   direction=0;
   level=0.0;
   name="";
   double buffer=InpBreakoutBufferPips*g_pip;
   if(InpUseSimpleCandleBreakout)
     {
      MqlRates priorBars[];
      ArraySetAsSeries(priorBars,true);
      int copied=CopyRates(_Symbol,PERIOD_M15,2,InpSimpleBreakoutLookback,priorBars);
      if(copied!=InpSimpleBreakoutLookback || copied<=0)
         return false;
      double priorHigh=priorBars[0].high;
      double priorLow=priorBars[0].low;
      for(int i=1;i<copied;i++)
        {
         priorHigh=MathMax(priorHigh,priorBars[i].high);
         priorLow=MathMin(priorLow,priorBars[i].low);
        }
      if(previous.close<=priorHigh && bar.close>priorHigh+buffer)
        {
         direction=1;
         level=priorHigh;
         name=(InpSimpleBreakoutLookback==1 ? "Previous candle high" : "Prior range high");
        }
      else if(previous.close>=priorLow && bar.close<priorLow-buffer)
        {
         direction=-1;
         level=priorLow;
         name=(InpSimpleBreakoutLookback==1 ? "Previous candle low" : "Prior range low");
        }
      if(direction==0 ||
         MathAbs(bar.close-level)/g_pip<InpMinDistancePips)
         return false;
      return true;
     }
   double levels[];
   string names[];
   if(!BuildKeyLevels(levels,names))
      return false;
   double bestDistance=1.0e100;
   for(int i=0;i<ArraySize(levels);i++)
     {
      int candidate=0;
      if(previous.close<=levels[i] && bar.close>levels[i]+buffer)
         candidate=1;
      else if(previous.close>=levels[i] && bar.close<levels[i]-buffer)
         candidate=-1;
      if(candidate==0 || MathAbs(bar.close-levels[i])/g_pip<InpMinDistancePips)
         continue;
      double distance=MathAbs(bar.close-levels[i]);
      if(distance<bestDistance)
        {
         bestDistance=distance;
         direction=candidate;
         level=levels[i];
         name=names[i];
        }
     }
   return direction!=0;
  }

bool RetestCandleConfirms(const MqlRates &bar,const int direction,const double level)
  {
   double tolerance=InpRetestTolerancePips*g_pip;
   bool touched=(bar.low<=level+tolerance && bar.high>=level-tolerance);
   if(!touched)
      return false;
   if(direction>0 && bar.close<=level)
      return false;
   if(direction<0 && bar.close>=level)
      return false;
   double range=bar.high-bar.low;
   if(range<=0.0 || MathAbs(bar.close-bar.open)/range<InpMinBodyRangeRatio)
      return false;
   return true;
  }

void ClearPendingRetest()
  {
   g_pendingRetest=false;
   g_pendingDirection=0;
   g_pendingLevel=0.0;
   g_pendingLevelName="";
   g_pendingBreakoutTime=0;
   g_pendingAge=0;
   SaveState();
  }

void ProcessPendingRetest(const MqlRates &bar)
  {
   if(bar.time<=g_pendingBreakoutTime)
      return;
   int breakoutShift=iBarShift(_Symbol,PERIOD_M15,g_pendingBreakoutTime,true);
   if(breakoutShift<0)
     {
      Print("KLB: pending retest cancelled because its breakout candle is unavailable.");
      ClearPendingRetest();
      return;
     }
   g_pendingAge=breakoutShift-1;
   if(g_pendingAge>InpMaxRetestBars)
     {
      Print("KLB: retest setup expired while the EA was offline.");
      ClearPendingRetest();
      return;
     }
   g_currentLevel=g_pendingLevel;
   g_currentLevelName=g_pendingLevelName;
   g_currentDirection=g_pendingDirection;
   if(g_pendingDirection>0 && bar.close<=g_pendingLevel)
     {
      Print("KLB: retest setup rejected after close returned inside the broken level.");
      ClearPendingRetest();
      return;
     }
   if(g_pendingDirection<0 && bar.close>=g_pendingLevel)
     {
      Print("KLB: retest setup rejected after close returned inside the broken level.");
      ClearPendingRetest();
      return;
     }
   if(RetestCandleConfirms(bar,g_pendingDirection,g_pendingLevel))
     {
      datetime signal=bar.time;
      int direction=g_pendingDirection;
      double level=g_pendingLevel;
      string name=g_pendingLevelName;
      ClearPendingRetest();
      g_lastSignalTime=signal;
      SaveState();
      TryOpenTrade(direction,level,name,signal);
      return;
     }
   if(g_pendingAge>=InpMaxRetestBars)
     {
      Print("KLB: retest setup expired without confirmation.");
      ClearPendingRetest();
     }
   else
      SaveState();
  }

void ProcessClosedBar()
  {
   MqlRates bars[];
   ArraySetAsSeries(bars,true);
   if(CopyRates(_Symbol,PERIOD_M15,0,3,bars)!=3)
      return;
   MqlRates closed=bars[1];
   MqlRates previous=bars[2];
   if(g_pendingRetest)
     {
      ProcessPendingRetest(closed);
      return;
     }
   if(closed.time<=g_lastSignalTime || !CandleAndVolatilityAllow(closed))
      return;
   int direction=0;
   double level=0.0;
   string name="";
   if(!FindBreakout(closed,previous,direction,level,name))
      return;
   PrintFormat("KLB: M15 %s breakout confirmed at %s %.5f; candle close %.5f.",
               (direction>0 ? "BUY" : "SELL"),name,level,closed.close);
   if(!TrendAllows(direction))
     {
      Print("KLB: breakout rejected by trend confirmation.");
      return;
     }
   if(!SessionAllowsTrading())
      return;
   g_currentLevel=level;
   g_currentLevelName=name;
   g_currentDirection=direction;
   g_lastSignalTime=closed.time;          // Consume signal candle even if execution is rejected
   if(InpEntryMode==KLB_RETEST)
     {
      g_pendingRetest=true;
      g_pendingDirection=direction;
      g_pendingLevel=level;
      g_pendingLevelName=name;
      g_pendingBreakoutTime=closed.time;
      g_pendingAge=0;
      PrintFormat("KLB: confirmed %s breakout of %s at %.5f; waiting for retest.",
                  (direction>0 ? "BUY" : "SELL"),name,level);
      SaveState();
      return;
     }
   SaveState();
   TryOpenTrade(direction,level,name,closed.time);
  }

void ManageOpenPosition()
  {
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0 || PositionGetString(POSITION_SYMBOL)!=_Symbol ||
         (ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagicNumber)
         continue;
      long type=PositionGetInteger(POSITION_TYPE);
      double open=PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL=PositionGetDouble(POSITION_SL);
      double currentTP=PositionGetDouble(POSITION_TP);
      MqlTick tick;
      if(!SymbolInfoTick(_Symbol,tick))
         continue;
      double current=(type==POSITION_TYPE_BUY ? tick.bid : tick.ask);
      double profitPips=(type==POSITION_TYPE_BUY ?
                         (current-open)/g_pip : (open-current)/g_pip);
      double wanted=currentSL;
      if(InpUseBreakEven && profitPips>=InpBreakEvenTriggerPips)
        {
         double be=NormalizePrice(open+(type==POSITION_TYPE_BUY ?
                              InpBreakEvenLockPips*g_pip :
                              -InpBreakEvenLockPips*g_pip));
         if((type==POSITION_TYPE_BUY && (wanted==0.0 || be>wanted)) ||
            (type==POSITION_TYPE_SELL && (wanted==0.0 || be<wanted)))
            wanted=be;
        }
      if(InpUseTrailingStop && profitPips>=InpTrailingStartPips)
        {
         double trail=NormalizePrice(current+(type==POSITION_TYPE_BUY ?
                                   -InpTrailingDistancePips*g_pip :
                                   InpTrailingDistancePips*g_pip));
         if((type==POSITION_TYPE_BUY && trail>wanted) ||
            (type==POSITION_TYPE_SELL && (wanted==0.0 || trail<wanted)))
            wanted=trail;
        }
      if(wanted>0.0 && MathAbs(wanted-currentSL)>=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE))
        {
         double minDistance=(double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*_Point;
         double tickSize=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
         if(tickSize<=0.0)
            tickSize=_Point;
         minDistance+=tickSize;
         if((type==POSITION_TYPE_BUY && wanted>tick.bid-minDistance) ||
            (type==POSITION_TYPE_SELL && wanted<tick.ask+minDistance))
            continue;
         g_trade.SetExpertMagicNumber(InpMagicNumber);
         if(!g_trade.PositionModify(ticket,wanted,currentTP))
            PrintFormat("KLB: stop modification failed for %I64u: %s",
                        ticket,g_trade.ResultRetcodeDescription());
        }
     }
  }

string DirectionText(const int direction)
  {
   if(direction>0) return "BUY";
   if(direction<0) return "SELL";
   return "NONE";
  }

string PositionText()
  {
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      if(PositionGetTicket(i)==0 ||
         PositionGetString(POSITION_SYMBOL)!=_Symbol ||
         (ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagicNumber)
         continue;
      long type=PositionGetInteger(POSITION_TYPE);
      return StringFormat("%s %.2f lot",
                         (type==POSITION_TYPE_BUY ? "BUY" : "SELL"),
                         PositionGetDouble(POSITION_VOLUME));
     }
   return "None";
  }

string CurrentLotText()
  {
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      if(PositionGetTicket(i)==0 ||
         PositionGetString(POSITION_SYMBOL)!=_Symbol ||
         (ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagicNumber)
         continue;
      double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
      return DoubleToString(PositionGetDouble(POSITION_VOLUME),VolumeDigits(step));
     }
   return "n/a";
  }

void SetDashboardLine(const int row,const string text,const color lineColor)
  {
   string name=g_objectPrefix+IntegerToString(row);
   if(ObjectFind(0,name)<0)
     {
      if(!ObjectCreate(0,name,OBJ_LABEL,0,0,0))
        {
         PrintFormat("KLB: failed to create dashboard label %s (error %d)",
                     name,GetLastError());
         return;
        }
      ObjectSetInteger(0,name,OBJPROP_CORNER,InpDashboardCorner);
      ObjectSetInteger(0,name,OBJPROP_XDISTANCE,InpDashboardX);
      ObjectSetInteger(0,name,OBJPROP_YDISTANCE,InpDashboardY+row*(InpDashboardFontSize+7));
      ObjectSetInteger(0,name,OBJPROP_FONTSIZE,InpDashboardFontSize);
      ObjectSetString(0,name,OBJPROP_FONT,"Consolas");
      ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
      ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);
     }
   ObjectSetInteger(0,name,OBJPROP_COLOR,lineColor);
   ObjectSetString(0,name,OBJPROP_TEXT,text);
  }

void UpdateDashboard()
  {
   if(!InpShowDashboard)
      return;
   RefreshDailyStats();
   bool halted=DailyRiskHalted() ||
               (!MQLInfoInteger(MQL_TESTER) && !TerminalInfoInteger(TERMINAL_CONNECTED)) ||
               !TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) ||
               !MQLInfoInteger(MQL_TRADE_ALLOWED) ||
               !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) ||
               !SessionAllowsTrading() ||
               !SpreadAllowsTrading() ||
               !NewsAllowsTrading();
   double lot=NormalizeVolume(CurrentSequenceLot());
   if(lot<=0.0)
      lot=CurrentSequenceLot();
   string mode=(InpEntryMode==KLB_RETEST ? "Breakout + Retest" : "Direct Breakout");
   string status=(halted ? "STOPPED" : "RUNNING");
   color statusColor=(halted ? clrTomato : clrLimeGreen);
   color directionColor=(g_currentDirection>0 ? clrLimeGreen :
                         (g_currentDirection<0 ? clrTomato : clrSilver));
   color pnlColor=(g_dailyPnl>=0.0 ? clrLimeGreen : clrTomato);
   string levelText=(g_currentLevel>0.0 ?
                     g_currentLevelName+" "+DoubleToString(g_currentLevel,_Digits) :
                     "n/a");
   SetDashboardLine(0,"GonyBreakout | "+status,statusColor);
   SetDashboardLine(1,"Symbol: "+_Symbol+" | Timeframe: M15",clrWhite);
   SetDashboardLine(2,"Key level: "+levelText,clrAqua);
   SetDashboardLine(3,"Breakout direction: "+DirectionText(g_currentDirection),directionColor);
   SetDashboardLine(4,"Current lot: "+CurrentLotText(),clrWhite);
   SetDashboardLine(5,"Consecutive losses: "+IntegerToString(g_consecutiveLosses),clrWhite);
   SetDashboardLine(6,"Trades today: "+IntegerToString(g_tradesToday),clrWhite);
   SetDashboardLine(7,"Today's P/L: "+DoubleToString(g_dailyPnl,2),pnlColor);
   SetDashboardLine(8,"Open position: "+PositionText(),clrWhite);
   SetDashboardLine(9,"Daily drawdown: "+DoubleToString(MathMax(0.0,-g_dailyPnl),2),clrOrange);
   SetDashboardLine(10,"Next trade lot: "+DoubleToString(lot,VolumeDigits(SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP))),clrWhite);
   SetDashboardLine(11,"Mode: "+mode,clrWhite);
   ChartRedraw(0);
  }

bool ValidateInputs()
  {
   if(InpMagicNumber==0 || InpMaxSlippagePoints<0 ||
      InpSwingLookbackBars<2 || InpSwingLookbackBars>5000 ||
      InpSimpleBreakoutLookback<1 || InpSimpleBreakoutLookback>5000 ||
      InpATRPeriod<1 || InpEMAPeriod<1 || InpH1EMAPeriod<1 ||
      InpMaxRetestBars<1 || InpMaxConsecutiveLosses<0 || InpMaxTradesPerDay<0 ||
      (InpEntryMode!=KLB_DIRECT && InpEntryMode!=KLB_RETEST))
      return false;
   if(!IsPositive(InpFirstLot) || !IsPositive(InpSecondLot) ||
      !IsPositive(InpRecoveryLot) || !IsPositive(InpStopLossPips) ||
      !IsPositive(InpMaxBodyPips) || InpMaxBodyPips<InpMinBodyPips ||
      !IsFinite(InpMinBodyPips) || InpMinBodyPips<0.0 ||
      !IsFinite(InpMinDistancePips) || InpMinDistancePips<0.0 ||
      !IsFinite(InpBreakoutBufferPips) || InpBreakoutBufferPips<0.0 ||
      !IsFinite(InpMinBodyRangeRatio) || InpMinBodyRangeRatio<0.0 ||
      InpMinBodyRangeRatio>1.0 ||
      !IsFinite(InpRetestTolerancePips) || InpRetestTolerancePips<0.0 ||
      !IsFinite(InpMinATRPips) || InpMinATRPips<0.0 ||
      !IsFinite(InpMaxATRPips) || InpMaxATRPips<0.0 ||
      (InpMinATRPips>0.0 && InpMaxATRPips>0.0 && InpMinATRPips>InpMaxATRPips) ||
      !IsPositive(InpMaxRiskPerTradePercent) || InpMaxRiskPerTradePercent>100.0 ||
      !IsFinite(InpMaxDailyLossPercent) || InpMaxDailyLossPercent<0.0 ||
      InpMaxDailyLossPercent>100.0 ||
      !IsFinite(InpDailyProfitTargetPercent) || InpDailyProfitTargetPercent<0.0 ||
      !IsFinite(InpMaxSpreadPips) || InpMaxSpreadPips<0.0)
      return false;
   if((InpUseRiskReward && !IsPositive(InpRiskRewardRatio)) ||
      (!InpUseRiskReward && !IsPositive(InpTakeProfitPips)))
      return false;
   if((InpUseBreakEven && (!IsFinite(InpBreakEvenLockPips) ||
       InpBreakEvenLockPips<0.0 || !IsPositive(InpBreakEvenTriggerPips))) ||
      (InpUseTrailingStop && (!IsPositive(InpTrailingStartPips) ||
       !IsPositive(InpTrailingDistancePips))))
      return false;
   if(InpUseSessionFilter &&
      (InpSessionStartHour<0 || InpSessionStartHour>23 ||
       InpSessionEndHour<0 || InpSessionEndHour>23 ||
       InpSessionStartMinute<0 || InpSessionStartMinute>59 ||
       InpSessionEndMinute<0 || InpSessionEndMinute>59))
      return false;
   if(InpDashboardFontSize<6 || InpDashboardFontSize>24)
      return false;
   return true;
  }

int OnInit()
  {
   if(_Period!=PERIOD_M15)
     {
      Print("KLB: attach this EA to an M15 chart.");
      return INIT_FAILED;
     }
   if(!ValidateInputs())
     {
      Print("KLB: invalid input parameters.");
      return INIT_PARAMETERS_INCORRECT;
     }
   g_pip=_Point*((_Digits==3 || _Digits==5) ? 10.0 : 1.0);
   if(!IsPositive(g_pip))
      return INIT_FAILED;

   long login=AccountInfoInteger(ACCOUNT_LOGIN);
   g_globalPrefix=StringFormat("KLB_%I64d_%I64u_%I64d",
                               login,InpMagicNumber,SymbolKeyHash(_Symbol));
   g_objectPrefix=StringFormat("KLB_%I64u_",InpMagicNumber);
   g_persistent=!MQLInfoInteger(MQL_TESTER);
   if(!AcquireInstanceLock())
      return INIT_FAILED;
   RestoreState();
   g_emaHandle=iMA(_Symbol,PERIOD_M15,InpEMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   g_h1EmaHandle=iMA(_Symbol,PERIOD_H1,InpH1EMAPeriod,0,MODE_EMA,PRICE_CLOSE);
   g_atrHandle=iATR(_Symbol,PERIOD_M15,InpATRPeriod);
   if(g_emaHandle==INVALID_HANDLE || g_h1EmaHandle==INVALID_HANDLE ||
      g_atrHandle==INVALID_HANDLE)
     {
      PrintFormat("KLB: failed to create indicator handles (error %d)",GetLastError());
      return INIT_FAILED;
     }
   g_trade.SetExpertMagicNumber(InpMagicNumber);
   g_trade.SetDeviationInPoints((ulong)InpMaxSlippagePoints);
   g_trade.SetTypeFillingBySymbol(_Symbol);
   g_lastBarTime=iTime(_Symbol,PERIOD_M15,0);
   ReconcileClosedTrades();
   RefreshDailyStats(true);
   PrintFormat("KLB: initialized on %s M15; progression loss count=%d, closed loss streak=%d",
               _Symbol,g_progressionLosses,g_consecutiveLosses);
   UpdateDashboard();
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   if(g_emaHandle!=INVALID_HANDLE) IndicatorRelease(g_emaHandle);
   if(g_h1EmaHandle!=INVALID_HANDLE) IndicatorRelease(g_h1EmaHandle);
   if(g_atrHandle!=INVALID_HANDLE) IndicatorRelease(g_atrHandle);
   ObjectsDeleteAll(0,g_objectPrefix);
   SaveState();
   ReleaseInstanceLock();
  }

void OnTick()
  {
   ManageOpenPosition();
   RefreshDailyStats();
   datetime currentBar=iTime(_Symbol,PERIOD_M15,0);
   if(currentBar>0 && currentBar!=g_lastBarTime)
     {
      g_lastBarTime=currentBar;
      ProcessClosedBar();
     }
   UpdateDashboard();
  }

void OnTradeTransaction(const MqlTradeTransaction &transaction,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   if(transaction.type!=TRADE_TRANSACTION_DEAL_ADD || transaction.deal==0)
      return;
   if(!HistoryDealSelect(transaction.deal))
     {
      PrintFormat("KLB: cannot select transaction deal %I64u (error %d)",
                  transaction.deal,GetLastError());
      return;
     }
   if(HistoryDealGetString(transaction.deal,DEAL_SYMBOL)!=_Symbol ||
      (ulong)HistoryDealGetInteger(transaction.deal,DEAL_MAGIC)!=InpMagicNumber)
      return;
   long entry=HistoryDealGetInteger(transaction.deal,DEAL_ENTRY);
   string comment=HistoryDealGetString(transaction.deal,DEAL_COMMENT);
   if((entry==DEAL_ENTRY_IN || entry==DEAL_ENTRY_INOUT) &&
      (g_progressionLosses>=2 || StringFind(comment,"KLB_R")>=0))
     {
      g_recoveryPositionId=(ulong)HistoryDealGetInteger(transaction.deal,DEAL_POSITION_ID);
      SaveState();
     }
   ReconcileClosedTrades();
   RefreshDailyStats(true);
   UpdateDashboard();
  }