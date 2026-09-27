import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/format';
import { fmtInterval, guessSymbol, parseBarsFile, ImportError, type ParsedBars } from '@/data/fileImport';
import { SYMBOLS } from '@/data/generator';
import { isReplayActive, useTradingStore, type ImportItem } from '@/store/useTradingStore';
import { TIMEFRAME_LABELS, TIMEFRAMES, type Timeframe } from '@/types';

const TZ_KEY = 'gony-bar-replay:import-tz';
const TZ_OPTIONS = Array.from({ length: 27 * 2 - 1 }, (_, i) => (i - 24) * 30).filter((m) => m % 60 === 0 || [330, 345, 570, 630].includes(Math.abs(m)));
const fmtTz = (m: number) => `UTC${m < 0 ? '−' : '+'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}:${String(Math.abs(m) % 60).padStart(2, '0')}`;
const fmtDate = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

interface FileResult {
  name: string;
  ok: boolean;
  text: string;
}

/** "Import file" tab: MT5 / MT4 / TradingView / Dukascopy / Binance / generic CSV bars → saved real data. */
export function ImportPanel() {
  const current = useTradingStore((s) => s.symbol);
  const importSeries = useTradingStore((s) => s.importSeries);
  const [symbol, setSymbol] = useState(current);
  const [fromName, setFromName] = useState(true);
  const [tf, setTf] = useState<Timeframe | 'auto'>('auto');
  const [tz, setTz] = useState(() => Number(localStorage.getItem(TZ_KEY)) || 0);
  const [merge, setMerge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [results, setResults] = useState<FileResult[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const changeTz = (m: number) => {
    setTz(m);
    localStorage.setItem(TZ_KEY, String(m));
  };

  const run = async (files: File[]) => {
    if (!files.length || busy) return;
    if (isReplayActive(useTradingStore.getState().replay.status) && !confirm('Importing data ends the replay and clears paper trades. Continue?')) return;
    setBusy(true);
    const items: ImportItem[] = [];
    const out: FileResult[] = [];
    for (const f of files) {
      try {
        const parsed: ParsedBars = parseBarsFile(await f.text(), { tzOffsetMinutes: tz, timeframe: tf });
        const sym = (fromName && guessSymbol(f.name)) || symbol;
        const c = parsed.candles;
        items.push({ symbol: sym, timeframe: parsed.timeframe, candles: c, source: `${parsed.format} · ${f.name}`, merge });
        const agg = parsed.aggregatedFrom ? ` (from ${parsed.aggregatedFrom.toLocaleString()} × ${fmtInterval(parsed.intervalSec)})` : '';
        const skip = parsed.skipped ? `, ${parsed.skipped} rows skipped` : '';
        out.push({ name: f.name, ok: true, text: `${parsed.format} → ${sym} ${TIMEFRAME_LABELS[parsed.timeframe]}: ${c.length.toLocaleString()} bars${agg}, ${fmtDate(c[0].time)} → ${fmtDate(c[c.length - 1].time)}${skip}` });
      } catch (e) {
        out.push({ name: f.name, ok: false, text: e instanceof ImportError ? e.message : `Could not read file: ${(e as Error).message}` });
      }
    }
    importSeries(items);
    setResults(out);
    setBusy(false);
    if (input.current) input.current.value = '';
  };

  const sel = 'rounded border border-slate-700 bg-slate-900 px-1.5 py-1 outline-none focus:border-blue-500';

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose bar files to import"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void run([...e.dataTransfer.files]);
        }}
        className={cn(
          'mb-2 flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed py-3 text-center',
          drag ? 'border-blue-400 bg-blue-500/10' : 'border-slate-600 hover:border-slate-400',
        )}
      >
        {busy ? <Loader2 size={18} className="animate-spin text-slate-400" /> : <FileUp size={18} className="text-slate-400" />}
        <span className="font-medium text-slate-200">Drop CSV / TXT files or click to browse</span>
        <span className="text-[10px] text-slate-500">MT5 · MT4 · TradingView · Dukascopy · Binance · any OHLC CSV</span>
      </div>
      <input ref={input} type="file" multiple accept=".csv,.txt,.tsv,text/csv,text/plain" className="hidden" data-testid="import-files" onChange={(e) => void run([...(e.target.files ?? [])])} />

      <div className="mb-2 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
        <label htmlFor="imp-symbol" className="text-slate-400">Symbol</label>
        <select id="imp-symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} className={sel}>
          {SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
        </select>
        <span />
        <label className="flex items-center gap-1.5 text-slate-400">
          <input type="checkbox" checked={fromName} onChange={(e) => setFromName(e.target.checked)} />
          Use symbol from file name when found
        </label>
        <label htmlFor="imp-tf" className="text-slate-400">Timeframe</label>
        <select id="imp-tf" value={tf} onChange={(e) => setTf(e.target.value as Timeframe | 'auto')} className={sel}>
          <option value="auto">Auto-detect</option>
          {TIMEFRAMES.map((t) => <option key={t} value={t}>{TIMEFRAME_LABELS[t]} (aggregate finer bars)</option>)}
        </select>
        <label htmlFor="imp-tz" className="text-slate-400">File time</label>
        <select id="imp-tz" value={tz} onChange={(e) => changeTz(Number(e.target.value))} className={sel}>
          {TZ_OPTIONS.map((m) => <option key={m} value={m}>{m === 0 ? 'UTC (GMT)' : fmtTz(m)}</option>)}
        </select>
        <span />
        <label className="flex items-center gap-1.5 text-slate-400">
          <input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} />
          Merge with saved bars (else replace)
        </label>
      </div>
      <p className="mb-2 text-[10px] text-slate-500">
        MT5/MT4 exports use broker <em>server</em> time (often UTC+2 / UTC+3) — pick it so intraday bars line up. Timestamps that carry a zone or unix time, and D1/W1/MN bars, are not shifted. The GonyExportBars script already writes UTC.
      </p>

      {results.length > 0 && (
        <ul className="space-y-1" aria-label="Import results">
          {results.map((r, i) => (
            <li key={i} className={cn('break-words', r.ok ? 'text-emerald-300' : 'text-red-400')}>
              <span className="font-mono text-[10px] text-slate-500">{r.name}</span>
              <br />
              {r.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
