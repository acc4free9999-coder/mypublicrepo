import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { TradeFilters } from '../lib/types';
import { inputClass } from './ui';

export function FilterBar({
  accountId,
  filters,
  onChange,
  showResult = true,
  showSearch = true,
}: {
  accountId: number | null;
  filters: TradeFilters;
  onChange: (next: TradeFilters) => void;
  showResult?: boolean;
  showSearch?: boolean;
}) {
  const [symbols, setSymbols] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .listSymbols(accountId)
      .then((list) => {
        if (!cancelled) setSymbols(list);
      })
      .catch(() => {
        if (!cancelled) setSymbols([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const update = (patch: Partial<TradeFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-slate-500">
        <span className="mb-1 block uppercase tracking-wide">Symbol</span>
        <select
          className={inputClass}
          value={filters.symbol ?? ''}
          onChange={(e) => update({ symbol: e.target.value })}
        >
          <option value="">All symbols</option>
          {symbols.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-slate-500">
        <span className="mb-1 block uppercase tracking-wide">Direction</span>
        <select
          className={inputClass}
          value={filters.direction ?? ''}
          onChange={(e) => update({ direction: e.target.value as TradeFilters['direction'] })}
        >
          <option value="">Buy &amp; sell</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
      </label>

      {showResult && (
        <label className="text-xs text-slate-500">
          <span className="mb-1 block uppercase tracking-wide">Result</span>
          <select
            className={inputClass}
            value={filters.result ?? ''}
            onChange={(e) => update({ result: e.target.value as TradeFilters['result'] })}
          >
            <option value="">All results</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
          </select>
        </label>
      )}

      <label className="text-xs text-slate-500">
        <span className="mb-1 block uppercase tracking-wide">From</span>
        <input
          type="date"
          className={inputClass}
          value={filters.from ?? ''}
          onChange={(e) => update({ from: e.target.value })}
        />
      </label>

      <label className="text-xs text-slate-500">
        <span className="mb-1 block uppercase tracking-wide">To</span>
        <input
          type="date"
          className={inputClass}
          value={filters.to ?? ''}
          onChange={(e) => update({ to: e.target.value })}
        />
      </label>

      {showSearch && (
        <label className="text-xs text-slate-500">
          <span className="mb-1 block uppercase tracking-wide">Search</span>
          <input
            className={inputClass}
            placeholder="Symbol or ticket"
            value={filters.search ?? ''}
            onChange={(e) => update({ search: e.target.value })}
          />
        </label>
      )}

      <button
        type="button"
        onClick={() =>
          onChange({ symbol: '', direction: '', result: '', from: '', to: '', search: '' })
        }
        className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"
      >
        Reset
      </button>
    </div>
  );
}
