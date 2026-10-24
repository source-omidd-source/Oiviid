// UI + editing sound design, synthesised with the Web Audio API (no audio files, no music).
// window.sfx.hover() / click() / whoosh(up) / focus() / burst()
//            transition(type) — whip | glitch | burn | zoom | mosh | ink
//            cut() / flash() / kick() / tick(project)
(() => {
  const KEY = 'oiviid-sound';
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch {}

  let ctx = null;
  let master = null;
  let noise = null;

  // Browsers only allow audio after a user gesture, so create it lazily.
  const ensure = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    // two seconds of white noise, reused for every noisy sound
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, ensure, { once: true, passive: true }));

  const ready = () => enabled && ctx && ctx.state === 'running';
  const rand = (a, b) => a + Math.random() * (b - a);

  const tone = (freq, { type = 'sine', gain = 0.05, attack = 0.002, decay = 0.08, slideTo = null, when = 0 } = {}) => {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + attack + decay);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + attack + decay + 0.02);
  };

  const noiseHit = ({ type = 'highpass', freq = 2000, q = 0.7, gain = 0.06, decay = 0.04, sweepTo = null, attack = 0.002, when = 0 } = {}) => {
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random());
    src.stop(t + attack + decay + 0.05);
  };

  // stuttering square-wave bursts: a "digital" glitch
  const stutter = (count, { base = 300, gain = 0.05, gap = 0.035 } = {}) => {
    for (let i = 0; i < count; i++) {
      tone(base * rand(0.5, 3), { type: 'square', gain: gain * rand(0.5, 1), decay: rand(0.012, 0.03), when: i * gap * rand(0.6, 1.4) });
    }
  };

  let lastHover = 0;
  let lastTransition = 0;
  let lastTick = 0;
  const sfx = {
    hover() {
      if (!ready()) return;
      const now = performance.now();
      if (now - lastHover < 45) return;
      lastHover = now;
      tone(rand(2300, 2700), { gain: 0.028, decay: 0.05 });
      noiseHit({ freq: 6000, gain: 0.012, decay: 0.015 });
    },
    click() {
      if (!ready()) return;
      tone(180, { type: 'triangle', gain: 0.16, decay: 0.12, slideTo: 70 });
      tone(rand(1200, 1400), { gain: 0.03, decay: 0.06, when: 0.01 });
      noiseHit({ freq: 2500, gain: 0.05, decay: 0.03 });
    },
    whoosh(up = true) {
      if (!ready()) return;
      noiseHit({ type: 'bandpass', freq: up ? 300 : 3000, sweepTo: up ? 3500 : 250, q: 1.2, gain: 0.14, attack: 0.12, decay: 0.35 });
    },
    focus() {
      if (!ready()) return;
      noiseHit({ type: 'bandpass', freq: 700, sweepTo: 2600, q: 6, gain: 0.07, attack: 0.02, decay: 0.16 });
      tone(rand(520, 560), { type: 'triangle', gain: 0.03, decay: 0.12, slideTo: 880 });
      tone(rand(1900, 2100), { gain: 0.035, decay: 0.05, when: 0.17 });
      tone(90, { gain: 0.06, decay: 0.08, when: 0.17 });
    },
    burst() {
      if (!ready()) return;
      tone(120, { gain: 0.22, decay: 0.35, slideTo: 40 });
      noiseHit({ type: 'lowpass', freq: 1800, sweepTo: 200, gain: 0.12, attack: 0.005, decay: 0.3 });
    },
    // hard edit point
    cut() {
      if (!ready()) return;
      noiseHit({ freq: 3500, gain: 0.07, decay: 0.025 });
      tone(70, { gain: 0.12, decay: 0.07 });
    },
    // white flash frame
    flash() {
      if (!ready()) return;
      noiseHit({ type: 'highpass', freq: 5000, gain: 0.08, attack: 0.001, decay: 0.12 });
      tone(rand(3000, 3600), { gain: 0.02, decay: 0.1 });
    },
    // beat for kinetic type
    kick() {
      if (!ready()) return;
      tone(150, { gain: 0.3, decay: 0.18, slideTo: 45 });
      noiseHit({ freq: 4000, gain: 0.03, decay: 0.02 });
    },
    // scrubbing: a dry tape tick as each frame passes the playhead
    tick(project = 0) {
      if (!ready()) return;
      const now = performance.now();
      if (now - lastTick < 28) return;
      lastTick = now;
      tone(900 + (project % 5) * 140 + rand(-40, 40), { type: 'triangle', gain: 0.035, decay: 0.022 });
      noiseHit({ freq: 5000, gain: 0.012, decay: 0.01 });
    },
    // one signature sound per editing transition
    transition(type) {
      if (!ready()) return;
      const now = performance.now();
      if (now - lastTransition < 250) return;
      lastTransition = now;
      switch (type) {
        case 'whip':
          noiseHit({ type: 'bandpass', freq: 400, sweepTo: 5000, q: 1.6, gain: 0.2, attack: 0.08, decay: 0.22 });
          noiseHit({ type: 'bandpass', freq: 5000, sweepTo: 600, q: 1.6, gain: 0.1, attack: 0.02, decay: 0.2, when: 0.18 });
          break;
        case 'glitch':
          stutter(9, { base: 260, gain: 0.05 });
          noiseHit({ freq: 1500, gain: 0.06, decay: 0.05, when: 0.05 });
          break;
        case 'burn':
          noiseHit({ type: 'lowpass', freq: 300, sweepTo: 4000, gain: 0.12, attack: 0.25, decay: 0.5 });
          tone(220, { type: 'sawtooth', gain: 0.025, attack: 0.2, decay: 0.5, slideTo: 330 });
          break;
        case 'zoom':
          tone(200, { type: 'sawtooth', gain: 0.03, attack: 0.15, decay: 0.12, slideTo: 1600 });
          noiseHit({ type: 'bandpass', freq: 800, sweepTo: 6000, q: 2, gain: 0.08, attack: 0.15, decay: 0.08 });
          tone(60, { gain: 0.3, decay: 0.3, when: 0.26, slideTo: 35 });
          break;
        case 'mosh':
          for (let i = 0; i < 6; i++) noiseHit({ type: 'bandpass', freq: rand(200, 1500), q: 8, gain: 0.08, decay: rand(0.03, 0.08), when: i * 0.05 });
          tone(55, { type: 'square', gain: 0.04, decay: 0.3 });
          break;
        case 'ink':
          noiseHit({ type: 'lowpass', freq: 2500, sweepTo: 150, gain: 0.14, attack: 0.05, decay: 0.45 });
          tone(110, { gain: 0.08, attack: 0.05, decay: 0.4, slideTo: 55 });
          break;
        default:
          sfx.cut();
      }
    },
    get enabled() { return enabled; },
    set enabled(v) {
      enabled = v;
      try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch {}
    },
    ensure,
  };
  window.sfx = sfx;
})();
