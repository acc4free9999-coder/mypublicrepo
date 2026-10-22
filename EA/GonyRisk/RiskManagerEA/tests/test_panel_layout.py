"""Check wrapping and paging against the EA's actual layout helpers."""

from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest


EA = Path(__file__).resolve().parents[1] / "RiskManagerEA.mq5"


def extract(source, name):
    match = re.search(r"\b(?:void|int|color)\s+" + name + r"\(", source)
    start = match.start()
    end = source.index("{", start) + 1
    depth = 1
    while depth:
        depth += (source[end] == "{") - (source[end] == "}")
        end += 1
    return source[start:end]


class PanelLayoutTests(unittest.TestCase):
    def test_wrapping_and_page_height(self):
        compiler = shutil.which("clang++") or shutil.which("g++")
        if not compiler:
            self.skipTest("C++ compiler required for the layout harness")
        source = EA.read_text()
        wrapping = extract(source, "WrapPanelLines").replace(
            "const string &source[]", "const std::vector<string> &source"
        ).replace("string &wrapped[]", "std::vector<string> &wrapped")
        paging = extract(source, "GetPanelPageRows")
        font_sizing = extract(source, "GetPanelFontSize").replace(
            "const string &lines[]", "const std::vector<string> &lines"
        )
        colored_wrapping = extract(source, "WrapColoredPanelLines").replace(
            "const string &source[]", "const std::vector<string> &source"
        ).replace(
            "const color &sourceColors[]", "const std::vector<color> &sourceColors"
        ).replace(
            "string &lines[]", "std::vector<string> &lines"
        ).replace(
            "color &colors[]", "std::vector<color> &colors"
        ).replace("string single[], wrapped[];", "std::vector<string> single, wrapped;")
        status_colors = extract(source, "GetPanelStatusColor")
        harness = r"""
#include <cassert>
#include <algorithm>
#include <string>
#include <vector>
using std::string;
using color = int;
enum { clrTomato, clrOrange, clrKhaki, clrPaleGreen };
int InpMaxTradesPerDay = 3;
bool InpShowTradeButtons = false;
int InpPanelFontSize = 9;
const int RM_PANEL_PADDING = 16;
int MathMax(int a, int b) { return std::max(a,b); }
int StringLen(string s) { return int(s.size()); }
string StringSubstr(string s, int start, int count = -1) {
 return s.substr(start, count < 0 ? string::npos : count);
}
void StringTrimLeft(string &s) {
 auto first = s.find_first_not_of(" ");
 s = first == string::npos ? "" : s.substr(first);
}
template<class T> int ArraySize(const std::vector<T> &v) { return int(v.size()); }
template<class T> int ArrayResize(std::vector<T> &v, int n) { v.resize(n); return n; }
int EstimateTextWidth(string s, int fontSize) { return int(s.size()) * fontSize; }
string withoutSpaces(string s) {
 s.erase(std::remove(s.begin(), s.end(), ' '), s.end());
 return s;
}
"""
        cases = r"""
int main() {
 assert(GetPanelStatusColor(true, 2, 0, false, true) == clrPaleGreen);
 assert(GetPanelStatusColor(true, 3, 0, false, true) == clrTomato);
 assert(GetPanelStatusColor(false, 0, 0, false, true) == clrTomato);
 assert(GetPanelStatusColor(true, 1, 1, false, true) == clrKhaki);
 assert(GetPanelStatusColor(true, 1, 0, true, true) == clrOrange);
 assert(GetPanelStatusColor(true, 1, 0, false, false) == clrOrange);
 InpMaxTradesPerDay = 0;
 assert(GetPanelStatusColor(true, 20, 0, false, true) == clrPaleGreen);
 InpMaxTradesPerDay = 3;
 std::vector<string> coloredSource = {"ABCDEFGHIJKLMNOPQRSTUVWXYZ", "Ready"};
 std::vector<color> sourceColors = {clrTomato, clrPaleGreen}, rowColors;
 std::vector<string> coloredRows;
 WrapColoredPanelLines(coloredSource, sourceColors, coloredRows, rowColors, 80, 9);
 assert(coloredRows.size() == rowColors.size());
 assert(rowColors.size() > 2);
 for(int i = 0; i < int(rowColors.size()) - 1; i++) assert(rowColors[i] == clrTomato);
 assert(rowColors.back() == clrPaleGreen);
 std::vector<string> source = {
  "Daily used: 2/3 | Remaining: 1 | Entry: Blocked: position open",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", "", " "
 };
 for(int width : {80, 240, 568, 900}) {
  std::vector<string> wrapped;
  WrapPanelLines(source, wrapped, width, 11);
  string original, actual;
  for(auto s : source) original += withoutSpaces(s);
  for(auto s : wrapped) {
   assert(EstimateTextWidth(s, 11) <= width);
   actual += withoutSpaces(s);
  }
  assert(original == actual);
 }
  std::vector<string> fontLines = {"1234567890"};
  assert(GetPanelFontSize(fontLines, 90) == 9);
  assert(GetPanelFontSize(fontLines, 80) == 8);
  assert(GetPanelFontSize(fontLines, 60) == 6);
  assert(GetPanelFontSize(fontLines, 20) == 6);
  InpPanelFontSize = 11;
  assert(GetPanelFontSize(fontLines, 110) == 11);
  InpPanelFontSize = 4;
  assert(GetPanelFontSize(fontLines, 110) == 6);
 // All rows are accessible through paging and the controls stay in bounds.
 for(int height : {260, 320, 480, 600, 1080}) {
  for(bool buttons : {false, true}) {
   InpShowTradeButtons = buttons;
   for(int lineHeight : {20, 28, 38}) {
    int y = std::max(0, std::min(50, height - 260));
    int rows = GetPanelPageRows(height, y, lineHeight);
    assert(rows >= 1);
    int bottom = y + 54 + rows * lineHeight + 8 + 36
                 + (buttons ? 48 : 0) + 40 + 16;
    assert(bottom <= height);
    int totalRows = 75, visited = 0;
    int pages = (totalRows + rows - 1) / rows;
    for(int p = 0; p < pages; p++)
      visited += std::min(rows, totalRows - p * rows);
    assert(visited == totalRows);
   }
  }
 }
}
"""
        with tempfile.TemporaryDirectory() as directory:
            cpp = Path(directory) / "layout.cpp"
            binary = Path(directory) / "layout"
            cpp.write_text(harness + wrapping + paging + font_sizing + colored_wrapping + status_colors + cases)
            subprocess.run([compiler, "-std=c++17", str(cpp), "-o", str(binary)], check=True)
            subprocess.run([str(binary)], check=True)

    def test_resize_navigation_and_cleanup(self):
        source = EA.read_text()
        events = extract(source, "OnChartEvent")
        self.assertIn("CHARTEVENT_CHART_CHANGE", events)
        for button in ("PREV", "NEXT"):
            self.assertIn(f'g_prefix + "{button}"', events)
            self.assertIn(f'ObjectDelete(0, g_prefix + "{button}")', extract(source, "RemovePanel"))
        self.assertIn("chartWidth - x", extract(source, "CreatePanel"))
        self.assertNotIn("GetPanelInfoLines", extract(source, "RemovePanel"))
        self.assertIn("colors[start + i], fontSize", extract(source, "CreatePanel"))
        self.assertIn("OBJPROP_COLOR, colors[start + i]", extract(source, "UpdatePanelInfo"))


if __name__ == "__main__":
    unittest.main()
