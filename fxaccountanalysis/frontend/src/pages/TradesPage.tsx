import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAccounts } from '../lib/store';
import { formatDateTime, formatDuration, formatSigned } from '../lib/format';
import type { TradeFilters, TradePage } from '../lib/types';
import { Button, Card, Empty, ErrorState, Loading } from '../components/ui';
import { FilterBar } from '../components/FilterBar';

const COLUMNS: { key: string; label: string; sortable?: boolean }[] = [
  { key: 'open_time', label: 'Open', sortable: true },
  { key: 'close_time', label: 'Close', sortable: true },
  { key: 'symbol', label: 'Symbol', sortable: true },
  { key: 'direction', label: 'Side' },
  { key: 'volume', label: 'Lots', sortable: true },
  { key: 'open_price', label: 'Entry' },
  { key: 'close_price', label: 'Exit' },
  { key: 'stop_loss', label: 'SL' },
  { key: 'take_profit', label: 'TP' },
  { key: 'pips', label: 'Pips' },
  { key: 'duration', label: 'Duration' },
  { key: 'profit', label: 'P/L', sortable: true },
];

export function TradesPage() {
  const { activeAccountId, accounts } = useAccounts();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<TradeFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState('close_time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [includeOpen, setIncludeOpen] = useState(false);
  const [data, setData] = useState<TradePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = accounts.find((a) => a.id === activeAccountId)?.currency ?? 'USD';

  const load = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    setError(null);
    try {
      setData(
        await api.listTrades({
          ...filters,
          account_id: activeAccountId,
          page,
          page_size: pageSize,
          sort_by: sortBy,
          sort_dir: sortDir,
          include_open: includeOpen,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load trades');
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, filters, page, pageSize, sortBy, sortDir, includeOpen]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize, includeOpen, activeAccountId]);

  function toggleSort(key: string) {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(key);
      setSortDir('desc');
    }
  }

  if (!activeAccountId) {
    return (
      <Card title="No account linked">
        <Empty label="Connect an MT5 account to see your trade history." />
      </Card>
    );
  }

  return (
    <Card
      title="Trade history"
      action={
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={includeOpen}
            onChange={(e) => setIncludeOpen(e.target.checked)}
          />
          Include open positions
        </label>
      }
    >
      <FilterBar accountId={activeAccountId} filters={filters} onChange={setFilters} />

      {error && (
        <div className="mt-4">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}
      {loading && <Loading label="Loading trades…" />}

      {data && !loading && data.items.length === 0 && (
        <div className="mt-4">
          <Empty label="No trades match these filters." />
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      onClick={() => toggleSort(column.key)}
                      className={`whitespace-nowrap py-2 pr-4 ${
                        column.sortable ? 'cursor-pointer select-none hover:text-slate-300' : ''
                      }`}
                    >
                      {column.label}
                      {sortBy === column.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((trade) => (
                  <tr
                    key={trade.id}
                    onClick={() => navigate(`/trades/${trade.id}`)}
                    className={`cursor-pointer border-t border-slate-800 transition hover:bg-slate-800/60 ${
                      trade.is_open
                        ? 'bg-slate-800/20'
                        : trade.net_profit >= 0
                          ? 'bg-emerald-950/20'
                          : 'bg-rose-950/20'
                    }`}
                  >
                    <td className="whitespace-nowrap py-2 pr-4">
                      {formatDateTime(trade.open_time)}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      {trade.is_open ? 'Open' : formatDateTime(trade.close_time)}
                    </td>
                    <td className="py-2 pr-4 font-medium">{trade.symbol}</td>
                    <td
                      className={`py-2 pr-4 uppercase ${
                        trade.direction === 'buy' ? 'text-sky-400' : 'text-amber-400'
                      }`}
                    >
                      {trade.direction}
                    </td>
                    <td className="py-2 pr-4">{trade.volume}</td>
                    <td className="py-2 pr-4">{trade.open_price}</td>
                    <td className="py-2 pr-4">{trade.close_price ?? '—'}</td>
                    <td className="py-2 pr-4 text-slate-500">{trade.stop_loss ?? '—'}</td>
                    <td className="py-2 pr-4 text-slate-500">{trade.take_profit ?? '—'}</td>
                    <td className="py-2 pr-4">{trade.pips ?? '—'}</td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      {formatDuration(trade.duration_seconds)}
                    </td>
                    <td
                      className={`py-2 pr-4 font-semibold ${
                        trade.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatSigned(trade.net_profit, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span>
              {data.total} trades · page {data.page} of {data.pages}
            </span>
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button
                variant="ghost"
                disabled={page >= data.pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
