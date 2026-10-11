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

/** Relative Strength Index with Wilder's smoothing (TradingView's `ta.rsi`). First value at bar `period`. */
export function rsi(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  if (period < 1 || candles.length <= period) return out;
  const value = (gain: number, loss: number) => (loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss));
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out.push({ time: candles[period].time, value: value(gain, loss) });
  for (let i = period + 1; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out.push({ time: candles[i].time, value: value(gain, loss) });
  }
  return out;
}
