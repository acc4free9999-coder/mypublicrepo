import { describe, expect, it } from 'vitest';
import { nextCandleEndIndex, visibleCandles } from '@/data/aggregate';
import { parseTdTime, parseTdValues } from '@/data/twelveData';
import { resolveBase, useTradingStore } from '@/store/useTradingStore';
import type { Candle } from '@/types';

const bar = (time: number, px = 100): Candle => ({ time, open: px, high: px + 1, low: px - 1, close: px, volume: 0 });

describe('Twelve Data parsing', () => {
  it('parses UTC datetimes and dates', () => {
    expect(parseTdTime('2026-09-25 20:45:00')).toBe(Date.UTC(2026, 8, 25, 20, 45) / 1000);
    expect(parseTdTime('2026-09-25')).toBe(Date.UTC(2026, 8, 25) / 1000);
  });

  it('sorts, de-duplicates, drops bad rows and defaults missing volume to 0', () => {
    const c = parseTdValues([
      { datetime: '2026-09-26', open: '2', high: '3', low: '1', close: '2.5' },
      { datetime: '2026-09-25', open: '1', high: '2', low: '0.5', close: '1.5', volume: '42' },
      { datetime: '2026-09-26', open: '9', high: '9', low: '9', close: '9' },
      { datetime: 'garbage', open: '1', high: '1', low: '1', close: '1' },
    ]);
    expect(c.map((x) => x.close)).toEqual([1.5, 2.5]);
    expect(c.map((x) => x.volume)).toEqual([42, 0]);
  });
});

describe('native base timeframe', () => {
  // 4h bars offset by 1h (as some feeds deliver them) must not be re-bucketed.
  const base = [0, 1, 2, 3].map((i) => bar(3600 + i * 14400, 100 + i));

  it('shows native bars 1:1 and steps one bar at a time', () => {
    expect(visibleCandles(base, '4h', 1, '4h').map((c) => c.time)).toEqual([base[0].time, base[1].time]);
    expect(nextCandleEndIndex(base, '4h', 1, '4h')).toBe(2);
  });
});

describe('resolveBase', () => {
  const series = { '1h': [bar(0), bar(3600), bar(7200)], '1d': [bar(0)] };
  const realData = { XAUUSD: { symbol: 'XAUUSD', fetchedAt: 1, series } };

  it('prefers the native timeframe, then the coarsest finer one, else no data', () => {
    expect(resolveBase(realData, 'XAUUSD', '1w').baseTf).toBe('1h');
    expect(resolveBase(realData, 'XAUUSD', '4h').baseTf).toBe('1h');
    expect(resolveBase(realData, 'XAUUSD', '15m').base).toEqual([]);
    expect(resolveBase(realData, 'EURUSD', '1h').base).toEqual([]);
  });
});

describe('store: switching to a finer real timeframe during replay', () => {
  it('maps the cursor to the end of the revealed coarse bar (no look-ahead)', () => {
    const DAY = 86400;
    const daily = Array.from({ length: 10 }, (_, i) => bar(i * DAY, 100 + i));
    const hourly = Array.from({ length: 10 * 24 }, (_, i) => bar(i * 3600, 100 + i / 24));
    const realData = { XAUUSD: { symbol: 'XAUUSD', fetchedAt: 1, series: { '1h': hourly, '1d': daily } } };
    const st = useTradingStore;
    st.setState({ symbol: 'XAUUSD', realData });
    st.getState().setTimeframe('1d');
    expect(st.getState()).toMatchObject({ baseTf: '1d', base: daily });

    st.getState().enterReplay();
    st.getState().selectCutoff(3 * DAY);
    expect(st.getState().replay.cursor).toBe(3);

    st.getState().setTimeframe('1h');
    const s = st.getState();
    expect(s.baseTf).toBe('1h');
    // Last hourly bar of day 3 = 23:00 on day 3.
    expect(s.base[s.replay.cursor].time).toBe(4 * DAY - 3600);
    expect(s.replay.status).toBe('paused');

    // Going coarser again keeps the hourly series and aggregates it.
    st.getState().setTimeframe('1d');
    expect(st.getState().baseTf).toBe('1h');
  });
});

describe('store: without fetched data', () => {
  it('has no candles and refuses to start a replay', () => {
    const st = useTradingStore;
    st.setState({ realData: {} });
    st.getState().setSymbol('AUDUSD');
    expect(st.getState().base).toEqual([]);
    st.getState().enterReplay();
    st.getState().randomCutoff();
    expect(st.getState().replay.status).toBe('off');
  });
});

describe('store: importSeries', () => {
  it('stores imported bars, shows them for the current symbol and merges on request', () => {
    const st = useTradingStore;
    st.setState({ realData: {} });
    st.getState().setSymbol('AUDUSD');
    st.getState().setTimeframe('1h');
    const m15 = Array.from({ length: 16 }, (_, i) => bar(i * 900, 1 + i / 100));
    st.getState().importSeries([{ symbol: 'AUDUSD', timeframe: '15m', candles: m15, source: 'MT5 · AUDUSD_M15.csv', merge: false }]);
    let s = st.getState();
    expect(s.realData.AUDUSD.sources?.['15m']).toBe('MT5 · AUDUSD_M15.csv');
    // 1h chart falls back to the imported 15m series (aggregated).
    expect(s.baseTf).toBe('15m');
    expect(s.base).toHaveLength(16);

    st.getState().importSeries([{ symbol: 'AUDUSD', timeframe: '15m', candles: [bar(15 * 900, 9), bar(16 * 900, 9)], source: 'CSV · more.csv', merge: true }]);
    s = st.getState();
    expect(s.realData.AUDUSD.series['15m']).toHaveLength(17);
    expect(s.base[15].close).toBe(9);
  });

  it('switches to the imported symbol when nothing is shown yet', () => {
    const st = useTradingStore;
    st.setState({ realData: {} });
    st.getState().setSymbol('SPX');
    st.getState().importSeries([{ symbol: 'ETHUSD', timeframe: '1d', candles: [0, 1, 2, 3].map((i) => bar(i * 86400)), source: 'CSV · eth.csv', merge: false }]);
    expect(st.getState()).toMatchObject({ symbol: 'ETHUSD', timeframe: '1d', baseTf: '1d' });
    expect(st.getState().base).toHaveLength(4);
  });
});
