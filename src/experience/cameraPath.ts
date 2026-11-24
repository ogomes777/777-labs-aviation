import * as THREE from 'three';
import type { JetBuild } from '@/three/jet/buildJet';
import { GALLERY } from '@/content/site';
import { floorY, groundY } from '@/three/jet/spec';

export interface Key { t: number; eye: [number, number, number]; target: [number, number, number]; fov: number }
export interface Track { t0: number; t1: number; keys: Key[]; eye: THREE.CatmullRomCurve3; target: THREE.CatmullRomCurve3 }

/** Centro do globo no mundo (longe do jato para nunca intersectar). */
export const GLOBE_CENTER = new THREE.Vector3(0, 0, -2400);

const v = (a: [number, number, number]) => new THREE.Vector3(...a);
const arr = (p: THREE.Vector3): [number, number, number] => [p.x, p.y, p.z];

function track(keys: Key[]): Track {
  return {
    t0: keys[0].t, t1: keys[keys.length - 1].t, keys,
    eye: new THREE.CatmullRomCurve3(keys.map((k) => v(k.eye)), false, 'centripetal'),
    target: new THREE.CatmullRomCurve3(keys.map((k) => v(k.target)), false, 'centripetal'),
  };
}

/**
 * Constrói as trilhas de câmera a partir da geometria real (janela-portal, spots da cabine).
 * `aspect` adapta enquadramentos: retrato recua a câmera e gira a planta na anatomia.
 */
export function buildTracks(jet: JetBuild, aspect: number): Track[] {
  const s = jet.spec;
  const portrait = aspect < 0.9;
  const k = Math.min(2.1, Math.max(1, Math.pow(1.6 / aspect, 0.8)));
  const p = jet.portal.center;
  const n = jet.portal.normal;
  const out = (dist: number, dy = 0): [number, number, number] => [p.x + n.x * dist, p.y + n.y * dist + dy, p.z + n.z * dist];
  const gy = groundY(s);
  const yf = floorY(s);
  const sp = jet.cabin.spots;
  const L = s.L;
  const heroX = portrait ? -2 : -6;
  const hx = portrait ? 0 : 5.2; // hangar: desloca o jato para a direita da tela (câmera em −z → +x é esquerda)
  const hy = portrait ? -4.5 : 0;

  // 3/4 frontal: direção a 36° do eixo do nariz; alvo deslocado para a esquerda da tela → jato no terço direito
  const heroDir = new THREE.Vector3(Math.cos(0.5), 0.07, Math.sin(0.5)).normalize();
  const heroDist = L * 1.32 * k;
  const heroEye = heroDir.clone().multiplyScalar(heroDist);
  const fwd = heroEye.clone().negate().normalize();
  const left = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd).normalize();
  const heroTarget = left.clone().multiplyScalar(portrait ? -heroDist * 0.02 : heroDist * 0.17).add(new THREE.Vector3(L * 0.05, portrait ? -2.2 : -0.9, 0));
  const midEye = new THREE.Vector3(Math.cos(1.05), 0.05, Math.sin(1.05)).multiplyScalar(L * 1.0 * Math.min(k, 1.4));
  const main: Key[] = [
    // HERO — 3/4 frontal, jato no terço direito, mar de nuvens
    { t: 0.0, eye: arr(heroEye), target: arr(heroTarget), fov: 30 },
    { t: 0.34, eye: arr(midEye), target: [heroX * 0.3, -0.3, 0], fov: 32 },
    { t: 0.66, eye: [L * 0.35, 1.0, 16 * Math.min(k, 1.4)], target: [p.x - 2, 0.4, 0], fov: 36 },
    { t: 0.9, eye: out(5.6, 0.1), target: arr(p), fov: 36 },
    // PORTAL — a janela ocupa o quadro, atravessa, a cabine quente toma o lugar do céu
    { t: 1.0, eye: out(2.4, 0.04), target: arr(p), fov: 38 },
    { t: 1.22, eye: out(0.42, 0.0), target: [p.x, p.y - 0.02, 0], fov: 42 },
    { t: 1.38, eye: [p.x, p.y + 0.02, p.z - 0.5], target: [p.x - 3.5, yf + 0.8, -0.3], fov: 50 },
    { t: 1.56, eye: [p.x + 0.3, yf + 1.2, 0.1], target: [p.x - 6, yf + 0.7, -0.4], fov: 52 },
    { t: 1.74, eye: [p.x + 0.2, yf + 1.35, -(s.R + 0.3)], target: [p.x - 1.5, yf + 1.0, 0], fov: 46 },
    // HANGAR — perfil lateral (nariz à esquerda), arco até 3/4 frontal
    { t: 2.0, eye: [1.5 + hx, 0.4, -44 * k], target: [hx, -0.5 + hy, 0], fov: 30 },
    { t: 2.3, eye: [-1 + hx, 0.7, -47 * k], target: [hx, -0.4 + hy, 0], fov: 30 },
    { t: 2.65, eye: [20 * Math.min(k, 1.3), 1.4, -31 * k], target: [1.5 + hx * 0.8, -0.3 + hy, 0], fov: 31 },
    { t: 2.95, eye: [24 * Math.min(k, 1.3), -0.6, -21 * k], target: [2.5 + hx * 0.6, -0.4 + hy, 0], fov: 32 },
    // ANATOMIA — sobe para vista de planta (quase ortográfica)
    { t: 3.25, eye: [10, 26, -24 * k], target: [0, -1, 0], fov: 30 },
    { t: 3.55, eye: portrait ? [-15, 82, 0] : [-5.5, 60 * Math.max(1, k * 0.9), -6], target: portrait ? [-8, gy + 1, 0] : [-5.5, gy + 1, 0], fov: portrait ? 34 : 30 },
    { t: 3.95, eye: portrait ? [-15.5, 84, 0] : [-5.8, 62 * Math.max(1, k * 0.9), -6.5], target: portrait ? [-8, gy + 1, 0] : [-5.8, gy + 1, 0], fov: portrait ? 34 : 30 },
    // INTERIOR — corte do teto, mergulho oblíquo e entrada no corredor
    { t: 4.25, eye: portrait ? [-11, 44, 0.2] : [8.5, 37, -5], target: portrait ? [-7, yf, 0] : [8.5, yf, 0], fov: 30 },
    { t: 4.52, eye: [sp.lounge.target.x - 9, 7.5, -3.5], target: [sp.lounge.target.x - 2, yf + 0.3, 0], fov: 38 },
    { t: 4.76, eye: [sp.lounge.eye.x - 1.4, yf + 1.6, 0.15], target: [sp.lounge.target.x, yf + 0.8, -0.05], fov: 48 },
  ];
  // GALERIA — 4 microcenas com permanência (cada card segura o quadro)
  GALLERY.forEach((g, i) => {
    const sp_ = sp[g.id];
    const t = 5 + i / 3;
    if (i === 0) main.push({ t: 4.9, eye: arr(sp_.eye.clone().add(new THREE.Vector3(-0.2, 0.05, 0))), target: arr(sp_.target), fov: sp_.fov });
    main.push({ t: t + (i === 0 ? 0.03 : -0.04), eye: arr(sp_.eye), target: arr(sp_.target), fov: sp_.fov });
    if (i < 3) main.push({ t: t + 0.12, eye: arr(sp_.eye.clone().add(new THREE.Vector3(i === 2 ? 0.25 : -0.25, 0, 0))), target: arr(sp_.target), fov: sp_.fov });
  });
  // DESTINOS — empurra contra o vidro da janela (véu pérola), corte mascarado para o globo
  const wj = sp.janela;
  const dir = wj.target.clone().sub(wj.eye).normalize();
  main.push({ t: 6.16, eye: arr(wj.eye.clone().addScaledVector(dir, 0.55)), target: arr(wj.target), fov: 42 });
  main.push({ t: 6.3, eye: arr(wj.eye.clone().addScaledVector(dir, 0.92)), target: arr(wj.target.clone().addScaledVector(dir, 2)), fov: 40 });

  const G = GLOBE_CENTER;
  const gx = portrait ? 0 : -2.0;
  const gyOff = portrait ? -1.6 : 0;
  const globe: Key[] = [
    { t: 6.3, eye: [G.x + 0.4, G.y + 0.6, G.z + 3.4], target: [G.x + gx * 0.4, G.y, G.z], fov: 40 },
    { t: 6.55, eye: [G.x, G.y + 1.4, G.z + 10 * Math.min(k, 1.5)], target: [G.x + gx, G.y + gyOff, G.z], fov: 34 },
    { t: 7.0, eye: [G.x, G.y + 1.2, G.z + 10.4 * Math.min(k, 1.5)], target: [G.x + gx, G.y + gyOff, G.z], fov: 34 },
  ];
  const epilogue: Key[] = [
    { t: 7.0, eye: [0, 26, 150], target: [0, 18, 0], fov: 32 },
    { t: 8.0, eye: [-6, 25, 146], target: [4, 17, 0], fov: 32 },
  ];
  return [track(main), track(globe), track(epilogue)];
}

const tmpA = new THREE.Vector3();

/** Amostra a trilha ativa em t. Retorna eye/target/fov. */
export function sampleTracks(tracks: Track[], t: number, eye: THREE.Vector3, target: THREE.Vector3): number {
  let tr = tracks[0];
  if (t >= tracks[2].t0) tr = tracks[2];
  else if (t >= tracks[1].t0) tr = tracks[1];
  const keys = tr.keys;
  const tc = Math.min(tr.t1, Math.max(tr.t0, t));
  let i = 0;
  while (i < keys.length - 2 && tc > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1];
  const f = b.t === a.t ? 0 : (tc - a.t) / (b.t - a.t);
  const fe = f * f * (3 - 2 * f) * 0.35 + f * 0.65; // ease segmentado suave
  const u = (i + fe) / (keys.length - 1);
  tr.eye.getPoint(u, eye);
  tr.target.getPoint(u, target);
  void tmpA;
  return a.fov + (b.fov - a.fov) * fe;
}
