const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { create } = require('../lib/notebook-sync.js');
const word = (text, extra = {}) => ({ word: text, translation: 'meaning', collections: ['default'], srs: { reps: 0, due: 123 }, ...extra });
const group = randomUUID();
function server() {
  const records = {};
  const acks = {};
  let queue = Promise.resolve();
  const remote = { records, online: true, lost: false, beforeResponse: null, calls: 0 };
  remote.rpc = (groupId, client, ops) => {
    const run = async () => {
      remote.calls++;
      if (!remote.online) throw new Error('Offline');
      let ack = acks[client] || 0;
      for (const op of ops) {
        if (op.sequence <= ack) continue;
        const id = JSON.stringify([op.kind, op.key]);
        const old = records[id];
        if (!op.seed || !old) records[id] = {
          kind: op.kind, key: op.key, deleted: op.deleted,
          data: op.deleted ? {} : { ...(old && !old.deleted ? old.data : op.entry), ...op.fields },
        };
        ack = op.sequence;
      }
      acks[client] = ack;
      const snapshot = structuredClone({ groupId, records, ack });
      if (remote.beforeResponse) await remote.beforeResponse(ops);
      if (remote.lost && ops.length) { remote.lost = false; throw new Error('Response lost'); }
      return snapshot;
    };
    return queue = queue.then(run, run);
  };
  return remote;
}
function client(remote, initial = {}) {
  const data = structuredClone(initial);
  let queue = Promise.resolve();
  let schedules = 0;
  const lock = (fn) => (queue = queue.then(fn, fn));
  const storage = {
    get: async (keys) => Object.fromEntries((typeof keys === 'string' ? [keys] : keys).filter((k) => data[k] !== undefined).map((k) => [k, structuredClone(data[k])])),
    set: async (value) => Object.assign(data, structuredClone(value)),
  };
  const engine = create({
    storage, lock, rpc: remote.rpc, newId: randomUUID, newSrs: () => ({ reps: 0, due: 456 }),
    schedule: () => { schedules++; },
  });
  return { data, storage, engine, write: (...args) => lock(() => engine.write(...args)), schedules: () => schedules };
}
test('two clients automatically share words and collections, with private review progress', async () => {
  const remote = server();
  const a = client(remote, { vocab: { hello: word('hello') }, collections: { default: { id: 'default', name: 'Group' } } });
  await a.engine.connect(group);
  const b = client(remote, { vocab: { world: word('world') }, collections: { default: { id: 'default', name: 'My Words' } } });
  await b.engine.connect(group); await a.engine.sync();
  assert.deepEqual(Object.keys(a.data.vocab).sort(), ['hello', 'world']);
  assert.equal(b.data.collections.default.name, 'Group');
  assert.equal(b.data.vocab.hello.srs.due, 456);
  assert.equal(a.data.vocab.hello.srs.due, 123);
  const review = structuredClone(a.data.vocab); review.hello.srs.reps++;
  await a.write('vocab', review);
  assert.equal(Object.keys(a.data.syncPending).length, 0);
  assert.equal(remote.records['["vocab","hello"]'].data.srs, undefined);
});
test('concurrent field edits merge, without overwriting other users changes', async () => {
  const remote = server();
  const a = client(remote, { vocab: { hello: word('hello') } }); await a.engine.connect(group);
  const b = client(remote); await b.engine.connect(group);
  await a.write('vocab', { hello: word('hello', { translation: 'translated' }) });
  await b.write('vocab', { hello: word('hello', { definition: 'defined' }) });
  await Promise.all([a.engine.sync(), b.engine.sync()]); await a.engine.sync();
  assert.equal(a.data.vocab.hello.translation, 'translated');
  assert.equal(a.data.vocab.hello.definition, 'defined');
});
test('offline deletes retain an outbox and tombstones block old initial copies', async () => {
  const remote = server(); const a = client(remote, { vocab: { hello: word('hello') } }); await a.engine.connect(group);
  remote.online = false;
  await a.write('vocab', {}); await assert.rejects(a.engine.sync(), /Offline/);
  assert.equal(a.data.syncStatus.state, 'error');
  assert.equal(Object.keys(a.data.syncPending).length, 1);
  assert.ok(a.schedules() > 0);
  remote.online = true; await a.engine.sync();
  const b = client(remote, { vocab: { hello: word('hello') } }); await b.engine.connect(group);
  assert.equal(b.data.vocab.hello, undefined);
  assert.equal(remote.records['["vocab","hello"]'].deleted, true);
});
test('lost response acknowledgments do not replay stale writes', async () => {
  const remote = server(); const a = client(remote, { vocab: { hello: word('hello') } }); await a.engine.connect(group);
  const b = client(remote); await b.engine.connect(group);
  await a.write('vocab', { hello: word('hello', { translation: 'first' }) });
  remote.lost = true; await assert.rejects(a.engine.sync(), /Response lost/);
  await b.write('vocab', { hello: word('hello', { translation: 'second' }) });
  await b.engine.sync(); await a.engine.sync();
  assert.equal(a.data.vocab.hello.translation, 'second');
  assert.equal(Object.keys(a.data.syncPending).length, 0);
});
test('stale page edits preserve remote additions, but cannot resurrect words with SRS alone', async () => {
  const remote = server(); const a = client(remote, { vocab: { hello: word('hello') } }); await a.engine.connect(group);
  const base = structuredClone(a.data.vocab);
  await a.write('vocab', { ...a.data.vocab, world: word('world') });
  const page = structuredClone(base); page.hello.translation = 'page';
  await a.write('vocab', page, base);
  assert.equal(a.data.vocab.world.word, 'world');
  await a.write('vocab', { world: a.data.vocab.world }); await a.engine.sync();
  const review = structuredClone(base); review.hello.srs.reps++;
  await a.write('vocab', review, base);
  assert.equal(a.data.vocab.hello, undefined);
  page.hello.translation = 'intentional recreation';
  await a.write('vocab', page, base); await a.engine.sync();
  assert.equal(remote.records['["vocab","hello"]'].data.translation, 'intentional recreation');
});
test('edits during a response remain queued; restart preserves pending operations', async () => {
  const remote = server(); const a = client(remote, { vocab: { hello: word('hello') } }); await a.engine.connect(group);
  await a.write('vocab', { hello: word('hello', { translation: 'before' }) });
  remote.beforeResponse = async (ops) => {
    if (!ops.length) return;
    remote.beforeResponse = null;
    await a.write('vocab', { hello: word('hello', { translation: 'during' }) });
  };
  await a.engine.sync();
  assert.equal(remote.records['["vocab","hello"]'].data.translation, 'during');
  remote.online = false;
  await a.write('vocab', { hello: word('hello', { translation: 'restart' }) });
  const restarted = client(remote, a.data);
  remote.online = true; await restarted.engine.sync();
  assert.equal(remote.records['["vocab","hello"]'].data.translation, 'restart');
});
test('pause retains local edits, and resuming uploads them; groups cannot be mixed', async () => {
  const remote = server(); const a = client(remote); await a.engine.connect(group);
  await a.engine.pause(); const count = remote.calls;
  await a.write('vocab', { hello: word('hello') }); await a.engine.sync();
  assert.equal(remote.calls, count);
  assert.equal(a.data.syncStatus.state, 'paused');
  await a.engine.connect(group);
  assert.equal(remote.records['["vocab","hello"]'].data.word, 'hello');
  await assert.rejects(a.engine.connect(randomUUID()), /separate Chrome profile/);
});
test('invalid response and entry fail explicitly without replacing the local notebook', async () => {
  const remote = server(); const a = client(remote, { vocab: { hello: word('hello') } });
  await assert.rejects(a.write('vocab', { bad: { word: 123 } }), /Invalid notebook word/);
  remote.records['["vocab","invalid"]'] = { kind: 'vocab', key: 'invalid', deleted: false, data: { word: 'invalid' } };
  await assert.rejects(a.engine.connect(group), /Invalid notebook word/);
  assert.equal(a.data.vocab.hello.word, 'hello');
});
test('large outboxes upload in ordered batches without dropping entries', async () => {
  const remote = server(); const a = client(remote); await a.engine.connect(group);
  const words = Object.fromEntries(Array.from({ length: 1100 }, (_, i) => [`word${i}`, word(`word${i}`)]));
  await a.write('vocab', words); await a.engine.sync();
  assert.equal(Object.keys(remote.records).length, 1100);
  assert.equal(Object.keys(a.data.syncPending).length, 0);
});
test('a stale initial seed cannot undo a concurrent deletion between read and upload', async () => {
  const remote = server();
  const a = client(remote, { vocab: { hello: word('hello') } });
  remote.beforeResponse = async (ops) => {
    if (ops.length) return;
    remote.beforeResponse = null;
    remote.records['["vocab","hello"]'] = { kind: 'vocab', key: 'hello', deleted: true, data: {} };
  };
  await a.engine.connect(group);
  assert.equal(a.data.vocab.hello, undefined);
  assert.equal(Object.keys(a.data.syncPending).length, 0);
});
