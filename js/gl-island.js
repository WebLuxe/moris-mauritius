// =========================================================
// MORIS — 3D flyover of Mauritius built from the REAL coastline
//   • signed-distance field of the OSM outline, computed in a Web Worker
//   • terrain with the central plateau, Black River Peak, the Moka range
//     and Le Morne Brabant at their true positions (heights exaggerated)
//   • lagoon + reef ~2 km offshore, wider in the east, none on the south coast
//   • palms on the shore, catamarans, seabirds, clouds, day → golden hour
//   • camera spline driven by ScrollTrigger (HW.island); HUD shows where you look
// Device tiers (HW.tier) scale resolution and object counts for weaker phones.
// =========================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const HW = (window.HW = window.HW || {});
const section = document.getElementById('island3d');
const canvas = document.getElementById('islandCanvas');
const GEO = window.MU_GEO;

const U = 2.4;                 // world units per km
const EXT = 70;                // distance field covers ±70 km
const LAT0 = -20.25, LON0 = 57.55, KX = 111.32 * Math.cos(LAT0 * Math.PI / 180);
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y) { let v = 0, a = 0.5; for (let i = 0; i < 5; i++) { v += a * noise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return v; }

/* ---------- signed distance field of the outline (worker) ---------- */
function buildSDF(outline, N) {
  const src = `onmessage = e => {
    const { pts, N, E } = e.data, n = pts.length / 2, out = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -E + 2 * E * i / (N - 1), y = -E + 2 * E * j / (N - 1);
      let best = 1e9, inside = false;
      for (let k = 0, m = n - 1; k < n; m = k++) {
        const ax = pts[m * 2], ay = pts[m * 2 + 1], bx = pts[k * 2], by = pts[k * 2 + 1];
        if ((by > y) !== (ay > y) && x < (ax - bx) * (y - by) / (ay - by) + bx) inside = !inside;
        const dx = ax - bx, dy = ay - by, l = dx * dx + dy * dy;
        let t = l ? ((x - bx) * dx + (y - by) * dy) / l : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = bx + t * dx - x, qy = by + t * dy - y, d = qx * qx + qy * qy;
        if (d < best) best = d;
      }
      out[j * N + i] = (inside ? -1 : 1) * Math.sqrt(best);
    }
    postMessage(out, [out.buffer]);
  };`;
  return new Promise(res => {
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = e => { res(e.data); w.terminate(); };
    w.postMessage({ pts: new Float32Array(outline.flat()), N, E: EXT });
  });
}

async function init() {
  const low = HW.tier === 'low';
  const Q = low
    ? { grid: 150, seg: 150, palms: 170, birds: 18, clouds: 7, tex: 160, aa: false }
    : { grid: 240, seg: 240, palms: 420, birds: 36, clouds: 13, tex: 256, aa: true };

  const field = await buildSDF(GEO.outline, Q.grid);
  const sd = (x, y) => {            // km in → signed km out (+ = sea)
    const fx = (x + EXT) / (2 * EXT) * (Q.grid - 1), fy = (y + EXT) / (2 * EXT) * (Q.grid - 1);
    if (fx < 0 || fy < 0 || fx >= Q.grid - 1 || fy >= Q.grid - 1) return 40;
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, G = Q.grid;
    const a = field[j * G + i], b = field[j * G + i + 1], c = field[(j + 1) * G + i], d = field[(j + 1) * G + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  const P = GEO.places;
  const bump = (x, y, p, sig, amp) => amp * Math.exp(-((x - p[0]) ** 2 + (y - p[1]) ** 2) / (2 * sig * sig));
  const MOKA = [P['port-louis'][0] + 4, P['port-louis'][1] - 4];
  function height(x, y) {         // km in → world units out
    const s = sd(x, y);
    if (s > 0) return -3;
    const land = smooth(0, -4, s);
    let h = 0.6 + land * (1.2 + fbm(x * 0.09 + 3, y * 0.09 + 7) * 5.5);
    h += land * bump(x, y, P.curepipe, 9, 6.5);                // central plateau
    h += land * bump(x, y, P['black-river-peak'], 2.6, 8.5);    // Black River Peak (828 m)
    h += land * bump(x, y, MOKA, 2.2, 6);                       // Moka range / Pieter Both
    h += land * bump(x, y, [P.mahebourg[0] - 3, P.mahebourg[1] + 3], 2, 3.5);
    const dm = Math.hypot(x - P['le-morne'][0] - 0.3, y - P['le-morne'][1] - 0.2);
    h += 8.5 * smooth(2.1, 0.9, dm) + 4.5 * smooth(3.6, 1.6, dm); // Le Morne Brabant (flat-topped monolith)
    return h;
  }
  const reefOff = x => 2.2 + smooth(8, 16, x) * 1.6;           // wider lagoons on the east coast
  const southGap = (x, y) => smooth(-23, -25.5, y) * smooth(-12, -8, x) * smooth(16, 12, x);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.aa, powerPreference: 'high-performance' }); }
  catch (e) { return; }
  renderer.setPixelRatio(HW.dpr || 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const HORIZON = new THREE.Color('#dff1f2');
  scene.fog = new THREE.Fog(HORIZON, 260, 950);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 3000);
  const time = { value: 0 };
  const SUN = new THREE.Vector3(0.55, 0.5, -0.65).normalize();
  const SUN_DAY = SUN.clone(), SUN_SET = new THREE.Vector3(-0.78, 0.07, -0.62).normalize();
  const SKY_TOP = new THREE.Color('#3f9fdc'), WSKY = new THREE.Color('#bfe3f5');
  const PAL = {
    hDay: new THREE.Color('#dff1f2'), hSet: new THREE.Color('#ffb98a'), tDay: new THREE.Color('#3f9fdc'), tSet: new THREE.Color('#5a4f9c'),
    wDay: new THREE.Color('#bfe3f5'), wSet: new THREE.Color('#ffc7a1'), sDay: new THREE.Color('#fff1d6'), sSet: new THREE.Color('#ff9b5c'),
    hemiDay: new THREE.Color('#d6f1ff'), hemiSet: new THREE.Color('#ffd0b5')
  };
  const warm = { value: 0 };

  /* sky */
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1600, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN }, uTop: { value: SKY_TOP }, uH: { value: HORIZON }, uWarm: warm },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 uSun, uTop, uH; uniform float uWarm; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); vec3 c = mix(uH, uTop, pow(smoothstep(-0.02, 0.6, d.y), 0.7));
        float s = max(dot(d, uSun), 0.0);
        c += vec3(1.0, 0.92, 0.75) * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.18) + vec3(1.0, 0.5, 0.25) * pow(s, 5.0) * 0.55 * uWarm;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  })));
  const hemi = new THREE.HemisphereLight(0xd6f1ff, 0xe8d3a5, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2); sun.position.copy(SUN).multiplyScalar(200); scene.add(sun);

  /* terrain from the real outline */
  const SIZE = 2 * 66 * U;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, Q.seg, Q.seg).rotateX(-Math.PI / 2);
  const pos = tg.attributes.position, cols = new Float32Array(pos.count * 3);
  const SAND = new THREE.Color('#f2e2b6'), CANE = new THREE.Color('#9cc965'), G1 = new THREE.Color('#2f7d43'), G2 = new THREE.Color('#5d9e4c'), FOREST = new THREE.Color('#1f5e36'), ROCK = new THREE.Color('#5d6253');
  const EARTH = [new THREE.Color('#b8565f'), new THREE.Color('#8f5a8c'), new THREE.Color('#d48b54')];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const X = pos.getX(i), Z = pos.getZ(i), x = X / U, y = -Z / U;
    const h = height(x, y), s = sd(x, y);
    pos.setY(i, h);
    if (s > -0.45 && h < 2.2) c.copy(SAND);
    else if (h > 11 || Math.hypot(x - P['le-morne'][0], y - P['le-morne'][1]) < 1.1) c.copy(ROCK).lerp(G1, smooth(16, 9, h) * 0.4);
    else {
      c.copy(G1).lerp(G2, fbm(x * 0.4, y * 0.4));
      if (x < -6 && y < -6) c.lerp(FOREST, 0.6);                              // native forest of the south-west
      else if (noise(x * 0.35 + 40, y * 0.35) > 0.5 && h < 8) c.lerp(CANE, 0.75); // sugar cane fields
    }
    if (Math.hypot(x - P.chamarel[0] - 0.4, y - P.chamarel[1]) < 0.75) c.copy(EARTH[Math.floor(noise(x * 9, y * 9) * 3) % 3]); // Seven Coloured Earth
    cols.set([c.r, c.g, c.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  tg.computeVertexNormals();
  scene.add(new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })));

  /* lagoon map: R = lagoon, G = shallow, B = reef foam */
  const TS = Q.tex, data = new Uint8Array(TS * TS * 4);
  for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) {
    const x = -EXT + 2 * EXT * i / (TS - 1), y = EXT - 2 * EXT * j / (TS - 1);
    const s = sd(x, y), ro = reefOff(x), gap = 1 - southGap(x, y);
    const a = Math.atan2(y, x), pass = smooth(0.22, 0.32, noise(Math.cos(a) * 4 + 20, Math.sin(a) * 4 + 20));
    const k = (j * TS + i) * 4;
    data[k] = 255 * smooth(ro + 0.6, ro - 0.2, s) * gap;
    data[k + 1] = 255 * smooth(1.3, 0, s);
    data[k + 2] = 255 * smooth(ro - 0.45, ro + 0.05, s) * smooth(ro + 0.9, ro + 0.35, s) * gap * pass;
    data[k + 3] = 255;
  }
  const lagoonTex = new THREE.DataTexture(data, TS, TS);
  lagoonTex.magFilter = lagoonTex.minFilter = THREE.LinearFilter; lagoonTex.needsUpdate = true;

  const WEXT = EXT * U;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uTime: time, uTex: { value: lagoonTex }, uSun: { value: SUN }, uExt: { value: WEXT },
      uDeep: { value: new THREE.Color('#0a3f7a') }, uMid: { value: new THREE.Color('#1a78bd') }, uLag: { value: new THREE.Color('#1fc6bd') },
      uShal: { value: new THREE.Color('#a8f0de') }, uSky: { value: WSKY }, uH: { value: HORIZON } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime, uExt; uniform sampler2D uTex; uniform vec3 uSun, uDeep, uMid, uLag, uShal, uSky, uH; varying vec3 vW;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1,0)), u.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), u.x), u.y); }
      void main(){
        vec2 uv = vec2((vW.x + uExt) / (2.0 * uExt), (vW.z + uExt) / (2.0 * uExt));
        vec4 m = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture2D(uTex, uv);
        float dist = length(cameraPosition - vW);
        float calm = mix(1.0, 0.25, m.r) * smoothstep(420.0, 60.0, dist) * 0.7;
        vec2 p = vW.xz; float t = uTime;
        float dx = (cos(p.x*0.11 + t*1.1)*0.5 + cos((p.x+p.y)*0.21 + t*1.7)*0.3 + cos(p.y*0.37 - t*2.1)*0.2) * calm * 0.35;
        float dz = (cos(p.y*0.09 + t*0.9)*0.5 + cos((p.x-p.y)*0.17 + t*1.3)*0.3 + cos(p.x*0.43 + t*2.4)*0.2) * calm * 0.35;
        vec3 n = normalize(vec3(dx, 1.0, dz)); vec3 v = normalize(cameraPosition - vW);
        vec3 col = mix(uDeep, uMid, smoothstep(600.0, 80.0, dist) * 0.6);
        col = mix(col, uLag, m.r); col = mix(col, uShal, m.g * 0.9);
        float ca = n2(p * 0.6 + vec2(t * 0.4, t * 0.3)) * n2(p * 0.9 - vec2(t * 0.3, t * 0.5));
        col += vec3(0.9, 1.0, 1.0) * ca * 0.22 * m.g;
        float foam = m.b * smoothstep(0.45, 0.8, n2(p * 0.5 + vec2(t * 0.7, 0.0)) * 0.6 + n2(p * 1.4 - t) * 0.5);
        float shore = smoothstep(0.9, 0.995, m.g) * (0.55 + 0.45 * sin(t * 2.0 + p.x * 0.3 + p.y * 0.2));
        col = mix(col, vec3(1.0), clamp(foam + shore * 0.8, 0.0, 1.0));
        col = mix(col, uSky, pow(1.0 - max(dot(n, v), 0.0), 5.0) * 0.4);
        col += vec3(1.0, 0.96, 0.88) * pow(max(dot(reflect(-v, n), uSun), 0.0), 420.0) * 1.1;
        col = mix(col, uH, smoothstep(300.0, 1100.0, dist));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  water.position.y = 0.45;
  scene.add(water);

  /* palms on the real shoreline */
  function palmGeo() {
    const H = 3.4, pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector3(Math.sin(t * 1.2) * 0.5, t * H, 0)); }
    const parts = [[new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.08, 4, false), new THREE.Color('#7a5a3a')]];
    const top = pts[6];
    for (let k = 0; k < 8; k++) {
      const L = 1.8 + Math.random() * 0.5;
      const leaf = new THREE.PlaneGeometry(L, 0.45, 6, 1).translate(L / 2, 0, 0);
      const p = leaf.attributes.position;
      for (let v = 0; v < p.count; v++) { const t = p.getX(v) / L; p.setY(v, p.getY(v) * (1 - t * 0.85) * Math.sin(Math.min(1, t * 4) * 1.57)); }
      leaf.rotateX(-Math.PI / 2);
      for (let v = 0; v < p.count; v++) { const t = p.getX(v) / L; p.setY(v, p.getY(v) + t * 0.5 - t * t * 1.5); }
      leaf.rotateY((k / 8) * Math.PI * 2).translate(top.x, top.y, top.z);
      parts.push([leaf, new THREE.Color(k % 2 ? '#2f7d3a' : '#3f9a45')]);
    }
    const geos = parts.map(([g, col]) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; });
    const m = mergeGeometries(geos); m.computeVertexNormals(); return m;
  }
  const palmMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
  palmMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      float k = position.y * position.y * 0.012;
      float ph = uTime * 1.4 + instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.2;
      transformed.x += sin(ph) * k; transformed.z += cos(ph * 0.7) * k * 0.6;`);
  };
  const palms = new THREE.InstancedMesh(palmGeo(), palmMat, Q.palms);
  const dummy = new THREE.Object3D();
  let placed = 0, tries = 0;
  while (placed < Q.palms && tries < 40000) {
    tries++;
    const x = (Math.random() - 0.5) * 60, y = (Math.random() - 0.5) * 66, s = sd(x, y);
    if (s > -0.15 || s < -1.4) continue;
    const h = height(x, y); if (h > 4) continue;
    dummy.position.set(x * U, h - 0.1, -y * U);
    dummy.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.25);
    dummy.scale.setScalar(0.8 + Math.random() * 0.6); dummy.updateMatrix();
    palms.setMatrixAt(placed++, dummy.matrix);
  }
  palms.count = placed; scene.add(palms);

  /* catamarans drifting in the lagoon */
  function catamaran() {
    const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    [-0.6, 0.6].forEach(x => { const h = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.25, 2.4), white); h.position.set(x, 0.15, 0); g.add(h); });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.6), white); deck.position.y = 0.3; g.add(deck);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 3.2, -0.1, 0, 0.4, -0.1, 0, 0.4, 1.1]), 3)); sg.computeVertexNormals();
    g.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xfff7ea, side: THREE.DoubleSide })));
    return g;
  }
  const boats = [];
  for (let i = 0, t = 0; boats.length < (low ? 6 : 12) && t < 4000; t++) {
    const x = (Math.random() - 0.5) * 64, y = (Math.random() - 0.5) * 70, s = sd(x, y);
    if (s < 0.5 || s > reefOff(x) - 0.4 || southGap(x, y) > 0.5) continue;
    const b = catamaran(); scene.add(b);
    boats.push({ mesh: b, cx: x * U, cz: -y * U, r: 1.2 + Math.random() * 2, a: Math.random() * 6.28, sp: (0.08 + Math.random() * 0.08) * (i++ % 2 ? 1 : -1) });
  }

  /* clouds */
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.45, flatShading: true, roughness: 1, transparent: true, opacity: 0.95 });
  const clouds = [];
  for (let i = 0; i < Q.clouds; i++) {
    const parts = [], n = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) { const s = new THREE.IcosahedronGeometry(4 + Math.random() * 4, 1); s.translate(k * 5 - n * 2.5, Math.random() * 2, (Math.random() - 0.5) * 4); parts.push(s); }
    const m = new THREE.Mesh(mergeGeometries(parts), cloudMat); m.scale.y = 0.55;
    m.position.set((Math.random() - 0.5) * 520, 60 + Math.random() * 30, (Math.random() - 0.5) * 520);
    clouds.push(m); scene.add(m);
  }

  /* seabirds */
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.5, -1.5, 0, -0.2, 0, 0, -0.35, 0, 0, 0.5, 0, 0, -0.35, 1.5, 0, -0.2]), 3));
  birdGeo.computeVertexNormals();
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1b2a33, side: THREE.DoubleSide });
  birdMat.onBeforeCompile = sh => {
    sh.uniforms.uTime = time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      transformed.y += abs(position.x) * sin(uTime * 9.0 + instanceMatrix[3].x * 0.7) * 0.55;`);
  };
  const birds = new THREE.InstancedMesh(birdGeo, birdMat, Q.birds);
  const birdData = Array.from({ length: Q.birds }, (_, i) => { const f = i % 4; return { r: 60 + f * 22 + Math.random() * 8, h: 28 + f * 6 + Math.random() * 6, ph: f * 1.6 + Math.random() * 0.35, sp: 0.12 + f * 0.02 }; });
  scene.add(birds);
  const bP = new THREE.Vector3(), bN = new THREE.Vector3();

  /* camera path (world units) — built around real landmarks */
  const W = p => new THREE.Vector3(p[0] * U, 0, -p[1] * U);
  const LMw = W(P['le-morne']), PLw = W(P['port-louis']);
  const camPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-150, 165, 230), new THREE.Vector3(-125, 55, 150),
    new THREE.Vector3(LMw.x - 42, 14, LMw.z + 36), new THREE.Vector3(LMw.x - 30, 22, LMw.z - 40),
    new THREE.Vector3(PLw.x - 70, 40, PLw.z + 10), new THREE.Vector3(20, 85, -175), new THREE.Vector3(185, 42, 30)
  ]);
  const lookPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(LMw.x, 6, LMw.z), new THREE.Vector3(LMw.x, 10, LMw.z), new THREE.Vector3(LMw.x + 10, 8, LMw.z - 20),
    new THREE.Vector3(PLw.x, 6, PLw.z), new THREE.Vector3(0, 5, 0), new THREE.Vector3(-70, 14, 0)
  ]);

  function resize() {
    const w = section.clientWidth, h = section.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 68 : 50; camera.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);

  // HUD: what are we looking at?
  const hudPlace = document.getElementById('hudPlace'), hudCoord = document.getElementById('hudCoord');
  const NAMES = { 'le-morne': 'Le Morne', 'port-louis': 'Port Louis', 'chamarel': 'Chamarel', 'black-river-peak': 'Black River Peak', 'flic-en-flac': 'Flic en Flac', 'tamarin': 'Tamarin', 'grand-baie': 'Grand Baie', 'cap-malheureux': 'Cap Malheureux', 'pamplemousses': 'Pamplemousses', 'curepipe': 'Curepipe', 'belle-mare': 'Belle Mare', 'mahebourg': 'Mahébourg', 'blue-bay': 'Blue Bay', 'gris-gris': 'Gris Gris', 'ile-aux-cerfs': 'Île aux Cerfs' };
  const dms = (v, pos, neg) => { const a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60); return d + '°' + String(m).padStart(2, '0') + '′' + (v >= 0 ? pos : neg); };
  let hudTick = 0;
  function updateHud(L) {
    const x = L.x / U, y = -L.z / U;
    let best = 'Mauritius', bd = 7;
    for (const k in NAMES) { const p = P[k], d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = NAMES[k]; } }
    if (hudPlace) hudPlace.textContent = sd(x, y) > reefOff(x) ? 'Indian Ocean' : best;
    if (hudCoord) hudCoord.textContent = dms(LAT0 + y / 110.57, 'N', 'S') + ' ' + dms(LON0 + x / KX, 'E', 'W');
  }

  const mouse = new THREE.Vector2(), mT = new THREE.Vector2();
  addEventListener('pointermove', e => mT.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5));
  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '80px' }).observe(section);
  const clock = new THREE.Clock();
  const Pc = new THREE.Vector3(), Lc = new THREE.Vector3();
  let prog = 0;

  // warm up: compile shaders + one frame before the section is on screen
  camPath.getPointAt(0, Pc); camera.position.copy(Pc); camera.lookAt(0, 0, 0);
  renderer.compile(scene, camera); renderer.render(scene, camera);
  section.classList.add('is-gl');

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible) return;
    time.value += dt;
    prog += ((HW.island || 0) - prog) * 0.08;
    mouse.lerp(mT, 0.05);
    const p = Math.min(0.999, Math.max(0, prog));
    camPath.getPointAt(p, Pc); lookPath.getPointAt(p, Lc);
    camera.position.set(Pc.x + mouse.x * 8, Pc.y - mouse.y * 4, Pc.z);
    camera.lookAt(Lc);
    if (++hudTick % 8 === 0) updateHud(Lc);

    boats.forEach(b => { b.a += b.sp * dt; b.mesh.position.set(b.cx + Math.cos(b.a) * b.r * U, 0.35 + Math.sin(time.value * 2 + b.a * 10) * 0.06, b.cz + Math.sin(b.a) * b.r * U); b.mesh.rotation.y = -b.a + (b.sp > 0 ? Math.PI : 0); });
    clouds.forEach((cl, i) => { cl.position.x += dt * (1.5 + (i % 3)); if (cl.position.x > 300) cl.position.x = -300; });
    birdData.forEach((b, i) => {
      const a = b.ph + time.value * b.sp, a2 = a + 0.02;
      bP.set(Math.cos(a) * b.r, b.h + Math.sin(time.value * 0.7 + i) * 1.5, Math.sin(a) * b.r * 1.15);
      bN.set(Math.cos(a2) * b.r, bP.y, Math.sin(a2) * b.r * 1.15);
      dummy.position.copy(bP); dummy.lookAt(bN); dummy.scale.setScalar(1.2); dummy.updateMatrix(); birds.setMatrixAt(i, dummy.matrix);
    });
    birds.instanceMatrix.needsUpdate = true;

    // day → golden hour across the flyover
    const k = THREE.MathUtils.smoothstep(p, 0.42, 0.88);
    SUN.copy(SUN_DAY).lerp(SUN_SET, k).normalize(); sun.position.copy(SUN).multiplyScalar(200);
    HORIZON.copy(PAL.hDay).lerp(PAL.hSet, k); scene.fog.color.copy(HORIZON);
    SKY_TOP.copy(PAL.tDay).lerp(PAL.tSet, k); WSKY.copy(PAL.wDay).lerp(PAL.wSet, k);
    sun.color.copy(PAL.sDay).lerp(PAL.sSet, k); sun.intensity = 2.2 - k * 0.8;
    hemi.color.copy(PAL.hemiDay).lerp(PAL.hemiSet, k); hemi.intensity = 1.1 - k * 0.35;
    warm.value = k; renderer.toneMappingExposure = 1.0 - k * 0.08;
    renderer.render(scene, camera);
  });
}

if (section && canvas && GEO) (HW.whenNear ? HW.whenNear(section, init, '220% 0px') : init());
