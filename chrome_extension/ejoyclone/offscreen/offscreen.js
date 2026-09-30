let player = null;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return false;
  if (player) {
    player.pause();
    player = null;
  }
  if (msg.type === 'offscreen-stop') {
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type !== 'offscreen-play') return false;
  const audio = new Audio(msg.url);
  player = audio;
  audio
    .play()
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
  return true;
});
