import { describe, expect, it } from 'vitest';
import { closePosition, emptyBook, submitOrder, updateBrackets } from '@/engine/matchingEngine';
import { balanceCurve, tradeStats } from '@/engine/stats';
import type { ClosedTrade, Order } from '@/types';

let n = 0;
const trade = (realizedPnl: number, riskUsd?: number): ClosedTrade => ({
  id: `t${n++}`, symbol: 'XAUUSD', side: 'buy', qty: 0.01, entryPrice: 0, exitPrice: 0, openedAt: 0, closedAt: 0, realizedPnl, reason: 'manual', riskUsd,
});

describe('tradeStats', () => {
  it('handles no trades', () => {
    const s = tradeStats([]);
    expect(s).toMatchObject({ totalTrades: 0, wins: 0, losses: 0, winRate: null, profitFactor: null, rewardRisk: null, maxWin: null, maxLoss: null, expectancy: null, avgR: null });
  });

  it('computes totals, extremes, win rate, R:R and profit factor', () => {
    const s = tradeStats([trade(100, 50), trade(-50, 50), trade(300, 100), trade(-100, 50), trade(0)]);
    expect(s.totalTrades).toBe(5);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(2);
    expect(s.breakeven).toBe(1);
    expect(s.winRate).toBe(50);
    expect(s.grossProfit).toBe(400);
    expect(s.grossLoss).toBe(-150);
    expect(s.netPnl).toBe(250);
    expect(s.maxWin).toBe(300);
    expect(s.maxLoss).toBe(-100);
    expect(s.avgWin).toBe(200);
    expect(s.avgLoss).toBe(-75);
    expect(s.rewardRisk).toBeCloseTo(200 / 75);
    expect(s.profitFactor).toBeCloseTo(400 / 150);
    expect(s.expectancy).toBe(50);
    expect(s.tradesWithRisk).toBe(4);
    expect(s.avgR).toBeCloseTo((2 - 1 + 3 - 2) / 4);
  });

  it('reports infinite profit factor / R:R when there are no losses', () => {
    const s = tradeStats([trade(10), trade(20)]);
    expect(s.winRate).toBe(100);
    expect(s.profitFactor).toBe(Infinity);
    expect(s.rewardRisk).toBe(Infinity);
    expect(s.maxLoss).toBeNull();
  });

  it('reports zero profit factor when there are only losses', () => {
    const s = tradeStats([trade(-10)]);
    expect(s.winRate).toBe(0);
    expect(s.profitFactor).toBe(0);
    expect(s.rewardRisk).toBe(0);
  });

  it('tracks max consecutive wins and losses', () => {
    const s = tradeStats([10, 10, 10, -1, -1, 0, -1, 5].map((p) => trade(p)));
    expect(s.maxConsecutiveWins).toBe(3);
    expect(s.maxConsecutiveLosses).toBe(2);
  });
});

describe('initial risk on closed trades', () => {
  const ids = (() => { let i = 0; return (p: string) => `${p}${i++}`; })();
  const order = (o: Partial<Order>): Order => ({
    id: ids('o'), symbol: 'XAUUSD', side: 'buy', type: 'market', qty: 0.01, status: 'pending', createdAt: 0, contractSize: 100, ...o,
  } as Order);

  it('uses the SL at fill, not a later moved SL', () => {
    let b = submitOrder(emptyBook(), order({ stopLoss: 4240 }), 4250, 0, ids).book;
    b = updateBrackets(b, b.positions[0].id, { stopLoss: 4250 });
    b = closePosition(b, b.positions[0].id, 4260, 1, ids).book;
    expect(b.closedTrades[0].realizedPnl).toBeCloseTo(10);
    expect(b.closedTrades[0].riskUsd).toBeCloseTo(10);
  });

  it('uses the first SL added after fill and leaves risk undefined without one', () => {
    let b = submitOrder(emptyBook(), order({}), 4250, 0, ids).book;
    b = updateBrackets(b, b.positions[0].id, { stopLoss: 4245 });
    b = closePosition(b, b.positions[0].id, 4260, 1, ids).book;
    expect(b.closedTrades[0].riskUsd).toBeCloseTo(5);

    b = submitOrder(b, order({}), 4250, 2, ids).book;
    b = closePosition(b, b.positions[0].id, 4240, 3, ids).book;
    expect(b.closedTrades[0].riskUsd).toBeUndefined();
  });
});

describe('balanceCurve', () => {
  it('starts at the initial balance with no trades', () => {
    const c = balanceCurve([], 1000);
    expect(c.points).toEqual([{ index: 0, time: null, balance: 1000, pnl: 0, drawdown: 0 }]);
    expect(c.maxDrawdown).toBe(0);
  });

  it('accumulates balance and tracks peak-to-trough drawdown', () => {
    const c = balanceCurve([trade(100), trade(-50), trade(-100), trade(300), trade(-20)], 1000);
    expect(c.points.map((p) => p.balance)).toEqual([1000, 1100, 1050, 950, 1250, 1230]);
    expect(c.points.map((p) => p.drawdown)).toEqual([0, 0, -50, -150, 0, -20]);
    expect(c.peak).toBe(1250);
    expect(c.maxDrawdown).toBe(-150);
    expect(c.maxDrawdownPct).toBeCloseTo((-150 / 1100) * 100);
  });
});
