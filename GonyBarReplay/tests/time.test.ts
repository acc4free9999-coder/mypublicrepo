import { describe, expect, it } from 'vitest';
import { fmtTime } from '@/lib/format';
import { inDailyRange, parseHHMM, sessionAt, SESSION_PRESETS, type SessionRange } from '@/lib/sessions';
import { fixedZone, formatCrosshair, formatDateTime, formatTick, minuteOfDay, setDisplayZone, zoneOffsetMinutes } from '@/lib/time';

const utc = (s: string) => Date.parse(`${s}Z`) / 1000;

describe('display time zones', () => {
  it('converts UTC bar times to GMT+7', () => {
    const t = utc('2026-10-07T20:00:00');
    expect(formatDateTime(t, 'UTC+07:00')).toBe('2026-10-08 03:00');
    expect(formatDateTime(t, 'Asia/Bangkok')).toBe('2026-10-08 03:00');
    expect(formatDateTime(t, 'UTC')).toBe('2026-10-07 20:00');
    expect(fixedZone(420)).toBe('UTC+07:00');
    expect(fixedZone(-330)).toBe('UTC-05:30');
  });

  it('follows daylight saving time for named zones', () => {
    expect(zoneOffsetMinutes('America/New_York', utc('2026-01-15T12:00:00'))).toBe(-300);
    expect(zoneOffsetMinutes('America/New_York', utc('2026-07-15T12:00:00'))).toBe(-240);
    expect(zoneOffsetMinutes('Europe/London', utc('2026-07-15T12:00:00'))).toBe(60);
  });

  it('formats fmtTime with the active display zone', () => {
    const t = utc('2026-10-07T20:00:00');
    setDisplayZone('UTC+07:00');
    expect(fmtTime(t)).toBe('2026-10-08 03:00');
    setDisplayZone('UTC');
    expect(fmtTime(t)).toBe('2026-10-07 20:00');
  });

  it('keeps the trading date of daily bars and shifts intraday labels', () => {
    const t = utc('2026-10-07T00:00:00');
    expect(formatCrosshair(t, 'UTC-05:00', false)).toBe("Wed 07 Oct '26");
    expect(formatCrosshair(t, 'UTC+07:00', true)).toBe("Wed 07 Oct '26 07:00");
    expect(formatTick(t, 3, 'UTC+07:00', true)).toBe('07:00');
    expect(formatTick(t, 2, 'UTC-05:00', false)).toBe('7');
  });
});

describe('session ranges', () => {
  it('parses times and handles ranges that wrap past midnight', () => {
    expect(parseHHMM('09:30')).toBe(570);
    expect(parseHHMM('24:00')).toBe(1440);
    expect(parseHHMM('25:00')).toBeNull();
    expect(inDailyRange(23 * 60, 22 * 60, 2 * 60)).toBe(true);
    expect(inDailyRange(60, 22 * 60, 2 * 60)).toBe(true);
    expect(inDailyRange(2 * 60, 22 * 60, 2 * 60)).toBe(false);
    expect(inDailyRange(5, 600, 600)).toBe(true);
  });

  it('evaluates chart-zone ranges in the chart time zone', () => {
    const r: SessionRange = { id: 'a', name: 'Morning', enabled: true, start: '07:00', end: '12:00', zone: 'chart', upColor: '#fff', downColor: '#000' };
    const t = utc('2026-10-07T00:30:00'); // 07:30 in GMT+7
    expect(minuteOfDay(t, 'UTC+07:00')).toBe(450);
    expect(sessionAt(t, [r], 'UTC+07:00')?.id).toBe('a');
    expect(sessionAt(t, [r], 'UTC')).toBeNull();
    expect(sessionAt(t, [{ ...r, enabled: false }], 'UTC+07:00')).toBeNull();
  });

  it('keeps preset sessions on exchange hours across DST, with list order breaking overlaps', () => {
    // 08:00 New York is 13:00 UTC in winter and 12:00 UTC in summer.
    expect(sessionAt(utc('2026-01-15T13:00:00'), SESSION_PRESETS, 'UTC')?.id).toBe('london');
    expect(sessionAt(utc('2026-01-15T13:00:00'), SESSION_PRESETS.slice(2), 'UTC')?.id).toBe('new-york');
    expect(sessionAt(utc('2026-07-15T12:00:00'), SESSION_PRESETS.slice(2), 'UTC')?.id).toBe('new-york');
    expect(sessionAt(utc('2026-07-15T11:00:00'), SESSION_PRESETS.slice(2), 'UTC')).toBeNull();
    expect(sessionAt(utc('2026-01-15T01:00:00'), SESSION_PRESETS, 'UTC')?.id).toBe('tokyo');
  });
});
