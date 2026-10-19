// UI sound design, synthesised with the Web Audio API (no audio files, no music).
// window.sfx.hover() / click() / whoosh() / swish(strength) / burst() / focus()
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
    // one second of white noise, reused for clicks and whooshes
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
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
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + decay);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + attack + decay + 0.02);
  };

  const noiseHit = ({ type = 'highpass', freq = 2000, q = 0.7, gain = 0.06, decay = 0.04, sweepTo = null, attack = 0.002 } = {}) => {
    const t = ctx.currentTime;
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
    src.start(t, Math.random() * 0.5);
    src.stop(t + attack + decay + 0.05);
  };

  let lastHover = 0;
  let lastSwish = 0;
  const sfx = {
    // tiny glassy tick
    hover() {
      if (!ready()) return;
      const now = performance.now();
      if (now - lastHover < 45) return;
      lastHover = now;
      tone(rand(2300, 2700), { gain: 0.028, decay: 0.05 });
      noiseHit({ freq: 6000, gain: 0.012, decay: 0.015 });
    },
    // soft "thock"
    click() {
      if (!ready()) return;
      tone(180, { type: 'triangle', gain: 0.16, decay: 0.12, slideTo: 70 });
      tone(rand(1200, 1400), { gain: 0.03, decay: 0.06, when: 0.01 });
      noiseHit({ freq: 2500, gain: 0.05, decay: 0.03 });
    },
    // airy sweep for opening/closing things
    whoosh(up = true) {
      if (!ready()) return;
      noiseHit({ type: 'bandpass', freq: up ? 300 : 3000, sweepTo: up ? 3500 : 250, q: 1.2, gain: 0.14, attack: 0.12, decay: 0.35 });
    },
    // grainy brush as the cursor scatters the particles
    swish(strength = 0.5) {
      if (!ready()) return;
      const now = performance.now();
      if (now - lastSwish < 110) return;
      lastSwish = now;
      noiseHit({ type: 'bandpass', freq: rand(2500, 5000), q: 2.5, gain: 0.05 * strength, attack: 0.01, decay: 0.12 });
    },
    // low impact for the hero shockwave
    burst() {
      if (!ready()) return;
      tone(120, { type: 'sine', gain: 0.22, decay: 0.35, slideTo: 40 });
      noiseHit({ type: 'lowpass', freq: 1800, sweepTo: 200, gain: 0.12, attack: 0.005, decay: 0.3 });
    },
    // lens focus pull for project hovers: a quick motor whirr that settles into a soft click
    focus() {
      if (!ready()) return;
      noiseHit({ type: 'bandpass', freq: 700, sweepTo: 2600, q: 6, gain: 0.07, attack: 0.02, decay: 0.16 });
      tone(rand(520, 560), { type: 'triangle', gain: 0.03, decay: 0.12, slideTo: 880 });
      tone(rand(1900, 2100), { gain: 0.035, decay: 0.05, when: 0.17 });
      tone(90, { gain: 0.06, decay: 0.08, when: 0.17 });
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
