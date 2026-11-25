import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { FleetId, SystemId } from '@/content/fleet';
import { Fuselage, fuselageGeometry } from '../jet/fuselage';
import { loft, naca, type Station } from '../jet/loft';
import { CUT_PLANES } from '../jet/materials';
import type { JetSpec } from '../jet/spec';
import type { InspectEntry } from '../inspector';
import { FLEET_SPECS, type FleetSpec } from './specs';

/**
 * Gerador ORIGINAL de aeronaves paramétricas para o hangar SimFly.
 * - Envelope (comprimento, envergadura, altura) calibrado pelo tipo: o volume final respeita esses três números.
 * - Cada sistema é um grupo nomeado com malhas reais (nada de esfera genérica): fuselagem, asas, propulsão,
 *   empenagem, trem, cabine, portas. A estrutura interna (cavernas, longarinas, núcleo do motor) é ILUSTRATIVA
 *   e só aparece no raio-X.
 * - Eixos: nariz +x, topo +y, asa direita +z. Origem no eixo da fuselagem, no meio do comprimento; solo em y = −axisH.
 */
export const SYSTEMS: SystemId[] = ['fuselagem', 'asas', 'propulsao', 'empenagem', 'trem', 'cabine', 'portas'];

export interface FleetCraftBuild {
  id: FleetId;
  spec: FleetSpec;
  group: THREE.Group;
  systems: Record<SystemId, THREE.Group>;
  anchors: Record<SystemId, THREE.Vector3>;
  /** âncora presa ao objeto que se desloca na desmontagem (posição local nesse objeto) */
  anchorRefs: Record<SystemId, { obj: THREE.Object3D; local: THREE.Vector3 }>;
  bounds: Record<SystemId, { center: THREE.Vector3; radius: number }>;
  entries: InspectEntry[];
  seats: { pos: THREE.Vector3; facing: 1 | -1 }[];
  floorY: number;
  cutY: number;
  size: number;
  /** altura do eixo acima do solo */
  axisH: number;
  setXray: (k: number) => void;
  isolate: (s: SystemId | null) => void;
  dispose: () => void;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const D2R = THREE.MathUtils.degToRad;

/** Nariz de motor a pistão: frente rombuda (capô) em vez de cone. */
class PropFuselage extends Fuselage {
  profile(d: number) {
    const { R, Ln } = this.s;
    if (d >= Ln) return super.profile(d);
    const k = Math.max(0, d / Ln);
    const e = Math.pow(1 - (1 - k) * (1 - k), 0.7);
    const r0 = 0.46;
    const top = R * (r0 + (1 - r0) * e) - 0.05 * R * (1 - e);
    const bot = -R * (r0 + 0.08 + (1 - r0 - 0.08) * e) - 0.05 * R * (1 - e);
    return { top, bot, w: R * (r0 + (1 - r0) * e) };
  }
}

function flipWinding(g: THREE.BufferGeometry) {
  const idx = g.getIndex();
  if (!idx) return g;
  const a = idx.array as Uint32Array | Uint16Array;
  for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; }
  idx.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Contorno de superfície de controle: trecho do bordo de fuga do perfil, levemente mais espesso (sem z-fighting). */
function trailingFoil(foil: [number, number][], from: number, inflate = 1.06): [number, number][] {
  const n = foil.length;
  const half = Math.floor(n / 2);
  const upper = foil.slice(0, half + 1).filter(([x]) => x >= from);
  const lower = foil.slice(half).filter(([x]) => x >= from);
  return [...upper, ...lower].map(([x, y]) => [x, y * inflate] as [number, number]);
}

// ---------- texturas compartilhadas ----------
let shadowTex: THREE.CanvasTexture | null = null;
function contactShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.78)'); grd.addColorStop(0.45, 'rgba(0,0,0,0.42)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

function liveryTexture(s: FleetSpec, f: Fuselage, L: number, W: number) {
  const H = W / 4;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const X = (d: number) => (d / L) * W;
  const Y = (th: number) => (1 - (((th % TAU) + TAU) % TAU) / TAU) * H;
  const lv = s.livery;
  g.fillStyle = lv.base; g.fillRect(0, 0, W, H);
  // ventre
  const bellyBand = (half: number, color: string, alpha = 1) => {
    const y0 = Y(1.5 * Math.PI + half), y1 = Y(1.5 * Math.PI - half);
    const grd = g.createLinearGradient(0, y0, 0, y1);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.12, color); grd.addColorStop(0.88, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alpha; g.fillStyle = grd; g.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0)); g.globalAlpha = 1;
  };
  // faixas laterais que sobem na cauda
  const sweepLine = (th0: number, width: number, color: string, rise = 0.55, start = 0.6) => {
    for (const side of [1, -1]) {
      g.beginPath();
      for (let i = 0; i <= 300; i++) {
        const d = start + (L - start - 0.5) * (i / 300);
        const k = Math.max(0, (d - (L - s.Lt)) / s.Lt);
        const th = th0 + rise * k * k;
        const a = side === 1 ? th : Math.PI - th;
        if (i === 0) g.moveTo(X(d), Y(a)); else g.lineTo(X(d), Y(a));
      }
      g.lineWidth = width * (W / 2048); g.strokeStyle = color; g.stroke();
    }
  };
  if (lv.scheme === 'dark-belly') {
    // ventre escuro que sobe em direção à cauda (pintura clara em cima, escura embaixo)
    for (const side of [1, -1]) {
      g.beginPath();
      const pts: [number, number][] = [];
      for (let i = 0; i <= 200; i++) {
        const d = 0.4 + (L - 0.8) * (i / 200);
        const k = Math.max(0, (d - (L - s.Lt - 2)) / (s.Lt + 2));
        pts.push([X(d), Y(side === 1 ? -0.42 + 0.7 * k * k : Math.PI + 0.42 - 0.7 * k * k)]);
      }
      g.moveTo(pts[0][0], Y(1.5 * Math.PI));
      pts.forEach(([x, y]) => g.lineTo(x, y));
      g.lineTo(pts[pts.length - 1][0], Y(1.5 * Math.PI));
      g.closePath(); g.fillStyle = lv.belly; g.fill();
    }
    sweepLine(-0.36, 7, lv.stripe, 0.7, 0.8);
  } else if (lv.scheme === 'pinstripe') {
    bellyBand(0.7, lv.belly, 0.8);
    sweepLine(-0.3, 5, lv.stripe); sweepLine(-0.4, 3, lv.accent);
  } else if (lv.scheme === 'dark-tail') {
    bellyBand(0.72, lv.belly, 0.85);
    sweepLine(-0.34, 4, lv.stripe, 0.9);
    // cone de cauda escuro
    const d0 = L - s.Lt * 0.7;
    const grd = g.createLinearGradient(X(d0), 0, X(d0 + 1.2), 0);
    grd.addColorStop(0, 'rgba(20,27,36,0)'); grd.addColorStop(1, lv.accent);
    g.fillStyle = grd; g.fillRect(X(d0), 0, W - X(d0), H);
  } else if (lv.scheme === 'piper') {
    bellyBand(0.8, lv.belly, 0.7);
    sweepLine(-0.22, 9, lv.stripe, 0.4, 1.2); sweepLine(-0.34, 3, lv.accent, 0.4, 1.2);
  } else {
    sweepLine(-0.26, 8, lv.stripe, 0.75, 1.0); sweepLine(-0.38, 3, lv.accent, 0.75, 1.0);
  }
  // janelas da cabine (pintadas; vidro escuro com reflexo)
  const wn = s.windows;
  for (let i = 0; i < wn.n; i++) {
    const d = wn.d0 + i * wn.pitch;
    for (const side of [1, -1]) {
      const th = side === 1 ? 0.2 : Math.PI - 0.2;
      const w = (wn.w / L) * W, h = ((wn.h / s.R) / TAU) * H;
      const x = X(d) - w / 2, y = Y(th) - h / 2;
      const grd = g.createLinearGradient(0, y, 0, y + h);
      grd.addColorStop(0, '#2c3a48'); grd.addColorStop(0.5, '#0d141c'); grd.addColorStop(1, '#1a2633');
      g.fillStyle = grd;
      g.beginPath(); g.roundRect(x, y, w, h, Math.min(w, h) * 0.45); g.fill();
      g.strokeStyle = 'rgba(120,130,140,0.55)'; g.lineWidth = Math.max(1, W / 2048); g.stroke();
    }
  }
  // contorno da porta principal
  {
    const dr = s.door;
    const yTop = s.cabin.floor + dr.h, yBot = s.cabin.floor - 0.05;
    const a0 = Math.PI - Math.asin(Math.min(0.98, yTop / s.R)), a1 = Math.PI - Math.asin(Math.max(-0.98, yBot / s.R));
    const x = X(dr.d - dr.w / 2), w = (dr.w / L) * W;
    g.strokeStyle = 'rgba(40,48,58,0.75)'; g.lineWidth = Math.max(1.5, W / 1400);
    g.beginPath(); g.roundRect(x, Y(a0), w, Y(a1) - Y(a0), w * 0.18); g.stroke();
  }
  void f;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ---------- material de raio-X (fresnel azul, aditivo) ----------
function xrayMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#6fb2ff') }, uAlpha: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(uColor * (0.18 + 1.5 * f), (0.035 + 0.5 * f) * uAlpha); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

export function buildFleetCraft(id: FleetId, opts: { textureSize: number; detail: number }): FleetCraftBuild {
  const s = FLEET_SPECS[id];
  const prop = s.nose === 'prop';
  const spinnerLen = prop ? 0.38 : 0;
  const L = s.envelope.length - spinnerLen;
  const js = { L, R: s.R, Ln: s.Ln, Lt: s.Lt } as JetSpec;
  const f = prop ? new PropFuselage(js) : new Fuselage(js);
  const fx = (d: number) => f.x(d);
  const detail = opts.detail;
  const group = new THREE.Group(); group.name = `fleet-${id}`;
  const disposables: { dispose: () => void }[] = [];
  const tr = <T extends { dispose: () => void }>(o: T) => { disposables.push(o); return o; };
  const systems = {} as Record<SystemId, THREE.Group>;
  for (const sid of SYSTEMS) { const g = new THREE.Group(); g.name = sid; systems[sid] = g; group.add(g); }
  const skins: THREE.Mesh[] = [];
  const internals: THREE.Object3D[] = [];
  const mesh = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, name: string, role: 'skin' | 'internal' | 'solid' = 'solid') => {
    tr(geo);
    const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.xray = role;
    parent.add(m);
    if (role === 'skin') skins.push(m);
    if (role === 'internal') { internals.push(m); m.visible = false; }
    return m;
  };

  // ---------- materiais PBR ----------
  const livery = tr(liveryTexture(s, f, L, opts.textureSize));
  const paint = tr(new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: livery, roughness: 0.24, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide }));
  paint.clippingPlanes = CUT_PLANES;
  const wingPaint = tr(new THREE.MeshPhysicalMaterial({ color: s.livery.scheme === 'dark-belly' ? '#e9eaeb' : '#eceded', roughness: 0.32, metalness: 0.12, clearcoat: 0.85, clearcoatRoughness: 0.1 }));
  const surfacePaint = tr(new THREE.MeshPhysicalMaterial({ color: '#d4d8dc', roughness: 0.36, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.14 }));
  const finColor = s.livery.scheme === 'dark-tail' || s.livery.scheme === 'dark-belly' ? s.livery.accent : s.livery.base;
  const finPaint = tr(new THREE.MeshPhysicalMaterial({ color: finColor, roughness: 0.26, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.07 }));
  const nacellePaint = tr(new THREE.MeshPhysicalMaterial({ color: s.livery.scheme === 'dark-tail' ? '#f2f2f0' : s.livery.base, roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 }));
  const polished = tr(new THREE.MeshStandardMaterial({ color: '#d8dbde', roughness: 0.14, metalness: 1 }));
  const darkMetal = tr(new THREE.MeshStandardMaterial({ color: '#2a2f35', roughness: 0.38, metalness: 0.85 }));
  const ductMat = tr(new THREE.MeshStandardMaterial({ color: '#14171b', roughness: 0.6, metalness: 0.4, side: THREE.BackSide }));
  const glass = tr(new THREE.MeshPhysicalMaterial({ color: '#0c141b', roughness: 0.04, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.9 }));
  const rubber = tr(new THREE.MeshStandardMaterial({ color: '#141619', roughness: 0.88, metalness: 0 }));
  const strutMat = tr(new THREE.MeshStandardMaterial({ color: '#b3b8bd', roughness: 0.26, metalness: 0.95 }));
  const internalMat = tr(new THREE.MeshStandardMaterial({ color: '#b9c7d6', roughness: 0.45, metalness: 0.7, emissive: new THREE.Color('#2a64b8'), emissiveIntensity: 0.35 }));
  const leather = tr(new THREE.MeshStandardMaterial({ color: '#e7dccb', roughness: 0.62, metalness: 0 }));
  leather.clippingPlanes = CUT_PLANES;
  const carpet = tr(new THREE.MeshStandardMaterial({ color: '#5b5550', roughness: 0.95, metalness: 0 }));
  carpet.clippingPlanes = CUT_PLANES;
  const lining = tr(new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: 0.7, metalness: 0, side: THREE.BackSide }));
  lining.clippingPlanes = CUT_PLANES;
  const xray = tr(xrayMaterial());

  // ---------- FUSELAGEM ----------
  mesh(systems.fuselagem, fuselageGeometry(f, { nu: Math.round(170 * detail), nv: Math.round(64 * detail) }), paint, 'skin', 'skin');
  // para-brisa (painéis no nariz)
  {
    const panes: [number, number, number, number][] = prop
      ? [[s.Ln * 0.6, s.Ln * 1.02, 0.1, 0.62], [s.Ln * 0.74, s.Ln * 1.1, 0.68, 1.02]]
      : [[s.Ln * 0.58, s.Ln * 0.86, 0.06, 0.6], [s.Ln * 0.66, s.Ln * 0.92, 0.68, 1.04]];
    const geos: THREE.BufferGeometry[] = [];
    for (const side of [1, -1]) for (const [a0, a1, t0, t1] of panes) {
      const pos: number[] = []; const nu = 10, nv = 8;
      const pt = (u: number, v: number) => {
        const d = a0 + (a1 - a0) * u; const pinch = 0.05 * (1 - Math.sin(Math.PI * u));
        return f.point(d, Math.PI / 2 - side * (t0 + pinch + (t1 - t0 - 2 * pinch) * v), -0.008);
      };
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const a = pt(i / nu, j / nv), b = pt((i + 1) / nu, j / nv), c = pt(i / nu, (j + 1) / nv), e = pt((i + 1) / nu, (j + 1) / nv);
        if (side === 1) pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, b.x, b.y, b.z, e.x, e.y, e.z, c.x, c.y, c.z);
        else pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, b.x, b.y, b.z, c.x, c.y, c.z, e.x, e.y, e.z);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); geos.push(g);
    }
    mesh(systems.fuselagem, mergeGeometries(geos)!, glass, 'windshield', 'skin');
    geos.forEach((g) => g.dispose());
  }
  // carenagem asa-fuselagem
  {
    const fair = new THREE.SphereGeometry(1, 40, 20);
    fair.scale(s.wing.root * 0.78, s.R * 0.32, s.R * 0.86);
    const m = mesh(systems.fuselagem, fair, wingPaint, 'fairing', 'skin');
    m.position.set(fx(s.wing.d + s.wing.root * 0.45), -s.R * 0.9, 0);
  }
  // estrutura interna ilustrativa: cavernas + longarinas
  {
    const geos: THREE.BufferGeometry[] = [];
    const d0 = s.Ln * 0.7, d1 = L - s.Lt * 0.45;
    for (let d = d0; d <= d1; d += prop ? 0.42 : 0.6) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 40; k++) pts.push(f.point(d, (k / 40) * TAU, 0.05));
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 40, prop ? 0.018 : 0.026, 4, true));
    }
    for (let k = 0; k < 14; k++) {
      const th = (k / 14) * TAU; const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) pts.push(f.point(d0 + (d1 - d0) * (i / 24), th, 0.06));
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, prop ? 0.012 : 0.016, 3, false));
    }
    mesh(systems.fuselagem, mergeGeometries(geos)!, internalMat, 'frames', 'internal');
    geos.forEach((g) => g.dispose());
  }

  // ---------- ASAS ----------
  const foil = naca(0.02, 0.4, prop ? 0.14 : 0.115, Math.round(22 * detail));
  const wl = s.wing.winglet;
  const wlOut = wl === 'praetor' ? 0.42 : wl === 'legacy' ? 0.26 : 0;
  const z0 = s.R * 0.62, zt = s.envelope.span / 2 - wlOut;
  const sweep = D2R(s.wing.sweep), dih = D2R(s.wing.dihedral);
  const xr = fx(s.wing.d);
  const station = (side: 1 | -1, t: number): Station => {
    const z = z0 + (zt - z0) * t; const dz = z - z0;
    return { le: V(xr - dz * Math.tan(sweep), s.wing.y + dz * Math.tan(dih), side * z), chord: s.wing.root + (s.wing.tip - s.wing.root) * Math.pow(t, 0.9), up: V(0, 1, 0) };
  };
  const wingAnchors: THREE.Vector3[] = [];
  for (const side of [1, -1] as const) {
    const wg = new THREE.Group(); wg.name = side === 1 ? 'wing-R' : 'wing-L'; systems.asas.add(wg);
    const st = Array.from({ length: 8 }, (_, i) => station(side, i / 7));
    const g = loft(st, foil, wl === 'none', false); if (side === -1) flipWinding(g);
    mesh(wg, g, wingPaint, 'wing', 'skin');
    if (wl !== 'none') {
      const tip = st[st.length - 1];
      const hgt = wl === 'praetor' ? 1.45 : 0.95, cant = D2R(wl === 'praetor' ? 76 : 70);
      const ws: Station[] = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6; const ang = cant * Math.sin((t * Math.PI) / 2);
        const r = 0.32;
        const lift = r * (1 - Math.cos(ang)) + Math.max(0, t - 0.35) * hgt;
        const out = Math.min(wlOut, r * Math.sin(ang) + Math.max(0, t - 0.35) * wlOut * 0.35);
        ws.push({ le: V(tip.le.x - t * tip.chord * (wl === 'praetor' ? 0.75 : 0.6), tip.le.y + lift, side * (zt + out)), chord: tip.chord * (1 - (wl === 'praetor' ? 0.52 : 0.4) * t), up: V(0, Math.cos(ang), -side * Math.sin(ang)) });
      }
      const wg2 = loft(ws, naca(0, 0.3, 0.1, 16), true, false); if (side === -1) flipWinding(wg2);
      mesh(wg, wg2, wingPaint, 'winglet', 'skin');
    }
    // superfícies de controle (malhas próprias sobre o bordo de fuga)
    const surf = (name: string, t0: number, t1: number, from: number) => {
      const ss = [0, 1 / 3, 2 / 3, 1].map((u) => station(side, t0 + (t1 - t0) * u));
      const sg = loft(ss, trailingFoil(foil, from), true, true); if (side === -1) flipWinding(sg);
      mesh(wg, sg, surfacePaint, name, 'skin');
    };
    surf('flap', prop ? 0.06 : 0.1, prop ? 0.58 : 0.56, 0.72);
    surf('aileron', prop ? 0.62 : 0.6, prop ? 0.93 : 0.9, 0.74);
    // longarinas e nervuras (ilustrativas)
    {
      const geos: THREE.BufferGeometry[] = [];
      const bar = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
        const len = a.distanceTo(b); const c = new THREE.CylinderGeometry(r, r, len, 6);
        c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
        c.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); geos.push(c);
      };
      const at = (t: number, c: number) => { const q = station(side, t); return q.le.clone().addScaledVector(V(-1, 0, 0), q.chord * c).add(V(0, 0.02, 0)); };
      bar(at(0, 0.25), at(1, 0.25), 0.04); bar(at(0, 0.68), at(1, 0.68), 0.032);
      for (let i = 0; i <= 12; i++) { const t = i / 12; bar(at(t, 0.12), at(t, 0.82), 0.014); }
      mesh(wg, mergeGeometries(geos)!, internalMat, 'spar', 'internal');
      geos.forEach((g) => g.dispose());
    }
    if (side === -1) wingAnchors.push(station(-1, 0.55).le.clone().add(V(-station(-1, 0.55).chord * 0.4, 0.16, 0)));
  }

  // ---------- EMPENAGEM ----------
  const thinFoil = naca(0, 0.3, 0.1, 16);
  const tail = s.tail;
  const finTopY = s.envelope.height - s.axisH;
  const finRootD0 = L - s.Lt * (prop ? 0.82 : 0.9);
  const finRootY = f.profile(finRootD0 + 1).top - 0.12;
  const finH = finTopY - finRootY;
  const finSw = D2R(tail.finSweep);
  const finLeD = Math.min(finRootD0, L - 0.08 - tail.finTip - finH * Math.tan(finSw));
  const finSt: Station[] = [0, 0.5, 1].map((t) => ({ le: V(fx(finLeD + t * finH * Math.tan(finSw)), finRootY + t * finH, 0), chord: tail.finRoot + (tail.finTip - tail.finRoot) * t, up: V(0, 0, 1) }));
  finSt.unshift({ le: V(finSt[0].le.x + 0.3, finRootY - 0.5, 0), chord: tail.finRoot * 1.06, up: V(0, 0, 1) });
  const finG = new THREE.Group(); finG.name = 'fin-group'; systems.empenagem.add(finG);
  mesh(finG, loft(finSt, thinFoil, true), finPaint, 'fin', 'skin');
  mesh(finG, loft(finSt.slice(1).map((q, i) => ({ ...q, le: q.le.clone(), chord: q.chord })).filter((_, i) => i < 3), trailingFoil(thinFoil, 0.68, 1.08), true, true), surfacePaint, 'rudder', 'skin');
  const tipLe = finSt[finSt.length - 1].le;
  const half = tail.stabSpan / 2;
  let stabRootLe: THREE.Vector3, stabY: number;
  if (tail.kind === 'T') { stabRootLe = V(tipLe.x - 0.12, tipLe.y + 0.04, 0); stabY = tipLe.y + 0.04; }
  else { const d = L - 0.1 - tail.stabRoot - 0.25; stabY = (f.profile(d).top + f.profile(d).bot) / 2 + 0.05; stabRootLe = V(fx(d), stabY, 0); }
  const stabTipChord = tail.stabRoot * 0.52;
  const room = (stabRootLe.x - fx(L - 0.08)) - stabTipChord;
  const stabSw = Math.min(D2R(32), Math.atan(Math.max(0, room) / half));
  const stabSt: Station[] = [-1, -0.5, 0, 0.5, 1].map((u) => {
    const a = Math.abs(u);
    return { le: V(stabRootLe.x - a * half * Math.tan(stabSw), stabY + a * half * (tail.kind === 'T' ? -0.03 : 0.06), u * half), chord: tail.stabRoot * (1 - 0.48 * a), up: V(0, 1, 0) };
  });
  const stabG = new THREE.Group(); stabG.name = 'stab-group'; (tail.kind === 'T' ? finG : systems.empenagem).add(stabG);
  mesh(stabG, loft(stabSt, thinFoil, true, true), tail.kind === 'T' ? finPaint : wingPaint, 'stab', 'skin');
  mesh(stabG, loft(stabSt, trailingFoil(thinFoil, 0.7, 1.08), true, true), surfacePaint, 'elevator', 'skin');

  // ---------- PROPULSÃO ----------
  const lathe = (pts: [number, number][], seg = 40) => {
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), Math.round(seg * detail));
    g.rotateZ(Math.PI / 2); return g;
  };
  const e = s.engine;
  let propAnchor = V();
  if (e.kind === 'rear-turbofan') {
    const r = e.r, Le = e.len;
    const ex = fx(e.d) + Le * 0.5, ey = s.R * 0.36, ez = s.R * 0.86 + r + 0.3;
    for (const side of [1, -1] as const) {
      const eg = new THREE.Group(); eg.name = side === 1 ? 'engine-R' : 'engine-L'; eg.position.set(ex, ey, side * ez); systems.propulsao.add(eg);
      mesh(eg, lathe([[r, 0.3], [r * 1.0, Le * 0.36], [r * 0.97, Le * 0.62], [r * 0.86, Le * 0.86], [r * 0.74, Le]]), nacellePaint, 'nacelle', 'skin');
      mesh(eg, lathe([[r * 0.8, 0.3], [r * 0.82, 0.06], [r * 0.88, 0], [r * 0.95, 0.02], [r * 0.99, 0.1], [r, 0.3]]), polished, 'lip');
      mesh(eg, lathe([[r * 0.8, 0.29], [r * 0.8, 0.9]]), ductMat, 'duct');
      mesh(eg, lathe([[0.001, Le + 0.3], [r * 0.25, Le + 0.04], [r * 0.42, Le - 0.4]]), darkMetal, 'exhaust');
      // fan: pás + spinner (ESTÁTICO: aeronave estacionada)
      const blades: THREE.BufferGeometry[] = [];
      for (let b = 0; b < 20; b++) { const bg = new THREE.BoxGeometry(0.025, r * 0.56, 0.13); bg.translate(0, r * 0.5, 0); bg.applyMatrix4(new THREE.Matrix4().makeRotationY(0.6)); bg.rotateX((b / 20) * TAU); blades.push(bg); }
      const bl = mesh(eg, mergeGeometries(blades)!, darkMetal, 'fan'); bl.position.x = -0.85; blades.forEach((g) => g.dispose());
      const sp = mesh(eg, lathe([[0.001, 0.4], [r * 0.2, 0.68], [r * 0.27, 0.9]], 28), polished, 'spinner'); void sp;
      // núcleo ilustrativo: compressor, câmara, turbina
      const core: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 9; i++) { const c = new THREE.CylinderGeometry(r * (0.5 - i * 0.02), r * (0.5 - i * 0.02), 0.05, 20); c.rotateZ(Math.PI / 2); c.translate(-1.1 - i * 0.14, 0, 0); core.push(c); }
      { const c = new THREE.TorusGeometry(r * 0.36, r * 0.09, 8, 24); c.rotateY(Math.PI / 2); c.translate(-2.45, 0, 0); core.push(c); }
      for (let i = 0; i < 4; i++) { const c = new THREE.CylinderGeometry(r * (0.38 + i * 0.03), r * (0.38 + i * 0.03), 0.06, 20); c.rotateZ(Math.PI / 2); c.translate(-2.75 - i * 0.16, 0, 0); core.push(c); }
      { const c = new THREE.CylinderGeometry(r * 0.12, r * 0.12, Le * 0.85, 10); c.rotateZ(Math.PI / 2); c.translate(-Le * 0.5, 0, 0); core.push(c); }
      mesh(eg, mergeGeometries(core)!, internalMat, 'engine-core', 'internal'); core.forEach((g) => g.dispose());
      // pilone
      const rz = f.profile(e.d).w * 0.9;
      const py: Station[] = [0, 1].map((t) => ({ le: V(ex - 0.85, ey, side * (rz + t * (ez - r * 0.7 - rz))), chord: Le * 0.55, up: V(0, 1, 0) }));
      const pg = loft(py, naca(0, 0.3, 0.16, 14), true); if (side === -1) flipWinding(pg);
      mesh(systems.propulsao, pg, nacellePaint, side === 1 ? 'pylon-R' : 'pylon-L', 'skin');
      if (side === -1) propAnchor = V(ex - Le * 0.35, ey + r, -ez);
    }
  } else {
    // monomotor a pistão: spinner + hélice no nariz, núcleo ilustrativo no capô
    const pg = new THREE.Group(); pg.name = 'propeller'; pg.position.set(fx(0), (f.profile(0).top + f.profile(0).bot) / 2, 0); systems.propulsao.add(pg);
    mesh(pg, lathe([[0.001, -spinnerLen], [0.14, -spinnerLen * 0.6], [0.24, -0.04], [0.25, 0.02]], 32), polished, 'spinner');
    const n = e.blades ?? 3, pr = e.propR ?? 1;
    const bladeFoil = naca(0, 0.3, 0.09, 12);
    const bladeMat = tr(new THREE.MeshStandardMaterial({ color: '#17191c', roughness: 0.5, metalness: 0.2 }));
    for (let b = 0; b < n; b++) {
      // pá torcida: corda no plano de rotação perto da ponta, mais "aberta" na raiz
      const st: Station[] = [0.15, 0.35, 0.6, 0.85, 1].map((u) => {
        const twist = D2R(48 - 34 * u);
        const chord = (0.17 + 0.06 * Math.sin(Math.PI * Math.min(1, u * 1.3))) * (u > 0.9 ? 0.75 : 1);
        const back = new THREE.Vector3(-Math.sin(twist), 0, Math.cos(twist));
        const up = new THREE.Vector3(Math.cos(twist), 0, Math.sin(twist));
        return { le: new THREE.Vector3(-0.02, u * pr, 0).addScaledVector(back, -chord * 0.35), chord, up, back };
      });
      const bg = loft(st, bladeFoil, true, true);
      bg.rotateX((b / n) * TAU + 0.35);
      mesh(pg, bg, bladeMat, `prop-blade-${b + 1}`);
    }
    // escapamentos
    for (const side of [1, -1]) { const c = new THREE.CylinderGeometry(0.035, 0.04, 0.22, 10); c.rotateZ(Math.PI / 2 - 0.4); const m = mesh(systems.propulsao, c, darkMetal, `exhaust-${side === 1 ? 'R' : 'L'}`); m.position.set(fx(1.05), -s.R * 0.62, side * s.R * 0.42); }
    // núcleo ilustrativo: bloco, cilindros opostos e turbocompressor
    const core: THREE.BufferGeometry[] = [];
    { const b = new THREE.BoxGeometry(0.75, 0.32, 0.36); b.translate(fx(0.85), -0.04, 0); core.push(b); }
    for (let i = 0; i < 3; i++) for (const side of [1, -1]) { const c = new THREE.CylinderGeometry(0.075, 0.075, 0.34, 12); c.rotateX(Math.PI / 2); c.translate(fx(0.6 + i * 0.24), 0.02, side * 0.32); core.push(c); }
    { const t = new THREE.TorusGeometry(0.09, 0.04, 8, 18); t.translate(fx(1.35), -0.28, 0.18); core.push(t); }
    mesh(systems.propulsao, mergeGeometries(core)!, internalMat, 'engine-core', 'internal'); core.forEach((g) => g.dispose());
    propAnchor = V(fx(0) - 0.1, 0.1, -0.35);
  }

  // ---------- TREM DE POUSO ----------
  const gy = -s.axisH;
  const wheel = (r: number, w: number) => { const t = new THREE.TorusGeometry(r * 0.76, r * 0.25, 12, Math.round(28 * detail)); t.scale(1, 1, w / (r * 0.5)); return t; };
  const hub = (r: number, w: number) => { const c = new THREE.CylinderGeometry(r * 0.55, r * 0.55, w * 0.9, 20); c.rotateX(Math.PI / 2); return c; };
  const leg = (name: string, x: number, z: number, topY: number, wr: number, twin: boolean) => {
    const pivot = new THREE.Group(); pivot.name = name; pivot.position.set(x, topY, z); systems.trem.add(pivot);
    const len = topY - (gy + wr);
    const sg = new THREE.CylinderGeometry(wr * 0.2, wr * 0.24, len, 14); sg.translate(0, -len / 2, 0);
    mesh(pivot, sg, strutMat, 'strut');
    const ww = wr * 0.62;
    const ax = new THREE.CylinderGeometry(wr * 0.13, wr * 0.13, twin ? ww * 2.6 : ww * 1.3, 10); ax.rotateX(Math.PI / 2); ax.translate(0, -len, 0);
    mesh(pivot, ax, strutMat, 'axle');
    for (const off of twin ? [-ww * 0.95, ww * 0.95] : [0]) {
      const w = mesh(pivot, wheel(wr, ww), rubber, 'wheel'); w.position.set(0, -len, off);
      const h = mesh(pivot, hub(wr, ww), strutMat, 'hub'); h.position.set(0, -len, off);
    }
    return pivot;
  };
  const twin = !prop && id !== 'citation-cj2-plus';
  leg('gear-nose', fx(s.gear.noseD), 0, f.profile(s.gear.noseD).bot + 0.12, s.gear.wheel, twin);
  const mainD = s.wing.d + s.wing.root * 0.62;
  for (const side of [1, -1] as const) leg(side === 1 ? 'gear-main-R' : 'gear-main-L', fx(mainD), side * s.gear.track / 2, s.wing.y + 0.05, s.gear.mainWheel, twin);

  // ---------- CABINE (interior ilustrativo) ----------
  const floorY = s.cabin.floor;
  const cab = new THREE.Group(); cab.name = 'cabin-interior'; systems.cabine.add(cab);
  {
    const w = f.profile((s.cabin.start + s.cabin.end) / 2).w * 0.92 * Math.sqrt(Math.max(0, 1 - (floorY / s.R) ** 2));
    const fl = new THREE.BoxGeometry(s.cabin.end - s.cabin.start, 0.04, w * 2);
    const m = mesh(cab, fl, carpet, 'floor'); m.position.set(fx((s.cabin.start + s.cabin.end) / 2), floorY - 0.02, 0);
    mesh(cab, fuselageGeometry(f, { nu: Math.round(50 * detail), nv: Math.round(36 * detail), inset: 0.07, d0: s.cabin.start, d1: s.cabin.end }), lining, 'lining');
  }
  const seatGeo = (() => {
    const sc = prop ? 0.78 : 1;
    const base = new RoundedBoxGeometry(0.56 * sc, 0.2 * sc, 0.56 * sc, 3, 0.06 * sc); base.translate(0, 0.38 * sc, 0);
    const back = new RoundedBoxGeometry(0.16 * sc, 0.7 * sc, 0.56 * sc, 3, 0.06 * sc); back.translate(-0.24 * sc, 0.78 * sc, 0);
    const armL = new RoundedBoxGeometry(0.5 * sc, 0.12 * sc, 0.08 * sc, 2, 0.03 * sc); armL.translate(0, 0.58 * sc, 0.29 * sc);
    const armR = armL.clone(); armR.translate(0, 0, -0.58 * sc);
    const ped = new THREE.CylinderGeometry(0.1 * sc, 0.14 * sc, 0.3 * sc, 12); ped.translate(0, 0.15 * sc, 0);
    const parts = [base, back, armL, armR, ped].map((x) => (x.index ? x.toNonIndexed() : x));
    const g = mergeGeometries(parts)!; [base, back, armL, armR, ped, ...parts].forEach((x) => x.dispose());
    return g;
  })();
  tr(seatGeo);
  const seats: FleetCraftBuild['seats'] = [];
  s.cabin.seats.forEach((st, i) => {
    const z = st.side * (prop ? s.R * 0.4 : s.R * 0.5);
    const m = new THREE.Mesh(seatGeo, leather); m.name = `seat-${i + 1}`; m.userData.xray = 'solid';
    m.position.set(fx(st.d), floorY, z); m.rotation.y = st.facing === 1 ? Math.PI : 0;
    cab.add(m);
    seats.push({ pos: V(fx(st.d), floorY, z), facing: st.facing });
  });

  // ---------- PORTAS ----------
  {
    const dr = s.door; const pts: number[] = []; const uvs: number[] = []; const nu = 8, nv = 12;
    const yTop = floorY + dr.h, yBot = floorY - 0.05;
    const a0 = Math.PI - Math.asin(Math.min(0.98, yTop / s.R)), a1 = Math.PI - Math.asin(Math.max(-0.98, yBot / s.R));
    const du = (u: number) => dr.d - dr.w / 2 + dr.w * u, tv = (v: number) => a0 + (a1 - a0) * v;
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      for (const [u, v] of [[i, j], [i + 1, j], [i, j + 1], [i + 1, j], [i + 1, j + 1], [i, j + 1]] as const) {
        const d = du(u / nu), th = tv(v / nv); const q = f.point(d, th, -0.006);
        pts.push(q.x, q.y, q.z); uvs.push(d / L, th / TAU);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.computeVertexNormals();
    // mesma pintura e mesma UV da fuselagem: a porta é uma malha própria, mas visualmente contínua (só o contorno aparece)
    const doorMat = tr(paint.clone()); doorMat.side = THREE.DoubleSide; doorMat.polygonOffset = true; doorMat.polygonOffsetFactor = -2;
    mesh(systems.portas, g, doorMat, 'door', 'skin');
  }

  // ---------- sombra de contato (assenta a aeronave no piso) ----------
  {
    const sm = tr(new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.85, color: '#000000' }));
    const pl = tr(new THREE.PlaneGeometry(1, 1)); pl.rotateX(-Math.PI / 2);
    const body = new THREE.Mesh(pl, sm); body.name = 'contact-shadow'; body.scale.set(L * 1.05, 1, s.envelope.span * 0.55); body.position.set(fx(L * 0.52), gy + 0.012, 0); body.renderOrder = -1;
    group.add(body);
    const wing = new THREE.Mesh(pl, sm); wing.name = 'contact-shadow-wing'; wing.scale.set(s.wing.root * 1.6, 1, s.envelope.span * 1.02); wing.position.set(fx(s.wing.d + s.wing.root * 0.8), gy + 0.011, 0); wing.renderOrder = -1;
    group.add(wing);
  }

  // ---------- âncoras de hotspot (lado esquerdo, voltado à câmera) ----------
  const anchors: Record<SystemId, THREE.Vector3> = {
    fuselagem: f.point(prop ? s.Ln + 0.6 : s.Ln * 0.82, Math.PI / 2 + 0.6, 0),
    asas: wingAnchors[0] ?? V(),
    propulsao: propAnchor,
    empenagem: V(tipLe.x - tail.finTip * 0.45, finRootY + finH * 0.62, -0.05),
    trem: V(fx(mainD), gy + s.gear.mainWheel * 2.2, -s.gear.track / 2),
    cabine: f.point((s.cabin.start + s.cabin.end) * 0.55, Math.PI - 0.2, 0).add(V(0, 0.32, 0)),
    portas: f.point(s.door.d, Math.PI - 0.1, 0),
  };

  const refObj: Record<SystemId, THREE.Object3D> = {
    fuselagem: systems.fuselagem, asas: systems.asas.getObjectByName('wing-L') ?? systems.asas,
    propulsao: systems.propulsao.getObjectByName('engine-L') ?? systems.propulsao.getObjectByName('propeller') ?? systems.propulsao,
    empenagem: finG, trem: systems.trem.getObjectByName('gear-main-L') ?? systems.trem, cabine: cab, portas: systems.portas,
  };
  const anchorRefs = {} as FleetCraftBuild['anchorRefs'];
  group.updateMatrixWorld(true);
  for (const sid of SYSTEMS) { const o = refObj[sid]; anchorRefs[sid] = { obj: o, local: o.worldToLocal(group.localToWorld(anchors[sid].clone())) }; }

  // ---------- limites por sistema (enquadramento de câmera) ----------
  group.updateMatrixWorld(true);
  const bounds = {} as FleetCraftBuild['bounds'];
  const box = new THREE.Box3(), sph = new THREE.Sphere();
  for (const sid of SYSTEMS) { box.setFromObject(systems[sid]); box.getBoundingSphere(sph); bounds[sid] = { center: sph.center.clone(), radius: Math.max(0.6, sph.radius) }; }

  // ---------- desmontagem: vetores por conjunto (posição = base + vetor × progresso; nunca acumula) ----------
  const entries: InspectEntry[] = [];
  const add = (part: SystemId, obj: THREE.Object3D | undefined, off: THREE.Vector3, w: [number, number], spin = 0) => {
    if (!obj) return;
    entries.push({ part, obj, base: obj.position.clone(), baseRot: obj.rotation.clone(), off, w, spin });
  };
  const k = s.envelope.length / 20;
  add('cabine', cab, V(0, s.R * 2 + 1.6 * k, 0), [0, 0.45]);
  add('portas', systems.portas, V(0, 0, -1.6 * k), [0.06, 0.5]);
  systems.asas.children.forEach((w) => add('asas', w, V(0, -0.7 * k, (w.name === 'wing-R' ? 1 : -1) * 2.6 * k), [0.12, 0.62]));
  systems.propulsao.children.forEach((c) => {
    if (c.name.startsWith('engine-')) add('propulsao', c, V(0, 1.3 * k, Math.sign(c.position.z) * 2.2 * k), [0.2, 0.7]);
    else if (c.name.startsWith('pylon-')) add('propulsao', c, V(0, 0.6 * k, (c.name.endsWith('R') ? 1 : -1) * 0.9 * k), [0.24, 0.72]);
    else if (c.name === 'propeller') add('propulsao', c, V(1.6, 0, 0), [0.2, 0.7], 0.6);
  });
  add('empenagem', finG, V(-1.6 * k, 2.2 * k, 0), [0.3, 0.8]);
  if (tail.kind !== 'T') add('empenagem', stabG, V(-2.2 * k, 0.6 * k, 0), [0.34, 0.84]);
  systems.trem.children.forEach((g) => add('trem', g, V(0, -1.6 * k, 0), [0.4, 0.9]));

  // ---------- raio-X e isolamento ----------
  const original = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  skins.forEach((m) => original.set(m, m.material));
  let xrOn = false;
  const setXray = (amount: number) => {
    const on = amount > 0.02;
    (xray.uniforms.uAlpha as { value: number }).value = amount;
    internalMat.emissiveIntensity = 0.35 + 0.9 * amount;
    if (on === xrOn) return;
    xrOn = on;
    skins.forEach((m) => { m.material = on ? xray : original.get(m)!; m.renderOrder = on ? 3 : 0; });
    internals.forEach((o) => { o.visible = on; });
  };
  const isolate = (sid: SystemId | null) => { for (const k2 of SYSTEMS) systems[k2].visible = !sid || k2 === sid; };

  return {
    id, spec: s, group, systems, anchors, anchorRefs, bounds, entries, seats, floorY, cutY: s.R * 0.26, size: s.envelope.length, axisH: s.axisH,
    setXray, isolate,
    dispose: () => { disposables.forEach((d) => d.dispose()); },
  };
}
