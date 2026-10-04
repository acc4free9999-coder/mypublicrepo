import { describe, expect, it } from 'vitest';
import { guessSymbol, ImportError, mergeCandles, parseBarsFile, parseDateTime } from '@/data/fileImport';

const T = (iso: string) => Date.parse(iso) / 1000;

describe('parseBarsFile', () => {
  it('reads an MT5 Bars export (tab separated, <DATE> <TIME>, tick volume)', () => {
    const txt = [
      '<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\t<VOL>\t<SPREAD>',
      '2026.09.25\t20:30:00\t4250.10\t4255.00\t4249.00\t4252.30\t812\t0\t12',
      '2026.09.25\t20:45:00\t4252.30\t4260.00\t4251.00\t4258.80\t901\t0\t12',
      '2026.09.25\t21:00:00\t4258.80\t4259.00\t4240.00\t4241.10\t1400\t0\t12',
    ].join('\r\n');
    const r = parseBarsFile(txt);
    expect(r.format).toBe('MT5');
    expect(r.timeframe).toBe('15m');
    expect(r.candles).toHaveLength(3);
    expect(r.candles[0]).toEqual({ time: T('2026-09-25T20:30:00Z'), open: 4250.1, high: 4255, low: 4249, close: 4252.3, volume: 812 });
  });

  it('applies the server time zone to naive intraday timestamps only', () => {
    const txt = '<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\n2026.09.25\t03:00:00\t1\t2\t0.5\t1.5\t10\n2026.09.25\t04:00:00\t1.5\t2\t1\t1.2\t10\n2026.09.25\t05:00:00\t1.2\t2\t1\t1.1\t10';
    const r = parseBarsFile(txt, { tzOffsetMinutes: 180 });
    expect(r.timeframe).toBe('1h');
    expect(r.candles[0].time).toBe(T('2026-09-25T00:00:00Z'));

    const daily = '<DATE>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\n2026.09.23\t1\t2\t0.5\t1.5\t10\n2026.09.24\t1\t2\t0.5\t1.5\t10\n2026.09.25\t1\t2\t0.5\t1.5\t10';
    const d = parseBarsFile(daily, { tzOffsetMinutes: 180 });
    expect(d.timeframe).toBe('1d');
    expect(d.candles[0].time).toBe(T('2026-09-23T00:00:00Z'));
  });

  it('reads an MT4 History Center export without header', () => {
    const txt = '2026.09.25,20:00,1.17010,1.17100,1.16900,1.17050,1200\n2026.09.25,21:00,1.17050,1.17200,1.17000,1.17150,900\n2026.09.25,22:00,1.17150,1.17160,1.17010,1.17020,700\n';
    const r = parseBarsFile(txt);
    expect(r.format).toBe('MT4');
    expect(r.timeframe).toBe('1h');
    expect(r.candles[2].close).toBe(1.1702);
  });

  it('reads TradingView / GonyExportBars CSV with unix seconds', () => {
    const t0 = T('2026-09-21T00:00:00Z');
    const txt = `time,open,high,low,close,Volume\n${t0},10,12,9,11,5\n${t0 + 14400},11,13,10,12,6\n${t0 + 28800},12,14,11,13,7`;
    const r = parseBarsFile(txt, { tzOffsetMinutes: 180 });
    expect(r.format).toBe('TradingView');
    expect(r.timeframe).toBe('4h');
    expect(r.candles[0].time).toBe(t0); // unix time is never shifted
  });

  it('reads Dukascopy (Gmt time, DD.MM.YYYY)', () => {
    const txt = 'Gmt time,Open,High,Low,Close,Volume\n21.09.2026 00:00:00.000,1.1,1.2,1.0,1.15,100\n22.09.2026 00:00:00.000,1.15,1.2,1.1,1.18,100\n23.09.2026 00:00:00.000,1.18,1.3,1.1,1.25,100';
    const r = parseBarsFile(txt);
    expect(r.format).toBe('Dukascopy');
    expect(r.timeframe).toBe('1d');
    expect(r.candles[1].time).toBe(T('2026-09-22T00:00:00Z'));
  });

  it('preserves native Binance 5m bars and aggregates only when requested', () => {
    const t0 = T('2026-09-25T00:00:00Z') * 1000;
    const rows = Array.from({ length: 6 }, (_, i) => `${t0 + i * 300_000},${100 + i},${102 + i},${99 + i},${101 + i},10,${t0 + i * 300_000 + 299_999},1000,5,5,500,0`);
    const r = parseBarsFile(rows.join('\n'));
    expect(r.format).toBe('Binance');
    expect(r.timeframe).toBe('5m');
    expect(r.aggregatedFrom).toBeUndefined();
    expect(r.candles).toHaveLength(6);
    expect(r.candles[0]).toMatchObject({ open: 100, high: 102, low: 99, close: 101, volume: 10 });
    const aggregated = parseBarsFile(rows.join('\n'), { timeframe: '15m' });
    expect(aggregated.candles).toHaveLength(2);
    expect(aggregated.candles[0]).toMatchObject({ open: 100, high: 104, low: 99, close: 103, volume: 30 });
  });

  it('detects MT5 M5 exports and aggregates one-minute input into 5m', () => {
    const header = '<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>';
    const rows = ['00:00:00', '00:05:00', '00:10:00'].map((time) =>
      `2026.09.25\t${time}\t4250\t4255\t4249\t4252\t100`);
    const native = parseBarsFile([header, ...rows].join('\n'));
    expect(native.timeframe).toBe('5m');
    expect(native.candles).toHaveLength(3);
    expect(native.candles[1].time - native.candles[0].time).toBe(300);
    const t0 = T('2026-09-25T00:00:00Z');
    const minutes = 'time,open,high,low,close,volume\n' +
      Array.from({ length: 10 }, (_, i) => `${t0 + i * 60},10,12,9,11,1`).join('\n');
    const aggregated = parseBarsFile(minutes);
    expect(aggregated.timeframe).toBe('5m');
    expect(aggregated.candles).toHaveLength(2);
    expect(aggregated.candles[0].volume).toBe(5);
  });

  it('handles semicolon files with decimal commas, ISO dates and header aliases', () => {
    const txt = 'Date;Open;High;Low;Close\n2026-09-01;4000,5;4010;3990;4005,25\n2026-09-02;4005,25;4020;4000;4015\n2026-09-03;4015;4030;4010;4020';
    const r = parseBarsFile(txt);
    expect(r.candles[0]).toMatchObject({ open: 4000.5, close: 4005.25, volume: 0 });
  });

  it('detects monthly bars and honours a coarser timeframe override', () => {
    const months = ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01'];
    const txt = 'date,open,high,low,close\n' + months.map((d) => `${d},1,2,0.5,1.5`).join('\n');
    expect(parseBarsFile(txt).timeframe).toBe('1M');

    const hours = 'time,open,high,low,close\n' + Array.from({ length: 8 }, (_, i) => `2026-09-25T${String(i).padStart(2, '0')}:00:00Z,1,2,0.5,1.5`).join('\n');
    const r = parseBarsFile(hours, { timeframe: '4h' });
    expect(r.timeframe).toBe('4h');
    expect(r.candles).toHaveLength(2);
    expect(() => parseBarsFile(hours, { timeframe: '15m' })).toThrow(ImportError);
  });

  it('sorts, de-duplicates and repairs high/low', () => {
    const txt = 'time,open,high,low,close\n2026-09-25 02:00,5,6,4,5\n2026-09-25 00:00,1,1,1,3\n2026-09-25 01:00,3,4,2,3\n2026-09-25 01:00,3,4.5,2,3.5\nbad,row,,,';
    const r = parseBarsFile(txt);
    expect(r.candles.map((c) => c.close)).toEqual([3, 3.5, 5]);
    expect(r.candles[0].high).toBe(3);
    expect(r.skipped).toBe(1);
  });

  it('reports missing columns', () => {
    expect(() => parseBarsFile('foo,bar\n1,2\n3,4')).toThrow(/Couldn't find column/);
  });
});

describe('helpers', () => {
  it('parseDateTime decides day/month order', () => {
    expect(parseDateTime('09/25/2026', '', false)?.t).toBe(T('2026-09-25T00:00:00Z'));
    expect(parseDateTime('25/09/2026')?.t).toBe(T('2026-09-25T00:00:00Z'));
    expect(parseDateTime('2026-09-25T10:00:00+02:00')).toEqual({ t: T('2026-09-25T08:00:00Z'), naive: false });
    expect(parseDateTime('20260925')?.t).toBe(T('2026-09-25T00:00:00Z'));
  });

  it('guessSymbol maps broker names', () => {
    expect(guessSymbol('XAUUSDm_M15_202401020000_202609251200.csv')).toBe('XAUUSD');
    expect(guessSymbol('OANDA_XAUUSD, 60.csv')).toBe('XAUUSD');
    expect(guessSymbol('GOLD_H1.csv')).toBe('XAUUSD');
    expect(guessSymbol('BTCUSDT-15m-2026-09.csv')).toBe('BTCUSD');
    expect(guessSymbol('US500_D1.csv')).toBe('SPX');
    expect(guessSymbol('data.csv')).toBeNull();
  });

  it('mergeCandles keeps incoming bars on overlap', () => {
    const a = [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 0 }, { time: 2, open: 2, high: 2, low: 2, close: 2, volume: 0 }];
    const b = [{ time: 2, open: 9, high: 9, low: 9, close: 9, volume: 0 }, { time: 3, open: 3, high: 3, low: 3, close: 3, volume: 0 }];
    expect(mergeCandles(a, b).map((c) => c.close)).toEqual([1, 9, 3]);
  });
});
