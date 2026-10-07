import type { UnixTime } from '@/types';

/**
 * Converts between wall-clock time and fractional logical bar index for the
 * complete loaded series, including timestamps hidden during replay. Only
 * times outside the loaded range are extrapolated one timeframe per bar.
 * Using the complete calendar keeps future anchors stable across session gaps.
 */
export class TimeMapper {
  private times: { time: number }[] = [];
  private tf = 60;

  set(times: { time: number }[], tfSeconds: number) {
    this.times = times;
    this.tf = tfSeconds;
  }

  get length() {
    return this.times.length;
  }

  toLogical(t: UnixTime): number | null {
    const a = this.times;
    const n = a.length;
    if (n === 0) return null;
    if (t <= a[0].time) return (t - a[0].time) / this.tf;
    if (t >= a[n - 1].time) return n - 1 + (t - a[n - 1].time) / this.tf;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (a[mid].time <= t) lo = mid;
      else hi = mid;
    }
    return lo + (t - a[lo].time) / (a[hi].time - a[lo].time);
  }

  toTime(logical: number): UnixTime | null {
    const a = this.times;
    const n = a.length;
    if (n === 0) return null;
    if (logical <= 0) return Math.round(a[0].time + logical * this.tf);
    if (logical >= n - 1) return Math.round(a[n - 1].time + (logical - (n - 1)) * this.tf);
    const i = Math.floor(logical);
    const frac = logical - i;
    return Math.round(a[i].time + frac * (a[i + 1].time - a[i].time));
  }
}
