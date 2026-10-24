import { Play, Square } from 'lucide-react';
import { visibleCandles } from '@/data/aggregate';
import { cn } from '@/lib/format';
import { runPineScript } from '@/pine/runtime';
import { usePineStore } from '@/store/usePineStore';
import { useTradingStore } from '@/store/useTradingStore';

export function PineEditor() {
  const source = usePineStore((state) => state.source);
  const activeSource = usePineStore((state) => state.activeSource);
  const error = usePineStore((state) => state.error);
  const { setSource, run, setError, clear } = usePineStore.getState();

  const execute = () => {
    try {
      const market = useTradingStore.getState();
      const cursor = market.replay.status === 'selecting' ? market.base.length - 1 : market.replay.cursor;
      const candles = visibleCandles(market.base, market.timeframe, cursor, market.baseTf);
      runPineScript(source, candles);
      run(source);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 p-2">
      <div className="flex min-h-0 flex-1 gap-2">
        <textarea
          aria-label="Pine Script editor"
          spellCheck={false}
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setError(null);
          }}
          className="min-h-0 min-w-0 flex-1 resize-none rounded border border-slate-700 bg-[#0b0e14] p-2 font-mono text-[11px] leading-4 text-slate-200 outline-none focus:border-blue-500"
        />
        <div className="flex w-56 shrink-0 flex-col gap-1 text-[10px] leading-4 text-slate-500">
          <div className="font-semibold text-slate-300">Supported Pine v5/v6 subset</div>
          <div>OHLCV, arithmetic, comparisons, ternaries, history offsets, plot(), input.int/float/string/bool/color()</div>
          <div>String option arrays and hex color literals</div>
          <div>ta.sma/ema/rsi · math.abs/max/min/round · color.*</div>
          <div>Indicators only; no strategies, loops, drawing objects, or external requests.</div>
          <div>Plots use only bars currently visible in replay.</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={execute} className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-500">
          <Play size={12} /> Run
        </button>
        <button onClick={clear} disabled={!activeSource} className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40">
          <Square size={11} /> Stop
        </button>
        <span className={cn('min-w-0 truncate text-[10px]', error ? 'text-rose-400' : activeSource ? 'text-emerald-400' : 'text-slate-500')} role="status">
          {error ?? (activeSource ? 'Running · edits apply when you click Run' : 'Stopped')}
        </span>
      </div>
    </div>
  );
}
