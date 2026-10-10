import { minuteOfDay, type TimeZoneId } from './time';

/** Candles whose open time falls in [start, end) of this daily range get its colors. */
export interface SessionRange {
  id: string;
  name: string;
  enabled: boolean;
  /** 'HH:MM'. When end ≤ start the range wraps past midnight. */
  start: string;
  end: string;
  /** Zone the start/end times are in: `'chart'` follows the chart time zone. */
  zone: 'chart' | TimeZoneId;
  upColor: string;
  downColor: string;
}

export interface SessionColors {
  enabled: boolean;
  ranges: SessionRange[];
}

/** Market hours in each exchange's own zone, so they follow DST automatically. */
export const SESSION_PRESETS: SessionRange[] = [
  { id: 'tokyo', name: 'Tokyo', enabled: true, start: '09:00', end: '18:00', zone: 'Asia/Tokyo', upColor: '#4dd0e1', downColor: '#7e57c2' },
  { id: 'london', name: 'London', enabled: true, start: '08:00', end: '17:00', zone: 'Europe/London', upColor: '#ffd54f', downColor: '#ff7043' },
  { id: 'new-york', name: 'New York', enabled: true, start: '08:00', end: '17:00', zone: 'America/New_York', upColor: '#9ccc65', downColor: '#f06292' },
];

export const DEFAULT_SESSION_COLORS: SessionColors = { enabled: false, ranges: SESSION_PRESETS };

export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 24 && mi < 60 && h * 60 + mi <= 1440 ? h * 60 + mi : null;
}

/** Is minute-of-day `m` inside [start, end)? Equal start and end means the whole day. */
export function inDailyRange(m: number, start: number, end: number) {
  const e = end % 1440;
  const s = start % 1440;
  if (s === e) return true;
  return s < e ? m >= s && m < e : m >= s || m < e;
}

/** First enabled range containing `time`; earlier ranges win where they overlap. */
export function sessionAt(time: number, ranges: readonly SessionRange[], chartZone: TimeZoneId): SessionRange | null {
  for (const r of ranges) {
    if (!r.enabled) continue;
    const s = parseHHMM(r.start);
    const e = parseHHMM(r.end);
    if (s == null || e == null) continue;
    if (inDailyRange(minuteOfDay(time, r.zone === 'chart' ? chartZone : r.zone), s, e)) return r;
  }
  return null;
}
