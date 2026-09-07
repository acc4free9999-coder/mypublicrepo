export type PeriodKey = 'day' | 'week' | 'month' | 'year';
export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1';

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Account {
  id: number;
  name: string;
  login: string;
  server: string;
  broker: string;
  provider: string;
  currency: string;
  starting_balance: number;
  balance: number;
  equity: number;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  status_message: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface Trade {
  id: number;
  account_id: number;
  ticket: string;
  symbol: string;
  direction: 'buy' | 'sell';
  volume: number;
  open_time: string;
  close_time: string | null;
  open_price: number;
  close_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  profit: number;
  commission: number;
  swap: number;
  net_profit: number;
  pips: number | null;
  duration_seconds: number | null;
  is_open: boolean;
  comment: string | null;
}

export interface TradePage {
  items: Trade[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface PeriodStats {
  period: string;
  period_start: string;
  period_end: string;
  total_trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate: number;
  net_pl: number;
  gross_profit: number;
  gross_loss: number;
  average_win: number;
  average_loss: number;
  profit_factor: number | null;
  largest_win: number;
  largest_loss: number;
}

export interface AnalyticsSummary {
  period: PeriodKey;
  overall: PeriodStats;
  buckets: PeriodStats[];
  equity_curve: { time: string; equity: number }[];
  by_symbol: {
    symbol: string;
    total_trades: number;
    wins: number;
    losses: number;
    win_rate: number;
    net_pl: number;
  }[];
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeChart {
  trade: Trade;
  timeframe: Timeframe;
  candles: Candle[];
  markers: { time: number; kind: 'entry' | 'exit'; price: number; label: string }[];
  stop_loss: number | null;
  take_profit: number | null;
}

export interface ImportResult {
  account_id: number;
  filename: string;
  trades_found: number;
  trades_imported: number;
  message: string;
}

export interface TradeFilters {
  account_id?: number | null;
  symbol?: string;
  direction?: 'buy' | 'sell' | '';
  result?: 'win' | 'loss' | '';
  from?: string;
  to?: string;
  search?: string;
}
