import type { AnchorPoint, Drawing } from './types';
import { FIB_LEVELS } from './types';

/** Screen-space projection of the main chart pane (CSS pixels). */
export interface Viewport {
  width: number;
  height: number;
  toX(time: number): number | null;
  toY(price: number): number | null;
}

export interface Px {
  x: number;
  y: number;
}

export const HIT_TOLERANCE = 6;
export const HANDLE_RADIUS = 5;
const FAR = 1e5;

export function project(vp: Viewport, p: AnchorPoint): Px | null {
  const x = vp.toX(p.time);
  const y = vp.toY(p.price);
  return x == null || y == null ? null : { x, y };
}

export function distToSegment(p: Px, a: Px, b: Px): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Returns the visible segment for trend / ray / extended lines. */
export function lineSegment(type: Drawing['type'], a: Px, b: Px): [Px, Px] {
  if (type === 'trendline') return [a, b];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const end = { x: a.x + ux * FAR, y: a.y + uy * FAR };
  if (type === 'ray') return [a, end];
  return [{ x: a.x - ux * FAR, y: a.y - uy * FAR }, end];
}

export const fibPrice = (d: Drawing, level: number) => d.points[1].price + (d.points[0].price - d.points[1].price) * level;

// ───────────── text metrics ─────────────

let measureCtx: CanvasRenderingContext2D | null | undefined;
export const fontFor = (size: number) => `${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;

export function measureText(text: string, size: number): number {
  if (measureCtx === undefined) measureCtx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * size * 0.6;
  measureCtx.font = fontFor(size);
  return measureCtx.measureText(text).width;
}

export const textLines = (d: Drawing) => (d.text ?? '').split('\n');
export const lineHeight = (size: number) => Math.round(size * 1.3);

export function textBox(d: Drawing, vp: Viewport) {
  const p = project(vp, d.points[0]);
  if (!p) return null;
  const size = d.fontSize ?? 14;
  const lines = textLines(d);
  const w = Math.max(8, ...lines.map((l) => measureText(l || ' ', size)));
  const h = lines.length * lineHeight(size);
  return { x: p.x, y: p.y - h / 2, w, h };
}

export const CALLOUT_PAD = 8;

/** Callout bubble: centred on points[1]; its tail points at points[0]. */
export function calloutBox(d: Drawing, vp: Viewport) {
  const c = project(vp, d.points[1]);
  if (!c) return null;
  const size = d.fontSize ?? 14;
  const lines = textLines(d);
  const w = Math.max(24, ...lines.map((l) => measureText(l || ' ', size))) + CALLOUT_PAD * 2;
  const h = lines.length * lineHeight(size) + CALLOUT_PAD * 2;
  return { x: c.x - w / 2, y: c.y - h / 2, w, h, cx: c.x, cy: c.y };
}

// ───────────── anchors (drag handles) ─────────────

export interface Anchor extends Px {
  index: number;
}

export function anchorsOf(d: Drawing, vp: Viewport): Anchor[] {
  const pts = d.points.map((p) => project(vp, p));
  switch (d.type) {
    case 'hline': {
      const y = vp.toY(d.points[0].price);
      if (y == null) return [];
      const x = pts[0] ? Math.min(Math.max(pts[0].x, 24), vp.width - 24) : vp.width / 2;
      return [{ x, y, index: 0 }];
    }
    case 'vline': {
      const x = vp.toX(d.points[0].time);
      return x == null ? [] : [{ x, y: vp.height / 2, index: 0 }];
    }
    case 'rect': {
      const [a, b] = pts;
      if (!a || !b) return [];
      return [
        { ...a, index: 0 },
        { ...b, index: 1 },
        { x: a.x, y: b.y, index: 2 },
        { x: b.x, y: a.y, index: 3 },
      ];
    }
    default:
      return pts.flatMap((p, index) => (p ? [{ ...p, index }] : []));
  }
}

/** New point list after dragging anchor `index` to data point `p`. */
export function applyAnchor(d: Drawing, index: number, p: AnchorPoint): AnchorPoint[] {
  const [a, b] = d.points;
  if (d.type === 'rect' && index >= 2) {
    return index === 2
      ? [{ time: p.time, price: a.price }, { time: b.time, price: p.price }]
      : [{ time: a.time, price: p.price }, { time: p.time, price: b.price }];
  }
  return d.points.map((pt, i) => (i === index ? p : pt));
}

// ───────────── hit testing ─────────────

export function hitBody(d: Drawing, vp: Viewport, m: Px): boolean {
  const tol = HIT_TOLERANCE + d.style.width / 2;
  const pts = d.points.map((p) => project(vp, p));
  switch (d.type) {
    case 'trendline':
    case 'ray':
    case 'extended': {
      const [a, b] = pts;
      if (!a || !b) return false;
      const [s, e] = lineSegment(d.type, a, b);
      return distToSegment(m, s, e) <= tol;
    }
    case 'hline': {
      const y = vp.toY(d.points[0].price);
      return y != null && Math.abs(m.y - y) <= tol;
    }
    case 'hray': {
      const a = pts[0];
      return !!a && m.x >= a.x - tol && Math.abs(m.y - a.y) <= tol;
    }
    case 'vline': {
      const x = vp.toX(d.points[0].time);
      return x != null && Math.abs(m.x - x) <= tol;
    }
    case 'rect':
    case 'measure': {
      const [a, b] = pts;
      if (!a || !b) return false;
      return m.x >= Math.min(a.x, b.x) - tol && m.x <= Math.max(a.x, b.x) + tol && m.y >= Math.min(a.y, b.y) - tol && m.y <= Math.max(a.y, b.y) + tol;
    }
    case 'fib': {
      const [a, b] = pts;
      if (!a || !b) return false;
      if (distToSegment(m, a, b) <= tol) return true;
      const x0 = Math.min(a.x, b.x);
      const x1 = Math.max(a.x, b.x);
      if (m.x < x0 - tol || m.x > x1 + tol) return false;
      return FIB_LEVELS.some(({ level }) => {
        const y = vp.toY(fibPrice(d, level));
        return y != null && Math.abs(m.y - y) <= tol;
      });
    }
    case 'callout': {
      const box = calloutBox(d, vp);
      if (!box) return false;
      if (m.x >= box.x && m.x <= box.x + box.w && m.y >= box.y && m.y <= box.y + box.h) return true;
      const tip = pts[0];
      return !!tip && distToSegment(m, { x: box.cx, y: box.cy }, tip) <= tol;
    }
    case 'text': {
      const box = textBox(d, vp);
      return !!box && m.x >= box.x - 4 && m.x <= box.x + box.w + 4 && m.y >= box.y - 4 && m.y <= box.y + box.h + 4;
    }
  }
}

export type Hit = { id: string; anchor: number | null };

/** Topmost hit. Handles of the selected drawing take priority. */
export function hitTestAll(drawings: Drawing[], vp: Viewport, m: Px, selectedId: string | null): Hit | null {
  const sel = selectedId ? drawings.find((d) => d.id === selectedId) : undefined;
  if (sel) {
    const a = anchorsOf(sel, vp).find((h) => Math.hypot(h.x - m.x, h.y - m.y) <= HANDLE_RADIUS + 3);
    if (a) return { id: sel.id, anchor: a.index };
  }
  for (let i = drawings.length - 1; i >= 0; i--) {
    if (hitBody(drawings[i], vp, m)) return { id: drawings[i].id, anchor: null };
  }
  return null;
}
