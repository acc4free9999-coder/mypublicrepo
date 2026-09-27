import { describe, expect, it } from 'vitest';
import { ema } from '@/indicators';
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
});
