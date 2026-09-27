import { useEffect, useState } from 'react';
import { Database, Download, Eye, EyeOff, Loader2, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/format';
import { ImportPanel } from './ImportPanel';
import { hasData, isReplayActive, useTradingStore } from '@/store/useTradingStore';
import { TIMEFRAME_LABELS, TIMEFRAMES } from '@/types';

const fmtDate = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
const fmtStamp = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Short source tag for the table ("Twelve Data" → "API", "MT5 · file.csv" → "MT5"). */
const sourceLabel = (src?: string) => (!src ? 'API' : src === 'Twelve Data' ? 'API' : src.split(' · ')[0]);

const confirmReset = () =>
  !isReplayActive(useTradingStore.getState().replay.status) || confirm('Loading new data ends the replay and clears paper trades. Continue?');

/** Top-bar data badge + popover: fetch from Twelve Data or import MT5/other exports; saved in the browser. */
export function DataSourceMenu() {
  const open = useTradingStore((s) => s.dataPanelOpen);
  const setOpen = useTradingStore((s) => s.setDataPanelOpen);
  const symbol = useTradingStore((s) => s.symbol);
  const hasBars = useTradingStore(hasData);
  const loading = useTradingStore((s) => s.dataStatus.loading);
  const fetchedAt = useTradingStore((s) => s.realData[s.symbol]?.fetchedAt);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={hasBars ? `Market data saved ${fetchedAt ? fmtStamp(fetchedAt) : ''}` : `No data loaded for ${symbol} yet`}
        className={cn(
          'ml-auto flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
          hasBars ? 'border-emerald-700 text-emerald-300' : 'border-amber-700/70 text-amber-300',
          open && 'bg-slate-800',
        )}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
        {hasBars ? 'Market data' : 'Load data'}
        {hasBars && fetchedAt && <span className="text-slate-400">· {fmtStamp(fetchedAt)}</span>}
      </button>
      {open && <DataPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function DataPanel({ onClose }: { onClose: () => void }) {
  const symbol = useTradingStore((s) => s.symbol);
  const status = useTradingStore((s) => s.dataStatus);
  const saved = useTradingStore((s) => s.realData[s.symbol]);
  const storedKey = useTradingStore((s) => s.apiKey);
  const { setApiKey, fetchRealData, clearRealData } = useTradingStore.getState();
  const [key, setKey] = useState(storedKey);
  const [showKey, setShowKey] = useState(false);
  const [tab, setTab] = useState<'fetch' | 'import'>(saved && Object.values(saved.sources ?? {}).some((v) => v !== 'Twelve Data') ? 'import' : 'fetch');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fetchNow = () => {
    if (key.trim() !== storedKey) setApiKey(key);
    if (!confirmReset()) return;
    void fetchRealData();
  };

  return (
    <div role="dialog" aria-label="Market data" className="fixed right-3 top-12 z-50 max-h-[calc(100vh-4rem)] w-96 overflow-y-auto rounded-lg border border-slate-700 bg-[#131823] p-3 text-xs shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-slate-400"><Database size={14} /> Market data</h2>
        <button onClick={onClose} aria-label="Close" className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"><X size={14} /></button>
      </div>

      <div role="tablist" className="mb-3 grid grid-cols-2 rounded-md border border-slate-700 p-0.5">
        {(['fetch', 'import'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn('rounded py-1 font-medium', tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200')}
          >
            {t === 'fetch' ? 'Twelve Data API' : 'Import file (MT5…)'}
          </button>
        ))}
      </div>

      {tab === 'import' ? <ImportPanel /> : <>
      <label className="mb-1 block text-slate-400" htmlFor="td-key">Twelve Data API key</label>
      <div className="mb-1 flex gap-1">
        <input
          id="td-key"
          type={showKey ? 'text' : 'password'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onBlur={() => key.trim() !== storedKey && setApiKey(key)}
          placeholder="Paste your API key"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono outline-none focus:border-blue-500"
        />
        <button onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Hide key' : 'Show key'} className="rounded border border-slate-700 px-1.5 text-slate-400 hover:bg-slate-800">
          {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
      <p className="mb-3 text-[10px] text-slate-500">
        Free key at{' '}
        <a href="https://twelvedata.com/pricing" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">twelvedata.com</a>
        . Stored only in this browser.
      </p>

      <button
        onClick={fetchNow}
        disabled={status.loading || !key.trim()}
        className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-1.5 font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status.loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {saved ? 'Refresh' : 'Fetch'} {symbol} · {TIMEFRAMES.length} timeframes
      </button>
      <p className="mb-2 text-[10px] text-slate-500">
        Uses {TIMEFRAMES.length} API credits (1 per timeframe, up to 5,000 bars each). Nothing is fetched automatically — data is saved and reused until you refresh.
      </p>

      </>}

      {status.message && <p className="mb-1 text-slate-300">{status.message}</p>}
      {status.error && <p className="mb-1 break-words text-red-400">{status.error}</p>}

      {saved ? (
        <div className="mt-2 rounded border border-slate-800 p-2">
          <div className="mb-1 flex items-center justify-between text-slate-400">
            <span>Saved {symbol} · {fmtStamp(saved.fetchedAt)}</span>
            <button
              onClick={() => confirm(`Delete saved real data for ${symbol}?`) && confirmReset() && clearRealData(symbol)}
              title={`Delete saved ${symbol} data`}
              aria-label={`Delete saved ${symbol} data`}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-red-400"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <table className="w-full font-mono text-[10px]">
            <tbody>
              {TIMEFRAMES.map((tf) => {
                const s = saved.series[tf];
                return (
                  <tr key={tf} className={s ? 'text-slate-300' : 'text-slate-600'}>
                    <td className="pr-2">{TIMEFRAME_LABELS[tf]}</td>
                    <td className="pr-2 text-right">{s ? s.length.toLocaleString() : '—'}</td>
                    <td className="text-right">{s ? `${fmtDate(s[0].time)} → ${fmtDate(s[s.length - 1].time)}` : 'not loaded'}</td>
                    <td className="max-w-[7rem] truncate pl-2 text-right text-slate-500" title={saved.sources?.[tf]}>{s ? sourceLabel(saved.sources?.[tf]) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-slate-500">No data saved for {symbol} yet — fetch it or import a file to show the chart.</p>
      )}
      <p className="mt-2 text-[10px] text-slate-600">Forex and gold quotes from Twelve Data have no volume (MT5 exports include tick volume). In replay, fills are checked on the bars of the loaded timeframe.</p>
    </div>
  );
}
