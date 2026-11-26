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
import { buildCabin } from './cabin';

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
  seats: { pos: THREE.Vector3; facing: 1 | -1 | 0; side: -1 | 1 }[];
  floorY: number;
  /** fuselagem paramétrica (interior de luxo do voo usa a mesma seção) */
  fuse: Fuselage;
  fusL: number;
  cutY: number;
  size: number;
  /** altura do eixo acima do solo */
  axisH: number;
  setXray: (k: number) => void;
  /** isola uma peça (ID de catálogo) dentro do sistema visível; demais malhas viram fantasma de raio-X */
  focusPart: (part: string | null) => void;
  partBounds: (part: string) => { center: THREE.Vector3; radius: number } | null;
  /** IDs de peça com malha real nesta aeronave */
  partIds: Set<string>;
  isolate: (s: SystemId | null) => void;
  /** destaque no hangar: 1 = vívida; < 1 = mais clara e translúcida (aeronaves não selecionadas) */
  setFade: (k: number) => void;
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

/** Nariz de jato com altura de ponta ajustável (Embraer/Citation têm o nariz mais baixo). */
class JetFuselage extends Fuselage {
  constructor(s: JetSpec, private tip: number) { super(s); }
  profile(d: number) {
    const { R, Ln } = this.s;
    if (d >= Ln) return super.profile(d);
    const k = Math.max(0, d / Ln);
    const e = 1 - (1 - k) * (1 - k);
    const tipY = this.tip * R;
    void e;
    // nariz longo e caído: linha superior sobe devagar (para-brisa inclinado), inferior chega cedo ao ventre, planta ogival
    const top = tipY + (R - tipY) * (1 - Math.pow(1 - k, 1.7));
    const bot = tipY - (R + tipY) * Math.pow(1 - Math.pow(1 - k, 3), 0.62);
    const w = R * Math.pow(1 - Math.pow(1 - k, 2.0), 0.6);
    return { top, bot, w };
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
  // linha divisória θb(d) (lado; θ=0 é a lateral, negativo desce) → ventre pintado de θb até o ponto mais baixo
  const sm01 = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const paintBelly = (thB: (d: number) => number, color: string, line?: { color: string; w: number; off?: number }) => {
    for (const side of [1, -1]) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 260; i++) { const d = 0.15 + (L - 0.3) * (i / 260); const t = Math.min(-0.02, thB(d)); pts.push([X(d), Y(side === 1 ? t : Math.PI - t)]); }
      g.beginPath(); g.moveTo(pts[0][0], Y(1.5 * Math.PI)); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(pts[pts.length - 1][0], Y(1.5 * Math.PI)); g.closePath();
      g.fillStyle = color; g.fill();
      if (line) {
        g.beginPath();
        for (let i = 0; i <= 260; i++) { const d = 0.15 + (L - 0.3) * (i / 260); const t = Math.min(-0.02, thB(d)) + (line.off ?? 0.035); const y = Y(side === 1 ? t : Math.PI - t); if (i === 0) g.moveTo(X(d), y); else g.lineTo(X(d), y); }
        g.lineWidth = line.w * (W / 2048); g.strokeStyle = line.color; g.stroke();
      }
    }
  };
  const curve = (thFn: (d: number) => number, d0: number, d1: number, width: number, color: string) => {
    for (const side of [1, -1]) {
      g.beginPath();
      for (let i = 0; i <= 260; i++) { const d = d0 + (d1 - d0) * (i / 260); const t = thFn(d); const y = Y(side === 1 ? t : Math.PI - t); if (i === 0) g.moveTo(X(d), y); else g.lineTo(X(d), y); }
      g.lineWidth = width * (W / 2048); g.strokeStyle = color; g.lineCap = 'round'; g.stroke();
    }
  };
  const tailFrom = L - s.Lt;
  const darkTail = (color: string, from: number) => { const grd = g.createLinearGradient(X(from), 0, X(from + 1.6), 0); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, color); g.fillStyle = grd; g.fillRect(X(from), 0, W - X(from), H); };
  if (lv.scheme === 'dark-belly') {
    // Legacy 450 (landing SimFly): pérola em cima, ventre azul-marinho que sobe em direção à cauda, filete dourado
    paintBelly((d) => -0.95 + 0.72 * sm01(0.6, s.Ln * 1.6, d) + 0.22 * sm01(tailFrom - 2.5, L, d), lv.belly, { color: lv.stripe, w: 6 });
    darkTail(lv.belly, tailFrom + 1.2);
  } else if (lv.scheme === 'pinstripe') {
    // Praetor 500: branco com dois frisos escuros finos do nariz à nacele
    bellyBand(0.75, lv.belly, 0.7);
    curve((d) => -0.5 + 0.32 * sm01(0.8, s.Ln * 1.8, d) + 0.5 * sm01(tailFrom - 1.5, L - 0.6, d), 0.9, L - 0.7, 5, lv.stripe);
    curve((d) => -0.6 + 0.32 * sm01(0.8, s.Ln * 1.8, d) + 0.5 * sm01(tailFrom - 1.5, L - 0.6, d), 1.1, L - 0.9, 3, lv.accent);
  } else if (lv.scheme === 'dark-tail') {
    // Praetor 600: branco, ventre preto no terço inferior com filete claro, cone de cauda e deriva pretos
    paintBelly((d) => -0.85 + 0.5 * sm01(0.6, s.Ln * 1.5, d) + 0.12 * sm01(tailFrom - 2, L, d), lv.belly, { color: '#c9ced6', w: 3, off: 0.03 });
    darkTail(lv.accent, tailFrom + 0.6);
  } else if (lv.scheme === 'piper') {
    // Matrix: branco, ventre preto da carenagem do motor à cauda, filete dourado
    paintBelly((d) => -0.32 + 0.06 * sm01(0, L, d) + 0.12 * sm01(tailFrom, L, d), lv.belly, { color: lv.stripe, w: 5 });
  } else {
    // Citation CJ2+: faixa marinho em curva do nariz até a nacele, filete dourado acompanhando
    curve((d) => -0.62 + 0.55 * sm01(0.8, L * 0.5, d) + 0.45 * sm01(L * 0.55, L - 0.6, d), 0.7, L - 0.6, 11, lv.stripe);
    curve((d) => -0.74 + 0.55 * sm01(0.8, L * 0.5, d) + 0.45 * sm01(L * 0.55, L - 0.6, d), 1.0, L - 0.8, 4, lv.accent);
  }
  // janelas da cabine (pintadas; vidro escuro com reflexo)
  const wn = s.windows;
  for (let i = 0; i < wn.n; i++) {
    const d = wn.d0 + i * wn.pitch;
    for (const side of [1, -1]) {
      const th = side === 1 ? (wn.th ?? 0.2) : Math.PI - (wn.th ?? 0.2);
      const w = (wn.w / L) * W, h = ((wn.h / s.R) / TAU) * H;
      const x = X(d) - w / 2, y = Y(th) - h / 2;
      const grd = g.createLinearGradient(0, y, 0, y + h);
      grd.addColorStop(0, '#2c3a48'); grd.addColorStop(0.5, '#0d141c'); grd.addColorStop(1, '#1a2633');
      g.fillStyle = grd;
      g.beginPath(); g.roundRect(x, y, w, h, Math.min(w, h) * 0.45); g.fill();
      g.strokeStyle = 'rgba(120,130,140,0.55)'; g.lineWidth = Math.max(1, W / 2048); g.stroke();
    }
  }
  // Matrix: faixa escura sob o para-brisa envolvente (sem frestas entre vidro e pele) + montante central claro
  if (s.nose === 'prop') {
    for (const side of [1, -1]) {
      const pts: [number, number][] = [[s.Ln * 0.8, Math.PI / 2 - 0.035], [s.Ln * 1.07, Math.PI / 2 - 0.035], [s.Ln * 1.07, Math.PI / 2 - 1.18], [s.Ln * 0.86, Math.PI / 2 - 1.12]];
      g.beginPath(); pts.forEach(([d, t], i) => { const tt = side === 1 ? t : Math.PI - t; const y = Y(tt); if (i === 0) g.moveTo(X(d), y); else g.lineTo(X(d), y); }); g.closePath();
      g.fillStyle = '#0d141c'; g.fill();
    }
  }
  // janelas laterais do cockpit (atrás do para-brisa)
  {
    const prop2 = s.nose === 'prop';
    const d0 = prop2 ? s.Ln + 0.12 : s.Ln * 0.86, d1 = prop2 ? s.Ln + 0.62 : s.Ln * 1.02;
    for (const side of [1, -1]) {
      const thc = prop2 ? 0.42 : 0.5;
      const pts: [number, number][] = [[d0, thc + 0.18], [d1, thc + 0.26], [d1, thc - 0.08], [d0 + (d1 - d0) * 0.25, thc - 0.12]];
      g.beginPath(); pts.forEach(([d, t], i) => { const y = Y(side === 1 ? t : Math.PI - t); if (i === 0) g.moveTo(X(d), y); else g.lineTo(X(d), y); }); g.closePath();
      g.fillStyle = '#121a24'; g.fill(); g.strokeStyle = 'rgba(150,160,170,0.6)'; g.lineWidth = Math.max(1, W / 2048); g.stroke();
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
  const L = s.fusL ?? s.envelope.length - spinnerLen;
  const js = { L, R: s.R, Ln: s.Ln, Lt: s.Lt } as JetSpec;
  const f = prop ? new PropFuselage(js) : new JetFuselage(js, s.noseTip ?? -0.3);
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
  const finColor = s.livery.fin;
  const finPaint = tr(new THREE.MeshPhysicalMaterial({ color: finColor, roughness: 0.26, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.07 }));
  const nacellePaint = tr(new THREE.MeshPhysicalMaterial({ color: s.livery.nacelle, roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 }));
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
  const noseCut = prop ? s.Ln : s.Ln * 0.34;
  mesh(systems.fuselagem, fuselageGeometry(f, { nu: Math.round(160 * detail), nv: Math.round(64 * detail), d0: noseCut * 0.995, d1: L }), paint, 'skin', 'skin');
  // nariz como malha própria: radome (jatos) ou capô do motor (Matrix, pertence à propulsão)
  mesh(prop ? systems.propulsao : systems.fuselagem, fuselageGeometry(f, { nu: Math.round(40 * detail), nv: Math.round(64 * detail), d0: 0, d1: noseCut }), paint, prop ? 'cowling' : 'radome', 'skin');
  // para-brisa (painéis no nariz)
  {
    const panes: [number, number, number, number][] = prop
      ? [[s.Ln * 0.8, s.Ln * 1.07, 0.035, 1.18]]
      : [[s.Ln * 0.56, s.Ln * 0.84, 0.05, 0.58], [s.Ln * 0.64, s.Ln * 0.9, 0.66, 1.06]];
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
    // quebra do bordo de fuga (Embraer): trecho interno com bordo de fuga reto, externo enflechado até a ponta
    const kk = s.wing.kink ?? 0;
    let chord: number;
    if (kk > 0) {
      const zk = z0 + (zt - z0) * kk, ck = s.wing.root - (zk - z0) * Math.tan(sweep);
      chord = t <= kk ? s.wing.root - dz * Math.tan(sweep) : ck + (s.wing.tip - ck) * ((t - kk) / (1 - kk));
    } else chord = s.wing.root + (s.wing.tip - s.wing.root) * Math.pow(t, 0.9);
    return { le: V(xr - dz * Math.tan(sweep), s.wing.y + dz * Math.tan(dih), side * z), chord, up: V(0, 1, 0) };
  };
  const wingAnchors: THREE.Vector3[] = [];
  for (const side of [1, -1] as const) {
    const wg = new THREE.Group(); wg.name = side === 1 ? 'wing-R' : 'wing-L'; systems.asas.add(wg);
    const tk = s.wing.kink ?? 0;
    const ts = tk > 0 ? [0, tk * 0.5, tk, tk + (1 - tk) * 0.25, tk + (1 - tk) * 0.5, tk + (1 - tk) * 0.75, 1] : Array.from({ length: 8 }, (_, i) => i / 7);
    const st = ts.map((t) => station(side, t));
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
  // raiz embutida na fuselagem + filete dorsal (barbatana dorsal que nasce à frente da deriva)
  const dorsal = tail.kind === 'T' ? s.envelope.length * 0.085 : 0.9;
  finSt.unshift({ le: V(finSt[0].le.x + dorsal, finRootY - 0.42, 0), chord: tail.finRoot + dorsal * 0.92, up: V(0, 0, 1) });
  const finG = new THREE.Group(); finG.name = 'fin-group'; systems.empenagem.add(finG);
  mesh(finG, loft(finSt, thinFoil, true), finPaint, 'fin', 'skin');
  mesh(finG, loft(finSt.slice(1).map((q, i) => ({ ...q, le: q.le.clone(), chord: q.chord })).filter((_, i) => i < 3), trailingFoil(thinFoil, 0.68, 1.08), true, true), surfacePaint, 'rudder', 'skin');
  const tipLe = finSt[finSt.length - 1].le;
  const half = tail.stabSpan / 2;
  let stabRootLe: THREE.Vector3, stabY: number;
  if (tail.kind === 'T') { stabRootLe = V(tipLe.x - 0.12, tipLe.y + 0.04, 0); stabY = tipLe.y + 0.04; }
  else { const d = L - 0.1 - tail.stabRoot - 0.25; stabY = (f.profile(d).top + f.profile(d).bot) / 2 + 0.05; stabRootLe = V(fx(d), stabY, 0); }
  const stabTipChord = tail.stabRoot * 0.52;
  // cauda em T: as pontas do estabilizador definem o comprimento total do tipo (vista cotada do fabricante)
  const tailEnd = tail.kind === 'T' ? s.envelope.length - spinnerLen : L - 0.08;
  const room = (stabRootLe.x - fx(tailEnd)) - stabTipChord;
  const stabSw = Math.min(D2R(tail.kind === 'T' ? 38 : 32), Math.atan(Math.max(0, room) / half));
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
    const ex = fx(e.d) + Le * 0.5, ey = s.R * (e.yk ?? 0.36), ez = s.R * 0.86 + r + 0.3;
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
      // núcleo ilustrativo (estágios genéricos de turbofan, não geometria Honeywell/Williams)
      const disc = (rad: number, x: number, w = 0.05) => { const c = new THREE.CylinderGeometry(rad, rad, w, 22); c.rotateZ(Math.PI / 2); c.translate(x, 0, 0); return c; };
      const k0 = Le / 3.3;
      const comp = Array.from({ length: 8 }, (_, i) => disc(r * (0.5 - i * 0.025), (-1.05 - i * 0.13) * k0));
      mesh(eg, mergeGeometries(comp)!, internalMat, 'compressor', 'internal'); comp.forEach((g) => g.dispose());
      { const c = new THREE.TorusGeometry(r * 0.34, r * 0.1, 10, 26); c.rotateY(Math.PI / 2); c.translate(-2.2 * k0, 0, 0); mesh(eg, c, internalMat, 'combustor', 'internal'); }
      const turb = Array.from({ length: 4 }, (_, i) => disc(r * (0.36 + i * 0.035), (-2.55 - i * 0.15) * k0, 0.07));
      mesh(eg, mergeGeometries(turb)!, internalMat, 'turbine', 'internal'); turb.forEach((g) => g.dispose());
      { const c = new THREE.CylinderGeometry(r * 0.1, r * 0.1, Le * 0.8, 10); c.rotateZ(Math.PI / 2); c.translate(-Le * 0.5, 0, 0); mesh(eg, c, internalMat, 'shaft', 'internal'); }
      { const c = new THREE.BoxGeometry(0.5 * k0, 0.18 * k0, 0.22 * k0); c.translate(-1.5 * k0, -r * 0.62, 0); mesh(eg, c, internalMat, 'accessory', 'internal'); }
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
    // motor a pistão ilustrativo: cárter, 6 cilindros opostos, turbocompressor e intercooler (não é geometria Lycoming)
    { const b = new THREE.BoxGeometry(0.75, 0.32, 0.34); b.translate(fx(0.85), -0.04, 0); mesh(systems.propulsao, b, internalMat, 'crankcase', 'internal'); }
    { const cyl: THREE.BufferGeometry[] = []; for (let i = 0; i < 3; i++) for (const side of [1, -1]) { const c = new THREE.CylinderGeometry(0.075, 0.075, 0.32, 14); c.rotateX(Math.PI / 2); c.translate(fx(0.6 + i * 0.24), 0.02, side * 0.32); cyl.push(c); }
      mesh(systems.propulsao, mergeGeometries(cyl)!, internalMat, 'cylinders', 'internal'); cyl.forEach((g) => g.dispose()); }
    { const t = new THREE.TorusGeometry(0.085, 0.04, 8, 18); t.translate(fx(1.38), -0.28, 0.18); mesh(systems.propulsao, t, internalMat, 'turbo', 'internal'); }
    { const b = new THREE.BoxGeometry(0.22, 0.12, 0.3); b.translate(fx(1.2), 0.24, -0.12); mesh(systems.propulsao, b, internalMat, 'intercooler', 'internal'); }
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
      if (name !== 'gear-nose') { const bd = new THREE.CylinderGeometry(wr * 0.42, wr * 0.42, ww * 0.35, 18); bd.rotateX(Math.PI / 2); const bm = mesh(pivot, bd, darkMetal, 'brake'); bm.position.set(0, -len, off + (off >= 0 ? -1 : 1) * ww * 0.18); }
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
    mesh(cab, fuselageGeometry(f, { nu: Math.round(50 * detail), nv: Math.round(36 * detail), inset: 0.07, d0: s.cabin.start, d1: s.cabin.end }), lining, 'lining');
  }
  // poltronas, móveis e cockpit pela planta de fábrica (mesma fonte da planta 2D)
  const cabinB = buildCabin(s, f, L, { lux: false, clip: CUT_PLANES });
  cab.add(cabinB.group); disposables.push(cabinB);
  const seats: FleetCraftBuild['seats'] = cabinB.seats;

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

  // ---------- micropeças visíveis (catálogo V6; posições ilustrativas) ----------
  {
    const navMat = (c: string) => tr(new THREE.MeshStandardMaterial({ color: c, emissive: new THREE.Color(c), emissiveIntensity: 1.6, roughness: 0.3 }));
    const lightGeo = tr(new THREE.SphereGeometry(0.06, 12, 8));
    for (const side of [1, -1] as const) {
      const wg = systems.asas.getObjectByName(side === 1 ? 'wing-R' : 'wing-L')!;
      const tip = station(side, 1);
      const m = new THREE.Mesh(lightGeo, navMat(side === 1 ? '#3dff8a' : '#ff3b3b')); m.name = 'navlight'; m.userData.xray = 'solid';
      m.position.copy(tip.le).add(V(-0.12, 0.02, side * 0.04)); wg.add(m);
    }
    const tl = new THREE.Mesh(lightGeo, navMat('#ffffff')); tl.name = 'navlight'; tl.position.set(fx(L) + 0.02, (f.profile(L - 0.05).top + f.profile(L - 0.05).bot) / 2, 0); systems.empenagem.add(tl);
    // pitots e antenas
    const sens: THREE.BufferGeometry[] = [];
    for (const side of [1, -1]) { const c = new THREE.CylinderGeometry(0.012, 0.016, 0.22, 8); c.rotateZ(Math.PI / 2); const q = f.point(prop ? s.Ln + 0.2 : s.Ln * 0.42, side === 1 ? 0.15 : Math.PI - 0.15, -0.05); c.translate(q.x, q.y, q.z); sens.push(c); }
    for (const [d, th, hgt] of [[s.Ln + (L - s.Ln) * 0.35, Math.PI / 2, 0.22], [s.Ln + (L - s.Ln) * 0.6, Math.PI / 2, 0.16], [s.Ln + (L - s.Ln) * 0.45, -Math.PI / 2, 0.14]] as const) {
      const b = new THREE.BoxGeometry(0.22, hgt, 0.025); const q = f.point(d, th, 0); b.translate(q.x - 0.03, q.y + (th > 0 ? hgt / 2 : -hgt / 2), q.z); sens.push(b);
    }
    mesh(systems.fuselagem, mergeGeometries(sens.map((g) => (g.index ? g.toNonIndexed() : g)))!, darkMetal, 'sensors'); sens.forEach((g) => g.dispose());
    // tanques de combustível ilustrativos (volume entre longarinas; só no raio-X)
    const fuelMat = tr(new THREE.MeshStandardMaterial({ color: '#7fb6ff', emissive: new THREE.Color('#1d4fa8'), emissiveIntensity: 0.6, transparent: true, opacity: 0.55, depthWrite: false }));
    for (const side of [1, -1] as const) {
      const wg = systems.asas.getObjectByName(side === 1 ? 'wing-R' : 'wing-L')!;
      const st = [0.06, 0.4, prop ? 0.7 : 0.78].map((t) => { const q = station(side, t); return { ...q, le: q.le.clone().addScaledVector(V(-1, 0, 0), q.chord * 0.27), chord: q.chord * 0.4 }; });
      const g = loft(st, naca(0, 0.4, prop ? 0.12 : 0.09, 10), true, true); if (side === -1) flipWinding(g);
      mesh(wg, g, fuelMat, 'fuel', 'internal');
    }
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
  const k = (s.envelope.length / 20) * 1.7;
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

  // ---------- IDs de peça (ligam a malha ao catálogo do atlas) ----------
  const PART_OF: Record<string, string> = {
    skin: 'skin', fairing: 'skin', radome: 'radome', windshield: 'windshield', frames: 'frames', sensors: 'sensors',
    wing: 'wing', winglet: 'winglet', flap: 'flap', aileron: 'aileron', spar: 'spar', fuel: 'fuel', navlight: 'navlights',
    nacelle: 'nacelle', lip: 'nacelle', duct: 'nacelle', exhaust: 'nacelle', fan: 'fan', spinner: prop ? 'spinner' : 'fan',
    compressor: 'compressor', combustor: 'combustor', turbine: 'turbine', shaft: 'shaft', accessory: 'accessory',
    cowling: 'cowling', crankcase: 'crankcase', cylinders: 'cylinders', turbo: 'turbo', intercooler: 'intercooler',
    fin: 'fin', rudder: 'fin', stab: 'stab', elevator: 'stab',
    floor: 'floor', lining: 'floor', furnishing: 'floor', lavatory: 'lavatory', panel: 'cockpit', displays: 'cockpit', 'crew-seat': 'cockpit', door: 'door',
  };
  const allMeshes: THREE.Mesh[] = [];
  const partIds = new Set<string>();
  group.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh || m.name.startsWith('contact-shadow')) return;
    let part = PART_OF[m.name];
    if (!part) {
      if (m.name.startsWith('prop-blade')) part = 'prop';
      else if (m.name.startsWith('exhaust-')) part = 'cowling';
      else if (m.name.startsWith('pylon-')) part = 'pylon';
      else if (m.name.startsWith('seat-')) part = 'seats';
      else if (m.name === 'brake') part = 'brakes';
      else if (['strut', 'axle', 'wheel', 'hub'].includes(m.name)) { let p: THREE.Object3D | null = m.parent; while (p && !p.name.startsWith('gear-')) p = p.parent; part = p?.name === 'gear-nose' ? 'gear-nose' : 'gear-main'; }
      else part = m.name;
    }
    m.userData.part = part; partIds.add(part); allMeshes.push(m);
  });
  const original = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  allMeshes.forEach((m) => original.set(m, m.material));
  const skinSet = new Set(skins);
  const skinMatSet = new Set<THREE.Material>(skins.flatMap((m) => ([] as THREE.Material[]).concat(m.material)));
  let xrOn = false, focused: string | null = null;
  const refresh = () => {
    for (const m of allMeshes) {
      const internal = m.userData.xray === 'internal';
      if (focused) {
        const hit = m.userData.part === focused;
        m.material = hit ? original.get(m)! : xray;
        m.visible = hit || !internal || xrOn;
        m.renderOrder = hit ? 0 : 3;
      } else {
        m.material = original.get(m)!;
        m.visible = internal ? xrOn : true;
        m.renderOrder = 0;
      }
    }
  };
  // raio-X contínuo: camada fresnel sobreposta (mesma geometria) aparece enquanto a pele esmaece — sem troca brusca
  const overlays: THREE.Mesh[] = skins.map((m) => { const o = new THREE.Mesh(m.geometry, xray); o.name = 'xray-overlay'; o.visible = false; o.renderOrder = 3; o.userData.xray = 'overlay'; m.add(o); return o; });
  let xrA = 0, fadeKk = 1;
  const applyOpacity = () => {
    fadeMats.forEach((b0, m) => {
      const skinMat = skinMatSet.has(m);
      const k = fadeKk * (skinMat ? 1 - 0.88 * xrA : 1);
      m.opacity = b0.op * k;
      const t = b0.tr || k < 0.999;
      if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; }
      if (!b0.tr) m.depthWrite = k > 0.35; // longe de 0,6 (fade dos não escolhidos): sem alternar a cada quadro → sem pisca
    });
  };
  const setXray = (amount: number) => {
    let a = Math.min(1, Math.max(0, amount));
    if (a < 0.006) a = 0; // sem resíduo: casco volta a ser 100% opaco (resíduo deixava o casco no passe transparente e ele sumia atrás de nuvens)
    (xray.uniforms.uAlpha as { value: number }).value = focused ? Math.max(0.55, a) : a;
    internalMat.emissiveIntensity = 0.35 + 0.9 * a;
    internalMat.transparent = true; internalMat.opacity = Math.min(1, a * 1.4);
    const on = a > 0.01;
    if (!focused) { overlays.forEach((o) => { o.visible = on; }); internals.forEach((o) => { o.visible = on; }); }
    if ((a === xrA || (a > 0 && Math.abs(a - xrA) < 0.004)) && on === xrOn) return;
    xrA = a; xrOn = on; applyOpacity();
  };
  const focusPart = (part: string | null) => {
    const p = part && partIds.has(part) ? part : null;
    if (p === focused) return;
    focused = p; partCache.clear();
    overlays.forEach((o) => { o.visible = !p && xrOn; });
    (xray.uniforms.uAlpha as { value: number }).value = p ? 0.55 : xrOn ? 1 : 0;
    refresh();
  };
  const partCache = new Map<string, { center: THREE.Vector3; radius: number } | null>();
  const partBounds = (part: string) => {
    if (partCache.has(part)) return partCache.get(part)!;
    const b = new THREE.Box3(), tmpB = new THREE.Box3();
    group.updateMatrixWorld(true);
    const inv = group.matrixWorld.clone().invert();
    for (const m of allMeshes) if (m.userData.part === part) { m.geometry.computeBoundingBox(); tmpB.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld).applyMatrix4(inv); b.union(tmpB); }
    const r = b.isEmpty() ? null : (() => { const sp = b.getBoundingSphere(new THREE.Sphere()); return { center: sp.center.clone(), radius: Math.max(0.35, sp.radius) }; })();
    partCache.set(part, r); return r;
  };
  const fadeMats = new Map<THREE.Material, { op: number; tr: boolean }>();
  group.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh || o.userData.xray === 'overlay') return; for (const mt of ([] as THREE.Material[]).concat(m.material)) if (!(mt instanceof THREE.ShaderMaterial) && !fadeMats.has(mt)) fadeMats.set(mt, { op: mt.opacity, tr: mt.transparent }); });
  const setFade = (k: number) => {
    const kk = Math.round(Math.min(1, Math.max(0, k)) * 100) / 100;
    if (kk === fadeKk) return;
    fadeKk = kk; applyOpacity();
  };
  const isolate = (sid: SystemId | null) => { for (const k2 of SYSTEMS) systems[k2].visible = !sid || k2 === sid; };

  return {
    id, spec: s, group, systems, anchors, anchorRefs, bounds, entries, seats, floorY, fuse: f, fusL: L, cutY: s.R * 0.26, size: s.envelope.length, axisH: s.axisH,
    setXray, isolate, setFade, focusPart, partBounds, partIds,
    dispose: () => { disposables.forEach((d) => d.dispose()); },
  };
}
