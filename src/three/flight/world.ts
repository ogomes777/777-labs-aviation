import * as THREE from 'three';
import { ISLAND } from './terrain';

/**
 * Mundo do test drive (sem imagens chapadas): terra procedural em volta do aeródromo da Frota
 * (talhões, matas, cercas vivas), praia e oceano com ondas, reflexo do céu e brilho do sol; e um campo
 * de nuvens volumétricas em billboards que se repetem em volta da câmera sem emenda.
 * Tudo em 2 draw calls, sem texturas externas.
 */
const NOISE = /* glsl */ `
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
`;

export function createFlightWorld(gy: number) {
  const group = new THREE.Group();
  group.name = 'flight-world';
  group.visible = false;

  // ---------- terra + mar ----------
  const earthU = {
    uCam: { value: new THREE.Vector3() },
    uSun: { value: new THREE.Vector3(-0.6, 0.25, 0.75).normalize() },
    uSunCol: { value: new THREE.Color('#ffd7a1') },
    uSky: { value: new THREE.Color('#6f93c4') },
    uHaze: { value: new THREE.Color('#e7c7ac') },
    uDeep: { value: new THREE.Color('#0d2c45') },
    uShallow: { value: new THREE.Color('#1f6d7c') },
    uTime: { value: 0 },
    uFog: { value: 0.00011 },
  };
  const earthM = new THREE.ShaderMaterial({
    uniforms: earthU, fog: false, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vW; uniform vec3 uCam, uSun, uSunCol, uSky, uHaze, uDeep, uShallow; uniform float uTime, uFog;
      ${NOISE}
      void main(){
        vec2 p = vW.xz;
        vec3 V = normalize(vW - uCam);
        float d = length(vW - uCam);
        // tamanho do pixel no chão: detalhes finos somem com a distância (sem serrilhado/cintilação lá do alto)
        float px = length(fwidth(p));
        float fine = 1.0 - smoothstep(14.0, 60.0, px);
        float micro = 1.0 - smoothstep(2.0, 10.0, px);
        // continente e ilha (mesma geografia de terrain.ts)
        vec2 q = (p - vec2(-500.0, 900.0)) * vec2(1.0, 1.25);
        float coast = length(q) - (3500.0 + 1300.0 * (fbm(p * 0.00042) - 0.5) * 2.0 + 260.0 * fbm(p * 0.003));
        float isl = (length((p - vec2(-9800.0, 600.0)) / vec2(1150.0, 640.0)) - (1.0 + 0.12 * (fbm(p * 0.002) - 0.5) * 2.0)) * 900.0;
        float shore = min(coast, isl);
        // terra: talhões, matas, cercas vivas (detalhe só quando cabe no pixel)
        vec2 fs = vec2(150.0, 96.0);
        vec2 cell = floor((p + vec2(fbm(p * 0.004) * 40.0)) / fs);
        float r = hash(cell);
        vec3 avgLand = vec3(0.30, 0.31, 0.18);
        vec3 land = mix(vec3(0.24, 0.28, 0.15), vec3(0.40, 0.35, 0.20), step(0.52, r));
        land = mix(land, vec3(0.30, 0.34, 0.17), step(0.78, r));
        land = mix(land, vec3(0.47, 0.41, 0.27), step(0.93, r));
        land *= 0.86 + 0.28 * mix(0.5, noise(p * 0.06), micro);
        vec2 f = fract(p / fs);
        float hedge = smoothstep(0.0, 0.035, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
        land *= mix(1.0, 0.76 + 0.24 * hedge, fine);
        land = mix(avgLand, land, fine);
        float forest = smoothstep(0.56, 0.68, fbm(p * 0.0011 + 3.0));
        land = mix(land, vec3(0.09, 0.13, 0.07) * (0.85 + 0.3 * mix(0.5, noise(p * 0.15), micro)), forest);
        // ilha tropical: verde denso
        land = mix(land, vec3(0.10, 0.20, 0.09) * (0.85 + 0.3 * fbm(p * 0.01)), step(isl, 0.0) * step(0.0, coast));
        float apt = smoothstep(1.0, 0.82, length((p - vec2(-640.0, 80.0)) / vec2(1200.0, 380.0)));
        land = mix(land, vec3(0.23, 0.26, 0.16) * (0.92 + 0.16 * mix(0.5, noise(p * 0.3), micro)), apt);
        float iapt = smoothstep(1.0, 0.8, length((p - vec2(-9800.0, 600.0)) / vec2(800.0, 90.0)));
        land = mix(land, vec3(0.24, 0.28, 0.16), iapt);
        land *= 0.62 + 0.55 * max(uSun.y, 0.0) + 0.1;
        vec3 sand = vec3(0.78, 0.69, 0.53) * (0.92 + 0.16 * mix(0.5, noise(p * 0.2), micro));
        // oceano: soma de ondas direcionais (swell + vento) + ondulação fina, tudo com LOD por pixel
        vec2 g = vec2(0.0);
        // ondas: direções e fases quebradas por ruído (sem faixas regulares), amplitudes baixas; textura fina por fbm
        float warp = fbm(p * 0.0016) * 7.0;
        vec4 dirs[4];
        dirs[0] = vec4(normalize(vec2(1.0, 0.35)), 0.013, 0.9);
        dirs[1] = vec4(normalize(vec2(0.6, -1.0)), 0.021, 1.3);
        dirs[2] = vec4(normalize(vec2(-0.5, 1.0)), 0.047, 2.1);
        dirs[3] = vec4(normalize(vec2(1.0, 0.9)), 0.093, 3.0);
        for (int k = 0; k < 4; k++) {
          float fr = dirs[k].z, ph = dot(dirs[k].xy, p) * fr + uTime * dirs[k].w + warp * (1.0 + float(k) * 0.6);
          float lod = 1.0 - smoothstep(0.2, 0.9, px * fr);
          g += dirs[k].xy * cos(ph) * 0.055 * lod;
        }
        vec2 w1 = vec2(fbm(p * 0.03 + uTime * 0.06), fbm(p * 0.03 - uTime * 0.05 + 9.0)) - 0.5;
        g += w1 * 0.42 * (1.0 - smoothstep(6.0, 30.0, px));
        vec2 rip = vec2(noise(p * 0.22 + uTime * 0.5), noise(p * 0.22 - uTime * 0.45 + 7.0)) - 0.5;
        g += rip * 0.3 * micro;
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        float ndv = max(dot(-V, N), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        vec3 R = reflect(V, N);
        vec3 skyR = mix(uHaze * 1.05, uSky, smoothstep(0.0, 0.45, R.y));
        float depth = smoothstep(0.0, 900.0, shore);
        vec3 body = mix(uShallow * 1.15, uDeep * 0.85, depth);
        // luz dentro da água (subsuperfície) nas cristas voltadas ao sol
        body += uShallow * 0.25 * max(dot(N.xz, normalize(uSun.xz)), 0.0) * (1.0 - depth * 0.6);
        vec3 water = mix(body, skyR, fres);
        float sd = max(dot(R, uSun), 0.0);
        float glint = pow(sd, 900.0) * 9.0 + pow(sd, 120.0) * 0.9 * (0.6 + 0.4 * noise(p * 0.6 + uTime)) + pow(sd, 12.0) * 0.08;
        water += uSunCol * glint;
        // espuma: arrebentação na costa + carneirinhos raros nas cristas
        float foam = smoothstep(60.0, 0.0, abs(shore - 30.0 - 9.0 * sin(uTime * 0.7 + p.x * 0.012))) * (0.55 + 0.45 * noise(p * 0.08 + uTime * 0.3));
        float caps = smoothstep(0.62, 0.8, noise(p * 0.013 + uTime * 0.05)) * smoothstep(0.3, 0.55, length(g)) * 0.35 * fine;
        water = mix(water, vec3(0.93, 0.95, 0.95), clamp(foam * 0.8 + caps, 0.0, 1.0));
        vec3 col = shore < 0.0 ? land : shore < 36.0 ? sand : water;
        col = mix(col, sand, smoothstep(-8.0, 0.0, shore) * step(shore, 0.0));
        // perspectiva aérea (mais densa perto do horizonte)
        float fogF = 1.0 - exp(-pow(d * uFog, 1.35));
        col = mix(col, uHaze, clamp(fogF, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const earth = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), earthM);
  earth.rotation.x = -Math.PI / 2;
  earth.scale.set(90000, 90000, 1);
  earth.position.y = gy - 0.45; // abaixo do asfalto com folga (sem briga de profundidade perto da câmera)
  earth.frustumCulled = false;
  earth.renderOrder = -5;
  group.add(earth);

  // ---------- céu atmosférico do voo (espalhamento aproximado + disco/halo do sol + cirros) ----------
  const skyU = {
    uSun: { value: new THREE.Vector3(-0.6, 0.25, 0.75).normalize() }, uTime: { value: 0 },
    uZenith: { value: new THREE.Color('#1f4f9c') }, uHorizon: { value: new THREE.Color('#cfe0f2') }, uHaze: { value: new THREE.Color('#e9dccf') }, uSunCol: { value: new THREE.Color('#fff1d6') },
  };
  const skyM = new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; vec4 pp = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = pp.xyww; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir; uniform vec3 uSun, uZenith, uHorizon, uHaze, uSunCol; uniform float uTime;
      ${NOISE}
      void main(){
        vec3 d = normalize(vDir); float h = d.y; float mu = max(dot(d, uSun), 0.0);
        // Rayleigh aproximado: zênite profundo, horizonte claro e espesso
        vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.42));
        col = mix(col, uHaze, pow(1.0 - clamp(abs(h) * 3.0, 0.0, 1.0), 6.0) * 0.6);
        // Mie: halo largo + coroa + disco do sol
        col += uSunCol * (pow(mu, 6.0) * 0.18 + pow(mu, 60.0) * 0.45 + smoothstep(0.99955, 0.9998, mu) * 14.0);
        // cirros altos: estrias suaves projetadas num plano alto, derivando com o vento
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.08) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
          float ci = fbm(uv * vec2(1.0, 3.2)) * fbm(uv * 0.6 + 4.0);
          float cir = smoothstep(0.24, 0.5, ci) * smoothstep(0.0, 0.18, h) * (1.0 - smoothstep(0.55, 0.95, h));
          col = mix(col, mix(vec3(1.0), uSunCol, 0.35) * (0.92 + 0.3 * pow(mu, 4.0)), cir * 0.55);
        }
        // abaixo do horizonte: névoa do mar (o oceano cobre quase tudo)
        col = mix(col, uHaze * 0.92, smoothstep(0.0, -0.08, h));
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
    for (let x = 120; x < 1930; x += 60) g.fillRect(x, 30.5, 34, 3);           // eixo tracejado
    g.fillRect(0, 2, 2048, 2); g.fillRect(0, 60, 2048, 2);                     // bordas
    for (const x0 of [14, 2048 - 44]) for (let k = 0; k < 8; k++) g.fillRect(x0, 8 + k * 6.2, 30, 3.4); // cabeceiras
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

  // ---------- nuvens volumétricas (billboards em mosaico infinito) ----------
  const tex = (() => {
    // atlas 2×2 de cúmulos: A = densidade, R = luz (topo iluminado, base sombreada — luz "assada" por espessura)
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N * 2; const g = c.getContext('2d')!;
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let t = 0; t < 4; t++) {
      const ox = (t % 2) * N, oy = Math.floor(t / 2) * N;
      const puffs = 90 + t * 25;
      for (let i = 0; i < puffs; i++) {
        const a = rnd() * Math.PI, rr = Math.pow(rnd(), 0.65) * (88 + t * 6);
        const x = ox + 128 + Math.cos(a) * rr * (rnd() > 0.5 ? 1 : -1), y = oy + 160 - Math.sin(a) * rr * (0.5 + t * 0.06) - rnd() * 8;
        const r = 9 + rnd() * 30 * (1 - rr / 150);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,0.26)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.09)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const fade = g.createLinearGradient(0, oy + 160, 0, oy + 200); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(ox, oy + 160, N, N - 160); g.globalCompositeOperation = 'source-over';
    }
    const img = g.getImageData(0, 0, N * 2, N * 2), px = img.data, W = N * 2;
    const dens = new Float32Array(W * W); for (let i = 0; i < W * W; i++) dens[i] = px[i * 4 + 3] / 255;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      // espessura acima do pixel (luz vindo de cima/levemente do sol) → sombra interna
      let acc = 0; for (let k = 1; k <= 7; k++) { const yy = y - k * 5, xx = x + k * 2; if (yy >= 0 && xx < W && (yy % N) < (y % N)) acc += dens[yy * W + xx]; }
      const lit = Math.max(0, Math.min(1, 1 - acc * 0.32));
      const o = (y * W + x) * 4; px[o] = lit * 255; px[o + 1] = lit * 255; px[o + 2] = 255; px[o + 3] = Math.min(255, dens[y * W + x] * 255 * 1.25);
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.premultiplyAlpha = false; return t;
  })();
  const makeClouds = (COUNT: number, TILE: number, y0: number, yr: number, s0: number, sr: number, rel: number, seed: number) => {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
  const offs = new Float32Array(COUNT * 3), sizes = new Float32Array(COUNT * 2);
  let s2 = seed; const rnd2 = () => ((s2 = (s2 * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < COUNT; i++) {
    // cúmulos em grupos (mais realistas que espalhados uniformemente)
    const cluster = Math.floor(i / 6);
    const cx = ((cluster * 0.618034) % 1) * TILE - TILE / 2, cz = ((cluster * 0.414214 + 0.3) % 1) * TILE - TILE / 2;
    offs[i * 3] = cx + (rnd2() - 0.5) * TILE * 0.065;
    offs[i * 3 + 1] = y0 + rnd2() * yr + (i % 6) * 18;
    offs[i * 3 + 2] = cz + (rnd2() - 0.5) * TILE * 0.065;
    const sz = s0 + rnd2() * sr;
    sizes[i * 2] = sz; sizes[i * 2 + 1] = rnd2();
  }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(offs, 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 2));
  geo.instanceCount = COUNT;
  const cloudU = {
    uMap: { value: tex }, uCam: { value: new THREE.Vector3() }, uTile: { value: TILE },
    uLit: { value: new THREE.Color('#fff1e0') }, uShade: { value: new THREE.Color('#9aa4b8') }, uHaze: { value: new THREE.Color('#e7c7ac') },
    uSun: { value: new THREE.Vector3(-0.6, 0.25, 0.75).normalize() }, uFog: { value: 0.00011 }, uOpacity: { value: 1 }, uRel: { value: rel }, uFarNear: { value: rel },
  };
  const cloudM = new THREE.ShaderMaterial({
    uniforms: cloudU, transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `
      attribute vec3 aOff; attribute vec2 aSize; uniform vec3 uCam; uniform float uTile; uniform float uRel; uniform vec3 uSun;
      varying vec2 vUv; varying float vD; varying float vEdge; varying float vSeed; varying float vY; varying float vSil;
      void main(){
        vec3 c = aOff;
        vec2 rel = mod(aOff.xz - uCam.xz + 0.5 * uTile, uTile) - 0.5 * uTile;
        c.xz = uCam.xz + rel; c.y += uCam.y * uRel;
        vEdge = 1.0 - smoothstep(0.36, 0.5, max(abs(rel.x), abs(rel.y)) / uTile);
        vec4 mv = viewMatrix * vec4(c, 1.0);
        float rot = aSize.y * 6.283;
        vec2 corner = position.xy * vec2(1.0, 0.56);
        corner = mat2(cos(rot * 0.08), -sin(rot * 0.08), sin(rot * 0.08), cos(rot * 0.08)) * corner;
        mv.xy += corner * aSize.x;
        vUv = uv; vD = -mv.z; vSeed = aSize.y; vY = position.y;
        vSil = pow(max(dot(normalize(c - uCam), uSun), 0.0), 6.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uLit, uShade, uHaze; uniform float uFog, uOpacity, uFarNear;
      varying vec2 vUv; varying float vD; varying float vEdge; varying float vSeed; varying float vY; varying float vSil;
      void main(){
        vec2 uv = vUv; if (fract(vSeed * 7.0) > 0.5) uv.x = 1.0 - uv.x;
        float tile = floor(vSeed * 3.999);
        uv = uv * 0.5 + vec2(mod(tile, 2.0), floor(tile / 2.0)) * 0.5;
        vec4 tx = texture2D(uMap, uv);
        float a = tx.a;
        vec3 col = mix(uShade * 0.92, uLit * 1.04, tx.r);
        // borda prateada contra o sol (espalhamento para frente)
        col += uLit * vSil * (1.0 - a) * 0.9;
        float fogF = 1.0 - exp(-pow(vD * uFog, 1.35));
        col = mix(col, uHaze, clamp(fogF * 0.85, 0.0, 1.0));
        float near = smoothstep(4.0, 26.0, vD) * mix(smoothstep(40.0, 260.0, vD), 1.0, step(0.5, uFarNear));
        gl_FragColor = vec4(col, a * vEdge * near * uOpacity);
        if (gl_FragColor.a < 0.004) discard;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, cloudM);
  mesh.frustumCulled = false; mesh.renderOrder = 2; group.add(mesh);
  // ordenação de trás para frente (sem "piscar" quando nuvens se sobrepõem)
  const src = { o: offs.slice(), s: sizes.slice() }; const order = Array.from({ length: COUNT }, (_, i) => i); const dist = new Float32Array(COUNT);
  const aO = geo.getAttribute('aOff') as THREE.InstancedBufferAttribute, aS = geo.getAttribute('aSize') as THREE.InstancedBufferAttribute;
  const sort = (cam: THREE.Vector3) => {
    for (let i = 0; i < COUNT; i++) {
      const rx = ((src.o[i * 3] - cam.x + TILE * 0.5) % TILE + TILE) % TILE - TILE * 0.5;
      const rz = ((src.o[i * 3 + 2] - cam.z + TILE * 0.5) % TILE + TILE) % TILE - TILE * 0.5;
      const ry = src.o[i * 3 + 1] + cam.y * rel - cam.y;
      dist[i] = rx * rx + ry * ry + rz * rz;
    }
    order.sort((a, b) => dist[b] - dist[a]);
    for (let k = 0; k < COUNT; k++) { const i = order[k]; offs[k * 3] = src.o[i * 3]; offs[k * 3 + 1] = src.o[i * 3 + 1]; offs[k * 3 + 2] = src.o[i * 3 + 2]; sizes[k * 2] = src.s[i * 2]; sizes[k * 2 + 1] = src.s[i * 2 + 1]; }
    aO.needsUpdate = true; aS.needsUpdate = true;
  };
  return { mesh, u: cloudU, sort, dispose: () => { geo.dispose(); base.dispose(); cloudM.dispose(); } };
  };
  const clouds = makeClouds(220, 14000, gy + 820, 520, 380, 520, 0, 11);
  // nuvens próximas na altitude da aeronave: passam rasgando quando a velocidade sobe
  const wisps = makeClouds(70, 2600, -70, 140, 40, 90, 1, 29);
  wisps.u.uOpacity.value = 0;
  const cloudU = clouds.u;

  let frameN = 0;
  return {
    group, earthU, cloudU, wispU: wisps.u, skyU,
    update(cam: THREE.Vector3, time: number) {
      earth.position.x = cam.x; earth.position.z = cam.z; sky.position.copy(cam); skyU.uTime.value = time;
      earthU.uCam.value.copy(cam); earthU.uTime.value = time;
      cloudU.uCam.value.copy(cam); wisps.u.uCam.value.copy(cam);
      if ((frameN = (frameN + 1) % 3) === 0) { clouds.sort(cam); wisps.sort(cam); }
    },
    dispose() { earth.geometry.dispose(); earthM.dispose(); tex.dispose(); clouds.dispose(); wisps.dispose(); rwTex.dispose(); rwMat.dispose(); sky.geometry.dispose(); skyM.dispose(); runway.geometry.dispose(); lampGeo.dispose(); lampMat.dispose(); },
  };
}
export type FlightWorld = ReturnType<typeof createFlightWorld>;
