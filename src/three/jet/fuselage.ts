import * as THREE from 'three';
import type { JetSpec } from './spec';

const TAU = Math.PI * 2;
const sm = (t: number) => t * t * (3 - 2 * t);

/** Forma paramétrica da fuselagem: P(d, θ) com d = distância do nariz, θ ao redor do eixo (0 = +z, π/2 = topo). */
export class Fuselage {
  constructor(public s: JetSpec) {}

  profile(d: number) {
    const { L, R, Ln, Lt } = this.s;
    let top: number, bot: number, w: number;
    const tipY = -0.3 * R;
    if (d < Ln) {
      const k = Math.max(0, d / Ln);
      const e = 1 - (1 - k) * (1 - k);
      top = tipY + (R - tipY) * Math.pow(e, 0.56);
      bot = tipY - (R + tipY) * Math.pow(e, 0.66);
      w = R * Math.pow(1 - Math.pow(1 - k, 2.15), 0.54);
    } else if (d > L - Lt) {
      const k = Math.min(1, (d - (L - Lt)) / Lt);
      top = R - 0.33 * R * Math.pow(k, 1.7);
      bot = -R + 1.5 * R * Math.pow(k, 1.32);
      w = R * (1 - 0.92 * Math.pow(k, 1.22));
    } else {
      top = R; bot = -R; w = R;
    }
    // arredondamento final da cauda
    const e0 = L - 0.32;
    if (d > e0) {
      const q = Math.min(1, (d - e0) / 0.32);
      const f = Math.sqrt(Math.max(0, 1 - q * q));
      const cy = (top + bot) / 2;
      top = cy + (top - cy) * f;
      bot = cy + (bot - cy) * f;
      w *= f;
    }
    return { top, bot, w };
  }

  x(d: number) { return this.s.L / 2 - d; }

  point(d: number, th: number, inset = 0, out = new THREE.Vector3()) {
    const p = this.profile(d);
    const top = p.top - inset, bot = p.bot + inset, w = Math.max(0, p.w - inset);
    const cy = (top + bot) / 2, ry = Math.max(0, (top - bot) / 2);
    return out.set(this.x(d), cy + ry * Math.sin(th), w * Math.cos(th));
  }

  normal(d: number, th: number, inset = 0, out = new THREE.Vector3()) {
    const e = 0.004;
    const dd = Math.min(Math.max(d, 0.03), this.s.L - 0.03);
    const a = this.point(dd, th + e, inset), b = this.point(dd, th - e, inset);
    const c = this.point(dd + e * 4, th, inset), f = this.point(dd - e * 4, th, inset);
    const pt = a.sub(b), pd = c.sub(f);
    return out.crossVectors(pt, pd).normalize();
  }
}

/** Distribuição de amostras ao longo do comprimento, mais densa no nariz e na cauda. */
export function stations(L: number, n: number) {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(L * (0.5 * t + 0.5 * (0.5 - 0.5 * Math.cos(Math.PI * t))));
  }
  return out;
}

/**
 * Malha de superfície da fuselagem. Atributo `fus` = (d/L, θ/2π) usado pelo shader para abrir as janelas.
 * `inset` > 0 gera o revestimento interno (lining) restrito ao intervalo [d0, d1].
 */
export function fuselageGeometry(f: Fuselage, opts: { nu: number; nv: number; inset?: number; d0?: number; d1?: number; thetaMin?: number; thetaMax?: number }) {
  const { nu, nv, inset = 0 } = opts;
  const d0 = opts.d0 ?? 0, d1 = opts.d1 ?? f.s.L;
  const t0 = opts.thetaMin ?? 0, t1 = opts.thetaMax ?? TAU;
  const ds = stations(1, nu).map((t) => d0 + (d1 - d0) * t);
  const lin = opts.inset !== undefined;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], fus: number[] = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= nu; i++) {
    const d = lin ? d0 + (d1 - d0) * (i / nu) : ds[i];
    for (let j = 0; j <= nv; j++) {
      const th = t0 + (t1 - t0) * (j / nv);
      f.point(d, th, inset, P);
      f.normal(d, th, inset, N);
      pos.push(P.x, P.y, P.z);
      nor.push(N.x, N.y, N.z);
      uv.push(d / f.s.L, th / TAU);
      fus.push(d / f.s.L, th / TAU);
    }
  }
  const idx: number[] = [];
  const row = nv + 1;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * row + j, b = a + row, c = b + 1, e = a + 1;
    idx.push(a, e, b, b, e, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('fus', new THREE.Float32BufferAttribute(fus, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Superelipse |x|^n + |y|^n = 1 parametrizada (contorno da janela). */
export function superellipse(k: number, n: number) {
  const out: [number, number][] = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * TAU;
    const c = Math.cos(a), s = Math.sin(a);
    out.push([Math.sign(c) * Math.pow(Math.abs(c), 2 / n), Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]);
  }
  return out;
}

export { sm };
