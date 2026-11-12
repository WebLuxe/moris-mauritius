/* =========================================================
   MORIS — shared core (loaded on every page)
   device tier · smooth scroll · liquid-wave page transitions
   topographic paper texture · scroll progress · nav
   live island clock + weather · procedural ocean sound
   mobile video swap · lazy 3D mounting · modal · reveals
   Page scripts register work with HW.onReady(fn).
   ========================================================= */
(() => {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
  const store = {
    get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { sessionStorage.removeItem(k); } catch (e) {} }
  };
  const HW = (window.HW = window.HW || {});
  Object.assign(HW, { $, $$, reduce, isTouch, store });

  /* ---------------- Device tier ----------------
     Budget GPUs (e.g. Adreno 6xx, older Mali) get lighter 3D: lower
     resolution, fewer particles/vertices, no hero shader.
     Override with ?tier=high or ?tier=low for testing. */
  (() => {
    let gpu = '';
    try {
      const c = document.createElement('canvas').getContext('webgl');
      const e = c && c.getExtension('WEBGL_debug_renderer_info');
      gpu = e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '';
      const l = c && c.getExtension('WEBGL_lose_context'); l && l.loseContext();
    } catch (e) {}
    const weakGpu = /Adreno \(TM\) [1-6]\d\d|Mali-[GT]?[1-7]\d\b|Mali-4|PowerVR|SwiftShader|llvmpipe|Intel.*HD Graphics [1-5]/i.test(gpu);
    const weakDevice = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    const q = new URLSearchParams(location.search).get('tier');
    HW.gpu = gpu;
    HW.tier = q || (weakGpu || (isTouch && weakDevice) ? 'low' : 'high');
    HW.dpr = HW.tier === 'low' ? 1 : Math.min(devicePixelRatio || 1, 1.75);
    document.documentElement.dataset.tier = HW.tier;
  })();

  /* ---------------- Smooth scroll ---------------- */
  const lenis = new Lenis({ lerp: reduce ? 1 : 0.09, smoothWheel: !reduce, wheelMultiplier: 0.9 });
  HW.lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  lenis.on('scroll', ({ velocity }) => (HW.velocity = velocity));
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ---------------- Ready pipeline ---------------- */
  const readyFns = [];
  HW.onReady = fn => (HW.isReady ? fn() : readyFns.push(fn));
  HW.fireReady = () => {
    if (HW.isReady) return;
    HW.isReady = true;
    document.body.classList.remove('is-loading');
    lenis.start();
    readyFns.forEach(f => f());
    initReveals();
    ScrollTrigger.refresh();
    if (location.hash && $(location.hash)) setTimeout(() => lenis.scrollTo(location.hash, { offset: -90, duration: 1.6 }), 250);
  };

  /* ---------------- Lazy 3D mounting ----------------
     Build a WebGL scene shortly before its section scrolls into view,
     in an idle slot, so shader compiles don't stutter the scroll. */
  HW.whenNear = (el, fn, margin = '160% 0px') => {
    if (!el) return;
    const idle = window.requestIdleCallback || (f => setTimeout(f, 60));
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); idle(() => fn(), { timeout: 500 }); } }, { rootMargin: margin });
    io.observe(el);
  };

  /* ---------------- Mobile video swap ----------------
     Phones get 640px encodes (~6× smaller). Videos may use data-src
     (hero) or src; both are rewritten before playback starts. */
  const small = HW.tier === 'low' || innerWidth < 820;
  $$('video').forEach(v => {
    let src = v.getAttribute('data-src') || v.getAttribute('src');
    if (!src) return;
    if (small && src.includes('assets/mu/video/') && !src.includes('/m/')) src = src.replace('assets/mu/video/', 'assets/mu/video/m/');
    if (v.getAttribute('src') !== src) v.setAttribute('src', src);
  });

  /* ---------------- Topographic paper texture ----------------
     Contour lines drawn with marching squares over tileable noise,
     set as a background tile once the page is idle. */
  (window.requestIdleCallback || (f => setTimeout(f, 200)))(() => {
    const S = 700, G = 70, cell = S / G;
    const P = 7; // noise period (tileable)
    const h = (x, y) => { x = ((x % P) + P) % P; y = ((y % P) + P) % P; const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    const n = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      return h(ix, iy) * (1 - u) * (1 - v) + h(ix + 1, iy) * u * (1 - v) + h(ix, iy + 1) * (1 - u) * v + h(ix + 1, iy + 1) * u * v; };
    const f = (x, y) => n(x, y) * 0.7 + n(x * 2, y * 2) * 0.3;
    const v = new Float32Array((G + 1) * (G + 1));
    for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) v[j * (G + 1) + i] = f(i / G * P, j / G * P);
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.lineWidth = 1.1; g.strokeStyle = 'rgba(15,33,41,0.075)';
    for (let lv = 0.18; lv < 0.95; lv += 0.055) {
      g.beginPath();
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const a = v[j * (G + 1) + i], b = v[j * (G + 1) + i + 1], cc = v[(j + 1) * (G + 1) + i + 1], d = v[(j + 1) * (G + 1) + i];
        const pts = [];
        const edge = (p, q, x1, y1, x2, y2) => { if ((p < lv) !== (q < lv)) { const t = (lv - p) / (q - p); pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]); } };
        const x = i * cell, y = j * cell;
        edge(a, b, x, y, x + cell, y); edge(b, cc, x + cell, y, x + cell, y + cell);
        edge(cc, d, x + cell, y + cell, x, y + cell); edge(d, a, x, y + cell, x, y);
        for (let k = 0; k + 1 < pts.length; k += 2) { g.moveTo(pts[k][0], pts[k][1]); g.lineTo(pts[k + 1][0], pts[k + 1][1]); }
      }
      g.stroke();
    }
    c.toBlob(b => b && document.documentElement.style.setProperty('--topo', `url(${URL.createObjectURL(b)})`));
  });

  /* ---------------- Liquid-wave page transitions ---------------- */
  const PAGES = {
    'index.html': ['Mauritius', '20°15′S · 57°33′E'],
    'explore.html': ['Explore', 'Le Morne · 20°27′S 57°19′E'],
    'heritage.html': ['Heritage', 'Port Louis · 20°09′S 57°30′E'],
    'experiences.html': ['Experiences', 'Blue Bay · 20°26′S 57°43′E'],
    'plan.html': ['Plan your trip', 'Plaine Magnien · 20°25′S 57°41′E']
  };
  const pageOf = href => (href.split('#')[0].split('/').pop() || 'index.html');
  const pt = document.createElement('div');
  pt.className = 'pt';
  pt.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path class="pt__w1"/><path class="pt__w2"/></svg><div class="pt__label"><div class="pt__name"></div><div class="pt__coords"></div></div>';
  document.body.appendChild(pt);
  const w1 = $('.pt__w1', pt), w2 = $('.pt__w2', pt), label = $('.pt__label', pt);
  const setLabel = file => { const [n, c] = PAGES[file] || PAGES['index.html']; $('.pt__name', pt).textContent = n; $('.pt__coords', pt).textContent = c; };
  // edge of a wave at progress p (0..1): y goes 100 → -30 with a living crest
  function wavePath(p, t, phase, below) {
    const base = 100 - p * 130, amp = 7 * Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
    let d = below ? 'M0 100 ' : 'M0 0 ';
    for (let x = 0; x <= 100; x += 4) {
      const y = base + amp * Math.sin(x * 0.075 + t * 4.2 + phase) + amp * 0.35 * Math.sin(x * 0.21 - t * 2.6 + phase * 2);
      d += `L${x} ${y.toFixed(2)} `;
    }
    return d + (below ? 'L100 100 Z' : 'L100 0 Z');
  }
  function drawWaves(p, below) {
    const t = performance.now() / 1000;
    const p1 = below ? Math.min(1, p * 1.15) : Math.min(1, p * 1.15);
    const p2 = Math.max(0, Math.min(1, p * 1.15 - 0.15));
    // leaving: lagoon leads, deep follows; arriving: deep leaves first, lagoon trails
    w1.setAttribute('d', wavePath(below ? p1 : p2, t, 0, below));
    w2.setAttribute('d', wavePath(below ? p2 : p1, t, 2.1, below));
  }
  const arriving = store.get('hw-pt') === '1';
  store.del('hw-pt');
  HW.arrived = arriving;
  if (arriving && !reduce) { gsap.set(pt, { visibility: 'visible' }); setLabel(pageOf(location.pathname)); gsap.set(label, { opacity: 1 }); drawWaves(0, false); }

  function revealPage(cb) {
    setLabel(pageOf(location.pathname));
    gsap.set(pt, { visibility: 'visible' });
    const s = { p: 0 };
    gsap.timeline({ onComplete: () => { gsap.set(pt, { visibility: 'hidden' }); cb && cb(); } })
      .to(label, { opacity: 0, y: -30, duration: 0.45, ease: 'power2.in' }, 0.15)
      .to(s, { p: 1, duration: 1.15, ease: 'power2.inOut', onUpdate: () => drawWaves(s.p, false) }, 0.2);
  }
  function leave(href) {
    store.set('hw-pt', '1');
    lenis.stop();
    setLabel(pageOf(href));
    gsap.set(pt, { visibility: 'visible' });
    gsap.set(label, { opacity: 0, y: 30 });
    const s = { p: 0 };
    gsap.timeline({ onComplete: () => (location.href = href) })
      .to(s, { p: 1, duration: 1.0, ease: 'power2.inOut', onUpdate: () => drawWaves(s.p, true) }, 0)
      .to(label, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, 0.65)
      .to({}, { duration: 0.15 });
  }
  HW.revealPage = revealPage;
  HW.leave = leave;

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented) return;
    const href = a.getAttribute('href');
    if (a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (href.startsWith('#')) {
      e.preventDefault(); closeMenu();
      if (href === '#') return;
      if (href === '#top') return lenis.scrollTo(0, { duration: 1.6 });
      if ($(href)) lenis.scrollTo(href, { offset: -90, duration: 1.8 });
      return;
    }
    if (/^(https?:|mailto:|tel:)/.test(href)) return;
    const [path, hash] = href.split('#');
    const here = pageOf(location.pathname);
    if ((path || 'index.html') === here) {
      e.preventDefault(); closeMenu();
      return hash ? lenis.scrollTo('#' + hash, { offset: -90, duration: 1.8 }) : lenis.scrollTo(0, { duration: 1.6 });
    }
    e.preventDefault(); closeMenu();
    reduce ? (location.href = href) : leave(href);
  });
  addEventListener('pageshow', e => { if (e.persisted) { gsap.set(pt, { visibility: 'hidden' }); lenis.start(); } });

  document.addEventListener('DOMContentLoaded', () => {
    if ($('#intro')) return; // home handles its own intro
    const go = () => (arriving && !reduce ? revealPage(HW.fireReady) : HW.fireReady());
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(go);
  });

  /* ---------------- Scroll progress ---------------- */
  const prog = document.createElement('div');
  prog.className = 'progress';
  document.body.appendChild(prog);
  lenis.on('scroll', ({ progress }) => (prog.style.transform = `scaleX(${progress || 0})`));

  /* ---------------- Nav ---------------- */
  const nav = $('#nav');
  const page = document.body.dataset.page;
  $$('[data-nav]').forEach(a => a.classList.toggle('is-active', a.dataset.nav === page));
  let lastY = 0;
  lenis.on('scroll', ({ scroll }) => {
    if (!nav) return;
    nav.classList.toggle('is-solid', scroll > 60);
    if (!nav.classList.contains('menu-open')) nav.classList.toggle('is-hidden', scroll > lastY && scroll > 400);
    lastY = scroll;
  });
  function closeMenu() { if (nav && nav.classList.contains('menu-open')) { nav.classList.remove('menu-open'); lenis.start(); } }
  const burger = $('#burger');
  burger && burger.addEventListener('click', () => {
    const open = nav.classList.toggle('menu-open');
    open ? lenis.stop() : lenis.start();
    if (open) gsap.fromTo('#menu a', { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: 0.06, duration: 0.8, ease: 'expo.out', delay: 0.25 });
  });

  /* ---------------- Live island clock + weather ----------------
     Time is computed locally (Mauritius = UTC+4, no DST). Temperature
     comes from the free Open-Meteo API (only the island's coordinates are sent). */
  const live = $$('[data-live]');
  if (live.length) {
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Indian/Mauritius' });
    const tick = () => live.forEach(l => { const t = $('[data-live-time]', l); if (t) t.textContent = fmt.format(new Date()); });
    tick(); setInterval(tick, 15000);
    const codes = c => (c === 0 ? 'Clear' : c <= 2 ? 'Sunny spells' : c === 3 ? 'Cloudy' : c < 50 ? 'Hazy' : c < 70 ? 'Showers' : c < 90 ? 'Rain' : 'Storms');
    const paint = d => live.forEach(l => {
      const t = $('[data-live-temp]', l), w = $('[data-live-wx]', l);
      if (t) t.textContent = Math.round(d.t) + '°C';
      if (w) w.textContent = codes(d.c);
      l.classList.add('has-wx');
    });
    const cached = store.get('mu-wx');
    if (cached) paint(JSON.parse(cached));
    else fetch('https://api.open-meteo.com/v1/forecast?latitude=-20.16&longitude=57.5&current=temperature_2m,weather_code')
      .then(r => r.json()).then(j => { const d = { t: j.current.temperature_2m, c: j.current.weather_code }; store.set('mu-wx', JSON.stringify(d)); paint(d); })
      .catch(() => {});
  }

  /* ---------------- Procedural ocean sound ---------------- */
  const sndBtn = $('#sound');
  let audio = null;
  function startOcean() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const swell = ctx.createGain(); swell.gain.value = 0.35;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lg = ctx.createGain(); lg.gain.value = 0.28; lfo.connect(lg).connect(swell.gain);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.13; const lg2 = ctx.createGain(); lg2.gain.value = 300; lfo2.connect(lg2).connect(lp.frequency);
    const master = ctx.createGain(); master.gain.value = 0;
    src.connect(lp).connect(swell).connect(master).connect(ctx.destination);
    src.start(); lfo.start(); lfo2.start();
    master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2);
    return { ctx, master };
  }
  function setSound(on) {
    if (!sndBtn) return;
    sndBtn.classList.toggle('is-on', on); sndBtn.setAttribute('aria-pressed', on);
    if (on) { if (!audio) audio = startOcean(); else { audio.ctx.resume(); audio.master.gain.cancelScheduledValues(audio.ctx.currentTime); audio.master.gain.linearRampToValueAtTime(0.5, audio.ctx.currentTime + 1.2); } }
    else if (audio) { audio.master.gain.cancelScheduledValues(audio.ctx.currentTime); audio.master.gain.linearRampToValueAtTime(0, audio.ctx.currentTime + 0.8); }
    store.set('mu-sound', on ? '1' : '0');
  }
  if (sndBtn) {
    sndBtn.addEventListener('click', () => setSound(!sndBtn.classList.contains('is-on')));
    if (store.get('mu-sound') === '1') {
      sndBtn.classList.add('is-armed');
      const resume = () => { setSound(true); sndBtn.classList.remove('is-armed'); };
      addEventListener('pointerdown', resume, { once: true }); addEventListener('keydown', resume, { once: true });
    }
  }

  /* ---------------- Modal ---------------- */
  const modal = $('#modal'), box = $('#modalBox');
  function openModal(html) { $$('video, img', box).forEach(n => n.remove()); box.insertAdjacentHTML('beforeend', html); modal.classList.add('is-open'); lenis.stop(); }
  function closeModal() { if (!modal.classList.contains('is-open')) return; modal.classList.remove('is-open'); const v = $('video', box); if (v) v.pause(); lenis.start(); }
  HW.openModal = openModal;
  if (modal) {
    document.addEventListener('click', e => {
      const v = e.target.closest('[data-video]'), i = e.target.closest('[data-image]');
      if (v) openModal(`<video src="${v.dataset.video}" controls autoplay playsinline></video>`);
      else if (i) openModal(`<img src="${i.dataset.image}" alt="">`);
    });
    $('#modalClose').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }

  /* ---------------- Videos: play only on screen ---------------- */
  const vio = new IntersectionObserver(entries => entries.forEach(({ target: v, isIntersecting }) => {
    if (isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
  }), { rootMargin: '200px 200px' });
  $$('video[data-autoplay]').forEach(v => vio.observe(v));

  /* ---------------- Living photos ----------------
     Every content photo gets a slow drift animation that only runs on screen. */
  if (!reduce) {
    const kio = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-on', e.isIntersecting)), { rootMargin: '80px' });
    $$('main img, .pc img').forEach((img, i) => {
      if (img.closest('.nav, .sticker, .dodo__art') || img.width && img.width < 60) return;
      if (HW.tier === 'low' && img.closest('.food__img')) return; // big image + weak GPU: keep still
      img.classList.add('kb', 'kb--' + (1 + (i % 4)));
      img.style.animationDelay = (-(i * 3.7) % 20) + 's';
      kio.observe(img);
    });
  }

  /* ---------------- Text helpers ---------------- */
  HW.splitWords = el => { el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' '); return $$('.w', el); };
  HW.splitChars = el => { const t = el.textContent; el.innerHTML = [...t].map(c => `<span class="c" style="display:inline-block">${c === ' ' ? '&nbsp;' : c}</span>`).join(''); return $$('.c', el); };

  /* ---------------- Generic reveals ---------------- */
  function initReveals() {
    if (reduce) return;
    $$('[data-reveal]').forEach(el => {
      const type = el.dataset.reveal, st = { trigger: el, start: 'top 88%' };
      if (type === 'lines') gsap.from($$('.split-line > span', el), { yPercent: 110, duration: 1.1, stagger: 0.08, ease: 'expo.out', scrollTrigger: st });
      else if (type === 'stagger') gsap.from(el.children, { y: 40, autoAlpha: 0, duration: 0.9, stagger: 0.07, ease: 'expo.out', scrollTrigger: st });
      else gsap.from(el, { y: 40, autoAlpha: 0, duration: 0.9, ease: 'expo.out', scrollTrigger: st });
    });
    $$('[data-parallax]').forEach(el => {
      const amt = parseFloat(el.dataset.parallax) || 0.12;
      gsap.fromTo(el, { yPercent: -amt * 100 }, { yPercent: amt * 100, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    const fb = $('.footer__big');
    if (fb) {
      const chars = HW.splitChars(fb);
      gsap.from(chars, { yPercent: 105, stagger: 0.04, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: fb, start: 'top 92%' } });
    }
  }

  addEventListener('load', () => ScrollTrigger.refresh());
})();
