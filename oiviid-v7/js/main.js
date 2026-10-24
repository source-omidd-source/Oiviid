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

  const reel = $('#reel');

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
