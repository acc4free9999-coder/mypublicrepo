importScripts('lib/common.js');

const cache = new Map();
const CACHE_LIMIT = 200;

async function translate(text, tl) {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&dt=bd' +
    `&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translate failed (${res.status})`);
  const json = await res.json();
  return {
    text: (json[0] || []).map((s) => s[0]).join(''),
    alternatives: (json[1] || []).map((a) => ({ pos: a[0], terms: a[1] || [] })),
    sourceLang: json[2] || '',
  };
}

const stripHtml = (html) =>
  String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

async function wiktionary(word) {
  const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`, {
    headers: { 'Api-User-Agent': 'DropletDictionary/1.0 (Chrome extension)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const meanings = (json.en || [])
    .map((m) => ({
      pos: m.partOfSpeech.toLowerCase(),
      defs: (m.definitions || [])
        .map((d) => ({
          def: stripHtml(d.definition),
          example: stripHtml(d.parsedExamples?.[0]?.example || d.examples?.[0] || ''),
        }))
        .filter((d) => d.def),
      synonyms: [],
    }))
    .filter((m) => m.defs.length);
  return meanings.length ? { word, phonetic: '', audio: '', meanings } : null;
}

// dictionaryapi.dev has phonetics and synonyms but is often very slow, so it only enriches Wiktionary results.
async function freeDictionary(word, timeoutMs) {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return null;
  const entries = await res.json();
  if (!Array.isArray(entries) || !entries.length) return null;
  const e = entries[0];
  const phonetic = e.phonetic || entries.flatMap((x) => x.phonetics || []).find((p) => p.text)?.text || '';
  const audio = entries.flatMap((x) => x.phonetics || []).find((p) => p.audio)?.audio || '';
  const byPos = new Map();
  for (const entry of entries) {
    for (const m of entry.meanings || []) {
      const cur = byPos.get(m.partOfSpeech) || { pos: m.partOfSpeech, defs: [], synonyms: [] };
      for (const d of m.definitions || []) cur.defs.push({ def: d.definition, example: d.example || '' });
      cur.synonyms.push(...(m.synonyms || []), ...(m.definitions || []).flatMap((d) => d.synonyms || []));
      byPos.set(m.partOfSpeech, cur);
    }
  }
  const meanings = [...byPos.values()].map((m) => ({ ...m, synonyms: [...new Set(m.synonyms)] }));
  return { word: e.word, phonetic, audio, meanings };
}

async function define(word) {
  const [wk, fd] = await Promise.allSettled([wiktionary(word), freeDictionary(word, 3500)]);
  const w = wk.status === 'fulfilled' ? wk.value : null;
  const f = fd.status === 'fulfilled' ? fd.value : null;
  if (w) {
    if (f) {
      w.phonetic = f.phonetic;
      w.audio = f.audio;
      for (const m of w.meanings) m.synonyms = f.meanings.find((x) => x.pos === m.pos)?.synonyms || [];
    }
    return w;
  }
  return f || freeDictionary(word, 12000).catch(() => null);
}

const isDictionaryCandidate = (text) => /^[A-Za-z][A-Za-z'’\- ]{0,40}$/.test(text) && text.split(' ').length <= 3;

async function cached(key, fn) {
  if (cache.has(key)) return cache.get(key);
  const value = await fn();
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return value;
}

// part: 'translation' | 'dict'. The UI requests both in parallel so a slow dictionary never blocks the translation.
async function lookupPart(rawText, part) {
  const text = EJ.normalize(rawText).slice(0, 1000);
  if (!text) return null;
  if (part === 'dict') {
    if (!isDictionaryCandidate(text)) return null;
    return cached(`dict|${text.toLowerCase()}`, () => define(text.toLowerCase()));
  }
  const { targetLang } = await EJ.getSettings();
  return cached(`tr|${targetLang}|${text}`, () => translate(text, targetLang));
}

async function saveWord({ data, context, url, title }) {
  const vocab = await EJ.getVocab();
  const k = EJ.key(data.text);
  const existing = vocab[k];
  vocab[k] = {
    word: data.dict?.word || data.text,
    phonetic: data.dict?.phonetic || '',
    translation: data.translation?.text || '',
    definition: EJ.firstDefinition(data.dict),
    context: context || existing?.context || '',
    url: url || existing?.url || '',
    title: title || existing?.title || '',
    createdAt: existing?.createdAt || Date.now(),
    srs: existing?.srs || EJ.newSrs(),
  };
  await EJ.setVocab(vocab);
  return true;
}

async function removeWord(text) {
  const vocab = await EJ.getVocab();
  delete vocab[EJ.key(text)];
  await EJ.setVocab(vocab);
  return true;
}

async function updateBadge() {
  const [{ reminders }, vocab] = await Promise.all([EJ.getSettings(), EJ.getVocab()]);
  const due = reminders ? EJ.dueCount(vocab) : 0;
  await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  await chrome.action.setBadgeText({ text: due ? String(Math.min(due, 999)) : '' });
}

const handlers = {
  lookupPart: (m) => lookupPart(m.text, m.part),
  save: (m) => saveWord(m),
  remove: (m) => removeWord(m.text),
  isSaved: async (m) => Boolean((await EJ.getVocab())[EJ.key(m.text)]),
  speak: (m) => {
    chrome.tts.stop();
    chrome.tts.speak(EJ.normalize(m.text).slice(0, 500), { lang: m.lang || 'en-US', rate: m.rate || 0.95 });
    return true;
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = handlers[msg?.type];
  if (!handler) return false;
  Promise.resolve(handler(msg))
    .then((value) => sendResponse({ ok: true, value }))
    .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'ej-lookup', title: 'Look up “%s”', contexts: ['selection'] });
  chrome.alarms.create('ej-due', { periodInMinutes: 30 });
  updateBadge();
});
chrome.runtime.onStartup.addListener(updateBadge);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'ej-lookup' || !tab?.id) return;
  chrome.tabs
    .sendMessage(tab.id, { type: 'show-lookup', text: info.selectionText }, { frameId: info.frameId ?? 0 })
    .catch(() => {
      // Content script not available (e.g. chrome:// pages) — fall back to the notebook page.
      chrome.tabs.create({ url: chrome.runtime.getURL(`popup/popup.html?q=${encodeURIComponent(info.selectionText)}`) });
    });
});

chrome.alarms.onAlarm.addListener((a) => a.name === 'ej-due' && updateBadge());
chrome.storage.onChanged.addListener((changes) => {
  if (changes.vocab || changes.reminders) updateBadge();
});
