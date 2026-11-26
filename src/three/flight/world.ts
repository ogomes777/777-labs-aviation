import * as THREE from 'three';

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
    uniforms: earthU, fog: false, polygonOffset: true, polygonOffsetFactor: 8, polygonOffsetUnits: 8,
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vW; uniform vec3 uCam, uSun, uSunCol, uSky, uHaze, uDeep, uShallow; uniform float uTime, uFog;
      ${NOISE}
      void main(){
        vec2 p = vW.xz;
        // costa: o aeródromo fica numa planície; o mar começa a ~3,5 km, com recortes irregulares
        vec2 q = (p - vec2(-500.0, 900.0)) * vec2(1.0, 1.25);
        float coast = length(q) - (3500.0 + 1300.0 * (fbm(p * 0.00042) - 0.5) * 2.0 + 260.0 * fbm(p * 0.003));
        // terra: talhões, matas e cercas vivas
        vec2 fs = vec2(150.0, 96.0);
        vec2 cell = floor((p + vec2(fbm(p * 0.004) * 40.0)) / fs);
        float r = hash(cell);
        vec3 land = mix(vec3(0.24, 0.28, 0.15), vec3(0.40, 0.35, 0.20), step(0.52, r));
        land = mix(land, vec3(0.30, 0.34, 0.17), step(0.78, r));
        land = mix(land, vec3(0.47, 0.41, 0.27), step(0.93, r));
        land *= 0.86 + 0.28 * noise(p * 0.06);
        vec2 f = fract(p / fs);
        float hedge = smoothstep(0.0, 0.035, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
        land *= 0.74 + 0.26 * hedge;
        float forest = smoothstep(0.56, 0.68, fbm(p * 0.0011 + 3.0));
        land = mix(land, vec3(0.09, 0.13, 0.07) * (0.8 + 0.4 * noise(p * 0.15)), forest);
        // o próprio aeródromo: grama aparada uniforme sob pistas e pátio
        float apt = smoothstep(1.0, 0.82, length((p - vec2(-640.0, 80.0)) / vec2(1200.0, 380.0)));
        land = mix(land, vec3(0.23, 0.26, 0.16) * (0.92 + 0.16 * noise(p * 0.3)), apt);
        land *= 0.62 + 0.55 * max(uSun.y, 0.0) + 0.1;
        // praia
        vec3 sand = vec3(0.74, 0.65, 0.50) * (0.9 + 0.2 * noise(p * 0.2));
        // oceano: normal por ruído animado, fresnel com o céu e reflexo do sol
        vec3 V = normalize(vW - uCam);
        float d = length(vW - uCam);
        float sc = d < 1500.0 ? 1.0 : 0.35;
        vec2 w1 = vec2(fbm(p * 0.035 * sc + uTime * 0.07), fbm(p * 0.035 * sc - uTime * 0.06 + 9.0)) - 0.5;
        vec2 w2 = vec2(noise(p * 0.18 + uTime * 0.4), noise(p * 0.18 - uTime * 0.35 + 3.0)) - 0.5;
        float near = 1.0 - smoothstep(600.0, 4000.0, d);
        vec3 N = normalize(vec3((w1.x + w2.x * near * 0.6) * 0.5, 1.0, (w1.y + w2.y * near * 0.6) * 0.5));
        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(-V, N), 0.0), 5.0);
        vec3 R = reflect(V, N);
        vec3 skyR = mix(uHaze, uSky, clamp(R.y * 2.2, 0.0, 1.0));
        vec3 water = mix(uShallow, uDeep, smoothstep(0.0, 700.0, coast));
        water = mix(water, skyR, fres);
        water += uSunCol * (pow(max(dot(R, uSun), 0.0), 420.0) * 6.0 + pow(max(dot(R, uSun), 0.0), 30.0) * 0.18);
        float foam = smoothstep(55.0, 0.0, abs(coast - 30.0 - 8.0 * sin(uTime * 0.8 + p.x * 0.01))) * (0.55 + 0.45 * noise(p * 0.08 + uTime * 0.3));
        water = mix(water, vec3(0.92, 0.93, 0.9), foam * 0.75);
        vec3 col = coast < 0.0 ? land : coast < 34.0 ? sand : water;
        col = mix(col, sand, smoothstep(-8.0, 0.0, coast) * step(coast, 0.0));
        // perspectiva aérea
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
  earth.position.y = gy - 0.08;
  earth.frustumCulled = false;
  earth.renderOrder = -5;
  group.add(earth);

  // ---------- nuvens volumétricas (billboards em mosaico infinito) ----------
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d')!;
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 46; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 78, x = 128 + Math.cos(a) * rr, y = 136 + Math.sin(a) * rr * 0.55, r = 26 + rnd() * 46;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.42)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
  })();
  const COUNT = 220, TILE = 14000;
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
  const offs = new Float32Array(COUNT * 3), sizes = new Float32Array(COUNT * 2);
  let s2 = 11; const rnd2 = () => ((s2 = (s2 * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < COUNT; i++) {
    // cúmulos em grupos (mais realistas que espalhados uniformemente)
    const cluster = Math.floor(i / 6);
    const cx = ((cluster * 0.618034) % 1) * TILE - TILE / 2, cz = ((cluster * 0.414214 + 0.3) % 1) * TILE - TILE / 2;
    offs[i * 3] = cx + (rnd2() - 0.5) * 900;
    offs[i * 3 + 1] = gy + 820 + rnd2() * 520 + (i % 6) * 18;
    offs[i * 3 + 2] = cz + (rnd2() - 0.5) * 900;
    const sz = 380 + rnd2() * 520;
    sizes[i * 2] = sz; sizes[i * 2 + 1] = rnd2();
  }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(offs, 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 2));
  geo.instanceCount = COUNT;
  const cloudU = {
    uMap: { value: tex }, uCam: { value: new THREE.Vector3() }, uTile: { value: TILE },
    uLit: { value: new THREE.Color('#fff1e0') }, uShade: { value: new THREE.Color('#9aa4b8') }, uHaze: { value: new THREE.Color('#e7c7ac') },
    uSun: { value: new THREE.Vector3(-0.6, 0.25, 0.75).normalize() }, uFog: { value: 0.00011 }, uOpacity: { value: 1 },
  };
  const cloudM = new THREE.ShaderMaterial({
    uniforms: cloudU, transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `
      attribute vec3 aOff; attribute vec2 aSize; uniform vec3 uCam; uniform float uTile;
      varying vec2 vUv; varying float vD; varying float vEdge; varying float vSeed; varying float vY;
      void main(){
        vec3 c = aOff;
        vec2 rel = mod(aOff.xz - uCam.xz + 0.5 * uTile, uTile) - 0.5 * uTile;
        c.xz = uCam.xz + rel;
        vEdge = 1.0 - smoothstep(0.36, 0.5, max(abs(rel.x), abs(rel.y)) / uTile);
        vec4 mv = viewMatrix * vec4(c, 1.0);
        float rot = aSize.y * 6.283;
        vec2 corner = position.xy * vec2(1.0, 0.56);
        corner = mat2(cos(rot * 0.08), -sin(rot * 0.08), sin(rot * 0.08), cos(rot * 0.08)) * corner;
        mv.xy += corner * aSize.x;
        vUv = uv; vD = -mv.z; vSeed = aSize.y; vY = position.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uLit, uShade, uHaze; uniform float uFog, uOpacity;
      varying vec2 vUv; varying float vD; varying float vEdge; varying float vSeed; varying float vY;
      void main(){
        vec2 uv = vUv; if (vSeed > 0.5) uv.x = 1.0 - uv.x;
        float a = texture2D(uMap, uv).r;
        vec3 col = mix(uShade, uLit, smoothstep(-0.35, 0.4, vY));
        float fogF = 1.0 - exp(-pow(vD * uFog, 1.35));
        col = mix(col, uHaze, clamp(fogF * 0.85, 0.0, 1.0));
        float near = smoothstep(40.0, 260.0, vD);
        gl_FragColor = vec4(col, a * vEdge * near * uOpacity);
        if (gl_FragColor.a < 0.004) discard;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const clouds = new THREE.Mesh(geo, cloudM);
  clouds.frustumCulled = false;
  clouds.renderOrder = 2;
  group.add(clouds);

  return {
    group, earthU, cloudU,
    update(cam: THREE.Vector3, time: number) {
      earth.position.x = cam.x; earth.position.z = cam.z;
      earthU.uCam.value.copy(cam); earthU.uTime.value = time;
      cloudU.uCam.value.copy(cam);
    },
    dispose() { earth.geometry.dispose(); earthM.dispose(); tex.dispose(); geo.dispose(); base.dispose(); cloudM.dispose(); },
  };
}
export type FlightWorld = ReturnType<typeof createFlightWorld>;
