import * as THREE from 'three';

export const SKY_PALETTES = {
  dawn: { zenith: '#4f7fb3', horizon: '#efbfae', glow: '#ffc79c', below: '#d9c0c4', lit: '#fbe6d8', shade: '#8a8fb4', deep: '#5c6590', haze: '#e6bfb6' },
  dusk: { zenith: '#5d6f8e', horizon: '#e8b98f', glow: '#ffc58e', below: '#d7b49a', lit: '#ffe2c2', shade: '#8c7f93', deep: '#5d5a72', haze: '#e3b996' },
};
export type SkyPalette = typeof SKY_PALETTES.dawn;

const NOISE = /* glsl */ `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p, int oct){ float a = 0.5, s = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++){ if (i >= oct) break; s += a * noise(p); p = m * p; a *= 0.5; } return s; }
`;

/** Cúpula do céu: gradiente zênite→horizonte + halo solar. */
export function createSkyDome(palette: SkyPalette) {
  const uniforms = {
    uZenith: { value: new THREE.Color(palette.zenith) },
    uHorizon: { value: new THREE.Color(palette.horizon) },
    uGlow: { value: new THREE.Color(palette.glow) },
    uBelow: { value: new THREE.Color(palette.below) },
    uSun: { value: new THREE.Vector3(-0.78, 0.2, 0.6).normalize() },
    uOpacity: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth, transparent: true, fog: false,
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir; uniform vec3 uZenith, uHorizon, uGlow, uBelow, uSun; uniform float uOpacity;
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        float t = pow(clamp(1.0 - max(h, 0.0) * 1.6, 0.0, 1.0), 3.2);
        vec3 col = mix(uZenith, uHorizon, t);
        float s = max(dot(d, uSun), 0.0);
        col += uGlow * (pow(s, 6.0) * 0.28 + pow(s, 48.0) * 0.45 + pow(s, 1200.0) * 3.0);
        col = mix(col, uBelow, smoothstep(0.0, -0.2, h));
        gl_FragColor = vec4(col, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

/** Mar de nuvens: plano infinito (segue a câmera) com fbm em domain-warp e luz por gradiente na direção do sol. */
export function createCloudSea(palette: SkyPalette, octaves: number) {
  const uniforms = {
    uTime: { value: 0 },
    uSun: { value: new THREE.Vector3(-0.78, 0.2, 0.6).normalize() },
    uLit: { value: new THREE.Color(palette.lit) },
    uShade: { value: new THREE.Color(palette.shade) },
    uDeep: { value: new THREE.Color(palette.deep) },
    uHaze: { value: new THREE.Color(palette.haze) },
    uCam: { value: new THREE.Vector3() },
    uOpacity: { value: 1 },
    uScale: { value: 0.0032 },
    uFlow: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vW; uniform float uTime, uOpacity, uScale, uFlow; uniform vec3 uSun, uLit, uShade, uDeep, uHaze, uCam;
      ${NOISE}
      float dens(vec2 p){
        vec2 q = vec2(fbm(p * 0.5 + vec2(0.0, uTime * 0.006), 3), fbm(p * 0.5 + vec2(5.2, 1.3), 3));
        float base = fbm(p * 0.9 + 1.8 * q, ${Math.min(octaves, 5)});
        float detail = fbm(p * 4.2 + q * 3.0, 3);
        return base * 0.8 + detail * 0.27;
      }
      void main(){
        vec2 p = vW.xz * uScale + vec2(uFlow, uTime * 0.003);
        float d = dens(p);
        float cov = smoothstep(0.44, 0.6, d);
        vec2 sd = normalize(uSun.xz) * 0.03;
        float ds = dens(p + sd);
        float lit = clamp(0.5 + (d - ds) * 9.0, 0.0, 1.0);
        float ao = smoothstep(0.38, 0.82, d);
        vec3 col = mix(uShade, uLit, lit);
        col *= mix(0.7, 1.07, ao);
        float edge = 1.0 - smoothstep(0.44, 0.53, d);
        col += uLit * edge * lit * 0.28;
        col = mix(uDeep, col, cov);
        float dist = length(vW.xz - uCam.xz);
        float fog = 1.0 - exp(-dist / 2600.0);
        col = mix(col, uHaze, clamp(fog * 1.08, 0.0, 1.0));
        gl_FragColor = vec4(col, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -9;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

/** Textura de "puff" de nuvem gerada em canvas (sem asset externo). */
function puffTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const hash = (x: number, y: number) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c2 = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v;
  };
  const fbm = (x: number, y: number) => { let s = 0, a = 0.5; for (let i = 0; i < 5; i++) { s += a * noise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = x / size - 0.5, ny = (y / size - 0.5) * 1.5;
    const r = Math.sqrt(nx * nx + ny * ny) * 2;
    const n = fbm(x / 34 + 3.1, y / 34 + 7.7);
    const v = Math.max(0, Math.min(1, (n * 1.25 - r * 0.95 + 0.12) * 3.2));
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(v * v * 210);
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

/** Véus de nuvem instanciados (billboard no vertex shader), com fade por proximidade da câmera. */
export function createCloudPuffs(palette: SkyPalette, count: number) {
  const tex = puffTexture();
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));
  const offs = new Float32Array(count * 3), sizes = new Float32Array(count), rots = new Float32Array(count);
  let seed = 29;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    // concentração no corredor da câmera do hero (x: -40..70, z: 6..90) + campo distante
    const near = i < count * 0.6;
    const stream = i < count * 0.28; // na altitude do jato, vistos pelas janelas
    const sideZ = rnd() > 0.5 ? 1 : -1;
    // perto: abaixo/à frente do jato; stream: altitude da cabine nas laterais; longe: campo de profundidade
    const x = near ? -70 + rnd() * 160 : -500 + rnd() * 1000;
    const z = stream ? (sideZ > 0 ? 48 + rnd() * 110 : -(26 + rnd() * 110)) : near ? -30 + rnd() * 110 : -700 + rnd() * 900;
    const y = stream ? -9 + rnd() * 13 : near ? -34 + rnd() * 26 : -60 + rnd() * 30;
    offs.set([x, y, z], i * 3);
    sizes[i] = near ? 10 + rnd() * 20 : 70 + rnd() * 130;
    rots[i] = rnd() * Math.PI * 2;
  }
  geo.setAttribute('offset', new THREE.InstancedBufferAttribute(offs, 3));
  geo.setAttribute('size', new THREE.InstancedBufferAttribute(sizes, 1));
  geo.setAttribute('rot', new THREE.InstancedBufferAttribute(rots, 1));
  geo.instanceCount = count;
  const uniforms = {
    uMap: { value: tex },
    uLit: { value: new THREE.Color(palette.lit) },
    uShade: { value: new THREE.Color(palette.shade) },
    uHaze: { value: new THREE.Color(palette.haze) },
    uOpacity: { value: 1 },
    uTime: { value: 0 },
    uFlow: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `
      attribute vec3 offset; attribute float size; attribute float rot;
      uniform float uTime; uniform float uFlow; varying vec2 vUv; varying float vFade; varying float vDist;
      void main(){
        vUv = uv;
        vec3 o = offset;
        float near = step(size, 60.0);
        float span = mix(1000.0, 260.0, near);
        o.x = mod(offset.x - uFlow + span * 0.5, span) - span * 0.5 + (near > 0.5 ? 10.0 : 0.0);
        float wrapFade = smoothstep(-span * 0.5, -span * 0.38, o.x) * (1.0 - smoothstep(span * 0.38, span * 0.5, o.x));
        vec4 mv = viewMatrix * modelMatrix * vec4(o, 1.0);
        float c = cos(rot), s = sin(rot * 0.15);
        vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
        mv.xy += q * vec2(size, size * 0.62);
        float dist = -mv.z; vDist = dist;
        vFade = wrapFade * smoothstep(5.0, 38.0, dist) * (1.0 - smoothstep(900.0, 1600.0, dist));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uLit, uShade, uHaze; uniform float uOpacity;
      varying vec2 vUv; varying float vFade; varying float vDist;
      void main(){
        float a = texture2D(uMap, vUv).a;
        vec3 col = mix(uShade, uLit, smoothstep(0.15, 0.85, vUv.y));
        col = mix(col, uHaze, clamp(vDist / 1400.0, 0.0, 0.85));
        gl_FragColor = vec4(col, a * vFade * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return { mesh, uniforms, dispose: () => { tex.dispose(); geo.dispose(); base.dispose(); mat.dispose(); } };
}

export function lerpPalette(a: SkyPalette, b: SkyPalette, t: number, out: Record<string, THREE.Color>) {
  for (const k of Object.keys(a) as (keyof SkyPalette)[]) {
    (out[k] ??= new THREE.Color()).set(a[k]).lerp(new THREE.Color(b[k]), t);
  }
  return out;
}
