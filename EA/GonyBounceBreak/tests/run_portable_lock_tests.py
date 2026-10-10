"""Exercise the EA's actual AcquireLock function with mocked terminal APIs."""

from pathlib import Path
import shutil
import subprocess
import tempfile


MOCKS = r"""
#include <cassert>
#include <cstdio>
#include <string>
using std::string;
constexpr int ERR_GLOBALVARIABLE_EXISTS=4502;
bool g_persistent=true,g_lockOwned=false;
string g_lockName="test.lock";
bool exists=false,creation_race=false,create_failure=false,read_failure=false;
bool reclaim_failure=false;
double owner=0.0,race_owner=0.0;
int error=0,temp_calls=0;
void ResetLastError() { error=0; }
int GetLastError() { return error; }
template<class... Args> void PrintFormat(const char* format,Args... args) {
    std::printf(format,args...); std::puts("");
}
bool GlobalVariableCheck(const string&) { return exists; }
bool GlobalVariableTemp(const string&) {
    temp_calls++;
    if(creation_race) { exists=true; owner=race_owner; }
    if(exists) { error=ERR_GLOBALVARIABLE_EXISTS; return false; }
    if(create_failure) { error=4503; return false; }
    exists=true; owner=0.0; return true;
}
bool GlobalVariableGet(const string&,double& value) {
    if(read_failure || !exists) { error=4501; return false; }
    value=owner; return true;
}
bool GlobalVariableSetOnCondition(const string&,double value,double expected) {
    if(reclaim_failure && expected!=0.0) { error=4501; return false; }
    if(!exists || owner!=expected) { error=4502; return false; }
    owner=value; return true;
}
long ChartID() { return 101; }
long ChartFirst() { return 101; }
long ChartNext(long chart) { return chart==101 ? 202 : -1; }
void Reset() {
    g_persistent=true; g_lockOwned=false; exists=false; creation_race=false;
    create_failure=false; read_failure=false; reclaim_failure=false;
    owner=0.0; race_owner=0.0; error=0; temp_calls=0;
}
"""

CHECKS = r"""
int main() {
    Reset();
    assert(AcquireLock() && g_lockOwned && owner==101 && temp_calls==1);
    Reset(); exists=true;
    assert(AcquireLock() && g_lockOwned && owner==101 && temp_calls==0);
    Reset(); exists=true; owner=202;
    assert(!AcquireLock() && !g_lockOwned && owner==202 && temp_calls==0);
    Reset(); exists=true; owner=303;
    assert(AcquireLock() && g_lockOwned && owner==101 && temp_calls==0);
    Reset(); creation_race=true;
    assert(AcquireLock() && g_lockOwned && owner==101);
    Reset(); creation_race=true; race_owner=202;
    assert(!AcquireLock() && !g_lockOwned && owner==202);
    Reset(); create_failure=true;
    assert(!AcquireLock() && !g_lockOwned && !exists);
    Reset(); exists=true; read_failure=true;
    assert(!AcquireLock() && !g_lockOwned && owner==0);
    Reset(); exists=true; owner=303; reclaim_failure=true;
    assert(!AcquireLock() && !g_lockOwned && owner==303);
    Reset(); g_persistent=false;
    assert(AcquireLock() && !exists && temp_calls==0);
    std::puts("GBB lock tests: 10 scenarios passed.");
}
"""


def main() -> None:
    compiler = shutil.which("clang++") or shutil.which("g++")
    if compiler is None:
        raise SystemExit("A C++17 compiler (clang++ or g++) is required.")
    ea = (Path(__file__).resolve().parent.parent / "GonyBounceBreak.mq5").read_text()
    start = ea.index("bool AcquireLock()")
    end = ea.index("\nvoid DeleteLines()", start)
    function = ea[start:end]
    with tempfile.TemporaryDirectory(prefix="gbb-lock-tests-") as temporary:
        source = Path(temporary) / "lock_tests.cpp"
        executable = Path(temporary) / "lock_tests"
        source.write_text(MOCKS + function + CHECKS)
        subprocess.run(
            [compiler, "-std=c++17", "-Wall", "-Wextra", "-Werror",
             str(source), "-o", str(executable)],
            check=True,
        )
        subprocess.run([str(executable)], check=True)


if __name__ == "__main__":
    main()
