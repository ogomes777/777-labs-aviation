import * as THREE from 'three';
import { CLOUD_SHADOW, LIT, NOISE, SKY, WATER } from './glsl';
import type { SharedU } from './ocean';
import type { Spray } from './spray';
import { rng, seabedDepth, shoreInfo, type WorldCfg } from './env';

/**
 * Vida do test drive (instanciada, animada no vertex shader, ~8 draw calls):
 * cardumes de peixes (sardinha, olho-de-boi, atum, peixes de recife), tubarões, tartarugas que sobem para respirar,
 * golfinhos em grupo saltando (com respingos), rochas, corais e algas no fundo raso, e aves no céu —
 * gaivotas planando no litoral, revoadas de estorninhos, formações em V e fragatas.
 * Tudo nasce em volta da câmera (o mundo nunca é o mesmo) e só onde faz sentido (água funda o bastante, litoral, etc.).
 */
export type SfxKind = 'gull' | 'starling' | 'goose' | 'frigate' | 'dolphin' | 'click' | 'splash' | 'fishjump' | 'breath' | 'fin' | 'impact';
export type SfxFn = (kind: SfxKind, x: number, y: number, z: number, power: number) => void;

// ---------------- geometria procedural ----------------
interface Piece { pos: number[]; bend: number[]; part: number[]; idx: number[] }
const newPiece = (): Piece => ({ pos: [], bend: [], part: [], idx: [] });
/** corpo por seções (x da cabeça para a cauda; ry meia-altura, rz meia-largura) */
function lathe(P: Piece, st: [number, number, number][], seg: number, part: number, x0: number, len: number, yScaleBelow = 1) {
  const base = P.pos.length / 3;
  for (const [x, ry, rz] of st) for (let j = 0; j < seg; j++) {
    const a = (j / seg) * Math.PI * 2;
    let y = Math.sin(a) * ry; if (y < 0) y *= yScaleBelow;
    P.pos.push(x, y, Math.cos(a) * rz); P.bend.push(Math.min(1, Math.max(0, (x0 - x) / len))); P.part.push(part);
  }
  for (let i = 0; i < st.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = base + i * seg + j, b = base + i * seg + ((j + 1) % seg), c = a + seg, d = b + seg;
    P.idx.push(a, c, b, b, c, d);
  }
}
function tri(P: Piece, pts: [number, number, number][], part: number, x0: number, len: number, bendFn?: (p: [number, number, number]) => number) {
  const base = P.pos.length / 3;
  for (const p of pts) { P.pos.push(...p); P.bend.push(bendFn ? bendFn(p) : Math.min(1, Math.max(0, (x0 - p[0]) / len))); P.part.push(part); }
  for (let k = 1; k < pts.length - 1; k++) P.idx.push(base, base + k, base + k + 1);
}
function toGeo(P: Piece) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3));
  g.setAttribute('aBend', new THREE.Float32BufferAttribute(P.bend, 1));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(P.part, 1));
  g.setIndex(P.idx); g.computeVertexNormals();
  return g;
}
function fishGeo() {
  const P = newPiece();
  lathe(P, [[0.5, 0.001, 0.001], [0.42, 0.07, 0.038], [0.25, 0.13, 0.062], [0.05, 0.14, 0.062], [-0.15, 0.1, 0.044], [-0.32, 0.045, 0.02], [-0.4, 0.018, 0.008]], 7, 0, 0.5, 1.05);
  tri(P, [[-0.38, 0, 0], [-0.55, 0.15, 0], [-0.49, 0, 0]], 1, 0.5, 1.05); tri(P, [[-0.38, 0, 0], [-0.49, 0, 0], [-0.55, -0.15, 0]], 1, 0.5, 1.05);
  tri(P, [[0.12, 0.125, 0], [-0.12, 0.11, 0], [-0.02, 0.21, 0]], 4, 0.5, 1.05);
  return toGeo(P);
}
function sharkGeo() {
  const P = newPiece();
  lathe(P, [[0.5, 0.001, 0.001], [0.44, 0.035, 0.04], [0.3, 0.075, 0.085], [0.1, 0.09, 0.095], [-0.1, 0.075, 0.075], [-0.28, 0.04, 0.04], [-0.4, 0.02, 0.018], [-0.44, 0.012, 0.01]], 9, 0, 0.5, 1.0, 0.8);
  tri(P, [[0.12, 0.08, 0], [-0.03, 0.075, 0], [0.0, 0.25, 0]], 4, 0.5, 1.0);
  for (const s of [-1, 1]) tri(P, [[0.18, -0.04, 0.07 * s], [0.07, -0.045, 0.08 * s], [0.0, -0.1, 0.3 * s]], 4, 0.5, 1.0);
  tri(P, [[-0.42, 0.01, 0], [-0.6, 0.21, 0], [-0.5, 0.0, 0]], 1, 0.5, 1.0); tri(P, [[-0.42, -0.005, 0], [-0.49, 0, 0], [-0.54, -0.12, 0]], 1, 0.5, 1.0);
  return toGeo(P);
}
function dolphinGeo() {
  const P = newPiece();
  lathe(P, [[0.5, 0.001, 0.001], [0.45, 0.024, 0.024], [0.39, 0.038, 0.038], [0.34, 0.085, 0.075], [0.2, 0.11, 0.1], [0.0, 0.115, 0.104], [-0.2, 0.085, 0.074], [-0.33, 0.04, 0.035], [-0.42, 0.017, 0.014]], 9, 0, 0.5, 0.95, 0.85);
  tri(P, [[0.06, 0.1, 0], [-0.1, 0.095, 0], [-0.08, 0.25, 0]], 4, 0.5, 0.95);
  for (const s of [-1, 1]) {
    tri(P, [[-0.4, 0, 0], [-0.49, 0, 0.0001 * s], [-0.53, 0, 0.15 * s]], 1, 0.5, 0.95);
    tri(P, [[0.2, -0.05, 0.08 * s], [0.12, -0.05, 0.09 * s], [0.07, -0.09, 0.21 * s]], 4, 0.5, 0.95);
  }
  return toGeo(P);
}
function turtleGeo() {
  const P = newPiece();
  lathe(P, [[0.44, 0.001, 0.001], [0.36, 0.08, 0.22], [0.15, 0.12, 0.34], [-0.1, 0.11, 0.32], [-0.3, 0.07, 0.22], [-0.44, 0.001, 0.001]], 12, 0, 0.44, 0.9, 0.4);
  lathe(P, [[0.66, 0.001, 0.001], [0.6, 0.04, 0.045], [0.52, 0.05, 0.055], [0.4, 0.04, 0.05]], 7, 0, 0.44, 0.9);
  for (const s of [-1, 1]) {
    const pf = s < 0 ? 2 : 3, pr = s < 0 ? 4 : 5;
    tri(P, [[0.27, 0, 0.26 * s], [0.12, 0, 0.3 * s], [-0.08, 0, 0.78 * s], [0.06, 0, 0.74 * s]], pf, 0.44, 0.9, (p) => Math.abs(p[2]));
    tri(P, [[-0.26, 0, 0.18 * s], [-0.36, 0, 0.18 * s], [-0.46, 0, 0.36 * s]], pr, 0.44, 0.9, (p) => Math.abs(p[2]));
  }
  return toGeo(P);
}
function birdGeo() {
  const P = newPiece();
  lathe(P, [[0.5, 0.001, 0.001], [0.42, 0.04, 0.035], [0.3, 0.09, 0.09], [0.1, 0.11, 0.11], [-0.15, 0.08, 0.08], [-0.38, 0.03, 0.04], [-0.5, 0.001, 0.001]], 6, 0, 0.5, 1);
  tri(P, [[-0.35, 0, -0.08], [-0.6, 0, -0.13], [-0.6, 0, 0.13], [-0.35, 0, 0.08]], 1, 0.5, 1);
  for (const s of [-1, 1]) {
    const part = s < 0 ? 2 : 3, b = (p: [number, number, number]) => Math.abs(p[2]) / 1.35;
    tri(P, [[0.15, 0.02, 0.08 * s], [-0.12, 0.02, 0.08 * s], [-0.14, 0.02, 0.7 * s], [0.12, 0.03, 0.7 * s]], part, 0.5, 1, b);
    tri(P, [[0.12, 0.03, 0.7 * s], [-0.14, 0.02, 0.7 * s], [-0.33, 0.0, 1.35 * s], [-0.12, 0.0, 1.3 * s]], part, 0.5, 1, b);
  }
  return toGeo(P);
}
function rockGeo() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.72 + 0.28 * Math.sin(x * 3.1 + 1.7) * Math.cos(z * 2.7 - 0.4) + 0.14 * Math.sin(y * 7.3 + x * 4.1) + 0.06 * Math.sin(z * 13.0 + y * 9.0);
    p.setXYZ(i, x * k, y * k * 0.62, z * k);
  }
  const ng = g; // a icosfera já vem sem índice: cada face com normal própria (facetada como pedra)
  ng.computeVertexNormals();
  const n = ng.getAttribute('position').count;
  ng.setAttribute('aBend', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  ng.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  return ng;
}
function weedGeo() {
  const P = newPiece();
  const r = rng(77);
  for (let b = 0; b < 6; b++) {
    const a = r() * Math.PI * 2, lean = 0.12 + r() * 0.2, h = 0.6 + r() * 0.45, w = 0.05 + r() * 0.03;
    const ox = (r() - 0.5) * 0.25, oz = (r() - 0.5) * 0.25, base = P.pos.length / 3, segs = 6;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs, y = t * h, wk = w * (1 - t * 0.7);
      const cx = ox + Math.cos(a) * lean * t * t, cz = oz + Math.sin(a) * lean * t * t;
      P.pos.push(cx - Math.sin(a) * wk, y, cz + Math.cos(a) * wk, cx + Math.sin(a) * wk, y, cz - Math.cos(a) * wk);
      P.bend.push(t, t); P.part.push(0, 0);
    }
    for (let k = 0; k < segs; k++) { const i0 = base + k * 2; P.idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2); }
  }
  return toGeo(P);
}

// ---------------- material ----------------
const LIFE_VS = /* glsl */ `
  attribute vec4 aPos; attribute vec4 aRot; attribute vec4 aAnim; attribute float aBend; attribute float aPart;
  uniform float uTime;
  varying vec3 vN; varying vec3 vW; varying float vPart; varying float vBend; varying float vVar; varying vec3 vLocal;
  mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
  mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  void main(){
    vec3 p = position, n = normal;
    float ph = aAnim.x, amp = aAnim.y, fr = aAnim.z;
    #if MODE == 1
      p.z += sin(aBend * 5.0 - uTime * fr + ph) * amp * aBend * aBend;           // nado lateral (peixe/tubarão)
    #elif MODE == 2
      p.y += sin(aBend * 4.0 - uTime * fr + ph) * amp * aBend * aBend;           // nado vertical (golfinho)
    #elif MODE == 3
      if (aPart > 1.5) {                                                          // bater de asas (curva a ponta)
        float side = aPart < 2.5 ? -1.0 : 1.0;
        float th = sin(uTime * fr + ph) * amp * (1.0 + 0.7 * smoothstep(0.45, 1.0, aBend)) + 0.06;
        float zz = abs(p.z); p.y += zz * sin(th); p.z = side * zz * cos(th);
        n = vec3(n.x, n.y * cos(th), -side * n.y * sin(th));
      }
    #elif MODE == 4
      if (aPart > 1.5) {                                                          // nadadeiras da tartaruga
        float side = (aPart == 2.0 || aPart == 4.0) ? -1.0 : 1.0, front = aPart < 3.5 ? 1.0 : 0.45, hinge = aPart < 3.5 ? 0.27 : 0.18;
        float th = sin(uTime * fr + ph + (aPart > 3.5 ? 1.6 : 0.0)) * amp * front;
        float zz = abs(p.z) - hinge; p.y += zz * sin(th); p.z = side * (hinge + zz * cos(th));
        p.x += zz * 0.15 * sin(uTime * fr + ph + 1.2) * front;
      }
    #elif MODE == 5
      float h = max(p.y, 0.0);                                                    // algas balançando na correnteza
      p.x += sin(uTime * fr + ph + h * 1.3) * amp * h * h; p.z += cos(uTime * fr * 0.8 + ph * 1.7 + h) * amp * 0.6 * h * h;
    #endif
    p *= aPos.w;
    mat3 R = rotY(aRot.x) * rotZ(aRot.y) * rotX(aRot.z);
    vec3 wp = R * p + aPos.xyz;
    vN = normalize(R * n); vW = wp; vPart = aPart; vBend = aBend; vVar = aAnim.w; vLocal = position;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }`;

const LIFE_FS = /* glsl */ `
  uniform vec3 uCam; uniform float uFog, uTime, uShine, uSpec;
  uniform vec3 uBack[4]; uniform vec3 uBelly[4]; uniform vec3 uAcc[4];
  varying vec3 vN; varying vec3 vW; varying float vPart; varying float vBend; varying float vVar; varying vec3 vLocal;
  ${NOISE}
  ${SKY}
  ${WATER}
  ${CLOUD_SHADOW}
  ${LIT}
  void main(){
    vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
    int vi = int(clamp(vVar + 0.5, 0.0, 3.0));
    vec3 back = uBack[vi], belly = uBelly[vi], acc = uAcc[vi];
    vec3 alb = mix(belly, back, smoothstep(-0.3, 0.35, N.y));                      // contra-sombreamento: dorso escuro, ventre claro
    #if MODE == 3
      if (vPart > 1.5) alb = mix(acc, acc * 0.18, smoothstep(0.8, 0.9, vBend));    // asas com pontas escuras
    #elif MODE == 4
      if (vPart < 0.5 && vLocal.y > 0.02 && vLocal.x < 0.44) {                     // casco com placas
        vec2 q = vLocal.xz * vec2(11.0, 13.0); vec2 f = fract(q) - 0.5;
        alb *= 0.72 + 0.32 * smoothstep(0.5, 0.3, max(abs(f.x), abs(f.y))) + 0.1 * noise(q * 3.0);
      } else if (vPart > 1.5) alb = acc;
    #elif MODE == 0
      alb *= 0.8 + 0.35 * noise(vLocal.xz * 6.0 + vVar * 3.0) + 0.15 * noise(vLocal.xy * 17.0);
      alb = mix(alb, acc, smoothstep(0.1, 0.6, N.y) * 0.55 * step(vVar, 1.5));        // algas por cima das rochas
    #elif MODE == 5
      alb = mix(belly, back, vBend);
    #else
      if (vPart > 0.5) alb = mix(alb, acc, 0.65);                                    // barbatanas
    #endif
    vec3 V = normalize(vW - uCam);
    vec3 col = litColor(alb, N, vW, cloudShadow(vW) * 0.62);
    float below = uSeaY - vW.y;
    vec3 sl = below > 0.0 ? downLight(below) : vec3(1.0);
    col += uSunCol * pow(max(dot(reflect(V, N), uSun), 0.0), uShine) * uSpec * sl;    // escamas prateadas / pele molhada
    col = underwater(col, vW, V);
    col = mix(col, fogCol(V), aerial(length(vW - uCam), uFog));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const C3 = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
interface Pal { back: THREE.Color[]; belly: THREE.Color[]; acc: THREE.Color[] }
const pal = (rows: [number[], number[], number[]][]): Pal => ({
  back: rows.map((r) => C3(r[0][0], r[0][1], r[0][2])), belly: rows.map((r) => C3(r[1][0], r[1][1], r[1][2])), acc: rows.map((r) => C3(r[2][0], r[2][1], r[2][2])),
});

function species(U: SharedU, base: THREE.BufferGeometry, max: number, mode: number, p: Pal, shine: number, spec: number, name: string) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  for (const k of ['position', 'normal', 'aBend', 'aPart']) geo.setAttribute(k, base.getAttribute(k));
  const mk = () => new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, max) * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aPos = mk(), aRot = mk(), aAnim = mk();
  geo.setAttribute('aPos', aPos); geo.setAttribute('aRot', aRot); geo.setAttribute('aAnim', aAnim);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uBack: { value: p.back }, uBelly: { value: p.belly }, uAcc: { value: p.acc }, uShine: { value: shine }, uSpec: { value: spec } },
    defines: { MODE: mode }, vertexShader: LIFE_VS, fragmentShader: LIFE_FS, side: THREE.DoubleSide, fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.name = name; mesh.visible = false;
  const P = aPos.array as Float32Array, R = aRot.array as Float32Array, A = aAnim.array as Float32Array;
  return {
    mesh, max,
    set(i: number, x: number, y: number, z: number, scale: number, yaw: number, pitch: number, roll: number, phase: number, amp: number, freq: number, variant: number) {
      const o = i * 4;
      P[o] = x; P[o + 1] = y; P[o + 2] = z; P[o + 3] = scale;
      R[o] = yaw; R[o + 1] = pitch; R[o + 2] = roll;
      A[o] = phase; A[o + 1] = amp; A[o + 2] = freq; A[o + 3] = variant;
    },
    commit(n: number) { geo.instanceCount = n; mesh.visible = n > 0; if (n) { aPos.needsUpdate = true; aRot.needsUpdate = true; aAnim.needsUpdate = true; } },
    dispose() { geo.dispose(); base.dispose(); mat.dispose(); },
  };
}
type Species = ReturnType<typeof species>;

/** direção (dx, dz) → guinada no referencial do gerador (+x à frente) */
const yawOf = (dx: number, dz: number) => Math.atan2(-dz, dx);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

interface School { x: number; z: number; hd: number; sp: number; depth: number; bed: number; r: number; n0: number; n: number; variant: number; size: number; burst: number; check: number; jump: { i: number; t: number; x: number; z: number; hd: number } | null }
interface Swimmer { x: number; z: number; y: number; hd: number; sp: number; depth: number; check: number; t: number; size: number; variant: number; breath: number; phase: number }
interface Pod { x: number; z: number; hd: number; sp: number; check: number; m: { lat: number; back: number; ph: number; period: number; h: number; lastU: number; size: number }[] }
interface Flock { kind: 0 | 1 | 2 | 3; x: number; y: number; z: number; hd: number; sp: number; turn: number; n0: number; n: number; scatter: number; call: number; off: Float32Array; seed: number }

export function createLife(U: SharedU, cfg: WorldCfg, seaY: number, sfx: SfxFn) {
  const group = new THREE.Group(); group.name = 'flight-life';
  const fish = species(U, fishGeo(), cfg.fish, 1, pal([
    [[0.1, 0.22, 0.3], [0.86, 0.89, 0.92], [0.3, 0.42, 0.5]],      // sardinha
    [[0.22, 0.3, 0.46], [0.92, 0.86, 0.62], [0.95, 0.78, 0.2]],     // olho-de-boi (cauda amarela)
    [[0.04, 0.07, 0.17], [0.76, 0.79, 0.83], [0.2, 0.25, 0.35]],    // atum
    [[0.95, 0.52, 0.14], [0.98, 0.84, 0.55], [0.15, 0.2, 0.55]],    // peixe de recife
  ]), 40, 0.9, 'life-fish');
  const sharks = species(U, sharkGeo(), cfg.sharks, 1, pal([[[0.32, 0.37, 0.42], [0.88, 0.88, 0.86], [0.28, 0.33, 0.38]], [[0.36, 0.33, 0.28], [0.86, 0.84, 0.8], [0.3, 0.28, 0.24]], [[0.3, 0.35, 0.4], [0.88, 0.88, 0.86], [0.28, 0.33, 0.38]], [[0.3, 0.35, 0.4], [0.88, 0.88, 0.86], [0.28, 0.33, 0.38]]]), 18, 0.25, 'life-sharks');
  const dolphins = species(U, dolphinGeo(), cfg.dolphins, 2, pal([[[0.27, 0.3, 0.35], [0.8, 0.81, 0.82], [0.24, 0.27, 0.31]], [[0.33, 0.36, 0.4], [0.82, 0.82, 0.83], [0.3, 0.33, 0.37]], [[0.27, 0.3, 0.35], [0.8, 0.81, 0.82], [0.24, 0.27, 0.31]], [[0.27, 0.3, 0.35], [0.8, 0.81, 0.82], [0.24, 0.27, 0.31]]]), 60, 0.7, 'life-dolphins');
  const turtles = species(U, turtleGeo(), cfg.turtles, 4, pal([[[0.34, 0.27, 0.13], [0.78, 0.7, 0.46], [0.42, 0.38, 0.26]], [[0.28, 0.3, 0.16], [0.75, 0.7, 0.5], [0.36, 0.38, 0.27]], [[0.34, 0.27, 0.13], [0.78, 0.7, 0.46], [0.42, 0.38, 0.26]], [[0.34, 0.27, 0.13], [0.78, 0.7, 0.46], [0.42, 0.38, 0.26]]]), 30, 0.35, 'life-turtles');
  const birds = species(U, birdGeo(), cfg.birds, 3, pal([
    [[0.95, 0.95, 0.95], [0.97, 0.97, 0.97], [0.66, 0.69, 0.74]],    // gaivota
    [[0.07, 0.07, 0.08], [0.12, 0.12, 0.13], [0.06, 0.06, 0.07]],    // estorninho
    [[0.36, 0.33, 0.3], [0.82, 0.8, 0.74], [0.3, 0.28, 0.25]],       // ganso / garça em V
    [[0.05, 0.05, 0.06], [0.55, 0.55, 0.56], [0.05, 0.05, 0.06]],    // fragata
  ]), 20, 0.15, 'life-birds');
  const rocks = species(U, rockGeo(), cfg.props, 0, pal([
    [[0.34, 0.32, 0.28], [0.27, 0.26, 0.23], [0.2, 0.3, 0.13]],      // rocha com alga
    [[0.42, 0.39, 0.33], [0.33, 0.31, 0.27], [0.24, 0.32, 0.15]],
    [[0.86, 0.5, 0.52], [0.7, 0.4, 0.45], [0.86, 0.5, 0.52]],        // coral rosado
    [[0.58, 0.42, 0.68], [0.85, 0.62, 0.3], [0.58, 0.42, 0.68]],     // coral violeta/âmbar
  ]), 10, 0.05, 'life-rocks');
  const weeds = species(U, weedGeo(), Math.round(cfg.props * 0.6), 5, pal([[[0.42, 0.5, 0.12], [0.1, 0.22, 0.07], [0.2, 0.3, 0.1]], [[0.55, 0.42, 0.12], [0.18, 0.2, 0.06], [0.3, 0.3, 0.1]], [[0.42, 0.5, 0.12], [0.1, 0.22, 0.07], [0.2, 0.3, 0.1]], [[0.42, 0.5, 0.12], [0.1, 0.22, 0.07], [0.2, 0.3, 0.1]]]), 8, 0.05, 'life-weeds');
  const all: Species[] = [fish, sharks, dolphins, turtles, birds, rocks, weeds];
  all.forEach((s) => group.add(s.mesh));

  let R = rng(1);
  const schools: School[] = [], sharkL: Swimmer[] = [], turtleL: Swimmer[] = [], pods: Pod[] = [], flocks: Flock[] = [];
  const fishSeed = new Float32Array(cfg.fish * 4); // ângulo, raio, altura, fase
  const birdSeed = new Float32Array(cfg.birds * 4);
  const camF = new THREE.Vector2(1, 0);
  let spray: Spray | null = null;

  /** ponto na água à frente da câmera, com fundo entre [dMin, dMax] metros */
  let spawnBudget = 0; // renascimentos por quadro (o trabalho de achar água se espalha no tempo: sem picos)
  const findWater = (cx: number, cz: number, rMin: number, rMax: number, dMin: number, dMax = 1e9, tries = 10) => {
    if (spawnBudget <= 0) return null;
    spawnBudget--;
    for (let k = 0; k < tries; k++) {
      const a = Math.atan2(camF.y, camF.x) + (R() - 0.5) * 2.2, r = rMin + R() * (rMax - rMin);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const s = shoreInfo(x, z);
      if (s.shore <= 8) continue;
      const d = seabedDepth(s.shore, s.island);
      if (d >= dMin && d <= dMax) return { x, z, bed: d, island: s.island, shore: s.shore };
    }
    return null;
  };
  const bedAt = (x: number, z: number) => { const s = shoreInfo(x, z); return s.shore <= 4 ? 0 : seabedDepth(s.shore, s.island); };

  const reset = (seed: number) => {
    R = rng(seed ^ 0x51ed27);
    schools.length = 0; sharkL.length = 0; turtleL.length = 0; pods.length = 0; flocks.length = 0;
    // cardumes: grupos de tamanhos variados (muitas sardinhas, poucos atuns)
    let i = 0;
    while (i < cfg.fish) {
      const variant = schools.length % 4 === 2 ? 2 : schools.length % 4 === 3 ? 3 : schools.length % 2;
      const n = Math.min(cfg.fish - i, variant === 2 ? 14 + Math.floor(R() * 10) : variant === 3 ? 18 + Math.floor(R() * 14) : 70 + Math.floor(R() * 90));
      schools.push({ x: 1e9, z: 1e9, hd: R() * 6.28, sp: 0.6 + R() * 0.9, depth: 2, bed: 10, r: variant === 2 ? 9 : 4 + R() * 7, n0: i, n, variant, size: variant === 2 ? 0.9 + R() * 0.5 : variant === 3 ? 0.25 + R() * 0.12 : 0.2 + R() * 0.12, burst: 0, check: 0, jump: null });
      for (let k = i; k < i + n; k++) { fishSeed[k * 4] = R() * 6.28; fishSeed[k * 4 + 1] = Math.sqrt(R()); fishSeed[k * 4 + 2] = R() - 0.5; fishSeed[k * 4 + 3] = R() * 6.28; }
      i += n;
    }
    for (let k = 0; k < cfg.sharks; k++) sharkL.push({ x: 1e9, z: 1e9, y: 0, hd: R() * 6.28, sp: 1.1 + R() * 0.6, depth: 3, check: 0, t: 0, size: 2.4 + R() * 1.5, variant: k % 2, breath: 0, phase: R() * 6.28 });
    for (let k = 0; k < cfg.turtles; k++) turtleL.push({ x: 1e9, z: 1e9, y: 0, hd: R() * 6.28, sp: 0.45 + R() * 0.3, depth: 1.8, check: 0, t: 0, size: 0.8 + R() * 0.35, variant: k % 2, breath: 8 + R() * 20, phase: R() * 6.28 });
    let d = 0;
    while (d < cfg.dolphins) {
      const n = Math.min(cfg.dolphins - d, 3 + Math.floor(R() * 3));
      pods.push({ x: 1e9, z: 1e9, hd: R() * 6.28, sp: 6 + R() * 3, check: 0, m: Array.from({ length: n }, (_, k) => ({ lat: (k - (n - 1) / 2) * (2.4 + R() * 1.5), back: R() * 6, ph: R() * 5, period: 3.6 + R() * 2.8, h: 0.9 + R() * 1.6, lastU: 0, size: 2.1 + R() * 0.5 })) });
      d += n;
    }
    // aves: gaivotas (bandos soltos), estorninhos (revoada), formações em V e fragatas solitárias
    let b = 0, fk = 0;
    while (b < cfg.birds) {
      const kind = ([0, 1, 0, 2, 0, 3, 1, 0] as const)[fk++ % 8];
      const n = Math.min(cfg.birds - b, kind === 0 ? 5 + Math.floor(R() * 9) : kind === 1 ? 40 + Math.floor(R() * 60) : kind === 2 ? 7 + Math.floor(R() * 8) : 1 + Math.floor(R() * 2));
      const off = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) {
        if (kind === 2) { const side = k % 2 ? 1 : -1, j = Math.ceil(k / 2); off[k * 3] = -j * 2.4; off[k * 3 + 1] = (R() - 0.5) * 0.4; off[k * 3 + 2] = side * j * 2.0; }
        else { const sp = kind === 1 ? 18 : kind === 0 ? 14 : 30; off[k * 3] = (R() - 0.5) * sp; off[k * 3 + 1] = (R() - 0.5) * sp * 0.4; off[k * 3 + 2] = (R() - 0.5) * sp; }
      }
      for (let k = b; k < b + n; k++) { birdSeed[k * 4] = R() * 6.28; birdSeed[k * 4 + 1] = R(); birdSeed[k * 4 + 2] = R(); birdSeed[k * 4 + 3] = R(); }
      flocks.push({ kind, x: 1e9, y: 0, z: 1e9, hd: R() * 6.28, sp: kind === 0 ? 10 : kind === 1 ? 13 : kind === 2 ? 17 : 9, turn: 0, n0: b, n, scatter: 0, call: 2 + R() * 4, off, seed: R() * 100 });
      b += n;
    }
  };
  reset(1);

  // ---------- fundo: rochas, corais e algas em células em volta da câmera ----------
  const CELL = 22, PR = 330;
  const cellOffs: [number, number][] = [];
  for (let i = -15; i <= 15; i++) for (let j = -15; j <= 15; j++) if (Math.hypot(i, j) * CELL <= PR) cellOffs.push([i, j]);
  cellOffs.sort((a, b) => a[0] * a[0] + a[1] * a[1] - b[0] * b[0] - b[1] * b[1]);
  type Prop = { x: number; z: number; y: number; kind: 0 | 1; s: number; yaw: number; v: number } | null;
  const propCache = new Map<number, Prop>();
  let propAt = { x: 1e9, z: 1e9 }, propT = 0;
  const hash2 = (i: number, j: number, k: number) => { let h = Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(k, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const refreshProps = (cx: number, cz: number) => {
    const ci = Math.floor(cx / CELL), cj = Math.floor(cz / CELL);
    let nr = 0, nw = 0, fresh = 0;
    for (const [di, dj] of cellOffs) {
      const i = ci + di, j = cj + dj, key = i * 100003 + j;
      let p = propCache.get(key);
      if (p === undefined) {
        if (++fresh > 120) { propAt = { x: 1e9, z: 1e9 }; continue; } // o resto entra no próximo respiro (sem pico num quadro só)
        p = null;
        if (hash2(i, j, 1) < 0.5) {
          const x = (i + hash2(i, j, 2)) * CELL, z = (j + hash2(i, j, 3)) * CELL;
          const s = shoreInfo(x, z);
          if (s.shore > 6) {
            const d = seabedDepth(s.shore, s.island);
            if (d > 0.9 && d < 16) {
              const h = hash2(i, j, 4), reef = s.island && s.shore > 180 && s.shore < 600;
              const weed = !reef && d > 1.4 && d < 10 && h < 0.4;
              p = { x, z, y: seaY - d, kind: weed ? 1 : 0, s: weed ? 0.8 + h * 2.2 : reef ? 0.6 + hash2(i, j, 5) * 1.6 : 0.5 + hash2(i, j, 5) * 2.4, yaw: hash2(i, j, 6) * 6.28, v: weed ? (h < 0.2 ? 1 : 0) : reef ? 2 + Math.floor(hash2(i, j, 7) * 2) : Math.floor(hash2(i, j, 7) * 2) };
            }
          }
        }
        if (propCache.size > 6000) propCache.clear();
        propCache.set(key, p);
      }
      if (!p) continue;
      if (p.kind === 0 && nr < rocks.max) rocks.set(nr++, p.x, p.y + p.s * 0.15, p.z, p.s, p.yaw, 0, 0, 0, 0, 0, p.v);
      else if (p.kind === 1 && nw < weeds.max) weeds.set(nw++, p.x, p.y, p.z, p.s, p.yaw, 0, 0, p.yaw, 0.09, 0.9 + p.v * 0.3, p.v);
    }
    rocks.commit(nr); weeds.commit(nw);
  };

  const setSpray = (s: Spray) => { spray = s; };

  const update = (dt: number, t: number, cam: THREE.Vector3, camDir: THREE.Vector3, plane: THREE.Vector3, wash: number, washX: number, washZ: number) => {
    const camAlt = cam.y - seaY;
    spawnBudget = 3;
    const fl = Math.hypot(camDir.x, camDir.z); if (fl > 1e-3) camF.set(camDir.x / fl, camDir.z / fl);
    const ahead = Math.min(260, Math.max(60, camAlt * 1.2));
    const ax = cam.x + camF.x * ahead, az = cam.z + camF.y * ahead;
    const under = camAlt < 480, wildUnder = camAlt < 750;
    const dist2 = (x: number, z: number) => (x - ax) * (x - ax) + (z - az) * (z - az);

    // ---------- cardumes ----------
    let nf = 0;
    if (under) {
      for (const s of schools) {
        if (s.x > 1e8 || dist2(s.x, s.z) > 900 * 900) {
          const w = findWater(ax, az, 30, 520, 2.2);
          if (!w) continue;
          s.x = w.x; s.z = w.z; s.bed = w.bed; s.depth = Math.min(Math.max(0.7, w.bed * (0.15 + R() * 0.4)), w.bed - 0.6, 7); s.check = 0;
          if (s.variant === 3 && !w.island) s.variant = 0;
        }
        s.hd = wrap(s.hd + Math.sin(t * 0.13 + s.r) * 0.1 * dt);
        const vx = Math.cos(s.hd) * s.sp * (1 + s.burst * 3), vz = Math.sin(s.hd) * s.sp * (1 + s.burst * 3);
        s.x += vx * dt; s.z += vz * dt;
        if ((s.check -= dt) <= 0) { s.check = 1.2; const b = bedAt(s.x + vx * 12, s.z + vz * 12); if (b < 1.8) s.hd += Math.PI * 0.7; else s.bed = b; }
        // o sopro do avião espanta o cardume (abre e mergulha)
        if (wash > 0.12 && (s.x - washX) ** 2 + (s.z - washZ) ** 2 < 55 * 55) s.burst = 1;
        s.burst = Math.max(0, s.burst - dt * 0.35);
        const depth = Math.min(s.depth + s.burst * 2.5, s.bed - 0.4);
        const rr = s.r * (1 + s.burst * 1.6), ch = Math.cos(s.hd), sh = Math.sin(s.hd);
        // peixe saltando fora d'água de vez em quando (com respingo)
        if (!s.jump && depth < 2.5 && R() < dt * 0.07) { const k = s.n0 + Math.floor(R() * s.n); s.jump = { i: k, t: 0, x: 0, z: 0, hd: s.hd + (R() - 0.5) }; }
        for (let k = s.n0; k < s.n0 + s.n; k++) {
          const a0 = fishSeed[k * 4], rk = fishSeed[k * 4 + 1], yk = fishSeed[k * 4 + 2], phk = fishSeed[k * 4 + 3];
          const w = (0.35 + rk * 0.25) * (s.variant === 2 ? 0.6 : 1) * (1 + s.burst * 2.5);
          const a = a0 + t * w * (k % 3 === 0 ? -1 : 1);
          const lx = Math.cos(a) * rr * rk * 1.25, lz = Math.sin(a) * rr * rk * 0.7;
          const ly = yk * rr * 0.35 + Math.sin(t * 0.8 + phk) * 0.25;
          let x = s.x + lx * ch - lz * sh, z = s.z + lx * sh + lz * ch, y = seaY - depth + ly;
          // direção: órbita + deslocamento do cardume
          const ovx = -Math.sin(a) * rr * rk * 1.25 * w * (k % 3 === 0 ? -1 : 1), ovz = Math.cos(a) * rr * rk * 0.7 * w * (k % 3 === 0 ? -1 : 1);
          const dx = vx + ovx * ch - ovz * sh, dz = vz + ovx * sh + ovz * ch;
          let yaw = yawOf(dx, dz), pitch = Math.cos(t * 0.8 + phk) * 0.12;
          const sz = s.size * (0.8 + rk * 0.4);
          if (s.jump && s.jump.i === k) {
            const J = s.jump;
            if (J.t === 0) { J.x = x; J.z = z; }
            J.t += dt; const u = J.t / 0.75;
            if (u >= 1) { s.jump = null; spray?.splash(J.x + Math.cos(J.hd) * 2.4, seaY, J.z + Math.sin(J.hd) * 2.4, 0.35); sfx('fishjump', J.x, seaY, J.z, 0.4); }
            else {
              if (J.t - dt <= 0) { spray?.splash(J.x, seaY, J.z, 0.3); sfx('fishjump', J.x, seaY, J.z, 0.3); }
              x = J.x + Math.cos(J.hd) * 2.4 * u; z = J.z + Math.sin(J.hd) * 2.4 * u; y = seaY - 0.2 + 4 * 0.9 * u * (1 - u);
              yaw = yawOf(Math.cos(J.hd), Math.sin(J.hd)); pitch = Math.atan2(3.6 * (1 - 2 * u), 3.2);
            }
          }
          fish.set(nf++, x, y, z, sz, yaw, pitch, 0, phk, 0.09, 9 + s.burst * 10, s.variant);
        }
      }
    }
    fish.commit(nf);

    // ---------- tubarões e tartarugas ----------
    const swim = (L: Swimmer[], sp: Species, minBed: number, turtle: boolean) => {
      let n = 0;
      if (!under) { sp.commit(0); return; }
      for (const a of L) {
        if (a.x > 1e8 || dist2(a.x, a.z) > 800 * 800) {
          const w = findWater(ax, az, 20, 420, minBed, turtle ? 14 : 1e9); if (!w) continue;
          a.x = w.x; a.z = w.z; a.depth = turtle ? 1 + R() * 1.6 : Math.min(w.bed - 1, 1.6 + R() * 3.5); a.y = seaY - a.depth;
        }
        a.t += dt;
        a.hd = wrap(a.hd + Math.sin(a.t * 0.21 + a.phase) * 0.18 * dt);
        a.x += Math.cos(a.hd) * a.sp * dt; a.z += Math.sin(a.hd) * a.sp * dt;
        if ((a.check -= dt) <= 0) { a.check = 1.5; const b = bedAt(a.x + Math.cos(a.hd) * 15, a.z + Math.sin(a.hd) * 15); if (b < minBed) a.hd += Math.PI * 0.8; }
        let depth = a.depth;
        if (turtle) {
          // sobe para respirar de tempos em tempos (e dá para ouvir o sopro)
          a.breath -= dt;
          const surf = a.breath < 0 ? Math.min(1, -a.breath / 2) * (a.breath > -7 ? 1 : Math.max(0, 1 - (-a.breath - 7) / 2)) : 0;
          if (a.breath < -9) a.breath = 15 + R() * 25;
          if (surf > 0.95 && a.breath > -5.05 && a.breath - dt <= -5.05) sfx('breath', a.x, seaY, a.z, 0.6);
          depth = a.depth * (1 - surf) + 0.12 * surf;
        } else if (Math.sin(a.t * 0.05 + a.phase) > 0.93) {
          depth = 0.25; // barbatana cortando a superfície
          if (R() < dt * 0.4) sfx('fin', a.x, seaY, a.z, 0.3);
        }
        a.y += (seaY - depth - a.y) * Math.min(1, dt * 0.6);
        sp.set(n++, a.x, a.y, a.z, a.size, yawOf(Math.cos(a.hd), Math.sin(a.hd)), 0, 0, a.phase, turtle ? 0.55 : 0.07, turtle ? 1.8 : 3.2, a.variant);
      }
      sp.commit(n);
    };
    swim(sharkL, sharks, 4, false);
    swim(turtleL, turtles, 2, true);

    // ---------- golfinhos ----------
    let nd = 0;
    if (wildUnder) {
      for (const P of pods) {
        if (P.x > 1e8 || dist2(P.x, P.z) > 1100 * 1100) {
          const w = findWater(ax, az, 80, 700, 4); if (!w) continue;
          P.x = w.x; P.z = w.z;
        }
        P.hd = wrap(P.hd + Math.sin(t * 0.09 + P.sp) * 0.12 * dt);
        P.x += Math.cos(P.hd) * P.sp * dt; P.z += Math.sin(P.hd) * P.sp * dt;
        if ((P.check -= dt) <= 0) { P.check = 1.4; if (bedAt(P.x + Math.cos(P.hd) * 40, P.z + Math.sin(P.hd) * 40) < 3.5) P.hd += Math.PI * 0.7; }
        const ch = Math.cos(P.hd), sh = Math.sin(P.hd);
        let near = false;
        for (const m of P.m) {
          const bx = P.x - m.back * ch - m.lat * sh, bz = P.z - m.back * sh + m.lat * ch;
          const cyc = ((t + m.ph) % m.period), leap = 1.15, u = cyc / leap;
          let y: number, pitch: number;
          if (u < 1) {
            y = seaY - 0.7 + (m.h + 0.7) * 4 * u * (1 - u);
            pitch = Math.atan2((m.h + 0.7) * 4 * (1 - 2 * u) / leap, P.sp);
            if (m.lastU < 0.1 && u >= 0.1) { spray?.splash(bx, seaY, bz, 0.7); sfx('splash', bx, seaY, bz, 0.6); }
            if (m.lastU < 0.9 && u >= 0.9) { spray?.splash(bx, seaY, bz, 1); sfx('splash', bx, seaY, bz, 0.9); }
            if (m.lastU < 0.3 && u >= 0.3 && R() < 0.6) sfx('dolphin', bx, y, bz, 0.8);
          } else { y = seaY - 1.1 - 0.25 * Math.sin(t * 1.3 + m.ph); pitch = 0.06 * Math.sin(t * 1.3 + m.ph + 1.0); }
          m.lastU = u;
          if (R() < dt * 0.25) near = true;
          dolphins.set(nd++, bx, y, bz, m.size, yawOf(ch, sh), pitch, 0, m.ph, 0.08, 6.5, 0);
        }
        if (near) sfx('click', P.x, seaY - 1, P.z, 0.5);
      }
    }
    dolphins.commit(nd);

    // ---------- fundo raso: rochas, corais, algas ----------
    propT -= dt;
    if (camAlt < 320) { if (propT <= 0 && Math.hypot(ax - propAt.x, az - propAt.z) > 24) { propT = 0.45; propAt = { x: ax, z: az }; refreshProps(ax, az); if (propAt.x > 1e8) propT = 0.05; } }
    else if (rocks.mesh.visible) { rocks.commit(0); weeds.commit(0); propAt = { x: 1e9, z: 1e9 }; }

    // ---------- aves ----------
    let nb = 0;
    if (camAlt < 2600) {
      for (const F of flocks) {
        const dx = F.x - cam.x, dz = F.z - cam.z;
        const behind = dx * camF.x + dz * camF.y < -700;
        if (F.x > 1e8 || dx * dx + dz * dz > 2600 * 2600 || behind || Math.abs(F.y - cam.y) > 1800) {
          const a = Math.atan2(camF.y, camF.x) + (R() - 0.5) * 1.4, r = 350 + R() * 1200;
          F.x = cam.x + Math.cos(a) * r; F.z = cam.z + Math.sin(a) * r;
          const ground = seaY + 0.35;
          F.y = F.kind === 0 ? ground + 14 + R() * 70 : F.kind === 1 ? ground + 50 + R() * 230 : F.kind === 2 ? Math.min(seaY + 1500, Math.max(ground + 160, cam.y + (R() - 0.55) * 300)) : ground + 70 + R() * 180;
          F.hd = Math.atan2(camF.y, camF.x) + Math.PI + (R() - 0.5) * 2.4; F.scatter = 0;
        }
        F.turn = Math.sin(t * (F.kind === 3 ? 0.08 : 0.17) + F.seed) * (F.kind === 3 ? 0.14 : 0.1) + (F.kind === 3 ? 0.06 : 0);
        F.hd = wrap(F.hd + F.turn * dt);
        F.x += Math.cos(F.hd) * F.sp * dt; F.z += Math.sin(F.hd) * F.sp * dt; F.y += Math.sin(t * 0.3 + F.seed) * 0.5 * dt;
        // o avião passou perto: o bando se espalha
        const pd = Math.hypot(F.x - plane.x, F.y - plane.y, F.z - plane.z);
        if (pd < 60) F.scatter = 1;
        F.scatter = Math.max(0, F.scatter - dt * 0.3);
        // canto/chamado quando perto da câmera
        const cd = Math.hypot(F.x - cam.x, F.y - cam.y, F.z - cam.z);
        if ((F.call -= dt) <= 0) {
          F.call = (F.kind === 1 ? 0.6 : F.kind === 2 ? 1.4 : 1.8) + R() * 3;
          if (cd < 420) sfx((['gull', 'starling', 'goose', 'frigate'] as const)[F.kind], F.x, F.y, F.z, Math.min(1, 1 - cd / 420 + 0.15));
        }
        const ch = Math.cos(F.hd), sh = Math.sin(F.hd), yaw0 = yawOf(ch, sh), bank = -F.turn * 3;
        for (let k = 0; k < F.n; k++) {
          const i = F.n0 + k, s0 = birdSeed[i * 4], s1 = birdSeed[i * 4 + 1], s2 = birdSeed[i * 4 + 2];
          let ox = F.off[k * 3], oy = F.off[k * 3 + 1], oz = F.off[k * 3 + 2];
          if (F.kind === 1) { // revoada que muda de forma
            ox += Math.sin(t * 0.7 + s0) * 6 + Math.sin(t * 1.3 + s2 * 9) * 3; oy += Math.sin(t * 0.9 + s1 * 7) * 3; oz += Math.cos(t * 0.6 + s0 * 2) * 6;
          } else if (F.kind === 0) { ox += Math.sin(t * 0.3 + s0) * 4; oy += Math.sin(t * 0.4 + s1 * 5) * 2; oz += Math.cos(t * 0.25 + s2 * 3) * 4; }
          const sc = 1 + F.scatter * 3.5;
          ox *= sc; oy = oy * sc - F.scatter * 6 * s1; oz *= sc;
          const x = F.x + ox * ch - oz * sh, z = F.z + ox * sh + oz * ch, y = F.y + oy;
          const glide = F.kind === 0 ? Math.max(0.12, Math.min(1, Math.sin(t * 0.35 + s0 * 6) * 1.5 + 0.4)) : F.kind === 3 ? 0.1 : 1;
          const amp = (F.kind === 1 ? 0.75 : F.kind === 2 ? 0.5 : F.kind === 3 ? 0.6 : 0.6) * glide + F.scatter * 0.3;
          const freq = F.kind === 1 ? 52 : F.kind === 2 ? 15 : F.kind === 3 ? 9 : 19;
          const size = F.kind === 1 ? 0.2 : F.kind === 2 ? 0.75 : F.kind === 3 ? 0.85 : 0.45;
          birds.set(nb++, x, y, z, size * (0.9 + s2 * 0.2), yaw0 + Math.sin(t * 0.5 + s0) * 0.08, Math.sin(t * 0.4 + s1 * 4) * 0.06, bank + Math.sin(t * 0.6 + s2 * 5) * 0.1, s0 * 6.28, amp, freq, F.kind);
        }
      }
    }
    birds.commit(nb);
  };

  return {
    group, reset, update, setSpray,
    hide() { all.forEach((s) => s.commit(0)); propAt = { x: 1e9, z: 1e9 }; },
    dispose() { all.forEach((s) => s.dispose()); },
  };
}
export type Life = ReturnType<typeof createLife>;
