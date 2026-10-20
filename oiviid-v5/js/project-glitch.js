// Project hover: a live glitch / channel-split pass over the hovered card.
// Torn slices follow the cursor's row, RGB channels drift apart with pointer speed,
// scanlines roll, and every entry starts with a short corrupted burst.
import * as THREE from 'three';

const finePointer = matchMedia('(pointer: fine)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (finePointer && !reduceMotion) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false }); } catch (err) { console.warn('Glitch hover disabled:', err); }
  if (renderer) init(renderer);
}

function init(renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.className = 'project__fx';
  canvas.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTexSize: { value: new THREE.Vector2(16, 9) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uSpeed: { value: 0 },
      uBurst: { value: 0 },
      uTime: { value: 0 },
      uCrop: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uTex;
      uniform vec2 uRes, uTexSize, uMouse;
      uniform float uSpeed, uBurst, uTime, uCrop;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec2 cover(vec2 uv) {
        vec2 s = uRes / uTexSize; float sc = max(s.x, s.y); vec2 size = uTexSize * sc;
        vec2 c = (uv * uRes - (uRes - size) * 0.5) / size;
        return clamp((c - 0.5) / uCrop + 0.5, 0.001, 0.999);
      }
      void main() {
        vec2 uv = vUv;
        float tick = floor(uTime * 18.0);
        float amt = clamp(uSpeed * 1.2 + uBurst, 0.0, 1.5);

        // torn horizontal slices, strongest near the cursor's row
        float row = floor(uv.y * 34.0);
        float near = exp(-pow((uv.y - uMouse.y) * 5.0, 2.0));
        float n = hash(vec2(row, tick));
        float tear = step(1.0 - (0.25 + near * 0.5) * amt, n);
        uv.x += (hash(vec2(row, tick + 9.0)) - 0.5) * 0.22 * tear * amt;

        // channel split pointing away from the cursor
        vec2 dir = normalize(uv - uMouse + 1e-4);
        float s = 0.004 + 0.022 * amt;
        vec3 col = vec3(
          texture2D(uTex, cover(uv + dir * s)).r,
          texture2D(uTex, cover(uv)).g,
          texture2D(uTex, cover(uv - dir * s)).b
        );

        // rolling scanlines + a few corrupted blocks during the burst
        col *= 0.9 + 0.1 * sin((uv.y + uTime * 0.15) * uRes.y * 1.2);
        vec2 blk = floor(uv * vec2(18.0, 10.0));
        if (hash(blk + tick) > 1.0 - uBurst * 0.12) col = vec3(col.g, col.b, col.r) * 1.4;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const imgTex = new Map();
  const vidTex = new WeakMap();
  const prep = (t) => { t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
  const imageTexture = (src) => { if (!imgTex.has(src)) imgTex.set(src, prep(loader.load(src))); return imgTex.get(src); };
  const videoTexture = (v) => { if (!vidTex.has(v)) vidTex.set(v, prep(new THREE.VideoTexture(v))); return vidTex.get(v); };

  let active = null, media = null, running = false, last = performance.now();
  const mouse = new THREE.Vector2(0.5, 0.5);
  let prevMouse = new THREE.Vector2(0.5, 0.5);
  let speed = 0, burst = 0, show = 0;

  const size = () => {
    const r = media.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    material.uniforms.uRes.value.set(r.width, r.height);
  };
  const activate = (p) => {
    active = p;
    media = p.querySelector('.project__media');
    media.append(canvas);
    size();
    material.uniforms.uCrop.value = p.classList.contains('project--crop') ? 1.38 : 1;
    burst = 1;
    canvas.classList.add('is-on');
    window.sfx?.transition('glitch');
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  };
  const deactivate = (p) => {
    if (active !== p) return;
    active = null;
    canvas.classList.remove('is-on');
  };
  document.querySelectorAll('.project').forEach((p) => {
    p.addEventListener('mouseenter', () => activate(p));
    p.addEventListener('mouseleave', () => deactivate(p));
    p.addEventListener('mousemove', (e) => {
      const r = p.querySelector('.project__media').getBoundingClientRect();
      mouse.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
    });
  });
  addEventListener('resize', () => { if (media) size(); });

  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const moved = mouse.distanceTo(prevMouse) / Math.max(dt, 1e-3);
    prevMouse = mouse.clone();
    speed += (Math.min(1, moved * 0.25) - speed) * Math.min(1, dt * 8);
    burst = Math.max(0, burst - dt * 2.2);
    show += ((active ? 1 : 0) - show) * Math.min(1, dt * 8);

    if (media) {
      const owner = media.closest('.project');
      const v = owner.querySelector('.project__media video');
      const img = owner.querySelector('.project__media img');
      let tex;
      if (v && v.readyState >= 2) {
        tex = videoTexture(v);
        material.uniforms.uTexSize.value.set(v.videoWidth || 16, v.videoHeight || 9);
      } else {
        tex = imageTexture(img.currentSrc || img.src);
        if (tex.image && tex.image.width) material.uniforms.uTexSize.value.set(tex.image.width, tex.image.height);
      }
      const u = material.uniforms;
      u.uTex.value = tex;
      u.uMouse.value.copy(mouse);
      u.uSpeed.value = speed;
      u.uBurst.value = burst;
      u.uTime.value = now / 1000;
      if (tex.image) renderer.render(scene, camera);
    }
    if (active || show > 0.02) requestAnimationFrame(loop);
    else { running = false; if (canvas.parentNode) canvas.remove(); media = null; }
  };
}
