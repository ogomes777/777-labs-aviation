import * as THREE from 'three';
import { CLOUD_SHADOW, GEO, GERSTNER, NOISE, PLANE_SHADOW, SKY, WATER } from './glsl';
import type { WorldCfg } from './env';

/**
 * Terra, fundo do mar e superfície da água do test drive.
 * - Relevo: malha radial que segue a câmera; terra plana em volta do aeródromo, praia, e o FUNDO DO MAR na
 *   profundidade real (plataforma rasa cristalina, recife e laguna na ilha, depois o azul profundo).
 *   O fundo é visto através da água com absorção espectral pelo caminho da luz, cáusticas e refração.
 * - Água: ondas de Gerstner (swell + mar de vento), reflexo do céu, brilho do sol, luz atravessando a crista,
 *   carneirinhos, arrebentação na praia e o sopro das turbinas (a água afunda, levanta em anel e ondula).
 * Sem texturas externas; 2 draw calls.
 */

export type SharedU = Record<string, THREE.IUniform>;

/** malha radial (densa no centro, esparsa no horizonte); aSp = espaçamento local (LOD das ondas) */
export function radialGrid(rings: number, segs: number, rMax: number, r0: number) {
  const n = 1 + rings * segs;
  const pos = new Float32Array(n * 3), sp = new Float32Array(n);
  const ratio = Math.pow(rMax / r0, 1 / (rings - 1));
  sp[0] = r0;
  for (let i = 0; i < rings; i++) {
    const r = r0 * Math.pow(ratio, i), s = r * Math.max(ratio - 1, (Math.PI * 2) / segs);
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2, k = 1 + i * segs + j;
      pos[k * 3] = Math.cos(a) * r; pos[k * 3 + 2] = Math.sin(a) * r; sp[k] = s;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < segs; j++) {
    const a = 1 + i * segs + j, b = 1 + i * segs + ((j + 1) % segs), c = a + segs, d = b + segs;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSp', new THREE.BufferAttribute(sp, 1));
  g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  return g;
}

const TERRAIN_VS = /* glsl */ `
  attribute float aSp;
  uniform vec2 uC; uniform float uSeaY;
  varying vec3 vW; varying float vShore; varying float vIsl;
  ${NOISE}
  ${GEO}
  void main(){
    vec2 p = uC + position.xz;
    float isl; float s = shoreD(p, isl);
    float y = s < 0.0 ? uSeaY + 0.35 * smoothstep(0.0, -25.0, s) : uSeaY - bedDepth(s, isl);
    vW = vec3(p.x, y, p.y); vShore = s; vIsl = isl;
    gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
  }`;

const TERRAIN_FS = /* glsl */ `
  varying vec3 vW; varying float vShore; varying float vIsl;
  uniform vec3 uCam; uniform float uTime, uFog;
  ${NOISE}
  ${GEO}
  ${SKY}
  ${WATER}
  ${GERSTNER}
  ${PLANE_SHADOW}
  ${CLOUD_SHADOW}
  void main(){
    vec2 p = vW.xz;
    vec3 V = normalize(vW - uCam);
    float d = length(vW - uCam);
    float px = length(fwidth(p));
    float fine = 1.0 - smoothstep(14.0, 60.0, px);
    float micro = 1.0 - smoothstep(2.0, 10.0, px);
    float isl = vIsl, shore = vShore;
    if (abs(vShore) < 520.0) shore = shoreD(p, isl); // costa nítida por pixel só perto dela
    float shL = planeShadow(vW), shC = cloudShadow(vW);
    float direct = max(uSun.y, 0.0) * (1.0 - 0.62 * shC) * (1.0 - 0.6 * shL);
    vec3 col;
    if (shore < 0.0) {
      // ---------- terra: talhões, matas, cercas vivas, ilha tropical, praia ----------
      vec2 fs = vec2(150.0, 96.0);
      vec2 pw0 = p + vec2(fbm(p * 0.0021) * 160.0, fbm(p * 0.0021 + 7.0) * 160.0);
      vec2 cell = floor(pw0 / fs);
      float r = hash(cell);
      vec3 avgLand = vec3(0.30, 0.31, 0.18);
      vec3 land = mix(vec3(0.24, 0.28, 0.15), vec3(0.40, 0.35, 0.20), step(0.52, r));
      land = mix(land, vec3(0.30, 0.34, 0.17), step(0.78, r));
      land = mix(land, vec3(0.47, 0.41, 0.27), step(0.93, r));
      land *= 0.86 + 0.28 * mix(0.5, noise(p * 0.06), micro);
      vec2 f = fract(pw0 / fs);
      float hedge = smoothstep(0.0, 0.035, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
      land *= mix(1.0, 0.9 + 0.1 * hedge, fine);
      land = mix(avgLand, land, fine);
      float forest = smoothstep(0.56, 0.68, fbm(p * 0.0011 + 3.0));
      land = mix(land, vec3(0.09, 0.13, 0.07) * (0.85 + 0.3 * mix(0.5, noise(p * 0.15), micro)), forest);
      land = mix(land, vec3(0.10, 0.20, 0.09) * (0.85 + 0.3 * fbm(p * 0.01)), isl);
      float apt = smoothstep(1.0, 0.82, length((p - vec2(-640.0, 80.0)) / vec2(1200.0, 380.0)));
      land = mix(land, vec3(0.23, 0.26, 0.16) * (0.92 + 0.16 * mix(0.5, noise(p * 0.3), micro)), apt);
      float iapt = smoothstep(1.0, 0.8, length((p - vec2(-9800.0, 600.0)) / vec2(800.0, 90.0)));
      land = mix(land, vec3(0.24, 0.28, 0.16), iapt);
      vec3 sand = mix(vec3(0.80, 0.71, 0.55), vec3(0.93, 0.87, 0.74), isl) * (0.92 + 0.16 * mix(0.5, noise(p * 0.2), micro));
      float beachW = 40.0 + 70.0 * fbm(p * 0.0021 + 2.0);
      float sandK = smoothstep(-beachW, -beachW * 0.55, shore);
      float scrub = smoothstep(0.45, 0.75, noise(p * 0.05) * 0.6 + (1.0 - sandK) * 0.7);
      vec3 shoreLand = mix(sand, mix(vec3(0.33, 0.36, 0.2), land, 0.5), scrub * (1.0 - sandK));
      vec3 alb = mix(land, shoreLand, smoothstep(-beachW * 1.4, -beachW * 0.4, shore));
      alb = mix(alb, sand * vec3(0.7, 0.68, 0.64), smoothstep(-6.0, 0.0, shore)); // areia molhada na linha d'água
      col = alb * (uSunCol * direct * 1.05 + mix(uZen, uHor, 0.5) * 0.42 + 0.06);
    } else {
      // ---------- fundo do mar visto através da água cristalina ----------
      float below = max(uSeaY - vW.y, 0.0);
      vec2 bp = p;
      #if REFRACT
        float cr; vec3 wn = gerstnerN(p, px * 2.0 + 1.0, cr);
        bp += wn.xz * below * 0.3; // a onda desloca a imagem do fundo (refração)
      #endif
      vec3 sand = mix(vec3(0.80, 0.73, 0.58), vec3(0.95, 0.90, 0.78), isl);
      float rip = sin(dot(bp, vec2(0.83, 0.55)) * 1.6 + noise(bp * 0.25) * 5.0) * 0.5 + 0.5;
      vec3 bed = sand * (0.86 + 0.16 * mix(0.5, rip, micro) + 0.12 * (fbm3(bp * 0.03) - 0.5));
      // rochas com algas
      float rock = smoothstep(0.6, 0.72, fbm(bp * 0.011 + 11.0)) * smoothstep(0.5, 1.5, below);
      vec3 rockC = mix(vec3(0.20, 0.19, 0.16), vec3(0.16, 0.24, 0.12), noise(bp * 0.4)) * (0.65 + 0.55 * mix(0.5, noise(bp * 0.9), micro));
      bed = mix(bed, rockC, rock);
      // pradarias de capim marinho
      float grass = smoothstep(0.52, 0.64, fbm(bp * 0.0065 + 3.0)) * smoothstep(1.5, 4.0, below) * (1.0 - smoothstep(16.0, 24.0, below)) * (1.0 - rock);
      vec3 grassC = vec3(0.07, 0.15, 0.06) * (0.75 + 0.5 * mix(0.5, noise(bp * vec2(1.6, 0.3)), micro));
      bed = mix(bed, grassC, grass * 0.9);
      // recife de coral em volta da ilha
      float reef = exp(-pow((shore - 380.0) / 130.0, 2.0)) * isl * smoothstep(0.45, 0.6, fbm(bp * 0.02 + 5.0));
      vec3 coral = mix(mix(vec3(0.78, 0.46, 0.44), vec3(0.74, 0.58, 0.30), noise(bp * 0.12)), vec3(0.50, 0.36, 0.58), smoothstep(0.6, 0.8, noise(bp * 0.07 + 9.0)));
      bed = mix(bed, coral * (0.7 + 0.5 * mix(0.5, noise(bp * 0.7), micro)), reef);
      bed = mix(bed, vec3(0.42, 0.40, 0.35), smoothstep(18.0, 40.0, below)); // sedimento no fundo
      vec3 dl = downLight(below);
      float caus = 0.0;
      #if CAUSTICS
        caus = caustic(bp * 0.8, uTime * 0.85) * smoothstep(22.0, 0.6, below) * (1.0 - smoothstep(0.35, 1.6, px)) * (1.0 - shL) * (1.0 - 0.7 * shC);
      #endif
      vec3 E = uSunCol * direct * 1.1 * dl * (1.0 + caus * 1.8) + uZen * 0.42 * exp(-WK * below) + 0.03;
      col = underwater(bed * E, vW, V);
    }
    col = mix(col, fogCol(V), aerial(d, uFog));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const WATER_VS = /* glsl */ `
  attribute float aSp;
  uniform vec2 uC; uniform float uSeaY;
  uniform vec4 uJet; uniform vec4 uTrail[8];
  varying vec3 vW; varying float vShore; varying float vIsl; varying float vH; varying float vWash;
  ${NOISE}
  ${GEO}
  ${GERSTNER}
  void main(){
    vec2 p = uC + position.xz;
    float isl; float s = shoreD(p, isl);
    float fade = smoothstep(2.0, 90.0, s) * (1.0 - smoothstep(2600.0, 9000.0, length(position.xz)));
    vec3 d = gerstnerD(p, aSp) * fade;
    float wash = 0.0;
    if (uJet.z > 0.001) {
      vec2 q = p - uJet.xy; float r2 = dot(q, q), R = uJet.w, rr = sqrt(r2);
      d.y -= uJet.z * 0.9 * exp(-r2 / (R * R));                                   // o sopro afunda a água
      d.y += uJet.z * 0.6 * exp(-pow((rr - R * 1.5) / (R * 0.55), 2.0));            // e ela sobe em anel
      wash = uJet.z * exp(-r2 / (R * R * 4.0));
    }
    for (int i = 0; i < 8; i++) {
      vec4 tr = uTrail[i];
      if (tr.w <= 0.001) continue;
      float rr = length(p - tr.xy), R = 3.0 + tr.z * 9.0, env = tr.w * exp(-tr.z * 0.55), x = rr - R;
      d.y += env * 0.5 * sin(x * 0.8) * exp(-x * x / 30.0);                          // ondulação que se espalha
      wash = max(wash, env * exp(-x * x / 40.0) * 0.32);
    }
    vW = vec3(p.x, uSeaY, p.y) + d; vShore = s; vIsl = isl; vH = d.y; vWash = wash;
    gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
  }`;

const WATER_FS = /* glsl */ `
  varying vec3 vW; varying float vShore; varying float vIsl; varying float vH; varying float vWash;
  uniform vec3 uCam; uniform float uTime, uFog, uWind, uAmp; uniform vec2 uWindDir;
  uniform vec4 uJet; uniform vec2 uJetDir;
  ${NOISE}
  ${GEO}
  ${SKY}
  ${WATER}
  ${GERSTNER}
  ${PLANE_SHADOW}
  ${CLOUD_SHADOW}
  void main(){
    vec2 p = vW.xz;
    float isl = vIsl, shore = vShore;
    if (abs(vShore) < 400.0) shore = shoreD(p, isl);
    if (shore < 0.0) discard;
    vec3 V = normalize(vW - uCam);
    float d = length(vW - uCam);
    float px = length(fwidth(p));
    float crest; vec3 N = gerstnerN(p, px, crest);
    // mar de vento: ondulação alongada na direção do vento (não isotrópica), com LOD por pixel
    vec2 wd = uWindDir; vec2 pw = vec2(dot(p, wd), dot(p, vec2(-wd.y, wd.x)));
    float micro = 1.0 - smoothstep(1.5, 9.0, px);
    vec2 w1 = vec2(noise(pw * vec2(0.022, 0.06) + uTime * vec2(0.11, 0.0)), noise(pw * vec2(0.026, 0.07) - uTime * vec2(0.08, 0.01) + 9.0)) - 0.5;
    vec2 rip = vec2(noise(pw * vec2(0.16, 0.42) + uTime * 0.7), noise(pw * vec2(0.19, 0.5) - uTime * 0.6 + 7.0)) - 0.5;
    vec2 w0 = vec2(fbm3(pw * vec2(0.006, 0.016) + uTime * vec2(0.02, 0.0)), fbm3(pw * vec2(0.007, 0.018) - uTime * vec2(0.015, 0.004) + 5.0)) - 0.5;
    vec2 det = w0 * 0.16 * (1.0 - smoothstep(60.0, 220.0, px)) + w1 * 0.09 * (1.0 - smoothstep(4.0, 30.0, px)) + rip * 0.08 * micro;
    N.xz += wd * det.x + vec2(-wd.y, wd.x) * det.y;
    // a água estremece sob o sopro das turbinas
    if (vWash > 0.01) N.xz += (vec2(noise(p * 0.9 + uTime * 3.1), noise(p * 0.9 - uTime * 2.7 + 4.0)) - 0.5) * vWash * 1.1;
    float rough = smoothstep(0.6, 45.0, px);
    N = normalize(vec3(N.x * (1.0 - 0.5 * rough), N.y, N.z * (1.0 - 0.5 * rough)));
    float ndv = max(dot(-V, N), 0.0);
    float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
    vec3 R = reflect(V, N); R.y = abs(R.y);
    vec3 refl = skyCol(R);
    // nuvens refletidas (manchas suaves e grandes)
    float cl = smoothstep(0.5, 0.82, fbm3(R.xz / (R.y + 0.12) * 0.55 + uTime * 0.003));
    refl = mix(refl, uSunCol * 0.9 + uZen * 0.08, cl * 0.22 * smoothstep(0.03, 0.4, R.y));
    float shL = planeShadow(vW), shC = cloudShadow(vW);
    float sunVis = (1.0 - shL * 0.95) * (1.0 - shC * 0.9) * smoothstep(-0.02, 0.08, uSun.y);
    // brilho do sol: espelho perto, trilha de cintilações longe (ondas não resolvidas viram rugosidade)
    float sd = max(dot(R, uSun), 0.0);
    float glintN = 0.6 + 0.4 * noise(p * 0.6 + uTime * 1.3);
    vec3 glint = uSunCol * (pow(sd, mix(1600.0, 60.0, rough)) * mix(22.0, 1.8, rough) + pow(sd, mix(170.0, 12.0, rough)) * mix(0.9, 0.45, rough) * glintN + pow(sd, 9.0) * 0.05) * sunVis;
    // luz atravessando a crista da onda (turquesa) quando se olha para o lado do sol
    vec3 Vh = normalize(vec3(V.x, 0.0, V.z) + 1e-5), Sh = normalize(vec3(uSun.x, 0.0, uSun.z) + 1e-5);
    float sss = pow(max(dot(Vh, Sh), 0.0), 3.0) * smoothstep(-0.15, 1.0, vH / max(uAmp, 0.1)) * (1.0 - ndv) * (1.0 - rough * 0.7);
    vec3 sssC = vec3(0.06, 0.46, 0.40) * uSunCol * sss * 0.42 * sunVis;
    // espuma: carneirinhos (vento), arrebentação na praia e o sopro das turbinas
    float fine = 1.0 - smoothstep(10.0, 60.0, px);
    // textura de espuma orgânica (ruído girado em camadas: bolhas e veios, sem grade aparente)
    vec2 fp = mat2(0.8, -0.6, 0.6, 0.8) * p;
    float ftex = smoothstep(0.32, 0.72, fbm3(fp * 0.55 + vec2(uTime * 0.35, -uTime * 0.2)) * 0.65 + fbm3(fp * 2.3 - uTime * 0.6) * 0.35 * micro + 0.12);
    float streak = noise(pw * vec2(0.035, 0.12) + uTime * 0.05);
    float foam = smoothstep(0.84 - uWind * 0.028, 1.0, crest / max(0.55 + uWind * 0.03, 0.1)) * smoothstep(0.35, 0.8, streak) * fine;
    float br = sin(shore * 0.12 - uTime * 1.3 + fbm3(p * 0.01) * 6.0);
    foam += smoothstep(52.0, 0.0, shore - 4.0) * smoothstep(0.35, 1.0, br) * (0.4 + 0.6 * ftex);
    foam += smoothstep(8.0, 0.0, shore) * 0.65;
    foam += vWash * (0.35 + 0.65 * ftex);
    if (uJet.z > 0.01) {
      // esteira: água branca turbulenta atrás das turbinas e o V da esteira se abrindo
      vec2 q = p - uJet.xy; float al = -dot(q, uJetDir), ac = dot(q, vec2(-uJetDir.y, uJetDir.x));
      float behind = smoothstep(-4.0, 6.0, al) * (1.0 - smoothstep(30.0, 90.0, al));
      float churn = behind * smoothstep(uJet.w * 0.75, 0.0, abs(ac)) * (0.3 + 0.7 * ftex);
      float vw = behind * exp(-pow((abs(ac) - max(al, 0.0) * 0.354 - uJet.w * 0.4) / (2.0 + al * 0.05), 2.0)) * (0.35 + 0.65 * ftex);
      foam += uJet.z * (churn * 1.1 + vw * 0.7);
    }
    foam = clamp(foam * (0.7 + 0.3 * fbm3(fp * 0.21 + uTime * 0.1)), 0.0, 1.0);
    vec3 foamC = vec3(0.93, 0.96, 0.97) * (uSunCol * max(uSun.y, 0.0) * (0.35 + 0.65 * sunVis) * 0.95 + uZen * 0.32 + 0.12);
    float fogF = aerial(d, uFog);
    float A = clamp(F + foam * (1.0 - F), 0.0, 1.0);
    vec3 C = (refl * F + glint + sssC) * (1.0 - foam) + foamC * foam;
    C = C * (1.0 - fogF) + fogCol(V) * fogF * A;
    gl_FragColor = vec4(C, A);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createLandSea(U: SharedU, cfg: WorldCfg) {
  const local = {
    uC: { value: new THREE.Vector2() },
    uJet: { value: new THREE.Vector4() }, uJetDir: { value: new THREE.Vector2(1, 0) },
    uTrail: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
    uWind: { value: 6 }, uWindDir: { value: new THREE.Vector2(1, 0) }, uAmp: { value: 1 },
  };
  const defs = { WAVES: cfg.waves, CAUSTICS: 1, REFRACT: 1 };
  const terrM = new THREE.ShaderMaterial({ uniforms: { ...U, ...local }, defines: defs, vertexShader: TERRAIN_VS, fragmentShader: TERRAIN_FS, fog: false, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  const waterM = new THREE.ShaderMaterial({
    uniforms: { ...U, ...local }, defines: defs, vertexShader: WATER_VS, fragmentShader: WATER_FS, fog: false,
    transparent: true, depthWrite: true, premultipliedAlpha: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
  const terrain = new THREE.Mesh(radialGrid(cfg.terrRings, cfg.terrSegs, 46000, 3), terrM);
  terrain.frustumCulled = false; terrain.renderOrder = -5; terrain.name = 'flight-terrain';
  const water = new THREE.Mesh(radialGrid(cfg.oceanRings, cfg.oceanSegs, 46000, 2), waterM);
  water.frustumCulled = false; water.renderOrder = -4; water.name = 'flight-water';

  return {
    terrain, water, local,
    update(cam: THREE.Vector3) { local.uC.value.set(cam.x, cam.z); },
    dispose() { terrain.geometry.dispose(); water.geometry.dispose(); terrM.dispose(); waterM.dispose(); },
  };
}
