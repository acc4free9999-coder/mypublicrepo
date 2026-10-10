/**
 * Display-time helpers. Bar data stays in UTC; these only change how times are shown
 * and how session ranges are evaluated.
 *
 * A zone is `'UTC'`, `'local'` (the browser zone), a fixed offset such as `'UTC+07:00'`,
 * or an IANA name such as `'America/New_York'` (DST-aware).
 */
export type TimeZoneId = string;

export const LOCAL_ZONE = 'local';
const FIXED = /^UTC([+-])(\d{2}):(\d{2})$/;

export const browserZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const fixedZone = (minutes: number): TimeZoneId => {
  if (minutes === 0) return 'UTC';
  const a = Math.abs(minutes);
  return `UTC${minutes < 0 ? '-' : '+'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
};

export const offsetLabel = (minutes: number) => {
  if (minutes === 0) return 'UTC';
  const a = Math.abs(minutes);
  return `UTC${minutes < 0 ? '−' : '+'}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, '0')}` : ''}`;
};

const formatters = new Map<string, Intl.DateTimeFormat | null>();
const offsetCache = new Map<string, number>();

function formatterFor(zone: string): Intl.DateTimeFormat | null {
  if (!formatters.has(zone)) {
    try {
      formatters.set(
        zone,
        new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }),
      );
    } catch {
      formatters.set(zone, null);
    }
  }
  return formatters.get(zone)!;
}

export const isValidZone = (zone: TimeZoneId) =>
  zone === 'UTC' || zone === LOCAL_ZONE || FIXED.test(zone) || formatterFor(zone) != null;

/** Offset from UTC, in minutes, of `zone` at unix second `t`. */
export function zoneOffsetMinutes(zone: TimeZoneId, t: number): number {
  if (zone === 'UTC') return 0;
  const m = FIXED.exec(zone);
  if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  const name = zone === LOCAL_ZONE ? browserZone() : zone;
  if (name === 'UTC' || name === 'Etc/UTC') return 0;
  // DST and historical offset changes happen on quarter-hour UTC boundaries.
  const key = `${name}|${Math.floor(t / 900)}`;
  const cached = offsetCache.get(key);
  if (cached != null) return cached;
  const f = formatterFor(name);
  let offset = 0;
  if (f) {
    const p: Record<string, number> = {};
    for (const part of f.formatToParts(new Date(t * 1000))) if (part.type !== 'literal') p[part.type] = Number(part.value);
    const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) / 1000;
    offset = Math.round((wall - Math.floor(t / 60) * 60) / 60);
  }
  if (offsetCache.size > 200_000) offsetCache.clear();
  offsetCache.set(key, offset);
  return offset;
}

/** Wall-clock fields of `t` in `zone`. */
export function wallClock(t: number, zone: TimeZoneId) {
  const d = new Date((t + zoneOffsetMinutes(zone, t) * 60) * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes(), weekday: d.getUTCDay() };
}

/** Minutes after local midnight (0–1439) of `t` in `zone`. */
export const minuteOfDay = (t: number, zone: TimeZoneId) => {
  const m = Math.floor((t + zoneOffsetMinutes(zone, t) * 60) / 60) % 1440;
  return m < 0 ? m + 1440 : m;
};

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatDateTime = (t: number, zone: TimeZoneId) => {
  const w = wallClock(t, zone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)}`;
};

/** Daily and longer bars represent a trading date, so their date is never shifted by the display zone. */
export const formatBarDate = (t: number) => formatDateTime(t, 'UTC').slice(0, 10);

/** Crosshair label: `Wed 07 Oct '26 14:00`, or date-only for D1+ bars. */
export function formatCrosshair(t: number, zone: TimeZoneId, intraday: boolean) {
  const w = wallClock(t, intraday ? zone : 'UTC');
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][w.weekday];
  const date = `${day} ${pad(w.day)} ${MONTHS[w.month - 1]} '${String(w.year).slice(2)}`;
  return intraday ? `${date} ${pad(w.hour)}:${pad(w.minute)}` : date;
}

/** Matches Lightweight Charts' TickMarkType: Year, Month, DayOfMonth, Time, TimeWithSeconds. */
export function formatTick(t: number, tickType: number, zone: TimeZoneId, intraday: boolean) {
  const w = wallClock(t, intraday ? zone : 'UTC');
  switch (tickType) {
    case 0:
      return String(w.year);
    case 1:
      return MONTHS[w.month - 1];
    case 2:
      return String(w.day);
    default:
      return `${pad(w.hour)}:${pad(w.minute)}`;
  }
}

// Module-level display zone used by non-React formatters such as fmtTime.
let displayZone: TimeZoneId = 'UTC';
export const setDisplayZone = (zone: TimeZoneId) => {
  displayZone = zone;
};
export const getDisplayZone = () => displayZone;
