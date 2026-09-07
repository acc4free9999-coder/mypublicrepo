import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAccounts, useAuth } from '../lib/store';
import { formatMoney } from '../lib/format';
import { Button } from './ui';

const statusStyles: Record<string, string> = {
  connected: 'bg-emerald-500/15 text-emerald-300 border-emerald-700/50',
  disconnected: 'bg-slate-700/30 text-slate-300 border-slate-600/50',
  error: 'bg-rose-500/15 text-rose-300 border-rose-700/50',
  syncing: 'bg-amber-500/15 text-amber-300 border-amber-700/50',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs capitalize ${statusStyles[status] ?? statusStyles.disconnected}`}
    >
      {status}
    </span>
  );
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/trades', label: 'Trade History' },
  { to: '/accounts', label: 'Accounts' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { accounts, activeAccountId, setActiveAccountId } = useAccounts();
  const navigate = useNavigate();
  const active = accounts.find((a) => a.id === activeAccountId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-lg font-semibold text-sky-400">FX Analysis</span>

          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm transition ${
                    isActive ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            {accounts.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={activeAccountId ?? ''}
                  onChange={(event) => setActiveAccountId(Number(event.target.value))}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                  aria-label="Active account"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.login}
                    </option>
                  ))}
                </select>
                {active && (
                  <>
                    <StatusBadge status={active.status} />
                    <span className="hidden text-sm text-slate-400 sm:inline">
                      {formatMoney(active.equity, active.currency)}
                    </span>
                  </>
                )}
              </div>
            )}
            <span className="hidden text-sm text-slate-500 md:inline">{user?.email}</span>
            <Button
              variant="ghost"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
