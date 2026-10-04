import { describe, expect, it, vi } from 'vitest';
import { initializePriceScale } from '@/components/chart/priceScaleInit';
import { screenAngle, trendStats } from '@/drawings/DrawingsPrimitive';
import { statsVisible } from '@/drawings/types';
import { useDrawingStore } from '@/store/useDrawingStore';
import { DEFAULT_INDICATORS, loadIndicators } from '@/store/useTradingStore';

describe('price scale initialization', () => {
  it('fits the first painted range before restoring saved manual mode', () => {
    const frames: FrameRequestCallback[] = [];
    const schedule = (fn: FrameRequestCallback) => frames.push(fn);
    const apply = vi.fn();
    initializePriceScale(apply, () => false, schedule, vi.fn());
    expect(apply.mock.calls).toEqual([[true]]);
    frames.shift()!(0);
    expect(apply.mock.calls).toEqual([[true]]);
    frames.shift()!(0);
    expect(apply.mock.calls).toEqual([[true], [false]]);
  });

  it('cancels initialization when the chart is removed or the user changes scaling', () => {
    const cancel = vi.fn();
    const cleanup = initializePriceScale(vi.fn(), () => true, () => 42, cancel);
    cleanup();
    expect(cancel).toHaveBeenCalledWith(42);
  });
});

describe('indicator persistence', () => {
  it('restores saved values and falls back to defaults for bad input', () => {
    expect(loadIndicators(JSON.stringify({ ema: { enabled: false, period: 21 }, volume: { enabled: false } }))).toEqual({ ema: { enabled: false, period: 21 }, volume: { enabled: false } });
    expect(loadIndicators(JSON.stringify({ ema: { period: 9000 } })).ema).toEqual({ enabled: true, period: 500 });
    expect(loadIndicators('not json')).toEqual(DEFAULT_INDICATORS);
    expect(loadIndicators(null)).toEqual(DEFAULT_INDICATORS);
  });
});

describe('trend line stats', () => {
  it('computes price change, bars, duration and on-screen angle', () => {
    const lines = trendStats({ time: 0, price: 4250 }, { time: 3 * 3600, price: 4260 }, 12, screenAngle({ x: 0, y: 100 }, { x: 100, y: 0 }), 2);
    expect(lines).toEqual(['+10.00 (+0.24%)', '12 bars, 3h', '∠ 45.0°']);
    expect(screenAngle({ x: 0, y: 0 }, { x: 100, y: 100 })).toBeCloseTo(-45);
  });

  it('is on by default for trend lines only', () => {
    expect(statsVisible({ type: 'trendline' })).toBe(true);
    expect(statsVisible({ type: 'trendline', showStats: false })).toBe(false);
    expect(statsVisible({ type: 'ray' })).toBe(false);
    expect(statsVisible({ type: 'ray', showStats: true })).toBe(true);
    expect(statsVisible({ type: 'hline', showStats: true })).toBe(false);
  });
});

describe('drawing store duplicate / removeAll', () => {
  it('clones a drawing and removes all with undo', () => {
    const s = useDrawingStore.getState();
    s.removeAll('TEST');
    const d = s.create('TEST', 'trendline', [{ time: 1, price: 1 }, { time: 2, price: 2 }]);
    s.add({ ...d, showStats: false });
    useDrawingStore.getState().duplicate(d.id);
    let list = useDrawingStore.getState().bySymbol.TEST;
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ type: 'trendline', showStats: false, points: d.points });
    expect(list[1].id).not.toBe(d.id);
    useDrawingStore.getState().removeAll('TEST');
    expect(useDrawingStore.getState().bySymbol.TEST).toHaveLength(0);
    useDrawingStore.getState().undo();
    list = useDrawingStore.getState().bySymbol.TEST;
    expect(list).toHaveLength(2);
  });
});

describe('stopReplay', () => {
  it('returns to the latest bar, asking first when trades are open', async () => {
    const { stopReplay, useTradingStore: st } = await import('@/store/useTradingStore');
    const base = Array.from({ length: 50 }, (_, i) => ({ time: i * 3600, open: 100, high: 101, low: 99, close: 100, volume: 0 }));
    st.setState({ symbol: 'ETHUSD', realData: { ETHUSD: { symbol: 'ETHUSD', fetchedAt: 1, series: { '1h': base } } } });
    st.getState().setTimeframe('1h');
    st.getState().enterReplay();
    st.getState().selectCutoff(10 * 3600);
    expect(st.getState().replay.cursor).toBe(10);
    expect(st.getState().placeOrder({ side: 'buy', type: 'market', qty: 1 })).toBe(true);

    expect(stopReplay(() => false)).toBe(false);
    expect(st.getState().replay.status).toBe('paused');

    expect(stopReplay(() => true)).toBe(true);
    const s = st.getState();
    expect(s.replay).toMatchObject({ status: 'off', cutoffIndex: null, cursor: 49 });
    expect(s.book.positions).toHaveLength(0);
    expect(stopReplay(() => true)).toBe(false);
  });
});
