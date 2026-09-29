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
    const data = { text, translation: undefined, dict: undefined };
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
    await Promise.all([part('translation'), part('dict')]);
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
  EJ.firstDefinition = (dict) => dict?.meanings?.[0]?.defs?.[0]?.def || '';

  EJ.renderResult = (d, { saved = false } = {}) => {
    const esc = EJ.esc;
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
            .map((x) => `<li>${esc(x.def)}${x.example ? `<div class="ej-ex">“${esc(x.example)}”</div>` : ''}</li>`)
            .join('')}</ol>
          ${m.synonyms.length ? `<div class="ej-syn">Synonyms: ${esc(m.synonyms.slice(0, 6).join(', '))}</div>` : ''}
        </div>`
      )
      .join('');
    return `
      <div class="ej-head">
        <div class="ej-titles">
          <div class="ej-word">${esc(word)}</div>
          ${d.dict?.phonetic ? `<div class="ej-phon">${esc(d.dict.phonetic)}</div>` : ''}
        </div>
        <div class="ej-actions">
          <button class="ej-btn" data-act="speak" title="Pronounce">🔊</button>
          <button class="ej-btn ej-save ${saved ? 'is-saved' : ''}" data-act="save" title="Save to notebook">${saved ? '★ Saved' : '☆ Save'}</button>
        </div>
      </div>
      ${d.translation ? `<div class="ej-trans">${esc(d.translation.text)}</div>` : ''}
      ${d.translation === undefined ? '<div class="ej-loading">Translating…</div>' : ''}
      ${alts}
      ${meanings ? `<div class="ej-meanings">${meanings}</div>` : ''}
      ${d.dict === undefined ? '<div class="ej-loading">Loading definitions…</div>' : ''}
      <div class="ej-links">
        <a target="_blank" rel="noopener" href="https://www.google.com/search?q=${q}+meaning">Google</a>
        <a target="_blank" rel="noopener" href="https://dictionary.cambridge.org/dictionary/english/${q}">Cambridge</a>
        <a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Special:Search?search=${q}">Wikipedia</a>
        <a target="_blank" rel="noopener" href="https://www.google.com/search?tbm=isch&q=${q}">Images</a>
        <a target="_blank" rel="noopener" href="https://youglish.com/pronounce/${q}/english">YouGlish</a>
      </div>`;
  };
})(globalThis);
