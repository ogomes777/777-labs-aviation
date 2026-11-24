import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PartId } from '@/content/site';
import { CABIN_INSET, SPECS, WIN, floorY, groundY, type JetSpec, type AircraftId } from './spec';
import { Fuselage, fuselageGeometry, superellipse } from './fuselage';
import { loft, naca, type Station } from './loft';
import { finLivery, fuselageLivery, wingMaps } from './livery';
import { CUT_PLANES, paintMaterial, windowUniforms, withWindows } from './materials';
import { buildCabin, type CabinBuild } from './cabin';
import type { VariantId } from '@/content/site';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export interface JetBuild {
  spec: JetSpec;
  fus: Fuselage;
  group: THREE.Group;
  parts: Record<PartId, THREE.Group>;
  partMaterials: Record<PartId, THREE.Material[]>;
  anchors: Record<PartId, THREE.Vector3>;
  explode: Record<PartId, THREE.Vector3>;
  gearPivots: THREE.Object3D[];
  cabin: CabinBuild;
  /** centro externo e normal da janela-portal (lado direito, 3ª janela) */
  portal: { center: THREE.Vector3; normal: THREE.Vector3; d: number };
  exhausts: THREE.Vector3[];
  /** rotores (pás + cone) que giram */
  fans: THREE.Object3D[];
  windowCenters: { d: number; left: THREE.Vector3; right: THREE.Vector3; nl: THREE.Vector3; nr: THREE.Vector3 }[];
  dispose: () => void;
}

export interface BuildOptions { textureSize: number; detail: number }

export function buildJet(variant: AircraftId | VariantId, opts: BuildOptions): JetBuild {
  const s = SPECS[variant as AircraftId];
  const tp = s.kind === 'turboprop';
  const f = new Fuselage(s);
  const group = new THREE.Group();
  group.name = `jet-${variant}`;
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T) => { disposables.push(o); return o; };
  const mk = <T extends THREE.Material>(m: T) => track(m);
  const parts = {} as Record<PartId, THREE.Group>;
  const partMaterials = {} as Record<PartId, THREE.Material[]>;
  (['fuselagem', 'asas', 'motores', 'empenagem', 'trem', 'cabine'] as PartId[]).forEach((id) => {
    const g = new THREE.Group(); g.name = id; parts[id] = g; partMaterials[id] = []; group.add(g);
  });
  const addMesh = (part: PartId, geo: THREE.BufferGeometry, mat: THREE.Material, name?: string) => {
    track(geo);
    const m = new THREE.Mesh(geo, mat);
    if (name) m.name = name;
    parts[part].add(m);
    if (!partMaterials[part].includes(mat)) partMaterials[part].push(mat);
    return m;
  };
  const detail = opts.detail;

  // ---------- Fuselagem ----------
  const livery = track(fuselageLivery(s, opts.textureSize));
  const paint = mk(withWindows(paintMaterial(livery), windowUniforms(s, s.R), `shell-${variant}`));
  paint.side = THREE.DoubleSide;
  paint.clippingPlanes = CUT_PLANES;
  addMesh('fuselagem', fuselageGeometry(f, { nu: Math.round(200 * detail), nv: Math.round(72 * detail) }), paint, 'shell');

  // carenagem asa-fuselagem
  const fairMat = mk(new THREE.MeshPhysicalMaterial({ color: '#d9dcdf', roughness: 0.34, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.1 }));
  const fair = new THREE.SphereGeometry(1, 48, 24);
  fair.scale(s.rootChord * 0.75, s.R * 0.3, s.R * 0.84);
  const fairMesh = addMesh('fuselagem', fair, fairMat, 'fairing');
  fairMesh.position.set(f.x(s.wingD + s.rootChord * 0.42), tp ? s.R * 0.86 : -s.R * 0.99, 0);

  // ---------- Janelas: vidro, túnel (reveal) e moldura interna ----------
  const inner = CABIN_INSET;
  const contour = superellipse(48, WIN.n);
  const glassGeos: THREE.BufferGeometry[] = [], revealGeos: THREE.BufferGeometry[] = [], bezelGeos: THREE.BufferGeometry[] = [];
  const windowCenters: JetBuild['windowCenters'] = [];
  const P = V(), Q = V();
  const Ri = s.R - inner;
  for (let i = 0; i < s.windows; i++) {
    const d = s.winD0 + i * s.winPitch;
    for (const side of [1, -1]) {
      const th0 = side === 1 ? WIN.theta : Math.PI - WIN.theta;
      const at = (dx: number, dy: number, inset: number, scale = 1, out = V()) => {
        const R = s.R - inset;
        return f.point(d + dx * (WIN.w / 2) * scale, th0 + (side === 1 ? 1 : -1) * dy * (WIN.h / 2) * scale / R, inset, out);
      };
      // vidro (recuado 1,5 cm)
      {
        const pos: number[] = [];
        const c = at(0, 0, 0.015);
        for (let k = 0; k < contour.length; k++) {
          const [ax, ay] = contour[k], [bx, by] = contour[(k + 1) % contour.length];
          const a = at(ax, ay, 0.015), b = at(bx, by, 0.015);
          pos.push(c.x, c.y, c.z, a.x, a.y, a.z, b.x, b.y, b.z);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.computeVertexNormals();
        glassGeos.push(g);
      }
      // túnel entre casca e revestimento
      {
        const pos: number[] = [];
        for (let k = 0; k < contour.length; k++) {
          const [ax, ay] = contour[k], [bx, by] = contour[(k + 1) % contour.length];
          const a0 = at(ax, ay, 0), b0 = at(bx, by, 0), a1 = at(ax, ay, inner), b1 = at(bx, by, inner);
          pos.push(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b0.x, b0.y, b0.z, b0.x, b0.y, b0.z, a1.x, a1.y, a1.z, b1.x, b1.y, b1.z);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.computeVertexNormals();
        revealGeos.push(g);
      }
      // moldura interna marfim com relevo (a "janela-portal")
      {
        const rings = [[1.0, 0.045], [1.1, 0.06], [1.28, 0.05], [1.5, 0.0]];
        const pos: number[] = [];
        const n = V();
        const ringPt = (k: number, r: number) => {
          const [cx, cy] = contour[k % contour.length];
          const [sc, raise] = rings[r];
          at(cx, cy, inner, sc, P);
          f.normal(d + cx * (WIN.w / 2) * sc, th0, inner, n);
          return P.clone().addScaledVector(n, -raise);
        };
        for (let r = 0; r < rings.length - 1; r++) for (let k = 0; k < contour.length; k++) {
          const a = ringPt(k, r), b = ringPt(k + 1, r), c = ringPt(k, r + 1), e = ringPt(k + 1, r + 1);
          pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, b.x, b.y, b.z, c.x, c.y, c.z, e.x, e.y, e.z);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.computeVertexNormals();
        bezelGeos.push(g);
      }
    }
    windowCenters.push({
      d,
      left: f.point(d, Math.PI - WIN.theta, 0),
      right: f.point(d, WIN.theta, 0),
      nl: f.normal(d, Math.PI - WIN.theta, 0),
      nr: f.normal(d, WIN.theta, 0),
    });
  }
  void Q; void Ri;
  const glass = mk(new THREE.MeshPhysicalMaterial({ color: '#1d2a33', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.32, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.02 }));
  glass.clippingPlanes = CUT_PLANES;
  const glassMesh = addMesh('fuselagem', mergeGeometries(glassGeos)!, glass, 'glass');
  glassMesh.renderOrder = 2;
  glassGeos.forEach((g) => g.dispose());

  // ---------- Cabine (interior em escala real) ----------
  const cabin = buildCabin(s, f, { detail });
  parts.cabine.add(cabin.group);
  partMaterials.cabine.push(...cabin.materials);
  disposables.push({ dispose: cabin.dispose });
  const lining = cabin.materials[0] as THREE.MeshStandardMaterial;
  addMesh('cabine', mergeGeometries(revealGeos)!, lining, 'reveals');
  addMesh('cabine', mergeGeometries(bezelGeos)!, cabin.bezel, 'bezels');
  revealGeos.forEach((g) => g.dispose());
  bezelGeos.forEach((g) => g.dispose());

  // ---------- Para-brisa ----------
  const cockpitGlass = mk(new THREE.MeshPhysicalMaterial({ color: '#0d151c', roughness: 0.05, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8 }));
  {
    const panes: [number, number, number, number][] = [
      // d0, d1, θ0, θ1 (θ medido do topo para o lado)
      [s.Ln * 0.6, s.Ln * 0.86, 0.06, 0.62],
      [s.Ln * 0.66, s.Ln * 0.9, 0.7, 1.05],
    ];
    const geos: THREE.BufferGeometry[] = [];
    for (const side of [1, -1]) for (const [a0, a1, t0, t1] of panes) {
      const pos: number[] = [];
      const nu = 10, nv = 8;
      const pt = (u: number, v: number) => {
        const d = a0 + (a1 - a0) * u;
        // cantos arredondados: estreita a faixa angular nas extremidades
        const pinch = 0.05 * (1 - Math.sin(Math.PI * u));
        const th = Math.PI / 2 - side * (t0 + pinch + (t1 - t0 - 2 * pinch) * v);
        const p = f.point(d, th, -0.006);
        return p;
      };
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const a = pt(i / nu, j / nv), b = pt((i + 1) / nu, j / nv), c = pt(i / nu, (j + 1) / nv), e = pt((i + 1) / nu, (j + 1) / nv);
        if (side === 1) pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, b.x, b.y, b.z, e.x, e.y, e.z, c.x, c.y, c.z);
        else pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, b.x, b.y, b.z, c.x, c.y, c.z, e.x, e.y, e.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      geos.push(g);
    }
    addMesh('fuselagem', mergeGeometries(geos)!, cockpitGlass, 'windshield');
    geos.forEach((g) => g.dispose());
  }

  // ---------- Asas ----------
  const wm = wingMaps();
  track(wm.map); track(wm.mr);
  const wingMat = mk(new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: wm.map, roughnessMap: wm.mr, metalnessMap: wm.mr, roughness: 1, metalness: 1, clearcoat: 0.9, clearcoatRoughness: 0.08 }));
  const foil = naca(0.02, 0.4, 0.115, Math.round(22 * detail));
  const foilThin = naca(0, 0.3, 0.1, Math.round(18 * detail));
  const wingY = tp ? s.R * 0.78 : -s.R * 0.79; // jato: asa baixa (raiz sob o piso); turboélice: asa alta
  const sweep = THREE.MathUtils.degToRad(s.sweep);
  const dihedral = THREE.MathUtils.degToRad(tp ? 1.2 : 3.2);
  const wingStations = (side: 1 | -1): Station[] => {
    const z0 = s.R * 0.55, zt = s.span / 2;
    const xr = f.x(s.wingD);
    const out: Station[] = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const z = z0 + (zt - z0) * t;
      const dz = z - z0;
      const chord = s.rootChord + (s.tipChord - s.rootChord) * Math.pow(t, 0.85) - (t < 0.3 ? 0 : 0);
      out.push({ le: V(xr - dz * Math.tan(sweep), wingY + dz * Math.tan(dihedral), side * z), chord, up: V(0, 1, 0) });
    }
    if (tp) return out;
    // winglet: mistura curva até ~78°
    const tip = out[out.length - 1];
    const wl = s.span * 0.06;
    for (let i = 1; i <= 5; i++) {
      const t = i / 5;
      const ang = THREE.MathUtils.degToRad(78) * Math.sin((t * Math.PI) / 2);
      const r = wl * 0.35;
      const lift = t < 0.4 ? r * (1 - Math.cos(ang)) : r * (1 - Math.cos(ang)) + (t - 0.4) * wl * 1.2;
      const out_ = t < 0.4 ? r * Math.sin(ang) : r * Math.sin(ang) + (t - 0.4) * wl * 0.25;
      out.push({
        le: V(tip.le.x - t * s.tipChord * 0.9, tip.le.y + lift, side * (s.span / 2 + out_)),
        chord: s.tipChord * (1 - 0.45 * t),
        up: V(0, Math.cos(ang), -side * Math.sin(ang)),
      });
    }
    return out;
  };
  for (const side of [1, -1] as const) {
    const st = wingStations(side);
    const g = loft(side === 1 ? st : st, foil, true, false);
    if (side === -1) { const idx = g.getIndex()!; const arr = idx.array as Uint32Array | Uint16Array; for (let i = 0; i < arr.length; i += 3) { const tmp = arr[i]; arr[i] = arr[i + 1]; arr[i + 1] = tmp; } g.computeVertexNormals(); }
    addMesh('asas', g, wingMat, `wing-${side}`);
  }

  // ---------- Empenagem (cauda em T) ----------
  const finMat = mk(paintMaterial(track(finLivery(Math.min(1024, opts.textureSize / 2)))));
  const stabMat = mk(paintMaterial());
  const finD = s.L - s.Lt * 0.86;
  const finRootY = f.profile(finD + 1.5).top - 0.25;
  const finSweep = THREE.MathUtils.degToRad(42);
  const finRoot = s.L * 0.16, finTip = finRoot * 0.62;
  const finSt: Station[] = [0, 0.5, 1].map((t) => ({
    le: V(f.x(finD) - t * s.finH * Math.tan(finSweep), finRootY + t * s.finH, 0),
    chord: finRoot + (finTip - finRoot) * t,
    up: V(0, 0, 1),
  }));
  // a raiz entra na fuselagem
  finSt.unshift({ le: V(finSt[0].le.x + 0.3, finRootY - 0.6, 0), chord: finRoot * 1.08, up: V(0, 0, 1) });
  addMesh('empenagem', loft(finSt, foilThin, true), finMat, 'fin');
  const tipLe = finSt[finSt.length - 1].le;
  const hs = s.span * 0.34;
  const hsSweep = THREE.MathUtils.degToRad(32);
  const hsSt: Station[] = [-1, -0.5, 0, 0.5, 1].map((u) => {
    const a = Math.abs(u);
    return { le: V(tipLe.x - 0.15 - a * (hs / 2) * Math.tan(hsSweep), tipLe.y + 0.02 + a * (hs / 2) * 0.03, u * (hs / 2)), chord: finTip * 1.05 * (1 - 0.5 * a), up: V(0, 1, 0) };
  });
  addMesh('empenagem', loft(hsSt, foilThin, true, true), stabMat, 'stab');

  // ---------- Motores ----------
  const nacelleMat = mk(paintMaterial());
  const polished = mk(new THREE.MeshStandardMaterial({ color: '#d6d9dc', roughness: 0.16, metalness: 1 }));
  const darkMetal = mk(new THREE.MeshStandardMaterial({ color: '#2a2f35', roughness: 0.35, metalness: 0.9 }));
  const duct = mk(new THREE.MeshStandardMaterial({ color: '#15181c', roughness: 0.6, metalness: 0.4, side: THREE.BackSide }));
  const re = 0.66 * s.engine, Le = 3.8 * s.engine;
  const fans: THREE.Object3D[] = [];
  const spiral = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d')!; g.fillStyle = '#2b3036'; g.fillRect(0, 0, 256, 64);
    g.strokeStyle = '#f2f2f2'; g.lineWidth = 9; g.beginPath(); g.moveTo(0, 64); g.bezierCurveTo(80, 40, 120, 20, 256, 0); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  track(spiral);
  const spinnerMat = mk(new THREE.MeshStandardMaterial({ color: '#ffffff', map: spiral, roughness: 0.3, metalness: 0.6 }));
  const lathe = (pts: [number, number][], seg = 48) => {
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), Math.round(seg * detail));
    g.rotateZ(Math.PI / 2); // eixo do torno (+y) → −x (entrada voltada para o nariz)
    return g;
  };
  const engineX = f.x(s.L - s.Lt - 0.2) + Le * 0.5;
  const engineY = s.R * 0.32;
  const engineZ = s.R + re + 0.32;
  for (const side of tp ? [] : [1, -1]) {
    const eg = new THREE.Group();
    eg.position.set(engineX, engineY, side * engineZ);
    const add = (g: THREE.BufferGeometry, m: THREE.Material, name: string) => { const mesh = addMesh('motores', g, m, name); parts.motores.remove(mesh); eg.add(mesh); return mesh; };
    add(lathe([[re * 1.0, 0.3 * s.engine], [re * 1.0, 1.4 * s.engine], [re * 0.97, 2.4 * s.engine], [re * 0.88, 3.25 * s.engine], [re * 0.76, Le]]), nacelleMat, 'nacelle');
    add(lathe([[re * 0.8, 0.3 * s.engine], [re * 0.82, 0.07 * s.engine], [re * 0.88, 0.0], [re * 0.95, 0.02 * s.engine], [re * 0.99, 0.1 * s.engine], [re * 1.0, 0.3 * s.engine]]), polished, 'lip');
    add(lathe([[re * 0.8, 0.29 * s.engine], [re * 0.8, 0.95 * s.engine]]), duct, 'duct');
    add(lathe([[re * 0.74, Le - 0.02], [re * 0.7, Le - 0.5 * s.engine]]), duct, 'exhaust-duct');
    add(lathe([[0.001, Le + 0.35 * s.engine], [re * 0.25, Le + 0.05 * s.engine], [re * 0.42, Le - 0.4 * s.engine]]), darkMetal, 'exhaust-cone');
    // fan + spinner
    const fan = new THREE.CircleGeometry(re * 0.79, Math.round(40 * detail));
    fan.rotateY(Math.PI / 2);
    const fanMesh = add(fan, darkMetal, 'fan-disc');
    fanMesh.position.x = -0.95 * s.engine;
    const rotor = new THREE.Group(); rotor.name = 'rotor';
    eg.add(rotor);
    const spin = new THREE.Mesh(track(lathe([[0.001, 0.42 * s.engine], [re * 0.2, 0.72 * s.engine], [re * 0.26, 0.94 * s.engine]], 32)), spinnerMat);
    rotor.add(spin);
    fans.push(rotor);
    const blades: THREE.BufferGeometry[] = [];
    for (let b = 0; b < 22; b++) {
      const bg = new THREE.BoxGeometry(0.03, re * 0.55, 0.16 * s.engine);
      bg.translate(0, re * 0.5, 0);
      bg.rotateY(0); // torção
      const m4 = new THREE.Matrix4().makeRotationY(0.6);
      bg.applyMatrix4(m4);
      bg.rotateX((b / 22) * Math.PI * 2);
      blades.push(bg);
    }
    const bl = new THREE.Mesh(track(mergeGeometries(blades)!), darkMetal);
    bl.position.x = -0.88 * s.engine;
    rotor.add(bl);
    blades.forEach((g) => g.dispose());
    parts.motores.add(eg);
    // pilone
    const rz = f.profile(s.L - s.Lt - 0.2 + 0.9 * s.engine).w * 0.92;
    const py: Station[] = [0, 1].map((t) => ({ le: V(engineX - 0.9 * s.engine, engineY, side * (rz + t * (engineZ - re * 0.7 - rz))), chord: 2.2 * s.engine, up: V(0, 1, 0) }));
    const pg = loft(py, naca(0, 0.3, 0.16, 14), true);
    if (side === -1) { const idx = pg.getIndex()!; const arr = idx.array as Uint32Array | Uint16Array; for (let i = 0; i < arr.length; i += 3) { const tmp = arr[i]; arr[i] = arr[i + 1]; arr[i + 1] = tmp; } pg.computeVertexNormals(); }
    addMesh('motores', pg, nacelleMat, 'pylon');
  }

  // ---------- Turboélice: naceles sob a asa + hélices de 5 pás ----------
  if (tp) {
    const zN = s.R + 2.0, rN = 0.42;
    const wingLeAt = (z: number) => f.x(s.wingD) - (z - s.R * 0.55) * Math.tan(sweep);
    for (const side of [1, -1]) {
      const eg = new THREE.Group(); eg.name = 'engine';
      const xLe = wingLeAt(zN);
      eg.position.set(xLe + 1.1, wingY - 0.18, side * zN);
      const add = (g: THREE.BufferGeometry, m: THREE.Material, name: string) => { const mesh = new THREE.Mesh(track(g), m); mesh.name = name; eg.add(mesh); if (!partMaterials.motores.includes(m)) partMaterials.motores.push(m); return mesh; };
      add(lathe([[rN * 0.55, 0.0], [rN * 0.95, 0.35], [rN, 1.0], [rN * 0.92, 2.6], [rN * 0.45, 3.6]]), nacelleMat, 'nacelle');
      add(lathe([[0.001, -0.5], [rN * 0.42, -0.25], [rN * 0.56, 0.02]], 32), spinnerMat, 'spinner-cap');
      const rotor = new THREE.Group(); rotor.name = 'rotor'; rotor.position.x = 0.12; eg.add(rotor);
      const blades: THREE.BufferGeometry[] = [];
      for (let b = 0; b < 5; b++) {
        const bg = new THREE.BoxGeometry(0.05, 1.45, 0.2);
        bg.translate(0, 0.82, 0);
        bg.applyMatrix4(new THREE.Matrix4().makeRotationY(0.35));
        bg.rotateX((b / 5) * Math.PI * 2);
        blades.push(bg);
      }
      const bl = new THREE.Mesh(track(mergeGeometries(blades)!), darkMetal); bl.name = 'prop';
      blades.forEach((g) => g.dispose());
      rotor.add(bl);
      fans.push(rotor);
      parts.motores.add(eg);
    }
  }

  // ---------- Trem de pouso ----------
  const rubber = mk(new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.85, metalness: 0 }));
  const strutMat = mk(new THREE.MeshStandardMaterial({ color: '#a9afb5', roughness: 0.28, metalness: 0.95 }));
  const gy = groundY(s);
  const gearPivots: THREE.Object3D[] = [];
  const wheel = (r: number, w: number) => {
    const t = new THREE.TorusGeometry(r * 0.78, r * 0.24, 14, Math.round(32 * detail));
    t.scale(1, 1, w / (r * 0.5));
    return t;
  };
  const hub = (r: number, w: number) => { const c = new THREE.CylinderGeometry(r * 0.56, r * 0.56, w * 0.9, 24); c.rotateX(Math.PI / 2); return c; };
  const leg = (x: number, z: number, topY: number, wr: number, twin: boolean) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, topY, z);
    const len = topY - (gy + wr);
    const strut = new THREE.CylinderGeometry(0.07, 0.08, len, 16);
    strut.translate(0, -len / 2, 0);
    const sm = new THREE.Mesh(track(strut), strutMat); pivot.add(sm);
    const axle = new THREE.CylinderGeometry(0.05, 0.05, twin ? 0.62 : 0.3, 12); axle.rotateX(Math.PI / 2); axle.translate(0, -len, 0);
    pivot.add(new THREE.Mesh(track(axle), strutMat));
    for (const off of twin ? [-0.24, 0.24] : [0]) {
      const wgeo = track(wheel(wr, 0.22)); const w = new THREE.Mesh(wgeo, rubber); w.position.set(0, -len, off); pivot.add(w);
      const hgeo = track(hub(wr, 0.22)); const h = new THREE.Mesh(hgeo, strutMat); h.position.set(0, -len, off); pivot.add(h);
    }
    parts.trem.add(pivot);
    gearPivots.push(pivot);
  };
  leg(f.x(2.4), 0, f.profile(2.4).bot + 0.15, 0.3, true);
  const mainX = f.x(s.wingD + s.rootChord * 0.62);
  for (const side of [1, -1]) leg(tp ? f.x(s.wingD + s.rootChord * 0.55) : mainX, side * s.R * (tp ? 0.95 : 1.35), tp ? -s.R * 0.62 : wingY + 0.05, tp ? 0.36 : 0.44, true);
  partMaterials.trem.push(rubber, strutMat);

  // ---------- Âncoras de hotspot e vetores de explosão ----------
  const anchors: Record<PartId, THREE.Vector3> = {
    fuselagem: f.point(s.Ln * 0.75, Math.PI / 2, 0),
    asas: V(f.x(s.wingD) - s.span * 0.25 * Math.tan(sweep) - s.rootChord * 0.3, wingY + 0.4, -s.span * 0.3),
    motores: V(engineX - Le * 0.3, engineY + re, -engineZ),
    empenagem: V(tipLe.x - finTip * 0.4, tipLe.y + 0.1, 0),
    trem: V(mainX, gy + 0.6, -s.R * 1.35),
    cabine: f.point((s.cabinStart + s.cabinEnd) / 2, Math.PI / 2, 0),
  };
  const explode: Record<PartId, THREE.Vector3> = {
    fuselagem: V(0, 0, 0),
    asas: V(0, -0.4, 0), // escalonado por lado no runtime
    motores: V(0, 1.4, 0),
    empenagem: V(-1.6, 2.6, 0),
    trem: V(0, -2.0, 0),
    cabine: V(0, 0, 0),
  };

  const portalIdx = Math.min(2, s.windows - 1);
  const pw = windowCenters[portalIdx];
  return {
    spec: s, fus: f, group, parts, partMaterials, anchors, explode, gearPivots, cabin,
    portal: { center: pw.right.clone(), normal: pw.nr.clone(), d: pw.d },
    windowCenters,
    fans,
    exhausts: tp ? [] : [1, -1].map((side) => V(engineX - Le - 0.3 * s.engine, engineY, side * engineZ)),
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

export { floorY };
