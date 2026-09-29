const $ = (id) => document.getElementById(id);
const result = $('result');
let current = null; // { data, saved }
let seq = 0;

const openPage = (hash) => {
  chrome.tabs.create({ url: chrome.runtime.getURL(`vocab/vocab.html#${hash}`) });
  window.close();
};

async function refreshStats() {
  const vocab = await EJ.getVocab();
  $('total').textContent = Object.keys(vocab).length;
  $('due').textContent = EJ.dueCount(vocab);
}

const render = () => (result.innerHTML = EJ.renderResult(current.data, { saved: current.saved }));

async function lookup(text) {
  text = EJ.normalize(text);
  if (!text) return;
  const my = ++seq;
  current = { data: { text }, saved: false };
  result.hidden = false;
  result.innerHTML = '<div class="ej-loading">Looking up…</div>';
  EJ.send({ type: 'isSaved', text }).then((saved) => {
    if (my !== seq) return;
    current.saved = saved;
    render();
  });
  const data = await EJ.lookup(text, (partial) => {
    if (my !== seq) return;
    current.data = partial;
    render();
  });
  if (my !== seq) return;
  if (current.saved && data.dict) EJ.send({ type: 'save', data });
  const { autoSpeak } = await EJ.getSettings();
  if (autoSpeak && !data.error) EJ.send({ type: 'speak', text });
}

result.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || !current) return;
  if (btn.dataset.act === 'speak') EJ.send({ type: 'speak', text: current.data.text });
  if (btn.dataset.act === 'save') {
    await EJ.send(current.saved ? { type: 'remove', text: current.data.text } : { type: 'save', data: current.data });
    current.saved = !current.saved;
    render();
    refreshStats();
  }
});

$('search').addEventListener('submit', (e) => {
  e.preventDefault();
  lookup($('q').value);
});
$('openNotebook').addEventListener('click', () => openPage('notebook'));
$('openReview').addEventListener('click', () => openPage('review'));
$('settings').addEventListener('click', (e) => {
  e.preventDefault();
  openPage('settings');
});

refreshStats();
const initial = new URLSearchParams(location.search).get('q');
if (initial) {
  $('q').value = initial;
  lookup(initial);
}
