(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const EMAIL = 'editedbyomidd@gmail.com';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const sfx = window.sfx;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) scrollTo(0, 0);

  const flash = $('#flash');
  const flashCut = (sound = true) => {
    if (reduceMotion) return;
    flash.classList.remove('is-on');
    void flash.offsetWidth;
    flash.classList.add('is-on');
    if (sound) sfx.flash();
  };

  /* ---------- Intro: the first bars of a lyric video ---------- */
  const intro = $('#intro');
  const stage = $('#introStage');
  const WORDS = [
    ['I', 'fx-punch'], ['make', 'fx-stretch'], ['songs', 'fx-split'], ['look', 'fx-outline'],
    ['the way', 'fx-stretch'], ['they', 'fx-invert'], ['sound.', 'fx-accent'],
  ];
  let introDone = false;
  const endIntro = () => {
    if (introDone) return;
    introDone = true;
    intro.classList.add('is-done');
    document.body.classList.remove('is-intro');
    setTimeout(() => intro.remove(), 800);
  };
  $('#introSkip').addEventListener('click', endIntro);
  let seen = false;
  try { seen = sessionStorage.getItem('oiviid-intro') === '1'; sessionStorage.setItem('oiviid-intro', '1'); } catch {}
  if (reduceMotion || seen) endIntro();
  else {
    const BEAT = 300;
    WORDS.forEach(([word, fx], i) => {
      setTimeout(() => {
        if (introDone) return;
        stage.innerHTML = '';
        const w = document.createElement('p');
        w.className = `intro__word ${fx}`;
        w.textContent = word;
        stage.append(w);
        intro.classList.toggle('is-dark', fx === 'fx-invert');
        if (fx === 'fx-invert' || fx === 'fx-accent') sfx.flash(); else sfx.kick();
      }, 250 + i * BEAT);
    });
    setTimeout(endIntro, 250 + WORDS.length * BEAT + 250);
  }

  /* ---------- Smooth scroll + scroll velocity ---------- */
  let lenis = null;
  let vel = 0;
  if (window.Lenis && !reduceMotion) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', (l) => { vel = l.velocity; });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  } else {
    let lastY = scrollY;
    addEventListener('scroll', () => { vel = scrollY - lastY; lastY = scrollY; }, { passive: true });
  }
  const root = document.documentElement;
  const liquid = $('#liquidMap');
  let shownVel = 0;
  let lastVelT = performance.now();
  const velLoop = (now) => {
    // time-based easing so the effect settles quickly even if frames are dropped
    const dt = Math.min(0.25, (now - lastVelT) / 1000);
    lastVelT = now;
    shownVel += (vel - shownVel) * (1 - Math.exp(-dt * 12));
    vel *= Math.exp(-dt * 10);
    const v = clamp(shownVel, -40, 40);
    root.style.setProperty('--vel', v.toFixed(2));
    root.style.setProperty('--avel', Math.abs(v).toFixed(2));
    liquid.setAttribute('scale', Math.min(36, Math.abs(v) * 0.9).toFixed(1));
    requestAnimationFrame(velLoop);
  };
  if (!reduceMotion) requestAnimationFrame(velLoop);

  const scrollToTarget = (target) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    flashCut();
    scrollToTarget(target);
  }));

  /* ---------- Hero: the reel plays inside the letters ---------- */
  const heroCanvas = $('#heroType');
  const heroVideo = $('#heroVideo');
  const hctx = heroCanvas.getContext('2d');
  const LETTERS = ['O', 'M', 'I', 'D'];
  let cw = 1, ch = 1, fontSize = 100, baseW = LETTERS.map(() => 1);
  let scales = LETTERS.map(() => 1);
  let pointerX = null;
  let hover = 0;
  let vScale = 1;
  const FONT = (s) => `800 ${s}px "Bricolage Grotesque", Arial, sans-serif`;

  const sizeHero = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cw = heroCanvas.clientWidth || 1;
    hctx.font = FONT(100);
    const total100 = LETTERS.reduce((s, l) => s + hctx.measureText(l).width, 0);
    fontSize = (cw / total100) * 100 * 0.995;
    hctx.font = FONT(fontSize);
    baseW = LETTERS.map((l) => hctx.measureText(l).width);
    // the canvas fills the free height of the hero; letters stretch vertically to match
    ch = Math.max(Math.round(fontSize * 0.76), heroCanvas.clientHeight || 0);
    vScale = Math.min(cw < 600 ? 4.5 : 2.4, ch / (fontSize * 0.74));
    heroCanvas.width = Math.round(cw * dpr);
    heroCanvas.height = Math.round(ch * dpr);
    hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const drawLetters = (color, dx = 0) => {
    hctx.fillStyle = color;
    hctx.font = FONT(fontSize);
    hctx.textBaseline = 'alphabetic';
    const total = baseW.reduce((s, w, i) => s + w * scales[i], 0);
    let x = (cw - total) / 2 + dx;
    LETTERS.forEach((l, i) => {
      hctx.save();
      hctx.translate(x, ch * 0.995);
      hctx.scale(scales[i], vScale);
      hctx.fillText(l, 0, 0);
      hctx.restore();
      x += baseW[i] * scales[i];
    });
  };

  const drawHero = () => {
    // letters near the cursor stretch, the others give way so the word keeps its width
    const total = baseW.reduce((s, w) => s + w, 0);
    let x = (cw - total) / 2;
    const want = LETTERS.map((_, i) => {
      const centre = x + baseW[i] / 2;
      x += baseW[i];
      return pointerX === null ? 1 : 1 + 0.45 * Math.exp(-(((pointerX - centre) / (cw * 0.12)) ** 2));
    });
    const norm = total / baseW.reduce((s, w, i) => s + w * want[i], 0);
    scales = scales.map((s, i) => s + (want[i] * norm - s) * 0.14);

    hctx.globalCompositeOperation = 'source-over';
    hctx.clearRect(0, 0, cw, ch);
    drawLetters('#0e0e0e');
    if (heroVideo.readyState >= 2) {
      hctx.globalCompositeOperation = 'source-in';
      const vw = heroVideo.videoWidth, vh = heroVideo.videoHeight;
      const s = Math.max(cw / vw, ch / vh);
      hctx.drawImage(heroVideo, (cw - vw * s) / 2, (ch - vh * s) / 2, vw * s, vh * s);
    }
    // chroma fringes behind the letters, driven by hover and scroll speed
    const split = hover * 6 + Math.min(14, Math.abs(shownVel) * 0.5);
    if (split > 0.3) {
      hctx.globalCompositeOperation = 'destination-over';
      hctx.globalAlpha = 0.85;
      drawLetters('#ff1e3c', -split);
      drawLetters('#00c8ff', split);
      hctx.globalAlpha = 1;
    }
    requestAnimationFrame(drawHero);
  };
  const startHero = () => { sizeHero(); requestAnimationFrame(drawHero); };
  (document.fonts ? document.fonts.load(FONT(100)) : Promise.resolve()).then(startHero, startHero);
  addEventListener('resize', sizeHero);
  heroVideo.play().catch(() => {});
  heroCanvas.addEventListener('pointermove', (e) => {
    const r = heroCanvas.getBoundingClientRect();
    pointerX = e.clientX - r.left;
    hover = Math.min(1, hover + 0.08);
  });
  heroCanvas.addEventListener('pointerleave', () => { pointerX = null; });
  setInterval(() => { if (pointerX === null) hover *= 0.85; }, 50);
  // click = jump cut to a new moment of the reel
  heroCanvas.addEventListener('click', () => {
    flashCut();
    if (heroVideo.duration) heroVideo.currentTime = (heroVideo.currentTime + 1.6) % heroVideo.duration;
  });

  /* ---------- Karaoke statement ---------- */
  const karaoke = $('#karaoke');
  const HOT = ['beat,', 'track.'];
  karaoke.innerHTML = karaoke.textContent.trim().split(/\s+/)
    .map((w) => `<span class="w${HOT.includes(w) ? ' is-hot' : ''}">${w}</span>`).join(' ');
  const kWords = $$('.w', karaoke);
  const karaokeLoop = () => {
    const r = karaoke.getBoundingClientRect();
    const p = clamp((innerHeight * 0.8 - r.top) / (r.height + innerHeight * 0.3), 0, 1);
    const n = p * kWords.length;
    kWords.forEach((w, i) => w.style.setProperty('--f', clamp(n - i, 0, 1).toFixed(3)));
  };
  addEventListener('scroll', karaokeLoop, { passive: true });
  if (lenis) lenis.on('scroll', karaokeLoop);
  karaokeLoop();

  /* ---------- Slice-glitch reveal for big titles ---------- */
  const SLICES = 7;
  $$('.slice').forEach((el) => {
    const text = el.textContent.trim();
    el.innerHTML = `<span class="slice__text">${text}</span>` + Array.from({ length: SLICES }, (_, i) => {
      const top = (i / SLICES) * 100, bottom = 100 - ((i + 1) / SLICES) * 100;
      return `<span class="slice__part" aria-hidden="true" style="clip-path: inset(${top}% 0 ${bottom}% 0)">${text}</span>`;
    }).join('');
    el.classList.add('is-slicing');
  });
  const sliceIn = (el) => {
    if (reduceMotion) { el.classList.remove('is-slicing'); return; }
    $$('.slice__part', el).forEach((p, i) => {
      const off = (Math.random() - 0.5) * 30;
      p.animate([
        { transform: `translateX(${off}%)`, color: i % 2 ? '#ff3d00' : '#0e0e0e', opacity: 0 },
        { transform: `translateX(${-off * 0.4}%)`, opacity: 1, offset: 0.4 },
        { transform: `translateX(${off * 0.15}%)`, offset: 0.7 },
        { transform: 'none', color: '#0e0e0e' },
      ], { duration: 560, delay: i * 25, easing: 'steps(6)', fill: 'both' });
    });
    sfx.transition('glitch');
    setTimeout(() => el.classList.remove('is-slicing'), 560 + SLICES * 25 + 40);
  };
  const sliceIO = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    sliceIn(e.target);
    sliceIO.unobserve(e.target);
  }), { rootMargin: '0px 0px -15% 0px' });
  $$('.slice').forEach((el) => sliceIO.observe(el));

  /* ---------- Contact: the words drop on the beat ---------- */
  const beats = $$('#contactTitle .beat');
  const beatIO = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    beatIO.disconnect();
    beats.forEach((b, i) => setTimeout(() => {
      b.classList.add('is-in');
      if (i === beats.length - 1) flashCut(); else sfx.kick();
    }, reduceMotion ? 0 : i * 280));
  }, { threshold: 0.4 });
  beatIO.observe($('#contactTitle'));

  /* ---------- Credits marquee: repeat for a seamless loop ---------- */
  const cBox = $('.credits__marquee');
  const cTrack = $('.credits__track');
  for (let i = 1; i < Math.max(2, Math.ceil((cBox.offsetWidth * 2) / Math.max(1, cTrack.offsetWidth))); i++) {
    const c = cTrack.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    cBox.append(c);
  }

  /* ---------- Sound toggle + UI sounds ---------- */
  const soundBtn = $('#soundToggle');
  const syncSound = () => { soundBtn.classList.toggle('is-on', sfx.enabled); soundBtn.setAttribute('aria-pressed', String(sfx.enabled)); };
  soundBtn.addEventListener('click', () => { sfx.ensure(); sfx.enabled = !sfx.enabled; syncSound(); });
  syncSound();
  let lastHovered = null;
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest('[data-sfx]');
    if (el === lastHovered) return;
    lastHovered = el;
    if (el && e.pointerType === 'mouse') sfx.hover();
  });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-sfx]')) sfx.click(); });

  /* ---------- Services: play the video inside the title on hover ---------- */
  $$('.service').forEach((row) => {
    const v = $('video', row);
    row.addEventListener('mouseenter', () => { v.play().catch(() => {}); });
    row.addEventListener('mouseleave', () => v.pause());
    row.addEventListener('click', () => scrollToTarget($('#contact')));
  });

  /* ---------- Projects: previews, filters, lightbox ---------- */
  const projects = $$('.project');
  const attachPreview = (p) => {
    const src = p.dataset.preview;
    if (!src) return null;
    let v = $('video', p);
    if (!v) {
      v = document.createElement('video');
      Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'none' });
      v.setAttribute('muted', '');
      v.src = src;
      v.addEventListener('playing', () => p.classList.add('is-playing'));
      $('.project__media', p).append(v);
    }
    return v;
  };
  const play = (p) => { const v = attachPreview(p); if (v) v.play().catch(() => {}); };
  const stop = (p) => { const v = $('video', p); if (v) { v.pause(); p.classList.remove('is-playing'); } };
  projects.forEach((p) => {
    const img = $('img', p);
    img.addEventListener('error', () => {
      if (p.dataset.yt && !img.src.includes('hqdefault')) img.src = `https://img.youtube.com/vi/${p.dataset.yt}/hqdefault.jpg`;
    }, { once: true });
  });
  if (finePointer) {
    projects.forEach((p) => { p.addEventListener('mouseenter', () => play(p)); p.addEventListener('mouseleave', () => stop(p)); });
  } else {
    const tio = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? play(e.target) : stop(e.target))), { rootMargin: '-35% 0px -35% 0px' });
    projects.forEach((p) => tio.observe(p));
  }

  const grid = $('#projects');
  $$('.filter').forEach((btn) => btn.addEventListener('click', () => {
    $$('.filter').forEach((b) => b.classList.toggle('is-active', b === btn));
    const f = btn.dataset.filter;
    grid.classList.toggle('is-filtered', f !== 'all');
    projects.forEach((p) => p.classList.toggle('is-out', f !== 'all' && p.dataset.cat !== f));
    flashCut(false);
    lenis?.resize();
  }));

  const lb = $('#lightbox');
  const lbFrame = $('#lbFrame');
  const lbExternal = $('#lbExternal');
  let lastFocus = null;
  const openLightbox = (p) => {
    lastFocus = document.activeElement;
    const title = $('h3', p).textContent;
    $('#lbTitle').textContent = title;
    $('#lbTags').textContent = $('.project__info p', p).textContent;
    if (p.dataset.yt) {
      lbFrame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${p.dataset.yt}?autoplay=1&rel=0&modestbranding=1" title="${title}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      lbExternal.href = `https://www.youtube.com/watch?v=${p.dataset.yt}`;
      lbExternal.hidden = false;
    } else {
      lbFrame.innerHTML = `<video src="${p.dataset.video}" autoplay loop playsinline controls></video>`;
      lbExternal.hidden = !p.dataset.link;
      if (p.dataset.link) lbExternal.href = p.dataset.link;
    }
    projects.forEach(stop);
    lb.hidden = false;
    lenis?.stop();
    document.body.style.overflow = 'hidden';
    $('#lbClose').focus();
  };
  const closeLightbox = () => {
    lb.hidden = true;
    lbFrame.innerHTML = '';
    lenis?.start();
    document.body.style.overflow = '';
    sfx.whoosh(false);
    if (lastFocus) lastFocus.focus();
  };
  projects.forEach((p) => {
    p.tabIndex = 0;
    p.setAttribute('role', 'button');
    p.setAttribute('aria-label', `Play ${$('h3', p).textContent}`);
    p.addEventListener('click', () => openLightbox(p));
    p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(p); } });
  });
  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lbCta').addEventListener('click', closeLightbox);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) closeLightbox(); });

  /* ---------- Sticky CTA + copy email ---------- */
  const sticky = $('#stickyCta');
  const hero = $('#hero');
  const contact = $('#contact');
  const toggleSticky = () => {
    sticky.classList.toggle('is-on', hero.getBoundingClientRect().bottom < innerHeight * 0.4 && contact.getBoundingClientRect().top > innerHeight * 0.9);
  };
  addEventListener('scroll', toggleSticky, { passive: true });
  toggleSticky();

  $('#copyMail').addEventListener('click', async () => {
    const state = $('#copyState');
    try { await navigator.clipboard.writeText(EMAIL); state.textContent = 'copied'; } catch { location.href = `mailto:${EMAIL}`; }
    setTimeout(() => { state.textContent = 'copy'; }, 2000);
  });
})();
