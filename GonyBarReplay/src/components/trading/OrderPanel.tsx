import { AlertTriangle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { getSymbolSpec } from '@/data/generator';
import { riskAmount } from '@/engine/risk';
import { cn, fmtPrice, fmtQty, fmtUsd } from '@/lib/format';
import { isReplayActive, marketPrice, ticketLots, useTradingStore } from '@/store/useTradingStore';
import type { OrderType, Side } from '@/types';

const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

export function OrderPanel() {
  const symbol = useTradingStore((s) => s.symbol);
  const status = useTradingStore((s) => s.replay.status);
  const price = useTradingStore(marketPrice);
  const lastError = useTradingStore((s) => s.lastError);
  const t = useTradingStore((s) => s.ticket);
  const lots = useTradingStore(ticketLots);
  const balance = useTradingStore((s) => s.account.balance);
  const { submitTicket, clearError, updateTicket } = useTradingStore.getState();
  const spec = getSymbolSpec(symbol);
  const { side, type, qty, price: limit, slOn: useSl, tpOn: useTp, sl, tp, sizing, riskPct } = t;

  const enabled = isReplayActive(status) && Number.isFinite(price);
  const entry = type === 'market' ? price : num(limit) ?? price;
  const qtyN = lots;
  const cs = spec.contractSize;

  const setSide = (v: Side) => updateTicket({ side: v });
  const setType = (v: OrderType) => updateTicket({ type: v });
  const setQty = (v: string) => updateTicket({ qty: v });
  const setLimit = (v: string) => updateTicket({ price: v });
  const setUseSl = (v: boolean) => updateTicket({ slOn: v });
  const setUseTp = (v: boolean) => updateTicket({ tpOn: v });
  const setSl = (v: string) => updateTicket({ sl: v });
  const setTp = (v: string) => updateTicket({ tp: v });

  const slN = useSl ? num(sl) : undefined;
  const tpN = useTp ? num(tp) : undefined;
  const risk = slN != null ? riskAmount(qtyN, entry, slN, cs) : null;
  const reward = tpN != null ? riskAmount(qtyN, entry, tpN, cs) : null;
  const pctOf = (v: number) => (balance > 0 ? ` (${((v / balance) * 100).toFixed(2)}%)` : '');
  const lotHint = `${fmtQty(qtyN * cs)} ${spec.unit} · ≈ ${fmtUsd(entry * qtyN * cs)}`;

  const submit = () => submitTicket();

  const buy = side === 'buy';
  return (
    <section className="flex flex-col gap-3 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Order ticket · {symbol}</h2>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setSide('sell')} className={cn('rounded-md border px-2 py-2 text-left', !buy ? 'border-rose-500 bg-rose-500/15' : 'border-slate-700 hover:border-slate-500')}>
          <div className="text-[10px] uppercase text-rose-400">Sell</div>
          <div className="font-mono text-sm text-slate-100">{fmtPrice(price, spec.pricePrecision)}</div>
        </button>
        <button onClick={() => setSide('buy')} className={cn('rounded-md border px-2 py-2 text-right', buy ? 'border-emerald-500 bg-emerald-500/15' : 'border-slate-700 hover:border-slate-500')}>
          <div className="text-[10px] uppercase text-emerald-400">Buy</div>
          <div className="font-mono text-sm text-slate-100">{fmtPrice(price, spec.pricePrecision)}</div>
        </button>
      </div>

      <div className="flex overflow-hidden rounded-md border border-slate-700">
        {(['market', 'limit', 'stop'] as OrderType[]).map((t) => (
          <button key={t} onClick={() => setType(t)} className={cn('flex-1 py-1 text-xs capitalize', t === type ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800')}>
            {t}
          </button>
        ))}
      </div>

      {type !== 'market' && <Field label={`${type === 'limit' ? 'Limit' : 'Stop'} price`} value={limit} onChange={setLimit} step={10 ** -spec.pricePrecision} />}
      <div className="flex overflow-hidden rounded-md border border-slate-700 text-xs" role="group" aria-label="Position sizing">
        <button onClick={() => updateTicket({ sizing: 'lots' })} className={cn('flex-1 py-1', sizing === 'lots' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800')}>Lots</button>
        <button onClick={() => updateTicket({ sizing: 'risk' })} className={cn('flex-1 py-1', sizing === 'risk' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800')}>Risk % of balance</button>
      </div>
      {sizing === 'lots' ? (
        <Field label="Lots" value={qty} onChange={setQty} step={spec.qtyStep} hint={lotHint} />
      ) : (
        <>
          <Field label="Risk %" value={riskPct} onChange={(v) => updateTicket({ riskPct: v })} step={0.1} hint={`${fmtUsd((balance * (Number(riskPct) || 0)) / 100)} of ${fmtUsd(balance)}`} />
          <div className="-mt-1 flex justify-between rounded-md bg-slate-800/60 px-2 py-1.5 text-xs">
            <span className="text-slate-500">Position size</span>
            <span className="font-mono text-slate-200">{qtyN ? `${fmtQty(qtyN)} lots · ${lotHint}` : 'Set a stop loss'}</span>
          </div>
        </>
      )}

      <Bracket label="Stop loss" color="text-rose-400" on={useSl} setOn={setUseSl} value={sl} setValue={setSl} step={10 ** -spec.pricePrecision} hint={risk != null ? `Risk ${fmtUsd(risk)}${pctOf(risk)}` : undefined} lockOn={sizing === 'risk'} />
      <Bracket label="Take profit" color="text-emerald-400" on={useTp} setOn={setUseTp} value={tp} setValue={setTp} step={10 ** -spec.pricePrecision} hint={reward != null ? `Reward ${fmtUsd(reward)}${pctOf(reward)}${risk ? ` · R:R ${(reward / risk).toFixed(2)}` : ''}` : undefined} />

      {lastError && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-200">
          <AlertTriangle size={14} className="mt-px shrink-0" />
          <span className="flex-1">{lastError}</span>
          <button onClick={clearError} className="text-amber-400 hover:text-amber-200">✕</button>
        </div>
      )}

      <button
        disabled={!enabled || !qtyN}
        onClick={submit}
        className={cn('flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40', buy ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500')}
      >
        {buy ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        {buy ? 'Buy' : 'Sell'} {qtyN ? `${fmtQty(qtyN)} lots` : ''} {type !== 'market' ? `${type.toUpperCase()} @ ${limit}` : 'MKT'}
      </button>
      {!enabled && <p className="text-center text-[11px] text-slate-500">Start a bar replay to enable paper trading.</p>}
      {enabled && (type !== 'market' || useSl || useTp) && <p className="text-center text-[11px] text-slate-500">Drag the preview lines on the chart to adjust entry, SL and TP.</p>}
    </section>
  );
}

function Field({ label, value, onChange, step, hint }: { label: string; value: string; onChange: (v: string) => void; step: number; hint?: string }) {
  return (
    <label className="block text-xs">
      <div className="mb-1 flex justify-between text-slate-500"><span>{label}</span>{hint && <span>{hint}</span>}</div>
      <input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm outline-none focus:border-blue-500" />
    </label>
  );
}

function Bracket(p: { label: string; color: string; on: boolean; setOn: (v: boolean) => void; value: string; setValue: (v: string) => void; step: number; hint?: string; lockOn?: boolean }) {
  return (
    <div className="text-xs">
      <label className="mb-1 flex items-center justify-between">
        <span className={cn('flex items-center gap-1.5', p.on ? p.color : 'text-slate-500')}>
          <input type="checkbox" checked={p.on} disabled={p.lockOn} title={p.lockOn ? 'Required for risk-based sizing' : undefined} onChange={(e) => p.setOn(e.target.checked)} className="accent-blue-500" /> {p.label}
        </span>
        {p.on && p.hint && <span className="text-slate-500">{p.hint}</span>}
      </label>
      {p.on && <input type="number" step={p.step} value={p.value} onChange={(e) => p.setValue(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm outline-none focus:border-blue-500" />}
    </div>
  );
}
