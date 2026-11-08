import { describe, expect, it } from 'vitest';
import { defaultSimulation, simulateTrades } from './simulation';

describe('random trade simulation', () => {
  it('generates configured wins within the winning range', () => {
    const result = simulateTrades({ ...defaultSimulation, tradeCount: 3, winRate: 100 }, {}, () => 0.5);
    expect(result.trades.map(trade => trade.result)).toEqual([2, 2, 2]);
    expect(result).toMatchObject({ net: 6, wins: 3, losses: 0, winRate: 100, maxDrawdown: 0 });
  });
  it('applies losses as negative RR and measures drawdown from the starting equity', () => {
    const result = simulateTrades({ ...defaultSimulation, tradeCount: 3, winRate: 0 }, {}, () => 0.5);
    expect(result.trades.map(trade => trade.cumulative)).toEqual([-1, -2, -3]);
    expect(result).toMatchObject({ net: -3, wins: 0, losses: 3, winRate: 0, maxDrawdown: 3 });
  });
  it('honors individual signed ranges and excludes breakevens from observed win rate', () => {
    const result = simulateTrades({ ...defaultSimulation, tradeCount: 4 }, { 0: { minRR: 3, maxRR: 3 }, 1: { minRR: -2, maxRR: -2 }, 2: { minRR: 0, maxRR: 0 }, 3: { minRR: -1, maxRR: 1 } }, () => 0.5);
    expect(result.trades.map(trade => trade.result)).toEqual([3, -2, 0, 0]);
    expect(result).toMatchObject({ net: 1, wins: 1, losses: 1, breakevens: 2, winRate: 50, maxDrawdown: 2 });
  });
  it('handles a recovery and draws down from the high-water mark', () => {
    const result = simulateTrades({ ...defaultSimulation, tradeCount: 4 }, { 0: { minRR: 2, maxRR: 2 }, 1: { minRR: -1, maxRR: -1 }, 2: { minRR: 4, maxRR: 4 }, 3: { minRR: -3, maxRR: -3 } }, () => 0);
    expect(result.trades.map(trade => trade.drawdown)).toEqual([0, 1, 0, 3]);
    expect(result.maxDrawdown).toBe(3);
  });
  it('rejects invalid counts, probabilities, and reversed or nonfinite ranges', () => {
    for (const config of [{ tradeCount: 0 }, { tradeCount: 1001 }, { tradeCount: 2.5 }, { winRate: 101 }, { minWinRR: 4, maxWinRR: 2 }, { minLossRR: 0 }, { maxWinRR: Infinity }]) {
      expect(() => simulateTrades({ ...defaultSimulation, ...config })).toThrow();
    }
    expect(() => simulateTrades(defaultSimulation, { 0: { minRR: 2, maxRR: -1 } })).toThrow('Trade 1');
    expect(() => simulateTrades(defaultSimulation, { 100: { minRR: -1, maxRR: 2 } })).toThrow('outside');
  });
  it('keeps every sampled value within its specified range', () => {
    const result = simulateTrades({ ...defaultSimulation, tradeCount: 1000 }, {}, Math.random);
    for (const trade of result.trades) expect(trade.result > 0 ? trade.result >= 1 && trade.result <= 3 : trade.result === -1).toBe(true);
    expect(result.trades).toHaveLength(1000);
  });
});