import type { Candle, SymbolInfo, UnixTime } from '@/types';

/** `[YYYY-MM-DD, price]` — real-world reference closes the synthetic path is bridged through. */
type Anchor = [string, number];

export interface SymbolSpec extends SymbolInfo {
  /** Annualised volatility used by the random walk. */
  annualVol: number;
  /** Mean volume of a 15m bar. */
  baseVolume: number;
  seed: number;
  /** Unit name for one contract (oz / coins / units). */
  unit: string;
  /** Default ticket size in lots. */
  defaultQty: number;
  /** '24/5' = FX-style week: closed Fri 21:00 → Sun 22:00 UTC. */
  session: '24/7' | '24/5';
  anchors: Anchor[];
}

export const SYMBOLS: SymbolSpec[] = [
  {
    symbol: 'XAUUSD', description: 'Gold Spot / US Dollar', pricePrecision: 2, qtyStep: 0.01, unit: 'oz', contractSize: 100, defaultQty: 0.1, annualVol: 0.16, baseVolume: 900, seed: 9001, session: '24/5',
    anchors: [['2021-01-01', 1898], ['2021-12-31', 1829], ['2022-03-08', 2050], ['2022-09-28', 1615], ['2022-12-31', 1824], ['2023-12-31', 2063], ['2024-10-30', 2790], ['2024-12-31', 2625], ['2025-04-22', 3430], ['2025-06-30', 3300], ['2025-10-17', 4250], ['2026-09-27', 4285]],
  },
  {
    symbol: 'EURUSD', description: 'Euro / US Dollar', pricePrecision: 5, qtyStep: 0.01, unit: 'EUR', contractSize: 100_000, defaultQty: 0.1, annualVol: 0.07, baseVolume: 3750, seed: 2024, session: '24/5',
    anchors: [['2021-01-01', 1.2215], ['2021-12-31', 1.137], ['2022-09-27', 0.9565], ['2022-12-31', 1.0705], ['2023-07-18', 1.1245], ['2023-12-31', 1.1039], ['2024-12-31', 1.0354], ['2025-06-30', 1.1787], ['2026-09-27', 1.1505]],
  },
  {
    symbol: 'AUDUSD', description: 'Australian Dollar / US Dollar', pricePrecision: 5, qtyStep: 0.01, unit: 'AUD', contractSize: 100_000, defaultQty: 0.1, annualVol: 0.09, baseVolume: 2700, seed: 3131, session: '24/5',
    anchors: [['2021-01-01', 0.7695], ['2021-12-31', 0.7263], ['2022-10-13', 0.6200], ['2022-12-31', 0.6812], ['2023-12-31', 0.6820], ['2024-12-31', 0.6188], ['2025-04-09', 0.5930], ['2025-06-30', 0.6560], ['2026-09-27', 0.7100]],
  },
  {
    symbol: 'BTCUSD', description: 'Bitcoin / US Dollar', pricePrecision: 2, qtyStep: 0.01, unit: 'BTC', contractSize: 1, defaultQty: 0.1, annualVol: 0.5, baseVolume: 180, seed: 1337, session: '24/7',
    anchors: [['2021-01-01', 29000], ['2021-04-14', 63500], ['2021-07-20', 29800], ['2021-11-10', 68000], ['2021-12-31', 46200], ['2022-06-18', 19000], ['2022-12-31', 16550], ['2023-12-31', 42300], ['2024-03-14', 73000], ['2024-12-31', 93400], ['2025-06-30', 107000], ['2025-10-06', 124000], ['2026-02-05', 70000], ['2026-09-27', 77500]],
  },
  {
    symbol: 'ETHUSD', description: 'Ethereum / US Dollar', pricePrecision: 2, qtyStep: 0.01, unit: 'ETH', contractSize: 1, defaultQty: 1, annualVol: 0.65, baseVolume: 2100, seed: 4242, session: '24/7',
    anchors: [['2021-01-01', 730], ['2021-05-12', 4150], ['2021-07-20', 1780], ['2021-11-10', 4800], ['2021-12-31', 3680], ['2022-06-18', 1000], ['2022-12-31', 1196], ['2023-12-31', 2282], ['2024-12-31', 3330], ['2025-04-08', 1470], ['2025-06-30', 2480], ['2026-09-27', 2700]],
  },
  {
    symbol: 'SPX', description: 'S&P 500 Index CFD', pricePrecision: 2, qtyStep: 0.1, unit: 'units', contractSize: 1, defaultQty: 1, annualVol: 0.18, baseVolume: 13500, seed: 777, session: '24/5',
    anchors: [['2021-01-01', 3756], ['2021-12-31', 4766], ['2022-10-12', 3577], ['2022-12-31', 3840], ['2023-12-31', 4770], ['2024-12-31', 5882], ['2025-04-08', 4980], ['2025-06-30', 6205], ['2026-09-27', 7650]],
  },
];

export const getSymbolSpec = (symbol: string): SymbolSpec => {
  const spec = SYMBOLS.find((s) => s.symbol === symbol);
  if (!spec) throw new Error(`Unknown symbol ${symbol}`);
  return spec;
};

export const BASE_SECONDS = 900;
export const HISTORY_START: UnixTime = Date.UTC(2021, 0, 1) / 1000;

/** Open time of the last fully closed 15m bar. */
export const latestClosedBarTime = (nowMs = Date.now()): UnixTime => Math.floor(nowMs / 1000 / BASE_SECONDS) * BASE_SECONDS - BASE_SECONDS;

/** FX-style trading week: closed from Friday 21:00 to Sunday 22:00 UTC. */
export function isMarketOpen(time: UnixTime, session: SymbolSpec['session']): boolean {
  if (session === '24/7') return true;
  const dow = (Math.floor(time / 86400) + 4) % 7; // 0 = Sunday
  const hour = Math.floor((time % 86400) / 3600);
  if (dow === 6) return false;
  if (dow === 5 && hour >= 21) return false;
  if (dow === 0 && hour < 22) return false;
  return true;
}

/** Deterministic PRNG so every session replays the same history. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function lastAtOrBefore(sorted: number[], t: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

const round = (v: number, p: number) => Math.round(v * 10 ** p) / 10 ** p;

/**
 * Generates 15m OHLCV bars from 2021-01-01 up to `endTime` using a regime-switching
 * log random walk with volatility clustering, weekend gaps and intraday volume
 * seasonality. The path is then bridged (linear log correction) through the
 * symbol's real-world anchor prices so the long-term shape and today's level
 * look familiar, while every intraday move stays synthetic.
 */
export function generateBaseCandles(spec: SymbolSpec, endTime: UnixTime = latestClosedBarTime()): Candle[] {
  const rand = mulberry32(spec.seed);
  const barsPerYear = (spec.session === '24/7' ? 365 : 260) * (86400 / BASE_SECONDS);
  const barVol = spec.annualVol / Math.sqrt(barsPerYear);

  // Log-linear guide path through the anchors; the walk mean-reverts towards it
  // (half-life ≈ 3 weeks) so it wanders realistically without exploding.
  const guideT = spec.anchors.map(([d]) => Date.parse(`${d}T00:00:00Z`) / 1000);
  const guideL = spec.anchors.map(([, px]) => Math.log(px));
  let g = 0;
  const guide = (t: number) => {
    while (g < guideT.length - 2 && guideT[g + 1] <= t) g++;
    if (t <= guideT[0]) return guideL[0];
    if (t >= guideT[guideT.length - 1]) return guideL[guideL.length - 1];
    return guideL[g] + ((guideL[g + 1] - guideL[g]) * (t - guideT[g])) / (guideT[g + 1] - guideT[g]);
  };
  const kappa = Math.LN2 / (21 * 86400 / BASE_SECONDS);

  const times: number[] = [];
  const logs: [number, number, number, number][] = [];
  const vols: number[] = [];
  let logP = guideL[0];
  let logRegime = 0;
  let volRegime = 1;
  let drift = 0;
  let gap = false;

  for (let t = HISTORY_START; t <= endTime; t += BASE_SECONDS) {
    if (!isMarketOpen(t, spec.session)) {
      gap = true;
      continue;
    }
    // Slowly-varying regimes (≈ daily) produce realistic trends & quiet/wild periods.
    if (times.length % 96 === 0) {
      logRegime = 0.95 * logRegime + 0.12 * gaussian(rand);
      volRegime = Math.min(3, Math.max(0.4, Math.exp(logRegime)));
      drift = gaussian(rand) * barVol * 0.02;
    }
    const sigma = barVol * volRegime;
    const open = gap ? logP + gaussian(rand) * sigma * 3 : logP;
    gap = false;
    const ret = drift + kappa * (guide(t) - open) + sigma * gaussian(rand);
    const close = open + ret;
    const high = Math.max(open, close) + Math.abs(gaussian(rand)) * sigma * 0.6;
    const low = Math.min(open, close) - Math.abs(gaussian(rand)) * sigma * 0.6;

    const hourUtc = Math.floor((t % 86400) / 3600);
    const session = 0.5 + Math.exp(-((hourUtc - 14) ** 2) / 12) + 0.4 * Math.exp(-((hourUtc - 8) ** 2) / 6);
    vols.push(spec.baseVolume * session * volRegime * (0.5 + rand()) * (1 + Math.abs(ret) / sigma));
    times.push(t);
    logs.push([open, high, low, close]);
    logP = close;
  }

  const n = times.length;
  if (n === 0) return [];

  // Bridge the raw path through the anchors.
  const knots: { i: number; corr: number }[] = [];
  for (const [date, price] of spec.anchors) {
    const t = Date.parse(`${date}T00:00:00Z`) / 1000;
    const i = Math.max(0, Math.min(n - 1, lastAtOrBefore(times, t)));
    const corr = Math.log(price) - logs[i][3];
    if (knots.length && knots[knots.length - 1].i >= i) knots[knots.length - 1] = { i, corr };
    else knots.push({ i, corr });
  }

  const p = spec.pricePrecision;
  const out: Candle[] = new Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    while (k < knots.length - 1 && knots[k + 1].i <= i) k++;
    const a = knots[k];
    const b = knots[k + 1];
    const corr = !b || i <= a.i ? a.corr : a.corr + ((b.corr - a.corr) * (i - a.i)) / (b.i - a.i);
    const [o, h, l, c] = logs[i];
    const px = (x: number) => round(Math.exp(x + corr), p);
    out[i] = { time: times[i], open: px(o), high: px(h), low: px(l), close: px(c), volume: round(vols[i], 2) };
  }
  return out;
}

const cache = new Map<string, Candle[]>();

export function getBaseCandles(symbol: string): Candle[] {
  let data = cache.get(symbol);
  if (!data) {
    data = generateBaseCandles(getSymbolSpec(symbol));
    cache.set(symbol, data);
  }
  return data;
}
