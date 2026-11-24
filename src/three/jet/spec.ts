import type { VariantId } from '@/content/site';

/** Proporções conceituais (metros). Não correspondem a nenhuma aeronave certificada. */
export type AircraftId = VariantId | 'TP';
export interface JetSpec {
  id: AircraftId;
  kind: 'jet' | 'turboprop';
  L: number; // comprimento da fuselagem
  R: number; // raio externo da seção da cabine
  Ln: number; // comprimento do nariz
  Lt: number; // comprimento do cone de cauda
  windows: number;
  winPitch: number;
  winD0: number; // distância do nariz até o centro da 1ª janela
  span: number;
  rootChord: number;
  tipChord: number;
  sweep: number; // graus
  wingD: number; // distância do nariz ao bordo de ataque na raiz
  engine: number; // escala do motor
  finH: number;
  cabinStart: number;
  cabinEnd: number;
}

function make(id: AircraftId, L: number, R: number, Ln: number, Lt: number, windows: number, winPitch: number, span: number, engine: number): JetSpec {
  const cabinStart = Ln + 0.6;
  const cabinEnd = L - Lt + 1.0;
  return {
    id, kind: id === 'TP' ? 'turboprop' : 'jet', L, R, Ln, Lt, windows, winPitch,
    winD0: Ln + 2.15,
    span,
    rootChord: span * 0.17,
    tipChord: span * 0.052,
    sweep: 29,
    wingD: L * 0.43,
    engine,
    finH: 2.6 + L * 0.045,
    cabinStart,
    cabinEnd,
  };
}

export const SPECS: Record<AircraftId, JetSpec> = {
  TP: { ...make('TP', 16.4, 1.12, 3.4, 5.4, 5, 1.2, 19, 0.7), sweep: 3, rootChord: 2.3, tipChord: 1.15, wingD: 6.6 },
  L: make('L', 18.6, 1.2, 4.0, 6.0, 4, 1.42, 17.2, 0.82),
  M: make('M', 23.2, 1.3, 4.3, 6.8, 6, 1.45, 22.4, 0.92),
  XR: make('XR', 28.4, 1.36, 4.6, 7.6, 9, 1.47, 28.0, 1.0),
};

/** Altura do piso da cabine e raio interno (lining). */
export const CABIN_INSET = 0.1;
export const floorY = (s: JetSpec) => -s.R * 0.56;
export const groundY = (s: JetSpec) => -s.R - 1.18;

/** Janela: largura (eixo x), altura (arco), expoente da superelipse, altura angular do centro. */
export const WIN = { w: 0.5, h: 0.6, n: 2.7, theta: 0.2 };
