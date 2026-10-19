import { canvasPng, createArchive, downloadArchive } from "./archive.js";
import { isChatGptUrl, safeFilename } from "./conversation.js";
import { captureBounds, cropCoordinates, findConversation, hideCaptureOverlays, planCapture, waitForStableCapture, waitForVisibleImages } from "./capture.js";

const exportKey = "__chatGptImageExportRunning";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createStatus() {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:24px;bottom:24px;z-index:2147483647";
  const shadow = host.attachShadow({ mode: "closed" });
  const panel = document.createElement("div");
  panel.style.cssText = "max-width:350px;padding:18px;border:1px solid #b9d5c9;border-radius:12px;background:white;color:#182c25;box-shadow:0 8px 35px #0003;font:14px/1.5 system-ui,sans-serif";
  const text = document.createElement("p");
  text.style.cssText = "margin:0 0 12px";
  text.setAttribute("role", "status");
  text.setAttribute("aria-live", "polite");
  text.textContent = "Preparing real page screenshots. Keep this tab active. Press Esc to cancel.";
  const button = document.createElement("button");
  button.textContent = "Cancel";
  panel.append(text, button);
  shadow.append(panel);
  document.documentElement.append(host);
  return { host, text, button };
}

async function exportScreenshots() {
  if (globalThis[exportKey]) return;
  globalThis[exportKey] = true;
  const status = createStatus();
  let cancelled = false;
  let scroller;
  let saved;
  let restoreOverlays;
  let overlayObserver;
  let scrollSpacer;
  let extraScroll = 0;
  const cancel = () => { cancelled = true; };
  const keydown = (event) => { if (event.key === "Escape") cancel(); };
  const checkCancelled = () => {
    if (cancelled) throw new DOMException("Export cancelled.", "AbortError");
    if (document.visibilityState === "hidden") throw new Error("The chat tab is no longer visible. Keep it active during export.");
  };
  status.button.onclick = cancel;
  document.addEventListener("keydown", keydown);
  try {
    if (!isChatGptUrl(location.href)) throw new Error("Open a conversation on chatgpt.com first.");
    const conversation = findConversation(document);
    scroller = conversation.scroller;
    saved = {
      top: scroller.scrollTop,
      left: scroller.scrollLeft,
      behavior: scroller.style.getPropertyValue("scroll-behavior"),
      priority: scroller.style.getPropertyPriority("scroll-behavior"),
      snap: scroller.style.getPropertyValue("scroll-snap-type"),
      snapPriority: scroller.style.getPropertyPriority("scroll-snap-type"),
    };
    scroller.style.setProperty("scroll-behavior", "auto", "important");
    scroller.style.setProperty("scroll-snap-type", "none", "important");
    const restorers = [hideCaptureOverlays(document)];
    overlayObserver = new MutationObserver(() => {
      restorers.push(hideCaptureOverlays(document));
    });
    overlayObserver.observe(document.documentElement, { childList: true, subtree: true });
    restoreOverlays = () => {
      for (const restore of restorers.reverse()) restore();
    };
    scroller.scrollTop = 0;
    await pause(600);
    const screenshots = [];
    const viewport = { width: innerWidth, height: innerHeight, ratio: devicePixelRatio };
    let offset = 0;
    let covered = null;
    let retries = 0;
    while (true) {
      checkCancelled();
      scroller.scrollTop = offset;
      await pause(650);
      checkCancelled();
      if (innerWidth !== viewport.width || innerHeight !== viewport.height || devicePixelRatio !== viewport.ratio) {
        throw new Error("The browser size or zoom changed. Retry without resizing the window.");
      }
      let bounds = captureBounds(document, conversation.content, scroller);
      await waitForVisibleImages(document, bounds, checkCancelled);
      bounds = await waitForStableCapture(document, conversation.content, scroller, checkCancelled);
      const scrollerTop = scroller === document.scrollingElement
        ? 0
        : scroller.getBoundingClientRect().top + scroller.clientTop;
      const targetHeight = scroller.scrollHeight - extraScroll;
      if (covered !== null && targetHeight - covered <= 1) break;
      const plan = planCapture(bounds, scroller.scrollTop, scrollerTop, targetHeight, covered);
      if (plan.stalled) {
        const maximumScroll = scroller.scrollHeight - scroller.clientHeight;
        if (scroller.scrollTop < maximumScroll - 1 && ++retries <= 3) {
          offset = Math.min(maximumScroll, Math.max(scroller.scrollTop + 48, plan.nextOffset));
          continue;
        }
        if (!scrollSpacer && scroller.scrollTop >= maximumScroll - 1) {
          const previousHeight = scroller.scrollHeight;
          scrollSpacer = document.createElement("div");
          scrollSpacer.setAttribute("aria-hidden", "true");
          const missing = Math.max(0, targetHeight - plan.visibleEnd);
          scrollSpacer.style.cssText = `display:block!important;height:${Math.ceil(missing + 64)}px!important;min-height:${Math.ceil(missing + 64)}px!important;flex:0 0 auto!important;pointer-events:none!important`;
          const parent = scroller === document.scrollingElement ? document.body : scroller;
          parent.append(scrollSpacer);
          await pause(100);
          extraScroll = scroller.scrollHeight - previousHeight;
          if (extraScroll > missing) {
            retries = 0;
            offset = plan.nextOffset;
            continue;
          }
        }
        throw new Error(`Capture cannot reach the remaining content (scroll=${scroller.scrollTop.toFixed(2)}, max=${maximumScroll.toFixed(2)}, captured=${covered?.toFixed(2)}, visibleEnd=${plan.visibleEnd.toFixed(2)}, target=${targetHeight.toFixed(2)}, viewport=${bounds.height.toFixed(2)}). Please share these measurements.`);
      }
      if (plan.retryOffset !== undefined) {
        if (++retries > 3) throw new Error("The chat moved between screenshots. Retry after the page finishes loading.");
        offset = plan.retryOffset;
        continue;
      }
      bounds = plan.bounds;
      const capturedTop = scroller.scrollTop;
      const capturedHeight = scroller.scrollHeight;
      const contentRect = conversation.content.getBoundingClientRect();
      status.text.textContent = `Capturing section ${screenshots.length + 1}. Keep this tab active. Esc cancels.`;
      status.host.style.visibility = "hidden";
      let response;
      try {
        await pause(100);
        checkCancelled();
        response = await chrome.runtime.sendMessage({ type: "capture-conversation" });
      } finally {
        status.host.style.visibility = "visible";
      }
      if (!response?.data) throw new Error(response?.error || "Chrome could not capture the tab.");
      checkCancelled();
      const currentRect = conversation.content.getBoundingClientRect();
      if (Math.abs(scroller.scrollTop - capturedTop) > 0.1 ||
          Math.abs(scroller.scrollHeight - capturedHeight) > 0.1 ||
          Math.abs(currentRect.top - contentRect.top) > 0.1 ||
          Math.abs(currentRect.height - contentRect.height) > 0.1) {
        if (++retries > 3) throw new Error("The chat moved during capture. Wait for the page to settle and retry.");
        continue;
      }
      const blob = await (await fetch(response.data)).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      try {
        const crop = cropCoordinates(bounds, bitmap.width, bitmap.height);
        canvas.width = crop.width;
        canvas.height = crop.height;
        canvas.getContext("2d").drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
        screenshots.push(await canvasPng(canvas));
      } finally {
        bitmap.close();
        canvas.width = canvas.height = 0;
      }
      retries = 0;
      covered = plan.end;
      if (covered >= scroller.scrollHeight - extraScroll - 1) break;
      offset = plan.nextOffset;
    }
    status.text.textContent = `Packing ${screenshots.length} real page screenshots...`;
    await pause(0);
    checkCancelled();
    const archive = createArchive(screenshots);
    checkCancelled();
    downloadArchive(archive, safeFilename(document.title), document);
    status.text.textContent = `Download started: ZIP with ${screenshots.length} PNG screenshots of the ChatGPT page.`;
  } catch (error) {
    if (error.name === "AbortError") {
      status.text.textContent = "Export cancelled. No ZIP was downloaded.";
    } else {
      console.error("ChatGPT page screenshot export failed", error);
      status.text.textContent = `Export failed: ${error.message || "Unknown error"}`;
    }
  } finally {
    overlayObserver?.disconnect();
    scrollSpacer?.remove();
    restoreOverlays?.();
    if (scroller && saved) {
      scroller.scrollTop = saved.top;
      scroller.scrollLeft = saved.left;
      if (saved.behavior) scroller.style.setProperty("scroll-behavior", saved.behavior, saved.priority);
      else scroller.style.removeProperty("scroll-behavior");
      if (saved.snap) scroller.style.setProperty("scroll-snap-type", saved.snap, saved.snapPriority);
      else scroller.style.removeProperty("scroll-snap-type");
    }
    document.removeEventListener("keydown", keydown);
    globalThis[exportKey] = false;
    status.host.style.visibility = "visible";
    status.button.textContent = "Close";
    status.button.onclick = () => status.host.remove();
  }
}

void exportScreenshots();
