import { useEffect } from 'react';
import { ArrowDown, ArrowUp, Clock, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/format';
import { browserZone, fixedZone, LOCAL_ZONE, offsetLabel, zoneOffsetMinutes, type TimeZoneId } from '@/lib/time';
import { useDisplayStore } from '@/store/useDisplayStore';

const NAMED_ZONES: [string, string][] = [
  ['America/New_York', 'New York'],
  ['America/Chicago', 'Chicago'],
  ['Europe/London', 'London'],
  ['Europe/Berlin', 'Frankfurt / Berlin'],
  ['Asia/Bangkok', 'Bangkok / Hanoi'],
  ['Asia/Singapore', 'Singapore'],
  ['Asia/Hong_Kong', 'Hong Kong'],
  ['Asia/Tokyo', 'Tokyo'],
  ['Australia/Sydney', 'Sydney'],
];
const FIXED_OFFSETS = [...Array.from({ length: 27 }, (_, i) => (i - 12) * 60), 330, 345, 570].sort((a, b) => a - b);

const now = () => Math.floor(Date.now() / 1000);
const withOffset = (zone: TimeZoneId, name: string) => `${name} (${offsetLabel(zoneOffsetMinutes(zone, now()))})`;

/** Options shared by the chart zone and each session range's zone. */
function ZoneOptions({ includeChart }: { includeChart?: boolean }) {
  return (
    <>
      {includeChart && <option value="chart">Chart time zone</option>}
      {!includeChart && <option value={LOCAL_ZONE}>{withOffset(LOCAL_ZONE, `Local · ${browserZone()}`)}</option>}
      <option value="UTC">UTC</option>
      <optgroup label="Markets (DST-aware)">
        {NAMED_ZONES.map(([z, n]) => <option key={z} value={z}>{withOffset(z, n)}</option>)}
      </optgroup>
      <optgroup label="Fixed offset">
        {FIXED_OFFSETS.filter((m) => m !== 0).map((m) => <option key={m} value={fixedZone(m)}>{offsetLabel(m)}</option>)}
      </optgroup>
    </>
  );
}

export function ChartSettingsPanel() {
  const open = useDisplayStore((s) => s.settingsOpen);
  const timeZone = useDisplayStore((s) => s.timeZone);
  const sessions = useDisplayStore((s) => s.sessionColors);
  const { setSettingsOpen, setTimeZone, setSessionColorsEnabled, updateRange, addRange, removeRange, moveRange, resetRanges } = useDisplayStore.getState();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSettingsOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setSettingsOpen]);

  if (!open) return null;
  const input = 'rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs text-slate-200 outline-none focus:border-blue-500';

  return (
    <div role="dialog" aria-label="Chart settings" className="fixed right-3 top-12 z-50 max-h-[calc(100vh-4rem)] w-[30rem] overflow-y-auto whitespace-normal rounded-lg border border-slate-700 bg-[#131823] p-3 text-xs shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-slate-400"><Clock size={14} /> Time zone &amp; sessions</h2>
        <button onClick={() => setSettingsOpen(false)} aria-label="Close" className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"><X size={14} /></button>
      </div>

      <section className="mb-4">
        <label className="mb-1 block font-medium text-slate-300" htmlFor="chart-time-zone">Chart time zone</label>
        <select id="chart-time-zone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className={cn(input, 'w-full')}>
          <ZoneOptions />
        </select>
        <p className="mt-1.5 leading-relaxed text-slate-500">
          Applies to the time axis, crosshair, replay clock, drawings and trade history. Market data stays in UTC, so nothing is re-imported.
          The bundled MT5 bars use Exness server time (UTC). Daily and longer bars keep their trading date.
        </p>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <label className="flex items-center gap-2 font-medium text-slate-300">
            <input type="checkbox" checked={sessions.enabled} onChange={(e) => setSessionColorsEnabled(e.target.checked)} className="accent-blue-500" />
            Color candles by time range
          </label>
          <div className="flex gap-1">
            <button onClick={resetRanges} title="Restore Tokyo, London and New York" className="flex items-center gap-1 rounded px-1.5 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"><RotateCcw size={12} /> Presets</button>
            <button onClick={addRange} className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-1 text-slate-200 hover:bg-slate-700"><Plus size={12} /> Add range</button>
          </div>
        </div>
        <p className="mb-2 leading-relaxed text-slate-500">
          Intraday candles are colored by their open time. Ranges can wrap past midnight. Where ranges overlap, the higher one in the list wins.
        </p>

        <ul className={cn('space-y-1.5', !sessions.enabled && 'opacity-50')}>
          {sessions.ranges.length === 0 && <li className="rounded border border-dashed border-slate-700 p-3 text-center text-slate-500">No ranges. Add one or restore the presets.</li>}
          {sessions.ranges.map((r, i) => (
            <li key={r.id} className="rounded-md border border-slate-700/70 bg-slate-900/40 p-2" data-testid="session-range">
              <div className="mb-1.5 flex items-center gap-1.5">
                <input type="checkbox" checked={r.enabled} onChange={(e) => updateRange(r.id, { enabled: e.target.checked })} aria-label={`Enable ${r.name}`} className="accent-blue-500" />
                <input value={r.name} onChange={(e) => updateRange(r.id, { name: e.target.value })} aria-label="Range name" className={cn(input, 'min-w-0 flex-1')} />
                <ColorSwatch label="Up" value={r.upColor} onChange={(upColor) => updateRange(r.id, { upColor })} />
                <ColorSwatch label="Down" value={r.downColor} onChange={(downColor) => updateRange(r.id, { downColor })} />
                <IconBtn title="Move up" disabled={i === 0} onClick={() => moveRange(r.id, -1)}><ArrowUp size={12} /></IconBtn>
                <IconBtn title="Move down" disabled={i === sessions.ranges.length - 1} onClick={() => moveRange(r.id, 1)}><ArrowDown size={12} /></IconBtn>
                <IconBtn title="Delete range" onClick={() => removeRange(r.id)}><Trash2 size={12} /></IconBtn>
              </div>
              <div className="flex items-center gap-1.5">
                <input type="time" value={r.start} onChange={(e) => e.target.value && updateRange(r.id, { start: e.target.value })} aria-label={`${r.name} start`} className={input} />
                <span className="text-slate-500">to</span>
                <input type="time" value={r.end} onChange={(e) => e.target.value && updateRange(r.id, { end: e.target.value })} aria-label={`${r.name} end`} className={input} />
                <select value={r.zone} onChange={(e) => updateRange(r.id, { zone: e.target.value })} aria-label={`${r.name} time zone`} className={cn(input, 'min-w-0 flex-1')}>
                  <ZoneOptions includeChart />
                </select>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ColorSwatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-slate-500" title={`${label} candle color`}>
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} color`} className="h-6 w-6 cursor-pointer rounded border border-slate-700 bg-transparent p-0" />
    </label>
  );
}

function IconBtn({ children, title, onClick, disabled }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} disabled={disabled} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30 disabled:hover:bg-transparent">
      {children}
    </button>
  );
}
