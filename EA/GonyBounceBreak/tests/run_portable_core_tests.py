"""Run the actual MQL core tests through a small C++ syntax/API adapter.

This is not an MQL compiler or a simulation of MetaTrader's trading services.
Only arrays used directly by the core tests, math, and logging are adapted.
"""

from pathlib import Path
import shutil
import subprocess
import tempfile


PRELUDE = r"""
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <iostream>
#include <string>
#include <vector>
using std::string;
struct MqlRates { double low=0.0, high=0.0; };
double MathMin(double a,double b) { return std::min(a,b); }
double MathMax(double a,double b) { return std::max(a,b); }
double MathAbs(double a) { return std::abs(a); }
double MathFloor(double a) { return std::floor(a); }
double MathRound(double a) { return std::round(a); }
double NormalizeDouble(double a,int digits) {
    double scale=std::pow(10.0,digits);
    return std::round(a*scale)/scale;
}
template<class T> int ArraySize(const std::vector<T>& a) {
    return static_cast<int>(a.size());
}
template<class T> int ArrayResize(std::vector<T>& a,int size) {
    a.resize(size); return size;
}
template<class T> void ArraySetAsSeries(std::vector<T>&,bool) {}
void Print(const char* prefix,const string& message) {
    std::cout << prefix << message << '\n';
}
void PrintFormat(const char* format,int checks,int failures) {
    std::printf(format,checks,failures); std::puts("");
}
"""


def main() -> None:
    compiler = shutil.which("clang++") or shutil.which("g++")
    if compiler is None:
        raise SystemExit("A C++17 compiler (clang++ or g++) is required.")

    directory = Path(__file__).resolve().parent
    core = (directory.parent / "GonyBounceBreakCore.mqh").read_text()
    core = core.replace(
        "const MqlRates &rates[]", "const std::vector<MqlRates>& rates"
    )
    tests = (directory / "GonyBounceBreakCoreTests.mq5").read_text()
    tests = "\n".join(
        line for line in tests.splitlines()
        if not line.startswith(("#property", "#include"))
    ).replace("MqlRates rates[];", "std::vector<MqlRates> rates;")

    with tempfile.TemporaryDirectory(prefix="gbb-core-tests-") as temporary:
        source = Path(temporary) / "core_tests.cpp"
        executable = Path(temporary) / "core_tests"
        source.write_text(
            PRELUDE + core + tests
            + "\nint main() { OnStart(); return g_failures ? 1 : 0; }\n"
        )
        subprocess.run(
            [compiler, "-std=c++17", "-Wall", "-Wextra", "-Werror",
             str(source), "-o", str(executable)],
            check=True,
        )
        subprocess.run([str(executable)], check=True)


if __name__ == "__main__":
    main()
