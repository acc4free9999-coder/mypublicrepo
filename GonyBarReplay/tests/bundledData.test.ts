import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BUNDLED_SOURCE, parseBundled, withBundled } from '@/data/bundledData';
import { parseBarsFile } from '@/data/fileImport';
import type { Candle } from '@/types';

const H = '<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\t<VOL>\t<SPREAD>';
const h1 = [H, '2026.09.25\t18:00:00\t4280\t4290\t4275\t4285\t100\t0\t160', '2026.09.25\t19:00:00\t4285\t4295\t4280\t4290\t120\t0\t160', '2026.09.25\t20:00:00\t4290\t4292\t4284\t4286\t90\t0\t160'].join('\n');
const W = '<DATE>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\t<VOL>\t<SPREAD>';
const weekly = [W, '2026.09.06\t1\t2\t0.5\t1.5\t10\t0\t0', '2026.09.13\t1.5\t2\t1\t1.8\t10\t0\t0', '2026.09.20\t1.8\t2.2\t1.6\t2\t10\t0\t0'].join('\n');
const bar = (time: number, close: number): Candle => ({ time, open: close, high: close, low: close, close, volume: 0 });

describe('built-in MT5 data', () => {
  it('loads the actual bundled M5 history without dropping or aggregating bars', () => {
    const name = 'XAUUSDm_M5_202601012305_202609250045.csv';
    const text = readFileSync(new URL(`../mt5/Mt5Data/${name}`, import.meta.url), 'utf8');
    const parsed = parseBarsFile(text);
    expect(parsed.skipped).toBe(0);
    expect(parsed.timeframe).toBe('5m');
    const d = parseBundled([{ name, text }]);
    const candles = d.XAUUSD.series['5m']!;
    expect(candles).toHaveLength(51970);
    expect(candles[0].time).toBe(Date.UTC(2026, 0, 1, 23, 5) / 1000);
    expect(candles[candles.length - 1]).toMatchObject({
      time: Date.UTC(2026, 8, 25, 0, 45) / 1000, close: 4273.167, volume: 832,
    });
  });
  it('loads M5 exports as native 5m data', () => {
    const text = [H,
      '2026.09.25\t18:00:00\t4280\t4290\t4275\t4285\t100\t0\t160',
      '2026.09.25\t18:05:00\t4285\t4295\t4280\t4290\t120\t0\t160',
      '2026.09.25\t18:10:00\t4290\t4292\t4284\t4286\t90\t0\t160',
    ].join('\n');
    const d = parseBundled([{ name: 'mt5/XAUUSDm_M5.csv', text }]);
    expect(d.XAUUSD.series['5m']).toHaveLength(3);
    expect(d.XAUUSD.sources?.['5m']).toContain('XAUUSDm_M5.csv');
  });
  it('parses files by symbol and timeframe from the file name', () => {
    const d = parseBundled([
      { name: 'mt5/XAUUSDm_H1_202609251800_202609252000.csv', text: h1 },
      { name: 'mt5/unknown.csv', text: h1 },
      { name: 'mt5/EURUSD_H1.csv', text: 'garbage' },
    ]);
    expect(Object.keys(d)).toEqual(['XAUUSD']);
    expect(d.XAUUSD.series['1h']).toHaveLength(3);
    expect(d.XAUUSD.series['1h']![0].time).toBe(Date.UTC(2026, 8, 25, 18) / 1000);
    expect(d.XAUUSD.sources!['1h']).toBe(`${BUNDLED_SOURCE} · XAUUSDm_H1_202609251800_202609252000.csv`);
  });

  it('snaps MT5 Sunday-labelled weekly bars to Monday', () => {
    const { candles, timeframe } = parseBarsFile(weekly);
    expect(timeframe).toBe('1w');
    expect(candles.map((c) => new Date(c.time * 1000).getUTCDay())).toEqual([1, 1, 1]);
    expect(candles[2].time).toBe(Date.UTC(2026, 8, 21) / 1000);
  });

  it('layers saved bars over built-in bars (saved wins on overlap)', () => {
    const b = { symbol: 'XAUUSD', fetchedAt: 1, series: { '1h': [bar(1, 10), bar(2, 20)], '1d': [bar(5, 5)] }, sources: { '1h': `${BUNDLED_SOURCE} · a`, '1d': `${BUNDLED_SOURCE} · b` } };
    const s = { symbol: 'XAUUSD', fetchedAt: 2, series: { '1h': [bar(2, 21), bar(3, 30)] }, sources: { '1h': 'Twelve Data' } };
    const m = withBundled(s, b)!;
    expect(m.series['1h']!.map((c) => c.close)).toEqual([10, 21, 30]);
    expect(m.series['1d']).toEqual(b.series['1d']);
    expect(m.sources!['1h']).toBe(`Twelve Data + ${BUNDLED_SOURCE}`);
    expect(m.fetchedAt).toBe(2);
    expect(withBundled(undefined, b)).toBe(b);
    expect(withBundled(s, undefined)).toBe(s);
  });
});
