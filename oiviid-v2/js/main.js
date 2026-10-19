(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const EMAIL = 'editedbyomidd@gmail.com';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Scroll-driven bits: melting name, statement words, sticky CTA ---------- */
  const root = document.documentElement;
  const hero = $('#hero');
  const sticky = $('#stickyCta');
  const contact = $('#contact');

  // Split the statement into words so they can light up one by one.
  const statement = $('#statement');
  [...statement.childNodes].forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return;
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part.trim()) { frag.append(part); return; }
      const w = document.createElement('span');
      w.className = 'w';
      w.textContent = part;
      frag.append(w);
    });
    node.replaceWith(frag);
  });
  const words = $$('.w', statement);

  const onScroll = () => {
    const h = hero.offsetHeight;
    // 1979 = solid, 2050 = fully melted
    root.style.setProperty('--year', Math.round(1979 + clamp(scrollY / (h * 0.75), 0, 1) * 71));

    const r = statement.getBoundingClientRect();
    const p = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35), 0, 1);
    const lit = reduceMotion ? words.length : Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < lit));

    sticky.classList.toggle('is-on', scrollY > innerHeight * 0.8 && contact.getBoundingClientRect().top > innerHeight * 0.5);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Draggable stickers & polaroid ---------- */
  $$('[data-drag]').forEach((el) => {
    let sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      sx = e.clientX; sy = e.clientY; moved = false;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      el.style.translate = `${ox + dx}px ${oy + dy}px`;
    });
    const end = (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      el.releasePointerCapture(e.pointerId);
      el.classList.remove('is-dragging');
      ox += e.clientX - sx; oy += e.clientY - sy;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // A drag shouldn't count as a click (the round sticker is a link).
    el.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  });

  /* ---------- Tapes: repeat the track until it covers twice the band, for a seamless loop ---------- */
  $$('.tape').forEach((tape) => {
    const track = $('.tape__track', tape);
    const copies = Math.max(2, Math.ceil((tape.offsetWidth * 2) / track.offsetWidth));
    for (let i = 1; i < copies; i++) {
      const c = track.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      tape.append(c);
    }
    // Keep the speed constant regardless of how long the track is.
    tape.style.setProperty('--dur', `${track.offsetWidth / 60}s`);
  });

  /* ---------- Contact headline: letters melt on hover ---------- */
  const ct = $('#contactTitle');
  ct.innerHTML = ct.textContent.split('').map((ch) => (ch === ' ' ? ' ' : `<span class="l">${ch}</span>`)).join('');

  /* ---------- Inline clips only play while on screen ---------- */
  const clipIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause()));
  });
  $$('.clip video, .tile__blob video').forEach((v) => { v.pause(); clipIO.observe(v); });

  /* ---------- Cursor label ---------- */
  const cursor = $('#cursor');
  if (finePointer) {
    addEventListener('mousemove', (e) => {
      cursor.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 16}px)`;
    }, { passive: true });
    document.addEventListener('mouseover', (e) => {
      cursor.classList.toggle('is-on', !!e.target.closest('.card'));
    });
  }

  /* ---------- Work cards: previews + tilt ---------- */
  const cards = $$('.card');
  const attachPreview = (card) => {
    const src = card.dataset.preview;
    if (!src) return null;
    let v = $('video', card);
    if (!v) {
      v = document.createElement('video');
      Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'none' });
      v.setAttribute('muted', '');
      v.src = src;
      v.addEventListener('playing', () => card.classList.add('is-playing'));
      $('.card__media', card).append(v);
    }
    return v;
  };
  const playCard = (card) => { const v = attachPreview(card); if (v) v.play().catch(() => {}); };
  const stopCard = (card) => {
    const v = $('video', card);
    if (v) { v.pause(); card.classList.remove('is-playing'); }
  };

  // YouTube maxres thumbnails don't exist for every upload; fall back quietly.
  cards.forEach((card) => {
    const img = $('img', card);
    img.addEventListener('error', () => {
      if (card.dataset.yt && !img.src.includes('hqdefault')) img.src = `https://img.youtube.com/vi/${card.dataset.yt}/hqdefault.jpg`;
    }, { once: true });
  });

  if (finePointer) {
    cards.forEach((card) => {
      card.addEventListener('mouseenter', () => playCard(card));
      card.addEventListener('mouseleave', () => {
        stopCard(card);
        card.style.removeProperty('--tx');
        card.style.removeProperty('--ty');
      });
      if (!reduceMotion) {
        card.addEventListener('mousemove', (e) => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          card.style.setProperty('--ty', `${x * 8}deg`);
          card.style.setProperty('--tx', `${-y * 8}deg`);
        });
      }
    });
  } else {
    const touchIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? playCard(e.target) : stopCard(e.target)));
    }, { rootMargin: '-35% 0px -35% 0px' });
    cards.forEach((c) => touchIO.observe(c));
  }

  /* ---------- Filters ---------- */
  const grid = $('#workGrid');
  $$('.filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.filter').forEach((b) => b.classList.toggle('is-active', b === btn));
      const f = btn.dataset.filter;
      grid.classList.toggle('is-filtered', f !== 'all');
      cards.forEach((card) => card.classList.toggle('is-out', f !== 'all' && card.dataset.cat !== f));
    });
  });

  /* ---------- Lightbox ---------- */
  const lb = $('#lightbox');
  const lbFrame = $('#lbFrame');
  const lbExternal = $('#lbExternal');
  let lastFocus = null;
  const openLightbox = (card) => {
    lastFocus = document.activeElement;
    const title = $('h3', card).textContent;
    $('#lbTitle').textContent = title;
    $('#lbArtist').textContent = $('.card__meta p', card).textContent;
    const yt = card.dataset.yt;
    if (yt) {
      lbFrame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&modestbranding=1" title="${title}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      lbExternal.href = `https://www.youtube.com/watch?v=${yt}`;
      lbExternal.hidden = false;
    } else {
      lbFrame.innerHTML = `<video src="${card.dataset.video}" autoplay loop playsinline controls></video>`;
      lbExternal.hidden = !card.dataset.link;
      if (card.dataset.link) lbExternal.href = card.dataset.link;
    }
    cards.forEach(stopCard);
    cursor.classList.remove('is-on');
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#lbClose').focus();
  };
  const closeLightbox = () => {
    lb.hidden = true;
    lbFrame.innerHTML = '';
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  };
  cards.forEach((card) => {
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Play ${$('h3', card).textContent}, ${$('.card__meta p', card).textContent}`);
    card.addEventListener('click', () => openLightbox(card));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(card); } });
  });
  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lbCta').addEventListener('click', closeLightbox);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) closeLightbox(); });

  /* ---------- Copy email ---------- */
  $('#copyMail').addEventListener('click', async () => {
    const state = $('#copyState');
    try {
      await navigator.clipboard.writeText(EMAIL);
      state.textContent = 'copied!';
    } catch {
      location.href = `mailto:${EMAIL}`;
    }
    setTimeout(() => { state.textContent = 'copy'; }, 2000);
  });
})();
