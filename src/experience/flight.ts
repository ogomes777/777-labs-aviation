import { createStore } from './store';

/**
 * Test drive — estado compartilhado entre o loop 3D (sim) e a interface (HUD).
 * Valores contínuos vivem em objetos mutáveis (sem re-render); só as mudanças de fase passam pela store.
 */
export type FlightPhase = 'start' | 'ready' | 'roll' | 'air' | 'approach' | 'rollout' | 'parked';
export type FlightView = 'chase' | 'cockpit';

export const flightUi = createStore({
  phase: 'start' as FlightPhase,
  view: 'chase' as FlightView,
  /** voo livre: piloto automático cênico (sobe, cruza o mar e as nuvens, faz curvas) */
  auto: false,
  sound: true,
  /** retrato no celular: a cena é girada para paisagem automaticamente */
  rotate: false,
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
};

export function resetFlightInput() {
  Object.assign(flightInput, { pitch: 0, roll: 0, throttle: 0, takeoff: false, land: false, restart: false, lookYaw: 0, lookPitch: 0, lookAt: 0 });
}
