import * as THREE from 'three';

/** Perfil NACA 4 dígitos (m = arqueamento, p = posição, t = espessura). Loop: TE → extradorso → LE → intradorso → TE. */
export function naca(m: number, p: number, t: number, n = 22): [number, number][] {
  const up: [number, number][] = [], lo: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    let yc = 0, dy = 0;
    if (m > 0) {
      if (x < p) { yc = (m / (p * p)) * (2 * p * x - x * x); dy = ((2 * m) / (p * p)) * (p - x); }
      else { yc = (m / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * x - x * x); dy = ((2 * m) / ((1 - p) ** 2)) * (p - x); }
    }
    const th = Math.atan(dy);
    up.push([x - yt * Math.sin(th), yc + yt * Math.cos(th)]);
    lo.push([x + yt * Math.sin(th), yc - yt * Math.cos(th)]);
  }
  return [...up.reverse(), ...lo.slice(1)];
}

export interface Station { le: THREE.Vector3; chord: number; up: THREE.Vector3; back?: THREE.Vector3 }

/** Loft de seções de aerofólio. Fecha a ponta com leque. UV: u = estação, v = loop. */
export function loft(stations: Station[], foil: [number, number][], capEnd = true, capStart = false) {
  const pos: number[] = [], uv: number[] = [];
  const idx: number[] = [];
  const m = foil.length;
  const tmp = new THREE.Vector3();
  stations.forEach((s, i) => {
    const back = s.back ?? new THREE.Vector3(-1, 0, 0);
    foil.forEach(([x, y], j) => {
      tmp.copy(s.le).addScaledVector(back, x * s.chord).addScaledVector(s.up, y * s.chord);
      pos.push(tmp.x, tmp.y, tmp.z);
      uv.push(i / (stations.length - 1), j / (m - 1));
    });
  });
  for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < m - 1; j++) {
    const a = i * m + j, b = (i + 1) * m + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const cap = (si: number, flip: boolean) => {
    const s = stations[si];
    const back = s.back ?? new THREE.Vector3(-1, 0, 0);
    const c = s.le.clone().addScaledVector(back, 0.4 * s.chord);
    const ci = pos.length / 3;
    pos.push(c.x, c.y, c.z); uv.push(si / (stations.length - 1), 0.5);
    for (let j = 0; j < m - 1; j++) {
      const a = si * m + j;
      if (flip) idx.push(ci, a + 1, a); else idx.push(ci, a, a + 1);
    }
  };
  if (capEnd) cap(stations.length - 1, false);
  if (capStart) cap(0, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
