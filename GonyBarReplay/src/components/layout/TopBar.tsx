import { SYMBOLS } from '@/data/generator';
import { cn } from '@/lib/format';
import { useTradingStore } from '@/store/useTradingStore';
import { TIMEFRAME_LABELS, TIMEFRAMES } from '@/types';
import { DataSourceMenu } from './DataSourceMenu';

export function TopBar() {
  const symbol = useTradingStore((s) => s.symbol);
  const timeframe = useTradingStore((s) => s.timeframe);
  const indicators = useTradingStore((s) => s.indicators);
  const { setSymbol, setTimeframe, setIndicators } = useTradingStore.getState();

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 overflow-x-auto whitespace-nowrap border-b border-slate-800 bg-[#0f131b] px-3 [&>*]:shrink-0">
      <div className="flex items-center gap-2 pr-2 font-semibold text-slate-100">
        <img src="/favicon.svg" alt="" width={22} height={22} className="rounded-[5px]" /> GonyBarReplay
      </div>
      <select
        value={symbol}
        onChange={(e) => {
          if (useTradingStore.getState().replay.status !== 'off' && !confirm('Switching symbol ends the replay and clears paper trades. Continue?')) return;
          setSymbol(e.target.value);
        }}
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm font-semibold outline-none"
        title="Symbol"
      >
        {SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
      </select>
      <div className="flex overflow-hidden rounded-md border border-slate-700">
        {TIMEFRAMES.map((tf) => (
          <button key={tf} onClick={() => setTimeframe(tf)} className={cn('px-2.5 py-1 text-xs font-medium', tf === timeframe ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800')}>
            {TIMEFRAME_LABELS[tf]}
          </button>
        ))}
      </div>
      <div className="mx-1 h-5 w-px bg-slate-700" />
      <div className="flex items-center gap-2">
        <label className={cn('flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs', indicators.ema.enabled ? 'border-slate-600 text-slate-200' : 'border-slate-800 text-slate-500')}>
          <input type="checkbox" checked={indicators.ema.enabled} onChange={(e) => setIndicators({ ema: { enabled: e.target.checked } })} className="accent-blue-500" />
          EMA
          <input
            type="number"
            min={1}
            max={500}
            value={indicators.ema.period}
            onChange={(e) => setIndicators({ ema: { period: Number(e.target.value) } })}
            className="w-10 rounded bg-slate-900 px-1 text-right text-xs outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="EMA period"
          />
        </label>
        <label className={cn('flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs', indicators.volume.enabled ? 'border-slate-600 text-slate-200' : 'border-slate-800 text-slate-500')}>
          <input type="checkbox" checked={indicators.volume.enabled} onChange={(e) => setIndicators({ volume: { enabled: e.target.checked } })} className="accent-blue-500" />
          Volume
        </label>
      </div>
      <DataSourceMenu />
    </header>
  );
}
