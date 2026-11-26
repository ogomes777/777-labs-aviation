import type { FleetId } from '@/content/fleet';

/**
 * Envelope dimensional por TIPO de aeronave (metros). Só os campos `envelope` vêm de fonte pública
 * (ver `sources`); demais parâmetros (cordas, enflechamento, posição de janelas, pintura) são estimativas
 * visuais a partir das fotos do anúncio e ficam marcados como ilustrativos até validação com ortografias licenciadas.
 */
export interface Envelope { length: number; span: number; height: number }
export interface FleetSpec {
  id: FleetId;
  envelope: Envelope;
  sources: string[];
  /** confiança do envelope: verified = fabricante/autoridade; secondary = fonte secundária consistente */
  envelopeStatus: 'verified' | 'secondary' | 'conflict';
  /** nota pública sobre divergência de fontes */
  envelopeNote?: string;
  R: number; Ln: number; Lt: number;
  /** comprimento só da fuselagem (o total inclui pontas do estabilizador em T); ausente = comprimento total */
  fusL?: number;
  /** altura da ponta do nariz em frações de R (negativo = nariz baixo) */
  noseTip?: number;
  /** altura do eixo da fuselagem acima do solo */
  axisH: number;
  nose: 'jet' | 'prop';
  wing: { root: number; tip: number; sweep: number; dihedral: number; d: number; y: number; winglet: 'none' | 'legacy' | 'praetor'; kink?: number };
  engine: { kind: 'rear-turbofan' | 'nose-piston'; r: number; len: number; d: number; blades?: number; propR?: number; yk?: number };
  tail: { kind: 'T' | 'conventional'; finRoot: number; finTip: number; finSweep: number; stabSpan: number; stabRoot: number };
  windows: { n: number; d0: number; pitch: number; w: number; h: number; th?: number };
  door: { d: number; w: number; h: number; side: -1 | 1 };
  gear: { noseD: number; track: number; wheel: number; mainWheel: number };
  livery: { base: string; belly: string; stripe: string; accent: string; fin: string; nacelle: string; scheme: 'dark-belly' | 'pinstripe' | 'dark-tail' | 'piper' | 'citation' };
  /**
   * Planta da cabine (d = metros a partir do nariz; side −1 = esquerda/porta, +1 = direita, 0 = largura toda).
   * facing: 1 = de frente para o nariz, −1 = de costas (club), 0 = lateral (divã, voltado ao corredor).
   * Layouts de fábrica das brochuras (ver `layoutSource`); exemplar real ainda a confirmar.
   */
  cabin: { start: number; end: number; floor: number; seats: { d: number; side: -1 | 1; facing: 1 | -1 | 0 }[]; zones: CabinZone[]; layoutSource: string; crew: 2; cockpit: Cockpit };
}
export type CabinZoneKind = 'galley' | 'lav' | 'wardrobe' | 'credenza' | 'table' | 'divan' | 'entry' | 'baggage' | 'refresh' | 'exit';
export interface CabinZone { kind: CabinZoneKind; d0: number; d1: number; side: -1 | 0 | 1; toilet?: boolean }
/** Cockpit por tipo: telas (polegadas, orientação) e comando de voo. */
export interface Cockpit { suite: string; displays: { n: number; inch: number; portrait?: boolean; pedestal?: number }; control: 'sidestick' | 'yoke'; levers: number; overhead: boolean }

const Z = (kind: CabinZoneKind, d0: number, d1: number, side: -1 | 0 | 1, toilet?: boolean): CabinZone => ({ kind, d0, d1, side, ...(toilet ? { toilet } : {}) });
type St = { d: number; side: -1 | 1; facing: 1 | -1 | 0 };
const S = (d: number, side: -1 | 1, facing: 1 | -1 | 0): St => ({ d, side, facing });
/** club de 4: fileira da frente de costas, fileira de trás de frente (olho no olho) */
const club4 = (d: number, gap: number): St[] => [S(d, -1, -1), S(d, 1, -1), S(d + gap, -1, 1), S(d + gap, 1, 1)];
const FUSION: Cockpit = { suite: 'Collins Pro Line Fusion', displays: { n: 3, inch: 15.1, pedestal: 1 }, control: 'sidestick', levers: 2, overhead: true };


export const FLEET_SPECS: Record<FleetId, FleetSpec> = {
  'legacy-450': {
    id: 'legacy-450', envelope: { length: 19.68, span: 20.25, height: 6.43 }, envelopeStatus: 'verified',
    envelopeNote: 'Envergadura 20,25 m (66 ft 5 in) por convergência: ficha AOPA 2016 (dados Embraer), Airport-Technology e tabela Legacy 450/500; coerente com o Praetor 500 (winglets redesenhados levam a 21,50 m). O valor 19,25 m do TCDS EASA destoa e é tratado como erro de digitação.',
    sources: ['EASA TCDS IM.A.526 iss.12 (comprimento 19,68 m, altura 6,43 m)', 'AOPA Pilot 2016 — ficha técnica (envergadura 66 ft 5 in)', 'Airport-Technology — Legacy 450 (20,25 m)'],
    // geometria EMB-545 medida na vista superior/lateral cotada da brochura Embraer Praetor 500 (mesma fuselagem; winglet menor)
    R: 1.14, Ln: 4.0, Lt: 5.3, fusL: 17.85, noseTip: -0.5, axisH: 2.05, nose: 'jet',
    wing: { root: 4.4, tip: 1.0, sweep: 32, dihedral: 3.5, d: 6.45, y: -0.82, winglet: 'legacy', kink: 0.3 },
    engine: { kind: 'rear-turbofan', r: 0.7, len: 3.65, d: 13.45, yk: 0.5 },
    tail: { kind: 'T', finRoot: 4.5, finTip: 2.1, finSweep: 46, stabSpan: 7.34, stabRoot: 2.6 },
    windows: { n: 6, d0: 5.25, pitch: 0.92, w: 0.4, h: 0.52 },
    door: { d: 4.4, w: 0.78, h: 1.6, side: -1 },
    gear: { noseD: 2.3, track: 4.4, wheel: 0.27, mainWheel: 0.38 },
    livery: { base: '#ebe5d9', belly: '#1c2638', stripe: '#b9a27a', accent: '#1c2638', fin: '#1c2638', nacelle: '#1c2638', scheme: 'dark-belly' },
    // Embraer EMB-545: cabine 7,32 × 2,08 × 1,83 m, piso plano. Proxy de fábrica = Praetor 500 layout (a): club de 4 + 3 individuais + toalete com cinto (8)
    cabin: {
      start: 4.0, end: 11.3, floor: -0.62, crew: 2, cockpit: FUSION,
      layoutSource: 'Embraer — brochura Praetor 500 (mesma cabine EMB-545): "two club seats, three single seats and belted toilet", máx. 8',
      seats: [...club4(5.55, 1.2), S(7.95, 1, -1), S(9.15, 1, 1), S(8.85, -1, 1)],
      zones: [Z('entry', 4.0, 5.0, -1), Z('galley', 4.05, 4.95, 1), Z('table', 5.95, 6.35, -1), Z('table', 5.95, 6.35, 1), Z('table', 8.35, 8.75, 1), Z('credenza', 7.55, 8.3, -1), Z('wardrobe', 9.6, 10.2, 1), Z('lav', 10.25, 11.3, 0, true), Z('baggage', 11.3, 12.4, 0)],
    },
  },
  'praetor-500': {
    id: 'praetor-500', envelope: { length: 19.68, span: 21.5, height: 6.43 }, envelopeStatus: 'verified',
    sources: ['EASA TCDS IM.A.526 iss.12', 'Embraer — brochura Praetor 500 (out/2020), p.19'],
    // medido na vista superior/lateral cotada da brochura Embraer Praetor 500 (out/2020, p.19)
    R: 1.14, Ln: 4.0, Lt: 5.3, fusL: 17.85, noseTip: -0.5, axisH: 2.05, nose: 'jet',
    wing: { root: 4.4, tip: 1.0, sweep: 32, dihedral: 3.5, d: 6.45, y: -0.82, winglet: 'praetor', kink: 0.3 },
    engine: { kind: 'rear-turbofan', r: 0.7, len: 3.65, d: 13.45, yk: 0.5 },
    tail: { kind: 'T', finRoot: 4.5, finTip: 2.1, finSweep: 46, stabSpan: 7.34, stabRoot: 2.6 },
    windows: { n: 6, d0: 5.25, pitch: 0.92, w: 0.4, h: 0.52 },
    door: { d: 4.4, w: 0.78, h: 1.6, side: -1 },
    gear: { noseD: 2.3, track: 4.4, wheel: 0.27, mainWheel: 0.38 },
    livery: { base: '#f5f5f3', belly: '#e1e4e8', stripe: '#262d38', accent: '#7c8794', fin: '#f5f5f3', nacelle: '#f5f5f3', scheme: 'pinstripe' },
    // Embraer Praetor 500 layout (c): divã de 2 lugares à direita + club de 4 + 2 individuais + toalete com cinto (máx. 9)
    cabin: {
      start: 4.0, end: 11.3, floor: -0.62, crew: 2, cockpit: FUSION,
      layoutSource: 'Embraer — brochura Praetor 500 (out/2020): "two club seats, two single seats, two place divan and belted toilet", máx. 9',
      seats: [S(4.45, 1, 0), S(5.0, 1, 0), ...club4(5.8, 1.2), S(8.25, -1, 1), S(8.25, 1, 1)],
      zones: [Z('entry', 4.0, 5.0, -1), Z('divan', 4.12, 5.32, 1), Z('table', 6.2, 6.6, -1), Z('table', 6.2, 6.6, 1), Z('credenza', 8.85, 9.45, -1), Z('wardrobe', 9.55, 10.2, 1), Z('lav', 10.25, 11.3, 0, true), Z('baggage', 11.3, 12.4, 0)],
    },
  },
  'praetor-600': {
    id: 'praetor-600', envelope: { length: 20.74, span: 21.5, height: 6.44 }, envelopeStatus: 'verified',
    envelopeNote: 'Altura: 6,44 m (EASA) × 6,41 m (Embraer).',
    sources: ['EASA TCDS IM.A.526 iss.12', 'Embraer — brochura Praetor 600 (out/2020), p.19'],
    // medido na vista lateral/superior cotada da brochura Embraer Praetor 600 (out/2020, p.19): fuselagem ~1,06 m mais longa que a EMB-545
    R: 1.14, Ln: 4.0, Lt: 5.4, fusL: 18.9, noseTip: -0.5, axisH: 2.05, nose: 'jet',
    wing: { root: 4.5, tip: 1.0, sweep: 32, dihedral: 3.5, d: 7.5, y: -0.82, winglet: 'praetor', kink: 0.3 },
    engine: { kind: 'rear-turbofan', r: 0.7, len: 3.65, d: 14.55, yk: 0.5 },
    tail: { kind: 'T', finRoot: 4.6, finTip: 2.1, finSweep: 46, stabSpan: 7.34, stabRoot: 2.6 },
    windows: { n: 7, d0: 5.63, pitch: 0.82, w: 0.4, h: 0.52 },
    door: { d: 4.65, w: 0.78, h: 1.6, side: -1 },
    gear: { noseD: 2.3, track: 4.5, wheel: 0.27, mainWheel: 0.4 },
    livery: { base: '#f4f4f2', belly: '#141a24', stripe: '#f4f4f2', accent: '#141a24', fin: '#121820', nacelle: '#1a212c', scheme: 'dark-tail' },
    // Embraer Praetor 600 "Aft Cabin Double Divan" (máx. 12 = club de 4 + 2 divãs de 3 + assento lateral + toalete com cinto) — bate com os 12 anunciados
    cabin: {
      start: 4.0, end: 12.2, floor: -0.62, crew: 2, cockpit: FUSION,
      layoutSource: 'Embraer — brochura Praetor 600 (out/2020): "Aft Cabin Double Divan", 12 lugares com toalete com cinto e assento lateral',
      seats: [S(5.32, -1, 0), ...club4(6.0, 1.2), S(8.15, -1, 0), S(8.7, -1, 0), S(9.25, -1, 0), S(8.15, 1, 0), S(8.7, 1, 0), S(9.25, 1, 0)],
      zones: [Z('entry', 4.0, 5.05, -1), Z('galley', 4.05, 5.0, 1), Z('table', 6.4, 6.8, -1), Z('table', 6.4, 6.8, 1), Z('divan', 7.82, 9.58, -1), Z('divan', 7.82, 9.58, 1), Z('wardrobe', 9.75, 10.45, 1), Z('credenza', 9.85, 10.45, -1), Z('lav', 10.6, 12.2, 0, true), Z('baggage', 12.2, 13.3, 0)],
    },
  },
  matrix: {
    id: 'matrix', envelope: { length: 8.81, span: 13.11, height: 3.44 }, envelopeStatus: 'verified',
    sources: ['EASA TCDS IM.A.077 iss.22 §D (PA-46R-350T)', 'AOPA 2008 (hélice Hartzell 80 pol, 3 pás)'],
    // PA-46: capô longo e afilado, cone de cauda esbelto (comparado com foto lateral Commons 'Piper_PA-46_Matrix_Deurne_03', CC BY-SA)
    R: 0.66, Ln: 2.2, Lt: 3.9, noseTip: -0.05, axisH: 1.38, nose: 'prop',
    wing: { root: 2.05, tip: 1.05, sweep: 2, dihedral: 5, d: 2.0, y: -0.5, winglet: 'none' },
    engine: { kind: 'nose-piston', r: 0.5, len: 1.6, d: 0, blades: 3, propR: 1.016 },
    tail: { kind: 'conventional', finRoot: 1.7, finTip: 0.85, finSweep: 38, stabSpan: 4.3, stabRoot: 1.05 },
    windows: { n: 3, d0: 3.15, pitch: 0.66, w: 0.42, h: 0.36, th: 0.34 },
    door: { d: 4.6, w: 0.7, h: 1.05, side: -1 },
    gear: { noseD: 0.95, track: 3.6, wheel: 0.2, mainWheel: 0.25 },
    livery: { base: '#f4f3f0', belly: '#14171c', stripe: '#c7a76a', accent: '#14171c', fin: '#f4f3f0', nacelle: '#f4f3f0', scheme: 'piper' },
    // PA-46R-350T: cabine 3,76 × 1,26 × 1,19 m; 2 pilotos + club de 4 (porta airstair traseira esquerda); sem galley/toalete
    cabin: {
      start: 1.9, end: 5.2, floor: -0.36, crew: 2, cockpit: { suite: 'Garmin G1000 (opcional desde 2010; Avidyne Entegra de série)', displays: { n: 3, inch: 10.4 }, control: 'yoke', levers: 3, overhead: false },
      layoutSource: 'AOPA 2008 / Piper: 6 lugares com piloto, club traseiro, bagageiros dianteiro (13 pés³) e traseiro (20 pés³)',
      seats: [S(3.45, -1, -1), S(3.45, 1, -1), S(4.45, -1, 1), S(4.45, 1, 1)],
      zones: [Z('baggage', 1.25, 1.85, 0), Z('table', 3.75, 4.15, 1), Z('entry', 4.25, 5.0, -1), Z('baggage', 5.2, 5.85, 0)],
    },
  },
  'citation-cj2-plus': {
    id: 'citation-cj2-plus', envelope: { length: 14.53, span: 15.09, height: 4.32 }, envelopeStatus: 'verified',
    sources: ['EASA TCDS IM.A.078 iss.19 §B (525A, S/N 0300+ = CJ2+)'],
    R: 0.82, Ln: 3.0, Lt: 4.2, fusL: 13.75, noseTip: -0.4, axisH: 1.42, nose: 'jet',
    wing: { root: 2.55, tip: 1.05, sweep: 6, dihedral: 4, d: 5.6, y: -0.6, winglet: 'none' },
    engine: { kind: 'rear-turbofan', r: 0.46, len: 2.5, d: 10.4 },
    tail: { kind: 'T', finRoot: 2.4, finTip: 1.45, finSweep: 38, stabSpan: 6.0, stabRoot: 1.4 },
    windows: { n: 6, d0: 3.75, pitch: 0.74, w: 0.36, h: 0.44 },
    door: { d: 2.75, w: 0.62, h: 1.25, side: -1 },
    gear: { noseD: 1.7, track: 3.8, wheel: 0.22, mainWheel: 0.3 },
    livery: { base: '#f6f6f4', belly: '#eeeeec', stripe: '#1e2a44', accent: '#b8975e', fin: '#f6f6f4', nacelle: '#f6f6f4', scheme: 'citation' },
    // Cessna 525A: cabine 4,14 × 1,47 × 1,45 m, corredor rebaixado; refreshment center à esquerda, club central de 4, 2 de frente, toalete com cinto
    cabin: {
      start: 3.3, end: 8.5, floor: -0.44, crew: 2, cockpit: { suite: 'Collins Pro Line 21', displays: { n: 3, inch: 10, portrait: true }, control: 'yoke', levers: 2, overhead: false },
      layoutSource: 'Textron Aviation — anúncio 525A-0369: "Center-Club Arrangement", "Left-Hand Slimline Refreshment Center", "Belted Flushing Toilet"',
      seats: [...club4(4.3, 1.08), S(6.5, -1, 1), S(6.5, 1, 1)],
      zones: [Z('entry', 2.45, 3.3, -1), Z('refresh', 3.32, 3.86, -1), Z('table', 4.64, 4.94, -1), Z('table', 4.64, 4.94, 1), Z('exit', 6.35, 6.9, 1), Z('lav', 7.35, 8.5, 0, true), Z('baggage', 8.5, 9.4, 0)],
    },
  },
};
