//+------------------------------------------------------------------+
//|                                                GonyCopyTrade.mq5 |
//|                    Local Master -> Child copy trader for MT5     |
//+------------------------------------------------------------------+
//| ROLES                                                             |
//|  1) ROLE_CHILD_SAME_ACCOUNT (default)                             |
//|     Master trades (selected by MasterMagicNumber) live on the     |
//|     SAME account/terminal. This EA mirrors them with its own      |
//|     ChildMagicNumber.                                             |
//|  2) ROLE_MASTER_PUBLISHER                                         |
//|     Attach on the MASTER terminal. Publishes a snapshot of master |
//|     positions / pending orders to the terminals' common folder    |
//|     (<Common>\Files\<ChannelName>.snap).                          |
//|  3) ROLE_CHILD_FROM_FILE                                          |
//|     Attach on the CHILD terminal (different account, same PC).    |
//|     Reads the snapshot published by the master and mirrors it.    |
//|                                                                   |
//| DESIGN                                                            |
//|  The child side works by state reconciliation: on every tick,     |
//|  timer and trade transaction it compares the master snapshot with |
//|  its own positions/orders and fixes any difference (open, SL/TP,  |
//|  pending price, partial close, close/delete). This is much more   |
//|  robust than reacting to single events, which can be missed.      |
//|                                                                   |
//|  Every master ticket is linked to exactly one child ticket in a   |
//|  persistent map (plus the child comment "GCT#<masterTicket>" as a |
//|  fallback), so a master ticket is never copied twice, even after  |
//|  a terminal restart.                                              |
//|                                                                   |
//|  Master key = position identifier for positions, order ticket for |
//|  pending orders. In MT5 a position opened by a pending order has  |
//|  POSITION_IDENTIFIER == ticket of that order, so a filled limit   |
//|  keeps the same key and is managed seamlessly as a position.      |
//|                                                                   |
//|  The child account must be HEDGING (one child position per        |
//|  master position).                                                |
//+------------------------------------------------------------------+
#property copyright   "GonyCopyTrade"
#property version     "1.00"
#property description "Local copy trader: market + pending limit orders, fixed/proportional lots, live SL/TP sync."

#define GCT_TAG        "GCT#"   // child comment prefix: GCT#<masterKey>
#define GCT_FILE_MAGIC "GCT1"   // snapshot file header signature

//--- Lot size modes
enum ENUM_LOT_MODE
  {
   MODE_FIXED              = 0, // Fixed lot (FixedLotSize)
   MODE_EQUAL_PROPORTIONAL = 1  // Equal / proportional (master lot x LotMultiplier)
  };

//--- EA role
enum ENUM_EA_ROLE
  {
   ROLE_CHILD_SAME_ACCOUNT = 0, // Child: copy master trades on THIS account (by magic)
   ROLE_MASTER_PUBLISHER   = 1, // Master: publish trades for other terminals
   ROLE_CHILD_FROM_FILE    = 2  // Child: copy trades published by a master terminal
  };

//--- State of a master->child link
enum ENUM_LINK_STATE
  {
   LINK_ACTIVE     = 0, // child order/position exists and is managed
   LINK_RETRY_OPEN = 1, // child must be (re)opened, waiting for retry/backoff
   LINK_CHILD_GONE = 2, // child closed on its own (SL/TP/manual) - never reopen
   LINK_IGNORED    = 3  // master ticket deliberately not copied
  };

//+------------------------------------------------------------------+
//| Inputs                                                           |
//+------------------------------------------------------------------+
input group "=== General ==="
input bool          EnableCopyTrading   = true;                    // Enable copying of NEW trades (existing copies stay managed)
input ENUM_EA_ROLE  EARole              = ROLE_CHILD_SAME_ACCOUNT; // EA role
input ulong         MasterMagicNumber   = 0;                       // Master magic (0 = copy all master trades)
input ulong         ChildMagicNumber    = 123456;                  // Magic number of copied (child) trades

input group "=== Lot size ==="
input ENUM_LOT_MODE LotMode             = MODE_FIXED;              // Lot mode
input double        FixedLotSize        = 0.01;                    // Fixed lot size (MODE_FIXED)
input double        LotMultiplier       = 1.0;                     // Lot multiplier (MODE_EQUAL_PROPORTIONAL)

input group "=== Execution ==="
input int           MaxSlippage         = 30;                      // Max slippage / deviation (points)
input int           MaxEntryDeviation   = 0;                       // Skip market copy if price moved more than X points from master entry (0 = off)
input int           MaxRetries          = 3;                       // Retries per request (requote / price changed / off quotes)
input int           MaxOpenAttempts     = 5;                       // Give up opening a copy after N failed attempts

input group "=== Copy behaviour ==="
input bool          CopyPendingLimits   = true;                    // Copy Buy Limit / Sell Limit orders
input bool          CopyPendingStops    = false;                   // Copy Buy Stop / Sell Stop orders
input bool          CopyExistingOnStart = false;                   // Copy master trades that already exist when the EA starts
input bool          SyncPendingPrice    = true;                    // Follow master pending-order price modifications
input bool          CopyPartialCloses   = true;                    // Mirror master partial closes proportionally
input bool          CloseChildOnMasterClose = true;                // Close child position when master position closes
input bool          ConvertPendingOnMasterFill = true;             // If master pending fills but child pending did not: delete it and open at market

input group "=== Timing ==="
input int           TimerMilliseconds   = 250;                     // Sync timer (ms)
input int           GracePeriodMs       = 1500;                    // A ticket must be missing this long before acting (avoids transient states)

input group "=== Cross-terminal (shared file) ==="
input string        ChannelName         = "GonyCopyTrade";         // Channel (file) name in Common\Files
input long          MasterAccountLogin  = 0;                       // Only accept snapshots from this master login (0 = any)
input int           MasterHeartbeatTimeoutSec = 10;                // Snapshot older than this is ignored (no actions taken)
input string        SymbolPrefix        = "";                      // Child symbol prefix (e.g. "m.")
input string        SymbolSuffix        = "";                      // Child symbol suffix (e.g. ".pro")

//+------------------------------------------------------------------+
//| Data structures                                                  |
//+------------------------------------------------------------------+
struct MasterItem
  {
   ulong             key;          // position identifier / order ticket
   string            symbol;
   ENUM_ORDER_TYPE   type;         // BUY/SELL for positions, *_LIMIT/*_STOP for pending
   bool              isPosition;
   double            volume;
   double            price;        // open price / pending price
   double            sl;
   double            tp;
  };

struct ChildItem
  {
   ulong                id;        // position identifier / order ticket (link key)
   ulong                ticket;    // position ticket / order ticket (for requests)
   bool                 isPosition;
   string               symbol;
   ENUM_ORDER_TYPE      type;
   double               volume;
   double               price;
   double               sl;
   double               tp;
   ENUM_ORDER_TYPE_TIME typeTime;
   datetime             expiration;
   ulong                masterKey; // parsed from comment (0 if none)
  };

struct CopyLink
  {
   ulong             masterKey;
   ulong             childKey;
   string            childSymbol;
   double            masterInitVol;
   double            childInitVol;
   int               state;              // ENUM_LINK_STATE
   int               failCount;
   ulong             lastAttemptMs;
   ulong             masterMissingSince;
   ulong             childMissingSince;
  };

//+------------------------------------------------------------------+
//| Globals                                                          |
//+------------------------------------------------------------------+
CopyLink g_links[];
bool     g_linksDirty        = false;
bool     g_needInitialIgnore = false;
bool     g_busy              = false;
string   g_linksFile         = "";
string   g_snapFile          = "";
string   g_lastPayload       = "";
ulong    g_lastPublishMs     = 0;
string   g_logKeys[];
ulong    g_logTimes[];

//+------------------------------------------------------------------+
//| Small helpers                                                    |
//+------------------------------------------------------------------+
ulong NowMs() { return GetTickCount64(); }

bool IsChildRole() { return EARole != ROLE_MASTER_PUBLISHER; }

bool IsBuyType(const ENUM_ORDER_TYPE t)
  {
   return (t == ORDER_TYPE_BUY || t == ORDER_TYPE_BUY_LIMIT || t == ORDER_TYPE_BUY_STOP);
  }

bool IsPendingTypeCopyable(const ENUM_ORDER_TYPE t)
  {
   if(t == ORDER_TYPE_BUY_LIMIT || t == ORDER_TYPE_SELL_LIMIT)
      return CopyPendingLimits;
   if(t == ORDER_TYPE_BUY_STOP || t == ORDER_TYPE_SELL_STOP)
      return CopyPendingStops;
   return false;
  }

bool IsGctComment(const string c) { return StringFind(c, GCT_TAG) == 0; }

ulong MasterKeyFromComment(const string c)
  {
   if(!IsGctComment(c))
      return 0;
   return (ulong)StringToInteger(StringSubstr(c, StringLen(GCT_TAG)));
  }

bool MasterMagicMatches(const ulong magic)
  {
   if(magic == ChildMagicNumber)
      return false;
   return (MasterMagicNumber == 0 || magic == MasterMagicNumber);
  }

string MapSymbol(const string masterSymbol)
  {
   if(EARole == ROLE_CHILD_FROM_FILE)
      return SymbolPrefix + masterSymbol + SymbolSuffix;
   return masterSymbol;
  }

bool PriceDiffers(const double a, const double b, const double point)
  {
   return MathAbs(a - b) > point * 0.5;
  }

//--- Print a message at most once per interval for a given key (avoids log flooding)
void LogThrottled(const string key, const string msg, const ulong intervalMs = 30000)
  {
   ulong now = NowMs();
   int n = ArraySize(g_logKeys);
   for(int i = 0; i < n; i++)
     {
      if(g_logKeys[i] == key)
        {
         if(now - g_logTimes[i] >= intervalMs)
           {
            Print(msg);
            g_logTimes[i] = now;
           }
         return;
        }
     }
   ArrayResize(g_logKeys, n + 1);
   ArrayResize(g_logTimes, n + 1);
   g_logKeys[n]  = key;
   g_logTimes[n] = now;
   Print(msg);
  }

string RetcodeToString(const uint rc)
  {
   switch(rc)
     {
      case TRADE_RETCODE_REQUOTE:           return "REQUOTE";
      case TRADE_RETCODE_REJECT:            return "REJECT";
      case TRADE_RETCODE_CANCEL:            return "CANCEL";
      case TRADE_RETCODE_PLACED:            return "PLACED";
      case TRADE_RETCODE_DONE:              return "DONE";
      case TRADE_RETCODE_DONE_PARTIAL:      return "DONE_PARTIAL";
      case TRADE_RETCODE_ERROR:             return "ERROR";
      case TRADE_RETCODE_TIMEOUT:           return "TIMEOUT";
      case TRADE_RETCODE_INVALID:           return "INVALID_REQUEST";
      case TRADE_RETCODE_INVALID_VOLUME:    return "INVALID_VOLUME";
      case TRADE_RETCODE_INVALID_PRICE:     return "INVALID_PRICE";
      case TRADE_RETCODE_INVALID_STOPS:     return "INVALID_STOPS";
      case TRADE_RETCODE_TRADE_DISABLED:    return "TRADE_DISABLED";
      case TRADE_RETCODE_MARKET_CLOSED:     return "MARKET_CLOSED";
      case TRADE_RETCODE_NO_MONEY:          return "NO_MONEY";
      case TRADE_RETCODE_PRICE_CHANGED:     return "PRICE_CHANGED";
      case TRADE_RETCODE_PRICE_OFF:         return "PRICE_OFF (off quotes)";
      case TRADE_RETCODE_INVALID_EXPIRATION:return "INVALID_EXPIRATION";
      case TRADE_RETCODE_ORDER_CHANGED:     return "ORDER_CHANGED";
      case TRADE_RETCODE_TOO_MANY_REQUESTS: return "TOO_MANY_REQUESTS";
      case TRADE_RETCODE_NO_CHANGES:        return "NO_CHANGES";
      case TRADE_RETCODE_SERVER_DISABLES_AT:return "AUTOTRADING_DISABLED_BY_SERVER";
      case TRADE_RETCODE_CLIENT_DISABLES_AT:return "AUTOTRADING_DISABLED_BY_CLIENT";
      case TRADE_RETCODE_LOCKED:            return "LOCKED";
      case TRADE_RETCODE_FROZEN:            return "FROZEN";
      case TRADE_RETCODE_INVALID_FILL:      return "INVALID_FILL";
      case TRADE_RETCODE_CONNECTION:        return "NO_CONNECTION";
      case TRADE_RETCODE_ONLY_REAL:         return "ONLY_REAL";
      case TRADE_RETCODE_LIMIT_ORDERS:      return "LIMIT_ORDERS_REACHED";
      case TRADE_RETCODE_LIMIT_VOLUME:      return "LIMIT_VOLUME_REACHED";
      case TRADE_RETCODE_INVALID_ORDER:     return "INVALID_ORDER";
      case TRADE_RETCODE_POSITION_CLOSED:   return "POSITION_CLOSED";
      case TRADE_RETCODE_INVALID_CLOSE_VOLUME: return "INVALID_CLOSE_VOLUME";
      case TRADE_RETCODE_CLOSE_ORDER_EXIST: return "CLOSE_ORDER_EXIST";
      case TRADE_RETCODE_LIMIT_POSITIONS:   return "LIMIT_POSITIONS_REACHED";
      case TRADE_RETCODE_REJECT_CANCEL:     return "REJECT_CANCEL";
      case TRADE_RETCODE_LONG_ONLY:         return "LONG_ONLY";
      case TRADE_RETCODE_SHORT_ONLY:        return "SHORT_ONLY";
      case TRADE_RETCODE_CLOSE_ONLY:        return "CLOSE_ONLY";
      case TRADE_RETCODE_FIFO_CLOSE:        return "FIFO_CLOSE";
     }
   return "UNKNOWN";
  }

bool IsSuccessRetcode(const uint rc)
  {
   return (rc == TRADE_RETCODE_DONE || rc == TRADE_RETCODE_DONE_PARTIAL || rc == TRADE_RETCODE_PLACED);
  }

bool IsRetryableRetcode(const uint rc)
  {
   switch(rc)
     {
      case TRADE_RETCODE_REQUOTE:
      case TRADE_RETCODE_PRICE_CHANGED:
      case TRADE_RETCODE_PRICE_OFF:
      case TRADE_RETCODE_TIMEOUT:
      case TRADE_RETCODE_CONNECTION:
      case TRADE_RETCODE_TOO_MANY_REQUESTS:
      case TRADE_RETCODE_LOCKED:
      case TRADE_RETCODE_ERROR:
         return true;
     }
   return false;
  }

bool IsTradingAllowedNow()
  {
   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
     {
      LogThrottled("noconn", "[GCT] Terminal not connected - waiting.");
      return false;
     }
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
     {
      LogThrottled("noalgo", "[GCT] Algo trading is disabled (terminal button or EA properties). Copying paused.");
      return false;
     }
   if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) || !AccountInfoInteger(ACCOUNT_TRADE_EXPERT))
     {
      LogThrottled("noacct", "[GCT] Trading/expert trading not allowed for this account. Copying paused.");
      return false;
     }
   return true;
  }

//+------------------------------------------------------------------+
//| Symbol / price / volume helpers                                  |
//+------------------------------------------------------------------+
bool EnsureSymbol(const string sym)
  {
   if(!SymbolSelect(sym, true))
     {
      LogThrottled("sym_" + sym, StringFormat("[GCT] Symbol '%s' not available on child (err=%d). Check SymbolPrefix/SymbolSuffix.", sym, GetLastError()));
      return false;
     }
   if((ENUM_SYMBOL_TRADE_MODE)SymbolInfoInteger(sym, SYMBOL_TRADE_MODE) == SYMBOL_TRADE_MODE_DISABLED)
     {
      LogThrottled("symdis_" + sym, StringFormat("[GCT] Trading disabled for symbol '%s'.", sym));
      return false;
     }
   return true;
  }

double NormalizePrice(const string sym, double price)
  {
   if(price <= 0.0)
      return 0.0;
   double tickSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   int    digits   = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   if(tickSize > 0.0)
      price = MathRound(price / tickSize) * tickSize;
   return NormalizeDouble(price, digits);
  }

int VolumeDigits(const double step)
  {
   int d = 0;
   while(d < 8 && MathAbs(step * MathPow(10, d) - MathRound(step * MathPow(10, d))) > 1e-7)
      d++;
   return d;
  }

double VolumeStep(const string sym)
  {
   double step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   return (step > 0.0 ? step : 0.01);
  }

double FloorToStep(const string sym, const double v)
  {
   double step = VolumeStep(sym);
   return NormalizeDouble(MathFloor(v / step + 1e-9) * step, VolumeDigits(step));
  }

double RoundToStep(const string sym, const double v)
  {
   double step = VolumeStep(sym);
   return NormalizeDouble(MathRound(v / step) * step, VolumeDigits(step));
  }

//--- Lot size for a new child trade according to LotMode
double CalcChildLot(const string sym, const double masterVolume)
  {
   double raw  = (LotMode == MODE_FIXED) ? FixedLotSize : masterVolume * LotMultiplier;
   double vmin = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double vmax = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   double vol  = FloorToStep(sym, raw);
   if(vol < vmin)
     {
      PrintFormat("[GCT] Calculated lot %.4f < min lot %.4f on %s -> using min lot.", raw, vmin, sym);
      vol = vmin;
     }
   if(vmax > 0.0 && vol > vmax)
     {
      PrintFormat("[GCT] Calculated lot %.4f > max lot %.4f on %s -> using max lot.", raw, vmax, sym);
      vol = vmax;
     }
   return vol;
  }

int GetFillingCandidates(const string sym, const bool pending, ENUM_ORDER_TYPE_FILLING &out[])
  {
   ArrayResize(out, 0);
   long fm = SymbolInfoInteger(sym, SYMBOL_FILLING_MODE);
   int  n  = 0;
   if(pending)
     {
      ArrayResize(out, n + 1);
      out[n++] = ORDER_FILLING_RETURN;
     }
   if((fm & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK)
     {
      ArrayResize(out, n + 1);
      out[n++] = ORDER_FILLING_FOK;
     }
   if((fm & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC)
     {
      ArrayResize(out, n + 1);
      out[n++] = ORDER_FILLING_IOC;
     }
   if(!pending)
     {
      ArrayResize(out, n + 1);
      out[n++] = ORDER_FILLING_RETURN;
     }
   return n;
  }

ENUM_ORDER_TYPE_TIME GetPendingTypeTime(const string sym)
  {
   int em = (int)SymbolInfoInteger(sym, SYMBOL_EXPIRATION_MODE);
   if((em & SYMBOL_EXPIRATION_GTC) == SYMBOL_EXPIRATION_GTC)
      return ORDER_TIME_GTC;
   if((em & SYMBOL_EXPIRATION_DAY) == SYMBOL_EXPIRATION_DAY)
      return ORDER_TIME_DAY;
   return ORDER_TIME_GTC;
  }

//+------------------------------------------------------------------+
//| Central trade request sender with retries + full error logging   |
//+------------------------------------------------------------------+
bool SendTradeRequest(MqlTradeRequest &req, MqlTradeResult &res, const string context)
  {
   bool isDeal    = (req.action == TRADE_ACTION_DEAL);
   bool isPending = (req.action == TRADE_ACTION_PENDING);

   ENUM_ORDER_TYPE_FILLING fills[];
   int nf = 0, fi = 0;
   if(isDeal || isPending)
     {
      nf = GetFillingCandidates(req.symbol, isPending, fills);
      req.type_filling = fills[0];
     }

   int attempts = MathMax(1, MaxRetries);
   for(int a = 1; a <= attempts; a++)
     {
      //--- market deals always use a fresh price
      if(isDeal)
        {
         MqlTick tick;
         if(SymbolInfoTick(req.symbol, tick))
            req.price = IsBuyType(req.type) ? tick.ask : tick.bid;
        }

      ZeroMemory(res);
      ResetLastError();
      bool sent = OrderSend(req, res);
      if(sent && IsSuccessRetcode(res.retcode))
        {
         PrintFormat("[GCT] OK %s | retcode=%u (%s) order=%I64u deal=%I64u vol=%.2f price=%s",
                     context, res.retcode, RetcodeToString(res.retcode), res.order, res.deal,
                     res.volume, DoubleToString(res.price, (int)SymbolInfoInteger(req.symbol, SYMBOL_DIGITS)));
         return true;
        }

      int err = GetLastError();
      int dg  = (int)SymbolInfoInteger(req.symbol, SYMBOL_DIGITS);
      PrintFormat("[GCT] FAILED %s (attempt %d/%d) | retcode=%u (%s) GetLastError=%d broker='%s' | %s vol=%.2f price=%s sl=%s tp=%s fill=%s",
                  context, a, attempts, res.retcode, RetcodeToString(res.retcode), err, res.comment,
                  req.symbol, req.volume, DoubleToString(req.price, dg), DoubleToString(req.sl, dg),
                  DoubleToString(req.tp, dg), EnumToString(req.type_filling));

      //--- unsupported filling mode -> try the next allowed one (does not consume an attempt)
      if(res.retcode == TRADE_RETCODE_INVALID_FILL && fi + 1 < nf)
        {
         fi++;
         req.type_filling = fills[fi];
         a--;
         continue;
        }
      if(IsRetryableRetcode(res.retcode) && a < attempts)
        {
         Sleep(150 * a);
         continue;
        }
      return false;
     }
   return false;
  }

//+------------------------------------------------------------------+
//| Child trade operations                                           |
//+------------------------------------------------------------------+
bool ModifyChildPositionStops(const ChildItem &c, const double sl, const double tp)
  {
   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   req.action   = TRADE_ACTION_SLTP;
   req.position = c.ticket;
   req.symbol   = c.symbol;
   req.sl       = sl;
   req.tp       = tp;
   req.magic    = ChildMagicNumber;
   return SendTradeRequest(req, res, StringFormat("MODIFY SL/TP position #%I64u (master #%I64u)", c.ticket, c.masterKey));
  }

bool ModifyChildPendingOrder(const ChildItem &c, const double price, const double sl, const double tp)
  {
   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   req.action     = TRADE_ACTION_MODIFY;
   req.order      = c.ticket;
   req.symbol     = c.symbol;
   req.price      = price;
   req.sl         = sl;
   req.tp         = tp;
   req.type_time  = c.typeTime;
   req.expiration = c.expiration;
   req.magic      = ChildMagicNumber;
   return SendTradeRequest(req, res, StringFormat("MODIFY pending #%I64u (master #%I64u)", c.ticket, c.masterKey));
  }

bool CloseChildPosition(const ChildItem &c, const double volume, const string reason)
  {
   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   req.action    = TRADE_ACTION_DEAL;
   req.position  = c.ticket;
   req.symbol    = c.symbol;
   req.volume    = volume;
   req.type      = (c.type == ORDER_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
   req.deviation = (ulong)MathMax(0, MaxSlippage);
   req.magic     = ChildMagicNumber;
   if(SendTradeRequest(req, res, StringFormat("CLOSE %.2f lots of position #%I64u (%s)", volume, c.ticket, reason)))
      return true;
   //--- already closed (e.g. hit SL/TP in the meantime) counts as success
   if(res.retcode == TRADE_RETCODE_POSITION_CLOSED || !PositionSelectByTicket(c.ticket))
      return true;
   return false;
  }

bool DeleteChildOrder(const ChildItem &c, const string reason)
  {
   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   req.action = TRADE_ACTION_REMOVE;
   req.order  = c.ticket;
   req.symbol = c.symbol;
   req.magic  = ChildMagicNumber;
   if(SendTradeRequest(req, res, StringFormat("DELETE pending #%I64u (%s)", c.ticket, reason)))
      return true;
   if(!OrderSelect(c.ticket))
      return true; // already gone (filled or cancelled)
   return false;
  }

bool ChildPositionExists(const ulong positionId)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(PositionGetTicket(i) == 0)
         continue;
      if((ulong)PositionGetInteger(POSITION_IDENTIFIER) == positionId &&
         (ulong)PositionGetInteger(POSITION_MAGIC) == ChildMagicNumber)
         return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
//| Link map management                                              |
//+------------------------------------------------------------------+
int FindLink(const ulong masterKey)
  {
   for(int i = ArraySize(g_links) - 1; i >= 0; i--)
      if(g_links[i].masterKey == masterKey)
         return i;
   return -1;
  }

int FindLinkByChild(const ulong childKey)
  {
   if(childKey == 0)
      return -1;
   for(int i = ArraySize(g_links) - 1; i >= 0; i--)
      if(g_links[i].childKey == childKey)
         return i;
   return -1;
  }

int AddLink(const ulong masterKey, const ulong childKey, const string childSymbol, const int state,
            const double masterInitVol, const double childInitVol)
  {
   int n = ArraySize(g_links);
   ArrayResize(g_links, n + 1, 64);
   g_links[n].masterKey          = masterKey;
   g_links[n].childKey           = childKey;
   g_links[n].childSymbol        = childSymbol;
   g_links[n].masterInitVol      = masterInitVol;
   g_links[n].childInitVol       = childInitVol;
   g_links[n].state              = state;
   g_links[n].failCount          = 0;
   g_links[n].lastAttemptMs      = 0;
   g_links[n].masterMissingSince = 0;
   g_links[n].childMissingSince  = 0;
   g_linksDirty = true;
   return n;
  }

void RemoveLink(const int idx)
  {
   int last = ArraySize(g_links) - 1;
   if(idx < 0 || idx > last)
      return;
   if(idx != last)
      g_links[idx] = g_links[last];
   ArrayResize(g_links, last);
   g_linksDirty = true;
  }

//--- Exponential backoff between failed attempts on a link (0.5s .. 60s)
bool BackoffElapsed(const int idx)
  {
   if(g_links[idx].failCount <= 0)
      return true;
   int   p    = MathMin(g_links[idx].failCount, 7);
   ulong wait = (ulong)MathMin(60000, 500 * (1 << p));
   return (NowMs() - g_links[idx].lastAttemptMs >= wait);
  }

void RegisterFailure(const int idx)
  {
   g_links[idx].failCount++;
   g_links[idx].lastAttemptMs = NowMs();
  }

void SaveLinks()
  {
   if(!IsChildRole())
      return;
   ResetLastError();
   int h = FileOpen(g_linksFile, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(h == INVALID_HANDLE)
     {
      LogThrottled("savelinks", StringFormat("[GCT] Cannot save link map '%s' (err=%d).", g_linksFile, GetLastError()));
      return;
     }
   for(int i = 0; i < ArraySize(g_links); i++)
      FileWriteString(h, StringFormat("%I64u;%I64u;%s;%s;%s;%d\n",
                                      g_links[i].masterKey, g_links[i].childKey, g_links[i].childSymbol,
                                      DoubleToString(g_links[i].masterInitVol, 8),
                                      DoubleToString(g_links[i].childInitVol, 8), g_links[i].state));
   FileClose(h);
   g_linksDirty = false;
  }

void LoadLinks()
  {
   ArrayResize(g_links, 0);
   if(!FileIsExist(g_linksFile))
      return;
   ResetLastError();
   int h = FileOpen(g_linksFile, FILE_READ | FILE_TXT | FILE_ANSI);
   if(h == INVALID_HANDLE)
     {
      PrintFormat("[GCT] Cannot read link map '%s' (err=%d). Links will be rebuilt from child comments.", g_linksFile, GetLastError());
      return;
     }
   while(!FileIsEnding(h))
     {
      string line = FileReadString(h);
      StringTrimRight(line);
      StringTrimLeft(line);
      if(StringLen(line) == 0)
         continue;
      string f[];
      if(StringSplit(line, ';', f) != 6)
         continue;
      ulong mk = (ulong)StringToInteger(f[0]);
      if(mk == 0 || FindLink(mk) >= 0)
         continue;
      int st = (int)StringToInteger(f[5]);
      if(st < LINK_ACTIVE || st > LINK_IGNORED)
         continue;
      AddLink(mk, (ulong)StringToInteger(f[1]), f[2], st, StringToDouble(f[3]), StringToDouble(f[4]));
     }
   FileClose(h);
   g_linksDirty = false;
   PrintFormat("[GCT] Loaded %d link(s) from '%s'.", ArraySize(g_links), g_linksFile);
  }

//+------------------------------------------------------------------+
//| Snapshot collection                                              |
//+------------------------------------------------------------------+
int FindMaster(const MasterItem &items[], const ulong key)
  {
   for(int i = ArraySize(items) - 1; i >= 0; i--)
      if(items[i].key == key)
         return i;
   return -1;
  }

int FindChild(const ChildItem &items[], const ulong id)
  {
   if(id == 0)
      return -1;
   for(int i = ArraySize(items) - 1; i >= 0; i--)
      if(items[i].id == id)
         return i;
   return -1;
  }

//--- Master positions + pending orders on THIS account (filtered by MasterMagicNumber)
int CollectLocalMasterItems(MasterItem &items[])
  {
   ArrayResize(items, 0);
   int n = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(!MasterMagicMatches((ulong)PositionGetInteger(POSITION_MAGIC)))
         continue;
      if(IsGctComment(PositionGetString(POSITION_COMMENT)))
         continue; // never copy copies (e.g. another GonyCopyTrade instance)

      ArrayResize(items, n + 1, 32);
      items[n].key        = (ulong)PositionGetInteger(POSITION_IDENTIFIER);
      items[n].symbol     = PositionGetString(POSITION_SYMBOL);
      items[n].type       = ((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
      items[n].isPosition = true;
      items[n].volume     = PositionGetDouble(POSITION_VOLUME);
      items[n].price      = PositionGetDouble(POSITION_PRICE_OPEN);
      items[n].sl         = PositionGetDouble(POSITION_SL);
      items[n].tp         = PositionGetDouble(POSITION_TP);
      n++;
     }

   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0)
         continue;
      ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
      if(!IsPendingTypeCopyable(type))
         continue;
      if(!MasterMagicMatches((ulong)OrderGetInteger(ORDER_MAGIC)))
         continue;
      if(IsGctComment(OrderGetString(ORDER_COMMENT)))
         continue;
      if(FindMaster(items, ticket) >= 0)
         continue; // order is being filled and already shows as a position

      ArrayResize(items, n + 1, 32);
      items[n].key        = ticket;
      items[n].symbol     = OrderGetString(ORDER_SYMBOL);
      items[n].type       = type;
      items[n].isPosition = false;
      items[n].volume     = OrderGetDouble(ORDER_VOLUME_CURRENT);
      items[n].price      = OrderGetDouble(ORDER_PRICE_OPEN);
      items[n].sl         = OrderGetDouble(ORDER_SL);
      items[n].tp         = OrderGetDouble(ORDER_TP);
      n++;
     }
   return n;
  }

//--- Child positions + pending orders tagged with ChildMagicNumber
int CollectChildItems(ChildItem &items[])
  {
   ArrayResize(items, 0);
   int n = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || (ulong)PositionGetInteger(POSITION_MAGIC) != ChildMagicNumber)
         continue;
      ArrayResize(items, n + 1, 32);
      items[n].id         = (ulong)PositionGetInteger(POSITION_IDENTIFIER);
      items[n].ticket     = ticket;
      items[n].isPosition = true;
      items[n].symbol     = PositionGetString(POSITION_SYMBOL);
      items[n].type       = ((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
      items[n].volume     = PositionGetDouble(POSITION_VOLUME);
      items[n].price      = PositionGetDouble(POSITION_PRICE_OPEN);
      items[n].sl         = PositionGetDouble(POSITION_SL);
      items[n].tp         = PositionGetDouble(POSITION_TP);
      items[n].typeTime   = ORDER_TIME_GTC;
      items[n].expiration = 0;
      items[n].masterKey  = MasterKeyFromComment(PositionGetString(POSITION_COMMENT));
      n++;
     }

   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0 || (ulong)OrderGetInteger(ORDER_MAGIC) != ChildMagicNumber)
         continue;
      ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
      if(type != ORDER_TYPE_BUY_LIMIT && type != ORDER_TYPE_SELL_LIMIT &&
         type != ORDER_TYPE_BUY_STOP && type != ORDER_TYPE_SELL_STOP)
         continue;
      if(FindChild(items, ticket) >= 0)
         continue;
      ArrayResize(items, n + 1, 32);
      items[n].id         = ticket;
      items[n].ticket     = ticket;
      items[n].isPosition = false;
      items[n].symbol     = OrderGetString(ORDER_SYMBOL);
      items[n].type       = type;
      items[n].volume     = OrderGetDouble(ORDER_VOLUME_CURRENT);
      items[n].price      = OrderGetDouble(ORDER_PRICE_OPEN);
      items[n].sl         = OrderGetDouble(ORDER_SL);
      items[n].tp         = OrderGetDouble(ORDER_TP);
      items[n].typeTime   = (ENUM_ORDER_TYPE_TIME)OrderGetInteger(ORDER_TYPE_TIME);
      items[n].expiration = (datetime)OrderGetInteger(ORDER_TIME_EXPIRATION);
      items[n].masterKey  = MasterKeyFromComment(OrderGetString(ORDER_COMMENT));
      n++;
     }
   return n;
  }

//+------------------------------------------------------------------+
//| Shared-file protocol (cross-terminal)                            |
//|  line 1 : GCT1;<heartbeat TimeLocal>;<master login>;<count>      |
//|  lines  : key;symbol;type;isPosition;volume;price;sl;tp          |
//|  last   : END;<count>   (a snapshot without it is rejected)      |
//+------------------------------------------------------------------+
void PublishMasterSnapshot(const bool force)
  {
   MasterItem items[];
   int n = CollectLocalMasterItems(items);

   string body = "";
   for(int i = 0; i < n; i++)
     {
      int dg = (int)SymbolInfoInteger(items[i].symbol, SYMBOL_DIGITS);
      body += StringFormat("%I64u;%s;%d;%d;%s;%s;%s;%s\n",
                           items[i].key, items[i].symbol, (int)items[i].type, (int)items[i].isPosition,
                           DoubleToString(items[i].volume, 8), DoubleToString(items[i].price, dg),
                           DoubleToString(items[i].sl, dg), DoubleToString(items[i].tp, dg));
     }

   ulong now = NowMs();
   //--- write on change, or at least once per second as a heartbeat
   if(!force && body == g_lastPayload && now - g_lastPublishMs < 1000)
      return;

   ResetLastError();
   int h = FileOpen(g_snapFile, FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON | FILE_SHARE_READ | FILE_SHARE_WRITE);
   if(h == INVALID_HANDLE)
     {
      LogThrottled("pubopen", StringFormat("[GCT] Cannot write snapshot '%s' (err=%d) - will retry.", g_snapFile, GetLastError()), 10000);
      return;
     }
   FileWriteString(h, StringFormat("%s;%I64d;%I64d;%d\n", GCT_FILE_MAGIC, (long)TimeLocal(), AccountInfoInteger(ACCOUNT_LOGIN), n));
   FileWriteString(h, body);
   FileWriteString(h, StringFormat("END;%d\n", n));
   FileClose(h);

   if(body != g_lastPayload)
      PrintFormat("[GCT] Master snapshot published: %d item(s).", n);
   g_lastPayload   = body;
   g_lastPublishMs = now;
  }

bool ReadMasterSnapshotFile(MasterItem &items[])
  {
   ArrayResize(items, 0);
   if(!FileIsExist(g_snapFile, FILE_COMMON))
     {
      LogThrottled("nosnap", StringFormat("[GCT] Waiting for master snapshot '%s' in Common\\Files (is the master EA running with the same ChannelName?).", g_snapFile));
      return false;
     }
   ResetLastError();
   int h = FileOpen(g_snapFile, FILE_READ | FILE_TXT | FILE_ANSI | FILE_COMMON | FILE_SHARE_READ | FILE_SHARE_WRITE);
   if(h == INVALID_HANDLE)
      return false; // file busy (being written) - try again next cycle

   string lines[];
   int    nl = 0;
   while(!FileIsEnding(h))
     {
      string l = FileReadString(h);
      StringTrimRight(l);
      if(StringLen(l) == 0)
         continue;
      ArrayResize(lines, nl + 1, 64);
      lines[nl++] = l;
     }
   FileClose(h);
   if(nl < 2)
      return false;

   string hdr[], ftr[];
   if(StringSplit(lines[0], ';', hdr) != 4 || hdr[0] != GCT_FILE_MAGIC)
      return false;
   datetime heartbeat = (datetime)StringToInteger(hdr[1]);
   long     login     = StringToInteger(hdr[2]);
   int      count     = (int)StringToInteger(hdr[3]);
   if(StringSplit(lines[nl - 1], ';', ftr) != 2 || ftr[0] != "END" ||
      (int)StringToInteger(ftr[1]) != count || nl != count + 2)
      return false; // incomplete / torn snapshot

   if(MasterAccountLogin != 0 && login != MasterAccountLogin)
     {
      LogThrottled("wronglogin", StringFormat("[GCT] Snapshot is from login %I64d but MasterAccountLogin=%I64d - ignored.", login, MasterAccountLogin));
      return false;
     }
   long age = (long)(TimeLocal() - heartbeat);
   if(age > MasterHeartbeatTimeoutSec)
     {
      LogThrottled("stale", StringFormat("[GCT] Master snapshot is stale (%I64d s old). No actions until master is back online.", age));
      return false;
     }

   ArrayResize(items, count);
   for(int i = 0; i < count; i++)
     {
      string f[];
      if(StringSplit(lines[i + 1], ';', f) != 8)
         return false;
      items[i].key        = (ulong)StringToInteger(f[0]);
      items[i].symbol     = f[1];
      items[i].type       = (ENUM_ORDER_TYPE)StringToInteger(f[2]);
      items[i].isPosition = (StringToInteger(f[3]) != 0);
      items[i].volume     = StringToDouble(f[4]);
      items[i].price      = StringToDouble(f[5]);
      items[i].sl         = StringToDouble(f[6]);
      items[i].tp         = StringToDouble(f[7]);
     }

   //--- the publisher filters by its own MasterMagicNumber; drop pending types the child does not copy
   for(int i = ArraySize(items) - 1; i >= 0; i--)
     {
      if(!items[i].isPosition && !IsPendingTypeCopyable(items[i].type))
        {
         int last = ArraySize(items) - 1;
         if(i != last)
            items[i] = items[last];
         ArrayResize(items, last);
        }
     }
   return true;
  }

bool GetMasterSnapshot(MasterItem &items[])
  {
   if(EARole == ROLE_CHILD_SAME_ACCOUNT)
     {
      CollectLocalMasterItems(items);
      return true;
     }
   return ReadMasterSnapshotFile(items);
  }

//+------------------------------------------------------------------+
//| Open a child copy for a master item (market or pending)          |
//+------------------------------------------------------------------+
void OpenChildCopy(const MasterItem &m, int li)
  {
   string sym = MapSymbol(m.symbol);
   //--- create the link BEFORE sending: it is the duplicate guard for this master ticket
   if(li < 0)
      li = AddLink(m.key, 0, sym, LINK_RETRY_OPEN, m.volume, 0.0);
   g_links[li].lastAttemptMs = NowMs();

   if(!EnsureSymbol(sym))
     {
      RegisterFailure(li);
      if(g_links[li].failCount >= MaxOpenAttempts)
         g_links[li].state = LINK_IGNORED;
      g_linksDirty = true;
      return;
     }

   double vol = CalcChildLot(sym, m.volume);

   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   req.symbol    = sym;
   req.volume    = vol;
   req.type      = m.type;
   req.magic     = ChildMagicNumber;
   req.deviation = (ulong)MathMax(0, MaxSlippage);
   req.comment   = GCT_TAG + IntegerToString((long)m.key);
   req.sl        = NormalizePrice(sym, m.sl);
   req.tp        = NormalizePrice(sym, m.tp);

   if(m.isPosition)
     {
      MqlTick tick;
      if(!SymbolInfoTick(sym, tick))
        {
         PrintFormat("[GCT] No tick for %s (err=%d) - copy of master #%I64u postponed.", sym, GetLastError(), m.key);
         RegisterFailure(li);
         return;
        }
      req.action = TRADE_ACTION_DEAL;
      req.price  = IsBuyType(m.type) ? tick.ask : tick.bid;

      if(MaxEntryDeviation > 0 && m.price > 0.0)
        {
         double point = SymbolInfoDouble(sym, SYMBOL_POINT);
         double devPts = (point > 0.0) ? MathAbs(req.price - m.price) / point : 0.0;
         if(devPts > MaxEntryDeviation)
           {
            PrintFormat("[GCT] SKIP master #%I64u %s: price moved %.0f pts from master entry (limit %d). Not copied.",
                        m.key, sym, devPts, MaxEntryDeviation);
            g_links[li].state = LINK_IGNORED;
            g_linksDirty = true;
            return;
           }
        }
     }
   else
     {
      req.action    = TRADE_ACTION_PENDING;
      req.price     = NormalizePrice(sym, m.price);
      req.type_time = GetPendingTypeTime(sym);
     }

   string ctx = StringFormat("OPEN %s %.2f %s for master #%I64u", EnumToString(m.type), vol, sym, m.key);
   bool ok = SendTradeRequest(req, res, ctx);

   //--- broker rejected the stops (e.g. stops level on child) -> open without, SL/TP sync retries later
   if(!ok && res.retcode == TRADE_RETCODE_INVALID_STOPS && (req.sl > 0.0 || req.tp > 0.0))
     {
      PrintFormat("[GCT] Retrying master #%I64u without SL/TP; they will be applied by the sync loop.", m.key);
      req.sl = 0.0;
      req.tp = 0.0;
      ok = SendTradeRequest(req, res, ctx + " (no SL/TP)");
     }

   //--- note: if the server ever returns order=0 on success, the comment-based recovery re-attaches the child
   if(ok)
     {
      g_links[li].childKey          = res.order; // == child POSITION_IDENTIFIER once filled
      g_links[li].childSymbol       = sym;
      g_links[li].state             = LINK_ACTIVE;
      g_links[li].failCount         = 0;
      g_links[li].masterInitVol     = m.volume;
      g_links[li].childInitVol      = (m.isPosition && res.volume > 0.0) ? res.volume : vol;
      g_links[li].childMissingSince = 0;
      g_linksDirty = true;
      SaveLinks(); // persist immediately - this is the duplicate guard across restarts
      return;
     }

   RegisterFailure(li);
   if(g_links[li].failCount >= MaxOpenAttempts)
     {
      PrintFormat("[GCT] Giving up copying master #%I64u after %d failed attempts.", m.key, g_links[li].failCount);
      g_links[li].state = LINK_IGNORED;
     }
   g_linksDirty = true;
  }

//+------------------------------------------------------------------+
//| Rebuild links from child comments (restart / lost map file)      |
//+------------------------------------------------------------------+
void RecoverLinksFromComments(const ChildItem &kids[], const MasterItem &masters[])
  {
   for(int k = 0; k < ArraySize(kids); k++)
     {
      ulong mk = kids[k].masterKey;
      if(mk == 0 || FindLinkByChild(kids[k].id) >= 0)
         continue;

      int    mi   = FindMaster(masters, mk);
      double mVol = (mi >= 0) ? masters[mi].volume : 0.0;
      int    li   = FindLink(mk);
      if(li < 0)
        {
         AddLink(mk, kids[k].id, kids[k].symbol, LINK_ACTIVE, mVol, kids[k].volume);
         PrintFormat("[GCT] Recovered link master #%I64u -> child #%I64u from comment.", mk, kids[k].id);
        }
      else if(FindChild(kids, g_links[li].childKey) < 0)
        {
         g_links[li].childKey          = kids[k].id;
         g_links[li].childSymbol       = kids[k].symbol;
         g_links[li].state             = LINK_ACTIVE;
         g_links[li].failCount         = 0;
         g_links[li].childMissingSince = 0;
         if(g_links[li].masterInitVol <= 0.0 || g_links[li].childInitVol <= 0.0)
           {
            g_links[li].masterInitVol = mVol;
            g_links[li].childInitVol  = kids[k].volume;
           }
         g_linksDirty = true;
         PrintFormat("[GCT] Re-attached master #%I64u to child #%I64u.", mk, kids[k].id);
        }
      else
         LogThrottled("dup_" + IntegerToString((long)kids[k].id),
                      StringFormat("[GCT] WARNING: child #%I64u is a duplicate copy of master #%I64u (already linked to #%I64u). Not managed.",
                                   kids[k].id, mk, g_links[li].childKey), 300000);
     }
  }

//+------------------------------------------------------------------+
//| Manage a master item that already has a link                     |
//+------------------------------------------------------------------+
void ProcessLinkedMaster(const int li, const MasterItem &m, const ChildItem &kids[])
  {
   g_links[li].masterMissingSince = 0;
   int state = g_links[li].state;

   if(state == LINK_IGNORED || state == LINK_CHILD_GONE)
      return;

   if(state == LINK_RETRY_OPEN)
     {
      if(EnableCopyTrading && BackoffElapsed(li))
         OpenChildCopy(m, li);
      return;
     }

   //--- LINK_ACTIVE
   int ci = FindChild(kids, g_links[li].childKey);
   if(ci < 0)
     {
      ulong now = NowMs();
      if(g_links[li].childMissingSince == 0)
        {
         g_links[li].childMissingSince = now;
         return;
        }
      if(now - g_links[li].childMissingSince < (ulong)GracePeriodMs)
         return;
      PrintFormat("[GCT] Child #%I64u of master #%I64u was closed/deleted on the child side (SL/TP/manual). It will NOT be reopened.",
                  g_links[li].childKey, m.key);
      g_links[li].state = LINK_CHILD_GONE;
      g_linksDirty = true;
      return;
     }
   g_links[li].childMissingSince = 0;

   ChildItem c = kids[ci];
   c.masterKey = m.key;

   //--- master pending filled while the child pending is still waiting
   if(m.isPosition && !c.isPosition && ConvertPendingOnMasterFill && EnableCopyTrading)
     {
      if(!BackoffElapsed(li))
         return;
      PrintFormat("[GCT] Master #%I64u pending filled; child pending #%I64u not filled -> converting to market.", m.key, c.ticket);
      if(DeleteChildOrder(c, "master pending filled"))
        {
         //--- race: the child pending filled just now -> it is already a position, keep it
         if(ChildPositionExists(c.id))
            return;
         g_links[li].state     = LINK_RETRY_OPEN;
         g_links[li].childKey  = 0;
         g_links[li].failCount = 0;
         g_linksDirty = true;
         OpenChildCopy(m, li);
        }
      else
         RegisterFailure(li);
      return;
     }

   //--- SL / TP (and pending price) synchronisation
   double point   = SymbolInfoDouble(c.symbol, SYMBOL_POINT);
   double wantSL  = NormalizePrice(c.symbol, m.sl);
   double wantTP  = NormalizePrice(c.symbol, m.tp);
   bool   stopsDiff = PriceDiffers(wantSL, c.sl, point) || PriceDiffers(wantTP, c.tp, point);

   double wantPrice = c.price;
   bool   priceDiff = false;
   if(!m.isPosition && !c.isPosition && SyncPendingPrice)
     {
      wantPrice = NormalizePrice(c.symbol, m.price);
      priceDiff = PriceDiffers(wantPrice, c.price, point);
     }

   if((stopsDiff || priceDiff) && BackoffElapsed(li))
     {
      int dg = (int)SymbolInfoInteger(c.symbol, SYMBOL_DIGITS);
      PrintFormat("[GCT] Master #%I64u changed: SL %s->%s TP %s->%s%s",
                  m.key, DoubleToString(c.sl, dg), DoubleToString(wantSL, dg),
                  DoubleToString(c.tp, dg), DoubleToString(wantTP, dg),
                  priceDiff ? StringFormat(" price %s->%s", DoubleToString(c.price, dg), DoubleToString(wantPrice, dg)) : "");
      bool ok = c.isPosition ? ModifyChildPositionStops(c, wantSL, wantTP)
                             : ModifyChildPendingOrder(c, wantPrice, wantSL, wantTP);
      if(ok)
         g_links[li].failCount = 0;
      else
         RegisterFailure(li);
     }

   //--- proportional partial close
   if(CopyPartialCloses && m.isPosition && c.isPosition &&
      g_links[li].masterInitVol > 0.0 && g_links[li].childInitVol > 0.0 &&
      m.volume < g_links[li].masterInitVol - 1e-8)
     {
      double vmin    = SymbolInfoDouble(c.symbol, SYMBOL_VOLUME_MIN);
      double target  = RoundToStep(c.symbol, g_links[li].childInitVol * m.volume / g_links[li].masterInitVol);
      if(target < vmin)
         target = vmin;
      double toClose = FloorToStep(c.symbol, c.volume - target);
      if(toClose >= vmin - 1e-9 && BackoffElapsed(li))
        {
         if(CloseChildPosition(c, toClose, StringFormat("master #%I64u partial close", m.key)))
            g_links[li].failCount = 0;
         else
            RegisterFailure(li);
        }
     }
  }

//+------------------------------------------------------------------+
//| Main reconciliation cycle (child roles)                          |
//+------------------------------------------------------------------+
void SyncAll()
  {
   if(g_busy || !IsChildRole())
      return;
   g_busy = true;

   MasterItem masters[];
   if(!IsTradingAllowedNow() || !GetMasterSnapshot(masters))
     {
      g_busy = false;
      return; // no valid master view -> do nothing (never close on missing data)
     }

   ChildItem kids[];
   CollectChildItems(kids);
   RecoverLinksFromComments(kids, masters);

   //--- first valid snapshot after start: mark pre-existing master trades as "not to copy"
   if(g_needInitialIgnore)
     {
      int ignored = 0;
      for(int i = 0; i < ArraySize(masters); i++)
         if(FindLink(masters[i].key) < 0)
           {
            AddLink(masters[i].key, 0, MapSymbol(masters[i].symbol), LINK_IGNORED, masters[i].volume, 0.0);
            ignored++;
           }
      g_needInitialIgnore = false;
      PrintFormat("[GCT] CopyExistingOnStart=false: %d pre-existing master trade(s) will not be copied.", ignored);
     }

   //--- 1) new + existing master items
   for(int i = 0; i < ArraySize(masters); i++)
     {
      int li = FindLink(masters[i].key);
      if(li < 0)
        {
         if(EnableCopyTrading)
            OpenChildCopy(masters[i], -1);
         continue;
        }
      ProcessLinkedMaster(li, masters[i], kids);
     }

   //--- 2) links whose master ticket disappeared -> close / delete child
   ulong now = NowMs();
   for(int i = ArraySize(g_links) - 1; i >= 0; i--)
     {
      if(FindMaster(masters, g_links[i].masterKey) >= 0)
         continue;
      if(g_links[i].masterMissingSince == 0)
        {
         g_links[i].masterMissingSince = now;
         continue;
        }
      if(now - g_links[i].masterMissingSince < (ulong)GracePeriodMs)
         continue;

      if(g_links[i].state == LINK_ACTIVE)
        {
         int ci = FindChild(kids, g_links[i].childKey);
         if(ci >= 0)
           {
            ChildItem c = kids[ci];
            c.masterKey = g_links[i].masterKey;
            bool ok = true;
            if(!c.isPosition)
              {
               if(!BackoffElapsed(i))
                  continue;
               ok = DeleteChildOrder(c, StringFormat("master #%I64u removed", c.masterKey));
              }
            else if(CloseChildOnMasterClose)
              {
               if(!BackoffElapsed(i))
                  continue;
               ok = CloseChildPosition(c, c.volume, StringFormat("master #%I64u closed", c.masterKey));
              }
            if(!ok)
              {
               RegisterFailure(i);
               continue;
              }
           }
        }
      RemoveLink(i);
     }

   if(g_linksDirty)
      SaveLinks();
   g_busy = false;
  }

//+------------------------------------------------------------------+
//| Chart status                                                     |
//+------------------------------------------------------------------+
void UpdateStatus()
  {
   if(MQLInfoInteger(MQL_TESTER))
      return;
   if(!IsChildRole())
     {
      Comment(StringFormat("GonyCopyTrade - MASTER PUBLISHER\nChannel: %s\nLast publish: %s",
                           ChannelName, TimeToString(TimeLocal(), TIME_SECONDS)));
      return;
     }
   int active = 0, ignored = 0, gone = 0, retry = 0;
   for(int i = 0; i < ArraySize(g_links); i++)
     {
      switch(g_links[i].state)
        {
         case LINK_ACTIVE:     active++;  break;
         case LINK_IGNORED:    ignored++; break;
         case LINK_CHILD_GONE: gone++;    break;
         default:              retry++;   break;
        }
     }
   Comment(StringFormat("GonyCopyTrade - CHILD (%s)\nCopy new trades: %s | Lot mode: %s\nLinks: %d active, %d retry, %d child-closed, %d ignored",
                        EARole == ROLE_CHILD_SAME_ACCOUNT ? "same account" : "from file '" + ChannelName + "'",
                        EnableCopyTrading ? "ON" : "OFF",
                        LotMode == MODE_FIXED ? StringFormat("fixed %.2f", FixedLotSize) : StringFormat("x%.2f", LotMultiplier),
                        active, retry, gone, ignored));
  }

//+------------------------------------------------------------------+
//| Expert initialization                                            |
//+------------------------------------------------------------------+
int OnInit()
  {
   //--- input validation
   if(FixedLotSize <= 0.0 || LotMultiplier <= 0.0)
     {
      Print("[GCT] FixedLotSize and LotMultiplier must be > 0.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(MaxSlippage < 0 || MaxRetries < 1 || MaxOpenAttempts < 1 || TimerMilliseconds < 50 || GracePeriodMs < 0)
     {
      Print("[GCT] Invalid execution/timing inputs (MaxSlippage>=0, MaxRetries>=1, MaxOpenAttempts>=1, TimerMilliseconds>=50, GracePeriodMs>=0).");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(IsChildRole() && ChildMagicNumber == 0)
     {
      Print("[GCT] ChildMagicNumber must be non-zero.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(MasterMagicNumber != 0 && MasterMagicNumber == ChildMagicNumber)
     {
      Print("[GCT] MasterMagicNumber and ChildMagicNumber must differ (the EA would copy its own trades).");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(StringLen(ChannelName) == 0)
     {
      Print("[GCT] ChannelName must not be empty.");
      return INIT_PARAMETERS_INCORRECT;
     }

   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   g_snapFile  = ChannelName + ".snap";
   g_linksFile = StringFormat("GonyCopyTrade_links_%I64d_%I64u_%d.csv", login, ChildMagicNumber, (int)EARole);

   if(IsChildRole())
     {
      if((ENUM_ACCOUNT_MARGIN_MODE)AccountInfoInteger(ACCOUNT_MARGIN_MODE) != ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
        {
         Print("[GCT] The child account must be a HEDGING account (each master ticket needs its own child position).");
         return INIT_FAILED;
        }
      if(EARole == ROLE_CHILD_SAME_ACCOUNT && MasterMagicNumber == 0)
         Print("[GCT] WARNING: MasterMagicNumber=0 on the same account copies ALL trades (manual + other EAs) except this EA's own.");

      LoadLinks();
      g_needInitialIgnore = !CopyExistingOnStart;
     }

   if(!EventSetMillisecondTimer(TimerMilliseconds))
     {
      PrintFormat("[GCT] EventSetMillisecondTimer failed (err=%d).", GetLastError());
      return INIT_FAILED;
     }

   PrintFormat("[GCT] Started | role=%s login=%I64d masterMagic=%I64u childMagic=%I64u lotMode=%s fixed=%.2f mult=%.2f slippage=%d copyNew=%s",
               EnumToString(EARole), login, MasterMagicNumber, ChildMagicNumber, EnumToString(LotMode),
               FixedLotSize, LotMultiplier, MaxSlippage, EnableCopyTrading ? "ON" : "OFF");

   if(IsChildRole())
      SyncAll();
   else
      PublishMasterSnapshot(true);
   UpdateStatus();
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
//| Expert deinitialization                                          |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   if(IsChildRole())
      SaveLinks();
   Comment("");
   PrintFormat("[GCT] Stopped (reason=%d). Child trades remain open and will be re-attached on restart.", reason);
  }

//+------------------------------------------------------------------+
//| Tick                                                             |
//+------------------------------------------------------------------+
void OnTick()
  {
   if(IsChildRole())
      SyncAll();
   else
      PublishMasterSnapshot(false);
  }

//+------------------------------------------------------------------+
//| Timer: keeps syncing when ticks are sparse / file mode           |
//+------------------------------------------------------------------+
void OnTimer()
  {
   if(IsChildRole())
      SyncAll();
   else
      PublishMasterSnapshot(false);

   static ulong lastStatus = 0;
   if(NowMs() - lastStatus >= 1000)
     {
      UpdateStatus();
      lastStatus = NowMs();
     }
  }

//+------------------------------------------------------------------+
//| Trade transactions: react instantly to opens/modifies/closes     |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   //--- REQUEST echoes our own OrderSend results; the state changes follow as other transaction types
   if(trans.type == TRADE_TRANSACTION_REQUEST)
      return;

   if(IsChildRole())
      SyncAll();
   else
      PublishMasterSnapshot(true);
  }
//+------------------------------------------------------------------+
