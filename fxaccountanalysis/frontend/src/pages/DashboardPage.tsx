import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import { useAccounts } from '../lib/store';
import { formatMoney, formatSigned } from '../lib/format';
import type { AnalyticsSummary, PeriodKey, TradeFilters } from '../lib/types';
import { Button, Card, Empty, ErrorState, Loading, Stat } from '../components/ui';
import { FilterBar } from '../components/FilterBar';

const PERIODS: PeriodKey[] = ['day', 'week', 'month', 'year'];

export function DashboardPage() {
  const { accounts, activeAccountId, accountsLoading } = useAccounts();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [filters, setFilters] = useState<TradeFilters>({});
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = accounts.find((a) => a.id === activeAccountId)?.currency ?? 'USD';

  const load = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    setError(null);
    try {
      setSummary(await api.analytics(period, { ...filters, account_id: activeAccountId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load analytics');
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, period, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const barData = useMemo(
    () =>
      (summary?.buckets ?? []).slice(-40).map((bucket) => ({
        label: bucket.period,
        net: bucket.net_pl,
        trades: bucket.total_trades,
        winRate: bucket.win_rate,
      })),
    [summary],
  );

  const equityData = useMemo(
    () =>
      (summary?.equity_curve ?? []).map((point) => ({
        time: new Date(point.time).toLocaleDateString(),
        equity: point.equity,
      })),
    [summary],
  );

  if (accountsLoading) return <Loading />;
  if (!activeAccountId) {
    return (
      <Card title="No account linked">
        <Empty label="Connect an MT5 account to see your performance analytics." />
        <Link to="/accounts" className="mt-3 inline-block text-sm text-sky-400 underline">
          Go to account connection
        </Link>
      </Card>
    );
  }

  const overall = summary?.overall;

  return (
    <div className="space-y-6">
      <Card
        title="Performance"
        action={
          <div className="flex gap-1 rounded-lg bg-slate-800 p-1">
            {PERIODS.map((option) => (
              <button
                key={option}
                onClick={() => setPeriod(option)}
                className={`rounded-md px-3 py-1 text-sm capitalize transition ${
                  period === option ? 'bg-sky-600 text-white' : 'text-slate-400'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        }
      >
        <FilterBar
          accountId={activeAccountId}
          filters={filters}
          onChange={setFilters}
          showSearch={false}
        />

        {error && (
          <div className="mt-4">
            <ErrorState message={error} onRetry={load} />
          </div>
        )}
        {loading && <Loading label="Crunching your trades…" />}

        {overall && !loading && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <Stat label="Trades" value={String(overall.total_trades)} />
            <Stat
              label="Win rate"
              value={`${overall.win_rate}%`}
              tone={overall.win_rate >= 50 ? 'positive' : 'negative'}
              hint={`${overall.wins}W / ${overall.losses}L`}
            />
            <Stat
              label="Net P/L"
              value={formatSigned(overall.net_pl, currency)}
              tone={overall.net_pl >= 0 ? 'positive' : 'negative'}
            />
            <Stat
              label="Profit factor"
              value={overall.profit_factor === null ? '∞' : overall.profit_factor.toFixed(2)}
              tone={(overall.profit_factor ?? 99) >= 1 ? 'positive' : 'negative'}
            />
            <Stat
              label="Avg win / loss"
              value={`${formatMoney(overall.average_win, currency)} / ${formatMoney(
                overall.average_loss,
                currency,
              )}`}
            />
            <Stat
              label="Largest win / loss"
              value={`${formatMoney(overall.largest_win, currency)} / ${formatMoney(
                overall.largest_loss,
                currency,
              )}`}
            />
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={`Net P/L per ${period}`}>
          {barData.length === 0 ? (
            <Empty label="No closed trades match these filters." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} interval="preserveStartEnd" />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155' }}
                  formatter={(value: number, name) =>
                    name === 'net' ? formatSigned(value, currency) : value
                  }
                />
                <Bar dataKey="net" radius={[3, 3, 0, 0]}>
                  {barData.map((entry) => (
                    <Cell
                      key={entry.label}
                      fill={entry.net >= 0 ? '#16a34a' : '#dc2626'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Cumulative equity curve">
          {equityData.length === 0 ? (
            <Empty label="Equity curve appears once trades are synced." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={equityData}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} minTickGap={40} />
                <YAxis stroke="#64748b" fontSize={11} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155' }}
                  formatter={(value: number) => formatMoney(value, currency)}
                />
                <Line type="monotone" dataKey="equity" stroke="#38bdf8" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title={`Breakdown by ${period}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4">Period</th>
                <th className="py-2 pr-4">Trades</th>
                <th className="py-2 pr-4">Wins</th>
                <th className="py-2 pr-4">Losses</th>
                <th className="py-2 pr-4">Win rate</th>
                <th className="py-2 pr-4">Net P/L</th>
                <th className="py-2 pr-4">Avg win</th>
                <th className="py-2 pr-4">Avg loss</th>
                <th className="py-2 pr-4">Profit factor</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.buckets ?? [])
                .slice()
                .reverse()
                .map((bucket) => (
                  <tr key={bucket.period} className="border-t border-slate-800">
                    <td className="py-2 pr-4 font-medium">{bucket.period}</td>
                    <td className="py-2 pr-4">{bucket.total_trades}</td>
                    <td className="py-2 pr-4 text-emerald-400">{bucket.wins}</td>
                    <td className="py-2 pr-4 text-rose-400">{bucket.losses}</td>
                    <td className="py-2 pr-4">{bucket.win_rate}%</td>
                    <td
                      className={`py-2 pr-4 font-medium ${
                        bucket.net_pl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatSigned(bucket.net_pl, currency)}
                    </td>
                    <td className="py-2 pr-4">{formatMoney(bucket.average_win, currency)}</td>
                    <td className="py-2 pr-4">{formatMoney(bucket.average_loss, currency)}</td>
                    <td className="py-2 pr-4">
                      {bucket.profit_factor === null ? '∞' : bucket.profit_factor.toFixed(2)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Performance by symbol"
        action={
          <Link to="/trades">
            <Button variant="ghost">View trade history</Button>
          </Link>
        }
      >
        {(summary?.by_symbol ?? []).length === 0 ? (
          <Empty label="No symbol data yet." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary!.by_symbol.map((row) => (
              <div key={row.symbol} className="rounded-lg border border-slate-800 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{row.symbol}</span>
                  <span
                    className={row.net_pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                  >
                    {formatSigned(row.net_pl, currency)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {row.total_trades} trades · {row.win_rate}% win rate · {row.wins}W/{row.losses}L
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
