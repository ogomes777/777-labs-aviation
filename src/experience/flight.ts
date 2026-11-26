import { createStore } from './store';

/**
 * Test drive — estado compartilhado entre o loop 3D (sim) e a interface (HUD).
 * Valores contínuos vivem em objetos mutáveis (sem re-render); só as mudanças de fase passam pela store.
 */
export type FlightPhase = 'start' | 'ready' | 'roll' | 'air' | 'approach' | 'rollout' | 'parked' | 'crashed';
export type FlightView = 'chase' | 'cockpit' | 'seat' | 'walk';

export const flightUi = createStore({
  phase: 'start' as FlightPhase,
  view: 'chase' as FlightView,
  /** voo livre: piloto automático cênico (sobe, cruza o mar e as nuvens, faz curvas) */
  auto: false,
  sound: true,
  /** retrato no celular: a cena é girada para paisagem automaticamente */
  rotate: false,
  /** queda: no chão ou na água */
  crash: null as null | 'ground' | 'water',
  /** nota do último pouso */
  landing: null as null | { fpm: number; grade: 'perfect' | 'good' | 'firm' },
});

/** Comandos do piloto (-1..1). Teclado e manche escrevem aqui. */
export const flightInput = {
  pitch: 0,
  roll: 0,
  /** -1 reduz, +1 acelera (segurado) */
  throttle: 0,
  /** pedidos discretos (consumidos pelo sim) */
  takeoff: false,
  land: false,
  restart: false,
  /** órbita manual da câmera (radianos) — arrastar com a mãozinha */
  lookYaw: 0,
  lookPitch: 0,
  lookAt: 0,
  /** freio aerodinâmico (segurado) */
  brake: false,
  /** rampa do manche segurado (0..1) */
  hold: 0,
  /** zoom da câmera externa (roda do mouse / pinça) */
  zoom: 1,
  /** inércia do olhar 360° */
  lookVx: 0,
  lookVy: 0,
  /** caminhar dentro da cabine (primeira pessoa): frente/trás e lateral (-1..1) */
  walkF: 0,
  walkS: 0,
};

/** Telemetria para HUD e áudio. */
export const flightTel = {
  speed: 0, // m/s
  alt: 0, // m acima do solo
  hdg: 0, // graus
  vs: 0, // m/s
  spool: 0, // 0..1 rotação dos motores
  throttle: 0,
  onGround: true,
  gear: true,
  piston: false,
  pitch: 0,
  roll: 0,
};

export function resetFlightInput() {
  Object.assign(flightInput, { pitch: 0, roll: 0, throttle: 0, takeoff: false, land: false, restart: false, lookYaw: 0, lookPitch: 0, lookAt: 0, brake: false, hold: 0, zoom: 1, lookVx: 0, lookVy: 0, walkF: 0, walkS: 0 });
}
