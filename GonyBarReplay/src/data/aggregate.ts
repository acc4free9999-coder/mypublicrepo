import { BASE_TIMEFRAME, TIMEFRAME_SECONDS, type Candle, type Timeframe, type UnixTime } from '@/types';

const DAY = 86400;
/** 1970-01-01 was a Thursday; shifting by 4 days aligns weeks to Monday 00:00 UTC. */
const WEEK_OFFSET = 4 * DAY;

/** Open time (UTC) of the bucket containing `time`. */
export function bucketStart(time: UnixTime, tf: Timeframe): UnixTime {
  if (tf === '1M') {
    const d = new Date(time * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
  }
  if (tf === '1w') return time - ((((time - WEEK_OFFSET) % 604800) + 604800) % 604800);
  const s = TIMEFRAME_SECONDS[tf];
  return time - (time % s);
}

/** Open time of the bucket after the one starting at `start`. */
export function nextBucketStart(start: UnixTime, tf: Timeframe): UnixTime {
  if (tf === '1M') {
    const d = new Date(start * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000;
  }
  return start + TIMEFRAME_SECONDS[tf];
}

function mergeInto(target: Candle, c: Candle) {
  if (c.high > target.high) target.high = c.high;
  if (c.low < target.low) target.low = c.low;
  target.close = c.close;
  target.volume += c.volume;
}

/** Aggregates base candles in the inclusive index range [from, to] into timeframe buckets. */
export function aggregate(base: Candle[], tf: Timeframe, from = 0, to = base.length - 1): Candle[] {
  const out: Candle[] = [];
  let cur: Candle | null = null;
  for (let i = from; i <= to; i++) {
    const c = base[i];
    const t = bucketStart(c.time, tf);
    if (!cur || cur.time !== t) {
      cur = { time: t, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
      out.push(cur);
    } else {
      mergeInto(cur, c);
    }
  }
  return out;
}

/** Index of the last element whose time is <= `time` (binary search), or -1. */
export function lastIndexAtOrBefore(arr: { time: number }[], time: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].time <= time) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

const aggCache = new WeakMap<Candle[], Map<Timeframe, Candle[]>>();

/** Fully aggregated (memoised) series for a timeframe. */
export function getAggregated(base: Candle[], tf: Timeframe, baseTf: Timeframe = BASE_TIMEFRAME): Candle[] {
  let byTf = aggCache.get(base);
  if (!byTf) aggCache.set(base, (byTf = new Map()));
  let agg = byTf.get(tf);
  if (!agg) byTf.set(tf, (agg = tf === baseTf ? base : aggregate(base, tf)));
  return agg;
}

/**
 * Candles visible to the user when the replay cursor sits on base index `cursor`.
 * Closed buckets come from the memoised aggregation; the last bucket is rebuilt
 * from base bars up to the cursor so it never leaks future highs/lows/closes.
 */
export function visibleCandles(base: Candle[], tf: Timeframe, cursor: number, baseTf: Timeframe = BASE_TIMEFRAME): Candle[] {
  if (cursor < 0 || base.length === 0) return [];
  const full = getAggregated(base, tf, baseTf);
  if (cursor >= base.length - 1) return full;
  if (tf === baseTf) return base.slice(0, cursor + 1);

  const cursorTime = base[cursor].time;
  const bucketIdx = lastIndexAtOrBefore(full, cursorTime);
  const bucketTime = full[bucketIdx].time;
  const firstBaseInBucket = lastIndexAtOrBefore(base, bucketTime - 1) + 1;
  const partial = aggregate(base, tf, firstBaseInBucket, cursor)[0];
  const out = full.slice(0, bucketIdx);
  out.push(partial);
  return out;
}

/**
 * Base index of the last base bar belonging to the bucket that follows the one
 * containing `cursor` — or, if that bucket is still partial, the end of it.
 * This is what "step forward one candle" means in the chart timeframe.
 */
export function nextCandleEndIndex(base: Candle[], tf: Timeframe, cursor: number, baseTf: Timeframe = BASE_TIMEFRAME): number {
  const last = base.length - 1;
  if (cursor >= last) return last;
  if (tf === baseTf) return cursor + 1;
  const endOfCurrent = bucketEndIndex(base, tf, bucketStart(base[cursor].time, tf));
  if (endOfCurrent > cursor) return endOfCurrent;
  return Math.min(last, bucketEndIndex(base, tf, bucketStart(base[cursor + 1].time, tf)));
}

/** Base index of the last base bar inside the bucket that starts at `bucketTime`. */
export function bucketEndIndex(base: Candle[], tf: Timeframe, bucketTime: UnixTime, baseTf: Timeframe = BASE_TIMEFRAME): number {
  if (tf === baseTf) return lastIndexAtOrBefore(base, bucketTime);
  return lastIndexAtOrBefore(base, nextBucketStart(bucketTime, tf) - 1);
}
