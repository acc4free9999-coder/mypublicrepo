import { useState, type FormEvent } from 'react';
import { ArrowDownRight, ArrowRight, Brain, Check, CheckCheck, Clock3, Eye, Hand, Pencil, Play, Plus, RotateCcw, ShieldCheck, Timer, TrendingDown, TrendingUp } from 'lucide-react';
import { Button, cn, Dialog } from './ui';
import { checkInIsDue, createRound, DEFAULT_MIND_GYM_SCENARIO, initialRoundScore, practiceDay, readCheckIn, readMindGymLibrary, recordCheckIn, saveMindGymLibrary, scoreRound, validateMindGymScenario, type HourlyCheckIn, type MarketRound, type MindGymScenario, type RoundScore } from '../lib/mindGame';

type Stage = 'idle' | 'watching' | 'setup' | 'no-setup' | 'outcome' | 'accept-loss' | 'summary';
const moneyTone = (value: number) => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
const formatRR = (value: number) => `${value > 0 ? '+' : ''}${Number(value.toFixed(2))}R`;
type ScenarioFields = Record<keyof Omit<MindGymScenario, 'id'>, string>;
const scenarioFields = (scenario: MindGymScenario): ScenarioFields => ({
  name: scenario.name, description: scenario.description, roundCount: String(scenario.roundCount),
  setupChance: String(scenario.setupChance), winProbability: String(scenario.winProbability), breakevenChance: String(scenario.breakevenChance),
  minWinRR: String(scenario.minWinRR), maxWinRR: String(scenario.maxWinRR), minLossRR: String(scenario.minLossRR), maxLossRR: String(scenario.maxLossRR),
});

function ScoreTile({ icon, label, value, note, accent = '' }: { icon: React.ReactNode; label: string; value: number | string; note: string; accent?: string }) {
  return <div className="mind-score-tile"><span className={cn('mind-score-icon', accent)}>{icon}</span><div><span className="mind-score-label">{label}</span><strong>{value}</strong><span className="mind-score-note">{note}</span></div></div>;
}

function MarketChart({ round, visible, revealSetup = false }: { round: MarketRound; visible: number; revealSetup?: boolean }) {
  const y = (price: number) => 24 + (88 - price) / 76 * 176;
  return <div className="mind-chart-wrap"><svg className="mind-chart" viewBox="0 0 760 250" role="img" aria-label={`Simulated candlestick chart, ${visible} of 8 bars revealed${revealSetup && round.setupAt !== null ? ', setup confirmed' : ''}`}>
    {[0, 1, 2, 3].map(index => <g key={index}><line x1="42" x2="738" y1={28 + index * 54} y2={28 + index * 54} stroke="#e7e2ee" strokeDasharray="4 6" /><text x="4" y={32 + index * 54} fill="#898096" fontSize="10">{80 - index * 20}</text></g>)}
    <line x1="42" x2="738" y1="222" y2="222" stroke="#ddd5e7" />
    {round.candles.slice(0, visible).map((close, index) => {
      const open = index === 0 ? 50 : round.candles[index - 1];
      const high = Math.min(88, Math.max(open, close) + 5 + index % 3);
      const low = Math.max(12, Math.min(open, close) - 4 - index % 2);
      const x = 75 + index * 83;
      const top = Math.min(y(open), y(close));
      const height = Math.max(7, Math.abs(y(open) - y(close)));
      const rising = close >= open;
      return <g className="mind-candle" key={index} style={{ animationDelay: `${index * 35}ms` }}>
        <line x1={x + 13} x2={x + 13} y1={y(high)} y2={y(low)} stroke={rising ? '#279c67' : '#cf5366'} strokeWidth="2" />
        <rect x={x} y={top} width="26" height={height} rx="2" fill={rising ? '#37b77a' : '#e27a88'} />
        <text x={x + 13} y="240" fill="#898096" fontSize="9" textAnchor="middle">{index + 1}</text>
      </g>;
    })}
    {revealSetup && round.setupAt !== null && <g className="mind-signal"><line x1={75 + (round.setupAt - 1) * 83 + 13} x2={75 + (round.setupAt - 1) * 83 + 13} y1="20" y2="220" stroke="#8044cc" strokeDasharray="5 5" /><rect x={75 + (round.setupAt - 1) * 83 - 22} y="7" width="70" height="18" rx="8" fill="#f0e8fb" /><text x={75 + (round.setupAt - 1) * 83 + 13} y="20" fill="#7136b8" textAnchor="middle" fontSize="9" fontWeight="600">CONFIRM</text></g>}
  </svg></div>;
}

export default function MindGym() {
  const [checkIn, setCheckIn] = useState<HourlyCheckIn>(() => readCheckIn());
  const [library, setLibrary] = useState(() => readMindGymLibrary());
  const [editingScenario, setEditingScenario] = useState<ScenarioFields | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scenarioError, setScenarioError] = useState('');
  const [scenarioStorageError, setScenarioStorageError] = useState('');
  const [sessionScenario, setSessionScenario] = useState<MindGymScenario | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [rounds, setRounds] = useState<MarketRound[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [visible, setVisible] = useState(2);
  const [stage, setStage] = useState<Stage>('idle');
  const [score, setScore] = useState<RoundScore>(initialRoundScore);
  const [resolvedRR, setResolvedRR] = useState<number | null>(null);
  const [enteredEarly, setEnteredEarly] = useState(false);
  const [storageError, setStorageError] = useState('');

  const selectedScenario = library.scenarios.find(scenario => scenario.id === library.selectedId) ?? library.scenarios[0] ?? DEFAULT_MIND_GYM_SCENARIO;
  const activeScenario = sessionScenario ?? selectedScenario;
  const roundCount = activeScenario.roundCount;
  const round = rounds[roundIndex];
  const dayHours = checkIn.practicedHours.filter(hour => hour.startsWith(`${practiceDay(clock)}T`)).length;
  const due = checkInIsDue(checkIn, clock);
  const playedThisHour = !due;
  const nextHour = new Date(clock.getFullYear(), clock.getMonth(), clock.getDate(), clock.getHours() + 1);
  const minutesUntilHour = Math.max(0, Math.ceil((nextHour.getTime() - clock.getTime()) / 60000));
  const chooseScenario = (id: string) => {
    const updated = { ...library, selectedId: id };
    if (saveMindGymLibrary(updated)) { setLibrary(updated); setScenarioStorageError(''); }
    else setScenarioStorageError('Could not save your scenario selection. Storage may be full or blocked.');
  };
  const openScenarioEditor = (scenario?: MindGymScenario) => {
    setEditingId(scenario?.id ?? null);
    setEditingScenario(scenarioFields(scenario ?? { ...DEFAULT_MIND_GYM_SCENARIO, id: 'new-scenario', name: '', description: '' }));
    setScenarioError('');
  };
  const saveScenario = (event: FormEvent) => {
    event.preventDefault();
    if (!editingScenario) return;
    const scenario: MindGymScenario = {
      id: editingId ?? crypto.randomUUID(), name: editingScenario.name.trim(), description: editingScenario.description.trim(),
      roundCount: Number(editingScenario.roundCount), setupChance: Number(editingScenario.setupChance),
      winProbability: Number(editingScenario.winProbability), breakevenChance: Number(editingScenario.breakevenChance),
      minWinRR: Number(editingScenario.minWinRR), maxWinRR: Number(editingScenario.maxWinRR),
      minLossRR: Number(editingScenario.minLossRR), maxLossRR: Number(editingScenario.maxLossRR),
    };
    const error = validateMindGymScenario(scenario);
    if (error) { setScenarioError(error); return; }
    const scenarios = editingId ? library.scenarios.map(value => value.id === editingId ? scenario : value) : [...library.scenarios, scenario];
    if (!editingId && scenarios.length > 30) { setScenarioError('You can save up to 30 scenarios.'); return; }
    const updated = { scenarios, selectedId: scenario.id };
    if (!saveMindGymLibrary(updated)) { setScenarioError('Could not save this scenario. Check that the values are valid and browser storage is available.'); return; }
    setLibrary(updated);
    setScenarioStorageError('');
    setEditingScenario(null);
  };
  const start = () => {
    const now = new Date();
    setSessionScenario({ ...selectedScenario });
    setClock(now);
    setRounds(Array.from({ length: selectedScenario.roundCount }, () => createRound(Math.random, selectedScenario)));
    setRoundIndex(0);
    setVisible(2);
    setScore(initialRoundScore());
    setResolvedRR(null);
    setEnteredEarly(false);
    setStage('watching');
  };
  const advance = () => {
    if (roundIndex + 1 >= roundCount) {
      setStage('summary');
      const now = new Date();
      const updated = recordCheckIn(checkIn, now);
      try {
        localStorage.setItem('edgebook-mind-gym-v1', JSON.stringify(updated));
        setCheckIn(updated);
        setStorageError('');
      } catch { setStorageError('Session complete, but this browser could not save your hourly practice progress.'); }
      setClock(now);
      return;
    }
    setRoundIndex(index => index + 1);
    setVisible(2);
    setResolvedRR(null);
    setEnteredEarly(false);
    setStage('watching');
  };
  const wait = () => {
    const count = Math.min(7, visible + 1);
    setVisible(count);
    if (round.setupAt !== null && count >= round.setupAt) {
      setScore(current => scoreRound(current, 0, 'waited'));
      setStage('setup');
    } else if (count >= 7) {
      setScore(current => scoreRound(current, 0, 'waited'));
      setStage('no-setup');
    }
  };
  const takeEntry = () => {
    setResolvedRR(round.rewardRR);
    setEnteredEarly(false);
    setScore(current => scoreRound(current, round.rewardRR, 'entered'));
    setStage(round.outcome === 'loss' ? 'accept-loss' : 'outcome');
  };
  const enterEarly = () => {
    setResolvedRR(-1);
    setEnteredEarly(true);
    setScore(current => scoreRound(current, -1, 'early'));
    setStage('accept-loss');
  };
  const acceptLoss = () => {
    setScore(current => scoreRound(current, 0, 'accepted', true));
    setStage('outcome');
  };
  const pass = () => {
    setResolvedRR(0);
    setScore(current => scoreRound(current, 0, 'passed'));
    setStage('outcome');
  };

  return <div className="mind-gym">
    <section className="mind-intro panel">
      <div className="mind-intro-symbol"><Brain size={29} /></div>
      <div className="mind-intro-copy"><div className="eyebrow">YOUR CUSTOM PRACTICE SCENARIOS</div><h2>Wait for your setup. Follow your plan. Accept the outcome.</h2><p>Each candle is synthetic. The game rewards process, not whether a trade wins. No trades or scores are added to your journal.</p></div>
      <div className="mind-hour-pill"><Clock3 size={15} /><div><strong>{dayHours} <span>/ 24</span></strong><span>hours practiced today</span></div></div>
    </section>

    <section className="mind-scenarios panel">
      <div className="mind-scenarios-heading"><div><h2>Practice scenarios</h2><p>Choose an exercise, or make one that fits your process.</p></div><Button onClick={() => openScenarioEditor()} disabled={library.scenarios.length >= 30}><Plus size={15} />Add scenario</Button></div>
      <div className="mind-scenario-list">{library.scenarios.map(scenario => <article key={scenario.id} className={cn('mind-scenario-card', scenario.id === selectedScenario.id && 'selected')}>
        <button className="mind-scenario-select" aria-pressed={scenario.id === selectedScenario.id} onClick={() => chooseScenario(scenario.id)}><span className="mind-scenario-card-title">{scenario.name}{scenario.id === selectedScenario.id && <span className="mind-selected-label">Selected</span>}</span><span className="mind-scenario-description">{scenario.description}</span><span className="mind-scenario-facts">{scenario.roundCount} {scenario.roundCount === 1 ? 'round' : 'rounds'}<span>·</span>{scenario.setupChance}% setup<span>·</span>{scenario.winProbability}% win chance</span></button>
        <Button type="button" variant="ghost" size="icon" title={`Edit ${scenario.name}`} aria-label={`Edit ${scenario.name}`} onClick={() => openScenarioEditor(scenario)}><Pencil size={15} /></Button>
      </article>)}</div>
      {scenarioStorageError && <p role="alert" className="error-banner mind-scenario-error">{scenarioStorageError}</p>}
    </section>

    <div className="mind-scoreboard">
      <ScoreTile icon={<Eye size={18} />} label="Patience" value={score.patience} note="waited for confirmation" accent="purple" />
      <ScoreTile icon={<ShieldCheck size={18} />} label="Discipline" value={score.discipline} note="followed the plan" accent="green" />
      <ScoreTile icon={<Hand size={18} />} label="Acceptance" value={score.acceptance} note="losses acknowledged" accent="gold" />
      <ScoreTile icon={<TrendingUp size={18} />} label="Practice P&L" value={formatRR(score.netRR)} note={`${score.trades} simulated entries`} accent={moneyTone(score.netRR)} />
    </div>

    <section className="panel mind-arena" aria-label="Mind Gym game">
      <div className="mind-arena-heading"><div><span className="subtle-tag">{stage === 'summary' ? 'SESSION COMPLETE' : stage === 'idle' ? 'READY WHEN YOU ARE' : `ROUND ${roundIndex + 1} OF ${roundCount}`}</span><h2>{stage === 'idle' ? selectedScenario.name : stage === 'summary' ? 'A little more deliberate.' : 'Watch the market unfold.'}</h2></div>{stage !== 'idle' && stage !== 'summary' && <span className="mind-time-label"><Timer size={14} /> About 1 min per session</span>}</div>

      {stage === 'idle' && <div className="mind-welcome"><div className="mind-welcome-icon"><Eye size={28} /></div><h3>Can you wait until there is a setup?</h3><p>{selectedScenario.description} Wait for the candles to unfold, follow the plan, and acknowledge losses before moving on.</p><div className="mind-skill-chips"><span><Eye size={13} />Notice the signal</span><span><ShieldCheck size={13} />Stick to your rules</span><span><Hand size={13} />Let a loss be a loss</span><span>{selectedScenario.roundCount} {selectedScenario.roundCount === 1 ? 'round' : 'rounds'}</span></div><Button onClick={start}><Play size={16} />Start {selectedScenario.roundCount}-round session</Button><div className="mind-hour-status"><Clock3 size={14} />{due ? `This hour’s rep is ready${checkIn.todaySessions ? ` · ${checkIn.todaySessions} ${checkIn.todaySessions === 1 ? 'session' : 'sessions'} completed today` : ''}` : `This hour’s rep is done · next check-in in about ${minutesUntilHour} min`}</div><p className="mind-no-pressure">You can replay whenever you like. One session per hour counts toward your hourly practice.</p></div>}

      {round && stage !== 'idle' && stage !== 'summary' && <>
        <div className="mind-round-progress" aria-label={`Round ${roundIndex + 1} of ${roundCount}`}>
          {rounds.map((_, index) => <span key={index} className={cn('mind-round-dot', index < roundIndex && 'complete', index === roundIndex && 'current')} />)}
          <span className="mind-progress-label">{roundIndex + 1} / {roundCount}</span>
        </div>
        <MarketChart round={round} visible={visible} revealSetup={stage !== 'watching' && stage !== 'accept-loss'} />
        <div className="mind-instruction" aria-live="polite">
          {stage === 'watching' && <><strong>No rush. Wait for the confirmation.</strong><span>The market has no obligation to give you a trade.</span></>}
          {stage === 'setup' && <><strong>A setup is confirmed.</strong><span>Your plan says wait for confirmation. The outcome is still uncertain.</span></>}
          {stage === 'no-setup' && <><strong>No setup this round.</strong><span>Not trading is a decision. Protect your focus for the next one.</span></>}
          {stage === 'accept-loss' && <><strong className="negative">{enteredEarly ? 'An early entry broke the plan.' : 'A loss is part of the plan.'}</strong><span>Notice the urge to react. You can acknowledge the result and continue without revenge trading.</span></>}
          {stage === 'outcome' && <><strong>{resolvedRR === 0 && round.outcome === 'breakeven' ? 'Breakeven. Nothing to recover.' : 'Decision made. Let the next round begin.'}</strong><span>Keep your attention on the next decision, not the last outcome.</span></>}
        </div>
        <div className="mind-actions">
          {stage === 'watching' && <><Button variant="outline" onClick={enterEarly}><ArrowDownRight size={15} />Enter before the signal</Button><Button onClick={wait}><Eye size={15} />Wait and reveal next candle</Button></>}
          {stage === 'setup' && <><Button variant="outline" onClick={pass}>Pass this setup</Button><Button onClick={takeEntry}><Check size={15} />Take the planned setup</Button></>}
          {stage === 'no-setup' && <Button onClick={pass}><ShieldCheck size={15} />Pass and protect capital</Button>}
          {stage === 'accept-loss' && <Button onClick={acceptLoss}><Hand size={15} />Accept the loss and move on</Button>}
          {stage === 'outcome' && <><span className={cn('mind-outcome-result', moneyTone(resolvedRR ?? 0))}>{resolvedRR ? `Simulated result · ${formatRR(resolvedRR)}` : 'No trade · 0R'}</span><Button onClick={advance}>{roundIndex === roundCount - 1 ? 'See session recap' : 'Next round'}<ArrowRight size={15} /></Button></>}
        </div>
      </>}

      {stage === 'summary' && <div className="mind-session-summary"><div className="mind-summary-mark"><CheckCheck size={28} /></div><h3>{roundCount} moments to practice your process.</h3><p>The best score is the next calm, rule-following decision. It’s never the result of a simulated trade.</p><div className="mind-final-scores"><div><span>Patience</span><strong>{score.patience} / {roundCount}</strong></div><div><span>Discipline</span><strong>{score.discipline} / {roundCount}</strong></div><div><span>Losses accepted</span><strong>{score.acceptance}</strong></div><div><span>Simulated net</span><strong className={moneyTone(score.netRR)}>{formatRR(score.netRR)}</strong></div></div><div className="mind-checkin-confirm"><Clock3 size={16} />{checkInIsDue(checkIn) ? 'This session did not count toward today’s hourly practice.' : 'This hour’s practice rep is recorded.'}<span>{dayHours} practiced {dayHours === 1 ? 'hour' : 'hours'} today</span></div><Button onClick={start}><RotateCcw size={15} />Play another {selectedScenario.roundCount} rounds</Button></div>}
    </section>

    <Dialog open={editingScenario !== null} onOpenChange={open => { if (!open) { setEditingScenario(null); setScenarioError(''); } }} title={editingId ? 'Edit practice scenario' : 'Add practice scenario'} description="Set the exercise length and simulated market odds. These values never change your trading journal.">
      {editingScenario && <form className="mind-scenario-form" onSubmit={saveScenario}>
        <label className="field-label" htmlFor="scenario-name">Scenario name<input id="scenario-name" required maxLength={64} value={editingScenario.name} onChange={event => setEditingScenario(current => current && { ...current, name: event.target.value })} /></label>
        <label className="field-label" htmlFor="scenario-description">Exercise description<input id="scenario-description" required maxLength={180} value={editingScenario.description} onChange={event => setEditingScenario(current => current && { ...current, description: event.target.value })} /></label>
        <div className="mind-form-grid">
          <label className="field-label" htmlFor="scenario-rounds">Rounds<input id="scenario-rounds" type="number" min="1" max="12" step="1" required value={editingScenario.roundCount} onChange={event => setEditingScenario(current => current && { ...current, roundCount: event.target.value })} /></label>
          <label className="field-label" htmlFor="scenario-setup-chance">Setup chance (%)<input id="scenario-setup-chance" type="number" min="0" max="100" step="1" required value={editingScenario.setupChance} onChange={event => setEditingScenario(current => current && { ...current, setupChance: event.target.value })} /></label>
          <label className="field-label" htmlFor="scenario-win-chance">Win probability (%)<input id="scenario-win-chance" type="number" min="0" max="100" step="1" required value={editingScenario.winProbability} onChange={event => setEditingScenario(current => current && { ...current, winProbability: event.target.value })} /></label>
          <label className="field-label" htmlFor="scenario-breakeven-chance">Breakeven chance (%)<input id="scenario-breakeven-chance" type="number" min="0" max="30" step="1" required value={editingScenario.breakevenChance} onChange={event => setEditingScenario(current => current && { ...current, breakevenChance: event.target.value })} /></label>
          <label className="field-label" htmlFor="scenario-min-win">Minimum win RR<input id="scenario-min-win" type="number" min="0.1" max="100" step="any" required value={editingScenario.minWinRR} onChange={event => setEditingScenario(current => current && { ...current, minWinRR: event.target.value })} /></label>
          <label className="field-label" htmlFor="scenario-max-win">Maximum win RR<input id="scenario-max-win" type="number" min="0.1" max="100" step="any" required value={editingScenario.maxWinRR} onChange={event => setEditingScenario(current => current && { ...current, maxWinRR: event.target.value })} /></label>
          <label className="field-label" htmlFor="scenario-min-loss">Minimum loss size (R)<input id="scenario-min-loss" type="number" min="0.1" max="100" step="any" required value={editingScenario.minLossRR} onChange={event => setEditingScenario(current => current && { ...current, minLossRR: event.target.value })} /></label>
          <label className="field-label" htmlFor="scenario-max-loss">Maximum loss size (R)<input id="scenario-max-loss" type="number" min="0.1" max="100" step="any" required value={editingScenario.maxLossRR} onChange={event => setEditingScenario(current => current && { ...current, maxLossRR: event.target.value })} /></label>
        </div>
        {scenarioError && <p className="error-banner" role="alert">{scenarioError}</p>}
        <div className="dialog-actions"><Button type="button" variant="outline" onClick={() => setEditingScenario(null)}>Cancel</Button><Button type="submit"><Check size={16} />Save scenario</Button></div>
      </form>}
    </Dialog>

    {storageError && <p className="error-banner mind-storage-error" role="alert">{storageError}</p>}
    <div className="mind-footnote"><ShieldCheck size={15} /><span>Simulated candles and outcomes are random, not market forecasts or financial advice.</span><span className="mind-footnote-separator">·</span><span>Hourly progress is saved only on this device.</span></div>
  </div>;
}
