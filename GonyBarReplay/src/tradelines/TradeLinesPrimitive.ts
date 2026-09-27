import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  PrimitiveHoveredItem,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';
import { fmtPrice, fmtUsd } from '@/lib/format';
import { buildTradeLines, type TradeDrag, type TradeLine, type TradeLineInput } from './model';

type CanvasRenderingTarget2D = Parameters<IPrimitivePaneRenderer['draw']>[0];

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LineLayout {
  line: TradeLine;
  y: number;
  label: Rect;
  close?: Rect;
  submit?: Rect;
}

export type TradeHit = { line: TradeLine; part: 'line' | 'label' | 'close' | 'submit' };

const LABEL_H = 18;
const LINE_TOLERANCE = 5;
const FONT = '600 11px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

const inRect = (r: Rect | undefined, x: number, y: number) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`;

/**
 * Renders positions, pending orders and the order-ticket preview as
 * TradingView-style horizontal lines with draggable labels. Hit-testing reuses
 * the label layout computed during the last paint.
 */
export class TradeLinesPrimitive implements ISeriesPrimitive<Time> {
  private series: ISeriesApi<SeriesType> | null = null;
  private request: (() => void) | null = null;
  private readonly paneView: IPrimitivePaneView;
  private layout: LineLayout[] = [];
  private measure: CanvasRenderingContext2D | null = null;
  drag: TradeDrag | null = null;
  hover: string | null = null;

  constructor(
    private readonly input: () => TradeLineInput,
    private readonly precision: () => number,
  ) {
    this.paneView = { zOrder: () => 'top', renderer: () => ({ draw: (t) => this.draw(t) }) };
  }

  attached(p: SeriesAttachedParameter<Time>) {
    this.series = p.series;
    this.request = p.requestUpdate;
  }

  detached() {
    this.series = this.request = null;
  }

  requestUpdate() {
    this.request?.();
  }

  lines(): TradeLine[] {
    return buildTradeLines(this.input(), this.drag);
  }

  paneViews() {
    return [this.paneView];
  }

  /** Topmost line / button under the cursor. Labels win over bare lines. */
  hit(x: number, y: number): TradeHit | null {
    for (let i = this.layout.length - 1; i >= 0; i--) {
      const l = this.layout[i];
      if (inRect(l.close, x, y)) return { line: l.line, part: 'close' };
      if (inRect(l.submit, x, y)) return { line: l.line, part: 'submit' };
      if (inRect(l.label, x, y)) return { line: l.line, part: 'label' };
    }
    let best: LineLayout | null = null;
    for (const l of this.layout) {
      const d = Math.abs(l.y - y);
      if (d <= LINE_TOLERANCE && (!best || d < Math.abs(best.y - y))) best = l;
    }
    return best ? { line: best.line, part: 'line' } : null;
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    if (this.drag) return { externalId: 'trade-drag', zOrder: 'top', cursorStyle: 'ns-resize' };
    const h = this.hit(x, y);
    if (!h) return null;
    const cursor = h.part === 'close' || h.part === 'submit' ? 'pointer' : h.line.draggable ? 'ns-resize' : 'default';
    return { externalId: `trade:${h.line.key}`, zOrder: 'top', cursorStyle: cursor };
  }

  priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    const series = this.series;
    if (!series) return [];
    const pp = this.precision();
    const out: ISeriesPrimitiveAxisView[] = [];
    for (const l of this.lines()) {
      const y = series.priceToCoordinate(l.price);
      if (y == null) continue;
      out.push({
        coordinate: () => y,
        text: () => fmtPrice(l.price, pp).replace(/,/g, ''),
        textColor: () => '#ffffff',
        backColor: () => (l.preview ? alpha(l.color, 0.75) : l.color),
      });
    }
    return out;
  }

  private textWidth(s: string) {
    if (!this.measure) this.measure = document.createElement('canvas').getContext('2d');
    if (!this.measure) return s.length * 7;
    this.measure.font = FONT;
    return this.measure.measureText(s).width;
  }

  /** Computes label rectangles; overlapping labels are staggered to the left. */
  private computeLayout(width: number): LineLayout[] {
    const series = this.series;
    if (!series) return [];
    const items: LineLayout[] = [];
    for (const line of this.lines()) {
      const y = series.priceToCoordinate(line.price);
      if (y == null) continue;
      items.push({ line, y, label: { x: 0, y: y - LABEL_H / 2, w: 0, h: LABEL_H } });
    }
    items.sort((a, b) => a.y - b.y);
    const placed: Rect[] = [];
    for (const it of items) {
      const { line } = it;
      let w = this.textWidth(line.title) + 12;
      if (line.pnl != null) w += this.textWidth(fmtUsd(line.pnl, true)) + 12;
      if (line.submittable) w += LABEL_H;
      if (line.closable) w += LABEL_H;
      let right = width - 12;
      for (const p of placed) {
        const overlapsY = Math.abs(p.y - it.label.y) < LABEL_H + 1;
        if (overlapsY && right > p.x - 4) right = Math.min(right, p.x - 6);
      }
      it.label.w = w;
      it.label.x = Math.max(4, right - w);
      let cx = it.label.x + w;
      if (line.closable) {
        cx -= LABEL_H;
        it.close = { x: cx, y: it.label.y, w: LABEL_H, h: LABEL_H };
      }
      if (line.submittable) {
        cx -= LABEL_H;
        it.submit = { x: cx, y: it.label.y, w: LABEL_H, h: LABEL_H };
      }
      placed.push(it.label);
    }
    return items;
  }

  private draw(target: CanvasRenderingTarget2D) {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      this.layout = this.computeLayout(mediaSize.width);
      for (const it of this.layout) {
        ctx.save();
        this.drawLine(ctx, it, mediaSize.width);
        ctx.restore();
      }
    });
  }

  private drawLine(ctx: CanvasRenderingContext2D, it: LineLayout, width: number) {
    const { line, y, label } = it;
    const active = this.drag?.key === line.key || this.hover === line.key;
    const color = line.preview && !active ? alpha(line.color, 0.8) : line.color;
    const py = Math.round(y) + 0.5;

    ctx.strokeStyle = color;
    ctx.lineWidth = active ? 2 : 1;
    ctx.setLineDash(line.dash === 'dashed' ? [6, 4] : line.dash === 'dotted' ? [2, 3] : []);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(label.x, py);
    ctx.moveTo(label.x + label.w, py);
    ctx.lineTo(width, py);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    // Box background + border.
    ctx.fillStyle = '#0b0e14';
    ctx.beginPath();
    ctx.roundRect(label.x, label.y, label.w, label.h, 3);
    ctx.fill();

    let x = label.x;
    const tw = this.textWidth(line.title) + 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, label.y, tw, label.h, [3, 0, 0, 3]);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line.title, x + 6, y);
    x += tw;

    if (line.pnl != null) {
      const s = fmtUsd(line.pnl, true);
      ctx.fillStyle = line.pnl > 0 ? '#34d399' : line.pnl < 0 ? '#fb7185' : '#cbd5e1';
      ctx.fillText(s, x + 6, y);
      x += this.textWidth(s) + 12;
    }

    const button = (r: Rect | undefined, glyph: 'check' | 'x', hoverColor: string) => {
      if (!r) return;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r.x + 0.5, r.y + 3);
      ctx.lineTo(r.x + 0.5, r.y + r.h - 3);
      ctx.stroke();
      ctx.strokeStyle = active ? hoverColor : '#94a3b8';
      ctx.lineWidth = 1.5;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      ctx.beginPath();
      if (glyph === 'x') {
        ctx.moveTo(cx - 3.5, cy - 3.5);
        ctx.lineTo(cx + 3.5, cy + 3.5);
        ctx.moveTo(cx + 3.5, cy - 3.5);
        ctx.lineTo(cx - 3.5, cy + 3.5);
      } else {
        ctx.moveTo(cx - 4, cy);
        ctx.lineTo(cx - 1, cy + 3);
        ctx.lineTo(cx + 4, cy - 3.5);
      }
      ctx.stroke();
    };
    button(it.submit, 'check', '#22c55e');
    button(it.close, 'x', '#f43f5e');

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(label.x + 0.5, label.y + 0.5, label.w - 1, label.h - 1, 3);
    ctx.stroke();
  }
}
