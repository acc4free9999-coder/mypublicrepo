import { TIMEFRAMES, type Candle, type Timeframe } from '@/types';

/** Twelve Data (https://twelvedata.com) REST client — one request per symbol × timeframe, no streaming. */

const API = 'https://api.twelvedata.com/time_series';
/** Max bars per request on every plan; each request costs 1 API credit regardless of size. */
export const MAX_OUTPUT = 5000;
const REQUEST_TIMEOUT_MS = 20_000;

export const TD_SYMBOLS: Record<string, string> = {
  XAUUSD: 'XAU/USD',
  EURUSD: 'EUR/USD',
  AUDUSD: 'AUD/USD',
  BTCUSD: 'BTC/USD',
  ETHUSD: 'ETH/USD',
  SPX: 'SPX',
};

const TD_INTERVALS: Record<Timeframe, string> = {
  '5m': '5min',
  '15m': '15min',
  '1h': '1h',
  '4h': '4h',
  '1d': '1day',
  '1w': '1week',
  '1M': '1month',
};

interface TdValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

interface TdResponse {
  status: 'ok' | 'error';
  code?: number;
  message?: string;
  values?: TdValue[];
}

export class TwelveDataError extends Error {
  constructor(message: string, readonly code?: number) {
    super(message);
  }
}

/** Parses "2026-09-25 20:45:00" / "2026-09-25" (requested with timezone=UTC) into unix seconds. */
export function parseTdTime(dt: string): number {
  const iso = dt.length <= 10 ? `${dt}T00:00:00Z` : `${dt.replace(' ', 'T')}Z`;
  return Math.floor(Date.parse(iso) / 1000);
}

/** Converts a Twelve Data response into ascending, de-duplicated candles. Forex has no volume → 0. */
export function parseTdValues(values: TdValue[]): Candle[] {
  const out: Candle[] = [];
  for (const v of values) {
    const c: Candle = {
      time: parseTdTime(v.datetime),
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: Number(v.volume ?? 0) || 0,
    };
    if (![c.time, c.open, c.high, c.low, c.close].every(Number.isFinite)) continue;
    out.push(c);
  }
  out.sort((a, b) => a.time - b.time);
  return out.filter((c, i) => i === 0 || c.time !== out[i - 1].time);
}

export async function fetchTimeSeries(symbol: string, tf: Timeframe, apiKey: string, signal?: AbortSignal): Promise<Candle[]> {
  const tdSymbol = TD_SYMBOLS[symbol];
  if (!tdSymbol) throw new TwelveDataError(`${symbol} is not mapped to a Twelve Data symbol`);
  const params = new URLSearchParams({
    symbol: tdSymbol,
    interval: TD_INTERVALS[tf],
    outputsize: String(MAX_OUTPUT),
    timezone: 'UTC',
    order: 'asc',
    apikey: apiKey,
  });
  let res: Response;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  try {
    res = await fetch(`${API}?${params}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  } catch (e) {
    if (signal?.aborted) throw e;
    if (timeout.aborted) throw new TwelveDataError(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    throw new TwelveDataError('Network error — check your connection');
  }
  const body = (await res.json().catch(() => null)) as TdResponse | null;
  if (!body) throw new TwelveDataError(`HTTP ${res.status}`, res.status);
  if (body.status !== 'ok' || !body.values) throw new TwelveDataError(body.message ?? `HTTP ${res.status}`, body.code ?? res.status);
  const candles = parseTdValues(body.values);
  if (candles.length < 2) throw new TwelveDataError(`No ${tf} data returned for ${tdSymbol}`);
  return candles;
}

export interface FetchProgress {
  tf: Timeframe;
  done: number;
  total: number;
}

/**
 * Fetches every chart timeframe for `symbol` sequentially (7 requests = 7 credits;
 * the free plan allows 8/min). Returns what succeeded; throws only if nothing did.
 */
export async function fetchAllTimeframes(
  symbol: string,
  apiKey: string,
  onProgress?: (p: FetchProgress) => void,
  signal?: AbortSignal,
): Promise<{ series: Partial<Record<Timeframe, Candle[]>>; errors: string[] }> {
  const series: Partial<Record<Timeframe, Candle[]>> = {};
  const errors: string[] = [];
  for (let i = 0; i < TIMEFRAMES.length; i++) {
    const tf = TIMEFRAMES[i];
    onProgress?.({ tf, done: i, total: TIMEFRAMES.length });
    try {
      series[tf] = await fetchTimeSeries(symbol, tf, apiKey, signal);
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      const err = e as TwelveDataError;
      errors.push(`${tf}: ${err.message}`);
      // Bad key / plan / rate limit won't fix itself on the next timeframe.
      if (err.code === 401 || err.code === 403 || err.code === 429) break;
    }
  }
  if (!Object.keys(series).length) throw new TwelveDataError(errors[0] ?? 'No data');
  return { series, errors };
}
