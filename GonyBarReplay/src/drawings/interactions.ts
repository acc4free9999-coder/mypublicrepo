import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import { drawingsFor, useDrawingStore } from '@/store/useDrawingStore';
import { useTradingStore } from '@/store/useTradingStore';
import type { Candle } from '@/types';
import type { DrawingsPrimitive } from './DrawingsPrimitive';
import { applyAnchor, hitTestAll, project, type Px } from './geometry';
import type { TimeMapper } from './timeMapper';
import { isTextual, POINT_COUNT, type AnchorPoint } from './types';

interface Deps {
  container: HTMLElement;
  chart: IChartApi;
  series: ISeriesApi<SeriesType>;
  primitive: DrawingsPrimitive;
  mapper: TimeMapper;
  candles: () => Candle[];
}

type DragState =
  | { id: string; kind: 'anchor'; index: number }
  | { id: string; kind: 'move'; startLogical: number; startPrice: number; orig: { logical: number; price: number }[] };

const DRAG_THRESHOLD = 4;

/**
 * Wires pointer events on the chart container to the drawing store.
 * Listeners run in the capture phase so that, when a drawing is being
 * created or dragged, the event never reaches Lightweight Charts (which
 * would otherwise start panning the chart).
 */
export function attachDrawingInteractions({ container, chart, series, primitive, mapper, candles }: Deps): () => void {
  let drag: DragState | null = null;
  let draftDown: Px | null = null;
  let swallowMouse = false;

  const store = () => useDrawingStore.getState();
  const symbol = () => useTradingStore.getState().symbol;

  const local = (e: MouseEvent): Px & { inside: boolean } => {
    const r = container.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const paneH = chart.panes()[0]?.getHeight() ?? 0;
    return { x, y, inside: x >= 0 && y >= 0 && x <= chart.timeScale().width() && y <= paneH };
  };

  const rawLogical = (x: number) => chart.timeScale().coordinateToLogical(x) as number | null;

  /** Mouse → data point, snapped to bar centres (and OHLC when magnet is on). */
  const toData = (x: number, y: number, snapTime = true): AnchorPoint | null => {
    let logical = rawLogical(x);
    let price = series.coordinateToPrice(y) as number | null;
    if (logical == null || price == null) return null;
    if (snapTime) logical = Math.round(logical);
    if (store().magnet) {
      const c = candles()[Math.round(logical)];
      if (c) {
        let best = price;
        let bestDist = Infinity;
        for (const v of [c.open, c.high, c.low, c.close]) {
          const cy = series.priceToCoordinate(v);
          if (cy != null && Math.abs(cy - y) < bestDist) {
            bestDist = Math.abs(cy - y);
            best = v;
          }
        }
        price = best;
        logical = Math.round(logical);
      }
    }
    const time = mapper.toTime(logical);
    return time == null ? null : { time, price };
  };

  const swallow = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    swallowMouse = true;
  };

  const finishDraft = (p: AnchorPoint) => {
    const s = store();
    const draft = s.draft;
    const vp = primitive.viewport();
    if (!draft || !vp) return false;
    const a = project(vp, draft.points[0]);
    const b = project(vp, p);
    if (a && b && Math.hypot(a.x - b.x, a.y - b.y) < DRAG_THRESHOLD) return false;
    s.setDraft(null);
    s.add({ ...draft, points: [draft.points[0], p] });
    if (draft.type === 'callout') s.startTextEdit(draft.id);
    if (!s.stayInDrawingMode) useDrawingStore.setState({ tool: 'cursor' });
    draftDown = null;
    return true;
  };

  // ───────────── pointer down ─────────────
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (useTradingStore.getState().replay.status === 'selecting') return;
    const m = local(e);
    if (!m.inside) return;
    const s = store();

    if (s.tool !== 'cursor') {
      swallow(e);
      const p = toData(m.x, m.y);
      if (!p) return;
      if (s.draft) {
        finishDraft(p);
        return;
      }
      if (POINT_COUNT[s.tool] === 1) {
        const d = s.create(symbol(), s.tool, [p]);
        s.add(d);
        if (d.type === 'text') s.startTextEdit(d.id);
        if (!s.stayInDrawingMode) useDrawingStore.setState({ tool: 'cursor' });
        return;
      }
      s.setDraft(s.create(symbol(), s.tool, [p, p]));
      draftDown = m;
      window.addEventListener('pointerup', onDraftUp);
      return;
    }

    if (s.hidden) return;
    const vp = primitive.viewport();
    if (!vp) return;
    const list = drawingsFor(s, symbol());
    const hit = hitTestAll(list, vp, m, s.selectedId);
    if (!hit) {
      if (s.selectedId) s.select(null);
      return; // let the chart pan
    }
    swallow(e);
    s.select(hit.id);
    const d = list.find((x) => x.id === hit.id)!;
    if (d.locked) return;

    const startLogical = rawLogical(m.x);
    const startPrice = series.coordinateToPrice(m.y);
    if (hit.anchor != null) {
      drag = { id: d.id, kind: 'anchor', index: hit.anchor };
    } else if (startLogical != null && startPrice != null) {
      drag = {
        id: d.id,
        kind: 'move',
        startLogical,
        startPrice,
        orig: d.points.map((p) => ({ logical: mapper.toLogical(p.time) ?? 0, price: p.price })),
      };
    } else return;
    s.checkpoint();
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
  };

  // ───────────── drafting ─────────────
  const onPointerMove = (e: PointerEvent) => {
    const s = store();
    if (!s.draft || drag) return;
    const m = local(e);
    const p = toData(m.x, m.y);
    if (p) s.setDraft({ ...s.draft, points: [s.draft.points[0], p] });
  };

  const onDraftUp = (e: PointerEvent) => {
    window.removeEventListener('pointerup', onDraftUp);
    if (!draftDown || !store().draft) return;
    const m = local(e);
    // Press-drag-release creates the drawing in one gesture; a plain click waits for a second click.
    if (Math.hypot(m.x - draftDown.x, m.y - draftDown.y) > DRAG_THRESHOLD) {
      const p = toData(m.x, m.y);
      if (p) finishDraft(p);
    }
    draftDown = null;
  };

  // ───────────── dragging ─────────────
  const onDragMove = (e: PointerEvent) => {
    if (!drag) return;
    const s = store();
    const d = s.find(drag.id);
    if (!d) return;
    const m = local(e);
    if (drag.kind === 'anchor') {
      const p = toData(m.x, m.y);
      if (p) s.update(d.id, { points: applyAnchor(d, drag.index, p) });
      return;
    }
    const l = rawLogical(m.x);
    const price = series.coordinateToPrice(m.y);
    if (l == null || price == null) return;
    const dl = Math.round(l - drag.startLogical);
    const dp = price - drag.startPrice;
    const points = drag.orig.map((o) => ({ time: mapper.toTime(o.logical + dl) ?? 0, price: o.price + dp }));
    s.update(d.id, { points });
  };

  const onDragUp = () => {
    drag = null;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
  };

  // ───────────── misc ─────────────
  const onDblClick = (e: MouseEvent) => {
    const s = store();
    const vp = primitive.viewport();
    if (s.tool !== 'cursor' || !vp) return;
    const hit = hitTestAll(drawingsFor(s, symbol()), vp, local(e), s.selectedId);
    const d = hit && s.find(hit.id);
    if (d && isTextual(d.type)) {
      e.stopPropagation();
      s.startTextEdit(d.id);
    }
  };

  // Compatibility mouse / touch events that LWC listens to.
  const onCompatDown = (e: Event) => {
    if (swallowMouse) {
      e.stopPropagation();
      swallowMouse = false;
    }
  };

  const onContext = (e: MouseEvent) => {
    const s = store();
    if (s.draft || s.tool !== 'cursor') {
      e.preventDefault();
      s.setTool('cursor');
    }
  };

  container.addEventListener('pointerdown', onPointerDown, true);
  container.addEventListener('mousedown', onCompatDown, true);
  container.addEventListener('touchstart', onCompatDown, true);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('dblclick', onDblClick, true);
  container.addEventListener('contextmenu', onContext);

  return () => {
    container.removeEventListener('pointerdown', onPointerDown, true);
    container.removeEventListener('mousedown', onCompatDown, true);
    container.removeEventListener('touchstart', onCompatDown, true);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('dblclick', onDblClick, true);
    container.removeEventListener('contextmenu', onContext);
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    window.removeEventListener('pointerup', onDraftUp);
  };
}
