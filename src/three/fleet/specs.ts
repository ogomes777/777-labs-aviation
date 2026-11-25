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
    // geometria EMB-545 medida na vista superior/lateral cotada da brochura Embraer Praetor 500 (mesma fuselagem; winglet menor)
    R: 1.14, Ln: 4.0, Lt: 5.3, fusL: 17.85, noseTip: -0.5, axisH: 2.05, nose: 'jet',
    wing: { root: 4.4, tip: 1.0, sweep: 32, dihedral: 3.5, d: 6.45, y: -0.82, winglet: 'legacy', kink: 0.3 },
    engine: { kind: 'rear-turbofan', r: 0.7, len: 3.65, d: 13.45, yk: 0.5 },
    tail: { kind: 'T', finRoot: 4.5, finTip: 2.1, finSweep: 46, stabSpan: 7.34, stabRoot: 2.6 },
    windows: { n: 5, d0: 5.6, pitch: 0.86, w: 0.36, h: 0.44 },
    door: { d: 4.4, w: 0.78, h: 1.6, side: -1 },
    gear: { noseD: 2.3, track: 4.4, wheel: 0.27, mainWheel: 0.38 },
    livery: { base: '#ebe5d9', belly: '#1c2638', stripe: '#b9a27a', accent: '#1c2638', fin: '#1c2638', nacelle: '#1c2638', scheme: 'dark-belly' },
    cabin: { start: 4.0, end: 11.3, floor: -0.62, seats: [...club(5.0, 2, 1.25), { d: 8.1, side: -1, facing: 1 }, { d: 8.1, side: 1, facing: 1 }, { d: 9.4, side: -1, facing: -1 }, { d: 9.4, side: 1, facing: -1 }] },
  },
  'praetor-500': {
    id: 'praetor-500', envelope: { length: 19.68, span: 21.5, height: 6.43 }, envelopeStatus: 'verified',
    sources: ['EASA TCDS IM.A.526 iss.12', 'Embraer — brochura Praetor 500 (out/2020), p.19'],
    // medido na vista superior/lateral cotada da brochura Embraer Praetor 500 (out/2020, p.19)
    R: 1.14, Ln: 4.0, Lt: 5.3, fusL: 17.85, noseTip: -0.5, axisH: 2.05, nose: 'jet',
    wing: { root: 4.4, tip: 1.0, sweep: 32, dihedral: 3.5, d: 6.45, y: -0.82, winglet: 'praetor', kink: 0.3 },
    engine: { kind: 'rear-turbofan', r: 0.7, len: 3.65, d: 13.45, yk: 0.5 },
    tail: { kind: 'T', finRoot: 4.5, finTip: 2.1, finSweep: 46, stabSpan: 7.34, stabRoot: 2.6 },
    windows: { n: 5, d0: 5.6, pitch: 0.86, w: 0.36, h: 0.44 },
    door: { d: 4.4, w: 0.78, h: 1.6, side: -1 },
    gear: { noseD: 2.3, track: 4.4, wheel: 0.27, mainWheel: 0.38 },
    livery: { base: '#f5f5f3', belly: '#e1e4e8', stripe: '#262d38', accent: '#7c8794', fin: '#f5f5f3', nacelle: '#f5f5f3', scheme: 'pinstripe' },
    cabin: { start: 4.0, end: 11.3, floor: -0.62, seats: [...club(5.0, 2, 1.2), { d: 7.8, side: -1, facing: 1 }, { d: 7.8, side: 1, facing: 1 }, { d: 9.0, side: -1, facing: -1 }, { d: 9.0, side: 1, facing: -1 }, { d: 10.4, side: 1, facing: 1 }] },
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
    windows: { n: 7, d0: 5.63, pitch: 0.82, w: 0.36, h: 0.44 },
    door: { d: 4.65, w: 0.78, h: 1.6, side: -1 },
    gear: { noseD: 2.3, track: 4.5, wheel: 0.27, mainWheel: 0.4 },
    livery: { base: '#f4f4f2', belly: '#141a24', stripe: '#f4f4f2', accent: '#141a24', fin: '#121820', nacelle: '#1a212c', scheme: 'dark-tail' },
    cabin: { start: 4.0, end: 12.2, floor: -0.62, seats: [...club(5.1, 2, 1.2), ...club(7.7, 2, 1.2), { d: 10.4, side: -1, facing: 1 }, { d: 10.4, side: 1, facing: 1 }, { d: 11.6, side: -1, facing: -1 }, { d: 11.6, side: 1, facing: -1 }] },
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
    cabin: { start: 1.9, end: 5.2, floor: -0.36, seats: [{ d: 2.35, side: -1, facing: 1 }, { d: 2.35, side: 1, facing: 1 }, { d: 3.45, side: -1, facing: -1 }, { d: 3.45, side: 1, facing: -1 }, { d: 4.45, side: -1, facing: 1 }, { d: 4.45, side: 1, facing: 1 }] },
  },
  'citation-cj2-plus': {
    id: 'citation-cj2-plus', envelope: { length: 14.53, span: 15.09, height: 4.32 }, envelopeStatus: 'verified',
    sources: ['EASA TCDS IM.A.078 iss.19 §B (525A, S/N 0300+ = CJ2+)'],
    R: 0.82, Ln: 3.0, Lt: 4.2, fusL: 13.75, noseTip: -0.4, axisH: 1.42, nose: 'jet',
    wing: { root: 2.55, tip: 1.05, sweep: 6, dihedral: 4, d: 5.6, y: -0.6, winglet: 'none' },
    engine: { kind: 'rear-turbofan', r: 0.46, len: 2.5, d: 10.4 },
    tail: { kind: 'T', finRoot: 2.4, finTip: 1.45, finSweep: 38, stabSpan: 6.0, stabRoot: 1.4 },
    windows: { n: 6, d0: 3.75, pitch: 0.74, w: 0.34, h: 0.4 },
    door: { d: 2.75, w: 0.62, h: 1.25, side: -1 },
    gear: { noseD: 1.7, track: 3.8, wheel: 0.22, mainWheel: 0.3 },
    livery: { base: '#f6f6f4', belly: '#eeeeec', stripe: '#1e2a44', accent: '#b8975e', fin: '#f6f6f4', nacelle: '#f6f6f4', scheme: 'citation' },
    cabin: { start: 3.3, end: 8.5, floor: -0.44, seats: [...club(4.0, 2, 1.05), { d: 6.3, side: -1, facing: 1 }, { d: 6.3, side: 1, facing: 1 }] },
  },
};
