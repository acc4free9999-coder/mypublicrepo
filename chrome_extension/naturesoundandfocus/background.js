/* global chrome, NatureFocus, importScripts */
importScripts("shared.js");

const TIMER_ALARM = "still-focus-timer";
let state;
let queue = Promise.resolve();
let creatingOffscreen;

async function persist() {
  await chrome.storage.local.set({ state });
}

async function ensureOffscreen() {
  if (creatingOffscreen) return creatingOffscreen;
  creatingOffscreen = (async () => {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL("offscreen.html")]
    });
    if (!contexts.length) {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Keep nature sound mixes playing when the extension popup is closed."
      });
    }
  })();
  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

async function applyAudio(mixer) {
  if (!mixer.playing) {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
    if (contexts.length) await chrome.offscreen.closeDocument();
    return;
  }
  await ensureOffscreen();
  const result = await chrome.runtime.sendMessage({ target: "offscreen", type: "mix", mixer });
  if (!result?.ok) throw new Error(result?.error || "The sound engine did not respond. Please try again.");
}

async function updateBadge() {
  await chrome.action.setBadgeBackgroundColor({ color: "#357766" });
  await chrome.action.setBadgeText({ text: state.timer.status === "running"
    ? (state.timer.phase === "focus" ? "FOCUS" : "BREAK") : "" });
}

async function finishTimer() {
  if (state.timer.status !== "running") return;
  const finishedPhase = state.timer.phase;
  const phase = finishedPhase === "focus" ? "break" : "focus";
  const duration = state.settings[phase] * 60;
  state.timer = {
    phase, status: "idle", duration, remaining: duration, endAt: null,
    completed: state.timer.completed + (finishedPhase === "focus" ? 1 : 0)
  };
  await chrome.alarms.clear(TIMER_ALARM);
  await persist();
  await updateBadge();
  if (state.settings.notify) {
    try {
      await chrome.notifications.create("still-timer-complete", {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: finishedPhase === "focus" ? "Nice work. Take a breath." : "Ready for a fresh start?",
        message: finishedPhase === "focus"
          ? "Your focus session is complete. Start a short break when you're ready."
          : "Your break is complete. Your next focus session is ready.",
        priority: 1
      });
    } catch (error) {
      console.error("Still: timer notification failed", error);
      await chrome.storage.local.set({ notice: "Your timer finished, but Chrome could not show a notification." });
    }
  }
}

async function reconcileTimer() {
  if (state.timer.status !== "running") {
    await chrome.alarms.clear(TIMER_ALARM);
  } else if (state.timer.endAt <= Date.now()) {
    await finishTimer();
  } else {
    await chrome.alarms.create(TIMER_ALARM, { when: state.timer.endAt });
  }
}

async function initialize() {
  const stored = await chrome.storage.local.get("state");
  state = stored.state || NatureFocus.defaultState();
  await reconcileTimer();
  await updateBadge();
}

const ready = initialize();

function enqueue(operation) {
  const result = queue.then(() => ready).then(operation);
  queue = result.catch(error => console.error("Still:", error));
  return result;
}

async function handleMessage(message) {
  // A delayed alarm must not allow a new action to revive an expired session.
  if (state.timer.status === "running" && state.timer.endAt <= Date.now()) await finishTimer();
  switch (message.type) {
    case "getState":
      return state;
    case "setMixer": {
      const mixer = message.mixer;
      if (!mixer || typeof mixer.playing !== "boolean" || !NatureFocus.volume(mixer.master)
        || !NatureFocus.sounds.every(sound => NatureFocus.volume(mixer.volumes?.[sound.id]))) {
        throw new Error("Invalid sound mix.");
      }
      if (mixer.playing && (mixer.master === 0 || !Object.values(mixer.volumes).some(value => value > 0))) {
        throw new Error("Turn up the master volume and at least one sound before playing.");
      }
      await applyAudio(mixer);
      state.mixer = {
        playing: mixer.playing, master: mixer.master,
        volumes: Object.fromEntries(NatureFocus.sounds.map(sound => [sound.id, mixer.volumes[sound.id]]))
      };
      await persist();
      return state;
    }
    case "timerStart":
      if (state.timer.status !== "running") {
        state.timer.status = "running";
        state.timer.endAt = Date.now() + state.timer.remaining * 1000;
        await reconcileTimer();
      }
      break;
    case "timerPause":
      if (state.timer.status === "running") {
        state.timer.remaining = NatureFocus.remaining(state.timer);
        state.timer.status = "paused";
        state.timer.endAt = null;
        await chrome.alarms.clear(TIMER_ALARM);
      }
      break;
    case "timerReset":
    case "timerPhase": {
      const phase = message.type === "timerReset" ? state.timer.phase : message.phase;
      if (phase !== "focus" && phase !== "break") throw new Error("Invalid timer mode.");
      const duration = state.settings[phase] * 60;
      state.timer = { ...state.timer, phase, status: "idle", duration, remaining: duration, endAt: null };
      await chrome.alarms.clear(TIMER_ALARM);
      break;
    }
    case "setSettings": {
      const settings = message.settings;
      if (!settings || !Number.isInteger(settings.focus) || settings.focus < 1 || settings.focus > 180
        || !Number.isInteger(settings.break) || settings.break < 1 || settings.break > 60
        || typeof settings.notify !== "boolean") {
        throw new Error("Choose 1–180 focus minutes and 1–60 break minutes.");
      }
      state.settings = { focus: settings.focus, break: settings.break, notify: settings.notify };
      if (state.timer.status === "idle") {
        state.timer.duration = settings[state.timer.phase] * 60;
        state.timer.remaining = state.timer.duration;
      }
      break;
    }
    case "clearNotice":
      await chrome.storage.local.remove("notice");
      return state;
    default:
      throw new Error("Unknown extension action.");
  }
  await persist();
  await updateBadge();
  return state;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "background") return false;
  enqueue(() => handleMessage(message)).then(
    value => sendResponse({ ok: true, state: value }),
    error => sendResponse({ ok: false, error: error.message })
  );
  return true;
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === TIMER_ALARM) enqueue(reconcileTimer);
});

chrome.runtime.onStartup.addListener(() => {
  enqueue(async () => {
    // Audio documents do not survive a browser restart; don't auto-play on startup.
    state.mixer.playing = false;
    await persist();
    await reconcileTimer();
  });
});

chrome.runtime.onInstalled.addListener(() => enqueue(persist));
