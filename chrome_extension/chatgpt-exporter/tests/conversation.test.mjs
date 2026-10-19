import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFile, readdir } from "node:fs/promises";
import { copyContent, extractConversation, isChatGptUrl, nextPageEnd, safeFilename } from "../src/conversation.js";

test("only official HTTPS ChatGPT hosts are accepted", () => {
  for (const url of ["https://chatgpt.com/c/abc", "https://chat.openai.com/c/abc"]) {
    assert.equal(isChatGptUrl(url), true);
  }
  for (const url of ["https://chatgpt.com.evil.test", "http://chatgpt.com", "file:///tmp/chatgpt.com", undefined]) {
    assert.equal(isChatGptUrl(url), false);
  }
});

test("filenames remove unsafe characters and have a fallback", () => {
  assert.equal(safeFilename(' A / B: "C"? '), "A B C.zip");
  assert.equal(safeFilename("..."), "ChatGPT conversation.zip");
  assert.equal(safeFilename("x".repeat(200)).length, 104);
  assert.equal(safeFilename("Tiếng Việt"), "Tiếng Việt.zip");
});

test("extracts ordered messages, excluding controls and hidden branches", () => {
  const { document } = new JSDOM(`
    <title>Example - ChatGPT</title>
    <div data-message-author-role="user"><div class="whitespace-pre-wrap">Hello\nworld</div><button>Edit</button></div>
    <div data-message-author-role="assistant"><div class="markdown"><p>Hi <strong>there</strong></p><pre><code>const x = 1;</code></pre></div><button>Copy</button></div>
    <div hidden><div data-message-author-role="assistant">Old branch</div></div>
    <div data-message-author-role="system">Internal</div>
  `).window;
  const result = extractConversation(document);
  assert.equal(result.title, "Example");
  assert.deepEqual(result.messages.map((message) => message.role), ["user", "assistant"]);
  assert.equal(result.messages[0].content.textContent, "Hello\nworld");
  const container = document.createElement("div");
  container.append(result.messages[1].content);
  assert.equal(container.querySelector("strong").textContent, "there");
  assert.equal(container.querySelector("code").textContent, "const x = 1;");
  assert.equal(container.textContent.includes("Copy"), false);
});

test("sanitizes content, labels images, and preserves math source and tables", () => {
  const { document } = new JSDOM(`<main>
    <p onclick="bad()">Hello<script>bad()</script><img src="https://example.test/private" alt="Chart"></p>
    <a href="javascript:bad()">Bad</a><a href="https://example.test">Good</a>
    <span class="katex"><span aria-hidden="true">duplicate</span><annotation encoding="application/x-tex">x^2</annotation></span>
    <table><tr><td colspan="2">Data</td></tr></table>
    <button>Copy</button><iframe src="https://example.test"></iframe>
  </main>`).window;
  const container = document.createElement("div");
  container.append(copyContent(document.querySelector("main"), document));
  assert.equal(container.querySelector("script, iframe, button, [onclick], img[src]"), null);
  assert.equal(container.querySelector("img").dataset.exportImageSource, "https://example.test/private");
  assert.equal(container.querySelector("img").alt, "Chart");
  assert.equal(container.querySelector("a").hasAttribute("href"), false);
  assert.equal(container.querySelectorAll("a")[1].getAttribute("href"), "https://example.test");
  assert.equal(container.querySelector("code").textContent, "x^2");
  assert.equal(container.querySelector("td").getAttribute("colspan"), "2");
});

test("empty conversations produce an actionable error", () => {
  const { document } = new JSDOM("<title>ChatGPT</title>").window;
  assert.throws(() => extractConversation(document), /No conversation messages found/);
});

test("extracts turn-based layouts without message-author attributes", () => {
  const { document } = new JSDOM(`
    <main>
      <article data-testid="conversation-turn-0" data-turn="user">
        <h5 hidden>You said:</h5><div class="user-message-bubble">My question</div><button>Edit</button>
      </article>
      <article data-testid="conversation-turn-1" data-turn="assistant">
        <h6 hidden>ChatGPT said:</h6><div class="markdown"><p>First block</p></div>
        <div class="markdown"><p>Second block</p></div><button>Copy</button>
      </article>
    </main>
  `).window;
  const result = extractConversation(document);
  assert.deepEqual(result.messages.map(({ role }) => role), ["user", "assistant"]);
  assert.equal(result.messages[0].content.textContent, "My question");
  assert.equal(result.messages[1].content.textContent, "First blockSecond block");
});

test("nested turn and message containers do not duplicate or drop messages", () => {
  const { document } = new JSDOM(`
    <main><article data-turn="assistant" data-testid="conversation-turn-1">
      <div data-message-author-role="assistant"><div class="markdown"><p>One</p></div></div>
      <div data-message-author-role="assistant"><div class="markdown"><p>Two</p></div></div>
    </article><article data-turn="user"><div data-message-author-role="user">Three</div></article>
    <article data-turn="assistant" hidden><div class="markdown">Hidden</div></article></main>
  `).window;
  const result = extractConversation(document);
  assert.deepEqual(result.messages.map(({ content }) => content.textContent), ["One", "Two", "Three"]);
});

test("unidentified articles and unrelated markdown are never guessed to be messages", () => {
  const { document } = new JSDOM(`
    <nav><div class="markdown">Sidebar</div></nav>
    <main><article data-testid="conversation-turn-0"><p>Unknown role</p></article></main>
  `).window;
  assert.throws(() => extractConversation(document), /layout is not supported/);
});

test("extracts current bubble and markdown-attribute layout without search keys or old selectors", () => {
  const { document } = new JSDOM(`
    <main>
      <div><h4>You said:</h4><div data-chatgpt-search-unit-key="turn:0:user">
        <div data-user-message-bubble="true"><div class="whitespace-pre-wrap"><p>Question</p><p>More detail</p></div></div>
        <div class="turn-action-controls">Edit menu<button>Edit</button></div>
      </div></div>
      <div data-chatgpt-search-unit-key="turn:2:assistant">
        <h4 data-conversation-role="assistant">ChatGPT said:</h4>
        <div data-markdown-text-style="assistant-message"><div data-markdown-copy="contents">
          <p>Answer</p><div data-markdown-copy="exclude">Copy code</div><pre><code>example()</code></pre>
          <table><tr><td>Cell</td></tr></table>
        </div></div>
      </div>
      <div hidden><div data-markdown-text-style="assistant-message">Hidden</div></div>
    </main>
  `).window;
  const result = extractConversation(document);
  assert.deepEqual(result.messages.map(({ role }) => role), ["user", "assistant"]);
  assert.equal(result.messages[0].content.textContent, "QuestionMore detail");
  assert.match(result.messages[1].content.textContent, /Answer/);
  assert.equal(result.messages[1].content.querySelector("code").textContent, "example()");
  assert.equal(result.messages[1].content.querySelector("td").textContent, "Cell");
  assert.doesNotMatch(result.messages[1].content.textContent, /Copy code|ChatGPT said|Hidden/);
});

test("local saved HTML extracts every user and assistant content block in order", async (t) => {
  const sample = new URL("../sample/", import.meta.url);
  let files;
  try {
    files = await readdir(sample);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    t.skip("Local saved chat fixture not present");
    return;
  }
  const htmlFiles = files.filter((file) => file.endsWith(".html"));
  assert.ok(htmlFiles.length > 0, "Expected an HTML fixture in sample/");
  for (const file of htmlFiles) {
    const dom = new JSDOM(await readFile(new URL(file, sample), "utf8"), { url: "https://chatgpt.com/c/saved-fixture" });
    try {
      const doc = dom.window.document;
      const expected = [...doc.querySelectorAll('[data-user-message-bubble="true"], [data-markdown-text-style="assistant-message"]')]
        .filter((node) => !node.closest('[hidden], [aria-hidden="true"]'));
      assert.ok(expected.length > 0);
      const result = extractConversation(doc);
      assert.equal(result.messages.length, expected.length);
      for (const [index, node] of expected.entries()) {
        const message = result.messages[index];
        assert.equal(message.role, node.hasAttribute("data-user-message-bubble") ? "user" : "assistant");
        assert.equal(message.content.textContent, copyContent(node, doc).textContent);
        assert.ok(message.content.textContent.trim().length > 0);
        assert.equal(message.content.querySelector("script, button, iframe, [data-markdown-copy='exclude']"), null);
        assert.equal(message.content.querySelectorAll("img").length, node.querySelectorAll("img").length);
      }
    } finally {
      dom.window.close();
    }
  }
});

test("image-only and clickable-image messages retain images without event handlers", () => {
  const { document } = new JSDOM(`
    <div data-user-message-bubble="true"><button><img src="https://example.test/a.png" onclick="bad()" alt="Chart"></button></div>
    <div data-markdown-text-style="assistant-message"><img src="/b.png" alt="Answer"></div>
  `, { url: "https://chatgpt.com/c/test" }).window;
  const result = extractConversation(document);
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0].content.querySelector("img").dataset.exportImageSource, "https://example.test/a.png");
  assert.equal(result.messages[1].content.querySelector("img").dataset.exportImageSource, "https://chatgpt.com/b.png");
  assert.equal(result.messages[0].content.querySelector("[onclick], button, img[src]"), null);
});

test("pagination avoids crossed lines and always progresses for oversized lines", () => {
  assert.equal(nextPageEnd(0, 3000, 1000, [{ top: 990, bottom: 1010 }]), 990);
  assert.equal(nextPageEnd(990, 1500, 1000, []), 1500);
  assert.equal(nextPageEnd(0, 3000, 1000, [{ top: 0, bottom: 2000 }]), 1000);
  assert.equal(nextPageEnd(0, 3000, 1000, [{ top: 200, bottom: 1100 }]), 200);
  assert.equal(nextPageEnd(0, 3000, 1000, [
    { top: 990, bottom: 1010 }, { top: 980, bottom: 995 },
  ]), 980);
  let offset = 0;
  while (offset < 3200) {
    const end = nextPageEnd(offset, 3200, 1000, []);
    assert.ok(end > offset && end - offset <= 1000);
    offset = end;
  }
  assert.equal(offset, 3200);
});
