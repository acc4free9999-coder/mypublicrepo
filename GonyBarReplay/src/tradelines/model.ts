import { pnlOf } from '@/engine/matchingEngine';
import type { TradingBook } from '@/engine/matchingEngine';
import type { TicketDraft } from '@/store/useTradingStore';
import type { Side } from '@/types';

export type TradeLineKind =
  | 'position'
  | 'pos-sl'
  | 'pos-tp'
  /** Ghost bracket being created by dragging a position line. */
  | 'pos-new'
  | 'order'
  | 'order-sl'
  | 'order-tp'
  | 'ticket-entry'
  | 'ticket-sl'
  | 'ticket-tp';

export interface TradeLine {
  key: string;
  kind: TradeLineKind;
  /** Position / order id, or 'ticket'. */
  refId: string;
  price: number;
  color: string;
  dash: 'solid' | 'dashed' | 'dotted';
  title: string;
  /** Money result if price reaches this level (or the live unrealized PnL for a position). */
  pnl?: number;
  draggable: boolean;
  closable: boolean;
  /** Shows a ✓ button that submits the order ticket. */
  submittable?: boolean;
  preview?: boolean;
}

export interface TradeDrag {
  key: string;
  price: number;
}

export const LONG = '#22c55e';
export const SHORT = '#f43f5e';
export const SL_COLOR = '#f43f5e';
export const TP_COLOR = '#22c55e';
export const ORDER_COLOR = '#38bdf8';

const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
const sideLabel = (s: Side) => (s === 'buy' ? 'Buy' : 'Sell');

export interface TradeLineInput {
  book: TradingBook;
  ticket: TicketDraft;
  /** Lots the ticket would submit (resolved from fixed size or risk %). */
  ticketLots: number;
  /** Units per lot for the active symbol (ticket PnL). */
  contractSize: number;
  market: number;
  showTicket: boolean;
}

/** Which bracket a position-line drag to `price` would create. */
export const bracketForDrag = (side: Side, market: number, price: number): 'sl' | 'tp' =>
  (side === 'buy' ? price > market : price < market) ? 'tp' : 'sl';

/**
 * Builds every chart line for positions, pending orders and the order-ticket
 * preview. When `drag` is set, the dragged line (and anything attached to it)
 * is rendered at the drag price so the user gets live PnL feedback.
 */
export function buildTradeLines({ book, ticket, ticketLots, contractSize, market, showTicket }: TradeLineInput, drag: TradeDrag | null = null): TradeLine[] {
  const out: TradeLine[] = [];
  const at = (key: string, price: number) => (drag?.key === key ? drag.price : price);

  for (const p of book.positions) {
    const long = p.side === 'buy';
    const key = `pos:${p.id}`;
    out.push({
      key,
      kind: 'position',
      refId: p.id,
      price: p.entryPrice,
      color: long ? LONG : SHORT,
      dash: 'solid',
      title: `${long ? 'LONG' : 'SHORT'} ${p.qty}`,
      pnl: p.unrealizedPnl,
      draggable: true,
      closable: true,
    });
    if (drag?.key === key) {
      const which = bracketForDrag(p.side, market, drag.price);
      out.push({
        key: `${key}:new`,
        kind: 'pos-new',
        refId: p.id,
        price: drag.price,
        color: which === 'tp' ? TP_COLOR : SL_COLOR,
        dash: 'dashed',
        title: which.toUpperCase(),
        pnl: pnlOf(p.side, p.qty, p.entryPrice, drag.price, p.contractSize),
        draggable: false,
        closable: false,
      });
    }
    if (p.stopLoss != null) {
      const k = `pos-sl:${p.id}`;
      const price = at(k, p.stopLoss);
      out.push({ key: k, kind: 'pos-sl', refId: p.id, price, color: SL_COLOR, dash: 'dashed', title: 'SL', pnl: pnlOf(p.side, p.qty, p.entryPrice, price, p.contractSize), draggable: true, closable: true });
    }
    if (p.takeProfit != null) {
      const k = `pos-tp:${p.id}`;
      const price = at(k, p.takeProfit);
      out.push({ key: k, kind: 'pos-tp', refId: p.id, price, color: TP_COLOR, dash: 'dashed', title: 'TP', pnl: pnlOf(p.side, p.qty, p.entryPrice, price, p.contractSize), draggable: true, closable: true });
    }
  }

  for (const o of book.pendingOrders) {
    if (o.price == null) continue;
    const key = `ord:${o.id}`;
    const price = at(key, o.price);
    const delta = price - o.price;
    out.push({ key, kind: 'order', refId: o.id, price, color: ORDER_COLOR, dash: 'dotted', title: `${sideLabel(o.side)} ${o.type === 'limit' ? 'Limit' : 'Stop'} ${o.qty}`, draggable: true, closable: true });
    if (o.stopLoss != null) {
      const k = `ord-sl:${o.id}`;
      const sl = at(k, o.stopLoss + delta);
      out.push({ key: k, kind: 'order-sl', refId: o.id, price: sl, color: SL_COLOR, dash: 'dotted', title: 'SL', pnl: pnlOf(o.side, o.qty, price, sl, o.contractSize), draggable: true, closable: true });
    }
    if (o.takeProfit != null) {
      const k = `ord-tp:${o.id}`;
      const tp = at(k, o.takeProfit + delta);
      out.push({ key: k, kind: 'order-tp', refId: o.id, price: tp, color: TP_COLOR, dash: 'dotted', title: 'TP', pnl: pnlOf(o.side, o.qty, price, tp, o.contractSize), draggable: true, closable: true });
    }
  }

  if (showTicket && ticket.preview) {
    const qty = ticketLots;
    const baseEntry = ticket.type === 'market' ? market : num(ticket.price);
    if (baseEntry != null && Number.isFinite(baseEntry)) {
      const entry = ticket.type === 'market' ? market : at('tk:entry', baseEntry);
      const delta = entry - baseEntry;
      const sideColor = ticket.side === 'buy' ? LONG : SHORT;
      if (ticket.type !== 'market') {
        out.push({
          key: 'tk:entry',
          kind: 'ticket-entry',
          refId: 'ticket',
          price: entry,
          color: sideColor,
          dash: 'dashed',
          title: `${sideLabel(ticket.side)} ${ticket.type === 'limit' ? 'Limit' : 'Stop'} ${qty}`,
          draggable: true,
          closable: true,
          submittable: true,
          preview: true,
        });
      }
      const sl = ticket.slOn ? num(ticket.sl) : undefined;
      if (sl != null && Number.isFinite(sl)) {
        const price = at('tk:sl', sl + delta);
        out.push({ key: 'tk:sl', kind: 'ticket-sl', refId: 'ticket', price, color: SL_COLOR, dash: 'dashed', title: 'SL', pnl: pnlOf(ticket.side, qty, entry, price, contractSize), draggable: true, closable: true, preview: true });
      }
      const tp = ticket.tpOn ? num(ticket.tp) : undefined;
      if (tp != null && Number.isFinite(tp)) {
        const price = at('tk:tp', tp + delta);
        out.push({ key: 'tk:tp', kind: 'ticket-tp', refId: 'ticket', price, color: TP_COLOR, dash: 'dashed', title: 'TP', pnl: pnlOf(ticket.side, qty, entry, price, contractSize), draggable: true, closable: true, preview: true });
      }
    }
  }
  return out;
}
