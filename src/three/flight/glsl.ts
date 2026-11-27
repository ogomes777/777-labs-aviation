/**
 * Blocos GLSL compartilhados do mundo do test drive: o céu, o mar, o fundo, a vida e as nuvens
 * usam as MESMAS funções (a cor do céu refletida no mar é a cor do céu; a névoa é o horizonte daquela direção).
 */

export const NOISE = /* glsl */ `
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
  float fbm3(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
`;

/** geografia (mesma de terrain.ts) e profundidade do fundo (mesma de env.ts) */
export const GEO = /* glsl */ `
  float coastD(vec2 p){ vec2 q = (p - vec2(-500.0, 900.0)) * vec2(1.0, 1.25); return length(q) - (3500.0 + 1300.0 * (fbm(p * 0.00042) - 0.5) * 2.0 + 260.0 * fbm(p * 0.003)); }
  float islandD(vec2 p){ return (length((p - vec2(-9800.0, 600.0)) / vec2(1150.0, 640.0)) - (1.0 + 0.12 * (fbm(p * 0.002) - 0.5) * 2.0)) * 900.0; }
  float shoreD(vec2 p, out float isl){ float c = coastD(p), i = islandD(p); isl = step(i, c); return min(c, i); }
  float bedDepth(float s, float isl){
    if (s <= 0.0) return 0.0;
    float d = 0.3 + 6.0 * (1.0 - exp(-s / 450.0)) + 10.0 * smoothstep(mix(500.0, 450.0, isl), mix(1700.0, 1100.0, isl), s) + 65.0 * smoothstep(mix(1700.0, 1100.0, isl), mix(4600.0, 2800.0, isl), s);
    float reef = exp(-pow((s - 380.0) / 75.0, 2.0)) * isl;
    return d - reef * max(0.0, d - 0.9) * 0.85;
  }
`;

/** céu calibrado pela elevação do sol (cores calculadas na CPU, função barata aqui) */
export const SKY = /* glsl */ `
  uniform vec3 uSun, uSunCol, uZen, uHor, uHorSun, uHaze;
  vec3 skyCol(vec3 d){
    float h = d.y, mu = dot(d, uSun);
    float hh = clamp(h, 0.0, 1.0);
    float side = pow(clamp(mu * 0.5 + 0.5, 0.0, 1.0), 3.0);
    vec3 hor = mix(uHor, uHorSun, side * (1.0 - smoothstep(0.0, 0.55, hh)));
    vec3 col = mix(hor, uZen, pow(hh, 0.48));
    col += uHorSun * 0.1 * exp(-abs(h) * 22.0);
    float m = max(mu, 0.0);
    col += uSunCol * (pow(m, 7.0) * 0.2 + pow(m, 80.0) * 0.42);
    return mix(col, uHaze, smoothstep(0.0, -0.08, h));
  }
  /** perspectiva aérea: o longe se funde ao horizonte daquela direção (mais quente para o lado do sol) */
  vec3 fogCol(vec3 V){ return mix(skyCol(normalize(vec3(V.x, 0.015, V.z))), uHaze, 0.42); }
  float aerial(float d, float k){ return clamp(1.0 - exp(-pow(d * k, 1.35)), 0.0, 1.0); }
`;

/** ondas de Gerstner: fases relativas à câmera (calculadas na CPU) — sem perda de precisão longe da origem */
export const GERSTNER = /* glsl */ `
  uniform vec4 uWA[WAVES]; // dir.x, dir.z, amplitude, k
  uniform vec4 uWB[WAVES]; // ômega, fase no ponto de origem, Q, -
  uniform vec2 uWO;        // origem das fases (câmera)
  vec3 gerstnerD(vec2 p, float spacing){
    vec3 d = vec3(0.0); vec2 r = p - uWO;
    vec2 wq = vec2(noise(p * 0.0031), noise(p * 0.0031 + 7.3)) - 0.5 + (vec2(noise(p * 0.012 + 3.1), noise(p * 0.012 + 9.4)) - 0.5) * 0.45; // fases quebradas por ruído em duas escalas: sem padrão repetido
    for (int i = 0; i < WAVES; i++){
      vec4 a = uWA[i], b = uWB[i];
      float lam = 6.2831853 / a.w;
      float A = a.z * (1.0 - smoothstep(lam * 0.12, lam * 0.3, spacing));
      float Q = b.z / (a.w * a.z * float(WAVES) + 1e-4);
      float fi = float(i), f = a.w * dot(a.xy, r) + b.y + (wq.x * cos(fi * 1.7) + wq.y * sin(fi * 1.7)) * (3.2 + fi * 1.2);
      d.xz += Q * A * a.xy * cos(f);
      d.y += A * sin(f);
    }
    return d;
  }
  vec3 gerstnerN(vec2 p, float px, out float crest){
    vec3 n = vec3(0.0, 1.0, 0.0); crest = 0.0; vec2 r = p - uWO;
    vec2 wq = vec2(noise(p * 0.0031), noise(p * 0.0031 + 7.3)) - 0.5 + (vec2(noise(p * 0.012 + 3.1), noise(p * 0.012 + 9.4)) - 0.5) * 0.45;
    for (int i = 0; i < WAVES; i++){
      vec4 a = uWA[i], b = uWB[i];
      float lam = 6.2831853 / a.w;
      float lod = 1.0 - smoothstep(lam * 0.25, lam * 0.8, px);
      float WA = a.w * a.z * lod, Q = b.z / (a.w * a.z * float(WAVES) + 1e-4);
      float fi = float(i), f = a.w * dot(a.xy, r) + b.y + (wq.x * cos(fi * 1.7) + wq.y * sin(fi * 1.7)) * (3.2 + fi * 1.2);
      float s = sin(f), c = cos(f);
      n.x -= a.x * WA * c; n.z -= a.y * WA * c; n.y -= Q * WA * s;
      crest += Q * WA * s;
    }
    return normalize(n);
  }
`;

/** sombra da aeronave projetada pelo sol (planta: fuselagem, asas enflechadas e estabilizador), penumbra cresce com a altura */
export const PLANE_SHADOW = /* glsl */ `
  uniform vec3 uPlP, uPlF, uPlR, uPlU; uniform vec4 uPlD; // comprimento, envergadura, raio da fuselagem, força
  float planeShadow(vec3 W){
    if (uPlD.w <= 0.001) return 0.0;
    float dn = dot(uSun, uPlU);
    if (abs(dn) < 0.06) return 0.0;
    float t = dot(uPlP - W, uPlU) / dn;
    if (t <= 0.0 || t > 2600.0) return 0.0;
    vec3 Q = W + uSun * t - uPlP;
    float x = dot(Q, uPlF), z = abs(dot(Q, uPlR));
    float L = uPlD.x, S = uPlD.y, R = uPlD.z;
    float pen = 0.15 + t * 0.0093;
    float dF = length(vec2(max(abs(x + L * 0.02) - (L * 0.5 - R), 0.0), z)) - R;
    float c0 = L * 0.2, xle = -L * 0.06 + c0 * 0.5 - z * 0.36;
    float ch = c0 * (1.0 - 0.6 * clamp(z / (S * 0.5), 0.0, 1.0));
    float dW = max(z - S * 0.5, max(x - xle, (xle - ch) - x));
    float st = S * 0.18, ct = c0 * 0.55, xt = -L * 0.44 + ct * 0.5 - z * 0.5;
    float dT = max(z - st, max(x - xt, (xt - ct * (1.0 - 0.5 * clamp(z / st, 0.0, 1.0))) - x));
    float d = min(dF, min(dW, dT));
    return (1.0 - smoothstep(-pen, pen, d)) * uPlD.w * exp(-t / 1100.0) * smoothstep(0.06, 0.2, abs(dn));
  }
`;

/** sombra das nuvens reais (mapa gerado das posições dos cúmulos), projetada pelo sol */
export const CLOUD_SHADOW = /* glsl */ `
  uniform sampler2D uCShadow; uniform vec4 uCS; uniform float uCSk; // ladrilho, altura da base, deriva x/z
  float cloudShadow(vec3 W){
    if (uCSk <= 0.0) return 0.0;
    vec2 q = W.xz + uSun.xz / max(uSun.y, 0.12) * (uCS.y - W.y);
    return texture2D(uCShadow, (q - uCS.zw) / uCS.x + 0.5).r * uCSk;
  }
`;

/** água cristalina: absorção espectral (vermelho some primeiro) e espalhamento azul-turquesa */
export const WATER = /* glsl */ `
  uniform float uSeaY;
  const vec3 WK = vec3(0.30, 0.058, 0.042);
  vec3 waterScatter(){ return (vec3(0.0, 0.05, 0.105) + uZen * 0.035) * (0.45 + 0.75 * max(uSun.y, 0.0)); }
  vec3 downLight(float below){ return exp(-WK * below / max(uSun.y, 0.25)); }
  vec3 underwater(vec3 col, vec3 W, vec3 V){
    float below = uSeaY - W.y;
    if (below <= 0.0) return col;
    vec3 T = exp(-WK * (below / max(-V.y, 0.06)));
    return col * T + waterScatter() * (1.0 - T);
  }
  float ridge(vec2 p){ return 1.0 - abs(noise(p) * 2.0 - 1.0); }
  /** cáusticas: rede de linhas de luz focada pelas ondas, animada */
  float caustic(vec2 p, float t){
    vec2 q = p + vec2(noise(p * 0.35 + t * 0.12), noise(p * 0.35 - t * 0.1 + 3.7)) * 2.2;
    float r1 = ridge(q * 0.9 + vec2(t * 0.21, -t * 0.17));
    float r2 = ridge(q * 1.3 - vec2(t * 0.15, t * 0.19) + 7.1);
    return pow(r1, 7.0) * 0.9 + pow(r2, 9.0) * 0.7 + pow(r1 * r2, 3.0) * 0.6;
  }
`;

/** iluminação simples para a vida e objetos (sol + céu + sombra das nuvens e do avião + água) */
export const LIT = /* glsl */ `
  uniform vec3 uAmbSky, uAmbGround;
  vec3 litColor(vec3 albedo, vec3 N, vec3 W, float shadow){
    float below = uSeaY - W.y;
    float ndl = max(dot(N, uSun), 0.0);
    vec3 amb = mix(uAmbGround, uAmbSky, N.y * 0.5 + 0.5);
    vec3 sunL = uSunCol * ndl * (1.0 - shadow) * 1.15;
    if (below > 0.0) { vec3 dl = downLight(below); sunL *= dl; amb *= dl * 0.8 + 0.2 * exp(-WK * below); }
    return albedo * (sunL + amb * 0.62);
  }
`;
