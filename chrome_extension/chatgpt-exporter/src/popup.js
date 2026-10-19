import { isChatGptUrl } from "./conversation.js";

const button = document.querySelector("#export");
const status = document.querySelector("#status");

button.addEventListener("click", async () => {
  button.disabled = true;
  status.dataset.error = "false";
  status.textContent = "Starting export...";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !isChatGptUrl(tab.url)) {
      throw new Error("Open a conversation on chatgpt.com first.");
    }
    await startExport(tab.id);
  } catch (error) {
    console.error("Could not start ChatGPT screenshot export", error);
    status.dataset.error = "true";
    status.textContent = error.message || "Could not start export. Reload the page and try again.";
  } finally {
    button.disabled = false;
    button.textContent = "Capture chat page (ZIP)";
  }
});

async function startExport(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [new URL("exporter.js", document.baseURI).pathname.slice(1)],
  });
  status.textContent = "Export started. Close this popup and keep the ChatGPT tab active. Do not scroll or resize the window. Esc cancels.";
}
