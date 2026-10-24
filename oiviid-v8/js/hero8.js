// Hero: plays the rendered match-cut edit and draws a HUD synced to its frames.
// cuts.json (written by the renderer) says on which frame each cut lands and where
// the matched point sits, so the tracking markers appear exactly on the match.
(() => {
  const $ = (s) => document.querySelector(s);
  const pad = (n) => String(n).padStart(2, '0');
  const sfx = window.sfx || {};
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stage = $('#mcStage');
  const video = $('#mcVideo');
  const hud = $('#mcHud');
  const ctx = hud.getContext('2d');
  const flag = $('#mcFlag');
  const shotEl = $('#mcShot');
  const tcEl = $('#mcTc');
  const intro = $('#mcIntro');
  const end = $('#mcEnd');
  const soundBtn = $('#mcSoundBtn');

  let meta = null;
  fetch('assets/cuts.json').then((r) => r.json()).then((m) => { meta = m; }).catch(() => {});

  // map normalised video coords to stage px (cover on wide screens, contain on narrow ones)
  let W = 1, H = 1, DPR = 1, vx = 0, vy = 0, vw = 1, vh = 1;
  const resize = () => {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = stage.clientWidth; H = stage.clientHeight;
    hud.width = Math.round(W * DPR); hud.height = Math.round(H * DPR);
    const contain = W / H < 1.2;
    video.style.objectFit = contain ? 'contain' : 'cover';
    const s = contain ? Math.min(W / 1280, H / 720) : Math.max(W / 1280, H / 720);
    vw = 1280 * s; vh = 720 * s; vx = (W - vw) / 2; vy = (H - vh) / 2;
  };
  resize();
  addEventListener('resize', resize);

  const start = () => {
    video.currentTime = 0;
    end.classList.remove('is-on');
    video.play().catch(() => {});
  };
  // wait for the loader to lift before rolling
  const waitLoader = () => (document.body.classList.contains('is-loading') ? setTimeout(waitLoader, 120) : setTimeout(start, 500));
  waitLoader();

  soundBtn.addEventListener('click', () => {
    sfx.ensure?.();
    sfx.enabled = true;
    soundBtn.classList.add('is-used');
    start();
  });
  $('#mcReplay').addEventListener('click', start);
  video.addEventListener('ended', () => { end.classList.add('is-on'); sfx.burst?.(); });

  let lastCut = -1;
  const ring = (x, y, r, a) => {
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1 * DPR;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    const t = 8 * DPR;
    ctx.beginPath();
    ctx.moveTo(x - r - t, y); ctx.lineTo(x - r + t, y);
    ctx.moveTo(x + r - t, y); ctx.lineTo(x + r + t, y);
    ctx.moveTo(x, y - r - t); ctx.lineTo(x, y - r + t);
    ctx.moveTo(x, y + r - t); ctx.lineTo(x, y + r + t);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const draw = () => {
    requestAnimationFrame(draw);
    ctx.clearRect(0, 0, hud.width, hud.height);
    if (!meta) return;
    const f = video.currentTime * meta.fps;

    // which shot is on screen
    let shot = 'Intro — two lights';
    for (const s of meta.shots) if (f >= s.start) shot = s.artist ? `${s.name} / ${s.artist}` : s.name;
    if (shotEl.textContent !== shot) shotEl.textContent = shot;
    const secs = video.currentTime;
    tcEl.textContent = `00:00:${pad(Math.floor(secs))}:${pad(Math.floor((secs % 1) * 30))}`;
    intro.style.opacity = String(Math.max(0, 1 - secs / 1.2));

    // markers: fade in a few frames before each cut, hold, fade out after
    meta.cuts.forEach((c, i) => {
      const d = f - c.frame;
      if (d < -7 || d > 12) return;
      const a = d < 0 ? 1 + d / 7 : 1 - Math.max(0, d - 6) / 6;
      const pts = c.type === 'pair' ? c.points : [c.point];
      const r = c.type === 'pair' ? 26 * (vw / 1280) * DPR : (c.size * vw * DPR) / 2 + 6 * DPR;
      pts.forEach((p) => ring((vx + p[0] * vw) * DPR, (vy + p[1] * vh) * DPR, r, a));
      if (pts.length === 2) {
        ctx.globalAlpha = a; ctx.setLineDash([4 * DPR, 4 * DPR]); ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo((vx + pts[0][0] * vw) * DPR + r, (vy + pts[0][1] * vh) * DPR);
        ctx.lineTo((vx + pts[1][0] * vw) * DPR - r, (vy + pts[1][1] * vh) * DPR);
        ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      if (d >= 0 && i !== lastCut) {
        lastCut = i;
        flag.textContent = c.label;
        flag.classList.remove('is-on'); void flag.offsetWidth; flag.classList.add('is-on');
        sfx.cut?.();
      }
    });
    if (f < 2) lastCut = -1;
  };
  if (!reduceMotion) requestAnimationFrame(draw);
})();
