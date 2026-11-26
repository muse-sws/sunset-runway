// audio.js — one job: original synthesised sound, no audio files.
// All sounds are made with the Web Audio API at run time: an engine hum
// that follows the throttle, a chime for a ring, a thud for a hit and a
// short fanfare for a landing. Nothing is downloaded or copied.

export function createAudio() {
  const state = { ctx: null, engine: null, engineGain: null, muted: false, started: false };
  return {
    get muted() { return state.muted; },
    toggleMute() { state.muted = !state.muted; if (state.engineGain) state.engineGain.gain.value = state.muted ? 0 : 0.05; return state.muted; },
    start() {
      if (state.started) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        state.ctx = new AC();
        state.engine = state.ctx.createOscillator();
        state.engineGain = state.ctx.createGain();
        state.engine.type = "sawtooth";
        state.engine.frequency.value = 70;
        state.engineGain.gain.value = state.muted ? 0 : 0.05;
        const filter = state.ctx.createBiquadFilter();
        filter.type = "lowpass"; filter.frequency.value = 420;
        state.engine.connect(filter); filter.connect(state.engineGain); state.engineGain.connect(state.ctx.destination);
        state.engine.start();
        state.started = true;
      } catch (e) { /* sound is optional; the game plays without it */ }
    },
    engine(throttle, speed) {
      if (!state.ctx || !state.engine) return;
      state.engine.frequency.value = 55 + throttle * 0.9 + speed * 0.12;
    },
    chime() { this.tone(880, 0.14, 0.12); this.tone(1318, 0.2, 0.12); },
    thud() { this.tone(90, 0.3, 0.25); },
    fanfare() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 0.12), i * 120)); },
    tone(freq, dur, vol) {
      if (!state.ctx || state.muted) return;
      try {
        const o = state.ctx.createOscillator();
        const g = state.ctx.createGain();
        o.type = "sine"; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, state.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, state.ctx.currentTime + dur);
        o.connect(g); g.connect(state.ctx.destination);
        o.start(); o.stop(state.ctx.currentTime + dur);
      } catch (e) { /* ignore */ }
    },
  };
}
