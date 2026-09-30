const $ = (id) => document.getElementById(id);
const result = $('result');

const openPage = (hash) => {
  chrome.tabs.create({ url: chrome.runtime.getURL(`vocab/vocab.html#${hash}`) });
  window.close();
};

async function refreshStats() {
  const [vocab, collections] = await Promise.all([EJ.getVocab(), EJ.getCollections()]);
  $('total').textContent = Object.keys(vocab).length;
  $('due').textContent = EJ.dueCount(vocab);
  $('colls').textContent = Object.keys(collections).length;
}

const lookupCard = EJ.createLookupCard({
  el: result,
  autoSpeak: async () => (await EJ.getSettings()).autoSpeak,
});

function lookup(text) {
  text = EJ.normalize(text);
  if (!text) return;
  result.hidden = false;
  lookupCard.open(text);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.vocab || changes.collections)) refreshStats();
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
