const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const event = () => {
  const listeners = [];
  return { addListener: listener => listeners.push(listener), fire: (...args) => listeners.forEach(listener => listener(...args)), listeners };
};

async function background(savedState, options = {}) {
  let now = 1000000;
  let offscreen = false;
  let createCount = 0;
  let badge = "";
  const storage = savedState ? { state: structuredClone(savedState) } : {};
  const alarms = new Map();
  const notifications = [];
  const audioMessages = [];
  const errors = [];
  const chrome = {
    storage: { local: {
      get: async key => ({ [key]: structuredClone(storage[key]) }),
      set: async values => Object.assign(storage, structuredClone(values)),
      remove: async key => { delete storage[key]; }
    } },
    action: {
      setBadgeBackgroundColor: async () => {},
      setBadgeText: async ({ text }) => { badge = text; }
    },
    runtime: {
      getURL: file => `chrome-extension://test/${file}`,
      getContexts: async () => offscreen ? [{}] : [],
      sendMessage: async message => {
        audioMessages.push(message);
        return options.audioError ? { ok: false, error: "Audio failed" } : { ok: true };
      },
      onMessage: event(), onStartup: event(), onInstalled: event()
    },
    offscreen: {
      createDocument: async () => { offscreen = true; createCount++; },
      closeDocument: async () => { offscreen = false; }
    },
    alarms: {
      create: async (name, alarm) => alarms.set(name, alarm),
      clear: async name => alarms.delete(name),
      onAlarm: event()
    },
    notifications: { create: async (id, notification) => {
      if (options.notificationError) throw new Error("Notifications blocked");
      notifications.push(notification);
    } }
  };
  class Clock extends Date {
    static now() { return now; }
  }
  const context = vm.createContext({ chrome, Date: Clock, console: { error: (...args) => errors.push(args) } });
  context.importScripts = name => vm.runInContext(read(name), context);
  vm.runInContext(read("background.js"), context);
  const send = (type, extra = {}) => new Promise(resolve => {
    chrome.runtime.onMessage.listeners[0]({ target: "background", type, ...extra }, {}, resolve);
  });
  const get = async () => {
    const result = await send("getState");
    assert.equal(result.ok, true, result.error);
    return structuredClone(result.state);
  };
  await get();
  return {
    send, get, chrome, storage, alarms, notifications, audioMessages, errors,
    advance: seconds => { now += seconds * 1000; },
    alarm: async () => { chrome.alarms.onAlarm.fire({ name: "still-focus-timer" }); return get(); },
    get now() { return now; },
    get offscreen() { return offscreen; },
    get createCount() { return createCount; },
    get badge() { return badge; }
  };
}

test("fresh installation has eight sounds and a 25/5 timer", async () => {
  const app = await background();
  const state = await app.get();
  assert.equal(Object.keys(state.mixer.volumes).length, 8);
  assert.equal(state.mixer.playing, false);
  assert.equal(state.mixer.volumes.rain, 60);
  assert.equal(state.timer.remaining, 1500);
  assert.equal(state.settings.break, 5);
});

test("pause, resume and reset preserve the real timer deadline", async () => {
  const app = await background();
  await app.send("timerStart");
  assert.equal(app.alarms.get("still-focus-timer").when, app.now + 1500000);
  assert.equal(app.badge, "FOCUS");
  app.advance(90);
  await app.send("timerPause");
  let state = await app.get();
  assert.equal(state.timer.remaining, 1410);
  assert.equal(state.timer.status, "paused");
  assert.equal(state.timer.endAt, null);
  assert.equal(app.alarms.size, 0);
  app.advance(300);
  await app.send("timerStart");
  assert.equal(app.alarms.get("still-focus-timer").when, app.now + 1410000);
  await app.send("timerReset");
  state = await app.get();
  assert.equal(state.timer.remaining, 1500);
  assert.equal(state.timer.status, "idle");
  assert.equal(app.badge, "");
});

test("late and duplicate alarms complete focus only once and prepare a manual break", async () => {
  const app = await background();
  await app.send("timerStart");
  app.advance(1700);
  let state = await app.alarm();
  assert.equal(state.timer.phase, "break");
  assert.equal(state.timer.status, "idle");
  assert.equal(state.timer.remaining, 300);
  assert.equal(state.timer.completed, 1);
  assert.equal(app.notifications.length, 1);
  state = await app.alarm();
  assert.equal(state.timer.completed, 1);
  assert.equal(app.notifications.length, 1);
  await app.send("timerStart");
  app.advance(300);
  state = await app.alarm();
  assert.equal(state.timer.phase, "focus");
  assert.equal(state.timer.completed, 1);
  assert.equal(app.notifications.length, 2);
});

test("an early alarm reschedules instead of completing a session", async () => {
  const app = await background();
  await app.send("timerStart");
  app.advance(5);
  const state = await app.alarm();
  assert.equal(state.timer.status, "running");
  assert.equal(state.timer.completed, 0);
  assert.equal(app.notifications.length, 0);
  assert.equal(app.alarms.get("still-focus-timer").when, state.timer.endAt);
});

test("opening the popup reconciles an expired timer before a delayed alarm", async () => {
  const app = await background();
  await app.send("timerStart");
  app.advance(1501);
  const state = await app.get();
  assert.equal(state.timer.phase, "break");
  assert.equal(state.timer.completed, 1);
  assert.equal(app.alarms.size, 0);
});

test("a service worker restart restores a timer without changing its deadline", async () => {
  const first = await background();
  await first.send("timerStart");
  const saved = await first.get();
  const restored = await background(saved);
  assert.equal((await restored.get()).timer.endAt, saved.timer.endAt);
  assert.equal(restored.alarms.get("still-focus-timer").when, saved.timer.endAt);
});

test("settings update an idle timer but never interrupt a running or paused session", async () => {
  const app = await background();
  await app.send("setSettings", { settings: { focus: 50, break: 10, notify: false } });
  assert.equal((await app.get()).timer.remaining, 3000);
  await app.send("timerStart");
  const endAt = (await app.get()).timer.endAt;
  await app.send("setSettings", { settings: { focus: 15, break: 2, notify: false } });
  assert.equal((await app.get()).timer.endAt, endAt);
  await app.send("timerPause");
  await app.send("setSettings", { settings: { focus: 20, break: 3, notify: false } });
  assert.equal((await app.get()).timer.remaining, 3000);
  await app.send("timerReset");
  assert.equal((await app.get()).timer.remaining, 1200);
  await app.send("timerPhase", { phase: "break" });
  assert.equal((await app.get()).timer.remaining, 180);
});

test("invalid settings, volumes and modes are rejected without changing saved state", async () => {
  const app = await background();
  const before = await app.get();
  for (const focus of [0, 181, 1.5, "25"]) {
    assert.equal((await app.send("setSettings", { settings: { focus, break: 5, notify: true } })).ok, false);
  }
  assert.equal((await app.send("timerPhase", { phase: "invalid" })).ok, false);
  const mixer = structuredClone(before.mixer);
  mixer.volumes.rain = -1;
  assert.equal((await app.send("setMixer", { mixer })).ok, false);
  assert.deepEqual(await app.get(), before);
});

test("audio plays independently, reuses its offscreen document and closes it when paused", async () => {
  const app = await background();
  const mixer = (await app.get()).mixer;
  mixer.playing = true;
  assert.equal((await app.send("setMixer", { mixer })).ok, true);
  assert.equal(app.offscreen, true);
  assert.equal(app.createCount, 1);
  mixer.volumes.ocean = 40;
  await app.send("setMixer", { mixer });
  assert.equal(app.createCount, 1);
  await app.send("timerStart");
  app.advance(1500);
  await app.alarm();
  assert.equal((await app.get()).mixer.playing, true);
  mixer.playing = false;
  await app.send("setMixer", { mixer });
  assert.equal(app.offscreen, false);
  assert.equal(app.storage.state.mixer.playing, false);
});

test("silent playback and audio failures return a visible error rather than saving fake success", async () => {
  const app = await background(undefined, { audioError: true });
  const mixer = (await app.get()).mixer;
  mixer.playing = true;
  assert.equal((await app.send("setMixer", { mixer })).error, "Audio failed");
  assert.equal((await app.get()).mixer.playing, false);
  mixer.master = 0;
  assert.match((await app.send("setMixer", { mixer })).error, /Turn up/);
});

test("browser startup pauses audio while keeping the timer", async () => {
  const app = await background();
  const mixer = (await app.get()).mixer;
  mixer.playing = true;
  await app.send("setMixer", { mixer });
  await app.send("timerStart");
  app.chrome.runtime.onStartup.fire();
  const state = await app.get();
  assert.equal(state.mixer.playing, false);
  assert.equal(state.timer.status, "running");
});

test("notification failure preserves completion and records an explicit notice", async () => {
  const app = await background(undefined, { notificationError: true });
  await app.send("timerStart");
  app.advance(1500);
  assert.equal((await app.alarm()).timer.completed, 1);
  assert.match(app.storage.notice, /could not show/);
  assert.ok(app.errors.length > 0);
  await app.send("clearNotice");
  assert.equal(app.storage.notice, undefined);
});

test("disabled notifications still complete the timer", async () => {
  const app = await background();
  await app.send("setSettings", { settings: { focus: 1, break: 1, notify: false } });
  await app.send("timerStart");
  app.advance(60);
  assert.equal((await app.alarm()).timer.completed, 1);
  assert.equal(app.notifications.length, 0);
});

test("all synthesized buffers are finite, audible and loop with a quiet seam", () => {
  const context = vm.createContext({});
  vm.runInContext(read("audio.js"), context);
  const param = () => ({ value: 0, setTargetAtTime() {} });
  const node = () => ({ gain: param(), threshold: param(), knee: param(), ratio: param(), connect() {} });
  const audio = {
    sampleRate: 12000, destination: {},
    createGain: node, createDynamicsCompressor: node,
    createBuffer: (channels, length) => {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    }
  };
  const mixer = new context.SynthMixer(audio);
  for (const id of ["rain", "forest", "ocean", "stream", "wind", "fire", "thunder", "night"]) {
    const data = mixer.createBuffer(id).getChannelData(0);
    assert.equal(data.length, audio.sampleRate * 16);
    let energy = 0;
    for (const sample of data) {
      assert.ok(Number.isFinite(sample), id);
      assert.ok(Math.abs(sample) < 2, id);
      energy += sample * sample;
    }
    assert.ok(Math.sqrt(energy / data.length) > 0.005, `${id} is audible`);
    assert.equal(Math.abs(data[0]), 0);
    assert.ok(Math.abs(data[data.length - 1]) < 0.005, id);
  }
  assert.throws(() => mixer.createBuffer("invalid"), /Unknown sound/);
});

test("audio mixing creates sources only when needed and ramps volume without restarting", async () => {
  const context = vm.createContext({});
  vm.runInContext(read("audio.js"), context);
  const ramps = [];
  let sources = 0;
  const param = () => ({ value: 0, setTargetAtTime: (...args) => ramps.push(args) });
  const node = () => ({ gain: param(), threshold: param(), knee: param(), ratio: param(), connect() {} });
  const audio = {
    sampleRate: 1000, currentTime: 4, state: "running", destination: {},
    resume: async () => {},
    createGain: node, createDynamicsCompressor: node,
    createBuffer: (channels, length) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => { sources++; return { connect() {}, start() {} }; }
  };
  const mixer = new context.SynthMixer(audio);
  await mixer.apply({ master: 70, volumes: { rain: 50, ocean: 0 } });
  assert.equal(sources, 1);
  await mixer.apply({ master: 30, volumes: { rain: 0, ocean: 40 } });
  assert.equal(sources, 2);
  await mixer.apply({ master: 70, volumes: { rain: 50, ocean: 10 } });
  assert.equal(sources, 2);
  assert.ok(ramps.some(([value]) => value === 0));
  audio.state = "suspended";
  await assert.rejects(mixer.apply({ master: 70, volumes: {} }), /Audio is blocked/);
});

test("manifest uses only local resources and all declared entry points exist", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.host_permissions, undefined);
  for (const file of [manifest.background.service_worker, manifest.action.default_popup, ...Object.values(manifest.icons)]) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
  }
  const html = read("popup.html");
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);
  for (const [, file] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
  }
});
