import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SESSION_COLORS, SESSION_PRESETS, type SessionColors, type SessionRange } from '@/lib/sessions';
import { isValidZone, LOCAL_ZONE, setDisplayZone, type TimeZoneId } from '@/lib/time';

export interface DisplayStore {
  /** Zone used for the time axis, crosshair and every time shown in the app. */
  timeZone: TimeZoneId;
  sessionColors: SessionColors;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  setTimeZone: (zone: TimeZoneId) => void;
  setSessionColorsEnabled: (enabled: boolean) => void;
  updateRange: (id: string, patch: Partial<SessionRange>) => void;
  addRange: () => void;
  removeRange: (id: string) => void;
  moveRange: (id: string, dir: -1 | 1) => void;
  resetRanges: () => void;
}

let seq = 0;
const newId = () => `ses-${Date.now().toString(36)}-${(++seq).toString(36)}`;
const PALETTE: [string, string][] = [
  ['#80deea', '#5c6bc0'],
  ['#ffcc80', '#8d6e63'],
  ['#b39ddb', '#ef9a9a'],
  ['#a5d6a7', '#ce93d8'],
];

const setRanges = (s: DisplayStore, ranges: SessionRange[]) => ({ sessionColors: { ...s.sessionColors, ranges } });

export const useDisplayStore = create<DisplayStore>()(
  persist(
    (set) => ({
      timeZone: LOCAL_ZONE,
      sessionColors: DEFAULT_SESSION_COLORS,
      settingsOpen: false,
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setTimeZone: (zone) => set({ timeZone: isValidZone(zone) ? zone : 'UTC' }),
      setSessionColorsEnabled: (enabled) => set((s) => ({ sessionColors: { ...s.sessionColors, enabled } })),
      updateRange: (id, patch) => set((s) => setRanges(s, s.sessionColors.ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)))),
      addRange: () =>
        set((s) => {
          const [upColor, downColor] = PALETTE[s.sessionColors.ranges.length % PALETTE.length];
          const range: SessionRange = { id: newId(), name: `Range ${s.sessionColors.ranges.length + 1}`, enabled: true, start: '00:00', end: '06:00', zone: 'chart', upColor, downColor };
          return { sessionColors: { enabled: true, ranges: [...s.sessionColors.ranges, range] } };
        }),
      removeRange: (id) => set((s) => setRanges(s, s.sessionColors.ranges.filter((r) => r.id !== id))),
      moveRange: (id, dir) =>
        set((s) => {
          const list = [...s.sessionColors.ranges];
          const i = list.findIndex((r) => r.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= list.length) return {};
          [list[i], list[j]] = [list[j], list[i]];
          return setRanges(s, list);
        }),
      resetRanges: () => set((s) => setRanges(s, SESSION_PRESETS.map((r) => ({ ...r })))),
    }),
    {
      name: 'gony-bar-replay:display',
      partialize: (s) => ({ timeZone: s.timeZone, sessionColors: s.sessionColors }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DisplayStore>;
        return {
          ...current,
          timeZone: p.timeZone && isValidZone(p.timeZone) ? p.timeZone : current.timeZone,
          sessionColors: p.sessionColors?.ranges ? p.sessionColors : current.sessionColors,
        };
      },
    },
  ),
);

setDisplayZone(useDisplayStore.getState().timeZone);
useDisplayStore.subscribe((s, prev) => {
  if (s.timeZone !== prev.timeZone) setDisplayZone(s.timeZone);
});

/** Subscribe a component to time-zone changes so its formatted times re-render. */
export const useTimeZone = () => useDisplayStore((s) => s.timeZone);
