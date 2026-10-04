/** Unix timestamp in SECONDS (UTC) — the native time unit of Lightweight Charts. */
export type UnixTime = number;

export type Timeframe = '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';

export const TIMEFRAMES: Timeframe[] = ['5m', '15m', '1h', '4h', '1d', '1w', '1M'];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = { '5m': '5M', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W', '1M': '1M' };

/** Nominal bar duration. Weeks start Monday 00:00 UTC; months are calendar months (≈30d here). */
export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800,
  '1M': 2592000,
};

/** Resolution of the generated base series that the replay streams through the matching engine. */
export const BASE_TIMEFRAME: Timeframe = '15m';

export interface Candle {
  time: UnixTime; // bucket open time
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SymbolInfo {
  symbol: string;
  description: string;
  pricePrecision: number;
  /** Lot step for the order ticket. */
  qtyStep: number;
  /** Units per 1 lot (XAUUSD 100 oz, FX 100,000). PnL = Δprice × lots × contractSize. */
  contractSize: number;
}

// ───────────────────────────── Trading ─────────────────────────────

export type Side = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop';
export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'rejected';
export type CloseReason = 'manual' | 'stop_loss' | 'take_profit';

export interface Order {
  id: string;
  symbol: string;
  side: Side;
  type: OrderType;
  /** Size in lots. */
  qty: number;
  /** Units per lot; defaults to 1. */
  contractSize?: number;
  /** Trigger price for limit / stop orders. Undefined for market orders. */
  price?: number;
  /** Bracket levels attached to the position created when this order fills. */
  stopLoss?: number;
  takeProfit?: number;
  status: OrderStatus;
  createdAt: UnixTime;
  filledAt?: UnixTime;
  fillPrice?: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: Side; // buy = long, sell = short
  /** Size in lots. */
  qty: number;
  /** Units per lot; defaults to 1. */
  contractSize?: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: UnixTime;
  orderId: string;
  /** Mark-to-market fields, refreshed on every replay tick. */
  currentPrice: number;
  unrealizedPnl: number;
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  entryPrice: number;
  exitPrice: number;
  openedAt: UnixTime;
  closedAt: UnixTime;
  realizedPnl: number;
  reason: CloseReason;
}

export interface Account {
  currency: 'USD';
  initialBalance: number;
  /** Cash balance = initial + realized PnL. */
  balance: number;
  /** balance + unrealized PnL. */
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  /** Notional / leverage of all open positions. */
  marginUsed: number;
  leverage: number;
}

export type TradeEventKind =
  | 'order_placed'
  | 'order_filled'
  | 'order_cancelled'
  | 'order_modified'
  | 'order_rejected'
  | 'position_closed';

export interface TradeEvent {
  id: string;
  kind: TradeEventKind;
  time: UnixTime;
  message: string;
}

// ───────────────────────────── Replay ─────────────────────────────

/**
 * Replay state machine:
 *
 *   off ──enterReplay──▶ selecting ──selectCutoff──▶ paused ◀──pause── playing
 *    ▲                      │                          │  ──play──▶     │
 *    └──────exitReplay──────┴──────────────────────────┴────────────────┘
 *                                                      │ cursor == end
 *                                                      ▼
 *                                                    ended ──reset──▶ paused
 */
export type ReplayStatus = 'off' | 'selecting' | 'paused' | 'playing' | 'ended';

export type ReplaySpeed = 0.5 | 1 | 2 | 5 | 10;
export const REPLAY_SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 5, 10];

export interface ReplayState {
  status: ReplayStatus;
  /** Index into the 15m base series of the cutoff bar (last visible bar at start). */
  cutoffIndex: number | null;
  /** Index into the 15m base series of the last revealed bar (inclusive). */
  cursor: number;
  /** Candles (in the chart timeframe) revealed per second. */
  speed: ReplaySpeed;
}

// ───────────────────────────── Indicators ─────────────────────────────

export interface IndicatorSettings {
  ema: { enabled: boolean; period: number };
  volume: { enabled: boolean };
}

export interface LinePoint {
  time: UnixTime;
  value: number;
}
