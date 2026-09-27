export const fmtPrice = (v: number | undefined, p = 2) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: p, maximumFractionDigits: p });

export const fmtUsd = (v: number, signed = false) => {
  if (!Number.isFinite(v)) return '—';
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = v < 0 ? '-' : signed && v > 0 ? '+' : '';
  return `${sign}$${s}`;
};

export const fmtQty = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 6 });

export const fmtTime = (t: number) => {
  const d = new Date(t * 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

export const pnlClass = (v: number) => (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-slate-300');

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
