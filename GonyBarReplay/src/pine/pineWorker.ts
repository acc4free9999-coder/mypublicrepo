import type { Candle } from '@/types';
import { runPineScript, type PinePlot, type PineDrawing, type PineInputValue, type PineProgress } from './runtime';

type Request = { source: string; candles: Candle[]; inputs?: Record<string, PineInputValue> };
type Response =
  | { type: 'progress'; progress: PineProgress }
  | { type: 'result'; plots: PinePlot[]; drawings: PineDrawing[] }
  | { type: 'error'; message: string };

self.onmessage = ({ data }: MessageEvent<Request>) => {
  try {
    const result = runPineScript(data.source, data.candles, (progress) => {
      const response: Response = { type: 'progress', progress };
      self.postMessage(response);
    }, data.inputs);
    const response: Response = { type: 'result', plots: [...result], drawings: result.drawings };
    self.postMessage(response);
  } catch (cause) {
    const response: Response = { type: 'error', message: cause instanceof Error ? cause.message : String(cause) };
    self.postMessage(response);
  }
};
