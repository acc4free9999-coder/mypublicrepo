import { useState } from 'react';
import { Settings2, Wallet } from 'lucide-react';
import { fmtUsd, pnlClass } from '@/lib/format';
import { LEVERAGE_OPTIONS, useTradingStore } from '@/store/useTradingStore';

export function AccountSummary() {
  const account = useTradingStore((s) => s.account);
  const trades = useTradingStore((s) => s.book.closedTrades);
  const [editing, setEditing] = useState(false);
  const wins = trades.filter((t) => t.realizedPnl > 0).length;
  const ret = (account.equity / account.initialBalance - 1) * 100;

  const rows: [string, string, string?][] = [
    ['Starting balance', fmtUsd(account.initialBalance)],
    ['Balance', fmtUsd(account.balance)],
    ['Equity', fmtUsd(account.equity)],
    ['Unrealized PnL', fmtUsd(account.unrealizedPnl, true), pnlClass(account.unrealizedPnl)],
    ['Realized PnL', fmtUsd(account.realizedPnl, true), pnlClass(account.realizedPnl)],
    ['Margin used', fmtUsd(account.marginUsed)],
    ['Free margin', fmtUsd(account.equity - account.marginUsed)],
    ['Win rate', trades.length ? `${((wins / trades.length) * 100).toFixed(0)}% (${wins}/${trades.length})` : '—'],
  ];

  return (
    <section className="border-b border-slate-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Wallet size={14} /> Paper account</h2>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-xs ${pnlClass(ret)}`}>{ret >= 0 ? '+' : ''}{ret.toFixed(2)}%</span>
          <button
            title="Account settings"
            aria-label="Account settings"
            aria-pressed={editing}
            onClick={() => setEditing((v) => !v)}
            className={`rounded p-1 ${editing ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <Settings2 size={14} />
          </button>
        </div>
      </div>
      {editing && <AccountSettingsForm onDone={() => setEditing(false)} />}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {rows.map(([k, v, c]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className={`text-right font-mono ${c ?? 'text-slate-200'}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[10px] text-slate-600">Leverage 1:{account.leverage} · USD</p>
    </section>
  );
}

function AccountSettingsForm({ onDone }: { onDone: () => void }) {
  const settings = useTradingStore((s) => s.settings);
  const hasActivity = useTradingStore((s) => s.book.positions.length + s.book.pendingOrders.length + s.book.closedTrades.length > 0);
  const setAccountSettings = useTradingStore((s) => s.setAccountSettings);
  const [balance, setBalance] = useState(String(settings.balance));
  const [leverage, setLeverage] = useState(settings.leverage);

  const balanceN = Number(balance);
  const valid = Number.isFinite(balanceN) && balanceN > 0;
  const resets = valid && balanceN !== settings.balance;

  const apply = () => {
    if (!valid) return;
    if (resets && hasActivity && !window.confirm('Changing the starting balance resets the paper account (positions, orders and history). Continue?')) return;
    setAccountSettings({ balance: balanceN, leverage });
    onDone();
  };

  return (
    <form
      className="mb-3 space-y-2 rounded-md border border-slate-700 bg-slate-900/60 p-2 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <label className="block">
        <span className="mb-1 block text-slate-500">Starting balance (USD)</span>
        <input
          type="number"
          min={0}
          step="any"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm outline-none focus:border-blue-500"
        />
      </label>
      <div className="flex flex-wrap gap-1">
        {[1_000, 10_000, 50_000, 100_000, 1_000_000].map((v) => (
          <button key={v} type="button" onClick={() => setBalance(String(v))} className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-slate-100">
            {v >= 1_000_000 ? `${v / 1_000_000}M` : `${v / 1_000}k`}
          </button>
        ))}
      </div>
      <label className="flex items-center justify-between">
        <span className="text-slate-500">Leverage</span>
        <select value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono outline-none focus:border-blue-500">
          {LEVERAGE_OPTIONS.map((l) => (
            <option key={l} value={l}>1:{l}</option>
          ))}
        </select>
      </label>
      {resets && <p className="text-[10px] text-amber-300/80">A new starting balance resets the paper account.</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800">Cancel</button>
        <button type="submit" disabled={!valid} className="rounded bg-blue-600 px-2 py-1 font-semibold text-white hover:bg-blue-500 disabled:opacity-40">Apply</button>
      </div>
    </form>
  );
}
