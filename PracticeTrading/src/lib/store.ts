import { useEffect, useState } from 'react';
import { z } from 'zod';

const itemSchema = z.object({ id: z.string(), name: z.string() });
const questionSchema = z.object({ id: z.string(), name: z.string(), type: z.enum(['text', 'checklist']), options: z.array(itemSchema) });
const sectionSchema = z.object({ id: z.string(), name: z.string(), items: z.array(itemSchema) });
const questionSectionSchema = z.object({ id: z.string(), name: z.string(), questions: z.array(questionSchema) });
const stateSchema = z.object({
  sections: z.array(sectionSchema), questionSections: z.array(questionSectionSchema),
  daily: z.record(z.string(), z.object({ checked: z.array(z.string()), answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])) })),
  months: z.record(z.string(), z.record(z.string(), z.object({ trades: z.array(z.string()), notes: z.string() }))),
});
export type AppState = z.infer<typeof stateSchema>;
export type ChecklistSection = AppState['sections'][number];
export type QuestionSection = AppState['questionSections'][number];
export type Question = QuestionSection['questions'][number];
export const uid = () => crypto.randomUUID();
const STORAGE_KEY = 'edgebook-journal-v1';
export function emptyState(): AppState { return { sections: [], questionSections: [], daily: {}, months: {} }; }
export function initialState(): AppState {
  return {
    ...emptyState(),
    sections: [
      { id: 'pre', name: 'Pre-trading checklist', items: ['Check high-impact news', 'Identify higher timeframe bias', 'Identify market condition', 'Mark key support & resistance', 'Identify liquidity zones', 'Define entry, stop loss & take profit', 'Calculate risk before entering'].map((name, index) => ({ id: `pre-${index}`, name })) },
      { id: 'mind', name: 'Trading psychology', items: ['Am I calm and focused?', 'Am I being patient?', 'Am I following my trading plan?', 'Am I avoiding FOMO?', 'Am I accepting the possibility of a loss?'].map((name, index) => ({ id: `mind-${index}`, name })) },
      { id: 'post', name: 'Post-trading review', items: ['Record trading result', 'Take chart screenshots', 'Record my emotions', 'Review whether I followed my rules'].map((name, index) => ({ id: `post-${index}`, name })) },
    ],
    questionSections: [{ id: 'plan', name: 'The daily game plan', questions: [
      { id: 'bias', name: "What is today's market bias?", type: 'text', options: [] },
      { id: 'setup', name: 'What is the main trading setup?', type: 'text', options: [] },
      { id: 'condition', name: 'What is the current market condition?', type: 'checklist', options: ['Strong Uptrend', 'Strong Downtrend', 'Sideway', 'Transition'].map((name, index) => ({ id: `condition-${index}`, name })) },
      { id: 'lesson', name: 'What did I learn today?', type: 'text', options: [] },
    ] }],
  };
}
function load() {
  let rawBackup: string | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    rawBackup = raw;
    if (!raw) return { state: initialState(), error: '', rawBackup };
    const result = stateSchema.safeParse(JSON.parse(raw));
    if (!result.success) return { state: emptyState(), error: 'Saved data could not be read. Export a backup in Settings before clearing or reloading.', rawBackup };
    return { state: result.data, error: '', rawBackup };
  } catch { return { state: emptyState(), error: 'Local storage is unavailable or unreadable. Your changes cannot be saved.', rawBackup }; }
}
export function useJournal() {
  const [loaded] = useState(load);
  const [state, setState] = useState(loaded.state);
  const [readError, setReadError] = useState(loaded.error);
  const [saveError, setSaveError] = useState(loaded.error);
  useEffect(() => {
    if (readError) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setSaveError(''); }
    catch { setSaveError('Could not save your changes. Storage may be full or blocked. Export a backup in Settings.'); }
  }, [state, readError]);
  const resetState = () => { setReadError(''); setState(emptyState()); };
  const exportData = () => readError && loaded.rawBackup !== null ? loaded.rawBackup : JSON.stringify(state, null, 2);
  return { state, setState, saveError, resetState, exportData };
}