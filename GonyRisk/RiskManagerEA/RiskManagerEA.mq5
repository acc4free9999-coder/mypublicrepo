//+------------------------------------------------------------------+
//|                                              RiskManagerEA.mq5   |
//|  Risk-management EA: fixed lot size, auto SL (percent/pips),     |
//|  auto TP at fixed Risk:Reward, on-chart Buy/Sell panel, and      |
//|  auto-correction of any manually opened position on the chart    |
//|  symbol (oversized lot is closed and reopened at the fixed lot). |
//+------------------------------------------------------------------+
#property copyright "Risk Manager EA"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>

//--- SL calculation mode
enum ENUM_SL_MODE
  {
   SL_MODE_PERCENT = 0,   // Percent of account equity
   SL_MODE_PIPS    = 1    // Fixed pips
  };

//--- Inputs
input group "=== Lot / Risk Settings ==="
input double         InpFixedLot        = 0.10;    // Fixed lot size (all trades use this size)
input ENUM_SL_MODE   InpSLMode          = SL_MODE_PERCENT; // Stop Loss mode
input double          InpSLPercent       = 1.0;     // SL risk, % of account equity (used if mode = Percent)
input double          InpSLPips          = 20;       // SL distance in pips (used if mode = Pips)
input double          InpRiskReward      = 3.0;      // Risk:Reward ratio for Take Profit (e.g. 3 = 1:3)

input group "=== Trade / Behavior Settings ==="
input ulong           InpMagicNumber     = 20240918; // Magic number for trades opened by the panel
input ulong           InpSlippage        = 20;        // Max slippage (points)
input bool            InpManageAllPositions = true;   // Auto-correct lot/SL/TP on ANY position on this symbol
input int             InpTimerSeconds    = 1;         // Monitoring interval (seconds)

input group "=== Panel Settings ==="
input bool            InpShowPanel       = true;      // Show on-chart info panel
input bool            InpShowTradeButtons= false;      // Show Buy/Sell buttons on panel
input int             InpPanelX          = 20;        // Panel X position
input int             InpPanelY          = 50;        // Panel Y position
input int             InpPanelWidth      = 600;        // Panel width (px)
input int             InpPanelFontSize   = 11;         // Panel font size

//--- Globals
CTrade         trade;
string         g_prefix = "RM_EA_";
string         g_gv_prefix = "RM_EA_TICKET_";   // GlobalVariable prefix to mark tickets already processed

//+------------------------------------------------------------------+
//| Utility: pip size (handles 3/5 digit brokers)                    |
//+------------------------------------------------------------------+
double PipSize(const string symbol)
  {
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   if(digits == 3 || digits == 5)
      return point * 10.0;
   return point;
  }

//+------------------------------------------------------------------+
//| Utility: monetary value per 1.0 price unit move, for 1 lot       |
//+------------------------------------------------------------------+
double ValuePerPriceUnitPerLot(const string symbol)
  {
   double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize <= 0.0)
      return 0.0;
   return tickValue / tickSize;
  }

//+------------------------------------------------------------------+
//| Compute SL distance in price units for the given lot size        |
//+------------------------------------------------------------------+
double ComputeSLDistance(const string symbol, double lots)
  {
   if(InpSLMode == SL_MODE_PIPS)
     {
      return InpSLPips * PipSize(symbol);
     }
   else // percent of equity
     {
      double equity = AccountInfoDouble(ACCOUNT_EQUITY);
      double riskAmount = equity * (InpSLPercent / 100.0);
      double valuePerUnit = ValuePerPriceUnitPerLot(symbol);
      if(valuePerUnit <= 0.0 || lots <= 0.0)
         return 0.0;
      return riskAmount / (valuePerUnit * lots);
     }
  }

//+------------------------------------------------------------------+
//| Normalize price to symbol's tick size / digits                   |
//+------------------------------------------------------------------+
double NormalizePrice(const string symbol, double price)
  {
   double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(tickSize > 0.0)
      price = MathRound(price / tickSize) * tickSize;
   return NormalizeDouble(price, digits);
  }

//+------------------------------------------------------------------+
//| Normalize lot to symbol's volume step / limits                   |
//+------------------------------------------------------------------+
double NormalizeLot(const string symbol, double lots)
  {
   double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   double minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   if(step <= 0.0)
      step = 0.01;
   double normalized = MathRound(lots / step) * step;
   normalized = MathMax(minLot, MathMin(maxLot, normalized));
   return normalized;
  }

//+------------------------------------------------------------------+
//| Mark a ticket as processed (persists across restarts)            |
//+------------------------------------------------------------------+
void MarkProcessed(ulong ticket)
  {
   GlobalVariableSet(g_gv_prefix + IntegerToString((long)ticket), 1.0);
  }

bool IsProcessed(ulong ticket)
  {
   return GlobalVariableCheck(g_gv_prefix + IntegerToString((long)ticket));
  }

//+------------------------------------------------------------------+
//| Clamp SL/TP distance to the broker's minimum stop level/freeze   |
//+------------------------------------------------------------------+
double EnforceMinStopDistance(const string symbol, double dist)
  {
   long stopLevelPoints  = SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
   long freezeLevelPoints= SymbolInfoInteger(symbol, SYMBOL_TRADE_FREEZE_LEVEL);
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   double minDist = MathMax(stopLevelPoints, freezeLevelPoints) * point;
   // Add a small buffer (2 points) so we don't sit exactly on the broker minimum
   minDist += 2 * point;
   if(minDist > 0.0 && dist < minDist)
      return minDist;
   return dist;
  }

//+------------------------------------------------------------------+
//| Apply (or re-apply) SL/TP to an existing open position           |
//+------------------------------------------------------------------+
bool ApplySLTP(ulong ticket, int retries = 5)
  {
   bool selected = false;
   for(int attempt = 0; attempt < retries; attempt++)
     {
      if(PositionSelectByTicket(ticket))
        {
         selected = true;
         break;
        }
      Sleep(100); // position may not be visible yet right after opening
     }
   if(!selected)
     {
      Print("RiskManagerEA: could not select position ", ticket, " to apply SL/TP");
      return false;
     }

   string symbol   = PositionGetString(POSITION_SYMBOL);
   long   type     = PositionGetInteger(POSITION_TYPE);
   double volume   = PositionGetDouble(POSITION_VOLUME);
   double openPrice= PositionGetDouble(POSITION_PRICE_OPEN);
   double curSL    = PositionGetDouble(POSITION_SL);
   double curTP    = PositionGetDouble(POSITION_TP);

   double slDist = ComputeSLDistance(symbol, volume);
   if(slDist <= 0.0)
     {
      Print("RiskManagerEA: unable to compute SL distance for ticket ", ticket);
      return false;
     }
   slDist = EnforceMinStopDistance(symbol, slDist);
   double tpDist = slDist * InpRiskReward;

   double sl, tp;
   if(type == POSITION_TYPE_BUY)
     {
      sl = NormalizePrice(symbol, openPrice - slDist);
      tp = NormalizePrice(symbol, openPrice + tpDist);
     }
   else
     {
      sl = NormalizePrice(symbol, openPrice + slDist);
      tp = NormalizePrice(symbol, openPrice - tpDist);
     }

   // Nothing to do if already set to the same values
   if(MathAbs(sl - curSL) < SymbolInfoDouble(symbol, SYMBOL_POINT) &&
      MathAbs(tp - curTP) < SymbolInfoDouble(symbol, SYMBOL_POINT))
      return true;

   trade.SetExpertMagicNumber((int)InpMagicNumber);

   bool ok = false;
   for(int attempt = 0; attempt < retries; attempt++)
     {
      ok = trade.PositionModify(ticket, sl, tp);
      if(ok)
         break;
      int err = GetLastError();
      Print("RiskManagerEA: PositionModify failed for ticket ", ticket,
            " err=", err, " retcode=", trade.ResultRetcode(), " (attempt ", attempt + 1, "/", retries, ")");
      ResetLastError();
      Sleep(200);
     }
   return ok;
  }

//+------------------------------------------------------------------+
//| Close a position fully and reopen at the fixed lot size          |
//+------------------------------------------------------------------+
void CorrectLotSize(ulong ticket)
  {
   if(!PositionSelectByTicket(ticket))
      return;

   string symbol = PositionGetString(POSITION_SYMBOL);
   long   type   = PositionGetInteger(POSITION_TYPE);

   trade.SetExpertMagicNumber((int)InpMagicNumber);
   trade.SetDeviationInPoints((int)InpSlippage);

   if(!trade.PositionClose(ticket))
     {
      Print("RiskManagerEA: failed to close oversized position ", ticket, " err=", GetLastError());
      return;
     }

   double lots = NormalizeLot(symbol, InpFixedLot);
   bool opened;
   if(type == POSITION_TYPE_BUY)
      opened = trade.Buy(lots, symbol);
   else
      opened = trade.Sell(lots, symbol);

   if(!opened)
     {
      Print("RiskManagerEA: failed to reopen position at fixed lot for ", symbol, " err=", GetLastError());
      return;
     }

   ulong newTicket = trade.ResultOrder();
   // ResultOrder() returns the order ticket; find the resulting position ticket via deal.
   ulong dealTicket = trade.ResultDeal();
   ulong posTicket = 0;
   if(dealTicket > 0 && HistoryDealSelect(dealTicket))
      posTicket = (ulong)HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
   if(posTicket == 0)
      posTicket = newTicket; // fallback

   if(ApplySLTP(posTicket))
      MarkProcessed(posTicket);
  }

//+------------------------------------------------------------------+
//| Scan and manage all positions on the chart symbol                |
//+------------------------------------------------------------------+
void ManagePositions()
  {
   if(!InpManageAllPositions)
      return;

   string symbol = Symbol();
   int total = PositionsTotal();
   for(int i = total - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(!PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol)
         continue;
      if(IsProcessed(ticket))
         continue;

      double volume = PositionGetDouble(POSITION_VOLUME);
      double fixedLot = NormalizeLot(symbol, InpFixedLot);

      if(volume > fixedLot + 0.0000001)
        {
         // Oversized: close and reopen at fixed lot, then SL/TP will be applied inside CorrectLotSize
         CorrectLotSize(ticket);
        }
      else
        {
         // Correct size (or smaller): just make sure SL/TP are set
         if(ApplySLTP(ticket))
            MarkProcessed(ticket);
        }
     }
  }

//+------------------------------------------------------------------+
//| Panel: create Buy/Sell/CloseAll buttons                          |
//+------------------------------------------------------------------+
void CreateButton(const string name, const string text, int x, int y, int w, int h, color bgClr, int fontSize = 12)
  {
   if(ObjectFind(0, name) >= 0)
      ObjectDelete(0, name);
   ObjectCreate(0, name, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, name, OBJPROP_YSIZE, h);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, bgClr);
   ObjectSetInteger(0, name, OBJPROP_BORDER_COLOR, clrBlack);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
   ObjectSetString(0, name, OBJPROP_FONT, "Arial Bold");
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
  }

//+------------------------------------------------------------------+
//| Panel: create a background rectangle                             |
//+------------------------------------------------------------------+
void CreateBackground(const string name, int x, int y, int w, int h, color bgClr, color borderClr)
  {
   if(ObjectFind(0, name) >= 0)
      ObjectDelete(0, name);
   ObjectCreate(0, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, w + 200);
   ObjectSetInteger(0, name, OBJPROP_YSIZE, h);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, bgClr);
   ObjectSetInteger(0, name, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, name, OBJPROP_COLOR, borderClr);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
  }

//+------------------------------------------------------------------+
//| Panel: create a text label                                       |
//+------------------------------------------------------------------+
void CreateLabel(const string name, const string text, int x, int y, color clr, int fontSize, const string font = "Arial")
  {
   if(ObjectFind(0, name) >= 0)
      ObjectDelete(0, name);
   ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
   ObjectSetString(0, name, OBJPROP_FONT, font);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
  }

//+------------------------------------------------------------------+
//| Panel layout constants                                           |
//+------------------------------------------------------------------+
#define RM_PANEL_PADDING 16
#define RM_PANEL_LINE_H  38

//+------------------------------------------------------------------+
//| Build the full multi-line info text shown in the panel body      |
//+------------------------------------------------------------------+
void GetPanelInfoLines(string &lines[])
  {
   string symbol   = Symbol();
   double equity   = AccountInfoDouble(ACCOUNT_EQUITY);
   double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   double lots     = NormalizeLot(symbol, InpFixedLot);
   double slDist   = ComputeSLDistance(symbol, lots);
   double pip      = PipSize(symbol);
   double slPips   = (pip > 0.0) ? slDist / pip : 0.0;
   double tpPips   = slPips * InpRiskReward;
   double valuePerUnit = ValuePerPriceUnitPerLot(symbol);
   double riskMoney = valuePerUnit * lots * slDist;
   double rewardMoney = riskMoney * InpRiskReward;

   int posCount = 0;
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket != 0 && PositionSelectByTicket(ticket) && PositionGetString(POSITION_SYMBOL) == symbol)
         posCount++;
     }

   ArrayResize(lines, 10);
   lines[0] = StringFormat("Symbol: %s", symbol);
   lines[1] = StringFormat("Fixed Lot: %.2f", lots);
   lines[2] = StringFormat("SL Mode: %s", (InpSLMode == SL_MODE_PERCENT ? "% Equity" : "Fixed Pips"));
   lines[3] = (InpSLMode == SL_MODE_PERCENT)
              ? StringFormat("SL Risk: %.2f%% of equity", InpSLPercent)
              : StringFormat("SL: %.1f pips (fixed)", InpSLPips);
   lines[4] = StringFormat("SL Distance: %.1f pips", slPips);
   lines[5] = StringFormat("TP Distance: %.1f pips (R:R 1:%.1f)", tpPips, InpRiskReward);
   lines[6] = StringFormat("Risk / Reward: $%.2f / $%.2f", riskMoney, rewardMoney);
   lines[7] = StringFormat("Equity: %.2f | Balance: %.2f", equity, balance);
   lines[8] = StringFormat("Open Positions (%s): %d", symbol, posCount);
   lines[9] = StringFormat("Magic: %I64u", InpMagicNumber);
  }

//+------------------------------------------------------------------+
//| Estimate rendered text width in pixels (approximation)           |
//+------------------------------------------------------------------+
int EstimateTextWidth(const string text, int fontSize, bool bold = false)
  {
   // Arial glyphs average ~0.6x font size per character at small sizes,
   // but widen noticeably at larger sizes and when bold; these factors
   // are tuned to avoid clipping against the panel background.
   double factor = bold ? 0.95 : 0.85;
   return (int)MathCeil(StringLen(text) * fontSize * factor) + 10; // small safety buffer
  }

void CreatePanel()
  {
   if(!InpShowPanel)
      return;

   int x = InpPanelX;
   int y = InpPanelY;
   int btnH = InpShowTradeButtons ? 40 : 0;
   int headerH = 44;

   string lines[];
   GetPanelInfoLines(lines);

   // Widen the panel to fit the longest line if InpPanelWidth is too narrow
   int w = InpPanelWidth;
   int titleW = EstimateTextWidth("RISK MANAGER EA", InpPanelFontSize + 3, true) + RM_PANEL_PADDING * 2;
   w = MathMax(w, titleW);
   for(int i = 0; i < ArraySize(lines); i++)
     {
      int lineW = EstimateTextWidth(lines[i], InpPanelFontSize, false) + RM_PANEL_PADDING * 2;
      w = MathMax(w, lineW);
     }

   int bodyH = ArraySize(lines) * RM_PANEL_LINE_H + RM_PANEL_PADDING;
   int totalH = headerH + bodyH + btnH + RM_PANEL_PADDING * 2;

   CreateBackground(g_prefix + "BG", x, y, w, totalH, C'20,20,20', clrDodgerBlue);

   CreateLabel(g_prefix + "TITLE", "RISK MANAGER EA", x + RM_PANEL_PADDING, y + 8,
               clrDodgerBlue, InpPanelFontSize + 3, "Arial Bold");

   int infoY = y + headerH + 10;
   for(int i = 0; i < ArraySize(lines); i++)
     {
      CreateLabel(g_prefix + "INFO" + IntegerToString(i), lines[i],
                  x + RM_PANEL_PADDING, infoY + i * RM_PANEL_LINE_H,
                  clrWhiteSmoke, InpPanelFontSize);
     }

   int btnY = infoY + ArraySize(lines) * RM_PANEL_LINE_H + 8;

   if(InpShowTradeButtons)
     {
      int halfW = (w - RM_PANEL_PADDING * 3) / 2;
      CreateButton(g_prefix + "BUY",  "BUY",  x + RM_PANEL_PADDING, btnY, halfW, btnH, clrForestGreen, InpPanelFontSize + 3);
      CreateButton(g_prefix + "SELL", "SELL", x + RM_PANEL_PADDING * 2 + halfW, btnY, halfW, btnH, clrCrimson, InpPanelFontSize + 3);
     }
   else
     {
      ObjectDelete(0, g_prefix + "BUY");
      ObjectDelete(0, g_prefix + "SELL");
     }

   // Resize background to fit actual content precisely
   int bottomPad = InpShowTradeButtons ? RM_PANEL_PADDING : (RM_PANEL_PADDING / 2);
   ObjectSetInteger(0, g_prefix + "BG", OBJPROP_YSIZE, (btnY + btnH + bottomPad) - y);
  }

void RemovePanel()
  {
   ObjectDelete(0, g_prefix + "BG");
   ObjectDelete(0, g_prefix + "TITLE");
   ObjectDelete(0, g_prefix + "BUY");
   ObjectDelete(0, g_prefix + "SELL");
   string lines[];
   GetPanelInfoLines(lines);
   for(int i = 0; i < ArraySize(lines); i++)
      ObjectDelete(0, g_prefix + "INFO" + IntegerToString(i));
  }

//+------------------------------------------------------------------+
//| Refresh the dynamic info labels (called periodically)            |
//+------------------------------------------------------------------+
void UpdatePanelInfo()
  {
   if(!InpShowPanel)
      return;

   string lines[];
   GetPanelInfoLines(lines);
   for(int i = 0; i < ArraySize(lines); i++)
      ObjectSetString(0, g_prefix + "INFO" + IntegerToString(i), OBJPROP_TEXT, lines[i]);
  }

//+------------------------------------------------------------------+
//| Open a new trade at the fixed lot size and apply SL/TP           |
//+------------------------------------------------------------------+
void OpenTrade(bool isBuy)
  {
   string symbol = Symbol();
   double lots = NormalizeLot(symbol, InpFixedLot);

   trade.SetExpertMagicNumber((int)InpMagicNumber);
   trade.SetDeviationInPoints((int)InpSlippage);

   bool opened = isBuy ? trade.Buy(lots, symbol) : trade.Sell(lots, symbol);
   if(!opened)
     {
      Print("RiskManagerEA: failed to open ", (isBuy ? "BUY" : "SELL"), " err=", GetLastError());
      return;
     }

   ulong dealTicket = trade.ResultDeal();
   ulong posTicket = 0;
   if(dealTicket > 0 && HistoryDealSelect(dealTicket))
      posTicket = (ulong)HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
   if(posTicket == 0)
      posTicket = trade.ResultOrder();

   if(ApplySLTP(posTicket))
      MarkProcessed(posTicket);

   UpdatePanelInfo();
  }

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
  {
   trade.SetExpertMagicNumber((int)InpMagicNumber);
   trade.SetDeviationInPoints((int)InpSlippage);
   trade.SetTypeFillingBySymbol(Symbol());

   CreatePanel();
   EventSetTimer(MathMax(1, InpTimerSeconds));

   // Process any pre-existing positions once at startup
   ManagePositions();

   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Expert deinitialization                                           |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   RemovePanel();
  }

//+------------------------------------------------------------------+
//| Timer: periodic monitoring / auto-correction                     |
//+------------------------------------------------------------------+
void OnTimer()
  {
   ManagePositions();
   UpdatePanelInfo();
  }

//+------------------------------------------------------------------+
//| Tick: keep monitoring responsive between timer ticks              |
//+------------------------------------------------------------------+
void OnTick()
  {
   ManagePositions();
   UpdatePanelInfo();
  }

//+------------------------------------------------------------------+
//| Chart event: handle panel button clicks                          |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
  {
   if(id != CHARTEVENT_OBJECT_CLICK)
      return;

   if(sparam == g_prefix + "BUY")
     {
      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
      OpenTrade(true);
     }
   else if(sparam == g_prefix + "SELL")
     {
      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
      OpenTrade(false);
     }
  }
//+------------------------------------------------------------------+
