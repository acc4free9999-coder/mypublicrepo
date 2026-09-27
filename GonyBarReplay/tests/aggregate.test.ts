import { describe, expect, it } from 'vitest';
import { aggregate, bucketStart, nextBucketStart, nextCandleEndIndex, visibleCandles } from '@/data/aggregate';
import type { Candle } from '@/types';

const M15 = 900;
// 12 × 15m bars = 3 hours starting 2026-01-05 00:00 UTC (a Monday).
const T0 = Date.UTC(2026, 0, 5) / 1000;
const base: Candle[] = Array.from({ length: 12 }, (_, i) => ({ time: T0 + i * M15, open: i, high: i + 0.5, low: i - 0.5, close: i + 0.25, volume: 1 }));

const utc = (y: number, m: number, d: number, h = 0) => Date.UTC(y, m, d, h) / 1000;

describe('aggregation & replay visibility', () => {
  it('aggregates 15m into 1h buckets', () => {
    const agg = aggregate(base, '1h');
    expect(agg).toHaveLength(3);
    expect(agg[1]).toMatchObject({ time: T0 + 3600, open: 4, high: 7.5, low: 3.5, close: 7.25, volume: 4 });
  });

  it('never leaks future bars into the partial candle', () => {
    const vis = visibleCandles(base, '1h', 5); // cursor mid-way through bucket [4..7]
    expect(vis).toHaveLength(2);
    expect(vis[1]).toMatchObject({ time: T0 + 3600, open: 4, high: 5.5, close: 5.25, volume: 2 });
  });

  it('steps forward exactly one chart candle', () => {
    expect(nextCandleEndIndex(base, '1h', 3)).toBe(7);
    expect(nextCandleEndIndex(base, '1h', 5)).toBe(7); // completes the partial bucket first
    expect(nextCandleEndIndex(base, '1h', 10)).toBe(11);
  });

  it('aligns 4h buckets to UTC midnight', () => {
    expect(bucketStart(utc(2026, 8, 25, 5), '4h')).toBe(utc(2026, 8, 25, 4));
    expect(nextBucketStart(utc(2026, 8, 25, 20), '4h')).toBe(utc(2026, 8, 26));
  });

  it('starts weekly candles on Monday', () => {
    // 2026-09-27 is a Sunday → week of Monday 2026-09-21.
    expect(bucketStart(utc(2026, 8, 27, 23), '1w')).toBe(utc(2026, 8, 21));
    expect(bucketStart(utc(2026, 8, 21), '1w')).toBe(utc(2026, 8, 21));
    expect(nextBucketStart(utc(2026, 8, 21), '1w')).toBe(utc(2026, 8, 28));
  });

  it('uses calendar months for monthly candles', () => {
    expect(bucketStart(utc(2026, 1, 28, 13), '1M')).toBe(utc(2026, 1, 1));
    expect(nextBucketStart(utc(2026, 1, 1), '1M')).toBe(utc(2026, 2, 1));
    expect(nextBucketStart(utc(2026, 11, 1), '1M')).toBe(utc(2027, 0, 1));
  });
});
