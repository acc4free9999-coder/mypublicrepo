"""Exercise the EA's actual daily-limit functions with mocked terminal APIs."""

from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest


EA = Path(__file__).resolve().parents[1] / "RiskManagerEA.mq5"


def function(source, name):
    start = re.search(r"\b(?:bool|void|string|int)\s+" + re.escape(name) + r"\(", source).start()
    opening = source.index("{", start)
    depth = 1
    end = opening + 1
    while depth:
        depth += (source[end] == "{") - (source[end] == "}")
        end += 1
    return source[start:end]


class DailyTradeLimitTests(unittest.TestCase):
    def test_out_of_hours_fill_is_closed_without_touching_existing_positions(self):
        source = EA.read_text()
        transaction = function(source, "OnTradeTransaction")
        self.assertIn("EnforceTradingHoursForEntry(symbol, entryPosition)", transaction)
        self.assertIn("!IsWithinTradingHours()", function(source, "OpenTrade"))

        compiler = shutil.which("clang++") or shutil.which("g++")
        if compiler is None:
            self.skipTest("A C++ compiler is required for the terminal API harness")
        enforcement = function(source, "EnforceTradingHoursForEntry")
        harness = r"""
#include <cassert>
#include <string>
#include <vector>
using std::string;
using ulong = unsigned long;
enum { POSITION_SYMBOL, POSITION_IDENTIFIER };
struct Position { ulong ticket; string symbol; ulong id; bool open; };
std::vector<Position> positions;
int selected = -1;
bool InpUseTradingHours = true, tradingHoursOpen = false;
int PositionsTotal() {
 int count = 0;
 for(const auto &position : positions) if(position.open) count++;
 return count;
}
ulong PositionGetTicket(int index) {
 for(const auto &position : positions)
  if(position.open && index-- == 0) return position.ticket;
 return 0;
}
bool PositionSelectByTicket(ulong ticket) {
 for(int i = 0; i < int(positions.size()); i++)
  if(positions[i].open && positions[i].ticket == ticket) { selected = i; return true; }
 return false;
}
string PositionGetString(int) { return positions[selected].symbol; }
long PositionGetInteger(int) { return long(positions[selected].id); }
bool IsWithinTradingHours() { return tradingHoursOpen; }
bool IsManagedSymbol(string symbol) { return symbol == "XAUUSDm"; }
void PrepareTrade(string) {}
int GetLastError() { return 0; }
template<class... T> void Print(T...) {}
struct Trade {
 bool PositionClose(ulong ticket) {
  for(auto &position : positions)
   if(position.open && position.ticket == ticket) { position.open = false; return true; }
  return false;
 }
} trade;
"""
        cases = r"""
int main() {
 positions = {{1,"XAUUSDm",100,true}, {2,"XAUUSDm",200,true},
              {3,"BTCUSDm",300,true}};
 EnforceTradingHoursForEntry("XAUUSDm", 200);
 assert(positions[0].open);
 assert(!positions[1].open);
 assert(positions[2].open);
 positions[1].open = true;
 tradingHoursOpen = true;
 EnforceTradingHoursForEntry("XAUUSDm", 200);
 assert(positions[1].open);
}
"""
        with tempfile.TemporaryDirectory() as directory:
            cpp = Path(directory) / "trading_hours_entry.cpp"
            binary = Path(directory) / "trading_hours_entry"
            cpp.write_text(harness + enforcement + cases)
            subprocess.run([compiler, "-std=c++17", str(cpp), "-o", str(binary)], check=True)
            subprocess.run([str(binary)], check=True)

    def test_trading_hours_use_gmt_plus_7_boundaries(self):
        source = EA.read_text()
        self.assertIn('InpUseTradingHours = true', source)
        self.assertIn('InpTradingStartTime= "06:00"', source)
        self.assertIn('InpTradingEndTime  = "18:15"', source)
        panel = function(source, "GetPanelInfoLines")
        self.assertIn('Trading Hours GMT+7:', panel)
        self.assertIn('"GMT+7: " + TimeToString((datetime)(TimeGMT() + 7 * 60 * 60)', panel)

        compiler = shutil.which("clang++") or shutil.which("g++")
        if compiler is None:
            self.skipTest("A C++ compiler is required for the terminal API harness")
        parse_time = function(source, "ParseTimeOfDay").replace(
            "string parts[];", "std::vector<string> parts;"
        )
        within_hours = function(source, "IsWithinTradingHours")
        harness = r"""
#include <cassert>
#include <string>
#include <vector>
using std::string;
using datetime = long;
using ushort = unsigned short;
struct MqlDateTime { int hour, min, sec; };
bool InpUseTradingHours = true;
string InpTradingStartTime = "06:00", InpTradingEndTime = "18:15";
datetime utcNow = 0;
datetime TimeGMT() { return utcNow; }
bool TimeToStruct(datetime value, MqlDateTime &parts) {
 long seconds = value % 86400;
 if(seconds < 0) seconds += 86400;
 parts.hour = int(seconds / 3600);
 parts.min = int(seconds % 3600 / 60);
 parts.sec = int(seconds % 60);
 return true;
}
int StringSplit(const string &value, ushort delimiter, std::vector<string> &parts) {
 size_t start = 0, end;
 while((end = value.find(char(delimiter), start)) != string::npos) {
  parts.push_back(value.substr(start, end - start));
  start = end + 1;
 }
 parts.push_back(value.substr(start));
 return int(parts.size());
}
long StringToInteger(const string &value) { return std::stol(value); }
template<class... T> void Print(T...) {}
"""
        harness = harness.replace("#include <string>", "#include <string>\n#include <cstdlib>")
        cases = r"""
int main() {
 utcNow = 22 * 3600 + 59 * 60;
 assert(!IsWithinTradingHours()); // GMT+7 05:59
 utcNow = 23 * 3600;
 assert(IsWithinTradingHours()); // GMT+7 06:00
 utcNow = 11 * 3600 + 14 * 60;
 assert(IsWithinTradingHours()); // GMT+7 18:14
 utcNow = 11 * 3600 + 15 * 60;
 assert(!IsWithinTradingHours()); // GMT+7 18:15
 InpTradingStartTime = "bad";
 assert(!IsWithinTradingHours());
}
"""
        with tempfile.TemporaryDirectory() as directory:
            cpp = Path(directory) / "gmt_plus_7_hours.cpp"
            binary = Path(directory) / "gmt_plus_7_hours"
            cpp.write_text(harness + parse_time + within_hours + cases)
            subprocess.run([compiler, "-std=c++17", str(cpp), "-o", str(binary)], check=True)
            subprocess.run([str(binary)], check=True)

    def test_blacklist_matches_case_insensitive_prefixes(self):
        source = EA.read_text()
        for name in ("OnInit", "OnTradeTransaction", "OnTimer", "OnTick"):
            self.assertIn("EnforceBlacklistedTrades", function(source, name))
        self.assertIn("IsBlacklistedSymbol(symbol)", function(source, "OpenTrade"))

        compiler = shutil.which("clang++") or shutil.which("g++")
        if compiler is None:
            self.skipTest("A C++ compiler is required for the terminal API harness")
        blacklist = function(source, "IsBlacklistedSymbol").replace(
            "string blockedSymbols[];", "std::vector<string> blockedSymbols;"
        )
        harness = r"""
#include <algorithm>
#include <cassert>
#include <cctype>
#include <string>
#include <vector>
using std::string;
using ushort = unsigned short;
string InpBlacklistedSymbols = "BTCUSDm, ETHUSD";
int StringSplit(const string &source, ushort delimiter, std::vector<string> &parts) {
 size_t start = 0;
 size_t end;
 while((end = source.find(char(delimiter), start)) != string::npos) {
  parts.push_back(source.substr(start, end - start));
  start = end + 1;
 }
 parts.push_back(source.substr(start));
 return int(parts.size());
}
void StringTrimLeft(string &value) {
 size_t start = value.find_first_not_of(" \t\r\n");
 value = start == string::npos ? "" : value.substr(start);
}
void StringTrimRight(string &value) {
 size_t end = value.find_last_not_of(" \t\r\n");
 value = end == string::npos ? "" : value.substr(0, end + 1);
}
bool StringToUpper(string &value) {
 std::transform(value.begin(), value.end(), value.begin(),
                [](unsigned char ch) { return char(std::toupper(ch)); });
 return true;
}
int StringFind(const string &value, const string &prefix) {
 return value.find(prefix) == 0 ? 0 : -1;
}
"""
        cases = r"""
int main() {
 assert(IsBlacklistedSymbol("BTCUSDm"));
 assert(IsBlacklistedSymbol("BTCUSDm.a"));
 assert(IsBlacklistedSymbol("ethusd.r"));
 assert(!IsBlacklistedSymbol("XAUUSDm"));
 assert(!IsBlacklistedSymbol("USDETH"));
 InpBlacklistedSymbols = "";
 assert(!IsBlacklistedSymbol("BTCUSDm"));
}
"""
        with tempfile.TemporaryDirectory() as directory:
            cpp = Path(directory) / "symbol_blacklist.cpp"
            binary = Path(directory) / "symbol_blacklist"
            cpp.write_text(harness + blacklist + cases)
            subprocess.run([compiler, "-std=c++17", str(cpp), "-o", str(binary)], check=True)
            subprocess.run([str(binary)], check=True)

    def test_blacklisted_positions_and_pending_orders_are_removed(self):
        source = EA.read_text()
        enforcement = function(source, "EnforceBlacklistedTrades")
        harness = r"""
#include <cassert>
#include <string>
#include <vector>
using std::string;
using ulong = unsigned long;
enum { POSITION_SYMBOL, ORDER_SYMBOL };
struct Position { ulong ticket; string symbol; bool open; };
struct PendingOrder { ulong ticket; string symbol; bool active; };
std::vector<Position> positions;
std::vector<PendingOrder> orders;
int selectedPosition = -1, selectedOrder = -1;
int PositionsTotal() {
 int count = 0;
 for(const auto &position : positions) if(position.open) count++;
 return count;
}
ulong PositionGetTicket(int index) {
 for(const auto &position : positions)
  if(position.open && index-- == 0) return position.ticket;
 return 0;
}
bool PositionSelectByTicket(ulong ticket) {
 for(int i = 0; i < int(positions.size()); i++)
  if(positions[i].open && positions[i].ticket == ticket) {
   selectedPosition = i;
   return true;
  }
 return false;
}
string PositionGetString(int) { return positions[selectedPosition].symbol; }
int OrdersTotal() {
 int count = 0;
 for(const auto &order : orders) if(order.active) count++;
 return count;
}
ulong OrderGetTicket(int index) {
 for(const auto &order : orders)
  if(order.active && index-- == 0) return order.ticket;
 return 0;
}
bool OrderSelect(ulong ticket) {
 for(int i = 0; i < int(orders.size()); i++)
  if(orders[i].active && orders[i].ticket == ticket) {
   selectedOrder = i;
   return true;
  }
 return false;
}
string OrderGetString(int) { return orders[selectedOrder].symbol; }
bool IsBlacklistedSymbol(string symbol) {
 return symbol.find("BTCUSDm") == 0 || symbol.find("ETHUSD") == 0;
}
void PrepareTrade(string) {}
int GetLastError() { return 0; }
template<class... T> void Print(T...) {}
struct Trade {
 bool PositionClose(ulong ticket) {
  for(auto &position : positions)
   if(position.open && position.ticket == ticket) {
    position.open = false;
    return true;
   }
  return false;
 }
 bool OrderDelete(ulong ticket) {
  for(auto &order : orders)
   if(order.active && order.ticket == ticket) {
    order.active = false;
    return true;
   }
  return false;
 }
} trade;
"""
        cases = r"""
int main() {
 positions = {{1,"BTCUSDm",true}, {2,"ETHUSD.pro",true}, {3,"XAUUSDm",true}};
 orders = {{11,"BTCUSDm.r",true}, {12,"ETHUSDm",true}, {13,"EURUSDm",true}};
 EnforceBlacklistedTrades();
 assert(PositionsTotal() == 1);
 assert(positions[2].open);
 assert(OrdersTotal() == 1);
 assert(orders[2].active);
}
"""
        compiler = shutil.which("clang++") or shutil.which("g++")
        if compiler is None:
            self.skipTest("A C++ compiler is required for the terminal API harness")
        with tempfile.TemporaryDirectory() as directory:
            cpp = Path(directory) / "blacklisted_trades.cpp"
            binary = Path(directory) / "blacklisted_trades"
            cpp.write_text(harness + enforcement + cases)
            subprocess.run([compiler, "-std=c++17", str(cpp), "-o", str(binary)], check=True)
            subprocess.run([str(binary)], check=True)

    def test_user_entered_lot_size_is_preserved_in_dynamic_mode(self):
        source = EA.read_text()
        compiler = shutil.which("clang++") or shutil.which("g++")
        if compiler is None:
            self.skipTest("A C++ compiler is required for the terminal API harness")
        harness = r"""
#include <cassert>
#include <cmath>
#include <string>
using std::string;
bool InpUseFixedLot = true;
const int SYMBOL_VOLUME_STEP = 0;
double SymbolInfoDouble(const string &, int) { return 0.01; }
double MathAbs(double value) { return std::abs(value); }
"""
        cases = r"""
int main() {
 assert(IsLotDifferent("XAUUSDm", 0.10, 0.01));
 assert(!IsLotDifferent("XAUUSDm", 0.01, 0.01));
 InpUseFixedLot = false;
 assert(!IsLotDifferent("XAUUSDm", 0.10, 0.01));
 assert(!IsLotDifferent("XAUUSDm", 0.25, 0.01));
}
"""
        with tempfile.TemporaryDirectory() as directory:
            cpp = Path(directory) / "dynamic_lot.cpp"
            binary = Path(directory) / "dynamic_lot"
            cpp.write_text(harness + function(source, "IsLotDifferent") + cases)
            subprocess.run([compiler, "-std=c++17", str(cpp), "-o", str(binary)], check=True)
            subprocess.run([str(binary)], check=True)

    def test_cooldown_countdown_is_shown_separately_and_updates(self):
        source = EA.read_text()
        panel = function(source, "GetPanelInfoLines")
        self.assertIn('lines[n++] = "Cooldown: " + GetCooldownText(symbol);', panel)

        compiler = shutil.which("clang++") or shutil.which("g++")
        if compiler is None:
            self.skipTest("A C++ compiler is required for the terminal API harness")
        countdown = function(source, "GetCooldownText")
        harness = r"""
#include <cassert>
#include <cstdio>
#include <string>
using std::string;
using datetime = long;
int InpCooldownMinutes = 5;
datetime now = 1200, latestClose = 1140;
datetime TimeCurrent() { return now; }
datetime GetLastCloseTime(const string &) { return latestClose; }
string StringFormat(const char *format, int minutes, int seconds) {
 char buffer[32];
 std::snprintf(buffer, sizeof(buffer), format, minutes, seconds);
 return buffer;
}
"""
        cases = r"""
int main() {
 assert(GetCooldownText("XAUUSDm") == "04:00");
 now += 10;
 assert(GetCooldownText("XAUUSDm") == "03:50");
 now = 1200;
 latestClose = 500;
 assert(GetCooldownText("XAUUSDm") == "Ready");
 InpCooldownMinutes = 0;
 assert(GetCooldownText("XAUUSDm") == "Off");
}
"""
        with tempfile.TemporaryDirectory() as directory:
            cpp = Path(directory) / "cooldown_countdown.cpp"
            binary = Path(directory) / "cooldown_countdown"
            cpp.write_text(harness + countdown + cases)
            subprocess.run([compiler, "-std=c++17", str(cpp), "-o", str(binary)], check=True)
            subprocess.run([str(binary)], check=True)

    def test_configurable_maximum_open_trades(self):
        source = EA.read_text()
        self.assertIn("InpMaxOpenTrades = 1", source)
        self.assertNotIn("InpOneTradeOnly", source)
        self.assertIn("IsOpenTradeLimitReached(openTrades)", function(source, "OpenTrade"))
        panel = function(source, "GetPanelInfoLines")
        self.assertIn("IsOpenTradeLimitReached(open)", panel)
        self.assertIn("Open %d/%d", panel)
        self.assertIn("if(InpMaxOpenTrades < 1)", function(source, "OnInit"))

        compiler = shutil.which("clang++") or shutil.which("g++")
        if compiler is None:
            self.skipTest("A C++ compiler is required for the terminal API harness")
        limit_check = function(source, "IsOpenTradeLimitReached")
        harness = r"""
#include <cassert>
int InpMaxOpenTrades = 1;
"""
        cases = r"""
int main() {
 assert(!IsOpenTradeLimitReached(0));
 assert(IsOpenTradeLimitReached(1));
 InpMaxOpenTrades = 3;
 assert(!IsOpenTradeLimitReached(0));
 assert(!IsOpenTradeLimitReached(2));
 assert(IsOpenTradeLimitReached(3));
 assert(IsOpenTradeLimitReached(4));
}
"""
        with tempfile.TemporaryDirectory() as directory:
            cpp = Path(directory) / "open_trade_limit.cpp"
            binary = Path(directory) / "open_trade_limit"
            cpp.write_text(harness + limit_check + cases)
            subprocess.run([compiler, "-std=c++17", str(cpp), "-o", str(binary)], check=True)
            subprocess.run([str(binary)], check=True)

    def test_maximum_open_trades_closes_newest_excess_position(self):
        source = EA.read_text()
        self.assertEqual(source.count("void EnforceMaxOpenTrades("), 1)
        self.assertEqual(source.count("EnforceMaxOpenTrades(GetTradeSymbol());"), 3)
        self.assertNotIn("void EnforceMaxOpenTrades", function(source, "OnChartEvent"))
        for name in ("OnTradeTransaction", "OnInit", "OnTimer", "OnTick"):
            self.assertIn("EnforceMaxOpenTrades", function(source, name))

        compiler = shutil.which("clang++") or shutil.which("g++")
        if compiler is None:
            self.skipTest("A C++ compiler is required for the terminal API harness")
        count_positions = function(source, "CountOpenTradesOnSymbol")
        enforcement = function(source, "EnforceMaxOpenTrades")
        harness = r"""
#include <cassert>
#include <string>
#include <vector>
using std::string;
using ulong = unsigned long;
enum { POSITION_SYMBOL, POSITION_TIME };
struct Position { ulong ticket; string symbol; long time; bool open; };
std::vector<Position> positions;
std::vector<ulong> closedTickets;
int selected = -1;
int InpMaxOpenTrades = 2;
int PositionsTotal() {
 int count = 0;
 for(const auto &position : positions) if(position.open) count++;
 return count;
}
ulong PositionGetTicket(int index) {
 for(const auto &position : positions)
  if(position.open && index-- == 0) return position.ticket;
 return 0;
}
bool PositionSelectByTicket(ulong ticket) {
 for(int i = 0; i < int(positions.size()); i++)
  if(positions[i].open && positions[i].ticket == ticket) { selected = i; return true; }
 return false;
}
string PositionGetString(int) { return positions[selected].symbol; }
long PositionGetInteger(int) { return positions[selected].time; }
bool IsManagedSymbol(string symbol) { return symbol == "XAUUSDm"; }
void PrepareTrade(string) {}
int GetLastError() { return 0; }
template<class... T> void Print(T...) {}
struct Trade {
 bool PositionClose(ulong ticket) {
  for(auto &position : positions)
   if(position.open && position.ticket == ticket) {
    position.open = false;
    closedTickets.push_back(ticket);
    return true;
   }
  return false;
 }
} trade;
"""
        cases = r"""
int main() {
 positions = {{1,"XAUUSDm",10,true}, {2,"XAUUSDm",20,true},
              {3,"XAUUSDm",30,true}, {4,"XAUUSDm",40,true},
              {5,"EURUSDm",50,true}};
 EnforceMaxOpenTrades("XAUUSDm");
 assert(CountOpenTradesOnSymbol("XAUUSDm") == 2);
 assert(PositionsTotal() == 3);
 assert(closedTickets.size() == 2);
 assert(closedTickets[0] == 4 && closedTickets[1] == 3);
 assert(IsManagedSymbol(positions[4].symbol) == false);
}
"""
        with tempfile.TemporaryDirectory() as directory:
            cpp = Path(directory) / "max_open_trades.cpp"
            binary = Path(directory) / "max_open_trades"
            cpp.write_text(harness + count_positions + enforcement + cases)
            subprocess.run([compiler, "-std=c++17", str(cpp), "-o", str(binary)], check=True)
            subprocess.run([str(binary)], check=True)

    def test_exact_xauusd_symbol_is_managed(self):
        source = EA.read_text()
        self.assertNotRegex(source, r"\bInpSym[2-4]")
        self.assertNotIn("TRADE_SYMBOL_BTCUSDm", source)
        self.assertNotIn("InpTradeSymbol", source)

        compiler = shutil.which("clang++") or shutil.which("g++")
        if compiler is None:
            self.skipTest("A C++ compiler is required for the terminal API harness")
        get_symbol = function(source, "GetTradeSymbol")
        find_slot = function(source, "FindSlot")
        harness = r"""
#include <cassert>
#include <string>
using std::string;
struct SymbolSettings { bool enabled; };
SymbolSettings g_slots[1];
"""
        cases = r"""
int main() {
 g_slots[0].enabled = true;
 assert(GetTradeSymbol() == "XAUUSDm");
 assert(FindSlot("XAUUSDm") == 0);
 assert(FindSlot("XAUUSDm.pro") == -1);
 assert(FindSlot("BTCUSDm") == -1);
 g_slots[0].enabled = false;
 assert(FindSlot("XAUUSDm") == -1);
}
"""
        with tempfile.TemporaryDirectory() as directory:
            cpp = Path(directory) / "managed_symbol.cpp"
            binary = Path(directory) / "managed_symbol"
            cpp.write_text(harness + get_symbol + find_slot + cases)
            subprocess.run([compiler, "-std=c++17", str(cpp), "-o", str(binary)], check=True)
            subprocess.run([str(binary)], check=True)

    def test_counter_and_external_entry_enforcement(self):
        compiler = shutil.which("clang++") or shutil.which("g++")
        if compiler is None:
            self.skipTest("A C++ compiler is required for the terminal API harness")
        source = EA.read_text()
        counter = function(source, "GetTodayOpenedTradeCount").replace(
            "ulong entryOrders[];", "std::vector<ulong> entryOrders;"
        ).replace(
            "ulong eaClosedPositions[];", "std::vector<ulong> eaClosedPositions;"
        )
        enforcement = function(source, "EnforceDailyTradeLimit")
        monitoring = function(source, "EnforceDailyLimitOnOpenPositions")
        panel_text = function(source, "GetDailyTradeText")
        harness = r"""
#include <cassert>
#include <string>
#include <vector>
#include <set>
#include <cstdio>
using std::string;
using ulong = unsigned long;
using datetime = long;
using uint = unsigned int;
enum {
 DEAL_SYMBOL, DEAL_ENTRY, DEAL_TYPE, DEAL_ORDER, DEAL_TIME, DEAL_ENTRY_IN,
 DEAL_POSITION_ID, DEAL_REASON, DEAL_MAGIC, DEAL_ENTRY_OUT_BY,
 DEAL_REASON_EXPERT, DEAL_REASON_CLIENT, DEAL_REASON_SL, DEAL_REASON_TP,
 DEAL_ENTRY_OUT, DEAL_ENTRY_INOUT, DEAL_TYPE_BUY, DEAL_TYPE_SELL,
 POSITION_SYMBOL, POSITION_IDENTIFIER, TRADE_RETCODE_DONE = 10009
};
struct MqlDateTime { int hour, min, sec; };
struct Deal {
 ulong ticket, order;
 string symbol;
 long entry = DEAL_ENTRY_IN, type = DEAL_TYPE_BUY;
 datetime time = 86401;
 ulong position = 0;
 long reason = DEAL_REASON_CLIENT;
 ulong magic = 0;
};
std::vector<Deal> deals;
std::set<string> lotFixOrders;
datetime now = 90000, selectedStart, selectedEnd;
bool historyAvailable = true, managed = true;
int InpMaxTradesPerDay = 3;
ulong InpMagicNumber = 20240918;
int closedCount = 0;
ulong positionTicket = 900, positionId = 700;
string positionSymbol = "XAUUSDm";
bool livePosition = true, closeAllowed = true;
string DailyLotFixKey(ulong order) { return std::to_string(order); }
string DailyRejectedPositionKey(ulong id) { return "reject_" + std::to_string(id); }
datetime GlobalVariableSet(string key, double) { lotFixOrders.insert(key); return now; }
bool GlobalVariableCheck(const string &key) { return lotFixOrders.count(key); }
datetime TimeCurrent() { return now; }
bool TimeToStruct(datetime value, MqlDateTime &p) {
 p = {int(value % 86400 / 3600), int(value % 3600 / 60), int(value % 60)};
 return true;
}
datetime StructToTime(MqlDateTime p) {
 return now / 86400 * 86400 + p.hour * 3600 + p.min * 60 + p.sec;
}
void ResetLastError() {}
int GetLastError() { return 0; }
template<class... T> void Print(T...) {}
template<class... T> string StringFormat(const char *format, T... args) {
 int size = std::snprintf(nullptr, 0, format, args...);
 std::vector<char> buffer(size + 1);
 std::snprintf(buffer.data(), buffer.size(), format, args...);
 return string(buffer.data());
}
bool HistorySelect(datetime start, datetime end) {
 selectedStart = start; selectedEnd = end; return historyAvailable;
}
bool HistorySelectByPosition(ulong) { return HistorySelect(0, now); }
std::vector<Deal> selectedDeals() {
 std::vector<Deal> result;
 for(auto d : deals) if(d.time >= selectedStart && d.time <= selectedEnd) result.push_back(d);
 return result;
}
int HistoryDealsTotal() { return int(selectedDeals().size()); }
ulong HistoryDealGetTicket(int i) { return selectedDeals().at(i).ticket; }
Deal getDeal(ulong ticket) {
 for(auto d : deals) if(d.ticket == ticket) return d;
 assert(false); return {};
}
string HistoryDealGetString(ulong ticket, int) { return getDeal(ticket).symbol; }
long HistoryDealGetInteger(ulong ticket, int property) {
 auto d = getDeal(ticket);
 if(property == DEAL_ORDER) return d.order;
 if(property == DEAL_ENTRY) return d.entry;
 if(property == DEAL_TIME) return d.time;
 if(property == DEAL_POSITION_ID) return d.position ? d.position : d.order;
 if(property == DEAL_REASON) return d.reason;
 if(property == DEAL_MAGIC) return d.magic;
 return d.type;
}
int ArrayResize(std::vector<ulong> &v, int size) { v.resize(size); return size; }
bool IsManagedSymbol(string) { return managed; }
int PositionsTotal() { return livePosition ? 1 : 0; }
ulong PositionGetTicket(int) { return positionTicket; }
string PositionGetString(int) { return positionSymbol; }
long PositionGetInteger(int) { return positionId; }
void PrepareTrade(string) {}
struct {
 bool PositionClose(ulong ticket) {
  assert(ticket == positionTicket);
  if(!closeAllowed) return false;
  closedCount++; livePosition = false; return true;
 }
 uint ResultRetcode() { return closeAllowed ? TRADE_RETCODE_DONE : 10021; }
} trade;
"""
        cases = r"""
int main() {
 int count = -1;
 assert(GetDailyTradeText(0, true) == "Daily used: 0/3 | Remaining: 3");
 assert(GetDailyTradeText(2, true) == "Daily used: 2/3 | Remaining: 1");
 assert(GetDailyTradeText(3, true) == "Daily used: 3/3 | Remaining: 0");
 assert(GetDailyTradeText(4, true) == "Daily used: 4/3 | Remaining: 0");
 assert(GetDailyTradeText(0, false) ==
        "Daily used: N/A | Remaining: N/A (history unavailable)");
 InpMaxTradesPerDay = 0;
 assert(GetDailyTradeText(8, true) == "Daily used: 8 | Remaining: Unlimited");
 InpMaxTradesPerDay = 3;
 // Three entries, including already-closed trades, consume three slots.
 deals = {{1,101,"XAUUSDm"}, {2,102,"XAUUSDm"}, {3,103,"XAUUSDm"}};
 assert(GetTodayOpenedTradeCount("XAUUSDm", count) && count == 3);
 EnforceDailyTradeLimit("XAUUSDm", 103, positionId);
 assert(closedCount == 0); // The third is allowed, not rejected.
 // Manual or pending-order fills are rejected when they become entry #4.
 deals.push_back({4,104,"XAUUSDm"});
 EnforceDailyTradeLimit("XAUUSDm", 104, positionId);
 assert(closedCount == 1 && !livePosition);
 // A later event must not cause an earlier accepted entry to be rejected.
 livePosition = true;
 EnforceDailyTradeLimit("XAUUSDm", 102, positionId);
 assert(closedCount == 1);
 // Split fills of the same order count once, but distinct orders count
 // separately even on a netting account sharing one position identifier.
 deals.push_back({5,104,"XAUUSDm"});
 assert(GetTodayOpenedTradeCount("XAUUSDm", count) && count == 4);
 assert(GetTodayOpenedTradeCount("XAUUSDm", count, 104) && count == 4);
 // Pending order placement has no entry deal, hence no additional count.
 deals.push_back({6,105,"XAUUSDm",DEAL_ENTRY_OUT});
 assert(GetTodayOpenedTradeCount("XAUUSDm", count) && count == 4);
 // Symbols, closing deals, and yesterday's entries are independent.
 deals.push_back({7,106,"US500m"});
 deals.push_back({8,107,"XAUUSDm",DEAL_ENTRY_IN,DEAL_TYPE_BUY,86399});
 assert(GetTodayOpenedTradeCount("US500m", count) && count == 1);
 assert(GetTodayOpenedTradeCount("XAUUSDm", count) && count == 4);
 // Lot-size correction reopens are not new user entries.
 lotFixOrders.insert(DailyLotFixKey(104));
 assert(GetTodayOpenedTradeCount("XAUUSDm", count) && count == 3);
 EnforceDailyTradeLimit("XAUUSDm", 104, positionId);
 assert(closedCount == 1);
 // A reversal is an entry too.
 deals.push_back({9,108,"XAUUSDm",DEAL_ENTRY_INOUT});
 assert(GetTodayOpenedTradeCount("XAUUSDm", count) && count == 4);
 // The count resets at server midnight and can be rebuilt after restart.
 now = 172801;
 assert(GetTodayOpenedTradeCount("XAUUSDm", count) && count == 0);
 now = 90000;
 assert(GetTodayOpenedTradeCount("XAUUSDm", count) && count == 4);
 // History failure must fail closed, not return an allowed-looking zero.
 historyAvailable = false;
 assert(!GetTodayOpenedTradeCount("XAUUSDm", count));
 EnforceDailyTradeLimit("XAUUSDm", 108, positionId);
 assert(closedCount == 2);
 InpMaxTradesPerDay = 0;
 livePosition = true;
 EnforceDailyTradeLimit("XAUUSDm", 108, positionId);
 assert(closedCount == 2);
 // A rejected close is retried by the periodic monitor.
 InpMaxTradesPerDay = 3;
 historyAvailable = true;
 lotFixOrders.clear();
 deals = {{1,101,"XAUUSDm"}, {2,102,"XAUUSDm"},
          {3,103,"XAUUSDm"}, {4,104,"XAUUSDm"}};
 closeAllowed = false;
 EnforceDailyTradeLimit("XAUUSDm", 104, positionId);
 assert(livePosition && closedCount == 2);
 assert(GlobalVariableCheck(DailyRejectedPositionKey(positionId)));
 closeAllowed = true;
 EnforceDailyLimitOnOpenPositions();
 assert(!livePosition && closedCount == 3);
 // Completed closes by this EA free slots; failures do not.
 deals = {{1,101,"XAUUSDm"}, {2,102,"XAUUSDm"}, {3,103,"XAUUSDm"}};
 assert(GetTodayOpenedTradeCount("XAUUSDm", count) && count == 3);
 deals.push_back({4,201,"XAUUSDm",DEAL_ENTRY_OUT,DEAL_TYPE_SELL,
                  86402,101,DEAL_REASON_EXPERT,InpMagicNumber});
 assert(GetTodayOpenedTradeCount("XAUUSDm", count) && count == 2);
 // Another EA's close and this EA's SL/TP deals still count.
 deals.push_back({5,202,"XAUUSDm",DEAL_ENTRY_OUT,DEAL_TYPE_SELL,
                  86402,102,DEAL_REASON_EXPERT,999});
 deals.push_back({6,203,"XAUUSDm",DEAL_ENTRY_OUT,DEAL_TYPE_SELL,
                  86402,103,DEAL_REASON_SL,InpMagicNumber});
 assert(GetTodayOpenedTradeCount("XAUUSDm", count) && count == 2);
 // A partially closed live position continues to consume its slot.
 livePosition = true;
 positionId = 101;
 assert(GetTodayOpenedTradeCount("XAUUSDm", count) && count == 3);
 livePosition = false;
 // Exclusions survive a restart because they come from deal history.
 lotFixOrders.clear();
 assert(GetTodayOpenedTradeCount("XAUUSDm", count) && count == 2);
 deals.push_back({7,104,"XAUUSDm"});
 assert(GetTodayOpenedTradeCount("XAUUSDm", count, 104) && count == 3);
 EnforceDailyTradeLimit("XAUUSDm", 104, 104);
 assert(closedCount == 3);
}
"""
        with tempfile.TemporaryDirectory() as directory:
            cpp = Path(directory) / "daily_limit.cpp"
            binary = Path(directory) / "daily_limit"
            cpp.write_text(harness + counter + enforcement + monitoring + panel_text + cases)
            subprocess.run(
                [compiler, "-std=c++17", str(cpp), "-o", str(binary)],
                check=True,
            )
            subprocess.run([str(binary)], check=True)

    def test_transaction_hook_and_panel_guard(self):
        source = EA.read_text()
        transaction = function(source, "OnTradeTransaction")
        self.assertIn("entry == DEAL_ENTRY_IN || entry == DEAL_ENTRY_INOUT", transaction)
        self.assertIn("EnforceDailyTradeLimit(symbol, entryOrder, entryPosition)", transaction)
        self.assertLess(
            transaction.index("EnforceDailyTradeLimit("),
            transaction.index("if(entry == DEAL_ENTRY_OUT"),
        )
        self.assertIn("tradesToday >= InpMaxTradesPerDay", function(source, "OpenTrade"))
        self.assertIn("DailyLotFixKey(newTicket)", function(source, "CorrectLotSize"))
        self.assertIn("DailyRejectedPositionKey", function(source, "CorrectLotSize"))
        for name in ("OnTick", "OnTimer"):
            monitor = function(source, name)
            self.assertLess(
                monitor.index("EnforceDailyLimitOnOpenPositions()"),
                monitor.index("ManagePositions()"),
            )
        self.assertEqual(source.count("input int             InpMaxTradesPerDay"), 1)
        self.assertEqual(source.count("bool GetTodayOpenedTradeCount("), 1)

    def test_panel_uses_enforcement_count_and_fixed_row_layout(self):
        panel = function(EA.read_text(), "GetPanelInfoLines")
        self.assertIn("GetTodayOpenedTradeCount(symbol, tradesToday)", panel)
        self.assertIn("GetDailyTradeText(tradesToday, historyReady)", panel)
        self.assertIn("ArrayResize(lines, 4 + RM_SLOT_COUNT * 4)", panel)
        self.assertIn('lines[n++] = "Cooldown: " + GetCooldownText(symbol);', panel)
        self.assertIn('details[i] = " ";', panel)
        self.assertIn("ArrayResize(details, RM_SLOT_COUNT * 2)", panel)
        self.assertLess(
            panel.index("GetDailyTradeText(tradesToday, historyReady)"),
            panel.index('details[i * 2] = StringFormat'),
        )
        self.assertLess(
            panel.index("Daily reset: 00:00 server time"),
            panel.index("lines[n++] = details[i]"),
        )
        self.assertIn("Risk capacity %d", panel)
        self.assertIn("Blocked: daily limit", panel)
        self.assertIn("Daily reset: 00:00 server time", panel)


if __name__ == "__main__":
    unittest.main()
