// Review games: one engine with lives, combo, points, timer, sounds and persistent XP / streak / best scores.
// Shares globals from vocab.js: $, esc, speak, shuffle, reEscape, highlight, vocab, collections, inView, viewName.

const SESSION_SIZE = 20;
const START_LIVES = 3;
const QUESTION_SECONDS = 20;
const MODE_NAMES = {
  mixed: 'Mixed',
  flash: 'Flashcards',
  choice: 'Multiple choice',
  reverse: 'Meaning → word',
  type: 'Fill in the blank',
  listen: 'Listening',
};
const TYPE_LABELS = {
  flash: '🃏 Flashcard',
  choice: '🔤 Pick the meaning',
  reverse: '🎯 Pick the word',
  type: '✍️ Fill in the blank',
  listen: '🎧 Listen & type',
};

const game = {
  active: false,
  mode: 'mixed',
  view: 'all',
  timed: true,
  queue: [],
  idx: 0,
  total: 0,
  lives: START_LIVES,
  score: 0,
  combo: 0,
  bestCombo: 0,
  answered: 0,
  correct: 0,
  seen: new Set(),
  missed: new Set(),
  requeued: new Set(),
  lastType: '',
  onKey: null,
};
let questionToken = 0;
let timer = null;

// ---------- Sounds (synthesized, no audio files) ----------
const sfx = (() => {
  let ctx = null;
  const enabled = () => localStorage.getItem('ej-sound') !== 'off';
  // notes: [frequency Hz, start s, duration s, waveform]
  const play = (notes, volume = 0.12) => {
    if (!enabled()) return;
    try {
      ctx ||= new AudioContext();
      const t0 = ctx.currentTime + 0.01;
      for (const [freq, start, dur, type = 'sine'] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, t0 + start);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + start);
        osc.stop(t0 + start + dur + 0.02);
      }
    } catch {
      // Audio is optional.
    }
  };
  return {
    right: () => play([[660, 0, 0.1], [880, 0.08, 0.16]]),
    wrong: () => play([[196, 0, 0.28, 'square'], [147, 0.1, 0.3, 'square']], 0.06),
    combo: () => play([[523, 0, 0.08], [659, 0.07, 0.08], [784, 0.14, 0.08], [1047, 0.21, 0.2]]),
    tick: () => play([[1200, 0, 0.04, 'triangle']], 0.05),
    win: () => play([[523, 0, 0.15], [659, 0.15, 0.15], [784, 0.3, 0.15], [1047, 0.45, 0.4]]),
    over: () => play([[392, 0, 0.2, 'triangle'], [330, 0.2, 0.2, 'triangle'], [262, 0.4, 0.45, 'triangle']]),
  };
})();

function renderSoundToggle() {
  const on = localStorage.getItem('ej-sound') !== 'off';
  $('#soundToggle').textContent = on ? '🔈 Sound' : '🔇 Muted';
}
$('#soundToggle').addEventListener('click', () => {
  localStorage.setItem('ej-sound', localStorage.getItem('ej-sound') === 'off' ? 'on' : 'off');
  renderSoundToggle();
});

// ---------- Persistent stats: XP, level, daily streak, best score per mode ----------
const todayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayDiff = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);

async function getStats() {
  const { gameStats } = await chrome.storage.local.get('gameStats');
  return { xp: 0, best: {}, streak: 0, lastDay: '', games: 0, answered: 0, correct: 0, ...gameStats };
}

// Level n needs 100·n XP to reach level n+1.
function levelOf(xp) {
  let lvl = 1;
  let rest = xp;
  while (rest >= lvl * 100) {
    rest -= lvl * 100;
    lvl++;
  }
  return { lvl, into: rest, need: lvl * 100 };
}

const liveStreak = (s) => (s.lastDay && dayDiff(s.lastDay, todayStr()) <= 1 ? s.streak : 0);

async function recordGame(result) {
  const s = await getStats();
  const before = levelOf(s.xp).lvl;
  s.xp += result.xp;
  s.games += 1;
  s.answered += result.answered;
  s.correct += result.correct;
  const today = todayStr();
  if (s.lastDay !== today) {
    s.streak = s.lastDay && dayDiff(s.lastDay, today) === 1 ? s.streak + 1 : 1;
    s.lastDay = today;
  }
  const prevBest = s.best[result.mode] || 0;
  const newBest = result.score > prevBest;
  if (newBest) s.best[result.mode] = result.score;
  await chrome.storage.local.set({ gameStats: s });
  return { stats: s, newBest, prevBest, levelUp: levelOf(s.xp).lvl > before };
}

async function renderStatsBar() {
  const s = await getStats();
  const { lvl, into, need } = levelOf(s.xp);
  const streak = liveStreak(s);
  const best = Math.max(0, ...Object.values(s.best));
  const playedToday = s.lastDay === todayStr();
  $('#gameStats').innerHTML = `
    <div class="gs-item gs-level" title="${s.xp.toLocaleString()} XP total">
      <b>Lv ${lvl}</b>
      <div class="xpbar"><div style="width:${Math.round((into / need) * 100)}%"></div></div>
      <span class="muted">${into}/${need} XP</span>
    </div>
    <div class="gs-item" title="${playedToday ? 'You played today' : 'Play a game today to keep your streak'}">🔥 <b>${streak}</b> day${
      streak === 1 ? '' : 's'
    }${streak && !playedToday ? ' <span class="muted">· play today!</span>' : ''}</div>
    <div class="gs-item" title="Best score across all modes">🏆 <b>${best.toLocaleString()}</b></div>
    <div class="gs-item muted">${s.games} game${s.games === 1 ? '' : 's'} · ${
      s.answered ? Math.round((s.correct / s.answered) * 100) : 0
    }% correct</div>`;
}

// ---------- Setup ----------
function renderReviewOptions() {
  const sel = $('#reviewCollection');
  const prev = sel.value || localStorage.getItem('ej-review-coll') || 'all';
  const words = Object.values(vocab);
  const now = Date.now();
  const opt = (view) => {
    const ws = words.filter((w) => inView(w, view));
    const due = ws.filter((w) => w.srs.due <= now).length;
    return `<option value="${esc(view)}">${esc(viewName(view))} (${due} due / ${ws.length})</option>`;
  };
  const unsorted = words.some((w) => inView(w, 'unsorted'));
  sel.innerHTML = [opt('all'), ...EJ.sortedCollections(collections).map((c) => opt(c.id)), unsorted ? opt('unsorted') : ''].join('');
  sel.value = [...sel.options].some((o) => o.value === prev) ? prev : 'all';
}
$('#reviewCollection').addEventListener('change', (e) => localStorage.setItem('ej-review-coll', e.target.value));
$('#mode').value = localStorage.getItem('ej-mode') || 'mixed';
$('#mode').addEventListener('change', (e) => localStorage.setItem('ej-mode', e.target.value));
$('#timed').checked = localStorage.getItem('ej-timed') !== 'off';
$('#timed').addEventListener('change', (e) => localStorage.setItem('ej-timed', e.target.checked ? 'on' : 'off'));

const choicePool = () => Object.entries(vocab).filter(([, w]) => w.translation);

// Which question types can be asked about this word.
function typesFor(w, mode) {
  const canChoice = w.translation && choicePool().length >= 4;
  const canType = Boolean(w.translation || w.definition);
  if (mode !== 'mixed') {
    if ((mode === 'choice' || mode === 'reverse') && !canChoice) return ['flash'];
    if (mode === 'type' && !canType) return ['flash'];
    return [mode];
  }
  // Mixed: new words are introduced with easier questions, known words get harder recall questions.
  const lvl = EJ.level(w.srs).n;
  let types;
  if (lvl <= 1) types = canChoice ? ['flash', 'choice', 'choice'] : ['flash'];
  else if (lvl === 2) types = canChoice ? ['choice', 'reverse', 'listen'] : ['flash', 'listen'];
  else types = [...(canChoice ? ['reverse'] : []), ...(canType ? ['type', 'type'] : []), 'listen'];
  return types;
}

function pickType(w) {
  const types = typesFor(w, game.mode);
  const fresh = types.filter((t) => t !== game.lastType);
  const pool = fresh.length ? fresh : types;
  return pool[Math.floor(Math.random() * pool.length)];
}

function startGame(keysOverride) {
  const now = Date.now();
  const view = $('#reviewCollection').value || 'all';
  localStorage.setItem('ej-review-coll', view);
  const all = $('#allWords').checked;
  const keys = Array.isArray(keysOverride)
    ? keysOverride.filter((k) => vocab[k])
    : Object.keys(vocab).filter((k) => inView(vocab[k], view) && (all || vocab[k].srs.due <= now));
  Object.assign(game, {
    active: false,
    mode: $('#mode').value,
    view,
    timed: $('#timed').checked,
    queue: shuffle(keys).slice(0, SESSION_SIZE),
    idx: 0,
    lives: START_LIVES,
    score: 0,
    combo: 0,
    bestCombo: 0,
    answered: 0,
    correct: 0,
    seen: new Set(),
    missed: new Set(),
    requeued: new Set(),
    lastType: '',
    onKey: null,
  });
  game.total = game.queue.length;
  stopTimer();
  if (!game.total) {
    const has = Object.values(vocab).some((w) => inView(w, view));
    $('#game').innerHTML = `<div class="done"><div class="big">🎉</div><p>Nothing is due in “${esc(viewName(view))}” right now.</p>
      <p class="muted">${has ? 'Tick “Include words not yet due” to practise anyway.' : 'This collection has no words yet.'}</p></div>`;
    return;
  }
  if ((game.mode === 'choice' || game.mode === 'reverse') && choicePool().length < 4) {
    alert('Multiple choice needs at least 4 words with translations. Words without enough options are shown as flashcards.');
  }
  game.active = true;
  nextCard();
}

// ---------- HUD, timer and feedback effects ----------
function hud(type) {
  const hearts = Array.from({ length: START_LIVES }, (_, i) =>
    `<span class="heart ${i < game.lives ? '' : 'lost'}">${i < game.lives ? '❤️' : '🖤'}</span>`
  ).join('');
  const mult = multiplier(game.combo);
  const pct = Math.round((game.idx / game.queue.length) * 100);
  return `<div class="hud">
      <div class="hearts" title="Lives">${hearts}</div>
      <div class="hud-mid">
        <span class="qtype">${TYPE_LABELS[type]}</span>
        <span class="muted">${Math.min(game.idx + 1, game.queue.length)} / ${game.queue.length}</span>
      </div>
      <div class="hud-right">
        <span class="combo ${game.combo >= 3 ? 'hot' : ''}" title="Combo">🔥 ${game.combo}${mult > 1 ? ` <b>×${mult}</b>` : ''}</span>
        <span class="score" title="Score">${game.score.toLocaleString()}</span>
        <button id="quit" class="quit" title="End game">✕</button>
      </div>
    </div>
    <div class="progress"><div style="width:${pct}%"></div></div>
    ${game.timed && type !== 'flash' ? '<div class="timer"><div id="timerBar"></div><span id="timerText"></span></div>' : ''}`;
}

const multiplier = (combo) => (combo >= 10 ? 3 : combo >= 5 ? 2 : combo >= 3 ? 1.5 : 1);

function stopTimer() {
  clearInterval(timer?.id);
  timer = null;
  document.querySelector('#game .timer')?.classList.add('stopped');
}

// Counts down only while the Review tab is visible, so switching tabs pauses the clock.
function startTimer(onExpire) {
  stopTimer();
  if (!game.timed || !$('#timerBar')) return;
  const total = QUESTION_SECONDS * 1000;
  timer = { left: total, total };
  let last = performance.now();
  const draw = () => {
    const bar = $('#timerBar');
    if (!bar) return;
    bar.style.width = `${(timer.left / total) * 100}%`;
    bar.classList.toggle('low', timer.left <= 5000);
    $('#timerText').textContent = `${Math.ceil(timer.left / 1000)}s`;
  };
  draw();
  timer.id = setInterval(() => {
    const now = performance.now();
    const onReview = !document.hidden && $('#review').classList.contains('active');
    if (onReview) {
      const before = Math.ceil(timer.left / 1000);
      timer.left = Math.max(0, timer.left - (now - last));
      const after = Math.ceil(timer.left / 1000);
      if (after !== before && after <= 3 && after > 0) sfx.tick();
    }
    last = now;
    draw();
    if (timer.left <= 0) {
      stopTimer();
      onExpire();
    }
  }, 100);
}

// Fraction of time left (0..1); 0 when untimed.
const timeLeft = () => (timer && game.timed ? timer.left / timer.total : 0);

function floatText(text, cls = '') {
  const el = document.createElement('div');
  el.className = `float ${cls}`;
  el.textContent = text;
  $('#game').append(el);
  setTimeout(() => el.remove(), 1200);
}

function flash(cls) {
  const g = $('#game');
  g.classList.remove('fx-right', 'fx-wrong');
  void g.offsetWidth; // restart the animation
  g.classList.add(cls);
}

function confetti() {
  const colors = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];
  const box = document.createElement('div');
  box.className = 'confetti';
  box.innerHTML = Array.from({ length: 60 }, () => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.6;
    const dur = 1.6 + Math.random() * 1.4;
    const c = colors[Math.floor(Math.random() * colors.length)];
    return `<i style="left:${left}%;background:${c};animation-delay:${delay}s;animation-duration:${dur}s;transform:rotate(${Math.random() * 360}deg)"></i>`;
  }).join('');
  $('#game').append(box);
  setTimeout(() => box.remove(), 3500);
}

// ---------- Scoring ----------
// quality: 1 = hard (flash) / used hints, 2 = normal, 3 = easy (flash)
async function answer(key, correct, { quality = 2, hints = 0 } = {}) {
  const left = timeLeft();
  stopTimer();
  const w = vocab[key];
  const first = !game.seen.has(key);
  game.seen.add(key);
  if (first && w) {
    // Only the first attempt in a session counts for spaced repetition.
    w.srs = EJ.reviewSrs(w.srs, correct ? Math.max(1, hints ? 1 : quality) : 0);
    await EJ.setVocab(vocab);
  }
  game.answered++;
  let points = 0;
  if (correct) {
    game.correct++;
    game.combo++;
    game.bestCombo = Math.max(game.bestCombo, game.combo);
    const base = quality === 3 ? 120 : quality === 1 ? 60 : 100;
    const speed = Math.round(50 * left);
    const hintPenalty = Math.min(0.6, hints * 0.2);
    points = Math.round((base + speed) * (1 - hintPenalty) * multiplier(game.combo));
    game.score += points;
    flash('fx-right');
    floatText(`+${points}`, 'plus');
    if ([3, 5, 10].includes(game.combo) || (game.combo > 10 && game.combo % 5 === 0)) {
      sfx.combo();
      setTimeout(() => floatText(`🔥 ${game.combo} combo! ×${multiplier(game.combo)}`, 'combo-pop'), 250);
    } else sfx.right();
  } else {
    game.combo = 0;
    game.lives--;
    game.missed.add(key);
    if (!game.requeued.has(key) && game.lives > 0) {
      game.requeued.add(key);
      game.queue.push(key);
    }
    flash('fx-wrong');
    floatText(game.lives > 0 ? '💔 −1 life' : '💔 Out of lives', 'minus');
    sfx.wrong();
  }
  refreshHud();
  if (!correct) document.querySelectorAll('#game .heart')[game.lives]?.classList.add('breaking');
  return points;
}

function refreshHud() {
  const h = document.querySelector('#game .hud');
  if (!h) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = hud(game.currentType);
  h.replaceWith(tmp.querySelector('.hud'));
  const pb = document.querySelector('#game .progress');
  if (pb) pb.replaceWith(tmp.querySelector('.progress'));
  bindQuit();
}

function bindQuit() {
  const q = $('#quit');
  if (q) q.onclick = () => confirm('End this game now? Your answers so far are kept.') && finishGame(true);
}

// Shown after every answer; the Next button also works with Enter.
function showNext(container, extraHtml = '') {
  const over = game.lives <= 0;
  const last = game.idx + 1 >= game.queue.length;
  container.innerHTML = `${extraHtml}<div class="row"><button class="primary" id="next">${
    over ? 'See results →' : last ? 'Finish →' : 'Next →'
  }</button></div>`;
  $('#next').onclick = advance;
  $('#next').focus();
  game.onKey = (e) => {
    if (e.key === 'Enter' && document.activeElement !== $('#next')) (e.preventDefault(), advance());
  };
}

function advance() {
  if (!game.active) return;
  game.idx++;
  if (game.lives <= 0) return finishGame(false);
  nextCard();
}

// ---------- Cards ----------
function answerBlock(w) {
  return `<div class="answer">
    <div class="ans-word">${esc(w.word)} <span class="ej-phon">${esc(EJ.pronText(w.pron) || w.phonetic || '')}</span></div>
    <div class="tr">${esc(w.translation)}</div>
    ${w.definition ? `<div class="muted">${esc(w.definition)}</div>` : ''}
    ${w.context ? `<div class="prompt"><div class="ctx">“${highlight(w.context, w.word)}”</div></div>` : ''}
  </div>`;
}

const blanked = (text, word) => esc(text).replace(new RegExp(reEscape(esc(word)), 'gi'), '<b>_____</b>');
const pronSub = (w) => esc(EJ.pronText(w.pron) || w.phonetic || '');

function nextCard() {
  stopTimer();
  game.onKey = null;
  if (game.idx >= game.queue.length) return finishGame(false);
  const key = game.queue[game.idx];
  const w = vocab[key];
  if (!w) {
    game.idx++;
    return nextCard();
  }
  // Keep keyboard shortcuts from re-triggering toolbar buttons (e.g. Enter on a focused Start button).
  if (!$('#game').contains(document.activeElement)) document.activeElement?.blur();
  const type = pickType(w);
  game.lastType = type;
  game.currentType = type;
  const my = ++questionToken;
  const live = () => game.active && my === questionToken;
  ({ flash: flashCard, choice: choiceCard, reverse: reverseCard, type: typeCard, listen: listenCard })[type](key, w, live);
  bindQuit();
}

function flashCard(key, w, live) {
  $('#game').innerHTML = `${hud('flash')}
    <div class="prompt card-in"><div class="big">${esc(w.word)}</div><div class="sub">${pronSub(w)}</div>
    <button id="say">🔊</button></div>
    <div id="after"><div class="row"><button class="primary" id="reveal">Show answer (Space)</button></div></div>`;
  $('#say').onclick = () => speak(w);
  const reveal = () => {
    if (!live() || !$('#reveal')) return;
    $('#after').innerHTML = `${answerBlock(w)}
      <p class="muted center">How well did you remember it?</p>
      <div class="row">
        <button class="grade-0" data-g="0">1 · Forgot</button>
        <button class="grade-1" data-g="1">2 · Hard</button>
        <button class="grade-2" data-g="2">3 · Good</button>
        <button class="grade-3" data-g="3">4 · Easy</button>
      </div>`;
    document.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => onGrade(Number(b.dataset.g))));
  };
  let graded = false;
  const onGrade = async (g) => {
    if (!live() || graded) return;
    graded = true;
    await answer(key, g > 0, { quality: g });
    // Let the points / lost-life animation play before moving on.
    setTimeout(() => live() && advance(), 650);
  };
  $('#reveal').onclick = reveal;
  game.onKey = (e) => {
    if (e.code === 'Space' && $('#reveal')) (e.preventDefault(), reveal());
    else if (/^[1-4]$/.test(e.key) && !$('#reveal')) onGrade(Number(e.key) - 1);
  };
}

// Shared by "pick the meaning" and "pick the word".
function choiceQuestion(key, w, live, { type, promptHtml, label }) {
  const pool = shuffle(
    choicePool().filter(([k, x]) => k !== key && x.translation !== w.translation && EJ.key(x.word) !== EJ.key(w.word))
  ).slice(0, 3);
  const options = shuffle([[key, w], ...pool]);
  $('#game').innerHTML = `${hud(type)}
    <div class="prompt card-in">${promptHtml}</div>
    <div class="choices">${options
      .map(([k, x], i) => `<button data-k="${esc(k)}"><span class="kbd">${i + 1}</span> ${esc(label(x))}</button>`)
      .join('')}</div>
    <div id="after"></div>`;
  let done = false;
  const pick = async (btn) => {
    if (!live() || done) return;
    done = true;
    const ok = btn?.dataset.k === key;
    document.querySelectorAll('.choices button').forEach((x) => {
      x.disabled = true;
      if (x.dataset.k === key) x.classList.add('right');
    });
    if (btn && !ok) btn.classList.add('wrong');
    await answer(key, ok);
    if (!live()) return;
    if (type === 'reverse' || !ok) speak(w);
    showNext($('#after'), `${btn ? '' : '<div class="feedback bad">⏰ Time’s up!</div>'}${answerBlock(w)}`);
  };
  const buttons = [...document.querySelectorAll('.choices button')];
  buttons.forEach((b) => (b.onclick = () => pick(b)));
  game.onKey = (e) => {
    if (/^[1-4]$/.test(e.key) && buttons[Number(e.key) - 1]) pick(buttons[Number(e.key) - 1]);
  };
  startTimer(() => live() && pick(null));
}

function choiceCard(key, w, live) {
  choiceQuestion(key, w, live, {
    type: 'choice',
    promptHtml: `<div class="big">${esc(w.word)}</div><div class="sub">${pronSub(w)}</div>`,
    label: (x) => x.translation,
  });
  speak(w);
}

function reverseCard(key, w, live) {
  choiceQuestion(key, w, live, {
    type: 'reverse',
    promptHtml: `<div class="big meaning">${esc(w.translation)}</div>${
      w.definition ? `<div class="sub">${esc(w.definition)}</div>` : ''
    }<div class="sub">Which word means this?</div>`,
    label: (x) => x.word,
  });
}

function typeInCard(key, w, live, type, promptHtml) {
  $('#game').innerHTML = `${hud(type)}${promptHtml}
    <form class="typein"><input type="text" id="guess" autocomplete="off" spellcheck="false" placeholder="Type the word…" /><button class="primary">Check</button></form>
    <div class="row"><button id="hint" type="button">💡 Hint</button><button id="skip" type="button">I don't know</button></div>
    <div id="after"></div>`;
  const input = $('#guess');
  input.focus();
  let hints = 0;
  let done = false;
  $('#hint').onclick = () => {
    hints = Math.min(hints + 1, w.word.length);
    input.placeholder = w.word.slice(0, hints) + '·'.repeat(Math.max(0, w.word.length - hints));
    $('#hint').textContent = `💡 Hint (${hints})`;
    input.focus();
  };
  const finish = async (ok, reason = '') => {
    if (!live() || done) return;
    done = true;
    input.disabled = true;
    document.querySelectorAll('.typein button, #hint, #skip').forEach((b) => (b.disabled = true));
    input.classList.add(ok ? 'right' : 'wrong');
    await answer(key, ok, { hints });
    if (!live()) return;
    speak(w);
    showNext(
      $('#after'),
      `<div class="feedback ${ok ? 'ok' : 'bad'}">${ok ? '✓ Correct!' : `${reason}Answer: <b>${esc(w.word)}</b>`}</div>${answerBlock(w)}`
    );
  };
  $('.typein').onsubmit = (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    finish(EJ.key(input.value) === EJ.key(w.word));
  };
  $('#skip').onclick = () => finish(false);
  startTimer(() => finish(false, '⏰ Time’s up! '));
}

function typeCard(key, w, live) {
  const clue = w.context ? blanked(w.context, w.word) : esc(w.definition || '');
  typeInCard(
    key,
    w,
    live,
    'type',
    `<div class="prompt card-in"><div class="big meaning">${esc(w.translation || w.definition)}</div>
     ${clue && clue !== esc(w.translation || w.definition) ? `<div class="ctx">“${clue}”</div>` : ''}
     <div class="sub">${w.word.length} letters · starts with “${esc(w.word[0])}”</div></div>`
  );
}

function listenCard(key, w, live) {
  typeInCard(
    key,
    w,
    live,
    'listen',
    `<div class="prompt card-in"><button id="say" class="big-say">🔊</button>
     <div class="sub">Listen and type what you hear · <a href="#" id="sayUk">UK accent</a></div></div>`
  );
  $('#say').onclick = () => (speak(w), $('#guess').focus());
  $('#sayUk').onclick = (e) => (e.preventDefault(), speak(w, 'uk'), $('#guess').focus());
  speak(w);
}

// ---------- Results ----------
async function finishGame(quit) {
  if (!game.active) return;
  game.active = false;
  game.onKey = null;
  stopTimer();
  questionToken++;
  const survived = game.lives > 0 && !quit;
  const accuracy = game.answered ? Math.round((game.correct / game.answered) * 100) : 0;
  const xp = Math.round(game.score / 10) + (survived && game.answered ? 20 : 0) + (survived && accuracy === 100 ? 30 : 0);
  let rec = null;
  if (game.answered) rec = await recordGame({ mode: game.mode, score: game.score, xp, answered: game.answered, correct: game.correct });
  const lvl = levelOf(rec?.stats.xp ?? 0);
  const missed = [...game.missed].filter((k) => vocab[k]);
  const icon = !game.answered ? '👋' : game.lives <= 0 ? '💔' : accuracy === 100 ? '🏆' : accuracy >= 70 ? '🎉' : '💪';
  const title = !game.answered
    ? 'Game ended'
    : game.lives <= 0
      ? 'Game over'
      : quit
        ? 'Game ended'
        : accuracy === 100
          ? 'Perfect game!'
          : 'Session complete!';
  $('#game').innerHTML = `<div class="done results">
      <div class="big">${icon}</div>
      <h2>${title}</h2>
      <div class="final-score">${game.score.toLocaleString()}<span>points</span></div>
      ${rec?.newBest ? `<div class="badge best">🏆 New best for ${esc(MODE_NAMES[game.mode])}!${rec.prevBest ? ` (was ${rec.prevBest.toLocaleString()})` : ''}</div>` : ''}
      ${rec?.levelUp ? `<div class="badge lvlup">⬆️ Level up! You are now level ${lvl.lvl}</div>` : ''}
      <div class="res-grid">
        <div><b>${accuracy}%</b><span>accuracy</span></div>
        <div><b>${game.correct}/${game.answered}</b><span>correct</span></div>
        <div><b>🔥 ${game.bestCombo}</b><span>best combo</span></div>
        <div><b>+${game.answered ? xp : 0}</b><span>XP</span></div>
      </div>
      ${
        rec
          ? `<div class="res-level"><b>Lv ${lvl.lvl}</b><div class="xpbar"><div style="width:${Math.round(
              (lvl.into / lvl.need) * 100
            )}%"></div></div><span class="muted">${lvl.into}/${lvl.need} XP · 🔥 ${rec.stats.streak}-day streak</span></div>`
          : ''
      }
      ${
        missed.length
          ? `<h3>Words to practise (${missed.length})</h3>
            <div class="missed">${missed
              .map(
                (k) => `<div class="missed-item"><button data-say="${esc(k)}" title="Pronounce">🔊</button>
                  <b>${esc(vocab[k].word)}</b> <span class="ej-phon">${pronSub(vocab[k])}</span>
                  <span class="muted">— ${esc(vocab[k].translation || vocab[k].definition || '')}</span></div>`
              )
              .join('')}</div>`
          : game.answered
            ? '<p class="muted">No mistakes — great job!</p>'
            : ''
      }
      <div class="row">
        <button class="primary" id="again">▶ Play again</button>
        ${missed.length ? `<button id="practiseMissed">🎯 Practise missed words</button>` : ''}
        <a class="btn" href="#notebook">📒 Notebook</a>
      </div>
    </div>`;
  $('#again').onclick = () => startGame();
  if (missed.length) $('#practiseMissed').onclick = () => startGame(missed);
  document.querySelectorAll('[data-say]').forEach((b) => (b.onclick = () => speak(vocab[b.dataset.say])));
  if (game.answered) {
    if (game.lives <= 0) sfx.over();
    else sfx.win();
    if (survived && (accuracy >= 80 || rec?.newBest)) confetti();
  }
  renderStatsBar();
}

// ---------- Wiring ----------
document.addEventListener('keydown', (e) => {
  if (!game.onKey || !$('#review').classList.contains('active')) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return; // typing answers / settings
  game.onKey(e);
});

$('#start').addEventListener('click', () => {
  if (game.active && game.answered && !confirm('Start a new game? The current one will end.')) return;
  game.active = false;
  startGame();
});

renderSoundToggle();
renderStatsBar();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.gameStats) renderStatsBar();
});
