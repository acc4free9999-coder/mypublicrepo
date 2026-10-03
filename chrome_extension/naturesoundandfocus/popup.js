/* global chrome, NatureFocus */
const $ = id => document.getElementById(id);
let state;
let pending = Promise.resolve();
const lastVolumes = {};

function showError(error) {
  $("error").textContent = error.message;
  $("error").hidden = false;
}

async function request(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({ target: "background", type, ...extra });
  if (!response?.ok) throw new Error(response?.error || "Could not connect to Still. Please reopen the extension.");
  return response.state;
}

function action(type, extra = {}) {
  pending = pending.then(async () => {
    state = await request(type, typeof extra === "function" ? extra() : extra);
    $("error").hidden = true;
    render();
  }).catch(error => {
    showError(error);
    render();
  });
  return pending;
}

function changeMixer(update) {
  return action("setMixer", () => {
    const mixer = structuredClone(state.mixer);
    update(mixer);
    // A fully silent mix is paused to avoid an offscreen document timing out silently.
    if (mixer.master === 0 || !Object.values(mixer.volumes).some(volume => volume > 0)) mixer.playing = false;
    return { mixer };
  });
}

function setRange(input, value) {
  // Don't move a slider underneath a pointer while storage updates arrive.
  if (document.activeElement !== input) input.value = value;
  input.style.setProperty("--fill", `${input.value}%`);
}

function renderTimer() {
  if (!state) return;
  const timer = state.timer;
  const left = NatureFocus.remaining(timer);
  $("timer-time").textContent = NatureFocus.formatTime(left);
  $("ring-progress").style.strokeDashoffset = 389.558 * (1 - left / timer.duration);
  $("timer-status").textContent = timer.status === "running" ? (timer.phase === "focus" ? "YOU'RE DOING GREAT" : "TAKE A BREATH")
    : timer.status === "paused" ? "A MOMENT TO BREATHE" : "MAKE ROOM FOR FLOW";
  $("focus-mode").setAttribute("aria-pressed", String(timer.phase === "focus"));
  $("break-mode").setAttribute("aria-pressed", String(timer.phase === "break"));
  $("timer-start").querySelector("use").setAttribute("href", timer.status === "running" ? "#icon-pause" : "#icon-play");
  $("timer-start").querySelector("span").textContent = timer.status === "running" ? "Pause timer"
    : timer.status === "paused" ? "Resume" : `Start ${timer.phase}`;
  $("session-count").textContent = `${timer.completed} session${timer.completed === 1 ? "" : "s"} completed`;
}

function render() {
  if (!state) return;
  renderTimer();
  const mixer = state.mixer;
  const active = NatureFocus.sounds.filter(sound => mixer.volumes[sound.id] > 0);
  $("active-count").textContent = `${active.length} selected`;
  for (const sound of NatureFocus.sounds) {
    const value = mixer.volumes[sound.id];
    const card = $(`sound-${sound.id}`);
    card.classList.toggle("active", value > 0);
    card.querySelector("button").setAttribute("aria-pressed", String(value > 0));
    setRange($(`volume-${sound.id}`), value);
    $(`output-${sound.id}`).textContent = `${value}%`;
    if (value > 0) lastVolumes[sound.id] = value;
  }
  document.querySelectorAll("[data-preset]").forEach(button => {
    const preset = NatureFocus.presets[button.dataset.preset];
    button.setAttribute("aria-pressed", String(NatureFocus.sounds.every(sound =>
      mixer.volumes[sound.id] === (preset[sound.id] || 0))));
  });
  $("play-all").querySelector("use").setAttribute("href", mixer.playing ? "#icon-pause" : "#icon-play");
  $("play-all").querySelector("span").textContent = mixer.playing ? "Pause sounds" : "Play sounds";
  $("playing-indicator").classList.toggle("live", mixer.playing);
  $("mix-status").textContent = mixer.playing ? `${active.length} sound${active.length === 1 ? "" : "s"} · Playing in the background` : "Ready when you are";
  setRange($("master-volume"), mixer.master);
  $("master-output").textContent = `${mixer.master}%`;
}

function createSoundCards() {
  for (const sound of NatureFocus.sounds) {
    const card = document.createElement("article");
    card.className = "sound-card";
    card.id = `sound-${sound.id}`;
    card.innerHTML = `<button class="sound-toggle" aria-pressed="false" aria-label="Toggle ${sound.name}">
      <span class="sound-icon"><svg aria-hidden="true"><use href="#icon-${sound.icon}"/></svg></span>
      <span><span class="sound-name">${sound.name}</span><span class="sound-subtitle">${sound.subtitle}</span></span>
      <span class="sound-dot"></span></button>
      <div class="sound-volume"><input id="volume-${sound.id}" type="range" min="0" max="100" value="0" aria-label="${sound.name} volume"><output id="output-${sound.id}" for="volume-${sound.id}">0%</output></div>`;
    $("sound-grid").append(card);
    card.querySelector("button").addEventListener("click", () => changeMixer(mixer => {
      mixer.volumes[sound.id] = mixer.volumes[sound.id] > 0 ? 0 : (lastVolumes[sound.id] || 50);
    }));
    const input = $(`volume-${sound.id}`);
    input.addEventListener("input", () => {
      input.style.setProperty("--fill", `${input.value}%`);
      $(`output-${sound.id}`).textContent = `${input.value}%`;
    });
    input.addEventListener("change", () => {
      const volume = Number(input.value);
      changeMixer(mixer => { mixer.volumes[sound.id] = volume; });
    });
  }
}

async function init() {
  try {
    state = await request("getState");
    createSoundCards();
    render();
    $("timer-start").addEventListener("click", () => action(state.timer.status === "running" ? "timerPause" : "timerStart"));
    $("timer-reset").addEventListener("click", () => action("timerReset"));
    $("focus-mode").addEventListener("click", () => {
      if (state.timer.phase !== "focus") action("timerPhase", { phase: "focus" });
    });
    $("break-mode").addEventListener("click", () => {
      if (state.timer.phase !== "break") action("timerPhase", { phase: "break" });
    });
    $("play-all").addEventListener("click", () => action("setMixer", () => ({
      mixer: { ...structuredClone(state.mixer), playing: !state.mixer.playing }
    })));
    $("master-volume").addEventListener("input", event => {
      event.target.style.setProperty("--fill", `${event.target.value}%`);
      $("master-output").textContent = `${event.target.value}%`;
    });
    $("master-volume").addEventListener("change", event => {
      const value = Number(event.target.value);
      changeMixer(mixer => { mixer.master = value; });
    });
    document.querySelectorAll("[data-preset]").forEach(button => button.addEventListener("click", () => {
      changeMixer(mixer => {
        const preset = NatureFocus.presets[button.dataset.preset];
        mixer.volumes = Object.fromEntries(NatureFocus.sounds.map(sound => [sound.id, preset[sound.id] || 0]));
      });
    }));
    $("settings-toggle").addEventListener("click", () => {
      const open = $("settings-panel").hidden;
      $("settings-panel").hidden = !open;
      $("settings-toggle").setAttribute("aria-expanded", String(open));
      if (open) {
        $("focus-minutes").value = state.settings.focus;
        $("break-minutes").value = state.settings.break;
        $("notify").checked = state.settings.notify;
      }
    });
    $("settings-form").addEventListener("submit", async event => {
      event.preventDefault();
      const settings = {
        focus: Number($("focus-minutes").value),
        break: Number($("break-minutes").value),
        notify: $("notify").checked
      };
      await action("setSettings", { settings });
      if ($("error").hidden) {
        $("settings-panel").hidden = true;
        $("settings-toggle").setAttribute("aria-expanded", "false");
      }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.state?.newValue) {
        state = changes.state.newValue;
        render();
      }
      if (changes.notice?.newValue) showError(new Error(changes.notice.newValue));
    });
    const { notice } = await chrome.storage.local.get("notice");
    if (notice) {
      showError(new Error(notice));
      await request("clearNotice");
    }
    setInterval(renderTimer, 250);
  } catch (error) {
    showError(error);
    document.querySelectorAll("button, input").forEach(control => { control.disabled = true; });
  }
}

init();
