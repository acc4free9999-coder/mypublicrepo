importScripts('lib/common.js');
importScripts('supabase-config.js', 'lib/notebook-sync.js', 'lib/supabase-api.js', 'lib/supabase-runtime.js');

const cache = new Map();
const CACHE_LIMIT = 200;

// Google's dictionary-extension endpoint: accepts several q params and returns one translation per item.
async function translateList(items, sl, tl) {
  const qs = items.map((q) => `&q=${encodeURIComponent(q)}`).join('');
  const res = await fetch(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sl}&tl=${encodeURIComponent(tl)}${qs}`);
  if (!res.ok) throw new Error(`Translate failed (${res.status})`);
  return (await res.json()).map((x) => (Array.isArray(x) ? x : [x]));
}

async function translate(text, tl) {
  try {
    return await translateFull(text, tl);
  } catch (err) {
    // Fall back to the simpler endpoint (e.g. when the main one is rate limited).
    const [[translated, sourceLang = '']] = await translateList([text], 'auto', tl).catch(() => {
      throw err;
    });
    return { text: translated, alternatives: [], sourceLang };
  }
}

async function translateFull(text, tl) {
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
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const WIKI_HEADERS = { 'Api-User-Agent': 'DropletDictionary/1.0 (Chrome extension)' };

async function wiktionary(word) {
  const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`, {
    headers: WIKI_HEADERS,
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
  return meanings.length ? { word, meanings } : null;
}

// ---------- Pronunciation: { uk: { ipa, audio }, us: { ipa, audio } } ----------
const emptyPron = () => ({ uk: { ipa: '', audio: '' }, us: { ipa: '', audio: '' } });
const hasPron = (p) => Boolean(p && (p.uk.ipa || p.uk.audio || p.us.ipa || p.us.audio));

function accentsOf(label) {
  const s = String(label || '');
  const out = [];
  if (/\b(UK|RP|SSB|British|England|English|London|Southern England)\b/i.test(s)) out.push('uk');
  if (/\b(US|GA|GenAm|General American|American|California|New York)\b/i.test(s)) out.push('us');
  return out;
}

const commonsFileUrl = (file) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.trim().replace(/ /g, '_'))}`;

// English section of the Wiktionary page source (null if the page or section doesn't exist).
function wikiEnglish(word) {
  return cached(`wikitext|${word}`, async () => {
    const url =
      'https://en.wiktionary.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&redirects=1' +
      `&page=${encodeURIComponent(word)}`;
    const res = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const wikitext = (await res.json()).parse?.wikitext || '';
    return wikitext.match(/==English==([\s\S]*?)(?=\n==[^=]|$)/)?.[1] || null;
  });
}

// Reads IPA and native-speaker recordings from the English section of the Wiktionary page source.
async function wiktionaryPronunciation(word) {
  const en = await wikiEnglish(word);
  if (!en) return null;

  const pron = emptyPron();
  let genericIpa = '';
  let genericAudio = '';
  const label = (parts) => parts.find((p) => /^a\d*=/.test(p))?.replace(/^a\d*=/, '');
  for (const line of en.split('\n')) {
    const lineAccents = accentsOf(line.match(/\{\{(?:a|accent)\|([^}]*)\}\}/)?.[1]);
    for (const [, body] of line.matchAll(/\{\{IPA\|en\|([^}]*)\}\}/g)) {
      const parts = body.split('|').map((x) => x.trim());
      const ipa = parts.find((x) => /^\/.+\/$/.test(x));
      if (!ipa) continue;
      const accents = accentsOf(label(parts)).length ? accentsOf(label(parts)) : lineAccents;
      if (!accents.length && !genericIpa) genericIpa = ipa;
      for (const acc of accents) pron[acc].ipa ||= ipa;
    }
    for (const [, body] of line.matchAll(/\{\{audio\|en\|([^}]*)\}\}/g)) {
      const parts = body.split('|').map((x) => x.trim());
      const file = parts[0];
      if (!file) continue;
      const byName = /^en-us\b/i.test(file) ? ['us'] : /^en-(uk|gb)\b/i.test(file) ? ['uk'] : [];
      const accents = byName.length ? byName : accentsOf(label(parts)).length ? accentsOf(label(parts)) : lineAccents;
      if (!accents.length && !genericAudio) genericAudio = commonsFileUrl(file);
      for (const acc of accents) pron[acc].audio ||= commonsFileUrl(file);
    }
  }
  for (const acc of ['uk', 'us']) {
    pron[acc].ipa ||= genericIpa;
    pron[acc].audio ||= genericAudio;
  }
  return hasPron(pron) ? pron : null;
}

const INFLECTION_OF =
  /\{\{(?:infl of|inflection of|[a-z -]*(?:plural|participle|past|tense|singular|comparative|superlative)[a-z -]* of)\|en\|([^|}]+)|\{\{en-[a-z -]+ of\|([^|}]+)/g;
const FAMILY_PREFIXES = /^(un|in|im|il|ir|dis|mis|non|re|over|under|pre|counter|anti)/;
// What follows the part shared with the base word: an optional i/y and one joining consonant
// (happ-i-ness, run-n-er, deci-s-ion), then a common English suffix.
const FAMILY_SUFFIX =
  /^[iy]?[a-z]?(?:s|es|ed|er|ers|or|ing|ness|ly|ful|less|able|ible|ability|ibility|ment|ion|ation|ition|ity|ive|ous|ist|ism|al|ance|ence|ancy|ency|ant|ent|y|ish|ize|ise|ify|ification|ship|hood|dom|ure|age|ery|ary|ic|ical|ically|ee|ously|fully|ingly|ably|ibly|ively|ally|lessly|lessness|fulness)$/;

function derivedTerms(en) {
  const terms = [];
  for (const [, body] of en.matchAll(/={3,6}\s*(?:Derived|Related) terms\s*={3,6}\n([\s\S]*?)(?=\n=|$)/g)) {
    for (const [, inner] of body.matchAll(/\{\{(?:col|der|rel)[\w-]*\|en\|([\s\S]*?)\}\}/g)) {
      terms.push(...inner.split(/[|\n,]/).filter((x) => !/^\w+=/.test(x.trim())));
    }
    for (const [, t] of body.matchAll(/\{\{l\|en\|([^|}]+)/g)) terms.push(t);
  }
  return terms.map((t) => t.replace(/<[^>]*>/g, '').replace(/[[\]]/g, '').trim());
}

// Word family: the base word (for inflected forms like "running" → "run") plus single-word derivatives
// sharing its stem, e.g. happy → happily, happiness, unhappy.
async function wordFamily(word) {
  let en = await wikiEnglish(word);
  if (!en) return [];
  const lemmas = [...new Set([...en.matchAll(INFLECTION_OF)].map((m) => (m[1] || m[2]).trim().toLowerCase()))].filter(
    (l) => l !== word && /^[a-z][a-z-]*$/.test(l)
  );
  const base = lemmas[0] || word;
  if (base !== word) en = (await wikiEnglish(base).catch(() => null)) || en;
  const stem = base.slice(0, Math.max(Math.min(4, base.length), base.length - 2));
  const isDerivative = (t) => {
    let n = 0;
    while (n < t.length && t[n] === base[n]) n++;
    const rest = t.slice(n);
    // decide → decider: the base's final "e" doubles as the suffix's first letter.
    return n >= stem.length && (FAMILY_SUFFIX.test(rest) || (n === base.length && base.endsWith('e') && FAMILY_SUFFIX.test(`e${rest}`)));
  };
  const candidates = [...new Set(derivedTerms(en))].filter(
    (t) => /^[a-z]+$/.test(t) && t !== word && t !== base && t.length <= 18
  );
  const suffixed = candidates
    .filter(isDerivative)
    .sort((a, b) => a.length - b.length);
  const prefixed = candidates
    .filter((t) => !t.startsWith(stem) && t.includes(stem) && FAMILY_PREFIXES.test(t.slice(0, t.indexOf(stem))))
    .sort((a, b) => a.length - b.length);
  return [...new Set([...lemmas, ...suffixed.slice(0, 7), ...prefixed.slice(0, 3)])].slice(0, 10);
}

// Translates many short strings with one request; returns null if the result can't be aligned.
async function translateMany(items, tl) {
  if (!items.length) return [];
  const out = (await translateList(items, 'en', tl)).map((x) => x[0]);
  return out.length === items.length ? out : null;
}

// Extras shown under the definition: word family and example translations.
async function extras(word, tl) {
  const [dict, family] = await Promise.all([
    lookupPart(word, 'dict').catch(() => null),
    wordFamily(word).catch(() => []),
  ]);
  const examples = [
    ...new Set((dict?.meanings || []).flatMap((m) => m.defs.slice(0, 3).map((d) => d.example)).filter(Boolean)),
  ]
    .filter((ex) => ex.length <= 300)
    .slice(0, 10);
  if (!family.length && !examples.length) return null;
  const tr = tl === 'en' ? null : await translateMany([...family, ...examples], tl).catch(() => null);
  return {
    family: family.map((w, i) => ({ word: w, translation: tr?.[i] || '' })),
    examples: Object.fromEntries(tr ? examples.map((ex, i) => [ex, tr[family.length + i]]) : []),
  };
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
  const phonetics = entries.flatMap((x) => x.phonetics || []);
  const pron = emptyPron();
  for (const p of phonetics) {
    const acc = /-uk\.mp3$/.test(p.audio || '') ? 'uk' : /-us\.mp3$/.test(p.audio || '') ? 'us' : '';
    if (acc) {
      pron[acc].audio ||= p.audio;
      pron[acc].ipa ||= p.text || '';
    }
  }
  const anyIpa = e.phonetic || phonetics.find((p) => p.text)?.text || '';
  const anyAudio = phonetics.find((p) => p.audio)?.audio || '';
  for (const acc of ['uk', 'us']) {
    pron[acc].ipa ||= anyIpa;
    pron[acc].audio ||= anyAudio;
  }
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
  return { word: e.word, pron: hasPron(pron) ? pron : null, meanings };
}

const settled = (r) => (r.status === 'fulfilled' ? r.value : null);

// Fill the gaps of one pronunciation source with another.
function mergePron(primary, secondary) {
  if (!hasPron(primary)) return hasPron(secondary) ? secondary : null;
  if (!hasPron(secondary)) return primary;
  const out = emptyPron();
  for (const acc of ['uk', 'us']) {
    out[acc].ipa = primary[acc].ipa || secondary[acc].ipa;
    out[acc].audio = primary[acc].audio || secondary[acc].audio;
  }
  return out;
}

async function define(word) {
  const [wk, pr, fd] = await Promise.allSettled([wiktionary(word), wiktionaryPronunciation(word), freeDictionary(word, 3500)]);
  let f = settled(fd);
  let base = settled(wk) || f;
  if (!base && !settled(pr)) {
    f = await freeDictionary(word, 12000).catch(() => null);
    base = f;
  }
  const pron = mergePron(settled(pr), f?.pron);
  if (!base && !pron) return null;
  const meanings = (base?.meanings || []).map((m) => ({
    ...m,
    synonyms: m.synonyms.length ? m.synonyms : f?.meanings.find((x) => x.pos === m.pos)?.synonyms || [],
  }));
  return { word: base?.word || word, phonetic: EJ.pronText(pron), pron, meanings };
}

async function pronunciationOf(word) {
  const [pr, fd] = await Promise.allSettled([wiktionaryPronunciation(word), freeDictionary(word, 8000)]);
  if (pr.status === 'rejected' && fd.status === 'rejected') throw pr.reason; // offline: retry on a later backfill
  return mergePron(settled(pr), settled(fd)?.pron);
}

const isDictionaryCandidate = (text) => /^[A-Za-z][A-Za-z'’\- ]{0,40}$/.test(text) && text.split(' ').length <= 3;

// Caches promises so parallel requests for the same key share one fetch; failures are not cached.
function cached(key, fn) {
  if (cache.has(key)) return cache.get(key);
  const promise = Promise.resolve().then(fn);
  cache.set(key, promise);
  promise.catch(() => cache.delete(key));
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return promise;
}

// part: 'translation' | 'dict' | 'pron' | 'extras'. The UI requests them in parallel so a slow source never blocks the others.
async function lookupPart(rawText, part) {
  const text = EJ.normalize(rawText).slice(0, 1000);
  if (!text) return null;
  const word = text.toLowerCase();
  if (part === 'dict' || part === 'pron' || part === 'extras') {
    if (!isDictionaryCandidate(text)) return null;
    if (part === 'dict') return cached(`dict|${word}`, () => define(word));
    if (part === 'pron') {
      return cached(`pron|${word}`, async () => {
        const wk = await wiktionaryPronunciation(word).catch(() => null);
        return wk || (await freeDictionary(word, 8000).catch(() => null))?.pron || null;
      });
    }
    const { targetLang } = await EJ.getSettings();
    return cached(`extras|${targetLang}|${word}`, () => extras(word, targetLang));
  }
  const { targetLang } = await EJ.getSettings();
  return cached(`tr|${targetLang}|${text}`, () => translate(text, targetLang));
}

// Serialize read-modify-write cycles so quick successive clicks don't overwrite each other.
let writeQueue = Promise.resolve();
const exclusive = (fn) => (writeQueue = writeQueue.then(fn, fn));

async function getLastCollection(collections) {
  const { lastCollection } = await chrome.storage.local.get('lastCollection');
  return collections[lastCollection] ? lastCollection : EJ.sortedCollections(collections)[0].id;
}

async function wordState(text) {
  const [vocab, collections] = await Promise.all([EJ.getVocab(), EJ.getCollections()]);
  const w = vocab[EJ.key(text)];
  return {
    saved: Boolean(w),
    memberOf: w ? EJ.wordCollections(w).filter((id) => collections[id]) : [],
    collections: EJ.sortedCollections(collections).map(({ id, name }) => ({ id, name })),
    lastCollection: await getLastCollection(collections),
  };
}

function buildEntry(data, meta = {}, existing) {
  const pron = EJ.bestPron(data) || existing?.pron || null;
  return {
    word: data.dict?.word || existing?.word || data.text,
    phonetic: EJ.pronText(pron) || data.dict?.phonetic || existing?.phonetic || '',
    pron,
    pronChecked: Boolean(data.dict || data.pron) || existing?.pronChecked || false,
    translation: data.translation?.text || existing?.translation || '',
    definition: EJ.firstDefinition(data.dict) || existing?.definition || '',
    context: meta.context || existing?.context || '',
    url: meta.url || existing?.url || '',
    title: meta.title || existing?.title || '',
    createdAt: existing?.createdAt || Date.now(),
    srs: existing?.srs || EJ.newSrs(),
    collections: existing ? EJ.wordCollections(existing) : [],
  };
}

// Adds the word (creating it if needed) to the given collections.
async function addToCollections({ text, data, meta }, ids) {
  const vocab = await EJ.getVocab();
  const k = EJ.key(text);
  const entry = buildEntry(data || { text }, meta, vocab[k]);
  entry.collections = [...new Set([...entry.collections, ...ids])];
  vocab[k] = entry;
  await EJ.setVocab(vocab);
  if (ids.length) await chrome.storage.local.set({ lastCollection: ids[ids.length - 1] });
}

const saveWord = (m) =>
  exclusive(async () => {
    const collections = await EJ.getCollections();
    const ids = (m.collectionIds || [await getLastCollection(collections)]).filter((id) => collections[id]);
    await addToCollections(m, ids);
    return wordState(m.text);
  });

const updateWord = ({ data }) =>
  exclusive(async () => {
    const vocab = await EJ.getVocab();
    const k = EJ.key(data.text);
    if (!vocab[k]) return false;
    vocab[k] = buildEntry(data, {}, vocab[k]);
    await EJ.setVocab(vocab);
    return true;
  });

const removeWord = ({ text }) =>
  exclusive(async () => {
    const vocab = await EJ.getVocab();
    delete vocab[EJ.key(text)];
    await EJ.setVocab(vocab);
    return wordState(text);
  });

const toggleCollection = (m) =>
  exclusive(async () => {
    const collections = await EJ.getCollections();
    if (!collections[m.collectionId]) throw new Error('That collection no longer exists.');
    if (m.on) {
      await addToCollections(m, [m.collectionId]);
    } else {
      const vocab = await EJ.getVocab();
      const w = vocab[EJ.key(m.text)];
      if (w) {
        w.collections = EJ.wordCollections(w).filter((id) => id !== m.collectionId);
        await EJ.setVocab(vocab);
      }
    }
    return wordState(m.text);
  });

// Creates a collection (or reuses one with the same name) and adds the word to it.
const createCollection = (m) =>
  exclusive(async () => {
    const name = EJ.normalize(m.name).slice(0, 40);
    if (!name) throw new Error('Collection name is empty.');
    const collections = await EJ.getCollections();
    let c = EJ.findCollectionByName(collections, name);
    if (!c) {
      c = { id: EJ.newCollectionId(), name, createdAt: Date.now() };
      collections[c.id] = c;
      await EJ.setCollections(collections);
    }
    if (m.text) await addToCollections(m, [c.id]);
    return m.text ? wordState(m.text) : c;
  });

// Give words saved before collections existed an explicit collection list.
const migrate = () =>
  exclusive(async () => {
    const [vocab, collections] = await Promise.all([EJ.getVocab(), EJ.getCollections()]);
    let changed = false;
    for (const w of Object.values(vocab)) {
      if (Array.isArray(w.collections)) continue;
      if (!collections[EJ.DEFAULT_COLLECTION_ID]) {
        collections[EJ.DEFAULT_COLLECTION_ID] = { id: EJ.DEFAULT_COLLECTION_ID, name: 'My Words', createdAt: 0 };
        await EJ.setCollections(collections);
      }
      w.collections = [EJ.DEFAULT_COLLECTION_ID];
      changed = true;
    }
    if (changed) await EJ.setVocab(vocab);
  });

// Fetch pronunciation for saved words that don't have one yet (e.g. saved before this feature,
// or while the dictionary was slow). Each word is attempted once; results are merged in a single write.
let backfilling = null;
function backfillPronunciations() {
  backfilling ||= (async () => {
    const vocab = await EJ.getVocab();
    const todo = Object.entries(vocab)
      .filter(([, w]) => !w.pronChecked && !hasPron(w.pron))
      .map(([k, w]) => [k, w.word]);
    const found = {};
    const queue = [...todo];
    const worker = async () => {
      while (queue.length) {
        const [k, word] = queue.shift();
        found[k] = isDictionaryCandidate(word) ? await pronunciationOf(word.toLowerCase()).catch(() => undefined) : null;
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    await exclusive(async () => {
      const latest = await EJ.getVocab();
      let changed = false;
      for (const [k, pron] of Object.entries(found)) {
        const w = latest[k];
        if (!w || hasPron(w.pron) || pron === undefined) continue; // undefined = network error, retry later
        w.pron = pron;
        w.phonetic = w.phonetic || EJ.pronText(pron);
        w.pronChecked = true;
        changed = true;
      }
      if (changed) await EJ.setVocab(latest);
    });
    return Object.values(found).filter(hasPron).length;
  })().finally(() => (backfilling = null));
  return backfilling;
}

// ---------- Audio playback (offscreen document, so page CSP can't block it) ----------
let creatingOffscreen = null;
async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existing.length) return;
  creatingOffscreen ||= chrome.offscreen
    .createDocument({ url: 'offscreen/offscreen.html', reasons: ['AUDIO_PLAYBACK'], justification: 'Play word pronunciations' })
    .finally(() => (creatingOffscreen = null));
  await creatingOffscreen;
}

async function speak({ text, audio, accent }) {
  chrome.tts.stop();
  if (audio) {
    try {
      await ensureOffscreen();
      const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'offscreen-play', url: audio });
      if (res?.ok) return 'audio';
    } catch {
      // fall through to text-to-speech
    }
  } else {
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'offscreen-stop' }).catch(() => {});
  }
  chrome.tts.speak(EJ.normalize(text).slice(0, 500), { lang: accent === 'uk' ? 'en-GB' : 'en-US', rate: 0.95 });
  return 'tts';
}

async function updateBadge() {
  const [{ reminders }, vocab] = await Promise.all([EJ.getSettings(), EJ.getVocab()]);
  const due = reminders ? EJ.dueCount(vocab) : 0;
  await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  await chrome.action.setBadgeText({ text: due ? String(Math.min(due, 999)) : '' });
}

const handlers = {
  writeData: (m) => exclusive(() => SharedSync.write(m.kind, m.data, m.base)),
  ensureCollections: () => exclusive(() => EJ.getCollections()),
  syncInfo: () => SharedSync.info(),
  syncSignIn: (m) => SharedSync.signIn(m),
  syncSignUp: (m) => SharedSync.signUp(m),
  syncSignOut: () => SharedSync.signOut(),
  syncGroups: () => SharedSync.groups(),
  syncCreate: (m) => SharedSync.create(m),
  syncJoin: (m) => SharedSync.join(m),
  syncInvite: (m) => SharedSync.invite(m),
  syncRevoke: (m) => SharedSync.revoke(m),
  syncPause: () => SharedSync.pause(),
  syncResume: () => SharedSync.resume(),
  lookupPart: (m) => lookupPart(m.text, m.part),
  save: (m) => saveWord(m),
  update: (m) => updateWord(m),
  remove: (m) => removeWord(m),
  wordState: (m) => exclusive(() => wordState(m.text)),
  toggleCollection: (m) => toggleCollection(m),
  createCollection: (m) => createCollection(m),
  backfillPronunciations: () => backfillPronunciations(),
  speak: (m) => speak(m),
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target === 'offscreen') return false;
  const handler = handlers[msg?.type];
  if (!handler) return false;
  if ((msg.type.startsWith('sync') || ['writeData', 'ensureCollections'].includes(msg.type)) &&
      (!_sender.url?.startsWith(chrome.runtime.getURL('')) || _sender.id !== chrome.runtime.id)) {
    sendResponse({ ok: false, error: 'This action is only available from extension pages.' });
    return false;
  }
  Promise.resolve(handler(msg))
    .then((value) => sendResponse({ ok: true, value }))
    .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
  return true;
});

SharedSync.init(exclusive);

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'ej-lookup', title: 'Look up “%s”', contexts: ['selection'] });
  chrome.alarms.create('ej-due', { periodInMinutes: 30 });
  migrate().then(updateBadge).then(backfillPronunciations);
});
chrome.runtime.onStartup.addListener(() => migrate().then(updateBadge).then(backfillPronunciations));

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
