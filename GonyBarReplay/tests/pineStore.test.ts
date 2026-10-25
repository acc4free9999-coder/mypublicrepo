import { beforeEach, describe, expect, it } from 'vitest';
import { usePineStore } from '@/store/usePineStore';

const initialScript = { id: 'test-script', name: 'Test script', source: 'plot(close)' };

describe('Pine script store', () => {
  beforeEach(() => {
    usePineStore.setState({
      source: initialScript.source,
      scripts: [initialScript],
      selectedScriptId: initialScript.id,
      activeSource: null,
      error: null,
      execution: 'idle',
      progress: null,
    });
  });

  it('keeps edits with the selected script and restores them on selection', () => {
    const store = usePineStore.getState();
    store.createScript();
    const secondId = usePineStore.getState().selectedScriptId;
    usePineStore.getState().setSource('plot(high)');

    usePineStore.getState().selectScript(initialScript.id);
    expect(usePineStore.getState().source).toBe(initialScript.source);
    usePineStore.getState().selectScript(secondId);
    expect(usePineStore.getState().source).toBe('plot(high)');
  });

  it('renames and duplicates a script with its source', () => {
    usePineStore.getState().renameScript(initialScript.id, 'Renamed');
    usePineStore.getState().duplicateScript(initialScript.id);

    const { scripts, selectedScriptId, source } = usePineStore.getState();
    expect(scripts).toHaveLength(2);
    expect(scripts[1]).toMatchObject({ name: 'Renamed copy', source: initialScript.source });
    expect(selectedScriptId).toBe(scripts[1].id);
    expect(source).toBe(initialScript.source);
  });

  it('deletes the selected script and selects another saved script', () => {
    usePineStore.getState().createScript();
    const createdId = usePineStore.getState().selectedScriptId;

    usePineStore.getState().deleteScript(createdId);

    expect(usePineStore.getState().selectedScriptId).toBe(initialScript.id);
    expect(usePineStore.getState().source).toBe(initialScript.source);
    expect(usePineStore.getState().scripts).toHaveLength(1);
  });

  it('keeps input values isolated per saved script', () => {
    usePineStore.getState().setInputValue(initialScript.id, 'length', 14);
    usePineStore.getState().createScript();
    const secondId = usePineStore.getState().selectedScriptId;
    usePineStore.getState().setInputValue(secondId, 'length', 5);

    expect(usePineStore.getState().inputValues).toEqual({
      [initialScript.id]: { length: 14 },
      [secondId]: { length: 5 },
    });
  });
});
