import { ALARM_PREFIX, validateReminder, notificationOptions } from "./reminders.js";

let queue = Promise.resolve();
let creatingOffscreen;

async function readReminders() {
  const { reminders = [] } = await chrome.storage.local.get("reminders");
  return reminders;
}

async function reconcile() {
  const reminders = await readReminders();
  const alarms = await chrome.alarms.getAll();
  const active = new Map(reminders.filter(item => item.enabled).map(item => [ALARM_PREFIX + item.id, item]));
  for (const alarm of alarms) {
    if (alarm.name.startsWith(ALARM_PREFIX) && !active.has(alarm.name)) {
      await chrome.alarms.clear(alarm.name);
    }
  }
  for (const [name, reminder] of active) {
    const alarm = alarms.find(item => item.name === name);
    if (!alarm || alarm.periodInMinutes !== reminder.intervalMinutes) {
      await chrome.alarms.create(name, {
        delayInMinutes: reminder.intervalMinutes,
        periodInMinutes: reminder.intervalMinutes
      });
    }
  }
}

async function reportError(error) {
  console.error("Reminder List:", error);
  try {
    await chrome.storage.local.set({ notice: error.message });
  } catch (storageError) {
    console.error("Reminder List: could not save error notice", storageError);
  }
}

const ready = reconcile();
ready.catch(reportError);

function enqueue(operation) {
  const result = queue.then(() => ready).then(operation);
  queue = result.then(() => undefined, () => undefined);
  return result;
}

async function playSound() {
  if (!creatingOffscreen) {
    creatingOffscreen = (async () => {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [chrome.runtime.getURL("offscreen.html")]
      });
      if (!contexts.length) {
        await chrome.offscreen.createDocument({
          url: "offscreen.html",
          reasons: ["AUDIO_PLAYBACK"],
          justification: "Play the chime for reminders that have sound enabled."
        });
      }
    })();
  }
  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
  const response = await chrome.runtime.sendMessage({ target: "offscreen", type: "chime" });
  if (!response?.ok) throw new Error(response?.error || "The reminder sound could not play.");
}

async function notify(reminder) {
  const { os } = await chrome.runtime.getPlatformInfo();
  const id = ALARM_PREFIX + reminder.id;
  await chrome.notifications.clear(id);
  await chrome.notifications.create(id, notificationOptions(reminder, os));
  if (reminder.sound) await playSound();
}

async function getState() {
  const reminders = await readReminders();
  const alarms = await chrome.alarms.getAll();
  const { notice = "" } = await chrome.storage.local.get("notice");
  return {
    reminders: reminders.map(item => ({
      ...item,
      nextAt: alarms.find(alarm => alarm.name === ALARM_PREFIX + item.id)?.scheduledTime || null
    })),
    notice
  };
}

async function handleMessage(message) {
  if (message.type === "getState") return getState();
  if (message.type === "dismissNotice") {
    await chrome.storage.local.remove("notice");
    return getState();
  }
  const reminders = await readReminders();
  const index = reminders.findIndex(item => item.id === message.id);
  if (message.type === "save") {
    if (message.id && index < 0) throw new Error("This reminder no longer exists. Refresh the list.");
    const id = message.id || crypto.randomUUID();
    const reminder = validateReminder(message.reminder, id);
    if (index >= 0) reminders[index] = reminder;
    else reminders.push(reminder);
    await chrome.storage.local.set({ reminders });
    await reconcile();
  } else if (message.type === "toggle") {
    if (index < 0) throw new Error("This reminder no longer exists.");
    if (!["enabled", "sound"].includes(message.field) || typeof message.value !== "boolean") {
      throw new Error("Invalid reminder setting.");
    }
    reminders[index][message.field] = message.value;
    await chrome.storage.local.set({ reminders });
    await reconcile();
  } else if (message.type === "delete") {
    if (index < 0) throw new Error("This reminder no longer exists.");
    reminders.splice(index, 1);
    await chrome.storage.local.set({ reminders });
    await reconcile();
    await chrome.notifications.clear(ALARM_PREFIX + message.id);
  } else if (message.type === "test") {
    if (index < 0) throw new Error("Save this reminder before testing it.");
    await notify(reminders[index]);
  } else {
    throw new Error("Unknown reminder action.");
  }
  return getState();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "background" || sender.id !== chrome.runtime.id) return false;
  enqueue(() => handleMessage(message)).then(
    state => sendResponse({ ok: true, state }),
    error => {
      reportError(error);
      sendResponse({ ok: false, error: error.message });
    }
  );
  return true;
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  enqueue(async () => {
    const reminder = (await readReminders()).find(item => ALARM_PREFIX + item.id === alarm.name);
    if (reminder?.enabled) await notify(reminder);
  }).catch(reportError);
});
chrome.runtime.onInstalled.addListener(() => { enqueue(reconcile).catch(reportError); });
chrome.runtime.onStartup.addListener(() => { enqueue(reconcile).catch(reportError); });
chrome.action.onClicked.addListener(() => { chrome.runtime.openOptionsPage().catch(reportError); });
chrome.notifications.onClicked.addListener(id => {
  if (id.startsWith(ALARM_PREFIX)) chrome.runtime.openOptionsPage().catch(reportError);
});
