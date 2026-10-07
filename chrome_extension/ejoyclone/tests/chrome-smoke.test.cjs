const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('Chrome sign-in, private credential storage and automatic notebook syncing', {
  skip: !process.env.CHROME_BINARY, timeout: 60000,
}, async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'droplet-supabase-smoke-'));
  const website = createServer((_request, response) => response.end('<!doctype html><title>Content script test</title><p>Test page</p>'));
  await new Promise((resolve) => website.listen(0, '127.0.0.1', resolve));
  const extension = path.resolve(__dirname, '..');
  const chrome = spawn(process.env.CHROME_BINARY, [
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
    `--load-extension=${extension}`, `--disable-extensions-except=${extension}`, 'about:blank',
  ], { stdio: 'ignore' });
  let socket;
  try {
    let address;
    for (let attempt = 0; attempt < 100 && !address; attempt++) {
      try {
        const [port, endpoint] = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n');
        address = `ws://127.0.0.1:${port}${endpoint}`;
      } catch (err) { if (err.code !== 'ENOENT') throw err; await delay(100); }
    }
    assert.ok(address, 'Chrome debugging endpoint started');
    socket = new WebSocket(address);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0;
    const pending = new Map(), errors = [];
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
    };
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++sequence; pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
    const evaluate = async (sessionId, expression) => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const wait = async (sessionId, expression) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate(sessionId, expression)) return;
        await delay(100);
      }
      assert.fail(`Timed out: ${expression}`);
    };
    let worker;
    for (let attempt = 0; attempt < 100 && !worker; attempt++) {
      worker = (await send('Target.getTargets')).targetInfos.find((t) => t.type === 'service_worker' && t.url.startsWith('chrome-extension://'));
      if (!worker) await delay(100);
    }
    assert.ok(worker, 'Service worker loaded');
    const { sessionId: background } = await send('Target.attachToTarget', { targetId: worker.targetId, flatten: true });
    await send('Runtime.enable', {}, background);
    await evaluate(background, `(() => {
      SUPABASE_CONFIG.url = 'https://smoke.supabase.co';
      SUPABASE_CONFIG.publishableKey = 'sb_publishable_public';
      globalThis.remoteNotebook = {records:{},acks:{},calls:0};
      globalThis.testGroup = '11111111-1111-4111-8111-111111111111';
      backfillPronunciations = async () => 0;
      globalThis.fetch = async (url, options) => {
        const body = options.body ? JSON.parse(options.body) : {};
        const response = (data, status=200) => new Response(JSON.stringify(data), {status});
        if (url.includes('/auth/v1/token')) return response({
          access_token:'mock-access',refresh_token:'mock-refresh',expires_in:3600,
          user:{id:'22222222-2222-4222-8222-222222222222',email:'owner@example.com'}
        });
        if (url.includes('/auth/v1/logout')) return new Response(null,{status:204});
        if (url.includes('create_notebook')) return response(testGroup);
        if (url.includes('join_notebook')) return response({message:'A verified email and matching invitation are required'},403);
        if (url.includes('list_notebooks')) return response([{id:testGroup,name:'Smoke notebook',owner:true}]);
        if (url.includes('sync_notebook')) {
          if (options.headers.Authorization !== 'Bearer mock-access') return response({message:'Unauthenticated'},401);
          remoteNotebook.calls++;
          let ack = remoteNotebook.acks[body.p_client] || 0;
          for (const op of body.p_operations) {
            if (op.sequence <= ack) continue;
            const id = JSON.stringify([op.kind,op.key]), old = remoteNotebook.records[id];
            if (!op.seed || !old) remoteNotebook.records[id] = {
              kind:op.kind,key:op.key,deleted:op.deleted,
              data:op.deleted ? {} : {...(old && !old.deleted ? old.data : op.entry),...op.fields}
            };
            ack = op.sequence;
          }
          remoteNotebook.acks[body.p_client] = ack;
          return response({groupId:testGroup,records:remoteNotebook.records,ack});
        }
        return response({message:'Unexpected mock request: '+url},400);
      };
    })()`);
    const origin = `chrome-extension://${new URL(worker.url).host}`;
    const { targetId } = await send('Target.createTarget', { url: `${origin}/vocab/vocab.html#settings` });
    const { sessionId: page } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, page);
    await wait(page, `Boolean(document.querySelector('#syncStatus')?.textContent.includes('Not connected'))`);
    await evaluate(page, `(() => {
      const form = document.querySelector('#syncAuth');
      form.elements.email.value = 'owner@example.com';
      form.elements.password.value = 'password123';
      form.requestSubmit();
    })()`);
    await wait(page, `document.querySelector('#syncEmail').textContent === 'owner@example.com'`);
    assert.equal(await evaluate(page, `document.querySelector('#syncAuth').elements.password.value`), '');
    await evaluate(page, `(async () => {
      const words = await EJ.getVocab();
      words.hello = {word:'hello',translation:'test',collections:['default'],pronChecked:true,srs:EJ.newSrs()};
      await EJ.setVocab(words);
      await EJ.send({type:'syncCreate',name:'Smoke notebook'});
    })()`);
    await wait(page, `document.querySelector('#syncStatus').textContent.includes('Automatically synced')`);
    assert.equal(await evaluate(background, `remoteNotebook.records['["vocab","hello"]'].data.word`), 'hello');
    await evaluate(page, `EJ.send({type:'syncJoin',group:'11111111-1111-4111-8111-111111111111'})`);
    await evaluate(page, `(async () => {
      const words = await EJ.getVocab();
      words.automatic = {word:'automatic',translation:'auto',collections:['default'],pronChecked:true,srs:EJ.newSrs()};
      await EJ.setVocab(words);
    })()`);
    await wait(background, `Boolean(remoteNotebook.records['["vocab","automatic"]'])`);
    assert.equal(await evaluate(background, `remoteNotebook.records['["vocab","automatic"]'].data.srs`), undefined);
    await evaluate(page, `(() => {
      const input = document.querySelector('#importCsv'), transfer = new DataTransfer();
      transfer.items.add(new File(['word,translation,collections\\ncsvword,csv meaning,Imported collection\\n'], 'vocabulary.csv', {type:'text/csv'}));
      input.files = transfer.files;
      window.alert = () => {};
      input.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    await wait(background, `Boolean(remoteNotebook.records['["vocab","csvword"]'])`);
    assert.equal(await evaluate(background, `remoteNotebook.records['["vocab","csvword"]'].data.translation`), 'csv meaning');
    assert.equal(await evaluate(background, `Object.values(remoteNotebook.records).some(r=>r.kind==='collections' && r.data.name==='Imported collection')`), true);
    const callsBeforeReview = await evaluate(background, 'remoteNotebook.calls');
    await evaluate(page, `(async () => {
      const words = await EJ.getVocab();
      words.automatic.srs.reps = 5;
      await EJ.setVocab(words);
    })()`);
    await delay(700);
    assert.equal(await evaluate(background, 'remoteNotebook.calls'), callsBeforeReview, 'SRS-only changes do not schedule an upload');
    await evaluate(background, `(async () => {
      remoteNotebook.records['["vocab","hello"]'].deleted = true;
      remoteNotebook.records['["vocab","hello"]'].data = {};
      await chrome.alarms.create('supabase-smoke',{when:Date.now()+100});
    })()`);
    await wait(page, `(async () => !(await EJ.getVocab()).hello)()`);
    await evaluate(page, `(async () => {
      await EJ.send({type:'syncPause'});
      const words = await EJ.getVocab();
      delete words.automatic;
      await EJ.setVocab(words);
    })()`);
    await delay(700);
    assert.equal(await evaluate(background, `remoteNotebook.records['["vocab","automatic"]'].deleted`), false);
    await evaluate(page, `EJ.send({type:'syncResume'})`);
    assert.equal(await evaluate(background, `remoteNotebook.records['["vocab","automatic"]'].deleted`), true);
    const stored = await evaluate(page, `chrome.storage.local.get(null)`);
    assert.equal(JSON.stringify(stored).includes('mock-access'), false, 'Access tokens are absent from chrome.storage');
    assert.equal(JSON.stringify(stored).includes('mock-refresh'), false, 'Refresh tokens are absent from chrome.storage');
    const { targetId: contentTarget } = await send('Target.createTarget', { url: `http://127.0.0.1:${website.address().port}/` });
    const { sessionId: content } = await send('Target.attachToTarget', { targetId: contentTarget, flatten: true });
    const worlds = [];
    const previousMessage = socket.onmessage;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.sessionId === content && message.method === 'Runtime.executionContextCreated') worlds.push(message.params.context);
      previousMessage(event);
    };
    await send('Runtime.enable', {}, content);
    let isolated;
    for (let attempt = 0; attempt < 100 && !isolated; attempt++) {
      isolated = worlds.find((world) => world.origin === origin && world.auxData?.type === 'isolated');
      if (!isolated) await delay(100);
    }
    assert.ok(isolated, 'Content script isolated world loaded');
    const denied = await send('Runtime.evaluate', {
      expression: `chrome.runtime.sendMessage({type:'syncInfo'})`, contextId: isolated.id,
      awaitPromise: true, returnByValue: true,
    }, content);
    assert.equal(denied.result.value.ok, false);
    assert.match(denied.result.value.error, /only available from extension pages/);
    await evaluate(page, `EJ.send({type:'syncSignOut'})`);
    const info = await evaluate(page, `EJ.send({type:'syncInfo'})`);
    assert.equal(info.email, '');
    assert.equal(info.enabled, false);
    assert.deepEqual(errors, []);
  } finally {
    socket?.close();
    chrome.kill('SIGTERM');
    await new Promise((resolve) => chrome.exitCode !== null ? resolve() : chrome.once('exit', resolve));
    await new Promise((resolve) => website.close(resolve));
    await rm(profile, { recursive: true, force: true });
  }
});
