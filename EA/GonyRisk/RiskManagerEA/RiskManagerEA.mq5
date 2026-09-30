//+------------------------------------------------------------------+
//|                                              RiskManagerEA.mq5   |
//|  Risk-management EA: fixed lot size, auto SL (percent/pips),     |
//|  auto TP at fixed Risk:Reward, on-chart Buy/Sell panel, and      |
//|  auto-correction of any manually opened position on the          |
//|  configured symbols (up to 4, each with its own lot/SL/R:R/       |
//|  one-trade-only settings). Attach to ONE chart only.              |
//+------------------------------------------------------------------+
#property copyright "Risk Manager EA"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>

//--- SL calculation mode
enum ENUM_SL_MODE
  {
   SL_MODE_PERCENT         = 0,   // Percent of account equity (live, changes with balance)
   SL_MODE_PIPS            = 1,   // Fixed pips
   SL_MODE_PERCENT_INITIAL = 2    // Percent of a fixed initial balance you input
  };

//--- Inputs
// Each symbol group is matched by exact name or prefix, so "XAUUSD"
// also matches broker-suffixed symbols such as "XAUUSDm".
input group "=== Symbol 1 ==="
input string          InpSym1Name        = "XAUUSDm";  // Symbol name or prefix (empty = unused)
input bool            InpSym1Enabled     = true;      // Manage this symbol
input double          InpSym1FixedLot    = 0.01;      // Fixed lot size
input ENUM_SL_MODE    InpSym1SLMode      = SL_MODE_PERCENT_INITIAL; // Stop Loss mode
input double          InpSym1SLPercent   = 10.0;       // SL risk % (of equity or initial balance, per SL mode)
input double          InpSym1SLPips      = 20;        // SL distance in pips (used if mode = Pips)
input double          InpSym1RiskReward  = 10.0;       // Risk:Reward for TP (e.g. 3 = 1:3)
input bool            InpSym1OneTradeOnly= false;     // Only one open position at a time

input group "=== Symbol 2 ==="
input string          InpSym2Name        = "EURUSDm";  // Symbol name or prefix (empty = unused)
input bool            InpSym2Enabled     = true;      // Manage this symbol
input double          InpSym2FixedLot    = 0.10;      // Fixed lot size
input ENUM_SL_MODE    InpSym2SLMode      = SL_MODE_PERCENT_INITIAL; // Stop Loss mode
input double          InpSym2SLPercent   = 20.0;       // SL risk % (of equity or initial balance, per SL mode)
input double          InpSym2SLPips      = 20;        // SL distance in pips (used if mode = Pips)
input double          InpSym2RiskReward  = 10.0;       // Risk:Reward for TP (e.g. 3 = 1:3)
input bool            InpSym2OneTradeOnly= false;     // Only one open position at a time

input group "=== Symbol 3 ==="
input string          InpSym3Name        = "AUDUSDm";  // Symbol name or prefix (empty = unused)
input bool            InpSym3Enabled     = true;      // Manage this symbol
input double          InpSym3FixedLot    = 0.10;      // Fixed lot size
input ENUM_SL_MODE    InpSym3SLMode      = SL_MODE_PERCENT_INITIAL; // Stop Loss mode
input double          InpSym3SLPercent   = 20.0;       // SL risk % (of equity or initial balance, per SL mode)
input double          InpSym3SLPips      = 20;        // SL distance in pips (used if mode = Pips)
input double          InpSym3RiskReward  = 10.0;       // Risk:Reward for TP (e.g. 3 = 1:3)
input bool            InpSym3OneTradeOnly= false;     // Only one open position at a time

input group "=== Symbol 4 ==="
input string          InpSym4Name        = "GBPUSDm";  // Symbol name or prefix (empty = unused)
input bool            InpSym4Enabled     = true;      // Manage this symbol
input double          InpSym4FixedLot    = 0.10;      // Fixed lot size
input ENUM_SL_MODE    InpSym4SLMode      = SL_MODE_PERCENT_INITIAL; // Stop Loss mode
input double          InpSym4SLPercent   = 20.0;       // SL risk % (of equity or initial balance, per SL mode)
input double          InpSym4SLPips      = 20;        // SL distance in pips (used if mode = Pips)
input double          InpSym4RiskReward  = 10.0;       // Risk:Reward for TP (e.g. 3 = 1:3)
input bool            InpSym4OneTradeOnly= false;     // Only one open position at a time

input group "=== Account Settings ==="
input double          InpInitialBalance  = 100.0;   // Initial balance (used by SL mode = % of Initial Balance)

input group "=== Trade / Behavior Settings ==="
input ulong           InpMagicNumber     = 20240918; // Magic number for trades opened by the panel
input ulong           InpSlippage        = 20;        // Max slippage (points)
input bool            InpManageAllPositions = true;   // Auto-correct lot/SL/TP on ANY position on configured symbols
input int             InpCooldownMinutes = 0;          // Block new market entry for N minutes after the latest close on a symbol (0 = disabled)
input int             InpTimerSeconds    = 1;         // Monitoring interval (seconds)

input group "=== Trading Hours ==="
input bool            InpUseTradingHours = false;      // Restrict new entries to a time-of-day window (server time)
input string          InpTradingStartTime= "08:00";    // Start of allowed trading window (HH:MM, server time)
input string          InpTradingEndTime  = "20:00";    // End of allowed trading window (HH:MM, server time); if before start, window wraps past midnight

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
ulong          g_cooldownForcedCloseTicket = 0;
int            g_panelWidth = 0;
string        g_cooldownForcedCloseSymbol = "";

//+------------------------------------------------------------------+
//| Per-symbol settings                                               |
//+------------------------------------------------------------------+
#define RM_SLOT_COUNT 4

struct SymbolSettings
  {
   string            name;        // configured name/prefix
   string            symbol;      // resolved broker symbol ("" if not found)
   bool              enabled;
   double            fixedLot;
   ENUM_SL_MODE      slMode;
   double            slPercent;
   double            slPips;
   double            riskReward;
   bool              oneTradeOnly;
  };

SymbolSettings g_slots[RM_SLOT_COUNT];

void LoadSlot(const int i, const string name, const bool enabled, const double lot,
              const ENUM_SL_MODE mode, const double pct, const double pips,
              const double rr, const bool oneTrade)
  {
   g_slots[i].name         = name;
   StringTrimLeft(g_slots[i].name);
   StringTrimRight(g_slots[i].name);
   g_slots[i].symbol       = "";
   g_slots[i].enabled      = enabled && g_slots[i].name != "";
   g_slots[i].fixedLot     = lot;
   g_slots[i].slMode       = mode;
   g_slots[i].slPercent    = pct;
   g_slots[i].slPips       = pips;
   g_slots[i].riskReward   = rr;
   g_slots[i].oneTradeOnly = oneTrade;
  }

//+------------------------------------------------------------------+
//| Pick a display symbol for a slot's panel line: the chart symbol   |
//| if it matches, then a Market Watch symbol, then any broker symbol.|
//| An exact name match wins; otherwise the shortest prefix match.    |
//| Trade management does NOT use this - see FindSlot().              |
//+------------------------------------------------------------------+
string ResolveBrokerSymbol(const string name)
  {
   if(Symbol() == name || StringFind(Symbol(), name) == 0)
      return Symbol();

   for(int pass = 0; pass < 2; pass++)
     {
      bool selectedOnly = (pass == 0);
      string best = "";
      int total = SymbolsTotal(selectedOnly);
      for(int i = 0; i < total; i++)
        {
         string candidate = SymbolName(i, selectedOnly);
         if(candidate == name)
            return candidate;
         if(StringFind(candidate, name) != 0)
            continue;
         if(best == "" || StringLen(candidate) < StringLen(best))
            best = candidate;
        }
      if(best != "")
         return best;
     }
   return "";
  }

void InitSymbolSlots()
  {
   LoadSlot(0, InpSym1Name, InpSym1Enabled, InpSym1FixedLot, InpSym1SLMode, InpSym1SLPercent, InpSym1SLPips, InpSym1RiskReward, InpSym1OneTradeOnly);
   LoadSlot(1, InpSym2Name, InpSym2Enabled, InpSym2FixedLot, InpSym2SLMode, InpSym2SLPercent, InpSym2SLPips, InpSym2RiskReward, InpSym2OneTradeOnly);
   LoadSlot(2, InpSym3Name, InpSym3Enabled, InpSym3FixedLot, InpSym3SLMode, InpSym3SLPercent, InpSym3SLPips, InpSym3RiskReward, InpSym3OneTradeOnly);
   LoadSlot(3, InpSym4Name, InpSym4Enabled, InpSym4FixedLot, InpSym4SLMode, InpSym4SLPercent, InpSym4SLPips, InpSym4RiskReward, InpSym4OneTradeOnly);

   for(int i = 0; i < RM_SLOT_COUNT; i++)
     {
      if(!g_slots[i].enabled)
         continue;
      g_slots[i].symbol = ResolveBrokerSymbol(g_slots[i].name);
      if(g_slots[i].symbol == "")
        {
         Print("RiskManagerEA: no broker symbol starts with '", g_slots[i].name, "' (slot ", i + 1, ")");
         continue;
        }
      SymbolSelect(g_slots[i].symbol, true);
      Print("RiskManagerEA: slot ", i + 1, " '", g_slots[i].name, "' manages every symbol starting with it (panel shows ", g_slots[i].symbol, ")");
     }
  }

//+------------------------------------------------------------------+
//| Slot that manages a trade's symbol; -1 if none. A slot matches    |
//| the exact name or any symbol starting with it (XAUUSD matches     |
//| XAUUSD, XAUUSDm, XAUUSD.r ...). The longest matching name wins,   |
//| then the lowest slot number.                                      |
//+------------------------------------------------------------------+
int FindSlot(const string symbol)
  {
   int best = -1;
   for(int i = 0; i < RM_SLOT_COUNT; i++)
     {
      if(!g_slots[i].enabled)
         continue;
      if(StringFind(symbol, g_slots[i].name) != 0)
         continue;
      if(best < 0 || StringLen(g_slots[i].name) > StringLen(g_slots[best].name))
         best = i;
     }
   return best;
  }

bool IsManagedSymbol(const string symbol)
  {
   return FindSlot(symbol) >= 0;
  }

//+------------------------------------------------------------------+
//| Configure CTrade for a request on the given symbol                |
//+------------------------------------------------------------------+
void PrepareTrade(const string symbol)
  {
   trade.SetExpertMagicNumber((int)InpMagicNumber);
   trade.SetDeviationInPoints((int)InpSlippage);
   trade.SetTypeFillingBySymbol(symbol);
  }

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
   if(tickSize <= 0.0 || tickValue <= 0.0)
     {
      // Symbol data may not be loaded yet (e.g. not in Market Watch);
      // request it and retry once so risk figures don't collapse to zero.
      if(!SymbolSelect(symbol, true))
         return 0.0;
      tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
      tickSize  = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
     }
   if(tickSize <= 0.0)
      return 0.0;
   return tickValue / tickSize;
  }

//+------------------------------------------------------------------+
//| Compute SL distance in price units for the given lot size        |
//+------------------------------------------------------------------+
double ComputeSLDistance(const string symbol, double lots)
  {
   int slot = FindSlot(symbol);
   if(slot < 0)
      return 0.0;

   if(g_slots[slot].slMode == SL_MODE_PIPS)
      return g_slots[slot].slPips * PipSize(symbol);

   double base = (g_slots[slot].slMode == SL_MODE_PERCENT_INITIAL) ? InpInitialBalance
                                                                   : AccountInfoDouble(ACCOUNT_EQUITY);
   double riskAmount = base * (g_slots[slot].slPercent / 100.0);
   double valuePerUnit = ValuePerPriceUnitPerLot(symbol);
   if(valuePerUnit <= 0.0 || lots <= 0.0)
      return 0.0;
   return riskAmount / (valuePerUnit * lots);
  }

//+------------------------------------------------------------------+
//| Configured fixed lot for a symbol, normalized to broker limits    |
//+------------------------------------------------------------------+
double GetFixedLot(const string symbol)
  {
   int slot = FindSlot(symbol);
   if(slot < 0)
      return 0.0;
   return NormalizeLot(symbol, g_slots[slot].fixedLot);
  }

double GetRiskReward(const string symbol)
  {
   int slot = FindSlot(symbol);
   if(slot < 0)
      return 0.0;
   return g_slots[slot].riskReward;
  }

bool IsOneTradeOnly(const string symbol)
  {
   int slot = FindSlot(symbol);
   return slot >= 0 && g_slots[slot].oneTradeOnly;
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
   double tpDist = slDist * GetRiskReward(symbol);

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

   // Determine whether to keep the trader's manual SL:
   // if it's already at least as tight (closer to open price, i.e. smaller
   // risk) than the auto-calculated SL, leave it alone. Only override when
   // there's no SL yet, or the current SL is looser (bigger risk) than auto.
   double finalSL = sl;
   if(curSL != 0.0)
     {
      bool tighter = (type == POSITION_TYPE_BUY) ? (curSL > sl) : (curSL < sl);
      if(tighter)
         finalSL = curSL;
     }

   // TP is only auto-set once; if the trader has manually changed it (or set
   // it initially), leave it alone from then on - never force it back.
   double finalTP = (curTP != 0.0) ? curTP : tp;

   // Nothing to do if already set to the same values
   if(MathAbs(finalSL - curSL) < SymbolInfoDouble(symbol, SYMBOL_POINT) &&
      MathAbs(finalTP - curTP) < SymbolInfoDouble(symbol, SYMBOL_POINT))
      return true;

   sl = finalSL;
   tp = finalTP;

   trade.SetExpertMagicNumber((int)InpMagicNumber);

   bool ok = false;
   for(int attempt = 0; attempt < retries; attempt++)
     {
      ok = trade.PositionModify(ticket, sl, tp);
      if(ok)
        {
         Print("RiskManagerEA: set SL/TP on ", symbol, " position ", ticket, " SL=", sl, " TP=", tp);
         break;
        }
      int err = GetLastError();
      Print("RiskManagerEA: PositionModify failed for ticket ", ticket,
            " err=", err, " retcode=", trade.ResultRetcode(), " (attempt ", attempt + 1, "/", retries, ")");
      ResetLastError();
      Sleep(200);
     }
   return ok;
  }

//+------------------------------------------------------------------+
//| True if a volume differs from the configured fixed lot by at     |
//| least half a volume step (tolerates floating-point noise).        |
//+------------------------------------------------------------------+
bool IsLotDifferent(const string symbol, const double volume, const double fixedLot)
  {
   double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   if(step <= 0.0)
      step = 0.01;
   return MathAbs(volume - fixedLot) >= step * 0.5;
  }

//+------------------------------------------------------------------+
//| Mark a position being closed by the EA for lot correction, so     |
//| its close does not start the cooldown.                            |
//+------------------------------------------------------------------+
string LotFixKey(const ulong posTicket)
  {
   return g_prefix + "LOTFIX_" + IntegerToString((long)posTicket);
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
   double volume = PositionGetDouble(POSITION_VOLUME);

   PrepareTrade(symbol);

   GlobalVariableSet(LotFixKey(ticket), 1.0);
   if(!trade.PositionClose(ticket))
     {
      GlobalVariableDel(LotFixKey(ticket));
      Print("RiskManagerEA: failed to close position ", ticket, " with wrong lot ", volume, " err=", GetLastError());
      return;
     }
   Print("RiskManagerEA: closed ", symbol, " position ", ticket, " lot ", volume,
         " - reopening at fixed lot ", GetFixedLot(symbol));

   double lots = GetFixedLot(symbol);
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
//| When one-trade-only is on for a symbol, keep only the oldest open |
//| position on it and ignore pending orders for new entry blocking.  |
//+------------------------------------------------------------------+
void EnforceOneTradeOnly()
  {
   string symbols[];
   int symbolCount = 0;
   int totalPos = PositionsTotal();
   for(int i = 0; i < totalPos; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      string symbol = PositionGetString(POSITION_SYMBOL);
      if(!IsOneTradeOnly(symbol))
         continue;
      bool seen = false;
      for(int j = 0; j < symbolCount && !seen; j++)
         seen = (symbols[j] == symbol);
      if(seen)
         continue;
      ArrayResize(symbols, symbolCount + 1);
      symbols[symbolCount++] = symbol;
     }

   for(int i = 0; i < symbolCount; i++)
      EnforceOneTradeOnlyForSymbol(symbols[i]);
  }

void EnforceOneTradeOnlyForSymbol(const string symbol)
  {
   ulong  tickets[];
   datetime times[];
   int    count = 0;

   int totalPos = PositionsTotal();
   for(int i = 0; i < totalPos; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol)
         continue;
      ArrayResize(tickets, count + 1);
      ArrayResize(times, count + 1);
      tickets[count] = ticket;
      times[count]   = (datetime)PositionGetInteger(POSITION_TIME);
      count++;
     }

   if(count <= 1)
      return; // nothing to enforce

   int keepIdx = 0;
   for(int i = 1; i < count; i++)
      if(times[i] < times[keepIdx])
         keepIdx = i;

   PrepareTrade(symbol);

   for(int i = 0; i < count; i++)
     {
      if(i == keepIdx)
         continue;
      if(!trade.PositionClose(tickets[i]))
         Print("RiskManagerEA: one-trade-only failed to close extra position ", tickets[i], " err=", GetLastError());
     }
  }

//+------------------------------------------------------------------+
//| Scan and manage all positions on the chart symbol                |
//+------------------------------------------------------------------+
void ManagePositions()
  {
   if(!InpManageAllPositions)
      return;

   int total = PositionsTotal();
   for(int i = total - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(!PositionSelectByTicket(ticket))
         continue;
      string symbol = PositionGetString(POSITION_SYMBOL);
      if(!IsManagedSymbol(symbol))
         continue;

      double volume = PositionGetDouble(POSITION_VOLUME);
      double fixedLot = GetFixedLot(symbol);

      if(IsLotDifferent(symbol, volume, fixedLot) && !IsProcessed(ticket))
        {
         // Wrong lot size: close and reopen at fixed lot, then SL/TP will be applied inside CorrectLotSize
         CorrectLotSize(ticket);
        }
      else
        {
         // Always re-apply the auto SL/TP every cycle, so any manual SL/TP
         // change gets overwritten back to the calculated value. ApplySLTP
         // internally skips the broker request if values already match.
         ApplySLTP(ticket);
         MarkProcessed(ticket); // still used to prevent re-correcting lot size later
        }
     }
  }

//+------------------------------------------------------------------+
//| Apply (or re-apply) SL/TP to an existing pending order           |
//+------------------------------------------------------------------+
bool ApplySLTPToOrder(ulong ticket)
  {
   if(!OrderSelect(ticket))
      return false;

   string symbol    = OrderGetString(ORDER_SYMBOL);
   long   type      = OrderGetInteger(ORDER_TYPE);
   double volume    = OrderGetDouble(ORDER_VOLUME_CURRENT);
   double openPrice = OrderGetDouble(ORDER_PRICE_OPEN);
   double curSL     = OrderGetDouble(ORDER_SL);
   double curTP     = OrderGetDouble(ORDER_TP);

   bool isBuySide = (type == ORDER_TYPE_BUY_LIMIT || type == ORDER_TYPE_BUY_STOP || type == ORDER_TYPE_BUY_STOP_LIMIT);
   bool isSellSide= (type == ORDER_TYPE_SELL_LIMIT || type == ORDER_TYPE_SELL_STOP || type == ORDER_TYPE_SELL_STOP_LIMIT);
   if(!isBuySide && !isSellSide)
      return false; // not a pending order we manage

   double slDist = ComputeSLDistance(symbol, volume);
   if(slDist <= 0.0)
     {
      Print("RiskManagerEA: unable to compute SL distance for pending order ", ticket);
      return false;
     }
   slDist = EnforceMinStopDistance(symbol, slDist);
   double tpDist = slDist * GetRiskReward(symbol);

   double sl, tp;
   if(isBuySide)
     {
      sl = NormalizePrice(symbol, openPrice - slDist);
      tp = NormalizePrice(symbol, openPrice + tpDist);
     }
   else
     {
      sl = NormalizePrice(symbol, openPrice + slDist);
      tp = NormalizePrice(symbol, openPrice - tpDist);
     }

   // Keep a manually set SL if it is already tighter (smaller risk) than auto
   double finalSL = sl;
   if(curSL != 0.0)
     {
      bool tighter = isBuySide ? (curSL > sl) : (curSL < sl);
      if(tighter)
         finalSL = curSL;
     }

   // TP is only auto-set once; leave any manually changed value alone from then on
   double finalTP = (curTP != 0.0) ? curTP : tp;

   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   if(MathAbs(finalSL - curSL) < point && MathAbs(finalTP - curTP) < point)
      return true; // already correct, nothing to send

   trade.SetExpertMagicNumber((int)InpMagicNumber);
   bool ok = trade.OrderModify(ticket, openPrice, finalSL, finalTP,
                                (ENUM_ORDER_TYPE_TIME)OrderGetInteger(ORDER_TYPE_TIME),
                                OrderGetInteger(ORDER_TIME_EXPIRATION),
                                OrderGetDouble(ORDER_PRICE_STOPLIMIT));
   if(!ok)
      Print("RiskManagerEA: OrderModify failed for pending order ", ticket, " err=", GetLastError(), " retcode=", trade.ResultRetcode());
   else
      Print("RiskManagerEA: set SL/TP on ", symbol, " pending order ", ticket, " SL=", finalSL, " TP=", finalTP);
   return ok;
  }

//+------------------------------------------------------------------+
//| Delete a pending order and recreate it at the fixed lot size     |
//+------------------------------------------------------------------+
void CorrectOrderVolume(ulong ticket)
  {
   if(!OrderSelect(ticket))
      return;

   string symbol     = OrderGetString(ORDER_SYMBOL);
   long   type       = OrderGetInteger(ORDER_TYPE);
   double openPrice  = OrderGetDouble(ORDER_PRICE_OPEN);
   double stopLimit  = OrderGetDouble(ORDER_PRICE_STOPLIMIT);
   datetime expiration = (datetime)OrderGetInteger(ORDER_TIME_EXPIRATION);
   ENUM_ORDER_TYPE_TIME typeTime = (ENUM_ORDER_TYPE_TIME)OrderGetInteger(ORDER_TYPE_TIME);

   PrepareTrade(symbol);

   if(!trade.OrderDelete(ticket))
     {
      Print("RiskManagerEA: failed to delete pending order ", ticket, " with wrong lot, err=", GetLastError());
      return;
     }

   double lots = GetFixedLot(symbol);
   bool placed = false;
   ulong newOrderTicket = 0;
   switch(type)
     {
      case ORDER_TYPE_BUY_LIMIT:
         placed = trade.BuyLimit(lots, openPrice, symbol, 0, 0, typeTime, expiration);
         break;
      case ORDER_TYPE_SELL_LIMIT:
         placed = trade.SellLimit(lots, openPrice, symbol, 0, 0, typeTime, expiration);
         break;
      case ORDER_TYPE_BUY_STOP:
         placed = trade.BuyStop(lots, openPrice, symbol, 0, 0, typeTime, expiration);
         break;
      case ORDER_TYPE_SELL_STOP:
         placed = trade.SellStop(lots, openPrice, symbol, 0, 0, typeTime, expiration);
         break;
      case ORDER_TYPE_BUY_STOP_LIMIT:
        {
         MqlTradeRequest request = {};
         MqlTradeResult  result  = {};
         request.action       = TRADE_ACTION_PENDING;
         request.symbol       = symbol;
         request.volume       = lots;
         request.type         = ORDER_TYPE_BUY_STOP_LIMIT;
         request.price        = openPrice;
         request.stoplimit    = stopLimit;
         request.type_time    = typeTime;
         request.expiration   = expiration;
         request.magic        = InpMagicNumber;
         request.deviation    = InpSlippage;
         placed = OrderSend(request, result);
         if(placed)
            newOrderTicket = result.order;
        }
         break;
      case ORDER_TYPE_SELL_STOP_LIMIT:
        {
         MqlTradeRequest request = {};
         MqlTradeResult  result  = {};
         request.action       = TRADE_ACTION_PENDING;
         request.symbol       = symbol;
         request.volume       = lots;
         request.type         = ORDER_TYPE_SELL_STOP_LIMIT;
         request.price        = openPrice;
         request.stoplimit    = stopLimit;
         request.type_time    = typeTime;
         request.expiration   = expiration;
         request.magic        = InpMagicNumber;
         request.deviation    = InpSlippage;
         placed = OrderSend(request, result);
         if(placed)
            newOrderTicket = result.order;
        }
         break;
      default:
         Print("RiskManagerEA: unsupported pending order type for recreation, ticket ", ticket);
         return;
     }

   if(!placed)
     {
      Print("RiskManagerEA: failed to recreate pending order at fixed lot for ", symbol, " err=", GetLastError());
      return;
     }

   ulong newTicket = (newOrderTicket != 0) ? newOrderTicket : trade.ResultOrder();
   if(newTicket == 0)
      newTicket = ticket; // fallback, unlikely to be reused by broker

   if(ApplySLTPToOrder(newTicket))
      MarkProcessed(newTicket);
  }

//+------------------------------------------------------------------+
//| Scan and manage all pending orders on the chart symbol           |
//+------------------------------------------------------------------+
void ManagePendingOrders()
  {
   if(!InpManageAllPositions)
      return;

   int total = OrdersTotal();
   for(int i = total - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0)
         continue;
      if(!OrderSelect(ticket))
         continue;
      string symbol = OrderGetString(ORDER_SYMBOL);
      if(!IsManagedSymbol(symbol))
         continue;

      double volume = OrderGetDouble(ORDER_VOLUME_CURRENT);
      double fixedLot = GetFixedLot(symbol);

      if(IsLotDifferent(symbol, volume, fixedLot) && !IsProcessed(ticket))
        {
         // Wrong lot size: delete and recreate at fixed lot, then SL/TP applied inside CorrectOrderVolume
         CorrectOrderVolume(ticket);
        }
      else
        {
         // Always re-apply the auto SL/TP every cycle, same as positions
         ApplySLTPToOrder(ticket);
         MarkProcessed(ticket);
        }
     }
  }

//+------------------------------------------------------------------+
//| Panel: create Buy/Sell/Test Notification buttons                  |
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
   double equity   = AccountInfoDouble(ACCOUNT_EQUITY);
   double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   double openRisk = ComputeOpenRisk();
   double remainingBalance = MathMax(0.0, balance - openRisk);

   ArrayResize(lines, 3 + RM_SLOT_COUNT * 2);
   int n = 0;
   lines[n++] = StringFormat("Equity: %.2f | Balance: %.2f | Open Risk: $%.2f | Remaining: $%.2f",
                             equity, balance, openRisk, remainingBalance);

   for(int i = 0; i < RM_SLOT_COUNT; i++)
     {
      string label = StringFormat("[%d] %s", i + 1, g_slots[i].name);
      if(!g_slots[i].enabled)
        {
         lines[n++] = label + ": Off";
         lines[n++] = " ";
         continue;
        }
      string symbol = g_slots[i].symbol;
      if(symbol == "")
        {
         lines[n++] = label + ": no matching symbol found for panel (trades still managed by name)";
         lines[n++] = " ";
         continue;
        }
      if(FindSlot(symbol) != i)
        {
         lines[n++] = StringFormat("[%d] %s: duplicate of slot %d (ignored)", i + 1, symbol, FindSlot(symbol) + 1);
         lines[n++] = " ";
         continue;
        }

      double lots    = GetFixedLot(symbol);
      double slDist  = ComputeSLDistance(symbol, lots);
      double pip     = PipSize(symbol);
      double slPips  = (pip > 0.0) ? slDist / pip : 0.0;
      double rr      = g_slots[i].riskReward;
      double risk    = ComputeTradeRisk(symbol);
      int    open    = CountOpenTradesOnSymbol(symbol);
      int    left    = (risk > 0.0) ? (int)MathFloor((remainingBalance / risk) + 0.0000001) : 0;

      string slText;
      if(g_slots[i].slMode == SL_MODE_PERCENT)
         slText = StringFormat("SL %.2f%% equity", g_slots[i].slPercent);
      else if(g_slots[i].slMode == SL_MODE_PERCENT_INITIAL)
         slText = StringFormat("SL %.2f%% of $%.0f", g_slots[i].slPercent, InpInitialBalance);
      else
         slText = StringFormat("SL %.1f pips", g_slots[i].slPips);

      lines[n++] = StringFormat("[%d] %s | Lot %.2f | %s | R:R 1:%.1f | 1-Trade: %s",
                                i + 1, symbol, lots, slText, rr,
                                g_slots[i].oneTradeOnly ? "On" : "Off");
      lines[n++] = StringFormat("     SL %.1f / TP %.1f pips | Risk $%.2f / $%.2f | Open %d | Left %d | %s",
                                slPips, slPips * rr, risk, risk * rr, open, left,
                                GetCooldownText(symbol));
     }

   if(InpUseTradingHours)
      lines[n++] = StringFormat("Trading Hours: %s (%s - %s)",
                                IsWithinTradingHours() ? "Open" : "Closed",
                                InpTradingStartTime, InpTradingEndTime);
   else
      lines[n++] = "Trading Hours: Off (24h)";
   lines[n++] = StringFormat("Magic: %I64u", InpMagicNumber);
  }

string GetCooldownText(const string symbol)
  {
   if(InpCooldownMinutes <= 0)
      return "Cooldown Off";
   datetime latestClose = GetLastCloseTime(symbol);
   if(latestClose == 0)
      return "Cooldown Ready";
   long remainingSeconds = (long)(InpCooldownMinutes * 60) - (long)(TimeCurrent() - latestClose);
   if(remainingSeconds <= 0)
      return "Cooldown Ready";
   return StringFormat("Cooldown %02d:%02d", remainingSeconds / 60, remainingSeconds % 60);
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
   int btnH = 40;
   if(InpShowTradeButtons)
      btnH += 8 + 40;
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

   g_panelWidth = w;

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
      CreateButton(g_prefix + "BUY",  "BUY", x + RM_PANEL_PADDING, btnY, halfW, 40, clrForestGreen, InpPanelFontSize + 3);
      CreateButton(g_prefix + "SELL", "SELL", x + RM_PANEL_PADDING * 2 + halfW, btnY, halfW, 40, clrCrimson, InpPanelFontSize + 3);
     }
   else
     {
      ObjectDelete(0, g_prefix + "BUY");
      ObjectDelete(0, g_prefix + "SELL");
     }

   int testBtnY = btnY + (InpShowTradeButtons ? 48 : 0);
   CreateButton(g_prefix + "TEST_NOTIFY", "TEST NOTIFY",
                x + RM_PANEL_PADDING, testBtnY, w - RM_PANEL_PADDING * 2, 40,
                clrDarkOrange, InpPanelFontSize + 2);

   // Resize background to fit actual content precisely
   ObjectSetInteger(0, g_prefix + "BG", OBJPROP_YSIZE,
                   (testBtnY + 40 + RM_PANEL_PADDING) - y);

   ChartRedraw(0);
  }

void RemovePanel()
  {
   ObjectDelete(0, g_prefix + "BG");
   ObjectDelete(0, g_prefix + "TITLE");
   ObjectDelete(0, g_prefix + "BUY");
   ObjectDelete(0, g_prefix + "SELL");
   ObjectDelete(0, g_prefix + "TEST_NOTIFY");
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

   // Rebuild if the panel objects are gone (e.g. chart objects cleared)
   if(ObjectFind(0, g_prefix + "BG") < 0)
     {
      CreatePanel();
      return;
     }

   string lines[];
   GetPanelInfoLines(lines);

   // Values read at startup can be empty/zero before the terminal finishes
   // connecting, which makes the initial panel too narrow. Rebuild if the
   // text has since grown wider than the panel we created.
   int needed = 0;
   for(int i = 0; i < ArraySize(lines); i++)
      needed = MathMax(needed, EstimateTextWidth(lines[i], InpPanelFontSize, false) + RM_PANEL_PADDING * 2);
   if(needed > g_panelWidth)
     {
      CreatePanel();
      return;
     }

   for(int i = 0; i < ArraySize(lines); i++)
      ObjectSetString(0, g_prefix + "INFO" + IntegerToString(i), OBJPROP_TEXT, lines[i]);

   ChartRedraw(0);
  }

//+------------------------------------------------------------------+
//| Count currently open positions on a symbol                       |
//+------------------------------------------------------------------+
int CountOpenTradesOnSymbol(const string symbol)
  {
   int count = 0;

   int totalPos = PositionsTotal();
   for(int i = 0; i < totalPos; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket != 0 && PositionSelectByTicket(ticket) && PositionGetString(POSITION_SYMBOL) == symbol)
         count++;
     }

   return count;
  }

//+------------------------------------------------------------------+
//| Configured risk (money) for one fixed-lot trade on a symbol       |
//+------------------------------------------------------------------+
double ComputeTradeRisk(const string symbol)
  {
   double lots = GetFixedLot(symbol);
   double slDist = ComputeSLDistance(symbol, lots);
   return ValuePerPriceUnitPerLot(symbol) * lots * slDist;
  }

//+------------------------------------------------------------------+
//| Risk still at stake on open positions of all configured symbols,  |
//| from each position's actual volume and stop loss (0 once the SL   |
//| is at break-even or in profit).                                   |
//+------------------------------------------------------------------+
double ComputeOpenRisk()
  {
   double openRisk = 0.0;
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      string symbol = PositionGetString(POSITION_SYMBOL);
      if(!IsManagedSymbol(symbol))
         continue;

      double volume    = PositionGetDouble(POSITION_VOLUME);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl        = PositionGetDouble(POSITION_SL);
      double slDist;
      if(sl == 0.0)
         slDist = ComputeSLDistance(symbol, volume);
      else if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
         slDist = openPrice - sl;
      else
         slDist = sl - openPrice;

      openRisk += MathMax(0.0, slDist) * ValuePerPriceUnitPerLot(symbol) * volume;
     }
   return openRisk;
  }

//+------------------------------------------------------------------+
//| Remaining balance after open risk, and trades left for a symbol   |
//+------------------------------------------------------------------+
void GetTradeStatus(const string symbol, double &remainingBalance, int &remainingTrades, double &riskMoney)
  {
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   riskMoney = ComputeTradeRisk(symbol);
   remainingBalance = MathMax(0.0, balance - ComputeOpenRisk());
   remainingTrades = 0;
   if(riskMoney > 0.0)
      remainingTrades = (int)MathFloor((remainingBalance / riskMoney) + 0.0000001);
  }

void NotifyPositionClosed(const string symbol, const long reason)
  {
   double remainingBalance;
   double riskMoney;
   int remainingTrades;
   GetTradeStatus(symbol, remainingBalance, remainingTrades, riskMoney);

   string closeType = "Manual";
   if(reason == DEAL_REASON_SL)
      closeType = "Stop Loss";
   else if(reason == DEAL_REASON_TP)
      closeType = "Take Profit";

   string message = StringFormat("Trades left: %d | Balance: %.2f | Risk: %.2f | %s %s closed",
                                 remainingTrades,
                                 AccountInfoDouble(ACCOUNT_BALANCE), riskMoney,symbol, closeType);
   if(!SendNotification(message))
      Print("RiskManagerEA: failed to send close notification. Error=", GetLastError());
  }

//+------------------------------------------------------------------+
//| Cooldown helper: remember the latest close time for each symbol   |
//| using trade transactions, which is immediate and accurate even for |
//| manual closes.                                                   |
//+------------------------------------------------------------------+
string GetCooldownKey(const string symbol)
  {
   return g_prefix + "LAST_CLOSE_" + symbol;
  }

void UpdateLastCloseTime(const string symbol)
  {
   string key = GetCooldownKey(symbol);
   GlobalVariableSet(key, (double)TimeCurrent());
  }

datetime GetLastCloseTime(const string symbol)
  {
   string key = GetCooldownKey(symbol);
   if(!GlobalVariableCheck(key))
      return 0;
   return (datetime)GlobalVariableGet(key);
  }

bool IsCooldownActiveForSymbol(const string symbol)
  {
   if(InpCooldownMinutes <= 0)
      return false;

   datetime latestClose = GetLastCloseTime(symbol);
   if(latestClose == 0)
      return false;

   datetime waitSeconds = (datetime)(InpCooldownMinutes * 60);
   return (TimeCurrent() - latestClose) < waitSeconds;
  }

bool IsPositionCooldownActive()
  {
   return IsCooldownActiveForSymbol(Symbol());
  }

//+------------------------------------------------------------------+
//| Trading hours: parse "HH:MM" into minutes-since-midnight         |
//+------------------------------------------------------------------+
bool ParseTimeOfDay(const string text, int &minutesOfDay)
  {
   string parts[];
   int n = StringSplit(text, ':', parts);
   if(n < 2)
      return false;
   int hh = (int)StringToInteger(parts[0]);
   int mm = (int)StringToInteger(parts[1]);
   if(hh < 0 || hh > 23 || mm < 0 || mm > 59)
      return false;
   minutesOfDay = hh * 60 + mm;
   return true;
  }

//+------------------------------------------------------------------+
//| Trading hours: is the current server time inside the allowed     |
//| window? Supports overnight windows where end < start (e.g.       |
//| 22:00 -> 06:00 wraps past midnight).                              |
//+------------------------------------------------------------------+
bool IsWithinTradingHours()
  {
   if(!InpUseTradingHours)
      return true;

   int startMin, endMin;
   if(!ParseTimeOfDay(InpTradingStartTime, startMin) || !ParseTimeOfDay(InpTradingEndTime, endMin))
     {
      Print("RiskManagerEA: invalid trading hours input, expected HH:MM - allowing trade");
      return true;
     }

   MqlDateTime now;
   TimeToStruct(TimeCurrent(), now);
   int nowMin = now.hour * 60 + now.min;

   if(startMin == endMin)
      return true; // zero-width window means "always allowed"

   if(startMin < endMin)
      return (nowMin >= startMin && nowMin < endMin);

   // Overnight window wraps past midnight
   return (nowMin >= startMin || nowMin < endMin);
  }

//+------------------------------------------------------------------+
//| Open a new trade at the fixed lot size and apply SL/TP           |
//+------------------------------------------------------------------+
void OpenTrade(bool isBuy)
  {
   string symbol = Symbol();

   if(!IsManagedSymbol(symbol))
     {
      Print("RiskManagerEA: blocked new ", (isBuy ? "BUY" : "SELL"),
            " - chart symbol ", symbol, " is not configured in any symbol group");
      return;
     }

   if(IsOneTradeOnly(symbol) && CountOpenTradesOnSymbol(symbol) > 0)
     {
      Print("RiskManagerEA: blocked new ", (isBuy ? "BUY" : "SELL"),
            " - one-trade-only mode is on and a trade already exists on ", symbol);
      return;
     }

   if(IsPositionCooldownActive())
     {
      Print("RiskManagerEA: blocked new ", (isBuy ? "BUY" : "SELL"),
            " - cooldown is active for ", InpCooldownMinutes, " minutes after the latest close on ", symbol);
      return;
     }

   if(!IsWithinTradingHours())
     {
      Print("RiskManagerEA: blocked new ", (isBuy ? "BUY" : "SELL"),
            " - outside allowed trading hours (", InpTradingStartTime, " - ", InpTradingEndTime, ")");
      return;
     }

   double lots = GetFixedLot(symbol);

   PrepareTrade(symbol);

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
//| Trade event hook: update last close timestamp immediately on any  |
//| close deal, including manual closes.                              |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                       const MqlTradeRequest &request,
                       const MqlTradeResult &result)
  {
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD || trans.deal == 0)
      return;

   if(!HistoryDealSelect(trans.deal))
      return;

   string symbol = HistoryDealGetString(trans.deal, DEAL_SYMBOL);
   long entry = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   if(symbol == "")
      return;

   if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT)
     {
      ulong posTicket = (ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
      long reason = HistoryDealGetInteger(trans.deal, DEAL_REASON);
      if(IsManagedSymbol(symbol) &&
         (reason == DEAL_REASON_CLIENT || reason == DEAL_REASON_MOBILE ||
          reason == DEAL_REASON_WEB || reason == DEAL_REASON_SL ||
          reason == DEAL_REASON_TP || reason == DEAL_REASON_SO))
         NotifyPositionClosed(symbol, reason);

      if(posTicket == g_cooldownForcedCloseTicket && symbol == g_cooldownForcedCloseSymbol)
        {
         g_cooldownForcedCloseTicket = 0;
         g_cooldownForcedCloseSymbol = "";
         return; // keep the original cooldown timestamp; do not reset it
        }
      if(GlobalVariableCheck(LotFixKey(posTicket)))
        {
         GlobalVariableDel(LotFixKey(posTicket));
         return; // EA lot-size correction; not a real close, so no cooldown
        }
      UpdateLastCloseTime(symbol);
      return;
     }

   if(entry == DEAL_ENTRY_IN)
     {
      if(IsManagedSymbol(symbol) && IsCooldownActiveForSymbol(symbol))
        {
         ulong posTicket = (ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
         if(posTicket != 0)
           {
            g_cooldownForcedCloseTicket = posTicket;
            g_cooldownForcedCloseSymbol = symbol;
            PrepareTrade(symbol);
            if(!trade.PositionClose(posTicket))
               {
                Print("RiskManagerEA: failed to close trade entered during cooldown, ticket=", posTicket, " err=", GetLastError());
                g_cooldownForcedCloseTicket = 0;
                g_cooldownForcedCloseSymbol = "";
               }
            else
               Print("RiskManagerEA: closed trade entered during cooldown, ticket=", posTicket);
           }
        }
     }
  }

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
  {
   InitSymbolSlots();

   trade.SetExpertMagicNumber((int)InpMagicNumber);
   trade.SetDeviationInPoints((int)InpSlippage);
   trade.SetTypeFillingBySymbol(Symbol());

   CreatePanel();
   EventSetTimer(MathMax(1, InpTimerSeconds));

   // Process any pre-existing positions and pending orders once at startup
   EnforceOneTradeOnly();
   ManagePositions();
   ManagePendingOrders();

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
   EnforceOneTradeOnly();
   ManagePositions();
   ManagePendingOrders();
   UpdatePanelInfo();
  }

//+------------------------------------------------------------------+
//| Tick: keep monitoring responsive between timer ticks              |
//+------------------------------------------------------------------+
void OnTick()
  {
   EnforceOneTradeOnly();
   ManagePositions();
   ManagePendingOrders();
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
   else if(sparam == g_prefix + "TEST_NOTIFY")
     {
      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
      string testSymbol = Symbol();
      for(int i = 0; i < RM_SLOT_COUNT && !IsManagedSymbol(testSymbol); i++)
         if(g_slots[i].enabled && g_slots[i].symbol != "")
            testSymbol = g_slots[i].symbol;
      NotifyPositionClosed(testSymbol, DEAL_REASON_CLIENT);
     }
  }
//+------------------------------------------------------------------+
