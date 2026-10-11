import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import { useDrawingStore } from '@/store/useDrawingStore';
import { useTradingStore } from '@/store/useTradingStore';
import type { DrawingsPrimitive } from './DrawingsPrimitive';
import { applyAnchor, hitTestAll, project, type Px } from './geometry';
import type { TimeMapper } from './timeMapper';
import { isTextual, paneOf, POINT_COUNT, type AnchorPoint, type DrawingPane } from './types';

/** A chart pane that accepts drawings: its series gives the price ⇄ y mapping. */
export interface DrawingLayer {
  pane: DrawingPane;
  series: ISeriesApi<SeriesType>;
  primitive: DrawingsPrimitive;
  /** Values the magnet snaps to at a bar index (OHLC on the price pane, the RSI value on the RSI pane). */
  snapValues: (index: number) => number[];
}

interface Deps {
  container: HTMLElement;
  chart: IChartApi;
  mapper: TimeMapper;
  /** Current drawable panes (the RSI pane comes and goes with the indicator). */
  layers: () => DrawingLayer[];
}

type DragState =
  | { id: string; pane: DrawingPane; kind: 'anchor'; index: number }
  | { id: string; pane: DrawingPane; kind: 'move'; startLogical: number; startPrice: number; orig: { logical: number; price: number }[] };

const DRAG_THRESHOLD = 4;

interface Pointer extends Px {
  inside: boolean;
  layer: DrawingLayer | null;
}

/**
 * Wires pointer events on the chart container to the drawing store.
 * Listeners run in the capture phase so that, when a drawing is being
 * created or dragged, the event never reaches Lightweight Charts (which
 * would otherwise start panning the chart).
 *
 * Each pane is a layer with its own y axis; coordinates passed to a layer are relative to its pane.
 * A draft or drag stays in the pane where it started, even if the pointer leaves it.
 */
export function attachDrawingInteractions({ container, chart, mapper, layers }: Deps): () => void {
  let drag: DragState | null = null;
  let draftDown: Px | null = null;
  let swallowMouse = false;

  const store = () => useDrawingStore.getState();
  const symbol = () => useTradingStore.getState().symbol;
  const layerFor = (pane: DrawingPane) => layers().find((l) => l.pane === pane) ?? null;

  const paneRect = (layer: DrawingLayer) => {
    const pane = layer.series.getPane();
    const r = pane.getHTMLElement()?.getBoundingClientRect();
    return { top: r?.top ?? container.getBoundingClientRect().top, height: pane.getHeight() };
  };

  /** Pointer position relative to `fixed`'s pane, or to whichever pane is under the pointer. */
  const local = (e: MouseEvent, fixed?: DrawingLayer | null): Pointer => {
    const c = container.getBoundingClientRect();
    const x = e.clientX - c.left;
    const inX = x >= 0 && x <= chart.timeScale().width();
    if (fixed) {
      const { top, height } = paneRect(fixed);
      const y = e.clientY - top;
      return { x, y, inside: inX && y >= 0 && y <= height, layer: fixed };
    }
    for (const layer of layers()) {
      const { top, height } = paneRect(layer);
      const y = e.clientY - top;
      if (y >= 0 && y <= height) return { x, y, inside: inX, layer };
    }
    return { x, y: e.clientY - c.top, inside: false, layer: null };
  };

  const rawLogical = (x: number) => chart.timeScale().coordinateToLogical(x) as number | null;

  /** Mouse → data point, snapped to bar centres (and to the layer's snap values when magnet is on). */
  const toData = (layer: DrawingLayer, x: number, y: number, snapTime = true): AnchorPoint | null => {
    const { series } = layer;
    let logical = rawLogical(x);
    let price = series.coordinateToPrice(y) as number | null;
    if (logical == null || price == null) return null;
    if (snapTime) logical = Math.round(logical);
    if (store().magnet) {
      let best = price;
      let bestDist = Infinity;
      for (const v of layer.snapValues(Math.round(logical))) {
        const cy = series.priceToCoordinate(v);
        if (cy != null && Math.abs(cy - y) < bestDist) {
          bestDist = Math.abs(cy - y);
          best = v;
        }
      }
      if (bestDist < Infinity) {
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

  const draftLayer = () => {
    const d = store().draft;
    return d ? layerFor(paneOf(d)) : null;
  };

  const finishDraft = (p: AnchorPoint) => {
    const s = store();
    const draft = s.draft;
    const vp = draftLayer()?.primitive.viewport();
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
    const s = store();

    if (s.tool !== 'cursor') {
      // A second click finishes the draft in its own pane, wherever the pointer is.
      const dl = draftLayer();
      if (s.draft && dl) {
        if (!local(e).inside) return;
        const m = local(e, dl);
        swallow(e);
        const p = toData(dl, m.x, m.y);
        if (p) finishDraft(p);
        return;
      }
      const m = local(e);
      if (!m.inside || !m.layer) return;
      swallow(e);
      const layer = m.layer;
      const p = toData(layer, m.x, m.y);
      if (!p) return;
      if (POINT_COUNT[s.tool] === 1) {
        const d = s.create(symbol(), s.tool, [p], layer.pane);
        s.add(d);
        if (d.type === 'text') s.startTextEdit(d.id);
        if (!s.stayInDrawingMode) useDrawingStore.setState({ tool: 'cursor' });
        return;
      }
      s.setDraft(s.create(symbol(), s.tool, [p, p], layer.pane));
      draftDown = { x: e.clientX, y: e.clientY };
      window.addEventListener('pointerup', onDraftUp);
      return;
    }

    if (s.hidden) return;
    const m = local(e);
    if (!m.inside || !m.layer) return;
    const layer = m.layer;
    const vp = layer.primitive.viewport();
    if (!vp) return;
    const list = layer.primitive.drawings();
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
    const startPrice = layer.series.coordinateToPrice(m.y);
    if (hit.anchor != null) {
      drag = { id: d.id, pane: layer.pane, kind: 'anchor', index: hit.anchor };
    } else if (startLogical != null && startPrice != null) {
      drag = {
        id: d.id,
        pane: layer.pane,
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
    const layer = draftLayer();
    if (!s.draft || drag || !layer) return;
    const m = local(e, layer);
    const p = toData(layer, m.x, m.y);
    if (p) s.setDraft({ ...s.draft, points: [s.draft.points[0], p] });
  };

  const onDraftUp = (e: PointerEvent) => {
    window.removeEventListener('pointerup', onDraftUp);
    const layer = draftLayer();
    if (!draftDown || !layer) return;
    // Press-drag-release creates the drawing in one gesture; a plain click waits for a second click.
    if (Math.hypot(e.clientX - draftDown.x, e.clientY - draftDown.y) > DRAG_THRESHOLD) {
      const m = local(e, layer);
      const p = toData(layer, m.x, m.y);
      if (p) finishDraft(p);
    }
    draftDown = null;
  };

  // ───────────── dragging ─────────────
  const onDragMove = (e: PointerEvent) => {
    if (!drag) return;
    const s = store();
    const d = s.find(drag.id);
    const layer = layerFor(drag.pane);
    if (!d || !layer) return;
    const m = local(e, layer);
    if (drag.kind === 'anchor') {
      const p = toData(layer, m.x, m.y);
      if (p) s.update(d.id, { points: applyAnchor(d, drag.index, p) });
      return;
    }
    const l = rawLogical(m.x);
    const price = layer.series.coordinateToPrice(m.y);
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
    const m = local(e);
    const vp = m.layer?.primitive.viewport();
    if (s.tool !== 'cursor' || !vp || !m.layer) return;
    const hit = hitTestAll(m.layer.primitive.drawings(), vp, m, s.selectedId);
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
