import { describe, expect, it } from 'vitest';
import { applyAnchor, hitBody, hitTestAll, type Viewport } from '@/drawings/geometry';
import { TimeMapper } from '@/drawings/timeMapper';
import type { Drawing } from '@/drawings/types';

const style = { color: '#fff', width: 1, dash: 'solid' as const };
const mk = (id: string, type: Drawing['type'], points: Drawing['points'], extra: Partial<Drawing> = {}): Drawing => ({
  id, type, symbol: 'BTCUSD', points, style, createdAt: 0, ...extra,
});
// 1 time unit = 1px, price p → y = 1000 - p
const vp: Viewport = { width: 1000, height: 1000, toX: (t) => t, toY: (p) => 1000 - p };

describe('TimeMapper', () => {
  const m = new TimeMapper();
  m.set([{ time: 0 }, { time: 60 }, { time: 180 }], 60);

  it('maps exact and interpolated times', () => {
    expect(m.toLogical(60)).toBe(1);
    expect(m.toLogical(120)).toBe(1.5); // gap bar
    expect(m.toTime(1.5)).toBe(120);
  });

  it('extrapolates beyond the data range', () => {
    expect(m.toLogical(300)).toBe(4);
    expect(m.toLogical(-60)).toBe(-1);
    expect(m.toTime(4)).toBe(300);
    expect(m.toTime(-2)).toBe(-120);
  });

  it('returns null with no data', () => {
    const e = new TimeMapper();
    expect(e.toLogical(0)).toBeNull();
    expect(e.toTime(0)).toBeNull();
  });
});

describe('hit testing', () => {
  it('trendline hits only near its segment, ray extends forward', () => {
    const t = mk('t', 'trendline', [{ time: 100, price: 900 }, { time: 200, price: 800 }]);
    expect(hitBody(t, vp, { x: 150, y: 150 })).toBe(true);
    expect(hitBody(t, vp, { x: 300, y: 300 })).toBe(false);
    expect(hitBody({ ...t, type: 'ray' }, vp, { x: 300, y: 300 })).toBe(true);
    expect(hitBody({ ...t, type: 'ray' }, vp, { x: 50, y: 50 })).toBe(false);
    expect(hitBody({ ...t, type: 'extended' }, vp, { x: 50, y: 50 })).toBe(true);
  });

  it('horizontal line hits across the full width, hray only to the right', () => {
    const h = mk('h', 'hline', [{ time: 500, price: 500 }]);
    expect(hitBody(h, vp, { x: 5, y: 502 })).toBe(true);
    expect(hitBody({ ...h, type: 'hray' }, vp, { x: 5, y: 500 })).toBe(false);
    expect(hitBody({ ...h, type: 'hray' }, vp, { x: 800, y: 500 })).toBe(true);
  });

  it('prefers the selected drawing handles, then the topmost body', () => {
    const a = mk('a', 'hline', [{ time: 500, price: 500 }]);
    const b = mk('b', 'hline', [{ time: 500, price: 500 }]);
    expect(hitTestAll([a, b], vp, { x: 100, y: 500 }, null)).toEqual({ id: 'b', anchor: null });
    expect(hitTestAll([a, b], vp, { x: 500, y: 500 }, 'a')).toEqual({ id: 'a', anchor: 0 });
    expect(hitTestAll([a, b], vp, { x: 100, y: 100 }, null)).toBeNull();
  });
});

describe('applyAnchor', () => {
  const r = mk('r', 'rect', [{ time: 0, price: 10 }, { time: 100, price: 20 }]);
  it('moves the rectangle off-diagonal corners', () => {
    expect(applyAnchor(r, 2, { time: 5, price: 25 })).toEqual([{ time: 5, price: 10 }, { time: 100, price: 25 }]);
    expect(applyAnchor(r, 3, { time: 90, price: 5 })).toEqual([{ time: 0, price: 5 }, { time: 90, price: 20 }]);
  });
  it('moves a regular anchor', () => {
    expect(applyAnchor(r, 1, { time: 50, price: 15 })).toEqual([{ time: 0, price: 10 }, { time: 50, price: 15 }]);
  });
});

describe('callout', () => {
  it('hits the bubble and the tail, but not empty space', () => {
    const c = mk('c', 'callout', [{ time: 100, price: 900 }, { time: 300, price: 700 }], { text: 'Hi', fontSize: 14 });
    expect(hitBody(c, vp, { x: 300, y: 300 })).toBe(true); // bubble centre
    expect(hitBody(c, vp, { x: 150, y: 150 })).toBe(true); // along the tail
    expect(hitBody(c, vp, { x: 600, y: 600 })).toBe(false);
  });
});
