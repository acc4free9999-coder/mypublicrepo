(function (g) {
  const kinds = ['vocab', 'collections'];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const idOf = (kind, key) => JSON.stringify([kind, key]);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function shared(kind, entry) {
    const data = structuredClone(entry);
    if (kind === 'vocab') {
      delete data.srs;
      data.collections ??= ['default'];
    }
    return data;
  }
  function validateEntry(kind, key, data) {
    if (!kinds.includes(kind) || typeof key !== 'string' || !key || ['__proto__', 'constructor', 'prototype'].includes(key) ||
        !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid notebook entry.');
    if (kind === 'collections') {
      if (data.id !== key || typeof data.name !== 'string') throw new Error('Invalid notebook collection.');
    } else {
      if (typeof data.word !== 'string' || !Array.isArray(data.collections) ||
          data.collections.some((id) => typeof id !== 'string')) throw new Error('Invalid notebook word.');
      for (const field of ['phonetic', 'translation', 'definition', 'context', 'url', 'title']) {
        if (data[field] != null && typeof data[field] !== 'string') throw new Error(`Invalid notebook ${field}.`);
      }
    }
  }
  function validate(snapshot, group) {
    if (!snapshot || snapshot.groupId !== group || !Number.isSafeInteger(snapshot.ack) || snapshot.ack < 0 ||
        !snapshot.records || typeof snapshot.records !== 'object' || Array.isArray(snapshot.records)) {
      throw new Error('Invalid shared notebook response. Local changes were retained.');
    }
    for (const [id, record] of Object.entries(snapshot.records)) {
      if (!record || !kinds.includes(record.kind) || typeof record.key !== 'string' || !record.key ||
          ['__proto__', 'constructor', 'prototype'].includes(record.key) ||
          typeof record.deleted !== 'boolean' || id !== idOf(record.kind, record.key)) throw new Error('Invalid shared notebook record.');
      if (!record.deleted) validateEntry(record.kind, record.key, record.data);
    }
  }
  function create({ storage, lock, rpc, newId, newSrs, schedule }) {
    let running;
    const status = (state, error = '') => storage.set({ syncStatus: { state, error, time: Date.now() } });
    async function write(kind, data, base) {
      if (!kinds.includes(kind) || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid notebook update.');
      for (const [key, entry] of Object.entries(data)) validateEntry(kind, key, shared(kind, entry));
      const stored = await storage.get([kind, 'syncPending', 'syncSequence', 'syncClient']);
      const old = stored[kind] || {};
      const desired = base ? structuredClone(old) : structuredClone(data);
      if (base) {
        for (const key of new Set([...Object.keys(base), ...Object.keys(data)])) {
          if (same(base[key], data[key])) continue;
          if (!own(data, key)) { delete desired[key]; continue; }
          const before = base[key] ? shared(kind, base[key]) : {};
          const after = shared(kind, data[key]);
          if (!own(old, key) && own(base, key) && same(before, after)) continue;
          desired[key] = { ...(old[key] || data[key]) };
          for (const field of new Set([...Object.keys(base[key] || {}), ...Object.keys(data[key])])) {
            if (!same(base[key]?.[field], data[key][field])) {
              if (own(data[key], field)) desired[key][field] = data[key][field];
              else delete desired[key][field];
            }
          }
        }
      }
      const pending = stored.syncPending || {};
      let sequence = stored.syncSequence || 0;
      for (const key of new Set([...Object.keys(old), ...Object.keys(desired)])) {
        const id = idOf(kind, key);
        if (!own(desired, key)) {
          if (own(old, key)) pending[id] = { kind, key, deleted: true, fields: {}, sequence: ++sequence };
          continue;
        }
        const before = old[key] ? shared(kind, old[key]) : {};
        const after = shared(kind, desired[key]);
        const fields = {};
        for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
          if (!same(before[field], after[field])) fields[field] = after[field] ?? null;
        }
        if (Object.keys(fields).length) pending[id] = {
          kind, key, deleted: false, fields: { ...(pending[id]?.deleted ? {} : pending[id]?.fields), ...fields },
          entry: after, sequence: ++sequence,
        };
      }
      await storage.set({
        [kind]: desired, syncPending: pending, syncSequence: sequence, syncClient: stored.syncClient || newId(),
      });
      if (Object.keys(pending).length) schedule();
    }
    async function merge(snapshot, group) {
      validate(snapshot, group);
      await lock(async () => {
        const stored = await storage.get(['vocab', 'collections', 'syncPending', 'syncSequence', 'syncClient', 'syncSeeded']);
        const pending = stored.syncPending || {};
        let sequence = stored.syncSequence || 0;
        for (const [id, op] of Object.entries(pending)) if (op.sequence <= snapshot.ack) delete pending[id];
        if (!stored.syncSeeded) {
          for (const kind of kinds) for (const [key, data] of Object.entries(stored[kind] || {})) {
            const id = idOf(kind, key);
            if (!own(snapshot.records, id) && !own(pending, id)) pending[id] = {
              kind, key, deleted: false, fields: shared(kind, data), seed: true, sequence: ++sequence,
            };
          }
        }
        const merged = { vocab: {}, collections: {} };
        for (const record of Object.values(snapshot.records)) {
          if (!record.deleted) merged[record.kind][record.key] = shared(record.kind, record.data);
        }
        for (const op of Object.values(pending)) {
          if (op.deleted) delete merged[op.kind][op.key];
          else merged[op.kind][op.key] = {
            ...(merged[op.kind][op.key] || op.entry), ...op.fields,
          };
        }
        for (const [key, data] of Object.entries(merged.vocab)) data.srs = stored.vocab?.[key]?.srs || newSrs();
        await storage.set({
          ...merged, syncPending: pending, syncSequence: sequence, syncClient: stored.syncClient || newId(), syncSeeded: true,
        });
      });
    }
    function sync() {
      if (running) return running;
      running = (async () => {
        const { syncGroup: group, syncEnabled } = await storage.get(['syncGroup', 'syncEnabled']);
        if (!group || !syncEnabled) return;
        await status('syncing');
        try {
          const client = await lock(async () => {
            const { syncClient } = await storage.get('syncClient');
            if (syncClient) return syncClient;
            const id = newId();
            await storage.set({ syncClient: id });
            return id;
          });
          await merge(await rpc(group, client, []), group);
          for (let attempt = 0; attempt < 10; attempt++) {
            const { syncPending = {}, syncEnabled: enabled } = await storage.get(['syncPending', 'syncEnabled']);
            if (!enabled) return;
            const operations = Object.values(syncPending).sort((a, b) => a.sequence - b.sequence).slice(0, 500);
            if (!operations.length) { await status('synced'); return; }
            await merge(await rpc(group, client, operations), group);
          }
          await status('pending');
          schedule();
        } catch (err) { await status('error', err.message); throw err; }
      })().finally(() => { running = null; });
      return running;
    }
    async function pause() {
      await storage.set({ syncEnabled: false });
      if (running) await Promise.allSettled([running]);
      await status('paused');
    }
    async function connect(group) {
      const { syncGroup: old } = await storage.get('syncGroup');
      if (old && old !== group) throw new Error('Use a separate Chrome profile for a different notebook to avoid mixing data.');
      await storage.set({ syncGroup: group, syncEnabled: true });
      await sync();
    }
    return { write, sync, pause, connect };
  }
  g.NotebookSync = { create, validate };
  if (typeof module !== 'undefined') module.exports = g.NotebookSync;
})(globalThis);
