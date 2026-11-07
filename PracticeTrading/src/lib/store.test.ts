import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { emptyState, initialState, parseJournal } from './store';
import { monthStats } from './trading';

describe('journal imports', () => {
  it('round-trips an existing export without changing data', () => {
    const journal = initialState();
    journal.daily['2026-11-07'] = { checked: ['pre-0'], answers: { bias: 'Bullish', condition: ['condition-0', 'condition-3'] } };
    journal.months['2026-11'] = { '2026-11-07': { trades: ['2.5', '-1', '0', ''], notes: 'Followed plan' } };
    expect(parseJournal(JSON.stringify(journal))).toEqual(journal);
    expect(parseJournal(JSON.stringify(emptyState()))).toEqual(emptyState());
  });
  it('accepts the downloadable template with both answer types and sample trades', () => {
    const journal = parseJournal(readFileSync(new URL('../../public/edgebook-template.json', import.meta.url), 'utf8'));
    expect(journal.questionSections[0].questions.map(question => question.type)).toEqual(['text', 'checklist']);
    expect(monthStats(journal.months['2026-01'])).toMatchObject({ net: 1, totalTrades: 3, winRate: 50 });
  });
  it('rejects malformed or incomplete JSON', () => {
    expect(() => parseJournal('{broken')).toThrow('not valid JSON');
    expect(() => parseJournal('{}')).toThrow('Invalid journal format');
    expect(() => parseJournal('null')).toThrow('Invalid journal format');
  });
  it('rejects duplicate IDs, invalid calendar dates, and dates in the wrong month', () => {
    const duplicate = initialState();
    duplicate.sections[0].items[0].id = duplicate.sections[0].id;
    expect(() => parseJournal(JSON.stringify(duplicate))).toThrow('unique');
    const invalid = emptyState();
    invalid.daily['2026-02-30'] = { checked: [], answers: {} };
    expect(() => parseJournal(JSON.stringify(invalid))).toThrow('valid dates');
    const mismatched = emptyState();
    mismatched.months['2026-11'] = { '2026-10-07': { trades: ['1'], notes: '' } };
    expect(() => parseJournal(JSON.stringify(mismatched))).toThrow('containing month');
  });
  it('rejects invalid and infinite RR values', () => {
    for (const value of ['2R', 'Infinity', '1e999']) {
      const journal = emptyState();
      journal.months['2026-11'] = { '2026-11-07': { trades: [value], notes: '' } };
      expect(() => parseJournal(JSON.stringify(journal))).toThrow('numeric strings');
    }
  });
});