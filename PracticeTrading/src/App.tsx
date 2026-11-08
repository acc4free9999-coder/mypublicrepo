import { lazy, Suspense, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, BookOpen, CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight, ClipboardCheck, Dices, Download, FileJson, LayoutDashboard, Menu, MessageSquare, Pencil, Plus, Settings, ShieldCheck, Target, Trash2, TrendingUp, Upload, X } from 'lucide-react';
import { Button, ConfirmDialog, Dialog, cn } from './components/ui';
import { parseJournal, uid, useJournal, type AppState, type Question } from './lib/store';
import { dailyTotal, dateKey, daysInMonth, monthKey, monthStats, numericTrades, rr, type DayRecord, type MonthRecords } from './lib/trading';

const TradeSimulator = lazy(() => import('./components/TradeSimulator'));
type Page = 'Dashboard' | 'Daily Checklist' | 'Questions & Answers' | 'Monthly Performance' | 'Trade Simulator' | 'Settings';
const pages = [{ name: 'Dashboard', icon: LayoutDashboard }, { name: 'Daily Checklist', icon: ClipboardCheck }, { name: 'Questions & Answers', icon: MessageSquare }, { name: 'Monthly Performance', icon: BarChart3 }, { name: 'Trade Simulator', icon: Dices }] as const;
const today = () => dateKey(new Date());
const readableDate = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const tone = (value: number) => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';

function downloadJson(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Metric({ label, value, icon, detail, color = '' }: { label: string; value: ReactNode; icon: ReactNode; detail: ReactNode; color?: string }) {
  return <div className="metric"><div className="metric-label">{label}<span>{icon}</span></div><div className={cn('metric-value', color)}>{value}</div><div className="metric-detail">{detail}</div></div>;
}
function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="section-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

export default function App() {
  const { state, setState, saveError, resetState, exportData, importJournal } = useJournal();
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ filename: string; journal: AppState } | null>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [page, setPage] = useState<Page>('Dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [day, setDay] = useState(today);
  const [editChecklist, setEditChecklist] = useState(false);
  const [editQuestions, setEditQuestions] = useState(false);
  const [confirmStage, setConfirmStage] = useState(0);
  const [entryDay, setEntryDay] = useState<string | null>(null);
  const [entry, setEntry] = useState<DayRecord>({ trades: ['', '', ''], notes: '' });
  const [builder, setBuilder] = useState<{ kind: 'section' | 'item' | 'qsection' | 'question'; sectionId?: string; itemId?: string } | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState<'text' | 'checklist'>('text');
  const [draftOptions, setDraftOptions] = useState<{ id: string; name: string }[]>([]);
  const key = monthKey(month);
  const records = state.months[key] ?? {};
  const stats = monthStats(records);
  const currentStats = monthStats(state.months[monthKey(new Date())] ?? {});
  const allItems = state.sections.flatMap(section => section.items);
  const selectedDaily = state.daily[day] ?? { checked: [], answers: {} };
  const todayDaily = state.daily[today()] ?? { checked: [], answers: {} };
  const checkedCount = allItems.filter(item => todayDaily.checked.includes(item.id)).length;
  const completion = allItems.length ? Math.round(checkedCount / allItems.length * 100) : 0;
  const go = (next: Page) => { setPage(next); setMobileOpen(false); };
  const exportJournal = () => downloadJson(exportData(), `edgebook-${today()}.json`);
  const prepareImport = async (file: File) => {
    setImportError('');
    setImportSuccess('');
    setImportBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 5 MB.');
      setImportPreview({ filename: file.name, journal: parseJournal(await file.text()) });
    } catch (error) { setImportError(error instanceof Error ? error.message : 'This file could not be read. Please choose another file.'); }
    finally { setImportBusy(false); }
  };
  const changeMonth = (amount: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1));
  const updateDay = (date: string, record: DayRecord) => setState(prev => {
    const recordMonth = date.slice(0, 7);
    return { ...prev, months: { ...prev.months, [recordMonth]: { ...prev.months[recordMonth], [date]: record } } };
  });
  const updateDaily = (date: string, update: (daily: AppState['daily'][string]) => AppState['daily'][string]) => setState(prev => ({ ...prev, daily: { ...prev.daily, [date]: update(prev.daily[date] ?? { checked: [], answers: {} }) } }));
  const toggleItem = (date: string, id: string) => updateDaily(date, daily => ({ ...daily, checked: daily.checked.includes(id) ? daily.checked.filter(value => value !== id) : [...daily.checked, id] }));
  const openEntry = (date = today()) => { setEntryDay(date); setEntry(state.months[date.slice(0, 7)]?.[date] ?? { trades: ['', '', ''], notes: '' }); };
  const openBuilder = (kind: NonNullable<typeof builder>['kind'], sectionId?: string, itemId?: string) => {
    let name = '';
    let question: Question | undefined;
    if (kind === 'section') name = state.sections.find(section => section.id === sectionId)?.name ?? '';
    if (kind === 'item') name = state.sections.find(section => section.id === sectionId)?.items.find(item => item.id === itemId)?.name ?? '';
    if (kind === 'qsection') name = state.questionSections.find(section => section.id === sectionId)?.name ?? '';
    if (kind === 'question') { question = state.questionSections.find(section => section.id === sectionId)?.questions.find(item => item.id === itemId); name = question?.name ?? ''; }
    setDraftName(name); setDraftType(question?.type ?? 'text'); setDraftOptions(question?.options ?? []); setBuilder({ kind, sectionId, itemId });
  };
  const saveBuilder = (event: FormEvent) => {
    event.preventDefault();
    if (!builder || !draftName.trim()) return;
    const name = draftName.trim();
    const { kind, sectionId, itemId } = builder;
    setState(prev => {
      if (kind === 'section') return { ...prev, sections: sectionId ? prev.sections.map(section => section.id === sectionId ? { ...section, name } : section) : [...prev.sections, { id: uid(), name, items: [] }] };
      if (kind === 'qsection') return { ...prev, questionSections: sectionId ? prev.questionSections.map(section => section.id === sectionId ? { ...section, name } : section) : [...prev.questionSections, { id: uid(), name, questions: [] }] };
      if (kind === 'item') return { ...prev, sections: prev.sections.map(section => section.id !== sectionId ? section : { ...section, items: itemId ? section.items.map(item => item.id === itemId ? { ...item, name } : item) : [...section.items, { id: uid(), name }] }) };
      const question: Question = { id: itemId ?? uid(), name, type: draftType, options: draftOptions.filter(option => option.name.trim()).map(option => ({ ...option, name: option.name.trim() })) };
      return { ...prev, questionSections: prev.questionSections.map(section => section.id !== sectionId ? section : { ...section, questions: itemId ? section.questions.map(item => item.id === itemId ? question : item) : [...section.questions, question] }) };
    });
    setBuilder(null);
  };
  const checklistRows = (date: string, compact = false) => {
    const daily = state.daily[date] ?? { checked: [], answers: {} };
    return state.sections.map((section, index) => <section key={section.id} className={compact ? '' : 'checklist-section panel'}>
      <div className="list-section-heading"><span className="section-number">{String(index + 1).padStart(2, '0')}</span><h3>{section.name}</h3><span className="muted small">{section.items.filter(item => daily.checked.includes(item.id)).length}/{section.items.length}</span>{!compact && editChecklist && <div className="row-actions"><Button title="Edit section" aria-label={`Edit ${section.name}`} variant="ghost" size="icon" onClick={() => openBuilder('section', section.id)}><Pencil size={14} /></Button><Button title="Delete section" aria-label={`Delete ${section.name}`} variant="ghost" size="icon" onClick={() => setState(prev => ({ ...prev, sections: prev.sections.filter(item => item.id !== section.id) }))}><Trash2 size={14} /></Button></div>}</div>
      {section.items.map(item => <div className="check-row" key={item.id}><label className={cn('check-label', daily.checked.includes(item.id) && 'is-checked')}><input type="checkbox" checked={daily.checked.includes(item.id)} onChange={() => toggleItem(date, item.id)} /><span>{item.name}</span></label>{!compact && editChecklist && <div className="row-actions"><Button aria-label={`Edit ${item.name}`} title="Edit item" variant="ghost" size="icon" onClick={() => openBuilder('item', section.id, item.id)}><Pencil size={14} /></Button><Button aria-label={`Delete ${item.name}`} title="Delete item" variant="ghost" size="icon" onClick={() => setState(prev => ({ ...prev, sections: prev.sections.map(group => group.id === section.id ? { ...group, items: group.items.filter(value => value.id !== item.id) } : group) }))}><Trash2 size={14} /></Button></div>}</div>)}
      {!compact && <Button variant="ghost" size="sm" className="add-item" onClick={() => openBuilder('item', section.id)}><Plus size={15} />Add item</Button>}
    </section>);
  };
  const questionRows = (date: string, editable = false) => {
    const daily = state.daily[date] ?? { checked: [], answers: {} };
    return <div className="questions-layout">{state.questionSections.map((section, sectionIndex) => <section className="panel question-section" key={section.id}>
      <div className="list-section-heading"><span className="section-number">{String(sectionIndex + 1).padStart(2, '0')}</span><h3>{section.name}</h3>{editable && editQuestions && <div className="row-actions">
        <Button variant="ghost" size="icon" aria-label={`Edit ${section.name}`} title="Edit section" onClick={() => openBuilder('qsection', section.id)}><Pencil size={14} /></Button>
        <Button variant="ghost" size="icon" aria-label={`Delete ${section.name}`} title="Delete section" onClick={() => setState(prev => ({ ...prev, questionSections: prev.questionSections.filter(group => group.id !== section.id) }))}><Trash2 size={14} /></Button>
      </div>}</div>
      {section.questions.map((question, index) => <div className="question-block" key={question.id}>
        <div className="question-label"><label htmlFor={`answer-${question.id}`}><span className="muted">{String(index + 1).padStart(2, '0')}.</span> {question.name}</label>{editable && editQuestions && <div className="row-actions">
          <Button variant="ghost" size="icon" title="Edit question" aria-label={`Edit ${question.name}`} onClick={() => openBuilder('question', section.id, question.id)}><Pencil size={14} /></Button>
          <Button variant="ghost" size="icon" title="Delete question" aria-label={`Delete ${question.name}`} onClick={() => setState(prev => ({ ...prev, questionSections: prev.questionSections.map(group => group.id === section.id ? { ...group, questions: group.questions.filter(item => item.id !== question.id) } : group) }))}><Trash2 size={14} /></Button>
        </div>}</div>
        {question.type === 'text' ? <textarea id={`answer-${question.id}`} placeholder="Your thoughts..." value={typeof daily.answers[question.id] === 'string' ? daily.answers[question.id] as string : ''} onChange={event => updateDaily(date, current => ({ ...current, answers: { ...current.answers, [question.id]: event.target.value } }))} /> : <div className="question-options" role="group" aria-label={question.name}>
          {question.options.map(option => {
            const answers = Array.isArray(daily.answers[question.id]) ? daily.answers[question.id] as string[] : [];
            return <label className="option-label" key={option.id}><input type="checkbox" checked={answers.includes(option.id)} onChange={() => updateDaily(date, current => {
              const selected = Array.isArray(current.answers[question.id]) ? current.answers[question.id] as string[] : [];
              return { ...current, answers: { ...current.answers, [question.id]: selected.includes(option.id) ? selected.filter(value => value !== option.id) : [...selected, option.id] } };
            })} />{option.name}</label>;
          })}
          {!question.options.length && <span className="muted small">No options yet.</span>}
        </div>}
      </div>)}
      {editable && <Button variant="ghost" className="add-item" onClick={() => openBuilder('question', section.id)}><Plus size={16} />Add question</Button>}
    </section>)}</div>;
  };
  const monthControl = <div className="month-control"><Button variant="ghost" size="icon" aria-label="Previous month" title="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /></Button><span><CalendarDays size={15} />{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span><Button variant="ghost" size="icon" aria-label="Next month" title="Next month" onClick={() => changeMonth(1)}><ChevronRight size={17} /></Button></div>;

  return <div className="app-shell">
    {mobileOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={cn('sidebar', mobileOpen && 'sidebar-open')}>
      <a className="brand" href="#" onClick={event => { event.preventDefault(); go('Dashboard'); }}><span className="brand-mark"><Activity size={25} strokeWidth={2.5} /></span>edgebook<span className="brand-dot">.</span></a>
      <div className="workspace-label">PERSONAL WORKSPACE</div>
      <nav aria-label="Main navigation">{pages.map(({ name, icon: Icon }) => <button key={name} onClick={() => go(name)} className={cn('nav-item', page === name && 'active')}><Icon size={18} /><span>{name}</span>{page === name && <span className="active-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="process-note"><div className="process-icon"><Target size={19} /></div><p>Process over profits.</p><span>A little more disciplined.<br />Every single day.</span><div className="note-line" /></div><button className={cn('nav-item', page === 'Settings' && 'active')} onClick={() => go('Settings')}><Settings size={18} />Settings</button><div className="profile"><div className="avatar">T</div><div><strong>My trading journal</strong><span>Personal account</span></div><span className="local-dot" title="Stored on this device" /></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><Button className="mobile-menu" variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></Button><span>Workspace</span><ChevronRight size={14} /><strong>{page}</strong></div><div className="topbar-right"><span className={cn('save-status', saveError && 'negative')}><span className="status-dot" />{saveError ? 'Not saved' : 'All changes saved'}</span><span className="topbar-divider" /><span className="market-label"><span className="gold-dot" />XAUUSD <span className="muted">/ Forex</span></span><div className="avatar small-avatar">T</div></div></header>
    <main>
      {saveError && <div role="alert" className="error-banner">{saveError}</div>}
      <div className="page-heading"><div><div className="eyebrow">YOUR EDGE STARTS WITH CONSISTENCY</div><h1>{page === 'Dashboard' ? 'A clear mind. A better trade.' : page === 'Daily Checklist' ? 'Trust your process.' : page === 'Questions & Answers' ? 'Think before you trade.' : page === 'Monthly Performance' ? 'Let the numbers speak.' : page === 'Trade Simulator' ? 'Explore the possibilities.' : 'Your journal, your space.'}</h1><p>{page === 'Dashboard' ? 'Plan with intention. Trade with discipline. Review with honesty.' : page === 'Daily Checklist' ? 'The small habits behind your best trading days.' : page === 'Questions & Answers' ? 'Make room for a plan, a little reflection, and a sharper perspective.' : page === 'Monthly Performance' ? 'Every trade is a data point. See the bigger picture.' : page === 'Trade Simulator' ? 'Test your assumptions across a random sequence of trades.' : 'Manage your data and keep a copy of your progress.'}</p></div>{page === 'Dashboard' || page === 'Monthly Performance' ? <Button onClick={() => openEntry()}><Plus size={17} />Log a trade</Button> : null}</div>

      {page === 'Dashboard' && <>
        <div className="overview-toolbar"><div className="today-label"><CalendarDays size={16} />{readableDate(today())}</div><span className="period-badge">This month</span></div>
        <section className="panel today-checklist dashboard-checklist"><SectionTitle title="Today's checklist" action={<span className="subtle-tag">{checkedCount} of {allItems.length}</span>} /><div className="mini-progress"><span>Preparation is your first edge.</span><strong>{completion}%</strong></div><div className="progress-track"><div style={{ width: `${completion}%` }} /></div><div className="compact-checklist">{allItems.length ? checklistRows(today(), true) : <div className="empty-inline">Your process starts here. Add a checklist section.</div>}</div><Button variant="outline" onClick={() => { setDay(today()); go('Daily Checklist'); }}>Open daily checklist<ArrowRight size={15} /></Button></section>
        <div className="metrics-grid"><Metric label="Monthly net RR" value={rr(currentStats.net)} icon={<TrendingUp size={18} />} color={tone(currentStats.net)} detail={<><span className="tiny-dot emerald" />{new Date().toLocaleDateString('en-US', { month: 'long' })} performance</>} /><Metric label="Total trades" value={currentStats.totalTrades} icon={<BarChart3 size={18} />} detail={<><span className="positive">{currentStats.wins} wins</span><span className="detail-separator">/</span><span>{currentStats.losses} losses</span></>} /><Metric label="Win rate" value={<>{currentStats.winRate.toFixed(1)}<span className="value-unit">%</span></>} icon={<Target size={18} />} detail="Excluding breakeven trades" /><Metric label="Today's checklist" value={<>{completion}<span className="value-unit">%</span></>} icon={<ClipboardCheck size={18} />} detail={<div className="metric-progress"><div className="progress-track"><div style={{ width: `${completion}%` }} /></div><span>{checkedCount}/{allItems.length}</span></div>} /></div>
        <section className="panel performance-panel"><SectionTitle title="Performance overview" subtitle="Your cumulative return, one trade at a time." action={<span className="subtle-tag">This month <ChevronRight size={13} /></span>} /><EquityChart records={state.months[monthKey(new Date())] ?? {}} month={new Date()} /><div className="chart-footer"><span><span className="legend-line" />Cumulative RR</span><button className="text-link" onClick={() => { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); go('Monthly Performance'); }}>View performance<ArrowRight size={14} /></button></div></section>
        <div className="dashboard-bottom-grid"><section className="panel calendar-panel"><SectionTitle title="Trading activity" subtitle="Small steps. Measurable progress." action={<span className="muted small">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>} /><ActivityCalendar records={state.months[monthKey(new Date())] ?? {}} month={new Date()} onSelect={openEntry} /><div className="calendar-legend"><span><i className="legend-square positive-bg" />Profitable</span><span><i className="legend-square negative-bg" />Losing</span><span><i className="legend-square neutral-bg" />No trades</span></div></section><section className="panel recent-panel"><SectionTitle title="Recent trading days" action={<button className="text-link" onClick={() => go('Monthly Performance')}>View all<ArrowRight size={14} /></button>} /><div className="recent-head"><span>DATE</span><span>TRADES</span><span>NET RR</span></div>{Object.entries(state.months[monthKey(new Date())] ?? {}).filter(([, record]) => numericTrades(record).length).sort(([first], [second]) => second.localeCompare(first)).slice(0, 4).map(([date, record]) => <button className="recent-row" key={date} onClick={() => openEntry(date)}><span><span className={cn('trade-direction', tone(dailyTotal(record)))}>{dailyTotal(record) >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}</span>{new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><span>{numericTrades(record).length} trades</span><strong className={tone(dailyTotal(record))}>{rr(dailyTotal(record))}</strong></button>)}{!currentStats.tradingDays && <div className="empty-recent"><BookOpen size={24} /><strong>A fresh page for your progress</strong><span>Your trading days will appear here.</span><button className="text-link" onClick={() => openEntry()}>Log your first trade<Plus size={14} /></button></div>}</section></div>
        <section className="dashboard-questions" aria-label="Today's questions and answers">
          <SectionTitle title="Today's questions & answers" action={<button className="text-link" onClick={() => { setDay(today()); go('Questions & Answers'); }}>Open questions<ArrowRight size={14} /></button>} />
          {questionRows(today())}
          {!state.questionSections.length && <EmptyState icon={<MessageSquare size={28} />} title="A space for your thoughts" text="" action={<Button onClick={() => openBuilder('qsection')}><Plus size={16} />Add section</Button>} />}
        </section>
        <div className="bottom-note"><ShieldCheck size={14} /><span>Your journal stays yours. All data is saved locally on this device.</span><span className="bottom-note-right">Built for the long game.</span></div>
      </>}

      {page === 'Daily Checklist' && <><div className="view-toolbar"><label className="date-control"><CalendarDays size={16} /><input type="date" aria-label="Checklist date" value={day} onChange={event => event.target.value && setDay(event.target.value)} /></label><div className="toolbar-actions"><Button variant="outline" onClick={() => setEditChecklist(!editChecklist)}>{editChecklist ? <Check size={16} /> : <Pencil size={16} />}{editChecklist ? 'Done editing' : 'Customize'}</Button><Button onClick={() => openBuilder('section')}><Plus size={16} />Add section</Button></div></div><div className="daily-summary"><CheckCheck size={20} /><strong>{allItems.filter(item => selectedDaily.checked.includes(item.id)).length} of {allItems.length} complete</strong><div className="progress-track"><div style={{ width: `${allItems.length ? allItems.filter(item => selectedDaily.checked.includes(item.id)).length / allItems.length * 100 : 0}%` }} /></div><span className="muted">{allItems.length ? Math.round(allItems.filter(item => selectedDaily.checked.includes(item.id)).length / allItems.length * 100) : 0}%</span></div><div className="checklist-grid">{checklistRows(day)}</div>{!state.sections.length && <EmptyState icon={<ClipboardCheck size={28} />} title="Build your daily process" text="" action={<Button onClick={() => openBuilder('section')}><Plus size={16} />Add section</Button>} />}<div className="question-shortcut"><div><MessageSquare size={22} /><div><h3>The daily game plan</h3><p>Your questions and reflections for {new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.</p></div></div><Button variant="outline" onClick={() => go('Questions & Answers')}>Open questions<ArrowRight size={15} /></Button></div></>}

      {page === 'Questions & Answers' && <><div className="view-toolbar"><label className="date-control"><CalendarDays size={16} /><input type="date" aria-label="Answer date" value={day} onChange={event => event.target.value && setDay(event.target.value)} /></label><div className="toolbar-actions"><Button variant="outline" onClick={() => setEditQuestions(!editQuestions)}>{editQuestions ? <Check size={16} /> : <Pencil size={16} />}{editQuestions ? 'Done editing' : 'Customize'}</Button><Button onClick={() => openBuilder('qsection')}><Plus size={16} />Add section</Button></div></div>{questionRows(day, true)}{!state.questionSections.length && <EmptyState icon={<MessageSquare size={28} />} title="A space for your thoughts" text="" action={<Button onClick={() => openBuilder('qsection')}><Plus size={16} />Add section</Button>} />}</>}

      {page === 'Monthly Performance' && <><div className="view-toolbar">{monthControl}<Button variant="ghost" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Current month</Button></div><div className="metrics-grid"><Metric label="Total trading days" value={stats.tradingDays} icon={<CalendarDays size={18} />} detail={`${daysInMonth(month.getFullYear(), month.getMonth())} calendar days`} /><Metric label="Total trades" value={stats.totalTrades} icon={<BarChart3 size={18} />} detail={`${stats.totalTrades - stats.wins - stats.losses} breakeven trades`} /><Metric label="Winning trades" value={stats.wins} icon={<Target size={18} />} detail={`${stats.winRate.toFixed(1)}% win rate`} /><Metric label="Monthly net RR" value={rr(stats.net)} color={tone(stats.net)} icon={<TrendingUp size={18} />} detail="Combined risk-adjusted return" /></div><section className="panel monthly-table-panel"><SectionTitle title="The trading ledger" subtitle={month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} action={<span className="subtle-tag">Risk / Reward</span>} /><PerformanceTable month={month} records={records} onChange={updateDay} /><div className="ledger-total"><span>MONTHLY NET RETURN</span><strong className={tone(stats.net)}>{rr(stats.net)}</strong></div></section><div className="statistics-grid">{[{ label: 'Win rate', value: `${stats.winRate.toFixed(1)}%` }, { label: 'Average winning RR', value: rr(stats.averageWin), color: 'positive' }, { label: 'Average losing RR', value: rr(stats.averageLoss), color: 'negative' }, { label: 'Best trading day', value: stats.best ? rr(stats.best.total) : '—', note: stats.best?.date }, { label: 'Worst trading day', value: stats.worst ? rr(stats.worst.total) : '—', note: stats.worst?.date }, { label: 'Profitable / losing days', value: `${stats.profitableDays} / ${stats.losingDays}` }].map(item => <div className="stat-item" key={item.label}><span>{item.label}</span><strong className={item.color}>{item.value}</strong>{item.note && <small>{new Date(`${item.note}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small>}</div>)}</div></>}

      {page === 'Trade Simulator' && <Suspense fallback={<p className="muted" role="status">Loading simulator...</p>}><TradeSimulator /></Suspense>}

      {page === 'Settings' && <div className="settings-layout">
        <section className="settings-section">
          <div className="setting-heading"><ShieldCheck size={23} /><div><h2>Local by design</h2><p>No accounts. No servers. Just you and your journal.</p></div></div>
          <div className="setting-row"><div><h3>Automatic saving</h3><p>Changes are saved in this browser on this device. Clearing browser storage will remove your journal.</p></div><span className={cn('subtle-tag', saveError ? 'negative' : 'positive')}>{saveError ? 'Unavailable' : 'Enabled'}<Check size={14} /></span></div>
          <div className="setting-row"><div><h3>Export your journal</h3><p>Download all your checklists, answers, and trading records as JSON.</p></div><Button variant="outline" onClick={exportJournal}><Download size={16} />Export data</Button></div>
          <div className="setting-row"><div><h3>Import your journal</h3><p>Restore an Edgebook JSON backup from a file or pasted JSON. Importing replaces all current checklists, answers, and trading records after confirmation.</p></div><div className="import-actions"><Button variant="outline" disabled={importBusy} onClick={() => importFileRef.current?.click()}><Upload size={16} />{importBusy ? 'Reading file...' : 'Import journal'}</Button><Button variant="outline" disabled={importBusy} onClick={() => { setImportError(''); setImportSuccess(''); setPasteError(''); setPasteOpen(true); }}><FileJson size={16} />Paste JSON</Button></div></div>
          <input ref={importFileRef} type="file" className="hidden" aria-label="Import journal file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void prepareImport(file); }} />
          <div className="setting-row"><div><h3>Journal import template</h3><p>An editable JSON example with checklist sections, both question types, and a sample trading day on January 5, 2026. Remove or replace the example records before importing.</p></div><Button variant="outline" asChild><a href="/edgebook-template.json" download="edgebook-template.json"><FileJson size={16} />Download template</a></Button></div>
          {importError && <p role="alert" className="error-banner">{importError}</p>}
          {importSuccess && <p role="status" className="import-success"><Check size={16} />{importSuccess}</p>}
        </section>
        <section className="settings-section danger-zone"><div className="setting-heading"><Trash2 size={22} /><div><h2>Clear journal data</h2><p>A fresh start, when you really mean it.</p></div></div><div className="setting-row"><div><h3>Permanently delete all data</h3><p>Remove every checklist, question, answer, and trade across all months. You will be asked to confirm twice.</p></div><Button variant="destructive" onClick={() => setConfirmStage(1)}><Trash2 size={16} />Clear All Data</Button></div></section>
        <div className="settings-brand"><Activity size={20} /><strong>edgebook.</strong><span>Stay patient. Protect your capital.</span></div>
      </div>}
    </main></div>

    <Dialog open={builder !== null} onOpenChange={open => !open && setBuilder(null)} title={`${builder?.itemId || (builder?.sectionId && ['section', 'qsection'].includes(builder.kind)) ? 'Edit' : 'Add'} ${builder?.kind === 'question' ? 'question' : builder?.kind === 'item' ? 'checklist item' : 'section'}`}><form onSubmit={saveBuilder}><label className="field-label" htmlFor="builder-name">{builder?.kind === 'question' ? 'Question' : 'Name'}</label><input id="builder-name" autoFocus required maxLength={240} placeholder={builder?.kind === 'question' ? 'What would you like to reflect on?' : 'Give it a name'} value={draftName} onChange={event => setDraftName(event.target.value)} />{builder?.kind === 'question' && <><label className="field-label" htmlFor="answer-type">Answer type</label><select id="answer-type" value={draftType} onChange={event => setDraftType(event.target.value as 'text' | 'checklist')}><option value="text">Written answer</option><option value="checklist">Checklist answer</option></select>{draftType === 'checklist' && <div className="builder-options"><label className="field-label">Answer options</label>{draftOptions.map((option, index) => <div className="builder-option" key={option.id}><input required aria-label={`Option ${index + 1}`} placeholder={`Option ${index + 1}`} value={option.name} onChange={event => setDraftOptions(prev => prev.map(item => item.id === option.id ? { ...item, name: event.target.value } : item))} /><Button type="button" title="Remove option" aria-label={`Remove option ${index + 1}`} variant="ghost" size="icon" onClick={() => setDraftOptions(prev => prev.filter(item => item.id !== option.id))}><X size={16} /></Button></div>)}<Button type="button" variant="ghost" size="sm" onClick={() => setDraftOptions(prev => [...prev, { id: uid(), name: '' }])}><Plus size={15} />Add option</Button></div>}</>}<div className="dialog-actions"><Button type="button" variant="outline" onClick={() => setBuilder(null)}>Cancel</Button><Button type="submit" disabled={!draftName.trim() || (builder?.kind === 'question' && draftType === 'checklist' && !draftOptions.some(option => option.name.trim()))}><Check size={16} />Save {builder?.kind === 'question' ? 'question' : builder?.kind === 'item' ? 'item' : 'section'}</Button></div></form></Dialog>
    <Dialog open={entryDay !== null} onOpenChange={open => !open && setEntryDay(null)} title="Log your trading day" description="Record results in R multiples."><form onSubmit={event => { event.preventDefault(); if (entryDay) updateDay(entryDay, entry); setEntryDay(null); }}><label className="field-label" htmlFor="entry-date">Trading date</label><input id="entry-date" type="date" required value={entryDay ?? ''} onChange={event => { if (!event.target.value) return; setEntryDay(event.target.value); setEntry(state.months[event.target.value.slice(0, 7)]?.[event.target.value] ?? { trades: ['', '', ''], notes: '' }); }} /><div className="trade-entry-grid">{entry.trades.map((value, index) => <label key={index} className="field-label">Trade {index + 1} (RR)<input type="number" step="any" placeholder="—" value={value} onChange={event => setEntry(prev => ({ ...prev, trades: prev.trades.map((trade, tradeIndex) => index === tradeIndex ? event.target.value : trade) }))} /></label>)}</div><Button type="button" variant="ghost" size="sm" onClick={() => setEntry(prev => ({ ...prev, trades: [...prev.trades, ''] }))}><Plus size={15} />Add trade</Button><label className="field-label" htmlFor="entry-notes">Daily notes</label><textarea id="entry-notes" placeholder="What stood out today?" value={entry.notes} onChange={event => setEntry(prev => ({ ...prev, notes: event.target.value }))} /><div className="entry-total"><span>Daily total</span><strong className={tone(dailyTotal(entry))}>{rr(dailyTotal(entry))}</strong></div><div className="dialog-actions"><Button type="button" variant="outline" onClick={() => setEntryDay(null)}>Cancel</Button><Button type="submit"><Check size={16} />Save trading day</Button></div></form></Dialog>
    <Dialog open={pasteOpen} onOpenChange={setPasteOpen} title="Import from JSON" description="Paste an Edgebook journal export or an edited JSON template. You can review it before confirming replacement.">
      <form onSubmit={event => {
        event.preventDefault();
        setPasteError('');
        try {
          if (new Blob([pastedJson]).size > 5 * 1024 * 1024) throw new Error('Pasted JSON must be no larger than 5 MB.');
          const journal = parseJournal(pastedJson);
          setPasteOpen(false);
          setImportPreview({ filename: 'pasted JSON', journal });
        } catch (error) { setPasteError(error instanceof Error ? error.message : 'This JSON could not be read.'); }
      }}>
        <label className="field-label" htmlFor="pasted-journal">Journal JSON</label>
        <textarea id="pasted-journal" className="paste-json-editor" autoFocus spellCheck={false} autoCapitalize="off" autoCorrect="off" placeholder={'{\n  "sections": [],\n  "questionSections": [],\n  "daily": {},\n  "months": {}\n}'} value={pastedJson} aria-invalid={Boolean(pasteError)} aria-describedby={pasteError ? 'paste-json-error' : undefined} onChange={event => { setPastedJson(event.target.value); setPasteError(''); }} />
        {pasteError && <p id="paste-json-error" role="alert" className="error-banner import-dialog-error">{pasteError}</p>}
        <div className="dialog-actions"><Button type="button" variant="outline" onClick={() => setPasteOpen(false)}>Cancel</Button><Button type="submit" disabled={!pastedJson.trim()}><FileJson size={16} />Review import</Button></div>
      </form>
    </Dialog>
    <Dialog open={importPreview !== null} onOpenChange={open => { if (!open) { setImportPreview(null); setImportError(''); } }} title="Replace your journal?" description="Importing replaces all current checklist sections, questions, daily answers, and trading records from every month. This cannot be undone. Download a backup first to keep your current journal.">
      {importPreview && <>
        <p className="import-filename">{importPreview.filename}</p>
        <dl className="import-summary">
          <div><dt>Checklist sections</dt><dd>{importPreview.journal.sections.length}</dd></div>
          <div><dt>Questions</dt><dd>{importPreview.journal.questionSections.reduce((total, section) => total + section.questions.length, 0)}</dd></div>
          <div><dt>Daily answer records</dt><dd>{Object.keys(importPreview.journal.daily).length}</dd></div>
          <div><dt>Trading months</dt><dd>{Object.keys(importPreview.journal.months).length}</dd></div>
          <div><dt>Trades</dt><dd>{Object.values(importPreview.journal.months).reduce((total, records) => total + monthStats(records).totalTrades, 0)}</dd></div>
        </dl>
        <Button variant="outline" onClick={exportJournal}><Download size={16} />Download current backup</Button>
        {importError && <p role="alert" className="error-banner import-dialog-error">{importError}</p>}
        <div className="dialog-actions"><Button variant="outline" onClick={() => { setImportPreview(null); setImportError(''); }}>Cancel</Button><Button variant="destructive" onClick={() => {
          try { importJournal(importPreview.journal); setImportSuccess(`Imported ${importPreview.filename} successfully.`); setImportError(''); setImportPreview(null); setPastedJson(''); }
          catch (error) { setImportError(error instanceof Error ? error.message : 'Import failed. Your current journal has not been replaced.'); }
        }}><Upload size={16} />Replace and import</Button></div>
      </>}
    </Dialog>
    <ConfirmDialog stage={confirmStage} onCancel={() => setConfirmStage(0)} onContinue={() => { if (confirmStage === 1) setConfirmStage(2); else { resetState(); setConfirmStage(0); } }} />
  </div>;
}

function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action: ReactNode }) {
  return <div className="empty-state">{icon}<h2>{title}</h2>{text && <p>{text}</p>}{action}</div>;
}

function EquityChart({ records, month }: { records: MonthRecords; month: Date }) {
  const totalDays = daysInMonth(month.getFullYear(), month.getMonth());
  let running = 0;
  const values = Array.from({ length: totalDays }, (_, index) => { running += dailyTotal(records[`${monthKey(month)}-${String(index + 1).padStart(2, '0')}`]); return running; });
  const max = Math.max(3, ...values), min = Math.min(-1, ...values), range = max - min;
  const x = (index: number) => 50 + index / (totalDays - 1) * 650;
  const y = (value: number) => 20 + (max - value) / range * 170;
  const line = values.map((value, index) => `${index ? 'L' : 'M'}${x(index)},${y(value)}`).join(' ');
  const hasTrades = Object.values(records).some(record => numericTrades(record).length);
  return <div className="equity-chart"><div className="chart-value"><strong className={tone(running)}>{rr(running)}</strong><span>NET RETURN</span></div><svg viewBox="0 0 720 230" role="img" aria-label={`Cumulative monthly performance: ${rr(running)}`}><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#56d6a0" stopOpacity="0.16" /><stop offset="100%" stopColor="#56d6a0" stopOpacity="0" /></linearGradient></defs>{Array.from({ length: 5 }, (_, index) => { const value = max - range * index / 4; return <g key={index}><line x1="50" x2="700" y1={y(value)} y2={y(value)} stroke="#2b2e2c" strokeDasharray="3 5" /><text x="3" y={y(value) + 4} fill="#787e79" fontSize="10">{Number(value.toFixed(1))}R</text></g>; })}<path d={`${line} L700,190 L50,190 Z`} fill="url(#chart-fill)" /><path d={line} fill="none" stroke="#64d6a7" strokeWidth="2.5" strokeLinejoin="round" /><circle cx="700" cy={y(running)} r="4" fill="#64d6a7" stroke="#161a17" strokeWidth="2" />{[1, 5, 10, 15, 20, 25, totalDays].map(date => <text key={date} x={x(date - 1)} y="219" textAnchor="middle" fill="#787e79" fontSize="10">{String(date).padStart(2, '0')} {date === 1 ? month.toLocaleDateString('en-US', { month: 'short' }) : ''}</text>)}</svg>{!hasTrades && <span className="chart-empty-label">Your next chapter starts at zero.</span>}</div>;
}
function ActivityCalendar({ records, month, onSelect }: { records: MonthRecords; month: Date; onSelect: (date: string) => void }) {
  const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  return <div className="activity-calendar">{['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}{Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: daysInMonth(month.getFullYear(), month.getMonth()) }, (_, index) => { const date = `${monthKey(month)}-${String(index + 1).padStart(2, '0')}`; const record = records[date]; const active = numericTrades(record).length > 0; const total = dailyTotal(record); return <button key={date} title={`${date}${active ? `: ${rr(total)}` : ': no trades'}`} aria-label={`Log trades for ${date}`} className={cn('calendar-day', active && `${tone(total)}-day`, date === today() && 'is-today')} onClick={() => onSelect(date)}>{index + 1}{active && <span>{rr(total)}</span>}</button>; })}</div>;
}
function PerformanceTable({ month, records, onChange }: { month: Date; records: MonthRecords; onChange: (date: string, record: DayRecord) => void }) {
  const columns = Math.max(3, ...Object.values(records).map(record => record.trades.length));
  const [requestedColumns, setRequestedColumns] = useState(3);
  const count = Math.max(columns, requestedColumns);
  return <div className="table-scroll"><table><thead><tr><th>Date</th><th>Day</th>{Array.from({ length: count }, (_, index) => <th key={index}>Trade {index + 1} <span>(RR)</span></th>)}<th><Button variant="ghost" size="icon" title="Add trade column" aria-label="Add trade column" onClick={() => setRequestedColumns(count + 1)}><Plus size={15} /></Button></th><th>Daily total</th><th className="notes-column">Notes</th></tr></thead><tbody>{Array.from({ length: daysInMonth(month.getFullYear(), month.getMonth()) }, (_, index) => { const date = `${monthKey(month)}-${String(index + 1).padStart(2, '0')}`; const actualDate = new Date(`${date}T12:00:00`); const record = records[date] ?? { trades: [], notes: '' }; const active = numericTrades(record).length > 0; return <tr key={date} className={cn(date === today() && 'today-row', [0, 6].includes(actualDate.getDay()) && 'weekend-row')}><td><span className="table-date">{String(index + 1).padStart(2, '0')}{date === today() && <span className="tiny-dot emerald" />}</span></td><td className="muted">{actualDate.toLocaleDateString('en-US', { weekday: 'short' })}</td>{Array.from({ length: count }, (_, tradeIndex) => <td key={tradeIndex}><input type="number" step="any" className={tone(Number(record.trades[tradeIndex] || 0))} aria-label={`${date} trade ${tradeIndex + 1} RR`} placeholder="—" value={record.trades[tradeIndex] ?? ''} onChange={event => { const trades = Array.from({ length: Math.max(count, record.trades.length) }, (_, slot) => slot === tradeIndex ? event.target.value : record.trades[slot] ?? ''); onChange(date, { ...record, trades }); }} /></td>)}<td /><td className={cn('daily-total', active && tone(dailyTotal(record)))}>{active ? rr(dailyTotal(record)) : <span className="muted">—</span>}</td><td><input className="notes-input" aria-label={`${date} notes`} placeholder="Add a note..." value={record.notes} onChange={event => onChange(date, { ...record, notes: event.target.value })} /></td></tr>; })}</tbody></table></div>;
}