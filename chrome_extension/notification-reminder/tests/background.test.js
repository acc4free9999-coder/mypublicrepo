import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

globalThis.crypto ||= webcrypto;
const base = {
  title: "Stretch", text: "Stand up", intervalMinutes: 0.5,
  enabled: true, sound: false, image: "", imageIcon: ""
};
const stored = { reminders: [
  { ...base, id: "existing", intervalMinutes: 5 },
  { ...base, id: "missing", intervalMinutes: 10 },
  { ...base, id: "paused", enabled: false }
] };
const alarms = new Map([
  ["reminder:existing", { name: "reminder:existing", periodInMinutes: 5, scheduledTime: 12345 }],
  ["reminder:deleted", { name: "reminder:deleted", periodInMinutes: 2 }],
  ["unrelated", { name: "unrelated", periodInMinutes: 60 }]
]);
const listeners = {};
const notifications = [];
let soundCount = 0;
let contexts = [];
let offscreenCreated = 0;
let failStorage = false;
let failSound = false;
let opened = 0;
const event = name => ({ addListener: fn => { listeners[name] = fn; } });

globalThis.chrome = {
  storage: { local: {
    get: async key => structuredClone({ [key]: stored[key] }),
    set: async values => {
      if (failStorage) throw new Error("Storage quota exceeded.");
      Object.assign(stored, structuredClone(values));
    },
    remove: async key => { delete stored[key]; }
  } },
  alarms: {
    getAll: async () => structuredClone([...alarms.values()]),
    create: async (name, options) => {
      alarms.set(name, { name, ...options, scheduledTime: options.when ?? Date.now() + options.delayInMinutes * 60000 });
    },
    clear: async name => alarms.delete(name),
    onAlarm: event("alarm")
  },
  notifications: {
    clear: async id => { notifications.push({ cleared: id }); },
    create: async (id, options) => { notifications.push({ id, options }); },
    onClicked: event("notificationClick")
  },
  runtime: {
    id: "extension-id",
    getURL: path => `chrome-extension://extension-id/${path}`,
    getPlatformInfo: async () => ({ os: "mac" }),
    getContexts: async () => contexts,
    sendMessage: async () => {
      soundCount++;
      return failSound ? { ok: false, error: "Audio playback failed." } : { ok: true };
    },
    openOptionsPage: async () => { opened++; },
    onMessage: event("message"),
    onInstalled: event("installed"),
    onStartup: event("startup")
  },
  offscreen: {
    createDocument: async () => {
      offscreenCreated++;
      contexts = [{}];
    }
  },
  action: { onClicked: event("actionClick") }
};
await import("../background.js");

function send(message) {
  return new Promise(resolve => {
    listeners.message({ target: "background", ...message }, { id: "extension-id" }, resolve);
  });
}
async function state() {
  const response = await send({ type: "getState" });
  assert.equal(response.ok, true);
  return response.state;
}

test("startup restores missing alarms, preserves existing schedules and clears deleted reminders", async () => {
  await state();
  assert.equal(alarms.get("reminder:existing").scheduledTime, 12345);
  assert.equal(alarms.get("reminder:missing").periodInMinutes, 10);
  assert.equal(alarms.has("reminder:deleted"), false);
  assert.equal(alarms.has("reminder:paused"), false);
  assert.equal(alarms.has("unrelated"), true);
});

test("saves independent intervals and pauses/resumes only the selected reminder", async () => {
  const saved = await send({ type: "save", reminder: base });
  assert.equal(saved.ok, true);
  const id = saved.state.reminders.at(-1).id;
  assert.equal(alarms.get(`reminder:${id}`).periodInMinutes, 0.5);
  await send({ type: "toggle", id, field: "enabled", value: false });
  assert.equal(alarms.has(`reminder:${id}`), false);
  assert.equal(alarms.get("reminder:existing").periodInMinutes, 5);
  await send({ type: "toggle", id, field: "enabled", value: true });
  assert.equal(alarms.get(`reminder:${id}`).periodInMinutes, 0.5);
});

test("text and sound edits preserve the schedule; interval edits reset it", async () => {
  await send({ type: "save", id: "existing", reminder: { ...base, intervalMinutes: 5, text: "New text" } });
  assert.equal(alarms.get("reminder:existing").scheduledTime, 12345);
  await send({ type: "toggle", id: "existing", field: "sound", value: true });
  assert.equal(alarms.get("reminder:existing").scheduledTime, 12345);
  await send({ type: "save", id: "existing", reminder: { ...base, intervalMinutes: 8 } });
  assert.equal(alarms.get("reminder:existing").periodInMinutes, 8);
  assert.notEqual(alarms.get("reminder:existing").scheduledTime, 12345);
});

test("silent reminders never create an audio document; sound-enabled reminders reuse one", async () => {
  await send({ type: "test", id: "missing" });
  assert.equal(soundCount, 0);
  assert.equal(offscreenCreated, 0);
  await send({ type: "toggle", id: "missing", field: "sound", value: true });
  await send({ type: "test", id: "missing" });
  await send({ type: "test", id: "missing" });
  assert.equal(soundCount, 2);
  assert.equal(offscreenCreated, 1);
  assert.equal(notifications.at(-1).options.silent, true);
});

test("alarms ignore paused/deleted reminders and notify enabled reminders", async () => {
  let count = notifications.length;
  listeners.alarm({ name: "reminder:paused" });
  listeners.alarm({ name: "reminder:deleted" });
  await state();
  assert.equal(notifications.length, count);
  listeners.alarm({ name: "reminder:existing" });
  await state();
  assert.equal(notifications.length, count + 2);
});

test("test now works for paused reminders; delete removes storage and alarm", async () => {
  assert.equal((await send({ type: "test", id: "paused" })).ok, true);
  assert.equal((await send({ type: "delete", id: "existing" })).ok, true);
  assert.equal(alarms.has("reminder:existing"), false);
  assert.equal((await state()).reminders.some(item => item.id === "existing"), false);
});

test("concurrent saves are serialized without losing reminders", async () => {
  const before = (await state()).reminders.length;
  const results = await Promise.all([
    send({ type: "save", reminder: { ...base, title: "First" } }),
    send({ type: "save", reminder: { ...base, title: "Second" } })
  ]);
  assert.ok(results.every(result => result.ok));
  assert.equal((await state()).reminders.length, before + 2);
});

test("storage and audio failures are returned explicitly and do not break subsequent operations", async () => {
  const before = (await state()).reminders.length;
  failStorage = true;
  const response = await send({ type: "save", reminder: base });
  failStorage = false;
  assert.equal(response.ok, false);
  assert.match(response.error, /quota/);
  assert.equal((await state()).reminders.length, before);
  failSound = true;
  const audio = await send({ type: "test", id: "missing" });
  failSound = false;
  assert.equal(audio.ok, false);
  assert.match(audio.error, /Audio/);
  // Wait for error reporting before checking the stored manager notice.
  await new Promise(resolve => setImmediate(resolve));
  assert.match((await state()).notice, /Audio/);
  assert.equal((await send({ type: "dismissNotice" })).state.notice, "");
});

test("invalid input and stale edits are rejected instead of overwriting data", async () => {
  assert.equal((await send({ type: "save", reminder: { ...base, intervalMinutes: 0.49 } })).ok, false);
  assert.equal((await send({ type: "save", id: "deleted", reminder: base })).ok, false);
  assert.equal((await send({ type: "toggle", id: "missing", field: "sound", value: "false" })).ok, false);
});

test("toolbar and notification clicks open the manager", async () => {
  listeners.actionClick();
  listeners.notificationClick("reminder:missing");
  listeners.notificationClick("unrelated");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(opened, 2);
});

test("start minute creates an anchored alarm and edits preserve or reset it as appropriate", async () => {
  const now = new Date(2026, 9, 6, 13, 5).getTime();
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    const reminder = { ...base, startMinute: 10, intervalMinutes: 60 };
    const saved = await send({ type: "save", reminder });
    assert.equal(saved.ok, true);
    const id = saved.state.reminders.at(-1).id;
    const name = `reminder:${id}`;
    const at = (hour, minute) => new Date(2026, 9, 6, hour, minute).getTime();
    assert.equal(alarms.get(name).when, at(13, 10));
    assert.equal(alarms.get(name).periodInMinutes, 60);
    assert.equal(saved.state.reminders.at(-1).startMinute, 10);
    assert.equal(saved.state.reminders.at(-1).nextAt, at(13, 10));
    alarms.get(name).scheduledTime = at(14, 10);
    await send({ type: "save", id, reminder: { ...reminder, text: "Edited" } });
    await send({ type: "toggle", id, field: "sound", value: true });
    listeners.startup();
    await state();
    assert.equal(alarms.get(name).scheduledTime, at(14, 10));
    await send({ type: "save", id, reminder: { ...reminder, startMinute: 20 } });
    assert.equal(alarms.get(name).scheduledTime, at(13, 20));
    await send({ type: "save", id, reminder: { ...reminder, startMinute: 20, intervalMinutes: 30 } });
    assert.equal(alarms.get(name).when, at(13, 20));
    assert.equal(alarms.get(name).periodInMinutes, 30);
    await send({ type: "toggle", id, field: "enabled", value: false });
    assert.equal(alarms.has(name), false);
    Date.now = () => at(13, 25);
    await send({ type: "toggle", id, field: "enabled", value: true });
    assert.equal(alarms.get(name).when, at(14, 20));
    alarms.delete(name);
    listeners.startup();
    await state();
    assert.equal(alarms.get(name).when, at(14, 20));
    await send({ type: "save", id, reminder: { ...reminder, startMinute: null } });
    assert.equal(alarms.get(name).when, undefined);
    assert.equal(alarms.get(name).scheduledTime, at(14, 25));
  } finally {
    Date.now = originalNow;
  }
});
