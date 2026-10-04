import type { Candle, ClosedTrade, CloseReason, Order, Position, TradeEvent, UnixTime } from '@/types';

/**
 * Pure, framework-agnostic order book + matching engine.
 *
 * The engine never looks ahead: it is fed one base (15m) bar at a time by the replay
 * loop and resolves the intra-bar price path with the conventional OHLC
 * heuristic:
 *    bullish bar (close >= open):  O → L → H → C
 *    bearish bar (close <  open):  O → H → L → C
 *
 * Every pending order and every SL/TP is modelled as a *trigger*
 * (a price level + a direction). Walking the path segment by segment, the
 * engine repeatedly fires the nearest trigger crossed, so fills, bracket
 * exits and positions opened mid-bar are all handled in chronological order.
 * Gaps (a trigger already satisfied at the bar open) fill at the open price,
 * which models stop slippage and limit price-improvement.
 */

export interface TradingBook {
  pendingOrders: Order[];
  orderHistory: Order[]; // filled / cancelled / rejected (newest first)
  positions: Position[];
  closedTrades: ClosedTrade[]; // newest first
  realizedPnl: number;
}

export const emptyBook = (): TradingBook => ({
  pendingOrders: [],
  orderHistory: [],
  positions: [],
  closedTrades: [],
  realizedPnl: 0,
});

export type IdFactory = (prefix: string) => string;

let seq = 0;
export const defaultIdFactory: IdFactory = (prefix) => `${prefix}-${(++seq).toString(36)}-${Date.now().toString(36)}`;

export interface EngineResult {
  book: TradingBook;
  events: TradeEvent[];
}

type TriggerKind = 'stop_loss' | 'take_profit' | 'order';

interface Trigger {
  kind: TriggerKind;
  refId: string;
  level: number;
  /** 'down' fires when price <= level, 'up' fires when price >= level. */
  dir: 'up' | 'down';
}

const KIND_PRIORITY: Record<TriggerKind, number> = { stop_loss: 0, take_profit: 1, order: 2 };

const isSatisfied = (t: Trigger, price: number) => (t.dir === 'down' ? price <= t.level : price >= t.level);

export const pnlOf = (side: Position['side'], qty: number, entry: number, exit: number, contractSize = 1) =>
  (side === 'buy' ? exit - entry : entry - exit) * qty * contractSize;

function collectTriggers(book: TradingBook): Trigger[] {
  const out: Trigger[] = [];
  for (const o of book.pendingOrders) {
    if (o.price == null) continue;
    // buy limit / sell stop fire on the way down; sell limit / buy stop on the way up.
    const down = (o.side === 'buy') === (o.type === 'limit');
    out.push({ kind: 'order', refId: o.id, level: o.price, dir: down ? 'down' : 'up' });
  }
  for (const p of book.positions) {
    const long = p.side === 'buy';
    if (p.stopLoss != null) out.push({ kind: 'stop_loss', refId: p.id, level: p.stopLoss, dir: long ? 'down' : 'up' });
    if (p.takeProfit != null) out.push({ kind: 'take_profit', refId: p.id, level: p.takeProfit, dir: long ? 'up' : 'down' });
  }
  return out;
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 5 });

/** Fills an order at `price`, moving it to history and opening a position. Mutates `book`. */
function fillOrderMut(book: TradingBook, order: Order, price: number, time: UnixTime, ids: IdFactory, events: TradeEvent[]) {
  book.pendingOrders = book.pendingOrders.filter((o) => o.id !== order.id);
  const filled: Order = { ...order, status: 'filled', filledAt: time, fillPrice: price };
  book.orderHistory = [filled, ...book.orderHistory];
  book.positions = [
    ...book.positions,
    {
      id: ids('pos'),
      symbol: order.symbol,
      side: order.side,
      qty: order.qty,
      contractSize: order.contractSize,
      entryPrice: price,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      initialStopLoss: order.stopLoss,
      openedAt: time,
      orderId: order.id,
      currentPrice: price,
      unrealizedPnl: 0,
    },
  ];
  events.push({
    id: ids('evt'),
    kind: 'order_filled',
    time,
    message: `${order.type.toUpperCase()} ${order.side.toUpperCase()} ${fmt(order.qty)} ${order.symbol} filled @ ${fmt(price)}`,
  });
}

/** Closes a position at `price`. Mutates `book`. */
function closePositionMut(book: TradingBook, pos: Position, price: number, time: UnixTime, reason: CloseReason, ids: IdFactory, events: TradeEvent[]) {
  const realizedPnl = pnlOf(pos.side, pos.qty, pos.entryPrice, price, pos.contractSize);
  const sl = pos.initialStopLoss;
  const riskUsd = sl != null ? -pnlOf(pos.side, pos.qty, pos.entryPrice, sl, pos.contractSize) : undefined;
  book.positions = book.positions.filter((p) => p.id !== pos.id);
  book.realizedPnl += realizedPnl;
  book.closedTrades = [
    {
      id: ids('trd'),
      symbol: pos.symbol,
      side: pos.side,
      qty: pos.qty,
      entryPrice: pos.entryPrice,
      exitPrice: price,
      openedAt: pos.openedAt,
      closedAt: time,
      realizedPnl,
      reason,
      // A stop at or beyond entry carries no risk, so it can't define an R-multiple.
      riskUsd: riskUsd != null && riskUsd > 0 ? riskUsd : undefined,
    },
    ...book.closedTrades,
  ];
  const label = reason === 'stop_loss' ? 'Stop loss' : reason === 'take_profit' ? 'Take profit' : 'Manual close';
  events.push({
    id: ids('evt'),
    kind: 'position_closed',
    time,
    message: `${label}: ${pos.side === 'buy' ? 'LONG' : 'SHORT'} ${fmt(pos.qty)} ${pos.symbol} @ ${fmt(price)} → PnL ${realizedPnl >= 0 ? '+' : ''}${fmt(realizedPnl)}`,
  });
}

function fireTrigger(book: TradingBook, t: Trigger, price: number, time: UnixTime, ids: IdFactory, events: TradeEvent[]) {
  if (t.kind === 'order') {
    const order = book.pendingOrders.find((o) => o.id === t.refId);
    if (order) fillOrderMut(book, order, price, time, ids, events);
  } else {
    const pos = book.positions.find((p) => p.id === t.refId);
    if (pos) closePositionMut(book, pos, price, time, t.kind, ids, events);
  }
}

/** Fires every trigger already satisfied at `price` (pessimistic priority: SL → TP → orders). */
function fireAllSatisfied(book: TradingBook, price: number, time: UnixTime, ids: IdFactory, events: TradeEvent[]) {
  // Bounded: each iteration removes at least one order or position.
  for (let guard = 0; guard < 10_000; guard++) {
    const hit = collectTriggers(book)
      .filter((t) => isSatisfied(t, price))
      .sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]);
    if (hit.length === 0) return;
    fireTrigger(book, hit[0], price, time, ids, events);
  }
}

export function intraBarPath(bar: Candle): number[] {
  return bar.close >= bar.open ? [bar.open, bar.low, bar.high, bar.close] : [bar.open, bar.high, bar.low, bar.close];
}

/**
 * Advance the book through one bar. Pending orders created at or after
 * `bar.time` are ignored for this bar (they did not exist yet).
 */
export function processBar(input: TradingBook, bar: Candle, ids: IdFactory = defaultIdFactory): EngineResult {
  const events: TradeEvent[] = [];
  const book: TradingBook = { ...input };
  const deferred = book.pendingOrders.filter((o) => o.createdAt >= bar.time);
  book.pendingOrders = book.pendingOrders.filter((o) => o.createdAt < bar.time);

  const path = intraBarPath(bar);
  let cur = path[0];
  fireAllSatisfied(book, cur, bar.time, ids, events);

  for (let i = 1; i < path.length; i++) {
    const target = path[i];
    for (let guard = 0; guard < 10_000; guard++) {
      let nearest: Trigger | null = null;
      for (const t of collectTriggers(book)) {
        if (isSatisfied(t, cur) || !isSatisfied(t, target)) continue;
        if (!nearest || Math.abs(t.level - cur) < Math.abs(nearest.level - cur)) nearest = t;
      }
      if (!nearest) break;
      cur = nearest.level;
      fireAllSatisfied(book, cur, bar.time, ids, events);
    }
    cur = target;
  }

  book.pendingOrders = [...book.pendingOrders, ...deferred];
  book.positions = markToMarket(book.positions, bar.close);
  return { book, events };
}

export function markToMarket(positions: Position[], price: number): Position[] {
  return positions.map((p) => ({ ...p, currentPrice: price, unrealizedPnl: pnlOf(p.side, p.qty, p.entryPrice, price, p.contractSize) }));
}

// ───────────────────────── Imperative book operations ─────────────────────────

export function submitOrder(input: TradingBook, order: Order, marketPrice: number, time: UnixTime, ids: IdFactory = defaultIdFactory): EngineResult {
  const events: TradeEvent[] = [];
  const book: TradingBook = { ...input };
  if (order.type === 'market') {
    fillOrderMut(book, order, marketPrice, time, ids, events);
    book.positions = markToMarket(book.positions, marketPrice);
  } else {
    book.pendingOrders = [...book.pendingOrders, order];
    events.push({
      id: ids('evt'),
      kind: 'order_placed',
      time,
      message: `${order.type.toUpperCase()} ${order.side.toUpperCase()} ${fmt(order.qty)} ${order.symbol} @ ${fmt(order.price!)} placed`,
    });
  }
  return { book, events };
}

export function cancelOrder(input: TradingBook, orderId: string, time: UnixTime, ids: IdFactory = defaultIdFactory): EngineResult {
  const order = input.pendingOrders.find((o) => o.id === orderId);
  if (!order) return { book: input, events: [] };
  return {
    book: {
      ...input,
      pendingOrders: input.pendingOrders.filter((o) => o.id !== orderId),
      orderHistory: [{ ...order, status: 'cancelled' }, ...input.orderHistory],
    },
    events: [{ id: ids('evt'), kind: 'order_cancelled', time, message: `Order ${order.type.toUpperCase()} ${order.side.toUpperCase()} @ ${fmt(order.price ?? 0)} cancelled` }],
  };
}

export function closePosition(input: TradingBook, positionId: string, price: number, time: UnixTime, ids: IdFactory = defaultIdFactory): EngineResult {
  const pos = input.positions.find((p) => p.id === positionId);
  if (!pos) return { book: input, events: [] };
  const events: TradeEvent[] = [];
  const book = { ...input };
  closePositionMut(book, pos, price, time, 'manual', ids, events);
  return { book, events };
}

export function updateBrackets(input: TradingBook, positionId: string, brackets: { stopLoss?: number; takeProfit?: number }): TradingBook {
  return {
    ...input,
    positions: input.positions.map((p) =>
      p.id === positionId ? { ...p, stopLoss: brackets.stopLoss, takeProfit: brackets.takeProfit, initialStopLoss: p.initialStopLoss ?? brackets.stopLoss } : p,
    ),
  };
}

/** Replaces the trigger price / type / brackets of a pending order. Validation is the caller's job. */
export function modifyOrder(
  input: TradingBook,
  orderId: string,
  patch: Partial<Pick<Order, 'type' | 'price' | 'stopLoss' | 'takeProfit'>>,
  time: UnixTime,
  ids: IdFactory = defaultIdFactory,
): EngineResult {
  const order = input.pendingOrders.find((o) => o.id === orderId);
  if (!order) return { book: input, events: [] };
  const next: Order = { ...order, ...patch };
  const parts = [`${next.type.toUpperCase()} ${next.side.toUpperCase()} @ ${fmt(next.price ?? 0)}`];
  if (next.stopLoss != null) parts.push(`SL ${fmt(next.stopLoss)}`);
  if (next.takeProfit != null) parts.push(`TP ${fmt(next.takeProfit)}`);
  return {
    book: { ...input, pendingOrders: input.pendingOrders.map((o) => (o.id === orderId ? next : o)) },
    events: [{ id: ids('evt'), kind: 'order_modified', time, message: `Order modified → ${parts.join(' · ')}` }],
  };
}
