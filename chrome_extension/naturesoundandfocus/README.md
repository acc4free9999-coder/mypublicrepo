# Still — Nature Sounds & Focus

A self-contained Chrome extension for a quieter workday. Mix eight nature-inspired
soundscapes and three gentle instrument melodies with a focus/break timer, without
accounts, network requests, tracking, or downloaded audio.

## Install

1. Use Chrome 116 or newer.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select this `naturesoundandfocus` folder.
4. Pin **Still — Nature Sounds & Focus** from Chrome's Extensions menu.
5. Open Still, select sounds, and click **Play sounds**. Start the timer separately.

## Features

- Soft rain, forest birds, ocean waves, flowing stream, mountain wind, campfire,
  distant thunder, and summer-night crickets.
- Gentle piano, acoustic guitar, and peaceful flute: original, synthesized
  32-second melodies with soft echoes and looping note releases.
- Layer sounds with independent volume sliders and a master volume.
- Four quick mixes: Woodland, Rainy day, Coastline, and Cozy cabin.
- A 25-minute focus timer and 5-minute break, with customizable durations
  (focus: 1–180 minutes; break: 1–60 minutes).
- Pause, resume, reset, and manually switch timer modes. Changing modes resets the
  countdown. Each completed focus session increments the saved session count.
- Optional completion notifications and a toolbar badge during a running timer.
- Mixes, settings, and timer state are saved automatically.

Audio is **procedurally synthesized with Web Audio**, not field or instrument recordings.
The sounds are nature-inspired textures and instrument-inspired melodies;
no third-party sound assets are used. All three instruments share a compatible
musical scale and can be layered with the nature sounds or played individually.
Existing saved mixes keep their volumes when updating; new instruments start muted.
Rain uses an equal-power overlap at its loop boundary to maintain continuous
sound without a fade-to-silence between repeats.
Sound selection does not start playback automatically. Sliders apply when released.
Muting every sound or setting master volume to zero pauses playback.

Closing the popup does not stop playback or the timer. Timer deadlines are stored
as timestamps and handled by Chrome alarms rather than a popup interval. On
completion the next mode is prepared, but does not auto-start. Sound continues
through session changes. Chrome or operating-system sleep may delay the notification;
the timer reconciles the stored deadline when Chrome wakes or the popup opens.
After a browser restart, audio stays paused; an unfinished timer is restored.
Session totals are cumulative, not daily. Notifications may also need to be enabled
for Chrome in your operating-system settings.

## Privacy and permissions

- `storage`: save your mix and timer on this device (not Chrome sync).
- `offscreen`: keep Web Audio playing outside the popup.
- `alarms`: complete the timer even when the popup is closed.
- `notifications`: let you know when a focus session or break finishes.

There are no host permissions, remote scripts, analytics, or network requests.

## Development and validation

No build step or dependencies are required. After editing, reload the extension
from `chrome://extensions` and reopen the popup.

Run the automated tests with Node.js 18 or newer:

```sh
node --test tests/*.test.js
```

For a Chrome smoke test:

1. Mix several sounds and verify each slider and master volume.
2. Close and reopen the popup; sound should continue and controls should match.
3. Set focus to one minute, start it, and close the popup. Confirm the completion
   notification, **Break** mode, and incremented session count.
4. Pause/resume/reset a timer, and verify audio remains independent.
5. Restart Chrome; verify audio is paused and any timer deadline is restored.
6. Play rain alone for at least 50 seconds. Verify there is no volume dip or
   interruption at the 16-second loop boundaries.
7. Scroll down to the instrument cards. Play each instrument alone for at least
   65 seconds, then mix it with rain. Verify individual volumes, smooth phrase
   repeats, and playback continuing after closing the popup.
