#include <cassert>
#include <cmath>
#define GTLR_RULES_TEST
#include "../GonyTrendLineEAVisual.mq5"

static bool near(double a, double b)
{
    return std::fabs(a - b) < 1e-9;
}

int main()
{
    VirtualSpec spec = {1, 1, 1, 1, 100, 1, 2, 1, 2, 0.5};
    VirtualTrade trade = {};
    assert(VirtualPrepare(true, 100, 100, 93, 133, 10000, spec, trade) == VIRTUAL_ACCEPTED);
    assert(near(trade.entry, 103) && near(trade.rewardRisk, 3));
    assert(near(trade.volume, 3) && near(trade.risk, 39));
    assert(VirtualProcessBar(trade, spec, 99, 100, 104, 95, 102) == -1);
    assert(VirtualProcessBar(trade, spec, 100, 100, 104, 95, 102) == 0);
    assert(near(trade.mfe, 1) && near(trade.mae, 8));
    assert(VirtualProcessBar(trade, spec, 100, 100, 104, 95, 102) == -1);
    assert(VirtualProcessBar(trade, spec, 101, 100, 134, 92, 100) == 1);
    assert(trade.outcome == -1 && near(trade.exitPrice, 92));
    assert(near(trade.netProfit, -39) && near(trade.mfe, 1) && near(trade.mae, 10));
    assert(near(trade.stop, 93));

    assert(VirtualPrepare(false, 100, 100, 109, 69, 10000, spec, trade) == VIRTUAL_ACCEPTED);
    assert(near(trade.entry, 99) && near(trade.volume, 3));
    assert(VirtualProcessBar(trade, spec, 100, 100, 104, 96, 100) == 0);
    assert(near(trade.mfe, 1) && near(trade.mae, 7));
    assert(VirtualProcessBar(trade, spec, 101, 100, 108, 66, 100) == 1);
    assert(trade.outcome == -1 && near(trade.exitPrice, 110) && near(trade.netProfit, -39));

    assert(VirtualPrepare(true, 100, 100, 93, 133, 10000, spec, trade) == VIRTUAL_ACCEPTED);
    assert(VirtualProcessBar(trade, spec, 100, 90, 100, 89, 95) == 1);
    assert(near(trade.exitPrice, 89) && near(trade.netProfit, -48));
    assert(VirtualPrepare(true, 100, 100, 93, 133, 10000, spec, trade) == VIRTUAL_ACCEPTED);
    assert(VirtualProcessBar(trade, spec, 100, 100, 134, 99, 132) == 1);
    assert(trade.outcome == 1 && near(trade.netProfit, 81));
    assert(VirtualPrepare(false, 100, 100, 109, 69, 10000, spec, trade) == VIRTUAL_ACCEPTED);
    assert(VirtualProcessBar(trade, spec, 100, 100, 101, 66, 70) == 1);
    assert(trade.outcome == 1 && near(trade.exitPrice, 70) && near(trade.netProfit, 81));

    assert(VirtualPrepare(true, 100, 100, 0, 133, 10000, spec, trade) == VIRTUAL_INVALID_STOP);
    assert(VirtualPrepare(true, 100, 100, 93, 102, 10000, spec, trade) == VIRTUAL_INVALID_TARGET);
    assert(VirtualPrepare(true, 100, 100, 93, 132.99, 10000, spec, trade) == VIRTUAL_LOW_REWARD);
    assert(VirtualPrepare(true, 100, 100, 93, 133, 1000, spec, trade) == VIRTUAL_VOLUME_TOO_SMALL);
    spec.volumeMin = 0.01;
    spec.volumeStep = 0.01;
    assert(VirtualPrepare(true, 100, 100, 93, 133, 10000, spec, trade) == VIRTUAL_ACCEPTED);
    assert(near(trade.volume, 3.84) && near(trade.risk, 49.92));
    assert(VirtualProcessBar(trade, spec, 100, 100, 99, 95, 98) == -1);
    spec.volumeMin = 1;
    spec.volumeStep = 1;
    spec.tickValueLoss = 2;
    spec.tickValueProfit = 1;
    assert(VirtualPrepare(true, 100, 100, 93, 133, 10000, spec, trade) == VIRTUAL_ACCEPTED);
    assert(near(trade.volume, 2) && near(trade.risk, 48));
    assert(VirtualProcessBar(trade, spec, 100, 100, 134, 99, 132) == 1);
    assert(near(trade.netProfit, 54));
    spec.tickSize = 0;
    assert(VirtualPrepare(true, 100, 100, 93, 133, 10000, spec, trade) == VIRTUAL_INVALID_DATA);
}
