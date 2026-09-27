import { aggregate, bucketStart } from './aggregate';
import { TIMEFRAME_SECONDS, TIMEFRAMES, type Candle, type Timeframe } from '@/types';

/**
 * OHLC(V) text-file import with format auto-detection:
 * - MT5 "Bars → Export" (tab-separated, `<DATE> <TIME> <OPEN> … <TICKVOL> <VOL> <SPREAD>`)
 * - MT4 History Center export (no header: `2026.09.25,20:45,o,h,l,c,v`)
 * - GonyExportBars.mq5 script / TradingView chart export (`time,open,high,low,close,Volume`, unix or ISO time)
 * - Dukascopy (`Gmt time,Open,High,Low,Close,Volume`, `25.09.2026 20:45:00.000`)
 * - Binance klines CSV (no header, open time in ms)
 * - Any CSV/TSV/semicolon file with date/time + open/high/low/close columns
 */

export type ImportFormat = 'MT5' | 'MT4' | 'TradingView' | 'Dukascopy' | 'Binance' | 'CSV';

export interface ParseOptions {
  /** Offset of naive (zone-less) intraday timestamps, e.g. 180 for broker server time UTC+3. */
  tzOffsetMinutes?: number;
  /** Target timeframe; 'auto' detects it from the bar spacing. Finer files are aggregated up. */
  timeframe?: Timeframe | 'auto';
}

export interface ParsedBars {
  candles: Candle[];
  timeframe: Timeframe;
  format: ImportFormat;
  /** Bar spacing found in the file, in seconds. */
  intervalSec: number;
  /** Number of source bars when they were aggregated into `timeframe`. */
  aggregatedFrom?: number;
  skipped: number;
}

export class ImportError extends Error {}

const DAY = 86400;
const MONTH_MIN = 27 * DAY;
const MONTH_MAX = 32 * DAY;

type Col = 'date' | 'time' | 'datetime' | 'open' | 'high' | 'low' | 'close' | 'volume';

const HEADER_ALIASES: Record<string, Col> = {
  date: 'date',
  day: 'date',
  time: 'time',
  datetime: 'datetime',
  'date/time': 'datetime',
  timestamp: 'datetime',
  gmttime: 'datetime',
  localtime: 'datetime',
  opentime: 'datetime',
  timeutc: 'datetime',
  datetimeutc: 'datetime',
  open: 'open',
  o: 'open',
  high: 'high',
  h: 'high',
  low: 'low',
  l: 'low',
  close: 'close',
  c: 'close',
  last: 'close',
  price: 'close',
};
/** Volume column preference (MT5 has TICKVOL + VOL; VOL is 0 for FX/CFDs). */
const VOLUME_PREF = ['volume', 'tickvol', 'tickvolume', 'vol', 'realvolume', 'v'];

const normHeader = (s: string) => s.replace(/^<|>$/g, '').toLowerCase().replace(/[\s_"'<>]/g, '');
const isNumeric = (s: string) => /^[-+]?(\d+([.,]\d*)?|[.,]\d+)(e[-+]?\d+)?$/i.test(s);
const TIME_ONLY = /^\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?$/;

function detectDelimiter(line: string): string {
  const counts = ['\t', ';', ','].map((d) => [d, line.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

const splitRow = (line: string, delim: string) => line.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, '$1').trim());

interface ParsedTime {
  t: number;
  /** True when the string carried no zone (so the user's time-zone setting applies). */
  naive: boolean;
}

const YMD = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|UTC|GMT|[+-]\d{2}:?\d{2})?$/i;
const DMY = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|UTC|GMT|[+-]\d{2}:?\d{2})?$/i;
const COMPACT = /^(\d{4})(\d{2})(\d{2})(?:[ T]?(\d{2}):?(\d{2})(?::?(\d{2}))?)?$/;

function zoneOffsetSec(z: string | undefined): number | null {
  if (!z) return null;
  if (/^(z|utc|gmt)$/i.test(z)) return 0;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(z);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60) : null;
}

function build(y: number, mo: number, d: number, h = 0, mi = 0, s = 0, zone?: string): ParsedTime | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 60) return null;
  const t = Date.UTC(y, mo - 1, d, h, mi, s) / 1000;
  const off = zoneOffsetSec(zone);
  return { t: off == null ? t : t - off, naive: off == null };
}

/** Parses one timestamp (optionally split into date + time columns). */
export function parseDateTime(date: string, time = '', dayFirst = true): ParsedTime | null {
  const raw = (time ? `${date} ${time}` : date).trim();
  if (/^\d{9,}(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    // Unix seconds (10 digits) / milliseconds (13) / microseconds (16).
    const sec = n > 1e14 ? n / 1e6 : n > 1e11 ? n / 1000 : n;
    return { t: Math.floor(sec), naive: false };
  }
  let m = YMD.exec(raw);
  if (m) return build(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), m[7]);
  m = DMY.exec(raw);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    return dayFirst ? build(+m[3], b, a, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), m[7]) : build(+m[3], a, b, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), m[7]);
  }
  m = COMPACT.exec(raw);
  if (m) return build(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  if (!time) {
    const iso = Date.parse(raw);
    if (Number.isFinite(iso)) return { t: Math.floor(iso / 1000), naive: !/(z|[+-]\d{2}:?\d{2})$/i.test(raw) };
  }
  return null;
}

/** File-level D/M/Y vs M/D/Y decision: any first part > 12 → day first; any second part > 12 → month first. */
function detectDayFirst(samples: string[]): boolean {
  for (const s of samples) {
    const m = /^(\d{1,2})[.\-/](\d{1,2})[.\-/]\d{4}/.exec(s);
    if (!m) continue;
    if (+m[1] > 12) return true;
    if (+m[2] > 12) return false;
  }
  return true;
}

function medianInterval(c: Candle[]): number {
  const diffs: number[] = [];
  for (let i = 1; i < c.length; i++) diffs.push(c[i].time - c[i - 1].time);
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)] ?? 0;
}

const tfSec = (tf: Timeframe) => TIMEFRAME_SECONDS[tf];

/** Timeframe of bars spaced `interval` seconds apart (exact), or null. */
export function timeframeOfInterval(interval: number): Timeframe | null {
  if (interval >= MONTH_MIN && interval <= MONTH_MAX) return '1M';
  return TIMEFRAMES.find((tf) => tf !== '1M' && tfSec(tf) === interval) ?? null;
}

/** Can bars spaced `interval` apart be aggregated into `tf`? */
const aggregatesInto = (interval: number, tf: Timeframe) =>
  tf === '1M' ? interval <= DAY && DAY % interval === 0 : interval < tfSec(tf) && tfSec(tf) % interval === 0;

export const fmtInterval = (sec: number) =>
  sec >= MONTH_MIN && sec <= MONTH_MAX ? '1 month' : sec % 604800 === 0 ? `${sec / 604800}w` : sec % DAY === 0 ? `${sec / DAY}d` : sec % 3600 === 0 ? `${sec / 3600}h` : sec % 60 === 0 ? `${sec / 60}m` : `${sec}s`;

export function parseBarsFile(text: string, opts: ParseOptions = {}): ParsedBars {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new ImportError('File is empty or has only one line');
  const delim = detectDelimiter(lines[0]);
  const first = splitRow(lines[0], delim);
  const hasHeader = first.slice(1).filter(isNumeric).length < 4;

  const idx: Partial<Record<Col, number>> = {};
  let format: ImportFormat = 'CSV';
  let rows = lines;
  if (hasHeader) {
    rows = lines.slice(1);
    const names = first.map(normHeader);
    names.forEach((n, i) => {
      const col = HEADER_ALIASES[n];
      if (col && idx[col] == null) idx[col] = i;
    });
    for (const v of VOLUME_PREF) {
      const i = names.indexOf(v);
      if (i >= 0) {
        idx.volume = i;
        break;
      }
    }
    // A lone "time" column (TradingView, our MT5 script) holds the full timestamp.
    if (idx.date == null && idx.datetime == null && idx.time != null) {
      idx.datetime = idx.time;
      delete idx.time;
    }
    if (idx.date != null && idx.time == null && idx.datetime == null) {
      idx.datetime = idx.date;
      delete idx.date;
    }
    if (/^<.*>$/.test(first[0])) format = 'MT5';
    else if (names.includes('gmttime') || names.includes('localtime')) format = 'Dukascopy';
    else if (names[0] === 'time') format = 'TradingView';
  } else if (first.length >= 6 && TIME_ONLY.test(first[1])) {
    Object.assign(idx, { date: 0, time: 1, open: 2, high: 3, low: 4, close: 5, volume: first.length > 6 ? 6 : undefined });
    format = 'MT4';
  } else if (first.length >= 5) {
    Object.assign(idx, { datetime: 0, open: 1, high: 2, low: 3, close: 4, volume: first.length > 5 ? 5 : undefined });
    if (/^\d{13}$/.test(first[0])) format = 'Binance';
  }
  if (format === 'TradingView' && idx.datetime != null && !/^\d{9,}$/.test(splitRow(rows[0] ?? '', delim)[idx.datetime] ?? '')) format = 'CSV';

  const missing = (['open', 'high', 'low', 'close'] as Col[]).filter((c) => idx[c] == null);
  if (idx.datetime == null && idx.date == null) missing.unshift('date');
  if (missing.length) throw new ImportError(`Couldn't find column(s): ${missing.join(', ')}. Expected a header like "time,open,high,low,close,volume".`);

  const dateCol = (idx.datetime ?? idx.date)!;
  const dayFirst = detectDayFirst(rows.slice(0, 500).map((r) => splitRow(r, delim)[dateCol] ?? ''));
  const decimalComma = delim === ';' || delim === '\t';
  const toNum = (s: string | undefined) => (s == null || s === '' ? NaN : Number(decimalComma ? s.replace(',', '.') : s));

  const parsed: (Candle & { naive: boolean })[] = [];
  let skipped = 0;
  for (const line of rows) {
    const c = splitRow(line, delim);
    const pt = idx.datetime != null ? parseDateTime(c[idx.datetime] ?? '', '', dayFirst) : parseDateTime(c[idx.date!] ?? '', idx.time != null ? c[idx.time] ?? '' : '', dayFirst);
    const o = toNum(c[idx.open!]);
    const h = toNum(c[idx.high!]);
    const l = toNum(c[idx.low!]);
    const cl = toNum(c[idx.close!]);
    if (!pt || ![o, h, l, cl].every((v) => Number.isFinite(v) && v > 0)) {
      skipped++;
      continue;
    }
    const v = idx.volume != null ? toNum(c[idx.volume]) : 0;
    parsed.push({ time: pt.t, open: o, high: Math.max(h, o, cl), low: Math.min(l, o, cl), close: cl, volume: Number.isFinite(v) && v > 0 ? v : 0, naive: pt.naive });
  }
  if (parsed.length < 2) throw new ImportError(`No valid bars found (${skipped} unreadable row${skipped === 1 ? '' : 's'})`);

  parsed.sort((a, b) => a.time - b.time);
  let candles: Candle[] = [];
  for (const p of parsed) {
    const { naive: _naive, ...bar } = p;
    if (candles.length && candles[candles.length - 1].time === bar.time) candles[candles.length - 1] = bar;
    else candles.push(bar);
  }

  const intervalSec = medianInterval(candles);
  if (intervalSec <= 0) throw new ImportError('Could not determine the bar interval');

  // Zone shift only for intraday bars: D1/W1/MN1 bars are labelled by trading date, not an instant.
  const offset = (opts.tzOffsetMinutes ?? 0) * 60;
  if (offset && intervalSec < DAY) {
    const naive = new Set(parsed.filter((p) => p.naive).map((p) => p.time));
    candles = candles.map((c) => (naive.has(c.time) ? { ...c, time: c.time - offset } : c));
  }

  const native = timeframeOfInterval(intervalSec);
  const want = opts.timeframe && opts.timeframe !== 'auto' ? opts.timeframe : null;
  let timeframe: Timeframe;
  if (want) {
    if (native === want) timeframe = want;
    else if (aggregatesInto(intervalSec, want)) timeframe = want;
    else throw new ImportError(`File has ${fmtInterval(intervalSec)} bars — can't import them as ${want}.`);
  } else if (native) {
    timeframe = native;
  } else {
    const up = TIMEFRAMES.find((tf) => aggregatesInto(intervalSec, tf));
    if (!up) throw new ImportError(`Unsupported bar interval (${fmtInterval(intervalSec)})`);
    timeframe = up;
  }

  if (native === timeframe) {
    // MT5/MT4 label weeks by their Sunday open; the app's weeks start Monday 00:00 UTC.
    if (timeframe === '1w') candles = candles.map((c) => ({ ...c, time: bucketStart(c.time + 2 * DAY, '1w') }));
    return { candles, timeframe, format, intervalSec, skipped };
  }
  const agg = aggregate(candles, timeframe);
  return { candles: agg, timeframe, format, intervalSec, aggregatedFrom: candles.length, skipped };
}

const SYMBOL_ALIASES: [string, string[]][] = [
  ['XAUUSD', ['XAUUSD', 'GOLD']],
  ['EURUSD', ['EURUSD']],
  ['AUDUSD', ['AUDUSD']],
  ['BTCUSD', ['BTCUSD', 'XBTUSD', 'BITCOIN']],
  ['ETHUSD', ['ETHUSD']],
  ['SPX', ['US500', 'SPX', 'SP500', 'USA500', 'SPY']],
];

/** App symbol mentioned in a file name (e.g. "XAUUSDm_M15_2024….csv", "OANDA_XAUUSD, 15.csv", "BTCUSDT-15m.csv"). */
export function guessSymbol(fileName: string): string | null {
  const u = fileName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const [sym, aliases] of SYMBOL_ALIASES) if (aliases.some((a) => u.includes(a))) return sym;
  return null;
}

/** Combine two series; bars from `incoming` win on equal timestamps. */
export function mergeCandles(existing: Candle[], incoming: Candle[]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const c of existing) byTime.set(c.time, c);
  for (const c of incoming) byTime.set(c.time, c);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
