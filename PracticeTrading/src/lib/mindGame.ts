export interface HourlyCheckIn {
  version: 1;
  sessions: number;
  lastPlayedAt: number | null;
  practicedHours: string[];
  day: string;
  todaySessions: number;
}

export interface MarketRound {
  candles: number[];
  setupAt: number | null;
  outcome: 'win' | 'loss' | 'breakeven';
  rewardRR: number;
}

export interface MindGymScenario {
  id: string;
  name: string;
  description: string;
  roundCount: number;
  setupChance: number;
  winProbability: number;
  breakevenChance: number;
  minWinRR: number;
  maxWinRR: number;
  minLossRR: number;
  maxLossRR: number;
}

export interface MindGymLibrary { scenarios: MindGymScenario[]; selectedId: string }

export interface RoundScore { patience: number; discipline: number; acceptance: number; trades: number; netRR: number }
export const ROUND_COUNT = 5;
export const DEFAULT_MIND_GYM_SCENARIO: MindGymScenario = {
  id: 'patient-practice', name: 'The patience practice', description: 'Wait for a confirmed setup. Some rounds have no entry at all.',
  roundCount: ROUND_COUNT, setupChance: 82, winProbability: 58, breakevenChance: 4,
  minWinRR: 1, maxWinRR: 3, minLossRR: 1, maxLossRR: 1,
};
const CHECKIN_KEY = 'edgebook-mind-gym-v1';
const LIBRARY_KEY = 'edgebook-mind-gym-scenarios-v1';

export function practiceDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function practicedHour(date = new Date()) { return `${practiceDay(date)}T${String(date.getHours()).padStart(2, '0')}`; }

export function readCheckIn(now = new Date()): HourlyCheckIn {
  const day = practiceDay(now);
  const fresh: HourlyCheckIn = { version: 1, sessions: 0, lastPlayedAt: null, practicedHours: [], day, todaySessions: 0 };
  try {
    const stored = JSON.parse(localStorage.getItem(CHECKIN_KEY) ?? 'null') as Partial<HourlyCheckIn> | null;
    if (!stored || stored.version !== 1 || typeof stored.sessions !== 'number' || !Number.isFinite(stored.sessions) || !Array.isArray(stored.practicedHours)) return fresh;
    return {
      version: 1, sessions: Math.max(0, Math.floor(stored.sessions)),
      lastPlayedAt: typeof stored.lastPlayedAt === 'number' && Number.isFinite(stored.lastPlayedAt) ? stored.lastPlayedAt : null,
      practicedHours: stored.practicedHours.filter((hour): hour is string => typeof hour === 'string').slice(-366 * 24),
      day, todaySessions: stored.day === day && typeof stored.todaySessions === 'number' && Number.isFinite(stored.todaySessions) ? Math.max(0, Math.floor(stored.todaySessions)) : 0,
    };
  } catch { return fresh; }
}

export function recordCheckIn(previous: HourlyCheckIn, now = new Date()): HourlyCheckIn {
  const day = practiceDay(now);
  const hour = practicedHour(now);
  return {
    version: 1, sessions: previous.sessions + 1, lastPlayedAt: now.getTime(),
    practicedHours: previous.practicedHours.includes(hour) ? previous.practicedHours : [...previous.practicedHours, hour].slice(-366 * 24),
    day, todaySessions: (previous.day === day ? previous.todaySessions : 0) + 1,
  };
}

export function checkInIsDue(checkIn: HourlyCheckIn, now = new Date()) {
  return !checkIn.practicedHours.includes(practicedHour(now));
}

export function validateMindGymScenario(scenario: MindGymScenario): string | null {
  if (!scenario.id.trim()) return 'Every scenario needs a unique ID.';
  if (!scenario.name.trim() || scenario.name.trim().length > 64) return 'Scenario name is required and must be 64 characters or fewer.';
  if (!scenario.description.trim() || scenario.description.trim().length > 180) return 'Scenario description is required and must be 180 characters or fewer.';
  if (!Number.isInteger(scenario.roundCount) || scenario.roundCount < 1 || scenario.roundCount > 12) return 'Round count must be a whole number from 1 to 12.';
  for (const [label, value] of [['Setup chance', scenario.setupChance], ['Win probability', scenario.winProbability]] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 100) return `${label} must be between 0% and 100%.`;
  }
  if (!Number.isFinite(scenario.breakevenChance) || scenario.breakevenChance < 0 || scenario.breakevenChance > 30) return 'Breakeven chance must be between 0% and 30%.';
  for (const [label, min, max] of [['Win RR', scenario.minWinRR, scenario.maxWinRR], ['Loss size', scenario.minLossRR, scenario.maxLossRR]] as const) {
    if (![min, max].every(Number.isFinite) || min < 0.1 || max > 100 || min > max) return `${label} range must be between 0.1R and 100R, with minimum no greater than maximum.`;
  }
  return null;
}

export function readMindGymLibrary(): MindGymLibrary {
  try {
    const stored = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? 'null') as Partial<MindGymLibrary> | null;
    if (!stored || !Array.isArray(stored.scenarios) || typeof stored.selectedId !== 'string') return { scenarios: [{ ...DEFAULT_MIND_GYM_SCENARIO }], selectedId: DEFAULT_MIND_GYM_SCENARIO.id };
    const scenarios = stored.scenarios as MindGymScenario[];
    const ids = new Set<string>();
    if (!scenarios.length || scenarios.length > 30 || scenarios.some(scenario => {
      if (!scenario || typeof scenario !== 'object' || Object.values(scenario).some(value => typeof value !== 'string' && typeof value !== 'number')) return true;
      const error = validateMindGymScenario(scenario);
      if (error || ids.has(scenario.id)) return true;
      ids.add(scenario.id);
      return false;
    })) return { scenarios: [{ ...DEFAULT_MIND_GYM_SCENARIO }], selectedId: DEFAULT_MIND_GYM_SCENARIO.id };
    return { scenarios, selectedId: ids.has(stored.selectedId) ? stored.selectedId : scenarios[0].id };
  } catch { return { scenarios: [{ ...DEFAULT_MIND_GYM_SCENARIO }], selectedId: DEFAULT_MIND_GYM_SCENARIO.id }; }
}

export function saveMindGymLibrary(library: MindGymLibrary): boolean {
  if (!library.scenarios.length || library.scenarios.length > 30) return false;
  const ids = new Set<string>();
  for (const scenario of library.scenarios) {
    if (validateMindGymScenario(scenario) || ids.has(scenario.id)) return false;
    ids.add(scenario.id);
  }
  if (!ids.has(library.selectedId)) return false;
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(library)); return true; }
  catch { return false; }
}

export function createRound(random: () => number = Math.random, scenario: MindGymScenario = DEFAULT_MIND_GYM_SCENARIO): MarketRound {
  const candles: number[] = [];
  let price = 50;
  for (let index = 0; index < 8; index++) {
    price = Math.max(12, Math.min(88, price + Math.round((random() * 2 - 1) * 13)));
    candles.push(price);
  }
  const setupRoll = random();
  const setupAt = setupRoll >= scenario.setupChance / 100 ? null : 3 + Math.floor(random() * 4);
  const outcomeRoll = random();
  const breakevenLimit = 1 - scenario.breakevenChance / 100;
  const outcome = outcomeRoll >= breakevenLimit ? 'breakeven' : outcomeRoll < breakevenLimit * scenario.winProbability / 100 ? 'win' : 'loss';
  const rewardRR = outcome === 'win' ? Math.round((scenario.minWinRR + random() * (scenario.maxWinRR - scenario.minWinRR)) * 10) / 10 : outcome === 'loss' ? -Math.round((scenario.minLossRR + random() * (scenario.maxLossRR - scenario.minLossRR)) * 10) / 10 : 0;
  return { candles, setupAt, outcome, rewardRR };
}

export function scoreRound(score: RoundScore, result: number, decision: 'waited' | 'entered' | 'passed' | 'early' | 'accepted', wasLossAccepted = false): RoundScore {
  return {
    patience: score.patience + (decision === 'waited' ? 1 : 0),
    discipline: score.discipline + (decision === 'entered' || decision === 'passed' ? 1 : 0),
    acceptance: score.acceptance + (wasLossAccepted ? 1 : 0),
    trades: score.trades + (decision === 'entered' || decision === 'early' ? 1 : 0),
    netRR: Math.round((score.netRR + result) * 100) / 100,
  };
}

export function initialRoundScore(): RoundScore { return { patience: 0, discipline: 0, acceptance: 0, trades: 0, netRR: 0 }; }