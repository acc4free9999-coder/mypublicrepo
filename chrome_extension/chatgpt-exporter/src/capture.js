const messageSelector = '[data-message-author-role], [data-user-message-bubble="true"], [data-markdown-text-style="assistant-message"], [data-turn="user"], [data-turn="assistant"]';
const bottomOverlaySelector = [
  '[data-thread-scroll-footer="true"]',
  '[data-pip-obstacle="thread-footer"]',
  'form[data-chatgpt-composer]',
  'form[data-composer-placement="thread"]',
  'form[data-thread-find-composer]',
  'form:has(#prompt-textarea)',
  '[data-type="unified-composer"]',
  '[data-testid="scroll-to-bottom-button"]',
  'button[aria-label="Scroll to bottom"]',
  'button[class~="group/scroll-to-bottom"]',
].join(", ");

export function findConversation(document) {
  const messages = [...document.querySelectorAll(messageSelector)]
    .filter((node) => !node.closest('[hidden], [aria-hidden="true"]'));
  if (!messages.length) throw new Error("No conversation found. Open a chat with messages and close any dialogs.");
  const content = messages[0].closest('[data-thread-user-message-navigation-content], [data-thread-find-target="conversation"]') ||
    messages[0].closest("main");
  if (!content) throw new Error("Could not locate the conversation area in this ChatGPT layout.");
  const view = document.defaultView;
  let scroller = messages[0].parentElement;
  while (scroller && scroller !== document.body) {
    const style = view.getComputedStyle(scroller);
    if (/(auto|scroll)/.test(style.overflowY) && scroller.clientHeight > 0 &&
        scroller.scrollHeight > scroller.clientHeight) break;
    scroller = scroller.parentElement;
  }
  if (!scroller || scroller === document.body) scroller = document.scrollingElement;
  if (!scroller) throw new Error("Could not locate the chat's scroll container.");
  return { content, scroller };
}

export function captureBounds(document, content, scroller) {
  const view = document.defaultView;
  const rootScroll = scroller === document.scrollingElement;
  const rect = rootScroll
    ? { left: 0, top: 0, right: view.innerWidth, bottom: view.innerHeight }
    : scroller.getBoundingClientRect();
  const area = content.getBoundingClientRect();
  const left = Math.max(0, rect.left, area.left);
  const right = Math.min(view.innerWidth, rect.right, area.right);
  let top = Math.max(0, rect.top);
  let bottom = Math.min(view.innerHeight, rect.bottom);
  // Exclude overlapping page chrome without altering the conversation's styling.
  const overlays = document.querySelectorAll('main header, [data-app-shell-main-titlebar], form:has(#prompt-textarea), [data-type="unified-composer"]');
  for (const overlay of overlays) {
    const style = view.getComputedStyle(overlay);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const box = overlay.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0 || box.right <= left || box.left >= right) continue;
    if (box.top <= top && box.bottom > top) top = box.bottom;
  }
  // Never count pixels under the composer/footer as captured conversation content.
  for (const overlay of document.querySelectorAll(bottomOverlaySelector)) {
    if (overlay.closest(messageSelector)) continue;
    const style = view.getComputedStyle(overlay);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const box = overlay.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0 || box.right <= left || box.left >= right) continue;
    if (box.bottom > top && box.top < bottom) bottom = Math.max(top, box.top);
  }

  if (right - left < 100 || bottom - top < 100) {
    throw new Error("The conversation area is too small or covered. Close dialogs and enlarge the browser window.");
  }
  return { left, top, width: right - left, height: bottom - top, viewportWidth: view.innerWidth, viewportHeight: view.innerHeight };
}

export function hideCaptureOverlays(document) {
  const changed = [];
  for (const node of document.querySelectorAll(bottomOverlaySelector)) {
    if (node.closest(messageSelector)) continue;
    if (node.style.getPropertyValue("visibility") === "hidden" &&
        node.style.getPropertyPriority("visibility") === "important") continue;
    changed.push({ node, value: node.style.getPropertyValue("visibility"), priority: node.style.getPropertyPriority("visibility") });
    node.style.setProperty("visibility", "hidden", "important");
  }
  return () => {
    for (const { node, value, priority } of changed) {
      if (value) node.style.setProperty("visibility", value, priority);
      else node.style.removeProperty("visibility");
    }
  };
}

export function cropCoordinates(bounds, imageWidth, imageHeight) {
  const values = [bounds.left, bounds.top, bounds.width, bounds.height, bounds.viewportWidth, bounds.viewportHeight, imageWidth, imageHeight];
  if (!values.every(Number.isFinite) || bounds.left < 0 || bounds.top < 0 ||
      bounds.width <= 0 || bounds.height <= 0 || bounds.viewportWidth <= 0 || bounds.viewportHeight <= 0 ||
      imageWidth <= 0 || imageHeight <= 0 ||
      bounds.left + bounds.width > bounds.viewportWidth + 1 ||
      bounds.top + bounds.height > bounds.viewportHeight + 1) {
    throw new Error("Invalid screenshot crop area.");
  }
  const x = Math.round(bounds.left * imageWidth / bounds.viewportWidth);
  const y = Math.round(bounds.top * imageHeight / bounds.viewportHeight);
  const right = Math.min(imageWidth, Math.round((bounds.left + bounds.width) * imageWidth / bounds.viewportWidth));
  const bottom = Math.min(imageHeight, Math.round((bounds.top + bounds.height) * imageHeight / bounds.viewportHeight));
  if (right <= x || bottom <= y) throw new Error("Screenshot crop area contains no pixels.");
  return { x, y, width: right - x, height: bottom - y };
}

export function planCapture(bounds, scrollTop, scrollerTop, scrollHeight, covered) {
  const inset = bounds.top - scrollerTop;
  const visibleStart = scrollTop + inset;
  const visibleEnd = Math.min(visibleStart + bounds.height, scrollHeight);
  const start = covered === null ? visibleStart : covered;
  // Revisit a small overlap so sticky headers and scroll rounding cannot skip content.
  const retryOffset = Math.max(0, start - inset - 48);
  if (visibleStart > start + 0.01) return { retryOffset };
  if (visibleEnd <= start) return {
    stalled: true,
    nextOffset: Math.max(0, start - inset),
    visibleEnd,
  };
  return {
    bounds: { ...bounds, top: bounds.top + start - visibleStart, height: visibleEnd - start },
    start,
    end: visibleEnd,
    nextOffset: Math.max(0, visibleEnd - inset - 48),
  };
}

export async function waitForStableCapture(document, content, scroller, checkCancelled) {
  let previous;
  let stable = 0;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    checkCancelled();
    const bounds = captureBounds(document, content, scroller);
    const geometry = [scroller.scrollTop, scroller.scrollHeight, bounds.left, bounds.top, bounds.width, bounds.height,
      content.getBoundingClientRect().top, content.getBoundingClientRect().height];
    if (previous && geometry.every((value, index) => Math.abs(value - previous[index]) < 0.1)) stable++;
    else stable = 0;
    if (stable >= 3) return bounds;
    previous = geometry;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The chat layout keeps moving. Wait for images and responses to finish, then retry.");
}

export async function waitForVisibleImages(document, bounds, checkCancelled) {
  const deadline = Date.now() + 15000;
  while (true) {
    checkCancelled();
    const images = [...document.images].filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > bounds.top &&
        rect.top < bounds.top + bounds.height && rect.right > bounds.left && rect.left < bounds.left + bounds.width;
    });
    const broken = images.find((image) => image.complete && image.naturalWidth === 0);
    if (broken) throw new Error("A visible chat image failed to load. Reload the image on the page and try again.");
    if (images.every((image) => image.complete && image.naturalWidth > 0)) return;
    if (Date.now() >= deadline) throw new Error("Timed out waiting for visible chat images. Let them load and retry.");
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}
