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
  /** altura do eixo da fuselagem acima do solo */
  axisH: number;
  nose: 'jet' | 'prop';
  wing: { root: number; tip: number; sweep: number; dihedral: number; d: number; y: number; winglet: 'none' | 'legacy' | 'praetor' };
  engine: { kind: 'rear-turbofan' | 'nose-piston'; r: number; len: number; d: number; blades?: number; propR?: number };
  tail: { kind: 'T' | 'conventional'; finRoot: number; finTip: number; finSweep: number; stabSpan: number; stabRoot: number };
  windows: { n: number; d0: number; pitch: number; w: number; h: number };
  door: { d: number; w: number; h: number; side: -1 | 1 };
  gear: { noseD: number; track: number; wheel: number; mainWheel: number };
  livery: { base: string; belly: string; stripe: string; accent: string; scheme: 'dark-belly' | 'pinstripe' | 'dark-tail' | 'piper' | 'citation' };
  cabin: { start: number; end: number; floor: number; seats: { d: number; side: -1 | 1; facing: 1 | -1 }[] };
}

const club = (d0: number, rows: number, pitch: number) => {
  const out: FleetSpec['cabin']['seats'] = [];
  for (let r = 0; r < rows; r++) for (const side of [-1, 1] as const) out.push({ d: d0 + r * pitch, side, facing: r % 2 === 0 ? -1 : 1 });
  return out;
};

export const FLEET_SPECS: Record<FleetId, FleetSpec> = {
  'legacy-450': {
    id: 'legacy-450', envelope: { length: 19.68, span: 20.25, height: 6.43 }, envelopeStatus: 'conflict',
    envelopeNote: 'Envergadura em revisão: EASA IM.A.526 informa 19,25 m; fontes secundárias (AOPA 2016) 20,25 m. O 3D usa 20,25 m até confirmação.',
    sources: ['EASA TCDS IM.A.526 iss.12 (comprimento 19,68 m, altura 6,43 m)', 'AOPA Pilot 2016 (envergadura 66 ft 5 in)'],
    R: 1.16, Ln: 3.5, Lt: 5.7, axisH: 1.95, nose: 'jet',
    wing: { root: 3.7, tip: 1.15, sweep: 26, dihedral: 3.5, d: 8.0, y: -0.82, winglet: 'legacy' },
    engine: { kind: 'rear-turbofan', r: 0.62, len: 3.3, d: 14.0 },
    tail: { kind: 'T', finRoot: 3.4, finTip: 2.0, finSweep: 40, stabSpan: 7.34, stabRoot: 1.9 },
    windows: { n: 5, d0: 5.05, pitch: 1.05, w: 0.42, h: 0.5 },
    door: { d: 3.85, w: 0.78, h: 1.55, side: -1 },
    gear: { noseD: 2.4, track: 4.6, wheel: 0.27, mainWheel: 0.38 },
    livery: { base: '#f2f2ef', belly: '#1f2733', stripe: '#9aa3ad', accent: '#2e3a4a', scheme: 'dark-belly' },
    cabin: { start: 4.6, end: 11.6, floor: -0.62, seats: [...club(5.2, 2, 1.25), { d: 8.6, side: -1, facing: 1 }, { d: 8.6, side: 1, facing: 1 }, { d: 9.9, side: -1, facing: -1 }, { d: 9.9, side: 1, facing: -1 }] },
  },
  'praetor-500': {
    id: 'praetor-500', envelope: { length: 19.68, span: 21.5, height: 6.43 }, envelopeStatus: 'verified',
    sources: ['EASA TCDS IM.A.526 iss.12', 'Embraer — brochura Praetor 500 (out/2020), p.19'],
    R: 1.16, Ln: 3.5, Lt: 5.7, axisH: 1.95, nose: 'jet',
    wing: { root: 3.7, tip: 1.1, sweep: 26, dihedral: 3.5, d: 8.0, y: -0.82, winglet: 'praetor' },
    engine: { kind: 'rear-turbofan', r: 0.62, len: 3.3, d: 14.0 },
    tail: { kind: 'T', finRoot: 3.4, finTip: 2.0, finSweep: 40, stabSpan: 7.34, stabRoot: 1.9 },
    windows: { n: 5, d0: 5.05, pitch: 1.05, w: 0.42, h: 0.5 },
    door: { d: 3.85, w: 0.78, h: 1.55, side: -1 },
    gear: { noseD: 2.4, track: 4.6, wheel: 0.27, mainWheel: 0.38 },
    livery: { base: '#f4f4f2', belly: '#d9dde1', stripe: '#1d2836', accent: '#6b7787', scheme: 'pinstripe' },
    cabin: { start: 4.6, end: 11.6, floor: -0.62, seats: [...club(5.2, 2, 1.25), { d: 8.6, side: -1, facing: 1 }, { d: 8.6, side: 1, facing: 1 }, { d: 9.9, side: -1, facing: -1 }, { d: 9.9, side: 1, facing: -1 }, { d: 11.0, side: 1, facing: 1 }] },
  },
  'praetor-600': {
    id: 'praetor-600', envelope: { length: 20.74, span: 21.5, height: 6.44 }, envelopeStatus: 'verified',
    envelopeNote: 'Altura: 6,44 m (EASA) × 6,41 m (Embraer).',
    sources: ['EASA TCDS IM.A.526 iss.12', 'Embraer — brochura Praetor 600 (out/2020), p.19'],
    R: 1.16, Ln: 3.5, Lt: 5.9, axisH: 2.0, nose: 'jet',
    wing: { root: 3.8, tip: 1.1, sweep: 26, dihedral: 3.5, d: 8.6, y: -0.82, winglet: 'praetor' },
    engine: { kind: 'rear-turbofan', r: 0.62, len: 3.3, d: 14.9 },
    tail: { kind: 'T', finRoot: 3.5, finTip: 2.0, finSweep: 40, stabSpan: 7.34, stabRoot: 1.95 },
    windows: { n: 7, d0: 5.05, pitch: 1.05, w: 0.42, h: 0.5 },
    door: { d: 3.85, w: 0.78, h: 1.55, side: -1 },
    gear: { noseD: 2.4, track: 4.7, wheel: 0.27, mainWheel: 0.4 },
    livery: { base: '#f3f3f1', belly: '#c9ced4', stripe: '#141b24', accent: '#141b24', scheme: 'dark-tail' },
    cabin: { start: 4.6, end: 12.7, floor: -0.62, seats: [...club(5.1, 2, 1.2), ...club(7.7, 2, 1.2), { d: 10.4, side: -1, facing: 1 }, { d: 10.4, side: 1, facing: 1 }, { d: 11.6, side: -1, facing: -1 }, { d: 11.6, side: 1, facing: -1 }] },
  },
  matrix: {
    id: 'matrix', envelope: { length: 8.81, span: 13.11, height: 3.44 }, envelopeStatus: 'verified',
    sources: ['EASA TCDS IM.A.077 iss.22 §D (PA-46R-350T)', 'AOPA 2008 (hélice Hartzell 80 pol, 3 pás)'],
    R: 0.66, Ln: 1.75, Lt: 3.3, axisH: 1.38, nose: 'prop',
    wing: { root: 2.05, tip: 1.05, sweep: 2, dihedral: 5, d: 2.15, y: -0.5, winglet: 'none' },
    engine: { kind: 'nose-piston', r: 0.5, len: 1.6, d: 0, blades: 3, propR: 1.016 },
    tail: { kind: 'conventional', finRoot: 1.7, finTip: 0.85, finSweep: 38, stabSpan: 4.3, stabRoot: 1.05 },
    windows: { n: 3, d0: 3.35, pitch: 0.6, w: 0.36, h: 0.34 },
    door: { d: 4.6, w: 0.7, h: 1.05, side: -1 },
    gear: { noseD: 0.95, track: 3.6, wheel: 0.2, mainWheel: 0.25 },
    livery: { base: '#f5f4f1', belly: '#e7e6e2', stripe: '#1b222c', accent: '#8c6a3c', scheme: 'piper' },
    cabin: { start: 1.9, end: 5.2, floor: -0.36, seats: [{ d: 2.35, side: -1, facing: 1 }, { d: 2.35, side: 1, facing: 1 }, { d: 3.45, side: -1, facing: -1 }, { d: 3.45, side: 1, facing: -1 }, { d: 4.45, side: -1, facing: 1 }, { d: 4.45, side: 1, facing: 1 }] },
  },
  'citation-cj2-plus': {
    id: 'citation-cj2-plus', envelope: { length: 14.53, span: 15.09, height: 4.32 }, envelopeStatus: 'verified',
    sources: ['EASA TCDS IM.A.078 iss.19 §B (525A, S/N 0300+ = CJ2+)'],
    R: 0.82, Ln: 2.55, Lt: 4.4, axisH: 1.42, nose: 'jet',
    wing: { root: 2.55, tip: 1.05, sweep: 6, dihedral: 4, d: 5.6, y: -0.6, winglet: 'none' },
    engine: { kind: 'rear-turbofan', r: 0.46, len: 2.5, d: 10.4 },
    tail: { kind: 'T', finRoot: 2.4, finTip: 1.45, finSweep: 38, stabSpan: 6.0, stabRoot: 1.4 },
    windows: { n: 6, d0: 3.75, pitch: 0.74, w: 0.34, h: 0.4 },
    door: { d: 2.75, w: 0.62, h: 1.25, side: -1 },
    gear: { noseD: 1.7, track: 3.8, wheel: 0.22, mainWheel: 0.3 },
    livery: { base: '#f5f5f3', belly: '#f0f0ee', stripe: '#232c38', accent: '#b08a55', scheme: 'citation' },
    cabin: { start: 3.3, end: 8.5, floor: -0.44, seats: [...club(4.0, 2, 1.05), { d: 6.3, side: -1, facing: 1 }, { d: 6.3, side: 1, facing: 1 }] },
  },
};
