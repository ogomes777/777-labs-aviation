/**
 * Ponte entre o voo das aeronaves (WantedFlight) e o céu vivo (SkyFinale):
 * posição atual de cada aeronave em pixels da janela, raio de influência e quanto ela ainda está voando.
 * Sem React/estado: escrito a cada quadro de scroll, lido a cada quadro do céu.
 */
export type WakePlane = { x: number; y: number; r: number; on: number; vx: number; vy: number };
export const skyWake: { planes: WakePlane[] } = { planes: [] };
