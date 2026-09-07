import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAccounts } from '../lib/store';
import { formatDateTime, formatDuration, formatSigned } from '../lib/format';
import type { TradeChart, Timeframe } from '../lib/types';
import { Card, Empty, ErrorState, Loading } from '../components/ui';
import { CandleChart } from '../components/CandleChart';

const TIMEFRAMES: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

export function TradeDetailPage() {
  const { tradeId } = useParams<{ tradeId: string }>();
  const { accounts } = useAccounts();
  const [data, setData] = useState<TradeChart | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tradeId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getTradeChart(Number(tradeId), timeframe ?? undefined);
      setData(result);
      setTimeframe((current) => current ?? result.timeframe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the chart');
    } finally {
      setLoading(false);
    }
  }, [tradeId, timeframe]);

  useEffect(() => {
    void load();
  }, [load]);

  const trade = data?.trade;
  const currency = accounts.find((a) => a.id === trade?.account_id)?.currency ?? 'USD';

  return (
    <div className="space-y-4">
      <Link to="/trades" className="inline-block text-sm text-sky-400 hover:underline">
        ← Back to trade history
      </Link>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <Card
          title={trade ? `${trade.symbol} · ${trade.direction.toUpperCase()}` : 'Trade chart'}
          action={
            <div className="flex flex-wrap gap-1 rounded-lg bg-slate-800 p-1">
              {TIMEFRAMES.map((option) => (
                <button
                  key={option}
                  onClick={() => setTimeframe(option)}
                  className={`rounded-md px-2 py-1 text-xs transition ${
                    (timeframe ?? data?.timeframe) === option
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          }
        >
          {loading && !data && <Loading label="Loading candles…" />}
          {error && <ErrorState message={error} onRetry={load} />}
          {data && data.candles.length === 0 && !loading && (
            <Empty label="No market data available for this window." />
          )}
          {data && data.candles.length > 0 && <CandleChart data={data} />}
          {data && (
            <p className="mt-2 text-xs text-slate-500">
              {data.candles.length} candles · {data.timeframe} · blue = entry, purple = exit, red =
              stop loss, green = take profit. Scroll to zoom, drag to pan.
            </p>
          )}
        </Card>

        <Card title="Trade details">
          {!trade && !error && <Loading />}
          {trade && (
            <dl className="space-y-2 text-sm">
              {[
                ['Ticket', trade.ticket],
                ['Symbol', trade.symbol],
                ['Direction', trade.direction.toUpperCase()],
                ['Lot size', String(trade.volume)],
                ['Entry price', String(trade.open_price)],
                ['Entry time', formatDateTime(trade.open_time)],
                ['Exit price', trade.close_price === null ? 'Still open' : String(trade.close_price)],
                ['Exit time', trade.is_open ? 'Still open' : formatDateTime(trade.close_time)],
                ['Stop loss', trade.stop_loss === null ? '—' : String(trade.stop_loss)],
                ['Take profit', trade.take_profit === null ? '—' : String(trade.take_profit)],
                ['Pips', trade.pips === null ? '—' : String(trade.pips)],
                ['Duration', formatDuration(trade.duration_seconds)],
                ['Commission', formatSigned(trade.commission, currency)],
                ['Swap', formatSigned(trade.swap, currency)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-slate-800 pb-1">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right text-slate-200">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 pt-2">
                <dt className="text-slate-500">Net P/L</dt>
                <dd
                  className={`text-right text-lg font-semibold ${
                    trade.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatSigned(trade.net_profit, currency)}
                </dd>
              </div>
            </dl>
          )}
        </Card>
      </div>
    </div>
  );
}
