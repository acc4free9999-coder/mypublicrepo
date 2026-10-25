import { useEffect, useMemo, useState } from 'react';
import { getAggregated, visibleCandles } from '@/data/aggregate';
import { ema, rsi } from '@/indicators';
import type { PineDrawing, PinePlot, PineResult } from '@/pine/runtime';
import type { PineChartDrawing } from '@/pine/PineDrawingsPrimitive';
import { usePineStore } from '@/store/usePineStore';
import { useTradingStore } from '@/store/useTradingStore';

const EMPTY_PINE_RESULT = Object.assign([], { drawings: [] }) as PineResult;

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
  const pineInputs = usePineStore((s) => s.inputValues[s.selectedScriptId]);

  const candles = useMemo(() => visibleCandles(base, timeframe, cursor, baseTf), [base, timeframe, cursor, baseTf]);
  // Drawing anchors need the complete trading calendar, not estimated times after the replay cutoff.
  const drawingTimes = useMemo(() => getAggregated(base, timeframe, baseTf).map(({ time }) => ({ time })), [base, timeframe, baseTf]);
  const emaData = useMemo(() => (emaCfg.enabled ? ema(candles, emaCfg.period) : []), [candles, emaCfg]);

  const rsiData = useMemo(() => (rsiCfg.enabled ? rsi(candles, rsiCfg.period) : []), [candles, rsiCfg]);
  const [pineResult, setPineResult] = useState<PineResult>(EMPTY_PINE_RESULT);
  useEffect(() => {
    if (!pineSource) {
      setPineResult(EMPTY_PINE_RESULT);
      return;
    }
    const { setFailed, setProgress, setReady } = usePineStore.getState();
    const worker = new Worker(new URL('../pine/pineWorker.ts', import.meta.url), { type: 'module' });
    let current = true;
    worker.onmessage = ({ data }: MessageEvent<
      | { type: 'progress'; progress: { completedBars: number; totalBars: number } }
      | { type: 'result'; plots: PinePlot[]; drawings: PineDrawing[] }
      | { type: 'error'; message: string }
    >) => {
      if (!current) return;
      if (data.type === 'progress') {
        setProgress(data.progress);
      } else if (data.type === 'error') {
        setFailed(data.message);
        setPineResult(EMPTY_PINE_RESULT);
        worker.terminate();
      } else {
        const result = Object.assign(data.plots, { drawings: data.drawings }) as PineResult;
        setPineResult(result);
        setReady();
        worker.terminate();
      }
    };
    worker.onerror = (event) => {
      if (!current) return;
      setFailed(event.message || 'Pine worker failed.');
      setPineResult(EMPTY_PINE_RESULT);
      worker.terminate();
    };
    worker.postMessage({ source: pineSource, candles, inputs: pineInputs });
    return () => {
      current = false;
      worker.terminate();
    };
  }, [candles, pineSource, pineInputs]);
  const pinePlots = pineResult;
  const pineDrawings = useMemo<PineChartDrawing[]>(() => {
    if (!('drawings' in pineResult)) return [];
    const toTime = (x: number, xloc: string): number => {
      if (xloc === 'bar_time') return x;
      const whole = Math.trunc(x);
      const fraction = x - whole;
      if (whole >= 0 && whole < candles.length) {
        const time = candles[whole].time;
        const next = candles[whole + 1]?.time ?? (time + (time - (candles[whole - 1]?.time ?? time - 1)));
        return time + (next - time) * fraction;
      }
      if (whole < 0) {
        const first = candles[0]?.time ?? 0;
        const step = (candles[1]?.time ?? first + 1) - first;
        return first + x * step;
      }
      const last = candles[candles.length - 1]?.time ?? 0;
      const step = last - (candles[candles.length - 2]?.time ?? last - 1);
      return last + (x - (candles.length - 1)) * step;
    };
    return pineResult.drawings.map((drawing) => drawing.kind === 'line'
      ? {
          id: String(drawing.id),
          kind: 'line',
          x1: toTime(drawing.x1, drawing.xloc),
          x2: toTime(drawing.x2, drawing.xloc),
          y1: drawing.y1,
          y2: drawing.y2,
          color: drawing.color,
          width: drawing.width,
          style: drawing.style === 'dashed' || drawing.style === 'dotted' ? drawing.style : 'solid',
          extend: drawing.extend === 'left' || drawing.extend === 'right' || drawing.extend === 'both' ? drawing.extend : 'none',
        }
      : {
          id: String(drawing.id),
          kind: 'box',
          x1: toTime(drawing.left, drawing.xloc),
          x2: toTime(drawing.right, drawing.xloc),
          y1: drawing.top,
          y2: drawing.bottom,
          color: drawing.borderColor,
          width: drawing.borderWidth,
          style: drawing.borderStyle === 'dashed' || drawing.borderStyle === 'dotted' ? drawing.borderStyle : 'solid',
          fillColor: drawing.bgcolor === 'transparent' ? undefined : drawing.bgcolor,
          text: drawing.text,
          textColor: drawing.textColor,
          extend: drawing.extend === 'left' || drawing.extend === 'right' || drawing.extend === 'both' ? drawing.extend : 'none',
        });
  }, [pineResult, candles]);

  return { candles, drawingTimes, emaData, rsiData, pinePlots, pineDrawings };
}
