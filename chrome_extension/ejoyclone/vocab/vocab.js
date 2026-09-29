const $ = (sel) => document.querySelector(sel);
const esc = EJ.esc;
const speak = (text) => EJ.send({ type: 'speak', text }).catch(() => {});
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

function renderList() {
  const q = EJ.key($('#filter').value);
  const sort = $('#sort').value;
  let items = Object.entries(vocab);
  if (q) items = items.filter(([, w]) => [w.word, w.translation, w.definition, w.context].join(' ').toLowerCase().includes(q));
  const sorters = {
    new: (a, b) => b[1].createdAt - a[1].createdAt,
    az: (a, b) => a[1].word.localeCompare(b[1].word),
    due: (a, b) => a[1].srs.due - b[1].srs.due,
    weak: (a, b) => a[1].srs.interval - b[1].srs.interval || b[1].srs.lapses - a[1].srs.lapses,
  };
  items.sort(sorters[sort]);

  const total = Object.keys(vocab).length;
  $('#summary').textContent = `${total} word${total === 1 ? '' : 's'} saved · ${EJ.dueCount(vocab)} due for review`;
  $('#list').innerHTML = items.length
    ? items
        .map(([k, w]) => {
          const lvl = EJ.level(w.srs);
          return `
          <div class="word" data-key="${esc(k)}">
            <h3>${esc(w.word)} <small>${esc(w.phonetic)}</small></h3>
            <div class="side">
              <span class="lvl lvl-${lvl.n}" title="Next review ${esc(fmtDue(w.srs.due))}">${lvl.label}</span>
              <span class="muted">${esc(fmtDue(w.srs.due))}</span>
              <div><button data-act="speak" title="Pronounce">🔊</button> <button data-act="delete" title="Delete">🗑</button></div>
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
          </div>`;
        })
        .join('')
    : `<p class="muted">${total ? 'No matches.' : 'No words yet. Select any text on a web page and click the green droplet to save words.'}</p>`;
}

$('#list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const key = btn.closest('.word').dataset.key;
  if (btn.dataset.act === 'speak') speak(vocab[key].word);
  if (btn.dataset.act === 'delete' && confirm(`Delete “${vocab[key].word}”?`)) {
    delete vocab[key];
    await EJ.setVocab(vocab);
  }
});
$('#filter').addEventListener('input', renderList);
$('#sort').addEventListener('change', renderList);

// ---------- CSV import / export ----------
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

$('#exportCsv').addEventListener('click', () => {
  const header = ['word', 'phonetic', 'translation', 'definition', 'context', 'url'];
  const rows = Object.values(vocab).map((w) => header.map((h) => csvCell(w[h])).join(','));
  const blob = new Blob(['\ufeff' + [header.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'droplet-vocabulary.csv' });
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

$('#importCsv').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const rows = parseCsv((await file.text()).replace(/^\ufeff/, ''));
  const first = rows[0]?.map((h) => h.trim().toLowerCase()) || [];
  const hasHeader = first.includes('word');
  const cols = hasHeader ? first : ['word', 'translation', 'definition'];
  let added = 0;
  for (const r of hasHeader ? rows.slice(1) : rows) {
    const rec = Object.fromEntries(cols.map((c, i) => [c, (r[i] || '').trim()]));
    const k = EJ.key(rec.word);
    if (!k) continue;
    vocab[k] = {
      word: rec.word,
      phonetic: rec.phonetic || vocab[k]?.phonetic || '',
      translation: rec.translation || vocab[k]?.translation || '',
      definition: rec.definition || vocab[k]?.definition || '',
      context: rec.context || vocab[k]?.context || '',
      url: rec.url || vocab[k]?.url || '',
      title: vocab[k]?.title || '',
      createdAt: vocab[k]?.createdAt || Date.now(),
      srs: vocab[k]?.srs || EJ.newSrs(),
    };
    added++;
  }
  await EJ.setVocab(vocab);
  e.target.value = '';
  alert(`Imported ${added} word(s).`);
});

// ---------- Review games ----------
const game = { queue: [], idx: 0, total: 0, correct: 0, mode: 'flash', requeued: new Set() };

async function grade(key, g) {
  if (!vocab[key]) return;
  vocab[key].srs = EJ.reviewSrs(vocab[key].srs, g);
  if (g > 0) game.correct++;
  else if (!game.requeued.has(key)) {
    game.requeued.add(key);
    game.queue.push(key);
  }
  await EJ.setVocab(vocab);
}

function startGame() {
  const all = $('#allWords').checked;
  const now = Date.now();
  const keys = Object.keys(vocab).filter((k) => all || vocab[k].srs.due <= now);
  game.mode = $('#mode').value;
  game.queue = shuffle(keys).slice(0, 20);
  game.idx = 0;
  game.total = game.queue.length;
  game.correct = 0;
  game.requeued = new Set();
  if (!game.total) {
    $('#game').innerHTML = `<div class="done"><div class="big">🎉</div><p>Nothing is due right now.</p>
      <p class="muted">${Object.keys(vocab).length ? 'Tick “Include words not yet due” to practise anyway.' : 'Save some words first.'}</p></div>`;
    return;
  }
  if (game.mode === 'choice' && Object.values(vocab).filter((w) => w.translation).length < 4) {
    game.mode = 'flash';
    alert('Multiple choice needs at least 4 words with translations — switching to flashcards.');
  }
  nextCard();
}

function progress() {
  const pct = Math.round((game.idx / game.queue.length) * 100);
  return `<div class="progress"><div style="width:${pct}%"></div></div>`;
}

function answerBlock(w) {
  return `<div class="answer">
    <div class="tr">${esc(w.translation)}</div>
    ${w.definition ? `<div class="muted">${esc(w.definition)}</div>` : ''}
    ${w.context ? `<div class="prompt"><div class="ctx">“${highlight(w.context, w.word)}”</div></div>` : ''}
  </div>`;
}

function blanked(text, word) {
  return esc(text).replace(new RegExp(reEscape(esc(word)), 'gi'), '<b>_____</b>');
}

function nextCard() {
  if (game.idx >= game.queue.length) {
    const firstTry = game.total ? Math.round((Math.min(game.correct, game.total) / game.total) * 100) : 0;
    $('#game').innerHTML = `<div class="done"><div class="big">✅</div><h2>Session complete!</h2>
      <p>You reviewed ${game.total} word(s). Score: ${firstTry}%</p>
      <button class="primary" id="again">Play again</button></div>`;
    $('#again').onclick = startGame;
    return;
  }
  const key = game.queue[game.idx];
  const w = vocab[key];
  if (!w) {
    game.idx++;
    return nextCard();
  }
  ({ flash: flashCard, choice: choiceCard, type: typeCard, listen: listenCard })[game.mode](key, w);
}

const advance = () => {
  game.idx++;
  nextCard();
};

function flashCard(key, w) {
  $('#game').innerHTML = `${progress()}
    <div class="prompt"><div class="big">${esc(w.word)}</div><div class="sub">${esc(w.phonetic)}</div>
    <button id="say">🔊</button></div>
    <div class="row"><button class="primary" id="reveal">Show answer (Space)</button></div>`;
  $('#say').onclick = () => speak(w.word);
  const reveal = () => {
    $('#reveal').parentElement.outerHTML = `${answerBlock(w)}
      <div class="row">
        <button class="grade-0" data-g="0">1 · Again</button>
        <button class="grade-1" data-g="1">2 · Hard</button>
        <button class="grade-2" data-g="2">3 · Good</button>
        <button class="grade-3" data-g="3">4 · Easy</button>
      </div>`;
    document.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => onGrade(Number(b.dataset.g))));
  };
  const onGrade = async (g) => {
    document.onkeydown = null;
    await grade(key, g);
    advance();
  };
  $('#reveal').onclick = reveal;
  document.onkeydown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space' && $('#reveal')) (e.preventDefault(), reveal());
    else if (/^[1-4]$/.test(e.key) && !$('#reveal')) onGrade(Number(e.key) - 1);
  };
}

function choiceCard(key, w) {
  document.onkeydown = null;
  const pool = shuffle(
    Object.entries(vocab).filter(([k, x]) => k !== key && x.translation && x.translation !== w.translation)
  ).slice(0, 3);
  const options = shuffle([[key, w], ...pool]);
  $('#game').innerHTML = `${progress()}
    <div class="prompt"><div class="big">${esc(w.word)}</div><div class="sub">${esc(w.phonetic)}</div></div>
    <div class="choices">${options.map(([k, x]) => `<button data-k="${esc(k)}">${esc(x.translation)}</button>`).join('')}</div>
    <div id="after"></div>`;
  speak(w.word);
  document.querySelectorAll('.choices button').forEach((b) => {
    b.onclick = async () => {
      const ok = b.dataset.k === key;
      document.querySelectorAll('.choices button').forEach((x) => {
        x.disabled = true;
        if (x.dataset.k === key) x.classList.add('right');
      });
      if (!ok) b.classList.add('wrong');
      await grade(key, ok ? 2 : 0);
      $('#after').innerHTML = `${answerBlock(w)}<div class="row"><button class="primary" id="next">Next →</button></div>`;
      $('#next').onclick = advance;
      $('#next').focus();
    };
  });
}

function typeInCard(key, w, promptHtml) {
  document.onkeydown = null;
  $('#game').innerHTML = `${progress()}${promptHtml}
    <form class="typein"><input type="text" id="guess" autocomplete="off" placeholder="Type the word…" /><button class="primary">Check</button></form>
    <div class="row"><button id="hint">💡 Hint</button><button id="skip">I don't know</button></div>
    <div id="after"></div>`;
  const input = $('#guess');
  input.focus();
  let hints = 0;
  $('#hint').onclick = () => {
    hints = Math.min(hints + 1, w.word.length);
    input.placeholder = w.word.slice(0, hints) + '·'.repeat(Math.max(0, w.word.length - hints));
    input.focus();
  };
  const finish = async (ok) => {
    input.disabled = true;
    document.querySelectorAll('.typein button, #hint, #skip').forEach((b) => (b.disabled = true));
    await grade(key, ok ? (hints ? 1 : 2) : 0);
    $('#after').innerHTML = `<div class="feedback ${ok ? 'ok' : 'bad'}">${ok ? 'Correct!' : `Answer: ${esc(w.word)}`}</div>
      ${answerBlock(w)}<div class="row"><button class="primary" id="next">Next →</button></div>`;
    speak(w.word);
    $('#next').onclick = advance;
    $('#next').focus();
  };
  $('.typein').onsubmit = (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    finish(EJ.key(input.value) === EJ.key(w.word));
  };
  $('#skip').onclick = () => finish(false);
}

function typeCard(key, w) {
  const clue = w.context ? blanked(w.context, w.word) : esc(w.definition || '');
  typeInCard(
    key,
    w,
    `<div class="prompt"><div class="big" style="font-size:24px">${esc(w.translation || w.definition)}</div>
     ${clue ? `<div class="ctx">“${clue}”</div>` : ''}
     <div class="sub">${w.word.length} letters</div></div>`
  );
}

function listenCard(key, w) {
  typeInCard(
    key,
    w,
    `<div class="prompt"><button id="say" style="font-size:40px;padding:16px 28px">🔊</button>
     <div class="sub">Listen and type what you hear</div></div>`
  );
  $('#say').onclick = () => (speak(w.word), $('#guess').focus());
  speak(w.word);
}

$('#start').addEventListener('click', startGame);

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
  if (!confirm('Delete ALL saved words? Export a CSV first if you want a backup.')) return;
  vocab = {};
  await EJ.setVocab(vocab);
});

// ---------- Init ----------
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.vocab) {
    vocab = changes.vocab.newValue || {};
    renderList();
  }
});

(async () => {
  showTab();
  vocab = await EJ.getVocab();
  renderList();
  initSettings();
})();
