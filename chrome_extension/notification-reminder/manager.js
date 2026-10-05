const $ = id => document.getElementById(id);
let editingId = null;
let image = "";
let imageIcon = "";
let imageVersion = 0;
let busy = false;

async function request(message) {
  const response = await chrome.runtime.sendMessage({ target: "background", ...message });
  if (!response?.ok) throw new Error(response?.error || "The extension did not respond. Please reload this page.");
  render(response.state);
}

function showError(error) {
  $("error").textContent = error.message;
  $("error").hidden = false;
}

async function perform(operation) {
  if (busy) return;
  busy = true;
  $("error").hidden = true;
  document.querySelectorAll("button, input, textarea").forEach(element => { element.disabled = true; });
  try {
    await operation();
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    document.querySelectorAll("button, input, textarea").forEach(element => { element.disabled = false; });
  }
}

function updatePreview() {
  $("image-preview").hidden = !image;
  if (image) $("preview").src = image;
  else $("preview").removeAttribute("src");
}

function resetEditor() {
  editingId = null;
  image = "";
  imageIcon = "";
  imageVersion++;
  $("reminder-form").reset();
  $("editor-title").textContent = "New reminder";
  $("save").textContent = "Add reminder";
  $("cancel").hidden = true;
  updatePreview();
}

function edit(reminder) {
  editingId = reminder.id;
  image = reminder.image;
  imageIcon = reminder.imageIcon;
  imageVersion++;
  $("image").value = "";
  $("title").value = reminder.title;
  $("text").value = reminder.text;
  $("interval").value = reminder.intervalMinutes;
  $("enabled").checked = reminder.enabled;
  $("sound").checked = reminder.sound;
  $("editor-title").textContent = "Edit reminder";
  $("save").textContent = "Save changes";
  $("cancel").hidden = false;
  updatePreview();
  $("title").focus();
  $("reminder-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function render(state) {
  const enabledCount = state.reminders.filter(item => item.enabled).length;
  $("count").textContent = `${enabledCount} active / ${state.reminders.length} total`;
  $("empty").hidden = state.reminders.length !== 0;
  $("notice").hidden = !state.notice;
  $("notice-text").textContent = state.notice;
  $("list").replaceChildren();
  for (const reminder of state.reminders) {
    const card = $("reminder-card").content.cloneNode(true);
    card.querySelector("h3").textContent = reminder.title;
    card.querySelector(".status").textContent = reminder.enabled ? "Active" : "Paused";
    card.querySelector(".body-text").textContent = reminder.text;
    const img = card.querySelector(".card-image");
    img.hidden = !reminder.image;
    if (reminder.image) img.src = reminder.image;
    card.querySelector(".schedule").textContent = `Every ${reminder.intervalMinutes} minute${reminder.intervalMinutes === 1 ? "" : "s"}`;
    card.querySelector(".next").textContent = !reminder.enabled
      ? "Paused - no scheduled notification"
      : reminder.nextAt ? `Next: ${new Date(reminder.nextAt).toLocaleString()}`
        : "Schedule unavailable - check the error notice.";
    for (const field of ["enabled", "sound"]) {
      const checkbox = card.querySelector(`.${field}-toggle`);
      checkbox.checked = reminder[field];
      checkbox.addEventListener("change", () => {
        const value = checkbox.checked;
        checkbox.checked = reminder[field];
        perform(() => request({ type: "toggle", id: reminder.id, field, value }));
      });
    }
    card.querySelector(".edit").addEventListener("click", () => edit(reminder));
    card.querySelector(".test").addEventListener("click", () => perform(() => request({ type: "test", id: reminder.id })));
    card.querySelector(".delete").addEventListener("click", () => {
      if (!confirm(`Delete "${reminder.title}"?`)) return;
      perform(async () => {
        await request({ type: "delete", id: reminder.id });
        if (editingId === reminder.id) resetEditor();
      });
    });
    $("list").append(card);
  }
  if (busy) $("list").querySelectorAll("button, input").forEach(element => { element.disabled = true; });
}

function resizedImage(bitmap, maxSize, type, quality) {
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type, quality);
}

$("image").addEventListener("change", () => {
  const file = $("image").files[0];
  if (!file) return;
  const version = ++imageVersion;
  perform(async () => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Choose a PNG, JPEG or WebP image.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
    const bitmap = await createImageBitmap(file);
    try {
      const nextImage = resizedImage(bitmap, 1000, "image/jpeg", 0.8);
      const nextIcon = resizedImage(bitmap, 128, "image/png");
      if (nextImage.length > 750000) throw new Error("This image is too detailed. Try a smaller image.");
      if (version !== imageVersion) return;
      image = nextImage;
      imageIcon = nextIcon;
      updatePreview();
    } finally {
      bitmap.close();
      $("image").value = "";
    }
  });
});
$("remove-image").addEventListener("click", () => {
  image = "";
  imageIcon = "";
  imageVersion++;
  $("image").value = "";
  updatePreview();
});
$("cancel").addEventListener("click", resetEditor);
$("dismiss").addEventListener("click", () => perform(() => request({ type: "dismissNotice" })));
$("reminder-form").addEventListener("submit", event => {
  event.preventDefault();
  perform(async () => {
    await request({
      type: "save", id: editingId,
      reminder: {
        title: $("title").value, text: $("text").value,
        intervalMinutes: Number($("interval").value),
        enabled: $("enabled").checked, sound: $("sound").checked, image, imageIcon
      }
    });
    resetEditor();
  });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.reminders || changes.notice)) request({ type: "getState" }).catch(showError);
});
request({ type: "getState" }).catch(showError);
setInterval(() => request({ type: "getState" }).catch(showError), 30000);
