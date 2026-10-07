(function (g) {
  function credentials() {
    let database;
    function open() {
      database ||= new Promise((resolve, reject) => {
        const request = indexedDB.open('droplet-private-auth', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('session');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Authentication database is blocked. Close other extension pages and retry.'));
      });
      return database;
    }
    async function transact(mode, action) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('session', mode);
        const request = action(transaction.objectStore('session'));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Authentication storage was interrupted.'));
      });
    }
    return {
      get: () => transact('readonly', (store) => store.get('supabase')),
      set: (value) => transact('readwrite', (store) => store.put(value, 'supabase')),
      clear: () => transact('readwrite', (store) => store.delete('supabase')),
    };
  }
  let engine, api, timer;
  let management = Promise.resolve();
  const manage = (fn) => (management = management.then(fn, fn));
  const report = (err) => console.error('Supabase sync:', err.message);
  const uuid = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => engine.sync().catch(report), 500);
    chrome.alarms.create('supabase-soon', { when: Date.now() + 1500 }).catch(report);
  }
  async function info() {
    const stored = await chrome.storage.local.get(['syncGroup', 'syncEnabled', 'syncStatus', 'syncPending', 'syncGroupName']);
    let setupError = '';
    try { api.configured(); } catch (err) { setupError = err.message; }
    const user = await api.user();
    return {
      email: user?.email || '', group: stored.syncGroup || '', name: stored.syncGroupName || '',
      enabled: Boolean(stored.syncEnabled), status: stored.syncStatus || {}, pending: Object.keys(stored.syncPending || {}).length, setupError,
    };
  }
  async function connect(group) {
    if (!uuid(group)) throw new Error('Enter a valid notebook ID from its owner.');
    const { syncGroup } = await chrome.storage.local.get('syncGroup');
    if (syncGroup && syncGroup !== group) throw new Error('Use a separate Chrome profile for a different notebook.');
    let groups = await api.rpc('list_notebooks');
    let notebook = groups.find((item) => item.id === group);
    if (!notebook) {
      await api.rpc('join_notebook', { p_group: group });
      groups = await api.rpc('list_notebooks');
      notebook = groups.find((item) => item.id === group);
    }
    if (!notebook) throw new Error('Notebook membership was not returned.');
    await chrome.storage.local.set({ syncGroupName: notebook.name });
    await engine.connect(group);
    return info();
  }
  function email(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Enter a valid email address.');
    return normalized;
  }
  g.SharedSync = {
    init(lock) {
      api = SupabaseApi.create({ config: g.SUPABASE_CONFIG, vault: credentials(), fetch: (...args) => fetch(...args) });
      engine = NotebookSync.create({
        storage: chrome.storage.local, lock, newId: () => crypto.randomUUID(), newSrs: () => EJ.newSrs(), schedule,
        rpc: (group, client, operations) => api.rpc('sync_notebook', { p_group: group, p_client: client, p_operations: operations }),
      });
      Object.assign(g.SharedSync, {
        write: engine.write, info,
        signIn: (m) => manage(async () => {
          if (typeof m.password !== 'string' || !m.password) throw new Error('Enter your password.');
          const result = await api.signIn(email(m.email), m.password);
          const { syncUser } = await chrome.storage.local.get('syncUser');
          if (syncUser && syncUser !== result.user.id) throw new Error('Use a separate Chrome profile for a different account. Your local data and pending changes belong to the previous account.');
          await engine.pause();
          await api.save(result);
          await chrome.storage.local.set({ syncUser: result.user.id });
          const { syncGroup } = await chrome.storage.local.get('syncGroup');
          if (syncGroup) await engine.connect(syncGroup);
          return info();
        }),
        signUp: (m) => manage(async () => {
          if (typeof m.password !== 'string' || m.password.length < 8) throw new Error('Use a password with at least 8 characters.');
          await api.signUp(email(m.email), m.password);
          return 'Check your email to confirm the account, then sign in. If it already exists, sign in instead.';
        }),
        signOut: () => manage(async () => {
          await engine.pause();
          await api.signOut();
          return info();
        }),
        pause: () => manage(async () => { await engine.pause(); return info(); }),
        resume: () => manage(async () => {
          const { syncGroup } = await chrome.storage.local.get('syncGroup');
          if (!syncGroup) throw new Error('Create or join a notebook first.');
          await engine.connect(syncGroup);
          return info();
        }),
        groups: () => manage(() => api.rpc('list_notebooks')),
        create: (m) => manage(async () => {
          const { syncGroup } = await chrome.storage.local.get('syncGroup');
          if (syncGroup) throw new Error('A notebook is already connected. Use a separate Chrome profile for another notebook.');
          const name = EJ.normalize(m.name);
          if (!name || name.length > 80) throw new Error('Enter a notebook name of 1-80 characters.');
          return connect(await api.rpc('create_notebook', { p_name: name }));
        }),
        join: (m) => manage(() => connect(m.group)),
        invite: (m) => manage(async () => {
          const { syncGroup } = await chrome.storage.local.get('syncGroup');
          if (!syncGroup) throw new Error('Connect a notebook first.');
          await api.rpc('invite_notebook_member', { p_group: syncGroup, p_email: email(m.email) });
          return `Invitation saved for ${email(m.email)}. Send them the notebook ID; no email is sent automatically.`;
        }),
        revoke: (m) => manage(async () => {
          const { syncGroup } = await chrome.storage.local.get('syncGroup');
          if (!syncGroup) throw new Error('Connect a notebook first.');
          await api.rpc('revoke_notebook_member', { p_group: syncGroup, p_email: email(m.email) });
          return `Access revoked for ${email(m.email)}. Previously downloaded local copies cannot be erased remotely.`;
        }),
      });
      chrome.alarms.create('supabase-poll', { periodInMinutes: 1 }).catch(report);
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name.startsWith('supabase-')) engine.sync().catch(report);
      });
      engine.sync().catch(report);
    },
  };
})(globalThis);
