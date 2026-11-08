import { useState, type FormEvent, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, ChevronLeft, ChevronRight, Dices, Percent, Play, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { Button, cn } from './ui';
import { defaultSimulation, simulateTrades, type SimulationConfig, type SimulationResult, type TradeRange } from '../lib/simulation';
import { rr } from '../lib/trading';

type Fields = Record<keyof SimulationConfig, string>;
type RangeFields = { minRR: string; maxRR: string };
const initialFields = (): Fields => ({
  tradeCount: String(defaultSimulation.tradeCount), winRate: String(defaultSimulation.winRate),
  minWinRR: String(defaultSimulation.minWinRR), maxWinRR: String(defaultSimulation.maxWinRR),
  minLossRR: String(defaultSimulation.minLossRR), maxLossRR: String(defaultSimulation.maxLossRR),
});
const color = (value: number) => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';

function Summary({ label, value, detail, icon, tone }: { label: string; value: ReactNode; detail: string; icon: ReactNode; tone?: string }) {
  return <div className="metric"><div className="metric-label">{label}<span>{icon}</span></div><div className={cn('metric-value', tone)}>{value}</div><div className="metric-detail">{detail}</div></div>;
}

export default function TradeSimulator() {
  const [fields, setFields] = useState(initialFields);
  const [customize, setCustomize] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, RangeFields>>({});
  const [run, setRun] = useState<{ result: SimulationResult; signature: string } | null>(null);
  const [error, setError] = useState('');
  const [chartView, setChartView] = useState<'equity' | 'drawdown'>('equity');
  const [tablePage, setTablePage] = useState(0);
  const parsedCount = Number(fields.tradeCount);
  const tradeCount = fields.tradeCount.trim() && Number.isInteger(parsedCount) && parsedCount >= 1 && parsedCount <= 1000 ? parsedCount : 0;
  const signature = JSON.stringify({ fields, customize, overrides });
  const pending = Boolean(run && signature !== run.signature);
  const result = run?.result;
  const ledgerCount = customize ? tradeCount : result?.trades.length ?? tradeCount;
  const pageCount = Math.max(1, Math.ceil(ledgerCount / 25));
  const currentPage = Math.min(tablePage, pageCount - 1);
  const start = currentPage * 25;
  const rows = Array.from({ length: Math.min(25, Math.max(0, ledgerCount - start)) }, (_, index) => start + index);
  const chartData = result ? [{ trade: 0, cumulative: 0, drawdown: 0 }, ...result.trades.map(trade => ({ ...trade, drawdown: -trade.drawdown }))] : [];
  const updateField = (name: keyof Fields, value: string) => { setFields(prev => ({ ...prev, [name]: value })); setError(''); };
  const updateRange = (index: number, name: keyof RangeFields, value: string) => { setOverrides(prev => ({ ...prev, [index]: { ...prev[index], [name]: value } })); setError(''); };
  const execute = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      if (Object.values(fields).some(value => !value.trim())) throw new Error('Enter a number in every simulation field.');
      const config: SimulationConfig = {
        tradeCount: Number(fields.tradeCount), winRate: Number(fields.winRate),
        minWinRR: Number(fields.minWinRR), maxWinRR: Number(fields.maxWinRR),
        minLossRR: Number(fields.minLossRR), maxLossRR: Number(fields.maxLossRR),
      };
      const ranges: Record<number, TradeRange> = {};
      if (customize) for (const [index, range] of Object.entries(overrides)) {
        if (Number(index) >= config.tradeCount) continue;
        if (!range.minRR.trim() || !range.maxRR.trim()) throw new Error(`Trade ${Number(index) + 1}: enter both minimum and maximum RR.`);
        ranges[Number(index)] = { minRR: Number(range.minRR), maxRR: Number(range.maxRR) };
      }
      setRun({ result: simulateTrades(config, ranges), signature });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The simulation could not run.'); }
  };
  const reset = () => { setFields(initialFields()); setCustomize(false); setOverrides({}); setRun(null); setError(''); setTablePage(0); };

  return <div className="simulator">
    <form className="simulation-controls" onSubmit={execute}>
      <div className="section-title"><div><h2>Simulation parameters</h2></div><span className="subtle-tag"><Dices size={14} />Simulation only</span></div>
      <div className="simulation-parameter-grid">
        <div className="simulation-parameter-group">
          <label className="field-label" htmlFor="simulation-count">Number of trades</label>
          <input id="simulation-count" type="number" required min="1" max="1000" step="1" value={fields.tradeCount} onChange={event => updateField('tradeCount', event.target.value)} />
          <label className="field-label" htmlFor="simulation-probability">Win probability (%)</label>
          <div className="probability-control"><input id="simulation-probability" type="number" required min="0" max="100" step="any" value={fields.winRate} onChange={event => updateField('winRate', event.target.value)} /><input className="probability-slider" type="range" aria-label="Win probability slider" min="0" max="100" value={Math.max(0, Math.min(100, Number(fields.winRate) || 0))} onChange={event => updateField('winRate', event.target.value)} /></div>
        </div>
        <div className="simulation-parameter-group"><h3><TrendingUp size={16} />Winning RR</h3><div className="simulation-range-fields">
          <label className="field-label" htmlFor="min-win-rr">Minimum<input id="min-win-rr" aria-label="Minimum winning RR" type="number" required min="0.01" max="1000" step="any" value={fields.minWinRR} onChange={event => updateField('minWinRR', event.target.value)} /></label>
          <label className="field-label" htmlFor="max-win-rr">Maximum<input id="max-win-rr" aria-label="Maximum winning RR" type="number" required min="0.01" max="1000" step="any" value={fields.maxWinRR} onChange={event => updateField('maxWinRR', event.target.value)} /></label>
        </div><span className="simulation-range-note positive">Positive R multiples</span></div>
        <div className="simulation-parameter-group"><h3><TrendingDown size={16} />Loss size (R)</h3><div className="simulation-range-fields">
          <label className="field-label" htmlFor="min-loss-rr">Minimum<input id="min-loss-rr" aria-label="Minimum loss size" type="number" required min="0.01" max="1000" step="any" value={fields.minLossRR} onChange={event => updateField('minLossRR', event.target.value)} /></label>
          <label className="field-label" htmlFor="max-loss-rr">Maximum<input id="max-loss-rr" aria-label="Maximum loss size" type="number" required min="0.01" max="1000" step="any" value={fields.maxLossRR} onChange={event => updateField('maxLossRR', event.target.value)} /></label>
        </div><span className="simulation-range-note negative">Recorded as negative R</span></div>
      </div>
      <div className="simulation-controls-footer"><label className="check-label"><input type="checkbox" checked={customize} onChange={event => { setCustomize(event.target.checked); setError(''); }} /><span>Customize individual trade ranges</span></label><div className="simulation-actions"><Button type="button" variant="outline" onClick={reset}><RotateCcw size={15} />Reset</Button><Button type="submit"><Play size={15} />{run ? 'Run again' : 'Run random trades'}</Button></div></div>
      {error && <p className="error-banner simulation-error" role="alert">{error}</p>}
    </form>

    <div className="metrics-grid simulation-metrics">
      <Summary label="Net simulated RR" value={result ? rr(result.net) : '—'} tone={result ? color(result.net) : undefined} icon={<TrendingUp size={18} />} detail={result ? `${result.trades.length} simulated trades` : 'Awaiting first run'} />
      <Summary label="Observed win rate" value={result ? `${result.winRate.toFixed(1)}%` : '—'} icon={<Percent size={18} />} detail={result ? `${result.wins} wins / ${result.losses} losses` : 'Excludes breakeven trades'} />
      <Summary label="Maximum drawdown" value={result ? rr(-result.maxDrawdown) : '—'} tone={result?.maxDrawdown ? 'negative' : undefined} icon={<TrendingDown size={18} />} detail="Peak-to-trough decline" />
      <Summary label="Average RR per trade" value={result ? rr(result.averageRR) : '—'} tone={result ? color(result.averageRR) : undefined} icon={<BarChart3 size={18} />} detail={result ? `${result.breakevens} breakeven trades` : 'Net RR / total trades'} />
    </div>

    <section className="panel simulation-chart-panel" aria-label="Simulation performance">
      <div className="section-title"><div><h2>Simulated performance</h2><p>{pending ? 'Settings changed. Results are from the previous run.' : result ? `${result.trades.length} trades · Starting at 0R` : 'No simulation yet.'}</p></div><div className="simulation-chart-tabs" role="tablist" aria-label="Simulation chart view"><button role="tab" aria-selected={chartView === 'equity'} className={cn(chartView === 'equity' && 'selected')} onClick={() => setChartView('equity')}><TrendingUp size={14} />Equity</button><button role="tab" aria-selected={chartView === 'drawdown'} className={cn(chartView === 'drawdown' && 'selected')} onClick={() => setChartView('drawdown')}><TrendingDown size={14} />Drawdown</button></div></div>
      <div className="simulation-chart" role="img" aria-label={result ? `${chartView === 'equity' ? 'Cumulative equity' : 'Drawdown'} over ${result.trades.length} trades. Net ${rr(result.net)}. Maximum drawdown ${rr(-result.maxDrawdown)}.` : 'No simulated trades yet'}>
        {result ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 20, right: 15, left: 0, bottom: 12 }}>
          <defs><linearGradient id="simulation-equity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartView === 'equity' ? '#8044cc' : '#c43d50'} stopOpacity={0.2} /><stop offset="100%" stopColor={chartView === 'equity' ? '#8044cc' : '#c43d50'} stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid stroke="#e7e2ee" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="trade" type="number" domain={[0, result.trades.length]} allowDecimals={false} minTickGap={30} tick={{ fill: '#756d80', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'Trade number', position: 'insideBottom', offset: -8, fill: '#756d80', fontSize: 10 }} />
          <YAxis tick={{ fill: '#756d80', fontSize: 10 }} tickFormatter={value => `${Number(Number(value).toFixed(2))}R`} axisLine={false} tickLine={false} width={65} />
          <Tooltip labelFormatter={value => `Trade ${value}`} formatter={value => [rr(Number(value ?? 0)), chartView === 'equity' ? 'Cumulative RR' : 'Drawdown']} contentStyle={{ background: '#ffffff', border: '1px solid #dfd1ed', borderRadius: 6, fontSize: 12, color: '#241e2e' }} />
          <ReferenceLine y={0} stroke="#b7a5ca" />
          <Area type="linear" dataKey={chartView === 'equity' ? 'cumulative' : 'drawdown'} stroke={chartView === 'equity' ? '#8044cc' : '#c43d50'} strokeWidth={2} fill="url(#simulation-equity-fill)" isAnimationActive={false} dot={false} activeDot={{ r: 4 }} />
        </AreaChart></ResponsiveContainer> : <div className="simulation-empty"><Dices size={32} /><span>A new set of possibilities.</span></div>}
      </div>
      <div className="simulation-chart-footer"><span>Random outcomes, not a forecast.</span><span>{pending ? 'Previous run' : 'Separate from journal records'}</span></div>
    </section>

    {(customize || result) && <section className="panel simulation-ledger">
      <div className="section-title"><div><h2>{customize ? 'Individual trade ranges' : 'Simulated trades'}</h2><p>{customize ? 'Custom signed ranges replace the default win / loss model for that trade.' : 'Results from the latest run.'}</p></div><span className="subtle-tag">{ledgerCount} trades</span></div>
      <div className="table-scroll"><table><thead><tr><th>Trade</th>{customize && <><th>Custom range</th><th>Min RR</th><th>Max RR</th></>}<th>Result</th><th>Cumulative RR</th></tr></thead><tbody>{rows.map(index => <tr key={index}>
        <td>{index + 1}</td>
        {customize && <><td><input type="checkbox" aria-label={`Use custom range for trade ${index + 1}`} checked={Boolean(overrides[index])} onChange={event => {
          if (event.target.checked) setOverrides(prev => ({ ...prev, [index]: { minRR: String(-Math.abs(Number(fields.maxLossRR) || 1)), maxRR: fields.maxWinRR || '3' } }));
          else setOverrides(prev => { const next = { ...prev }; delete next[index]; return next; });
          setError('');
        }} /></td><td><input type="number" step="any" min="-1000" max="1000" disabled={!overrides[index]} aria-label={`Trade ${index + 1} minimum RR`} value={overrides[index]?.minRR ?? ''} placeholder="Default" onChange={event => updateRange(index, 'minRR', event.target.value)} /></td><td><input type="number" step="any" min="-1000" max="1000" disabled={!overrides[index]} aria-label={`Trade ${index + 1} maximum RR`} value={overrides[index]?.maxRR ?? ''} placeholder="Default" onChange={event => updateRange(index, 'maxRR', event.target.value)} /></td></>}
        <td className={result?.trades[index] ? color(result.trades[index].result) : 'muted'}>{result?.trades[index] ? rr(result.trades[index].result) : '—'}</td><td className={result?.trades[index] ? color(result.trades[index].cumulative) : 'muted'}>{result?.trades[index] ? rr(result.trades[index].cumulative) : '—'}</td>
      </tr>)}</tbody></table></div>
      <div className="simulation-pagination"><span>{ledgerCount ? `${start + 1}–${Math.min(start + 25, ledgerCount)} of ${ledgerCount}` : 'Enter a valid trade count'}</span><div><Button variant="ghost" size="icon" title="Previous trades" aria-label="Previous simulated trades" disabled={currentPage === 0} onClick={() => setTablePage(currentPage - 1)}><ChevronLeft size={17} /></Button><span>Page {currentPage + 1} of {pageCount}</span><Button variant="ghost" size="icon" title="Next trades" aria-label="Next simulated trades" disabled={currentPage >= pageCount - 1} onClick={() => setTablePage(currentPage + 1)}><ChevronRight size={17} /></Button></div></div>
    </section>}
  </div>;
}