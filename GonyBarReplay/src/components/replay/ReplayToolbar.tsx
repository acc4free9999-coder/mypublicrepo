import { History, Pause, Play, RotateCcw, Scissors, Shuffle, SkipForward, Square } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn, fmtTime } from '@/lib/format';
import { useTimeZone } from '@/store/useDisplayStore';
import { hasData, isReplayActive, stopReplay, useTradingStore } from '@/store/useTradingStore';
import { REPLAY_SPEEDS } from '@/types';

export function ReplayToolbar() {
  const replay = useTradingStore((s) => s.replay);
  const base = useTradingStore((s) => s.base);
  useTimeZone();
  const ready = useTradingStore(hasData);
  const a = useTradingStore.getState();

  if (replay.status === 'off') {
    return (
      <Bar>
        <Btn onClick={a.enterReplay} disabled={!ready} title="Start bar replay" variant="primary"><History size={15} /> Replay</Btn>
        <Btn onClick={a.randomCutoff} disabled={!ready} title="Start replay from a random bar"><Shuffle size={15} /> Random bar</Btn>
        <span className="ml-2 text-xs text-slate-500">{ready ? 'Pick a historical bar to hide the future and paper-trade it candle by candle.' : 'Fetch or import market data to start a replay.'}</span>
      </Bar>
    );
  }

  const active = isReplayActive(replay.status);
  const playing = replay.status === 'playing';
  const start = replay.cutoffIndex ?? replay.cursor;
  const progress = active ? (replay.cursor - start) / Math.max(1, base.length - 1 - start) : 0;

  return (
    <Bar>
      <span className="mr-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-400"><History size={14} /> Replay</span>
      <Btn onClick={a.enterReplay} title="Select a new starting bar" active={replay.status === 'selecting'}><Scissors size={15} /> Select bar</Btn>
      <Btn onClick={a.randomCutoff} title="Jump to a random bar"><Shuffle size={15} /></Btn>
      <Sep />
      <Btn onClick={a.togglePlay} disabled={!active || replay.status === 'ended'} title={playing ? 'Pause (Space)' : 'Play (Space)'} variant="primary">
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </Btn>
      <Btn onClick={() => { a.pause(); a.stepForward(); }} disabled={!active || replay.status === 'ended'} title="Step forward 1 candle (→)"><SkipForward size={15} /></Btn>
      <Btn onClick={a.resetReplay} disabled={replay.cutoffIndex == null} title="Reset to starting bar (clears paper trades)"><RotateCcw size={15} /></Btn>
      <div className="flex overflow-hidden rounded-md border border-slate-700">
        {REPLAY_SPEEDS.map((sp) => (
          <button key={sp} onClick={() => a.setSpeed(sp)} className={cn('px-2 py-1 text-xs', sp === replay.speed ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800')}>
            {sp}x
          </button>
        ))}
      </div>
      <Sep />
      {active && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono text-slate-200">{fmtTime(base[replay.cursor].time)}</span>
          <div className="h-1.5 w-28 overflow-hidden rounded bg-slate-800"><div className="h-full bg-blue-500" style={{ width: `${progress * 100}%` }} /></div>
          {replay.status === 'ended' && <span className="text-amber-400">End of data</span>}
        </div>
      )}
      <div className="flex-1 !shrink" />
      <Btn onClick={() => stopReplay()} title="Stop replay and show the latest data (clears paper trades)" variant="danger"><Square size={13} fill="currentColor" /> Stop replay</Btn>
    </Bar>
  );
}

const Bar = ({ children }: { children: ReactNode }) => (
  <div className="flex h-11 shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap border-t border-slate-800 bg-[#0f131b] px-3 [&>*]:shrink-0">{children}</div>
);
const Sep = () => <div className="mx-1 h-5 w-px bg-slate-700" />;

function Btn({ children, onClick, title, disabled, active, variant }: { children: ReactNode; onClick: () => void; title: string; disabled?: boolean; active?: boolean; variant?: 'primary' | 'danger' }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-500' : variant === 'danger' ? 'border border-rose-700/70 text-rose-300 hover:bg-rose-600 hover:text-white' : 'text-slate-300 hover:bg-slate-800',
        active && 'bg-slate-800 ring-1 ring-blue-500',
      )}
    >
      {children}
    </button>
  );
}
