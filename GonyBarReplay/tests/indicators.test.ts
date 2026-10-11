import { describe, expect, it } from 'vitest';
import { ema, rsi } from '@/indicators';
import type { Candle } from '@/types';

const c = (closes: number[]): Candle[] => closes.map((close, i) => ({ time: i, open: close, high: close, low: close, close, volume: 0 }));

describe('indicators', () => {
  it('EMA seeds with SMA then smooths', () => {
    const v = ema(c([1, 2, 3, 4]), 3).map((p) => p.value);
    expect(v[0]).toBe(2);
    expect(v[1]).toBeCloseTo(3); // 4*0.5 + 2*0.5
  });
  it('EMA is empty when there are fewer candles than the period', () => {
    expect(ema(c([1, 2]), 3)).toEqual([]);
  });
  it('RSI uses Wilder smoothing and starts at bar `period`', () => {
    const out = rsi(c([1, 2, 3, 2, 3]), 2);
    expect(out.map((p) => p.time)).toEqual([2, 3, 4]);
    expect(out.map((p) => p.value)).toEqual([100, 50, 75]);
  });
  it('RSI is 50 on a flat series and 0 when price only falls', () => {
    expect(rsi(c([5, 5, 5, 5]), 2).map((p) => p.value)).toEqual([50, 50]);
    expect(rsi(c([5, 4, 3, 2]), 2).map((p) => p.value)).toEqual([0, 0]);
  });
  it('RSI never looks ahead: a prefix gives the same values', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 5 + i * 0.1);
    const all = rsi(c(closes), 14);
    expect(rsi(c(closes.slice(0, 40)), 14)).toEqual(all.slice(0, 40 - 14));
  });
  it('RSI is empty without enough bars', () => {
    expect(rsi(c([1, 2]), 2)).toEqual([]);
  });
});
