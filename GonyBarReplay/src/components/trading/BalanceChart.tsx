import { useEffect, useMemo, useRef, useState } from 'react';
import type { BalanceCurve } from '@/engine/stats';
import { cn, fmtTime, fmtUsd, pnlClass } from '@/lib/format';

const HEIGHT = 150;
const PAD = { top: 12, right: 76, bottom: 18, left: 8 };

const niceStep = (range: number, ticks: number) => {
  const raw = range / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * mag;
};

/** Line chart of realized balance per closed trade, with the starting balance as baseline. */
export function BalanceChart({ curve, initialBalance }: { curve: BalanceCurve; initialBalance: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { points } = curve;
  const geo = useMemo(() => {
    const vals = points.map((p) => p.balance);
    let lo = Math.min(...vals, initialBalance);
    let hi = Math.max(...vals, initialBalance);
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
    const w = Math.max(1, width - PAD.left - PAD.right);
    const h = HEIGHT - PAD.top - PAD.bottom;
    const n = Math.max(1, points.length - 1);
    const x = (i: number) => PAD.left + (i / n) * w;
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * h;
    const step = niceStep(hi - lo, 4);
    const ticks: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join('');
    const base = y(initialBalance);
    const area = `${line}L${x(points.length - 1).toFixed(1)},${base.toFixed(1)}L${x(0).toFixed(1)},${base.toFixed(1)}Z`;
    return { x, y, ticks, line, area, base, w };
  }, [points, initialBalance, width]);

  const last = points[points.length - 1];
  const change = last.balance - initialBalance;
  const up = change >= 0;
  const color = up ? '#34d399' : '#fb7185';
  const hp = hover != null ? points[hover] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - r.left - PAD.left) / geo.w;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(rel * (points.length - 1)))));
  };

  return (
    <div className="border-b border-slate-800 px-3 py-2" data-testid="balance-chart">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 font-mono text-[11px]">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Balance</span>
        <span className="text-slate-200">{fmtUsd(last.balance)}</span>
        <span className={pnlClass(change)}>
          {fmtUsd(change, true)} ({up ? '+' : ''}{((change / initialBalance) * 100).toFixed(2)}%)
        </span>
        {hp && (
          <span className="ml-auto text-slate-400">
            {hp.index === 0 ? 'Start' : `Trade #${hp.index} · ${fmtTime(hp.time!)}`} ·{' '}
            <span className="text-slate-200">{fmtUsd(hp.balance)}</span>
            {hp.index > 0 && <span className={cn('ml-1', pnlClass(hp.pnl))}>{fmtUsd(hp.pnl, true)}</span>}
            {hp.drawdown < 0 && <span className="ml-1 text-rose-400/80">DD {fmtUsd(hp.drawdown)}</span>}
          </span>
        )}
      </div>
      <div ref={ref} className="w-full">
        {width > 0 && (
          <svg width={width} height={HEIGHT} className="block select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
            <defs>
              <linearGradient id="balance-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={up ? 0.28 : 0.04} />
                <stop offset="100%" stopColor={color} stopOpacity={up ? 0.04 : 0.28} />
              </linearGradient>
            </defs>
            {geo.ticks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={PAD.left + geo.w} y1={geo.y(v)} y2={geo.y(v)} stroke="#1e293b" />
                <text x={width - PAD.right + 6} y={geo.y(v) + 3} fontSize="10" fill="#64748b" fontFamily="ui-monospace, monospace">
                  {fmtUsd(v).replace('.00', '')}
                </text>
              </g>
            ))}
            <line x1={PAD.left} x2={PAD.left + geo.w} y1={geo.base} y2={geo.base} stroke="#94a3b8" strokeDasharray="4 3" strokeOpacity={0.6} />
            <path d={geo.area} fill="url(#balance-fill)" />
            <path d={geo.line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
            {points.length <= 60 &&
              points.slice(1).map((p) => (
                <circle key={p.index} cx={geo.x(p.index)} cy={geo.y(p.balance)} r={2.2} fill={p.pnl > 0 ? '#34d399' : p.pnl < 0 ? '#fb7185' : '#94a3b8'} />
              ))}
            <text x={PAD.left} y={HEIGHT - 4} fontSize="10" fill="#64748b" fontFamily="ui-monospace, monospace">Start</text>
            <text x={PAD.left + geo.w} y={HEIGHT - 4} fontSize="10" fill="#64748b" textAnchor="end" fontFamily="ui-monospace, monospace">
              Trade #{last.index}
            </text>
            {hp && (
              <g pointerEvents="none">
                <line x1={geo.x(hp.index)} x2={geo.x(hp.index)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#64748b" strokeDasharray="3 3" />
                <circle cx={geo.x(hp.index)} cy={geo.y(hp.balance)} r={4} fill={color} stroke="#0f131b" strokeWidth={2} />
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
