import type { Candle, Timeframe } from '@/types';

/** Fetched real series persisted in IndexedDB (too large for localStorage). */
export interface RealSymbolData {
  symbol: string;
  fetchedAt: number;
  series: Partial<Record<Timeframe, Candle[]>>;
  /** Where each timeframe came from, e.g. "Twelve Data" or "MT5 · XAUUSD_M15.csv". */
  sources?: Partial<Record<Timeframe, string>>;
}

const DB = 'gony-bar-replay';
const STORE = 'real-data';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'symbol' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }).finally(() => db.close()),
  );
}

export const loadAllRealData = () => tx<RealSymbolData[]>('readonly', (s) => s.getAll() as IDBRequest<RealSymbolData[]>).catch(() => []);
export const saveRealData = (d: RealSymbolData) => tx('readwrite', (s) => s.put(d)).catch(() => undefined);
export const deleteRealData = (symbol: string) => tx('readwrite', (s) => s.delete(symbol)).catch(() => undefined);
