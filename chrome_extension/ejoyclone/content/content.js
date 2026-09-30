(() => {
  if (window.__dropletDict) return;
  window.__dropletDict = true;

  const DROP_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#10b981" d="M12 2c-.3 0-.6.2-.8.4C9.6 4.6 5 10.6 5 15a7 7 0 0 0 14 0c0-4.4-4.6-10.4-6.2-12.6-.2-.2-.5-.4-.8-.4z"/><path fill="#fff" opacity=".7" d="M9 14.5a1 1 0 0 1 1 1 2.5 2.5 0 0 0 2.5 2.5 1 1 0 0 1 0 2A4.5 4.5 0 0 1 8 15.5a1 1 0 0 1 1-1z"/></svg>';

  let settings = { ...EJ.DEFAULT_SETTINGS };
  EJ.getSettings().then((s) => (settings = s));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue ?? EJ.DEFAULT_SETTINGS[k];
  });

  // ---------- Shadow DOM host ----------
  const host = document.createElement('droplet-dict');
  host.style.cssText = 'all:initial;position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<link rel="stylesheet" href="${chrome.runtime.getURL('lib/card.css')}">`;
  const mount = () => host.isConnected || document.documentElement.appendChild(host);

  const drop = document.createElement('button');
  drop.className = 'ej-drop ej-float';
  drop.title = 'Look up (Droplet Dictionary)';
  drop.innerHTML = DROP_SVG;
  drop.style.display = 'none';

  const card = document.createElement('div');
  card.className = 'ej-card ej-float';
  card.style.display = 'none';
  root.append(drop, card);

  let pending = null; // { text, rect, context } — rect is in page (not viewport) coordinates
  let current = null; // info of the word shown in the card

  const hideAll = () => {
    drop.style.display = 'none';
    card.style.display = 'none';
    current = null;
    lookupCard.close();
  };

  const toPageRect = (r) => ({
    left: r.left + window.scrollX,
    top: r.top + window.scrollY,
    bottom: r.bottom + window.scrollY,
    width: r.width,
  });

  function selectionInfo() {
    const sel = window.getSelection();
    const text = EJ.normalize(sel?.toString());
    if (!text || text.length > 1000 || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const rects = range.getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;
    return { text, rect: toPageRect(rect), context: extractContext(range, text) };
  }

  function extractContext(range, text) {
    let node = range.commonAncestorContainer;
    if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
    const block = node?.closest('p,li,td,dd,blockquote,h1,h2,h3,h4,h5,h6,div,span') || node;
    const full = EJ.normalize(block?.innerText || block?.textContent || '');
    if (!full || full.length > 5000) return '';
    const sentences = full.match(/[^.!?。！？]+[.!?。！？]*/g) || [full];
    const hit = sentences.find((s) => s.toLowerCase().includes(text.toLowerCase()));
    return EJ.normalize(hit || '').slice(0, 400);
  }

  function place(el, pageRect) {
    el.style.display = el === drop ? 'flex' : 'block';
    const sx = window.scrollX;
    const sy = window.scrollY;
    const rect = { left: pageRect.left - sx, top: pageRect.top - sy, bottom: pageRect.bottom - sy, width: pageRect.width };
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = rect.left + (el === drop ? rect.width : 0);
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) {
      const above = rect.top - h - 6;
      if (above >= 8) top = above;
    }
    el.style.left = `${left + sx}px`;
    el.style.top = `${top + sy}px`;
  }

  const lookupCard = EJ.createLookupCard({
    el: card,
    root,
    getMeta: () => ({ context: current?.context || '', url: location.href, title: document.title }),
    afterRender: () => current && place(card, current.rect),
    autoSpeak: async () => settings.autoSpeak,
  });

  function openCard(info) {
    mount();
    drop.style.display = 'none';
    current = info;
    place(card, info.rect);
    lookupCard.open(info.text);
  }

  card.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideAll();
  });

  drop.addEventListener('mousedown', (e) => e.preventDefault()); // keep selection
  drop.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pending) openCard(pending);
  });

  const insideUs = (e) => e.composedPath().includes(host);

  document.addEventListener(
    'mousedown',
    (e) => {
      if (!insideUs(e)) hideAll();
    },
    true
  );

  document.addEventListener(
    'mouseup',
    (e) => {
      if (insideUs(e) || e.button !== 0) return;
      setTimeout(() => {
        const info = selectionInfo();
        if (!info) return;
        pending = info;
        if (settings.dblclickLookup && e.detail === 2) return openCard(info);
        if (settings.showIcon) {
          mount();
          place(drop, info.rect);
        }
      }, 10);
    },
    true
  );

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideAll();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== 'show-lookup') return;
    const info = selectionInfo() || {
      text: EJ.normalize(msg.text),
      rect: toPageRect(new DOMRect(window.innerWidth / 2 - 180, 40, 0, 0)),
      context: '',
    };
    info.text = EJ.normalize(msg.text) || info.text;
    openCard(info);
  });
})();
