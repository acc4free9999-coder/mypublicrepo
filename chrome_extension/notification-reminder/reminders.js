export const ALARM_PREFIX = "reminder:";

export function alarmOptions(reminder, now = Date.now()) {
  if (reminder.startMinute == null) {
    return { delayInMinutes: reminder.intervalMinutes, periodInMinutes: reminder.intervalMinutes };
  }
  const start = new Date(now);
  start.setMinutes(reminder.startMinute, 0, 0);
  if (start.getTime() <= now) start.setHours(start.getHours() + 1);
  return { when: start.getTime(), periodInMinutes: reminder.intervalMinutes };
}

export function validateReminder(input, id) {
  if (!input || typeof input !== "object") throw new Error("Invalid reminder.");
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!title || title.length > 100) throw new Error("Enter a title of 1 to 100 characters.");
  if (text.length > 1000) throw new Error("Reminder text must be at most 1,000 characters.");
  if (!Number.isFinite(input.intervalMinutes) || input.intervalMinutes < 0.5
    || input.intervalMinutes > 525600) {
    throw new Error("The interval must be between 0.5 and 525,600 minutes.");
  }
  if (typeof input.enabled !== "boolean" || typeof input.sound !== "boolean") {
    throw new Error("Choose valid reminder and sound settings.");
  }
  const startMinute = input.startMinute ?? null;
  if (startMinute !== null && (!Number.isInteger(startMinute) || startMinute < 0 || startMinute > 59)) {
    throw new Error("Start minute must be a whole number from 0 to 59, or left blank.");
  }
  for (const field of ["image", "imageIcon"]) {
    if (typeof input[field] !== "string" || input[field].length > 750000
      || (input[field] && !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(input[field]))) {
      throw new Error("Use a valid uploaded PNG or JPEG image.");
    }
  }
  if (Boolean(input.image) !== Boolean(input.imageIcon)) throw new Error("Upload the image again.");
  if (!text && !input.image) throw new Error("Add reminder text or an image.");
  return {
    id, title, text, intervalMinutes: input.intervalMinutes, startMinute,
    enabled: input.enabled, sound: input.sound, image: input.image, imageIcon: input.imageIcon
  };
}

export function notificationOptions(reminder, os) {
  const options = {
    type: "basic",
    iconUrl: reminder.imageIcon || "icons/icon128.png",
    title: reminder.title,
    message: reminder.text || "Your image reminder is ready.",
    silent: true
  };
  if (reminder.image && os !== "mac") {
    options.type = "image";
    options.imageUrl = reminder.image;
  }
  return options;
}
