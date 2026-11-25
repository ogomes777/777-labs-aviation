import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CABIN_INSET, floorY, type JetSpec } from './spec';
import { fuselageGeometry, type Fuselage } from './fuselage';
import { CUT_PLANES, windowUniforms, withWindows } from './materials';
import type { GalleryId } from '@/content/site';

export interface CameraSpot { eye: THREE.Vector3; target: THREE.Vector3; fov: number }
export interface CabinBuild {
  group: THREE.Group;
  materials: THREE.Material[];
  bezel: THREE.Material;
  glow: THREE.MeshStandardMaterial[];
  lightSpots: THREE.Vector3[];
  spots: Record<GalleryId, CameraSpot>;
  /** ponto sobre o corredor, usado no mergulho do cutaway */
  aisle: { fwd: THREE.Vector3; aft: THREE.Vector3 };
  hasSuite: boolean;
  /** poltronas: posição no piso (local da aeronave) e sentido (+1 = olha para o nariz) */
  seats: { pos: THREE.Vector3; facing: 1 | -1 }[];
  floorY: number;
  dispose: () => void;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function woodTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5a3b26';
  g.fillRect(0, 0, size, size);
  // veios: linhas senoidais com ruído determinístico
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) {
    const y0 = rnd() * size, amp = 2 + rnd() * 9, fr = 0.004 + rnd() * 0.01, ph = rnd() * 6.28;
    const light = rnd() > 0.5;
    g.strokeStyle = light ? `rgba(150,105,70,${0.08 + rnd() * 0.16})` : `rgba(40,24,14,${0.1 + rnd() * 0.2})`;
    g.lineWidth = 0.6 + rnd() * 2.2;
    g.beginPath();
    for (let x = 0; x <= size; x += 6) {
      const y = y0 + Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 3.1 + ph) * amp * 0.25;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function noiseTexture(size = 256, base = 128, spread = 40) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * size; i++) {
    const v = base + (rnd() - 0.5) * spread;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildCabin(s: JetSpec, f: Fuselage, opts: { detail: number }): CabinBuild {
  const group = new THREE.Group();
  group.name = 'cabin';
  const disposables: { dispose: () => void }[] = [];
  const T = <O extends { dispose: () => void }>(o: O) => { disposables.push(o); return o; };
  const clip = <M extends THREE.Material>(m: M) => { m.clippingPlanes = CUT_PLANES; return T(m); };

  const Ri = s.R - CABIN_INSET;
  const yf = floorY(s);
  const X = (d: number) => f.x(d);
  const wallZ = (y: number) => Ri * Math.sqrt(Math.max(0, 1 - (y / Ri) ** 2));

  const wood = T(woodTexture(opts.detail >= .95 ? 1024 : 512));
  const carpetNoise = T(noiseTexture(256, 128, 60));
  const grain = T(noiseTexture(opts.detail >= .95 ? 1024 : 512, 128, 65));
  grain.repeat.set(3, 3);
  carpetNoise.repeat.set(8, 2);

  const lining = clip(withWindows(new THREE.MeshStandardMaterial({ color: '#d9cfbf', roughness: 0.8, metalness: 0, side: THREE.BackSide }), windowUniforms(s, Ri), 'lining'));
  const bezel = clip(new THREE.MeshStandardMaterial({ color: '#eee7dc', roughness: 0.34, metalness: 0, side: THREE.DoubleSide }));
  const leather = clip(new THREE.MeshPhysicalMaterial({ color: '#e9e3d9', roughness: 0.43, metalness: 0, bumpMap: grain, bumpScale: 0.012, sheen: 0.6, sheenColor: new THREE.Color('#fff2df'), sheenRoughness: 0.6 }));
  const leatherDark = clip(new THREE.MeshPhysicalMaterial({ color: '#172e4c', roughness: 0.55, metalness: 0, sheen: 0.3, sheenColor: new THREE.Color('#9b7d66') }));
  const walnut = clip(new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: wood, roughness: 0.32, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.12 }));
  const trim = clip(new THREE.MeshStandardMaterial({ color: '#b4c2d1', roughness: 0.38, metalness: 0.72, envMapIntensity: 2.2, emissive: new THREE.Color('#172b43'), emissiveIntensity: 0.35 }));
  const carpet = clip(new THREE.MeshStandardMaterial({ color: '#142b49', roughness: 1, metalness: 0, bumpMap: carpetNoise, bumpScale: 0.035 }));
  const stone = clip(new THREE.MeshPhysicalMaterial({ color: '#e4ddd2', roughness: 0.18, metalness: 0, clearcoat: 0.5 }));
  const fabric = clip(new THREE.MeshPhysicalMaterial({ color: '#f5f1ea', roughness: 0.92, sheen: 0.6, sheenColor: new THREE.Color('#ffffff') }));
  const throwMat = clip(new THREE.MeshPhysicalMaterial({ color: '#214778', roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color('#f0d9b5') }));
  const screen = clip(new THREE.MeshPhysicalMaterial({ color: '#0b0d10', roughness: 0.08, metalness: 0.2, clearcoat: 1 }));
  const glowWarm = clip(new THREE.MeshStandardMaterial({ color: '#000000', emissive: new THREE.Color('#ffd6a0'), emissiveIntensity: 2.2, toneMapped: true }));
  const glowSoft = clip(new THREE.MeshStandardMaterial({ color: '#000000', emissive: new THREE.Color('#ffe9cc'), emissiveIntensity: 1.4 }));

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0, parent: THREE.Object3D = group) => {
    T(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    parent.add(m);
    return m;
  };
  const rb = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, Math.max(3, Math.round(6 * opts.detail)), r);

  // ---- casca interna (lining), piso e teto ----
  const c0 = s.cabinStart, c1 = s.cabinEnd;
  add(fuselageGeometry(f, { nu: Math.round(140 * opts.detail), nv: Math.round(112 * opts.detail), inset: CABIN_INSET, d0: c0 - 0.05, d1: c1 + 0.05 }), lining, 0, 0, 0).name='lining';
  const fw = wallZ(yf) + 0.06;
  const floorGeo = new THREE.PlaneGeometry(c1 - c0, fw * 2);
  floorGeo.rotateX(-Math.PI / 2);
  add(floorGeo, carpet, X((c0 + c1) / 2), yf, 0);
  // painel central do teto + sancas iluminadas
  const ceilY = Ri * 0.84;
  const ceil = new THREE.PlaneGeometry(c1 - c0, wallZ(ceilY) * 1.3);
  ceil.rotateX(Math.PI / 2);
  add(ceil, bezel, X((c0 + c1) / 2), ceilY, 0).name='ceiling';
  const coveY = Ri * 0.6;
  for (const side of [1, -1]) {
    const strip = new THREE.BoxGeometry(c1 - c0 - 0.4, 0.018, 0.04);
    add(strip, glowWarm, X((c0 + c1) / 2), coveY, side * (wallZ(coveY) - 0.06)).name='cove-light';
    const wash = new THREE.BoxGeometry(c1 - c0 - 0.4, 0.012, 0.03);
    add(wash, glowSoft, X((c0 + c1) / 2), yf + 0.03, side * (fw - 0.2));
    const lip = new THREE.BoxGeometry(c1 - c0, 0.035, 0.12);
    add(lip, bezel, X((c0 + c1) / 2), ceilY - 0.02, side * (wallZ(ceilY) * 0.65)).name='ceiling-lip';
  }
  for (let d = c0 + 0.8; d < c1 - 0.4; d += 1.1) {
    const dl = new THREE.CircleGeometry(0.035, 16);
    dl.rotateX(Math.PI / 2);
    add(dl, glowWarm, X(d), ceilY - 0.002, 0).name='downlight';
  }

  // ---- divisórias (seção elíptica interna com portas) ----
  const bulkhead = (d: number, door: { w: number; h: number; z: number } | null, mat: THREE.Material, thick = 0.06) => {
    const shape = new THREE.Shape();
    const th0 = Math.asin(Math.max(-1, yf / Ri));
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const th = th0 + ((Math.PI - 2 * th0) * i) / n;
      const zz = Ri * Math.cos(th) + 0.01 * Math.cos(th), yy = Ri * Math.sin(th);
      if (i === 0) shape.moveTo(-zz, yy); else shape.lineTo(-zz, yy);
    }
    shape.closePath();
    if (door) {
      const h = new THREE.Path();
      const z0 = -(door.z - door.w / 2), z1 = -(door.z + door.w / 2);
      h.moveTo(z0, yf); h.lineTo(z1, yf); h.lineTo(z1, yf + door.h - 0.1); h.quadraticCurveTo(z1, yf + door.h, (z0 + z1) / 2, yf + door.h); h.quadraticCurveTo(z0, yf + door.h, z0, yf + door.h - 0.1); h.closePath();
      shape.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 8 });
    g.rotateY(Math.PI / 2);
    add(g, mat, X(d) - thick / 2, 0, 0);
  };
  bulkhead(c0, null, walnut, 0.08);
  bulkhead(c1, null, bezel, 0.08);
  // porta da toalete na divisória de ré
  add(rb(0.62, 1.82, 0.04, 0.02), walnut, X(c1) + 0.06, yf + 0.92, -0.25);
  add(new THREE.BoxGeometry(0.02, 0.18, 0.02), trim, X(c1) + 0.09, yf + 1.0, -0.5);

  // ---- assento lounge (origem no piso, voltado para +x) ----
  const seatParts = {
    base: rb(0.56, 0.28, 0.58, 0.04),
    cushion: rb(0.66, 0.16, 0.64, 0.06),
    back: rb(0.17, 0.74, 0.64, 0.07),
    head: rb(0.14, 0.20, 0.46, 0.055),
    arm: rb(0.62, 0.20, 0.12, 0.05),
    armTrim: new THREE.BoxGeometry(0.03, 0.008, 0.5),
    lumbar: rb(0.10, 0.25, 0.39, 0.045),
  };
  Object.values(seatParts).forEach(T);
  const seats: { pos: THREE.Vector3; facing: 1 | -1 }[] = [];
  const seat = (x: number, z: number, facing: 1 | -1) => {
    seats.push({ pos: V(x, yf, z), facing });
    const g = new THREE.Group();
    g.name='seat';
    g.position.set(x, yf, z);
    g.rotation.y = facing === 1 ? 0 : Math.PI;
    const m = (geo: THREE.BufferGeometry, mat: THREE.Material, px: number, py: number, pz: number, rz = 0) => {
      const mesh = new THREE.Mesh(geo, mat); mesh.position.set(px, py, pz); mesh.rotation.z = rz; g.add(mesh); return mesh;
    };
    m(seatParts.base, leatherDark, 0, 0.14, 0);
    m(seatParts.cushion, leather, 0.02, 0.36, 0);
    m(seatParts.back, leather, -0.3, 0.78, 0, 0.12);
    m(seatParts.head, leather, -0.35, 1.2, 0, 0.12);
    m(seatParts.lumbar, throwMat, -0.18, 0.60, 0, 0.12);
    for (const sz of [0.37, -0.37]) {
      m(seatParts.arm, leather, 0.0, 0.52, sz);
      m(seatParts.armTrim, trim, 0.0, 0.625, sz).rotation.y = Math.PI / 2;
    }
    group.add(g);
    return g;
  };
  const sideTable = (x: number, z: number, w = 0.62, depth = 0.52) => {
    add(rb(w, 0.04, depth, 0.015), walnut, x, yf + 0.72, z).name='table';
    add(new THREE.CylinderGeometry(0.035, 0.05, 0.7, 16), trim, x, yf + 0.35, z + Math.sign(z) * 0.12);
  };
  const ledge = (d0: number, d1: number, side: 1 | -1) => {
    const y = yf + 0.6;
    const z = side * (wallZ(y) - 0.12);
    add(rb(d1 - d0, 0.05, 0.3, 0.012), walnut, X((d0 + d1) / 2), y, z);
    add(new THREE.BoxGeometry(d1 - d0, 0.56, 0.06), bezel, X((d0 + d1) / 2), yf + 0.3, side * (wallZ(y) - 0.25));
    add(new THREE.BoxGeometry(d1 - d0 - 0.1, 0.008, 0.01), glowSoft, X((d0 + d1) / 2), y - 0.03, side * (wallZ(y) - 0.27));
  };

  // ---- zonas por variante ----
  const zones: Record<string, [number, number]> = {};
  if (s.id === 'XR') Object.assign(zones, { entry: [c0, c0 + 1.8], lounge: [c0 + 1.8, c0 + 5.2], dining: [c0 + 5.2, c0 + 8.4], divan: [c0 + 8.4, c0 + 11.2], suite: [c0 + 11.4, c1] });
  else if (s.id === 'M') Object.assign(zones, { entry: [c0, c0 + 1.7], lounge: [c0 + 1.7, c0 + 5.0], dining: [c0 + 5.0, c0 + 8.1], divan: [c0 + 8.2, c1] });
  else Object.assign(zones, { entry: [c0, c0 + 1.4], lounge: [c0 + 1.4, c0 + 4.8], divan: [c0 + 5.0, c1] });

  // entrada / galley (lado direito)
  {
    const [a, b] = zones.entry;
    const z = wallZ(yf + 0.9) - 0.32;
    add(rb(b - a - 0.2, 0.92, 0.55, 0.02), walnut, X((a + b) / 2), yf + 0.46, z);
    add(rb(b - a - 0.16, 0.035, 0.6, 0.01), stone, X((a + b) / 2), yf + 0.94, z - 0.02);
    add(rb(b - a - 0.2, 0.42, 0.34, 0.02), walnut, X((a + b) / 2), yf + 1.62, wallZ(yf + 1.62) - 0.22);
    add(new THREE.BoxGeometry(b - a - 0.3, 0.008, 0.01), glowWarm, X((a + b) / 2), yf + 1.4, wallZ(yf + 1.42) - 0.38);
    // painel interno da porta (lado esquerdo)
    const dz = -(wallZ(yf + 0.95) - 0.02);
    add(rb(0.86, 1.7, 0.03, 0.04), bezel, X(s.Ln + 0.8), yf + 0.95, dz).rotation.y = 0;
    add(new THREE.BoxGeometry(0.2, 0.03, 0.03), trim, X(s.Ln + 0.62), yf + 1.0, dz + 0.04);
  }
  // lounge: clube de 4
  const lc = (zones.lounge[0] + zones.lounge[1]) / 2;
  for (const side of [1, -1] as const) {
    const z = side * 0.66;
    seat(X(lc - 0.88), z, -1);
    seat(X(lc + 0.88), z, 1);
    sideTable(X(lc), side * 0.74);
  }
  ledge(zones.lounge[0] + 0.2, zones.lounge[1] - 0.1, 1);
  ledge(zones.lounge[0] + 0.2, zones.lounge[1] - 0.1, -1);
  // mesa de jantar para quatro
  let dc = lc;
  if (zones.dining) {
    dc = (zones.dining[0] + zones.dining[1]) / 2;
    for (const side of [1, -1] as const) { seat(X(dc - 0.92), side * 0.62, -1); seat(X(dc + 0.92), side * 0.62, 1); }
    add(rb(1.05, 0.045, 1.5, 0.02), walnut, X(dc), yf + 0.73, 0).name='table';
    add(new THREE.CylinderGeometry(0.06, 0.12, 0.7, 20), trim, X(dc), yf + 0.36, 0);
    // pratos e taças discretos
    for (const [px, pz] of [[-0.3, 0.45], [0.3, 0.45], [-0.3, -0.45], [0.3, -0.45]]) {
      add(new THREE.CylinderGeometry(0.11, 0.1, 0.012, 28), stone, X(dc) + px, yf + 0.76, pz);
      add(new THREE.CylinderGeometry(0.028, 0.02, 0.14, 16), bezel, X(dc) + px * 0.55, yf + 0.82, pz * 0.62);
    }
    add(new THREE.CylinderGeometry(0.05, 0.075, 0.2, 24), stone, X(dc), yf + 0.85, 0);
    add(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 6), trim, X(dc), yf + 1.03, 0);
    ledge(zones.dining[0] + 0.1, zones.dining[1] - 0.1, 1);
    ledge(zones.dining[0] + 0.1, zones.dining[1] - 0.1, -1);
  }
  // divã (lado direito) + credenza com luminária (lado esquerdo)
  const [v0, v1] = zones.divan;
  const vc = (v0 + v1) / 2;
  const divLen = Math.min(2.3, v1 - v0 - 0.5);
  {
    const z = wallZ(yf + 0.4) - 0.36;
    add(rb(divLen, 0.3, 0.62, 0.04), leatherDark, X(vc), yf + 0.15, z);
    add(rb(divLen - 0.02, 0.16, 0.64, 0.06), leather, X(vc), yf + 0.38, z - 0.01);
    add(rb(divLen - 0.06, 0.48, 0.16, 0.07), leather, X(vc), yf + 0.7, z + 0.26).rotation.x = -0.12;
    for (const off of [-divLen / 3, 0, divLen / 3]) add(rb(0.4, 0.3, 0.12, 0.05), fabric, X(vc) + off, yf + 0.62, z + 0.12).rotation.x = -0.2;
    add(rb(divLen * 0.5, 0.03, 0.5, 0.01), throwMat, X(vc) - divLen * 0.15, yf + 0.47, z - 0.02);
    const zc = -(wallZ(yf + 0.5) - 0.3);
    add(rb(Math.min(1.6, divLen), 0.56, 0.42, 0.02), walnut, X(vc), yf + 0.28, zc);
    add(rb(Math.min(1.6, divLen) + 0.02, 0.025, 0.44, 0.008), stone, X(vc), yf + 0.57, zc);
    add(new THREE.CylinderGeometry(0.02, 0.06, 0.32, 16), trim, X(vc) + 0.4, yf + 0.74, zc);
    add(new THREE.CylinderGeometry(0.1, 0.13, 0.13, 24, 1, true), glowWarm, X(vc) + 0.4, yf + 0.94, zc);
    add(new THREE.CylinderGeometry(0.05, 0.07, 0.24, 20), stone, X(vc) - 0.35, yf + 0.7, zc);
    // tela embutida (desligada) acima da credenza
    add(rb(0.9, 0.52, 0.03, 0.01), screen, X(vc), yf + 1.28, -(wallZ(yf + 1.28) - 0.08)).rotation.y = 0;
  }
  // suíte (XR): divisória com porta + cama
  let bedC = vc;
  const hasSuite = !!zones.suite;
  if (hasSuite) {
    const [s0, s1] = zones.suite;
    bulkhead(s0 - 0.1, { w: 0.82, h: 1.9, z: -0.32 }, walnut, 0.07);
    bedC = (s0 + s1) / 2 + 0.25;
    const bz = 0.22;
    add(rb(2.0, 0.34, 1.42, 0.03), walnut, X(bedC), yf + 0.17, bz);
    add(rb(1.96, 0.22, 1.36, 0.08), fabric, X(bedC), yf + 0.45, bz);
    add(rb(1.5, 0.08, 1.44, 0.05), fabric, X(bedC) + 0.22, yf + 0.57, bz);
    add(rb(0.36, 0.05, 1.46, 0.02), throwMat, X(bedC) + 0.62, yf + 0.62, bz);
    for (const pz of [-0.34, 0.34]) add(rb(0.34, 0.14, 0.56, 0.06), fabric, X(bedC) - 0.78, yf + 0.64, bz + pz).rotation.z = 0.25;
    // cabeceira estofada na divisória de ré
    add(rb(0.08, 0.7, 1.5, 0.03), leather, X(s1) + 0.12, yf + 0.78, bz);
    // criado-mudo + luminária
    add(rb(0.4, 0.5, 0.36, 0.02), walnut, X(s1) + 0.45, yf + 0.25, -0.72);
    add(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 20, 1, true), glowWarm, X(s1) + 0.45, yf + 0.62, -0.72);
    ledge(s0 + 0.1, s1 - 0.1, 1);
  }

  // ---- spots de câmera para a galeria ----
  const wy = yf + 1.0;
  const winIdx = Math.max(0, Math.min(s.windows - 1, Math.round((lc - s.winD0) / s.winPitch)));
  const wd = s.winD0 + winIdx * s.winPitch;
  const wp = f.point(wd, Math.PI - 0.2, CABIN_INSET);
  const spots: Record<GalleryId, { eye: THREE.Vector3; target: THREE.Vector3; fov: number }> = {
    lounge: { eye: V(X(lc - 2.3), yf + 1.32, 0.18), target: V(X(lc + 0.9), yf + 0.62, -0.08), fov: 52 },
    mesa: { eye: V(X(dc - 1.75), yf + 1.55, -0.32), target: V(X(dc + 0.2), yf + 0.62, 0.08), fov: 50 },
    suite: hasSuite
      ? { eye: V(X(zones.suite[0] + 0.15), yf + 1.42, -0.35), target: V(X(bedC - 0.3), yf + 0.5, 0.25), fov: 54 }
      : { eye: V(X(vc - 0.4), yf + 1.3, -0.62), target: V(X(vc + 0.2), yf + 0.5, 0.7), fov: 54 },
    janela: { eye: V(X(wd) - 0.95, wy + 0.05, -0.38), target: V(wp.x, wp.y, wp.z), fov: 46 },
  };
  const lightSpots = [V(X(lc), yf + 1.55, 0), V(X(zones.dining ? dc : vc), yf + 1.55, 0), V(X(hasSuite ? bedC : vc), yf + 1.55, 0)];

  return {
    group,
    materials: [lining, bezel, leather, leatherDark, walnut, trim, carpet, stone, fabric, throwMat, screen, glowWarm, glowSoft],
    bezel,
    glow: [glowWarm, glowSoft],
    lightSpots,
    spots,
    aisle: { fwd: V(X(c0 + 0.6), yf + 1.4, 0), aft: V(X(c1 - 0.6), yf + 1.4, 0) },
    hasSuite,
    seats,
    floorY: yf,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
