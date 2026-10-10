//+------------------------------------------------------------------+
//| GonyBounceBreak: closed-bar range breakout followed by a retest.   |
//| Use a dedicated symbol/magic pair; test on your broker before use.|
//+------------------------------------------------------------------+
#property copyright "GonyBounceBreak"
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>
#include "GonyBounceBreakCore.mqh"

enum ENUM_ENTRY_TYPE
  {
   ENTRY_LIMIT_ORDER=0,
   ENTRY_MARKET_TOUCH=1
  };
enum ENUM_LOT_MODE
  {
   LOT_FIXED=0,
   LOT_RISK_PERCENT=1
  };
enum ENUM_STOP_MODE
  {
   STOP_FIXED_PIPS=0,
   STOP_OPPOSITE_RANGE=1
  };
enum ENUM_TARGET_MODE
  {
   TARGET_FIXED_PIPS=0,
   TARGET_RISK_REWARD=1
  };
enum ENUM_STRATEGY_STATE
  {
   STATE_SEARCHING_BUILDUP=0,
   STATE_WAITING_RETEST=1,
   STATE_IN_TRADE=2
  };

input group "--- Build-Up Settings ---"
input int              InpBuildUpCandles=10;          // Closed candles in consolidation
input double           InpMaxRangePips=30.0;          // Maximum range height
input int              InpMaxWaitBars=12;             // Retest candles after breakout
input double           InpRetestTolerancePips=2.0;    // Market-touch distance from line
input group "--- Execution Settings ---"
input ENUM_ENTRY_TYPE  InpEntryType=ENTRY_LIMIT_ORDER;
input ulong            InpMagicNumber=884422;         // Unique symbol/magic pair
input int              InpSlippagePips=3;             // Requested maximum deviation
input group "--- Risk & Money Management ---"
input ENUM_LOT_MODE     InpLotMode=LOT_RISK_PERCENT;
input double           InpFixedLot=0.1;
input double           InpRiskPercent=1.0;            // Percent of current equity
input double           InpStopLossPips=20.0;
input double           InpTakeProfitPips=40.0;
input ENUM_STOP_MODE    InpStopMode=STOP_FIXED_PIPS;
input ENUM_TARGET_MODE  InpTargetMode=TARGET_FIXED_PIPS;
input double           InpRiskRewardRatio=2.0;        // Used by TARGET_RISK_REWARD
input group "--- Visualization & Chart Lines ---"
input color            InpSupportColor=clrDodgerBlue;
input color            InpResistanceColor=clrCrimson;
input int              InpLineWidth=2;

CTrade g_trade;
ENUM_STRATEGY_STATE g_state=STATE_SEARCHING_BUILDUP;
double g_pip=0.0,g_tickSize=0.0,g_support=0.0,g_resistance=0.0;
double g_level=0.0,g_previousBid=0.0;
datetime g_breakoutTime=0,g_lastBar=0;
int g_direction=0;
bool g_rangeReady=false,g_submitted=false,g_cancelPending=false;
bool g_initialized=false,g_lockOwned=false,g_persistent=false,g_ownsObjects=false;
bool g_uncertain=false;
bool g_initialScanPending=true;
datetime g_lastInitialScan=0;
string g_prefix="",g_lockName="",g_supportName="",g_resistanceName="";

bool PositiveFinite(const double value)
  {
   return MathIsValidNumber(value) && value>0.0;
  }

bool ValidateInputs()
  {
   if(InpBuildUpCandles<2 || InpBuildUpCandles>10000 || InpMaxWaitBars<1 ||
      !PositiveFinite(InpMaxRangePips) ||
      !MathIsValidNumber(InpRetestTolerancePips) || InpRetestTolerancePips<0.0 ||
      InpSlippagePips<0 || InpMagicNumber==0 || InpLineWidth<1 || InpLineWidth>5 ||
      (InpEntryType!=ENTRY_LIMIT_ORDER && InpEntryType!=ENTRY_MARKET_TOUCH) ||
      (InpLotMode!=LOT_FIXED && InpLotMode!=LOT_RISK_PERCENT) ||
      (InpStopMode!=STOP_FIXED_PIPS && InpStopMode!=STOP_OPPOSITE_RANGE) ||
      (InpTargetMode!=TARGET_FIXED_PIPS && InpTargetMode!=TARGET_RISK_REWARD))
     {
      Print("GBB: invalid build-up, execution, enum or visualization input.");
      return false;
     }
   if((InpLotMode==LOT_FIXED && !PositiveFinite(InpFixedLot)) ||
      (InpLotMode==LOT_RISK_PERCENT &&
       (!PositiveFinite(InpRiskPercent) || InpRiskPercent>100.0)) ||
      (InpStopMode==STOP_FIXED_PIPS && !PositiveFinite(InpStopLossPips)) ||
      (InpTargetMode==TARGET_FIXED_PIPS && !PositiveFinite(InpTakeProfitPips)) ||
      (InpTargetMode==TARGET_RISK_REWARD && !PositiveFinite(InpRiskRewardRatio)))
     {
      Print("GBB: invalid lot, risk, stop loss or target input.");
      return false;
     }
   return true;
  }

bool PutMemory(const string field,const double value)
  {
   ResetLastError();
   if(GlobalVariableSet(g_prefix+field,value)==0)
     {
      PrintFormat("GBB: cannot save %s; error=%d",field,GetLastError());
      return false;
     }
   return true;
  }

bool SaveState()
  {
   if(!g_persistent)
      return true;
   // Mark the snapshot incomplete until all fields have been persisted.
   if(!PutMemory(".valid",0.0))
      return false;
   bool ok=true;
   if(!PutMemory(".period",(double)_Period)) ok=false;
   if(!PutMemory(".support",g_support)) ok=false;
   if(!PutMemory(".resist",g_resistance)) ok=false;
   if(!PutMemory(".time",(double)g_breakoutTime)) ok=false;
   if(!PutMemory(".dir",(double)g_direction)) ok=false;
   if(!PutMemory(".ready",g_rangeReady ? 1.0 : 0.0)) ok=false;
   if(!PutMemory(".sent",g_submitted ? 1.0 : 0.0)) ok=false;
   if(!PutMemory(".cancel",g_cancelPending ? 1.0 : 0.0)) ok=false;
   if(!PutMemory(".uncertain",g_uncertain ? 1.0 : 0.0)) ok=false;
   if(!PutMemory(".state",(double)g_state)) ok=false;
   if(ok) ok=PutMemory(".valid",1.0);
   GlobalVariablesFlush();
   return ok;
  }

bool GetMemory(const string field,double &value)
  {
   ResetLastError();
   if(!GlobalVariableGet(g_prefix+field,value) || !MathIsValidNumber(value))
     {
      PrintFormat("GBB: missing/invalid snapshot field %s; error=%d",
                  field,GetLastError());
      return false;
     }
   return true;
  }

void RestoreState()
  {
   if(!g_persistent || !GlobalVariableCheck(g_prefix+".valid"))
      return;
   double valid,period,support,resistance,time,direction,ready,sent,state,cancel,uncertain;
   if(!GetMemory(".valid",valid) || valid!=1.0 ||
      !GetMemory(".period",period) || !GetMemory(".support",support) ||
      !GetMemory(".resist",resistance) || !GetMemory(".time",time) ||
      !GetMemory(".dir",direction) || !GetMemory(".ready",ready) ||
      !GetMemory(".sent",sent) || !GetMemory(".state",state) ||
      !GetMemory(".cancel",cancel) || !GetMemory(".uncertain",uncertain))
     {
      Print("GBB: incomplete recovery snapshot; orphan orders will be cancelled.");
      g_cancelPending=true;
      return;
     }
   if(period!=(double)_Period || state<0.0 || state>2.0 ||
      state!=MathFloor(state) || (ready!=0.0 && ready!=1.0) ||
      (sent!=0.0 && sent!=1.0) ||
      (cancel!=0.0 && cancel!=1.0) || (uncertain!=0.0 && uncertain!=1.0) ||
      (ready==1.0 && (support<=0.0 || resistance<=support)) ||
      (state==STATE_WAITING_RETEST &&
       (ready!=1.0 || time<=0.0 || (direction!=1.0 && direction!=-1.0))))
     {
      Print("GBB: recovery timeframe changed or snapshot invalid; cancel pending setup.");
      g_cancelPending=true;
      return;
     }
   g_state=(ENUM_STRATEGY_STATE)(int)state;
   g_support=support;
   g_resistance=resistance;
   g_breakoutTime=(datetime)time;
   g_direction=(int)direction;
   g_rangeReady=(ready==1.0);
   g_submitted=(sent==1.0);
   g_cancelPending=(cancel==1.0);
   g_uncertain=(uncertain==1.0);
   g_level=(g_direction==1 ? g_resistance : g_support);
  }

bool AcquireLock()
  {
   if(!g_persistent)
      return true;
   // GlobalVariableTemp reports 4502 when the name already exists, including
   // a released lock left by OnDeinit. Never overwrite an existing owner.
   ResetLastError();
   if(!GlobalVariableCheck(g_lockName) && !GlobalVariableTemp(g_lockName))
     {
      int error=GetLastError();
      // Another chart may have created the lock between the check and create.
      if(error!=ERR_GLOBALVARIABLE_EXISTS || !GlobalVariableCheck(g_lockName))
        {
         PrintFormat("GBB: cannot create instance lock; error=%d",error);
         return false;
        }
     }
   double owner=0.0;
   ResetLastError();
   if(!GlobalVariableGet(g_lockName,owner))
     {
      PrintFormat("GBB: cannot read instance lock; error=%d",GetLastError());
      return false;
     }
   if(owner!=0.0)
     {
      bool chart_exists=false;
      for(long chart=ChartFirst();chart!=-1;chart=ChartNext(chart))
         if((double)chart==owner)
            chart_exists=true;
      if(!chart_exists)
        {
         ResetLastError();
         if(!GlobalVariableSetOnCondition(g_lockName,0.0,owner))
           {
            PrintFormat("GBB: cannot reclaim stale instance lock; error=%d",GetLastError());
            return false;
           }
        }
     }
   ResetLastError();
   if(!GlobalVariableSetOnCondition(g_lockName,(double)ChartID(),0.0))
     {
      PrintFormat("GBB: instance lock unavailable (another chart may own this account/symbol/magic); error=%d. Use a unique magic.",
                  GetLastError());
      return false;
     }
   g_lockOwned=true;
   return true;
  }

void DeleteLines()
  {
   string names[2];
   names[0]=g_supportName;
   names[1]=g_resistanceName;
   for(int i=0;i<2;i++)
      if(names[i]!="" && ObjectFind(0,names[i])>=0 &&
         !ObjectDelete(0,names[i]))
         PrintFormat("GBB: cannot delete line %s; error=%d",names[i],GetLastError());
   ChartRedraw();
  }

bool SetLine(const string name,const double price,const color line_color)
  {
   ResetLastError();
   if(ObjectFind(0,name)<0 && !ObjectCreate(0,name,OBJ_HLINE,0,0,price))
     {
      PrintFormat("GBB: cannot create line %s; error=%d",name,GetLastError());
      return false;
     }
   if(!ObjectSetDouble(0,name,OBJPROP_PRICE,price) ||
      !ObjectSetInteger(0,name,OBJPROP_COLOR,line_color) ||
      !ObjectSetInteger(0,name,OBJPROP_WIDTH,InpLineWidth) ||
      !ObjectSetInteger(0,name,OBJPROP_STYLE,STYLE_SOLID) ||
      !ObjectSetInteger(0,name,OBJPROP_BACK,false) ||
      !ObjectSetInteger(0,name,OBJPROP_TIMEFRAMES,OBJ_ALL_PERIODS) ||
      !ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false) ||
      !ObjectSetInteger(0,name,OBJPROP_HIDDEN,false))
     {
      PrintFormat("GBB: cannot configure line %s; error=%d",name,GetLastError());
      return false;
     }
   return true;
  }

bool DrawLines()
  {
   if(!SetLine(g_supportName,g_support,InpSupportColor) ||
      !SetLine(g_resistanceName,g_resistance,InpResistanceColor))
     {
      DeleteLines();
      return false;
     }
   ChartRedraw();
   return true;
  }

void ResetSetup(const string reason)
  {
   Print("GBB: ",reason);
   DeleteLines();
   g_state=STATE_SEARCHING_BUILDUP;
   g_rangeReady=false;
   g_submitted=false;
   g_cancelPending=false;
   g_uncertain=false;
   g_support=0.0;
   g_resistance=0.0;
   g_level=0.0;
   g_direction=0;
   g_breakoutTime=0;
   g_previousBid=0.0;
   g_lastBar=iTime(_Symbol,_Period,0);
   SaveState();
  }

bool IsOwnedPosition()
  {
   return PositionGetString(POSITION_SYMBOL)==_Symbol &&
          (ulong)PositionGetInteger(POSITION_MAGIC)==InpMagicNumber;
  }

bool IsOwnedOrder()
  {
   return OrderGetString(ORDER_SYMBOL)==_Symbol &&
          (ulong)OrderGetInteger(ORDER_MAGIC)==InpMagicNumber;
  }

void CountExposure(int &positions,int &orders)
  {
   positions=0;
   orders=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
      if(PositionGetTicket(i)!=0 && IsOwnedPosition())
         positions++;
   for(int i=OrdersTotal()-1;i>=0;i--)
      if(OrderGetTicket(i)!=0 && IsOwnedOrder())
         orders++;
  }

bool NettingSymbolOccupied()
  {
   if((ENUM_ACCOUNT_MARGIN_MODE)AccountInfoInteger(ACCOUNT_MARGIN_MODE)==
      ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
      return false;
   return PositionSelect(_Symbol);
  }

bool DeletePending()
  {
   bool ok=true;
   for(int i=OrdersTotal()-1;i>=0;i--)
     {
      ulong ticket=OrderGetTicket(i);
      if(ticket==0 || !IsOwnedOrder())
         continue;
      if(!g_trade.OrderDelete(ticket) || g_trade.ResultRetcode()!=TRADE_RETCODE_DONE)
        {
         PrintFormat("GBB: order deletion failed #%I64u: %u %s (error=%d)",
                     ticket,g_trade.ResultRetcode(),g_trade.ResultRetcodeDescription(),
                     GetLastError());
         ok=false;
        }
     }
   return ok;
  }

// Never reset an expired signal until its broker-side order is gone.
bool ReconcileExposure()
  {
   // An offline account cache is not proof that a server order/trade is gone.
   if(!MQLInfoInteger(MQL_TESTER) && !TerminalInfoInteger(TERMINAL_CONNECTED))
      return true;
   int positions,orders;
   CountExposure(positions,orders);
   if(positions>0)
     {
      if(g_uncertain)
        {
         g_uncertain=false;
         SaveState();
        }
      if(g_state!=STATE_IN_TRADE)
        {
         g_state=STATE_IN_TRADE;
         g_submitted=true;
         SaveState();
         Print("GBB: position active; no further entry for this signal.");
        }
      // Also removes any unfilled remainder after a partial pending fill.
      if(orders>0)
         DeletePending();
      return true;
     }
   if(orders>0)
     {
      if(g_uncertain)
        {
         g_uncertain=false;
         SaveState();
        }
      if(g_state!=STATE_WAITING_RETEST || !g_submitted || !g_rangeReady ||
         NettingSymbolOccupied())
         g_cancelPending=true;
      if(g_cancelPending)
        {
         if(DeletePending())
           {
            CountExposure(positions,orders);
            if(positions==0 && orders==0)
               ResetSetup("pending setup cancelled.");
           }
         return true;
        }
      return false;
     }
   // An accepted-but-not-yet-visible request or a timeout is not a rejection.
   // Do not start another setup until exposure arrives or this window expires.
   if(g_uncertain && g_submitted && g_state==STATE_WAITING_RETEST)
      return false;
   if(g_submitted || g_state==STATE_IN_TRADE || g_cancelPending)
     {
      ResetSetup("trade closed, order removed, or consumed setup recovered.");
      return true;
     }
   return false;
  }

bool TradingAllowed()
  {
   if((!MQLInfoInteger(MQL_TESTER) &&
       (!TerminalInfoInteger(TERMINAL_CONNECTED) ||
        !TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))) ||
      !MQLInfoInteger(MQL_TRADE_ALLOWED) ||
      !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) ||
      !AccountInfoInteger(ACCOUNT_TRADE_EXPERT))
     {
      Print("GBB: entry rejected: connection or automated trading permission unavailable.");
      return false;
     }
   ENUM_SYMBOL_TRADE_MODE mode=(ENUM_SYMBOL_TRADE_MODE)
                               SymbolInfoInteger(_Symbol,SYMBOL_TRADE_MODE);
   if(mode==SYMBOL_TRADE_MODE_DISABLED || mode==SYMBOL_TRADE_MODE_CLOSEONLY ||
      (g_direction==1 && mode==SYMBOL_TRADE_MODE_SHORTONLY) ||
      (g_direction==-1 && mode==SYMBOL_TRADE_MODE_LONGONLY))
     {
      Print("GBB: entry rejected by symbol trading direction/mode.");
      return false;
     }
   return true;
  }

bool MakePrices(const MqlTick &tick,const bool pending,
                double &entry,double &sl,double &tp)
  {
   entry=GBBTickPrice(pending ? g_level : (g_direction==1 ? tick.ask : tick.bid),
                      g_tickSize,_Digits);
   double raw_sl=(InpStopMode==STOP_OPPOSITE_RANGE ?
                  (g_direction==1 ? g_support : g_resistance) :
                  entry-g_direction*InpStopLossPips*g_pip);
   sl=GBBTickPrice(raw_sl,g_tickSize,_Digits);
   double risk=g_direction*(entry-sl);
   tp=GBBTickPrice(entry+g_direction*
                   (InpTargetMode==TARGET_RISK_REWARD ? risk*InpRiskRewardRatio :
                    InpTakeProfitPips*g_pip),g_tickSize,_Digits);
   double distance=(double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*_Point;
   double epsilon=g_tickSize*1e-6;
   if(!PositiveFinite(entry) || !PositiveFinite(sl) || !PositiveFinite(tp) ||
      risk<g_tickSize-epsilon || g_direction*(tp-entry)<g_tickSize-epsilon ||
      risk+epsilon<distance || g_direction*(tp-entry)+epsilon<distance)
     {
      Print("GBB: SL/TP invalid or closer than the broker stop distance; setup skipped.");
      return false;
     }
   if(pending)
     {
      double gap=(g_direction==1 ? tick.ask-entry : entry-tick.bid);
      if(gap<g_tickSize-epsilon || gap+epsilon<distance)
        {
         Print("GBB: line is not a valid limit price at this quote; no market fallback.");
         return false;
        }
     }
   else
     {
      // Buy stops are tested against Bid; sell stops against Ask.
      double reference=(g_direction==1 ? tick.bid : tick.ask);
      if(g_direction*(reference-sl)<g_tickSize-epsilon ||
         g_direction*(tp-reference)<g_tickSize-epsilon ||
         g_direction*(reference-sl)+epsilon<distance ||
         g_direction*(tp-reference)+epsilon<distance)
        {
         Print("GBB: spread/stop distance invalidates market SL/TP; setup skipped.");
         return false;
        }
     }
   return true;
  }

double DirectionalVolume()
  {
   double total=0.0;
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      if(PositionGetTicket(i)==0 || PositionGetString(POSITION_SYMBOL)!=_Symbol)
         continue;
      ENUM_POSITION_TYPE type=(ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      if((g_direction==1 && type==POSITION_TYPE_BUY) ||
         (g_direction==-1 && type==POSITION_TYPE_SELL))
         total+=PositionGetDouble(POSITION_VOLUME);
     }
   for(int i=OrdersTotal()-1;i>=0;i--)
     {
      if(OrderGetTicket(i)==0 || OrderGetString(ORDER_SYMBOL)!=_Symbol)
         continue;
      ENUM_ORDER_TYPE type=(ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
      bool buy=(type==ORDER_TYPE_BUY_LIMIT || type==ORDER_TYPE_BUY_STOP ||
                type==ORDER_TYPE_BUY_STOP_LIMIT || type==ORDER_TYPE_BUY);
      bool sell=(type==ORDER_TYPE_SELL_LIMIT || type==ORDER_TYPE_SELL_STOP ||
                 type==ORDER_TYPE_SELL_STOP_LIMIT || type==ORDER_TYPE_SELL);
      if((g_direction==1 && buy) || (g_direction==-1 && sell))
         total+=OrderGetDouble(ORDER_VOLUME_CURRENT);
     }
   return total;
  }

bool MakeVolume(const double entry,const double sl,const bool pending,double &volume)
  {
   double minimum=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double maximum=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   double limit=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_LIMIT);
   if(!PositiveFinite(minimum) || !PositiveFinite(maximum) || !PositiveFinite(step))
     {
      Print("GBB: invalid broker volume specification.");
      return false;
     }
   double requested=InpFixedLot;
   if(InpLotMode==LOT_RISK_PERCENT)
     {
      double equity=AccountInfoDouble(ACCOUNT_EQUITY);
      double loss=0.0;
      // Size market orders conservatively for the requested adverse deviation.
      double risk_entry=entry+(pending ? 0.0 : g_direction*InpSlippagePips*g_pip);
      ENUM_ORDER_TYPE side=(g_direction==1 ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);
      if(!PositiveFinite(equity) ||
         !OrderCalcProfit(side,_Symbol,1.0,risk_entry,sl,loss) ||
         !MathIsValidNumber(loss) || loss>=0.0)
        {
         PrintFormat("GBB: cannot calculate account-currency SL risk; error=%d",
                     GetLastError());
         return false;
        }
      requested=equity*(InpRiskPercent/100.0)/(-loss);
      requested=MathMin(requested,maximum);
      if(limit>0.0)
         requested=MathMin(requested,MathMax(0.0,limit-DirectionalVolume()));
     }
   volume=GBBFloorVolume(requested,step);
   if(!PositiveFinite(volume) || volume<minimum-1e-9 || volume>maximum+1e-9 ||
      (limit>0.0 && volume+DirectionalVolume()>limit+1e-9))
     {
      PrintFormat("GBB: requested volume %.8f cannot meet broker limits; no minimum-lot fallback.",
                  requested);
      return false;
     }
   return true;
  }

bool CheckRequest(const MqlTick &tick,const bool pending,const double entry,
                  const double sl,const double tp,const double volume)
  {
   MqlTradeRequest request={};
   MqlTradeCheckResult check={};
   request.action=(pending ? TRADE_ACTION_PENDING : TRADE_ACTION_DEAL);
   request.magic=InpMagicNumber;
   request.symbol=_Symbol;
   request.volume=volume;
   request.price=(pending ? entry : (g_direction==1 ? tick.ask : tick.bid));
   request.sl=sl;
   request.tp=tp;
   request.deviation=(ulong)MathRound(InpSlippagePips*g_pip/_Point);
   request.type=(g_direction==1 ?
                 (pending ? ORDER_TYPE_BUY_LIMIT : ORDER_TYPE_BUY) :
                 (pending ? ORDER_TYPE_SELL_LIMIT : ORDER_TYPE_SELL));
   request.type_time=ORDER_TIME_GTC;
   request.type_filling=ORDER_FILLING_RETURN;
   if(!pending)
     {
      long filling=SymbolInfoInteger(_Symbol,SYMBOL_FILLING_MODE);
      if((filling & SYMBOL_FILLING_FOK)!=0)
         request.type_filling=ORDER_FILLING_FOK;
      else if((filling & SYMBOL_FILLING_IOC)!=0)
         request.type_filling=ORDER_FILLING_IOC;
     }
   ResetLastError();
   if(!OrderCheck(request,check) ||
      (check.retcode!=0 && check.retcode!=TRADE_RETCODE_DONE))
     {
      PrintFormat("GBB: preflight failed: %u %s; free margin=%.2f; error=%d",
                  check.retcode,check.comment,check.margin_free,GetLastError());
      return false;
     }
   return true;
  }

void SubmitEntry(const MqlTick &tick)
  {
   if(g_submitted)
      return;
   int positions,orders;
   CountExposure(positions,orders);
   if(positions>0 || orders>0 || NettingSymbolOccupied())
     {
      ResetSetup("entry skipped: existing position/order or occupied netting symbol.");
      return;
     }
   bool pending=(InpEntryType==ENTRY_LIMIT_ORDER);
   double entry,sl,tp,volume;
   if(!TradingAllowed() || !MakePrices(tick,pending,entry,sl,tp) ||
      !MakeVolume(entry,sl,pending,volume) ||
      !CheckRequest(tick,pending,entry,sl,tp,volume))
     {
      ResetSetup("entry validation failed; signal discarded.");
      return;
     }
   // Persist consumption BEFORE sending. A crash/timeout must never cause a
   // second request for the same breakout, even if the first result is unknown.
   g_submitted=true;
   g_uncertain=true;
   if(!SaveState())
     {
      g_cancelPending=true;
      Print("GBB: cannot persist signal consumption; order NOT sent.");
      return;
     }
   string comment=StringFormat("GBB:%I64d",(long)g_breakoutTime);
   ResetLastError();
   bool sent=false;
   if(pending)
     {
      // Bar-based cancellation is handled by the EA, not a seconds-based expiry.
      if(g_direction==1)
         sent=g_trade.BuyLimit(volume,entry,_Symbol,sl,tp,ORDER_TIME_GTC,0,comment);
      else
         sent=g_trade.SellLimit(volume,entry,_Symbol,sl,tp,ORDER_TIME_GTC,0,comment);
     }
   else if(g_direction==1)
      sent=g_trade.Buy(volume,_Symbol,0.0,sl,tp,comment);
   else
      sent=g_trade.Sell(volume,_Symbol,0.0,sl,tp,comment);

   uint code=g_trade.ResultRetcode();
   bool accepted=(sent && (code==TRADE_RETCODE_DONE ||
                          code==TRADE_RETCODE_PLACED ||
                          code==TRADE_RETCODE_DONE_PARTIAL));
   if(!accepted)
     {
      PrintFormat("GBB: entry failed/uncertain: %u %s; order=%I64u deal=%I64u error=%d. No retry.",
                  code,g_trade.ResultRetcodeDescription(),g_trade.ResultOrder(),
                  g_trade.ResultDeal(),GetLastError());
      // Keep ambiguous requests quarantined until the breakout window ends.
      if(code==TRADE_RETCODE_TIMEOUT || code==TRADE_RETCODE_CONNECTION)
        {
         g_uncertain=true;
         g_cancelPending=true;
         SaveState();
         return;
        }
      ResetSetup("broker rejected entry; signal discarded.");
      return;
     }
   PrintFormat("GBB: %s accepted, volume=%.8f entry=%.*f SL=%.*f TP=%.*f order=%I64u deal=%I64u",
               pending ? "limit" : "market",volume,_Digits,entry,_Digits,sl,
               _Digits,tp,g_trade.ResultOrder(),g_trade.ResultDeal());
   g_uncertain=(code==TRADE_RETCODE_PLACED);
   if(!pending && !g_uncertain)
      g_state=STATE_IN_TRADE;
   SaveState();
  }

void EstablishRange(const MqlRates &rates[])
  {
   double support=0.0,resistance=0.0;
   if(!GBBBuildRange(rates,InpBuildUpCandles,InpMaxRangePips*g_pip,
                    support,resistance))
     {
      PrintFormat("GBB: no qualifying build-up; last %d closed candles span %.2f pips (maximum %.2f). Lines are drawn only for a valid positive range.",
                  InpBuildUpCandles,(resistance-support)/g_pip,InpMaxRangePips);
      return;
     }
   g_support=support;
   g_resistance=resistance;
   g_rangeReady=true;
   if(!DrawLines() || !SaveState())
     {
      ResetSetup("cannot establish range visualization/state.");
      return;
     }
   PrintFormat("GBB: range frozen, support=%.*f resistance=%.*f height=%.2f pips",
               _Digits,g_support,_Digits,g_resistance,(g_resistance-g_support)/g_pip);
  }

void ScanInitialRange()
  {
   // Startup establishes a range only: never replay an old breakout or send
   // an entry from OnInit/OnTimer. Retry unloaded history at most once/second.
   datetime now=TimeLocal();
   if(g_lastInitialScan!=0 && now==g_lastInitialScan)
      return;
   g_lastInitialScan=now;
   MqlRates rates[];
   ArraySetAsSeries(rates,true);
   int required=InpBuildUpCandles+1;
   ResetLastError();
   if(CopyRates(_Symbol,_Period,0,required,rates)!=required)
     {
      PrintFormat("GBB: initial range scan waiting for %d chart candles; error=%d",
                  required,GetLastError());
      return;
     }
   g_initialScanPending=false;
   g_lastBar=rates[0].time;
   EstablishRange(rates);
  }

void ProcessClosedBar(const MqlTick &tick)
  {
   MqlRates rates[];
   ArraySetAsSeries(rates,true);
   int required=InpBuildUpCandles+1;
   ResetLastError();
   if(CopyRates(_Symbol,_Period,0,required,rates)!=required)
     {
      PrintFormat("GBB: waiting for %d chart candles; error=%d",required,GetLastError());
      return;
     }
   if(g_rangeReady)
     {
      double close=rates[1].close;
      int direction=GBBBreakoutDirection(close,g_support,g_resistance);
      if(direction!=0)
        {
         g_direction=direction;
         g_level=(g_direction==1 ? g_resistance : g_support);
         g_breakoutTime=rates[1].time;
         g_previousBid=close;
         g_state=STATE_WAITING_RETEST;
         if(!SaveState())
           {
            ResetSetup("breakout persistence failed; signal discarded.");
            return;
           }
         PrintFormat("GBB: %s breakout at %s; waiting for retest of %.*f",
                     g_direction==1 ? "bullish" : "bearish",
                     TimeToString(g_breakoutTime),_Digits,g_level);
         if(InpEntryType==ENTRY_LIMIT_ORDER)
            SubmitEntry(tick);
         else
           {
            if(GBBRetestTouch(g_direction,g_previousBid,tick.bid,g_level,
                              InpRetestTolerancePips*g_pip))
               SubmitEntry(tick);
            g_previousBid=tick.bid;
           }
        }
      return;
     }
   EstablishRange(rates);
  }

void Manage(const bool allow_entry)
  {
   if(!g_initialized)
      return;
   if(ReconcileExposure())
      return;
   if(g_initialScanPending)
     {
      if(g_state==STATE_SEARCHING_BUILDUP && !g_rangeReady)
        {
         ScanInitialRange();
         return;
        }
      g_initialScanPending=false;
     }
   datetime current_bar=iTime(_Symbol,_Period,0);
   if(current_bar==0)
      return;
   bool new_bar=(current_bar!=g_lastBar);
   if(allow_entry)
      g_lastBar=current_bar;
   MqlTick tick;
   if(!SymbolInfoTick(_Symbol,tick) || tick.bid<=0.0 || tick.ask<=0.0)
      return;
   if(g_state==STATE_WAITING_RETEST)
     {
      int shift=iBarShift(_Symbol,_Period,g_breakoutTime,true);
      if(shift<1 || GBBRetestExpired(shift,InpMaxWaitBars))
        {
         if(shift<1)
            Print("GBB: breakout candle unavailable in chart history; cancelling setup.");
         g_cancelPending=true;
         if(DeletePending())
           {
            int positions,orders;
            CountExposure(positions,orders);
            if(positions==0 && orders==0)
               ResetSetup("retest window expired.");
           }
         return;
        }
      if(allow_entry && !g_submitted && InpEntryType==ENTRY_MARKET_TOUCH &&
         GBBRetestTouch(g_direction,g_previousBid,tick.bid,g_level,
                        InpRetestTolerancePips*g_pip))
         SubmitEntry(tick);
      if(allow_entry)
         g_previousBid=tick.bid;
      return;
     }
   if(g_state==STATE_SEARCHING_BUILDUP && new_bar && allow_entry)
      ProcessClosedBar(tick);
  }

int OnInit()
  {
   if(!ValidateInputs())
      return INIT_PARAMETERS_INCORRECT;
   g_pip=GBBPipSize(_Point,_Digits);
   g_tickSize=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
   if(!PositiveFinite(g_pip) || !PositiveFinite(g_tickSize))
     {
      Print("GBB: invalid symbol point/tick size.");
      return INIT_FAILED;
     }
   long order_mode=SymbolInfoInteger(_Symbol,SYMBOL_ORDER_MODE);
   if((order_mode & SYMBOL_ORDER_SL)==0 || (order_mode & SYMBOL_ORDER_TP)==0 ||
      (InpEntryType==ENTRY_LIMIT_ORDER && (order_mode & SYMBOL_ORDER_LIMIT)==0) ||
      (InpEntryType==ENTRY_MARKET_TOUCH && (order_mode & SYMBOL_ORDER_MARKET)==0) ||
      (InpEntryType==ENTRY_LIMIT_ORDER &&
       (SymbolInfoInteger(_Symbol,SYMBOL_EXPIRATION_MODE) & SYMBOL_EXPIRATION_GTC)==0))
     {
      Print("GBB: symbol does not support the requested order/SL/TP/GTC capabilities.");
      return INIT_FAILED;
     }
   if((SymbolInfoInteger(_Symbol,SYMBOL_EXPIRATION_MODE) & SYMBOL_EXPIRATION_GTC)!=0 &&
      SymbolInfoInteger(_Symbol,SYMBOL_ORDER_GTC_MODE)==SYMBOL_ORDERS_DAILY)
     {
      Print("GBB: broker removes SL/TP at day change; this symbol is unsupported.");
      return INIT_FAILED;
     }
   uint symbol_hash=2166136261;
   string identity=AccountInfoString(ACCOUNT_SERVER)+"|"+_Symbol;
   for(int i=0;i<StringLen(identity);i++)
      symbol_hash=(symbol_hash^(uint)StringGetCharacter(identity,i))*16777619;
   g_prefix=StringFormat("GBB.%I64d.%u.%I64u",AccountInfoInteger(ACCOUNT_LOGIN),
                         symbol_hash,InpMagicNumber);
   g_lockName=g_prefix+".lock";
   g_supportName=g_prefix+".Support";
   g_resistanceName=g_prefix+".Resistance";
   if(StringLen(g_resistanceName)>63)
     {
      Print("GBB: account/magic namespace exceeds terminal name limit.");
      return INIT_PARAMETERS_INCORRECT;
     }
   g_persistent=!MQLInfoInteger(MQL_TESTER);
   if(!AcquireLock())
      return INIT_FAILED;
   g_ownsObjects=true;
   g_trade.SetExpertMagicNumber(InpMagicNumber);
   g_trade.SetDeviationInPoints((ulong)MathRound(InpSlippagePips*g_pip/_Point));
   g_trade.SetAsyncMode(false);
   if(!g_trade.SetTypeFillingBySymbol(_Symbol))
     {
      Print("GBB: cannot select a supported broker filling mode.");
      return INIT_FAILED;
     }
   RestoreState();
   g_initialScanPending=(g_state==STATE_SEARCHING_BUILDUP && !g_rangeReady);
   g_lastBar=iTime(_Symbol,_Period,0);
   MqlTick tick;
   if(SymbolInfoTick(_Symbol,tick))
      g_previousBid=tick.bid;
   if(g_rangeReady && !DrawLines())
      return INIT_FAILED;
   if(!EventSetTimer(1))
     {
      PrintFormat("GBB: cannot start lifecycle timer; error=%d",GetLastError());
      return INIT_FAILED;
     }
   g_initialized=true;
   if(!ReconcileExposure() && g_initialScanPending)
      ScanInitialRange();
   Print("GBB: initialized on ",_Symbol," ",EnumToString(_Period),
         "; pip=",DoubleToString(g_pip,_Digits),".");
   return INIT_SUCCEEDED;
  }

void OnTick()
  {
   Manage(true);
  }

void OnTimer()
  {
   // Timer manages closure/cancellation only; a stale quote must not open a trade.
   Manage(false);
  }

void OnTradeTransaction(const MqlTradeTransaction &transaction,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   if(!g_initialized || transaction.type!=TRADE_TRANSACTION_DEAL_ADD ||
      transaction.deal==0)
      return;
   if(!HistoryDealSelect(transaction.deal))
     {
      PrintFormat("GBB: cannot select transaction deal #%I64u; error=%d",
                  transaction.deal,GetLastError());
      return;
     }
   if(HistoryDealGetString(transaction.deal,DEAL_SYMBOL)!=_Symbol ||
      (ulong)HistoryDealGetInteger(transaction.deal,DEAL_MAGIC)!=InpMagicNumber)
      return;
   ENUM_DEAL_ENTRY entry=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(transaction.deal,DEAL_ENTRY);
   if(entry==DEAL_ENTRY_IN || entry==DEAL_ENTRY_INOUT)
     {
      // Record even a trade that opens and closes between two ticks.
      g_submitted=true;
      g_uncertain=false;
      g_state=STATE_IN_TRADE;
      SaveState();
     }
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   if(g_initialized)
     {
      if(reason==REASON_REMOVE || reason==REASON_CHARTCLOSE || reason==REASON_TEMPLATE)
        {
         g_cancelPending=true;
         if(DeletePending())
           {
            int positions,orders;
            CountExposure(positions,orders);
            if(positions==0 && orders==0)
               ResetSetup("EA removed; pending setup cancelled.");
           }
        }
      SaveState();
     }
   // A rejected duplicate instance must not delete the active owner's objects.
   if(g_ownsObjects)
      DeleteLines();
   if(g_lockOwned &&
      !GlobalVariableSetOnCondition(g_lockName,0.0,(double)ChartID()))
      PrintFormat("GBB: cannot release instance lock; error=%d",GetLastError());
   g_initialized=false;
  }
