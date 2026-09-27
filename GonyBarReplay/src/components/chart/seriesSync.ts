import type { ISeriesApi, SeriesType, Time } from 'lightweight-charts';

export interface SyncMarker {
  key: string;
  length: number;
  firstTime: number;
  lastTime: number;
}

/**
 * Pushes `data` into a series with the cheapest possible operation.
 * During replay, consecutive ticks only append/replace the tail, so we use
 * `series.update()` (O(1), keeps the user's zoom/pan). Anything else —
 * symbol/timeframe/period change, reset, seeking backwards — triggers `setData()`.
 * Returns true when a full `setData()` happened.
 */
export function syncSeries<D extends { time: number }, T extends SeriesType>(
  series: ISeriesApi<T>,
  data: D[],
  map: (d: D) => Parameters<ISeriesApi<T>['update']>[0],
  key: string,
  ref: { current: SyncMarker | null },
): boolean {
  const prev = ref.current;
  const n = data.length;
  const incremental =
    prev != null &&
    prev.key === key &&
    prev.length > 0 &&
    n >= prev.length &&
    n - prev.length <= 64 &&
    data[0].time === prev.firstTime &&
    data[prev.length - 1].time === prev.lastTime;

  if (incremental) {
    for (let i = prev.length - 1; i < n; i++) series.update(map(data[i]));
  } else {
    series.setData(data.map(map) as Parameters<ISeriesApi<T>['setData']>[0]);
  }
  ref.current = n ? { key, length: n, firstTime: data[0].time, lastTime: data[n - 1].time } : null;
  return !incremental;
}

export const asTime = (t: number) => t as Time;
