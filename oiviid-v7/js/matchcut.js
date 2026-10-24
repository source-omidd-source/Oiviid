// Match-cut hero + scroll-scrubbed VFX breakdown.
//
// Hero: scroll drives a three-shot sequence. Every shot is placed with a two-point
// similarity transform (position, scale, rotation), the same maths as a 2-point track,
// so its pair of "lights" lands exactly on the same two screen points as the shot
// before it: two graphic dots -> a car's headlights -> Omid's sunglasses.
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const pad = (n) => String(n).padStart(2, '0');
  const sfx = window.sfx || {};

  /* ---------------- HERO ---------------- */
  const sec = document.getElementById('reel');
  const stage = document.getElementById('mcStage');
  const canvas = document.getElementById('mcCanvas');
  const ctx = canvas.getContext('2d');
  const ringL = document.getElementById('ringL');
  const ringR = document.getElementById('ringR');
  const span = document.getElementById('mcSpan');
  const lock = document.getElementById('mcLock');
  const shotEl = document.getElementById('mcShot');
  const tcEl = document.getElementById('mcTc');
  const flag = document.getElementById('mcFlag');
  const intro = document.getElementById('mcIntro');
  const end = document.getElementById('mcEnd');

  const load = (src) => { const im = new Image(); im.decoding = 'async'; im.src = src; return im; };
  const CAR_N = 15;
  const car = Array.from({ length: CAR_N }, (_, i) => load(`assets/seq/car/${pad(i + 1)}.jpg`));
  const me = load('assets/me.webp');

  // measured headlight centres (source px) at three frames of the dolly move
  const CAR_KEYS = [
    [0, [250, 272], [525, 265]],
    [7, [283, 270], [568, 262]],
    [14, [318, 278], [606, 268]],
  ];
  const ME_PTS = [[190, 225], [297, 230]]; // lens centres in me.webp (500 x 500)

  const carPoints = (f) => {
    let a = CAR_KEYS[0], b = CAR_KEYS[1];
    if (f > CAR_KEYS[1][0]) { a = CAR_KEYS[1]; b = CAR_KEYS[2]; }
    const t = clamp((f - a[0]) / (b[0] - a[0]), 0, 1);
    return [
      [lerp(a[1][0], b[1][0], t), lerp(a[1][1], b[1][1], t)],
      [lerp(a[2][0], b[2][0], t), lerp(a[2][1], b[2][1], t)],
    ];
  };

  let W = 1, H = 1, DPR = 1, K = 1;
  const resize = () => {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = stage.clientWidth; H = stage.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    K = clamp(Math.min(W / 1440, H / 900), 0.42, 1.4);
  };
  resize();
  addEventListener('resize', resize);

  // draw an image so that its points P1,P2 land on screen points Q1,Q2
  const drawAligned = (img, P1, P2, Q1, Q2, alpha = 1) => {
    if (!img.complete || !img.naturalWidth) return;
    const pdx = P2[0] - P1[0], pdy = P2[1] - P1[1];
    const qdx = Q2[0] - Q1[0], qdy = Q2[1] - Q1[1];
    const s = Math.hypot(qdx, qdy) / Math.hypot(pdx, pdy);
    const ang = Math.atan2(qdy, qdx) - Math.atan2(pdy, pdx);
    const c = Math.cos(ang) * s, si = Math.sin(ang) * s;
    const tx = Q1[0] - (c * P1[0] - si * P1[1]);
    const ty = Q1[1] - (si * P1[0] + c * P1[1]);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.setTransform(DPR * c, DPR * si, -DPR * si, DPR * c, DPR * tx, DPR * ty);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  };

  const CUT1 = 0.2, CUT2 = 0.58, END = 0.8;
  let target = 0, pos = 0, lastPhase = 0, last = performance.now();
  const read = () => {
    const r = sec.getBoundingClientRect();
    target = clamp(-r.top / Math.max(1, sec.offsetHeight - innerHeight), 0, 1);
  };
  addEventListener('scroll', read, { passive: true });
  read();

  const showFlag = (text) => {
    flag.textContent = text;
    flag.classList.remove('is-on');
    void flag.offsetWidth;
    flag.classList.add('is-on');
  };

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(sec);

  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (!visible) return;
    pos += (target - pos) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 10));
    if (Math.abs(target - pos) < 1e-4) pos = target;
    const p = pos;

    const endT = clamp((p - END) / (1 - END), 0, 1);
    // after the last cut the locked pair slides right to make room for the headline
    const cx = lerp(W / 2, W * (W < 700 ? 0.5 : 0.7), ease(endT));
    const cy = lerp(H * 0.48, H * (W < 700 ? 0.36 : 0.5), ease(endT));

    let D, phase, label;
    if (p < CUT1) {
      phase = 0;
      const t = ease(p / CUT1);
      D = lerp(W * 0.7, 290 * K, t);
      label = '01 — Two lights';
    } else if (p < CUT2) {
      phase = 1;
      D = lerp(290 * K, 255 * K, (p - CUT1) / (CUT2 - CUT1));
      label = '02 — Runnin Thru The City / Ndotspinalot';
    } else {
      phase = 2;
      D = lerp(255 * K, (W < 700 ? 120 : 165) * K, ease(clamp((p - CUT2) / (END - CUT2), 0, 1)));
      label = '03 — Omid';
    }
    const Q1 = [cx - D / 2, cy], Q2 = [cx + D / 2, cy];

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (phase === 0) {
      const t = p / CUT1;
      const r = lerp(5, 24, ease(t)) * K;
      ctx.save();
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.shadowColor = 'rgba(255,244,220,.9)';
      ctx.shadowBlur = lerp(10, 60, t) * K;
      ctx.fillStyle = '#fff6e6';
      [Q1, Q2].forEach((q) => { ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
    } else if (phase === 1) {
      const f = ((p - CUT1) / (CUT2 - CUT1)) * (CAR_N - 1);
      const [P1, P2] = carPoints(f);
      drawAligned(car[Math.round(f)], P1, P2, Q1, Q2);
    } else {
      drawAligned(me, ME_PTS[0], ME_PTS[1], Q1, Q2);
    }

    // film grain over everything
    if (!reduceMotion) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2 * DPR, 2 * DPR);
      }
      ctx.globalAlpha = 1;
    }

    // tracking markers locked on the two points
    const ringR0 = Math.max(14, 30 * K);
    [ringL, ringR].forEach((el, i) => {
      const q = i ? Q2 : Q1;
      el.style.width = el.style.height = `${ringR0 * 2}px`;
      el.style.transform = `translate3d(${q[0] - ringR0}px, ${q[1] - ringR0}px, 0)`;
    });
    span.style.width = `${Math.max(0, D - ringR0 * 2)}px`;
    span.style.transform = `translate3d(${Q1[0] + ringR0}px, ${cy}px, 0)`;
    span.dataset.d = `${Math.round(D / K)} px`;
    lock.style.opacity = String(1 - endT);

    if (phase !== lastPhase) {
      if (phase > lastPhase) { showFlag(`Match cut 0${phase}`); sfx.cut?.(); }
      else sfx.whoosh?.(false);
      lastPhase = phase;
    }
    if (shotEl.textContent !== label) shotEl.textContent = label;
    const secs = p * 12;
    tcEl.textContent = `00:00:${pad(Math.floor(secs))}:${pad(Math.floor((secs % 1) * 25))}`;
    intro.style.opacity = String(1 - clamp(p / 0.06, 0, 1));
    end.style.opacity = String(endT);
    end.style.transform = `translateY(${(1 - endT) * 30}px)`;
    end.style.pointerEvents = endT > 0.6 ? 'auto' : 'none';
  };
  requestAnimationFrame(frame);

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
