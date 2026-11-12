// =========================================================
// MORIS — WebGL hero: lagoon video through a water-shimmer shader
//   • rising heat shimmer (fbm noise UV warp, stronger near the ground)
//   • mouse ripples that react to cursor speed
//   • scroll-driven zoom + RGB split + warm grade, vignette, grain
// Falls back to the plain <video> if WebGL is unavailable.
// =========================================================
import * as THREE from 'three';

const HW = (window.HW = window.HW || {});
const video = document.getElementById('heroVideo');
const host = document.getElementById('heroMedia');

function init() {
  if (HW.tier === 'low' || !video || !host) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return; }
  if (!renderer.getContext()) return;

  const canvas = renderer.domElement;
  canvas.className = 'cover gl-hero';
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tex = new THREE.VideoTexture(video);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;

  const uniforms = {
    uTex: { value: tex },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTexRes: { value: new THREE.Vector2(1280, 720) },
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uMouseVel: { value: 0 },
    uScroll: { value: 0 },
    uVel: { value: 0 },
    uIntro: { value: 0 }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D uTex;
      uniform vec2 uRes, uTexRes, uMouse;
      uniform float uTime, uMouseVel, uScroll, uVel, uIntro;
      varying vec2 vUv;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<4;i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }

      vec2 coverUv(vec2 uv){
        float rs = uRes.x / uRes.y, rt = uTexRes.x / uTexRes.y;
        vec2 s = rs > rt ? vec2(1.0, rt / rs) : vec2(rs / rt, 1.0);
        return (uv - 0.5) * s + 0.5;
      }

      void main(){
        vec2 uv = vUv;
        // (zoom is handled by the GSAP scale on the container)

        // heat haze rising from the ground
        float ground = smoothstep(1.0, 0.0, vUv.y);
        vec2 q = vec2(uv.x * 4.0, uv.y * 7.0 - uTime * 0.9);
        float n = fbm(q + fbm(q * 0.7 + uTime * 0.15));
        uv += vec2(n - 0.5, (n - 0.5) * 0.6) * 0.0035;

        // mouse ripple
        vec2 m = uMouse; vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
        float d = length((vUv - m) * aspect);
        float rip = sin(d * 38.0 - uTime * 7.0) * exp(-d * 6.0) * (0.002 + uMouseVel * 0.02);
        uv += normalize((vUv - m) * aspect + 1e-5) * rip;

        // RGB split: grows with scroll progress + scroll velocity
        vec2 dir = (vUv - 0.5);
        float split = 0.0015 + uScroll * 0.012 + abs(uVel) * 0.004;
        vec2 cu = coverUv(uv);
        float r = texture2D(uTex, coverUv(uv + dir * split)).r;
        float g = texture2D(uTex, cu).g;
        float b = texture2D(uTex, coverUv(uv - dir * split)).b;
        vec3 col = vec3(r, g, b);

        // warm grade + lift shadows into violet
        col = pow(col, vec3(1.0, 0.97, 0.95));
        col *= vec3(0.98, 1.02, 1.04);

        // vignette + grain
        float v = smoothstep(1.15, 0.25, length((vUv - 0.5) * vec2(1.25, 1.0)));
        col *= mix(0.7, 1.0, v);
        col += (hash(vUv * uRes + fract(uTime) * 100.0) - 0.5) * 0.02;

        gl_FragColor = vec4(col, 1.0);
      }`
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
  }
  resize();
  addEventListener('resize', resize);
  video.addEventListener('loadedmetadata', () => uniforms.uTexRes.value.set(video.videoWidth, video.videoHeight));
  if (video.videoWidth) uniforms.uTexRes.value.set(video.videoWidth, video.videoHeight);

  // mouse
  const target = new THREE.Vector2(0.5, 0.5);
  let mv = 0, lx = 0, ly = 0;
  addEventListener('pointermove', e => {
    target.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
    mv = Math.min(1, mv + Math.hypot(e.clientX - lx, e.clientY - ly) / 300);
    lx = e.clientX; ly = e.clientY;
  });

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(host);

  // hand the hero media over to WebGL
  host.classList.add('is-gl');
  HW.heroGL = true;

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    uniforms.uMouse.value.lerp(target, 0.08);
    mv *= 0.94;
    uniforms.uMouseVel.value = mv;
    uniforms.uScroll.value += ((HW.hero || 0) - uniforms.uScroll.value) * 0.2;
    uniforms.uVel.value += (Math.max(-3, Math.min(3, HW.velocity || 0)) - uniforms.uVel.value) * 0.1;
    uniforms.uIntro.value += ((HW.introDone ? 1 : 0) - uniforms.uIntro.value) * 0.035;
    renderer.render(scene, camera);
  });
}

init();
