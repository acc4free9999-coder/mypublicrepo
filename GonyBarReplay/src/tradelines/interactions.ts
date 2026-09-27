import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import { getSymbolSpec } from '@/data/generator';
import { useDrawingStore } from '@/store/useDrawingStore';
import { marketPrice, useTradingStore } from '@/store/useTradingStore';
import { bracketForDrag, type TradeLine } from './model';
import type { TradeLinesPrimitive } from './TradeLinesPrimitive';

interface Deps {
  container: HTMLElement;
  chart: IChartApi;
  series: ISeriesApi<SeriesType>;
  primitive: TradeLinesPrimitive;
}

const DRAG_THRESHOLD = 3;

/** Applies a finished drag of `line` to `price` through the trading store. */
export function commitTradeDrag(line: TradeLine, price: number) {
  const s = useTradingStore.getState();
  const pp = getSymbolSpec(s.symbol).pricePrecision;
  const px = Number(price.toFixed(pp));
  switch (line.kind) {
    case 'pos-sl':
    case 'pos-tp': {
      const p = s.book.positions.find((x) => x.id === line.refId);
      if (!p) return;
      if (line.kind === 'pos-sl') s.updateBrackets(p.id, px, p.takeProfit);
      else s.updateBrackets(p.id, p.stopLoss, px);
      return;
    }
    case 'position': {
      const p = s.book.positions.find((x) => x.id === line.refId);
      if (!p) return;
      if (bracketForDrag(p.side, marketPrice(s), px) === 'tp') s.updateBrackets(p.id, p.stopLoss, px);
      else s.updateBrackets(p.id, px, p.takeProfit);
      return;
    }
    case 'order': {
      const o = s.book.pendingOrders.find((x) => x.id === line.refId);
      if (!o || o.price == null) return;
      const d = px - o.price;
      const fix = (v?: number) => (v == null ? undefined : Number((v + d).toFixed(pp)));
      s.modifyOrder(o.id, { price: px, stopLoss: fix(o.stopLoss), takeProfit: fix(o.takeProfit) });
      return;
    }
    case 'order-sl':
      s.modifyOrder(line.refId, { stopLoss: px });
      return;
    case 'order-tp':
      s.modifyOrder(line.refId, { takeProfit: px });
      return;
    case 'ticket-entry':
      s.updateTicket({ price: px.toFixed(pp) }, { shiftBrackets: true });
      return;
    case 'ticket-sl':
      s.updateTicket({ sl: px.toFixed(pp) });
      return;
    case 'ticket-tp':
      s.updateTicket({ tp: px.toFixed(pp) });
      return;
  }
}

/** Handles the × button of a line. */
export function closeTradeLine(line: TradeLine) {
  const s = useTradingStore.getState();
  switch (line.kind) {
    case 'position':
      s.closePosition(line.refId);
      return;
    case 'pos-sl':
    case 'pos-tp': {
      const p = s.book.positions.find((x) => x.id === line.refId);
      if (p) s.updateBrackets(p.id, line.kind === 'pos-sl' ? undefined : p.stopLoss, line.kind === 'pos-tp' ? undefined : p.takeProfit);
      return;
    }
    case 'order':
      s.cancelOrder(line.refId);
      return;
    case 'order-sl':
      s.modifyOrder(line.refId, { stopLoss: undefined });
      return;
    case 'order-tp':
      s.modifyOrder(line.refId, { takeProfit: undefined });
      return;
    case 'ticket-entry':
      s.updateTicket({ preview: false });
      return;
    case 'ticket-sl':
      s.updateTicket({ slOn: false });
      return;
    case 'ticket-tp':
      s.updateTicket({ tpOn: false });
      return;
  }
}

/**
 * Pointer handling for trade lines. Must be registered before the drawing
 * interactions: on a hit it stops the event (capture phase) so neither the
 * drawing layer nor Lightweight Charts' panning sees it.
 */
export function attachTradeInteractions({ container, chart, series, primitive }: Deps): () => void {
  let active: { line: TradeLine; startY: number; moved: boolean } | null = null;
  let swallowMouse = false;

  const local = (e: MouseEvent) => {
    const r = container.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const paneH = chart.panes()[0]?.getHeight() ?? 0;
    return { x, y, inside: x >= 0 && y >= 0 && x <= chart.timeScale().width() && y <= paneH };
  };

  const enabled = () => useTradingStore.getState().replay.status !== 'selecting' && useDrawingStore.getState().tool === 'cursor';

  const stop = (e: Event) => {
    e.stopImmediatePropagation();
    e.preventDefault();
    swallowMouse = true;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || !enabled()) return;
    const m = local(e);
    if (!m.inside) return;
    const hit = primitive.hit(m.x, m.y);
    if (!hit) return;
    stop(e);
    if (hit.part === 'close') {
      closeTradeLine(hit.line);
      return;
    }
    if (hit.part === 'submit') {
      useTradingStore.getState().submitTicket();
      return;
    }
    if (!hit.line.draggable) return;
    active = { line: hit.line, startY: m.y, moved: false };
    useDrawingStore.getState().select(null);
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
  };

  const onDragMove = (e: PointerEvent) => {
    if (!active) return;
    const m = local(e);
    if (!active.moved && Math.abs(m.y - active.startY) < DRAG_THRESHOLD) return;
    active.moved = true;
    const price = series.coordinateToPrice(m.y) as number | null;
    if (price == null || !(price > 0)) return;
    primitive.drag = { key: active.line.key, price };
    primitive.requestUpdate();
  };

  const onDragUp = () => {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    const a = active;
    const drag = primitive.drag;
    active = null;
    primitive.drag = null;
    if (a?.moved && drag) commitTradeDrag(a.line, drag.price);
    primitive.requestUpdate();
  };

  const onHover = (e: PointerEvent) => {
    if (active) return;
    const m = local(e);
    const key = enabled() && m.inside ? (primitive.hit(m.x, m.y)?.line.key ?? null) : null;
    if (key !== primitive.hover) {
      primitive.hover = key;
      primitive.requestUpdate();
    }
  };

  const onCompatDown = (e: Event) => {
    if (swallowMouse) {
      e.stopImmediatePropagation();
      swallowMouse = false;
    }
  };

  container.addEventListener('pointerdown', onPointerDown, true);
  container.addEventListener('mousedown', onCompatDown, true);
  container.addEventListener('touchstart', onCompatDown, true);
  container.addEventListener('pointermove', onHover);

  return () => {
    container.removeEventListener('pointerdown', onPointerDown, true);
    container.removeEventListener('mousedown', onCompatDown, true);
    container.removeEventListener('touchstart', onCompatDown, true);
    container.removeEventListener('pointermove', onHover);
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
  };
}
