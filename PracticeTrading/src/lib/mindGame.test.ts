import { beforeEach, describe, expect, it } from 'vitest';
import { checkInIsDue, createRound, DEFAULT_MIND_GYM_SCENARIO, initialRoundScore, practiceDay, practicedHour, readCheckIn, readMindGymLibrary, recordCheckIn, ROUND_COUNT, saveMindGymLibrary, scoreRound, validateMindGymScenario } from './mindGame';

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
});

describe('hourly mind-gym check-ins', () => {
  it('counts completed sessions and practiced clock hours separately', () => {
    const first = recordCheckIn(readCheckIn(new Date(2026, 10, 16, 9, 10)), new Date(2026, 10, 16, 9, 10));
    const sameHour = recordCheckIn(first, new Date(2026, 10, 16, 9, 50));
    const nextHour = recordCheckIn(sameHour, new Date(2026, 10, 16, 10, 5));
    expect(first.todaySessions).toBe(1);
    expect(sameHour.todaySessions).toBe(2);
    expect(sameHour.practicedHours).toHaveLength(1);
    expect(nextHour.practicedHours).toHaveLength(2);
    expect(checkInIsDue(nextHour, new Date(2026, 10, 16, 10, 55))).toBe(false);
    expect(checkInIsDue(nextHour, new Date(2026, 10, 16, 11, 0))).toBe(true);
  });
  it('resets the daily counter on a new local calendar day', () => {
    const first = recordCheckIn(readCheckIn(new Date(2026, 10, 16, 23, 55)), new Date(2026, 10, 16, 23, 55));
    const next = readCheckIn(new Date(2026, 10, 17, 0, 5));
    expect(first.todaySessions).toBe(1);
    expect(next.todaySessions).toBe(0);
    expect(practiceDay(new Date(2026, 10, 17, 0, 5))).toBe('2026-11-17');
    expect(practicedHour(new Date(2026, 10, 17, 0, 5))).toBe('2026-11-17T00');
  });
  it('gracefully defaults when saved check-in data is malformed', () => {
    localStorage.setItem('edgebook-mind-gym-v1', '{broken');
    expect(readCheckIn(new Date(2026, 10, 16, 9))).toMatchObject({ sessions: 0, todaySessions: 0, practicedHours: [] });
  });
});

describe('patient trading practice game', () => {
  it('creates a replayable-length market chart with either a setup or a skip day', () => {
    let value = 0;
    const round = createRound(() => { value += 0.1; return value % 0.9; });
    expect(round.candles).toHaveLength(8);
    expect(round.candles.every(price => price >= 12 && price <= 88)).toBe(true);
    expect(round.setupAt === null || round.setupAt >= 3 && round.setupAt <= 6).toBe(true);
    expect(ROUND_COUNT).toBe(5);
  });
  it('uses the selected scenario setup odds, win probability, and loss RR', () => {
    const scenario = { ...DEFAULT_MIND_GYM_SCENARIO, setupChance: 0, winProbability: 0, breakevenChance: 0, minLossRR: 2, maxLossRR: 2 };
    const values = [...Array(8).fill(0.5), 0.1, 0.5, 0.5];
    const round = createRound(() => values.shift() ?? 0.5, scenario);
    expect(round.setupAt).toBeNull();
    expect(round.outcome).toBe('loss');
    expect(round.rewardRR).toBe(-2);
  });
  it('rewards waiting, following the plan, and acknowledging losses independently of outcome', () => {
    const start = initialRoundScore();
    const waitedThenLost = scoreRound(start, -1, 'entered', true);
    expect(waitedThenLost).toEqual({ patience: 0, discipline: 1, acceptance: 1, trades: 1, netRR: -1 });
    const patientlyEntered = scoreRound(start, 2, 'waited');
    expect(patientlyEntered.patience).toBe(1);
    expect(patientlyEntered.discipline).toBe(0);
    const skipped = scoreRound(scoreRound(start, 0, 'waited'), 0, 'passed');
    expect(skipped).toMatchObject({ patience: 1, discipline: 1, trades: 0, netRR: 0 });
    const early = scoreRound(start, -1, 'early', true);
    expect(early).toMatchObject({ discipline: 0, acceptance: 1, trades: 1, netRR: -1 });
  });
});

describe('editable Mind Gym scenarios', () => {
  it('saves and reloads customized scenarios and selection independently', () => {
    const scenario = { ...DEFAULT_MIND_GYM_SCENARIO, id: 'memory-rep', name: 'Memory rep', roundCount: 8, setupChance: 60, minWinRR: 2, maxWinRR: 4 };
    const library = { scenarios: [scenario], selectedId: scenario.id };
    expect(saveMindGymLibrary(library)).toBe(true);
    expect(readMindGymLibrary()).toEqual(library);
  });
  it('rejects invalid probabilities, ranges, round counts, and duplicate IDs', () => {
    expect(validateMindGymScenario({ ...DEFAULT_MIND_GYM_SCENARIO, roundCount: 0 })).toContain('Round count');
    expect(validateMindGymScenario({ ...DEFAULT_MIND_GYM_SCENARIO, setupChance: 101 })).toContain('Setup chance');
    expect(validateMindGymScenario({ ...DEFAULT_MIND_GYM_SCENARIO, breakevenChance: 31 })).toContain('Breakeven');
    expect(validateMindGymScenario({ ...DEFAULT_MIND_GYM_SCENARIO, minWinRR: 4, maxWinRR: 2 })).toContain('Win RR range');
    const duplicated = { scenarios: [DEFAULT_MIND_GYM_SCENARIO, { ...DEFAULT_MIND_GYM_SCENARIO }], selectedId: DEFAULT_MIND_GYM_SCENARIO.id };
    expect(saveMindGymLibrary(duplicated)).toBe(false);
  });
  it('falls back to the default scenario if saved custom data is malformed', () => {
    localStorage.setItem('edgebook-mind-gym-scenarios-v1', '{broken');
    expect(readMindGymLibrary()).toEqual({ scenarios: [DEFAULT_MIND_GYM_SCENARIO], selectedId: DEFAULT_MIND_GYM_SCENARIO.id });
  });
});