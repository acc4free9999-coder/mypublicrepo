import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../offscreen.js", import.meta.url), "utf8");

function fixture(failResume = false) {
  let listener;
  let contextCount = 0;
  const oscillators = [];
  const gains = [];
  const errors = [];
  class AudioContext {
    constructor() { contextCount++; }
    currentTime = 10;
    destination = {};
    async resume() {
      if (failResume) throw new Error("Audio is unavailable.");
    }
    createOscillator() {
      const oscillator = {
        frequency: {},
        connect() {},
        disconnect() { this.disconnected = true; },
        start(time) { this.started = time; },
        stop(time) { this.stopped = time; }
      };
      oscillators.push(oscillator);
      return oscillator;
    }
    createGain() {
      const gain = {
        gain: {
          setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}
        },
        connect() {},
        disconnect() { this.disconnected = true; }
      };
      gains.push(gain);
      return gain;
    }
  }
  vm.runInNewContext(source, {
    AudioContext, console: { error: (...args) => errors.push(args) },
    chrome: { runtime: { onMessage: { addListener: fn => { listener = fn; } } } }
  });
  return {
    send: () => new Promise(resolve => listener({ target: "offscreen", type: "chime" }, {}, resolve)),
    ignore: () => listener({ target: "background" }, {}, () => {}),
    oscillators, gains, errors, contextCount: () => contextCount
  };
}

test("chime schedules two gentle notes and reuses the audio context", async () => {
  const audio = fixture();
  assert.equal((await audio.send()).ok, true);
  assert.deepEqual(audio.oscillators.map(item => item.frequency.value), [660, 880]);
  assert.deepEqual(audio.oscillators.map(item => item.started), [10, 10.18]);
  assert.ok(audio.oscillators.every(item => item.stopped > item.started));
  audio.oscillators.forEach(item => item.onended());
  assert.ok(audio.oscillators.every(item => item.disconnected));
  assert.ok(audio.gains.every(item => item.disconnected));
  await audio.send();
  assert.equal(audio.contextCount(), 1);
  assert.equal(audio.ignore(), false);
});

test("audio failures are logged and returned to the service worker", async () => {
  const audio = fixture(true);
  const response = await audio.send();
  assert.equal(response.ok, false);
  assert.equal(response.error, "Audio is unavailable.");
  assert.equal(audio.errors.length, 1);
  assert.equal(audio.oscillators.length, 0);
});
