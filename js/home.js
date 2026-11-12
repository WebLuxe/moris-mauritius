/* =========================================================
   MORIS — home page choreography
   intro (orbit dive → portal) · hero wordmark · greetings
   photo ribbons · 3D island · particle morph · globe
   postcard deck · quote
   ========================================================= */
(() => {
  const HW = window.HW;
  const { $, $$, reduce } = HW;
  const heroVideo = $('#heroVideo');
  const intro = $('#intro');
  const letters = $$('#heroWord span');

  /* ---------------- INTRO ---------------- */
  let introApi = null, introResolve;
  const introReady = new Promise(r => (introResolve = r));
  HW.registerIntro = api => { introApi = api; introResolve(api); };

  const firstVisit = !(HW.arrived || HW.store.get('mu-intro') === '1');

  function heroIn(delay = 0) {
    heroVideo.play().catch(() => {});
    gsap.fromTo(letters, { yPercent: 115, rotate: 6 }, { yPercent: 0, rotate: 0, duration: 1.3, stagger: 0.05, ease: 'expo.out', delay });
    gsap.from('#heroTop, #heroBottom', { y: 30, autoAlpha: 0, duration: 1, stagger: 0.1, ease: 'expo.out', delay: delay + 0.35 });
    gsap.from('#heroSticker', { scale: 0, rotate: -90, duration: 1.2, ease: 'back.out(1.6)', delay: delay + 0.5 });
    gsap.fromTo('#heroMedia', { scale: 1.25 }, { scale: 1.08, duration: 2.2, ease: 'expo.out', delay });
  }

  function finish() {
    intro && intro.remove();
    HW.store.set('mu-intro', '1');
    HW.onReady(initScroll);
    HW.fireReady();
  }

  if (!firstVisit || reduce) {
    intro && intro.remove();
    gsap.set(letters, { yPercent: 115 });
    const start = () => { heroIn(0.05); HW.onReady(initScroll); HW.fireReady(); };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => (HW.arrived && !reduce ? HW.revealPage(start) : start()));
    // free the intro's 3D context if the module still loads
    introReady.then(api => api.dispose());
  } else {
    gsap.set(letters, { yPercent: 115 });
    runIntro();
  }

  function runIntro() {
    const pct = $('#introPct'), bar = $('#introBar'), status = $('#introStatus');
    const st = { p: 0 };
    const render = () => { pct.textContent = Math.round(st.p) + '%'; bar.style.transform = `scaleX(${st.p / 100})`; };
    let skipped = false;
    $('#introSkip').addEventListener('click', () => { skipped = true; portal(true); });

    const tasks = [
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise(r => { if (heroVideo.readyState >= 3) return r(); heroVideo.addEventListener('canplay', r, { once: true }); heroVideo.addEventListener('error', r, { once: true }); setTimeout(r, 4000); }),
      Promise.race([introReady, new Promise(r => setTimeout(r, 4500))])
    ];
    heroVideo.load();
    let done = 0;
    tasks.forEach(t => t.then(() => { done++; gsap.to(st, { p: (done / tasks.length) * 100, duration: 0.6, onUpdate: render, overwrite: true }); }));
    gsap.from('.intro__tl, .intro__tr, .intro__bl', { autoAlpha: 0, y: 10, duration: 0.8, stagger: 0.12, delay: 0.1 });

    Promise.all([Promise.all(tasks), new Promise(r => setTimeout(r, 900))]).then(async () => {
      if (skipped) return;
      status.textContent = 'Locked on';
      gsap.to('.intro__bl, .intro__bar', { autoAlpha: 0, duration: 0.4 });
      const lat = $('#introLat'), lon = $('#introLon'), alt = $('#introAlt');
      const dms = (v, pos, neg, pad) => { const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60); return String(d).padStart(pad, '0') + '°' + String(m).padStart(2, '0') + '′' + (v >= 0 ? pos : neg); };
      const hud = k => {
        const e = 1 - Math.pow(1 - k, 3);
        lat.textContent = dms(18 + (-20.28 - 18) * e, 'N', 'S', 2);
        lon.textContent = dms(15 + (57.55 - 15) * e, 'E', 'W', 3);
        alt.textContent = Math.max(0, Math.round(35786 * Math.pow(1 - k, 2.4))).toLocaleString('en-US');
      };
      if (introApi) {
        gsap.to('#introReticle', { autoAlpha: 1, scale: 0.6, duration: 1.2, delay: 1.6, ease: 'expo.out' });
        let opened = false;
        await introApi.dive(3.4, k => {
          hud(k);
          const pos = HW.introPos;
          if (pos) { intro.style.setProperty('--px', pos.x + '%'); intro.style.setProperty('--py', pos.y + '%'); $('#introReticle').style.left = pos.x + '%'; $('#introReticle').style.top = pos.y + '%'; }
          if (k > 0.8 && !opened) { opened = true; portal(false); }
        });
      } else {
        // no WebGL: a typographic countdown, then open from the centre
        const o = { k: 0 };
        gsap.to('#introTitle span', { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.05, ease: 'expo.out' });
        await gsap.to(o, { k: 1, duration: 1.6, ease: 'power2.inOut', onUpdate: () => hud(o.k) });
        portal(false);
      }
    });

    let portalled = false;
    function portal(fast) {
      if (portalled) return; portalled = true;
      const r = { v: 0 };
      const max = Math.hypot(innerWidth, innerHeight) * 1.1;
      heroIn(fast ? 0 : 0.25);
      gsap.to('.intro__hud', { autoAlpha: 0, duration: 0.35 });
      gsap.to(r, { v: max, duration: fast ? 0.7 : 1.15, ease: 'expo.in', onUpdate: () => intro.style.setProperty('--hole', r.v + 'px'),
        onComplete: () => { introApi && introApi.dispose(); finish(); } });
    }
  }
  gsap.set('#introTitle span', { autoAlpha: 0, y: 40 });

  /* ---------------- SCROLL SCENES ---------------- */
  function initScroll() {
    // greetings + photo ribbons drift; scroll speed pushes them
    const mq = gsap.to('#greet', { xPercent: -50, ease: 'none', duration: reduce ? 120 : 38, repeat: -1 });
    const ra = gsap.fromTo('#ribbonA', { xPercent: 0 }, { xPercent: -50, ease: 'none', duration: 60, repeat: -1 });
    const rb = gsap.fromTo('#ribbonB', { xPercent: -50 }, { xPercent: 0, ease: 'none', duration: 60, repeat: -1 });
    HW.lenis.on('scroll', ({ velocity }) => {
      const b = 1 + Math.min(Math.abs(velocity) * 0.25, 6);
      [mq, ra, rb].forEach(t => gsap.to(t, { timeScale: b, duration: 0.4, overwrite: true }));
    });
    // duplicate ribbon content for a seamless loop
    ['#ribbonA', '#ribbonB'].forEach(s => { const r = $(s); r.innerHTML += r.innerHTML; });
    if (reduce) { gsap.set([$$('[data-cap]')[0], $$('[data-mcap]')[0]], { autoAlpha: 1 }); HW.globe = 1; return; }

    // HERO: the wordmark breaks apart as you scroll away
    const mid = (letters.length - 1) / 2;
    gsap.timeline({ scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 0.6, onUpdate: s => (HW.hero = s.progress) } })
      .to(letters, { yPercent: i => -40 - Math.abs(i - mid) * 18, xPercent: i => (i - mid) * 22, rotate: i => (i - mid) * 5, ease: 'none' }, 0)
      .to('#heroMedia', { scale: 1.22, ease: 'none' }, 0)
      .to('#heroBottom, #heroTop', { autoAlpha: 0, y: -40, ease: 'none' }, 0)
      .to('#heroSticker', { rotate: 180, y: -120, ease: 'none' }, 0);
    gsap.fromTo('.ribbons__title span', { scale: 0.6, rotate: -12 }, { scale: 1, rotate: -3, ease: 'back.out(2)', duration: 1, scrollTrigger: { trigger: '#ribbons', start: 'top 70%' } });

    // THE REEL: pinned; each clip opens from a circle, giant word punches in
    const slides = $$('.reel__slide'), rvids = $$('.reel__slide video'), rcount = $('#reelCount');
    const playOnly = idx => rvids.forEach((v, i) => {
      if (i === idx || i === idx + 1) { if (v.preload === 'none') v.preload = 'auto'; if (i === idx) v.play().catch(() => {}); }
      else v.pause();
    });
    const rt = gsap.timeline({ scrollTrigger: { trigger: '#reel', start: 'top top', end: '+=' + (slides.length * 85) + '%', scrub: 0.7, pin: true, anticipatePin: 1,
      onEnter: () => playOnly(0), onEnterBack: () => playOnly(0), onLeave: () => rvids.forEach(v => v.pause()), onLeaveBack: () => rvids.forEach(v => v.pause()),
      onUpdate: s => { const i = Math.min(slides.length - 1, Math.floor(s.progress * slides.length * 0.999)); if (i !== rt._i) { rt._i = i; playOnly(i); rcount.textContent = '0' + (i + 1) + ' / 0' + slides.length; } } } });
    const masks = $$('.reel__mask');
    gsap.set(masks.slice(1), { scale: 0 });
    rt.fromTo($('.reel__word', slides[0]), { scale: 1.25, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, 0);
    slides.slice(1).forEach((sl, k) => {
      const at = k + 0.6;
      rt.to($('.reel__word', slides[k]), { scale: 0.75, autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, at)
        .to(masks[k + 1], { scale: 1, duration: 1, ease: 'power2.inOut' }, at)
        .fromTo($('.reel__word', sl), { scale: 1.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, at + 0.45);
    });
    rt.to({}, { duration: 0.5 });

    // 3D ISLAND
    const caps = $$('[data-cap]'), bars = $$('.hud__steps b'), scene = $('#hudScene');
    gsap.timeline({ scrollTrigger: { trigger: '#island3d', start: 'top top', end: '+=330%', scrub: 1, pin: true, anticipatePin: 1,
      onUpdate: s => { HW.island = s.progress; bars.forEach((b, i) => (b.style.transform = `scaleX(${gsap.utils.clamp(0, 1, s.progress * 3 - i)})`)); scene.textContent = '0' + Math.min(3, 1 + Math.floor(s.progress * 3)); } } })
      .fromTo(caps[0], { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.07 }, 0.04)
      .to(caps[0], { autoAlpha: 0, y: -60, duration: 0.07 }, 0.27)
      .fromTo(caps[1], { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.07 }, 0.36)
      .to(caps[1], { autoAlpha: 0, y: -60, duration: 0.07 }, 0.58)
      .fromTo(caps[2], { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.07 }, 0.75)
      .to({}, { duration: 0.18 }, 0.82);

    // PARTICLE MORPH
    const mcaps = $$('[data-mcap]'), idx = $('#morphIdx');
    const M = (HW.morph = { p: 0, flag: 0 });
    gsap.timeline({ scrollTrigger: { trigger: '#morph', start: 'top top', end: '+=400%', scrub: 1, pin: true, anticipatePin: 1,
      onUpdate: () => (idx.textContent = '0' + Math.min(4, 1 + Math.round(M.p + M.flag * 0.01)) + ' / 04') } })
      .fromTo(mcaps[0], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 0)
      .to(mcaps[0], { autoAlpha: 0, y: -40, duration: 0.3 }, 0.9)
      .to(M, { p: 1, duration: 1, ease: 'power1.inOut' }, 1)
      .fromTo(mcaps[1], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 1.8)
      .to(mcaps[1], { autoAlpha: 0, y: -40, duration: 0.3 }, 2.6)
      .to(M, { p: 2, duration: 1, ease: 'power1.inOut' }, 2.7)
      .fromTo(mcaps[2], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 3.5)
      .to(mcaps[2], { autoAlpha: 0, y: -40, duration: 0.3 }, 4.3)
      .to(M, { p: 2.999, duration: 1, ease: 'power1.inOut' }, 4.4)
      .to(M, { flag: 1, duration: 0.6 }, 4.9)
      .fromTo(mcaps[3], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 5.3)
      .to({}, { duration: 0.6 }, 5.6);

    // GLOBE
    ScrollTrigger.create({ trigger: '#globe', start: 'top top', end: '+=150%', pin: true, scrub: true, anticipatePin: 1, onUpdate: s => (HW.globe = s.progress) });
    gsap.from('.globe__text > *', { y: 40, autoAlpha: 0, duration: 1, stagger: 0.07, ease: 'expo.out', scrollTrigger: { trigger: '#globe', start: 'top 70%' } });

    // POSTCARD DECK: each card is tossed off the top of the pile
    const cards = $$('.pc'), count = $('#deckCount');
    cards.forEach((c, i) => gsap.set(c, { zIndex: cards.length - i, rotate: (i % 2 ? 1 : -1) * (2 + i * 1.3), y: i * 6, x: i * 4 }));
    const dt = gsap.timeline({ scrollTrigger: { trigger: '#deck', start: 'top top', end: '+=' + (cards.length * 60) + '%', scrub: 0.8, pin: true, anticipatePin: 1,
      onUpdate: s => (count.textContent = String(Math.min(cards.length, 1 + Math.floor(s.progress * cards.length))).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0')) } });
    cards.slice(0, -1).forEach((c, i) => {
      dt.to(c, { x: (i % 2 ? 1 : -1) * innerWidth * 0.9, y: -innerHeight * 0.25, rotate: (i % 2 ? 1 : -1) * 28, ease: 'power2.in', duration: 1 }, i)
        .to(cards[i + 1], { rotate: 0, x: 0, y: 0, duration: 0.6, ease: 'power2.out' }, i + 0.45);
    });
    dt.to({}, { duration: 0.6 });

    // QUOTE
    gsap.to(HW.splitWords($('#quote')), { opacity: 1, stagger: 0.06, ease: 'none', scrollTrigger: { trigger: '.quote', start: 'top 70%', end: 'center 45%', scrub: true } });

    // CTA parallax
    gsap.fromTo('.cta video', { yPercent: -10, scale: 1.15 }, { yPercent: 10, scale: 1, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });

    ScrollTrigger.refresh();
  }
})();
