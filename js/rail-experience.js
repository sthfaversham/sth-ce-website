// STH Construction & Engineering: a railway turnout taken through the Network Rail PACE lifecycle as you scroll.
// Concept visualisation, illustrative geometry. Units are metres.
// x = along the main line from the switch toe, z = across (diverging side negative), y = up.
// Everything is procedural (no model or texture downloads) so the page stays light.
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
const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const span = (p, a, b) => clamp((p - a) / (b - a));
const win = (p, a, b, f = 0.015) => Math.min(span(p, a, a + f), 1 - span(p, b - f, b));
const DEG = Math.PI / 180;

// ---------- timeline (scroll progress 0..1) ----------
// PACE phases: 1 Project initiation, 2 Development & project selection, 3 Project design, 4 Project delivery, 5 Project close.
const T = {
  scan: [0.0, 0.075], survey: [0.012, 0.1], options: [0.11, 0.17], select: [0.17, 0.2], design: [0.2, 0.29], extrude: [0.285, 0.345],
  descend: [0.345, 0.395],
  formation: [0.39, 0.42], bottom: [0.42, 0.45], bearers: [0.45, 0.505],
  stock: [0.505, 0.54], blades: [0.53, 0.555], closure: [0.54, 0.565],
  crane: [0.545, 0.64], crossing: [0.605, 0.628], check: [0.618, 0.638],
  fixings: [0.625, 0.65], train: [0.635, 0.76], top: [0.655, 0.725],
  tamp: [0.73, 0.795], test: [0.8, 0.83],
  close: [0.84, 0.91], services: [0.92, 1],
};

// ---------- geometry (illustrative; same turnout as the site's design-check drawing) ----------
const G = 1.435, R = 190, HC = G / 2 + 0.036;
const uX = Math.sqrt(2 * R * G - G * G);
const TA = uX / Math.sqrt(R * R - uX * uX);
const U0 = -30, U1 = 78;           // extent of the new-build worksite
const BX0 = U0 - 1, BX1 = U1 + 1;  // earthworks extent
const vcR = (u, r) => { const ux = Math.sqrt(2 * r * G - G * G), ta = ux / Math.sqrt(r * r - ux * ux); return u <= 0 ? 0 : u <= ux ? -(r - Math.sqrt(r * r - u * u)) : -(G + (u - ux) * ta); };
const vc = u => vcR(u, R);
const dvc = u => u <= 0 ? 0 : u <= uX ? -u / Math.sqrt(R * R - u * u) : -TA;
const HEEL = 10.5, THROAT = uX - 2.1, FW = 0.112;
const RAIL_Y = 0.235, RAIL_TOP = RAIL_Y + 0.16;

const isMobile = matchMedia('(max-width: 760px)').matches;
const lowPower = isMobile || (navigator.hardwareConcurrency || 8) <= 4;
const DPR = Math.min(devicePixelRatio || 1, isMobile ? 1.75 : 2);

// ---------- renderer ----------
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { fallback('webgl'); throw e; }
if (!renderer.getContext()) { fallback('webgl'); throw new Error('no webgl'); }
renderer.setPixelRatio(DPR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const NAVY = new THREE.Color(0x061019);
const CYAN = new THREE.Color(0x4fd3f0);
const scene = new THREE.Scene();
scene.background = NAVY.clone();
scene.fog = new THREE.FogExp2(NAVY.getHex(), 0.004);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 900);

const hemi = new THREE.HemisphereLight(0x6f9bb2, 0x0a1218, 0);
const key = new THREE.DirectionalLight(0xfff1de, 0);
key.position.set(-18, 34, 22); key.target.position.set(20, 0, -3);
key.castShadow = true;
key.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
Object.assign(key.shadow.camera, { left: -60, right: 60, top: 36, bottom: -36, near: 1, far: 150 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
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
const ballastTex = canvasTex(512, stones(21, '#242424', 62, 132), [(BX1 - BX0) * 0.6, 13]);
const formationTex = canvasTex(256, (g, n) => {
  const r = rand(3); g.fillStyle = '#4a3c30'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 6000; i++) { const v = r(); g.fillStyle = `rgba(${90 + v * 60 | 0},${72 + v * 45 | 0},${55 + v * 35 | 0},0.5)`; g.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); }
}, [(BX1 - BX0) * 0.36, 10]);
const groundTex = canvasTex(256, (g, n) => {
  const r = rand(11); g.fillStyle = '#1d2219'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 9000; i++) { const v = r(); g.fillStyle = `rgba(${40 + v * 40 | 0},${48 + v * 42 | 0},${32 + v * 24 | 0},0.55)`; g.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 3); }
}, [90, 30]);
const glowTex = canvasTex(128, (g, n) => {
  const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, n, n);
});

// ---------- materials ----------
const MATS = [];
function phys(opts) { const m = new THREE.MeshStandardMaterial(opts); MATS.push(m); return m; }
const matRailSide = phys({ color: 0x5b4a40, metalness: 0.55, roughness: 0.72 });
const matRailHead = phys({ color: 0xaeb7bd, metalness: 1.0, roughness: 0.3 });
const matConcrete = phys({ color: 0xa9aba4, roughness: 0.92, metalness: 0, map: concreteTex });
const matPlate = phys({ color: 0x30353a, roughness: 0.55, metalness: 0.6 });
const matClip = phys({ color: 0x2c3329, roughness: 0.55, metalness: 0.5 });
const matBar = phys({ color: 0x3a3f44, roughness: 0.5, metalness: 0.7 });
const matPlant = phys({ vertexColors: true, roughness: 0.66, metalness: 0.18 });
const matLamp = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

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
const gw = isMobile ? 260 : 420, gh = isMobile ? 70 : 110;
const distTrack = (x, z) => Math.min(Math.abs(z), Math.abs(z - vc(x)), (x < uX + 14 && z > vc(x) && z < 0) ? 0 : 99);
function bed(fn, colFn) {
  const geo = new THREE.PlaneGeometry(BX1 - BX0, 24, gw, gh); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), r = rand(5);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + (BX0 + BX1) / 2, z = p.getZ(i) - 2.5, d = distTrack(x, z);
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
// top ballast is laid behind the ballast train's discharge chutes
const DROP = { value: -1e4 };
topBallast.material.onBeforeCompile = sh => {
  sh.uniforms.uDrop = DROP;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWXZ = (modelMatrix * vec4(transformed,1.0)).xz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWXZ; uniform float uDrop;')
    .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vWXZ.x > uDrop + 0.5 * sin(vWXZ.y * 3.1) + 0.35 * sin(vWXZ.y * 7.3 + 1.7)) discard;');
};
// the wider site: dark ground, plus the existing railway either side of the worksite
const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 300).rotateX(-Math.PI / 2), phys({ color: 0x8a8f86, map: groundTex, roughness: 1, metalness: 0 }));
ground.position.set(25, -0.66, -3); ground.receiveShadow = true; ground.visible = false; scene.add(ground);

const LEGS = [];
const PL = 300;
function plainLeg(x0, z0, dirX, dirZ, len, skip = 1) {
  const yaw = Math.atan2(-dirZ, dirX), g = new THREE.Group(); g.position.set(x0, 0, z0); g.rotation.y = yaw;
  // ballast shoulder profile, low resolution across, very low along
  const bg = new THREE.PlaneGeometry(len, 11, 6, 22); bg.rotateX(-Math.PI / 2); bg.translate(len / 2 + skip, 0, 0);
  const p = bg.attributes.position, r = rand(9), col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const d = Math.abs(p.getZ(i)); p.setY(i, topBallastY(d, r)); const c = fadeOut(d); col.set([c * 0.95, c, c * 0.97], i * 3); }
  bg.setAttribute('color', new THREE.BufferAttribute(col, 3)); bg.computeVertexNormals();
  const bt = ballastTex.clone(); bt.repeat.set(len * 0.6, 6); bt.needsUpdate = true;
  const bm = new THREE.Mesh(bg, phys({ vertexColors: true, color: 0xa7a3a0, map: bt, roughness: 0.95, metalness: 0 })); bm.receiveShadow = true; g.add(bm);
  const n = Math.floor(len / 0.65), sl = new THREE.InstancedMesh(bearerGeo, matConcrete, n), d = new THREE.Object3D();
  for (let i = 0; i < n; i++) { d.position.set(0.95 + i * 0.65, 0, 0); d.scale.set(0.26, 1, 2.6); d.updateMatrix(); sl.setMatrixAt(i, d.matrix); }
  sl.receiveShadow = true; g.add(sl);
  for (const s of [-HC, HC]) { const m = new THREE.Mesh(sweepRail([[0, s], [len, s]]), [matRailSide, matRailHead]); m.castShadow = true; g.add(m); }
  g.visible = false; scene.add(g); LEGS.push(g);
}
plainLeg(U0, 0, -1, 0, PL);                                   // approach
plainLeg(U1, 0, 1, 0, PL);                                    // main line onward
{ const l = Math.hypot(1, TA); plainLeg(U1, vc(U1), 1 / l, -TA / l, 160); } // diverging route onward

// ---------- plant (simple merged kits: one mesh per vehicle, one for its lamps) ----------
function kit() {
  const parts = [];
  function push(g, x, y, z, col, ry = 0, rz = 0) {
    g = g.index ? g.toNonIndexed() : g; if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z);
    g.deleteAttribute('uv'); const c = new THREE.Color(col), n = g.attributes.position.count, ca = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) ca.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); parts.push(g);
  }
  const api = {
    box(w, h, d, x, y, z, col, ry, rz) { push(new THREE.BoxGeometry(w, h, d), x, y, z, col, ry, rz); return api; },
    cyl(r, len, x, y, z, col, axis = 'z', seg = 12) { const g = new THREE.CylinderGeometry(r, r, len, seg); if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(Math.PI / 2); push(g, x, y, z, col); return api; },
    wheelset(x, r = 0.45) { for (const s of [-1, 1]) api.cyl(r, 0.14, x, RAIL_TOP + r - 0.02, s * 0.74, '#1b1d1f', 'z', 14); api.cyl(0.08, 1.4, x, RAIL_TOP + r - 0.02, 0, '#3a3d40'); return api; },
    mesh(mat = matPlant, shadow = true) {
      let n = 0; for (const g of parts) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
      for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = shadow; return m;
    },
  };
  return api;
}
const YEL = '#d99a12', YEL2 = '#b57f10', DK = '#1f2327', GRY = '#4a5157', WIN = '#0a141b', STEEL = '#8d959b';
function vehicle(build, lamps) { const g = new THREE.Group(); const k = kit(); build(k); g.add(k.mesh()); if (lamps) { const l = kit(); lamps(l); g.add(l.mesh(matLamp, false)); } g.visible = false; scene.add(g); return g; }
function bogie(k, x, axles) { k.box(axles * 1.5 + 0.6, 0.42, 2.3, x, 1.02, 0, DK); const s = (axles - 1) / 2 * 1.5; for (let i = 0; i < axles; i++) k.wheelset(x - s + i * 1.5); }
function windowsBand(k, x, len, y, w = 3.04) { k.box(len, 0.8, w, x, y, 0, WIN); }

// S&C tamper (front at +13)
const tamper = vehicle(k => {
  k.box(26.4, 0.45, 2.8, 0, 1.45, 0, DK);
  bogie(k, -9.6, 2); bogie(k, 9.6, 2);
  k.box(13.2, 2.4, 3.0, -4.9, 2.85, 0, YEL);                 // machinery housing
  k.box(12.6, 0.12, 3.06, -4.9, 2.0, 0, DK);                 // skirt line
  k.box(5.6, 0.55, 1.9, -6.2, 4.3, 0, GRY); k.cyl(0.16, 1.0, -9.5, 4.6, 0.6, DK, 'y');
  k.box(4.2, 2.8, 3.0, 11.0, 3.05, 0, YEL); windowsBand(k, 11.0, 3.6, 3.75); k.box(0.08, 0.95, 2.6, 13.12, 3.75, 0, WIN);
  k.box(4.0, 2.8, 3.0, -11.0, 3.05, 0, YEL); windowsBand(k, -11.0, 3.4, 3.75); k.box(0.08, 0.95, 2.6, -13.02, 3.75, 0, WIN);
  k.box(6.6, 0.55, 3.0, 5.6, 4.15, 0, YEL);                  // bridge over the tamping units
  for (const x of [2.5, 8.7]) for (const s of [-1, 1]) k.box(0.3, 2.3, 0.3, x, 2.85, s * 1.35, YEL2);
  k.box(1.6, 0.5, 2.4, 8.0, 1.05, 0, GRY);                   // lifting & lining unit
  for (const x of [-13.25, 13.25]) { k.box(0.25, 0.55, 2.8, x, 1.35, 0, DK); for (const s of [-1, 1]) k.cyl(0.14, 0.4, x + Math.sign(x) * 0.25, 1.35, s * 0.95, STEEL, 'x'); }
  for (let i = 0; i < 9; i++) k.box(0.5, 0.42, 0.04, 13.13, 1.62 + 0, -1.2 + i * 0.3, i % 2 ? DK : YEL);
}, l => {
  for (const s of [-1, 1]) { l.box(0.08, 0.2, 0.32, 13.15, 2.15, s * 0.95, '#fff6e0'); l.box(0.08, 0.16, 0.2, -13.05, 2.15, s * 0.95, '#ff3020'); }
  for (const x of [11.0, -11.0]) l.cyl(0.12, 0.22, x, 4.56, 1.05, '#ffa21a', 'y');
  l.box(0.08, 0.12, 0.12, 13.15, 4.15, 0, '#fff6e0');
});
const tampHead = kit();
for (const s of [-1, 1]) {
  tampHead.box(1.1, 1.3, 0.62, 0, 2.05, s * 0.74, YEL2);
  tampHead.box(1.3, 0.2, 0.8, 0, 1.38, s * 0.74, DK);
  for (const dx of [-0.36, 0.36]) for (const dz of [-0.24, 0.24]) tampHead.box(0.07, 1.05, 0.07, dx, 0.82, s * 0.74 + dz, STEEL);
}
const tampHeadMesh = tampHead.mesh(); tampHeadMesh.position.x = 5.6; tamper.add(tampHeadMesh);
const workGlow = new THREE.Mesh(new THREE.PlaneGeometry(9, 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffc27a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
workGlow.position.set(5.6, 0.42, 0); tamper.add(workGlow);

// Ballast train: locomotive (front at x = 0) and three autoballaster hoppers behind it
const LOCO = 21, HOP = 14, NHOP = 3;
const train = new THREE.Group(); train.visible = false; scene.add(train);
const loco = vehicle(k => {
  k.box(21, 0.5, 2.7, 0, 1.45, 0, DK); bogie(k, -6.9, 3); bogie(k, 6.9, 3);
  k.box(6, 0.8, 2.2, 0, 0.95, 0, DK);
  k.box(19.7, 2.4, 2.66, 0, 2.9, 0, '#33414d'); k.box(19.1, 0.3, 2.3, 0, 4.2, 0, GRY);
  k.box(19.72, 0.22, 2.68, 0, 2.15, 0, '#b9c3c9');
  for (const s of [-1, 1]) { k.box(0.1, 1.55, 2.5, s * 9.88, 2.55, 0, YEL); k.box(0.1, 0.75, 2.3, s * 9.9, 3.55, 0, WIN); k.box(0.3, 0.55, 2.7, s * 10.4, 1.4, 0, DK); }
  k.box(2.2, 0.8, 2.7, 7.6, 3.55, 0, WIN); k.box(2.2, 0.8, 2.7, -7.6, 3.55, 0, WIN);
}, l => { for (const s of [-1, 1]) l.box(0.08, 0.2, 0.3, 9.95, 1.95, s * 0.9, '#fff4dc'); });
loco.position.x = -LOCO / 2; loco.visible = true; train.add(loco);
const hopperXs = [];
for (let i = 0; i < NHOP; i++) {
  const h = vehicle(k => {
    k.box(14, 0.4, 2.7, 0, 1.3, 0, DK); bogie(k, -4.8, 2); bogie(k, 4.8, 2);
    k.box(10.6, 1.1, 2.0, 0, 2.0, 0, YEL2); k.box(13.2, 1.5, 2.95, 0, 3.15, 0, YEL);
    k.box(12.8, 0.28, 2.7, 0, 3.98, 0, '#6d6a66');
    for (let j = -2; j <= 2; j++) k.box(0.08, 1.52, 3.0, j * 2.6, 3.15, 0, YEL2);
    for (const z of [-1.15, 0, 1.15]) k.box(0.7, 0.5, 0.45, 0, 1.22, z, DK);
    for (const s of [-1, 1]) k.box(0.4, 0.3, 0.3, s * 7.1, 1.4, 0, DK);
  });
  h.visible = true; const x = -LOCO - HOP / 2 - i * HOP; h.position.x = x; hopperXs.push(x); train.add(h);
}
const TRAIN_LEN = LOCO + HOP * NHOP;
// falling ballast
const NROCK = lowPower ? 220 : 420;
const rockMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), phys({ color: 0x9a968f, roughness: 0.9 }), NROCK);
rockMesh.visible = false; scene.add(rockMesh);
const ROCKS = []; { const r = rand(42); for (let i = 0; i < NROCK; i++) ROCKS.push({ h: i % NHOP, lane: (i / NHOP | 0) % 3, ph: r(), s: 0.09 + r() * 0.09, dz: (r() - 0.5) * 0.5, rx: r() * 6, ry: r() * 6, sp: 0.7 + r() * 0.6 }); }

// Mobile crane beside the crossing: carrier, slewing superstructure, telescopic boom, hook and rigging
const CRANE_AT = new THREE.Vector3(uX + 4, -0.62, 9.6);
const crane = new THREE.Group(); crane.position.copy(CRANE_AT); crane.visible = false; scene.add(crane);
{
  const k = kit();
  k.box(13, 1.15, 2.6, 0, 1.45, 0, YEL); k.box(2.3, 1.8, 2.55, 5.4, 2.6, 0, YEL); k.box(2.32, 0.75, 2.58, 5.4, 3.0, 0, WIN); k.box(0.08, 0.8, 2.2, 6.56, 3.0, 0, WIN);
  for (const x of [-4.4, -2.8, 1.4, 3.0, 4.6]) for (const s of [-1, 1]) k.cyl(0.62, 0.5, x, 0.62, s * 1.15, '#17191b', 'z', 14);
  for (const x of [-4.6, 3.8]) { k.box(0.35, 0.35, 7.4, x, 0.95, 0, DK); for (const s of [-1, 1]) { k.box(0.3, 0.9, 0.3, x, 0.5, s * 3.55, DK); k.box(0.9, 0.08, 0.9, x, 0.04, s * 3.55, GRY); } }
  const m = k.mesh(); crane.add(m);
}
const slew = new THREE.Group(); slew.position.set(-2.0, 2.05, 0); crane.add(slew);
{
  const k = kit();
  k.cyl(1.2, 0.3, 0, 0.15, 0, DK, 'y', 18); k.box(5.4, 1.4, 2.5, -1.2, 1.0, 0, YEL); k.box(1.8, 1.5, 2.5, -3.6, 0.95, 0, GRY);
  k.box(1.7, 1.7, 1.0, 1.4, 1.15, 1.25, YEL); k.box(1.72, 0.7, 1.02, 1.4, 1.45, 1.25, WIN);
  slew.add(k.mesh());
}
const boom = new THREE.Group(); boom.position.set(0.6, 1.6, 0); slew.add(boom);
const boomBase = kit().box(1, 0.85, 0.75, 0.5, 0, 0, YEL).mesh(); boomBase.scale.x = 11; boom.add(boomBase);
const boomTele = kit().box(1, 0.6, 0.55, 0.5, 0, 0, YEL2).mesh(); boom.add(boomTele);
const boomHead = kit().box(0.9, 0.9, 0.6, 0, 0, 0, DK).mesh(); boom.add(boomHead);
const ropeMat = new THREE.MeshBasicMaterial({ color: 0x15181b });
const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6).translate(0, -0.5, 0), ropeMat); rope.visible = false; scene.add(rope);
const rig = new THREE.Group(); rig.visible = false; scene.add(rig);
{
  const k = kit(); k.box(0.45, 0.65, 0.35, 0, -0.3, 0, YEL); k.box(0.2, 0.3, 0.1, 0, -0.75, 0, DK); k.box(5.2, 0.2, 0.22, 0, -1.6, 0, '#c43a2a'); rig.add(k.mesh());
  const sl = []; for (const sx of [-2.4, 2.4]) { sl.push(0, -0.8, 0, sx, -1.5, 0); for (const sz of [-0.38, 0.38]) sl.push(sx, -1.7, 0, sx * 1.1, -3.7, sz); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(sl, 3));
  rig.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2f33 })));
}
const XING_C = new THREE.Vector3(uX, 0.2, -HC);              // landed position (nose point, underside)
const XING_LAY = new THREE.Vector3(uX + 13, -0.62, 13.2);    // laydown area on the cess
const xing = (() => {
  const k = kit(), a = Math.atan(TA), rl = (x0, z0, len, ang) => { const c = Math.cos(ang), sn = Math.sin(ang); k.box(len, 0.16, 0.072, x0 + c * len / 2, 0.115, z0 - sn * len / 2, '#a9b1b6', ang); k.box(len, 0.03, 0.15, x0 + c * len / 2, 0.05, z0 - sn * len / 2, '#4b4440', ang); };
  rl(0, 0, 5, 0); rl(0, 0, 5, a);
  rl(-4, FW + 0.02, 5.2, 0); rl(-4, -FW - 0.02, 5.2, a * 0.6);
  for (let i = -3; i <= 4; i++) k.box(0.26, 0.035, 2.2, i * 0.65, 0.018, -0.2 - i * 0.05, '#3b3f43');
  const m = k.mesh(); m.material = phys({ vertexColors: true, roughness: 0.45, metalness: 0.7 }); m.visible = false; scene.add(m); return m;
})();
const RIG_DROP = 3.6;

// ---------- CAD: crisp screen-space lines with a soft glow ----------
const RES = new THREE.Vector2(1, 1);
const lineQuad = new THREE.InstancedBufferGeometry();
lineQuad.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
lineQuad.setIndex([0, 1, 2, 0, 2, 3]);
function cadLayer() {
  const A = [], B = [], birth = [], kind = [];
  const api = {
    seg(a, b, t, k = 0) { A.push(...a); B.push(...b); birth.push(t); kind.push(k); },
    poly(pts, t0, t1, k = 0, y = 0.03) { for (let i = 0; i < pts.length - 1; i++) api.seg([pts[i][0], y, pts[i][1]], [pts[i + 1][0], y, pts[i + 1][1]], lerp(t0, t1, i / (pts.length - 1)), k); },
    dash(fn, a, b, t0, t1, k = 1, y = 0.03) { for (let u = a; u < b; u += 1.6) api.seg([u, y, fn(u)], [u + 1, y, fn(u + 1)], lerp(t0, t1, (u - a) / (b - a)), k); },
    build(color = CYAN, width = 1) {
      const g = new THREE.InstancedBufferGeometry(); g.index = lineQuad.index; g.attributes.position = lineQuad.attributes.position;
      g.setAttribute('iA', new THREE.InstancedBufferAttribute(new Float32Array(A), 3));
      g.setAttribute('iB', new THREE.InstancedBufferAttribute(new Float32Array(B), 3));
      g.setAttribute('iBirth', new THREE.InstancedBufferAttribute(new Float32Array(birth), 1));
      g.setAttribute('iKind', new THREE.InstancedBufferAttribute(new Float32Array(kind), 1));
      g.instanceCount = birth.length;
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
        uniforms: { uP: { value: 0 }, uFade: { value: 1 }, uColor: { value: color.clone() }, uRes: { value: RES }, uW: { value: 3.2 * DPR * width } },
        vertexShader: `attribute vec3 iA; attribute vec3 iB; attribute float iBirth; attribute float iKind;
          uniform vec2 uRes; uniform float uW; uniform float uP; varying float vSide; varying float vB; varying float vK; varying float vT;
          void main(){
            vB = iBirth; vK = iKind; vSide = position.y; vT = position.x;
            float grow = clamp((uP - iBirth) / 0.012, 0.0, 1.0);
            vec3 b3 = mix(iA, iB, grow);
            vec4 va = modelViewMatrix * vec4(iA, 1.0), vb = modelViewMatrix * vec4(b3, 1.0);
            float nz = -0.15;
            if (va.z > nz && vb.z > nz) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
            if (va.z > nz) va = mix(va, vb, (va.z - nz) / (va.z - vb.z));
            if (vb.z > nz) vb = mix(vb, va, (vb.z - nz) / (vb.z - va.z));
            vec4 ca = projectionMatrix * va, cb = projectionMatrix * vb;
            vec2 sa = ca.xy / ca.w * uRes, sb = cb.xy / cb.w * uRes;
            vec2 d = sb - sa; float l = length(d); vec2 dir = l > 1e-4 ? d / l : vec2(1.0, 0.0); vec2 n = vec2(-dir.y, dir.x);
            vec4 c = mix(ca, cb, position.x);
            float w = uW * (iKind > 2.5 ? 0.8 : 1.0);
            c.xy += (n * position.y * w + dir * (position.x * 2.0 - 1.0) * w * 0.5) / uRes * c.w;
            gl_Position = c;
          }`,
        fragmentShader: `uniform float uP; uniform float uFade; uniform vec3 uColor; uniform float uW; varying float vSide; varying float vB; varying float vK;
          void main(){
            if (vB > uP) discard;
            float d = abs(vSide);
            float core = 1.0 - smoothstep(0.22, 0.34, d);
            float glow = exp(-d * d * 7.0) * 0.32;
            float fresh = 1.0 - smoothstep(0.0, 0.03, uP - vB);
            float a = vK > 2.5 ? 0.42 : (vK > 0.5 ? 0.5 : 0.92);
            vec3 col = mix(uColor, vec3(1.0), 0.35 * core + 0.4 * fresh);
            gl_FragColor = vec4(col * (1.0 + fresh * 1.4), (core + glow) * (a + fresh * 0.5) * uFade);
          }`,
      });
      const l = new THREE.Mesh(g, m); l.frustumCulled = false; l.renderOrder = 5; scene.add(l); return l;
    },
  };
  return api;
}

// survey sheet: anti-aliased grid that is scanned in, with a laser sweep and a point cloud
const scanU = { value: -1e4 }, sheetFade = { value: 1 };
const sheet = new THREE.Mesh(new THREE.PlaneGeometry(150, 64).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uScan: scanU, uFade: sheetFade, uColor: { value: CYAN.clone() } },
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform float uScan; uniform float uFade; uniform vec3 uColor; varying vec3 vW;
    float grid(vec2 p, float s, float w){ vec2 c = p / s; vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
    void main(){
      vec2 p = vW.xz;
      float minor = grid(p, 1.0, 1.0), major = grid(p, 5.0, 1.3), big = grid(p, 25.0, 1.6);
      vec2 q = (p - vec2(24.0, -3.0)) / vec2(70.0, 30.0);
      float edge = 1.0 - smoothstep(0.55, 1.0, length(q));
      float shown = max(0.5, smoothstep(uScan + 0.5, uScan - 2.5, vW.x));
      float band = exp(-pow((vW.x - uScan) / 1.4, 2.0));
      float a = (minor * 0.06 + major * 0.14 + big * 0.16) * shown * edge + band * 0.3 * edge;
      gl_FragColor = vec4(uColor * (1.0 + band), a * uFade);
    }`,
}));
sheet.position.set(24, -0.02, -3); sheet.renderOrder = 1; scene.add(sheet);
const scanWall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uO: { value: 0 }, uColor: { value: CYAN.clone() } },
  vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform float uO; uniform vec3 uColor; varying vec2 vU; void main(){ float a = pow(1.0 - vU.y, 2.2) * (1.0 - pow(abs(vU.x - 0.5) * 2.0, 4.0)); gl_FragColor = vec4(uColor * 1.6, a * 0.5 * uO); }',
}));
scanWall.rotation.y = Math.PI / 2; scanWall.scale.set(34, 6, 1); scanWall.renderOrder = 6; scene.add(scanWall);
const terrainH = (x, z) => 0.42 * Math.sin(x / 9.0 + z / 7.0) + 0.22 * Math.sin(x / 4.3 - z / 3.1) + 0.12 * Math.sin(z / 2.2 + x / 13.0);
const NPTS = isMobile ? 5000 : 10000;
const cloud = (() => {
  const pos = new Float32Array(NPTS * 3), r = rand(77);
  for (let i = 0; i < NPTS; i++) { const x = -26 + r() * 102, z = -15.5 + r() * 25; pos.set([x, 0.15 + terrainH(x, z), z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uScan: scanU, uFade: { value: 0 }, uSize: { value: 3.4 * DPR }, uColor: { value: CYAN.clone() } },
    vertexShader: `uniform float uScan; uniform float uSize; varying float vA; varying float vH;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        float since = uScan - position.x; vA = since < 0.0 ? 0.22 : (0.5 + 1.4 * exp(-since * 0.6)); vH = position.y;
        gl_PointSize = clamp(uSize * 60.0 / -mv.z, 1.0, 6.0) * (1.0 + exp(-max(since,0.0) * 0.8)); }`,
    fragmentShader: `uniform float uFade; uniform vec3 uColor; varying float vA; varying float vH;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c,c); if (d > 0.25 || vA <= 0.0) discard;
        vec3 col = mix(uColor * 0.7, vec3(0.85, 0.98, 1.0), smoothstep(-0.4, 0.8, vH));
        gl_FragColor = vec4(col, (1.0 - d * 4.0) * vA * 0.9 * uFade); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4; scene.add(pts); return pts;
})();

// survey & constraints (phase 1)
const S1 = cadLayer();
const BOUND = [[-26, 6.5], [76, 6.5], [76, -13.5], [36, -13.5], [-26, -4.5], [-26, 6.5]];
for (let i = 0; i < BOUND.length - 1; i++) { const [a, b] = [BOUND[i], BOUND[i + 1]], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.4); for (let k = 0; k < n; k += 2) { const t0 = k / n, t1 = (k + 1) / n; S1.seg([lerp(a[0], b[0], t0), 0.03, lerp(a[1], b[1], t0)], [lerp(a[0], b[0], t1), 0.03, lerp(a[1], b[1], t1)], lerp(0.05, 0.085, (i + t0) / (BOUND.length - 1)), 1); } }
const CONTROL = [[-20, 4], [0, 4.5], [24, 4.6], [48, 3.6], [68, -11], [30, -11.5], [-12, -3]];
CONTROL.forEach(([x, z], i) => { const t = 0.04 + i * 0.006; const tri = [[x, z - 0.7], [x + 0.62, z + 0.4], [x - 0.62, z + 0.4], [x, z - 0.7]]; S1.poly(tri, t, t, 0); S1.seg([x - 0.2, 0.03, z], [x + 0.2, 0.03, z], t, 0); S1.seg([x, 0.03, z - 0.2], [x, 0.03, z + 0.2], t, 0); });
S1.dash(u => 0, U0, U1, 0.075, 0.1, 1); // proposed main line centreline
for (let k = 0; k < 10; k++) { // ground contours from the topographical survey
  const z0 = -15 + k * 2.6, pts = [];
  for (let x = -26; x <= 76; x += 1.2) pts.push([x, z0 + 1.4 * Math.sin(x / 9 + k * 0.7) + 0.6 * Math.sin(x / 4.1 + k * 1.9)]);
  S1.poly(pts, T.survey[0] + 0.01 + k * 0.004, T.survey[0] + 0.045 + k * 0.004, 1, 0.0);
}
const cadSurvey = S1.build(CYAN, 0.8);
// options (phase 2): three diverging alignments, B (R190) selected
const optA = cadLayer(); optA.poly(samplePath(u => [u, vcR(u, 120)], 0, U1, 1), T.options[0], T.options[0] + 0.035, 0); const cadOptA = optA.build(new THREE.Color(0x9fb6bf));
const optC = cadLayer(); optC.poly(samplePath(u => [u, vcR(u, 320)], 0, U1, 1), T.options[0] + 0.02, T.options[0] + 0.055, 0); const cadOptC = optC.build(new THREE.Color(0x9fb6bf));
const optB = cadLayer(); optB.poly(samplePath(u => [u, vc(u)], 0, U1, 1), T.options[0] + 0.01, T.options[0] + 0.045, 0); const cadOptB = optB.build(CYAN, 1.3);
// detailed design (phase 3): rails, bearers, dimensions, worksite limits
const D = cadLayer();
const bearerCorners = b => { const c = Math.cos(b.rot), s = Math.sin(b.rot), hx = 0.13, hz = b.len / 2; return [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([dx, dz]) => [b.cx + dx * c + dz * s, b.cz - dx * s + dz * c]); };
for (const b of BEARERS) {
  const q = bearerCorners(b), t = lerp(T.design[0] + 0.03, T.design[1] - 0.02, (b.cx - U0) / (U1 - U0));
  for (let k = 0; k < 4; k++) D.seg([q[k][0], 0.03, q[k][1]], [q[(k + 1) % 4][0], 0.03, q[(k + 1) % 4][1]], t, 0);
}
const railEdges = r => { const pos = r.mesh.geometry.attributes.position, N = pos.count / PROF.length / 2, base = 7 * N * 2, out = [[], []]; for (const off of [0, 1]) for (let i = 0; i < N; i++) out[off].push([pos.getX(base + i * 2 + off), pos.getZ(base + i * 2 + off)]); return out; };
for (const r of RAILS) for (const e of railEdges(r)) for (let i = 0; i < e.length - 1; i++) D.seg([e[i][0], 0.05, e[i][1]], [e[i + 1][0], 0.05, e[i + 1][1]], lerp(T.design[0], T.design[0] + 0.045, clamp((e[i][0] - U0) / (U1 - U0))), 0);
// chainage line and ticks, gauge dimension, radius leader, worksite limits
const TD = T.design[0] + 0.05;
D.seg([U0, 0.03, 3.2], [U1, 0.03, 3.2], TD, 1);
for (let u = -20; u <= 70; u += 5) D.seg([u, 0.03, 3.2], [u, 0.03, u % 10 === 0 ? 3.95 : 3.55], TD + 0.004, 0);
const arrow = (x, z, dx, dz, t) => { const l = 0.45, w = 0.18; D.seg([x, 0.03, z], [x + dx * l - dz * w, 0.03, z + dz * l + dx * w], t, 0); D.seg([x, 0.03, z], [x + dx * l + dz * w, 0.03, z + dz * l - dx * w], t, 0); };
D.seg([-20, 0.03, -HC], [-20, 0.03, HC], T.design[0] + 0.06, 0); arrow(-20, -HC, 0, 1, T.design[0] + 0.06); arrow(-20, HC, 0, -1, T.design[0] + 0.06);
D.seg([-20.6, 0.03, -HC], [-19.4, 0.03, -HC], T.design[0] + 0.06, 1); D.seg([-20.6, 0.03, HC], [-19.4, 0.03, HC], T.design[0] + 0.06, 1);
{ const ux = 12, cz = -R; const px = ux, pz = vc(ux); const dx = (px - 0) , dz = (pz - cz), l = Math.hypot(dx, dz); D.seg([px, 0.03, pz], [px - dx / l * 9, 0.03, pz - dz / l * 9], T.design[0] + 0.065, 1); arrow(px, pz, dx / l * -1, dz / l * -1, T.design[0] + 0.065); }
for (const x of [U0 + 2, U1 - 2]) { D.seg([x, 0.03, -4.2 + (x > 40 ? vc(x) : 0)], [x, 0.03, 4.2], T.design[1] - 0.03, 0); D.seg([x - 0.8, 0.03, 4.2], [x + 0.8, 0.03, 4.2], T.design[1] - 0.03, 0); }
// toe / heel / crossing nose markers
for (const [x, z] of [[0, -HC], [HEEL, -HC], [uX, -HC]]) { D.seg([x, 0.03, z - 1.6], [x, 0.03, z - 0.3], T.design[0] + 0.07, 1); D.seg([x - 0.25, 0.03, z - 1.6], [x + 0.25, 0.03, z - 1.6], T.design[0] + 0.07, 0); }
// title block (bottom corner of the sheet)
const TB = { x0: 52, x1: 74, z0: 8.2, z1: 13.4 };
{ const t = T.design[0] + 0.02; const { x0, x1, z0, z1 } = TB; D.poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]], t, t + 0.01, 0); D.seg([x0, 0.03, z0 + 2.2], [x1, 0.03, z0 + 2.2], t + 0.01, 1); D.seg([x0 + 14, 0.03, z0], [x0 + 14, 0.03, z0 + 2.2], t + 0.012, 1); }
const cadDesign = D.build(CYAN, 1);
// 3D wireframe: the drawing rises into a model before anything is built
const W3 = cadLayer();
for (const b of BEARERS) {
  const q = bearerCorners(b), t = lerp(T.extrude[0], T.extrude[0] + 0.035, (b.cx - U0) / (U1 - U0));
  for (let k = 0; k < 4; k++) { W3.seg([q[k][0], 0.2, q[k][1]], [q[(k + 1) % 4][0], 0.2, q[(k + 1) % 4][1]], t, 3); if (k % 2 === 0) W3.seg([q[k][0], 0.0, q[k][1]], [q[k][0], 0.2, q[k][1]], t, 3); }
}
for (const r of RAILS) for (const e of railEdges(r)) {
  for (let i = 0; i < e.length - 1; i++) W3.seg([e[i][0], RAIL_TOP, e[i][1]], [e[i + 1][0], RAIL_TOP, e[i + 1][1]], lerp(T.extrude[0] + 0.01, T.extrude[0] + 0.045, clamp((e[i][0] - U0) / (U1 - U0))), 3);
  for (let i = 0; i < e.length; i += 6) W3.seg([e[i][0], 0.2, e[i][1]], [e[i][0], RAIL_TOP, e[i][1]], lerp(T.extrude[0] + 0.01, T.extrude[0] + 0.045, clamp((e[i][0] - U0) / (U1 - U0))), 3);
}
for (const s of [-1, 1]) { // ballast profile outline either side
  const pts = []; for (let u = U0; u <= U1; u += 2) pts.push([u, s > 0 ? toeD : vc(u) - toeD]); W3.poly(pts, T.extrude[0] + 0.02, T.extrude[0] + 0.05, 3, -0.4);
  const pts2 = []; for (let u = U0; u <= U1; u += 2) pts2.push([u, s > 0 ? shoulder : vc(u) - shoulder]); W3.poly(pts2, T.extrude[0] + 0.02, T.extrude[0] + 0.05, 3, 0.17);
}
const cadWire = W3.build(new THREE.Color(0x7fe3f7), 0.9);
const CADS = [cadSurvey, cadOptA, cadOptB, cadOptC, cadDesign, cadWire];

// drawing text, laid flat on the sheet
const TXT_AZ = -48 * DEG;
const TEXTS = [];
function sheetText(lines, x, z, h, w, opts = {}) {
  const c = document.createElement('canvas'), fs = 64, lines2 = Array.isArray(lines) ? lines : [lines];
  const g0 = c.getContext('2d'); g0.font = `600 ${fs}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
  const tw = Math.max(...lines2.map(s => g0.measureText(s).width)) + 24, th = fs * 1.25 * lines2.length + 16;
  c.width = Math.ceil(tw); c.height = Math.ceil(th);
  const g = c.getContext('2d'); g.font = g0.font; g.fillStyle = '#fff'; g.textBaseline = 'top';
  lines2.forEach((s, i) => { if (opts.dim && i > 0) g.globalAlpha = 0.65; g.fillText(s, 12, 8 + i * fs * 1.25); g.globalAlpha = 1; });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const height = h * lines2.length * 1.1, width = height * c.width / c.height;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height).translate(opts.center ? 0 : width / 2, 0, 0),
    new THREE.MeshBasicMaterial({ map: tex, color: opts.color || CYAN, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
  m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, (opts.az ?? TXT_AZ) - Math.PI / 2, opts.rz || 0);
  m.position.set(x, 0.06, z); m.renderOrder = 7; m.visible = false; scene.add(m);
  TEXTS.push({ m, w: w, k: opts.k ?? 1 }); return m;
}
sheetText(['TOPOGRAPHICAL SURVEY', 'POINT CLOUD · 1:500'], -22, 9.5, 0.9, [T.scan[0] + 0.02, T.design[0]], { dim: true });
['STN 01', 'STN 02', 'STN 03', 'STN 04'].forEach((s, i) => sheetText(s, CONTROL[i][0] + 0.9, CONTROL[i][1] + 0.9, 0.55, [0.045 + i * 0.006, T.descend[0]], { k: 0.8 }));
sheetText('OPTION A · R120', 34, vcR(34, 120) - 1.2, 0.7, [T.options[0] + 0.03, T.select[0] + 0.01], { color: new THREE.Color(0x9fb6bf) });
sheetText('OPTION C · R320', 62, vcR(62, 320) + 1.4, 0.7, [T.options[0] + 0.045, T.select[0] + 0.01], { color: new THREE.Color(0x9fb6bf) });
sheetText('R 190 m · 1 in 8 CROSSING', 30, vc(30) - 2.6, 0.75, [T.options[0] + 0.035, T.descend[1]]);
for (let u = -20; u <= 70; u += 10) sheetText(`0+${String(u + 20).padStart(3, '0')}`, u - 0.2, 4.9, 0.5, [TD + 0.004, T.descend[1]], { k: 0.75 });
sheetText('1435', -21.5, 0.0, 0.55, [T.design[0] + 0.06, T.descend[1]]);
sheetText('TOE', -0.6, -HC - 2.4, 0.5, [T.design[0] + 0.07, T.descend[1]]);
sheetText('HEEL', HEEL - 0.8, -HC - 2.4, 0.5, [T.design[0] + 0.07, T.descend[1]]);
sheetText('X NOSE', uX - 1.0, -HC - 2.4, 0.5, [T.design[0] + 0.07, T.descend[1]]);
sheetText(['STH CONSTRUCTION & ENGINEERING', 'S&C LAYOUT · CONCEPT', 'DRG STH-XP-001 · REV A'], TB.x0 + 1, (TB.z0 + TB.z1) / 2 + 0.6, 0.62, [T.design[0] + 0.03, T.descend[1]], { dim: true });

// ---------- labels ----------
const LABELS = [
  { t: 'Laser scan', p: [0, 2, 0], dyn: 'scan', w: [T.scan[0] + 0.005, T.scan[1]] },
  { t: 'Survey control', p: [CONTROL[2][0], 0, CONTROL[2][1]], w: [T.survey[0] + 0.03, T.survey[1] + 0.01] },
  { t: 'Option B selected', p: [44, 0, vc(44)], w: [T.select[0] + 0.005, T.design[0] + 0.02] },
  { t: '3D design model', p: [16, 0.4, vc(16) - HC], w: [T.extrude[0] + 0.02, T.descend[0] + 0.01] },
  { t: 'Formation', p: [6, -0.42, -4.6], w: [T.formation[0] + 0.005, T.bottom[0] + 0.01] },
  { t: 'Bottom ballast', p: [6, 0, -3.6], w: [T.bottom[0] + 0.005, T.bearers[0] + 0.01] },
  { t: 'Bearers', p: [10, 0.2, vc(10) - HC - 0.6], w: [T.bearers[0] + 0.01, T.bearers[1]] },
  { t: 'Switch blades', p: [4.5, 0.4, -HC + 0.03], w: [T.blades[0], T.closure[1]] },
  { t: 'Crane lift · crossing', p: [0, 0, 0], dyn: 'xing', w: [T.crane[0] + 0.02, T.crossing[0] + 0.004] },
  { t: 'Crossing', p: [uX + 0.3, 0.4, -HC], w: [T.crossing[0] + 0.005, T.check[1]] },
  { t: 'Ballast train · top ballast', p: [0, 4.2, 0], dyn: 'train', w: [T.top[0] - 0.008, T.top[1]] },
  { t: 'Tamping', p: [0, 0.4, 0], dyn: 'tamp', w: [T.tamp[0], T.tamp[1]] },
  { t: 'Test & commission', p: [0, 0.4, -HC], dyn: 'test', w: [T.test[0], T.test[1]] },
  { t: 'Handed back', p: [uX + 6, 0.4, vc(uX + 6)], w: [T.close[0] + 0.02, T.close[1] - 0.005] },
];
for (const L of LABELS) { const d = document.createElement('div'); d.className = 'xp-label'; d.textContent = L.t; labelsEl.appendChild(d); L.el = d; L.v = new THREE.Vector3(...L.p); }

// ---------- camera ----------
// [progress, targetX, targetZ, distance, elevation°, azimuth°, fov]
const KEYS = [
  [0.000, 24, -3, 128, 88, -64, 30],
  [0.060, 22, -3, 104, 84, -58, 30],
  [0.120, 22, -3, 90, 80, -50, 30],
  [0.200, 21, -3, 84, 74, -44, 30],
  [0.285, 18, -3, 70, 58, -30, 31],
  [0.340, 14, -2.5, 46, 32, -4, 34],
  [0.395, 8, -2.5, 46, 26, -48, 35],
  [0.450, 10, -2.5, 40, 26, -62, 36],
  [0.505, 12, -2, 33, 24, -30, 37],
  [0.548, 16, 0, 30, 24, 8, 38],
  [0.590, uX + 2, 4, 36, 22, -64, 38],
  [0.625, uX, 0, 30, 28, -104, 38],
  [0.660, -18, 0.5, 38, 24, -70, 38],
  [0.692, 16, 0.5, 38, 26, -56, 38],
  [0.725, 46, 0, 42, 28, -40, 38],
  [0.738, -18, 0, 30, 22, -52, 38],
  [0.765, 22, 0, 28, 20, -22, 38],
  [0.795, 56, -1, 30, 22, 12, 38],
  [0.835, 18, -1.5, 12, 15, 34, 40],
  [0.890, 27, -2.5, 10, 15, 64, 40],
  [0.950, 28, -3, 42, 42, 96, 34],
  [1.000, 28, -3, 62, 56, 118, 32],
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
  el = clamp(el, 4, 89.5);
  const e = el * DEG, a = az * DEG;
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
const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
let testX = -1e4, tampX = -1e4, trainFront = -1e4, scanX = -1e4;
function setBed(mesh, k, rise) {
  mesh.visible = k > 0.001; mesh.material.opacity = k; mesh.material.transparent = k < 0.999; mesh.material.depthWrite = k > 0.5;
  mesh.position.y = -(1 - easeOut(k)) * rise;
}
// crane kinematics: point the boom tip over (x, z) with a hook height
const PIV = new THREE.Vector3();
function aimCrane(tx, tz, luff) {
  PIV.set(0, 0, 0); slew.localToWorld(PIV);
  const dx = tx - PIV.x, dz = tz - PIV.z, phi = Math.atan2(-dz, dx), rh = Math.hypot(dx, dz) - 0.6;
  return { phi, len: rh / Math.cos(luff), luff };
}
function setCrane(phi, len, luff) {
  slew.rotation.y = phi; boom.rotation.z = luff;
  boomTele.scale.x = Math.max(0.5, len - 10); boomTele.position.x = 10;
  boomHead.position.x = len;
  crane.updateMatrixWorld(true);
  tmpW.set(0, 0, 0); boomHead.localToWorld(tmpW); return tmpW.clone();
}
const LUFF_STOW = 6 * DEG, LUFF_WORK = 52 * DEG;
function applyCrane(p) {
  const on = p > T.bearers[0] && p < 0.84;
  xing.visible = p > T.bearers[0] && p < T.crossing[0] + 0.012;   // the real crossing rails take over once it's down
  if (p >= T.crane[0] + 0.06) { xing.position.copy(XING_C); xing.rotation.y = 0; } else { xing.position.copy(XING_LAY); xing.rotation.y = 0.6; }
  crane.visible = on; if (!on) { rope.visible = rig.visible = false; return; }
  const drive = ease(span(p, 0.8, 0.835)), arrive = 1 - easeOut(span(p, T.bearers[0], T.bearers[0] + 0.04));
  crane.position.set(CRANE_AT.x - arrive * 10, CRANE_AT.y, CRANE_AT.z + drive * 70 + arrive * 60);
  crane.updateMatrixWorld(true);
  const c0 = T.crane[0];
  const kUp = ease(span(p, c0, c0 + 0.018));             // luff up and slew to the laydown
  const kHoist = ease(span(p, c0 + 0.02, c0 + 0.028));   // pick
  const kSlew = easeIO(span(p, c0 + 0.028, c0 + 0.05));  // slew to the crossing
  const kLower = ease(span(p, c0 + 0.05, c0 + 0.06));    // land it
  const kFree = ease(span(p, c0 + 0.062, c0 + 0.072));   // hook up
  const kHome = ease(span(p, c0 + 0.072, c0 + 0.095));   // slew back and stow
  const lay = aimCrane(XING_LAY.x, XING_LAY.z, LUFF_WORK), dst = aimCrane(XING_C.x, XING_C.z, LUFF_WORK);
  let phi, len, luff;
  if (kHome > 0) { phi = lerp(dst.phi, 0, kHome); len = lerp(dst.len, 11, kHome); luff = lerp(LUFF_WORK, LUFF_STOW, kHome); }
  else if (kSlew > 0) { phi = lerp(lay.phi, dst.phi, kSlew); len = lerp(lay.len, dst.len, kSlew); luff = LUFF_WORK; }
  else { phi = lerp(0, lay.phi, kUp); len = lerp(11, lay.len, kUp); luff = lerp(LUFF_STOW, LUFF_WORK, kUp); }
  const tip = setCrane(phi, len, luff);
  // load path (underside of the crossing): sat at laydown, lifted, swung, landed
  const lift = 3.2;
  let ly;
  if (kSlew <= 0) ly = XING_LAY.y + lift * kHoist;
  else if (kLower <= 0) ly = lerp(XING_LAY.y + lift, XING_C.y + lift, kSlew);
  else ly = lerp(XING_C.y + lift, XING_C.y, kLower);
  const attached = kHoist > 0 && kFree <= 0;
  const landed = kLower >= 1;
  // crossing body
  if (attached && !landed) { xing.position.set(tip.x, ly, tip.z); xing.rotation.y = lerp(0.6, 0, kSlew); }
  // hook: above the load while attached, otherwise hanging under the tip
  let hookY;
  if (kHoist <= 0) hookY = lerp(tip.y - 2.5, XING_LAY.y + 0.13 + RIG_DROP, kUp);
  else if (kFree <= 0) hookY = ly + 0.13 + RIG_DROP;
  else hookY = lerp(XING_C.y + 0.13 + RIG_DROP, tip.y - 3.0, kFree);
  if (kHome > 0) hookY = Math.min(tip.y - 1.5, lerp(tip.y - 3.0, tip.y - 2.0, kHome));
  hookY = Math.min(hookY, tip.y - 0.8);
  rig.visible = true; rig.position.set(tip.x, hookY, tip.z); rig.rotation.y = xing.rotation.y;
  rope.visible = true; rope.position.copy(tip); rope.scale.y = Math.max(0.1, tip.y - hookY);
  if (drive > 0) { // stowed for travel: hook hangs close to the boom head
    rope.scale.y = 0.6; rig.position.set(tip.x, tip.y - 0.6, tip.z);
  }
}
function placeOnMain(group, frontX) { group.position.set(frontX, 0, 0); }
function apply(p) {
  // ----- drawing -----
  scanX = lerp(-26, 80, ease(span(p, ...T.scan))); scanU.value = p > T.scan[1] ? 1e4 : scanX;
  const scanOn = win(p, T.scan[0], T.scan[1], 0.008);
  scanWall.visible = scanOn > 0.01; scanWall.material.uniforms.uO.value = scanOn; scanWall.position.set(scanX, -0.02, -3);
  const cadFade = 1 - 0.88 * ease(span(p, T.descend[0] + 0.03, 0.5)) + 0.45 * span(p, 0.93, 1);
  sheetFade.value = (1 - ease(span(p, T.descend[0], T.descend[1] + 0.02))) * (1 - 0.35 * span(p, T.extrude[0], T.extrude[1]));
  sheet.visible = sheetFade.value > 0.01;
  cloud.material.uniforms.uFade.value = (1 - 0.75 * span(p, T.options[0], T.design[0])) * (1 - span(p, T.extrude[0], T.descend[0]));
  cloud.visible = cloud.material.uniforms.uFade.value > 0.01;
  for (const c of CADS) c.material.uniforms.uP.value = p;
  cadSurvey.material.uniforms.uFade.value = cadFade * (1 - 0.6 * span(p, T.options[0], T.options[1])) * (1 - span(p, T.descend[0], T.descend[1]));
  const optOff = 1 - ease(span(p, ...T.select));
  cadOptA.material.uniforms.uFade.value = optOff; cadOptC.material.uniforms.uFade.value = optOff;
  cadOptB.material.uniforms.uFade.value = cadFade * (1 + 0.8 * win(p, T.select[0], T.design[0] + 0.03, 0.01)) * (1 - 0.6 * span(p, T.design[0], T.design[1]));
  cadDesign.material.uniforms.uFade.value = cadFade * (1 - 0.45 * span(p, T.extrude[0], T.extrude[1]));
  cadWire.material.uniforms.uFade.value = (1 - ease(span(p, T.descend[1] - 0.01, T.bearers[1]))) + 0.35 * span(p, 0.93, 1);
  for (const c of CADS) c.visible = c.material.uniforms.uFade.value > 0.005 && p > 0.001;
  for (const t of TEXTS) { const o = win(p, t.w[0], t.w[1], 0.012) * t.k; t.m.visible = o > 0.01; t.m.material.opacity = o; }
  // ----- earthworks -----
  setBed(formation, ease(span(p, ...T.formation)), 0.6);
  setBed(bottomBallast, ease(span(p, ...T.bottom)), 0.35);
  const lit = ease(span(p, T.descend[0], T.descend[1]));
  ground.visible = lit > 0.01; LEGS.forEach(g => g.visible = lit > 0.01);
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
  // ----- crane -----
  applyCrane(p);
  // ----- ballast train: arrives, drops top ballast from its hoppers as it runs through, then leaves -----
  const [ta, tb] = T.train, [da, db] = T.top, LEAD = -LOCO - HOP / 2; // lead chute relative to the front
  const dropStart = U0 + 2, dropEnd = U1 + 1;
  if (p < da) trainFront = lerp(-160, dropStart - LEAD, easeOut(span(p, ta, da)));
  else if (p < db) trainFront = lerp(dropStart - LEAD, dropEnd - LEAD, span(p, da, db));
  else trainFront = lerp(dropEnd - LEAD, dropEnd - LEAD + 260, Math.pow(span(p, db, tb), 1.6));
  train.visible = p > ta && p < tb; placeOnMain(train, trainFront);
  DROP.value = p < da ? -1e4 : p >= db ? 1e4 : trainFront + LEAD;
  const topOn = p >= da; topBallast.visible = topOn; topBallast.material.opacity = 1; topBallast.material.transparent = false; topBallast.position.y = 0;
  const dropping = p > da && p < db;
  rockMesh.visible = dropping;
  if (dropping) {
    for (let i = 0; i < NROCK; i++) {
      const r = ROCKS[i], cx = trainFront + hopperXs[r.h], s = (r.ph + trainFront * 0.55 * r.sp) % 1;
      const live = cx > dropStart && cx < dropEnd;
      const lz = [-1.15, 0, 1.15][r.lane];
      dummy.position.set(cx - s * 0.9, 0.95 - 0.75 * s * s, lz + (r.lane === 1 ? r.dz * 0.6 : Math.sign(lz) * s * 0.9) + r.dz * 0.4);
      dummy.rotation.set(r.rx + s * 4, r.ry, 0); dummy.scale.setScalar(live ? r.s : 0.0001); dummy.updateMatrix(); rockMesh.setMatrixAt(i, dummy.matrix);
    }
    rockMesh.instanceMatrix.needsUpdate = true;
  }
  // ----- tamper: follows the train in, tamps the main line through the S&C, then runs off -----
  const [ma, mb] = T.tamp, TH = 5.6;
  let tf;
  if (p < ma) tf = lerp(-150, U0 + 0.5 + 0, easeOut(span(p, 0.7, ma)));
  else if (p < mb) tf = lerp(U0 + 0.5, U1 - 1, span(p, ma, mb));
  else tf = lerp(U1 - 1, U1 + 220, Math.pow(span(p, mb, 0.84), 1.5));
  tampX = tf; tamper.visible = p > 0.7 && p < 0.84; placeOnMain(tamper, tampX - TH);
  const working = p > ma && p < mb;
  tampHeadMesh.position.y = working ? -0.42 * Math.pow(0.5 - 0.5 * Math.cos(tampX / 0.65 * Math.PI * 2), 1.5) : 0.15;
  workGlow.material.opacity = working ? 0.34 : 0.0;
  // tamping band on the diverging route (the S&C tamper's third-rail lift and offset tamping units)
  const kt = span(p, ma, mb);
  const tv = win(p, ma, mb, 0.006);
  tampMat.opacity = 0.3 * tv; tamp2.position.set(tampX, 0.42, vc(tampX)); tamp2.rotation.y = Math.PI / 2 - Math.atan(-dvc(tampX)); tamp2.visible = tampX > 4 && tv > 0.01;
  const ks = span(p, ...T.test); testX = ks > 0 && ks < 1 ? lerp(U0, U1, ks) : -1e4; TEST.value = testX;
  // ----- lighting and atmosphere -----
  key.intensity = 3.4 * lit; hemi.intensity = 0.25 + 0.32 * lit; rim.intensity = 1.6 * lit; scene.environmentIntensity = 0.35 * lit;
  const away = ease(span(p, 0.93, 0.99));
  scene.fog.density = lerp(0.004, 0.0085, lit) + 0.008 * away; renderer.toneMappingExposure = 1.05 - 0.35 * away;
  placeCamera(p);
}
const tampMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const tamp2 = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.3), tampMat); scene.add(tamp2);

// ---------- UI ----------
const PHASES = ['Design development', 'Constructability', 'Integration & assurance', 'Delivery & commercial insight', 'STH services'];
function ui(p) {
  barEl.style.transform = `scaleX(${p.toFixed(4)})`;
  let active = 0, vis = 0;
  stages.forEach((s, i) => {
    const a = +s.dataset.from, b = +s.dataset.to, last = i === stages.length - 1;
    const o = last ? span(p, a, a + 0.03) : (i === 0 ? 1 - span(p, b - 0.03, b) : win(p, a, b, 0.03));
    s.style.opacity = o.toFixed(3);
    s.style.visibility = o > 0.01 ? 'visible' : 'hidden'; s.inert = o < 0.5;
    if (p >= a - 0.01) active = i; vis = Math.max(vis, o);
  });
  stageEl.style.setProperty('--veil', (0.25 + 0.75 * vis).toFixed(3));
  stageNumEl.textContent = active < 4 ? `0${active + 1} / 04 · ${PHASES[active]}` : PHASES[4];
  dots.forEach((d, i) => d.setAttribute('aria-current', i === active ? 'step' : 'false'));
  steps.forEach(li => { const a = +li.dataset.a, b = +li.dataset.b; li.classList.toggle('now', p >= a && p < b); li.classList.toggle('done', p >= b); });
  for (const L of LABELS) {
    const o = win(p, L.w[0], L.w[1], 0.012);
    if (o <= 0.01) { L.el.style.opacity = 0; continue; }
    if (L.dyn === 'tamp') L.v.set(tampX, 2.2, 0);
    if (L.dyn === 'test') L.v.set(testX, 0.45, -HC);
    if (L.dyn === 'scan') L.v.set(scanX, 5.4, 6);
    if (L.dyn === 'train') L.v.set(trainFront + hopperXs[0], 4.2, 0);
    if (L.dyn === 'xing') L.v.set(xing.position.x, xing.position.y + 0.3, xing.position.z);
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
  renderer.setSize(viewW, viewH, false); camera.aspect = aspect; RES.set(viewW * renderer.getPixelRatio() / 2, viewH * renderer.getPixelRatio() / 2); dirty = true;
}
let target = 0, cur = 0, dirty = true, visible = true, raf = 0, last = performance.now();
const scrollProgress = () => { const r = root.getBoundingClientRect(), total = r.height - innerHeight; return total > 0 ? clamp(-r.top / total) : 0; };
const kick = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };
let slow = 0, frames = 0, degraded = false;
function frame(now) {
  raf = 0;
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const diff = target - cur;
  cur = Math.abs(diff) < 0.0002 ? target : cur + diff * (1 - Math.exp(-dt * 7));
  apply(cur); ui(cur); renderer.render(scene, camera);
  frames++; if (dt > 0.045) slow++;
  if (!degraded && frames > 40 && slow > 18) {
    degraded = true; renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; key.castShadow = false; MATS.forEach(m => m.needsUpdate = true);
    for (const c of CADS) c.material.uniforms.uW.value /= DPR; resize();
  }
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
