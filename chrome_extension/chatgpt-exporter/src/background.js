import { isChatGptUrl } from "./conversation.js";

let capturing = false;
let lastCapture = 0;

async function capture(sender) {
  if (capturing) throw new Error("Another screenshot is in progress. Retry the export.");
  capturing = true;
  try {
    const assertActive = async () => {
      const [active] = await chrome.tabs.query({ active: true, windowId: sender.tab.windowId });
      if (active?.id !== sender.tab.id || !isChatGptUrl(active.url)) {
        throw new Error("The active tab changed. Keep the ChatGPT tab active during export.");
      }
    };
    await assertActive();
    const delay = Math.max(0, 600 - (Date.now() - lastCapture));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    await assertActive();
    lastCapture = Date.now();
    const data = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" });
    await assertActive();
    return { data };
  } finally {
    capturing = false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "capture-conversation") return;
  if (!sender.tab || !isChatGptUrl(sender.url) || sender.frameId !== 0) {
    respond({ error: "Screenshots must be requested from the main ChatGPT tab." });
    return;
  }
  capture(sender).then(respond).catch((error) => {
    console.error("ChatGPT tab capture failed", error);
    respond({ error: error.message });
  });
  return true;
});
