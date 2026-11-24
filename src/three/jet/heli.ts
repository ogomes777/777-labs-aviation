import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SPECS, type JetSpec } from './spec';
import { Fuselage, fuselageGeometry } from './fuselage';
import { loft, naca, type Station } from './loft';
import { fuselageLivery } from './livery';
import { paintMaterial } from './materials';

/** Helicóptero conceitual: casca paramétrica (cabine + cone de cauda), rotor de 5 pás, rotor de cauda e esquis. */
export interface HeliBuild { group: THREE.Group; fans: { obj: THREE.Object3D; axis: 'y' | 'z'; disc?: THREE.Mesh }[]; length: number; dispose: () => void }

export function buildHeli(opts: { textureSize: number }): HeliBuild {
  const s: JetSpec = { ...SPECS.L, id: 'L', L: 12.6, R: 1.0, Ln: 2.5, Lt: 8.2, windows: 0, winPitch: 1, winD0: 0 };
  const f = new Fuselage(s);
  const group = new THREE.Group(); group.name = 'heli';
  const D: { dispose: () => void }[] = [];
  const T = <O extends { dispose: () => void }>(o: O) => { D.push(o); return o; };
  const named = (g: THREE.BufferGeometry, m: THREE.Material, name: string, parent: THREE.Object3D = group) => { const mesh = new THREE.Mesh(T(g), m); mesh.name = name; parent.add(mesh); return mesh; };
  const paint = T(paintMaterial(T(fuselageLivery(s, opts.textureSize))));
  named(fuselageGeometry(f, { nu: 140, nv: 56 }), paint, 'shell');
  const glass = T(new THREE.MeshPhysicalMaterial({ color: '#0f171e', roughness: 0.05, metalness: 0.25, clearcoat: 1, envMapIntensity: 1.8 }));
  // para-brisa envolvente + janelas laterais (patches sobre a casca)
  const patch = (d0: number, d1: number, t0: number, t1: number) => {
    const pos: number[] = [];
    const n = 12;
    const pt = (u: number, v: number) => f.point(d0 + (d1 - d0) * u, t0 + (t1 - t0) * v, -0.008);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const a = pt(i / n, j / n), b = pt((i + 1) / n, j / n), c = pt(i / n, (j + 1) / n), e = pt((i + 1) / n, (j + 1) / n);
      pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, b.x, b.y, b.z, c.x, c.y, c.z, e.x, e.y, e.z);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
  };
  named(mergeGeometries([patch(0.35, 2.1, 0.15, 2.99), patch(2.6, 3.7, 0.05, 0.75), patch(2.6, 3.7, Math.PI - 0.75, Math.PI - 0.05)])!, glass, 'windshield');
  // carenagem do motor (corcova) e mastro
  const cowl = new THREE.SphereGeometry(1, 40, 20); cowl.scale(1.9, 0.55, 0.78);
  const cowlM = named(cowl, paint, 'cowling'); cowlM.position.set(f.x(4.3), s.R * 0.92, 0);
  const metal = T(new THREE.MeshStandardMaterial({ color: '#9aa1a8', roughness: 0.3, metalness: 1 }));
  const dark = T(new THREE.MeshStandardMaterial({ color: '#23282e', roughness: 0.45, metalness: 0.7 }));
  const mast = named(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 20), metal, 'mast'); mast.position.set(f.x(3.9), s.R + 0.62, 0);
  // rotor principal (5 pás) + disco de borrão de movimento
  const rotor = new THREE.Group(); rotor.name = 'rotor-main'; rotor.position.set(f.x(3.9), s.R + 1.05, 0); group.add(rotor);
  named(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 24), metal, 'hub', rotor);
  const blades: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 5; b++) { const g = new THREE.BoxGeometry(5.9, 0.035, 0.34); g.translate(3.2, 0, 0); g.rotateY((b / 5) * Math.PI * 2); blades.push(g); }
  named(mergeGeometries(blades)!, dark, 'blades', rotor); blades.forEach((g) => g.dispose());
  const discMat = T(new THREE.MeshBasicMaterial({ color: '#3a4048', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const disc = new THREE.Mesh(T(new THREE.RingGeometry(0.4, 6.1, 64)), discMat); disc.rotation.x = -Math.PI / 2; disc.name = 'blur'; rotor.add(disc);
  // deriva + estabilizador
  const foil = naca(0, 0.3, 0.12, 14);
  const fin: Station[] = [0, 1].map((t) => ({ le: new THREE.Vector3(f.x(s.L - 1.4) - t * 0.9, f.profile(s.L - 1.2).top - 0.2 + t * 1.5, 0), chord: 1.3 - t * 0.5, up: new THREE.Vector3(0, 0, 1) }));
  named(loft(fin, foil, true), paint, 'tail-fin');
  const hs: Station[] = [-1, 0, 1].map((u) => ({ le: new THREE.Vector3(f.x(s.L - 2.6), f.profile(s.L - 2.6).top - 0.1, u * 1.3), chord: 0.7, up: new THREE.Vector3(0, 1, 0) }));
  named(loft(hs, foil, true, true), paint, 'tail-stab');
  // rotor de cauda
  const tr = new THREE.Group(); tr.name = 'tail-rotor'; tr.position.set(f.x(s.L - 1.0), f.profile(s.L - 1.0).top + 0.75, 0.28); group.add(tr);
  const tb: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 4; b++) { const g = new THREE.BoxGeometry(0.16, 0.95, 0.03); g.translate(0, 0.5, 0); g.rotateZ((b / 4) * Math.PI * 2); tb.push(g); }
  named(mergeGeometries(tb)!, dark, 'tail-blades', tr); tb.forEach((g) => g.dispose());
  // esquis
  const skids = new THREE.Group(); skids.name = 'skids'; group.add(skids);
  const y0 = -s.R - 0.75;
  for (const z of [-0.95, 0.95]) {
    const tube = new THREE.CylinderGeometry(0.06, 0.06, 4.6, 12); tube.rotateZ(Math.PI / 2);
    named(tube, metal, 'skid', skids).position.set(f.x(3.4), y0, z);
    const tip = new THREE.TorusGeometry(0.3, 0.06, 10, 16, Math.PI / 2); tip.rotateX(Math.PI / 2);
    const tm = named(tip, metal, 'skid-tip', skids); tm.position.set(f.x(3.4) + 2.3, y0 + 0.3, z); tm.rotation.y = Math.PI / 2; tm.rotation.z = -Math.PI / 2;
    for (const dx of [-1.1, 1.1]) { const st = new THREE.CylinderGeometry(0.05, 0.05, 0.85, 10); const sm = named(st, metal, 'strut', skids); sm.position.set(f.x(3.4) + dx, y0 + 0.4, z * 0.85); sm.rotation.x = z > 0 ? 0.35 : -0.35; }
  }
  return {
    group, length: s.L,
    fans: [{ obj: rotor, axis: 'y', disc }, { obj: tr, axis: 'z' }],
    dispose: () => D.forEach((d) => d.dispose()),
  };
}
