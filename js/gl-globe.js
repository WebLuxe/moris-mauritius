// =========================================================
// MORIS — "Where in the world": a 3D Earth that turns to Mauritius
// as you scroll, while flight arcs draw in from major cities.
// Day texture + city lights on the night side + atmosphere rim.
// Progress comes from ScrollTrigger via HW.globe (0..1).
// Earth textures: NASA Blue Marble / Black Marble (public domain).
// =========================================================
import * as THREE from 'three';

const HW = (window.HW = window.HW || {});
const stage = document.getElementById('globeStage');
const canvas = document.getElementById('globeCanvas');

const MU = { lat: -20.25, lon: 57.55 };
const CITIES = [
  { id: 'reunion', lat: -20.88, lon: 55.45 },
  { id: 'johannesburg', lat: -26.2, lon: 28.05 },
  { id: 'mumbai', lat: 19.08, lon: 72.88 },
  { id: 'dubai', lat: 25.2, lon: 55.27 },
  { id: 'paris', lat: 48.86, lon: 2.35 },
  { id: 'london', lat: 51.5, lon: -0.13 }
];

function ll(lat, lon, r = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat), a = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-r * Math.cos(a) * Math.sin(phi), r * Math.cos(phi), r * Math.sin(a) * Math.sin(phi));
}

function init() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { return; }
  renderer.setPixelRatio(HW.dpr || 1);
  const low = HW.tier === 'low';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);

  const loader = new THREE.TextureLoader();
  const day = loader.load('assets/mu/tex/earth.jpg'); day.colorSpace = THREE.SRGBColorSpace; day.anisotropy = 8;
  const night = loader.load('assets/mu/tex/earth-lights.png'); night.colorSpace = THREE.SRGBColorSpace;

  const globe = new THREE.Group();
  scene.add(globe);
  const SUN = new THREE.Vector3(-0.6, 0.25, 0.75).normalize();

  globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, low ? 64 : 96, low ? 44 : 64), new THREE.ShaderMaterial({
    uniforms: { uDay: { value: day }, uNight: { value: night }, uSun: { value: SUN } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D uDay, uNight; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float l = dot(normalize(vN), uSun);
        vec3 d = texture2D(uDay, vUv).rgb, n = texture2D(uNight, vUv).rgb;
        float k = smoothstep(-0.15, 0.25, l);
        vec3 col = mix(n * vec3(1.0, 0.8, 0.55) * 1.6 + d * 0.04, d * (0.35 + 0.85 * max(l, 0.0)), k);
        float rim = pow(1.0 - max(dot(normalize(vN), vV), 0.0), 3.0);
        col += vec3(0.3, 0.75, 1.0) * rim * 0.6;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  })));
  // atmosphere glow
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vN; void main(){ float i = pow(0.72 - dot(vN, vec3(0,0,1.0)), 3.0); gl_FragColor = vec4(0.35, 0.8, 1.0, 1.0) * i * 1.6; }`
  })));
  // stars
  const NS = low ? 600 : 1500, sg = new THREE.BufferGeometry(), sp = new Float32Array(NS * 3);
  for (let i = 0; i < NS; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 20); sp.set([v.x, v.y, v.z], i * 3); }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.7 })));

  // Mauritius beacon
  const muV = ll(MU.lat, MU.lon, 1.002);
  const beacon = new THREE.Group();
  beacon.position.copy(muV);
  beacon.lookAt(muV.clone().multiplyScalar(2));
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.018, 24), new THREE.MeshBasicMaterial({ color: 0xff6a4d }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.036, 48), new THREE.MeshBasicMaterial({ color: 0xff6a4d, transparent: true, side: THREE.DoubleSide }));
  beacon.add(dot, ring);
  globe.add(beacon);

  // arcs
  const arcs = CITIES.map((c, i) => {
    const a = ll(c.lat, c.lon, 1.002), b = muV.clone();
    const dist = a.distanceTo(b);
    const mid = a.clone().add(b).normalize().multiplyScalar(1 + dist * 0.35);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uDraw: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uDraw, uTime; varying vec2 vUv;
        void main(){
          if (vUv.x > uDraw) discard;
          float head = smoothstep(uDraw - 0.12, uDraw, vUv.x);
          float pulse = smoothstep(0.06, 0.0, abs(fract(vUv.x - uTime * 0.35) - 0.5) - 0.44);
          vec3 c = mix(vec3(0.38, 0.89, 0.82), vec3(1.0, 0.45, 0.33), vUv.x);
          gl_FragColor = vec4(c * (0.8 + head * 1.6 + pulse * 1.2), 0.85);
        }`
    });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.0045, 6, false), mat);
    globe.add(tube);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    pin.position.copy(a); globe.add(pin);
    return { mat, id: c.id, start: 0.18 + i * 0.1 };
  });

  // orientation: start looking at Europe, end with Mauritius front & centre
  const Z = new THREE.Vector3(0, 0, 1);
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.18);
  const qStart = new THREE.Quaternion().setFromUnitVectors(ll(30, 10).normalize(), Z).premultiply(tilt);
  const qEnd = new THREE.Quaternion().setFromUnitVectors(muV.clone().normalize(), Z).premultiply(tilt);
  const q = new THREE.Quaternion();

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);

  const mouse = new THREE.Vector2(), mT = new THREE.Vector2();
  addEventListener('pointermove', e => mT.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5));
  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '100px' }).observe(stage);
  const rows = [...document.querySelectorAll('.route')];
  const clock = new THREE.Clock();
  let p = 0, t = 0;
  renderer.compile(scene, camera);
  stage.classList.add('is-gl');

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible) return;
    t += dt;
    p += ((HW.globe || 0) - p) * 0.08;
    const k = THREE.MathUtils.smoothstep(p, 0.0, 0.75);
    q.slerpQuaternions(qStart, qEnd, k);
    mouse.lerp(mT, 0.05);
    globe.quaternion.copy(q);
    globe.rotateY(mouse.x * 0.25 + Math.sin(t * 0.3) * 0.02 * (1 - k));
    globe.rotateX(mouse.y * 0.12);
    arcs.forEach(a => {
      a.mat.uniforms.uDraw.value = THREE.MathUtils.clamp((p - a.start) / 0.22, 0, 1.001);
      a.mat.uniforms.uTime.value = t;
    });
    rows.forEach(r => { const a = arcs.find(x => x.id === r.dataset.city); r.classList.toggle('is-active', !!a && a.mat.uniforms.uDraw.value > 0.98); });
    const s = 1 + (Math.sin(t * 2.5) * 0.5 + 0.5) * 1.6;
    ring.scale.setScalar(s); ring.material.opacity = 1 - (s - 1) / 1.6;
    renderer.render(scene, camera);
  });
}

if (stage && canvas) (HW.whenNear ? HW.whenNear(stage, init, '200% 0px') : init());
