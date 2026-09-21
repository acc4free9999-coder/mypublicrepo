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

input group "=== Panel ==="
input bool    InpShowPanel          = true;     // Show top-left control panel
input int     InpPanelX             = 20;       // Panel X position
input int     InpPanelY             = 20;       // Panel Y position

input group "=== Auto Draw Trendlines ==="
input int     InpAutoTrendlineBars  = 200;      // Bars to search for last buy/sell trendlines
input int     InpAutoSwingLeftBars  = 3;        // Swing bars on older side
input int     InpAutoSwingRightBars = 3;        // Swing bars on newer side
input int     InpAutoLineFutureBars = 5;        // Auto line visual extension after latest swing
input color   InpAutoBuyLineColor   = clrLimeGreen; // Auto buy trendline color
input color   InpAutoSellLineColor  = clrTomato;    // Auto sell trendline color

CTrade trade;

string g_comment_prefix = "GTL:";
string g_memory_prefix = "GTL_USED_";
string g_panel_prefix = "GTL_PANEL_";
string g_auto_line_prefix = "GTL_AUTO_TL_";
datetime g_last_scan = 0;
int g_auto_draw_sequence = 0;
int g_panel_total_trendlines = 0;
int g_panel_valid_setups = 0;
int g_panel_used_trendlines = 0;
int g_panel_cleaned_orders = 0;
int g_panel_pending_orders = 0;

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
   DrawPanel(0, 0, 0, 0, 0);
   ChartRedraw();

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
   DeletePanelObjects();
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
   if(id == CHARTEVENT_CHART_CHANGE)
     {
      g_last_scan = 0;
      DrawLastPanelState();
      ManageTrendlines();
      ChartRedraw();
      return;
     }

   if(id == CHARTEVENT_OBJECT_CLICK && sparam == PanelButtonName())
     {
      ObjectSetInteger(0, PanelButtonName(), OBJPROP_STATE, false);
      int removed = ClearCurrentTrendlines();
      Print("GonyTrendLineEA: clear trendlines button removed ", removed, " trendline(s)");
      g_last_scan = 0;
      ManageTrendlines();
      ChartRedraw();
      return;
     }

   if(id == CHARTEVENT_OBJECT_CLICK && sparam == PanelAutoDrawButtonName())
     {
      ObjectSetInteger(0, PanelAutoDrawButtonName(), OBJPROP_STATE, false);
      int drawn = DrawLastBuySellTrendlines();
      Print("GonyTrendLineEA: auto trendline button drew ", drawn, " trendline(s)");
      g_last_scan = 0;
      ManageTrendlines();
      ChartRedraw();
      return;
     }

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
      DrawClearTrendlinesButton(InpShowPanel ? InpPanelY + 248 : InpPanelY);
      Comment("");
      return;
     }

   datetime now = TimeCurrent();
   if(now == g_last_scan)
     {
      DrawLastPanelState();
      ChartRedraw();
      return;
     }
   g_last_scan = now;

   int managed_orders = CountManagedPendingOrders();
   bool position_blocks_entries = InpOnePositionOnly && HasManagedPositionForSymbol();

   int total = ObjectsTotal(0, 0, OBJ_TREND);
   string active_comments[];
   int valid_setups = 0;
   int used_trendlines = 0;
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
      duplicate_orders_removed += DeleteWrongSideAutoOrder(name, setup.comment);

      if(HasTrendlineBeenUsed(setup.comment))
        {
         used_trendlines++;
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

   int pending_orders = CountManagedPendingOrders();
   SavePanelState(total, valid_setups, used_trendlines,
                  duplicate_orders_removed + removed_orders, pending_orders);
   DrawLastPanelState();
   ChartRedraw();
   Comment("");
  }

//+------------------------------------------------------------------+
void SavePanelState(const int total_trendlines, const int valid_setups,
                    const int used_trendlines,
                    const int cleaned_orders, const int pending_orders)
  {
   g_panel_total_trendlines = total_trendlines;
   g_panel_valid_setups = valid_setups;
   g_panel_used_trendlines = used_trendlines;
   g_panel_cleaned_orders = cleaned_orders;
   g_panel_pending_orders = pending_orders;
  }

//+------------------------------------------------------------------+
void DrawLastPanelState()
  {
   DrawPanel(g_panel_total_trendlines, g_panel_valid_setups,
             g_panel_used_trendlines,
             g_panel_cleaned_orders, g_panel_pending_orders);
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
int DeleteWrongSideAutoOrder(const string trendline_name, const string comment)
  {
   ulong ticket = 0;
   ENUM_ORDER_TYPE type = ORDER_TYPE_BUY_LIMIT;
   double price = 0.0;
   if(!FindManagedOrder(comment, ticket, type, price))
      return 0;

   bool wrong_buy_line_order = IsAutoBuyTrendline(trendline_name) && type != ORDER_TYPE_BUY_LIMIT;
   bool wrong_sell_line_order = IsAutoSellTrendline(trendline_name) && type != ORDER_TYPE_SELL_LIMIT;
   if(!wrong_buy_line_order && !wrong_sell_line_order)
      return 0;

   return DeleteOrder(ticket) ? 1 : 0;
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
int ClearCurrentTrendlines()
  {
   int removed = 0;
   for(int i = ObjectsTotal(0, 0, OBJ_TREND) - 1; i >= 0; i--)
     {
      string name = ObjectName(0, i, 0, OBJ_TREND);
      if(name == "" || !ShouldUseTrendline(name))
         continue;

      DeleteManagedOrder(BuildOrderComment(name));
      if(ObjectDelete(0, name))
         removed++;
      else
         Print("GonyTrendLineEA: failed to delete trendline '", name, "'");
     }
   return removed;
  }

//+------------------------------------------------------------------+
int DrawLastBuySellTrendlines()
  {
   DeleteAutoDrawnTrendlines();

   int bars_to_scan = MathMax(InpAutoTrendlineBars,
                              InpAutoSwingLeftBars + InpAutoSwingRightBars + 10);
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, _Period, 0, bars_to_scan, rates);
   if(copied <= InpAutoSwingLeftBars + InpAutoSwingRightBars + 2)
     {
      Print("GonyTrendLineEA: not enough bars to draw auto trendlines");
      return 0;
     }

   int low_newer = -1;
   int low_older = -1;
   int high_newer = -1;
   int high_older = -1;

   FindLastRisingLowPair(rates, copied, low_newer, low_older);
   FindLastFallingHighPair(rates, copied, high_newer, high_older);

   int drawn = 0;
   g_auto_draw_sequence++;
   string suffix = IntegerToString((long)TimeCurrent()) + "_" + IntegerToString(g_auto_draw_sequence);

   if(low_newer >= 0 && low_older >= 0 &&
      CreateAutoTrendline(AutoTrendlineName("BUY", suffix),
                          rates[low_older].time, rates[low_older].low,
                          rates[low_newer].time, rates[low_newer].low,
                          InpAutoBuyLineColor))
      drawn++;

   if(high_newer >= 0 && high_older >= 0 &&
      CreateAutoTrendline(AutoTrendlineName("SELL", suffix),
                          rates[high_older].time, rates[high_older].high,
                          rates[high_newer].time, rates[high_newer].high,
                          InpAutoSellLineColor))
      drawn++;

   if(drawn == 0)
      Print("GonyTrendLineEA: could not find rising swing lows or falling swing highs to draw trendlines");

   return drawn;
  }

//+------------------------------------------------------------------+
bool FindLastRisingLowPair(const MqlRates &rates[], const int count,
                           int &newer_index, int &older_index)
  {
   newer_index = -1;
   older_index = -1;
   int first = MathMax(1, InpAutoSwingRightBars);
   int last = count - MathMax(1, InpAutoSwingLeftBars) - 1;

   for(int newer = first; newer <= last; newer++)
     {
      if(!IsSwingLow(rates, count, newer))
         continue;

      for(int older = newer + 1; older <= last; older++)
        {
         if(!IsSwingLow(rates, count, older))
            continue;

         if(rates[newer].low > rates[older].low)
           {
            newer_index = newer;
            older_index = older;
            return true;
           }
        }
     }

   return false;
  }

//+------------------------------------------------------------------+
bool FindLastFallingHighPair(const MqlRates &rates[], const int count,
                             int &newer_index, int &older_index)
  {
   newer_index = -1;
   older_index = -1;
   int first = MathMax(1, InpAutoSwingRightBars);
   int last = count - MathMax(1, InpAutoSwingLeftBars) - 1;

   for(int newer = first; newer <= last; newer++)
     {
      if(!IsSwingHigh(rates, count, newer))
         continue;

      for(int older = newer + 1; older <= last; older++)
        {
         if(!IsSwingHigh(rates, count, older))
            continue;

         if(rates[newer].high < rates[older].high)
           {
            newer_index = newer;
            older_index = older;
            return true;
           }
        }
     }

   return false;
  }

//+------------------------------------------------------------------+
bool IsSwingLow(const MqlRates &rates[], const int count, const int index)
  {
   int left = MathMax(1, InpAutoSwingLeftBars);
   int right = MathMax(1, InpAutoSwingRightBars);
   if(index - right < 0 || index + left >= count)
      return false;

   for(int i = 1; i <= left; i++)
      if(rates[index].low >= rates[index + i].low)
         return false;
   for(int i = 1; i <= right; i++)
      if(rates[index].low >= rates[index - i].low)
         return false;

   return true;
  }

//+------------------------------------------------------------------+
bool IsSwingHigh(const MqlRates &rates[], const int count, const int index)
  {
   int left = MathMax(1, InpAutoSwingLeftBars);
   int right = MathMax(1, InpAutoSwingRightBars);
   if(index - right < 0 || index + left >= count)
      return false;

   for(int i = 1; i <= left; i++)
      if(rates[index].high <= rates[index + i].high)
         return false;
   for(int i = 1; i <= right; i++)
      if(rates[index].high <= rates[index - i].high)
         return false;

   return true;
  }

//+------------------------------------------------------------------+
bool CreateAutoTrendline(const string name,
                         const datetime older_time, const double older_price,
                         const datetime newer_time, const double newer_price,
                         const color line_color)
  {
   if(ObjectFind(0, name) >= 0)
      ObjectDelete(0, name);

   datetime end_time = newer_time;
   double end_price = newer_price;
   int seconds = PeriodSeconds(_Period);
   if(seconds <= 0)
      seconds = 60;

   int future_bars = MathMax(0, InpAutoLineFutureBars);
   datetime current_bar_time = iTime(_Symbol, _Period, 0);
   if(current_bar_time <= 0)
      current_bar_time = TimeCurrent();

   if(newer_time != older_time)
     {
      end_time = current_bar_time + (datetime)(future_bars * seconds);
      end_price = newer_price + (newer_price - older_price) *
                  ((double)(end_time - newer_time) / (double)(newer_time - older_time));
     }

   if(!ObjectCreate(0, name, OBJ_TREND, 0, older_time, older_price, end_time, end_price))
     {
      Print("GonyTrendLineEA: failed to create auto trendline '", name, "'");
      return false;
     }

   ObjectSetInteger(0, name, OBJPROP_COLOR, line_color);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_SOLID);
   ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   return true;
  }

//+------------------------------------------------------------------+
void DeleteAutoDrawnTrendlines()
  {
   for(int i = ObjectsTotal(0, 0, OBJ_TREND) - 1; i >= 0; i--)
     {
      string name = ObjectName(0, i, 0, OBJ_TREND);
      if(name == "" || StringFind(name, g_auto_line_prefix) < 0)
         continue;

      DeleteManagedOrder(BuildOrderComment(name));
      ObjectDelete(0, name);
     }
  }

//+------------------------------------------------------------------+
string AutoTrendlineName(const string side, const string suffix)
  {
   return AutoTrendlinePrefix() + side + "_" + suffix;
  }

//+------------------------------------------------------------------+
string AutoTrendlinePrefix()
  {
   string filter_prefix = "";
   if(InpNameContains != "")
      filter_prefix = InpNameContains + "_";
   return filter_prefix + g_auto_line_prefix;
  }

//+------------------------------------------------------------------+
bool IsAutoBuyTrendline(const string name)
  {
   return StringFind(name, g_auto_line_prefix + "BUY_") >= 0;
  }

//+------------------------------------------------------------------+
bool IsAutoSellTrendline(const string name)
  {
   return StringFind(name, g_auto_line_prefix + "SELL_") >= 0;
  }

//+------------------------------------------------------------------+
void DrawPanel(const int total_trendlines, const int valid_setups,
               const int used_trendlines,
               const int cleaned_orders, const int pending_orders)
  {
   if(!InpShowPanel)
     {
      DeletePanelObjectsExceptClearButton();
      DrawClearTrendlinesButton(InpPanelY);
      return;
     }

   string bg = PanelBackgroundName();
   string title = PanelTitleName();
   string auto_button = PanelAutoDrawButtonName();
   int hSpacer = 15;
   if(ObjectFind(0, bg) < 0)
      ObjectCreate(0, bg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, bg, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, bg, OBJPROP_XDISTANCE, InpPanelX);
   ObjectSetInteger(0, bg, OBJPROP_YDISTANCE, InpPanelY);
   ObjectSetInteger(0, bg, OBJPROP_XSIZE, 350);
   ObjectSetInteger(0, bg, OBJPROP_YSIZE, 305);
   ObjectSetInteger(0, bg, OBJPROP_BGCOLOR, C'24,24,24');
   ObjectSetInteger(0, bg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, bg, OBJPROP_COLOR, clrDimGray);
   SetPanelObjectFlags(bg, 10);

   if(ObjectFind(0, title) < 0)
      ObjectCreate(0, title, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, title, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, title, OBJPROP_XDISTANCE, InpPanelX + 10);
   ObjectSetInteger(0, title, OBJPROP_YDISTANCE, InpPanelY + hSpacer);
   ObjectSetInteger(0, title, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, title, OBJPROP_FONTSIZE, 10);
   ObjectSetString(0, title, OBJPROP_FONT, "Arial Bold");
   ObjectSetString(0, title, OBJPROP_TEXT, "Gony TrendLine EA");
   SetPanelObjectFlags(title, 1000);

   DrawPanelText(0, "Trendlines: " + IntegerToString(total_trendlines),
                 InpPanelX + 10, InpPanelY + 36 + hSpacer, clrLightGray);
   DrawPanelText(1, "Valid: " + IntegerToString(valid_setups) +
                 "   Used: " + IntegerToString(used_trendlines),
                 InpPanelX + 10, InpPanelY + 60 + hSpacer, clrLightGray);
   DrawPanelText(2, "Pending orders: " + IntegerToString(pending_orders),
                 InpPanelX + 10, InpPanelY + 84 + hSpacer, clrLightGray);
   DrawPanelText(3, "Cleaned/removed: " + IntegerToString(cleaned_orders),
                 InpPanelX + 10, InpPanelY + 108 + hSpacer, clrLightGray);

   if(ObjectFind(0, auto_button) < 0)
      ObjectCreate(0, auto_button, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, auto_button, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, auto_button, OBJPROP_XDISTANCE, InpPanelX + 10);
   ObjectSetInteger(0, auto_button, OBJPROP_YDISTANCE, InpPanelY + 186);
   ObjectSetInteger(0, auto_button, OBJPROP_XSIZE, 300);
   ObjectSetInteger(0, auto_button, OBJPROP_YSIZE, 35);
   ObjectSetInteger(0, auto_button, OBJPROP_BGCOLOR, clrDarkSlateGray);
   ObjectSetInteger(0, auto_button, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, auto_button, OBJPROP_FONTSIZE, 9);
   ObjectSetString(0, auto_button, OBJPROP_FONT, "Arial");
   ObjectSetString(0, auto_button, OBJPROP_TEXT, "Draw Buy/Sell Trendlines");
   SetPanelObjectFlags(auto_button, 1000);

   DrawClearTrendlinesButton(InpPanelY + 248);
  }

//+------------------------------------------------------------------+
void SetPanelObjectFlags(const string name, const long z_order = 1000)
  {
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, z_order);
  }

//+------------------------------------------------------------------+
void DrawPanelText(const int row, const string text, const int x, const int y, const color text_color)
  {
   string name = PanelStatsName(row);
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_COLOR, text_color);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 9);
   ObjectSetString(0, name, OBJPROP_FONT, "Arial");
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   SetPanelObjectFlags(name, 1000);
  }

//+------------------------------------------------------------------+
void DrawClearTrendlinesButton(const int y)
  {
   string button = PanelButtonName();
   if(ObjectFind(0, button) < 0)
      ObjectCreate(0, button, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, button, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, button, OBJPROP_XDISTANCE, InpPanelX + 10);
   ObjectSetInteger(0, button, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, button, OBJPROP_XSIZE, 300);
   ObjectSetInteger(0, button, OBJPROP_YSIZE, 35);
   ObjectSetInteger(0, button, OBJPROP_BGCOLOR, clrFireBrick);
   ObjectSetInteger(0, button, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, button, OBJPROP_FONTSIZE, 9);
   ObjectSetString(0, button, OBJPROP_FONT, "Arial");
   ObjectSetString(0, button, OBJPROP_TEXT, "Clear Trendlines");
   SetPanelObjectFlags(button, 1000);
  }

//+------------------------------------------------------------------+
void DeletePanelObjectsExceptClearButton()
  {
   ObjectDelete(0, PanelBackgroundName());
   ObjectDelete(0, PanelTitleName());
   ObjectDelete(0, g_panel_prefix + IntegerToString((long)ChartID()) + "_STATS");
   for(int i = 0; i < 5; i++)
      ObjectDelete(0, PanelStatsName(i));
   ObjectDelete(0, PanelAutoDrawButtonName());
  }

//+------------------------------------------------------------------+
void DeletePanelObjects()
  {
   DeletePanelObjectsExceptClearButton();
   ObjectDelete(0, PanelButtonName());
  }

//+------------------------------------------------------------------+
string PanelBackgroundName()
  {
   return g_panel_prefix + IntegerToString((long)ChartID()) + "_BG";
  }

//+------------------------------------------------------------------+
string PanelTitleName()
  {
   return g_panel_prefix + IntegerToString((long)ChartID()) + "_TITLE";
  }

//+------------------------------------------------------------------+
string PanelStatsName(const int row)
  {
   return g_panel_prefix + IntegerToString((long)ChartID()) + "_STATS_" + IntegerToString(row);
  }

//+------------------------------------------------------------------+
string PanelButtonName()
  {
   return g_panel_prefix + IntegerToString((long)ChartID()) + "_CLEAR_BTN";
  }

//+------------------------------------------------------------------+
string PanelAutoDrawButtonName()
  {
   return g_panel_prefix + IntegerToString((long)ChartID()) + "_AUTO_DRAW_BTN";
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
   bool allow_buy_limit = InpOrderMode != TRENDLINE_ORDER_SELL_LIMIT_ONLY;
   bool allow_sell_limit = InpOrderMode != TRENDLINE_ORDER_BUY_LIMIT_ONLY;

   if(IsAutoBuyTrendline(name))
      allow_sell_limit = false;
   else if(IsAutoSellTrendline(name))
      allow_buy_limit = false;

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

      if(line_price < ask - min_stop_distance && allow_buy_limit)
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

      if(line_price > bid + min_stop_distance && allow_sell_limit)
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