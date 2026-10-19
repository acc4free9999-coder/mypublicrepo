import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const project = new URL("../", import.meta.url);
const popupBundle = await readFile(new URL("dist/popup.js", project), "utf8");

async function openPopup(folder, tab, injectionError) {
  const manifest = JSON.parse(await readFile(new URL(`${folder}manifest.json`, project), "utf8"));
  assert.ok((await readFile(new URL(`${folder}${manifest.background.service_worker}`, project), "utf8")).length > 0);
  const popupPath = `${folder}${manifest.action.default_popup}`;
  const html = await readFile(new URL(popupPath, project), "utf8");
  const dom = new JSDOM(html, {
    url: `https://extension.test/${manifest.action.default_popup}`,
    runScripts: "outside-only",
  });
  const script = dom.window.document.querySelector("script[src]");
  const relativeScript = new URL(script.getAttribute("src"), new URL(popupPath, project));
  assert.equal(await readFile(relativeScript, "utf8"), popupBundle);
  const calls = [];
  dom.window.chrome = {
    tabs: { query: async () => [tab] },
    scripting: {
      executeScript: async (options) => {
        if (injectionError) throw new Error(injectionError);
        calls.push(options);
      },
    },
  };
  dom.window.console.error = () => {};
  dom.window.eval(popupBundle);
  dom.window.document.querySelector("#export").click();
  await new Promise((resolve) => setImmediate(resolve));
  return { dom, calls };
}

for (const folder of ["", "dist/"]) {
  test(`popup starts export when loading ${folder || "project root"}`, async () => {
    const { dom, calls } = await openPopup(folder, { id: 7, url: "https://chatgpt.com/c/example" });
    try {
      assert.equal(calls.length, 1);
      assert.equal(calls[0].target.tabId, 7);
      const expected = folder ? "exporter.js" : "dist/exporter.js";
      assert.equal(calls[0].files[0], expected);
      assert.ok((await readFile(new URL(`${folder}${expected}`, project), "utf8")).length > 0);
      assert.match(dom.window.document.querySelector("#status").textContent, /Export started/);
      assert.equal(dom.window.document.querySelector("#export").disabled, false);
    } finally {
      dom.window.close();
    }
  });
}

test("popup displays injection errors rather than claiming export started", async () => {
  const { dom } = await openPopup("dist/", { id: 7, url: "https://chatgpt.com/c/example" }, "Cannot access contents of the page");
  try {
    const status = dom.window.document.querySelector("#status");
    assert.equal(status.dataset.error, "true");
    assert.equal(status.textContent, "Cannot access contents of the page");
    assert.equal(dom.window.document.querySelector("#export").disabled, false);
  } finally {
    dom.window.close();
  }
});

test("popup rejects unsupported tabs before injection", async () => {
  const { dom, calls } = await openPopup("dist/", { id: 7, url: "https://example.com" });
  try {
    assert.equal(calls.length, 0);
    assert.match(dom.window.document.querySelector("#status").textContent, /Open a conversation/);
    assert.equal(dom.window.document.querySelector("#status").dataset.error, "true");
  } finally {
    dom.window.close();
  }
});
