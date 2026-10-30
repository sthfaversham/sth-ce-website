// STH Construction & Engineering: a railway turnout taken through the Network Rail PACE lifecycle as you scroll.
// Concept visualisation, illustrative geometry. Units are metres.
// x = along the main line from the switch toe, z = across (diverging side negative), y = up.
// The new S&C goes in during a night possession: plain line built in place, the switch, closure and crossing
// panels lifted in by a Kirow from the adjacent line, then top ballast, tamping, test and OLE wiring on the adjacent line.
// Everything is procedural (no model downloads) so the page stays light.
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
  scan: [0.0, 0.07], survey: [0.01, 0.09], options: [0.1, 0.15], select: [0.15, 0.18], design: [0.18, 0.26], extrude: [0.255, 0.31],
  descend: [0.31, 0.355],
  formation: [0.35, 0.375], bottom: [0.375, 0.4], masts: [0.355, 0.445],
  plainSlp: [0.4, 0.432], plainRail: [0.428, 0.455], plainFix: [0.45, 0.472],
  kirowIn: [0.442, 0.47], lifts: [[0.47, 0.515], [0.515, 0.56], [0.56, 0.605]], kirowOut: [0.605, 0.63],
  train: [0.612, 0.74], top: [0.632, 0.698],
  tamp: [0.705, 0.77], test: [0.776, 0.8], wire: [0.79, 0.858],
  close: [0.845, 0.91], services: [0.92, 1],
};
T.design3 = T.design; // kept for the drawing code

// ---------- geometry (illustrative; same turnout as the site's design-check drawing) ----------
const G = 1.435, R = 190, HC = G / 2 + 0.036;
const uX = Math.sqrt(2 * R * G - G * G);
const TA = uX / Math.sqrt(R * R - uX * uX);
const U0 = -30, U1 = 78;           // extent of the new-build worksite
const BX0 = U0 - 1, BX1 = U1 + 1;  // earthworks extent
const ZA = 3.6;                    // adjacent (existing) line centre
const CUT = 1.85;                  // six-foot: new-line earthworks stop here, adjacent line ballast starts
const vcR = (u, r) => { const ux = Math.sqrt(2 * r * G - G * G), ta = ux / Math.sqrt(r * r - ux * ux); return u <= 0 ? 0 : u <= ux ? -(r - Math.sqrt(r * r - u * u)) : -(G + (u - ux) * ta); };
const vc = u => vcR(u, R);
const dvc = u => u <= 0 ? 0 : u <= uX ? -u / Math.sqrt(R * R - u * u) : -TA;
const HEEL = 10.5, THROAT = uX - 2.1, FW = 0.112;
const RAIL_Y = 0.235, RAIL_TOP = RAIL_Y + 0.16;
const SPLIT = uX + 12.2;
// panel joints sit mid-crib between bearers: switch | closure | crossing
const PJ = [-2.6, 11.05, 19.5];
let XB = 0; // end of the crossing panel (set once the bearers exist)
const PANEL_NAMES = ['switch panel', 'closure panel', 'crossing panel'];

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
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.localClippingEnabled = true;

const NAVY = new THREE.Color(0x061019);
const CYAN = new THREE.Color(0x4fd3f0);
const scene = new THREE.Scene();
scene.background = NAVY.clone();
scene.fog = new THREE.FogExp2(NAVY.getHex(), 0.004);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 900);

// night possession: cool moonlight + sky, warm tower lights doing the real work
const hemi = new THREE.HemisphereLight(0x5d7f9c, 0x0a1016, 0);
const moon = new THREE.DirectionalLight(0x9db8dc, 0);
moon.position.set(-30, 40, -26); moon.target.position.set(20, 0, 0);
moon.castShadow = true;
moon.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
Object.assign(moon.shadow.camera, { left: -60, right: 60, top: 40, bottom: -40, near: 1, far: 160 });
moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02;
const rim = new THREE.DirectionalLight(0x58d6f2, 0);
rim.position.set(60, 10, 30);
scene.add(hemi, moon, moon.target, rim);

// ---------- procedural textures ----------
function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvasTex(size, draw, repeat, h) {
  const c = document.createElement('canvas'); c.width = size; c.height = h || size; draw(c.getContext('2d'), size, h || size);
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
const chevronTex = canvasTex(256, (g, n) => {
  g.fillStyle = '#f2b705'; g.fillRect(0, 0, n, n); g.fillStyle = '#16181a';
  for (let i = -n; i < n * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 32, 0); g.lineTo(i + 32 + n, n); g.lineTo(i + n, n); g.closePath(); g.fill(); }
});
chevronTex.wrapS = chevronTex.wrapT = THREE.ClampToEdgeWrapping;
const logoTex = new THREE.TextureLoader().load('images/sth-email-signature-logo.png', () => { dirty = true; kick(); });
logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

// ---------- materials ----------
const MATS = [];
function phys(opts) { const m = new THREE.MeshStandardMaterial(opts); MATS.push(m); return m; }
const matRailSide = phys({ color: 0x5b4a40, metalness: 0.55, roughness: 0.72 });
const matRailHead = phys({ color: 0xc3ccd2, metalness: 1.0, roughness: 0.24 });
const matConcrete = phys({ color: 0xa9aba4, roughness: 0.92, metalness: 0, map: concreteTex });
const matPlate = phys({ color: 0x30353a, roughness: 0.55, metalness: 0.6 });
const matClip = phys({ color: 0x2c3329, roughness: 0.55, metalness: 0.5 });
const matBar = phys({ color: 0x3a3f44, roughness: 0.5, metalness: 0.7 });
const matPlant = phys({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
const matLamp = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const matChev = phys({ map: chevronTex, roughness: 0.5, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 });
const matLogo = phys({ map: logoTex, transparent: true, alphaTest: 0.35, roughness: 0.45, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2 });

// Rails, all sharing one reveal state:
//  - plain line either side sweeps out from the panels (bright cutting edge)
//  - the three S&C panels appear as each one is landed (brief flash)
//  - a green test pulse runs the length at commissioning
const RU = { uL: { value: -1e4 }, uM: { value: -1e4 }, uM0: { value: -1e4 }, uFlash: { value: 0 }, uR: { value: -1e4 }, uTest: { value: -1e4 } };
function addReveal(mat) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, RU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWX;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWX = (modelMatrix * vec4(transformed,1.0)).x;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWX; uniform float uL, uM, uM0, uFlash, uR, uTest;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        bool left = vWX < ${PJ[0].toFixed(3)}, right = vWX >= XB_VALUE;
        if (left ? vWX > uL : (right ? vWX > uR : vWX > uM)) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float edge = left ? uL - vWX : (right ? uR - vWX : 1e4);
        float sweeping = left ? step(uL, ${PJ[0].toFixed(3)} - 0.01) : (right ? step(uR, ${U1.toFixed(1)} - 0.01) : 0.0);
        totalEmissiveRadiance += vec3(0.31,0.83,0.94) * 2.2 * (1.0 - smoothstep(0.0, 1.4, edge)) * sweeping;
        totalEmissiveRadiance += vec3(0.31,0.83,0.94) * 1.6 * uFlash * step(uM0, vWX) * step(vWX, uM) * (left || right ? 0.0 : 1.0);
        totalEmissiveRadiance += vec3(0.2,1.0,0.5) * 3.5 * (1.0 - smoothstep(0.0, 4.5, abs(vWX - uTest)));`)
      .replace(/XB_VALUE/g, XB.toFixed(3));
  };
  mat.customProgramCacheKey = () => 'rail-reveal-v3';
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

// ---------- bearers (built first: they decide where the panel joints fall) ----------
const BEARERS = [];
const zoneOf = x => x < PJ[0] ? 'L' : x < PJ[1] ? 0 : x < PJ[2] ? 1 : 2;
for (let u = U0 + 0.3; u < PJ[0]; u += 0.65) BEARERS.push({ cx: u, cz: 0, len: 2.6, rot: 0, zone: 'L' });
for (let u = PJ[0] + 0.325; u < SPLIT; u += 0.65) { const z0 = vc(u) - HC - 0.62, z1 = HC + 0.62; BEARERS.push({ cx: u, cz: (z0 + z1) / 2, len: Math.max(2.6, z1 - z0), rot: 0, zone: zoneOf(u) }); XB = u + 0.325; }
for (let u = XB + 0.33; u < U1; u += 0.65) BEARERS.push({ cx: u, cz: 0, len: 2.6, rot: 0, zone: 'R' });
for (let u = XB + 0.1; u < U1 - 1; u += 0.65 * Math.cos(Math.atan(dvc(u)))) BEARERS.push({ cx: u, cz: vc(u), len: 2.6, rot: Math.atan(-dvc(u)), zone: 'R' });
BEARERS.sort((a, b) => a.cx - b.cx);
// plain bearers are dropped in from the panel ends outwards
for (const b of BEARERS) if (b.zone === 'L' || b.zone === 'R') { const d = b.zone === 'L' ? (PJ[0] - b.cx) / (PJ[0] - U0) : (b.cx - XB) / (U1 - XB); b.birth = lerp(T.plainSlp[0], T.plainSlp[1] - 0.01, clamp(d)); }
const PANELS = [0, 1, 2].map(i => {
  const x0 = i === 0 ? PJ[0] : PJ[i], x1 = i === 2 ? XB : PJ[i + 1], bs = BEARERS.filter(b => b.zone === i);
  const zc = bs.reduce((s, b) => s + b.cz, 0) / bs.length;
  return { i, x0, x1, pc: (x0 + x1) / 2, zc, bs, name: PANEL_NAMES[i] };
});

// ---------- rails ----------
const RAILS = [];
function addRail(name, pts, headScaleFn) {
  const side = matRailSide.clone(), head = matRailHead.clone();
  addReveal(side); addReveal(head); MATS.push(side, head);
  const mesh = new THREE.Mesh(sweepRail(pts, headScaleFn), [side, head]);
  mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false; scene.add(mesh);
  const xs = pts.map(p => p[0]);
  RAILS.push({ mesh, x0: Math.min(...xs), x1: Math.max(...xs), name });
}
const P = (fn, a, b, step = 0.5) => samplePath(fn, a, b, step);
const toe = u => 0.25 + 0.75 * clamp(u / 4.5), nose = u => 0.35 + 0.65 * clamp((u - uX) / 2.2);
addRail('stock-right', [[U0, HC], ...P(u => [u, HC], PJ[0] - 2, XB + 2, 2), [U1, HC]]);
addRail('stock-left', [[U0, -HC], ...P(u => [u, vc(u) - HC], 0, U1)]);
addRail('blade-straight', P(u => [u, -HC + 0.046 * (1 - u / HEEL)], 0.15, HEEL, 0.25), toe);
addRail('blade-curved', P(u => [u, vc(u) + HC - 0.115 * Math.pow(1 - u / HEEL, 1.5)], 0.15, HEEL, 0.25), toe);
addRail('closure-straight', [[HEEL, -HC], [THROAT, -HC]]);
addRail('closure-curved', P(u => [u, vc(u) + HC], HEEL, THROAT));
addRail('wing-a', [[THROAT, -HC], ...P(u => [u, vc(u) + HC - FW], uX - 0.2, uX + 3.2), [uX + 4.4, vc(uX + 4.4) + HC - FW - 0.22]]);
addRail('wing-b', [...P(u => [u, vc(u) + HC], THROAT, THROAT + 0.2), [uX - 0.2, -HC + FW], [uX + 3.2, -HC + FW], [uX + 4.4, -HC + FW + 0.22]]);
addRail('nose-straight', [[uX, -HC], ...P(u => [u, -HC], uX + 1, XB + 2, 2), [U1, -HC]], nose);
addRail('nose-diverging', P(u => [u, vc(u) + HC], uX, U1), nose);
const CK0 = uX - 3.2, CK1 = uX + 2.2;
addRail('check-main', [[CK0 - 0.8, HC - FW - 0.14], [CK0, HC - FW], [CK1, HC - FW], [CK1 + 0.8, HC - FW - 0.14]]);
addRail('check-div', [[CK0 - 0.8, vc(CK0 - 0.8) - HC + FW + 0.14], ...P(u => [u, vc(u) - HC + FW], CK0, CK1, 0.4), [CK1 + 0.8, vc(CK1 + 0.8) - HC + FW + 0.14]]);

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
  if (b.rot) { for (const s of [-HC, HC]) PLATES.push({ x: b.cx + Math.sin(b.rot) * s, z: b.cz + Math.cos(b.rot) * s, rot: b.rot, zone: b.zone }); continue; }
  for (const z of (b.cx > XB ? [HC, -HC] : railsAt(b.cx))) PLATES.push({ x: b.cx, z, rot: 0, zone: b.zone });
}
PLATES.forEach(q => { const d = q.zone === 'L' ? (PJ[0] - q.x) / (PJ[0] - U0) : (q.x - XB) / (U1 - XB); q.birth = lerp(T.plainFix[0], T.plainFix[1] - 0.01, clamp(d)); });
const plateGeo = new THREE.BoxGeometry(0.2, 0.035, 0.36); plateGeo.translate(0, 0.2175, 0);
const plateMesh = new THREE.InstancedMesh(plateGeo, matPlate, PLATES.length); plateMesh.receiveShadow = true; scene.add(plateMesh);
const clipGeo = new THREE.TorusGeometry(0.028, 0.007, 5, 10, Math.PI * 1.2); clipGeo.rotateY(Math.PI / 2); clipGeo.translate(0, 0.243, 0);
const clipMesh = new THREE.InstancedMesh(clipGeo, matClip, PLATES.length * 2); scene.add(clipMesh);
const barGeos = [0.75, 2.6].map(u => { const z0 = -HC + 0.046 * (1 - u / HEEL), z1 = vc(u) + HC - 0.115 * Math.pow(1 - u / HEEL, 1.5); const g = new THREE.BoxGeometry(0.06, 0.05, z1 - z0); g.translate(u, 0.27, (z0 + z1) / 2); return g; });
const barMeshes = barGeos.map(g => { const m = new THREE.Mesh(g, matBar); m.castShadow = true; m.visible = false; scene.add(m); return m; });

// ---------- earthworks: formation, bottom ballast, top ballast ----------
const gw = isMobile ? 260 : 420, gh = isMobile ? 70 : 110;
const distTrack = (x, z) => Math.min(Math.abs(z), Math.abs(z - vc(x)), (x < uX + 14 && z > vc(x) && z < 0) ? 0 : 99);
function bed(fn, colFn) {
  const geo = new THREE.PlaneGeometry(BX1 - BX0, 22, gw, gh); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), r = rand(5);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + (BX0 + BX1) / 2, z = p.getZ(i) - 4.5, d = distTrack(x, z);
    p.setXYZ(i, x, z > CUT ? -0.8 : fn(d, r), z); const c = colFn(d); col[i * 3] = c * 0.95; col[i * 3 + 1] = c; col[i * 3 + 2] = c * 0.97;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals(); return geo;
}
const shoulder = 2.1, toeD = 4.2;
const topBallastY = (d, r) => (d < shoulder ? 0.17 : d < toeD ? lerp(0.17, -0.42, (d - shoulder) / (toeD - shoulder)) : -0.6) + (r ? (r() - 0.5) * 0.04 : 0);
const bottomBallastY = (d, r) => (d < shoulder + 0.3 ? -0.005 : d < toeD + 0.3 ? lerp(-0.005, -0.42, (d - shoulder - 0.3) / (toeD - shoulder)) : -0.6) + (r ? (r() - 0.5) * 0.03 : 0);
const formationY = (d, r) => (d < toeD + 1.2 ? -0.42 : -0.42 - (d - toeD - 1.2) * 0.05) + (r ? (r() - 0.5) * 0.02 : 0);
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
// where people stand: rough surface height for the current stage
function surfaceY(x, z, p) {
  const d = distTrack(x, z);
  if (z > CUT) return Math.abs(z - ZA) < shoulder ? 0.17 : Math.abs(z - ZA) < toeD ? lerp(0.17, -0.5, (Math.abs(z - ZA) - shoulder) / 2.1) : -0.62;
  if (p > T.top[0] && x < DROP.value && d < toeD) return topBallastY(d);
  if (p > T.bottom[0] && d < toeD + 0.3) return bottomBallastY(d);
  return Math.max(-0.62, formationY(d));
}

// the wider site: dark ground, the existing railway either side, and the adjacent (existing) line
const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 300).rotateX(-Math.PI / 2), phys({ color: 0x8a8f86, map: groundTex, roughness: 1, metalness: 0 }));
ground.position.set(25, -0.66, -3); ground.receiveShadow = true; ground.visible = false; scene.add(ground);

const LEGS = [];
const PL = 300;
function plainLeg(x0, z0, dirX, dirZ, len, { b0 = 0, b1 = len, hide = null } = {}) {
  const yaw = Math.atan2(-dirZ, dirX), g = new THREE.Group(); g.position.set(x0, 0, z0); g.rotation.y = yaw;
  const bl = b1 - b0, bg = new THREE.PlaneGeometry(bl, 11, 6, 44); bg.rotateX(-Math.PI / 2); bg.translate(b0 + bl / 2, 0, 0);
  const p = bg.attributes.position, r = rand(9), col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const lz = p.getZ(i), d = Math.abs(lz); p.setY(i, hide && hide(lz) ? -0.8 : topBallastY(d, r)); const c = fadeOut(d); col.set([c * 0.95, c, c * 0.97], i * 3); }
  bg.setAttribute('color', new THREE.BufferAttribute(col, 3)); bg.computeVertexNormals();
  const bt = ballastTex.clone(); bt.repeat.set(bl * 0.6, 6); bt.needsUpdate = true;
  const bm = new THREE.Mesh(bg, phys({ vertexColors: true, color: 0xa7a3a0, map: bt, roughness: 0.95, metalness: 0 })); bm.receiveShadow = true; g.add(bm);
  const n = Math.floor((len - 0.95) / 0.65), sl = new THREE.InstancedMesh(bearerGeo, matConcrete, n), d = new THREE.Object3D();
  for (let i = 0; i < n; i++) { d.position.set(0.95 + i * 0.65, 0, 0); d.scale.set(0.26, 1, 2.6); d.updateMatrix(); sl.setMatrixAt(i, d.matrix); }
  sl.receiveShadow = true; g.add(sl);
  for (const s of [-HC, HC]) { const m = new THREE.Mesh(sweepRail([[0, s], [len, s]]), [matRailSide, matRailHead]); m.castShadow = true; g.add(m); }
  g.visible = false; scene.add(g); LEGS.push(g); return g;
}
plainLeg(U0, 0, -1, 0, PL, { b0: 1, hide: lz => -lz > CUT });                    // approach
plainLeg(U1, 0, 1, 0, PL, { b0: 1, hide: lz => lz > CUT });                      // main line onward
{ const l = Math.hypot(1, TA); plainLeg(U1, vc(U1), 1 / l, -TA / l, 160, { b0: 1 }); } // diverging route onward
plainLeg(-PL, ZA, 1, 0, PL * 2, { hide: lz => lz < CUT - ZA });                   // adjacent existing line

// ---------- plant kit: rounded boxes/cylinders merged into one mesh per part, vertex coloured ----------
const RBOX = new Map();
function roundedBox(w, h, d, r) {
  const k = [w, h, d, r].map(v => v.toFixed(3)).join(','); if (RBOX.has(k)) return RBOX.get(k).clone();
  const iw = w / 2 - r, ih = h / 2 - r, c = Math.min(r * 0.6, iw, ih) * 0.999, s = new THREE.Shape();
  s.moveTo(-iw + c, -ih); s.lineTo(iw - c, -ih); s.quadraticCurveTo(iw, -ih, iw, -ih + c); s.lineTo(iw, ih - c); s.quadraticCurveTo(iw, ih, iw - c, ih);
  s.lineTo(-iw + c, ih); s.quadraticCurveTo(-iw, ih, -iw, ih - c); s.lineTo(-iw, -ih + c); s.quadraticCurveTo(-iw, -ih, -iw + c, -ih);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 2 });
  g.translate(0, 0, -(d - 2 * r) / 2); g.computeVertexNormals(); RBOX.set(k, g); return g.clone();
}
function kit() {
  const parts = [];
  function push(g, x, y, z, col, ry = 0, rz = 0, rx = 0) {
    g = g.index ? g.toNonIndexed() : g; if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z);
    g.deleteAttribute('uv'); const c = new THREE.Color(col), n = g.attributes.position.count, ca = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) ca.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); parts.push(g);
  }
  const api = {
    box(w, h, d, x, y, z, col, ry, rz, rx) {
      const m = Math.min(w, h, d);
      push(m >= 0.22 && Math.max(w, h, d) >= 0.5 ? roundedBox(w, h, d, clamp(m * 0.14, 0.025, 0.13)) : new THREE.BoxGeometry(w, h, d), x, y, z, col, ry, rz, rx); return api;
    },
    seams(x0, x1, step, y, h, d, col = '#1a2228') { for (let x = x0; x <= x1 + 1e-3; x += step) api.box(0.03, h, d + 0.02, x, y, 0, col); return api; },
    mullions(x0, x1, step, y, h, d) { for (let x = x0; x <= x1 + 1e-3; x += step) api.box(0.06, h + 0.04, d + 0.03, x, y, 0, '#2a3238'); return api; },
    cyl(r, len, x, y, z, col, axis = 'z', seg = 12, r2) { const g = new THREE.CylinderGeometry(r2 ?? r, r, len, seg); if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(Math.PI / 2); push(g, x, y, z, col); return api; },
    // a sloped-front cab: box with a raked windscreen face
    wheelset(x, r = 0.45) { for (const s of [-1, 1]) { api.cyl(r, 0.14, x, RAIL_TOP + r - 0.02, s * 0.74, '#1b1d1f', 'z', 14); api.cyl(r * 0.55, 0.16, x, RAIL_TOP + r - 0.02, s * 0.76, '#5c6266', 'z', 10); } api.cyl(0.08, 1.4, x, RAIL_TOP + r - 0.02, 0, '#3a3d40'); return api; },
    rail(x0, x1, y, z, col = '#c9d0d4') { api.box(x1 - x0, 0.04, 0.04, (x0 + x1) / 2, y, z, col); for (let x = x0; x <= x1 + 0.01; x += Math.max(1.2, (x1 - x0) / Math.ceil((x1 - x0) / 1.6))) api.box(0.035, 0.9, 0.035, x, y - 0.45, z, col); return api; },
    ladder(x, y0, y1, z, col = '#c9d0d4', side = 1) { for (const dx of [-0.2, 0.2]) api.box(0.035, y1 - y0, 0.035, x + dx, (y0 + y1) / 2, z, col); for (let y = y0 + 0.15; y < y1; y += 0.3) api.box(0.4, 0.03, 0.03, x, y, z, col); return api; },
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
// liveries
const YEL = '#e2a514', YEL2 = '#bb850f', DK = '#1d2125', GRY = '#4a5157', WIN = '#0b151c', STEEL = '#8d959b', RAILC = '#c9d0d4';
const STH_W = '#e4eaec', STH_T = '#1c5d74', STH_C = '#3fb7d9', STH_D = '#14303f';
function decal(parent, mat, w, h, x, y, z, ry = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; }
function logoSides(parent, len, x, y, halfW) { for (const s of [-1, 1]) decal(parent, matLogo, len, len * 156 / 440, x, y, s * (halfW + 0.012), s > 0 ? 0 : Math.PI); }
function chevrons(parent, x, y, w, h, dir) { decal(parent, matChev, w, h, x + dir * 0.012, y, 0, dir > 0 ? Math.PI / 2 : -Math.PI / 2); }
function bogie(k, x, axles, frameCol = DK) {
  k.box(axles * 1.5 + 0.7, 0.36, 2.2, x, 1.08, 0, frameCol);
  for (const s of [-1, 1]) { k.box(axles * 1.5 + 0.6, 0.26, 0.16, x, 0.95, s * 1.1, '#2c3136'); k.box(axles * 1.5 + 0.2, 0.06, 0.2, x, 1.2, s * 1.1, '#3b4147'); }
  const s0 = (axles - 1) / 2 * 1.5;
  for (let i = 0; i < axles; i++) {
    const ax = x - s0 + i * 1.5; k.wheelset(ax);
    for (const s of [-1, 1]) { k.box(0.34, 0.3, 0.24, ax, RAIL_TOP + 0.43, s * 1.0, '#2a2e32'); k.cyl(0.1, 0.3, ax - 0.12, RAIL_TOP + 0.72, s * 1.0, '#59606a', 'y', 8).cyl(0.1, 0.3, ax + 0.12, RAIL_TOP + 0.72, s * 1.0, '#59606a', 'y', 8); }
    if (i < axles - 1) for (const s of [-1, 1]) k.cyl(0.11, 0.32, ax + 0.75, 0.95, s * 0.55, '#3a3f44', 'x', 10);
  }
}

// lamp glows: one points cloud for every lamp in the scene, positioned each frame
const GLOWS = [];
function glow(obj, x, y, z, col, size) { GLOWS.push({ obj, v: new THREE.Vector3(x, y, z), c: new THREE.Color(col), size }); }
let glowPts = null;
function buildGlows() {
  const n = GLOWS.length, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uScale: { value: 400 }, uMap: { value: glowTex }, uK: { value: 1 } },
    vertexShader: 'attribute float size; attribute vec3 color; uniform float uScale; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size <= 0.0 ? 0.0 : clamp(size * uScale / -mv.z, 2.0, 220.0); }',
    fragmentShader: 'uniform sampler2D uMap; uniform float uK; varying vec3 vC; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC * 1.4, t.a * 0.85 * uK); }',
  });
  glowPts = new THREE.Points(g, m); glowPts.frustumCulled = false; glowPts.renderOrder = 8; scene.add(glowPts);
}
const isShown = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
function updateGlows(k) {
  const pa = glowPts.geometry.attributes.position, ca = glowPts.geometry.attributes.color, sa = glowPts.geometry.attributes.size;
  GLOWS.forEach((g, i) => { const on = k > 0.01 && isShown(g.obj); tmpG.copy(g.v); g.obj.localToWorld(tmpG); pa.setXYZ(i, tmpG.x, tmpG.y, tmpG.z); ca.setXYZ(i, g.c.r, g.c.g, g.c.b); sa.setX(i, on ? g.size : 0); });
  pa.needsUpdate = ca.needsUpdate = sa.needsUpdate = true; glowPts.material.uniforms.uK.value = k;
}
const tmpG = new THREE.Vector3();

// ---------- tower lights (warm work lighting) ----------
const TOWERS = [];
const towerSpots = [];
function towerLight(x, z, aimX, aimZ, castShadow) {
  const g = new THREE.Group(); g.position.set(x, -0.62, z);
  const k = kit();
  k.box(3.2, 0.7, 1.7, 0, 0.75, 0, YEL).box(3.3, 0.12, 1.8, 0, 1.15, 0, DK);
  for (const s of [-1, 1]) { k.cyl(0.32, 0.22, s * 0.9, 0.32, 0.95, '#151719'); k.cyl(0.32, 0.22, s * 0.9, 0.32, -0.95, '#151719'); }
  k.box(0.12, 1.2, 0.12, 1.9, 0.6, 0.0, DK);
  k.cyl(0.11, 8.6, 0, 5.4, 0, STEEL, 'y', 8, 0.07);
  k.box(1.6, 0.12, 0.12, 0, 9.6, 0, DK);
  for (const dx of [-0.6, -0.2, 0.2, 0.6]) k.box(0.34, 0.34, 0.16, dx, 9.35, 0.12, '#2a2d30');
  g.add(k.mesh());
  const l = kit(); for (const dx of [-0.6, -0.2, 0.2, 0.6]) l.box(0.28, 0.28, 0.02, dx, 9.35, 0.21, '#fff2d6'); g.add(l.mesh(matLamp, false));
  g.lookAt(aimX, -0.62, aimZ); g.rotation.x = 0; g.rotation.z = 0;
  g.visible = false; scene.add(g); TOWERS.push(g);
  glow(g, 0, 9.35, 0.3, '#ffe2b0', 9);
  const sp = new THREE.SpotLight(0xffdcae, 0, 0, 0.7, 0.6, 2);
  sp.position.set(x, 9.3, z); sp.target.position.set(aimX, 0, aimZ); sp.castShadow = !!castShadow;
  if (castShadow) { sp.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048); sp.shadow.bias = -0.0006; sp.shadow.normalBias = 0.03; sp.shadow.camera.near = 2; sp.shadow.camera.far = 80; }
  scene.add(sp, sp.target); towerSpots.push(sp);
}
towerLight(4, 19, 4, 1, !lowPower);
towerLight(30, 19.5, 28, 0, false);
if (!lowPower) { towerLight(-22, -17, -16, 0, false); towerLight(56, -22, 48, -4, false); }
towerLight(12, -21, 12, -1, false);

// ---------- site team: hi-vis figures ----------
const ORANGE = '#ff6a14';
function person(helmet, prop) {
  const g = new THREE.Group(), k = kit(), b = kit();
  for (const s of [-1, 1]) { k.box(0.15, 0.82, 0.17, 0, 0.43, s * 0.11, ORANGE); k.box(0.2, 0.1, 0.2, 0.03, 0.05, s * 0.11, '#141414'); b.box(0.155, 0.05, 0.175, 0, 0.3, s * 0.11, '#d9dee2'); b.box(0.155, 0.05, 0.175, 0, 0.6, s * 0.11, '#d9dee2'); }
  k.box(0.24, 0.62, 0.44, 0, 1.16, 0, ORANGE);
  b.box(0.245, 0.05, 0.445, 0, 1.0, 0, '#d9dee2'); b.box(0.245, 0.05, 0.445, 0, 1.12, 0, '#d9dee2');
  for (const s of [-1, 1]) { k.box(0.12, 0.58, 0.12, prop ? 0.12 : 0, 1.15, s * 0.29, ORANGE, 0, prop ? 0.5 : 0); }
  k.box(0.2, 0.22, 0.19, 0, 1.6, 0, '#c99a7c');
  k.box(0.27, 0.13, 0.25, 0, 1.75, 0, helmet).box(0.12, 0.03, 0.25, 0.16, 1.7, 0, helmet);
  if (prop === 'tablet') k.box(0.03, 0.22, 0.3, 0.32, 1.13, 0, '#202428');
  if (prop === 'radio') k.box(0.05, 0.16, 0.06, 0.2, 1.42, 0.24, '#202428');
  g.add(k.mesh()); g.add(b.mesh(matLamp, false)); g.visible = false; scene.add(g); return g;
}
const engineer = person('#f4f6f7', 'tablet');
const controller = person('#2c6fd6', 'radio');
const ops = [person('#f4f6f7'), person('#f4f6f7'), person('#f4f6f7')];
function stand(fig, x, z, faceX, faceZ, p) { fig.visible = true; fig.position.set(x, surfaceY(x, z, p), z); fig.rotation.y = Math.atan2(-(faceZ - z), faceX - x); }

// ---------- OLE on the adjacent line: masts erected by an RRV, then wired by a wiring train ----------
const ZM = ZA + 3.3;                       // mast line, far side of the adjacent line
const MASTS_X = [-100, -55, -10, 50, 95, 140];
const STAGGER = 0.2;
const MASTS = MASTS_X.map((x, i) => {
  const piv = new THREE.Group(); piv.position.set(x, -0.62, ZM);
  const k = kit();
  k.box(1.1, 0.5, 1.1, 0, 0.0, 0, '#7d7f7c');
  for (const s of [-1, 1]) k.box(0.32, 7.6, 0.03, 0, 3.8, s * 0.13, '#8f989d');
  k.box(0.03, 7.6, 0.26, 0, 3.8, 0, '#8f989d');
  // cantilever: top tube, bracket and registration arm reaching over the track
  const reach = ZM - ZA, st = i % 2 ? STAGGER : -STAGGER;
  k.box(0.07, 0.07, reach + 0.5, 0, 7.0, -(reach + 0.5) / 2, '#b8c0c5');
  const dl = Math.hypot(reach, 1.3); k.box(0.07, 0.07, dl, 0, 6.35, -reach / 2, '#b8c0c5', 0, 0, Math.atan2(1.3, reach));
  k.box(0.05, 0.05, 1.0, 0, 5.75, -reach - st + 0.45, '#b8c0c5');
  k.cyl(0.08, 0.5, 0, 6.75, -0.18, '#5a3c2a', 'z', 8).cyl(0.08, 0.5, 0, 6.15, -0.18, '#5a3c2a', 'z', 8);
  piv.add(k.mesh()); piv.visible = false; scene.add(piv);
  return { piv, x, st };
});
// wire runs (catenary sags between masts, contact wire staggered; droppers between)
const WIRE_SEGS = [];
for (let i = 0; i < MASTS.length - 1; i++) {
  const a = MASTS[i], b = MASTS[i + 1], n = Math.ceil((b.x - a.x) / 3);
  const cat = t => [lerp(a.x, b.x, t), 6.95 - 0.9 * 4 * t * (1 - t), ZA];
  const con = t => [lerp(a.x, b.x, t), 5.75, ZA + lerp(a.st, b.st, t)];
  for (let j = 0; j < n; j++) { WIRE_SEGS.push([cat(j / n), cat((j + 1) / n), 0.016]); WIRE_SEGS.push([con(j / n), con((j + 1) / n), 0.014]); }
  for (let j = 1; j < n; j += 2) { const c1 = cat(j / n), c2 = con(j / n); WIRE_SEGS.push([c1, [c2[0], c2[1] + 0.02, c2[2]], 0.008]); }
}
const wireMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5, 1, true).translate(0, 0.5, 0), phys({ color: 0xb87f4f, roughness: 0.4, metalness: 0.9 }), WIRE_SEGS.length);
wireMesh.frustumCulled = false; wireMesh.visible = false; scene.add(wireMesh);
const qUp = new THREE.Vector3(0, 1, 0), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), tmpS = new THREE.Vector3();
function setSeg(mesh, i, a, b, r, show) {
  tmpA.set(...a); tmpB.set(...b); const d = tmpB.clone().sub(tmpA), l = d.length();
  tmpQ.setFromUnitVectors(qUp, d.normalize()); tmpS.set(show ? r : 0, show ? l : 0, show ? r : 0);
  tmpM.compose(tmpA, tmpQ, tmpS); mesh.setMatrixAt(i, tmpM);
}
let wireFront = -1e4, wireDrawn = -2e4;
function updateWires() {
  if (wireFront === wireDrawn) return; wireDrawn = wireFront;
  WIRE_SEGS.forEach((s, i) => setSeg(wireMesh, i, s[0], s[1], s[2], Math.max(s[0][0], s[1][0]) < wireFront));
  wireMesh.instanceMatrix.needsUpdate = true;
}

// RRV (STH): road-rail excavator with a mast-handling arm
const rrv = new THREE.Group(); rrv.visible = false; scene.add(rrv);
{
  const k = kit();
  k.box(6.2, 0.7, 2.5, 0, 1.25, 0, STH_D);
  for (const x of [-2.1, 2.1]) { for (const s of [-1, 1]) k.cyl(0.55, 0.45, x, 0.95, s * 1.05, '#151719', 'z', 14); k.wheelset(x + 0.9 * Math.sign(-x), 0.22); }
  k.cyl(1.05, 0.35, -0.2, 1.75, 0, DK, 'y', 18);
  k.box(3.4, 1.2, 2.4, -0.6, 2.5, 0, STH_W).box(3.42, 0.25, 2.42, -0.6, 2.0, 0, STH_T).box(1.4, 1.3, 2.4, -2.7, 2.45, 0, STH_T);
  k.box(1.5, 1.6, 1.0, 1.0, 2.9, 0.65, STH_W).box(1.52, 0.8, 1.02, 1.1, 3.15, 0.65, WIN);
  k.box(3.6, 0.45, 0.4, 2.2, 4.3, -0.4, STH_T, 0, 0.55).box(3.0, 0.38, 0.34, 4.4, 4.9, -0.4, STH_W, 0, -0.35);
  k.box(0.5, 0.5, 0.8, 5.7, 4.15, -0.4, DK);
  rrv.add(k.mesh());
  const l = kit(); l.cyl(0.11, 0.2, -1.6, 3.2, -0.8, '#ffa21a', 'y'); l.box(0.06, 0.18, 0.3, 3.12, 1.4, 0.8, '#fff4dc').box(0.06, 0.18, 0.3, 3.12, 1.4, -0.8, '#fff4dc'); rrv.add(l.mesh(matLamp, false));
  glow(rrv, -1.6, 3.35, -0.8, '#ffa21a', 1.4); glow(rrv, 3.2, 1.4, 0.8, '#fff1d0', 1.6); glow(rrv, 3.2, 1.4, -0.8, '#fff1d0', 1.6);
}

// ---------- Kirow rail crane (STH livery) on the adjacent line ----------
const KIROW_L = 13;
const kirow = new THREE.Group(); kirow.visible = false; scene.add(kirow);
{
  const k = kit();
  k.box(15, 0.6, 2.8, 0, 1.4, 0, DK); bogie(k, -5, 2); bogie(k, 5, 2);
  k.box(14.6, 0.75, 2.9, 0, 2.05, 0, STH_T).box(14.62, 0.08, 2.92, 0, 2.2, 0, STH_C);
  for (const s of [-1, 1]) { k.box(0.35, 0.6, 2.8, s * 7.55, 1.55, 0, DK); for (const z of [-0.95, 0.95]) k.cyl(0.15, 0.4, s * 7.85, 1.55, z, STEEL, 'x'); }
  for (const s of [-1, 1]) k.rail(-6.5, 6.5, 3.35, s * 1.38, '#d0d6d9');
  for (const ox of [-6.2, 6.2]) for (const s of [-1, 1]) { k.box(0.42, 0.42, 2.4, ox, 1.6, s * 2.2, STH_D); k.box(0.3, 1.4, 0.3, ox, 0.95, s * 3.25, '#3a4248'); k.box(0.9, 0.12, 0.9, ox, 0.2, s * 3.25, '#22282c'); }
  k.seams(-6, 6, 2, 2.05, 0.7, 2.9);
  kirow.add(k.mesh());
  for (const dir of [-1, 1]) chevrons(kirow, dir * 7.73, 2.05, 2.9, 0.75, dir);
}
const kSlew = new THREE.Group(); kSlew.position.set(0, 2.45, 0); kirow.add(kSlew);
{
  const k = kit();
  k.cyl(1.35, 0.3, 0, 0.15, 0, DK, 'y', 20);
  k.box(6.6, 2.0, 2.9, -1.1, 1.3, 0, STH_W).box(6.62, 0.5, 2.92, -1.1, 0.55, 0, STH_T).box(6.64, 0.08, 2.94, -1.1, 0.85, 0, STH_C);
  k.box(1.9, 2.4, 3.0, -5.2, 1.4, 0, STH_D).box(1.92, 0.08, 3.02, -5.2, 2.0, 0, STH_C);
  k.box(2.2, 2.0, 1.25, 2.9, 1.3, 0.85, STH_W).box(2.22, 0.9, 1.27, 3.0, 1.75, 0.85, WIN).box(0.06, 0.9, 1.1, 4.02, 1.75, 0.85, WIN).box(0.06, 0.94, 1.3, 2.4, 1.75, 0.85, '#2a3238').box(0.06, 0.94, 1.3, 3.4, 1.75, 0.85, '#2a3238');
  k.box(0.04, 1.7, 2.92, -3.0, 1.2, 0, '#173948').box(0.04, 1.7, 2.92, 0.8, 1.2, 0, '#173948');
  k.box(2.0, 0.5, 2.0, -2.2, 2.55, 0, GRY);
  // A-frame
  for (const s of [-1, 1]) { k.box(0.22, 3.6, 0.22, -2.9, 3.9, s * 0.9, STH_D, 0, -0.25); }
  k.box(0.3, 0.3, 2.0, -3.3, 5.65, 0, STH_D);
  kSlew.add(k.mesh());
  logoSides(kSlew, 3.0, -1.4, 1.45, 1.45);
  const l = kit(); l.cyl(0.13, 0.22, -2.6, 2.9, 0.7, '#ffa21a', 'y').cyl(0.13, 0.22, -2.6, 2.9, -0.7, '#ffa21a', 'y'); l.box(0.02, 0.2, 0.36, 4.05, 2.4, 0.85, '#fff4dc'); kSlew.add(l.mesh(matLamp, false));
  glow(kSlew, -2.6, 3.05, 0.7, '#ffa21a', 1.5); glow(kSlew, -2.6, 3.05, -0.7, '#ffa21a', 1.5); glow(kSlew, 4.1, 2.4, 0.85, '#fff1d0', 2.4);
}
const kJib = new THREE.Group(); kJib.position.set(1.8, 1.6, 0); kSlew.add(kJib);
{
  const k = kit(), L = KIROW_L;
  k.box(L * 0.55, 0.95, 0.95, L * 0.275, 0, 0, STH_T).box(L * 0.45, 0.7, 0.7, L * 0.775, 0, 0, STH_T);
  k.box(L, 0.07, 0.97, L / 2, 0.36, 0, STH_C);
  for (let x = 0.8; x < L - 0.6; x += 1.1) for (const s of [-1, 1]) k.box(0.06, 0.8, 0.02, x, -0.02, s * (x < L * 0.55 ? 0.49 : 0.36), STH_W, 0, 0.6);
  k.box(0.8, 0.9, 0.75, L, 0, 0, STH_D).cyl(0.35, 0.3, L + 0.25, -0.1, 0, DK, 'z', 14);
  k.cyl(0.35, 1.2, 0, 0, 0, DK, 'z', 14);
  kJib.add(k.mesh());
  const l = kit(); l.box(0.3, 0.2, 0.2, L - 0.3, 0.55, 0, '#fff4dc'); kJib.add(l.mesh(matLamp, false));
  glow(kJib, L - 0.3, 0.6, 0, '#fff1d0', 2.2);
}
const ropeMat = new THREE.MeshStandardMaterial({ color: 0x2a2e31, roughness: 0.5, metalness: 0.6 });
const ropeGeo = new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0);
const kRope = new THREE.Mesh(ropeGeo, ropeMat); kRope.visible = false; scene.add(kRope);
const kLuffRope = new THREE.Mesh(ropeGeo, ropeMat); kLuffRope.visible = false; scene.add(kLuffRope);
function ropeBetween(m, a, b, r) { tmpA.copy(a); const d = tmpB.copy(b).sub(a), l = d.length(); m.position.copy(a); m.quaternion.setFromUnitVectors(qUp, d.normalize()); m.scale.set(r, l, r); m.visible = true; }
// lifting beam and slings
const RIG_H = 4.2;
const kRig = new THREE.Group(); kRig.visible = false; scene.add(kRig);
const kRigBeam = kit().box(0.5, 0.75, 0.42, 0, -0.35, 0, STH_D).box(0.25, 0.25, 0.1, 0, -0.85, 0, DK).box(1, 0.32, 0.36, 0, -1.65, 0, YEL).mesh();
kRig.add(kRigBeam);
const slingGeo = new THREE.BufferGeometry(); slingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
const kSlings = new THREE.LineSegments(slingGeo, new THREE.LineBasicMaterial({ color: 0x8a8f93 })); kSlings.frustumCulled = false; kRig.add(kSlings);
function rigFor(len, wid) { // re-shape the lifting beam for this panel
  kRigBeam.geometry.dispose();
  kRigBeam.geometry = kit().box(0.5, 0.75, 0.42, 0, -0.35, 0, STH_D).box(0.25, 0.25, 0.1, 0, -0.85, 0, DK).box(len * 0.75, 0.32, 0.36, 0, -1.65, 0, YEL).box(len * 0.75, 0.05, 0.37, 0, -1.55, 0, DK).mesh().geometry;
  const a = slingGeo.attributes.position, hx = len * 0.37, ex = len * 0.42, ez = wid * 0.42; let i = 0;
  const put = (x, y, z) => a.setXYZ(i++, x, y, z);
  put(0, -0.9, 0); put(-hx, -1.5, 0); put(0, -0.9, 0); put(hx, -1.5, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { put(sx * hx, -1.8, 0); put(sx * ex, -RIG_H + 0.25, sz * ez); }
  a.needsUpdate = true;
}

// ---------- the three S&C panels as lifted loads (copies of the real panels, clipped to their joints) ----------
const GHOSTS = PANELS.map(pn => {
  const g = new THREE.Group(), d = new THREE.Object3D();
  const bm = new THREE.InstancedMesh(bearerGeo, matConcrete, pn.bs.length);
  pn.bs.forEach((b, i) => { d.position.set(b.cx, 0, b.cz); d.rotation.set(0, b.rot, 0); d.scale.set(0.26, 1, b.len); d.updateMatrix(); bm.setMatrixAt(i, d.matrix); });
  bm.castShadow = bm.receiveShadow = true; g.add(bm);
  const pls = PLATES.filter(q => q.zone === pn.i), pm = new THREE.InstancedMesh(plateGeo, matPlate, pls.length);
  pls.forEach((q, i) => { d.position.set(q.x, 0, q.z); d.rotation.set(0, q.rot, 0); d.scale.setScalar(1); d.updateMatrix(); pm.setMatrixAt(i, d.matrix); }); g.add(pm);
  const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -pn.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), pn.x1)];
  const side = matRailSide.clone(), head = matRailHead.clone(); side.clippingPlanes = head.clippingPlanes = planes; side.clipShadows = head.clipShadows = true; MATS.push(side, head);
  for (const r of RAILS) if (r.x1 > pn.x0 && r.x0 < pn.x1) { const m = new THREE.Mesh(r.mesh.geometry, [side, head]); m.castShadow = true; g.add(m); }
  if (pn.i === 0) barGeos.forEach(bg => g.add(new THREE.Mesh(bg, matBar)));
  const wid = Math.max(...pn.bs.map(b => b.len));
  const lay = new THREE.Vector3(0, -0.62, 12.8 - pn.zc);
  g.visible = false; scene.add(g);
  return { g, planes, pn, wid, lay, len: pn.x1 - pn.x0 };
});
function placeGhost(gh, dx, dy, dz) { gh.g.position.set(dx, dy, dz); gh.planes[0].constant = -(gh.pn.x0 + dx); gh.planes[1].constant = gh.pn.x1 + dx; }

// ---------- ballast train: locomotive and three autoballaster hoppers (normal liveries) ----------
function locoKit(k, body = '#2f3b46', roof = GRY) {
  k.box(21, 0.5, 2.7, 0, 1.45, 0, DK); bogie(k, -6.9, 3); bogie(k, 6.9, 3);
  k.box(6, 0.8, 2.2, 0, 0.95, 0, DK).box(5.6, 0.1, 2.25, 0, 1.3, 0, '#3a3f44');
  k.box(18.4, 2.4, 2.66, 0, 2.9, 0, body).box(18, 0.3, 2.3, 0, 4.2, 0, roof);
  k.box(18.42, 0.22, 2.68, 0, 2.15, 0, '#b9c3c9');
  k.seams(-7.5, 7.5, 2.5, 2.9, 2.3, 2.66);
  for (const s of [-1, 1]) { k.box(0.9, 1.9, 0.04, s * 7.6, 2.75, 1.34, '#1a2228').box(0.9, 1.9, 0.04, s * 7.6, 2.75, -1.34, '#1a2228'); }
  for (let x = -6; x <= 6; x += 1.5) k.box(0.9, 0.9, 2.68, x, 3.3, 0, '#26313a');
  k.box(3, 0.35, 1.2, 1.5, 4.45, 0, '#22292f').box(1.0, 0.4, 0.8, -4.5, 4.5, 0, '#22292f');
  for (const s of [-1, 1]) {
    k.box(0.7, 2.25, 2.6, s * 9.55, 2.9, 0, YEL);                       // cab front warning panel
    k.box(0.5, 0.75, 2.3, s * 9.75, 3.55, 0, WIN, 0, s * 0.22);         // raked windscreen
    k.box(0.4, 0.55, 2.7, s * 10.4, 1.4, 0, DK);
    for (const z of [-0.95, 0.95]) k.cyl(0.17, 0.45, s * 10.7, 1.4, z, STEEL, 'x');
    k.box(1.6, 0.8, 0.04, s * 8.6, 3.55, 1.34, WIN).box(1.6, 0.8, 0.04, s * 8.6, 3.55, -1.34, WIN);
  }
}
const LOCO = 21, HOP = 14, NHOP = 3;
const train = new THREE.Group(); train.visible = false; scene.add(train);
{
  const loco = new THREE.Group(), k = kit(); locoKit(k, '#6b1d24', '#3b3f44'); loco.add(k.mesh());
  const l = kit(); for (const s of [-1, 1]) l.box(0.06, 0.2, 0.3, 10.62, 1.95, s * 0.9, '#fff4dc'); loco.add(l.mesh(matLamp, false));
  glow(loco, 10.7, 1.95, 0.9, '#fff1d0', 2.2); glow(loco, 10.7, 1.95, -0.9, '#fff1d0', 2.2);
  loco.position.x = -LOCO / 2; train.add(loco);
}
const hopperXs = [];
for (let i = 0; i < NHOP; i++) {
  const h = new THREE.Group(), k = kit();
  k.box(14, 0.4, 2.7, 0, 1.3, 0, DK); bogie(k, -4.8, 2); bogie(k, 4.8, 2);
  k.box(10.4, 1.0, 1.7, 0, 1.95, 0, YEL2);
  for (const s of [-1, 1]) k.box(10.6, 1.25, 0.12, 0, 2.15, s * 1.05, YEL2, 0, 0, s * 0.62);
  k.box(13.2, 1.45, 2.95, 0, 3.15, 0, YEL);
  for (let j = -2; j <= 2; j++) k.box(0.09, 1.47, 3.0, j * 2.6, 3.15, 0, YEL2);
  k.box(13.2, 0.08, 3.0, 0, 3.86, 0, YEL2).box(13.24, 0.1, 3.0, 0, 2.45, 0, YEL2);
  for (let j = 0; j < 9; j++) k.box(1.4, 0.22 + (j % 3) * 0.06, 2.6, -5.6 + j * 1.4, 3.98, 0, j % 2 ? '#6d6a66' : '#7a7671');
  for (const z of [-1.15, 0, 1.15]) k.box(0.7, 0.55, 0.45, 0, 1.2, z, DK);
  for (const s of [-1, 1]) { k.box(0.4, 0.3, 0.3, s * 7.1, 1.4, 0, DK); k.ladder(s * 6.4, 1.1, 3.9, 1.5); }
  k.rail(-6.4, 6.4, 4.8, 0, '#d0d6d9');
  h.add(k.mesh());
  const x = -LOCO - HOP / 2 - i * HOP; h.position.x = x; hopperXs.push(x); train.add(h);
}
const NROCK = lowPower ? 220 : 420;
const rockMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), phys({ color: 0x9a968f, roughness: 0.9 }), NROCK);
rockMesh.visible = false; scene.add(rockMesh);
const ROCKS = []; { const r = rand(42); for (let i = 0; i < NROCK; i++) ROCKS.push({ h: i % NHOP, lane: (i / NHOP | 0) % 3, ph: r(), s: 0.09 + r() * 0.09, dz: (r() - 0.5) * 0.5, rx: r() * 6, ry: r() * 6, sp: 0.7 + r() * 0.6 }); }

// ---------- S&C tamper (STH livery), working end at +x ----------
const tamper = new THREE.Group(); tamper.visible = false; scene.add(tamper);
{
  const k = kit();
  k.box(26.4, 0.45, 2.8, 0, 1.45, 0, DK);
  bogie(k, -9.6, 2); bogie(k, 9.6, 2);
  k.box(13.2, 2.4, 3.0, -4.9, 2.85, 0, STH_W).box(13.22, 0.55, 3.02, -4.9, 1.95, 0, STH_T).box(13.24, 0.08, 3.04, -4.9, 2.27, 0, STH_C);
  for (let x = -10.5; x <= 0.5; x += 1.6) k.box(0.9, 1.3, 3.04, x, 3.2, 0, '#c9d1d5').box(0.7, 0.05, 3.06, x, 3.5, 0, '#8f9aa0').box(0.7, 0.05, 3.06, x, 3.2, 0, '#8f9aa0').box(0.7, 0.05, 3.06, x, 2.9, 0, '#8f9aa0');
  k.seams(-11.3, 1.5, 3.2, 2.85, 2.3, 3.0);
  k.box(5.6, 0.55, 1.9, -6.2, 4.3, 0, GRY).box(2.2, 0.45, 1.6, -1.6, 4.25, 0, GRY); k.cyl(0.16, 1.0, -9.5, 4.6, 0.6, DK, 'y');
  for (const [cx, len, dir] of [[11.0, 4.2, 1], [-11.0, 4.0, -1]]) {
    k.box(len, 2.8, 3.0, cx, 3.05, 0, STH_W).box(len + 0.02, 0.55, 3.02, cx, 1.95, 0, STH_T).box(len + 0.04, 0.08, 3.04, cx, 2.27, 0, STH_C);
    k.box(len - 0.6, 0.85, 3.04, cx, 3.75, 0, WIN).mullions(cx - len / 2 + 0.3, cx + len / 2 - 0.3, (len - 0.6) / 3, 3.75, 0.85, 3.04);
    k.box(0.5, 0.9, 2.6, cx + dir * (len / 2 - 0.05), 3.75, 0, WIN, 0, dir * 0.2);
    k.box(len, 0.25, 3.0, cx, 4.55, 0, STH_T);
    k.ladder(cx - dir * (len / 2 - 0.4), 1.2, 3.0, 1.55);
  }
  k.box(6.6, 0.55, 3.0, 5.6, 4.15, 0, STH_T);
  for (const x of [2.5, 8.7]) for (const s of [-1, 1]) k.box(0.3, 2.3, 0.3, x, 2.85, s * 1.35, STH_D);
  k.box(1.6, 0.5, 2.4, 8.0, 1.05, 0, GRY).cyl(0.22, 0.12, 8.0, 0.75, 0.74, '#333', 'z').cyl(0.22, 0.12, 8.0, 0.75, -0.74, '#333', 'z');
  for (const s of [-1, 1]) k.rail(-11, 1.5, 2.35, s * 1.62, '#e0e5e8');
  for (const x of [-13.25, 13.25]) { k.box(0.25, 0.55, 2.8, x, 1.35, 0, DK); for (const s of [-1, 1]) k.cyl(0.14, 0.4, x + Math.sign(x) * 0.25, 1.35, s * 0.95, STEEL, 'x'); }
  k.box(1.0, 0.3, 1.6, 14.6, 0.85, 0, DK).wheelset(14.6, 0.25).box(1.5, 0.08, 0.1, 13.8, 0.95, 0, DK);
  tamper.add(k.mesh());
  logoSides(tamper, 3.6, -4.9, 3.05, 1.5);
  chevrons(tamper, 13.12, 2.45, 2.9, 0.75, 1); chevrons(tamper, -13.02, 2.45, 2.9, 0.75, -1);
  const l = kit();
  for (const s of [-1, 1]) { l.box(0.06, 0.2, 0.32, 13.15, 1.95, s * 0.95, '#fff6e0'); l.box(0.06, 0.16, 0.2, -13.05, 1.95, s * 0.95, '#ff3020'); }
  for (const x of [11.0, -11.0]) l.cyl(0.12, 0.22, x, 4.79, 1.05, '#ffa21a', 'y');
  for (const s of [-1, 1]) l.box(0.25, 0.12, 0.25, 5.6, 3.82, s * 1.2, '#fff2d6');
  tamper.add(l.mesh(matLamp, false));
  glow(tamper, 13.2, 1.95, 0.95, '#fff1d0', 2.2); glow(tamper, 13.2, 1.95, -0.95, '#fff1d0', 2.2);
  glow(tamper, -13.1, 1.95, 0.95, '#ff4030', 1.2); glow(tamper, -13.1, 1.95, -0.95, '#ff4030', 1.2);
  glow(tamper, 11.0, 4.9, 1.05, '#ffa21a', 1.5); glow(tamper, -11.0, 4.9, 1.05, '#ffa21a', 1.5);
}
const tampHead = kit();
for (const s of [-1, 1]) {
  tampHead.box(1.1, 1.3, 0.62, 0, 2.05, s * 0.74, '#e2a514');
  tampHead.box(1.3, 0.2, 0.8, 0, 1.38, s * 0.74, DK);
  tampHead.cyl(0.09, 0.9, -0.3, 2.9, s * 0.74, '#9aa0a5', 'y').cyl(0.09, 0.9, 0.3, 2.9, s * 0.74, '#9aa0a5', 'y');
  for (const dx of [-0.36, 0.36]) for (const dz of [-0.24, 0.24]) tampHead.box(0.07, 1.05, 0.07, dx, 0.82, s * 0.74 + dz, STEEL).box(0.12, 0.12, 0.04, dx, 0.32, s * 0.74 + dz, STEEL);
}
const tampHeadMesh = tampHead.mesh(); tampHeadMesh.position.x = 5.6; tamper.add(tampHeadMesh);
const workGlow = new THREE.Mesh(new THREE.PlaneGeometry(9, 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffc27a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
workGlow.position.set(5.6, 0.42, 0); tamper.add(workGlow);
const tampMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const tamp2 = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.3), tampMat); scene.add(tamp2);

// ---------- wiring train (normal livery): loco, drum carrier and a MEWP wagon running the wires out ----------
const wiring = new THREE.Group(); wiring.visible = false; scene.add(wiring);
{
  const loco = new THREE.Group(), k = kit(); locoKit(k, '#e2a514', '#5a5f63'); loco.add(k.mesh());
  const l = kit(); for (const s of [-1, 1]) l.box(0.06, 0.2, 0.3, 10.62, 1.95, s * 0.9, '#fff4dc'); loco.add(l.mesh(matLamp, false));
  glow(loco, 10.7, 1.95, 0.9, '#fff1d0', 2.2); glow(loco, 10.7, 1.95, -0.9, '#fff1d0', 2.2);
  loco.position.x = -10.5; wiring.add(loco);
  const w = new THREE.Group(), kw = kit();
  kw.box(16, 0.5, 2.7, 0, 1.4, 0, DK); bogie(kw, -5.5, 2); bogie(kw, 5.5, 2); kw.box(15.6, 0.15, 2.8, 0, 1.7, 0, '#3d4246');
  for (const x of [-4.2, 0.2]) { for (const s of [-1, 1]) kw.box(1.2, 2.6, 0.15, x, 2.9, s * 1.25, YEL); kw.cyl(1.25, 2.2, x, 3.0, 0, '#6b4f36', 'z', 20).cyl(0.75, 2.25, x, 3.0, 0, '#b07045', 'z', 20); }
  kw.box(3.4, 0.8, 2.6, 5.4, 2.2, 0, YEL).box(0.25, 2.8, 0.25, 4.6, 3.9, 0.6, '#c9d0d4').box(2.6, 0.15, 2.0, 5.2, 5.4, 0.7, YEL);
  kw.rail(4.0, 6.4, 6.4, 1.7, '#e0e5e8');
  w.add(kw.mesh()); w.position.x = -21 - 8; wiring.add(w);
  const op = person('#f4f6f7'); op.visible = true; op.position.set(5.6, 5.48, 0.7); op.rotation.y = Math.PI / 2; w.add(op);
  glow(w, 5.2, 6.2, 1.6, '#fff1d0', 2.0);
}
const WIRING_REAR = -21 - 16 - 2; // wire is run out behind the MEWP wagon

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
S1.dash(u => ZA, U0 - 4, U1 + 4, 0.06, 0.09, 1); // existing adjacent line
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


sheetText('EXISTING LINE', -24, ZA + 0.7, 0.55, [0.07, T.descend[1]], { k: 0.7 });
buildGlows();

// ---------- labels ----------
const LABELS = []; // chapter captions carry the words now
for (const L of LABELS) { const d = document.createElement('div'); d.className = 'xp-label'; d.textContent = L.t; labelsEl.appendChild(d); L.el = d; L.v = new THREE.Vector3(...L.p); }

// ---------- camera ----------
// [progress, targetX, targetZ, distance, elevation°, azimuth°, fov]
const KEYS = [
  [0.000, 24, -3, 128, 88, -64, 30],
  [0.060, 22, -3, 104, 84, -58, 30],
  [0.110, 22, -3, 90, 80, -50, 30],
  [0.180, 21, -3, 84, 74, -44, 30],
  [0.255, 18, -3, 70, 58, -30, 31],
  [0.305, 14, -2.5, 46, 32, -4, 34],
  [0.350, 4, 0, 58, 28, -52, 35],
  [0.400, 4, 1, 50, 24, -68, 36],
  [0.445, 6, 1.5, 44, 22, -38, 37],
  [0.475, 8, 5, 38, 22, -62, 38],
  [0.500, 5, 1, 34, 26, -84, 38],
  [0.530, 17, 4, 38, 24, -56, 38],
  [0.555, 17, 0, 36, 30, -94, 38],
  [0.580, 28, 4, 42, 24, -58, 38],
  [0.605, 26, 0, 40, 30, -104, 38],
  [0.632, -14, 0.5, 38, 24, -70, 38],
  [0.665, 16, 0.5, 38, 26, -56, 38],
  [0.698, 46, 0, 42, 28, -40, 38],
  [0.712, -18, 0, 30, 22, -52, 38],
  [0.740, 22, 0, 28, 20, -22, 38],
  [0.770, 56, -1, 30, 22, 12, 38],
  [0.795, 14, 1, 34, 20, 40, 38],
  [0.825, 30, 2, 44, 18, 70, 38],
  [0.890, 27, -1.5, 16, 15, 64, 40],
  [0.945, uX + 2, -1.5, 15, 17, 104, 38],
  [1.000, uX + 3, -1.8, 19, 21, 146, 36],
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
  if (aspect >= 1) camera.setViewOffset(viewW, viewH, -viewW * 0.1 * shift, 0, viewW, viewH);
  else camera.setViewOffset(viewW, viewH, 0, viewH * 0.12 * shift, viewW, viewH);
  camera.updateProjectionMatrix();
}

// ---------- Kirow: positions and slew/luff for each lift ----------
const PARK_LUFF = 10 * DEG;
const KX = PANELS.map(pn => pn.pc + 4);
const landAt = i => lerp(T.lifts[i][0], T.lifts[i][1], 0.74);
function aim(K, tx, tz) { const r0 = Math.hypot(tx - K, tz - ZA); return { phi: Math.atan2(-(tz - ZA), tx - K), th: Math.acos(clamp((r0 - 1.8) / KIROW_L, 0.15, 0.97)) }; }
const LIFT = PANELS.map((pn, i) => {
  const pick = aim(KX[i], pn.pc, GHOSTS[i].lay.z + pn.zc), place = aim(KX[i], pn.pc, pn.zc);
  if (place.phi - pick.phi > Math.PI) place.phi -= Math.PI * 2;
  if (pick.phi - place.phi > Math.PI) place.phi += Math.PI * 2;
  return { pick, place };
});
const tipW = new THREE.Vector3(), luffW = new THREE.Vector3(), hookW = new THREE.Vector3();
let rigShape = -1;
function setKirow(K, phi, th) { kirow.position.set(K, 0, ZA); kSlew.rotation.y = phi; kJib.rotation.z = th; kirow.updateMatrixWorld(true); tipW.set(KIROW_L + 0.25, -0.1, 0); kJib.localToWorld(tipW); luffW.set(-3.3, 5.65, 0); kSlew.localToWorld(luffW); }
function applyKirow(p) {
  const on = p > T.kirowIn[0] && p < T.kirowOut[1];
  kirow.visible = on;
  // ghost panels: on the laydown until lifted, then the real panel takes over once landed
  GHOSTS.forEach((gh, i) => { gh.g.visible = p > T.descend[0] && p < landAt(i); if (gh.g.visible) placeGhost(gh, gh.lay.x, gh.lay.y, gh.lay.z); });
  if (!on) { kRope.visible = kLuffRope.visible = kRig.visible = false; return { cur: -1 }; }
  let i = T.lifts.findIndex(w => p < w[1]); if (p < T.lifts[0][0]) i = -1;
  if (p < T.lifts[0][0]) { // arriving
    setKirow(lerp(-170, KX[0], easeOut(span(p, ...T.kirowIn))), 0, PARK_LUFF);
    hookW.set(tipW.x, tipW.y - 2.5, tipW.z); kRig.visible = false;
  } else if (i === -1) { // leaving
    setKirow(lerp(KX[2], -180, Math.pow(span(p, ...T.kirowOut), 1.4)), 0, PARK_LUFF);
    hookW.set(tipW.x, tipW.y - 2.5, tipW.z); kRig.visible = false;
  } else {
    const [a, b] = T.lifts[i], k = span(p, a, b), gh = GHOSTS[i], { pick, place } = LIFT[i];
    if (rigShape !== i) { rigFor(gh.len, gh.wid); rigShape = i; }
    const K = lerp(i === 0 ? KX[0] : KX[i - 1], KX[i], ease(span(k, 0, 0.12)));
    const kA = ease(span(k, 0.12, 0.26)), kH = ease(span(k, 0.26, 0.36)), kS = easeIO(span(k, 0.36, 0.62)), kL = ease(span(k, 0.62, 0.74)), kF = ease(span(k, 0.74, 0.84)), kB = ease(span(k, 0.84, 1));
    let phi, th;
    if (kB > 0) { phi = lerp(place.phi, -Math.PI * 2, kB); th = lerp(place.th, PARK_LUFF, kB); }
    else if (kS > 0) { phi = lerp(pick.phi, place.phi, kS); th = lerp(pick.th, place.th, kS); }
    else { phi = lerp(0, pick.phi, kA); th = lerp(PARK_LUFF, pick.th, kA); }
    setKirow(K, phi, th);
    const high = 4.6;
    if (k >= 0.26 && k < 0.74) {
      const y = kS <= 0 ? lerp(gh.lay.y, gh.lay.y + high, kH) : kL <= 0 ? lerp(gh.lay.y + high, high, kS) : lerp(high, 0, kL);
      gh.g.visible = true; placeGhost(gh, tipW.x - gh.pn.pc, y, tipW.z - gh.pn.zc);
      hookW.set(tipW.x, y + RIG_H, tipW.z);
    } else if (k < 0.26) {
      hookW.set(tipW.x, lerp(tipW.y - 3, gh.lay.y + RIG_H, kA), tipW.z);
    } else {
      hookW.set(tipW.x, kB > 0 ? tipW.y - 3 : lerp(RIG_H, tipW.y - 3, kF), tipW.z);
    }
    hookW.y = Math.min(hookW.y, tipW.y - 0.8);
    kRig.visible = true; kRig.position.copy(hookW);
    kSlings.visible = k > 0.2 && k < 0.8;
  }
  ropeBetween(kRope, hookW, tipW, 0.03); ropeBetween(kLuffRope, luffW, tipW, 0.035);
  return { cur: i };
}

// ---------- apply state ----------
const dummy = new THREE.Object3D();
const tmpV = new THREE.Vector3();
let testX = -1e4, tampX = -1e4, trainFront = -1e4, scanX = -1e4, rrvX = -1e4, wiringFront = -1e4;
function setBed(mesh, k, rise) {
  mesh.visible = k > 0.001; mesh.material.opacity = k; mesh.material.transparent = k < 0.999; mesh.material.depthWrite = k > 0.5;
  mesh.position.y = -(1 - easeOut(k)) * rise;
}
function apply(p) {
  // ----- drawing -----
  scanX = lerp(-26, 80, ease(span(p, ...T.scan))); scanU.value = p > T.scan[1] ? 1e4 : scanX;
  const scanOn = win(p, T.scan[0], T.scan[1], 0.008);
  scanWall.visible = scanOn > 0.01; scanWall.material.uniforms.uO.value = scanOn; scanWall.position.set(scanX, -0.02, -3);
  const cadFade = 1 - 0.88 * ease(span(p, T.descend[0] + 0.03, T.plainSlp[1])) + 0.45 * span(p, 0.93, 1);
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
  cadWire.material.uniforms.uFade.value = (1 - ease(span(p, T.descend[1] - 0.01, T.plainSlp[0] + 0.01))) + 0.35 * span(p, 0.93, 1);
  for (const c of CADS) c.visible = c.material.uniforms.uFade.value > 0.005 && p > 0.001;
  for (const t of TEXTS) { const o = win(p, t.w[0], t.w[1], 0.012) * t.k; t.m.visible = o > 0.01; t.m.material.opacity = o; }
  // ----- site, earthworks -----
  const lit = ease(span(p, T.descend[0], T.descend[1]));
  ground.visible = lit > 0.01; LEGS.forEach(g => g.visible = lit > 0.01); TOWERS.forEach(t => t.visible = lit > 0.01);
  setBed(formation, ease(span(p, ...T.formation)), 0.6);
  setBed(bottomBallast, ease(span(p, ...T.bottom)), 0.35);
  // ----- OLE masts going up as the RRV works along the adjacent line -----
  rrvX = lerp(-125, 165, span(p, ...T.masts));
  rrv.visible = p > T.masts[0] && p < T.masts[1]; rrv.position.set(rrvX, 0, ZA);
  for (const m of MASTS) { m.piv.visible = lit > 0.01; const k = ease(clamp((rrvX - (m.x - 7)) / 8)); m.piv.rotation.z = (1 - k) * Math.PI / 2 * 0.985; m.piv.position.y = -0.62 + (1 - k) * 0.25; }
  // ----- Kirow and the S&C panels -----
  const kir = applyKirow(p);
  const landed = [0, 1, 2].map(i => p >= landAt(i));
  let last = -1; landed.forEach((l, i) => { if (l) last = i; });
  RU.uM.value = last < 0 ? -1e4 : PANELS[last].x1; RU.uM0.value = last < 0 ? -1e4 : PANELS[last].x0;
  RU.uFlash.value = last < 0 ? 0 : 1 - span(p, landAt(last), landAt(last) + 0.014);
  // plain line either side: bearers, rails, fixings
  const kl = ease(span(p, ...T.plainRail));
  RU.uL.value = kl <= 0 ? -1e4 : kl >= 1 ? 1e4 : lerp(U0, PJ[0], kl);
  RU.uR.value = kl <= 0 ? -1e4 : kl >= 1 ? 1e4 : lerp(XB, U1, kl);
  const anyRail = kl > 0 || last >= 0; for (const r of RAILS) r.mesh.visible = anyRail;
  for (let i = 0; i < BEARERS.length; i++) {
    const b = BEARERS[i]; let k;
    if (typeof b.zone === 'number') k = landed[b.zone] ? 1 : 0; else k = easeOut(clamp((p - b.birth) / 0.012));
    dummy.position.set(b.cx, (1 - k) * 1.4, b.cz); dummy.rotation.set(0, b.rot, 0);
    if (k <= 0) dummy.scale.setScalar(0.0001); else dummy.scale.set(0.26, 1, b.len);
    dummy.updateMatrix(); bearerMesh.setMatrixAt(i, dummy.matrix);
  }
  bearerMesh.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < PLATES.length; i++) {
    const q = PLATES[i], pan = typeof q.zone === 'number';
    const k = pan ? (landed[q.zone] ? 1 : 0) : clamp((p - q.birth) / 0.01);
    dummy.position.set(q.x, (1 - k) * 0.5, q.z); dummy.rotation.set(0, q.rot, 0); dummy.scale.setScalar(k > 0 ? 1 : 0.0001); dummy.updateMatrix(); plateMesh.setMatrixAt(i, dummy.matrix);
    for (let c = 0; c < 2; c++) {
      const side = c ? 1 : -1, kc = pan ? k : clamp((p - q.birth - 0.006) / 0.01);
      dummy.position.set(q.x + Math.sin(q.rot) * side * 0.105, (1 - kc) * 0.4, q.z + Math.cos(q.rot) * side * 0.105);
      dummy.rotation.set(0, q.rot + (side > 0 ? Math.PI : 0), 0); dummy.scale.setScalar(kc > 0 ? 1 : 0.0001); dummy.updateMatrix(); clipMesh.setMatrixAt(i * 2 + c, dummy.matrix);
    }
  }
  plateMesh.instanceMatrix.needsUpdate = clipMesh.instanceMatrix.needsUpdate = true;
  barMeshes.forEach(m => m.visible = landed[0]);
  // ----- ballast train: arrives, drops top ballast from its hoppers as it runs through, then leaves -----
  const [ta, tb] = T.train, [da, db] = T.top, LEAD = -LOCO - HOP / 2;
  const dropStart = U0 + 2, dropEnd = U1 + 1;
  if (p < da) trainFront = lerp(-160, dropStart - LEAD, easeOut(span(p, ta, da)));
  else if (p < db) trainFront = lerp(dropStart - LEAD, dropEnd - LEAD, span(p, da, db));
  else trainFront = lerp(dropEnd - LEAD, dropEnd - LEAD + 260, Math.pow(span(p, db, tb), 1.6));
  train.visible = p > ta && p < tb; train.position.set(trainFront, 0, 0);
  DROP.value = p < da ? -1e4 : p >= db ? 1e4 : trainFront + LEAD;
  topBallast.visible = p >= da; topBallast.material.opacity = 1; topBallast.material.transparent = false; topBallast.position.y = 0;
  const dropping = p > da && p < db;
  rockMesh.visible = dropping;
  if (dropping) {
    for (let i = 0; i < NROCK; i++) {
      const r = ROCKS[i], cx = trainFront + hopperXs[r.h], s = (r.ph + trainFront * 0.55 * r.sp) % 1;
      const live = cx > dropStart && cx < dropEnd, lz = [-1.15, 0, 1.15][r.lane];
      dummy.position.set(cx - s * 0.9, 0.95 - 0.75 * s * s, lz + (r.lane === 1 ? r.dz * 0.6 : Math.sign(lz) * s * 0.9) + r.dz * 0.4);
      dummy.rotation.set(r.rx + s * 4, r.ry, 0); dummy.scale.setScalar(live ? r.s : 0.0001); dummy.updateMatrix(); rockMesh.setMatrixAt(i, dummy.matrix);
    }
    rockMesh.instanceMatrix.needsUpdate = true;
  }
  // ----- tamper: follows the train in, tamps through the S&C, then runs off -----
  const [ma, mb] = T.tamp, TH = 5.6;
  let tf;
  if (p < ma) tf = lerp(-150, U0 + 0.5, easeOut(span(p, ma - 0.035, ma)));
  else if (p < mb) tf = lerp(U0 + 0.5, U1 - 1, span(p, ma, mb));
  else tf = lerp(U1 - 1, U1 + 220, Math.pow(span(p, mb, T.test[1]), 1.5));
  tampX = tf; tamper.visible = p > ma - 0.035 && p < T.test[1]; tamper.position.set(tampX - TH, 0, 0);
  const working = p > ma && p < mb;
  tampHeadMesh.position.y = working ? -0.42 * Math.pow(0.5 - 0.5 * Math.cos(tampX / 0.65 * Math.PI * 2), 1.5) : 0.15;
  workGlow.material.opacity = working ? 0.34 : 0.0;
  const tv = win(p, ma, mb, 0.006);
  tampMat.opacity = 0.3 * tv; tamp2.position.set(tampX, 0.42, vc(tampX)); tamp2.rotation.y = Math.PI / 2 - Math.atan(-dvc(tampX)); tamp2.visible = tampX > 4 && tv > 0.01;
  const ks = span(p, ...T.test); testX = ks > 0 && ks < 1 ? lerp(U0, U1, ks) : -1e4; RU.uTest.value = testX;
  // ----- wiring train runs the OLE out on the adjacent line -----
  const kw = span(p, ...T.wire);
  wiringFront = lerp(-40, 240, kw); wiring.visible = kw > 0 && kw < 1; wiring.position.set(wiringFront, 0, ZA);
  wireFront = p < T.wire[0] ? -1e4 : p >= T.wire[1] ? 1e4 : wiringFront + WIRING_REAR;
  wireMesh.visible = p >= T.wire[0]; updateWires();
  // ----- site team -----
  [engineer, controller, ...ops].forEach(f => f.visible = false);
  if (lit > 0.5) {
    if (kir.cur >= 0) {
      const pn = PANELS[kir.cur], gh = GHOSTS[kir.cur], edge = pn.zc - gh.wid / 2;
      stand(engineer, pn.pc - 2.5, edge - 2.2, pn.pc, pn.zc, p);
      stand(ops[0], pn.x0 - 1.0, edge - 1.0, pn.pc, pn.zc, p); stand(ops[1], pn.x1 + 1.0, edge - 1.0, pn.pc, pn.zc, p); stand(ops[2], pn.pc + 3.5, edge - 1.6, pn.pc, pn.zc, p);
      stand(controller, kirow.position.x - 4, 9.4, tipW.x, tipW.z, p);
    } else if (p > T.plainSlp[0] && p < T.lifts[0][0]) {
      stand(engineer, -6, -3.6, -6, 0, p); stand(ops[0], -14, -2.9, -14, 0, p); stand(ops[1], XB + 8, vc(XB + 8) - 2.9, XB + 8, 0, p);
    } else if (p > T.train[0] && p < T.test[0]) {
      stand(engineer, -7, -4.4, 0, -4.4, p); stand(ops[0], -34, -3.4, -40, -3.4, p);
    } else if (p >= T.test[0]) {
      stand(engineer, uX + 5, vc(uX + 5) - 3.0, uX, -HC, p); stand(ops[0], uX - 1, vc(uX - 1) - 3.4, uX, -HC, p); stand(ops[1], uX - 2.6, vc(uX - 2.6) - 3.6, uX, -HC, p);
    }
  }
  // ----- night possession lighting -----
  moon.intensity = 0.9 * lit; hemi.intensity = 0.15 + 0.38 * lit; rim.intensity = 0.8 * lit; scene.environmentIntensity = 0.2 * lit;
  towerSpots.forEach(s => s.intensity = 3600 * lit);
  updateGlows(lit);
  const away = 0;
  scene.fog.density = lerp(0.004, 0.0085, lit) + 0.006 * away; renderer.toneMappingExposure = 1.05 + 0.15 * lit - 0.3 * away;
  placeCamera(p);
}

// ---------- UI ----------
const PHASE_AT = [0, 0.345, 0.61, 0.84, 0.92];
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
  active = PHASE_AT.filter(a => p >= a).length - 1;
  stageNumEl.textContent = active < 4 ? `0${active + 1} / 04 · ${PHASES[active]}` : 'Concept visualisation';
  dots.forEach((d, i) => d.setAttribute('aria-current', i === active ? 'step' : 'false'));
  steps.forEach(li => { const a = +li.dataset.a, b = +li.dataset.b; li.classList.toggle('now', p >= a && p < b); li.classList.toggle('done', p >= b); });
  for (const L of LABELS) {
    const o = win(p, L.w[0], L.w[1], 0.012);
    if (o <= 0.01) { L.el.style.opacity = 0; continue; }
    if (L.dyn === 'tamp') L.v.set(tampX, 2.2, 0);
    if (L.dyn === 'test') L.v.set(testX, 0.45, -HC);
    if (L.dyn === 'scan') L.v.set(scanX, 5.4, 6);
    if (L.dyn === 'train') L.v.set(trainFront + hopperXs[0], 4.4, 0);
    if (L.dyn === 'rrv') L.v.set(rrvX + 4, 5.5, ZA);
    if (L.dyn === 'wire') L.v.set(wiringFront - 26, 6.5, ZA);
    if (L.dyn && L.dyn.startsWith('load')) { const gh = GHOSTS[+L.dyn.slice(4)]; L.v.set(gh.pn.pc + gh.g.position.x, gh.g.position.y + 0.6, gh.pn.zc + gh.g.position.z); }
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
  renderer.setSize(viewW, viewH, false); camera.aspect = aspect; RES.set(viewW * renderer.getPixelRatio() / 2, viewH * renderer.getPixelRatio() / 2);
  if (glowPts) glowPts.material.uniforms.uScale.value = viewH * renderer.getPixelRatio() * 0.9;
  dirty = true;
}
let target = 0, cur = 0, dirty = true, visible = true, raf = 0, lastT = performance.now();
// four chapters, each a full-screen window onto the same scene and each owning one slice of the build
const CHAPS = [...document.querySelectorAll('.chap')].map(el => ({ el, r: el.dataset.range.split(',').map(Number), cap: el.querySelector('.chap-cap'), bar: el.querySelector('.chap-bar i') }));
let chapIdx = -1, inView = false;
const scrollProgress = () => {
  let best = -1, bestVis = 0, kBest = 0;
  CHAPS.forEach((c, i) => {
    const r = c.el.getBoundingClientRect(), vis = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    const k = clamp(-r.top / Math.max(1, r.height - innerHeight));
    c.cap.classList.toggle('on', vis > innerHeight * 0.5 && k < 0.985); c.bar.style.transform = `scaleX(${k.toFixed(3)})`;
    if (vis > bestVis) { bestVis = vis; best = i; kBest = k; }
  });
  inView = best >= 0;
  if (!inView) return target;
  if (best !== chapIdx) { chapIdx = best; snap = true; }
  const c = CHAPS[best]; return lerp(c.r[0], c.r[1], kBest);
};
let snap = false;
function kick() { if (!raf && visible) { lastT = performance.now(); raf = requestAnimationFrame(frame); } }
let slow = 0, frames = 0, degraded = false;
function frame(now) {
  raf = 0;
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (snap) { cur = target; snap = false; }
  if (!inView) { raf = 0; return; }
  const diff = target - cur;
  cur = Math.abs(diff) < 0.0002 ? target : cur + diff * (1 - Math.exp(-dt * 7));
  apply(cur); ui(cur); renderer.render(scene, camera);
  frames++; if (dt > 0.045) slow++;
  if (!degraded && frames > 40 && slow > 18) {
    degraded = true; renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; moon.castShadow = false; towerSpots.forEach(s => s.castShadow = false); MATS.forEach(m => m.needsUpdate = true);
    for (const c of CADS) c.material.uniforms.uW.value /= DPR; resize();
  }
  if (cur !== target || dirty) { dirty = false; raf = requestAnimationFrame(frame); }
}
new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }, { rootMargin: '200px' }).observe(root);
addEventListener('scroll', () => { target = scrollProgress(); kick(); }, { passive: true });
addEventListener('resize', () => { resize(); target = scrollProgress(); kick(); });
dots.forEach(d => d.addEventListener('click', () => { const r = root.getBoundingClientRect(), total = r.height - innerHeight; scrollTo({ top: scrollY + r.top + total * +d.dataset.p, behavior: 'smooth' }); }));
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fallback('context-lost'); });

document.body.classList.add('xp-live');
resize();
target = cur = scrollProgress();
apply(cur); ui(cur); renderer.render(scene, camera);
root.classList.add('xp-ready');
dispatchEvent(new Event('xp-ready'));
window.__xp = { progress: scrollProgress, set(p) { target = cur = p; apply(p); ui(p); renderer.render(scene, camera); }, info: () => renderer.info };
