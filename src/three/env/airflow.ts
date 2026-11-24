import * as THREE from 'three';
import type { JetBuild } from '../jet/buildJet';

/**
 * Escoamento visível: filetes de ar finos que escorrem pela fuselagem, saem do bordo de fuga e dos winglets,
 * e vórtices de ponta de asa. Um pulso luminoso percorre cada filete na velocidade do voo (ar, não fumaça).
 */
export function createAirflow(jet: JetBuild, count: number) {
  const s = jet.spec, f = jet.fus;
  const uniforms = { uTime: { value: 0 }, uOpacity: { value: 0 }, uSpeed: { value: 1 } };
  const geos: THREE.BufferGeometry[] = [];
  let seed = 41;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ribbon = (start: THREE.Vector3, len: number, width: number, up: THREE.Vector3, phase: number, twist = 0) => {
    const seg = 24;
    const pos: number[] = [], uv: number[] = [], ph: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      const a = twist * u * Math.PI * 2;
      const o = new THREE.Vector3(0, Math.cos(a), Math.sin(a)).multiplyScalar(twist ? 0.35 * u : 0);
      const c = start.clone().add(new THREE.Vector3(-len * u, 0, 0)).add(o);
      const w = up.clone().multiplyScalar(width * (1 - u * 0.6));
      pos.push(c.x + w.x, c.y + w.y, c.z + w.z, c.x - w.x, c.y - w.y, c.z - w.z);
      uv.push(u, 0, u, 1);
      ph.push(phase, phase);
    }
    const idx: number[] = [];
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('phase', new THREE.Float32BufferAttribute(ph, 1));
    g.setIndex(idx);
    geos.push(g);
  };
  // filetes colados à fuselagem (topo e laterais), do nariz ao cone de cauda
  for (let i = 0; i < count * 0.5; i++) {
    const th = Math.PI * (0.05 + rnd() * 0.9) * (rnd() > 0.15 ? 1 : -1) + (rnd() > 0.5 ? 0 : Math.PI);
    const d = 0.6 + rnd() * s.L * 0.35;
    const p = f.point(d, th, -0.06 - rnd() * 0.25);
    const n = f.normal(d, th);
    const up = new THREE.Vector3().crossVectors(n, new THREE.Vector3(1, 0, 0)).normalize();
    ribbon(p, 6 + rnd() * 14, 0.012 + rnd() * 0.02, up, rnd());
  }
  // bordo de fuga das asas e winglets
  const wings = jet.parts.asas.children as THREE.Mesh[];
  wings.forEach((w) => {
    const pos = (w.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute;
    w.geometry.computeBoundingBox();
    const bb = w.geometry.boundingBox!;
    const side = bb.max.z > 0 ? 1 : -1;
    for (let i = 0; i < count * 0.18; i++) {
      const vi = Math.floor(rnd() * pos.count);
      const p = new THREE.Vector3().fromBufferAttribute(pos, vi);
      ribbon(p.add(new THREE.Vector3(-0.2, 0.04, 0)), 8 + rnd() * 16, 0.015, new THREE.Vector3(0, 1, 0), rnd());
    }
    // vórtice de ponta de asa: espiral longa e tênue saindo do winglet
    const tip = new THREE.Vector3(bb.min.x + 0.4, bb.max.y - 0.3, side * (bb.max.z * side > 0 ? Math.abs(side === 1 ? bb.max.z : bb.min.z) : 0));
    for (let k = 0; k < 3; k++) ribbon(tip.clone(), 46 + k * 10, 0.03, new THREE.Vector3(0, 1, 0), k / 3, 6 + k);
  });
  const geo = geos.length ? mergeAll(geos) : new THREE.BufferGeometry();
  geos.forEach((g) => g.dispose());
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: /* glsl */ `attribute float phase; varying vec2 vUv; varying float vPh; void main(){ vUv = uv; vPh = phase; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying float vPh; uniform float uTime, uOpacity, uSpeed;
      void main(){
        float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
        float head = fract(vUv.x * 1.4 - uTime * 1.9 * uSpeed + vPh);
        float pulse = smoothstep(0.0, 0.08, head) * (1.0 - smoothstep(0.08, 0.7, head));
        float fade = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.55, 1.0, vUv.x));
        float a = pulse * fade * across * uOpacity * 0.32;
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.94) * a, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  return { mesh, uniforms, dispose: () => { geo.dispose(); mat.dispose(); } };
}

function mergeAll(geos: THREE.BufferGeometry[]) {
  let vCount = 0, iCount = 0;
  geos.forEach((g) => { vCount += g.getAttribute('position').count; iCount += g.getIndex()!.count; });
  const pos = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2), ph = new Float32Array(vCount), idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  geos.forEach((g) => {
    const p = g.getAttribute('position').array as Float32Array, u = g.getAttribute('uv').array as Float32Array, f = g.getAttribute('phase').array as Float32Array, ix = g.getIndex()!.array;
    pos.set(p, vo * 3); uv.set(u, vo * 2); ph.set(f, vo);
    for (let i = 0; i < ix.length; i++) idx[io + i] = ix[i] + vo;
    vo += p.length / 3; io += ix.length;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
