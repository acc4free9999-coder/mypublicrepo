import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';
import type { UnixTime } from '@/types';

type CanvasRenderingTarget2D = Parameters<IPrimitivePaneRenderer['draw']>[0];

export interface PineChartDrawing {
  id: string;
  kind: 'line' | 'box';
  x1: UnixTime;
  x2: UnixTime;
  y1: number;
  y2: number;
  color: string;
  width: number;
  style?: 'solid' | 'dashed' | 'dotted';
  fillColor?: string;
  text?: string;
  textColor?: string;
  extend?: 'none' | 'left' | 'right' | 'both';
}

/** Canvas coordinates far outside the pane are clamped to avoid precision/raster issues. */
const COORD_LIMIT = 1e6;
const clampCoord = (v: number) => Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, v));

function timeOf(t: Time): number | null {
  if (typeof t === 'number') return t;
  if (typeof t === 'string') {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  if (t && typeof t === 'object') return Math.floor(Date.UTC(t.year, t.month - 1, t.day) / 1000);
  return null;
}

function applyDash(ctx: CanvasRenderingContext2D, style: PineChartDrawing['style'], width: number) {
  const w = Math.max(1, width);
  ctx.setLineDash(style === 'dashed' ? [6 * w, 4 * w] : style === 'dotted' ? [w, w * 2] : []);
}

/**
 * Series primitive rendering Pine `line.new` / `box.new` objects. Drawings are
 * pulled from `getDrawings` at paint time; call `requestUpdate()` when they change.
 */
export class PineDrawingsPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private request: (() => void) | null = null;
  private readonly paneView: IPrimitivePaneView;
  private times: number[] = [];
  private timesSource: unknown = null;
  private timesLength = -1;

  constructor(private readonly getDrawings: () => PineChartDrawing[]) {
    this.paneView = { zOrder: () => 'normal', renderer: () => ({ draw: (t) => this.draw(t) }) };
  }

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart as IChartApi;
    this.series = p.series;
    this.request = p.requestUpdate;
  }

  detached() {
    this.chart = this.series = this.request = null;
    this.times = [];
    this.timesSource = null;
    this.timesLength = -1;
  }

  requestUpdate() {
    this.request?.();
  }

  updateAllViews() {}

  paneViews() {
    return [this.paneView];
  }

  private refreshTimes(series: ISeriesApi<SeriesType>) {
    const data = series.data();
    if (data === this.timesSource && data.length === this.timesLength) return;
    const times: number[] = [];
    for (const d of data) {
      const t = timeOf(d.time);
      if (t != null) times.push(t);
    }
    this.times = times;
    this.timesSource = data;
    this.timesLength = data.length;
  }

  /** Fractional logical index of a timestamp; extrapolates beyond the loaded bars. */
  private toLogical(t: UnixTime): number | null {
    const a = this.times;
    const n = a.length;
    if (n === 0 || !Number.isFinite(t)) return null;
    if (n === 1) return t === a[0] ? 0 : null;
    if (t <= a[0]) {
      const step = a[1] - a[0];
      return step > 0 ? (t - a[0]) / step : 0;
    }
    if (t >= a[n - 1]) {
      const step = a[n - 1] - a[n - 2];
      return step > 0 ? n - 1 + (t - a[n - 1]) / step : n - 1;
    }
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (a[mid] <= t) lo = mid;
      else hi = mid;
    }
    const span = a[hi] - a[lo];
    return span > 0 ? lo + (t - a[lo]) / span : lo;
  }

  private draw(target: CanvasRenderingTarget2D) {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series) return;
    const drawings = this.getDrawings();
    if (drawings.length === 0) return;
    this.refreshTimes(series);
    const ts = chart.timeScale();
    const toX = (t: UnixTime): number | null => {
      const l = this.toLogical(t);
      if (l == null) return null;
      const x = ts.logicalToCoordinate(l as Logical);
      return x == null || !Number.isFinite(x) ? null : clampCoord(x);
    };
    const toY = (p: number): number | null => {
      if (!Number.isFinite(p)) return null;
      const y = series.priceToCoordinate(p);
      return y == null || !Number.isFinite(y) ? null : clampCoord(y);
    };

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { width: W, height: H } = mediaSize;
      ctx.save();
      for (const d of drawings) {
        const x1 = toX(d.x1);
        const x2 = toX(d.x2);
        const y1 = toY(d.y1);
        const y2 = toY(d.y2);
        if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
        let pathStartX = x1;
        let pathStartY = y1;
        let pathEndX = x2;
        let pathEndY = y2;
        if (d.kind === 'line' && (d.extend === 'left' || d.extend === 'right' || d.extend === 'both')) {
          const slope = x2 === x1 ? 0 : (y2 - y1) / (x2 - x1);
          if (d.extend === 'left' || d.extend === 'both') {
            pathStartX = 0;
            pathStartY = clampCoord(y1 + (pathStartX - x1) * slope);
          }
          if (d.extend === 'right' || d.extend === 'both') {
            pathEndX = W;
            pathEndY = clampCoord(y1 + (pathEndX - x1) * slope);
          }
        }
        const left = Math.min(pathStartX, pathEndX);
        const right = Math.max(pathStartX, pathEndX);
        const visibleLeft = d.kind === 'box' && (d.extend === 'left' || d.extend === 'both') ? 0 : left;
        const visibleRight = d.kind === 'box' && (d.extend === 'right' || d.extend === 'both') ? W : right;
        const top = Math.min(pathStartY, pathEndY);
        const bottom = Math.max(pathStartY, pathEndY);
        const lw = Math.max(0, d.width);
        const pad = lw + 1;
        if (visibleRight < -pad || visibleLeft > W + pad || bottom < -pad || top > H + pad) continue;

        if (d.kind === 'box') {
          if (d.fillColor) {
            ctx.fillStyle = d.fillColor;
            ctx.fillRect(visibleLeft, top, visibleRight - visibleLeft, bottom - top);
          }
          if (lw > 0) {
            ctx.strokeStyle = d.color;
            ctx.lineWidth = lw;
            applyDash(ctx, d.style, lw);
            ctx.strokeRect(visibleLeft, top, visibleRight - visibleLeft, bottom - top);
          }
          if (d.text) {
            ctx.fillStyle = d.textColor ?? d.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '12px sans-serif';
            ctx.fillText(d.text, (visibleLeft + visibleRight) / 2, (top + bottom) / 2, Math.max(0, visibleRight - visibleLeft));
          }
        } else if (lw > 0) {
          ctx.strokeStyle = d.color;
          ctx.lineWidth = lw;
          ctx.lineCap = 'butt';
          applyDash(ctx, d.style, lw);
          ctx.beginPath();
          ctx.moveTo(pathStartX, pathStartY);
          ctx.lineTo(pathEndX, pathEndY);
          ctx.stroke();
        }
      }
      ctx.restore();
    });
  }
}
