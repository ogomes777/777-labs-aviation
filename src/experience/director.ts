import { createStore } from './store';
import type { PartId, VariantId, ViewId } from '@/content/site';
import type { RegionId } from '@/content/destinations';
import type { FleetId, SystemId } from '@/content/fleet';

export type Quality = 'high' | 'balanced' | 'lite';
export type MotionMode = 'cinematic' | 'lite' | 'reduced';

/**
 * SceneDirector — fonte ÚNICA do progresso do filme.
 * Valores contínuos (t, ponteiro, galeria) vivem em `frame` e são lidos no ticker/useFrame via ref,
 * sem re-render React. Estado discreto de UI vive na store.
 */
export const frame = {
  /** tempo global alvo, vindo do scroll (0..8) */
  t: 0,
  /** tempo global amortecido usado pela câmera */
  ts: 0,
  /** progresso local por capítulo */
  chapters: new Float32Array(9),
  /** índice contínuo da frota (0..4) em modo swipe */
  fleet: 0,
  fleetSwipe: false,
  /** ponteiro normalizado -1..1 (parallax sutil) */
  px: 0,
  py: 0,
  /** progresso contínuo da galeria 0..3 */
  gallery: 0,
  /** rotação manual do globo (radianos) */
  globeYaw: 0,
  globePitch: 0,
  /** véu de transição (0..1), escrito pelo canvas, lido pelo DOM */
  veil: 0,
  veilColor: '#f3efe8',
  /** canvas pronto (primeiro frame desenhado) */
  ready: false,
  /** custo de CPU por quadro do loop de direção (ms) */
  cpuMs: 0,
  cpuMax: 0,
  /** galeria em modo swipe nativo (mobile) */
  gallerySwipe: false,
  /** canvas totalmente coberto (pausa de render) */
  hidden: false,
  /** tempo de animação (s) — pode ser congelado para render determinístico */
  clock: 0,
  freezeClock: false,
};

export interface UIState {
  quality: Quality;
  motion: MotionMode;
  webgl: boolean;
  canvasReady: boolean;
  variant: VariantId;
  view: ViewId | null;
  part: PartId | null;
  explodeManual: number | null;
  anatomyExploded: boolean;
  anatomyDetail: string | null;
  anatomyAngle: number;
  anatomyPitch: number;
  anatomySubExplode: boolean;
  anatomyManualAt: number;
  galleryIndex: number;
  region: RegionId;
  destination: string | null;
  activeChapter: number;
  menuOpen: boolean;
  fleetIndex: number;
  inspect: FleetId | null;
  assembled: boolean;
  inspectPart: string | null;
  inspectMode: 'parts' | 'plan' | 'seat';
  /** V6: sistema isolado no atlas da aeronave inspecionada (null = conjunto) */
  inspectSystem: SystemId | null;
  /** V6: raio-X (casca translúcida + estrutura interna ilustrativa) */
  fleetXray: boolean;
  /** V6: órbita 360° manual em volta da aeronave inspecionada (radianos, somada à pose base) */
  fleetYaw: number;
  fleetPitch: number;
  /** V6: preview aberto (pré-seleção) — destaca o sistema em 3D sem desmontar */
  fleetPreview: SystemId | null;
  seat: number | null;
  /** nível de qualidade adaptativo 0..3 (regulado pelo FPS real do dispositivo) */
  perf: number;
  /** profundidade de campo ativa (desligada dentro da cabine) */
  dof: boolean;
  /** piso refletivo montado só no hangar/frota (ele re-renderiza a cena a cada quadro) */
  floor: boolean;
}

export const ui = createStore<UIState>({
  quality: 'high',
  motion: 'cinematic',
  webgl: true,
  canvasReady: false,
  variant: 'XR',
  view: null,
  part: null,
  explodeManual: null,
  anatomyExploded: false,
  anatomyDetail: null,
  anatomyAngle: 0,
  anatomyPitch: .65,
  anatomySubExplode: false,
  anatomyManualAt: 0,
  galleryIndex: 0,
  region: 'todos',
  destination: null,
  activeChapter: 0,
  menuOpen: false,
  fleetIndex: 0,
  inspect: null,
  assembled: true,
  inspectPart: null,
  inspectMode: 'parts',
  inspectSystem: null,
  fleetXray: false,
  fleetYaw: 0,
  fleetPitch: 0,
  fleetPreview: null,
  seat: null,
  perf: 2,
  dof: true,
  floor: false,
});

/** Destino escolhido no globo e enviado ao formulário (prefill). */
export const formBridge = createStore<{ to: string; toId: string | null; stamp: number }>({ to: '', toId: null, stamp: 0 });

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (t: number) => t * t * (3 - 2 * t);
/** rampa suave entre a e b (0 antes de a, 1 depois de b) */
export const ramp = (t: number, a: number, b: number) => smooth(clamp((t - a) / (b - a)));
/** pulso: sobe em a→b, desce em c→d */
export const pulse = (t: number, a: number, b: number, c: number, d: number) => ramp(t, a, b) * (1 - ramp(t, c, d));
export const damp = (cur: number, target: number, lambda: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

/** Progresso do capítulo da frota → índice contínuo 0..4 com permanência (o quadro "segura" em cada aeronave). */
export function fleetDwell(p: number, n = 5) {
  const q = clamp((p - 0.1) / 0.76) * (n - 1);
  const i = Math.min(n - 2, Math.floor(q));
  const f = q - i;
  return Math.min(n - 1, i + smooth(clamp((f - 0.18) / 0.64)));
}
/** inverso aproximado: índice → progresso do capítulo */
export const fleetProgressFor = (idx: number, n = 5) => 0.1 + (idx / (n - 1)) * 0.76;
