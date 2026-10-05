let context;

async function chime() {
  context ||= new AudioContext();
  await context.resume();
  const start = context.currentTime;
  for (const [offset, frequency] of [[0, 660], [0.18, 880]]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start + offset);
    gain.gain.linearRampToValueAtTime(0.18, start + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + offset + 0.55);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.6);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "offscreen") return false;
  chime().then(
    () => sendResponse({ ok: true }),
    error => {
      console.error("Reminder List: sound failed", error);
      sendResponse({ ok: false, error: error.message });
    }
  );
  return true;
});
