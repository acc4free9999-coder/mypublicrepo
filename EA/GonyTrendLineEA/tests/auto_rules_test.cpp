#include <cassert>
#include <cmath>
#define GTLR_RULES_TEST
#include "../GonyTrendLineEAVisual.mq5"

int main()
{
    assert(AutoBias(100, 110, 80, 90) == 1);
    assert(AutoBias(110, 100, 90, 80) == -1);
    assert(AutoBias(100, 110, 90, 80) == 0);
    assert(AutoBias(100, 100, 80, 90) == 0);
    assert(AutoConfirmation(true, 101, 105, 99, 104, 100, 1, 0));
    assert(!AutoConfirmation(true, 104, 105, 99, 101, 100, 1, 0));
    assert(!AutoConfirmation(true, 101, 105, 98, 104, 100, 1, 0));
    assert(!AutoConfirmation(true, 101, 105, 99.75, 104, 100, 0.15, 0));
    assert(AutoConfirmation(true, 101, 105, 99.75, 104, 100, 0.30, 0));
    assert(AutoConfirmation(false, 99, 100.25, 95, 96, 100, 0.30, 0));
    assert(AutoConfirmation(false, 99, 101, 95, 96, 100, 1, 0));
    assert(!AutoConfirmation(false, 96, 101, 95, 99, 100, 1, 0));
    assert(!AutoConfirmation(false, 99, 102, 95, 96, 100, 1, 0));
    assert(AutoLevelIntact(true, 100, 100, 0));
    assert(!AutoLevelIntact(true, 100.1, 100, 0));
    assert(AutoLevelIntact(false, 100, 100, 0));
    assert(!AutoLevelIntact(false, 99.9, 100, 0));
    assert(AutoRewardAllowed(AutoRewardRisk(true, 100, 90, 130)));
    assert(AutoRewardAllowed(AutoRewardRisk(false, 100, 110, 70)));
    assert(!AutoRewardAllowed(AutoRewardRisk(true, 100, 90, 129.9)));
    assert(!AutoRewardAllowed(AutoRewardRisk(true, 100, 100, 130)));
    assert(std::fabs(AutoVolume(10000, 0.5, 13, 0.01, 100, 0.01) - 3.84) < 1e-9);
    assert(AutoVolume(1000, 0.5, 13, 1, 100, 1) == 0);
    assert(AutoVolume(10000, 0.51, 13, 1, 100, 1) == 0);
    assert(AutoVolume(10000, 0.5, 13, 1, 2, 1) == 2);
}
