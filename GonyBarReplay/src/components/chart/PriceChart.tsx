import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { Database, Download, Loader2, Maximize2, MoveHorizontal } from 'lucide-react';
import { lastIndexAtOrBefore } from '@/data/aggregate';
import { getSymbolSpec } from '@/data/generator';
import { DrawingsPrimitive } from '@/drawings/DrawingsPrimitive';
import { hitTestAll } from '@/drawings/geometry';
import { attachDrawingInteractions } from '@/drawings/interactions';
import { TimeMapper } from '@/drawings/timeMapper';
import { drawingsFor, useDrawingStore } from '@/store/useDrawingStore';
import { useChartData } from '@/hooks/useChartData';
import { cn, fmtPrice } from '@/lib/format';
import { hasData, isReplayActive, marketPrice, ticketLots, usePricePrecision, useTradingStore } from '@/store/useTradingStore';
import { attachTradeInteractions } from '@/tradelines/interactions';
import { TradeLinesPrimitive } from '@/tradelines/TradeLinesPrimitive';
import { TIMEFRAME_LABELS, TIMEFRAME_SECONDS, type Candle, type LinePoint } from '@/types';
import { ChartContextMenu, type ContextTarget } from './ChartContextMenu';
import { DrawingProperties } from './DrawingProperties';
import { asTime, syncSeries, type SyncMarker } from './seriesSync';
import { initializePriceScale } from './priceScaleInit';

const UP = '#26a69a';
const DOWN = '#ef5350';
const EMA_COLOR = '#7c9cff';

interface Legend {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

const AUTO_SCALE_KEY = 'gony-bar-replay:auto-scale';
const readAutoScale = () => {
  try {
    return localStorage.getItem(AUTO_SCALE_KEY) !== 'false';
  } catch {
    return true;
  }
};
/** Bars shown after loading data or leaving a replay. */
const DEFAULT_VISIBLE_BARS = 160;

const mapCandle = (c: Candle) => ({ time: asTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close });
const mapVolume = (c: Candle) => ({ time: asTime(c.time), value: c.volume, color: c.close >= c.open ? 'rgba(38,166,154,0.45)' : 'rgba(239,83,80,0.45)' });
const mapLine = (p: LinePoint) => ({ time: asTime(p.time), value: p.value });

export function PriceChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const emaRef = useRef<ISeriesApi<'Line'> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const mapperRef = useRef(new TimeMapper());
  const primitiveRef = useRef<DrawingsPrimitive | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const sync = useRef<Record<string, { current: SyncMarker | null }>>({
    candle: { current: null },
    volume: { current: null },
    ema: { current: null },
  });

  const symbol = useTradingStore((s) => s.symbol);
  const timeframe = useTradingStore((s) => s.timeframe);
  // Changes whenever the underlying series is swapped (refetch, delete, finer timeframe).
  const dataKey = useTradingStore((s) => `${s.realData[s.symbol]?.fetchedAt ?? 'none'}|${s.baseTf}`);
  const status = useTradingStore((s) => s.replay.status);
  const indicators = useTradingStore((s) => s.indicators);
  const orderHistory = useTradingStore((s) => s.book.orderHistory);
  const closedTrades = useTradingStore((s) => s.book.closedTrades);
  const { candles, drawingTimes, emaData } = useChartData();
  const pp = usePricePrecision();

  const [legend, setLegend] = useState<Legend | null>(null);
  const [menu, setMenu] = useState<ContextTarget | null>(null);
  // "Auto (fits data to screen)": price scale follows the visible candles. Dragging the price axis turns it off.
  const [autoScale, setAutoScaleState] = useState(readAutoScale);
  const autoScalePreference = useRef(autoScale);
  const scaleInitialized = useRef(false);
  const cancelScaleInit = useRef<(() => void) | null>(null);
  const setAutoScale = useCallback((on: boolean) => {
    cancelScaleInit.current?.();
    cancelScaleInit.current = null;
    autoScalePreference.current = on;
    candleRef.current?.priceScale().applyOptions({ autoScale: on });
    setAutoScaleState(on);
    try {
      localStorage.setItem(AUTO_SCALE_KEY, String(on));
    } catch {
      /* storage unavailable */
    }
  }, []);
  const prevStatus = useRef(status);
  const closeMenu = useCallback(() => setMenu(null), []);
  const lastCandle = candles[candles.length - 1];

  // ───────────── chart lifecycle ─────────────
  useEffect(() => {
    const el = containerRef.current!;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#94a3b8',
        fontSize: 11,
        panes: { separatorColor: '#1e2533', separatorHoverColor: '#2a3346', enableResize: true },
      },
      grid: { vertLines: { color: '#131a26' }, horzLines: { color: '#131a26' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#1e2533', autoScale: true },
      timeScale: { borderColor: '#1e2533', timeVisible: true, secondsVisible: false, rightOffset: 10, shiftVisibleRangeOnNewBar: true },
      handleScale: { axisPressedMouseMove: { time: true, price: true }, mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
    });
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    // A saved manual mode has no saved price range; fit once before restoring it.
    candle.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 }, autoScale: true });
    const volume = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    const lineOpts = { lineWidth: 2 as const, priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: true };
    const emaS = chart.addSeries(LineSeries, { ...lineOpts, color: EMA_COLOR });

    chartRef.current = chart;
    candleRef.current = candle;
    volumeRef.current = volume;
    emaRef.current = emaS;
    markersRef.current = createSeriesMarkers(candle, []);

    const primitive = new DrawingsPrimitive(mapperRef.current, {
      symbol: () => useTradingStore.getState().symbol,
      precision: () => getSymbolSpec(useTradingStore.getState().symbol).pricePrecision,
    });
    candle.attachPrimitive(primitive);
    primitiveRef.current = primitive;
    const trade = new TradeLinesPrimitive(
      () => {
        const s = useTradingStore.getState();
        return {
          book: s.book,
          ticket: s.ticket,
          ticketLots: ticketLots(s),
          contractSize: getSymbolSpec(s.symbol).contractSize,
          market: marketPrice(s),
          showTicket: isReplayActive(s.replay.status),
        };
      },
      () => getSymbolSpec(useTradingStore.getState().symbol).pricePrecision,
    );
    candle.attachPrimitive(trade);
    // Trade lines take priority over drawings, so their listeners are registered first.
    const detachTrade = attachTradeInteractions({ container: el, chart, series: candle, primitive: trade });
    const unsubTrading = useTradingStore.subscribe((s, prev) => {
      if (s.book !== prev.book || s.ticket !== prev.ticket || s.replay !== prev.replay || s.account !== prev.account) trade.requestUpdate();
    });
    const detachDrawing = attachDrawingInteractions({ container: el, chart, series: candle, primitive, mapper: mapperRef.current, candles: () => candlesRef.current });
    const unsubDrawings = useDrawingStore.subscribe(() => primitive.requestUpdate());

    const onMove = (p: MouseEventParams<Time>) => {
      const d = p.seriesData.get(candle) as { open: number; high: number; low: number; close: number } | undefined;
      const v = p.seriesData.get(volume) as { value: number } | undefined;
      setLegend(d ? { o: d.open, h: d.high, l: d.low, c: d.close, v: v?.value ?? 0 } : null);
    };
    const onClick = (p: MouseEventParams<Time>) => {
      const s = useTradingStore.getState();
      if (s.replay.status === 'selecting' && p.time != null) s.selectCutoff(p.time as number);
    };
    chart.subscribeCrosshairMove(onMove);
    chart.subscribeClick(onClick);

    // Runs after the drawing layer's handler, which consumes right-clicks that cancel an active tool.
    const onContextMenu = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      if (useTradingStore.getState().replay.status === 'selecting') return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const inPane = x >= 0 && x <= chart.timeScale().width() && y >= 0 && y <= (chart.panes()[0]?.getHeight() ?? 0);
      const logical = chart.timeScale().coordinateToLogical(x);
      const bars = candlesRef.current;
      const bar = logical == null ? undefined : bars[Math.max(0, Math.min(bars.length - 1, Math.round(logical)))];
      const price = inPane ? (candle.coordinateToPrice(y) as number | null) : null;
      let drawingId: string | null = null;
      const vp = primitive.viewport();
      const ds = useDrawingStore.getState();
      if (inPane && vp && !ds.hidden) {
        drawingId = hitTestAll(drawingsFor(ds, useTradingStore.getState().symbol), vp, { x, y }, ds.selectedId)?.id ?? null;
        if (drawingId) ds.select(drawingId);
      }
      setMenu({ x, y, price: price != null && Number.isFinite(price) ? price : null, barTime: inPane && bar ? bar.time : null, drawingId });
    };
    el.addEventListener('contextmenu', onContextMenu);

    // LWC has no price-scale event: re-read autoScale after gestures that can change it
    // (axis drag / wheel over the axis turn it off, double-click on the axis turns it on).
    const syncAuto = () => requestAnimationFrame(() => {
      if (cancelScaleInit.current || !scaleInitialized.current) return;
      const on = candle.priceScale().options().autoScale;
      autoScalePreference.current = on;
      setAutoScaleState((prev) => {
        if (prev !== on) {
          try {
            localStorage.setItem(AUTO_SCALE_KEY, String(on));
          } catch {
            /* storage unavailable */
          }
        }
        return on;
      });
    });
    el.addEventListener('pointerup', syncAuto);
    el.addEventListener('wheel', syncAuto, { passive: true });
    el.addEventListener('dblclick', syncAuto);

    return () => {
      cancelScaleInit.current?.();
      cancelScaleInit.current = null;
      scaleInitialized.current = false;
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('pointerup', syncAuto);
      el.removeEventListener('wheel', syncAuto);
      el.removeEventListener('dblclick', syncAuto);
      unsubDrawings();
      detachDrawing();
      unsubTrading();
      detachTrade();
      primitiveRef.current = null;
      chart.unsubscribeCrosshairMove(onMove);
      chart.unsubscribeClick(onClick);
      chart.remove();
      chartRef.current = null;
      for (const r of Object.values(sync.current)) r.current = null;
    };
  }, []);

  // ───────────── data sync (runs every replay tick) ─────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !candleRef.current) return;
    mapperRef.current.set(drawingTimes, TIMEFRAME_SECONDS[timeframe]);
    candlesRef.current = candles;
    const ds = `${symbol}|${timeframe}|${dataKey}`;
    const full = syncSeries(candleRef.current, candles, mapCandle, ds, sync.current.candle);
    syncSeries(volumeRef.current!, indicators.volume.enabled ? candles : [], mapVolume, `${ds}|${indicators.volume.enabled}`, sync.current.volume);
    syncSeries(emaRef.current!, emaData, mapLine, `${ds}|${indicators.ema.enabled}|${indicators.ema.period}`, sync.current.ema);

    // Leaving a replay jumps back to the latest bars, even when the chart only appended them.
    const stopped = isReplayActive(prevStatus.current) && status === 'off';
    prevStatus.current = status;
    if ((full || stopped) && candles.length) {
      const n = candles.length;
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - DEFAULT_VISIBLE_BARS), to: n + 10 });
      if (!scaleInitialized.current) {
        scaleInitialized.current = true;
        const series = candleRef.current;
        cancelScaleInit.current = initializePriceScale(
          (on) => {
            series.priceScale().applyOptions({ autoScale: on });
            if (on === autoScalePreference.current) cancelScaleInit.current = null;
          },
          () => autoScalePreference.current,
        );
      }
    }
  }, [candles, drawingTimes, emaData, symbol, timeframe, indicators, dataKey, status]);

  // ───────────── per-symbol price format ─────────────
  useEffect(() => {
    const priceFormat = { type: 'price' as const, precision: pp, minMove: 10 ** -pp };
    candleRef.current?.applyOptions({ priceFormat });
    emaRef.current?.applyOptions({ priceFormat });
  }, [pp]);

  useEffect(() => {
    useDrawingStore.setState({ draft: null, selectedId: null, editingTextId: null });
    setMenu(null);
  }, [symbol]);

  // ───────────── execution markers ─────────────
  const lastTime = lastCandle?.time ?? 0;
  useEffect(() => {
    // Snap to the displayed bar containing the time (native real bars may not sit on UTC bucket boundaries).
    const barTimeAt = (time: number) => candles[lastIndexAtOrBefore(candles, time)]?.time;
    const markers: SeriesMarker<Time>[] = [];
    for (const o of orderHistory) {
      if (o.status !== 'filled' || o.filledAt == null) continue;
      const t = barTimeAt(o.filledAt);
      if (t == null || t > lastTime) continue;
      const buy = o.side === 'buy';
      markers.push({ time: asTime(t), position: buy ? 'belowBar' : 'aboveBar', shape: buy ? 'arrowUp' : 'arrowDown', color: buy ? '#22c55e' : '#f43f5e', text: buy ? "B" : "S" });
    }
    for (const tr of closedTrades) {
      const t = barTimeAt(tr.closedAt);
      if (t == null || t > lastTime) continue;
      markers.push({ time: asTime(t), position: tr.side === 'buy' ? 'aboveBar' : 'belowBar', shape: 'circle', color: tr.realizedPnl >= 0 ? '#22c55e' : '#f43f5e', text: tr.reason === 'stop_loss' ? 'SL' : tr.reason === 'take_profit' ? 'TP' : 'X' });
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    markersRef.current?.setMarkers(markers);
  }, [orderHistory, closedTrades, candles, lastTime]);

  // ───────────── selection-mode crosshair ─────────────
  useEffect(() => {
    const selecting = status === 'selecting';
    chartRef.current?.applyOptions({
      crosshair: { vertLine: { color: selecting ? '#3b82f6' : '#758696', width: selecting ? 2 : 1, style: selecting ? LineStyle.Solid : LineStyle.LargeDashed } },
    });
  }, [status]);

  const shown = legend ?? (lastCandle ? { o: lastCandle.open, h: lastCandle.high, l: lastCandle.low, c: lastCandle.close, v: lastCandle.volume } : null);
  const chg = shown ? shown.c - shown.o : 0;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className={`h-full w-full ${status === 'selecting' ? 'cursor-crosshair' : ''}`} />
      <DrawingProperties />
      {menu && (
        <ChartContextMenu
          target={menu}
          precision={pp}
          onClose={closeMenu}
          onFit={() => {
            chartRef.current?.timeScale().fitContent();
            setAutoScale(true);
          }}
          onScrollToLatest={() => chartRef.current?.timeScale().scrollToRealTime()}
        />
      )}

      {/* Legend */}
      <div className="pointer-events-none absolute left-3 top-2 z-10 space-y-0.5 text-[11px] font-mono">
        <div className="flex gap-3">
          <span className="font-semibold text-slate-100">{symbol} · {TIMEFRAME_LABELS[timeframe]}</span>
          {shown && (
            <span className={chg >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              O {fmtPrice(shown.o, pp)} H {fmtPrice(shown.h, pp)} L {fmtPrice(shown.l, pp)} C {fmtPrice(shown.c, pp)} V {shown.v.toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          {indicators.ema.enabled && <span style={{ color: EMA_COLOR }}>EMA {indicators.ema.period} {fmtPrice(emaData[emaData.length - 1]?.value, pp)}</span>}
        </div>
      </div>

      {/* Chart controls */}
      <div className="absolute bottom-8 left-3 z-10 flex gap-1">
        <ChartBtn title="Fit all data" onClick={() => chartRef.current?.timeScale().fitContent()}><Maximize2 size={13} /></ChartBtn>
        <ChartBtn title="Scroll to latest bar" onClick={() => chartRef.current?.timeScale().scrollToRealTime()}><MoveHorizontal size={13} /></ChartBtn>
      </div>

      {/* Sits in the empty corner where the price and time axes meet, like TradingView's "auto" toggle. */}
      <button
        onClick={() => setAutoScale(!autoScale)}
        aria-pressed={autoScale}
        title={autoScale ? 'Auto (fits data to screen) — on. Click to scale manually.' : 'Auto (fits data to screen) — off. Click to fit the price scale to the visible bars.'}
        className={cn(
          'absolute bottom-1 right-1 z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          autoScale ? 'bg-blue-600 text-white hover:bg-blue-500' : 'border border-slate-600 bg-slate-900/80 text-slate-400 hover:text-slate-100',
        )}
      >
        Auto
      </button>

      <NoDataOverlay />

      {status === 'selecting' && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-md border border-blue-500/50 bg-blue-600/20 px-3 py-1.5 text-xs text-blue-200 backdrop-blur">
          Click a candle to set the replay starting point · Esc to cancel
        </div>
      )}
    </div>
  );
}

function ChartBtn({ children, title, onClick }: { children: ReactNode; title: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick} className="rounded border border-slate-700/70 bg-slate-900/80 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
      {children}
    </button>
  );
}

function NoDataOverlay() {
  const hydrated = useTradingStore((s) => s.hydrated);
  const show = useTradingStore((s) => !hasData(s));
  const symbol = useTradingStore((s) => s.symbol);
  const loading = useTradingStore((s) => s.dataStatus.loading);
  const timeframe = useTradingStore((s) => s.timeframe);
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b0e14]/80">
      {!hydrated ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading saved data…</p>
      ) : (
        <div className="max-w-xs text-center text-sm">
          <Database size={28} className="mx-auto mb-2 text-slate-500" />
          <p className="mb-1 font-semibold text-slate-200">No {TIMEFRAME_LABELS[timeframe]} market data for {symbol}</p>
          <p className="mb-3 text-xs text-slate-500">Fetch real bars from Twelve Data or import an MT5 / MT4 / TradingView / CSV export. Data is saved in this browser and reloaded automatically next time.</p>
          <button
            onClick={() => useTradingStore.getState().setDataPanelOpen(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {loading ? 'Fetching…' : `Load ${symbol} data`}
          </button>
        </div>
      )}
    </div>
  );
}
