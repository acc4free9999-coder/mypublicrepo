import { describe, expect, it } from 'vitest';
import { screenAngle, trendStats } from '@/drawings/DrawingsPrimitive';
import { statsVisible } from '@/drawings/types';
import { useDrawingStore } from '@/store/useDrawingStore';
import { DEFAULT_INDICATORS, loadIndicators } from '@/store/useTradingStore';

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
