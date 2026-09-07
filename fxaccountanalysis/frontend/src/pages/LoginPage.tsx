import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/store';
import { Button, ErrorState, Field, inputClass } from '../components/ui';

export function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, fullName);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 lg:flex-row">
      <section className="flex flex-1 flex-col justify-center px-8 py-12 lg:px-16">
        <h1 className="text-4xl font-bold text-sky-400">FX Account Analysis</h1>
        <p className="mt-4 max-w-lg text-slate-400">
          Connect your MT5 account from Exness and see exactly where your edge is. Win/loss
          breakdowns by day, week, month and year, a full trade journal, and every trade replayed on
          a candlestick chart with entry and exit marked.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-slate-400">
          <li>• Period analytics: win rate, profit factor, average win/loss</li>
          <li>• Cumulative equity curve and per-symbol performance</li>
          <li>• Trade-by-trade chart replay with SL/TP levels</li>
          <li>• Credentials encrypted at rest, read-only investor password supported</li>
        </ul>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6"
        >
          <div className="flex gap-2">
            {(['login', 'register'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setMode(option);
                  setError(null);
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-sm capitalize transition ${
                  mode === option ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {option === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {mode === 'register' && (
            <Field label="Full name">
              <input
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Trader"
              />
            </Field>
          )}

          <Field label="Email">
            <input
              className={inputClass}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password">
            <input
              className={inputClass}
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </Field>

          {error && <ErrorState message={error} />}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </section>
    </div>
  );
}
