import { Check, ChevronDown, Copy, MoreHorizontal, Pencil, Play, Plus, Square, Trash2, X } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { cn } from '@/lib/format';
import { getPineInputs, type PineInputDefinition, type PineInputValue } from '@/pine/runtime';
import { usePineStore } from '@/store/usePineStore';

export function PineEditor() {
  const source = usePineStore((state) => state.source);
  const scripts = usePineStore((state) => state.scripts);
  const selectedScriptId = usePineStore((state) => state.selectedScriptId);
  const inputValues = usePineStore((state) => state.inputValues[state.selectedScriptId]);
  const activeSource = usePineStore((state) => state.activeSource);
  const error = usePineStore((state) => state.error);
  const execution = usePineStore((state) => state.execution);
  const progress = usePineStore((state) => state.progress);
  const deferredSource = useDeferredValue(source);
  const [scriptsOpen, setScriptsOpen] = useState(false);
  const [menuScriptId, setMenuScriptId] = useState<string | null>(null);
  const [renamingScriptId, setRenamingScriptId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const { setSource, setInputValue, selectScript, createScript, renameScript, duplicateScript, deleteScript, run, setError, clear } = usePineStore.getState();
  const parsedInputs = useMemo(() => {
    try {
      return { inputs: getPineInputs(deferredSource), error: null };
    } catch (cause) {
      return { inputs: [], error: cause instanceof Error ? cause.message : String(cause) };
    }
  }, [deferredSource]);

  const execute = () => {
    setError(null);
    run(source);
  };
  const saveRename = (id: string) => {
    renameScript(id, renameValue);
    setRenamingScriptId(null);
  };
  const runningText = progress && progress.totalBars > 0
    ? `Running Pine script · ${Math.round(progress.completedBars / progress.totalBars * 100)}%`
    : 'Running Pine script…';

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 p-2">
      <div className="relative flex shrink-0 items-center gap-1">
        <button
          onClick={() => {
            setScriptsOpen((open) => !open);
            setMenuScriptId(null);
          }}
          aria-expanded={scriptsOpen}
          className="flex max-w-56 items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
        >
          <span className="truncate">{scripts.find((script) => script.id === selectedScriptId)?.name ?? 'Pine Scripts'}</span>
          <ChevronDown size={12} />
        </button>
        <button
          onClick={() => {
            createScript();
            setScriptsOpen(false);
            setMenuScriptId(null);
          }}
          title="Create Pine script"
          aria-label="Create Pine script"
          className="rounded border border-slate-700 p-1 text-slate-300 hover:bg-slate-800"
        >
          <Plus size={13} />
        </button>
        {scriptsOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-72 overflow-y-auto rounded border border-slate-700 bg-[#0f131b] p-1 shadow-xl">
            {scripts.map((script) => (
              <div key={script.id} className="relative">
                <div className="flex items-center gap-1">
                  {renamingScriptId === script.id ? (
                    <form
                      className="flex min-w-0 flex-1 items-center gap-1"
                      onSubmit={(event) => {
                        event.preventDefault();
                        saveRename(script.id);
                      }}
                    >
                      <input
                        autoFocus
                        aria-label="Script name"
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        className="min-w-0 flex-1 rounded bg-slate-900 px-2 py-1 text-[11px] text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button type="submit" aria-label="Save script name" className="rounded p-1 text-emerald-400 hover:bg-slate-800"><Check size={13} /></button>
                      <button type="button" aria-label="Cancel rename" onClick={() => setRenamingScriptId(null)} className="rounded p-1 text-slate-400 hover:bg-slate-800"><X size={13} /></button>
                    </form>
                  ) : (
                    <button
                      onClick={() => {
                        selectScript(script.id);
                        setScriptsOpen(false);
                        setMenuScriptId(null);
                      }}
                      className={cn('min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-[11px] hover:bg-slate-800', selectedScriptId === script.id ? 'text-blue-300' : 'text-slate-300')}
                    >
                      {script.name}
                    </button>
                  )}
                  <button
                    onClick={() => setMenuScriptId((id) => id === script.id ? null : script.id)}
                    aria-label={`Options for ${script.name}`}
                    aria-expanded={menuScriptId === script.id}
                    className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>
                {menuScriptId === script.id && (
                  <div className="ml-2 grid grid-cols-2 gap-1 border-l border-slate-700 py-1 pl-2">
                    <button
                      onClick={() => {
                        selectScript(script.id);
                        setError(null);
                        run(script.source);
                        setScriptsOpen(false);
                        setMenuScriptId(null);
                      }}
                      className="flex items-center gap-1 rounded px-2 py-1 text-left text-[10px] text-slate-300 hover:bg-slate-800"
                    >
                      <Play size={11} /> Run
                    </button>
                    <button
                      onClick={() => {
                        setRenameValue(script.name);
                        setRenamingScriptId(script.id);
                        setMenuScriptId(null);
                      }}
                      className="flex items-center gap-1 rounded px-2 py-1 text-left text-[10px] text-slate-300 hover:bg-slate-800"
                    >
                      <Pencil size={11} /> Rename
                    </button>
                    <button
                      onClick={() => {
                        duplicateScript(script.id);
                        setScriptsOpen(false);
                        setMenuScriptId(null);
                      }}
                      className="flex items-center gap-1 rounded px-2 py-1 text-left text-[10px] text-slate-300 hover:bg-slate-800"
                    >
                      <Copy size={11} /> Duplicate
                    </button>
                    <button
                      disabled={scripts.length <= 1}
                      onClick={() => {
                        deleteScript(script.id);
                        setMenuScriptId(null);
                      }}
                      className="flex items-center gap-1 rounded px-2 py-1 text-left text-[10px] text-rose-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {parsedInputs.inputs.length > 0 && (
        <details open className="shrink-0 rounded border border-slate-800 bg-[#0f131b]">
          <summary className="cursor-pointer px-2 py-1 text-[11px] font-medium text-slate-300">
            Inputs <span className="text-slate-500">({parsedInputs.inputs.length})</span>
          </summary>
          <div className="grid max-h-36 grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2 overflow-y-auto border-t border-slate-800 p-2">
            {parsedInputs.inputs.map((input) => (
              <PineInputControl
                key={input.id}
                input={input}
                value={inputValues?.[input.id] ?? input.defaultValue}
                onChange={(value) => {
                  setInputValue(selectedScriptId, input.id, value);
                  if (activeSource === source) setError(null);
                }}
              />
            ))}
          </div>
        </details>
      )}
      {parsedInputs.error && source.trim() && (
        <div className="shrink-0 truncate text-[10px] text-amber-400" title={parsedInputs.error}>
          Pine inputs unavailable: {parsedInputs.error}
        </div>
      )}
      <div className="flex min-h-0 flex-1 gap-2">
        <textarea
          aria-label="Pine Script editor"
          spellCheck={false}
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setError(null);
          }}
          className="min-h-0 min-w-0 flex-1 resize-none rounded border border-slate-700 bg-[#0b0e14] p-2 font-mono text-[11px] leading-4 text-slate-200 outline-none focus:border-blue-500"
        />
        <div className="flex w-56 shrink-0 flex-col gap-1 text-[10px] leading-4 text-slate-500">
          <div className="font-semibold text-slate-300">Supported Pine v5/v6 subset</div>
          <div>OHLCV, arithmetic, comparisons, ternaries, history offsets, plots, and common constant input defaults</div>
          <div>Custom types and chart points, user-defined methods, mutable arrays, if/else, for/while, switch</div>
          <div>Persistent line/box drawings and label lifecycle · tuple results · common ta/math/str/color APIs</div>
          <div>MTF requests use chart data; labels, tables, shapes, fills, and alerts are not fully rendered or delivered.</div>
          <div>Runs the latest 5,000 bars in a background worker to keep the chart responsive.</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={execute} className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-500">
          <Play size={12} /> Run
        </button>
        <button onClick={clear} disabled={!activeSource} className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40">
          <Square size={11} /> Stop
        </button>
        <span className={cn('min-w-0 truncate text-[10px]', error ? 'text-rose-400' : activeSource ? 'text-emerald-400' : 'text-slate-500')} role="status">
          {error ?? (execution === 'running' ? runningText : activeSource ? 'Running · edits apply when you click Run' : 'Stopped')}
        </span>
      </div>
    </div>
  );
}

function PineInputControl({
  input,
  value,
  onChange,
}: {
  input: PineInputDefinition;
  value: PineInputValue;
  onChange: (value: PineInputValue) => void;
}) {
  const label = (
    <span className="truncate text-[10px] text-slate-400" title={input.group ? `${input.group} · ${input.title}` : input.title}>
      {input.title}
    </span>
  );
  const className = 'w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[11px] text-slate-200 outline-none focus:border-blue-500';

  if (input.type === 'bool') {
    return (
      <label className="flex min-w-0 items-center gap-1.5">
        <input
          type="checkbox"
          aria-label={input.title}
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="accent-blue-500"
        />
        {label}
      </label>
    );
  }

  const options = input.options;
  if ((input.type === 'string' || input.type === 'timeframe') && options?.length) {
    return (
      <label className="flex min-w-0 flex-col gap-0.5">
        {label}
        <select aria-label={input.title} value={String(value)} onChange={(event) => onChange(event.target.value)} className={className}>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }
  if (input.type === 'int' || input.type === 'float') {
    return (
      <label className="flex min-w-0 flex-col gap-0.5">
        {label}
        <input
          type="number"
          aria-label={input.title}
          value={String(value)}
          min={input.min}
          max={input.max}
          step={input.type === 'int' ? 1 : 'any'}
          onChange={(event) => {
            if (event.target.value === '') return;
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          className={className}
        />
      </label>
    );
  }
  if (input.type === 'color' && typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)) {
    return (
      <label className="flex min-w-0 flex-col gap-0.5">
        {label}
        <input
          type="color"
          aria-label={input.title}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-0.5"
        />
      </label>
    );
  }
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      {label}
      <input
        type="text"
        aria-label={input.title}
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      />
    </label>
  );
}
