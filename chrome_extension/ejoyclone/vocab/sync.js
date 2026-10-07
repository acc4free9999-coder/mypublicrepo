(function () {
  const root = document.querySelector('#sharedSettings');
  const status = root.querySelector('#syncStatus');
  const notice = root.querySelector('#syncNotice');
  let busy = false;
  let notebooks = [];
  let current;
  const query = (id) => root.querySelector(`#${id}`);
  function error(err) { notice.textContent = err.message; }
  async function render() {
    current = await EJ.send({ type: 'syncInfo' });
    const messages = {
      syncing: 'Syncing...', synced: `Automatically synced at ${new Date(current.status.time).toLocaleTimeString()}.`,
      pending: 'More changes queued for automatic retry.', paused: 'Sync paused.',
      error: `Sync failed: ${current.status.error}`,
    };
    status.textContent = current.setupError || `${messages[current.status.state] || 'Not connected.'} ${current.pending} pending changes.`;
    status.classList.toggle('sync-error', Boolean(current.setupError) || current.status.state === 'error');
    query('syncAuth').hidden = Boolean(current.email);
    query('syncAccount').hidden = !current.email;
    query('syncEmail').textContent = current.email;
    query('syncNotebook').textContent = current.group ? `Notebook: ${current.name} | ID: ${current.group}` : 'No notebook connected yet.';
    query('syncCreate').hidden = Boolean(current.group);
    query('syncJoin').hidden = Boolean(current.group);
    query('syncExisting').hidden = Boolean(current.group) || !notebooks.length;
    query('syncOwner').hidden = !notebooks.some((item) => item.id === current.group && item.owner);
    root.querySelectorAll('button').forEach((button) => { button.disabled = busy || Boolean(current.setupError); });
    query('syncPause').disabled ||= !current.enabled;
    query('syncResume').disabled ||= current.enabled || !current.group;
  }
  async function loadGroups() {
    notebooks = current?.email ? await EJ.send({ type: 'syncGroups' }) : [];
    query('syncGroups').replaceChildren(...notebooks.map((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      return option;
    }));
  }
  async function action(fn) {
    if (busy) return;
    busy = true;
    notice.textContent = '';
    root.querySelectorAll('button').forEach((button) => { button.disabled = true; });
    try {
      const result = await fn();
      await render();
      await loadGroups();
      if (typeof result === 'string') notice.textContent = result;
    } catch (err) { error(err); }
    finally { busy = false; await render().catch(error); }
  }
  query('syncAuth').addEventListener('submit', (event) => {
    event.preventDefault();
    action(async () => {
      const form = event.target;
      try { return await EJ.send({ type: 'syncSignIn', email: form.elements.email.value, password: form.elements.password.value }); }
      finally { form.elements.password.value = ''; }
    });
  });
  query('syncSignUp').addEventListener('click', () => {
    const form = query('syncAuth');
    if (!form.reportValidity()) return;
    action(async () => {
      try { return await EJ.send({ type: 'syncSignUp', email: form.elements.email.value, password: form.elements.password.value }); }
      finally { form.elements.password.value = ''; }
    });
  });
  for (const [id, type] of [['syncSignOut', 'syncSignOut'], ['syncPause', 'syncPause'], ['syncResume', 'syncResume']]) {
    query(id).addEventListener('click', () => action(() => EJ.send({ type })));
  }
  query('syncCreate').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!confirm('Create a shared notebook and upload your local words and collections? Export a CSV backup first.')) return;
    action(() => EJ.send({ type: 'syncCreate', name: event.target.elements.name.value }));
  });
  for (const id of ['syncJoin', 'syncExisting']) query(id).addEventListener('submit', (event) => {
    event.preventDefault();
    if (!confirm('Connect this shared notebook? Local-only words will upload; shared duplicate words will be imported. Export a CSV backup first.')) return;
    action(() => EJ.send({ type: 'syncJoin', group: event.target.elements.group.value.trim() }));
  });
  query('syncInvite').addEventListener('submit', (event) => {
    event.preventDefault();
    action(() => EJ.send({ type: 'syncInvite', email: event.target.elements.email.value }));
  });
  query('syncRevoke').addEventListener('click', () => {
    const form = query('syncInvite');
    if (!form.reportValidity() || !confirm('Revoke this member and any invitation? Already downloaded words remain in their local Chrome storage.')) return;
    action(() => EJ.send({ type: 'syncRevoke', email: form.elements.email.value }));
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && !busy && ['syncStatus', 'syncPending', 'syncEnabled', 'syncGroup'].some((key) => changes[key])) render().catch(error);
  });
  (async () => { await render(); await loadGroups(); await render(); })().catch(error);
})();
