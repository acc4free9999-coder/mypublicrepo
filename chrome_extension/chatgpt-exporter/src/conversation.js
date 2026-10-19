import { imageSource } from "./images.js";

const allowedTags = new Set([
  "P", "DIV", "SPAN", "BR", "HR", "H1", "H2", "H3", "H4", "H5", "H6",
  "UL", "OL", "LI", "STRONG", "B", "EM", "I", "S", "DEL", "U",
  "BLOCKQUOTE", "PRE", "CODE", "TABLE", "THEAD", "TBODY", "TFOOT", "TR",
  "TH", "TD", "A", "SUP", "SUB", "DL", "DT", "DD",
]);
const ignoredTags = new Set([
  "SCRIPT", "STYLE", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "NOSCRIPT",
  "IFRAME", "OBJECT", "EMBED",
]);

export function isChatGptUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["chatgpt.com", "chat.openai.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function safeFilename(title) {
  const name = title
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[. ]+|[. ]+$/g, "")
    .slice(0, 100)
    .trim();
  return `${name || "ChatGPT conversation"}.zip`;
}

export function copyContent(source, targetDocument) {
  const fragment = targetDocument.createDocumentFragment();
  for (const child of source.childNodes) {
    if (child.nodeType === 3) {
      fragment.append(targetDocument.createTextNode(child.textContent));
      continue;
    }
    if (child.nodeType !== 1) continue;
    if (child.tagName === "BUTTON" && child.querySelector("img")) {
      for (const image of child.querySelectorAll("img")) {
        const wrapper = targetDocument.createElement("div");
        wrapper.append(image.cloneNode());
        fragment.append(copyContent(wrapper, targetDocument));
      }
      continue;
    }
    if (ignoredTags.has(child.tagName) ||
        child.matches('[hidden], [aria-hidden="true"], [data-markdown-copy="exclude"], .turn-action-controls')) continue;
    if (child.matches(".katex")) {
      const math = targetDocument.createElement("code");
      math.textContent = child.querySelector('annotation[encoding="application/x-tex"]')?.textContent ||
        child.textContent;
      fragment.append(math);
      continue;
    }
    if (child.tagName === "IMG") {
      const image = targetDocument.createElement("img");
      image.alt = child.getAttribute("alt") || "Conversation image";
      image.dataset.exportImageSource = imageSource(child);
      fragment.append(image);
      continue;
    }
    if (["CANVAS", "SVG", "VIDEO", "AUDIO"].includes(child.tagName.toUpperCase())) {
      const label = targetDocument.createElement("span");
      label.textContent = `[${child.getAttribute("alt") || child.getAttribute("aria-label") || "Image or media omitted"}]`;
      fragment.append(label);
      continue;
    }
    if (!allowedTags.has(child.tagName)) {
      fragment.append(copyContent(child, targetDocument));
      continue;
    }
    const copy = targetDocument.createElement(child.tagName.toLowerCase());
    if (child.tagName === "A") {
      const href = child.getAttribute("href");
      if (href && /^(https?:|mailto:)/i.test(href)) copy.setAttribute("href", href);
    }
    for (const attribute of ["colspan", "rowspan", "start", "value"]) {
      const value = child.getAttribute(attribute);
      if (value && /^\d{1,4}$/.test(value)) copy.setAttribute(attribute, value);
    }
    copy.append(copyContent(child, targetDocument));
    fragment.append(copy);
  }
  return fragment;
}

export function extractConversation(document) {
  const roleFor = (node) => {
    if (node.matches('[data-user-message-bubble="true"]')) return "user";
    if (node.matches('[data-markdown-text-style="assistant-message"]')) return "assistant";
    const role = node.getAttribute("data-message-author-role") ||
      node.getAttribute("data-turn");
    return ["user", "assistant"].includes(role) ? role : null;
  };
  const turnSelector = '[data-testid^="conversation-turn-"], [data-turn="user"], [data-turn="assistant"], main article';
  const candidates = document.querySelectorAll(
    `[data-message-author-role], [data-user-message-bubble="true"], [data-markdown-text-style="assistant-message"], ${turnSelector}`,
  );
  const sources = [];
  for (const node of candidates) {
    if (node.closest('[hidden], [aria-hidden="true"]')) continue;
    const nestedMessages = [...node.querySelectorAll("[data-message-author-role]")]
      .filter((child) => roleFor(child));
    // Prefer individual messages when a turn contains multiple message blocks.
    if (nestedMessages.length > 0) continue;
    const turn = node.closest(turnSelector);
    const role = roleFor(node) || (turn && roleFor(turn));
    if (!role) continue;
    if (sources.some((source) => source.node.contains(node))) continue;
    sources.push({ node, role });
  }
  const messages = sources.map(({ node, role }) => {
      const blocks = [...node.querySelectorAll('.markdown, [data-markdown-text-style="assistant-message"]')];
      const content = document.createDocumentFragment();
      if (blocks.length > 0) {
        for (const block of blocks) {
          if (!blocks.some((parent) => parent !== block && parent.contains(block))) {
            content.append(copyContent(block, document));
          }
        }
      } else {
        const body = node.matches('[data-user-message-bubble="true"]')
          ? node
          : node.querySelector('[data-user-message-bubble="true"], .whitespace-pre-wrap, .user-message-bubble') || node;
        content.append(copyContent(body, document));
      }
      return { role, content };
    })
    .filter(({ content }) => content.textContent.trim() || content.querySelector("img"));
  if (messages.length === 0) {
    throw new Error("No conversation messages found. Wait for the chat to load, close any dialogs, and try again. If messages are visible, this ChatGPT layout is not supported yet.");
  }
  const title = document.title.replace(/\s*[-|]\s*ChatGPT\s*$/i, "").trim();
  return { title: title || "ChatGPT conversation", messages };
}

export function nextPageEnd(start, total, pageHeight, lineBoxes) {
  let end = Math.min(start + pageHeight, total);
  if (end === total) return end;
  // Move the cut above any text line it crosses, including adjacent table cells.
  for (let pass = 0; pass < lineBoxes.length; pass++) {
    const crossing = lineBoxes.filter(({ top, bottom }) => top < end && bottom > end);
    if (!crossing.length) break;
    const candidate = Math.min(...crossing.map(({ top }) => top));
    if (candidate <= start) break;
    end = candidate;
  }
  return end;
}
