import { create } from 'zustand';
import { bucketEndIndex, lastIndexAtOrBefore, nextBucketStart, nextCandleEndIndex } from '@/data/aggregate';
import { loadAllRealData, saveRealData, deleteRealData, type RealSymbolData } from '@/data/realDataCache';
import { fetchAllTimeframes } from '@/data/twelveData';
import { mergeCandles } from '@/data/fileImport';
import { getSymbolSpec, SYMBOLS } from '@/data/generator';
import {
  cancelOrder as engineCancel,
  modifyOrder as engineModify,
  closePosition as engineClose,
  emptyBook,
  markToMarket,
  processBar,
  submitOrder,
  updateBrackets as engineBrackets,
  defaultIdFactory,
  type TradingBook,
} from '@/engine/matchingEngine';
import { computeAccount, riskSizedLots, validateTicket, type OrderTicket } from '@/engine/risk';
import { TIMEFRAME_LABELS, TIMEFRAMES, type Account, type Candle, type IndicatorSettings, type Order, type OrderType, type ReplaySpeed, type ReplayState, type Side, type Timeframe, type TradeEvent, type UnixTime } from '@/types';

/** One parsed file ready to be stored. `merge` keeps existing bars of that timeframe (file bars win on overlap). */
export interface ImportItem {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  source: string;
  merge: boolean;
}

/** Order-ticket draft shared by the side panel and the on-chart preview lines (strings = raw input values). */
export interface TicketDraft {
  side: Side;
  type: OrderType;
  qty: string;
  price: string;
  slOn: boolean;
  tpOn: boolean;
  sl: string;
  tp: string;
  /** Whether the draft's entry / SL / TP preview lines are shown on the chart. */
  preview: boolean;
  /** 'lots' = fixed size from `qty`; 'risk' = size so that hitting the SL loses `riskPct`% of the balance. */
  sizing: 'lots' | 'risk';
  riskPct: string;
}

export interface AccountSettings {
  balance: number;
  leverage: number;
}

export interface DataStatus {
  loading: boolean;
  /** Progress / result message of the last fetch. */
  message: string | null;
  error: string | null;
}

export type OrderPatch = Partial<Pick<Order, 'price' | 'stopLoss' | 'takeProfit'>>;

export const DEFAULT_BALANCE = 100_000;
export const DEFAULT_LEVERAGE = 100;
export const LEVERAGE_OPTIONS = [1, 10, 20, 30, 50, 100, 200, 500];
const SETTINGS_KEY = 'gony-bar-replay:account';
const API_KEY_KEY = 'gony-bar-replay:twelvedata-key';
const INDICATORS_KEY = 'gony-bar-replay:indicators';

const readLS = (k: string) => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeLS = (k: string, v: string | null) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

export const DEFAULT_INDICATORS: IndicatorSettings = { ema: { enabled: true, period: 50 }, volume: { enabled: true } };

/** Saved indicator settings merged over the defaults (tolerates missing / malformed fields). */
export function loadIndicators(raw = readLS(INDICATORS_KEY)): IndicatorSettings {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<IndicatorSettings>) : {};
    const period = Number(v.ema?.period);
    return {
      ema: {
        enabled: typeof v.ema?.enabled === 'boolean' ? v.ema.enabled : DEFAULT_INDICATORS.ema.enabled,
        period: Number.isFinite(period) && period >= 1 ? Math.min(500, Math.round(period)) : DEFAULT_INDICATORS.ema.period,
      },
      volume: { enabled: typeof v.volume?.enabled === 'boolean' ? v.volume.enabled : DEFAULT_INDICATORS.volume.enabled },
    };
  } catch {
    return DEFAULT_INDICATORS;
  }
}

const tfRank = (tf: Timeframe) => TIMEFRAMES.indexOf(tf);

const NO_DATA: Candle[] = [];

/**
 * Series the chart / replay run on: the chart timeframe's native fetched bars,
 * else the coarsest fetched finer timeframe (aggregated). Empty when nothing
 * usable has been fetched for the symbol.
 */
export function resolveBase(realData: Record<string, RealSymbolData>, symbol: string, tf: Timeframe): { base: Candle[]; baseTf: Timeframe } {
  const series = realData[symbol]?.series;
  if (series) {
    for (let i = tfRank(tf); i >= 0; i--) {
      const s = series[TIMEFRAMES[i]];
      if (s && s.length >= MIN_BARS) return { base: s, baseTf: TIMEFRAMES[i] };
    }
  }
  return { base: NO_DATA, baseTf: tf };
}

/** Replay needs at least one bar of history, the cutoff bar and one bar of future. */
const MIN_BARS = 3;
export const hasData = (s: Pick<TradingStore, 'base'>) => s.base.length >= MIN_BARS;

function loadSettings(): AccountSettings {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(SETTINGS_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<AccountSettings>) : {};
    return {
      balance: Number(v.balance) > 0 ? Number(v.balance) : DEFAULT_BALANCE,
      leverage: Number(v.leverage) > 0 ? Number(v.leverage) : DEFAULT_LEVERAGE,
    };
  } catch {
    return { balance: DEFAULT_BALANCE, leverage: DEFAULT_LEVERAGE };
  }
}
const MAX_EVENTS = 200;

export interface TradingStore {
  // market
  symbol: string;
  timeframe: Timeframe;
  base: Candle[];
  /** Resolution of `base` (the fetched timeframe it comes from). */
  baseTf: Timeframe;
  /** False until saved data has been read from IndexedDB. */
  hydrated: boolean;
  dataPanelOpen: boolean;
  realData: Record<string, RealSymbolData>;
  dataStatus: DataStatus;
  apiKey: string;
  // replay
  replay: ReplayState;
  // trading
  book: TradingBook;
  account: Account;
  events: TradeEvent[];
  lastError: string | null;
  // chart
  indicators: IndicatorSettings;
  // order ticket
  ticket: TicketDraft;
  // paper account configuration (persisted)
  settings: AccountSettings;

  setSymbol: (symbol: string) => void;
  setTimeframe: (tf: Timeframe) => void;
  setDataPanelOpen: (open: boolean) => void;
  setApiKey: (key: string) => void;
  /** Downloads all timeframes of the current symbol from Twelve Data (one request each) and shows them. */
  fetchRealData: () => Promise<void>;
  /** Stores bars imported from files (MT5/MT4/TradingView/… exports) and shows them if they belong to the current symbol. */
  importSeries: (items: ImportItem[]) => void;
  clearRealData: (symbol: string) => void;
  /** Loads previously fetched series from IndexedDB. */
  hydrateRealData: () => Promise<void>;
  setIndicators: (patch: Partial<{ [K in keyof IndicatorSettings]: Partial<IndicatorSettings[K]> }>) => void;

  enterReplay: () => void;
  cancelSelection: () => void;
  selectCutoff: (bucketTime: UnixTime) => void;
  randomCutoff: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stepForward: () => void;
  resetReplay: () => void;
  exitReplay: () => void;
  setSpeed: (speed: ReplaySpeed) => void;

  /** `shiftBrackets` moves SL/TP together with the entry price (used when dragging the entry line). */
  updateTicket: (patch: Partial<TicketDraft>, opts?: { shiftBrackets?: boolean }) => void;
  submitTicket: () => boolean;
  /** Starting balance change resets the paper account; leverage change only re-computes margin. */
  setAccountSettings: (patch: Partial<AccountSettings>) => void;
  placeOrder: (ticket: OrderTicket) => boolean;
  /** Move a pending order and/or its brackets. Limit ⇄ stop switches automatically when the price crosses the market. */
  modifyOrder: (orderId: string, patch: OrderPatch) => boolean;
  cancelOrder: (orderId: string) => void;
  closePosition: (positionId: string) => void;
  closeAllPositions: () => void;
  updateBrackets: (positionId: string, stopLoss?: number, takeProfit?: number) => boolean;
  clearError: () => void;
}

let settings = loadSettings();

const tradingReset = () => ({ book: emptyBook(), account: computeAccount(settings.balance, settings.leverage, 0, []), events: [] as TradeEvent[], lastError: null });

const withEvents = (prev: TradeEvent[], next: TradeEvent[]) => (next.length ? [...next.reverse(), ...prev].slice(0, MAX_EVENTS) : prev);

const freshTicket = (symbol: string, prev?: TicketDraft): TicketDraft => ({
  side: 'buy',
  type: 'market',
  qty: String(getSymbolSpec(symbol).defaultQty),
  price: '',
  slOn: false,
  tpOn: false,
  sl: '',
  tp: '',
  preview: false,
  sizing: prev?.sizing ?? 'lots',
  riskPct: prev?.riskPct ?? '1',
});

const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

/** Typical SL distance for a symbol, derived from its volatility. */
export const bracketOffset = (symbol: string, price: number) => price * getSymbolSpec(symbol).annualVol * 0.03;

const accountFor = (book: TradingBook) => computeAccount(settings.balance, settings.leverage, book.realizedPnl, book.positions);

/** Entry price the ticket would use right now. */
export const ticketEntry = (s: Pick<TradingStore, 'base' | 'replay' | 'ticket'>) =>
  s.ticket.type === 'market' ? marketPrice(s) : num(s.ticket.price) ?? marketPrice(s);

/** Lots the ticket would submit (fixed, or derived from the risk % and the stop loss). */
export function ticketLots(s: Pick<TradingStore, 'base' | 'replay' | 'ticket' | 'symbol' | 'account'>): number {
  const t = s.ticket;
  if (t.sizing === 'lots') return Number(t.qty) || 0;
  const spec = getSymbolSpec(s.symbol);
  return riskSizedLots(s.account.balance, Number(t.riskPct), ticketEntry(s), t.slOn ? num(t.sl) : undefined, spec.contractSize, spec.qtyStep);
}

/** Price decimals of the active symbol. */
export const usePricePrecision = () => useTradingStore((s) => getSymbolSpec(s.symbol).pricePrecision);

export const isReplayActive = (s: ReplayState['status']) => s === 'paused' || s === 'playing' || s === 'ended';

/** Stop the replay and show all data up to the latest bar. Asks first when paper trades would be lost. */
export function stopReplay(ask: (msg: string) => boolean = (m) => confirm(m)): boolean {
  const s = useTradingStore.getState();
  if (s.replay.status === 'off') return false;
  const open = s.book.positions.length + s.book.pendingOrders.length;
  if (open && !ask(`Stop the replay? ${open} open position${open === 1 ? '' : 's'} / order${open === 1 ? '' : 's'} will be discarded.`)) return false;
  s.exitReplay();
  return true;
}

const initialSymbol = SYMBOLS[0].symbol;
/** Close of the bar under the replay cursor (NaN when no data is loaded). */
export const marketPrice = (s: Pick<TradingStore, 'base' | 'replay'>) => s.base[s.replay.cursor]?.close ?? NaN;

/** Replay reset caused by swapping the underlying series. */
const replayOff = (s: Pick<TradingStore, 'replay'>, base: Candle[]): ReplayState => ({ ...s.replay, status: s.replay.status === 'selecting' ? 'selecting' : 'off', cutoffIndex: null, cursor: base.length - 1 });

export const useTradingStore = create<TradingStore>()((set, get) => ({
  symbol: initialSymbol,
  timeframe: '1h',
  base: NO_DATA,
  baseTf: '1h',
  hydrated: false,
  dataPanelOpen: false,
  realData: {},
  dataStatus: { loading: false, message: null, error: null },
  apiKey: readLS(API_KEY_KEY) ?? '',
  replay: { status: 'off', cutoffIndex: null, cursor: -1, speed: 1 },
  ...tradingReset(),
  indicators: loadIndicators(),
  ticket: freshTicket(initialSymbol),
  settings,

  // ───────────── market ─────────────
  setSymbol: (symbol) => {
    const { realData, timeframe } = get();
    const { base, baseTf } = resolveBase(realData, symbol, timeframe);
    set((s) => ({ symbol, base, baseTf, replay: { ...s.replay, status: 'off', cutoffIndex: null, cursor: base.length - 1 }, ticket: freshTicket(symbol, s.ticket), ...tradingReset() }));
  },
  setTimeframe: (timeframe) => {
    const s = get();
    const next = resolveBase(s.realData, s.symbol, timeframe);
    if (next.base === s.base) return set({ timeframe });
    if (!isReplayActive(s.replay.status)) {
      return set({ timeframe, base: next.base, baseTf: next.baseTf, replay: replayOff(s, next.base), ...(s.replay.cutoffIndex != null ? tradingReset() : {}) });
    }
    // In replay, coarser timeframes aggregate the current series so the running session is untouched.
    if (tfRank(timeframe) >= tfRank(s.baseTf)) return set({ timeframe });
    if (!next.base.length) return set({ lastError: `No real ${TIMEFRAME_LABELS[timeframe]} data fetched for ${s.symbol}.` });
    // Finer timeframe: move onto the finer series at the same moment in time (end of the revealed bar).
    const mapIdx = (i: number) => lastIndexAtOrBefore(next.base, nextBucketStart(s.base[i].time, s.baseTf) - 1);
    const cursor = mapIdx(s.replay.cursor);
    if (cursor < 1) {
      const from = new Date(next.base[0].time * 1000).toISOString().slice(0, 10);
      return set({ lastError: `Real ${TIMEFRAME_LABELS[next.baseTf]} data starts ${from} — it doesn't reach this replay point. Pick a later cutoff to use ${TIMEFRAME_LABELS[timeframe]}.` });
    }
    const cutoff = s.replay.cutoffIndex == null ? cursor : Math.max(1, Math.min(cursor, mapIdx(s.replay.cutoffIndex)));
    set({
      timeframe,
      base: next.base,
      baseTf: next.baseTf,
      replay: { ...s.replay, cursor, cutoffIndex: cutoff, status: cursor >= next.base.length - 1 ? 'ended' : s.replay.status },
    });
  },

  // ───────────── data source ─────────────
  setDataPanelOpen: (dataPanelOpen) => set({ dataPanelOpen }),
  setApiKey: (key) => {
    const apiKey = key.trim();
    writeLS(API_KEY_KEY, apiKey || null);
    set({ apiKey });
  },
  fetchRealData: async () => {
    const { apiKey, symbol, dataStatus } = get();
    if (dataStatus.loading) return;
    if (!apiKey) {
      set({ dataStatus: { loading: false, message: null, error: 'Enter your Twelve Data API key first.' } });
      return;
    }
    set({ dataStatus: { loading: true, message: `Fetching ${symbol}…`, error: null } });
    try {
      const { series, errors } = await fetchAllTimeframes(symbol, apiKey, (p) =>
        set({ dataStatus: { loading: true, message: `Fetching ${symbol} ${TIMEFRAME_LABELS[p.tf]} (${p.done + 1}/${p.total})…`, error: null } }),
      );
      const prev = get().realData[symbol];
      const sources = { ...prev?.sources, ...Object.fromEntries(Object.keys(series).map((tf) => [tf, 'Twelve Data'])) };
      const entry: RealSymbolData = { symbol, fetchedAt: Date.now(), series: { ...prev?.series, ...series }, sources };
      void saveRealData(entry);
      const n = Object.keys(series).length;
      const dataStatus = { loading: false, message: `${symbol}: loaded ${n}/${TIMEFRAMES.length} timeframes.`, error: errors.length ? errors.join(' · ') : null };
      set((s) => {
        const realData = { ...s.realData, [symbol]: entry };
        // Only swap the chart if the user is still on that symbol.
        if (s.symbol !== symbol) return { realData, dataStatus };
        const { base, baseTf } = resolveBase(realData, symbol, s.timeframe);
        return { realData, dataStatus, base, baseTf, replay: replayOff(s, base), ...tradingReset() };
      });
    } catch (e) {
      set({ dataStatus: { loading: false, message: null, error: (e as Error).message } });
    }
  },
  importSeries: (items) => {
    if (!items.length) return;
    set((s) => {
      const realData = { ...s.realData };
      const now = Date.now();
      for (const it of items) {
        const prev = realData[it.symbol];
        const existing = it.merge ? prev?.series[it.timeframe] ?? [] : [];
        realData[it.symbol] = {
          symbol: it.symbol,
          fetchedAt: now,
          series: { ...prev?.series, [it.timeframe]: existing.length ? mergeCandles(existing, it.candles) : it.candles },
          sources: { ...prev?.sources, [it.timeframe]: it.source },
        };
      }
      const touched = [...new Set(items.map((i) => i.symbol))];
      for (const sym of touched) void saveRealData(realData[sym]);
      // Nothing on screen yet and a single other symbol imported → show it.
      const symbol = !s.base.length && touched.length === 1 && !touched.includes(s.symbol) ? touched[0] : s.symbol;
      const dataStatus = { loading: false, message: `Imported ${items.length} file${items.length === 1 ? '' : 's'} (${touched.join(', ')}).`, error: null };
      if (!touched.includes(symbol)) return { realData, dataStatus };
      let timeframe = s.timeframe;
      let { base, baseTf } = resolveBase(realData, symbol, timeframe);
      // Only coarser bars were imported than the chart timeframe → jump to the imported timeframe.
      if (!base.length) {
        timeframe = items.find((i) => i.symbol === symbol)!.timeframe;
        ({ base, baseTf } = resolveBase(realData, symbol, timeframe));
      }
      return {
        realData,
        dataStatus,
        symbol,
        timeframe,
        base,
        baseTf,
        replay: { ...replayOff(s, base), status: 'off' as const },
        ...tradingReset(),
        ...(symbol !== s.symbol ? { ticket: freshTicket(symbol, s.ticket) } : {}),
      };
    });
  },
  clearRealData: (symbol) => {
    void deleteRealData(symbol);
    set((s) => {
      const realData = { ...s.realData };
      delete realData[symbol];
      if (symbol !== s.symbol) return { realData };
      const { base, baseTf } = resolveBase(realData, s.symbol, s.timeframe);
      return { realData, base, baseTf, replay: replayOff(s, base), ...tradingReset(), dataStatus: { loading: false, message: `Removed saved ${symbol} data.`, error: null } };
    });
  },
  hydrateRealData: async () => {
    const all = await loadAllRealData();
    const realData = Object.fromEntries(all.map((d) => [d.symbol, d]));
    set((s) => {
      const merged = { ...realData, ...s.realData };
      // Don't yank the series out from under a running replay.
      if (s.replay.status !== 'off') return { realData: merged, hydrated: true };
      const { base, baseTf } = resolveBase(merged, s.symbol, s.timeframe);
      return { realData: merged, base, baseTf, replay: replayOff(s, base), hydrated: true, dataPanelOpen: s.dataPanelOpen || !base.length };
    });
  },
  setIndicators: (patch) =>
    set((s) => {
      const next = { ...s.indicators };
      for (const k of Object.keys(patch) as (keyof IndicatorSettings)[]) {
        const period = (patch[k] as { period?: number }).period;
        const merged = { ...next[k], ...patch[k] } as never;
        if (period != null) (merged as { period: number }).period = Math.max(1, Math.min(500, Math.round(period) || 1));
        next[k] = merged;
      }
      writeLS(INDICATORS_KEY, JSON.stringify(next));
      return { indicators: next };
    }),

  // ───────────── replay state machine ─────────────
  enterReplay: () => set((s) => (hasData(s) ? { replay: { ...s.replay, status: 'selecting' } } : {})),

  /** Esc while selecting: resume the running session, or leave replay if none exists. */
  cancelSelection: () =>
    set((s) =>
      s.replay.status !== 'selecting'
        ? {}
        : { replay: { ...s.replay, status: s.replay.cutoffIndex == null ? 'off' : 'paused' } },
    ),

  selectCutoff: (bucketTime) => {
    const { base, baseTf, timeframe, replay } = get();
    if (replay.status !== 'selecting') return;
    const idx = bucketEndIndex(base, timeframe, bucketTime, baseTf);
    // Keep at least one bar of history and one bar of future.
    const cursor = Math.max(1, Math.min(base.length - 2, idx));
    set({ replay: { ...replay, status: 'paused', cutoffIndex: cursor, cursor }, ...tradingReset() });
  },

  randomCutoff: () => {
    const { base } = get();
    if (base.length < MIN_BARS) return;
    const lo = Math.floor(base.length * 0.2);
    const hi = Math.floor(base.length * 0.9);
    const cursor = Math.max(1, Math.min(base.length - 2, lo + Math.floor(Math.random() * (hi - lo))));
    set((s) => ({ replay: { ...s.replay, status: 'paused', cutoffIndex: cursor, cursor }, ...tradingReset() }));
  },

  play: () =>
    set((s) => (s.replay.status === 'paused' ? { replay: { ...s.replay, status: 'playing' } } : {})),
  pause: () =>
    set((s) => (s.replay.status === 'playing' ? { replay: { ...s.replay, status: 'paused' } } : {})),
  togglePlay: () => (get().replay.status === 'playing' ? get().pause() : get().play()),

  /**
   * One replay tick: reveal the next chart-timeframe candle. Every base bar
   * inside it is streamed through the matching engine in order, so fills and
   * SL/TP exits are resolved at base resolution (15m for simulated data, the
   * loaded timeframe for real data) regardless of chart timeframe.
   */
  stepForward: () => {
    const { base, baseTf, timeframe, replay, book: startBook, events } = get();
    if (replay.status !== 'paused' && replay.status !== 'playing') return;
    const last = base.length - 1;
    if (replay.cursor >= last) {
      set({ replay: { ...replay, status: 'ended' } });
      return;
    }
    const target = nextCandleEndIndex(base, timeframe, replay.cursor, baseTf);
    let book = startBook;
    const newEvents: TradeEvent[] = [];
    for (let i = replay.cursor + 1; i <= target; i++) {
      const r = processBar(book, base[i]);
      book = r.book;
      if (r.events.length) newEvents.push(...r.events);
    }
    set({
      replay: { ...replay, cursor: target, status: target >= last ? 'ended' : replay.status },
      book,
      account: accountFor(book),
      events: withEvents(events, newEvents),
    });
  },

  resetReplay: () =>
    set((s) =>
      s.replay.cutoffIndex == null ? {} : { replay: { ...s.replay, status: 'paused', cursor: s.replay.cutoffIndex }, ...tradingReset() },
    ),

  exitReplay: () =>
    set((s) => ({ replay: { ...s.replay, status: 'off', cutoffIndex: null, cursor: s.base.length - 1 }, ...tradingReset() })),

  setSpeed: (speed) => set((s) => ({ replay: { ...s.replay, speed } })),

  // ───────────── order ticket ─────────────
  updateTicket: (patch, opts) =>
    set((s) => {
      const prev = s.ticket;
      const t: TicketDraft = { ...prev, ...patch };
      const pp = getSymbolSpec(s.symbol).pricePrecision;
      const fix = (v: number) => v.toFixed(pp);
      const market = marketPrice(s);
      if (!Number.isFinite(market)) return { ticket: { ...t, preview: false } };
      const off = bracketOffset(s.symbol, market);
      const dir = t.side === 'buy' ? 1 : -1;

      const contextChanged = (patch.side != null && patch.side !== prev.side) || (patch.type != null && patch.type !== prev.type);
      if (contextChanged && t.type !== 'market' && patch.price == null) t.price = fix(t.type === 'limit' ? market - dir * off * 0.5 : market + dir * off * 0.5);
      const entry = t.type === 'market' ? market : num(t.price) ?? market;
      // Risk-based sizing needs a stop; removing the stop falls back to fixed lots.
      if (patch.slOn === false && t.sizing === 'risk') t.sizing = 'lots';
      if (t.sizing === 'risk') t.slOn = true;
      if ((t.slOn && !prev.slOn) || (contextChanged && t.slOn)) t.sl = fix(entry - dir * off);
      if ((t.tpOn && !prev.tpOn) || (contextChanged && t.tpOn)) t.tp = fix(entry + dir * off * 2);

      if (opts?.shiftBrackets && patch.price != null) {
        const d = Number(patch.price) - Number(prev.price);
        if (Number.isFinite(d)) {
          if (t.slOn && num(prev.sl) != null) t.sl = fix(Number(prev.sl) + d);
          if (t.tpOn && num(prev.tp) != null) t.tp = fix(Number(prev.tp) + d);
        }
      }
      t.preview = patch.preview ?? (t.type !== 'market' || t.slOn || t.tpOn);
      return { ticket: t };
    }),

  submitTicket: () => {
    const t = get().ticket;
    const ok = get().placeOrder({
      side: t.side,
      type: t.type,
      qty: ticketLots(get()),
      price: t.type === 'market' ? undefined : num(t.price),
      stopLoss: t.slOn ? num(t.sl) : undefined,
      takeProfit: t.tpOn ? num(t.tp) : undefined,
    });
    if (ok) set((s) => ({ ticket: { ...s.ticket, preview: false } }));
    return ok;
  },

  setAccountSettings: (patch) => {
    const next: AccountSettings = { ...settings };
    if (patch.balance != null && Number.isFinite(patch.balance) && patch.balance > 0) next.balance = Math.round(patch.balance * 100) / 100;
    if (patch.leverage != null && patch.leverage > 0) next.leverage = patch.leverage;
    const balanceChanged = next.balance !== settings.balance;
    settings = next;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
    set((s) => (balanceChanged ? { settings: next, ...tradingReset() } : { settings: next, account: accountFor(s.book) }));
  },

  // ───────────── trading ─────────────
  placeOrder: (ticket) => {
    const { base, replay, book, account, symbol, events } = get();
    if (!isReplayActive(replay.status)) {
      set({ lastError: 'Start a bar replay session to place paper trades.' });
      return false;
    }
    const bar = base[replay.cursor];
    const { contractSize } = getSymbolSpec(symbol);
    const pendingNotional = book.pendingOrders.reduce((sum, o) => sum + (o.price ?? 0) * o.qty * (o.contractSize ?? 1), 0);
    const error = validateTicket(ticket, bar.close, account, pendingNotional, contractSize);
    if (error) {
      set({ lastError: error, events: withEvents(events, [{ id: defaultIdFactory('evt'), kind: 'order_rejected', time: bar.time, message: `Rejected: ${error}` }]) });
      return false;
    }
    const order: Order = {
      id: defaultIdFactory('ord'),
      symbol,
      side: ticket.side,
      type: ticket.type,
      qty: ticket.qty,
      contractSize,
      price: ticket.type === 'market' ? undefined : ticket.price,
      stopLoss: ticket.stopLoss,
      takeProfit: ticket.takeProfit,
      status: 'pending',
      createdAt: bar.time,
    };
    const r = submitOrder(book, order, bar.close, bar.time);
    set({ book: r.book, account: accountFor(r.book), events: withEvents(events, r.events), lastError: null });
    return true;
  },

  cancelOrder: (orderId) => {
    const { base, replay, book, events } = get();
    const r = engineCancel(book, orderId, base[replay.cursor].time);
    set({ book: r.book, events: withEvents(events, r.events) });
  },

  closePosition: (positionId) => {
    const { base, replay, book, events } = get();
    const bar = base[replay.cursor];
    const r = engineClose(book, positionId, bar.close, bar.time);
    const next = { ...r.book, positions: markToMarket(r.book.positions, bar.close) };
    set({ book: next, account: accountFor(next), events: withEvents(events, r.events) });
  },

  closeAllPositions: () => {
    for (const p of get().book.positions) get().closePosition(p.id);
  },

  updateBrackets: (positionId, stopLoss, takeProfit) => {
    const { book } = get();
    const pos = book.positions.find((p) => p.id === positionId);
    if (!pos) return false;
    const long = pos.side === 'buy';
    const px = pos.currentPrice;
    if (stopLoss != null && (long ? stopLoss >= px : stopLoss <= px)) {
      set({ lastError: `Stop loss must be ${long ? 'below' : 'above'} the current price (${px})` });
      return false;
    }
    if (takeProfit != null && (long ? takeProfit <= px : takeProfit >= px)) {
      set({ lastError: `Take profit must be ${long ? 'above' : 'below'} the current price (${px})` });
      return false;
    }
    set({ book: engineBrackets(book, positionId, { stopLoss, takeProfit }), lastError: null });
    return true;
  },

  modifyOrder: (orderId, patch) => {
    const s = get();
    const order = s.book.pendingOrders.find((o) => o.id === orderId);
    if (!order) return false;
    const market = marketPrice(s);
    const next: Order = { ...order, ...patch };
    const fail = (msg: string) => (set({ lastError: msg }), false);
    if (next.price == null || !(next.price > 0)) return fail('Enter a valid order price');
    const long = order.side === 'buy';
    if (patch.price != null && patch.price !== market) next.type = (long ? patch.price < market : patch.price > market) ? 'limit' : 'stop';
    if (next.stopLoss != null && (long ? next.stopLoss >= next.price : next.stopLoss <= next.price))
      return fail(`Stop loss must be ${long ? 'below' : 'above'} the order price (${next.price})`);
    if (next.takeProfit != null && (long ? next.takeProfit <= next.price : next.takeProfit >= next.price))
      return fail(`Take profit must be ${long ? 'above' : 'below'} the order price (${next.price})`);
    const r = engineModify(s.book, orderId, { type: next.type, price: next.price, stopLoss: next.stopLoss, takeProfit: next.takeProfit }, s.base[s.replay.cursor].time);
    set({ book: r.book, events: withEvents(s.events, r.events), lastError: null });
    return true;
  },

  clearError: () => set({ lastError: null }),
}));
