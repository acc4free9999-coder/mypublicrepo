import { describe, expect, it } from 'vitest';
import { dailyTotal, daysInMonth, monthStats, numericTrades } from './trading';

describe('trading calculations', () => {
  it('counts explicit zero as a trade, but excludes blanks and invalid values', () => {
    expect(numericTrades({ trades: ['', ' ', '0', '2.5', '-1', 'invalid'], notes: '' })).toEqual([0, 2.5, -1]);
    expect(dailyTotal({ trades: ['2.5', '-1', ''], notes: '' })).toBe(1.5);
  });
  it('excludes breakeven trades from win rate and non-trading days from statistics', () => {
    const stats = monthStats({ '01': { trades: ['2', '-1', '0'], notes: '' }, '02': { trades: ['', ''], notes: '' }, '03': { trades: ['-2'], notes: '' } });
    expect(stats).toMatchObject({ tradingDays: 2, totalTrades: 4, wins: 1, losses: 2, net: -1, averageWin: 2, averageLoss: -1.5, profitableDays: 1, losingDays: 1 });
    expect(stats.winRate).toBeCloseTo(100 / 3);
    expect(stats.best?.total).toBe(1);
    expect(stats.worst?.total).toBe(-2);
  });
  it('handles empty months and leap years', () => {
    expect(monthStats({})).toMatchObject({ net: 0, winRate: 0, best: null, worst: null });
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(daysInMonth(2026, 1)).toBe(28);
  });
});