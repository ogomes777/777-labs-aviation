import * as THREE from 'three';
import { NOISE, SKY } from './glsl';
import type { SharedU } from './ocean';

/**
 * Spray, névoa e respingos (billboards instanciados, 1 draw call):
 * 0 gotas (rápidas, caem), 1 névoa (grande, lenta, sobe e se espalha), 2 respingo (animais, impacto).
 * Simulação na CPU com arrays tipados; só as partículas vivas vão para a GPU.
 */
export function createSpray(U: SharedU, max: number) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.setAttribute('position', base.getAttribute('position')); geo.setAttribute('uv', base.getAttribute('uv'));
  let cap = max;
  let aP = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
  let aQ = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aP', aP); geo.setAttribute('aQ', aQ);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U },
    transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `
      attribute vec4 aP; attribute vec4 aQ;
      uniform vec3 uCam;
      varying vec2 vUv; varying float vA; varying float vKind; varying float vSeed; varying vec3 vW;
      void main(){
        vec4 mv = viewMatrix * vec4(aP.xyz, 1.0);
        float r = aQ.w; vec2 c = mat2(cos(r), -sin(r), sin(r), cos(r)) * position.xy;
        mv.xy += c * aP.w;
        vUv = uv; vA = aQ.x; vKind = aQ.y; vSeed = aQ.z; vW = aP.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCam; uniform float uFog, uTime;
      varying vec2 vUv; varying float vA; varying float vKind; varying float vSeed; varying vec3 vW;
      ${NOISE}
      ${SKY}
      void main(){
        vec2 q = vUv - 0.5; float r = length(q) * 2.0;
        float a;
        if (vKind > 0.5 && vKind < 1.5) { float n = fbm3(vUv * 2.6 + vSeed * 31.0 + uTime * 0.05); a = smoothstep(1.0, 0.2, r + (n - 0.5) * 0.7) * (0.55 + 0.6 * n); } // névoa
        else a = smoothstep(1.0, 0.35, r);                                                                                                // gota
        float dc = length(vW - uCam);
        a *= vA * smoothstep(3.0, 14.0, dc);                                                                                               // nada encosta na lente
        if (a < 0.01) discard;
        vec3 V = (vW - uCam) / dc;
        float fwd = pow(max(dot(V, uSun), 0.0), 6.0);
        vec3 col = vec3(0.95, 0.97, 1.0) * (uSunCol * (max(uSun.y, 0.0) * 0.85 + fwd * 1.2) + uZen * 0.45 + 0.16);
        col = mix(col, fogCol(V), aerial(length(vW - uCam), uFog));
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.name = 'flight-spray';

  // estado
  let P = new Float32Array(cap * 3), Vv = new Float32Array(cap * 3), L = new Float32Array(cap * 4); // vida, vidaMax, tamanho, crescimento
  let K = new Uint8Array(cap), S = new Float32Array(cap);
  let n = 0;
  const alloc = (m: number) => {
    cap = m; n = 0;
    P = new Float32Array(cap * 3); Vv = new Float32Array(cap * 3); L = new Float32Array(cap * 4); K = new Uint8Array(cap); S = new Float32Array(cap);
    aP = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    aQ = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aP', aP); geo.setAttribute('aQ', aQ); geo.instanceCount = 0;
  };

  const emit = (x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, kind: 0 | 1 | 2) => {
    if (n >= cap) return;
    const i = n++;
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    Vv[i * 3] = vx; Vv[i * 3 + 1] = vy; Vv[i * 3 + 2] = vz;
    L[i * 4] = 0; L[i * 4 + 1] = life; L[i * 4 + 2] = size; L[i * 4 + 3] = kind === 1 ? 1.2 : kind === 2 ? 0.6 : 0.25;
    K[i] = kind; S[i] = Math.random();
  };
  /** respingo de um animal ou impacto: coroa de gotas + névoa */
  const splash = (x: number, y: number, z: number, power: number) => {
    const m = Math.round(10 + power * 26);
    for (let k = 0; k < m; k++) {
      const a = Math.random() * Math.PI * 2, s = (0.6 + Math.random() * 1.6) * power;
      emit(x + Math.cos(a) * 0.3, y, z + Math.sin(a) * 0.3, Math.cos(a) * s, (2.2 + Math.random() * 3.5) * Math.sqrt(power), Math.sin(a) * s, 0.18 + Math.random() * 0.3 * power, 0.7 + Math.random() * 0.6, 2);
    }
    for (let k = 0; k < 3 + power * 4; k++) emit(x, y + 0.3, z, (Math.random() - 0.5) * 1.2, 0.6 + Math.random(), (Math.random() - 0.5) * 1.2, 0.8 + power * 1.4, 1.6 + Math.random(), 1);
  };

  return {
    mesh, emit, splash,
    get count() { return n; },
    resize(m: number) { if (m !== cap) alloc(m); },
    clear() { n = 0; geo.instanceCount = 0; },
    update(dt: number, seaY: number) {
      let j = 0;
      const pa = aP.array as Float32Array, qa = aQ.array as Float32Array;
      for (let i = 0; i < n; i++) {
        const k = K[i];
        L[i * 4] += dt;
        const age = L[i * 4], life = L[i * 4 + 1];
        if (age >= life) continue;
        const g = k === 1 ? -0.25 : 9.81, drag = k === 1 ? 1.6 : 0.55;
        let vx = Vv[i * 3], vy = Vv[i * 3 + 1], vz = Vv[i * 3 + 2];
        const f = Math.exp(-drag * dt);
        vx *= f; vz *= f; vy = vy * f - g * dt;
        let x = P[i * 3] + vx * dt, y = P[i * 3 + 1] + vy * dt, z = P[i * 3 + 2] + vz * dt;
        if (y < seaY && k !== 1) continue; // a gota voltou para o mar
        if (y < seaY) { y = seaY; vy = 0; }
        // compacta (mantém só as vivas no início do array)
        P[j * 3] = x; P[j * 3 + 1] = y; P[j * 3 + 2] = z; Vv[j * 3] = vx; Vv[j * 3 + 1] = vy; Vv[j * 3 + 2] = vz;
        L[j * 4] = age; L[j * 4 + 1] = life; L[j * 4 + 2] = L[i * 4 + 2]; L[j * 4 + 3] = L[i * 4 + 3]; K[j] = k; S[j] = S[i];
        const u = age / life;
        const size = L[j * 4 + 2] * (1 + L[j * 4 + 3] * u * 2.2);
        const alpha = (k === 1 ? 0.42 : k === 2 ? 0.85 : 0.9) * Math.min(1, u * 8) * (1 - u) * (1 - u * 0.3);
        pa[j * 4] = x; pa[j * 4 + 1] = y; pa[j * 4 + 2] = z; pa[j * 4 + 3] = size;
        qa[j * 4] = alpha; qa[j * 4 + 1] = k; qa[j * 4 + 2] = S[j]; qa[j * 4 + 3] = S[j] * 6.28 + age * (k === 1 ? 0.2 : 0.8);
        j++;
      }
      n = j;
      geo.instanceCount = n;
      if (n) { aP.needsUpdate = true; aQ.needsUpdate = true; aP.addUpdateRange(0, n * 4); aQ.addUpdateRange(0, n * 4); }
    },
    dispose() { geo.dispose(); base.dispose(); mat.dispose(); },
  };
}
export type Spray = ReturnType<typeof createSpray>;
