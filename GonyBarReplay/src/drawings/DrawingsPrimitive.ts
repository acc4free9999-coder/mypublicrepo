import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  Logical,
  PrimitiveHoveredItem,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';
import { fmtPrice, fmtTime } from '@/lib/format';
import { drawingsFor, useDrawingStore } from '@/store/useDrawingStore';
import {
  anchorsOf,
  calloutBox,
  CALLOUT_PAD,
  fibPrice,
  fontFor,
  HANDLE_RADIUS,
  hitTestAll,
  lineHeight,
  lineSegment,
  project,
  textBox,
  textLines,
  type Px,
  type Viewport,
} from './geometry';
import type { TimeMapper } from './timeMapper';
import { FIB_LEVELS, statsVisible, type AnchorPoint, type Drawing, type LineDash } from './types';

type CanvasRenderingTarget2D = Parameters<IPrimitivePaneRenderer['draw']>[0];

export interface DrawingContext {
  symbol(): string;
  precision(): number;
}

const withAlpha = (hex: string, alpha: number) =>
  `${hex}${Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')}`;

function setDash(ctx: CanvasRenderingContext2D, dash: LineDash, width: number) {
  ctx.setLineDash(dash === 'dashed' ? [6 * Math.max(1, width / 1.5), 4 * Math.max(1, width / 1.5)] : dash === 'dotted' ? [width, width * 2] : []);
}

function stroke(ctx: CanvasRenderingContext2D, a: Px, b: Px) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function arrowHead(ctx: CanvasRenderingContext2D, from: Px, to: Px, size = 7) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(ang - Math.PI / 7), to.y - size * Math.sin(ang - Math.PI / 7));
  ctx.lineTo(to.x - size * Math.cos(ang + Math.PI / 7), to.y - size * Math.sin(ang + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}

export function fmtDuration(seconds: number) {
  const s = Math.abs(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** On-screen angle of a→b in degrees (up = positive), as TradingView shows it; depends on the current zoom. */
export const screenAngle = (a: Px, b: Px) => (Math.atan2(a.y - b.y, b.x - a.x) * 180) / Math.PI;

/** Text lines of a trend-line stats label. */
export function trendStats(p0: AnchorPoint, p1: AnchorPoint, bars: number, angleDeg: number, precision: number): string[] {
  const diff = p1.price - p0.price;
  const pct = p0.price !== 0 ? (diff / p0.price) * 100 : 0;
  const sign = (v: number) => (v >= 0 ? '+' : '');
  return [
    `${sign(diff)}${fmtPrice(diff, precision)} (${sign(pct)}${pct.toFixed(2)}%)`,
    `${bars} bars, ${fmtDuration(p1.time - p0.time)}`,
    `∠ ${angleDeg.toFixed(1)}°`,
  ];
}

/** Stats box beside the end point, on the far side from the start point and kept inside the pane. */
function statsBox(ctx: CanvasRenderingContext2D, lines: string[], a: Px, b: Px, color: string, vp: Viewport) {
  ctx.setLineDash([]);
  ctx.font = fontFor(11);
  const lh = 14;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 12;
  const h = lines.length * lh + 6;
  const gap = 10;
  let x = b.x >= a.x ? b.x + gap : b.x - gap - w;
  let y = b.y <= a.y ? b.y - h - 4 : b.y + 4;
  x = Math.max(2, Math.min(vp.width - w - 2, x));
  y = Math.max(2, Math.min(vp.height - h - 2, y));
  ctx.fillStyle = 'rgba(19,24,35,0.92)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x + 6, y + 3 + i * lh));
}

function labelBox(ctx: CanvasRenderingContext2D, lines: string[], cx: number, top: number, bg: string) {
  ctx.font = fontFor(12);
  const lh = 16;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
  const h = lines.length * lh + 8;
  const x = cx - w / 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, top, w, h, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, cx, top + 4 + i * lh));
}

/**
 * Lightweight Charts series primitive rendering every user drawing for the
 * active symbol. It reads state straight from the drawing store at paint time;
 * the chart component calls `requestUpdate()` whenever that store changes.
 */
export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private request: (() => void) | null = null;
  private readonly paneView: IPrimitivePaneView;

  constructor(
    private readonly mapper: TimeMapper,
    private readonly ctx: DrawingContext,
  ) {
    this.paneView = { zOrder: () => 'top', renderer: () => ({ draw: (t) => this.draw(t) }) };
  }

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart as IChartApi;
    this.series = p.series;
    this.request = p.requestUpdate;
  }

  detached() {
    this.chart = this.series = this.request = null;
  }

  requestUpdate() {
    this.request?.();
  }

  viewport(width?: number, height?: number): Viewport | null {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series) return null;
    const ts = chart.timeScale();
    return {
      width: width ?? ts.width(),
      height: height ?? chart.panes()[0]?.getHeight() ?? 0,
      toX: (t) => {
        const l = this.mapper.toLogical(t);
        return l == null ? null : ts.logicalToCoordinate(l as Logical);
      },
      toY: (p) => series.priceToCoordinate(p),
    };
  }

  private visibleDrawings(): Drawing[] {
    const s = useDrawingStore.getState();
    if (s.hidden) return [];
    const list = drawingsFor(s, this.ctx.symbol());
    return s.draft ? [...list, s.draft] : list;
  }

  // ───────────── hover / cursor ─────────────

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const s = useDrawingStore.getState();
    if (s.tool !== 'cursor') return { externalId: 'drawing-tool', zOrder: 'top', cursorStyle: 'crosshair' };
    const vp = this.viewport();
    if (!vp || s.hidden) return null;
    const list = drawingsFor(s, this.ctx.symbol());
    const hit = hitTestAll(list, vp, { x, y }, s.selectedId);
    if (!hit) return null;
    const locked = list.find((d) => d.id === hit.id)?.locked;
    return { externalId: hit.id, zOrder: 'top', cursorStyle: locked ? 'default' : hit.anchor != null ? 'pointer' : 'move' };
  }

  // ───────────── axis labels ─────────────

  priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    const vp = this.viewport();
    if (!vp) return [];
    const s = useDrawingStore.getState();
    const pp = this.ctx.precision();
    const out: ISeriesPrimitiveAxisView[] = [];
    const add = (price: number, color: string) => {
      const y = vp.toY(price);
      if (y != null) out.push({ coordinate: () => y, text: () => fmtPrice(price, pp).replace(/,/g, ''), textColor: () => '#ffffff', backColor: () => color });
    };
    for (const d of this.visibleDrawings()) {
      const selected = d.id === s.selectedId || d === s.draft;
      if (d.type === 'hline' || d.type === 'hray') add(d.points[0].price, d.style.color);
      else if (selected && d.type !== 'vline') d.points.forEach((p) => add(p.price, d.style.color));
    }
    return out;
  }

  timeAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    const vp = this.viewport();
    if (!vp) return [];
    const s = useDrawingStore.getState();
    const out: ISeriesPrimitiveAxisView[] = [];
    const add = (time: number, color: string) => {
      const x = vp.toX(time);
      if (x != null) out.push({ coordinate: () => x, text: () => fmtTime(time), textColor: () => '#ffffff', backColor: () => color });
    };
    for (const d of this.visibleDrawings()) {
      const selected = d.id === s.selectedId || d === s.draft;
      if (d.type === 'vline') add(d.points[0].time, d.style.color);
      else if (selected && d.type !== 'hline') d.points.forEach((p) => add(p.time, d.style.color));
    }
    return out;
  }

  paneViews() {
    return [this.paneView];
  }

  // ───────────── rendering ─────────────

  private draw(target: CanvasRenderingTarget2D) {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const vp = this.viewport(mediaSize.width, mediaSize.height);
      if (!vp) return;
      const s = useDrawingStore.getState();
      for (const d of this.visibleDrawings()) {
        ctx.save();
        try {
          this.drawOne(ctx, d, vp, d.id === s.selectedId);
        } finally {
          ctx.restore();
        }
        if (d.id === s.selectedId || d === s.draft) this.drawHandles(ctx, d, vp);
      }
    });
  }

  private drawHandles(ctx: CanvasRenderingContext2D, d: Drawing, vp: Viewport) {
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    for (const a of anchorsOf(d, vp)) {
      ctx.beginPath();
      ctx.arc(a.x, a.y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#0b0e14';
      ctx.fill();
      ctx.strokeStyle = d.style.color;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawOne(ctx: CanvasRenderingContext2D, d: Drawing, vp: Viewport, selected: boolean) {
    const { color, width, dash } = d.style;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    setDash(ctx, dash, width);
    const [a, b] = d.points.map((p) => project(vp, p));
    const pp = this.ctx.precision();

    switch (d.type) {
      case 'trendline':
      case 'ray':
      case 'extended': {
        if (!a || !b) return;
        const [s, e] = lineSegment(d.type, a, b);
        stroke(ctx, s, e);
        if (statsVisible(d)) {
          const l0 = this.mapper.toLogical(d.points[0].time) ?? 0;
          const l1 = this.mapper.toLogical(d.points[1].time) ?? 0;
          statsBox(ctx, trendStats(d.points[0], d.points[1], Math.round(l1 - l0), screenAngle(a, b), pp), a, b, color, vp);
        }
        return;
      }
      case 'hline': {
        const y = vp.toY(d.points[0].price);
        if (y != null) stroke(ctx, { x: 0, y }, { x: vp.width, y });
        return;
      }
      case 'hray': {
        if (a) stroke(ctx, a, { x: vp.width, y: a.y });
        return;
      }
      case 'vline': {
        const x = vp.toX(d.points[0].time);
        if (x != null) stroke(ctx, { x, y: 0 }, { x, y: vp.height });
        return;
      }
      case 'rect': {
        if (!a || !b) return;
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const w = Math.abs(b.x - a.x);
        const h = Math.abs(b.y - a.y);
        ctx.fillStyle = withAlpha(color, 0.15);
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        return;
      }
      case 'fib': {
        if (!a || !b) return;
        const x0 = Math.min(a.x, b.x);
        const x1 = Math.max(a.x, b.x);
        const ys = FIB_LEVELS.map(({ level }) => vp.toY(fibPrice(d, level)));
        // Bands between consecutive levels.
        for (let i = 0; i < FIB_LEVELS.length - 1; i++) {
          const y0 = ys[i];
          const y1 = ys[i + 1];
          if (y0 == null || y1 == null) continue;
          ctx.fillStyle = withAlpha(FIB_LEVELS[i + 1].color, 0.08);
          ctx.fillRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0));
        }
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        ctx.font = fontFor(11);
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'left';
        FIB_LEVELS.forEach(({ level, color: c }, i) => {
          const y = ys[i];
          if (y == null) return;
          ctx.strokeStyle = c;
          stroke(ctx, { x: x0, y }, { x: x1, y });
          ctx.fillStyle = c;
          ctx.fillText(`${level} (${fmtPrice(fibPrice(d, level), pp)})`, x0 + 4, y - 2);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, width - 1);
        setDash(ctx, 'dashed', 1);
        stroke(ctx, a, b);
        return;
      }
      case 'measure': {
        if (!a || !b) return;
        const up = d.points[1].price >= d.points[0].price;
        const c = up ? '#2962ff' : '#f23645';
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const w = Math.abs(b.x - a.x);
        const h = Math.abs(b.y - a.y);
        ctx.fillStyle = withAlpha(c, 0.2);
        ctx.fillRect(x, y, w, h);
        ctx.setLineDash([]);
        ctx.strokeStyle = c;
        ctx.fillStyle = c;
        ctx.lineWidth = 1.5;
        const cx = x + w / 2;
        const cy = y + h / 2;
        stroke(ctx, { x: cx, y: a.y }, { x: cx, y: b.y });
        if (h > 10) arrowHead(ctx, { x: cx, y: a.y }, { x: cx, y: b.y });
        stroke(ctx, { x: a.x, y: cy }, { x: b.x, y: cy });
        if (w > 10) arrowHead(ctx, { x: a.x, y: cy }, { x: b.x, y: cy });

        const p0 = d.points[0].price;
        const diff = d.points[1].price - p0;
        const pct = p0 !== 0 ? (diff / p0) * 100 : 0;
        const l0 = this.mapper.toLogical(d.points[0].time) ?? 0;
        const l1 = this.mapper.toLogical(d.points[1].time) ?? 0;
        const bars = Math.round(l1 - l0);
        const lines = [
          `${diff >= 0 ? '+' : ''}${fmtPrice(diff, pp)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`,
          `${bars} bars, ${fmtDuration(d.points[1].time - d.points[0].time)}`,
        ];
        labelBox(ctx, lines, cx, up ? y - 48 : y + h + 8, c);
        return;
      }
      case 'callout': {
        const box = calloutBox(d, vp);
        if (!box) return;
        const size = d.fontSize ?? 14;
        ctx.setLineDash([]);
        // Tail: a wedge from the bubble centre to the target point.
        if (a) {
          const ang = Math.atan2(a.y - box.cy, a.x - box.cx);
          const half = Math.min(10, box.h / 2 - 2);
          ctx.beginPath();
          ctx.moveTo(box.cx + Math.sin(ang) * half, box.cy - Math.cos(ang) * half);
          ctx.lineTo(a.x, a.y);
          ctx.lineTo(box.cx - Math.sin(ang) * half, box.cy + Math.cos(ang) * half);
          ctx.closePath();
          ctx.fill();
        }
        ctx.beginPath();
        ctx.roundRect(box.x, box.y, box.w, box.h, 6);
        ctx.fill();
        if (selected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.font = fontFor(size);
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        textLines(d).forEach((line, i) => ctx.fillText(line, box.x + CALLOUT_PAD, box.y + CALLOUT_PAD + i * lineHeight(size)));
        return;
      }
      case 'text': {
        const box = textBox(d, vp);
        if (!box) return;
        const size = d.fontSize ?? 14;
        ctx.font = fontFor(size);
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillStyle = color;
        textLines(d).forEach((line, i) => ctx.fillText(line, box.x, box.y + i * lineHeight(size)));
        if (selected) {
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8);
        }
        return;
      }
    }
  }
}
