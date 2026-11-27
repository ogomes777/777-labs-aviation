/**
 * Test drive — parâmetros do mundo (puro, sem WebGL: testável).
 * Cada voo sorteia um mundo novo (sol, vento, mar, nuvens, vida) e roda num dos quatro níveis de gráfico.
 */
import { coastDist, islandDist } from './terrain';

export interface WorldCfg {
  /** ondas de Gerstner somadas na superfície */
  waves: number;
  /** malha radial do mar (anéis × setores) e do relevo/fundo do mar */
  oceanRings: number; oceanSegs: number;
  terrRings: number; terrSegs: number;
  /** vida: peixes (cardumes), aves, tubarões, tartarugas, golfinhos, objetos do fundo */
  fish: number; birds: number; sharks: number; turtles: number; dolphins: number; props: number;
  /** partículas de spray/névoa/respingo */
  spray: number;
  /** passos de luz por nuvem (volume) */
  cloudSteps: number;
}

/** Mega Ultra, sempre: todo o conteúdo ligado em qualquer aparelho (só a densidade de pixels se adapta). */
export const MEGA: WorldCfg = { waves: 8, oceanRings: 224, oceanSegs: 196, terrRings: 160, terrSegs: 160, fish: 1500, birds: 270, sharks: 4, turtles: 6, dolphins: 6, props: 300, spray: 1100, cloudSteps: 5 };

/**
 * Densidade de pixels do voo: começa no máximo (nível 4 = nativo até 2×) e só desce se o aparelho não
 * sustentar a fluidez, medindo nos primeiros segundos (motores ligando). Depois trava — sem queda no meio do voo,
 * a não ser numa emergência (FPS muito baixo e sustentado).
 */
export function flightResolution(level: number, fps: number, settling: boolean, lowStreak: number) {
  if (settling && fps < 50 && level > 1) return level - 1;
  if (!settling && lowStreak >= 4 && fps < 26 && level > 1) return level - 1;
  return level;
}

/** PRNG determinístico (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RGB = [number, number, number];
const mixC = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const sstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export interface Atmosphere {
  /** direção PARA o sol (unitária) */
  sun: [number, number, number];
  sunCol: RGB; zenith: RGB; horizon: RGB; horizonSun: RGB; haze: RGB;
  /** luz do sol sobre a aeronave e luz ambiente do céu/mar */
  sunI: number; hemiSky: RGB; hemiGround: RGB;
}

/** céu por elevação do sol: manhã/fim de tarde dourados, meio-dia azul profundo (modelo calibrado, barato na GPU) */
export function atmosphereFor(elevDeg: number, azim: number, hazeK = 1): Atmosphere {
  const el = (elevDeg * Math.PI) / 180;
  const sun: [number, number, number] = [Math.cos(el) * Math.cos(azim), Math.sin(el), Math.cos(el) * Math.sin(azim)];
  const s = sstep(8, 52, elevDeg); // 0 = sol baixo (hora dourada), 1 = sol alto
  const sunCol = mixC(hex('#ffad66'), hex('#fff3df'), s);
  const zenith = mixC(hex('#3561a6'), hex('#1b4b9e'), s);
  const horizon = mixC(hex('#bfd0e4'), hex('#c6daef'), s);
  const horizonSun = mixC(hex('#ffc68e'), hex('#eef0ea'), s);
  const haze = mixC(mixC(hex('#e2c7ae'), hex('#dbe6f1'), s), hex('#e9edf2'), Math.max(0, hazeK - 1) * 0.6);
  return {
    sun, sunCol, zenith, horizon, horizonSun, haze,
    sunI: 1.35 + 0.55 * s,
    hemiSky: mixC(hex('#9fb8d8'), hex('#bcd2ee'), s),
    hemiGround: mixC(hex('#5e6f78'), hex('#3f6f86'), s),
  };
}

export interface WorldSeed {
  seed: number;
  sunElev: number; sunAzim: number;
  /** vento: direção (rad) e velocidade (m/s) — ondas, carneirinhos e deriva das nuvens */
  windDir: number; wind: number;
  /** escala das ondas (m) */
  waveAmp: number;
  /** cobertura de nuvens 0..1 e deslocamento do campo (o céu nunca se repete) */
  cover: number; cloudShift: [number, number];
  /** visibilidade (1 = normal, >1 mais névoa) */
  hazeK: number;
  /** fase das ondas */
  wavePhase: number[];
  atmo: Atmosphere;
}

/** sorteia um mundo novo: nunca o mesmo céu, o mesmo mar, a mesma luz */
export function makeWorldSeed(seed: number): WorldSeed {
  const r = rng(seed);
  // elevação com viés para luz bonita (manhã/tarde), às vezes meio-dia
  const u = r();
  const sunElev = u < 0.55 ? 12 + r() * 20 : 30 + r() * 34;
  const sunAzim = r() * Math.PI * 2;
  const windDir = r() * Math.PI * 2;
  const wind = 3 + r() * 8.5;
  const hazeK = 0.8 + r() * 0.35;
  return {
    seed, sunElev, sunAzim, windDir, wind,
    waveAmp: 0.16 + wind * 0.055,
    cover: 0.45 + r() * 0.55,
    cloudShift: [r() * 22000, r() * 22000],
    hazeK,
    wavePhase: Array.from({ length: 8 }, () => r() * Math.PI * 2),
    atmo: atmosphereFor(sunElev, sunAzim, hazeK),
  };
}

export interface Wave { dx: number; dz: number; amp: number; k: number; omega: number; phase: number; q: number }
/** espectro de ondas de Gerstner: swell longo + mar de vento, direções espalhadas em volta do vento */
export function wavesFor(w: WorldSeed, n: number): Wave[] {
  const r = rng(w.seed ^ 0x9e3779b9);
  const out: Wave[] = [];
  const lambdas = [74, 51, 33, 22, 14.5, 9.6, 6.4, 4.2];
  for (let i = 0; i < n; i++) {
    const lam = lambdas[i] * (0.9 + r() * 0.2);
    const k = (Math.PI * 2) / lam;
    const spread = (i < 2 ? 0.75 : 1.25) * (r() - 0.5) * 2 + (i % 2 ? 0.35 : -0.35);
    const a = w.windDir + spread;
    // amplitude cai com o comprimento de onda (espectro), escala pelo vento
    const amp = w.waveAmp * (lam / 74) * (i === 0 ? 1.15 : 0.85 + r() * 0.3);
    out.push({ dx: Math.cos(a), dz: Math.sin(a), amp, k, omega: Math.sqrt(9.81 * k), phase: w.wavePhase[i] ?? 0, q: Math.min(0.85, 0.5 + w.wind * 0.03) });
  }
  return out;
}

/** Profundidade do fundo (m abaixo do nível do mar) pela distância à costa — gêmeo da função GLSL.
 *  Plataforma rasa cristalina (1–5 m até ~600 m da praia), depois o azul profundo; recife em volta da ilha com laguna por dentro. */
export function seabedDepth(shore: number, island: boolean) {
  if (shore <= 0) return 0;
  let d = 0.3 + 6 * (1 - Math.exp(-shore / 450)) + 10 * sstep(island ? 450 : 500, island ? 1100 : 1700, shore) + 65 * sstep(island ? 1100 : 1700, island ? 2800 : 4600, shore);
  if (island) { const reef = Math.exp(-(((shore - 380) / 75) ** 2)); d -= reef * Math.max(0, d - 0.9) * 0.85; }
  return d;
}

/** distância (m) até a costa mais próxima e se ela é a ilha (> 0 = mar) */
export function shoreInfo(x: number, z: number) {
  const c = coastDist(x, z), i = islandDist(x, z) * 900;
  return i < c ? { shore: i, island: true } : { shore: c, island: false };
}

/** intensidade do sopro das turbinas na água (0..1+): forte quando passa rente e rápido */
export function jetWash(agl: number, speed: number, size: number, overWater: boolean) {
  if (!overWater || agl < 0) return 0;
  const reach = size * 1.6 + 22;
  const k = Math.max(0, Math.min(1, 1 - agl / reach));
  return k * k * (3 - 2 * k) * Math.max(0.25, Math.min(1.3, speed / 70));
}

/** som do motor: ganho e brilho pela rotação, pelo comando de potência e pelo freio */
export function engineMix(spool: number, throttleIn: number, brake: boolean, speedK: number) {
  const push = throttleIn > 0 ? 1 : 0, pull = throttleIn < 0 || brake ? 1 : 0;
  const level = 0.18 + 0.82 * Math.pow(spool, 1.25);
  return {
    /** volume do motor (0..~1.15) */
    gain: Math.min(1.15, level * (1 + 0.16 * push - 0.22 * pull)),
    /** brilho (abre o filtro com a potência) */
    bright: 0.25 + 0.75 * spool + 0.12 * push,
    /** vibração dos spoilers no freio */
    buffet: brake ? Math.min(1, 0.25 + speedK) : 0,
  };
}
