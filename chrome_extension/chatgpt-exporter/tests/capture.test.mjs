import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { JSDOM } from "jsdom";
import { captureBounds, cropCoordinates, findConversation, hideCaptureOverlays, planCapture, waitForVisibleImages } from "../src/capture.js";

test("sections cover the transcript continuously with sticky headers and a clamped final scroll", () => {
  const total = 3400.5;
  let covered = null;
  let offset = 0;
  let sections = 0;
  const ranges = [];
  while (covered === null || covered < total) {
    assert.ok(sections++ < 20);
    const top = sections === 1 ? 20 : 84;
    const bounds = { left: 200, top, width: 700, height: 600 - top, viewportWidth: 1200, viewportHeight: 800 };
    const scrollTop = Math.min(offset, total - 600);
    const plan = planCapture(bounds, scrollTop, 0, total, covered);
    if (plan.retryOffset !== undefined) {
      offset = plan.retryOffset;
      continue;
    }
    if (covered !== null) assert.equal(plan.start, covered);
    assert.equal(scrollTop + plan.bounds.top, plan.start);
    assert.equal(plan.bounds.height, plan.end - plan.start);
    ranges.push([plan.start, plan.end]);
    covered = plan.end;
    offset = plan.nextOffset;
  }
  assert.equal(covered, total);
  assert.ok(ranges.length > 2);
});

test("a new viewport starting below the previous screenshot is revisited, never silently skipped", () => {
  const bounds = { top: 120, height: 480 };
  const plan = planCapture(bounds, 600, 0, 3000, 600);
  assert.deepEqual(plan, { retryOffset: 432 });
  const repaired = planCapture(bounds, plan.retryOffset, 0, 3000, 600);
  assert.equal(repaired.start, 600);
  assert.equal(plan.retryOffset + repaired.bounds.top, 600);
});

test("overlap removal uses content coordinates for offset scrollers and fractional positions", () => {
  const bounds = { top: 90.25, height: 510.5 };
  const plan = planCapture(bounds, 451.75, 30.25, 2000, 550);
  assert.equal(plan.start, 550);
  assert.equal(451.75 + plan.bounds.top - 30.25, 550);
  assert.equal(plan.end, 1022.25);
  assert.equal(plan.nextOffset, 914.25);
});

test("clipped scroll containers report a recoverable stall and can capture the tail with extra scroll room", () => {
  const bounds = { top: 0, height: 500 };
  const originalHeight = 2600;
  const clientHeight = 600;
  const atBottom = originalHeight - clientHeight;
  const stalled = planCapture(bounds, atBottom, 0, originalHeight, 2500);
  assert.equal(stalled.stalled, true);
  assert.equal(stalled.visibleEnd, 2500);
  const spacer = originalHeight - stalled.visibleEnd + 64;
  const scrollTop = Math.min(stalled.nextOffset, originalHeight + spacer - clientHeight);
  const tail = planCapture(bounds, scrollTop, 0, originalHeight, 2500);
  assert.equal(tail.start, 2500);
  assert.equal(tail.end, 2600);
  assert.equal(scrollTop + tail.bounds.top, 2500);
});

test("fractional last viewport is kept distinct from a substantial missing tail", () => {
  const plan = planCapture({ top: 0, height: 599.5 }, 2000, 0, 2600, 2500);
  assert.equal(plan.end, 2599.5);
  assert.ok(2600 - plan.end <= 1);
  const stalled = planCapture({ top: 0, height: 500 }, 2000, 0, 2600, 2500);
  assert.equal(stalled.stalled, true);
  assert.ok(2600 - stalled.visibleEnd > 1);
});

test("crop uses screenshot dimensions rather than assuming device pixel ratio", () => {
  const bounds = { left: 100, top: 50, width: 600, height: 400, viewportWidth: 1000, viewportHeight: 800 };
  assert.deepEqual(cropCoordinates(bounds, 2000, 1600), { x: 200, y: 100, width: 1200, height: 800 });
  assert.deepEqual(cropCoordinates(bounds, 1000, 800), { x: 100, y: 50, width: 600, height: 400 });
  assert.throws(() => cropCoordinates({ ...bounds, width: -1 }, 2000, 1600), /Invalid/);
});

test("current ChatGPT footer and arrow cannot hide the missing lesson at a section boundary", () => {
  const dom = new JSDOM(`
    <main><div id="scroll"><div data-thread-find-target="conversation">
      <div data-user-message-bubble="true">Question</div>
      <div data-markdown-text-style="assistant-message">Bai 1. Nen tang Elliott Wave</div>
    </div><div data-thread-scroll-footer="true"><div data-pip-obstacle="thread-footer">
      <button class="group/scroll-to-bottom" aria-label="Scroll to bottom">Down</button>
      <form data-chatgpt-composer data-composer-placement="thread"><div contenteditable="true">Ask ChatGPT</div></form>
    </div></div></div></main>
  `);
  try {
    const doc = dom.window.document;
    Object.defineProperty(dom.window, "innerHeight", { value: 1000 });
    const scroller = doc.querySelector("#scroll");
    const content = doc.querySelector("[data-thread-find-target]");
    scroller.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 980 });
    content.getBoundingClientRect = () => ({ left: 0, right: 768 });
    const box = (top, bottom) => () => ({ left: 0, right: 768, top, bottom, width: 768, height: bottom - top });
    doc.querySelector("[data-thread-scroll-footer]").getBoundingClientRect = box(900, 980);
    doc.querySelector("[data-pip-obstacle]").getBoundingClientRect = box(900, 980);
    doc.querySelector("form").getBoundingClientRect = box(910, 960);
    doc.querySelector("button").getBoundingClientRect = box(850, 882);
    const bounds = captureBounds(doc, content, scroller);
    assert.equal(bounds.height, 850);
    const first = planCapture(bounds, 0, 0, 3000, null);
    const second = planCapture(bounds, first.nextOffset, 0, 3000, first.end);
    assert.equal(first.end, 850);
    assert.equal(second.start, 850);
    assert.equal(first.nextOffset + second.bounds.top, 850);
    const restore = hideCaptureOverlays(doc);
    assert.equal(dom.window.getComputedStyle(doc.querySelector("form")).visibility, "hidden");
    assert.equal(dom.window.getComputedStyle(doc.querySelector("button")).visibility, "hidden");
    assert.equal(captureBounds(doc, content, scroller).height, 980);
    assert.equal(doc.querySelector("[data-markdown-text-style]").style.visibility, "");
    restore();
    assert.equal(dom.window.getComputedStyle(doc.querySelector("form")).visibility, "visible");
    assert.equal(captureBounds(doc, content, scroller).height, 850);
  } finally {
    dom.window.close();
  }
});

test("hiding a short footer before measurement prevents the final overlap from stalling", () => {
  const dom = new JSDOM(`
    <main><div id="scroll"><div data-thread-find-target="conversation">
      <div data-user-message-bubble="true">Question</div>
    </div></div><form data-chatgpt-composer>Ask ChatGPT</form></main>
  `);
  try {
    const doc = dom.window.document;
    const scroller = doc.querySelector("#scroll");
    const content = doc.querySelector("[data-thread-find-target]");
    scroller.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600 });
    content.getBoundingClientRect = () => ({ left: 0, right: 700 });
    doc.querySelector("form").getBoundingClientRect = () => ({ left: 0, top: 570, right: 700, bottom: 600, width: 700, height: 30 });
    const total = 2000;
    const first = planCapture(captureBounds(doc, content, scroller), 1400, 0, total, 1500);
    assert.equal(first.end, 1970);
    const repeated = Math.min(first.nextOffset, total - 600);
    assert.equal(planCapture(captureBounds(doc, content, scroller), repeated, 0, total, first.end).stalled, true);
    const restore = hideCaptureOverlays(doc);
    const repeatedHide = hideCaptureOverlays(doc);
    let covered = null;
    let offset = 0;
    let count = 0;
    while (covered === null || covered < total) {
      assert.ok(++count < 10);
      const scrollTop = Math.min(offset, total - 600);
      const plan = planCapture(captureBounds(doc, content, scroller), scrollTop, 0, total, covered);
      assert.equal(plan.retryOffset, undefined);
      if (covered !== null) assert.equal(plan.start, covered);
      covered = plan.end;
      offset = plan.nextOffset;
    }
    assert.equal(covered, 2000);
    repeatedHide();
    assert.equal(doc.querySelector("form").style.visibility, "hidden");
    restore();
    assert.equal(doc.querySelector("form").style.visibility, "");
  } finally {
    dom.window.close();
  }
});

test("finds nested conversation scroller and crops sidebar/header without copying content", () => {
  const dom = new JSDOM('<main><div data-app-shell-main-titlebar></div><div id="scroll" style="overflow-y:auto"><div data-thread-find-target="conversation"><div data-user-message-bubble="true">Hello</div></div></div></main>');
  try {
    const doc = dom.window.document;
    const scroller = doc.querySelector("#scroll");
    Object.defineProperties(scroller, { clientHeight: { value: 600 }, scrollHeight: { value: 2400 } });
    scroller.getBoundingClientRect = () => ({ left: 200, top: 0, right: 1000, bottom: 700 });
    doc.querySelector("[data-thread-find-target]").getBoundingClientRect = () => ({ left: 250, right: 950 });
    doc.querySelector("[data-app-shell-main-titlebar]").getBoundingClientRect = () => ({ left: 200, right: 1000, top: 0, bottom: 60, width: 800, height: 60 });
    const found = findConversation(doc);
    assert.equal(found.scroller, scroller);
    const bounds = captureBounds(doc, found.content, scroller);
    assert.deepEqual({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }, { left: 250, top: 60, width: 700, height: 640 });
  } finally {
    dom.window.close();
  }
});

test("composer visibility is restored exactly and visible failed images produce errors", async () => {
  const dom = new JSDOM('<main><div data-thread-find-target="conversation"><img src="bad"></div><form style="visibility:visible !important"><div id="prompt-textarea"></div></form></main>');
  try {
    const doc = dom.window.document;
    const form = doc.querySelector("form");
    const restore = hideCaptureOverlays(doc);
    assert.equal(form.style.visibility, "hidden");
    restore();
    assert.equal(form.style.visibility, "visible");
    assert.equal(form.style.getPropertyPriority("visibility"), "important");
    const image = doc.querySelector("img");
    image.getBoundingClientRect = () => ({ left: 0, top: 0, right: 50, bottom: 50, width: 50, height: 50 });
    Object.defineProperty(image, "complete", { value: true });
    await assert.rejects(waitForVisibleImages(doc, { left: 0, top: 0, width: 100, height: 100 }, () => {}), /failed to load/);
  } finally {
    dom.window.close();
  }
});

async function background(overrides = {}, focused = true) {
  let listener;
  let count = 0;
  const chrome = {
    runtime: { onMessage: { addListener: (callback) => { listener = callback; } } },
    windows: { get: async () => ({ focused }) },
    tabs: {
      query: async () => [{ id: 7, url: "https://chatgpt.com/c/test" }],
      captureVisibleTab: async (windowId, options) => {
        assert.equal(windowId, 3);
        assert.equal(options.format, "png");
        count++;
        return "data:image/png;base64,test";
      },
      ...overrides,
    },
  };
  runInNewContext(await readFile(new URL("../dist/background.js", import.meta.url), "utf8"), { chrome, URL, console, Date, setTimeout });
  return { send: (sender) => new Promise((resolve) => listener({ type: "capture-conversation" }, sender, resolve)), count: () => count };
}

const sender = { tab: { id: 7, windowId: 3 }, url: "https://chatgpt.com/c/test", frameId: 0 };
test("background captures only the requesting active ChatGPT tab", async () => {
  const worker = await background();
  const response = await worker.send(sender);
  assert.match(response.data, /^data:image\/png/);
  assert.equal(worker.count(), 1);
});

test("background captures the requesting window even when Chrome reports it unfocused", async () => {
  const worker = await background({}, false);
  const response = await worker.send(sender);
  assert.match(response.data, /^data:image\/png/);
  assert.equal(worker.count(), 1);
});

test("background returns Chrome capture errors without claiming success", async () => {
  const worker = await background({
    captureVisibleTab: async () => { throw new Error("Capture permission denied"); },
  });
  const response = await worker.send(sender);
  assert.equal(response.error, "Capture permission denied");
  assert.equal(response.data, undefined);
});

test("background rejects unrelated tabs, subframes, and active-tab changes", async () => {
  const worker = await background({ query: async () => [{ id: 99, url: "https://example.com" }] });
  assert.match((await worker.send(sender)).error, /active tab changed/);
  assert.match((await worker.send({ ...sender, frameId: 1 })).error, /main ChatGPT tab/);
  assert.match((await worker.send({ ...sender, url: "https://example.com" })).error, /main ChatGPT tab/);
  assert.equal(worker.count(), 0);
});

test("background discards captured pixels if the active tab changes during capture", async () => {
  let changed = false;
  const worker = await background({
    query: async () => [{ id: changed ? 99 : 7, url: "https://chatgpt.com/c/test" }],
    captureVisibleTab: async () => {
      changed = true;
      return "data:image/png;base64,must-not-be-returned";
    },
  });
  const response = await worker.send(sender);
  assert.match(response.error, /active tab changed/);
  assert.equal(response.data, undefined);
});
