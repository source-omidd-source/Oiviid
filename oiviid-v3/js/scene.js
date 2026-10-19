// Hero: "OMID" set as thousands of points that show the showreel through them.
// The cursor scatters them, a click sends a shockwave, and scrolling dissolves
// the letters into a dense 16:9 grid of points that plays the reel (lyric -> video).
import * as THREE from 'three';

const canvas = document.getElementById('scene');
const hero = document.getElementById('hero');
const video = document.getElementById('reelSrc');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
} catch (err) {
  console.warn('WebGL unavailable, hero disabled:', err);
}

if (renderer) {
  const PR = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(PR);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
  const clock = new THREE.Clock();

  const vtex = new THREE.VideoTexture(video);
  vtex.colorSpace = THREE.NoColorSpace;
  vtex.minFilter = THREE.LinearFilter;
  vtex.magFilter = THREE.LinearFilter;
  video.play().catch(() => {});

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uVideo: { value: vtex },
      uMorph: { value: 0 },
      uTime: { value: 0 },
      uPR: { value: PR },
      uSizeText: { value: 3 },
      uSizeGrid: { value: 4 },
      uMouse: { value: new THREE.Vector2(9999, 9999) },
      uMouseStr: { value: 0 },
      uReach: { value: 130 },
      uClick: { value: new THREE.Vector3(0, 0, -100) },
      uIntro: { value: 0 },
      uRect: { value: new THREE.Vector4(0, 0, 1, 1) }, // centre x, y, half width, half height
      uRadius: { value: 18 },
    },
    vertexShader: /* glsl */`
      attribute vec3 aText;
      attribute vec3 aGrid;
      attribute vec2 aTextUv;
      attribute vec2 aGridUv;
      attribute float aRand;
      uniform sampler2D uVideo;
      uniform float uMorph, uTime, uPR, uSizeText, uSizeGrid, uMouseStr, uReach, uIntro, uRadius;
      uniform vec2 uMouse;
      uniform vec3 uClick;
      uniform vec4 uRect;
      varying vec2 vUv;
      varying float vMorph;
      varying float vMask;

      void main() {
        // the frame builds outward from its centre, so the reveal reads as a sweep, not noise
        float fromCentre = length((aGridUv - 0.5) * vec2(1.6, 1.0));
        float m = clamp(uMorph * 1.9 - fromCentre * 0.75 - aRand * 0.15, 0.0, 1.0);
        m = m * m * (3.0 - 2.0 * m);

        vec3 p = mix(aText, aGrid, m);
        // curved flight path + points swell as if they pass close to the camera
        float flight = sin(m * 3.14159);
        vec2 travel = aGrid.xy - aText.xy;
        vec2 side = normalize(vec2(-travel.y, travel.x) + 1e-4);
        p.xy += side * flight * (40.0 + aRand * 90.0);

        // intro: assemble from a loose cloud
        float intro = clamp(uIntro * 1.6 - aRand * 0.6, 0.0, 1.0);
        intro = 1.0 - pow(1.0 - intro, 3.0);
        p.xy += vec2(sin(aRand * 91.0), cos(aRand * 57.0)) * (1.0 - intro) * 420.0;

        // idle shimmer while it reads as type
        p.xy += vec2(sin(uTime * 1.3 + aRand * 20.0), cos(uTime * 1.1 + aRand * 17.0)) * (1.0 - m) * 1.2;

        // the finished frame stays alive: bright pixels breathe a little
        vec3 vid = texture2D(uVideo, aGridUv).rgb;
        float lum = dot(vid, vec3(0.299, 0.587, 0.114));

        // cursor: scatter as type, ripple as video
        vec2 d = p.xy - uMouse;
        float dist = length(d);
        float f = smoothstep(uReach, 0.0, dist) * uMouseStr;
        float wave = mix(1.0, 0.5 + 0.5 * sin(dist * 0.08 - uTime * 6.0), m);
        p.xy += normalize(d + 1e-4) * f * wave * mix(70.0 * (0.6 + aRand), 14.0, m);

        // click shockwave
        float ct = uTime - uClick.z;
        float cd = length(p.xy - uClick.xy);
        float ring = ct > 0.0 ? exp(-pow((cd - ct * 900.0) / 70.0, 2.0)) * exp(-ct * 2.2) : 0.0;
        p.xy += normalize(p.xy - uClick.xy + 1e-4) * ring * mix(60.0, 22.0, m);

        // rounded corners of the frame
        vec2 q = abs(aGrid.xy - uRect.xy) - (uRect.zw - uRadius);
        float cornerD = length(max(q, 0.0)) - uRadius;
        vMask = mix(1.0, 1.0 - smoothstep(-1.0, 1.0, cornerD), m);

        vUv = mix(aTextUv, aGridUv, m);
        vMorph = m;
        float size = mix(uSizeText, uSizeGrid * (0.94 + lum * 0.18), m);
        size *= 1.0 + flight * 1.6 + f * 0.6 + ring * 0.8;
        gl_PointSize = size * uPR * mix(0.4, 1.0, intro);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uVideo;
      varying vec2 vUv;
      varying float vMorph;
      varying float vMask;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        // round dots as type, softened squares as video (dense, but still visibly pixels)
        float r = mix(length(c), max(abs(c.x), abs(c.y)) * 1.04, vMorph * 0.75);
        if (r > 0.5 || vMask < 0.01) discard;
        vec3 col = texture2D(uVideo, vUv).rgb;
        col = mix(col * 0.78, col * 1.06, vMorph);
        float a = smoothstep(0.5, 0.38, r) * vMask;
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  window.heroFrame = { x: 0, y: 0, w: 0, h: 0 }; // read by main.js to place the frame caption

  // Dark backing behind the finished frame, so the gaps between pixels read like an LED panel.
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uOpacity: { value: 0 }, uSize: { value: new THREE.Vector2(1, 1) }, uRadius: { value: 18 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      uniform float uOpacity, uRadius;
      uniform vec2 uSize;
      varying vec2 vUv;
      void main() {
        vec2 q = abs((vUv - 0.5) * uSize) - (uSize * 0.5 - uRadius);
        float d = length(max(q, 0.0)) - uRadius;
        gl_FragColor = vec4(vec3(0.043, 0.043, 0.051), uOpacity * (1.0 - smoothstep(-1.0, 1.0, d)));
      }
    `,
  }));
  backing.renderOrder = -1;
  scene.add(backing);

  let points = null;
  let W = 1, H = 1;

  // The video frame is a dense grid of points; each one starts somewhere inside the
  // letters, picked from the matching region so the word spreads into the frame.
  const build = () => {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    renderer.setSize(W, H, false);
    camera.left = -W / 2; camera.right = W / 2; camera.top = H / 2; camera.bottom = -H / 2;
    camera.updateProjectionMatrix();

    const small = W < 700;
    const step = small ? 2 : 3;

    // draw the word
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    const targetW = W * (small ? 0.86 : 0.74);
    let size = 200;
    g.font = `600 ${size}px Onest, Arial, sans-serif`;
    size *= targetW / g.measureText('OMID').width;
    g.font = `600 ${size}px Onest, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#000';
    g.fillText('OMID', W / 2, H * (small ? 0.4 : 0.42));
    const data = g.getImageData(0, 0, W, H).data;

    const tx = [], ty = [];
    let minX = W, maxX = 0, minY = H, maxY = 0;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 128) {
          tx.push(x); ty.push(y);
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (!tx.length) return;

    // bin the letter samples so each frame pixel can pull from the matching area
    const BX = 72, BY = 18;
    const bins = Array.from({ length: BX * BY }, () => []);
    for (let i = 0; i < tx.length; i++) {
      const bx = Math.min(BX - 1, Math.floor(((tx[i] - minX) / Math.max(1, maxX - minX)) * BX));
      const by = Math.min(BY - 1, Math.floor(((ty[i] - minY) / Math.max(1, maxY - minY)) * BY));
      bins[by * BX + bx].push(i);
    }
    const pick = (u, v) => {
      const bx = Math.min(BX - 1, Math.floor(u * BX)), by = Math.min(BY - 1, Math.floor(v * BY));
      for (let rad = 0; rad < Math.max(BX, BY); rad++) {
        for (let k = 0; k < 8; k++) {
          const ox = bx + Math.round((Math.random() * 2 - 1) * rad);
          const oy = by + Math.round((Math.random() * 2 - 1) * rad);
          if (ox < 0 || oy < 0 || ox >= BX || oy >= BY) continue;
          const bin = bins[oy * BX + ox];
          if (bin.length) return bin[(Math.random() * bin.length) | 0];
        }
      }
      return (Math.random() * tx.length) | 0;
    };

    // the frame: 16:9, as large as the screen allows, dense enough to read as video
    const rectW = Math.min(W * (small ? 0.92 : 0.8), H * 0.66 * 16 / 9);
    const rectH = rectW * 9 / 16;
    const cy = small ? 30 : 20;
    const cols = small ? 176 : Math.min(340, Math.round(rectW / 3.2));
    const rows = Math.round(cols * 9 / 16);
    const sx = rectW / cols, sy = rectH / rows;
    const gx0 = -rectW / 2 + sx / 2;
    const gy0 = cy + rectH / 2 - sy / 2;
    material.uniforms.uRect.value.set(0, cy, rectW / 2, rectH / 2);
    material.uniforms.uRadius.value = small ? 12 : 20;
    backing.scale.set(rectW, rectH, 1);
    backing.position.set(0, cy, -1);
    backing.material.uniforms.uSize.value.set(rectW, rectH);
    backing.material.uniforms.uRadius.value = small ? 12 : 20;
    Object.assign(window.heroFrame, { x: W / 2 - rectW / 2, y: H / 2 - cy - rectH / 2, w: rectW, h: rectH });

    const N = cols * rows;
    const aText = new Float32Array(N * 3);
    const aGrid = new Float32Array(N * 3);
    const aTextUv = new Float32Array(N * 2);
    const aGridUv = new Float32Array(N * 2);
    const aRand = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const u = col / (cols - 1), v = row / (rows - 1);
      aGrid[i * 3] = gx0 + col * sx;
      aGrid[i * 3 + 1] = gy0 - row * sy;
      aGridUv[i * 2] = u;
      aGridUv[i * 2 + 1] = 1 - v;

      const t = pick(u, v);
      const px = tx[t] + (Math.random() - 0.5) * step;
      const py = ty[t] + (Math.random() - 0.5) * step;
      aText[i * 3] = px - W / 2;
      aText[i * 3 + 1] = H / 2 - py;
      // the letters act as a window onto the reel
      aTextUv[i * 2] = px / W;
      aTextUv[i * 2 + 1] = 1 - py / H;
      aRand[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(aText.slice(), 3));
    geo.setAttribute('aText', new THREE.BufferAttribute(aText, 3));
    geo.setAttribute('aGrid', new THREE.BufferAttribute(aGrid, 3));
    geo.setAttribute('aTextUv', new THREE.BufferAttribute(aTextUv, 2));
    geo.setAttribute('aGridUv', new THREE.BufferAttribute(aGridUv, 2));
    geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 1));

    if (points) { scene.remove(points); points.geometry.dispose(); }
    points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    scene.add(points);

    material.uniforms.uSizeText.value = step * 1.15;
    material.uniforms.uSizeGrid.value = Math.max(sx, sy) * 1.02;
    material.uniforms.uReach.value = small ? 90 : 150;
  };

  (document.fonts ? document.fonts.load('600 100px Onest').catch(() => {}) : Promise.resolve()).then(build);
  let resizeT;
  let lastW = innerWidth;
  addEventListener('resize', () => {
    // ignore mobile URL-bar height changes; rebuild on real width changes
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    clearTimeout(resizeT);
    resizeT = setTimeout(build, 200);
  });

  // ---- pointer ----
  const mouse = new THREE.Vector2(9999, 9999);
  const target = new THREE.Vector2(9999, 9999);
  let strength = 0, strengthTarget = 0, lastMoveAt = -1e9;
  const toWorld = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    return [cx - r.left - r.width / 2, r.height / 2 - (cy - r.top)];
  };
  hero.addEventListener('pointermove', (e) => {
    const [x, y] = toWorld(e.clientX, e.clientY);
    const speed = Math.hypot(x - target.x, y - target.y);
    target.set(x, y);
    strengthTarget = 1;
    lastMoveAt = performance.now();
    if (speed > 25 && speed < 600) window.sfx?.swish(Math.min(1, speed / 160));
  });
  hero.addEventListener('pointerleave', () => { strengthTarget = 0; });
  hero.addEventListener('pointerdown', (e) => {
    const [x, y] = toWorld(e.clientX, e.clientY);
    material.uniforms.uClick.value.set(x, y, clock.elapsedTime);
    window.sfx?.burst();
  });

  // ---- scroll morph ----
  let morph = 0, morphTarget = 0, lastHalf = false;
  const onScroll = () => {
    const r = hero.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
    hero.style.setProperty('--p', p.toFixed(3));
    morphTarget = Math.min(1, Math.max(0, (p - 0.04) / 0.62));
    const half = morphTarget > 0.5;
    if (half !== lastHalf) { lastHalf = half; window.sfx?.whoosh(half); }
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- loop ----
  // intro is timed by the wall clock so a throttled tab can't stall it
  let introStart = reduceMotion || window.siteReady ? performance.now() - (reduceMotion ? 1e9 : 0) : null;
  addEventListener('site:ready', () => { if (introStart === null) introStart = performance.now(); });
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

  let lastFrameAt = performance.now();
  const render = () => {
    requestAnimationFrame(render);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    if (!visible || !points) return;
    const t = clock.elapsedTime;

    const intro = introStart === null ? 0 : Math.min(1, (performance.now() - introStart) / 2200);
    // idle autopilot so the scatter shows on touch screens too
    if (performance.now() - lastMoveAt > 2500) {
      target.set(Math.sin(t * 0.45) * W * 0.3, Math.sin(t * 0.8) * H * 0.12 + H * 0.08);
      strengthTarget = 0.7 * (1 - morph * 0.85); // stay calm once it's the video
    }
    mouse.lerp(target, Math.min(1, dt * 8));
    strength += (strengthTarget - strength) * Math.min(1, dt * 4);
    // real elapsed time (not the clamped dt) so a throttled tab still finishes the morph
    const now = performance.now();
    const realDt = Math.min(1, (now - lastFrameAt) / 1000);
    lastFrameAt = now;
    morph += (morphTarget - morph) * (1 - Math.exp(-realDt * 5));
    if (Math.abs(morphTarget - morph) < 0.002) morph = morphTarget;

    const u = material.uniforms;
    u.uTime.value = t;
    u.uIntro.value = intro;
    u.uMorph.value = morph;
    u.uMouse.value.copy(mouse);
    u.uMouseStr.value = strength;
    backing.material.uniforms.uOpacity.value = Math.min(1, Math.max(0, (morph - 0.8) / 0.2));
    renderer.render(scene, camera);
  };
  render();
}
