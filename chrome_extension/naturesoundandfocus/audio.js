globalThis.SynthMixer = class SynthMixer {
  constructor(context) {
    this.context = context;
    this.voices = new Map();
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 20;
    this.compressor.ratio.value = 4;
    this.master.connect(this.compressor);
    this.compressor.connect(context.destination);
  }

  createBuffer(id) {
    if (["piano", "guitar", "flute"].includes(id)) return this.createInstrumentBuffer(id);
    const rate = this.context.sampleRate;
    const seconds = 16;
    const buffer = this.context.createBuffer(1, rate * seconds, rate);
    const output = buffer.getChannelData(0);
    const overlap = id === "rain" ? Math.round(rate * 0.12) : 0;
    const data = overlap ? new Float32Array(output.length + overlap) : output;
    let low = 0;
    let brown = 0;
    const events = Array.from({ length: id === "forest" ? 22 : 48 }, () => ({
      start: Math.random() * (seconds - 1),
      length: 0.08 + Math.random() * 0.5,
      frequency: 1600 + Math.random() * 2600,
      strength: Math.random()
    }));
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      const noise = Math.random() * 2 - 1;
      low = low * 0.94 + noise * 0.06;
      brown = (brown + noise * 0.018) / 1.018;
      switch (id) {
        case "rain":
          data[i] = noise * 0.19 + low * 0.7;
          break;
        case "ocean": {
          const wave = 0.3 + 0.7 * Math.pow((1 + Math.sin(2 * Math.PI * t / 8)) / 2, 2);
          data[i] = (brown * 3 + low * 0.5 + noise * 0.04) * wave;
          break;
        }
        case "stream":
          data[i] = low * 1.5 + noise * 0.06
            + Math.sin(2 * Math.PI * 620 * t + 5 * Math.sin(t * 7)) * 0.012;
          break;
        case "wind":
          data[i] = brown * 2.5 * (0.5 + 0.25 * Math.sin(2 * Math.PI * t / 16));
          break;
        case "fire":
          data[i] = brown * 1.8 + noise * 0.025;
          for (const event of events) {
            const age = t - event.start;
            if (age >= 0 && age < 0.035) data[i] += noise * event.strength * Math.exp(-age * 130);
          }
          break;
        case "thunder": {
          const rumble = Math.pow(Math.max(0, Math.sin(2 * Math.PI * t / 16)), 4);
          data[i] = brown * 4 * rumble + low * 0.05;
          break;
        }
        case "forest":
          data[i] = low * 0.12;
          for (const event of events) {
            const age = t - event.start;
            if (age >= 0 && age < event.length) {
              const envelope = Math.sin(Math.PI * age / event.length) ** 2;
              const chirp = 2 * Math.PI * (event.frequency * age + 900 * age * age);
              data[i] += Math.sin(chirp) * envelope * 0.15 * (0.4 + event.strength);
            }
          }
          break;
        case "night": {
          const pulse = Math.max(0, Math.sin(2 * Math.PI * 3 * t)) ** 8;
          data[i] = (Math.sin(2 * Math.PI * 4100 * t) + Math.sin(2 * Math.PI * 4700 * t))
            * pulse * 0.045 + low * 0.08;
          break;
        }
        default:
          throw new Error(`Unknown sound: ${id}`);
      }
      if (!overlap) {
        // Fade intermittent soundscapes at the loop seam to prevent clicks.
        data[i] *= Math.min(1, t / 0.06, (seconds - t) / 0.06);
      }
    }
    if (overlap) {
      output.set(data.subarray(0, output.length));
      // Continue the tail across the loop boundary, then blend into the head.
      // Equal-power weights keep uncorrelated rain noise from dipping in volume.
      for (let i = 0; i < overlap; i++) {
        const angle = i / (overlap - 1) * Math.PI / 2;
        output[i] = data[output.length + i] * Math.cos(angle) + data[i] * Math.sin(angle);
      }
    }
    return buffer;
  }

  createInstrumentBuffer(id) {
    const rate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, rate * 32, rate);
    const data = buffer.getChannelData(0);
    const melody = [60, 64, 67, 69, 67, 64, 62, 64, 60, 62, 64, 67, 69, 67, 64, 62];
    const flute = id === "flute";
    const guitar = id === "guitar";
    const interval = flute ? 4 : 2;
    const duration = flute ? 3.8 : guitar ? 3 : 4;
    const attack = flute ? 0.18 : guitar ? 0.008 : 0.012;
    const release = flute ? 0.3 : 0.15;
    const echoes = [
      { delay: 0, gain: 1 },
      { delay: Math.round(rate * 0.17), gain: 0.18 },
      { delay: Math.round(rate * 0.37), gain: 0.08 }
    ];
    for (let note = 0; note < 32 / interval; note++) {
      const midi = melody[note * (flute ? 2 : 1)] + (guitar ? -12 : flute ? 12 : 0);
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      const start = Math.round(note * interval * rate);
      for (let i = 0; i < Math.round(duration * rate); i++) {
        const age = i / rate;
        const envelope = Math.min(1, age / attack) * Math.min(1, (duration - age) / release);
        const phase = 2 * Math.PI * frequency * age;
        let wave;
        if (flute) {
          const vibrato = 0.035 * Math.sin(2 * Math.PI * 5 * age) * Math.min(1, age / 0.5);
          wave = Math.sin(phase + vibrato) + 0.12 * Math.sin(phase * 2 + vibrato)
            + 0.04 * Math.sin(phase * 3) + (Math.random() * 2 - 1) * 0.015;
          wave *= 0.11 * Math.sin(Math.PI * age / duration) ** 0.4;
        } else {
          wave = Math.sin(phase) * Math.exp(-age * (guitar ? 1.5 : 0.9))
            + 0.32 * Math.sin(phase * (guitar ? 2 : 2.002)) * Math.exp(-age * 2)
            + 0.14 * Math.sin(phase * (guitar ? 3 : 3.006)) * Math.exp(-age * 3)
            + 0.06 * Math.sin(phase * 4) * Math.exp(-age * 5);
          wave *= 0.17;
        }
        const sample = wave * envelope;
        // Wrap note releases and echoes into the head so the phrase has no cut tail.
        for (const echo of echoes) {
          data[(start + i + echo.delay) % data.length] += sample * echo.gain;
        }
      }
    }
    return buffer;
  }

  async apply(mixer) {
    await this.context.resume();
    if (this.context.state !== "running") throw new Error("Audio is blocked. Try pressing Play again.");
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(mixer.master / 100 * 0.65, now, 0.12);
    for (const [id, volume] of Object.entries(mixer.volumes)) {
      let voice = this.voices.get(id);
      if (!voice && volume > 0) {
        const source = this.context.createBufferSource();
        const gain = this.context.createGain();
        gain.gain.value = 0;
        source.buffer = this.createBuffer(id);
        source.loop = true;
        source.connect(gain);
        gain.connect(this.master);
        source.start();
        voice = { source, gain };
        this.voices.set(id, voice);
      }
      if (voice) voice.gain.gain.setTargetAtTime(volume / 100, now, 0.12);
    }
  }
};
