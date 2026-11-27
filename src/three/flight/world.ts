import * as THREE from 'three';
import { ISLAND, isWater } from './terrain';
import { NOISE, SKY } from './glsl';
import { createLandSea, type SharedU } from './ocean';
import { createSpray } from './spray';
import { createLife, type SfxKind } from './life';
import { jetWash, makeWorldSeed, MEGA, wavesFor, type WorldSeed } from './env';
import { flightTel as TEL } from '@/experience/flight';

/**
 * Mundo do test drive — Mega Ultra, sempre.
 * Céu calibrado pelo sol do dia sorteado, nuvens com volume iluminadas pelo sol de verdade (borda prateada,
 * base sombreada, sombra real no chão e no mar), mar cristalino com fundo visível, vida no mar e no céu,
 * e a água reagindo às turbinas. Cada voo é um mundo novo (sol, vento, ondas, nuvens, bichos).
 */
export interface PlaneIn { pos: THREE.Vector3; quat: THREE.Quaternion; len: number; span: number; radius: number; V: number; axisH: number; flying: boolean; crashedWater: boolean }
export interface WorldIn { cam: THREE.Vector3; camDir: THREE.Vector3; camRight: THREE.Vector3; time: number; dt: number; plane: PlaneIn; fogK: number }

export function createFlightWorld(gy: number) {
  const cfg = MEGA;
  const group = new THREE.Group();
  group.name = 'flight-world';
  group.visible = false;
  const seaY = gy - 0.8;

  // ---------- uniformes compartilhados (céu, sol, mar, sombras) ----------
  const cShadowCv = document.createElement('canvas'); cShadowCv.width = cShadowCv.height = 256;
  const cShadowTex = new THREE.CanvasTexture(cShadowCv); cShadowTex.flipY = false; cShadowTex.wrapS = cShadowTex.wrapT = THREE.RepeatWrapping; cShadowTex.colorSpace = THREE.NoColorSpace;
  const U: SharedU = {
    uSun: { value: new THREE.Vector3(0.3, 0.5, 0.6).normalize() }, uSunCol: { value: new THREE.Color(1, 0.95, 0.88) },
    uZen: { value: new THREE.Color('#1d4c9c') }, uHor: { value: new THREE.Color('#c6daef') }, uHorSun: { value: new THREE.Color('#eef0ea') }, uHaze: { value: new THREE.Color('#dbe6f1') },
    uAmbSky: { value: new THREE.Color('#bcd2ee') }, uAmbGround: { value: new THREE.Color('#3f6f86') },
    uSeaY: { value: seaY }, uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uFog: { value: 0.00011 },
    uPlP: { value: new THREE.Vector3() }, uPlF: { value: new THREE.Vector3(1, 0, 0) }, uPlR: { value: new THREE.Vector3(0, 0, 1) }, uPlU: { value: new THREE.Vector3(0, 1, 0) }, uPlD: { value: new THREE.Vector4(20, 20, 1, 0) },
    uCShadow: { value: cShadowTex }, uCS: { value: new THREE.Vector4(22000, gy + 1050, 0, 0) }, uCSk: { value: 0.55 },
    uWA: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uWB: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uWO: { value: new THREE.Vector2() },
  };

  // ---------- terra, fundo do mar e água ----------
  const ls = createLandSea(U, cfg);
  group.add(ls.terrain, ls.water);

  // ---------- céu ----------
  const skyU = { ...U, uCirrus: { value: 0.6 } };
  const skyM = new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; vec4 pp = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = pp.xyww; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir; uniform float uTime, uCirrus;
      ${NOISE}
      ${SKY}
      void main(){
        vec3 d = normalize(vDir); float h = d.y, mu = max(dot(d, uSun), 0.0);
        vec3 col = skyCol(d);
        col += uSunCol * smoothstep(0.99955, 0.99982, mu) * 16.0;                       // disco do sol
        if (h > 0.0) {                                                                   // cirros altos derivando com o vento
          vec2 uv = d.xz / (h + 0.08) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
          float ci = fbm(uv * vec2(1.0, 3.2)) * fbm(uv * 0.6 + 4.0);
          float cir = smoothstep(0.3 - uCirrus * 0.08, 0.52, ci) * smoothstep(0.0, 0.18, h) * (1.0 - smoothstep(0.55, 0.95, h));
          col = mix(col, mix(vec3(1.0), uSunCol, 0.4) * (0.9 + 0.35 * pow(mu, 4.0)), cir * 0.5 * uCirrus);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), skyM);
  sky.frustumCulled = false; sky.renderOrder = -10; group.add(sky);

  // ---------- pista da ilha (mesmo rumo da pista 27) ----------
  const rwTex = (() => {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 64; const g = c.getContext('2d')!;
    g.fillStyle = '#2c2e31'; g.fillRect(0, 0, 2048, 64);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`; g.fillRect(Math.random() * 2048, Math.random() * 64, 2, 2); }
    g.fillStyle = '#e6e3da';
    for (let x = 120; x < 1930; x += 60) g.fillRect(x, 30.5, 34, 3);
    g.fillRect(0, 2, 2048, 2); g.fillRect(0, 60, 2048, 2);
    for (const x0 of [14, 2048 - 44]) for (let k = 0; k < 8; k++) g.fillRect(x0, 8 + k * 6.2, 30, 3.4);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  const rwLen = ISLAND.rx0 - ISLAND.rx1;
  const rwMat = new THREE.MeshStandardMaterial({ map: rwTex, roughness: 0.82, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(rwLen, ISLAND.rw), rwMat);
  runway.rotation.x = -Math.PI / 2; runway.position.set((ISLAND.rx0 + ISLAND.rx1) / 2, gy + 0.03, ISLAND.rz); group.add(runway);
  const lampGeo = new THREE.SphereGeometry(0.6, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.7, 2.2) });
  const nL = Math.floor(rwLen / 60) + 1;
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, nL * 2);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < nL; i++) for (const sd of [-1, 1]) { mm.makeTranslation(ISLAND.rx1 + i * 60, gy + 0.5, ISLAND.rz + sd * (ISLAND.rw / 2 + 1.5)); lamps.setMatrixAt(i * 2 + (sd > 0 ? 1 : 0), mm); }
  group.add(lamps);

  // ---------- nuvens com volume (billboards em mosaico infinito, luz do sol marchada no atlas) ----------
  const tex = (() => {
    // atlas 2×2 de cúmulos: A = densidade, R = espessura (densidade borrada: caminho da luz), G = oclusão ambiente
    const N = 512, W = N * 2, c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d')!;
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const puff = (x: number, y: number, r: number, a: number) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.55, `rgba(255,255,255,${a * 0.42})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
    for (let t = 0; t < 4; t++) {
      const ox = (t % 2) * N, oy = Math.floor(t / 2) * N, base = oy + N * 0.74;
      const towers = Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => ({ cx: ox + N * (0.22 + 0.56 * rnd()), w: N * (0.1 + 0.11 * rnd()), h: N * (0.16 + (t === 3 ? 0.42 : 0.3) * rnd()) }));
      for (let i = 0; i < 300; i++) {
        const tw = towers[Math.floor(rnd() * towers.length)];
        const u = (rnd() - 0.5) * 2, hv = Math.pow(rnd(), 0.8);
        const x = tw.cx + u * tw.w * (1.1 - hv * 0.45);
        const y = base - hv * tw.h * Math.sqrt(Math.max(0.05, 1 - u * u * 0.7)) - N * 0.02;
        puff(x, y, N * (0.035 + 0.075 * rnd()) * (1 - hv * 0.35), 0.24);
      }
      for (let i = 0; i < 520; i++) {
        const tw = towers[Math.floor(rnd() * towers.length)];
        const a = rnd() * Math.PI, x = tw.cx + Math.cos(a) * tw.w * (0.85 + rnd() * 0.3), y = base - N * 0.02 - Math.sin(a) * tw.h * (0.8 + rnd() * 0.25);
        puff(x, y, N * (0.01 + 0.024 * rnd()), 0.2);
      }
      const fade = g.createLinearGradient(0, base - N * 0.03, 0, base + N * 0.04); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(ox, base - N * 0.03, N, oy + N - (base - N * 0.03)); g.globalCompositeOperation = 'source-over';
    }
    const img = g.getImageData(0, 0, W, W), px = img.data;
    const dens = new Float32Array(W * W); for (let i = 0; i < W * W; i++) dens[i] = px[i * 4 + 3] / 255;
    // desfoque em caixa por somas corridas (O(1) por pixel), por ladrilho (sem vazar entre ladrilhos)
    const blur = (src: Float32Array, r: number) => {
      const tmp = new Float32Array(W * W), out = new Float32Array(W * W);
      for (let y = 0; y < W; y++) for (let t0 = 0; t0 < W; t0 += N) {
        let acc = 0; for (let k = -r; k <= r; k++) acc += src[y * W + t0 + Math.min(N - 1, Math.max(0, k))];
        for (let x = 0; x < N; x++) { tmp[y * W + t0 + x] = acc / (2 * r + 1); acc += src[y * W + t0 + Math.min(N - 1, x + r + 1)] - src[y * W + t0 + Math.max(0, x - r)]; }
      }
      for (let x = 0; x < W; x++) for (let t0 = 0; t0 < W; t0 += N) {
        let acc = 0; for (let k = -r; k <= r; k++) acc += tmp[(t0 + Math.min(N - 1, Math.max(0, k))) * W + x];
        for (let y = 0; y < N; y++) { out[(t0 + y) * W + x] = acc / (2 * r + 1); acc += tmp[(t0 + Math.min(N - 1, y + r + 1)) * W + x] - tmp[(t0 + Math.max(0, y - r)) * W + x]; }
      }
      return out;
    };
    const thick = blur(dens, 7), wide = blur(dens, 26);
    for (let i = 0; i < W * W; i++) {
      px[i * 4] = Math.min(255, thick[i] * 330); px[i * 4 + 1] = Math.max(0, Math.min(1, 1 - wide[i] * 0.75)) * 255; px[i * 4 + 2] = 255; px[i * 4 + 3] = Math.min(255, dens[i] * 255 * 1.2);
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.premultiplyAlpha = false; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t;
  })();
  const CLOUD_VS = /* glsl */ `
    attribute vec3 aOff; attribute vec2 aSize; uniform vec3 uCam, uSun; uniform float uTile, uRel, uAspect, uCover; uniform vec2 uDrift;
    varying vec2 vUv; varying float vD; varying float vEdge; varying float vSeed; varying vec3 vSunV; varying vec3 vDir;
    void main(){
      if (fract(aSize.y * 13.37) > uCover) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vec3 c = aOff;
      vec2 rel = mod(aOff.xz + uDrift - uCam.xz + 0.5 * uTile, uTile) - 0.5 * uTile;
      c.xz = uCam.xz + rel; c.y += uCam.y * uRel;
      vEdge = 1.0 - smoothstep(0.36, 0.5, max(abs(rel.x), abs(rel.y)) / uTile);
      vec4 mv = viewMatrix * vec4(c, 1.0);
      float rot = aSize.y * 6.283 * 0.08;
      vec2 corner = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * (position.xy * vec2(1.0, uAspect));
      mv.xy += corner * aSize.x;
      vUv = uv; vD = -mv.z; vSeed = aSize.y; vSunV = (viewMatrix * vec4(uSun, 0.0)).xyz; vDir = normalize(c - uCam);
      gl_Position = projectionMatrix * mv;
    }`;
  const CLOUD_FS = /* glsl */ `
    uniform sampler2D uMap; uniform float uFog, uOpacity, uFarNear, uTime, uClear;
    varying vec2 vUv; varying float vD; varying float vEdge; varying float vSeed; varying vec3 vSunV; varying vec3 vDir;
    ${NOISE}
    ${SKY}
    float hg(float c, float g){ float g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); }
    void main(){
      vec2 uv0 = vUv; float flip = fract(vSeed * 7.0) > 0.5 ? -1.0 : 1.0; if (flip < 0.0) uv0.x = 1.0 - uv0.x;
      float tile = floor(vSeed * 3.999);
      vec2 off = vec2(mod(tile, 2.0), floor(tile / 2.0)) * 0.5;
      vec2 wob = vec2(sin(vUv.y * 9.0 + uTime * 0.11 + vSeed * 40.0), cos(vUv.x * 7.0 - uTime * 0.09 + vSeed * 17.0)) * 0.004;
      vec4 tx = texture2D(uMap, clamp(uv0 + wob, 0.002, 0.998) * 0.5 + off);
      float a = tx.a * smoothstep(0.0, 0.35, tx.a + 0.12 * sin(uTime * 0.07 + vSeed * 60.0 + vUv.x * 5.0));
      float near = smoothstep(4.0, 26.0, vD) * mix(smoothstep(40.0, 260.0, vD), 1.0, step(0.5, uFarNear));
      float clear = uClear > 0.0 ? smoothstep(uClear, uClear * 2.2 + 60.0, vD) : 1.0;     // a aeronave nunca some atrás de nuvem
      clear *= 1.0 - smoothstep(9000.0, 14000.0, vD);
      float alpha = a * vEdge * near * uOpacity * clear;
      if (alpha < 0.02) discard;
      // luz do sol atravessando o volume: marcha no atlas na direção do sol projetada na tela
      vec2 l2 = vec2(vSunV.x * flip, vSunV.y); float ll = length(l2);
      vec2 ld = ll > 1e-3 ? l2 / ll : vec2(0.0, 1.0);
      float od = 0.0;
      for (int i = 1; i <= CLOUD_STEPS; i++) od += texture2D(uMap, clamp(uv0 + ld * (float(i) / float(CLOUD_STEPS)) * 0.22 * ll, 0.002, 0.998) * 0.5 + off).r;
      od /= float(CLOUD_STEPS);
      float thick = tx.r;
      od = mix(od, thick, clamp(abs(vSunV.z), 0.0, 1.0) * 0.7) * 2.4 + thick * 0.5;
      float T = exp(-od * 1.5), powder = 1.0 - exp(-thick * 4.0);
      float cosT = dot(vDir, uSun);
      float ph = min(mix(hg(cosT, 0.55), hg(cosT, -0.2), 0.45) * 0.55, 2.2);
      vec3 lit = uSunCol * 1.25 * T * mix(1.0, powder * 1.5, 0.45) * (0.65 + ph);
      vec3 amb = mix(uHor, uZen, 0.45) * (0.5 + 0.55 * smoothstep(0.05, 0.85, uv0.y)) * (0.55 + 0.45 * tx.g) + 0.05;
      vec3 col = lit + amb * 0.85;
      col += uSunCol * pow(max(cosT, 0.0), 10.0) * (1.0 - smoothstep(0.0, 0.6, thick)) * 1.3;   // borda prateada contra o sol
      col = mix(col, fogCol(vDir), clamp(aerial(vD, uFog) * 0.85, 0.0, 1.0));
      gl_FragColor = vec4(col, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const makeClouds = (COUNT: number, TILE: number, y0: number, yr: number, s0: number, sr: number, rel: number, seed: number, aspect: number) => {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index; geo.setAttribute('position', base.getAttribute('position')); geo.setAttribute('uv', base.getAttribute('uv'));
    const offs = new Float32Array(COUNT * 3), sizes = new Float32Array(COUNT * 2);
    let s2 = seed; const rnd2 = () => ((s2 = (s2 * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < COUNT; i++) {
      const cluster = Math.floor(i / 6);
      const cx = ((cluster * 0.618034) % 1) * TILE - TILE / 2, cz = ((cluster * 0.414214 + 0.3) % 1) * TILE - TILE / 2;
      offs[i * 3] = cx + (rnd2() - 0.5) * TILE * 0.065;
      offs[i * 3 + 1] = y0 + rnd2() * yr + (i % 6) * 18;
      offs[i * 3 + 2] = cz + (rnd2() - 0.5) * TILE * 0.065;
      sizes[i * 2] = s0 + rnd2() * sr; sizes[i * 2 + 1] = rnd2();
    }
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(offs, 3));
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 2));
    geo.instanceCount = COUNT;
    const u = {
      ...U, uMap: { value: tex }, uTile: { value: TILE }, uRel: { value: rel }, uFarNear: { value: rel }, uOpacity: { value: 1 },
      uDrift: { value: new THREE.Vector2() }, uAspect: { value: aspect }, uClear: { value: 0 }, uCover: { value: 1 }, uFog: { value: 0.00011 },
    };
    const m = new THREE.ShaderMaterial({ uniforms: u, defines: { CLOUD_STEPS: cfg.cloudSteps }, transparent: true, depthWrite: false, fog: false, vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS });
    const mesh = new THREE.Mesh(geo, m);
    mesh.frustumCulled = false; mesh.renderOrder = 2; group.add(mesh);
    // ordenação de trás para frente (sem "piscar" quando nuvens se sobrepõem)
    const src = { o: offs.slice(), s: sizes.slice() }; const order = Array.from({ length: COUNT }, (_, i) => i); const dist = new Float32Array(COUNT);
    const aO = geo.getAttribute('aOff') as THREE.InstancedBufferAttribute, aS = geo.getAttribute('aSize') as THREE.InstancedBufferAttribute;
    const sort = (cam: THREE.Vector3) => {
      const dx = u.uDrift.value.x, dz = u.uDrift.value.y;
      for (let i = 0; i < COUNT; i++) {
        const rx = ((src.o[i * 3] + dx - cam.x + TILE * 0.5) % TILE + TILE) % TILE - TILE * 0.5;
        const rz = ((src.o[i * 3 + 2] + dz - cam.z + TILE * 0.5) % TILE + TILE) % TILE - TILE * 0.5;
        const ry = src.o[i * 3 + 1] + cam.y * rel - cam.y;
        dist[i] = rx * rx + ry * ry + rz * rz;
      }
      order.sort((a, b) => dist[b] - dist[a]);
      for (let k = 0; k < COUNT; k++) { const i = order[k]; offs[k * 3] = src.o[i * 3]; offs[k * 3 + 1] = src.o[i * 3 + 1]; offs[k * 3 + 2] = src.o[i * 3 + 2]; sizes[k * 2] = src.s[i * 2]; sizes[k * 2 + 1] = src.s[i * 2 + 1]; }
      aO.needsUpdate = true; aS.needsUpdate = true;
    };
    return { mesh, u, sort, src, COUNT, TILE, dispose: () => { geo.dispose(); base.dispose(); m.dispose(); } };
  };
  // cúmulos (≈ 800–1.500 m), altocúmulos esparsos (≈ 2.700 m) e fiapos na altitude da aeronave
  const clouds = makeClouds(300, 22000, gy + 800, 560, 420, 640, 0, 11, 0.62);
  const high = makeClouds(56, 30000, gy + 2600, 400, 800, 1000, 0, 47, 0.34);
  high.u.uOpacity.value = 0.55;
  const wisps = makeClouds(70, 2600, -70, 140, 40, 90, 1, 29, 0.6);
  wisps.u.uOpacity.value = 0;

  // ---------- spray e vida ----------
  const spray = createSpray(U, cfg.spray);
  group.add(spray.mesh);
  const camRight = new THREE.Vector3();
  let camPos = new THREE.Vector3();
  const sfx = (kind: SfxKind, x: number, y: number, z: number, power: number) => {
    const dx = x - camPos.x, dy = y - camPos.y, dz = z - camPos.z, d = Math.hypot(dx, dy, dz);
    if (d > 900 || TEL.sfx.length > 14) return;
    TEL.sfx.push({ kind, d, pan: d > 0.1 ? Math.max(-1, Math.min(1, (dx * camRight.x + dy * camRight.y + dz * camRight.z) / d)) : 0, power });
  };
  const life = createLife(U, cfg, seaY, sfx);
  life.setSpray(spray);
  group.add(life.group);

  // ---------- semente do mundo ----------
  let seed: WorldSeed = makeWorldSeed(1);
  let waves = wavesFor(seed, cfg.waves);
  let envTex: THREE.Texture | null = null;
  const trail: { x: number; z: number; age: number; w: number }[] = [];
  let trailT = 0, wasCrashed = false;

  const drawCloudShadow = () => {
    const g = cShadowCv.getContext('2d')!; const S = 256, T = clouds.TILE;
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < clouds.COUNT; i++) {
      const sd = clouds.src.s[i * 2 + 1];
      if (((sd * 13.37) % 1) > clouds.u.uCover.value) continue;
      const x = (clouds.src.o[i * 3] / T + 0.5) * S, z = (clouds.src.o[i * 3 + 2] / T + 0.5) * S, r = (clouds.src.s[i * 2] * 0.3 / T) * S;
      for (const ox of [-S, 0, S]) for (const oz of [-S, 0, S]) {
        const gr = g.createRadialGradient(x + ox, z + oz, 0, x + ox, z + oz, r);
        gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x + ox - r, z + oz - r, r * 2, r * 2);
      }
    }
    g.globalCompositeOperation = 'source-over';
    cShadowTex.needsUpdate = true;
  };

  const reseed = (s: number) => {
    seed = makeWorldSeed(s);
    waves = wavesFor(seed, cfg.waves);
    const A = seed.atmo;
    (U.uSun.value as THREE.Vector3).set(...A.sun).normalize();
    (U.uSunCol.value as THREE.Color).setRGB(...A.sunCol);
    (U.uZen.value as THREE.Color).setRGB(...A.zenith); (U.uHor.value as THREE.Color).setRGB(...A.horizon);
    (U.uHorSun.value as THREE.Color).setRGB(...A.horizonSun); (U.uHaze.value as THREE.Color).setRGB(...A.haze);
    (U.uAmbSky.value as THREE.Color).setRGB(...A.hemiSky); (U.uAmbGround.value as THREE.Color).setRGB(...A.hemiGround);
    ls.local.uWind.value = seed.wind; ls.local.uWindDir.value.set(Math.cos(seed.windDir), Math.sin(seed.windDir));
    ls.local.uAmp.value = waves.reduce((a, w) => a + w.amp, 0);
    clouds.u.uCover.value = seed.cover; high.u.uCover.value = Math.min(1, seed.cover + 0.15); wisps.u.uCover.value = 1;
    skyU.uCirrus.value = 0.3 + (1 - seed.cover) * 0.7;
    U.uCSk.value = 0.42 + seed.cover * 0.2;
    drawCloudShadow();
    life.reset(s); spray.clear(); trail.length = 0; wasCrashed = false;
    envTex?.dispose(); envTex = null;
  };
  reseed(1);

  const fwd = new THREE.Vector3(), rgt = new THREE.Vector3(), up = new THREE.Vector3();
  let sortN = 0;

  return {
    group, U, seaY, clouds: clouds.u, high: high.u, wisps: wisps.u,
    get seed() { return seed; },
    reseed,
    /** mapa de ambiente do céu do dia (a pintura da aeronave reflete este céu e este mar) */
    envMap(gl: THREE.WebGLRenderer) {
      if (envTex) return envTex;
      const pm = new THREE.PMREMGenerator(gl);
      const sc = new THREE.Scene();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: skyM.vertexShader, fragmentShader: skyM.fragmentShader, side: THREE.BackSide, depthWrite: false }));
      sc.add(dome);
      const seaC = new THREE.Color().setRGB(...seed.atmo.haze).multiplyScalar(0.35).add(new THREE.Color(0.0, 0.05, 0.11));
      const below = new THREE.Mesh(new THREE.CircleGeometry(400, 32), new THREE.MeshBasicMaterial({ color: seaC }));
      below.rotation.x = -Math.PI / 2; below.position.y = -8; sc.add(below);
      envTex = pm.fromScene(sc, 0.015).texture;
      dome.geometry.dispose(); (dome.material as THREE.Material).dispose(); below.geometry.dispose(); (below.material as THREE.Material).dispose();
      pm.dispose();
      return envTex;
    },
    update(I: WorldIn) {
      const { cam, time, dt, plane } = I;
      camPos = cam; camRight.copy(I.camRight);
      sky.position.copy(cam);
      U.uTime.value = time; (U.uCam.value as THREE.Vector3).copy(cam);
      const fog = 0.00007 * I.fogK * seed.hazeK;
      U.uFog.value = fog; clouds.u.uFog.value = fog; high.u.uFog.value = fog; wisps.u.uFog.value = fog;
      ls.update(cam);
      // ondas: fase de cada onda no ponto da câmera em precisão dupla (sem tremor longe da origem)
      (U.uWO.value as THREE.Vector2).set(cam.x, cam.z);
      const WA = U.uWA.value as THREE.Vector4[], WB = U.uWB.value as THREE.Vector4[];
      for (let i = 0; i < waves.length; i++) {
        const w = waves[i];
        const ph = (w.k * (w.dx * cam.x + w.dz * cam.z) - w.omega * time + w.phase) % (Math.PI * 2);
        WA[i].set(w.dx, w.dz, w.amp, w.k); WB[i].set(w.omega, ph, w.q, 0);
      }
      // vento: camadas de nuvem derivam em velocidades diferentes (paralaxe real entre altitudes)
      const wx = Math.cos(seed.windDir), wz = Math.sin(seed.windDir);
      clouds.u.uDrift.value.set(seed.cloudShift[0] + time * wx * seed.wind * 0.9, seed.cloudShift[1] + time * wz * seed.wind * 0.9);
      high.u.uDrift.value.set(seed.cloudShift[1] + time * wx * seed.wind * 1.7, seed.cloudShift[0] + time * wz * seed.wind * 1.7);
      (U.uCS.value as THREE.Vector4).set(clouds.TILE, gy + 1050, clouds.u.uDrift.value.x, clouds.u.uDrift.value.y);
      sortN = (sortN + 1) % 3;
      if (sortN === 0) clouds.sort(cam); else if (sortN === 1) wisps.sort(cam); else high.sort(cam);

      // aeronave: sombra projetada e sopro das turbinas na água
      fwd.set(1, 0, 0).applyQuaternion(plane.quat); rgt.set(0, 0, 1).applyQuaternion(plane.quat); up.set(0, 1, 0).applyQuaternion(plane.quat);
      (U.uPlP.value as THREE.Vector3).copy(plane.pos); (U.uPlF.value as THREE.Vector3).copy(fwd); (U.uPlR.value as THREE.Vector3).copy(rgt); (U.uPlU.value as THREE.Vector3).copy(up);
      (U.uPlD.value as THREE.Vector4).set(plane.len, plane.span, plane.radius, plane.crashedWater ? 0 : 0.62);
      const jx = plane.pos.x - fwd.x * plane.len * 0.35, jz = plane.pos.z - fwd.z * plane.len * 0.35;
      const belly = plane.pos.y - plane.axisH * 0.6 - seaY;
      const overWater = isWater(jx, jz);
      const wash = plane.flying ? jetWash(belly, plane.V, plane.len, overWater) : 0;
      const R = 5 + plane.len * 0.45 + Math.max(0, belly) * 0.15;
      ls.local.uJet.value.set(jx, jz, wash, R);
      { const hl = Math.hypot(fwd.x, fwd.z) || 1; ls.local.uJetDir.value.set(fwd.x / hl, fwd.z / hl); }
      trailT -= dt;
      if (wash > 0.02 && trailT <= 0) { trailT = 0.15; trail.unshift({ x: jx, z: jz, age: 0, w: wash }); if (trail.length > 8) trail.length = 8; }
      for (const t of trail) t.age += dt;
      while (trail.length && trail[trail.length - 1].age > 7) trail.pop();
      const TR = ls.local.uTrail.value;
      for (let i = 0; i < 8; i++) { const t = trail[i]; if (t) TR[i].set(t.x, t.z, t.age, t.w); else TR[i].set(0, 0, 0, 0); }
      // a água levanta: gotas, coroa e névoa atrás do avião
      if (wash > 0.02) {
        const nDrops = wash * 600 * dt, nMist = wash * 60 * dt;
        for (let k = 0; k < nDrops + Math.random(); k++) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R * 1.2;
          const out = 1.5 + Math.random() * 5 * wash;
          spray.emit(jx + Math.cos(a) * r, seaY + 0.1, jz + Math.sin(a) * r, Math.cos(a) * out - fwd.x * plane.V * 0.07, (4 + Math.random() * 12) * wash, Math.sin(a) * out - fwd.z * plane.V * 0.07, 0.12 + Math.random() * 0.22, 0.7 + Math.random() * 0.8, 0);
        }
        for (let k = 0; k < nMist + Math.random() * 0.4; k++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * R;
          spray.emit(jx + Math.cos(a) * r, seaY + 0.6, jz + Math.sin(a) * r, -fwd.x * plane.V * 0.05 + Math.cos(a) * 1.5, 4 + Math.random() * 6 * wash, -fwd.z * plane.V * 0.05 + Math.sin(a) * 1.5, 3 + Math.random() * 3.2 * wash, 1.8 + Math.random() * 1.6, 1);
        }
      }
      // mergulho na água: explosão de água
      if (plane.crashedWater && !wasCrashed) {
        for (let k = 0; k < 6; k++) spray.splash(plane.pos.x + (Math.random() - 0.5) * plane.len, seaY, plane.pos.z + (Math.random() - 0.5) * plane.len, 3);
        sfx('impact', plane.pos.x, seaY, plane.pos.z, 1);
      }
      wasCrashed = plane.crashedWater;
      spray.update(dt, seaY);
      // vida
      life.update(dt, time, cam, I.camDir, plane.pos, wash, jx, jz);
      // telemetria para o áudio
      TEL.wash = wash;
      TEL.sea = Math.max(0, Math.min(1, 1 - (cam.y - seaY) / 160)) * (isWater(cam.x, cam.z) ? 1 : 0.35);
    },
    hideLife() { life.hide(); spray.clear(); TEL.wash = 0; TEL.sea = 0; TEL.sfx.length = 0; },
    dispose() {
      ls.dispose(); clouds.dispose(); high.dispose(); wisps.dispose(); spray.dispose(); life.dispose();
      tex.dispose(); cShadowTex.dispose(); rwTex.dispose(); rwMat.dispose(); sky.geometry.dispose(); skyM.dispose(); runway.geometry.dispose(); lampGeo.dispose(); lampMat.dispose();
      envTex?.dispose();
    },
  };
}
export type FlightWorld = ReturnType<typeof createFlightWorld>;
