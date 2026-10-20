// The showreel as an edit: scrolling scrubs a timeline, and every cut between clips is
// a different real editing transition rendered live in WebGL (whip pan, glitch cut,
// film burn, zoom punch, datamosh, ink matte). Each one has its own sound.
import * as THREE from 'three';

const section = document.getElementById('hero');
const monitor = document.getElementById('monitor');
const canvas = document.getElementById('reelCanvas');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const FX = {
  whip: { id: 0, label: 'Whip pan' },
  glitch: { id: 1, label: 'Glitch cut' },
  burn: { id: 2, label: 'Film burn' },
  zoom: { id: 3, label: 'Zoom punch' },
  mosh: { id: 4, label: 'Datamosh' },
  ink: { id: 5, label: 'Ink matte' },
};

const clips = [...document.querySelectorAll('#clipList li')].map((li, i) => {
  const v = document.createElement('video');
  Object.assign(v, { muted: true, loop: true, playsInline: true, preload: i < 2 ? 'auto' : 'metadata' });
  v.setAttribute('muted', '');
  v.src = li.dataset.src;
  return {
    video: v,
    name: li.dataset.name,
    artist: li.dataset.artist,
    tag: li.dataset.tag,
    color: li.dataset.color,
    crop: parseFloat(li.dataset.crop) || 1,
    fx: li.dataset.fx,
  };
});
const N = clips.length;

/* ---------- timeline UI ---------- */
const laneClips = document.getElementById('laneClips');
const laneTitles = document.getElementById('laneTitles');
const playhead = document.getElementById('playhead');
const fxLabel = document.getElementById('fxLabel');
const tcEl = document.getElementById('tc');
const titleBox = document.getElementById('clipTitle');

clips.forEach((c, i) => {
  const b = document.createElement('button');
  b.className = 'lane-clip';
  b.style.setProperty('--c', c.color);
  b.textContent = `${String(i + 1).padStart(2, '0')}_${c.name.replace(/\s+/g, '_').toLowerCase()}.mp4`;
  b.setAttribute('aria-label', `Jump to ${c.name}`);
  b.dataset.sfx = '';
  b.addEventListener('click', () => scrollToClip(i));
  laneClips.append(b);
  const t = document.createElement('div');
  t.className = 'lane-title';
  t.innerHTML = c.name;
  laneTitles.append(t);
  if (c.fx) {
    const m = document.createElement('span');
    m.className = 'lane-fx';
    m.textContent = c.fx;
    m.title = FX[c.fx].label;
    m.style.left = `${((i + 1) / N) * 100}%`;
    laneClips.append(m);
  }
});
const clipEls = [...laneClips.querySelectorAll('.lane-clip')];
const fxEls = [...laneClips.querySelectorAll('.lane-fx')];

// fake but deterministic audio waveform
const wave = document.getElementById('wave');
const drawWave = () => {
  const r = wave.getBoundingClientRect();
  if (!r.width) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  wave.width = r.width * dpr; wave.height = r.height * dpr;
  const g = wave.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = 'rgba(77, 188, 255, .55)';
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = 0; x < r.width; x += 3) {
    const beat = Math.abs(Math.sin(x * 0.045)) ** 3;
    const h = (0.2 + beat * 0.6 + rnd() * 0.25) * r.height * 0.9;
    g.fillRect(x, (r.height - h) / 2, 2, h);
  }
};

const scrollToClip = (i) => {
  const top = section.getBoundingClientRect().top + scrollY;
  const range = section.offsetHeight - innerHeight;
  const y = top + (i / (N - 1)) * range;
  if (window.lenis) window.lenis.scrollTo(y, { duration: 1.2 });
  else scrollTo({ top: y, behavior: 'smooth' });
};

/* ---------- WebGL ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
} catch (err) {
  console.warn('Reel WebGL unavailable:', err);
}

const textures = clips.map((c) => {
  const t = new THREE.VideoTexture(c.video);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
});

const material = new THREE.ShaderMaterial({
  uniforms: {
    uA: { value: textures[0] },
    uB: { value: textures[1] },
    uSizeA: { value: new THREE.Vector2(640, 360) },
    uSizeB: { value: new THREE.Vector2(640, 360) },
    uCropA: { value: 1 },
    uCropB: { value: 1 },
    uT: { value: 0 },
    uType: { value: 0 },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D uA, uB;
    uniform vec2 uSizeA, uSizeB, uRes;
    uniform float uCropA, uCropB, uT, uType, uTime;
    varying vec2 vUv;
    #define PI 3.14159265

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

    vec2 cover(vec2 uv, vec2 size, float crop) {
      vec2 s = uRes / size;
      float sc = max(s.x, s.y);
      vec2 sz = size * sc;
      vec2 c = (uv * uRes - (uRes - sz) * 0.5) / sz;
      return clamp((c - 0.5) / crop + 0.5, 0.001, 0.999);
    }
    vec3 A(vec2 uv) { return texture2D(uA, cover(uv, uSizeA, uCropA)).rgb; }
    vec3 B(vec2 uv) { return texture2D(uB, cover(uv, uSizeB, uCropB)).rgb; }

    // whip pan: A rushes out left, B in from the right, smeared with horizontal motion blur
    vec3 whip(vec2 uv, float t) {
      float e = t * t * (3.0 - 2.0 * t);
      float blur = sin(PI * t) * 0.22;
      vec3 col = vec3(0.0);
      for (int i = 0; i < 20; i++) {
        float k = (float(i) / 19.0 - 0.5) * blur;
        float x = uv.x + e + k;
        col += x < 1.0 ? A(vec2(x, uv.y)) : B(vec2(x - 1.0, uv.y));
      }
      return col / 20.0;
    }

    // glitch cut: blocks tear sideways, channels split, blocks flip between clips
    vec3 glitch(vec2 uv, float t) {
      float g = sin(PI * t);
      vec2 blk = floor(uv * vec2(10.0, 26.0));
      float tick = floor(uTime * 24.0);
      float n = hash(blk + tick);
      float on = step(1.0 - g * 0.75, n);
      vec2 d = vec2((hash(blk.yy + tick) - 0.5) * 0.3 * on * g, 0.0);
      bool useB = t + (hash(blk + 7.0) - 0.5) * 0.7 * g > 0.5;
      vec2 q = uv + d;
      float s = 0.02 * g + on * 0.03;
      vec3 col = useB
        ? vec3(B(q + vec2(s, 0.0)).r, B(q).g, B(q - vec2(s, 0.0)).b)
        : vec3(A(q + vec2(s, 0.0)).r, A(q).g, A(q - vec2(s, 0.0)).b);
      col *= 0.88 + 0.12 * sin(uv.y * uRes.y * 1.4);
      if (n > 0.985 && g > 0.25) col = 1.0 - col;
      return col;
    }

    // film burn: a hot light leak blooms across the frame while it dissolves
    vec3 burn(vec2 uv, float t) {
      float g = sin(PI * t);
      vec3 col = mix(A(uv), B(uv), smoothstep(0.35, 0.65, t));
      float nz = fbm(uv * vec2(2.2, 1.6) + vec2(uTime * 0.12, -uTime * 0.05));
      float leak = smoothstep(0.25, 0.95, nz + uv.x * 0.35 + g * 0.9 - 0.55);
      vec3 hot = mix(vec3(1.0, 0.25, 0.04), vec3(1.0, 0.86, 0.55), nz);
      col += hot * leak * g * 1.9;
      return mix(col, 1.0 - exp(-col * 1.4), g);
    }

    // zoom punch: crash into A's centre with radial blur, land out of B
    vec3 zoom(vec2 uv, float t) {
      float h = t < 0.5 ? t * 2.0 : (1.0 - t) * 2.0;
      float z = 1.0 + h * h * 3.0;
      vec2 c = vec2(0.5);
      vec2 zuv = (uv - c) / z + c;
      float blur = sin(PI * t) * 0.12;
      vec3 col = vec3(0.0);
      for (int i = 0; i < 16; i++) {
        vec2 p = mix(zuv, c, float(i) / 15.0 * blur);
        col += t < 0.5 ? A(p) : B(p);
      }
      col /= 16.0;
      col += exp(-pow((t - 0.5) * 11.0, 2.0)) * 0.95;
      return col;
    }

    // datamosh: B's motion drags A's pixels in blocky smears before B resolves
    vec3 mosh(vec2 uv, float t) {
      float g = sin(PI * t);
      vec2 grid = vec2(48.0, 27.0);
      vec2 bu = (floor(uv * grid) + 0.5) / grid;
      // motion vectors from B's luminance gradient, plus per-block jitter, like broken P-frames
      vec2 px = 1.0 / grid;
      float lx = dot(B(bu + vec2(px.x, 0.0)) - B(bu - vec2(px.x, 0.0)), vec3(0.333));
      float ly = dot(B(bu + vec2(0.0, px.y)) - B(bu - vec2(0.0, px.y)), vec3(0.333));
      vec2 mv = (vec2(lx, ly) * 1.6 + (vec2(hash(bu), hash(bu + 3.1)) - 0.5) * 0.16) * g;
      float m = smoothstep(0.5, 0.95, t + (hash(bu * 13.0) - 0.5) * 0.35);
      vec3 col = mix(A(uv - mv * 1.6), B(uv - mv * (1.0 - t)), m);
      return mix(col, floor(col * 5.0 + 0.5) / 5.0, g * 0.55);
    }

    // ink matte: B bleeds in through an organic matte with a dark wet edge
    vec3 ink(vec2 uv, float t) {
      float n = fbm(uv * vec2(3.2, 2.0) + vec2(0.0, uTime * 0.04));
      n = n * 0.85 + (1.0 - uv.y) * 0.15;
      float thr = t * 1.25 - 0.12;
      float mask = smoothstep(thr, thr + 0.015, n);
      vec3 col = mix(B(uv), A(uv), mask);
      float rim = smoothstep(0.05, 0.0, abs(n - thr)) * sin(PI * t);
      return mix(col, vec3(0.02, 0.02, 0.03), rim * 0.85);
    }

    void main() {
      vec2 uv = vUv;
      float t = uT;
      vec3 col;
      if (t <= 0.0) col = A(uv);
      else if (t >= 1.0) col = B(uv);
      else if (uType < 0.5) col = whip(uv, t);
      else if (uType < 1.5) col = glitch(uv, t);
      else if (uType < 2.5) col = burn(uv, t);
      else if (uType < 3.5) col = zoom(uv, t);
      else if (uType < 4.5) col = mosh(uv, t);
      else col = ink(uv, t);

      // film grain + gentle vignette over everything
      col += (hash(uv * uRes + fract(uTime) * 91.0) - 0.5) * 0.05;
      col *= 1.0 - 0.28 * pow(length(uv - 0.5) * 1.25, 2.4);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});

let scene, camera;
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
}

const resize = () => {
  const r = monitor.getBoundingClientRect();
  if (renderer) renderer.setSize(r.width, r.height, false);
  material.uniforms.uRes.value.set(r.width, r.height);
  drawWave();
};
addEventListener('resize', resize);
resize();
if (document.fonts) document.fonts.ready.then(resize);

/* ---------- scroll -> edit position ---------- */
let pos = 0;        // smoothed position in clips (0 .. N-1)
let target = 0;
const HOLD = 0.58;  // share of each segment the clip plays clean before the transition

const readScroll = () => {
  const r = section.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, -r.top / Math.max(1, section.offsetHeight - innerHeight)));
  target = p * (N - 1);
};
addEventListener('scroll', readScroll, { passive: true });
readScroll();

let shownTitle = -1;
let lastKey = 0;
const showTitle = (i) => {
  if (i === shownTitle) return;
  shownTitle = i;
  const c = clips[i];
  document.getElementById('clipName').textContent = c.name;
  document.getElementById('clipArtist').innerHTML = c.artist;
  document.getElementById('clipTag').textContent = `${String(i + 1).padStart(2, '0')} · ${c.tag}`;
  titleBox.classList.remove('cut-in');
  void titleBox.offsetWidth;
  titleBox.classList.add('cut-in');
  clipEls.forEach((el, k) => el.classList.toggle('is-active', k === i));
};

const playOnly = (keep) => {
  clips.forEach((c, k) => {
    if (keep.includes(k)) { if (c.video.paused) c.video.play().catch(() => {}); }
    else if (!c.video.paused) c.video.pause();
    if (keep.includes(k) && c.video.preload !== 'auto') c.video.preload = 'auto';
  });
};

let visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (!visible) playOnly([]); }).observe(section);

const pad = (n) => String(n).padStart(2, '0');
let last = performance.now();
const frame = (now) => {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!visible) return;

  pos += (target - pos) * (1 - Math.exp(-dt * 10));
  if (Math.abs(target - pos) < 0.0005) pos = target;

  const i = Math.min(N - 2, Math.floor(pos));
  const f = pos - i;
  let t = reduceMotion ? (f > HOLD ? 1 : 0) : Math.min(1, Math.max(0, (f - HOLD) / (1 - HOLD)));
  if (pos >= N - 1) t = 1;
  const a = clips[i], b = clips[i + 1];

  // keep only the clips on screen decoding
  playOnly(t > 0 && t < 1 ? [i, i + 1] : [t >= 1 ? i + 1 : i]);

  const fx = FX[a.fx] || FX.whip;
  const inFx = t > 0.001 && t < 0.999;
  fxLabel.textContent = fx.label;
  fxLabel.classList.toggle('is-on', inFx);
  fxEls.forEach((el, k) => el.classList.toggle('is-active', inFx && k === i));

  // sound + title cut when a transition crosses its midpoint (either scroll direction)
  const key = i + (t >= 0.5 ? 0.5 : 0);
  if (key !== lastKey) {
    if (Math.floor(key) === Math.floor(lastKey)) window.sfx?.transition(a.fx);
    lastKey = key;
  }
  showTitle(t >= 0.5 ? i + 1 : i);

  // playhead + timecode
  const total = (pos + (1 - HOLD) / 2) / N;
  playhead.style.left = `${laneClips.offsetLeft + laneClips.offsetWidth * Math.min(1, total)}px`;
  const secs = total * N * 4;
  tcEl.textContent = `00:00:${pad(Math.floor(secs))}:${pad(Math.floor((secs % 1) * 25))}`;

  if (renderer) {
    const u = material.uniforms;
    u.uA.value = textures[i];
    u.uB.value = textures[i + 1];
    u.uSizeA.value.set(a.video.videoWidth || 640, a.video.videoHeight || 360);
    u.uSizeB.value.set(b.video.videoWidth || 640, b.video.videoHeight || 360);
    u.uCropA.value = a.crop;
    u.uCropB.value = b.crop;
    u.uT.value = t;
    u.uType.value = fx.id;
    u.uTime.value = now / 1000;
    renderer.render(scene, camera);
  }
};
requestAnimationFrame(frame);
