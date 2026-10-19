(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const EMAIL = 'editedbyomidd@gmail.com';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const sfx = window.sfx;
  // Always start at the top so the intro and the hero morph play from the beginning.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) scrollTo(0, 0);

  /* ---------- Text splitting ---------- */
  // Letter roll: each character gets a clipped box; its text-shadow is the copy that rolls in.
  $$('.roll, .roll-big').forEach((el) => {
    let i = 0;
    el.innerHTML = el.textContent.trim().split(' ').map((word) =>
      `<span class="wd">${[...word].map((ch) => `<span class="c" style="--i:${i++}"><span>${ch}</span></span>`).join('')}</span>`
    ).join(' ');
    el.setAttribute('aria-label', el.textContent);
  });
  // Word-by-word reveal for big headings.
  $$('.split-lines').forEach((el) => {
    el.innerHTML = el.textContent.trim().split(' ').map((w, i) => `<span class="w"><span style="--i:${i}">${w}</span></span>`).join(' ');
  });

  /* ---------- Loader ---------- */
  const loader = $('#loader');
  const reel = $('#reelSrc');
  const start = performance.now();
  const MIN_MS = reduceMotion ? 0 : 1100;
  const MAX_MS = 3000;
  let assetsReady = false;
  Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((res) => (reel.readyState >= 3 ? res() : reel.addEventListener('canplay', res, { once: true }))),
  ]).then(() => { assetsReady = true; });

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(meter);
    $('#loaderCount').textContent = '100';
    $('#loaderBar').style.width = '100%';
    setTimeout(() => {
      loader.classList.add('is-done');
      document.body.classList.remove('is-loading');
      window.siteReady = true;
      dispatchEvent(new Event('site:ready'));
      $$('.hero .split-lines').forEach((el) => el.classList.add('in'));
      setTimeout(() => loader.remove(), 1200);
    }, 250);
  };
  const meter = setInterval(() => {
    const elapsed = performance.now() - start;
    if (assetsReady && elapsed >= MIN_MS) return finish();
    const p = Math.min(92, (elapsed / MAX_MS) * 100);
    $('#loaderCount').textContent = String(Math.round(p)).padStart(3, '0');
    $('#loaderBar').style.width = `${p}%`;
  }, 40);
  setTimeout(finish, MAX_MS);

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const scrollToTarget = (target) => {
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(target);
  }));

  /* ---------- Reveals ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('.reveal, .split-lines').forEach((el) => { if (!el.closest('.hero')) io.observe(el); });

  /* ---------- Services lines slide with scroll ---------- */
  const lines = $$('.services__line');
  const services = $('#services');
  // Repeat each line so it's always wider than the screen.
  lines.forEach((l) => { l.textContent = l.textContent.repeat(4); });
  const moveLines = () => {
    const r = services.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const p = (innerHeight - r.top) / (innerHeight + r.height);
    lines.forEach((l) => {
      const dir = Number(l.dataset.dir);
      l.style.transform = `translate3d(${(dir > 0 ? -50 : -10) + dir * p * 30}%, 0, 0)`;
    });
  };
  addEventListener('scroll', moveLines, { passive: true });
  moveLines();

  // Logo turns light while it sits over the dark services block.
  const nav = $('#nav');
  const navTone = () => {
    const r = services.getBoundingClientRect();
    nav.classList.toggle('on-dark', r.top < 40 && r.bottom > 40);
  };
  addEventListener('scroll', navTone, { passive: true });
  navTone();

  /* ---------- Menu ---------- */
  const menu = $('#menu');
  const menuBtn = $('#menuBtn');
  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
    sfx.whoosh(false);
  }
  menuBtn.addEventListener('click', () => {
    if (menu.hidden) {
      menu.hidden = false;
      menuBtn.setAttribute('aria-expanded', 'true');
      sfx.whoosh(true);
    } else closeMenu();
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !e.target.closest('#menu, #menuBtn')) closeMenu();
  });

  /* ---------- Sound ---------- */
  const soundBtn = $('#soundToggle');
  const syncSound = () => {
    soundBtn.classList.toggle('is-on', sfx.enabled);
    soundBtn.setAttribute('aria-pressed', String(sfx.enabled));
  };
  soundBtn.addEventListener('click', () => {
    sfx.ensure();
    sfx.enabled = !sfx.enabled;
    syncSound();
  });
  syncSound();

  // Hover ticks on anything interactive, a soft click on press.
  let lastHovered = null;
  document.addEventListener('pointerover', (e) => {
    // project cards get their own focus sound from project-fx.js
    const el = e.target.closest('[data-sfx], .services__list li');
    if (el === lastHovered) return;
    lastHovered = el;
    if (el && e.pointerType === 'mouse') sfx.hover();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-sfx], .project')) sfx.click();
  });

  /* ---------- Projects: hover previews ---------- */
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

  // Caption decodes from random characters on hover.
  const scramble = (el) => {
    const text = el.dataset.text || (el.dataset.text = el.textContent);
    const start = performance.now();
    cancelAnimationFrame(el._raf);
    const tick = (now) => {
      const shown = Math.floor((now - start) / 22);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        if (i < shown - 4 || text[i] === ' ') out += text[i];
        else if (i < shown) out += String.fromCharCode(33 + Math.floor(Math.random() * 93));
        else out += ' ';
      }
      el.textContent = out;
      if (shown - 4 < text.length) el._raf = requestAnimationFrame(tick);
      else el.textContent = text;
    };
    el._raf = requestAnimationFrame(tick);
  };
  if (finePointer) projects.forEach((p) => p.addEventListener('mouseenter', () => scramble($('.project__tags', p))));

  projects.forEach((p) => {
    const img = $('img', p);
    img.addEventListener('error', () => {
      if (p.dataset.yt && !img.src.includes('hqdefault')) img.src = `https://img.youtube.com/vi/${p.dataset.yt}/hqdefault.jpg`;
    }, { once: true });
  });
  if (finePointer) {
    projects.forEach((p) => {
      p.addEventListener('mouseenter', () => play(p));
      p.addEventListener('mouseleave', () => stop(p));
    });
  } else {
    const tio = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? play(e.target) : stop(e.target)));
    }, { rootMargin: '-35% 0px -35% 0px' });
    projects.forEach((p) => tio.observe(p));
  }

  /* ---------- Lightbox ---------- */
  const lb = $('#lightbox');
  const lbFrame = $('#lbFrame');
  const lbExternal = $('#lbExternal');
  let lastFocus = null;
  const openLightbox = (p) => {
    lastFocus = document.activeElement;
    const title = $('.project__name', p).getAttribute('aria-label');
    $('#lbTitle').textContent = title;
    $('#lbTags').textContent = $('.project__tags', p).textContent;
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
    requestAnimationFrame(() => lb.classList.add('is-open'));
    lenis?.stop();
    document.body.style.overflow = 'hidden';
    sfx.whoosh(true);
    $('#lbClose').focus();
  };
  const closeLightbox = () => {
    lb.classList.remove('is-open');
    lenis?.start();
    document.body.style.overflow = '';
    sfx.whoosh(false);
    setTimeout(() => { lb.hidden = true; lbFrame.innerHTML = ''; }, 450);
    if (lastFocus) lastFocus.focus();
  };
  projects.forEach((p) => {
    p.tabIndex = 0;
    p.setAttribute('role', 'button');
    p.setAttribute('aria-label', `Play ${$('.project__name', p).getAttribute('aria-label')}`);
    p.addEventListener('click', () => openLightbox(p));
    p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(p); } });
  });
  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lbCta').addEventListener('click', closeLightbox);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!lb.hidden) closeLightbox();
    closeMenu();
  });

  /* ---------- Hero caption under the video frame ---------- */
  const hero = $('#hero');
  const caption = $('#heroCaption');
  const placeCaption = () => {
    const f = window.heroFrame;
    if (f && f.h) caption.style.setProperty('--cap-top', `${f.y + f.h + 22}px`);
    const p = parseFloat(getComputedStyle(hero).getPropertyValue('--p')) || 0;
    caption.classList.toggle('is-live', p > 0.7);
  };
  addEventListener('scroll', placeCaption, { passive: true });
  addEventListener('resize', placeCaption);
  setTimeout(placeCaption, 500);

  /* ---------- Credits marquee: repeat for a seamless loop ---------- */
  const creditsBox = $('.credits__marquee');
  const creditsTrack = $('.credits__track');
  const copies = Math.max(2, Math.ceil((creditsBox.offsetWidth * 2) / Math.max(1, creditsTrack.offsetWidth)));
  for (let i = 1; i < copies; i++) {
    const c = creditsTrack.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    creditsBox.append(c);
  }

  /* ---------- Filters ---------- */
  const grid = $('#projects');
  $$('.filter').forEach((btn) => btn.addEventListener('click', () => {
    $$('.filter').forEach((b) => b.classList.toggle('is-active', b === btn));
    const f = btn.dataset.filter;
    grid.classList.toggle('is-filtered', f !== 'all');
    projects.forEach((p) => p.classList.toggle('is-out', f !== 'all' && p.dataset.cat !== f));
    lenis?.resize();
  }));

  /* ---------- Services: preview follows the pointer ---------- */
  const sp = $('#servicePreview');
  const spVideo = $('video', sp);
  if (finePointer) {
    $$('.service').forEach((row) => {
      row.addEventListener('mouseenter', () => {
        if (!spVideo.src.endsWith(row.dataset.preview)) spVideo.src = row.dataset.preview;
        spVideo.play().catch(() => {});
        sp.classList.add('is-on');
      });
      row.addEventListener('mouseleave', () => { sp.classList.remove('is-on'); spVideo.pause(); });
      row.addEventListener('mousemove', (e) => {
        sp.style.transform = `translate(${e.clientX + 30}px, ${e.clientY - 100}px)`;
      });
    });
  }

  /* ---------- Mobile sticky CTA: after the hero, hidden near contact ---------- */
  const sticky = $('#stickyCta');
  const contactEl = $('#contact');
  const toggleSticky = () => {
    const past = hero.getBoundingClientRect().bottom < innerHeight * 0.5;
    const nearContact = contactEl.getBoundingClientRect().top < innerHeight * 0.9;
    sticky.classList.toggle('is-on', past && !nearContact);
  };
  addEventListener('scroll', toggleSticky, { passive: true });
  toggleSticky();

  /* ---------- Copy email ---------- */
  $('#copyMail').addEventListener('click', async () => {
    const state = $('#copyState');
    try {
      await navigator.clipboard.writeText(EMAIL);
      state.textContent = 'copied';
    } catch {
      location.href = `mailto:${EMAIL}`;
    }
    setTimeout(() => { state.textContent = 'copy'; }, 2000);
  });
})();
