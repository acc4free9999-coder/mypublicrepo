import { useMemo } from 'react';
import { getAggregated, visibleCandles } from '@/data/aggregate';
import { ema, rsi } from '@/indicators';
import { compilePineScript } from '@/pine/runtime';
import { usePineStore } from '@/store/usePineStore';
import { useTradingStore } from '@/store/useTradingStore';

/** Candles + indicators visible at the current replay cursor (no look-ahead). */
export function useChartData() {
  const base = useTradingStore((s) => s.base);
  const baseTf = useTradingStore((s) => s.baseTf);
  const timeframe = useTradingStore((s) => s.timeframe);
  // While picking a new cutoff the whole history is shown (TradingView behaviour).
  const cursor = useTradingStore((s) => (s.replay.status === 'selecting' ? s.base.length - 1 : s.replay.cursor));
  const emaCfg = useTradingStore((s) => s.indicators.ema);
  const rsiCfg = useTradingStore((s) => s.indicators.rsi);
  const pineSource = usePineStore((s) => s.activeSource);

  const candles = useMemo(() => visibleCandles(base, timeframe, cursor, baseTf), [base, timeframe, cursor, baseTf]);
  // Drawing anchors need the complete trading calendar, not estimated times after the replay cutoff.
  const drawingTimes = useMemo(() => getAggregated(base, timeframe, baseTf).map(({ time }) => ({ time })), [base, timeframe, baseTf]);
  const emaData = useMemo(() => (emaCfg.enabled ? ema(candles, emaCfg.period) : []), [candles, emaCfg]);

  const rsiData = useMemo(() => (rsiCfg.enabled ? rsi(candles, rsiCfg.period) : []), [candles, rsiCfg]);
  const pineEvaluator = useMemo(() => (pineSource ? compilePineScript(pineSource) : null), [pineSource]);
  const pinePlots = useMemo(() => (pineEvaluator ? pineEvaluator(candles) : []), [candles, pineEvaluator]);

  return { candles, drawingTimes, emaData, rsiData, pinePlots };
}
