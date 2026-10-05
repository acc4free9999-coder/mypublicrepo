import test from "node:test";
import assert from "node:assert/strict";
import { validateReminder, notificationOptions } from "../reminders.js";

const base = {
  title: "Stretch", text: "Stand up", intervalMinutes: 0.5,
  enabled: true, sound: false, image: "", imageIcon: ""
};
const image = "data:image/jpeg;base64,YWJj";
const imageIcon = "data:image/png;base64,YWJj";

test("validates text-only and image-only reminders and trims text", () => {
  assert.deepEqual(validateReminder({ ...base, title: " Stretch ", text: " Stand up " }, "one"), { id: "one", ...base });
  assert.equal(validateReminder({ ...base, text: "", image, imageIcon }, "two").image, image);
});

test("requires a title and text or image", () => {
  assert.throws(() => validateReminder({ ...base, title: " " }, "one"), /title/);
  assert.throws(() => validateReminder({ ...base, text: "" }, "one"), /text or an image/);
  assert.throws(() => validateReminder({ ...base, text: "x".repeat(1001) }, "one"), /1,000/);
});

test("enforces the exact minimum interval and rejects invalid numbers", () => {
  assert.equal(validateReminder(base, "one").intervalMinutes, 0.5);
  for (const intervalMinutes of [0.499, 0, -1, NaN, Infinity, "30", 525601]) {
    assert.throws(() => validateReminder({ ...base, intervalMinutes }, "one"), /interval/);
  }
  assert.equal(validateReminder({ ...base, intervalMinutes: 525600 }, "one").intervalMinutes, 525600);
});

test("rejects remote images, invalid image pairs and invalid toggles", () => {
  assert.throws(() => validateReminder({ ...base, image: "https://example.com/a.png" }, "one"), /uploaded/);
  assert.throws(() => validateReminder({ ...base, image }, "one"), /again/);
  assert.throws(() => validateReminder({ ...base, image: "data:image/svg+xml;base64,YWJj" }, "one"), /uploaded/);
  assert.throws(() => validateReminder({ ...base, sound: "false" }, "one"), /settings/);
});

test("native notifications are silent; sound is handled separately", () => {
  assert.equal(notificationOptions(base, "mac").silent, true);
  assert.equal(notificationOptions({ ...base, sound: true }, "win").silent, true);
  assert.equal(notificationOptions(base, "linux").iconUrl, "icons/icon128.png");
});

test("macOS uses the uploaded icon while other platforms display expanded images", () => {
  const reminder = { ...base, text: "", image, imageIcon };
  const mac = notificationOptions(reminder, "mac");
  assert.equal(mac.type, "basic");
  assert.equal(mac.iconUrl, imageIcon);
  assert.equal(mac.imageUrl, undefined);
  assert.equal(notificationOptions(reminder, "win").imageUrl, image);
  assert.equal(notificationOptions(reminder, "linux").type, "image");
  assert.equal(mac.message, "Your image reminder is ready.");
});
