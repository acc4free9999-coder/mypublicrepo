import type { Candle, LinePoint } from '@/types';

/** Exponential Moving Average, seeded with the SMA of the first `period` closes. */
export function ema(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  if (period < 1 || candles.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += candles[i].close;
  let prev = seed / period;
  out.push({ time: candles[period - 1].time, value: prev });
  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k);
    out.push({ time: candles[i].time, value: prev });
  }
  return out;
}
