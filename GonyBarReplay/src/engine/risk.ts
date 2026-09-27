import type { Account, OrderType, Position, Side } from '@/types';

export interface OrderTicket {
  side: Side;
  type: OrderType;
  /** Lots. */
  qty: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
}

/** Returns a human-readable rejection reason, or null if the ticket is valid. */
/**
 * `pendingNotional` is the USD notional reserved by pending orders.
 * `contractSize` converts lots to units for the margin check.
 */
export function validateTicket(t: OrderTicket, marketPrice: number, account: Account, pendingNotional: number, contractSize = 1): string | null {
  if (!Number.isFinite(t.qty) || t.qty <= 0) return 'Quantity must be greater than 0';
  if (t.type !== 'market') {
    if (t.price == null || !Number.isFinite(t.price) || t.price <= 0) return 'Enter a valid order price';
    const buy = t.side === 'buy';
    if (t.type === 'limit' && (buy ? t.price > marketPrice : t.price < marketPrice))
      return `Buy limit must be ≤ market (${marketPrice}); sell limit must be ≥ market. Use a stop order instead.`;
    if (t.type === 'stop' && (buy ? t.price < marketPrice : t.price > marketPrice))
      return `Buy stop must be ≥ market (${marketPrice}); sell stop must be ≤ market. Use a limit order instead.`;
  }
  const entry = t.type === 'market' ? marketPrice : t.price!;
  const long = t.side === 'buy';
  if (t.stopLoss != null && (long ? t.stopLoss >= entry : t.stopLoss <= entry))
    return `Stop loss must be ${long ? 'below' : 'above'} the entry price (${entry})`;
  if (t.takeProfit != null && (long ? t.takeProfit <= entry : t.takeProfit >= entry))
    return `Take profit must be ${long ? 'above' : 'below'} the entry price (${entry})`;

  const requiredMargin = (entry * t.qty * contractSize) / account.leverage;
  const available = account.equity - account.marginUsed - pendingNotional / account.leverage;
  if (requiredMargin > available)
    return `Insufficient margin: requires $${requiredMargin.toFixed(2)}, available $${Math.max(0, available).toFixed(2)}`;
  return null;
}

export function computeAccount(initialBalance: number, leverage: number, realizedPnl: number, positions: Position[]): Account {
  let unrealizedPnl = 0;
  let notional = 0;
  for (const p of positions) {
    unrealizedPnl += p.unrealizedPnl;
    notional += p.currentPrice * p.qty * (p.contractSize ?? 1);
  }
  const balance = initialBalance + realizedPnl;
  return {
    currency: 'USD',
    initialBalance,
    balance,
    equity: balance + unrealizedPnl,
    realizedPnl,
    unrealizedPnl,
    marginUsed: notional / leverage,
    leverage,
  };
}

/** Monetary risk of `lots` between entry and stop. */
export const riskAmount = (lots: number, entry: number, stop: number, contractSize: number) => Math.abs(entry - stop) * lots * contractSize;

/**
 * Position size (lots) that loses `riskPct`% of `balance` if the stop is hit,
 * rounded down to the symbol's lot step. Returns 0 when it cannot be computed.
 */
export function riskSizedLots(balance: number, riskPct: number, entry: number, stop: number | undefined, contractSize: number, lotStep: number): number {
  if (stop == null || !(riskPct > 0) || !(balance > 0)) return 0;
  const perLot = Math.abs(entry - stop) * contractSize;
  if (!(perLot > 0)) return 0;
  const lots = Math.floor((balance * riskPct) / 100 / perLot / lotStep + 1e-9) * lotStep;
  const decimals = Math.max(0, -Math.floor(Math.log10(lotStep)));
  return Number(lots.toFixed(decimals));
}
