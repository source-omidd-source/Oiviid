// Project hover: a WebGL lens over the hovered card. On enter the image pulls focus
// (rack focus), then stays sharp around the cursor with depth-of-field falloff,
// a springy zoom toward the cursor, slight parallax and a ripple.
import * as THREE from 'three';

const finePointer = matchMedia('(pointer: fine)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (finePointer && !reduceMotion) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  } catch (err) {
    console.warn('Project hover effect disabled:', err);
  }
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
      uZoom: { value: 1 },
      uFocus: { value: 0 },
      uHover: { value: 0 },
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
      uniform float uZoom, uFocus, uHover, uTime, uCrop;
      varying vec2 vUv;

      vec2 cover(vec2 uv) {
        vec2 s = uRes / uTexSize;
        float sc = max(s.x, s.y);
        vec2 size = uTexSize * sc;
        return (uv * uRes - (uRes - size) * 0.5) / size;
      }

      void main() {
        vec2 m = uMouse;
        vec2 asp = vec2(uRes.x / uRes.y, 1.0);
        float d = length((vUv - m) * asp);

        // zoom toward the cursor, with a little counter-parallax
        vec2 uv = (vUv - m) / uZoom + m;
        uv += (m - 0.5) * -0.035 * uHover;
        // ripple spreading from the cursor
        vec2 dir = normalize((vUv - m) * asp + 1e-4) / asp;
        uv += dir * sin(d * 36.0 - uTime * 7.0) * 0.003 * exp(-d * 5.0) * uHover;

        vec2 tuv = (cover(uv) - 0.5) / uCrop + 0.5;

        // depth of field: rack focus on enter, then sharp at the cursor, soft away from it
        float blur = mix(0.022, 0.0, uFocus) + smoothstep(0.1, 0.8, d) * 0.009 * uHover;
        vec3 col = vec3(0.0);
        for (int i = 0; i < 14; i++) {
          float a = float(i) * 2.39996;
          float r = sqrt((float(i) + 0.5) / 14.0);
          col += texture2D(uTex, clamp(tuv + vec2(cos(a), sin(a)) * r * blur, 0.001, 0.999)).rgb;
        }
        col /= 14.0;

        // a touch of lens fringing where it's out of focus
        float ca = blur * 0.5 + 0.0015 * uHover;
        col.r = mix(col.r, texture2D(uTex, clamp(tuv + vec2(ca, 0.0), 0.001, 0.999)).r, 0.5);
        col.b = mix(col.b, texture2D(uTex, clamp(tuv - vec2(ca, 0.0), 0.001, 0.999)).b, 0.5);

        col *= 1.0 - 0.22 * smoothstep(0.35, 1.1, d) * uHover;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  // ---- textures ----
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const imgTex = new Map();
  const vidTex = new WeakMap();
  const prep = (t) => { t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
  const imageTexture = (src) => {
    if (!imgTex.has(src)) imgTex.set(src, prep(loader.load(src)));
    return imgTex.get(src);
  };
  const videoTexture = (v) => {
    if (!vidTex.has(v)) vidTex.set(v, prep(new THREE.VideoTexture(v)));
    return vidTex.get(v);
  };

  // ---- state ----
  let active = null;
  let media = null;
  const mouse = new THREE.Vector2(0.5, 0.5);
  const mouseTarget = new THREE.Vector2(0.5, 0.5);
  let zoom = 1, zoomVel = 0;
  let hover = 0, focus = 0;
  let running = false;
  let last = performance.now();

  const size = () => {
    const r = media.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    material.uniforms.uRes.value.set(r.width, r.height);
  };

  const activate = (project) => {
    active = project;
    media = project.querySelector('.project__media');
    media.append(canvas);
    size();
    material.uniforms.uCrop.value = project.classList.contains('project--crop') ? 1.38 : 1;
    focus = 0;
    zoomVel += 1.6; // kick the spring so it overshoots a little
    canvas.classList.remove('is-on');
    requestAnimationFrame(() => canvas.classList.add('is-on'));
    window.sfx?.focus();
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  };
  const deactivate = (project) => {
    if (active !== project) return;
    active = null;
    canvas.classList.remove('is-on');
  };

  document.querySelectorAll('.project').forEach((p) => {
    p.addEventListener('mouseenter', () => activate(p));
    p.addEventListener('mouseleave', () => deactivate(p));
    p.addEventListener('mousemove', (e) => {
      const r = p.querySelector('.project__media').getBoundingClientRect();
      mouseTarget.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
    });
  });
  addEventListener('resize', () => { if (media) size(); });

  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    hover += ((active ? 1 : 0) - hover) * Math.min(1, dt * 6);
    if (active) focus = Math.min(1, focus + dt / 0.55);
    // spring toward the hover zoom
    const zt = active ? 1.07 : 1;
    zoomVel += (zt - zoom) * 140 * dt;
    zoomVel *= Math.exp(-11 * dt);
    zoom += zoomVel * dt;
    mouse.lerp(mouseTarget, Math.min(1, dt * 10));

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
      u.uZoom.value = zoom;
      u.uFocus.value = 1 - Math.pow(1 - focus, 3);
      u.uHover.value = hover;
      u.uTime.value = now / 1000;
      if (tex.image) renderer.render(scene, camera);
    }

    // keep running until the fade-out has finished
    if (active || hover > 0.01) requestAnimationFrame(loop);
    else { running = false; if (!active && canvas.parentNode) canvas.remove(); media = null; }
  };
}
