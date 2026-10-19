// Liquid WebGL hero: the showreel as a texture that bends, ripples and splits RGB
// around the pointer, with a shockwave on click. Falls back to the plain <video>.
(() => {
  const win = document.getElementById('heroWindow');
  const canvas = document.getElementById('heroCanvas');
  const video = document.getElementById('heroVideo');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const VERT = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
  `;
  const FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec2 uRes, uVideoRes, uMouse, uVel;
    uniform vec3 uClick;
    uniform float uTime, uHover;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      // object-fit: cover
      vec2 s = uRes / uVideoRes;
      float sc = max(s.x, s.y);
      vec2 size = uVideoRes * sc;
      vec2 off = (uRes - size) * 0.5;
      vec2 tuv = (vUv * uRes - off) / size;

      // aspect-correct space for distances
      vec2 p = vUv * uRes / uRes.y;
      vec2 m = uMouse * uRes / uRes.y;
      float d = distance(p, m);
      vec2 dir = normalize(p - m + 1e-5);
      float speed = clamp(length(uVel), 0.0, 1.0);

      // liquid lens + ripples around the pointer
      float lens = smoothstep(0.38, 0.0, d) * uHover;
      tuv -= dir * lens * lens * (0.05 + speed * 0.12);
      tuv += dir * sin(d * 42.0 - uTime * 6.0) * lens * 0.007;

      // click shockwave
      float ct = uTime - uClick.z;
      vec2 c = uClick.xy * uRes / uRes.y;
      float cd = distance(p, c);
      float ring = ct > 0.0 ? exp(-pow((cd - ct * 1.1) * 12.0, 2.0)) * exp(-ct * 1.8) : 0.0;
      vec2 cdir = normalize(p - c + 1e-5);
      tuv += cdir * ring * 0.06;

      // slow global flow so it always feels alive
      tuv.x += sin(tuv.y * 8.0 + uTime * 0.9) * 0.002;
      tuv.y += cos(tuv.x * 7.0 + uTime * 0.7) * 0.002;

      // RGB split driven by pointer speed, lens and shockwave
      vec2 shift = uVel * 0.05 * (lens + 0.2) + cdir * ring * 0.025 + dir * lens * 0.004;
      tuv = clamp(tuv, 0.001, 0.999);
      float r = texture2D(uTex, clamp(tuv + shift, 0.001, 0.999)).r;
      float g = texture2D(uTex, tuv).g;
      float b = texture2D(uTex, clamp(tuv - shift, 0.001, 0.999)).b;
      vec3 col = vec3(r, g, b);

      col += (hash(vUv * uRes + fract(uTime) * 100.0) - 0.5) * 0.07;   // grain
      col *= 1.0 - 0.35 * pow(length(vUv - 0.5) * 1.25, 2.5);          // vignette
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    console.warn('Hero WebGL disabled:', err);
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const U = {};
  ['uTex', 'uRes', 'uVideoRes', 'uMouse', 'uVel', 'uClick', 'uTime', 'uHover'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform1i(U.uTex, 0);

  // ---- sizing ----
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const r = win.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
  };
  addEventListener('resize', resize);
  resize();

  // ---- pointer state ----
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, vx: 0, vy: 0 };
  let hover = 0, hoverTarget = 0, lastMove = -1e9;
  let click = [0.5, 0.5, -100];
  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;

  const toLocal = (cx, cy) => {
    const r = win.getBoundingClientRect();
    return [(cx - r.left) / r.width, 1 - (cy - r.top) / r.height];
  };
  win.addEventListener('pointermove', (e) => {
    [mouse.tx, mouse.ty] = toLocal(e.clientX, e.clientY);
    hoverTarget = 1;
    lastMove = now();
  });
  win.addEventListener('pointerleave', () => { hoverTarget = 0; });
  win.addEventListener('pointerdown', (e) => {
    const [x, y] = toLocal(e.clientX, e.clientY);
    click = [x, y, now()];
  });

  // ---- render loop (paused while the hero is off-screen) ----
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(win);
  let videoReady = false;
  let prev = now();

  const frame = () => {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = now();
    const dt = Math.min(0.05, t - prev);
    prev = t;

    // Autopilot: with no pointer for a while (or on touch), drift in a slow figure-8.
    if (t - lastMove > 2.2) {
      mouse.tx = 0.5 + Math.sin(t * 0.45) * 0.3;
      mouse.ty = 0.5 + Math.sin(t * 0.9) * 0.2;
      hoverTarget = 0.75;
    }
    const nx = mouse.x + (mouse.tx - mouse.x) * Math.min(1, dt * 9);
    const ny = mouse.y + (mouse.ty - mouse.y) * Math.min(1, dt * 9);
    mouse.vx += ((nx - mouse.x) / Math.max(dt, 1e-3) * 0.08 - mouse.vx) * 0.2;
    mouse.vy += ((ny - mouse.y) / Math.max(dt, 1e-3) * 0.08 - mouse.vy) * 0.2;
    mouse.x = nx; mouse.y = ny;
    hover += (hoverTarget - hover) * Math.min(1, dt * 4);

    if (video.readyState >= 2) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      if (!videoReady) {
        videoReady = true;
        gl.uniform2f(U.uVideoRes, video.videoWidth || 16, video.videoHeight || 9);
        win.classList.add('gl-on');
      }
    }
    if (!videoReady) return;

    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform2f(U.uVel, mouse.vx, mouse.vy);
    gl.uniform3f(U.uClick, click[0], click[1], click[2]);
    gl.uniform1f(U.uTime, t);
    gl.uniform1f(U.uHover, hover);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  video.play().catch(() => {});
  requestAnimationFrame(frame);
})();
