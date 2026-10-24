import { describe, expect, it } from 'vitest';
import { runPineScript } from '@/pine/runtime';
import type { Candle } from '@/types';

const candles = (closes: number[]): Candle[] => closes.map((close, i) => ({
  time: i,
  open: close - 1,
  high: close + 1,
  low: close - 2,
  close,
  volume: i * 10,
}));

describe('Pine indicator runtime', () => {
  it('plots a named EMA with the requested color', () => {
    const plots = runPineScript(
      '//@version=5\nindicator("EMA")\nplot(ta.ema(close, 3), title="Trend", color=color.orange)',
      candles([1, 2, 3, 4]),
    );
    expect(plots).toHaveLength(1);
    expect(plots[0].title).toBe('Trend');
    expect(plots[0].color).toBe('#ff9800');
    expect(plots[0].points.map((point) => point.value)).toEqual([2, 3]);
  });

  it('parses multiline declarations and plot options without treating string comments as code comments', () => {
    const plots = runPineScript(
      'indicator(\n  "Test",\n  overlay=true\n)\nplot(\n  close,\n  title="close // price",\n  color=color.blue,\n  linewidth=3\n)',
      candles([2]),
    );
    expect(plots[0]).toMatchObject({ title: 'close // price', color: '#2196f3', lineWidth: 3 });
  });

  it('accepts single-quoted Pine strings and ignores comment markers inside them', () => {
    const plots = runPineScript(
      `indicator('Test indicator')
plot(close, title='Close // price', color=color.blue)`,
      candles([2]),
    );
    expect(plots[0]).toMatchObject({ title: 'Close // price', color: '#2196f3' });
  });

  it('supports variables, arithmetic, history offsets, and RSI', () => {
    const plots = runPineScript(
      '//@version=6\nlength = input.int(2, title="Length")\nprev = close[1]\nplot(ta.rsi(close, length) + (close - prev), title="Combined")',
      candles([1, 2, 3, 2]),
    );
    expect(plots[0].points.map((point) => point.value)).toEqual([101, 49]);
  });

  it('parses Pine input option arrays, hex colors, comparisons, and ternary plots', () => {
    const plots = runPineScript(
      `len = input.int(2, 'Swings', minval=1, group='Settings')
opt = input.string('Only Wicks', 'Options', options=['Only Wicks', 'Only Breaks'], group='Settings')
col = input.color(#089981, 'Bull')
isWick = opt == 'Only Wicks'
plot(isWick ? ta.sma(close, len) : na, title='Swing', color=col)`,
      candles([2, 4, 6]),
    );
    expect(plots[0]).toMatchObject({ title: 'Swing', color: '#089981' });
    expect(plots[0].points.map((point) => point.value)).toEqual([3, 5]);
  });

  it('gets past the Liquidity Sweeps settings syntax and reports its next unsupported feature', () => {
    expect(() => runPineScript(
      `len = input.int(5, 'Swings', minval=1, group='Liquidity Sweeps')
opt = input.string('Only Wicks', 'options', options=['Only Wicks', 'Only Outbreaks & Retest', 'Wicks + Outbreaks & Retest'])
colBl = input.color(#089981, 'Bull')
extend = input.bool(true, 'Extend')
oW = opt == 'Only Wicks'
type piv
  float prc`,
      candles([2]),
    )).toThrow('type declarations and control flow are not supported');
  });

  it('omits undefined warmup values and updates only with the provided bars', () => {
    const source = 'plot(ta.sma(close, 3))';
    const all = runPineScript(source, candles([2, 4, 6, 8]));
    const prefix = runPineScript(source, candles([2, 4, 6]));
    expect(all[0].points.map((point) => point.value)).toEqual([4, 6]);
    expect(prefix[0].points).toEqual(all[0].points.slice(0, 1));
  });

  it('rejects scripts outside the supported subset with actionable errors', () => {
    expect(() => runPineScript('plot(close > open)', candles([1]))).toThrow('plot() requires a numeric series');
    expect(() => runPineScript('plot(ta.macd(close, 12, 26, 9))', candles([1]))).toThrow('unsupported function');
    expect(() => runPineScript('//@version=4\nplot(close)', candles([1]))).toThrow('versions 5 and 6');
    expect(() => runPineScript('strategy("Test")\nplot(close)', candles([1]))).toThrow('strategy scripts are not supported');
    expect(() => runPineScript('type pivot\n  float price\nplot(close)', candles([1]))).toThrow('type declarations and control flow are not supported');
  });
});
