//+------------------------------------------------------------------+
//|                                               GonyExportBars.mq5 |
//|   Exports M15 / H1 / H4 / D1 / W1 / MN1 bars as CSV files that   |
//|   GonyBarReplay imports directly ("Market data > Import file").  |
//+------------------------------------------------------------------+
#property copyright   "GonyBarReplay"
#property version     "1.00"
#property strict
#property script_show_inputs
#property description "Writes MQL5\\Files\\<folder>\\<SYMBOL>_<TF>.csv (time,open,high,low,close,volume) for M15, H1, H4, D1, W1 and MN1."

input group "Export"
input string InpSymbols = "";              // Symbols, comma separated (empty = chart symbol)
input int    InpMaxBars = 50000;           // Max bars per timeframe
input bool   InpToUtc   = true;            // Convert intraday bar times from server time to UTC
input string InpFolder  = "GonyBarReplay"; // Sub-folder of MQL5\Files

const ENUM_TIMEFRAMES g_tfs[]   = {PERIOD_M15, PERIOD_H1, PERIOD_H4, PERIOD_D1, PERIOD_W1, PERIOD_MN1};
const string          g_names[] = {"M15", "H1", "H4", "D1", "W1", "MN1"};

//+------------------------------------------------------------------+
//| Broker server offset from UTC in seconds (rounded to 30 min).     |
//| Uses the current offset; historical DST changes are not applied.  |
//+------------------------------------------------------------------+
int ServerUtcOffset()
  {
   long diff = (long)(TimeTradeServer() - TimeGMT());
   return (int)(MathRound(diff / 1800.0) * 1800);
  }

//+------------------------------------------------------------------+
//| CopyRates, retrying while the terminal downloads history.         |
//| Starts at shift 1 so the still-forming bar is not exported.       |
//+------------------------------------------------------------------+
int CopyClosedBars(const string sym, const ENUM_TIMEFRAMES tf, MqlRates &rates[])
  {
   ArraySetAsSeries(rates, false);
   for(int attempt = 0; attempt < 10 && !IsStopped(); attempt++)
     {
      ResetLastError();
      int n = CopyRates(sym, tf, 1, InpMaxBars, rates);
      if(n > 0)
         return n;
      Sleep(500);
     }
   return -1;
  }

//+------------------------------------------------------------------+
//| Writes one <SYMBOL>_<TF>.csv file. Returns the number of bars.    |
//+------------------------------------------------------------------+
int ExportTimeframe(const string sym, const ENUM_TIMEFRAMES tf, const string tfName, const int offset)
  {
   MqlRates rates[];
   int n = CopyClosedBars(sym, tf, rates);
   if(n <= 0)
     {
      PrintFormat("%s %s: no bars available (error %d)", sym, tfName, GetLastError());
      return 0;
     }

   string path = InpFolder + "\\" + sym + "_" + tfName + ".csv";
   int h = FileOpen(path, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(h == INVALID_HANDLE)
     {
      PrintFormat("%s %s: cannot create %s (error %d)", sym, tfName, path, GetLastError());
      return 0;
     }

   int  digits   = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   bool intraday = PeriodSeconds(tf) < 86400;
   FileWriteString(h, "time,open,high,low,close,volume\r\n");

   for(int i = 0; i < n; i++)
     {
      string t;
      // D1/W1/MN1 bars are labelled by trading date: keep that date (no zone shift).
      if(!intraday)
         t = IntegerToString((long)rates[i].time);
      else
         if(InpToUtc)
            t = IntegerToString((long)rates[i].time - offset);
         else
            t = TimeToString(rates[i].time, TIME_DATE | TIME_MINUTES); // server time; pick the zone in the app

      long vol = rates[i].real_volume > 0 ? rates[i].real_volume : rates[i].tick_volume;
      FileWriteString(h, t + "," +
                      DoubleToString(rates[i].open, digits) + "," +
                      DoubleToString(rates[i].high, digits) + "," +
                      DoubleToString(rates[i].low, digits) + "," +
                      DoubleToString(rates[i].close, digits) + "," +
                      IntegerToString(vol) + "\r\n");
     }
   FileClose(h);
   PrintFormat("%s %s: %d bars -> %s", sym, tfName, n, path);
   return n;
  }

//+------------------------------------------------------------------+
//| Script entry point                                                |
//+------------------------------------------------------------------+
void OnStart()
  {
   string symbols[];
   int count = 0;
   if(StringLen(InpSymbols) == 0)
     {
      ArrayResize(symbols, 1);
      symbols[0] = _Symbol;
      count = 1;
     }
   else
     {
      string parts[];
      int k = StringSplit(InpSymbols, ',', parts);
      for(int i = 0; i < k; i++)
        {
         StringTrimLeft(parts[i]);
         StringTrimRight(parts[i]);
         if(StringLen(parts[i]) == 0)
            continue;
         ArrayResize(symbols, count + 1);
         symbols[count++] = parts[i];
        }
     }

   FolderCreate(InpFolder);
   int offset = InpToUtc ? ServerUtcOffset() : 0;
   PrintFormat("GonyExportBars: server offset UTC%+.1f h, %d symbol(s)", offset / 3600.0, count);

   int files = 0;
   for(int s = 0; s < count && !IsStopped(); s++)
     {
      if(!SymbolSelect(symbols[s], true))
        {
         PrintFormat("%s: symbol not found", symbols[s]);
         continue;
        }
      for(int t = 0; t < ArraySize(g_tfs) && !IsStopped(); t++)
         if(ExportTimeframe(symbols[s], g_tfs[t], g_names[t], offset) > 0)
            files++;
     }

   string dir = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + InpFolder;
   Alert(StringFormat("GonyExportBars: wrote %d file(s) to %s", files, dir));
  }
//+------------------------------------------------------------------+
