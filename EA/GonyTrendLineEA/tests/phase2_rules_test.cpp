#include <cassert>
#include <cmath>
#define GTLR_RULES_TEST
#include "../GonyTrendLineEAVisual.mq5"

int main()
{
    double deviation = 0;
    assert(PivotRule(true, 110, 100, 105, 0.05, 2.0, deviation) == 3);
    assert(PivotRule(true, 110, 110, 105, 0.05, 2.0, deviation) == 0);
    assert(PivotRule(true, 101, 100, 100, 0.02, 2.0, deviation) == 1);
    assert(PivotRule(true, 103, 100, 100, 0.02, 2.0, deviation) == 2);
    assert(PivotRule(false, 90, 100, 95, 0.05, 2.0, deviation) == 3);
    assert(PivotRule(false, 90, 90, 95, 0.05, 2.0, deviation) == 0);

    assert(CandidateRule(true, 100, 101, 3, 3, 100) == 2);
    assert(CandidateRule(true, 100, 100, 3, 3, 100) == 1);
    assert(CandidateRule(true, 100, 99, 3, 3, 100) == 1);
    assert(CandidateRule(false, 100, 99, 100, 3, 100) == 2);
    assert(CandidateRule(false, 100, 101, 3, 3, 100) == 1);
    assert(CandidateRule(false, 100, 99, 2, 3, 100) == 0);
    assert(CandidateRule(false, 100, 99, 101, 3, 100) == 0);

    assert(ScoreRatio(-1, 2) == 0);
    assert(ScoreRatio(1, 2) == 0.5);
    assert(ScoreRatio(3, 2) == 1);
    assert(DirectionScore(true, 100, 101) == 1);
    assert(DirectionScore(true, 100, 99) == 0);
    assert(DirectionScore(false, 100, 99) == 1);
    assert(DirectionScore(false, 100, 100) == 0.5);

    assert(InteractionFlags(true, 98, 100, 2, 3) == 1);
    assert(InteractionFlags(true, 97, 100, 2, 3) == 0);
    assert(InteractionFlags(true, 96, 100, 2, 3) == 2);
    assert(InteractionFlags(false, 104, 100, 2, 3) == 2);
    assert(InteractionFlags(false, 103, 100, 4, 2) == 3);

    assert(RankBefore(80, 2, 70, 1));
    assert(RankBefore(80, 1, 80, 2));
    assert(!RankBefore(80, 2, 80, 1));
    ScoreFactors values = {1, 0, 0.5, 1, 0, 1, 1};
    ScoreFactors weights = {1, 1, 1, 1, 1, 1, 1};
    assert(std::fabs(WeightedScore(values, weights, true) - 64.28571428571429) < 1e-10);
    assert(std::fabs(WeightedScore(values, weights, false) - 58.33333333333333) < 1e-10);
    ScoreFactors contextOnly = {0, 0, 0, 0, 0, 0, 1};
    assert(WeightedScore(values, contextOnly, false) == -1);
    assert(WeightedScore(values, contextOnly, true) == 100);
}
