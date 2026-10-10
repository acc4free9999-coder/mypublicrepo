"""Test actual startup range functions with mocked history and chart APIs."""

from pathlib import Path
import shutil
import subprocess
import tempfile

from run_portable_core_tests import PRELUDE


MOCKS = r"""
#include <cassert>
using datetime=long;
constexpr int _Period=5;
string _Symbol="EURUSD";
int _Digits=5,InpBuildUpCandles=3;
double InpMaxRangePips=20.0,g_pip=0.0001,g_support=0,g_resistance=0;
bool g_rangeReady=false,g_initialScanPending=true;
datetime g_lastInitialScan=0,g_lastBar=0,now=100;
bool history_ready=true,draw_ok=true,save_ok=true;
int copies=0,draws=0,saves=0,resets=0;
std::vector<MqlRates> history;
datetime TimeLocal() { return now; }
void ResetLastError() {}
int GetLastError() { return 4401; }
template<class... Args> void PrintFormat(const char* format,Args... args) {
    std::printf(format,args...); std::puts("");
}
int CopyRates(const string&,int,int,int required,std::vector<MqlRates>& rates) {
    copies++;
    if(!history_ready) return -1;
    rates=history;
    return required;
}
bool DrawLines() { draws++; return draw_ok; }
bool SaveState() { saves++; return save_ok; }
void ResetSetup(const string&) {
    resets++; g_rangeReady=false; g_support=0; g_resistance=0;
}
void Reset() {
    g_rangeReady=false; g_initialScanPending=true;
    g_lastInitialScan=0; g_lastBar=0; now=100;
    history_ready=true; draw_ok=true; save_ok=true;
    copies=0; draws=0; saves=0; resets=0;
    history.assign(4,MqlRates{});
    history[0].time=90; history[0].low=0.5; history[0].high=2.0;
    for(int i=1;i<=3;i++) {
        history[i].low=1.1000; history[i].high=1.1010;
    }
}
"""

CHECKS = r"""
int main() {
    Reset(); ScanInitialRange();
    assert(g_rangeReady && !g_initialScanPending && draws==1 && saves==1);
    assert(g_support==1.1000 && g_resistance==1.1010 && g_lastBar==90);
    Reset(); history[1].high=1.1040; ScanInitialRange();
    assert(!g_rangeReady && !g_initialScanPending && draws==0);
    Reset(); history_ready=false; ScanInitialRange();
    assert(g_initialScanPending && !g_rangeReady && copies==1 && draws==0);
    ScanInitialRange(); assert(copies==1);
    now++; history_ready=true; ScanInitialRange();
    assert(!g_initialScanPending && g_rangeReady && copies==2 && draws==1);
    Reset(); draw_ok=false; ScanInitialRange();
    assert(!g_rangeReady && resets==1 && saves==0);
    Reset(); save_ok=false; ScanInitialRange();
    assert(!g_rangeReady && resets==1 && saves==1);
    std::puts("GBB startup tests: 7 scenarios passed.");
}
"""


def main() -> None:
    compiler = shutil.which("clang++") or shutil.which("g++")
    if compiler is None:
        raise SystemExit("A C++17 compiler (clang++ or g++) is required.")
    root = Path(__file__).resolve().parent.parent
    core = (root / "GonyBounceBreakCore.mqh").read_text().replace(
        "const MqlRates &rates[]", "const std::vector<MqlRates>& rates"
    )
    ea = (root / "GonyBounceBreak.mq5").read_text()
    functions = ea[ea.index("void EstablishRange("):ea.index("void ProcessClosedBar(")]
    functions = functions.replace(
        "const MqlRates &rates[]", "const std::vector<MqlRates>& rates"
    ).replace("MqlRates rates[];", "std::vector<MqlRates> rates;")
    prelude = PRELUDE.replace(
        "struct MqlRates {", "struct MqlRates { long time=0;"
    )
    with tempfile.TemporaryDirectory(prefix="gbb-startup-tests-") as temporary:
        source = Path(temporary) / "startup_tests.cpp"
        executable = Path(temporary) / "startup_tests"
        source.write_text(prelude + core + MOCKS + functions + CHECKS)
        subprocess.run(
            [compiler, "-std=c++17", "-Wall", "-Wextra", "-Werror",
             str(source), "-o", str(executable)],
            check=True,
        )
        subprocess.run([str(executable)], check=True)


if __name__ == "__main__":
    main()
