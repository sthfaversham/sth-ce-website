// STH Construction & Engineering: a railway turnout taken through the Network Rail PACE lifecycle as you scroll.
// Concept visualisation, illustrative geometry. Units are metres.
// x = along the main line from the switch toe, z = across (diverging side negative), y = up.
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';

const root = document.getElementById('xp');
const canvas = document.getElementById('xp-canvas');
const stageEl = root.querySelector('.xp-sticky');
const labelsEl = root.querySelector('.xp-labels');
const barEl = root.querySelector('.xp-bar i');
const stageNumEl = root.querySelector('.xp-stagenum');
const stages = [...root.querySelectorAll('.xp-stage')];
const dots = [...root.querySelectorAll('.xp-dots button')];
const steps = [...root.querySelectorAll('.xp-steps li')];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function fallback(reason) { root.classList.add('xp-static'); root.dataset.fallback = reason || 'unsupported'; }
if (reduce) { fallback('reduced-motion'); throw new Error('reduced motion: static presentation'); }

// ---------- helpers ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const span = (p, a, b) => clamp((p - a) / (b - a));
const win = (p, a, b, f = 0.015) => Math.min(span(p, a, a + f), 1 - span(p, b - f, b));

// ---------- timeline (scroll progress 0..1) ----------
// PACE phases: 1 Project initiation, 2 Development & project selection, 3 Project design, 4 Project delivery, 5 Project close.
const T = {
  survey: [0.02, 0.11], options: [0.13, 0.22], select: [0.22, 0.25], design: [0.26, 0.37],
  descend: [0.38, 0.45],
  formation: [0.44, 0.48], bottom: [0.48, 0.52], bearers: [0.52, 0.6],
  stock: [0.6, 0.645], blades: [0.63, 0.665], closure: [0.645, 0.68], crossing: [0.665, 0.7], check: [0.69, 0.71],
  fixings: [0.7, 0.73], top: [0.73, 0.765], tamp: [0.765, 0.8], test: [0.8, 0.83],
  close: [0.84, 0.91], services: [0.92, 1],
};

// ---------- geometry (illustrative; same turnout as the site's design-check drawing) ----------
const G = 1.435, R = 190, HC = G / 2 + 0.036;
const uX = Math.sqrt(2 * R * G - G * G);
const TA = uX / Math.sqrt(R * R - uX * uX);
const U0 = -16, U1 = 64;
const vcR = (u, r) => { const ux = Math.sqrt(2 * r * G - G * G), ta = ux / Math.sqrt(r * r - ux * ux); return u <= 0 ? 0 : u <= ux ? -(r - Math.sqrt(r * r - u * u)) : -(G + (u - ux) * ta); };
const vc = u => vcR(u, R);
const dvc = u => u <= 0 ? 0 : u <= uX ? -u / Math.sqrt(R * R - u * u) : -TA;
const HEEL = 10.5, THROAT = uX - 2.1, FW = 0.112;

const isMobile = matchMedia('(max-width: 760px)').matches;
const lowPower = isMobile || (navigator.hardwareConcurrency || 8) <= 4;

// ---------- renderer ----------
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { fallback('webgl'); throw e; }
if (!renderer.getContext()) { fallback('webgl'); throw new Error('no webgl'); }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobile ? 1.75 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const NAVY = new THREE.Color(0x061019);
const CYAN = new THREE.Color(0x4fd3f0);
const scene = new THREE.Scene();
scene.background = NAVY.clone();
scene.fog = new THREE.FogExp2(NAVY.getHex(), 0.0042);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 700);

const hemi = new THREE.HemisphereLight(0x5f8fa6, 0x0a1218, 0);
const key = new THREE.DirectionalLight(0xfff1de, 0);
key.position.set(-18, 34, 22); key.target.position.set(20, 0, -3);
key.castShadow = true;
key.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
Object.assign(key.shadow.camera, { left: -48, right: 48, top: 30, bottom: -30, near: 1, far: 120 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
const rim = new THREE.DirectionalLight(0x58d6f2, 0);
rim.position.set(60, 8, -30);
scene.add(hemi, key, key.target, rim);

// ---------- procedural textures ----------
function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(...repeat); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
const concreteTex = canvasTex(256, (g, n) => {
  const r = rand(7); g.fillStyle = '#8f918b'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 2600; i++) { const v = 110 + r() * 60 | 0; g.fillStyle = `rgba(${v},${v},${v - 4},${0.25 + r() * 0.35})`; g.fillRect(r() * n, r() * n, 1 + r() * 2.5, 1 + r() * 2.5); }
});
const stones = (seed, bg, lo, hi) => (g, n) => {
  const r = rand(seed); g.fillStyle = bg; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 5200; i++) {
    const x = r() * n, y = r() * n, s = 5 + r() * 8, base = lo + r() * (hi - lo) | 0, warm = r() * 14 | 0;
    g.fillStyle = `rgb(${base + warm},${base},${base - 4})`; g.beginPath();
    const k = 5 + (r() * 3 | 0);
    for (let j = 0; j < k; j++) { const a = j / k * 6.283 + r() * 0.5, rr = s * (0.6 + r() * 0.5); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x - s * 0.3, y - s * 0.4, s * 0.5, s * 0.25);
  }
};
const ballastTex = canvasTex(512, stones(21, '#242424', 62, 132), [64, 13]);
const formationTex = canvasTex(256, (g, n) => {
  const r = rand(3); g.fillStyle = '#4a3c30'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 6000; i++) { const v = r(); g.fillStyle = `rgba(${90 + v * 60 | 0},${72 + v * 45 | 0},${55 + v * 35 | 0},0.5)`; g.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); }
}, [40, 10]);

// ---------- materials ----------
const MATS = [];
function phys(opts) { const m = new THREE.MeshStandardMaterial(opts); MATS.push(m); return m; }
const matRailSide = phys({ color: 0x5b4a40, metalness: 0.55, roughness: 0.72 });
const matRailHead = phys({ color: 0xaeb7bd, metalness: 1.0, roughness: 0.3 });
const matConcrete = phys({ color: 0xa9aba4, roughness: 0.92, metalness: 0, map: concreteTex });
const matPlate = phys({ color: 0x30353a, roughness: 0.55, metalness: 0.6 });
const matClip = phys({ color: 0x2c3329, roughness: 0.55, metalness: 0.5 });
const matBar = phys({ color: 0x3a3f44, roughness: 0.5, metalness: 0.7 });

// Rails: reveal along the track, bright cutting edge while extending, and a green "test" pulse.
const TEST = { value: -1e4 };
function addReveal(mat, uni) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uReveal = uni.reveal; sh.uniforms.uTest = TEST;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWX;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWX = (modelMatrix * vec4(transformed,1.0)).x;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWX; uniform float uReveal; uniform float uTest;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vWX > uReveal) discard;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.31,0.83,0.94) * 2.2 * (1.0 - smoothstep(0.0, 1.4, uReveal - vWX)) * step(uReveal, 999.0);
        totalEmissiveRadiance += vec3(0.2,1.0,0.5) * 3.5 * (1.0 - smoothstep(0.0, 4.5, abs(vWX - uTest)));`);
  };
  mat.customProgramCacheKey = () => 'rail-reveal';
}

// ---------- rail sweep ----------
const PROF = [[-0.075, 0], [0.075, 0], [0.075, 0.011], [0.013, 0.03], [0.008, 0.105], [0.036, 0.117], [0.036, 0.154], [0.03, 0.16], [-0.03, 0.16], [-0.036, 0.154], [-0.036, 0.117], [-0.008, 0.105], [-0.013, 0.03], [-0.075, 0.011]];
const HEAD_EDGES = new Set([6, 7, 8]);
const RAIL_Y = 0.235;
const samplePath = (fn, a, b, step) => { const pts = [], n = Math.max(1, Math.ceil((b - a) / step)); for (let i = 0; i <= n; i++) pts.push(fn(a + (b - a) * i / n)); return pts; };
function sweepRail(pts, headScaleFn) {
  const pos = [], nor = [], groups = [[], []], N = pts.length;
  const fr = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; return { nx: -tz / l, nz: tx / l }; });
  let v = 0;
  for (let e = 0; e < PROF.length; e++) {
    const A = PROF[e], B = PROF[(e + 1) % PROF.length], es = B[0] - A[0], ey = B[1] - A[1], el = Math.hypot(es, ey);
    const ns = ey / el, ny = -es / el, start = v;
    for (let i = 0; i < N; i++) {
      const p = pts[i], f = fr[i], hs = headScaleFn ? headScaleFn(p[0]) : 1;
      for (const Q of [A, B]) { const head = Q[1] > 0.11, s = Q[0] * (head ? hs : 1), y = Q[1] * (head ? 0.75 + 0.25 * hs : 1); pos.push(p[0] + f.nx * s, RAIL_Y + y, p[1] + f.nz * s); nor.push(f.nx * ns, ny, f.nz * ns); }
      v += 2;
    }
    const g = HEAD_EDGES.has(e) ? groups[1] : groups[0];
    for (let i = 0; i < N - 1; i++) { const a = start + i * 2; g.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex([...groups[0], ...groups[1]]);
  geo.addGroup(0, groups[0].length, 0); geo.addGroup(groups[0].length, groups[1].length, 1);
  return geo;
}
const RAILS = [];
function addRail(name, pts, w, headScaleFn) {
  const uni = { reveal: { value: -1e4 } };
  const side = matRailSide.clone(), head = matRailHead.clone();
  addReveal(side, uni); addReveal(head, uni); MATS.push(side, head);
  const mesh = new THREE.Mesh(sweepRail(pts, headScaleFn), [side, head]);
  mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
  const xs = pts.map(p => p[0]);
  RAILS.push({ mesh, w, x0: Math.min(...xs), x1: Math.max(...xs), uni, name });
}
const P = (fn, a, b, step = 0.5) => samplePath(fn, a, b, step);
const toe = u => 0.25 + 0.75 * clamp(u / 4.5), nose = u => 0.35 + 0.65 * clamp((u - uX) / 2.2);
addRail('stock-right', [[U0, HC], [U1, HC]], T.stock);
addRail('stock-left', [[U0, -HC], ...P(u => [u, vc(u) - HC], 0, U1)], T.stock);
addRail('blade-straight', P(u => [u, -HC + 0.046 * (1 - u / HEEL)], 0.15, HEEL, 0.25), T.blades, toe);
addRail('blade-curved', P(u => [u, vc(u) + HC - 0.115 * Math.pow(1 - u / HEEL, 1.5)], 0.15, HEEL, 0.25), T.blades, toe);
addRail('closure-straight', [[HEEL, -HC], [THROAT, -HC]], T.closure);
addRail('closure-curved', P(u => [u, vc(u) + HC], HEEL, THROAT), T.closure);
addRail('wing-a', [[THROAT, -HC], ...P(u => [u, vc(u) + HC - FW], uX - 0.2, uX + 3.2), [uX + 4.4, vc(uX + 4.4) + HC - FW - 0.22]], T.crossing);
addRail('wing-b', [...P(u => [u, vc(u) + HC], THROAT, THROAT + 0.2), [uX - 0.2, -HC + FW], [uX + 3.2, -HC + FW], [uX + 4.4, -HC + FW + 0.22]], T.crossing);
addRail('nose-straight', [[uX, -HC], [U1, -HC]], T.crossing, nose);
addRail('nose-diverging', P(u => [u, vc(u) + HC], uX, U1), T.crossing, nose);
const CK0 = uX - 3.2, CK1 = uX + 2.2;
addRail('check-main', [[CK0 - 0.8, HC - FW - 0.14], [CK0, HC - FW], [CK1, HC - FW], [CK1 + 0.8, HC - FW - 0.14]], T.check);
addRail('check-div', [[CK0 - 0.8, vc(CK0 - 0.8) - HC + FW + 0.14], ...P(u => [u, vc(u) - HC + FW], CK0, CK1, 0.4), [CK1 + 0.8, vc(CK1 + 0.8) - HC + FW + 0.14]], T.check);

// ---------- bearers ----------
const BEARERS = [];
const SPLIT = uX + 12.2;
for (let u = U0 + 0.3; u < -2.6; u += 0.65) BEARERS.push({ cx: u, cz: 0, len: 2.6, rot: 0 });
for (let u = -2.6 + 0.325; u < SPLIT; u += 0.65) { const z0 = vc(u) - HC - 0.62, z1 = HC + 0.62; BEARERS.push({ cx: u, cz: (z0 + z1) / 2, len: Math.max(2.6, z1 - z0), rot: 0 }); }
for (let u = SPLIT + 0.33; u < U1; u += 0.65) BEARERS.push({ cx: u, cz: 0, len: 2.6, rot: 0 });
for (let u = SPLIT + 0.1; u < U1 - 1; u += 0.65 * Math.cos(Math.atan(dvc(u)))) BEARERS.push({ cx: u, cz: vc(u), len: 2.6, rot: Math.atan(-dvc(u)) });
BEARERS.sort((a, b) => a.cx - b.cx);
BEARERS.forEach((b, i) => { b.birth = lerp(T.bearers[0], T.bearers[1] - 0.012, i / BEARERS.length); });
const bearerGeo = new THREE.BoxGeometry(1, 0.2, 1); bearerGeo.translate(0, 0.1, 0);
{ const uv = bearerGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 0.4); }
const bearerMesh = new THREE.InstancedMesh(bearerGeo, matConcrete, BEARERS.length);
bearerMesh.castShadow = bearerMesh.receiveShadow = true; scene.add(bearerMesh);

// ---------- baseplates, clips, stretcher bars ----------
const railsAt = u => {
  const z = [HC];
  if (u < 0) z.push(-HC);
  else { z.push(vc(u) - HC); if (u < HEEL) { z.push(-HC + 0.046 * (1 - u / HEEL), vc(u) + HC - 0.115 * Math.pow(1 - u / HEEL, 1.5)); } else z.push(-HC, vc(u) + HC); }
  return z;
};
const PLATES = [];
for (const b of BEARERS) {
  if (b.rot) { for (const s of [-HC, HC]) PLATES.push({ x: b.cx + Math.sin(b.rot) * s, z: b.cz + Math.cos(b.rot) * s, rot: b.rot }); continue; }
  for (const z of (b.cx > SPLIT ? [HC, -HC] : railsAt(b.cx))) PLATES.push({ x: b.cx, z, rot: 0 });
}
PLATES.forEach(q => { q.birth = lerp(T.fixings[0], T.fixings[1] - 0.012, clamp((q.x - U0) / (U1 - U0))); });
const plateGeo = new THREE.BoxGeometry(0.2, 0.035, 0.36); plateGeo.translate(0, 0.2175, 0);
const plateMesh = new THREE.InstancedMesh(plateGeo, matPlate, PLATES.length); plateMesh.receiveShadow = true; scene.add(plateMesh);
const clipGeo = new THREE.TorusGeometry(0.028, 0.007, 5, 10, Math.PI * 1.2); clipGeo.rotateY(Math.PI / 2); clipGeo.translate(0, 0.243, 0);
const clipMesh = new THREE.InstancedMesh(clipGeo, matClip, PLATES.length * 2); scene.add(clipMesh);
const barMeshes = [0.75, 2.6].map(u => { const z0 = -HC + 0.046 * (1 - u / HEEL), z1 = vc(u) + HC - 0.115 * Math.pow(1 - u / HEEL, 1.5); const g = new THREE.BoxGeometry(0.06, 0.05, z1 - z0); g.translate(u, 0.27, (z0 + z1) / 2); const m = new THREE.Mesh(g, matBar); m.castShadow = true; scene.add(m); return m; });

// ---------- earthworks: formation, bottom ballast, top ballast ----------
const gw = isMobile ? 220 : 360, gh = isMobile ? 70 : 110;
const distTrack = (x, z) => Math.min(Math.abs(z), Math.abs(z - vc(x)), (x < uX + 14 && z > vc(x) && z < 0) ? 0 : 99);
function bed(fn, colFn) {
  const geo = new THREE.PlaneGeometry(U1 - U0 + 30, 24, gw, gh); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), r = rand(5);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + (U0 + U1) / 2, z = p.getZ(i) - 2.5, d = distTrack(x, z);
    p.setXYZ(i, x, fn(d, r), z); const c = colFn(d); col[i * 3] = c * 0.95; col[i * 3 + 1] = c; col[i * 3 + 2] = c * 0.97;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals(); return geo;
}
const shoulder = 2.1, toeD = 4.2;
const topBallastY = (d, r) => (d < shoulder ? 0.17 : d < toeD ? lerp(0.17, -0.42, (d - shoulder) / (toeD - shoulder)) : -0.6) + (r() - 0.5) * 0.04;
const bottomBallastY = (d, r) => (d < shoulder + 0.3 ? -0.005 : d < toeD + 0.3 ? lerp(-0.005, -0.42, (d - shoulder - 0.3) / (toeD - shoulder)) : -0.6) + (r() - 0.5) * 0.03;
const formationY = (d, r) => (d < toeD + 1.2 ? -0.42 : -0.42 - (d - toeD - 1.2) * 0.05) + (r() - 0.5) * 0.02;
const fadeOut = d => d < shoulder + 0.6 ? 1 : lerp(1, 0.22, clamp((d - shoulder - 0.6) / 1.6));
function bedMesh(geo, map, color) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, color, map, roughness: 0.95, metalness: 0, transparent: true, opacity: 0 });
  const mesh = new THREE.Mesh(geo, m); mesh.receiveShadow = true; mesh.visible = false; scene.add(mesh); return mesh;
}
const formation = bedMesh(bed(formationY, d => d < toeD + 1.2 ? 1 : lerp(1, 0.35, clamp((d - toeD - 1.2) / 6))), formationTex, 0xc9b9a4);
const bottomBallast = bedMesh(bed(bottomBallastY, fadeOut), ballastTex, 0x9d9995);
const topBallast = bedMesh(bed(topBallastY, fadeOut), ballastTex, 0xa7a3a0);

// tamping head: a glowing band travelling along both routes
const tampMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const tamp = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.3), tampMat); tamp.rotation.y = Math.PI / 2; scene.add(tamp);
const tamp2 = tamp.clone(); scene.add(tamp2);

// ---------- CAD layers ----------
function cadLayer(alpha) {
  const pos = [], birth = [], kind = [];
  const api = {
    seg(a, b, t, k = 0) { pos.push(...a, ...b); birth.push(t, t); kind.push(k, k); },
    poly(pts, t0, t1, k = 0, y = 0.03) { for (let i = 0; i < pts.length - 1; i++) api.seg([pts[i][0], y, pts[i][1]], [pts[i + 1][0], y, pts[i + 1][1]], lerp(t0, t1, i / (pts.length - 1)), k); },
    dash(fn, a, b, t0, t1, k = 1, y = 0.03) { for (let u = a; u < b; u += 1.6) api.seg([u, y, fn(u)], [u + 1, y, fn(u + 1)], lerp(t0, t1, (u - a) / (b - a)), k); },
    build(color = CYAN) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('birth', new THREE.Float32BufferAttribute(birth, 1));
      g.setAttribute('kind', new THREE.Float32BufferAttribute(kind, 1));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uP: { value: 0 }, uFade: { value: 1 }, uColor: { value: color.clone() } },
        vertexShader: 'attribute float birth; attribute float kind; varying float vB; varying float vK; void main(){ vB=birth; vK=kind; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: `uniform float uP; uniform float uFade; uniform vec3 uColor; varying float vB; varying float vK;
          void main(){ if(vB>uP) discard; float fresh = vK > 1.5 ? 0.0 : 1.0 - smoothstep(0.0, 0.025, uP - vB);
            float a = vK > 1.5 ? ${alpha.grid.toFixed(3)} : (vK > 0.5 ? 0.6 : 0.88);
            gl_FragColor = vec4(uColor * (1.0 + fresh * 1.6), (a + fresh * 0.4) * uFade); }`
      });
      const l = new THREE.LineSegments(g, m); l.frustumCulled = false; l.renderOrder = 5; scene.add(l); return l;
    }
  };
  return api;
}
// survey & constraints (phase 1)
const S1 = cadLayer({ grid: 0.06 });
for (let x = -20; x <= 70; x += 5) S1.seg([x, -0.01, -18], [x, -0.01, 12], lerp(T.survey[0], T.survey[0] + 0.04, (x + 20) / 90), 2);
for (let z = -18; z <= 12; z += 5) S1.seg([-20, -0.01, z], [70, -0.01, z], lerp(T.survey[0], T.survey[0] + 0.04, (z + 18) / 30), 2);
const BOUND = [[-14, 5.5], [62, 5.5], [62, -12.5], [30, -12.5], [-14, -4], [-14, 5.5]];
for (let i = 0; i < BOUND.length - 1; i++) { const [a, b] = [BOUND[i], BOUND[i + 1]], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.4); for (let k = 0; k < n; k += 2) { const t0 = k / n, t1 = (k + 1) / n; S1.seg([lerp(a[0], b[0], t0), 0.03, lerp(a[1], b[1], t0)], [lerp(a[0], b[0], t1), 0.03, lerp(a[1], b[1], t1)], lerp(0.05, 0.09, (i + t0) / (BOUND.length - 1)), 1); } }
const CONTROL = [[-10, 3.5], [8, 4], [26, 4.2], [44, 3], [56, -10], [20, -10.5], [-6, -2.5]];
CONTROL.forEach(([x, z], i) => { const t = 0.045 + i * 0.006; const tri = [[x, z - 0.6], [x + 0.55, z + 0.35], [x - 0.55, z + 0.35], [x, z - 0.6]]; S1.poly(tri, t, t, 0); S1.seg([x - 0.15, 0.03, z], [x + 0.15, 0.03, z], t, 0); });
S1.dash(u => 0, U0, U1, 0.07, 0.1, 1); // proposed main line centreline
for (let k = 0; k < 11; k++) { // ground contours from the topographical survey
  const z0 = -17 + k * 2.8, pts = [];
  for (let x = -20; x <= 70; x += 1.5) pts.push([x, z0 + 1.3 * Math.sin(x / 9 + k * 0.7) + 0.6 * Math.sin(x / 4.1 + k * 1.9)]);
  S1.poly(pts, T.survey[0] + 0.01 + k * 0.004, T.survey[0] + 0.05 + k * 0.004, 1, 0.0);
}
const cadSurvey = S1.build();
// options (phase 2): three diverging alignments, B (R190) selected
const optA = cadLayer({ grid: 0 }); optA.poly(samplePath(u => [u, vcR(u, 120)], 0, U1, 1), T.options[0], T.options[0] + 0.04, 0); const cadOptA = optA.build(new THREE.Color(0x9fb6bf));
const optC = cadLayer({ grid: 0 }); optC.poly(samplePath(u => [u, vcR(u, 320)], 0, U1, 1), T.options[0] + 0.02, T.options[0] + 0.06, 0); const cadOptC = optC.build(new THREE.Color(0x9fb6bf));
const optB = cadLayer({ grid: 0 }); optB.poly(samplePath(u => [u, vc(u)], 0, U1, 1), T.options[0] + 0.01, T.options[0] + 0.05, 0); const cadOptB = optB.build();
// detailed design (phase 3): rails, bearers, dimensions, worksite limits
const D = cadLayer({ grid: 0 });
for (const b of BEARERS) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), hx = 0.13, hz = b.len / 2;
  const q = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([dx, dz]) => [b.cx + dx * c + dz * s, 0.03, b.cz - dx * s + dz * c]);
  const t = lerp(T.design[0] + 0.035, T.design[1] - 0.02, (b.cx - U0) / (U1 - U0));
  for (let k = 0; k < 4; k++) D.seg(q[k], q[(k + 1) % 4], t, 0);
}
for (const r of RAILS) {
  const pos = r.mesh.geometry.attributes.position, N = pos.count / PROF.length / 2, base = 7 * N * 2;
  for (const off of [0, 1]) for (let i = 0; i < N - 1; i++) {
    const a = [pos.getX(base + i * 2 + off), 0.05, pos.getZ(base + i * 2 + off)], b = [pos.getX(base + (i + 1) * 2 + off), 0.05, pos.getZ(base + (i + 1) * 2 + off)];
    D.seg(a, b, lerp(T.design[0], T.design[0] + 0.05, clamp((a[0] - U0) / (U1 - U0))), 0);
  }
}
for (let u = 0; u <= 60; u += 5) D.seg([u, 0.03, 3.0], [u, 0.03, u % 10 === 0 ? 3.7 : 3.35], T.design[0] + 0.06, 0);
D.seg([0, 0.03, 3.0], [60, 0.03, 3.0], T.design[0] + 0.06, 0);
D.seg([-9, 0.03, -HC + 0.036], [-9, 0.03, HC - 0.036], T.design[0] + 0.07, 0);
for (const x of [-12, 58]) { D.seg([x, 0.03, -3.5], [x, 0.03, 3.5], T.design[1] - 0.03, 0); D.seg([x - 0.6, 0.03, 3.5], [x + 0.6, 0.03, 3.5], T.design[1] - 0.03, 0); }
const cadDesign = D.build();
const CADS = [cadSurvey, cadOptA, cadOptB, cadOptC, cadDesign];

// ---------- labels ----------
const LABELS = [
  { t: 'Survey control', p: [8, 0, 4], w: [T.survey[0] + 0.04, T.survey[1] + 0.01] },
  { t: 'Site boundary', p: [62, 0, -4], w: [T.survey[0] + 0.05, T.survey[1] + 0.01] },
  { t: 'Option A', p: [28, 0, vcR(28, 120)], w: [T.options[0] + 0.03, T.select[0] + 0.005] },
  { t: 'Option B', p: [44, 0, vc(44)], w: [T.options[0] + 0.04, T.select[0] + 0.005] },
  { t: 'Option C', p: [56, 0, vcR(56, 320)], w: [T.options[0] + 0.05, T.select[0] + 0.005] },
  { t: 'Option B selected', p: [44, 0, vc(44)], w: [T.select[0] + 0.005, T.design[0] + 0.02] },
  { t: 'Gauge 1435 mm', p: [-9, 0, -HC], w: [T.design[0] + 0.07, T.design[1]] },
  { t: 'Worksite limit', p: [58, 0, 3.5], w: [T.design[1] - 0.025, T.descend[0] + 0.03] },
  { t: 'Formation', p: [6, -0.42, -4.6], w: [T.formation[0] + 0.01, T.bottom[0] + 0.01] },
  { t: 'Bottom ballast', p: [6, 0, -3.6], w: [T.bottom[0] + 0.01, T.bearers[0] + 0.01] },
  { t: 'Bearers', p: [10, 0.2, vc(10) - HC - 0.6], w: [T.bearers[0] + 0.01, T.bearers[1]] },
  { t: 'Switch blades', p: [4.5, 0.4, -HC + 0.03], w: [T.blades[0], T.closure[1]] },
  { t: 'Crossing', p: [uX + 0.3, 0.4, -HC], w: [T.crossing[0], T.check[1]] },
  { t: 'Top ballast', p: [14, 0.17, 2.2], w: [T.top[0] + 0.005, T.top[1]] },
  { t: 'Tamping', p: [0, 0.4, 0], dyn: 'tamp', w: [T.tamp[0], T.tamp[1]] },
  { t: 'Test & commission', p: [0, 0.4, -HC], dyn: 'test', w: [T.test[0], T.test[1]] },
  { t: 'Handed back', p: [uX + 6, 0.4, vc(uX + 6)], w: [T.close[0] + 0.02, T.close[1] - 0.005] },
];
for (const L of LABELS) { const d = document.createElement('div'); d.className = 'xp-label'; d.textContent = L.t; labelsEl.appendChild(d); L.el = d; L.v = new THREE.Vector3(...L.p); }

// ---------- camera ----------
// [progress, targetX, targetZ, distance, elevation°, azimuth°, fov]
const KEYS = [
  [0.00, 22, -3, 104, 86, -42, 30],
  [0.12, 21, -3, 92, 84, -38, 30],
  [0.25, 19, -3, 88, 80, -34, 30],
  [0.37, 16, -3, 86, 74, -30, 31],
  [0.45, 15, -3, 52, 38, -36, 34],
  [0.52, 13, -2.5, 44, 32, -30, 35],
  [0.60, 12, -2.5, 38, 28, -24, 36],
  [0.70, 13, -2.5, 30, 24, -16, 38],
  [0.765, 8, -1.5, 15, 20, -10, 40],
  [0.83, 16, -1.5, 11, 16, 8, 40],
  [0.89, 27, -2.5, 9.5, 15, 36, 40],
  [0.95, 28, -3, 40, 44, 52, 34],
  [1.00, 28, -3, 58, 58, 60, 32],
];
const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
function camAt(p) {
  let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
  const k0 = KEYS[Math.max(0, i - 1)], k1 = KEYS[i], k2 = KEYS[i + 1], k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
  const t = ease(clamp((p - k1[0]) / (k2[0] - k1[0])));
  return [1, 2, 3, 4, 5, 6].map(j => cr(k0[j], k1[j], k2[j], k3[j], t));
}
let viewW = 1, viewH = 1, aspect = 1;
function placeCamera(p) {
  let [tx, tz, d, el, az, fov] = camAt(p);
  if (aspect < 1) { d *= lerp(1, 1.55, clamp((1 - aspect) / 0.5)); fov += 6; }
  const e = THREE.MathUtils.degToRad(el), a = THREE.MathUtils.degToRad(az);
  camera.fov = fov;
  camera.position.set(tx - Math.cos(e) * Math.cos(a) * d, Math.sin(e) * d, tz + Math.cos(e) * Math.sin(a) * d);
  camera.lookAt(tx, 0, tz);
  const shift = 1 - 0.7 * win(p, T.close[0], T.close[1], 0.02) - span(p, 0.9, 0.95) * 0.6;
  if (aspect >= 1) camera.setViewOffset(viewW, viewH, -viewW * 0.17 * shift, 0, viewW, viewH);
  else camera.setViewOffset(viewW, viewH, 0, -viewH * 0.17 * shift, viewW, viewH);
  camera.updateProjectionMatrix();
}

// ---------- apply state ----------
const dummy = new THREE.Object3D();
const tmpV = new THREE.Vector3();
let testX = -1e4, tampX = -1e4;
function setBed(mesh, k, rise) {
  mesh.visible = k > 0.001; mesh.material.opacity = k; mesh.material.transparent = k < 0.999; mesh.material.depthWrite = k > 0.5;
  mesh.position.y = -(1 - easeOut(k)) * rise;
}
function apply(p) {
  // earthworks
  setBed(formation, ease(span(p, ...T.formation)), 0.6);
  setBed(bottomBallast, ease(span(p, ...T.bottom)), 0.35);
  setBed(topBallast, ease(span(p, ...T.top)), 0.22);
  // bearers drop into place on the bottom ballast
  for (let i = 0; i < BEARERS.length; i++) {
    const b = BEARERS[i], k = easeOut(clamp((p - b.birth) / 0.012));
    dummy.position.set(b.cx, (1 - k) * 1.4, b.cz); dummy.rotation.set(0, b.rot, 0);
    if (k <= 0) dummy.scale.setScalar(0.0001); else dummy.scale.set(0.26, 1, b.len);
    dummy.updateMatrix(); bearerMesh.setMatrixAt(i, dummy.matrix);
  }
  bearerMesh.instanceMatrix.needsUpdate = true;
  // rails extend along the track
  for (const r of RAILS) { const k = ease(span(p, ...r.w)); r.uni.reveal.value = k <= 0 ? -1e4 : k >= 1 ? 1e4 : lerp(r.x0, r.x1, k); r.mesh.visible = k > 0; }
  // baseplates and clips
  for (let i = 0; i < PLATES.length; i++) {
    const q = PLATES[i], k = clamp((p - q.birth) / 0.01);
    dummy.position.set(q.x, (1 - k) * 0.5, q.z); dummy.rotation.set(0, q.rot, 0); dummy.scale.setScalar(k > 0 ? 1 : 0.0001); dummy.updateMatrix(); plateMesh.setMatrixAt(i, dummy.matrix);
    for (let c = 0; c < 2; c++) {
      const side = c ? 1 : -1, kc = clamp((p - q.birth - 0.006) / 0.01);
      dummy.position.set(q.x + Math.sin(q.rot) * side * 0.105, (1 - kc) * 0.4, q.z + Math.cos(q.rot) * side * 0.105);
      dummy.rotation.set(0, q.rot + (side > 0 ? Math.PI : 0), 0); dummy.scale.setScalar(kc > 0 ? 1 : 0.0001); dummy.updateMatrix(); clipMesh.setMatrixAt(i * 2 + c, dummy.matrix);
    }
  }
  plateMesh.instanceMatrix.needsUpdate = clipMesh.instanceMatrix.needsUpdate = true;
  barMeshes.forEach(m => m.visible = p > T.blades[1]);
  // tamping band and test pulse
  const kt = span(p, ...T.tamp); tampX = lerp(U0, U1, kt);
  const tv = win(p, ...T.tamp, 0.006);
  tampMat.opacity = 0.32 * tv; tamp.position.set(tampX, 0.42, 0); tamp2.position.set(tampX, 0.42, vc(tampX)); tamp2.rotation.y = Math.PI / 2 - Math.atan(-dvc(tampX)); tamp2.visible = tampX > 4;
  const ks = span(p, ...T.test); testX = ks > 0 && ks < 1 ? lerp(U0, U1, ks) : -1e4; TEST.value = testX;
  // CAD drawing: draws in during phases 1–3, then fades as the physical railway is built over it
  const cadFade = 1 - 0.85 * ease(span(p, 0.44, 0.56)) + 0.5 * span(p, 0.93, 1);
  for (const c of CADS) c.material.uniforms.uP.value = p;
  cadSurvey.material.uniforms.uFade.value = cadFade * (1 - 0.6 * span(p, T.options[0], T.options[1]));
  const optOff = 1 - ease(span(p, ...T.select));
  cadOptA.material.uniforms.uFade.value = optOff; cadOptC.material.uniforms.uFade.value = optOff;
  cadOptB.material.uniforms.uFade.value = cadFade * (1 + 0.8 * win(p, T.select[0], T.design[0] + 0.03, 0.01));
  cadDesign.material.uniforms.uFade.value = cadFade;
  // lighting comes up for delivery
  const lit = ease(span(p, T.descend[0], T.descend[1]));
  key.intensity = 3.4 * lit; hemi.intensity = 0.25 + 0.3 * lit; rim.intensity = 1.6 * lit; scene.environmentIntensity = 0.35 * lit;
  const away = ease(span(p, 0.93, 0.99));
  scene.fog.density = 0.0042 + 0.012 * away; renderer.toneMappingExposure = 1.05 - 0.35 * away;
  placeCamera(p);
}

// ---------- UI ----------
const PHASES = ['Project initiation', 'Development & selection', 'Project design', 'Project delivery', 'Project close', 'How STH helps'];
function ui(p) {
  barEl.style.transform = `scaleX(${p.toFixed(4)})`;
  let active = 0, vis = 0;
  stages.forEach((s, i) => {
    const a = +s.dataset.from, b = +s.dataset.to, last = i === stages.length - 1;
    const o = last ? span(p, a, a + 0.03) : (i === 0 ? 1 - span(p, b - 0.03, b) : win(p, a, b, 0.03));
    s.style.opacity = o.toFixed(3); s.style.transform = `translateY(${((1 - o) * 18).toFixed(1)}px)`;
    s.style.visibility = o > 0.01 ? 'visible' : 'hidden'; s.inert = o < 0.5;
    if (p >= a - 0.01) active = i; vis = Math.max(vis, o);
  });
  stageEl.style.setProperty('--veil', (0.25 + 0.75 * vis).toFixed(3));
  stageNumEl.textContent = active < 5 ? `PACE ${active + 1} / 5 · ${PHASES[active]}` : PHASES[5];
  dots.forEach((d, i) => d.setAttribute('aria-current', i === active ? 'step' : 'false'));
  steps.forEach(li => { const a = +li.dataset.a, b = +li.dataset.b; li.classList.toggle('now', p >= a && p < b); li.classList.toggle('done', p >= b); });
  for (const L of LABELS) {
    const o = win(p, L.w[0], L.w[1], 0.012);
    if (o <= 0.01) { L.el.style.opacity = 0; continue; }
    if (L.dyn === 'tamp') L.v.set(tampX, 0.5, 0); if (L.dyn === 'test') L.v.set(testX, 0.45, -HC);
    tmpV.copy(L.v).project(camera);
    if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.2 || Math.abs(tmpV.y) > 1.2) { L.el.style.opacity = 0; continue; }
    const x = (tmpV.x * 0.5 + 0.5) * viewW, y = (-tmpV.y * 0.5 + 0.5) * viewH;
    if (!L.w0) L.w0 = L.el.offsetWidth + 24;
    L.el.classList.toggle('flip', x > viewW - L.w0);
    L.el.style.opacity = o.toFixed(2); L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

// ---------- loop ----------
function resize() {
  const r = stageEl.getBoundingClientRect(); viewW = Math.max(1, r.width); viewH = Math.max(1, r.height); aspect = viewW / viewH;
  renderer.setSize(viewW, viewH, false); camera.aspect = aspect; dirty = true;
}
let target = 0, cur = 0, dirty = true, visible = true, raf = 0, last = performance.now();
const scrollProgress = () => { const r = root.getBoundingClientRect(), total = r.height - innerHeight; return total > 0 ? clamp(-r.top / total) : 0; };
const kick = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };
let slow = 0, frames = 0, degraded = false;
function frame(now) {
  raf = 0;
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const diff = target - cur;
  cur = Math.abs(diff) < 0.0003 ? target : cur + diff * (1 - Math.exp(-dt * 8));
  apply(cur); ui(cur); renderer.render(scene, camera);
  frames++; if (dt > 0.045) slow++;
  if (!degraded && frames > 40 && slow > 18) { degraded = true; renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; key.castShadow = false; MATS.forEach(m => m.needsUpdate = true); resize(); }
  if (cur !== target || dirty) { dirty = false; raf = requestAnimationFrame(frame); }
}
new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }, { rootMargin: '200px' }).observe(root);
addEventListener('scroll', () => { target = scrollProgress(); kick(); }, { passive: true });
addEventListener('resize', () => { resize(); target = scrollProgress(); kick(); });
dots.forEach(d => d.addEventListener('click', () => { const r = root.getBoundingClientRect(), total = r.height - innerHeight; scrollTo({ top: scrollY + r.top + total * +d.dataset.p, behavior: 'smooth' }); }));
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fallback('context-lost'); });

resize();
target = cur = scrollProgress();
apply(cur); ui(cur); renderer.render(scene, camera);
root.classList.add('xp-ready');
window.__xp = { set(p) { target = cur = p; apply(p); ui(p); renderer.render(scene, camera); }, info: () => renderer.info };
