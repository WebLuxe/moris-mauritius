/* =========================================================
   MORIS — page interactions (runs on every page after core.js)
   Behaviour is picked from <body data-page="…">.
   ========================================================= */
(() => {
  const HW = window.HW;
  const { $, $$, reduce, isTouch } = HW;
  const page = document.body.dataset.page;

  /* ---------- inner-page hero intro ---------- */
  HW.onReady(() => {
    const hero = $('.phero');
    if (!hero || reduce) return;
    gsap.from($$('.phero .split-line > span'), { yPercent: 110, duration: 1.3, stagger: 0.09, ease: 'expo.out' });
    gsap.from($$('.phero .eyebrow, .phero .lede, .phero [data-hero-fade]'), { y: 30, autoAlpha: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out', delay: 0.2 });
    const bg = $('.phero__bg');
    if (bg) {
      gsap.from(bg, { scale: 1.2, duration: 2.2, ease: 'expo.out' });
      gsap.to(bg, { yPercent: 10, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    }
  });

  /* ---------- counters ---------- */
  HW.onReady(() => {
    $$('[data-count]').forEach(el => {
      const end = parseFloat(el.dataset.count), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
      const fmt = v => pre + (el.hasAttribute('data-plain') ? Math.round(v) : Math.round(v).toLocaleString('en-US')) + suf;
      if (reduce) { el.textContent = fmt(end); return; }
      const o = { v: 0 };
      gsap.to(o, { v: end, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' }, onUpdate: () => (el.textContent = fmt(o.v)) });
    });
  });

  /* ---------- sliding pill tabs (filters / itineraries) ---------- */
  function pillTabs(wrap, onChange) {
    const pill = $('.filters__pill', wrap), btns = $$('button', wrap);
    const move = b => { pill.style.width = b.offsetWidth + 'px'; pill.style.transform = `translateX(${b.offsetLeft}px)`; };
    const select = b => { btns.forEach(x => x.classList.toggle('is-active', x === b)); move(b); onChange(b); };
    btns.forEach(b => b.addEventListener('click', () => select(b)));
    const init = () => move($('button.is-active', wrap) || btns[0]);
    requestAnimationFrame(init); addEventListener('resize', init);
    if (document.fonts) document.fonts.ready.then(init);
    return { select, btns };
  }

  /* ---------- video cards play on hover ---------- */
  $$('[data-hover-play]').forEach(card => {
    const v = $('video', card);
    if (!v) return;
    card.addEventListener('mouseenter', () => { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}); });
    card.addEventListener('mouseleave', () => v.pause());
  });

  /* ======================== EXPLORE ======================== */
  if (page === 'explore') {
    const pins = $$('.pin'), items = $$('.place');
    pins.forEach(p => { p.style.left = p.dataset.x + '%'; p.style.top = p.dataset.y + '%'; });
    const activate = (id, scrollList) => {
      pins.forEach(p => p.classList.toggle('is-active', p.dataset.id === id));
      items.forEach(i => i.classList.toggle('is-active', i.id === id));
      if (scrollList) { const it = $('#' + id); if (it) HW.lenis.scrollTo(it, { offset: -innerHeight / 2 + it.offsetHeight / 2, duration: 1.2 }); }
    };
    pins.forEach(p => {
      p.addEventListener('mouseenter', () => activate(p.dataset.id));
      p.addEventListener('click', () => activate(p.dataset.id, true));
    });
    items.forEach(i => {
      i.addEventListener('mouseenter', () => activate(i.id));
      i.addEventListener('click', () => {
        activate(i.id);
        if (innerWidth <= 1024) HW.lenis.scrollTo('#atlasMap', { offset: -90, duration: 1.2 });
      });
    });
    // deep link from home (explore.html#le-morne)
    HW.onReady(() => {
      if (location.hash && $(location.hash) && $(location.hash).classList.contains('place')) activate(location.hash.slice(1));
      if (reduce) return;
      gsap.from('.map', { y: 60, autoAlpha: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: '.atlas', start: 'top 80%' } });
      gsap.fromTo('.pin', { scale: 0 }, { scale: 1, duration: 0.7, stagger: 0.06, ease: 'back.out(3)', delay: 0.4, clearProps: 'transform', scrollTrigger: { trigger: '.atlas', start: 'top 80%' } });
      gsap.from('.place', { y: 40, autoAlpha: 0, duration: 1, stagger: 0.05, ease: 'expo.out', scrollTrigger: { trigger: '.places', start: 'top 85%' } });
      $$('.map__reef').forEach(r => gsap.from(r, { strokeDashoffset: 400, duration: 3, ease: 'power2.out', scrollTrigger: { trigger: '.atlas', start: 'top 80%' } }));
      if (HW.tier !== 'low') $$('.region').forEach(r => {
        gsap.fromTo($('.region__media', r), { clipPath: 'inset(10% 10% 10% 10% round 18px)' }, { clipPath: 'inset(0% 0% 0% 0% round 18px)', ease: 'none', scrollTrigger: { trigger: r, start: 'top 90%', end: 'center 60%', scrub: true } });
        gsap.fromTo($('.region__media > *', r), { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: r, start: 'top bottom', end: 'bottom top', scrub: true } });
        gsap.from($$('.region__text > *', r), { y: 40, autoAlpha: 0, duration: 1, stagger: 0.07, ease: 'expo.out', scrollTrigger: { trigger: r, start: 'top 70%' } });
      });
    });
  }

  /* ====================== EXPERIENCES ====================== */
  if (page === 'experiences') {
    const cards = $$('.card');
    const tabs = pillTabs($('#expFilters'), b => {
      const f = b.dataset.filter;
      const show = cards.filter(c => f === 'all' || c.dataset.type === f);
      gsap.to(cards, { autoAlpha: 0, y: 20, duration: 0.25, onComplete: () => {
        cards.forEach(c => c.classList.toggle('is-hidden', !show.includes(c)));
        gsap.fromTo(show, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.05, ease: 'expo.out', onComplete: () => ScrollTrigger.refresh() });
      } });
    });
    // home links like experiences.html#water preselect a filter
    HW.onReady(() => {
      const h = location.hash.slice(1);
      const b = tabs.btns.find(x => x.dataset.filter === h);
      if (b) { tabs.select(b); setTimeout(() => HW.lenis.scrollTo('#things', { offset: -100, duration: 1.4 }), 300); }
      if (reduce) return;
      gsap.from('.card', { y: 70, autoAlpha: 0, duration: 1.1, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.cards', start: 'top 85%' } });
      if (HW.tier !== 'low') gsap.fromTo('.food__img img', { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.food', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.from('.dish', { x: 40, autoAlpha: 0, duration: 1, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: '.dishes', start: 'top 85%' } });
    });
  }

  /* ========================= PLAN ========================= */
  if (page === 'plan') {
    // itineraries
    pillTabs($('#itinTabs'), b => {
      $$('.itin').forEach(i => i.classList.toggle('is-active', i.id === b.dataset.target));
      const now = $('#' + b.dataset.target);
      if (!reduce) gsap.from($$('.day', now), { y: 24, autoAlpha: 0, duration: 0.6, stagger: 0.05, ease: 'expo.out' });
      ScrollTrigger.refresh();
    });
    // interest chips
    $$('.chip').forEach(c => c.addEventListener('click', () => c.classList.toggle('is-on')));
    // planner form
    const form = $('#planner form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = (form.querySelector('[name=name]').value || '').trim().split(' ')[0];
      $('#doneName').textContent = name ? `Thanks, ${name}!` : 'Thanks!';
      form.classList.add('is-done');
      if (!reduce) gsap.from('.form__done > *', { y: 20, autoAlpha: 0, duration: 0.8, stagger: 0.08, ease: 'expo.out' });
      ScrollTrigger.refresh();
    });
    // FAQ
    $$('.faq__item').forEach(item => {
      const a = $('.faq__a', item);
      $('.faq__q', item).addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        $$('.faq__item.is-open').forEach(o => { if (o !== item) { o.classList.remove('is-open'); gsap.to($('.faq__a', o), { height: 0, duration: 0.5, ease: 'expo.inOut' }); } });
        item.classList.toggle('is-open', open);
        gsap.to(a, { height: open ? 'auto' : 0, duration: 0.6, ease: 'expo.inOut', onComplete: () => ScrollTrigger.refresh() });
      });
    });
    HW.onReady(() => {
      if (reduce) return;
      gsap.from('.month', { y: 40, autoAlpha: 0, duration: 0.9, stagger: 0.04, ease: 'expo.out', scrollTrigger: { trigger: '.months', start: 'top 85%' } });
      gsap.from('.ess', { y: 50, autoAlpha: 0, duration: 1, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.essentials', start: 'top 85%' } });
    });
  }
  /* ======================== HERITAGE ======================== */
  if (page === 'heritage') {
    HW.onReady(() => {
      if (reduce) return;
      // pinned horizontal timeline
      const track = $('#tlTrack');
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      gsap.to(track, { x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: '#timeline', start: 'top top', end: () => '+=' + dist(), scrub: 1, pin: true, invalidateOnRefresh: true, anticipatePin: 1,
          onUpdate: s => ($('#tlLine').style.transform = `scaleX(${s.progress})`) } });
      gsap.from('.era', { y: 80, autoAlpha: 0, duration: 1.2, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '#timeline', start: 'top 60%' } });
      // dodo: pieces pop in, then it bobs gently
      gsap.from('#dodoArt svg > *', { scale: 0.6, autoAlpha: 0, transformOrigin: '50% 50%', duration: 1, stagger: 0.05, ease: 'back.out(2)', scrollTrigger: { trigger: '#dodoArt', start: 'top 75%' } });
      gsap.to('#dodoArt svg', { y: -12, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.from('.dodo__facts > div', { y: 40, autoAlpha: 0, duration: 1, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: '.dodo__facts', start: 'top 88%' } });
      // recovery meters grow
      $$('.cb').forEach(cb => gsap.to($$('.cb__meter i', cb), { scaleY: 1, duration: 1.2, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: cb, start: 'top 80%' } }));
      gsap.from('.cb', { y: 60, autoAlpha: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.comeback', start: 'top 85%' } });
      // stamps fan out on scroll
      gsap.fromTo('.stamp--orange', { rotation: -2, x: 60, y: 30 }, { rotation: -10, x: 0, y: 0, ease: 'none', scrollTrigger: { trigger: '#stamps', start: 'top 90%', end: 'center 40%', scrub: true } });
      gsap.fromTo('.stamp--blue', { rotation: 2, x: -60, y: -10 }, { rotation: 9, x: 0, y: 0, ease: 'none', scrollTrigger: { trigger: '#stamps', start: 'top 90%', end: 'center 40%', scrub: true } });
    });
    if (reduce) $$('.cb__meter i').forEach(i => (i.style.transform = 'none'));
  }
})();
