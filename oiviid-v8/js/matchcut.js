// Scroll-scrubbed VFX breakdown: scroll position picks the frame.
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const pad = (n) => String(n).padStart(2, '0');
  const sfx = window.sfx || {};

  const load = (src) => { const im = new Image(); im.decoding = 'async'; im.src = src; return im; };

  /* ---------------- BREAKDOWN ---------------- */
  const bd = document.getElementById('breakdown');
  const bdCanvas = document.getElementById('bdCanvas');
  const bctx = bdCanvas.getContext('2d');
  const bdHead = document.getElementById('bdHead');
  const bdFrame = document.getElementById('bdFrame');
  const BD_N = 77;
  let bdFrames = null;
  const ensureBd = () => {
    if (bdFrames) return;
    bdFrames = Array.from({ length: BD_N }, (_, i) => load(`assets/seq/lst/${pad(i + 1)}.jpg`));
  };
  new IntersectionObserver(([e]) => { if (e.isIntersecting) ensureBd(); }, { rootMargin: '600px 0px' }).observe(bd);

  let bdShown = -1, bdLastTick = -1;
  const bdDraw = () => {
    requestAnimationFrame(bdDraw);
    if (!bdFrames) return;
    const r = bd.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, bd.offsetHeight - innerHeight), 0, 1);
    const i = Math.min(BD_N - 1, Math.floor(p * BD_N));
    const img = bdFrames[i];
    const w = bdCanvas.clientWidth, h = bdCanvas.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (bdCanvas.width !== Math.round(w * dpr)) { bdCanvas.width = Math.round(w * dpr); bdCanvas.height = Math.round(h * dpr); bdShown = -1; }
    if (i === bdShown || !img.complete || !img.naturalWidth) return;
    bdShown = i;
    const s = Math.max(bdCanvas.width / img.naturalWidth, bdCanvas.height / img.naturalHeight);
    bctx.drawImage(img, (bdCanvas.width - img.naturalWidth * s) / 2, (bdCanvas.height - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    bdHead.style.left = `${(i / (BD_N - 1)) * 100}%`;
    bdFrame.textContent = `Frame ${pad(i + 1)} / ${BD_N}`;
    if (i !== bdLastTick) { bdLastTick = i; sfx.tick?.(2); }
  };
  requestAnimationFrame(bdDraw);
})();
