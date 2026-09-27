import { describe, expect, it } from 'vitest';
import { emptyBook, modifyOrder, type TradingBook } from '@/engine/matchingEngine';
import { generateBaseCandles, getSymbolSpec, isMarketOpen } from '@/data/generator';
import { bracketForDrag, buildTradeLines } from '@/tradelines/model';
import type { TicketDraft } from '@/store/useTradingStore';
import type { Order, Position } from '@/types';

const ids = (p: string) => `${p}-x`;
const ticket: TicketDraft = { side: 'buy', type: 'limit', qty: '2', price: '95', slOn: true, tpOn: true, sl: '90', tp: '110', preview: true, sizing: 'lots', riskPct: '1' };
const position: Position = { id: 'p1', symbol: 'X', side: 'buy', qty: 1, entryPrice: 100, currentPrice: 105, unrealizedPnl: 5, openedAt: 0, orderId: 'o0', stopLoss: 95 };
const order: Order = { id: 'o1', symbol: 'X', side: 'sell', type: 'limit', qty: 1, price: 120, takeProfit: 110, status: 'pending', createdAt: 0 };
const book: TradingBook = { ...emptyBook(), positions: [position], pendingOrders: [order] };

describe('trade lines', () => {
  it('builds position, order and ticket lines with PnL', () => {
    const lines = buildTradeLines({ book, ticket, ticketLots: 2, contractSize: 1, market: 105, showTicket: true });
    const byKey = Object.fromEntries(lines.map((l) => [l.key, l]));
    expect(byKey['pos:p1']).toMatchObject({ price: 100, pnl: 5 });
    expect(byKey['pos-sl:p1']).toMatchObject({ price: 95, pnl: -5 });
    expect(byKey['ord:o1']).toMatchObject({ price: 120 });
    expect(byKey['ord-tp:o1']).toMatchObject({ price: 110, pnl: 10 });
    expect(byKey['tk:entry']).toMatchObject({ price: 95, submittable: true });
    expect(byKey['tk:sl']).toMatchObject({ price: 90, pnl: -10 });
    expect(byKey['tk:tp']).toMatchObject({ price: 110, pnl: 30 });
  });

  it('hides the ticket preview outside replay', () => {
    const lines = buildTradeLines({ book, ticket, ticketLots: 2, contractSize: 1, market: 105, showTicket: false });
    expect(lines.some((l) => l.key.startsWith('tk:'))).toBe(false);
  });

  it('moves attached brackets together with a dragged order', () => {
    const lines = buildTradeLines({ book, ticket, ticketLots: 2, contractSize: 1, market: 105, showTicket: true }, { key: 'ord:o1', price: 125 });
    expect(lines.find((l) => l.key === 'ord-tp:o1')!.price).toBe(115);
    const tk = buildTradeLines({ book, ticket, ticketLots: 2, contractSize: 1, market: 105, showTicket: true }, { key: 'tk:entry', price: 97 });
    expect(tk.find((l) => l.key === 'tk:sl')!.price).toBe(92);
  });

  it('dragging a position line previews a TP or SL depending on the side of the market', () => {
    expect(bracketForDrag('buy', 105, 110)).toBe('tp');
    expect(bracketForDrag('buy', 105, 101)).toBe('sl');
    expect(bracketForDrag('sell', 105, 101)).toBe('tp');
    const lines = buildTradeLines({ book, ticket, ticketLots: 2, contractSize: 1, market: 105, showTicket: false }, { key: 'pos:p1', price: 112 });
    expect(lines.find((l) => l.kind === 'pos-new')).toMatchObject({ title: 'TP', pnl: 12 });
    expect(lines.find((l) => l.key === 'pos:p1')!.price).toBe(100); // entry itself never moves
  });
});

describe('modifyOrder', () => {
  it('replaces price / type / brackets and emits an event', () => {
    const r = modifyOrder(book, 'o1', { type: 'stop', price: 101, takeProfit: undefined }, 60, ids);
    expect(r.book.pendingOrders[0]).toMatchObject({ type: 'stop', price: 101, takeProfit: undefined });
    expect(r.events[0].kind).toBe('order_modified');
  });
});

describe('generator', () => {
  const end = Date.UTC(2026, 8, 25, 20, 45) / 1000; // Fri 20:45 UTC
  it('ends at the requested time on the latest anchor and skips FX weekends', () => {
    const spec = getSymbolSpec('EURUSD');
    const bars = generateBaseCandles(spec, end);
    expect(bars[bars.length - 1].time).toBe(end);
    expect(bars.every((b) => isMarketOpen(b.time, '24/5'))).toBe(true);
    const lastAnchor = spec.anchors[spec.anchors.length - 1][1];
    expect(Math.abs(bars[bars.length - 1].close / lastAnchor - 1)).toBeLessThan(0.02);
    for (let i = 1; i < 500; i++) expect(bars[i].time).toBeGreaterThan(bars[i - 1].time);
  });

  it('lists XAUUSD first', async () => {
    const { SYMBOLS } = await import('@/data/generator');
    expect(SYMBOLS[0].symbol).toBe('XAUUSD');
  });
});
