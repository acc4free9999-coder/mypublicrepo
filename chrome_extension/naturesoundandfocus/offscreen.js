/* global chrome, SynthMixer */
let mixer;
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "offscreen") return false;
  (async () => {
    if (message.type !== "mix") throw new Error("Unknown audio action.");
    mixer ||= new SynthMixer(new AudioContext());
    await mixer.apply(message.mixer);
  })().then(
    () => sendResponse({ ok: true }),
    error => {
      console.error("Still: audio playback failed", error);
      sendResponse({ ok: false, error: error.message });
    }
  );
  return true;
});
