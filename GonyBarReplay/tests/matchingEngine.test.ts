import { describe, expect, it } from 'vitest';
import { emptyBook, processBar, submitOrder, type TradingBook } from '@/engine/matchingEngine';
import type { Candle, Order } from '@/types';

let n = 0;
const ids = (p: string) => `${p}${++n}`;
const bar = (time: number, open: number, high: number, low: number, close: number): Candle => ({ time, open, high, low, close, volume: 1 });
const order = (o: Partial<Order>): Order => ({ id: ids('o'), symbol: 'X', side: 'buy', type: 'limit', qty: 1, status: 'pending', createdAt: 0, ...o });
const place = (book: TradingBook, o: Order, px = 100) => submitOrder(book, o, px, o.createdAt, ids).book;

describe('matching engine', () => {
  it('fills a buy limit when the low crosses and applies price improvement on gaps', () => {
    let b = place(emptyBook(), order({ price: 95 }));
    b = processBar(b, bar(60, 99, 100, 96, 98), ids).book;
    expect(b.positions).toHaveLength(0);
    b = processBar(b, bar(120, 98, 99, 94, 97), ids).book;
    expect(b.positions[0].entryPrice).toBe(95);

    // Gap below the limit fills at the (better) open.
    let g = place(emptyBook(), order({ price: 95 }));
    g = processBar(g, bar(60, 90, 92, 89, 91), ids).book;
    expect(g.positions[0].entryPrice).toBe(90);
  });

  it('fills sell stop with slippage at the open when price gaps through', () => {
    let b = place(emptyBook(), order({ side: 'sell', type: 'stop', price: 95 }));
    b = processBar(b, bar(60, 93, 94, 92, 93), ids).book;
    expect(b.positions[0]).toMatchObject({ side: 'sell', entryPrice: 93 });
  });

  it('does not fill an order on the bar it was placed on', () => {
    let b = place(emptyBook(), order({ price: 95, createdAt: 60 }));
    b = processBar(b, bar(60, 99, 100, 90, 98), ids).book;
    expect(b.positions).toHaveLength(0);
    expect(b.pendingOrders).toHaveLength(1);
  });

  it('closes a long at take profit and books realized PnL', () => {
    let b = submitOrder(emptyBook(), order({ type: 'market', qty: 2, takeProfit: 110, stopLoss: 90 }), 100, 0, ids).book;
    b = processBar(b, bar(60, 100, 111, 99, 108), ids).book;
    expect(b.positions).toHaveLength(0);
    expect(b.closedTrades[0]).toMatchObject({ reason: 'take_profit', exitPrice: 110, realizedPnl: 20 });
    expect(b.realizedPnl).toBe(20);
  });

  it('resolves SL vs TP in the same bar using the OHLC path', () => {
    // Bearish bar: O → H → L → C. High (TP) is visited before the low (SL).
    let bear = submitOrder(emptyBook(), order({ type: 'market', takeProfit: 105, stopLoss: 95 }), 100, 0, ids).book;
    bear = processBar(bear, bar(60, 100, 106, 94, 97), ids).book;
    expect(bear.closedTrades[0].reason).toBe('take_profit');

    // Bullish bar: O → L → H → C. Low (SL) first.
    let bull = submitOrder(emptyBook(), order({ type: 'market', takeProfit: 105, stopLoss: 95 }), 100, 0, ids).book;
    bull = processBar(bull, bar(60, 100, 106, 94, 103), ids).book;
    expect(bull.closedTrades[0].reason).toBe('stop_loss');
  });

  it('can fill an entry and exit it at its bracket within the same bar', () => {
    // Bullish path O(100) → L(94) → H(106): buy limit 96 fills on the way down, TP 104 on the way up.
    let b = place(emptyBook(), order({ price: 96, takeProfit: 104 }));
    b = processBar(b, bar(60, 100, 106, 94, 105), ids).book;
    expect(b.positions).toHaveLength(0);
    expect(b.closedTrades[0]).toMatchObject({ entryPrice: 96, exitPrice: 104, realizedPnl: 8 });
  });

  it('marks open positions to market for shorts', () => {
    let b = submitOrder(emptyBook(), order({ type: 'market', side: 'sell', qty: 3 }), 100, 0, ids).book;
    b = processBar(b, bar(60, 100, 101, 97, 98), ids).book;
    expect(b.positions[0]).toMatchObject({ currentPrice: 98, unrealizedPnl: 6 });
  });
});

describe('lot sizing', () => {
  it('uses the contract size: 0.01 lot XAUUSD from 4250 to 4260 = $10', async () => {
    const { pnlOf } = await import('@/engine/matchingEngine');
    const { getSymbolSpec } = await import('@/data/generator');
    const gold = getSymbolSpec('XAUUSD').contractSize;
    expect(pnlOf('buy', 0.01, 4250, 4260, gold)).toBeCloseTo(10);
    expect(pnlOf('sell', 0.01, 4250, 4260, gold)).toBeCloseTo(-10);
    // 0.1 lot EURUSD, 20 pips = $20
    expect(pnlOf('buy', 0.1, 1.15, 1.152, getSymbolSpec('EURUSD').contractSize)).toBeCloseTo(20);
  });

  it('carries the contract size from the order to the position and its realized PnL', () => {
    let b = place(emptyBook(), order({ type: 'market', qty: 0.01, contractSize: 100, takeProfit: 4260 }), 4250);
    expect(b.positions[0]).toMatchObject({ contractSize: 100, entryPrice: 4250 });
    b = processBar(b, bar(60, 4252, 4262, 4251, 4258), ids).book;
    expect(b.closedTrades[0].realizedPnl).toBeCloseTo(10);
    expect(b.realizedPnl).toBeCloseTo(10);
  });

  it('sizes a position from a risk % of the balance', async () => {
    const { riskSizedLots } = await import('@/engine/risk');
    // 1% of $10,000 = $100; SL $10 away on gold (100 oz/lot) → $1,000 per lot → 0.1 lot
    expect(riskSizedLots(10_000, 1, 4250, 4240, 100, 0.01)).toBe(0.1);
    // rounds down to the lot step
    expect(riskSizedLots(10_000, 1, 4250, 4237, 100, 0.01)).toBe(0.07);
    expect(riskSizedLots(10_000, 1, 4250, undefined, 100, 0.01)).toBe(0);
  });
});
