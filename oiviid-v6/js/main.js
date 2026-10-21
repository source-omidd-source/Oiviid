(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const EMAIL = 'editedbyomidd@gmail.com';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const sfx = window.sfx;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (t) => t * t * (3 - 2 * t);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) scrollTo(0, 0);

  /* ---------- Scramble text (letters shuffle, then settle) ---------- */
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=';
  const scrambleTo = (el, text, dur = 420) => {
    if (reduceMotion) { el.textContent = text; return; }
    const start = performance.now();
    cancelAnimationFrame(el._scr);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const fixed = Math.floor(p * text.length);
      let out = text.slice(0, fixed);
      for (let i = fixed; i < text.length; i++) out += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = out;
      if (p < 1) el._scr = requestAnimationFrame(tick);
    };
    el._scr = requestAnimationFrame(tick);
  };
  $$('.scramble').forEach((el) => {
    const text = el.textContent;
    el.addEventListener('mouseenter', () => scrambleTo(el, text));
  });

  /* ---------- Projects ---------- */
  const projects = $$('#projectsData li').map((li, i) => {
    const d = li.dataset;
    let frames;
    if (d.thumbs === 'yt') {
      frames = ['maxresdefault', 'hq1', 'hq2', 'hq3'].map((n) => `https://img.youtube.com/vi/${d.yt}/${n}.jpg`);
    } else {
      // up to 7 frames, spread across this project's clips
      const all = [];
      const clips = d.frames.split(',');
      for (let k = 0; k < 6; k++) clips.forEach((c) => all.push(`assets/frames/${c}-${k}.jpg`));
      const want = Math.min(7, all.length);
      frames = Array.from({ length: want }, (_, j) => all[Math.floor((j / want) * all.length)]);
    }
    return {
      i, name: d.name, artist: li.getAttribute('data-artist'), tag: d.tag, cat: d.cat,
      yt: d.yt, link: d.link, video: d.video, crop: parseFloat(d.crop) || 1, frames,
      poster: d.yt ? `https://img.youtube.com/vi/${d.yt}/maxresdefault.jpg` : frames[0],
    };
  });

  /* ---------- Loader ---------- */
  const loader = $('#loader');
  const pctEl = $('#loaderPct');
  const t0 = performance.now();
  const LOAD_MS = reduceMotion ? 300 : 2400;
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  let loaded = false;
  fontsReady.then(() => { loaded = true; });
  const loadTick = () => {
    const p = Math.min(1, (performance.now() - t0) / LOAD_MS);
    const shown = loaded ? p : Math.min(p, 0.9);
    pctEl.textContent = Math.round(shown * 100);
    if (shown < 1) return setTimeout(loadTick, 40);
    loader.classList.add('is-done');
    document.body.classList.remove('is-loading');
    sfx.whoosh(true);
    setTimeout(() => loader.remove(), 1100);
  };
  loadTick();

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const scrollToTarget = (target) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  /* ---------- Rails: menu, sound, notes ---------- */
  const menu = $('#menu');
  const menuBtn = $('#menuBtn');
  const closeMenu = () => { if (!menu.hidden) { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); } };
  menuBtn.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    sfx.whoosh(open);
  });
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('#menu, #menuBtn')) closeMenu(); });

  const soundBtn = $('#soundToggle');
  const syncSound = () => soundBtn.setAttribute('aria-pressed', String(sfx.enabled));
  soundBtn.addEventListener('click', () => { sfx.ensure(); sfx.enabled = !sfx.enabled; syncSound(); });
  syncSound();

  const notesBtn = $('#notesToggle');
  let notesOn = true;
  try { notesOn = localStorage.getItem('oiviid-notes') !== 'off'; } catch {}
  const syncNotes = () => {
    document.body.classList.toggle('no-notes', !notesOn);
    notesBtn.setAttribute('aria-pressed', String(notesOn));
  };
  notesBtn.addEventListener('click', () => {
    notesOn = !notesOn;
    try { localStorage.setItem('oiviid-notes', notesOn ? 'on' : 'off'); } catch {}
    syncNotes();
  });
  syncNotes();

  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    closeMenu();
    sfx.whoosh(true);
    scrollToTarget(target);
  }));

  let lastHovered = null;
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest('[data-sfx], .track, .feat__name');
    if (el === lastHovered) return;
    lastHovered = el;
    if (el && e.pointerType === 'mouse') sfx.hover();
  });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-sfx], .track')) sfx.click(); });

  /* ---------- Reel: playhead scrubs a filmstrip that blooms into a collage ---------- */
  const reel = $('#reel');
  const stage = $('#stage');
  const framesBox = $('#frames');
  const mainTile = $('#reelMain');
  const nameEl = $('#reelName');
  const playhead = $('#playhead');
  const idxEl = $('#reelIndex');
  const nowEl = $('#reelNow');

  // a seeded random so the collage layout is the same on every visit
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const frames = [];
  projects.forEach((p) => {
    p.firstFrame = frames.length;
    p.frames.forEach((src) => {
      const img = document.createElement('img');
      img.className = 'frame';
      img.alt = '';
      img.decoding = 'async';
      img.src = src;
      if (src.includes('youtube')) img.addEventListener('error', () => { img.src = p.poster.replace('maxresdefault', 'hqdefault'); }, { once: true });
      framesBox.append(img);
      // push frames away from the middle so the main tile doesn't hide them
      const sx = rnd() < 0.5 ? -1 : 1, sy = rnd() < 0.5 ? -1 : 1;
      frames.push({ el: img, project: p, dx: sx * (0.45 + rnd() * 0.55), dy: sy * (0.25 + rnd() * 0.75), size: 0.42 + rnd() * 0.5, wasLeft: true });
    });
    p.lastFrame = frames.length - 1;
  });

  // one video per project for the main tile, only the current one plays
  projects.forEach((p) => {
    let el;
    if (p.video) {
      el = document.createElement('video');
      Object.assign(el, { muted: true, loop: true, playsInline: true, preload: p.i < 2 ? 'auto' : 'metadata' });
      el.setAttribute('muted', '');
      el.src = p.video;
      if (p.crop !== 1) el.style.transform = `scale(${p.crop})`;
    } else {
      el = document.createElement('img');
      el.src = p.poster;
      el.alt = '';
      el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .35s';
    }
    p.tileEl = el;
    mainTile.append(el);
  });

  const BW = 300, BH = 169;
  let W = 1, H = 1, x0 = 0, x1 = 1, stripY = 0, sw = 1, sh = 1, R = 1;
  const measure = () => {
    W = stage.clientWidth; H = stage.clientHeight;
    const small = W < 700;
    x0 = small ? 14 : 24; x1 = W - x0;
    stripY = H * 0.5;
    sw = (x1 - x0) / frames.length; sh = sw * 0.5625;
    R = W * (small ? 0.22 : 0.15);
    frames.forEach((f, i) => { f.home = x0 + (i + 0.5) * sw; });
    projects.forEach((p) => {
      p.from = frames[p.firstFrame].home - sw / 2;
      p.to = frames[p.lastFrame].home + sw / 2;
    });
  };
  measure();
  addEventListener('resize', measure);

  let target = 0, pos = 0, current = -1, last = performance.now();
  const readScroll = () => {
    const r = reel.getBoundingClientRect();
    target = clamp(-r.top / Math.max(1, reel.offsetHeight - innerHeight), 0, 1);
  };
  addEventListener('scroll', readScroll, { passive: true });
  if (lenis) lenis.on('scroll', readScroll);
  readScroll();

  const setCurrent = (k) => {
    if (k === current) return;
    current = k;
    const p = projects[k];
    projects.forEach((q) => {
      const on = q === p;
      q.tileEl.classList.toggle('is-on', on);
      if (q.tileEl.tagName === 'IMG') q.tileEl.style.opacity = on ? 1 : 0;
      if (q.tileEl.tagName === 'VIDEO') { if (on) q.tileEl.play().catch(() => {}); else q.tileEl.pause(); }
    });
    nameEl.innerHTML = `${p.name}<sup>(${p.artist})</sup>`;
    scrambleTo(idxEl, `${String(k + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}`);
    scrambleTo(nowEl, `▶ ${p.name}`);
  };

  let visible = true;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    const p = projects[current];
    if (p && p.tileEl.tagName === 'VIDEO') { if (visible) p.tileEl.play().catch(() => {}); else p.tileEl.pause(); }
  }).observe(reel);

  const frameLoop = (now) => {
    requestAnimationFrame(frameLoop);
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (!visible) return;
    pos += (target - pos) * (1 - Math.exp(-dt * 9));
    if (Math.abs(target - pos) < 1e-4) pos = target;

    const small = W < 700;
    // the playhead travels from the middle of the first project to the middle of the last
    const c0 = (projects[0].from + projects[0].to) / 2;
    const c1 = (projects[projects.length - 1].from + projects[projects.length - 1].to) / 2;
    const playX = c0 + pos * (c1 - c0);
    playhead.style.transform = `translate3d(${playX}px,0,0)`;

    // which project sits under the playhead
    let k = projects.findIndex((p) => playX >= p.from && playX <= p.to);
    if (k < 0) k = playX < projects[0].from ? 0 : projects.length - 1;
    setCurrent(k);

    // the main tile rides with the playhead
    const mw = Math.min(W * (small ? 0.78 : 0.34), 580);
    const mh = mw * 0.5625;
    const mx = clamp(playX - mw / 2, x0, x1 - mw);
    const my = H * (small ? 0.44 : 0.46) - mh / 2;
    mainTile.style.width = `${mw}px`;
    mainTile.style.transform = `translate3d(${mx}px,${my}px,0)`;
    nameEl.style.transform = `translate3d(${mx}px,${my - nameEl.offsetHeight - 6}px,0)`;

    // frames: thin strip far from the playhead, scattered collage around it
    const spreadX = Math.min(W * (small ? 0.46 : 0.36), 640);
    const spreadY = H * (small ? 0.3 : 0.36);
    const scaleBase = small ? 0.38 : Math.min(1, W / 1440);
    for (const f of frames) {
      const d = Math.abs(f.home - playX);
      const a = ease(clamp(1 - d / R, 0, 1));
      const s0 = sw / BW;
      const s1 = f.size * scaleBase * (small ? 0.9 : 0.8);
      const s = s0 + (s1 - s0) * a;
      const sx = f.home - sw / 2, sy = stripY - sh / 2;
      const cx = clamp(playX + f.dx * spreadX, x0 + (BW * s1) / 2, x1 - (BW * s1) / 2) - (BW * s1) / 2;
      const cy = clamp(H * 0.46 + f.dy * spreadY, 70 + (BH * s1) / 2, H - 60 - (BH * s1) / 2) - (BH * s1) / 2;
      const x = sx + (cx - sx) * a;
      const y = sy + (cy - sy) * a;
      f.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(4)})`;
      f.el.style.zIndex = String(1 + Math.round(a * 20));
      // scrubbing sound: a tick each time a frame passes under the playhead
      const left = f.home < playX;
      if (left !== f.wasLeft) { f.wasLeft = left; if (Math.abs(target - pos) > 0.0005) sfx.tick?.(f.project.i); }
    }
  };
  requestAnimationFrame(frameLoop);

  const openCurrent = () => openLightbox(projects[current]);
  mainTile.addEventListener('click', openCurrent);
  $('#reelView').addEventListener('click', openCurrent);

  /* ---------- Featuring: photo follows the cursor on names ---------- */
  const featImg = document.createElement('img');
  featImg.className = 'feat__img';
  featImg.alt = '';
  document.body.append(featImg);
  $$('.feat__name').forEach((n) => {
    n.addEventListener('mouseenter', () => { if (!n.dataset.img) return; featImg.src = n.dataset.img; featImg.classList.add('is-on'); });
    n.addEventListener('mouseleave', () => featImg.classList.remove('is-on'));
    n.addEventListener('mousemove', (e) => { featImg.style.transform = `translate(${e.clientX + 18}px, ${e.clientY - 150}px)`; });
  });

  /* ---------- Tracklist ---------- */
  const tracks = $('#tracks');
  projects.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'track';
    li.dataset.cat = p.cat;
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.setAttribute('aria-label', `Play ${p.name}`);
    li.innerHTML = `<span class="mono">${String(p.i + 1).padStart(2, '0')}</span>
      <span class="track__title">${p.name}</span>
      <span class="track__artist">${p.artist}</span>
      <span class="track__tag mono">${p.tag}</span>
      <span class="track__go mono">▶</span>`;
    li.addEventListener('click', () => openLightbox(p));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(p); } });
    p.trackEl = li;
    tracks.append(li);
  });
  $$('.filter').forEach((btn) => btn.addEventListener('click', () => {
    $$('.filter').forEach((b) => b.classList.toggle('is-active', b === btn));
    const f = btn.dataset.filter;
    projects.forEach((p) => p.trackEl.classList.toggle('is-out', f !== 'all' && p.cat !== f));
    lenis?.resize();
  }));

  // floating preview for tracks and services
  const hp = $('#hoverPreview');
  const hpVideo = $('video', hp);
  const hpImg = $('img', hp);
  const showPreview = (video, img) => {
    if (video) {
      hpImg.style.opacity = 0;
      if (!hpVideo.src.endsWith(video)) hpVideo.src = video;
      hpVideo.play().catch(() => {});
    } else {
      hpVideo.pause();
      hpVideo.removeAttribute('src');
      hpImg.src = img;
      hpImg.style.opacity = 1;
    }
    hp.classList.add('is-on');
  };
  const hidePreview = () => { hp.classList.remove('is-on'); hpVideo.pause(); };
  const followPreview = (e) => { hp.style.transform = `translate(${e.clientX + 24}px, ${e.clientY - 200}px)`; };
  if (finePointer) {
    projects.forEach((p) => {
      p.trackEl.addEventListener('mouseenter', () => { showPreview(p.video, p.poster); scrambleTo($('.track__tag', p.trackEl), p.tag); });
      p.trackEl.addEventListener('mouseleave', hidePreview);
      p.trackEl.addEventListener('mousemove', followPreview);
    });
    $$('.side').forEach((s) => {
      s.addEventListener('mouseenter', () => showPreview(s.dataset.preview));
      s.addEventListener('mouseleave', hidePreview);
      s.addEventListener('mousemove', followPreview);
    });
  }
  $$('.side').forEach((s) => s.addEventListener('click', () => scrollToTarget($('#contact'))));

  /* ---------- About: words light up as you read ---------- */
  const about = $('#aboutText');
  about.innerHTML = about.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
  const aboutWords = $$('.w', about);
  const aboutLoop = () => {
    const r = about.getBoundingClientRect();
    const p = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.25), 0, 1);
    const n = Math.round(p * aboutWords.length);
    aboutWords.forEach((w, i) => w.classList.toggle('on', i < n));
  };
  addEventListener('scroll', aboutLoop, { passive: true });
  if (lenis) lenis.on('scroll', aboutLoop);
  aboutLoop();

  /* ---------- Lightbox ---------- */
  const lb = $('#lightbox');
  const lbFrame = $('#lbFrame');
  const lbExternal = $('#lbExternal');
  let lastFocus = null;
  function openLightbox(p) {
    lastFocus = document.activeElement;
    $('#lbTitle').textContent = p.name;
    $('#lbArtist').textContent = `(${p.artist})`;
    if (p.yt) {
      lbFrame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${p.yt}?autoplay=1&rel=0&modestbranding=1" title="${p.name}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      lbExternal.href = `https://www.youtube.com/watch?v=${p.yt}`;
      lbExternal.hidden = false;
    } else {
      lbFrame.innerHTML = `<video src="${p.video}" autoplay loop playsinline controls></video>`;
      lbExternal.hidden = !p.link;
      if (p.link) lbExternal.href = p.link;
    }
    hidePreview();
    lb.hidden = false;
    lenis?.stop();
    document.body.style.overflow = 'hidden';
    sfx.whoosh(true);
    $('#lbClose').focus();
  }
  const closeLightbox = () => {
    lb.hidden = true;
    lbFrame.innerHTML = '';
    lenis?.start();
    document.body.style.overflow = '';
    sfx.whoosh(false);
    if (lastFocus) lastFocus.focus();
  };
  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lbCta').addEventListener('click', closeLightbox);
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!lb.hidden) closeLightbox();
    closeMenu();
  });

  /* ---------- Sticky CTA + copy email ---------- */
  const sticky = $('#stickyCta');
  const contact = $('#contact');
  const toggleSticky = () => {
    sticky.classList.toggle('is-on', reel.getBoundingClientRect().bottom < innerHeight * 0.6 && contact.getBoundingClientRect().top > innerHeight * 0.9);
  };
  addEventListener('scroll', toggleSticky, { passive: true });
  toggleSticky();

  $('#copyMail').addEventListener('click', async () => {
    const state = $('#copyState');
    try { await navigator.clipboard.writeText(EMAIL); state.textContent = '[copied]'; } catch { location.href = `mailto:${EMAIL}`; }
    setTimeout(() => { state.textContent = '[copy]'; }, 2000);
  });
})();
