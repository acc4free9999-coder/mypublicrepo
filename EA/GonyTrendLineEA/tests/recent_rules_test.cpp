#include <cassert>
#include <cmath>
#define GTLR_RULES_TEST
#include "../GonyTrendLineEAVisual.mq5"

static RecentCandidate candidate(int id, double distance)
{
    RecentCandidate line = {};
    line.firstTime = 100;
    line.secondTime = 200;
    line.firstPrice = 100 + id * 20;
    line.secondPrice = 110 + id * 20;
    line.bullish = true;
    line.firstAge = 20;
    line.secondAge = 10;
    line.importance = 4;
    line.distance = distance;
    line.validity = 1;
    return line;
}

int main()
{
    RecentWeights weights = {40, 25, 10, 10, 10, 5};
    assert(std::fabs(RecentScore(1, 1, 1, 1, 1, 1, weights) - 100) < 1e-10);
    assert(std::fabs(RecentScore(0, 0, 0, 0, 0, 0, weights)) < 1e-10);
    assert(std::fabs(RecentScore(0, 0, 0, 0, 1, 0, weights) - 10) < 1e-10);
    assert(RecentPivotImportance(true, 110, 100, 105, 0.05, 2.0) == 3);
    assert(RecentPivotImportance(true, 110, 110, 105, 0.05, 2.0) == 0);
    assert(RecentPivotImportance(true, 101, 100, 100, 0.02, 2.0) == 1);
    assert(RecentPivotImportance(true, 103, 100, 100, 0.02, 2.0) == 2);
    assert(RecentPivotImportance(false, 90, 100, 95, 0.05, 2.0) == 3);
    assert(RecentPivotImportance(false, 90, 90, 95, 0.05, 2.0) == 0);
    assert(RecentPairAllowed(true, 100, 101, 3, 3, 80));
    assert(!RecentPairAllowed(true, 100, 100, 3, 3, 80));
    assert(!RecentPairAllowed(false, 100, 101, 3, 3, 80));
    assert(RecentPairAllowed(false, 100, 99, 80, 3, 80));
    assert(!RecentPairAllowed(false, 100, 99, 81, 3, 80));
    assert(RecentCloseValid(true, 98, 100, 2));
    assert(!RecentCloseValid(true, 97.9, 100, 2));
    assert(RecentCloseValid(false, 102, 100, 2));
    assert(!RecentCloseValid(false, 102.1, 100, 2));
    assert(RecentTouch(98, 100, 2));
    assert(!RecentTouch(97.9, 100, 2));

    RecentCandidate a = candidate(0, 0.1);
    assert(std::fabs(RecentLinePrice(a, 250) - 115) < 1e-10);
    RecentCandidate b = a;
    b.score = 1;
    assert(RecentBetter(b, a));
    b.score = 0;
    b.distance = 0.2;
    assert(RecentBetter(a, b));
    b.distance = a.distance;
    b.secondAge = a.secondAge + 1;
    assert(RecentBetter(a, b));
    b.secondAge = a.secondAge;
    b.importance = a.importance - 1;
    assert(RecentBetter(a, b));

    RecentCandidate duplicate = a;
    duplicate.firstTime = 101;
    duplicate.secondTime = 201;
    duplicate.firstPrice += 0.1;
    duplicate.secondPrice += 0.1;
    assert(!RecentSamePair(a, duplicate));
    assert(RecentDuplicate(a, duplicate, 300, 250, 1e-9));
    duplicate.bullish = false;
    assert(!RecentDuplicate(a, duplicate, 300, 250, 1e-9));

    RecentCandidate pool[5] = {
        candidate(0, 1), candidate(1, 2), candidate(2, 3), candidate(3, 4), duplicate
    };
    // Give each pair its own anchor identity.
    for(int i = 0; i < 4; ++i)
    {
        pool[i].firstTime += i;
        pool[i].secondTime += i;
    }
    RecentCandidate chosen[3] = {};
    RecentCandidate previous[3] = {};
    int count = RecentChoose(pool, 4, previous, 0, chosen, 3, 300, 250, 0.01);
    assert(count == 3);
    assert(RecentSamePair(chosen[0], pool[0]));
    assert(RecentSamePair(chosen[1], pool[1]));
    assert(RecentSamePair(chosen[2], pool[2]));

    previous[0] = pool[3];
    count = RecentChoose(pool, 4, previous, 1, chosen, 3, 300, 250, 0.01);
    assert(count == 3);
    assert(RecentSamePair(chosen[0], pool[0]));
    assert(RecentSamePair(chosen[1], pool[1]));
    assert(RecentSamePair(chosen[2], pool[3]));

    count = RecentChoose(pool, 3, previous, 1, chosen, 3, 300, 250, 0.01);
    assert(count == 3);
    assert(RecentSamePair(chosen[2], pool[2]));
    count = RecentChoose(pool, 0, previous, 1, chosen, 3, 300, 250, 0.01);
    assert(count == 0);

    pool[4] = pool[0];
    pool[4].firstTime += 5;
    pool[4].secondTime += 5;
    pool[4].firstPrice += 0.5;
    pool[4].secondPrice += 0.5;
    pool[4].distance = 0.5;
    count = RecentChoose(pool, 5, previous, 0, chosen, 3, 300, 250, 0.01);
    assert(count == 3);
    assert(RecentSamePair(chosen[0], pool[4]));
    assert(!RecentSamePair(chosen[1], pool[0]));
    assert(!RecentSamePair(chosen[2], pool[0]));
}
