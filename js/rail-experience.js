// STH Construction & Engineering: scroll-built turnout (concept visualisation, illustrative geometry).
// Units are metres. x = along the main line from the switch toe, z = across (diverging side negative), y = up.
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
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function fallback(reason) {
  root.classList.add('xp-static');
  root.dataset.fallback = reason || 'unsupported';
}
if (reduce) { fallback('reduced-motion'); throw new Error('reduced motion: static presentation'); }

// ---------- helpers ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const span = (p, a, b) => clamp((p - a) / (b - a));

// ---------- geometry (illustrative, matches the site's design-check band) ----------
const G = 1.435, R = 190, HC = G / 2 + 0.036;          // gauge, radius, rail centre offset
const uX = Math.sqrt(2 * R * G - G * G);                // crossing nose (≈23.31 m)
const TA = uX / Math.sqrt(R * R - uX * uX);             // tan of crossing angle
const ANG = Math.atan(TA);
const U0 = -16, U1 = 64;
const vc = u => u <= 0 ? 0 : u <= uX ? -(R - Math.sqrt(R * R - u * u)) : -(G + (u - uX) * TA);
const dvc = u => u <= 0 ? 0 : u <= uX ? -u / Math.sqrt(R * R - u * u) : -TA; // slope
const HEEL = 10.5, THROAT = uX - 2.1, FW = 0.112;       // heel, throat, flangeway + head offset

const isMobile = matchMedia('(max-width: 760px)').matches;
const lowPower = isMobile || (navigator.hardwareConcurrency || 8) <= 4;

// ---------- renderer ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) { fallback('webgl'); throw e; }
if (!renderer.getContext()) { fallback('webgl'); throw new Error('no webgl'); }
let dprCap = isMobile ? 1.75 : 2;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap));
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
scene.environmentIntensity = 0.0;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 600);

// lights
const hemi = new THREE.HemisphereLight(0x5f8fa6, 0x0a1218, 0.0);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff1de, 0.0);
key.position.set(-18, 34, 22);
key.target.position.set(20, 0, -3);
key.castShadow = true;
key.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
Object.assign(key.shadow.camera, { left: -48, right: 48, top: 30, bottom: -30, near: 1, far: 120 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x58d6f2, 0.0);
rim.position.set(60, 8, -30);
scene.add(rim);

// ---------- procedural textures ----------
function noiseCanvas(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size); return c;
}
function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const concreteTex = new THREE.CanvasTexture(noiseCanvas(256, (g, n) => {
  const r = rand(7); g.fillStyle = '#8f918b'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 2600; i++) { const v = 110 + r() * 60 | 0; g.fillStyle = `rgba(${v},${v},${v - 4},${0.25 + r() * 0.35})`; g.fillRect(r() * n, r() * n, 1 + r() * 2.5, 1 + r() * 2.5); }
}));
concreteTex.colorSpace = THREE.SRGBColorSpace; concreteTex.wrapS = concreteTex.wrapT = THREE.RepeatWrapping;

const ballastTex = new THREE.CanvasTexture(noiseCanvas(512, (g, n) => {
  const r = rand(21); g.fillStyle = '#242424'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 5200; i++) {
    const x = r() * n, y = r() * n, s = 5 + r() * 8, base = 62 + r() * 70 | 0, warm = r() * 14 | 0;
    g.fillStyle = `rgb(${base + warm},${base},${base - 4})`;
    g.beginPath();
    const k = 5 + (r() * 3 | 0);
    for (let j = 0; j < k; j++) { const a = j / k * 6.283 + r() * 0.5, rr = s * (0.6 + r() * 0.5); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x - s * 0.3, y - s * 0.4, s * 0.5, s * 0.25);
  }
}));
ballastTex.colorSpace = THREE.SRGBColorSpace; ballastTex.wrapS = ballastTex.wrapT = THREE.RepeatWrapping;
ballastTex.repeat.set(64, 13);
ballastTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

// ---------- materials ----------
// Each physical material morphs from a cyan "CAD hologram" look to its real finish (uMorph 0→1).
const MATS = [];
function physMat(opts, cadTint = 1) {
  const m = new THREE.MeshStandardMaterial(opts);
  m.userData.base = { color: m.color.clone(), metalness: m.metalness, roughness: m.roughness, map: m.map };
  m.userData.cadTint = cadTint;
  MATS.push(m);
  return m;
}
const matRailSide = physMat({ color: 0x5b4a40, metalness: 0.55, roughness: 0.72 }, 2.2);
const matRailHead = physMat({ color: 0xaeb7bd, metalness: 1.0, roughness: 0.3 }, 2.6);
const matConcrete = physMat({ color: 0xa9aba4, roughness: 0.92, metalness: 0.0, map: concreteTex }, 0.5);
const matPlate = physMat({ color: 0x30353a, roughness: 0.55, metalness: 0.6 }, 0.6);
const matClip = physMat({ color: 0x2c3329, roughness: 0.55, metalness: 0.5 }, 0.6);
const matBar = physMat({ color: 0x3a3f44, roughness: 0.5, metalness: 0.7 }, 0.6);

// Rails reveal along the track: fragments beyond uReveal (world x) are discarded, with a bright cutting edge.
function addReveal(mat, uni) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uReveal = uni.reveal; sh.uniforms.uRevealFrom = uni.from;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWX;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWX = (modelMatrix * vec4(transformed,1.0)).x;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWX; uniform float uReveal; uniform float uRevealFrom;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif ((uRevealFrom < 0.5 && vWX > uReveal) || (uRevealFrom > 0.5 && vWX < uReveal)) discard;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat edge = (uRevealFrom < 0.5) ? (uReveal - vWX) : (vWX - uReveal);\ntotalEmissiveRadiance += vec3(0.31,0.83,0.94) * 2.2 * (1.0 - smoothstep(0.0, 1.4, edge)) * step(-1000.0, uReveal) * step(uReveal, 999.0);');
  };
  mat.customProgramCacheKey = () => 'reveal';
}

// ---------- rail sweep ----------
// Simplified flat-bottom rail profile (lateral s, height y): foot, web, head.
const PROF = [[-0.075, 0], [0.075, 0], [0.075, 0.011], [0.013, 0.03], [0.008, 0.105], [0.036, 0.117], [0.036, 0.154], [0.03, 0.16], [-0.03, 0.16], [-0.036, 0.154], [-0.036, 0.117], [-0.008, 0.105], [-0.013, 0.03], [-0.075, 0.011]];
const HEAD_EDGES = new Set([6, 7, 8]); // segments forming the running surface (polished)
const RAIL_Y = 0.235; // top of bearer (0.2) + baseplate

function samplePath(fn, a, b, step) {
  const pts = []; const n = Math.max(1, Math.ceil((b - a) / step));
  for (let i = 0; i <= n; i++) { const u = a + (b - a) * i / n; pts.push(fn(u)); }
  return pts;
}
// pts: [[x,z,(headScale),(heightScale)]]
function sweepRail(pts, { headScaleFn = null } = {}) {
  const pos = [], nor = [], idx = [], groups = [[], []];
  const N = pts.length;
  const frames = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    return { tx, tz, nx: -tz, nz: tx };
  });
  let v = 0;
  for (let e = 0; e < PROF.length; e++) {
    const A = PROF[e], B = PROF[(e + 1) % PROF.length];
    const es = B[0] - A[0], ey = B[1] - A[1]; const el = Math.hypot(es, ey);
    const ns = ey / el, ny = -es / el; // outward normal in profile plane
    const start = v;
    for (let i = 0; i < N; i++) {
      const p = pts[i], f = frames[i];
      const hs = headScaleFn ? headScaleFn(p[0]) : 1;
      for (const Q of [A, B]) {
        const isHead = Q[1] > 0.11; const s = Q[0] * (isHead ? hs : 1), y = Q[1] * (isHead ? (0.75 + 0.25 * hs) : 1);
        pos.push(p[0] + f.nx * s, RAIL_Y + y, p[1] + f.nz * s);
        nor.push(f.nx * ns, ny, f.nz * ns);
      }
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

// Components and their build windows (scroll progress).
const railGroup = new THREE.Group(); scene.add(railGroup);
const RAILS = []; // {mesh, from, to, x0, x1, uni}
function addRail(name, pts, win, opts = {}) {
  const geo = sweepRail(pts, opts);
  const uni = { reveal: { value: -1e4 }, from: { value: 0 } };
  const side = matRailSide.clone(), head = matRailHead.clone();
  side.userData = matRailSide.userData; head.userData = matRailHead.userData;
  MATS.push(side, head);
  addReveal(side, uni); addReveal(head, uni);
  const mesh = new THREE.Mesh(geo, [side, head]);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = name;
  railGroup.add(mesh);
  const xs = pts.map(p => p[0]);
  RAILS.push({ mesh, win, x0: Math.min(...xs), x1: Math.max(...xs), uni, name });
}
const P = (fn, a, b, step = 0.5) => samplePath(fn, a, b, step);
// timeline windows
const W = { stock: [0.40, 0.49], blades: [0.47, 0.53], closure: [0.49, 0.555], crossing: [0.53, 0.585], check: [0.565, 0.6], plain: [0.44, 0.53] };

// Right stock rail, continuous main-line right rail
addRail('stock-right', [[U0, HC], [U1, HC]], W.stock);
// Left stock rail continuing as the diverging outer rail
addRail('stock-left', [[U0, -HC], ...P(u => [u, vc(u) - HC], 0, U1)], W.stock);
// Straight switch blade (closed against the left stock rail), planed at the toe
addRail('blade-straight', P(u => [u, -HC + 0.046 * (1 - u / HEEL)], 0.15, HEEL, 0.25), W.blades, { headScaleFn: u => 0.25 + 0.75 * clamp(u / 4.5) });
// Curved switch blade (open), toe gap ~110 mm
addRail('blade-curved', P(u => [u, vc(u) + HC - 0.115 * Math.pow(1 - u / HEEL, 1.5)], 0.15, HEEL, 0.25), W.blades, { headScaleFn: u => 0.25 + 0.75 * clamp(u / 4.5) });
// Closure rails to the crossing throat
addRail('closure-straight', [[HEEL, -HC], [THROAT, -HC]], W.closure);
addRail('closure-curved', P(u => [u, vc(u) + HC], HEEL, THROAT), W.closure);
// Wing rails: each closure continues past the throat, knuckles, and runs alongside the opposite nose rail
addRail('wing-a', [[THROAT, -HC], ...P(u => [u, vc(u) + HC - FW], uX - 0.2, uX + 3.2), [uX + 4.4, vc(uX + 4.4) + HC - FW - 0.22]], W.crossing);
addRail('wing-b', [...P(u => [u, vc(u) + HC], THROAT, THROAT + 0.2), [uX - 0.2, -HC + FW], [uX + 3.2, -HC + FW], [uX + 4.4, -HC + FW + 0.22]], W.crossing);
// Crossing nose (V) and the plain rails beyond
addRail('nose-straight', [[uX, -HC], [U1, -HC]], W.crossing, { headScaleFn: u => 0.35 + 0.65 * clamp((u - uX) / 2.2) });
addRail('nose-diverging', P(u => [u, vc(u) + HC], uX, U1), W.crossing, { headScaleFn: u => 0.35 + 0.65 * clamp((u - uX) / 2.2) });
// Check rails opposite the crossing nose
const CK0 = uX - 3.2, CK1 = uX + 2.2;
addRail('check-main', [[CK0 - 0.8, HC - FW - 0.14], [CK0, HC - FW], [CK1, HC - FW], [CK1 + 0.8, HC - FW - 0.14]], W.check);
addRail('check-div', [[CK0 - 0.8, vc(CK0 - 0.8) - HC + FW + 0.14], ...P(u => [u, vc(u) - HC + FW], CK0, CK1, 0.4), [CK1 + 0.8, vc(CK1 + 0.8) - HC + FW + 0.14]], W.check);

// ---------- bearers (instanced) ----------
const BEARERS = []; // {x, z0, z1, rot, cx, cz, len}
for (let u = U0 + 0.3; u < -2.6; u += 0.65) BEARERS.push({ cx: u, cz: 0, len: 2.6, rot: 0 });
const SPLIT = uX + 12.2;
for (let u = -2.6 + 0.65 * 0.5; u < SPLIT; u += 0.65) { // S&C bearers, square to the main line, lengthening
  const z0 = vc(u) - HC - 0.62, z1 = HC + 0.62; BEARERS.push({ cx: u, cz: (z0 + z1) / 2, len: Math.max(2.6, z1 - z0), rot: 0 });
}
for (let u = SPLIT + 0.33; u < U1; u += 0.65) BEARERS.push({ cx: u, cz: 0, len: 2.6, rot: 0 });
{ // diverging sleepers, square to the diverging track
  let s = 0, u = SPLIT + 0.1;
  while (u < U1 - 1) { const z = vc(u); BEARERS.push({ cx: u, cz: z, len: 2.6, rot: Math.atan(-dvc(u)) }); u += 0.65 * Math.cos(Math.atan(dvc(u))); s++; }
}
BEARERS.sort((a, b) => a.cx - b.cx);
BEARERS.forEach((b, i) => { b.birth = 0.185 + 0.19 * (i / BEARERS.length) + (b.rot ? 0.004 : 0); });
const bearerGeo = new THREE.BoxGeometry(1, 0.2, 1, 1, 1, 1);
bearerGeo.translate(0, 0.1, 0);
{ // gentle chamfer look: darken lower faces via vertex colour-free trick (uv scale to tile texture)
  const uv = bearerGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 0.4);
}
const bearerMesh = new THREE.InstancedMesh(bearerGeo, matConcrete, BEARERS.length);
bearerMesh.castShadow = true; bearerMesh.receiveShadow = true;
scene.add(bearerMesh);

// ---------- baseplates, clips, stretcher bars ----------
const railLinesAt = u => { // rail centre z positions crossing a bearer at u (main-square bearers)
  const z = [HC];
  if (u < 0) z.push(-HC);
  else {
    z.push(vc(u) - HC); // outer diverging / left stock
    if (u < HEEL) { z.push(-HC + 0.046 * (1 - u / HEEL)); z.push(vc(u) + HC - 0.115 * Math.pow(1 - u / HEEL, 1.5)); }
    else if (u < THROAT) { z.push(-HC); z.push(vc(u) + HC); }
    else if (u < uX) { z.push(-HC); z.push(vc(u) + HC); }
    else { z.push(-HC); z.push(vc(u) + HC); }
  }
  return z;
};
const PLATES = [];
for (const b of BEARERS) {
  if (b.rot) { for (const s of [-HC, HC]) PLATES.push({ x: b.cx + Math.sin(b.rot) * s, z: b.cz + Math.cos(b.rot) * s, rot: b.rot, birth: 0 }); continue; }
  const zs = (b.cx > SPLIT) ? [HC, -HC] : railLinesAt(b.cx);
  for (const z of zs) PLATES.push({ x: b.cx, z, rot: 0 });
}
PLATES.forEach(p => { p.birth = 0.565 + 0.05 * clamp((p.x - U0) / (U1 - U0)); });
const plateGeo = new THREE.BoxGeometry(0.2, 0.035, 0.36); plateGeo.translate(0, 0.2175, 0);
const plateMesh = new THREE.InstancedMesh(plateGeo, matPlate, PLATES.length);
plateMesh.castShadow = false; plateMesh.receiveShadow = true; scene.add(plateMesh);
const clipGeo = new THREE.TorusGeometry(0.028, 0.007, 5, 10, Math.PI * 1.2); clipGeo.rotateY(Math.PI / 2); clipGeo.translate(0, 0.243, 0);
const clipMesh = new THREE.InstancedMesh(clipGeo, matClip, PLATES.length * 2);
scene.add(clipMesh);
const BARS = [0.75, 2.6].map(u => ({ u, z0: -HC + 0.046 * (1 - u / HEEL), z1: vc(u) + HC - 0.115 * Math.pow(1 - u / HEEL, 1.5) }));
const barMeshes = BARS.map(b => { const g = new THREE.BoxGeometry(0.06, 0.05, b.z1 - b.z0); g.translate(b.u, 0.27, (b.z0 + b.z1) / 2); const m = new THREE.Mesh(g, matBar); m.castShadow = true; scene.add(m); return m; });

// ---------- ballast bed & ground ----------
const gw = isMobile ? 220 : 360, gh = isMobile ? 70 : 110;
const ballastGeo = new THREE.PlaneGeometry(U1 - U0 + 30, 22, gw, gh); ballastGeo.rotateX(-Math.PI / 2);
{
  const p = ballastGeo.attributes.position; const r = rand(5); const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + (U0 + U1) / 2, z = p.getZ(i) - 2.5;
    const d = Math.min(Math.abs(z), Math.abs(z - vc(x)), x < uX + 14 ? (z > vc(x) && z < 0 ? 0 : 99) : 99);
    const top = 0.17, shoulder = 2.1, toe = 4.2;
    let y = d < shoulder ? top : d < toe ? lerp(top, -0.42, (d - shoulder) / (toe - shoulder)) : -0.42 - (d - toe) * 0.02;
    y += (r() - 0.5) * 0.04;
    p.setXYZ(i, x, y, z);
    const c = d < shoulder + 0.6 ? 1 : lerp(1, 0.22, clamp((d - shoulder - 0.6) / 1.6)); col[i * 3] = c * 0.95; col[i * 3 + 1] = c; col[i * 3 + 2] = c * 0.97;
  }
  ballastGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  ballastGeo.computeVertexNormals();
}
const matBallast = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xa7a3a0, map: ballastTex, roughness: 0.95, metalness: 0, transparent: true, opacity: 0 });
const ballast = new THREE.Mesh(ballastGeo, matBallast); ballast.receiveShadow = true; scene.add(ballast);

// ---------- CAD layer (lines with per-vertex birth) ----------
const cadPos = [], cadBirth = [], cadKind = [];
function cadSeg(a, b, birth, kind = 0) { cadPos.push(a[0], a[1], a[2], b[0], b[1], b[2]); cadBirth.push(birth, birth); cadKind.push(kind, kind); }
function cadPoly(pts, b0, b1, kind = 0, y = 0.02) { for (let i = 0; i < pts.length - 1; i++) { const t = i / (pts.length - 1); cadSeg([pts[i][0], y, pts[i][1]], [pts[i + 1][0], y, pts[i + 1][1]], lerp(b0, b1, t), kind); } }
// construction grid (kind 2, faint)
for (let x = -20; x <= 70; x += 5) cadSeg([x, -0.01, -16], [x, -0.01, 10], 0.0, 2);
for (let z = -16; z <= 10; z += 5) cadSeg([-20, -0.01, z], [70, -0.01, z], 0.0, 2);
// centrelines, dashed (kind 1)
for (let u = U0; u < U1; u += 1.6) cadSeg([u, 0.03, 0], [u + 1.0, 0.03, 0], 0.015 + 0.08 * (u - U0) / (U1 - U0), 1);
for (let u = 0; u < U1; u += 1.6) cadSeg([u, 0.03, vc(u)], [u + 1.0, 0.03, vc(u + 1.0)], 0.04 + 0.08 * u / U1, 1);
// setting-out points: crosses + circles every 10 m on both centrelines
const SO = [];
for (let u = -10; u <= 60; u += 10) { SO.push([u, 0]); if (u > 0) SO.push([u, vc(u)]); }
SO.forEach(([x, z], i) => { const b = 0.07 + i * 0.005; cadSeg([x - 0.5, 0.03, z], [x + 0.5, 0.03, z], b, 0); cadSeg([x, 0.03, z - 0.5], [x, 0.03, z + 0.5], b, 0);
  const c = []; for (let k = 0; k <= 16; k++) c.push([x + Math.cos(k / 16 * 6.283) * 0.32, z + Math.sin(k / 16 * 6.283) * 0.32]); cadPoly(c, b, b, 0, 0.03); });
// chainage ticks along main centreline
for (let u = 0; u <= 60; u += 5) cadSeg([u, 0.03, 2.2], [u, 0.03, u % 10 === 0 ? 2.9 : 2.55], 0.1 + u * 0.0006, 0);
cadSeg([0, 0.03, 2.2], [60, 0.03, 2.2], 0.1, 0);
// gauge dimension at x = -9
cadSeg([-9, 0.03, -HC + 0.036], [-9, 0.03, HC - 0.036], 0.13, 0);
cadSeg([-9.4, 0.03, -HC + 0.036], [-8.6, 0.03, -HC + 0.036], 0.13, 0); cadSeg([-9.4, 0.03, HC - 0.036], [-8.6, 0.03, HC - 0.036], 0.13, 0);
// bearer outlines appear just before each bearer is placed
for (const b of BEARERS) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), hx = 0.13, hz = b.len / 2;
  const corner = (dx, dz) => [b.cx + dx * c + dz * s, 0.21, b.cz - dx * s + dz * c];
  const q = [corner(-hx, -hz), corner(hx, -hz), corner(hx, hz), corner(-hx, hz)];
  for (let k = 0; k < 4; k++) cadSeg(q[k], q[(k + 1) % 4], b.birth - 0.012, 0);
}
// rail head outlines in plan
for (const r of RAILS) {
  const pos = r.mesh.geometry.attributes.position; // walk the head-top edge vertices
  const N = (pos.count / PROF.length) / 2; const e = 7, base = e * N * 2; // segment 7 = head top
  const L = [], Rr = [];
  for (let i = 0; i < N; i++) { L.push([pos.getX(base + i * 2), RAIL_Y + 0.165, pos.getZ(base + i * 2)]); Rr.push([pos.getX(base + i * 2 + 1), RAIL_Y + 0.165, pos.getZ(base + i * 2 + 1)]); }
  for (const line of [L, Rr]) for (let i = 0; i < line.length - 1; i++) {
    const t = (line[i][0] - r.x0) / Math.max(0.01, r.x1 - r.x0);
    cadSeg(line[i], line[i + 1], lerp(r.win[0] - 0.02, r.win[1] - 0.02, clamp(t)), 0);
  }
}
const cadGeo = new THREE.BufferGeometry();
cadGeo.setAttribute('position', new THREE.Float32BufferAttribute(cadPos, 3));
cadGeo.setAttribute('birth', new THREE.Float32BufferAttribute(cadBirth, 1));
cadGeo.setAttribute('kind', new THREE.Float32BufferAttribute(cadKind, 1));
const cadMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uP: { value: 0 }, uFade: { value: 1 }, uGrid: { value: 1 }, uColor: { value: CYAN } },
  vertexShader: `attribute float birth; attribute float kind; varying float vB; varying float vK; void main(){ vB=birth; vK=kind; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform float uP; uniform float uFade; uniform float uGrid; uniform vec3 uColor; varying float vB; varying float vK;
    void main(){ if(vB>uP) discard; float fresh = vK > 1.5 ? 0.0 : 1.0 - smoothstep(0.0, 0.03, uP - vB);
      float a = vK > 1.5 ? 0.0 : (vK > 0.5 ? 0.55 : 0.85); a *= uFade; if (vK > 1.5) a = 0.055 * uGrid;
      gl_FragColor = vec4(uColor * (1.0 + fresh * 1.6), a + fresh * 0.4 * uFade); }`
});
const cad = new THREE.LineSegments(cadGeo, cadMat); cad.renderOrder = 5; cad.frustumCulled = false; scene.add(cad);

// ---------- labels (HTML, projected) ----------
const LABELS = [
  { t: 'Main line centreline', p: [-11, 0, 0], w: [[0.03, 0.17]] },
  { t: 'Diverging centreline', p: [46, 0, vc(46)], w: [[0.06, 0.17]] },
  { t: 'Setting-out points', p: [20, 0, 0], w: [[0.08, 0.17]] },
  { t: 'Gauge 1435 mm', p: [-9, 0, -HC], w: [[0.13, 0.3]] },
  { t: 'Bearers square to the main line', p: [17, 0.2, vc(17) - 0.9], w: [[0.24, 0.37]] },
  { t: 'Switch toe', p: [0.2, 0.4, -HC], w: [[0.48, 0.6], [0.69, 0.79]] },
  { t: 'Switch blades', p: [5.5, 0.4, -HC + 0.03], w: [[0.5, 0.6]] },
  { t: 'Crossing nose', p: [uX + 0.3, 0.4, -HC], w: [[0.545, 0.61], [0.74, 0.83]] },
  { t: 'Check rail', p: [uX - 1, 0.4, HC - FW], w: [[0.575, 0.61], [0.75, 0.83]] },
];
for (const L of LABELS) { const d = document.createElement('div'); d.className = 'xp-label'; d.textContent = L.t; d.setAttribute('aria-hidden', 'true'); labelsEl.appendChild(d); L.el = d; L.v = new THREE.Vector3(...L.p); }

// ---------- camera path ----------
// key: [progress, targetX, targetZ, distance, elevation(deg), azimuth(deg), fov]
const KEYS = [
  [0.00, 17, -3, 96, 84, -38, 30],
  [0.17, 16, -3, 88, 82, -36, 30],
  [0.38, 15, -3, 80, 76, -32, 31],
  [0.56, 13, -2.5, 66, 68, -28, 32],
  [0.63, 10, -2, 42, 46, -22, 34],
  [0.70, 4, -1, 13, 22, -14, 38],
  [0.79, 16, -1.5, 8.5, 15, 18, 40],
  [0.86, 27, -2.5, 9.5, 18, 40, 40],
  [0.93, 28, -3, 40, 44, 52, 34],
  [1.00, 28, -3, 58, 58, 60, 32],
];
function cr(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
function camAt(p) {
  let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
  const k0 = KEYS[Math.max(0, i - 1)], k1 = KEYS[i], k2 = KEYS[i + 1], k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
  const t = ease(clamp((p - k1[0]) / (k2[0] - k1[0])));
  const o = []; for (let j = 1; j < 7; j++) o.push(cr(k0[j], k1[j], k2[j], k3[j], t));
  return o;
}
const tmpV = new THREE.Vector3();
let viewW = 1, viewH = 1, aspect = 1;
function placeCamera(p) {
  let [tx, tz, d, el, az, fov] = camAt(p);
  if (aspect < 1) { d *= lerp(1, 1.55, clamp((1 - aspect) / 0.5)); fov += 6; }
  const e = THREE.MathUtils.degToRad(el), a = THREE.MathUtils.degToRad(az);
  camera.fov = fov;
  camera.position.set(tx - Math.cos(e) * Math.cos(a) * d, Math.sin(e) * d, tz + Math.cos(e) * Math.sin(a) * d);
  camera.lookAt(tx, 0, tz);
  // keep the model clear of the text column (desktop: shift right; mobile: shift down)
  const textOn = 1 - span(p, 0.62, 0.7) + span(p, 0.84, 0.9);
  if (aspect >= 1) camera.setViewOffset(viewW, viewH, -viewW * 0.17 * clamp(textOn), 0, viewW, viewH);
  else camera.setViewOffset(viewW, viewH, 0, -viewH * 0.16 * clamp(textOn), viewW, viewH);
  camera.updateProjectionMatrix();
}

// ---------- state per progress ----------
const dummy = new THREE.Object3D();
const cadTintColor = new THREE.Color(0x0b2f3c), cadEmis = new THREE.Color(0x1aa6c9), black = new THREE.Color(0);
function apply(p) {
  // bearers drop into place
  for (let i = 0; i < BEARERS.length; i++) {
    const b = BEARERS[i]; const k = easeOut(clamp((p - b.birth) / 0.03));
    dummy.position.set(b.cx, (1 - k) * 1.6, b.cz); dummy.rotation.set(0, b.rot, 0);
    dummy.scale.set(0.26, k < 0.001 ? 0.0001 : 1, b.len * (0.85 + 0.15 * k));
    if (k <= 0) dummy.scale.set(0.0001, 0.0001, 0.0001);
    dummy.updateMatrix(); bearerMesh.setMatrixAt(i, dummy.matrix);
  }
  bearerMesh.instanceMatrix.needsUpdate = true;
  // rails extend along the track
  for (const r of RAILS) {
    const k = ease(span(p, r.win[0], r.win[1]));
    r.uni.reveal.value = k <= 0 ? -1e4 : k >= 1 ? 1e4 : lerp(r.x0, r.x1, k);
    r.mesh.visible = k > 0;
  }
  // plates and clips
  for (let i = 0; i < PLATES.length; i++) {
    const q = PLATES[i], k = clamp((p - q.birth) / 0.02);
    dummy.position.set(q.x, (1 - k) * 0.5, q.z); dummy.rotation.set(0, q.rot, 0); const s = k > 0 ? 1 : 0.0001; dummy.scale.set(s, s, s);
    dummy.updateMatrix(); plateMesh.setMatrixAt(i, dummy.matrix);
    for (let c = 0; c < 2; c++) {
      const side = c ? 1 : -1; const kc = clamp((p - q.birth - 0.012) / 0.02); const sc = kc > 0 ? 1 : 0.0001;
      dummy.position.set(q.x + Math.sin(q.rot) * side * 0.105, (1 - kc) * 0.4, q.z + Math.cos(q.rot) * side * 0.105);
      dummy.rotation.set(0, q.rot + (side > 0 ? Math.PI : 0), 0); dummy.scale.set(sc, sc, sc); dummy.updateMatrix();
      clipMesh.setMatrixAt(i * 2 + c, dummy.matrix);
    }
  }
  plateMesh.instanceMatrix.needsUpdate = true; clipMesh.instanceMatrix.needsUpdate = true;
  barMeshes.forEach(m => m.visible = p > 0.525);
  // CAD → physical
  const morph = ease(span(p, 0.58, 0.72));
  for (const m of MATS) {
    const b = m.userData.base; if (!b) continue;
    m.color.copy(cadTintColor).lerp(b.color, morph);
    m.emissive.copy(cadEmis).multiplyScalar(0.55 * (1 - morph) * m.userData.cadTint).lerp(black, morph);
    m.metalness = lerp(0.1, b.metalness, morph); m.roughness = lerp(0.6, b.roughness, morph);
  }
  const ground = ease(span(p, 0.6, 0.74));
  matBallast.opacity = ground; ballast.visible = ground > 0.001; matBallast.transparent = ground < 0.999; matBallast.depthWrite = ground > 0.5;
  cadMat.uniforms.uP.value = Math.max(p, intro);
  cadMat.uniforms.uFade.value = 1 - 0.85 * ease(span(p, 0.6, 0.72)) + 0.6 * span(p, 0.88, 1);
  cadMat.uniforms.uGrid.value = 1 - 0.7 * ease(span(p, 0.6, 0.72)) + 0.7 * span(p, 0.88, 1);
  // lighting comes up as the model becomes physical
  const lit = ease(span(p, 0.52, 0.72));
  key.intensity = 3.4 * lit; hemi.intensity = 0.25 + 0.3 * lit; rim.intensity = 1.6 * lit; scene.environmentIntensity = 0.35 * lit;
  // services stage: model recedes
  const away = ease(span(p, 0.86, 0.98));
  scene.fog.density = 0.0042 + 0.012 * away;
  renderer.toneMappingExposure = 1.05 - 0.35 * away;
  placeCamera(p);
}

// ---------- UI per progress ----------
const STAGE_NAMES = ['Design', 'Bearers', 'Rails', 'Model', 'Services'];
function ui(p) {
  barEl.style.transform = `scaleX(${p.toFixed(4)})`;
  let active = 0;
  stages.forEach((s, i) => {
    const a = +s.dataset.from, b = +s.dataset.to;
    const o = i === 0 ? 1 - span(p, b - 0.035, b) : (i === stages.length - 1 ? span(p, a, a + 0.035) : Math.min(span(p, a, a + 0.035), 1 - span(p, b - 0.035, b)));
    s.style.opacity = o.toFixed(3); s.style.transform = `translateY(${((1 - o) * 18).toFixed(1)}px)`;
    s.style.visibility = o > 0.01 ? 'visible' : 'hidden'; s.inert = o < 0.5;
    if (p >= a - 0.02) active = i;
  });
  { let vis = 0; stages.forEach(st => vis = Math.max(vis, +st.style.opacity || 0)); stageEl.style.setProperty('--veil', (0.25 + 0.75 * vis).toFixed(3)); }
  stageNumEl.textContent = `${String(active + 1).padStart(2, '0')} / 05 · ${STAGE_NAMES[active]}`;
  dots.forEach((d, i) => d.setAttribute('aria-current', i === active ? 'step' : 'false'));
  // labels
  for (const L of LABELS) {
    let o = 0; for (const [a, b] of L.w) o = Math.max(o, Math.min(span(p, a, a + 0.015), 1 - span(p, b - 0.015, b)));
    if (o <= 0.01) { L.el.style.opacity = 0; continue; }
    tmpV.copy(L.v).project(camera);
    if (tmpV.z > 1) { L.el.style.opacity = 0; continue; }
    const x = (tmpV.x * 0.5 + 0.5) * viewW, y = (-tmpV.y * 0.5 + 0.5) * viewH;
    if (!L.w0) L.w0 = L.el.offsetWidth + 24;
    const flip = x > viewW - L.w0; L.el.classList.toggle('flip', flip);
    L.el.style.opacity = o.toFixed(2); L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

// ---------- sizing, scroll, loop ----------
function resize() {
  const r = stageEl.getBoundingClientRect(); viewW = Math.max(1, r.width); viewH = Math.max(1, r.height); aspect = viewW / viewH;
  renderer.setSize(viewW, viewH, false); camera.aspect = aspect;
  dirty = true;
}
let target = 0, cur = 0, dirty = true, visible = true, raf = 0, last = performance.now(), intro = 0, introT0 = 0;
function scrollProgress() {
  const r = root.getBoundingClientRect(); const total = r.height - innerHeight;
  return total > 0 ? clamp(-r.top / total) : 0;
}
function onScroll() { target = scrollProgress(); kick(); }
function kick() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }
let slowFrames = 0, frameCount = 0, degraded = false;
function frame(now) {
  raf = 0;
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const diff = target - cur;
  cur = Math.abs(diff) < 0.0004 ? target : cur + diff * (1 - Math.exp(-dt * 7));
  if (intro < 0.16) { intro = Math.min(0.16, 0.16 * easeOut(Math.min(1, (now - introT0) / 4200))); dirty = true; }
  apply(cur); ui(cur);
  renderer.render(scene, camera);
  // adaptive quality: if the device struggles, drop resolution and shadows once
  frameCount++; if (dt > 0.045) slowFrames++;
  if (!degraded && frameCount > 40 && slowFrames > 18) {
    degraded = true; renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; key.castShadow = false;
    MATS.forEach(m => m.needsUpdate = true); resize();
  }
  if (cur !== target || dirty) { dirty = false; raf = requestAnimationFrame(frame); }
}
new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }, { rootMargin: '200px' }).observe(root);
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { resize(); onScroll(); });
dots.forEach(d => d.addEventListener('click', () => {
  const p = +d.dataset.p; const r = root.getBoundingClientRect(); const total = r.height - innerHeight;
  scrollTo({ top: scrollY + r.top + total * p, behavior: 'smooth' });
}));
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fallback('context-lost'); });

resize();
introT0 = performance.now();
target = cur = scrollProgress();
apply(cur); ui(cur); renderer.render(scene, camera);
root.classList.add('xp-ready');
kick();
// test hook (used for screenshots)
window.__xp = { set(p) { intro = 0.16; target = cur = p; apply(p); ui(p); renderer.render(scene, camera); }, info: () => renderer.info };
