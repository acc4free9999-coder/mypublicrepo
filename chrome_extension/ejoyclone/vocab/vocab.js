const $ = (sel) => document.querySelector(sel);
const esc = EJ.esc;
const speak = (w, accent = 'us') => EJ.send(EJ.speakMsg(w.word, w.pron, accent)).catch(() => {});
const pronLine = (w) => (EJ.pronText(w.pron) || w.phonetic ? EJ.renderPron(w.pron, w.phonetic) : '');
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let vocab = {};

// ---------- Tabs ----------
function showTab() {
  const tab = (location.hash || '#notebook').slice(1);
  document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.id === tab));
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
}
window.addEventListener('hashchange', showTab);

// ---------- Collections ----------
let collections = {};
let selected = localStorage.getItem('ej-selected') || 'all'; // 'all' | 'unsorted' | collection id
let openPicker = null; // word key whose collection picker is expanded
let sharedNotebook = false;
chrome.storage.local.get('syncGroup').then(({ syncGroup }) => { sharedNotebook = Boolean(syncGroup); })
  .catch((err) => alert(`Could not read sync settings: ${err.message}`));
const sharedWarning = () => sharedNotebook ? '\n\nThis deletion syncs to all notebook members, including after resuming sync.' : '';

const isRealCollection = (id) => Boolean(collections[id]);
const memberOf = (w) => EJ.wordCollections(w).filter((id) => collections[id]);

function inView(w, view = selected) {
  if (view === 'all') return true;
  if (view === 'unsorted') return memberOf(w).length === 0;
  return memberOf(w).includes(view);
}

function select(view) {
  selected = view === 'all' || view === 'unsorted' || isRealCollection(view) ? view : 'all';
  localStorage.setItem('ej-selected', selected);
  openPicker = null;
  renderNotebook();
}

const viewName = (view) =>
  view === 'all' ? 'All words' : view === 'unsorted' ? 'Unsorted' : collections[view]?.name || 'All words';

function renderSidebar() {
  const words = Object.values(vocab);
  const count = (view) => words.filter((w) => inView(w, view)).length;
  const item = (view, icon) =>
    `<button class="coll-item ${selected === view ? 'active' : ''}" data-view="${esc(view)}">
      <span class="name">${icon} ${esc(viewName(view))}</span><span class="count">${count(view)}</span>
    </button>`;
  const unsorted = count('unsorted');
  $('#collList').innerHTML = [
    item('all', '📚'),
    '<div class="coll-sep"></div>',
    ...EJ.sortedCollections(collections).map((c) => item(c.id, '📁')),
    unsorted ? `<div class="coll-sep"></div>${item('unsorted', '🗂')}` : '',
  ].join('');
}

$('#collList').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (btn) select(btn.dataset.view);
});

$('#newColl').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = EJ.normalize(e.target.elements.name.value).slice(0, 40);
  if (!name) return;
  const existing = EJ.findCollectionByName(collections, name);
  e.target.elements.name.value = '';
  if (existing) return select(existing.id);
  const c = { id: EJ.newCollectionId(), name, createdAt: Date.now() };
  collections[c.id] = c;
  await EJ.setCollections(collections);
  select(c.id);
});

$('#renameColl').addEventListener('click', async () => {
  const c = collections[selected];
  if (!c) return;
  const name = EJ.normalize(prompt('Rename collection', c.name) || '').slice(0, 40);
  if (!name || name === c.name) return;
  const clash = EJ.findCollectionByName(collections, name);
  if (clash && clash.id !== c.id) return alert(`A collection named “${clash.name}” already exists.`);
  c.name = name;
  await EJ.setCollections(collections);
});

$('#deleteColl').addEventListener('click', async () => {
  const c = collections[selected];
  if (!c) return;
  if (Object.keys(collections).length <= 1) return alert('You need at least one collection. Create another one first.');
  const words = Object.values(vocab).filter((w) => memberOf(w).includes(c.id));
  const only = words.filter((w) => memberOf(w).length === 1).length;
  const msg =
    `Delete collection “${c.name}”?\n\nIts ${words.length} word(s) stay in your notebook` +
    (only ? ` (${only} will become Unsorted).` : '.');
  if (!confirm(msg + sharedWarning())) return;
  for (const w of words) w.collections = EJ.wordCollections(w).filter((id) => id !== c.id);
  delete collections[c.id];
  const { lastCollection } = await chrome.storage.local.get('lastCollection');
  await Promise.all([
    EJ.setVocab(vocab),
    EJ.setCollections(collections),
    lastCollection === c.id ? chrome.storage.local.remove('lastCollection') : null,
  ]);
  select('all');
});

$('#reviewColl').addEventListener('click', () => {
  renderReviewOptions();
  $('#reviewCollection').value = selected;
  location.hash = 'review';
});

async function setMembership(key, collectionId, on) {
  const w = vocab[key];
  if (!w || !collections[collectionId]) return;
  const ids = new Set(EJ.wordCollections(w));
  if (on) ids.add(collectionId);
  else ids.delete(collectionId);
  w.collections = [...ids];
  await EJ.setVocab(vocab);
}

// ---------- Notebook ----------
function fmtDue(due) {
  const diff = due - Date.now();
  if (diff <= 0) return 'due now';
  const h = diff / 3600000;
  if (h < 1) return `in ${Math.ceil(diff / 60000)} min`;
  if (h < 24) return `in ${Math.round(h)} h`;
  return `in ${Math.round(h / 24)} d`;
}

function highlight(ctx, word) {
  const safe = esc(ctx);
  if (!word) return safe;
  return safe.replace(new RegExp(reEscape(esc(word)), 'gi'), (m) => `<mark>${m}</mark>`);
}

function renderNotebook() {
  if (selected !== 'all' && selected !== 'unsorted' && !isRealCollection(selected)) selected = 'all';
  renderSidebar();
  $('#collTitle').textContent = viewName(selected);
  $('#renameColl').hidden = $('#deleteColl').hidden = !isRealCollection(selected);
  renderList();
}

function renderWord(k, w) {
  const lvl = EJ.level(w.srs);
  const ids = memberOf(w);
  const chips = ids.length
    ? ids.map((id) => `<button class="chip" data-goto="${esc(id)}">📁 ${esc(collections[id].name)}</button>`).join('')
    : '<span class="chip none">Unsorted</span>';
  const picker =
    openPicker === k
      ? `<div class="picker">${EJ.sortedCollections(collections)
          .map(
            (c) => `<label><input type="checkbox" data-coll="${esc(c.id)}" ${ids.includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`
          )
          .join('')}</div>`
      : '';
  return `
    <div class="word" data-key="${esc(k)}">
      <h3>${esc(w.word)}</h3>
      ${pronLine(w)}
      <div class="side">
        <span class="lvl lvl-${lvl.n}" title="Next review ${esc(fmtDue(w.srs.due))}">${lvl.label}</span>
        <span class="muted">${esc(fmtDue(w.srs.due))}</span>
        <div>
          <button data-act="speak" title="Pronounce">🔊</button>
          <button data-act="picker" title="Add to / remove from collections">📁</button>
          ${isRealCollection(selected) ? '<button data-act="unlink" title="Remove from this collection">➖</button>' : ''}
          <button data-act="delete" title="Delete word from notebook">🗑</button>
        </div>
      </div>
      ${w.translation ? `<div class="tr">${esc(w.translation)}</div>` : ''}
      ${w.definition ? `<div class="def">${esc(w.definition)}</div>` : ''}
      ${
        w.context
          ? `<div class="ctx">“${highlight(w.context, w.word)}”${
              /^https?:/.test(w.url) ? ` — <a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.title || 'source')}</a>` : ''
            }</div>`
          : ''
      }
      <div class="chips">${chips}</div>
      ${picker}
    </div>`;
}

function renderList() {
  const q = EJ.key($('#filter').value);
  const sort = $('#sort').value;
  const inCollection = Object.entries(vocab).filter(([, w]) => inView(w));
  let items = inCollection;
  if (q) items = items.filter(([, w]) => [w.word, w.translation, w.definition, w.context].join(' ').toLowerCase().includes(q));
  const sorters = {
    new: (a, b) => b[1].createdAt - a[1].createdAt,
    az: (a, b) => a[1].word.localeCompare(b[1].word),
    due: (a, b) => a[1].srs.due - b[1].srs.due,
    weak: (a, b) => a[1].srs.interval - b[1].srs.interval || b[1].srs.lapses - a[1].srs.lapses,
  };
  items.sort(sorters[sort]);

  const total = inCollection.length;
  const due = EJ.dueCount(Object.fromEntries(inCollection));
  $('#summary').textContent = `${total} word${total === 1 ? '' : 's'} · ${due} due for review`;
  const empty = !Object.keys(vocab).length
    ? 'No words yet. Select any text on a web page, click the green droplet, then save it to a collection.'
    : total
      ? 'No matches.'
      : 'This collection is empty. Use the 📁 button on a word (in “All words”) or the lookup card to add words here.';
  $('#list').innerHTML = items.length ? items.map(([k, w]) => renderWord(k, w)).join('') : `<p class="muted">${empty}</p>`;
}

$('#list').addEventListener('click', async (e) => {
  const chip = e.target.closest('[data-goto]');
  if (chip) return select(chip.dataset.goto);
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const key = btn.closest('.word').dataset.key;
  const act = btn.dataset.act;
  if (act === 'speak') speak(vocab[key], btn.dataset.accent);
  if (act === 'picker') {
    openPicker = openPicker === key ? null : key;
    renderList();
  }
  if (act === 'unlink') await setMembership(key, selected, false);
  if (act === 'delete' && confirm(`Delete “${vocab[key].word}” from your notebook and all collections?${sharedWarning()}`)) {
    delete vocab[key];
    await EJ.setVocab(vocab);
  }
});
$('#list').addEventListener('change', (e) => {
  const box = e.target.closest('[data-coll]');
  if (box) setMembership(box.closest('.word').dataset.key, box.dataset.coll, box.checked);
});
$('#filter').addEventListener('input', renderList);
$('#sort').addEventListener('change', renderList);

// ---------- CSV import / export ----------
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

$('#exportCsv').addEventListener('click', () => {
  const header = ['word', 'phonetic', 'translation', 'definition', 'context', 'url', 'collections'];
  const rows = Object.values(vocab)
    .filter((w) => inView(w))
    .map((w) => {
      const rec = { ...w, collections: memberOf(w).map((id) => collections[id].name).join('; ') };
      return header.map((h) => csvCell(rec[h])).join(',');
    });
  const blob = new Blob(['\ufeff' + [header.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const slug = viewName(selected).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'words';
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `droplet-${slug}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
});

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell), rows.push(row), (row = []), (cell = '');
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}

// Rows with a "collections" column go to those collections (created if needed);
// other rows go to the collection currently open, or the first collection.
$('#importCsv').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const rows = parseCsv((await file.text()).replace(/^\ufeff/, ''));
  const first = rows[0]?.map((h) => h.trim().toLowerCase()) || [];
  const hasHeader = first.includes('word');
  const cols = (hasHeader ? first : ['word', 'translation', 'definition']).map((c) => (c === 'collection' ? 'collections' : c));
  const fallback = isRealCollection(selected) ? selected : EJ.sortedCollections(collections)[0].id;
  const idForName = (name) => {
    let c = EJ.findCollectionByName(collections, name);
    if (!c) {
      c = { id: EJ.newCollectionId(), name: name.slice(0, 40), createdAt: Date.now() };
      collections[c.id] = c;
    }
    return c.id;
  };
  let added = 0;
  for (const r of hasHeader ? rows.slice(1) : rows) {
    const rec = Object.fromEntries(cols.map((c, i) => [c, (r[i] || '').trim()]));
    const k = EJ.key(rec.word);
    if (!k) continue;
    const names = (rec.collections || '').split(';').map(EJ.normalize).filter(Boolean);
    const ids = names.length ? names.map(idForName) : [fallback];
    const old = vocab[k];
    vocab[k] = {
      word: rec.word,
      phonetic: rec.phonetic || old?.phonetic || '',
      pron: old?.pron,
      pronChecked: old?.pronChecked || false,
      translation: rec.translation || old?.translation || '',
      definition: rec.definition || old?.definition || '',
      context: rec.context || old?.context || '',
      url: rec.url || old?.url || '',
      title: old?.title || '',
      createdAt: old?.createdAt || Date.now(),
      srs: old?.srs || EJ.newSrs(),
      collections: [...new Set([...(old ? EJ.wordCollections(old) : []), ...ids])],
    };
    added++;
  }
  const importedVocab = vocab;
  await EJ.setCollections(collections);
  await EJ.setVocab(importedVocab);
  EJ.send({ type: 'backfillPronunciations' }).catch(() => {});
  e.target.value = '';
  alert(`Imported ${added} word(s).`);
});

// Review games live in game.js.

// ---------- Settings ----------
async function initSettings() {
  const s = await EJ.getSettings();
  $('#targetLang').innerHTML = Object.entries(EJ.LANGUAGES)
    .map(([code, name]) => `<option value="${code}">${name}</option>`)
    .join('');
  const form = $('#settingsForm');
  for (const el of form.elements) {
    if (el.type === 'checkbox') el.checked = Boolean(s[el.name]);
    else if (el.name) el.value = s[el.name];
  }
  form.addEventListener('change', async (e) => {
    const el = e.target;
    await chrome.storage.sync.set({ [el.name]: el.type === 'checkbox' ? el.checked : el.value });
    $('#savedMsg').textContent = 'Saved ✓';
    setTimeout(() => ($('#savedMsg').textContent = ''), 1500);
  });
}

$('#clearAll').addEventListener('click', async () => {
  if (!confirm(`Delete ALL saved words? Export a CSV first if you want a backup.${sharedWarning()}`)) return;
  vocab = {};
  await EJ.setVocab(vocab);
});

// ---------- Init ----------
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.syncGroup) sharedNotebook = Boolean(changes.syncGroup.newValue);
  if (area !== 'local' || !(changes.vocab || changes.collections)) return;
  if (changes.vocab) vocab = EJ.rememberData('vocab', changes.vocab.newValue || {});
  if (changes.collections) collections = EJ.rememberData('collections', changes.collections.newValue || {});
  renderNotebook();
  renderReviewOptions();
});

(async () => {
  showTab();
  [vocab, collections] = await Promise.all([EJ.getVocab(), EJ.getCollections()]);
  renderNotebook();
  renderReviewOptions();
  initSettings();
  EJ.send({ type: 'backfillPronunciations' }).catch(() => {});
})();
