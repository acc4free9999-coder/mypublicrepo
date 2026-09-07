import { useEffect, useRef } from 'react';
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { TradeChart } from '../lib/types';

export function CandleChart({ data }: { data: TradeChart }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#020617' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#334155' },
      timeScale: { borderColor: '#334155', timeVisible: true, secondsVisible: false },
      width: container.clientWidth,
      height: container.clientHeight,
    });

    const series = chart.addCandlestickSeries({
      upColor: '#16a34a',
      downColor: '#dc2626',
      borderUpColor: '#16a34a',
      borderDownColor: '#dc2626',
      wickUpColor: '#16a34a',
      wickDownColor: '#dc2626',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const observer = new ResizeObserver(() => {
      if (chartRef.current !== chart) return;
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chartRef.current = null;
      seriesRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    series.setData(
      data.candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );

    const isBuy = data.trade.direction === 'buy';
    series.setMarkers(
      data.markers.map((marker) => ({
        time: marker.time as UTCTimestamp,
        position: marker.kind === 'entry' ? (isBuy ? 'belowBar' : 'aboveBar') : isBuy ? 'aboveBar' : 'belowBar',
        color: marker.kind === 'entry' ? '#38bdf8' : data.trade.net_profit >= 0 ? '#16a34a' : '#dc2626',
        shape:
          marker.kind === 'entry'
            ? isBuy
              ? 'arrowUp'
              : 'arrowDown'
            : isBuy
              ? 'arrowDown'
              : 'arrowUp',
        text: marker.label,
      })),
    );

    const priceLines = [
      { price: data.trade.open_price, color: '#38bdf8', title: 'Entry' },
      ...(data.trade.close_price !== null
        ? [{ price: data.trade.close_price, color: '#a78bfa', title: 'Exit' }]
        : []),
      ...(data.stop_loss !== null ? [{ price: data.stop_loss, color: '#dc2626', title: 'SL' }] : []),
      ...(data.take_profit !== null
        ? [{ price: data.take_profit, color: '#16a34a', title: 'TP' }]
        : []),
    ].map((line) =>
      series.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: line.title,
      }),
    );

    chart.timeScale().fitContent();

    return () => {
      // On unmount the chart may already be disposed; removing price lines from
      // a disposed series throws.
      if (chartRef.current !== chart) return;
      priceLines.forEach((line) => series.removePriceLine(line));
    };
  }, [data]);

  return <div ref={containerRef} className="h-[460px] w-full" />;
}
