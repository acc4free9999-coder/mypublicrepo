# Reminder List

A Chrome Manifest V3 extension for recurring text and image reminders. Every
reminder has its own interval, enabled switch and sound switch. Data and uploaded
images stay in local extension storage; no account or network access is needed.

## Install

1. Open `chrome://extensions` in Chrome 120 or later.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this `notification-reminder` folder.
4. Click the extension's toolbar icon to open the reminder manager. You can also
   use **Extension options** from the extension's menu.

## Use

Enter a title, add text and/or an image, choose an interval in minutes and click
**Add reminder**. For example, `0.5` means 30 seconds, `60` means an hour and
`1440` means a day. The first notification arrives after one interval.

- Reminders are subject to Chrome's limits: 10 MB of local storage and at most
  500 active alarms.
- Pause or resume a reminder with **Enabled**, without deleting it.
- Toggle **Sound** independently for each reminder. Notifications suppress the
  default system sound; enabled sound uses the extension's gentle two-note chime.
- Use **Test now** to check a saved reminder immediately, even when paused.
- Edit text or sound without resetting the schedule. Changing the interval or
  resuming a paused reminder starts a fresh interval.
- Delete removes the reminder and its scheduled alarm.
- Click a notification to open the reminder manager.

PNG, JPEG and WebP uploads up to 10 MB are resized to a maximum of 1,000 pixels
and converted to JPEG; a smaller PNG is used as the notification icon. Chrome
does not support large notification images on macOS, so macOS displays the image
as an icon. Other platforms use an expanded image notification. The manager
always displays the full uploaded image.

Keep Chrome running. Alarms do not wake a sleeping computer, may run late and
do not replay every missed interval. Missing alarms are recreated when the
extension starts; existing alarms retain their schedule. Chrome and operating
system notification permissions, Do Not Disturb, and audio settings can affect
delivery. Allow Chrome notifications in system settings and use **Test now**.
Background errors are logged and shown as notices in the manager.

## Development

No build or dependencies are required. Run the tests with Node.js 18 or later:

```sh
npm test
```

After changing extension code, reload it at `chrome://extensions` and refresh
the manager tab. Native notifications, sound and restart behavior should also
be checked in a loaded Chrome extension.
