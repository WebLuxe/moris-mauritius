// =========================================================
// MORIS — particle morph (three.js)
// Glowing particles flow between four shapes as you scroll:
//   MAURITIUS  →  the real island outline  →  a dodo  →  the four-band flag
// Shapes are drawn on a hidden 2D canvas and sampled into points.
// The canvas is landscape on wide screens and portrait on phones, so the
// shapes always fill the screen. Progress: HW.morph = { p: 0..3, flag: 0..1 }.
// =========================================================
import * as THREE from 'three';

const HW = (window.HW = window.HW || {});
const section = document.getElementById('morph');
const canvas = document.getElementById('morphCanvas');
const COUNT = HW.tier === 'low' ? 7500 : 12000;

async function init() {
  if (document.fonts) { try { await document.fonts.load('800 100px "Bricolage Grotesque"'); } catch (e) {} }
  const portrait = section.clientWidth / section.clientHeight < 0.85;
  const W = portrait ? 900 : 1600, H = portrait ? 1600 : 900;
  const UW = portrait ? 9 : 16, UH = portrait ? 16 : 9;     // world units covered by the canvas

  function sample(draw) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.fillStyle = '#fff';
    draw(g);
    const d = g.getImageData(0, 0, W, H).data, pts = [];
    for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) if (d[(y * W + x) * 4 + 3] > 128) pts.push(x, y);
    const out = new Float32Array(COUNT * 3), n = pts.length / 2;
    for (let i = 0; i < COUNT; i++) {
      const k = Math.floor(Math.random() * n) * 2;
      out[i * 3] = ((pts[k] + Math.random() * 3) / W - 0.5) * UW;
      out[i * 3 + 1] = -((pts[k + 1] + Math.random() * 3) / H - 0.5) * UH;
      out[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    return out;
  }
  const font = s => `800 ${s}px "Bricolage Grotesque", system-ui, sans-serif`;
  function drawText(g) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = portrait ? ['MAURI', 'TIUS'] : ['MAURITIUS'];
    let size = portrait ? 420 : 260;
    g.font = font(size);
    while (Math.max(...lines.map(l => g.measureText(l).width)) > W * 0.94 && size > 60) { size -= 8; g.font = font(size); }
    lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * size * 0.92));
  }
  function drawIsland(g) {                       // real coastline (km) from mu-geo.js
    const o = window.MU_GEO && MU_GEO.outline;
    if (!o) { g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.3, H * 0.4, 0, 0, Math.PI * 2); g.fill(); return; }
    const k = Math.min((H * 0.9) / 62, (W * 0.92) / 54);
    g.beginPath();
    o.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, W / 2 + x * k, H / 2 - y * k));
    g.closePath(); g.fill();
  }
  function drawDodo(g) {                         // an original, stylised dodo silhouette (facing left)
    const s = portrait ? 1.25 : 1;
    g.save(); g.translate(W / 2 + 20 * s, H / 2 + 10 * s); g.scale(s, s);
    const e = (x, y, rx, ry, r = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, r, 0, Math.PI * 2); g.fill(); };
    e(60, 40, 230, 175, -0.12); e(-150, -150, 80, 72);
    g.beginPath(); g.moveTo(-210, -110); g.quadraticCurveTo(-120, -20, -40, -40); g.lineTo(-80, -170); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-200, -185); g.quadraticCurveTo(-330, -190, -360, -130); g.quadraticCurveTo(-370, -95, -335, -98);
    g.quadraticCurveTo(-320, -130, -280, -128); g.quadraticCurveTo(-240, -110, -190, -118); g.closePath(); g.fill();
    [[250, -90, 0.6], [280, -50, 0.3], [265, -130, 0.9]].forEach(([x, y, r]) => e(x, y, 60, 22, r));
    e(170, 60, 70, 34, -0.6);
    g.fillRect(-20, 190, 28, 110); g.fillRect(70, 190, 28, 110); e(-20, 300, 46, 14); e(90, 300, 46, 14);
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(-165, -165, 13, 0, Math.PI * 2); g.fill();
    g.restore(); g.globalCompositeOperation = 'source-over';
  }
  const FLAG = portrait ? { w: 820, h: 1000 } : { w: 1120, h: 660 };
  function drawFlag(g) { g.fillRect(W / 2 - FLAG.w / 2, H / 2 - FLAG.h / 2, FLAG.w, FLAG.h); }

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { return; }
  renderer.setPixelRatio(HW.dpr || 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  const shapes = [drawText, drawIsland, drawDodo, drawFlag].map(sample);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(shapes[0].slice(), 3));
  shapes.forEach((s, i) => geo.setAttribute('p' + i, new THREE.BufferAttribute(s, 3)));
  const rnd = new Float32Array(COUNT), col = new Float32Array(COUNT * 3), flag = new Float32Array(COUNT * 3);
  const tints = ['#62e3d2', '#9ff3e6', '#ffffff', '#3cc9e8', '#ffd38a'].map(c => new THREE.Color(c));
  const bands = ['#ff3346', '#4a58ff', '#ffd500', '#14c46a'].map(c => new THREE.Color(c));
  const top = (FLAG.h / 2 / H) * UH;            // flag spans +top .. -top in world units
  for (let i = 0; i < COUNT; i++) {
    rnd[i] = Math.random();
    const t = tints[Math.floor(Math.random() * tints.length)]; col.set([t.r, t.g, t.b], i * 3);
    const y = shapes[3][i * 3 + 1];
    const b = bands[Math.min(3, Math.max(0, Math.floor((top - y) / (2 * top) * 4)))]; flag.set([b.r, b.g, b.b], i * 3);
  }
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aFlag', new THREE.BufferAttribute(flag, 3));

  const uniforms = { uProg: { value: 0 }, uFlag: { value: 0 }, uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uSize: { value: portrait ? 1.25 : 1 }, uMouse: { value: new THREE.Vector2(99, 99) } };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 p0, p1, p2, p3; attribute float aRand; attribute vec3 aCol, aFlag;
      uniform float uProg, uFlag, uTime, uPR, uSize; uniform vec2 uMouse;
      varying vec3 vCol; varying float vA;
      void main(){
        vec3 a, b; float t;
        if (uProg < 1.0) { a = p0; b = p1; t = uProg; } else if (uProg < 2.0) { a = p1; b = p2; t = uProg - 1.0; } else { a = p2; b = p3; t = uProg - 2.0; }
        float tt = smoothstep(aRand * 0.45, aRand * 0.45 + 0.55, t);
        vec3 pos = mix(a, b, tt);
        float mid = sin(tt * 3.14159);
        pos.z += mid * (aRand - 0.5) * 7.0;
        pos.xy += mid * vec2(sin(aRand * 40.0 + uTime * 0.8), cos(aRand * 31.0 + uTime * 0.7)) * 1.4;
        pos += vec3(sin(uTime * 1.3 + aRand * 60.0), cos(uTime * 1.1 + aRand * 50.0), sin(uTime + aRand * 20.0)) * 0.025;
        vec2 dm = pos.xy - uMouse; pos.xy += normalize(dm + 1e-4) * smoothstep(1.4, 0.0, length(dm)) * 0.7;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = (2.8 + aRand * 3.4) * uSize * uPR * (12.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
        vCol = mix(aCol, aFlag, uFlag);
        vA = 0.75 + 0.25 * sin(uTime * 2.0 + aRand * 80.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vCol * (1.0 + 0.6 * smoothstep(0.25, 0.0, d)), a * vA); }`
  }));
  scene.add(points);

  function resize() {
    const w = section.clientWidth, h = section.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const tan = 2 * Math.tan(THREE.MathUtils.degToRad(22.5));
    camera.position.set(0, 0, Math.max((UH + 0.6) / tan, (UW + 0.6) / camera.aspect / tan));
    camera.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  section.addEventListener('pointermove', e => {
    const r = section.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) uniforms.uMouse.value.set(hit.x, hit.y);
  });
  section.addEventListener('pointerleave', () => uniforms.uMouse.value.set(99, 99));

  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '100px' }).observe(section);
  renderer.compile(scene, camera);
  section.classList.add('is-gl');
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible) return;
    uniforms.uTime.value += dt;
    const m = HW.morph || { p: 0, flag: 0 };
    uniforms.uProg.value += (Math.min(2.999, m.p) - uniforms.uProg.value) * 0.1;
    uniforms.uFlag.value += (m.flag - uniforms.uFlag.value) * 0.1;
    points.rotation.y = Math.sin(uniforms.uTime.value * 0.2) * 0.08;
    renderer.render(scene, camera);
  });
}

if (section && canvas) (HW.whenNear ? HW.whenNear(section, init, '200% 0px') : init());
