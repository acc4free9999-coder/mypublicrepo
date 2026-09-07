import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAccounts } from '../lib/store';
import { formatDateTime, formatMoney } from '../lib/format';
import { StatusBadge } from '../components/Layout';
import { Button, Card, Empty, ErrorState, Field, Loading, inputClass } from '../components/ui';

const PROVIDERS = [
  {
    value: 'manual',
    label: 'Statement upload (free, any OS)',
    hint: 'In MT5 open History → right-click → Report → HTML/XLSX, then upload the file below. No password needed.',
    needsPassword: false,
  },
  {
    value: 'mt5',
    label: 'Native MT5 terminal (free, Windows only)',
    hint: 'Requires the MetaTrader 5 terminal installed on the same Windows machine as this backend.',
    needsPassword: true,
  },
  {
    value: 'demo',
    label: 'Demo data (generated sample trades)',
    hint: 'Generates a realistic sample history so you can explore the app without a real account.',
    needsPassword: false,
  },
];

export function AccountsPage() {
  const { accounts, accountsLoading, accountsError, refreshAccounts, setActiveAccountId } =
    useAccounts();
  const [form, setForm] = useState({
    name: '',
    login: '',
    password: '',
    server: 'Exness-MT5Real',
    broker: 'Exness',
    provider: 'manual',
    starting_balance: '10000',
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [importingId, setImportingId] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const selectedProvider = PROVIDERS.find((p) => p.value === form.provider) ?? PROVIDERS[0];

  async function handleConnect(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const account = await api.createAccount({
        name: form.name,
        login: form.login,
        broker: form.broker,
        server: form.server,
        provider: form.provider,
        starting_balance: Number(form.starting_balance) || 0,
        ...(selectedProvider.needsPassword ? { password: form.password } : {}),
      });
      await refreshAccounts();
      setActiveAccountId(account.id);
      setForm({ ...form, name: '', login: '', password: '' });
      setNotice(
        form.provider === 'manual'
          ? `Created ${account.name}. Now upload an MT5 statement for it using "Import statement".`
          : `Connected ${account.name} and synced trade history.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect the account');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(accountId: number, file: File | undefined) {
    if (!file) return;
    setImportingId(accountId);
    setError(null);
    setNotice(null);
    try {
      const result = await api.importStatement(accountId, file);
      setNotice(result.message);
      setActiveAccountId(accountId);
      await refreshAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import that statement');
    } finally {
      setImportingId(null);
      const input = fileInputs.current[accountId];
      if (input) input.value = '';
    }
  }

  async function handleSync(id: number) {
    setSyncingId(id);
    setError(null);
    setNotice(null);
    try {
      const result = await api.syncAccount(id);
      setNotice(result.message || 'Sync complete');
      if (!result.success) setError(result.message);
      await refreshAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Unlink this account and delete its stored trades?')) return;
    try {
      await api.deleteAccount(id);
      await refreshAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the account');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card title="Linked MT5 accounts">
        {accountsLoading && <Loading />}
        {accountsError && <ErrorState message={accountsError} onRetry={refreshAccounts} />}
        {!accountsLoading && !accountsError && accounts.length === 0 && (
          <Empty label="No accounts yet. Add one on the right, then upload an MT5 statement." />
        )}

        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{account.name}</span>
                <StatusBadge status={account.status} />
                <span className="text-xs text-slate-500">
                  {account.broker} · {account.server} · #{account.login}
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                  <input
                    ref={(el) => {
                      fileInputs.current[account.id] = el;
                    }}
                    type="file"
                    accept=".html,.htm,.xlsx"
                    className="hidden"
                    onChange={(e) => handleImport(account.id, e.target.files?.[0])}
                  />
                  <Button
                    variant="ghost"
                    disabled={importingId === account.id}
                    onClick={() => fileInputs.current[account.id]?.click()}
                  >
                    {importingId === account.id ? 'Importing…' : 'Import statement'}
                  </Button>
                  {account.provider !== 'manual' && (
                    <Button
                      variant="ghost"
                      disabled={syncingId === account.id}
                      onClick={() => handleSync(account.id)}
                    >
                      {syncingId === account.id ? 'Syncing…' : 'Sync now'}
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => handleDelete(account.id)}>
                    Remove
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Balance</p>
                  <p>{formatMoney(account.balance, account.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Equity</p>
                  <p>{formatMoney(account.equity, account.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Source</p>
                  <p className="capitalize">{account.provider}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Last updated</p>
                  <p>{formatDateTime(account.last_synced_at)}</p>
                </div>
              </div>

              {account.status_message && (
                <p className="mt-2 text-xs text-rose-300">{account.status_message}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Add an MT5 account">
        <form onSubmit={handleConnect} className="space-y-3">
          <Field label="Data source">
            <select
              className={inputClass}
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
            >
              {PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </Field>
          <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
            {selectedProvider.hint}
          </p>

          <Field label="Display name">
            <input
              className={inputClass}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Exness Real"
            />
          </Field>
          <Field label="MT5 account number">
            <input
              className={inputClass}
              required
              inputMode="numeric"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
              placeholder="12345678"
            />
          </Field>
          {selectedProvider.needsPassword && (
            <Field label="Investor (read-only) password">
              <input
                className={inputClass}
                required
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Read-only password preferred"
              />
            </Field>
          )}
          <Field label="Server">
            <input
              className={inputClass}
              value={form.server}
              onChange={(e) => setForm({ ...form, server: e.target.value })}
              placeholder="Exness-MT5Real"
            />
          </Field>
          <Field label="Broker">
            <input
              className={inputClass}
              required
              value={form.broker}
              onChange={(e) => setForm({ ...form, broker: e.target.value })}
            />
          </Field>
          <Field label="Starting balance">
            <input
              className={inputClass}
              inputMode="decimal"
              value={form.starting_balance}
              onChange={(e) => setForm({ ...form, starting_balance: e.target.value })}
              placeholder="10000"
            />
          </Field>

          {error && <ErrorState message={error} />}
          {notice && !error && (
            <p className="rounded-lg border border-emerald-800/50 bg-emerald-950/40 p-3 text-sm text-emerald-200">
              {notice}
            </p>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Working…' : 'Add account'}
          </Button>
          <p className="text-xs text-slate-500">
            100% free — no paid bridge required. Any password you provide is encrypted before
            storage and is never logged or returned by the API. Chart candles come from Yahoo
            Finance.
          </p>
        </form>
      </Card>
    </div>
  );
}
