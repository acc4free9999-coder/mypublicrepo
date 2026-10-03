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
    const rate = this.context.sampleRate;
    const seconds = 16;
    const buffer = this.context.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
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
      // Fade the loop seam to prevent clicks without interrupting the other layers.
      data[i] *= Math.min(1, t / 0.06, (seconds - t) / 0.06);
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
