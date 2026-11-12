// =========================================================
// MORIS — intro: dive from orbit to Mauritius (three.js)
// Earth (NASA Blue/Black Marble) turns to Mauritius while the camera
// plunges in. Each frame the island's on-screen position is exposed so
// the page can punch a "portal" through the intro exactly there.
// Registers itself with HW.registerIntro(api); home.js drives the timing.
// =========================================================
import * as THREE from 'three';

const HW = (window.HW = window.HW || {});
const host = document.getElementById('intro');
const canvas = document.getElementById('introCanvas');

const MU = { lat: -20.25, lon: 57.55 };
function ll(lat, lon, r = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat), a = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-r * Math.cos(a) * Math.sin(phi), r * Math.cos(phi), r * Math.sin(a) * Math.sin(phi));
}
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const expoIn = t => (t === 0 ? 0 : Math.pow(2, 10 * t - 10));

async function init() {
  const low = HW.tier === 'low';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' }); }
  catch (e) { return; }
  renderer.setPixelRatio(HW.dpr || 1);
  renderer.setClearColor(0x020d13, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 200);
  camera.position.set(0, 0, 5.6);

  const loader = new THREE.TextureLoader();
  const load = url => new Promise(res => loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null)));
  const [day, night] = await Promise.all([load('assets/mu/tex/earth.jpg'), load('assets/mu/tex/earth-lights.png')]);
  if (day) day.anisotropy = low ? 2 : 8;

  const earth = new THREE.Group();
  scene.add(earth);
  const SUN = new THREE.Vector3(-0.35, 0.25, 0.9).normalize();
  const seg = low ? 72 : 128;
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, seg, seg * 0.66), new THREE.ShaderMaterial({
    uniforms: { uDay: { value: day }, uNight: { value: night }, uSun: { value: SUN }, uHas: { value: day ? 1 : 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D uDay, uNight; uniform vec3 uSun; uniform float uHas; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float l = dot(normalize(vN), uSun);
        vec3 d = uHas > 0.5 ? texture2D(uDay, vUv).rgb : vec3(0.05, 0.25, 0.45);
        vec3 n = uHas > 0.5 ? texture2D(uNight, vUv).rgb : vec3(0.0);
        float k = smoothstep(-0.18, 0.22, l);
        vec3 col = mix(n * vec3(1.0, 0.78, 0.5) * 1.8, d * (0.3 + 0.9 * max(l, 0.0)), k);
        float rim = pow(1.0 - max(dot(normalize(vN), vV), 0.0), 2.6);
        col += vec3(0.35, 0.8, 1.0) * rim * 0.75;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  })));
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.16, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vN; void main(){ float i = pow(0.74 - dot(vN, vec3(0,0,1.0)), 3.0); gl_FragColor = vec4(0.35, 0.85, 1.0, 1.0) * i * 1.7; }`
  })));
  // stars
  const N = low ? 900 : 2200, sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 30); sp.set([v.x, v.y, v.z], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.8 })));
  // Mauritius beacon
  const muV = ll(MU.lat, MU.lon, 1.003);
  const beacon = new THREE.Group(); beacon.position.copy(muV); beacon.lookAt(muV.clone().multiplyScalar(2));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.024, 0.03, 48), new THREE.MeshBasicMaterial({ color: 0xffb320, transparent: true, side: THREE.DoubleSide }));
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.009, 20), new THREE.MeshBasicMaterial({ color: 0xff5a3c }));
  beacon.add(ring, dot); earth.add(beacon);

  // orientation: start over Africa/Europe, end with Mauritius dead centre
  const Z = new THREE.Vector3(0, 0, 1);
  const qStart = new THREE.Quaternion().setFromUnitVectors(ll(18, 15).normalize(), Z);
  const qEnd = new THREE.Quaternion().setFromUnitVectors(muV.clone().normalize(), Z);
  const q = new THREE.Quaternion();
  earth.quaternion.copy(qStart);

  function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);

  const proj = new THREE.Vector3();
  const state = { k: 0, idle: true };
  const clock = new THREE.Clock();
  renderer.compile(scene, camera);

  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    if (state.idle) earth.rotateY(0.0008);
    else {
      const k = state.k;
      q.slerpQuaternions(qStart, qEnd, ease(Math.min(1, k / 0.62)));
      earth.quaternion.copy(q);
      // approach, then plunge
      const z1 = THREE.MathUtils.lerp(5.6, 1.75, ease(Math.min(1, k / 0.7)));
      camera.position.z = k < 0.7 ? z1 : THREE.MathUtils.lerp(1.75, 1.012, expoIn((k - 0.7) / 0.3));
      camera.fov = THREE.MathUtils.lerp(32, 18, ease(k)); camera.updateProjectionMatrix();
    }
    const s = 1 + (Math.sin(t * 3) * 0.5 + 0.5) * 1.4;
    ring.scale.setScalar(s); ring.material.opacity = 1 - (s - 1) / 1.4;
    renderer.render(scene, camera);
    // where Mauritius sits on screen (for the portal)
    beacon.getWorldPosition(proj); proj.project(camera);
    HW.introPos = { x: (proj.x * 0.5 + 0.5) * 100, y: (-proj.y * 0.5 + 0.5) * 100, front: proj.z < 1 };
  });

  HW.registerIntro && HW.registerIntro({
    textures: !!day,
    dive(duration, onUpdate) {
      return new Promise(res => {
        state.idle = false;
        const t0 = performance.now();
        const step = () => {
          state.k = Math.min(1, (performance.now() - t0) / (duration * 1000));
          onUpdate && onUpdate(state.k);
          state.k < 1 ? requestAnimationFrame(step) : res();
        };
        requestAnimationFrame(step);
      });
    },
    dispose() {
      renderer.setAnimationLoop(null);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      day && day.dispose(); night && night.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    }
  });
}

if (host && canvas) init();
