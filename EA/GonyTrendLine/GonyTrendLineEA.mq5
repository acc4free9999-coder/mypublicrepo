//+------------------------------------------------------------------+
//|                                           GonyTrendLineEA.mq5     |
//|  Places one Buy Limit / Sell Limit order per manual trendline.   |
//|  Trendlines must be drawn manually on the chart. No SL/TP is set. |
//+------------------------------------------------------------------+
#property copyright "GonyTrendLine EA"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>

enum ENUM_TRENDLINE_ORDER_MODE
  {
   TRENDLINE_ORDER_AUTO            = 0, // Buy limit below price, sell limit above price
   TRENDLINE_ORDER_BUY_LIMIT_ONLY  = 1, // Only buy limits
   TRENDLINE_ORDER_SELL_LIMIT_ONLY = 2  // Only sell limits
  };

input group "=== Trade Settings ==="
input double                    InpLots             = 0.50;       // Order lot size
input ulong                     InpMagicNumber      = 20260920;   // Magic number
input ulong                     InpDeviationPoints  = 20;         // Max deviation (points)
input ENUM_TRENDLINE_ORDER_MODE InpOrderMode        = TRENDLINE_ORDER_AUTO; // Allowed pending order side
input int                       InpMaxActiveOrders  = 5;          // Maximum EA pending limit orders
input bool                      InpOnePositionOnly  = false;      // Do not place limits if this symbol has an EA position

input group "=== Trendline Touch Prediction ==="
input int     InpLookAheadBars              = 3;       // Bars ahead to project the line
input double  InpMaxPredictionDistancePoints= 500;     // Only place if line is within this distance (0 = unlimited)
input double  InpEarlyEntryPips             = 0.0;     // Place limit this many pips before trendline touch
input double  InpMinStopBufferPoints        = 2;       // Extra buffer beyond broker stop/freeze levels
input bool    InpRespectTrendlineEnd        = false;   // Ignore prices beyond line end unless Ray Right is enabled

input group "=== Manual Trendline Filter ==="
input string  InpNameContains       = "";      // Trade only trendlines whose name contains this text (empty = all)
input string  InpIgnoredNamePrefix  = "STD_";  // Ignore trendlines starting with this prefix (empty = none)
input bool    InpIgnoreHiddenObjects= true;    // Ignore hidden trendline objects
input int     InpTimerSeconds       = 1;       // Chart scan interval in seconds

CTrade trade;

string g_comment_prefix = "GTL:";
string g_memory_prefix = "GTL_USED_";
datetime g_last_scan = 0;
datetime g_last_bar_time = 0;

struct TrendlineSetup
  {
   bool            valid;
   string          name;
   string          comment;
   ENUM_ORDER_TYPE type;
   double          price;
   datetime        target_time;
  };

//+------------------------------------------------------------------+
int OnInit()
  {
   trade.SetExpertMagicNumber((int)InpMagicNumber);
   trade.SetDeviationInPoints((int)InpDeviationPoints);
   ChartSetInteger(0, CHART_EVENT_OBJECT_DELETE, true);

   if(InpTimerSeconds > 0)
      EventSetTimer(InpTimerSeconds);

   ManageTrendlines();
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   Comment("");
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   ManageTrendlines();
  }

//+------------------------------------------------------------------+
void OnTimer()
  {
   ManageTrendlines();
  }

//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
  {
   if(sparam == "")
      return;

   if(id == CHARTEVENT_OBJECT_DELETE)
     {
      DeleteManagedOrder(BuildOrderComment(sparam));
      return;
     }

   if(id != CHARTEVENT_OBJECT_DRAG && id != CHARTEVENT_OBJECT_CHANGE)
      return;

   if(ObjectFind(0, sparam) < 0)
      return;
   if((ENUM_OBJECT)ObjectGetInteger(0, sparam, OBJPROP_TYPE) != OBJ_TREND)
      return;
   if(!ShouldUseTrendline(sparam))
      return;

   UpdateExistingOrder(sparam, BuildOrderComment(sparam));
  }

//+------------------------------------------------------------------+
void ManageTrendlines()
  {
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) ||
      !MQLInfoInteger(MQL_TRADE_ALLOWED))
     {
      Comment("GonyTrendLineEA: trading is not allowed by terminal or EA settings.");
      return;
     }

   datetime now = TimeCurrent();
   if(now == g_last_scan)
      return;
   g_last_scan = now;

   int managed_orders = CountManagedPendingOrders();
   bool position_blocks_entries = InpOnePositionOnly && HasManagedPositionForSymbol();
   bool candle_closed = HasCurrentCandleClosed();

   int total = ObjectsTotal(0, 0, OBJ_TREND);
   string active_comments[];
   int valid_setups = 0;
   int used_trendlines = 0;
   int updated_orders = 0;
   int duplicate_orders_removed = 0;

   for(int i = 0; i < total; i++)
     {
      string name = ObjectName(0, i, 0, OBJ_TREND);
      if(name == "")
         continue;

      TrendlineSetup setup;
      setup.valid = false;
      setup.name = name;
      setup.comment = BuildOrderComment(name);
      AddString(active_comments, setup.comment);

      if(!ShouldUseTrendline(name))
         continue;

      duplicate_orders_removed += EnforceSingleOrderForTrendline(setup.comment);

      if(HasTrendlineBeenUsed(setup.comment))
        {
         used_trendlines++;
         if(candle_closed && UpdateExistingOrder(name, setup.comment))
            updated_orders++;
         continue;
        }

      if(!BuildSetup(name, setup))
         continue;

      valid_setups++;

      ulong ticket = 0;
      ENUM_ORDER_TYPE existing_type = ORDER_TYPE_BUY_LIMIT;
      double existing_price = 0.0;
      if(HasManagedPosition(setup.comment) ||
         FindManagedOrder(setup.comment, ticket, existing_type, existing_price))
        {
         MarkTrendlineUsed(setup.comment);
         used_trendlines++;
         continue;
        }

      if(position_blocks_entries)
         continue;

      if(PlaceLimit(setup, managed_orders))
        {
         MarkTrendlineUsed(setup.comment);
         used_trendlines++;
        }
     }

   int removed_orders = DeleteOrdersForRemovedTrendlines(active_comments);

   Comment("GonyTrendLineEA\n",
           "Manual trendlines: ", total, "\n",
           "Valid setups: ", valid_setups, "\n",
           "Already used trendlines: ", used_trendlines, "\n",
           "Orders updated on candle close: ", updated_orders, "\n",
           "Duplicate orders removed: ", duplicate_orders_removed, "\n",
           "Orders removed for deleted trendlines: ", removed_orders, "\n",
           "EA pending limit orders: ", CountManagedPendingOrders());
  }

//+------------------------------------------------------------------+
bool HasCurrentCandleClosed()
  {
   datetime current_bar_time = iTime(_Symbol, _Period, 0);
   if(current_bar_time == 0)
      return false;

   if(g_last_bar_time == 0)
     {
      g_last_bar_time = current_bar_time;
      return false;
     }

   if(current_bar_time == g_last_bar_time)
      return false;

   g_last_bar_time = current_bar_time;
   return true;
  }

//+------------------------------------------------------------------+
bool UpdateExistingOrder(const string trendline_name, const string comment)
  {
   ulong ticket = 0;
   ENUM_ORDER_TYPE existing_type = ORDER_TYPE_BUY_LIMIT;
   double existing_price = 0.0;
   if(!FindManagedOrder(comment, ticket, existing_type, existing_price))
      return false;

   TrendlineSetup setup;
   setup.valid = false;
   setup.name = trendline_name;
   setup.comment = comment;
   if(!BuildSetup(trendline_name, setup))
      return false;

   if(existing_type != setup.type)
      return false;

   if(MathAbs(existing_price - setup.price) < _Point * 0.5)
      return false;

   return ModifyOrder(ticket, setup.price);
  }

//+------------------------------------------------------------------+
bool DeleteManagedOrder(const string comment)
  {
   ulong ticket = 0;
   ENUM_ORDER_TYPE type = ORDER_TYPE_BUY_LIMIT;
   double price = 0.0;
   if(!FindManagedOrder(comment, ticket, type, price))
      return false;

   return DeleteOrder(ticket);
  }

//+------------------------------------------------------------------+
int EnforceSingleOrderForTrendline(const string comment)
  {
   int removed = 0;
   ulong kept_ticket = 0;

   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0 || !IsManagedPendingOrder())
         continue;
      if(OrderGetString(ORDER_COMMENT) != comment)
         continue;

      if(kept_ticket == 0)
        {
         kept_ticket = ticket;
         continue;
        }

      if(DeleteOrder(ticket))
         removed++;
     }

   return removed;
  }

//+------------------------------------------------------------------+
int DeleteOrdersForRemovedTrendlines(const string &active_comments[])
  {
   int removed = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0 || !IsManagedPendingOrder())
         continue;

      string comment = OrderGetString(ORDER_COMMENT);
      if(StringArrayContains(active_comments, comment))
         continue;

      if(DeleteOrder(ticket))
         removed++;
     }
   return removed;
  }

//+------------------------------------------------------------------+
bool ShouldUseTrendline(const string name)
  {
   if(InpNameContains != "" && StringFind(name, InpNameContains) < 0)
      return false;

   if(InpIgnoredNamePrefix != "" &&
      StringSubstr(name, 0, StringLen(InpIgnoredNamePrefix)) == InpIgnoredNamePrefix)
      return false;

   if(InpIgnoreHiddenObjects && ObjectGetInteger(0, name, OBJPROP_HIDDEN))
      return false;

   return true;
  }

//+------------------------------------------------------------------+
bool BuildSetup(const string name, TrendlineSetup &setup)
  {
   int seconds = PeriodSeconds(_Period);
   if(seconds <= 0)
      seconds = 60;

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   if(bid <= 0.0 || ask <= 0.0)
      return false;

   double mid = (bid + ask) * 0.5;
   double max_distance = MathMax(0.0, InpMaxPredictionDistancePoints) * _Point;
   double min_stop_distance = MinPendingDistance();
   double early_entry_distance = MathMax(0.0, InpEarlyEntryPips) * PipSize();

   int look_ahead = MathMax(0, InpLookAheadBars);
   for(int bar = 0; bar <= look_ahead; bar++)
     {
      datetime target_time = TimeCurrent() + (datetime)(bar * seconds);
      double line_price = 0.0;
      if(!TrendlinePriceAtTime(name, target_time, line_price))
         continue;

      line_price = NormalizePrice(line_price);
      if(line_price <= 0.0)
         continue;

      if(max_distance > 0.0 && MathAbs(mid - line_price) > max_distance)
         continue;

      if(line_price < ask - min_stop_distance &&
         InpOrderMode != TRENDLINE_ORDER_SELL_LIMIT_ONLY)
        {
         double entry_price = NormalizePrice(line_price + early_entry_distance);
         double highest_allowed = NormalizePrice(ask - min_stop_distance);
         if(entry_price > highest_allowed)
            entry_price = highest_allowed;
         if(entry_price > ask - min_stop_distance)
            continue;

         setup.valid = true;
         setup.type = ORDER_TYPE_BUY_LIMIT;
         setup.price = entry_price;
         setup.target_time = target_time;
         return true;
        }

      if(line_price > bid + min_stop_distance &&
         InpOrderMode != TRENDLINE_ORDER_BUY_LIMIT_ONLY)
        {
         double entry_price = NormalizePrice(line_price - early_entry_distance);
         double lowest_allowed = NormalizePrice(bid + min_stop_distance);
         if(entry_price < lowest_allowed)
            entry_price = lowest_allowed;
         if(entry_price < bid + min_stop_distance)
            continue;

         setup.valid = true;
         setup.type = ORDER_TYPE_SELL_LIMIT;
         setup.price = entry_price;
         setup.target_time = target_time;
         return true;
        }
     }

   return false;
  }

//+------------------------------------------------------------------+
bool TrendlinePriceAtTime(const string name, const datetime target_time, double &price)
  {
   datetime time1 = (datetime)ObjectGetInteger(0, name, OBJPROP_TIME, 0);
   datetime time2 = (datetime)ObjectGetInteger(0, name, OBJPROP_TIME, 1);
   double price1 = ObjectGetDouble(0, name, OBJPROP_PRICE, 0);
   double price2 = ObjectGetDouble(0, name, OBJPROP_PRICE, 1);

   if(time1 == 0 || time2 == 0 || time1 == time2)
      return false;

   datetime left_time = (datetime)MathMin(time1, time2);
   datetime right_time = (datetime)MathMax(time1, time2);
   bool ray_right = ObjectGetInteger(0, name, OBJPROP_RAY_RIGHT);

   if(InpRespectTrendlineEnd && !ray_right && target_time > right_time)
      return false;
   if(target_time < left_time)
      return false;

   price = price1 + (price2 - price1) *
           ((double)(target_time - time1) / (double)(time2 - time1));

   return MathIsValidNumber(price);
  }

//+------------------------------------------------------------------+
bool PlaceLimit(const TrendlineSetup &setup, int &managed_orders)
  {
   if(managed_orders >= MathMax(0, InpMaxActiveOrders))
      return false;

   ulong ticket = 0;
   ENUM_ORDER_TYPE existing_type = ORDER_TYPE_BUY_LIMIT;
   double existing_price = 0.0;
   if(FindManagedOrder(setup.comment, ticket, existing_type, existing_price))
      return false;

   double lots = NormalizeLot(InpLots);
   if(lots <= 0.0)
     {
      Print("GonyTrendLineEA: invalid lot size after normalization: ", InpLots);
      return false;
     }

   trade.SetExpertMagicNumber((int)InpMagicNumber);
   trade.SetDeviationInPoints((int)InpDeviationPoints);

   bool placed = false;
   if(setup.type == ORDER_TYPE_BUY_LIMIT)
      placed = trade.BuyLimit(lots, setup.price, _Symbol, 0.0, 0.0, ORDER_TIME_GTC, 0, setup.comment);
   else if(setup.type == ORDER_TYPE_SELL_LIMIT)
      placed = trade.SellLimit(lots, setup.price, _Symbol, 0.0, 0.0, ORDER_TIME_GTC, 0, setup.comment);

   if(!placed)
     {
      Print("GonyTrendLineEA: failed to place ", OrderTypeText(setup.type),
            " for trendline '", setup.name, "' at ", DoubleToString(setup.price, _Digits),
            ". Retcode=", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription());
      return false;
     }

   managed_orders++;
   Print("GonyTrendLineEA: placed ", OrderTypeText(setup.type),
         " at ", DoubleToString(setup.price, _Digits),
         " for trendline '", setup.name, "'");
   return true;
  }

//+------------------------------------------------------------------+
bool FindManagedOrder(const string comment, ulong &ticket,
                      ENUM_ORDER_TYPE &type, double &price)
  {
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong current_ticket = OrderGetTicket(i);
      if(current_ticket == 0 || !IsManagedPendingOrder())
         continue;

      if(OrderGetString(ORDER_COMMENT) != comment)
         continue;

      ticket = current_ticket;
      type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
      price = OrderGetDouble(ORDER_PRICE_OPEN);
      return true;
     }

   return false;
  }

//+------------------------------------------------------------------+
bool ModifyOrder(const ulong ticket, const double price)
  {
   if(!OrderSelect(ticket))
      return false;

   trade.SetExpertMagicNumber((int)InpMagicNumber);
   bool modified = trade.OrderModify(ticket, price, 0.0, 0.0,
                                     (ENUM_ORDER_TYPE_TIME)OrderGetInteger(ORDER_TYPE_TIME),
                                     (datetime)OrderGetInteger(ORDER_TIME_EXPIRATION),
                                     OrderGetDouble(ORDER_PRICE_STOPLIMIT));
   if(!modified)
      Print("GonyTrendLineEA: failed to update order ", ticket,
            " to ", DoubleToString(price, _Digits),
            ". Retcode=", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription());
   return modified;
  }

//+------------------------------------------------------------------+
bool DeleteOrder(const ulong ticket)
  {
   trade.SetExpertMagicNumber((int)InpMagicNumber);
   bool deleted = trade.OrderDelete(ticket);
   if(!deleted)
      Print("GonyTrendLineEA: failed to delete order ", ticket,
            " after its trendline was removed. Retcode=",
            trade.ResultRetcode(), " ", trade.ResultRetcodeDescription());
   return deleted;
  }

//+------------------------------------------------------------------+
bool IsManagedPendingOrder()
  {
   if(OrderGetString(ORDER_SYMBOL) != _Symbol)
      return false;
   if((ulong)OrderGetInteger(ORDER_MAGIC) != InpMagicNumber)
      return false;

   ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
   if(type != ORDER_TYPE_BUY_LIMIT && type != ORDER_TYPE_SELL_LIMIT)
      return false;

   return StringSubstr(OrderGetString(ORDER_COMMENT), 0, StringLen(g_comment_prefix)) == g_comment_prefix;
  }

//+------------------------------------------------------------------+
int CountManagedPendingOrders()
  {
   int count = 0;
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket != 0 && IsManagedPendingOrder())
         count++;
     }
   return count;
  }

//+------------------------------------------------------------------+
bool HasManagedPositionForSymbol()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;

      if(PositionGetString(POSITION_SYMBOL) == _Symbol &&
         (ulong)PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
         return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
bool HasManagedPosition(const string comment)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;

      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagicNumber)
         continue;
      if(PositionGetString(POSITION_COMMENT) == comment)
         return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
void MarkTrendlineUsed(const string comment)
  {
   GlobalVariableSet(TrendlineMemoryKey(comment), 1.0);
  }

//+------------------------------------------------------------------+
bool HasTrendlineBeenUsed(const string comment)
  {
   return GlobalVariableCheck(TrendlineMemoryKey(comment));
  }

//+------------------------------------------------------------------+
string TrendlineMemoryKey(const string comment)
  {
   string key_source = _Symbol + "_" + IntegerToString((long)InpMagicNumber) + "_" + comment;
   return g_memory_prefix + IntegerToString((int)HashString(key_source));
  }

//+------------------------------------------------------------------+
double MinPendingDistance()
  {
   long stop_level = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   long freeze_level = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_FREEZE_LEVEL);
   double min_points = (double)MathMax(stop_level, freeze_level) + MathMax(0.0, InpMinStopBufferPoints);
   return min_points * _Point;
  }

//+------------------------------------------------------------------+
double PipSize()
  {
   if(_Digits == 3 || _Digits == 5)
      return _Point * 10.0;
   return _Point;
  }

//+------------------------------------------------------------------+
double NormalizePrice(const double price)
  {
   double tick_size = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double normalized = price;
   if(tick_size > 0.0)
      normalized = MathRound(price / tick_size) * tick_size;
   return NormalizeDouble(normalized, _Digits);
  }

//+------------------------------------------------------------------+
double NormalizeLot(const double lots)
  {
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double min_lot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double max_lot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);

   if(step <= 0.0)
      step = 0.01;

   double normalized = MathRound(lots / step) * step;
   normalized = MathMax(min_lot, MathMin(max_lot, normalized));
   return NormalizeDouble(normalized, 2);
  }

//+------------------------------------------------------------------+
string BuildOrderComment(const string trendline_name)
  {
   return g_comment_prefix + IntegerToString((int)HashString(trendline_name));
  }

//+------------------------------------------------------------------+
uint HashString(const string value)
  {
   uint hash = 2166136261;
   for(int i = 0; i < StringLen(value); i++)
     {
      hash ^= (uint)StringGetCharacter(value, i);
      hash *= 16777619;
     }
   return hash;
  }

//+------------------------------------------------------------------+
void AddString(string &items[], const string value)
  {
   int size = ArraySize(items);
   ArrayResize(items, size + 1);
   items[size] = value;
  }

//+------------------------------------------------------------------+
bool StringArrayContains(const string &items[], const string value)
  {
   for(int i = 0; i < ArraySize(items); i++)
      if(items[i] == value)
         return true;
   return false;
  }

//+------------------------------------------------------------------+
string OrderTypeText(const ENUM_ORDER_TYPE type)
  {
   if(type == ORDER_TYPE_BUY_LIMIT)
      return "Buy Limit";
   if(type == ORDER_TYPE_SELL_LIMIT)
      return "Sell Limit";
   return "Unsupported";
  }