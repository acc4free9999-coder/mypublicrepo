import type { ReactNode } from 'react';

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg ${className}`}
    >
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-slate-200">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
  hint?: string;
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-400'
      : tone === 'negative'
        ? 'text-rose-400'
        : 'text-slate-100';
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const styles = {
    primary: 'bg-sky-600 hover:bg-sky-500 text-white',
    ghost: 'border border-slate-700 text-slate-300 hover:bg-slate-800',
    danger: 'bg-rose-600/90 hover:bg-rose-500 text-white',
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-200">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs font-semibold underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p className="p-4 text-sm text-slate-500">{label}</p>;
}

export function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}
