import { useMemo } from 'react';
import { visibleCandles } from '@/data/aggregate';
import { ema } from '@/indicators';
import { useTradingStore } from '@/store/useTradingStore';

/** Candles + indicators visible at the current replay cursor (no look-ahead). */
export function useChartData() {
  const base = useTradingStore((s) => s.base);
  const baseTf = useTradingStore((s) => s.baseTf);
  const timeframe = useTradingStore((s) => s.timeframe);
  // While picking a new cutoff the whole history is shown (TradingView behaviour).
  const cursor = useTradingStore((s) => (s.replay.status === 'selecting' ? s.base.length - 1 : s.replay.cursor));
  const emaCfg = useTradingStore((s) => s.indicators.ema);

  const candles = useMemo(() => visibleCandles(base, timeframe, cursor, baseTf), [base, timeframe, cursor, baseTf]);
  const emaData = useMemo(() => (emaCfg.enabled ? ema(candles, emaCfg.period) : []), [candles, emaCfg]);

  return { candles, emaData };
}
