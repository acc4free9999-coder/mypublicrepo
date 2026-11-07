export interface DayRecord { trades: string[]; notes: string }
export type MonthRecords = Record<string, DayRecord>;

export function numericTrades(record?: DayRecord): number[] {
  return (record?.trades ?? []).filter(value => value.trim() !== '' && Number.isFinite(Number(value))).map(Number);
}

export function dailyTotal(record?: DayRecord): number {
  return numericTrades(record).reduce((total, value) => total + value, 0);
}

export function monthStats(records: MonthRecords) {
  const active = Object.entries(records).filter(([, record]) => numericTrades(record).length > 0);
  const trades = active.flatMap(([, record]) => numericTrades(record));
  const wins = trades.filter(value => value > 0);
  const losses = trades.filter(value => value < 0);
  const days = active.map(([date, record]) => ({ date, total: dailyTotal(record) }));
  return {
    tradingDays: active.length, totalTrades: trades.length, wins: wins.length, losses: losses.length,
    net: trades.reduce((total, value) => total + value, 0),
    winRate: wins.length + losses.length ? wins.length / (wins.length + losses.length) * 100 : 0,
    averageWin: wins.length ? wins.reduce((total, value) => total + value, 0) / wins.length : 0,
    averageLoss: losses.length ? losses.reduce((total, value) => total + value, 0) / losses.length : 0,
    profitableDays: days.filter(day => day.total > 0).length,
    losingDays: days.filter(day => day.total < 0).length,
    best: days.length ? days.reduce((best, day) => day.total > best.total ? day : best) : null,
    worst: days.length ? days.reduce((worst, day) => day.total < worst.total ? day : worst) : null,
  };
}

export function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
export function dateKey(date: Date) { return `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`; }
export function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
export function rr(value: number) { return `${value > 0 ? '+' : ''}${Number(value.toFixed(2))}R`; }