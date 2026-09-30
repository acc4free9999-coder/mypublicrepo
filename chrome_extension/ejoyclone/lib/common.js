// Shared helpers. Loaded in content scripts, extension pages and the service worker.
(function (g) {
  const EJ = (g.EJ = g.EJ || {});

  EJ.DEFAULT_SETTINGS = {
    targetLang: 'vi',
    showIcon: true,
    dblclickLookup: false,
    autoSpeak: false,
    reminders: true,
  };

  EJ.LANGUAGES = {
    vi: 'Vietnamese', en: 'English', zh: 'Chinese (Simplified)', 'zh-TW': 'Chinese (Traditional)',
    ja: 'Japanese', ko: 'Korean', th: 'Thai', id: 'Indonesian', fr: 'French', de: 'German',
    es: 'Spanish', pt: 'Portuguese', ru: 'Russian', it: 'Italian', ar: 'Arabic', hi: 'Hindi',
  };

  EJ.esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  EJ.normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  EJ.key = (text) => EJ.normalize(text).toLowerCase();

  EJ.getSettings = async () => ({ ...EJ.DEFAULT_SETTINGS, ...(await chrome.storage.sync.get(null)) });

  EJ.getVocab = async () => (await chrome.storage.local.get({ vocab: {} })).vocab;
  EJ.setVocab = (vocab) => chrome.storage.local.set({ vocab });

  // ---------- Collections (many-to-many: word.collections = [collectionId, ...]) ----------
  EJ.DEFAULT_COLLECTION_ID = 'default';
  EJ.newCollectionId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  EJ.getCollections = async () => {
    const { collections } = await chrome.storage.local.get({ collections: null });
    if (collections && Object.keys(collections).length) return collections;
    const fresh = { [EJ.DEFAULT_COLLECTION_ID]: { id: EJ.DEFAULT_COLLECTION_ID, name: 'My Words', createdAt: Date.now() } };
    await chrome.storage.local.set({ collections: fresh });
    return fresh;
  };
  EJ.setCollections = (collections) => chrome.storage.local.set({ collections });
  EJ.sortedCollections = (collections) => Object.values(collections).sort((a, b) => a.createdAt - b.createdAt);

  // Words saved before collections existed have no list; they belong to the default collection.
  EJ.wordCollections = (w) => (Array.isArray(w?.collections) ? w.collections : [EJ.DEFAULT_COLLECTION_ID]);

  EJ.findCollectionByName = (collections, name) => {
    const n = EJ.key(name);
    return Object.values(collections).find((c) => EJ.key(c.name) === n);
  };

  // Messages to the service worker. Responses are wrapped as { ok, value | error }.
  EJ.send = async (msg) => {
    let res;
    try {
      res = await chrome.runtime.sendMessage(msg);
    } catch {
      throw new Error('Extension was updated — please refresh this page.');
    }
    if (!res?.ok) throw new Error(res?.error || 'No response from extension.');
    return res.value;
  };

  // Calls onUpdate(data) each time a part arrives; resolves with the final data.
  EJ.lookup = async (rawText, onUpdate) => {
    const text = EJ.normalize(rawText);
    const data = { text, translation: undefined, dict: undefined, pron: undefined, extras: undefined };
    const part = (name) =>
      EJ.send({ type: 'lookupPart', text, part: name })
        .catch(() => null)
        .then((v) => {
          data[name] = v;
          if (data.translation !== undefined && data.dict !== undefined && !data.translation && !data.dict) {
            data.error = 'Could not look up this text. Check your connection and try again.';
          }
          onUpdate?.({ ...data });
        });
    await Promise.all(['translation', 'dict', 'pron', 'extras'].map(part));
    return data;
  };

  // ---------- Spaced repetition (simplified SM-2) ----------
  const MIN = 60 * 1000;
  const DAY = 24 * 60 * MIN;
  EJ.newSrs = () => ({ reps: 0, ease: 2.5, interval: 0, due: Date.now(), lapses: 0 });

  // grade: 0 = again, 1 = hard, 2 = good, 3 = easy
  EJ.reviewSrs = (srs, grade, now = Date.now()) => {
    const s = { ...EJ.newSrs(), ...srs };
    if (grade === 0) {
      s.reps = 0;
      s.lapses += 1;
      s.interval = 0;
      s.ease = Math.max(1.3, s.ease - 0.2);
      s.due = now + 10 * MIN;
      return s;
    }
    s.reps += 1;
    if (s.reps === 1) s.interval = grade === 3 ? 4 : 1;
    else if (s.reps === 2) s.interval = grade === 1 ? 3 : 6;
    else s.interval = Math.max(1, Math.round(s.interval * s.ease * (grade === 1 ? 0.8 : grade === 3 ? 1.3 : 1)));
    s.ease = Math.max(1.3, s.ease + (grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0));
    s.due = now + s.interval * DAY;
    return s;
  };

  EJ.level = (srs) => {
    const i = srs?.interval || 0;
    if (i >= 30) return { n: 5, label: 'Mastered' };
    if (i >= 14) return { n: 4, label: 'Strong' };
    if (i >= 6) return { n: 3, label: 'Good' };
    if (i >= 1) return { n: 2, label: 'Learning' };
    return { n: 1, label: 'New' };
  };

  EJ.dueCount = (vocab, now = Date.now()) =>
    Object.values(vocab).filter((w) => (w.srs?.due ?? 0) <= now).length;

  // ---------- Result card rendering ----------
  EJ.pronText = (p) => p?.us?.ipa || p?.uk?.ipa || '';
  EJ.hasPron = (p) => Boolean(p && (p.uk?.ipa || p.uk?.audio || p.us?.ipa || p.us?.audio));
  // The dictionary result merges more sources, but the dedicated pronunciation part usually arrives first.
  EJ.bestPron = (d) => (EJ.hasPron(d?.dict?.pron) ? d.dict.pron : EJ.hasPron(d?.pron) ? d.pron : null);

  // UK/US pronunciation buttons; falls back to a single speaker button when nothing is known.
  EJ.renderPron = (pron, phonetic = '') => {
    const rows = ['uk', 'us']
      .filter((acc) => pron?.[acc]?.ipa || pron?.[acc]?.audio)
      .map(
        (acc) => `<span class="ej-pron-item">
          <button class="ej-btn ej-pron-btn" data-act="speak" data-accent="${acc}" title="${
          pron[acc].audio ? 'Play recording' : 'Text-to-speech'
        }">🔊 ${acc.toUpperCase()}</button>${pron[acc].ipa ? `<span class="ej-phon">${EJ.esc(pron[acc].ipa)}</span>` : ''}</span>`
      );
    if (rows.length) return `<div class="ej-pron">${rows.join('')}</div>`;
    return `<div class="ej-pron"><span class="ej-pron-item"><button class="ej-btn ej-pron-btn" data-act="speak" title="Pronounce">🔊</button>${
      phonetic ? `<span class="ej-phon">${EJ.esc(phonetic)}</span>` : ''
    }</span></div>`;
  };

  EJ.speakMsg = (text, pron, accent = 'us') => ({ type: 'speak', text, accent, audio: pron?.[accent]?.audio || '' });

  EJ.firstDefinition = (dict) => dict?.meanings?.[0]?.defs?.[0]?.def || '';

  EJ.renderCollectionRow = ({ saved, collections = [], memberOf = [], lastCollection, pickerOpen }) => {
    const esc = EJ.esc;
    const byId = Object.fromEntries(collections.map((c) => [c.id, c]));
    const chips = memberOf
      .filter((id) => byId[id])
      .map((id) => `<span class="ej-chip">${esc(byId[id].name)}</span>`)
      .join('');
    const target = byId[lastCollection]?.name || collections[0]?.name || '';
    const label = saved
      ? chips || '<span class="ej-muted">Not in any collection</span>'
      : `<span class="ej-muted">Save to “${esc(target)}” or pick collections</span>`;
    const picker = pickerOpen
      ? `<div class="ej-picker">
          ${collections
            .map(
              (c) => `<label class="ej-pick"><input type="checkbox" data-coll="${esc(c.id)}" ${
                memberOf.includes(c.id) ? 'checked' : ''
              }> ${esc(c.name)}</label>`
            )
            .join('')}
          <form class="ej-newcoll"><input name="name" maxlength="40" placeholder="New collection…" autocomplete="off"><button class="ej-btn" type="submit">+ Add</button></form>
        </div>`
      : '';
    return `<div class="ej-colls">
        <span class="ej-colls-list">📁 ${label}</span>
        <button class="ej-link" data-act="picker">${pickerOpen ? 'Done' : saved ? 'Edit ▾' : 'Choose ▾'}</button>
      </div>${picker}`;
  };

  EJ.renderResult = (d, state = {}) => {
    const esc = EJ.esc;
    const saved = Boolean(state.saved);
    if (d.error) {
      return `<div class="ej-error">${esc(d.error)}</div>`;
    }
    const word = d.dict?.word || d.text;
    const q = encodeURIComponent(d.text);
    const alts = (d.translation?.alternatives || [])
      .map((a) => `<div class="ej-alt"><span class="ej-pos">${esc(a.pos)}</span> ${esc(a.terms.slice(0, 6).join(', '))}</div>`)
      .join('');
    const meanings = (d.dict?.meanings || [])
      .map(
        (m) => `
        <div class="ej-meaning">
          <div class="ej-pos">${esc(m.pos)}</div>
          <ol>${m.defs
            .slice(0, 3)
            .map((x) => {
              const tr = d.extras?.examples?.[x.example];
              const ex = x.example
                ? `<div class="ej-ex">“${esc(x.example)}”${tr ? `<div class="ej-ex-tr">→ ${esc(tr)}</div>` : ''}</div>`
                : '';
              return `<li>${esc(x.def)}${ex}</li>`;
            })
            .join('')}</ol>
          ${m.synonyms.length ? `<div class="ej-syn">Synonyms: ${esc(m.synonyms.slice(0, 6).join(', '))}</div>` : ''}
        </div>`
      )
      .join('');
    const family = (d.extras?.family || [])
      .map(
        (f) => `<button class="ej-fam" data-act="lookup" data-word="${esc(f.word)}" title="Look up “${esc(f.word)}”">
          <b>${esc(f.word)}</b>${f.translation ? `<span>${esc(f.translation)}</span>` : ''}</button>`
      )
      .join('');
    const pron = EJ.bestPron(d);
    const pronLoading = !pron && (d.pron === undefined || d.dict === undefined) && d.dict !== null;
    return `
      <div class="ej-head">
        <div class="ej-titles">
          <div class="ej-word">${esc(word)}</div>
          ${EJ.renderPron(pron, d.dict?.phonetic)}${pronLoading ? '<div class="ej-muted ej-pron-wait">Loading pronunciation…</div>' : ''}
        </div>
        <div class="ej-actions">
          <button class="ej-btn ej-save ${saved ? 'is-saved' : ''}" data-act="save" title="${
            saved ? 'Remove from notebook' : 'Save to notebook'
          }">${saved ? '★ Saved' : '☆ Save'}</button>
        </div>
      </div>
      ${state.collections ? EJ.renderCollectionRow(state) : ''}
      ${d.translation ? `<div class="ej-trans">${esc(d.translation.text)}</div>` : ''}
      ${d.translation === undefined ? '<div class="ej-loading">Translating…</div>' : ''}
      ${alts}
      ${meanings ? `<div class="ej-meanings">${meanings}</div>` : ''}
      ${d.dict === undefined ? '<div class="ej-loading">Loading definitions…</div>' : ''}
      ${family ? `<div class="ej-family"><div class="ej-pos">Word family</div><div class="ej-fams">${family}</div></div>` : ''}
      <div class="ej-links">
        <a target="_blank" rel="noopener" href="https://www.google.com/search?q=${q}+meaning">Google</a>
        <a target="_blank" rel="noopener" href="https://dictionary.cambridge.org/dictionary/english/${q}">Cambridge</a>
        <a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Special:Search?search=${q}">Wikipedia</a>
        <a target="_blank" rel="noopener" href="https://www.google.com/search?tbm=isch&q=${q}">Images</a>
        <a target="_blank" rel="noopener" href="https://youglish.com/pronounce/${q}/english">YouGlish</a>
      </div>`;
  };

  // Shared lookup card behaviour for the in-page card and the popup.
  // getMeta() returns { context, url, title } captured when the word is saved.
  EJ.createLookupCard = ({ el, root = document, getMeta = () => ({}), afterRender = () => {}, autoSpeak = async () => false }) => {
    let state = null;
    let seq = 0;

    const isCurrent = (my) => my === seq && state;
    const wordMsg = (extra) => ({ text: state.data.text, data: state.data, meta: getMeta(), ...extra });

    function render() {
      if (!state) return;
      // Keep the "new collection" input intact across progressive re-renders.
      const input = el.querySelector('.ej-newcoll input');
      const typed = input?.value || '';
      const focused = input && root.activeElement === input;
      el.innerHTML = EJ.renderResult(state.data, state);
      const next = el.querySelector('.ej-newcoll input');
      if (next) {
        next.value = typed;
        if (focused) next.focus();
      }
      afterRender();
    }

    const apply = (ws) => {
      if (!state) return;
      Object.assign(state, ws);
      render();
    };
    const showError = (err) => el.insertAdjacentHTML('beforeend', `<div class="ej-error">${EJ.esc(err.message)}</div>`);
    const call = (msg) => EJ.send(msg).then(apply).catch(showError);

    async function open(rawText) {
      const text = EJ.normalize(rawText);
      const my = ++seq;
      state = { data: { text }, saved: false, memberOf: [], collections: null, pickerOpen: false };
      el.innerHTML = `<div class="ej-loading">Looking up “${EJ.esc(text.slice(0, 80))}”…</div>`;
      afterRender();
      EJ.send({ type: 'wordState', text })
        .then((ws) => isCurrent(my) && apply(ws))
        .catch(() => {});
      const data = await EJ.lookup(text, (partial) => {
        if (!isCurrent(my)) return;
        state.data = partial;
        render();
      });
      if (!isCurrent(my)) return;
      // Fill in details if the word was saved before all lookup data arrived.
      if (state.saved && !data.error) EJ.send({ type: 'update', data }).catch(() => {});
      if (!data.error && (await autoSpeak())) EJ.send(EJ.speakMsg(text, EJ.bestPron(data))).catch(() => {});
    }

    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn || !state) return;
      const act = btn.dataset.act;
      if (act === 'speak') EJ.send(EJ.speakMsg(state.data.text, EJ.bestPron(state.data), btn.dataset.accent || 'us')).catch(() => {});
      if (act === 'lookup') open(btn.dataset.word);
      if (act === 'save') call(state.saved ? { type: 'remove', text: state.data.text } : { type: 'save', ...wordMsg() });
      if (act === 'picker') {
        state.pickerOpen = !state.pickerOpen;
        render();
        if (state.pickerOpen) el.querySelector('.ej-picker')?.scrollIntoView({ block: 'nearest' });
      }
    });
    el.addEventListener('change', (e) => {
      const box = e.target.closest('[data-coll]');
      if (!box || !state) return;
      call({ type: 'toggleCollection', ...wordMsg({ collectionId: box.dataset.coll, on: box.checked }) });
    });
    el.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = EJ.normalize(e.target.elements?.name?.value);
      if (!name || !state) return;
      e.target.elements.name.value = '';
      call({ type: 'createCollection', name, ...wordMsg() }).then(() => el.querySelector('.ej-newcoll input')?.focus());
    });
    // Stop host pages (e.g. video sites) from reacting to keys typed into the card.
    for (const type of ['keydown', 'keyup', 'keypress']) el.addEventListener(type, (e) => e.stopPropagation());

    return {
      open,
      close() {
        seq++;
        state = null;
      },
      get text() {
        return state?.data.text;
      },
    };
  };
})(globalThis);
