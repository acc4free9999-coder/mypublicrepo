/* global chrome */
globalThis.NatureFocus = (() => {
  const sounds = [
    { id: "rain", name: "Soft rain", subtitle: "A little room to think", icon: "rain" },
    { id: "forest", name: "Forest birds", subtitle: "Under the green canopy", icon: "forest" },
    { id: "ocean", name: "Ocean waves", subtitle: "Let your thoughts drift", icon: "ocean" },
    { id: "stream", name: "Flowing stream", subtitle: "Find your gentle rhythm", icon: "stream" },
    { id: "wind", name: "Mountain wind", subtitle: "Space to breathe", icon: "wind" },
    { id: "fire", name: "Campfire", subtitle: "Warmth for late nights", icon: "fire" },
    { id: "thunder", name: "Distant thunder", subtitle: "Cozy on the inside", icon: "thunder" },
    { id: "night", name: "Summer night", subtitle: "The world slows down", icon: "night" }
  ];
  const presets = {
    woodland: { forest: 65, stream: 40, wind: 15 },
    rainy: { rain: 70, thunder: 35 },
    coast: { ocean: 70, wind: 25 },
    cozy: { fire: 65, rain: 35, night: 15 }
  };
  const defaultState = () => ({
    mixer: {
      playing: false,
      master: 70,
      volumes: Object.fromEntries(sounds.map(sound => [sound.id, sound.id === "rain" ? 60 : 0]))
    },
    settings: { focus: 25, break: 5, notify: true },
    timer: { phase: "focus", status: "idle", duration: 1500, remaining: 1500, endAt: null, completed: 0 }
  });
  const remaining = (timer, now = Date.now()) => timer.status === "running"
    ? Math.max(0, Math.ceil((timer.endAt - now) / 1000))
    : timer.remaining;
  const formatTime = seconds => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const volume = value => Number.isFinite(value) && value >= 0 && value <= 100;
  return { sounds, presets, defaultState, remaining, formatTime, volume };
})();
