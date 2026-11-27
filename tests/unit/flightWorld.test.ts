import { describe, expect, it } from 'vitest';
import { atmosphereFor, engineMix, flightResolution, jetWash, makeWorldSeed, MEGA, rng, seabedDepth, shoreInfo, wavesFor } from '@/three/flight/env';
import { isWater } from '@/three/flight/terrain';

describe('mundo do test drive: semente', () => {
  it('a mesma semente gera o mesmo mundo; sementes diferentes, mundos diferentes', () => {
    const a = makeWorldSeed(123), b = makeWorldSeed(123), c = makeWorldSeed(124);
    expect(a).toEqual(b);
    expect([a.sunAzim, a.windDir, a.cover]).not.toEqual([c.sunAzim, c.windDir, c.cover]);
  });
  it('sempre de dia, com sol entre a hora dourada e o meio-dia, vento e nuvens em faixas plausíveis', () => {
    for (let s = 1; s < 200; s++) {
      const w = makeWorldSeed(s * 7919);
      expect(w.sunElev).toBeGreaterThanOrEqual(12); expect(w.sunElev).toBeLessThanOrEqual(64);
      expect(w.wind).toBeGreaterThanOrEqual(3); expect(w.wind).toBeLessThanOrEqual(11.5);
      expect(w.cover).toBeGreaterThanOrEqual(0.45); expect(w.cover).toBeLessThanOrEqual(1);
      expect(w.atmo.sun[1]).toBeGreaterThan(0.2);
      expect(Math.hypot(...w.atmo.sun)).toBeCloseTo(1, 5);
    }
  });
  it('o céu muda com o sol: hora dourada é mais quente que o meio-dia', () => {
    const low = atmosphereFor(14, 0), high = atmosphereFor(58, 0);
    const warmth = (c: number[]) => c[0] - c[2];
    expect(warmth(low.sunCol)).toBeGreaterThan(warmth(high.sunCol));
    expect(warmth(low.horizonSun)).toBeGreaterThan(warmth(high.horizonSun));
    expect(high.sunI).toBeGreaterThan(low.sunI);
  });
  it('PRNG determinístico em [0, 1)', () => {
    const r = rng(42), xs = Array.from({ length: 1000 }, r);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(rng(42)()).toBe(xs[0]);
  });
});

describe('mar cristalino: fundo e ondas', () => {
  it('perto da praia é raso (água turquesa), longe é o azul profundo', () => {
    expect(seabedDepth(0, false)).toBe(0);
    expect(seabedDepth(200, false)).toBeLessThan(4);
    expect(seabedDepth(500, false)).toBeLessThan(6);
    expect(seabedDepth(6000, false)).toBeGreaterThan(60);
    let prev = 0;
    for (let s = 10; s < 6000; s += 50) { const d = seabedDepth(s, false); expect(d).toBeGreaterThanOrEqual(prev - 1e-9); prev = d; }
  });
  it('a ilha tem recife raso com laguna por dentro', () => {
    const lagoon = seabedDepth(240, true), reef = seabedDepth(380, true), outside = seabedDepth(900, true);
    expect(reef).toBeLessThan(lagoon);
    expect(reef).toBeLessThan(1.6);
    expect(outside).toBeGreaterThan(reef);
  });
  it('geografia coerente com a física: o aeródromo é terra, o largo é mar, a laguna da ilha é rasa', () => {
    expect(isWater(-640, 80)).toBe(false);
    expect(isWater(-640, -6000)).toBe(true);
    const s = shoreInfo(-10300, -120);
    expect(s.island).toBe(true);
    expect(seabedDepth(s.shore, s.island)).toBeLessThan(6);
  });
  it('espectro de ondas: inclinação baixa (sem "tecido"), direções espalhadas em volta do vento', () => {
    const w = makeWorldSeed(77), ws = wavesFor(w, MEGA.waves);
    expect(ws).toHaveLength(8);
    const slope = ws.reduce((a, x) => a + x.k * x.amp, 0);
    expect(slope).toBeLessThan(0.5);
    const dirs = new Set(ws.map((x) => Math.round(Math.atan2(x.dz, x.dx) * 10)));
    expect(dirs.size).toBeGreaterThan(5);
    for (const x of ws) { expect(x.omega).toBeCloseTo(Math.sqrt(9.81 * x.k), 6); expect(x.q).toBeLessThanOrEqual(0.85); }
  });
});

describe('a água reage às turbinas', () => {
  it('rasante rápido sobre a água levanta spray; alto ou sobre terra, nada', () => {
    expect(jetWash(4, 110, 21, true)).toBeGreaterThan(0.9);
    expect(jetWash(30, 110, 21, true)).toBeGreaterThan(0.1);
    expect(jetWash(80, 110, 21, true)).toBe(0);
    expect(jetWash(4, 110, 21, false)).toBe(0);
    expect(jetWash(4, 40, 21, true)).toBeLessThan(jetWash(4, 110, 21, true));
  });
});

describe('som do motor', () => {
  it('cresce com a rotação, sobe ao acelerar e cai ao reduzir/frear', () => {
    const idle = engineMix(0.1, 0, false, 0.3), full = engineMix(1, 0, false, 0.8);
    expect(full.gain).toBeGreaterThan(idle.gain * 2.5);
    expect(engineMix(0.7, 1, false, 0.5).gain).toBeGreaterThan(engineMix(0.7, 0, false, 0.5).gain);
    expect(engineMix(0.7, 0, true, 0.5).gain).toBeLessThan(engineMix(0.7, 0, false, 0.5).gain);
    expect(engineMix(0.7, 0, true, 0.5).buffet).toBeGreaterThan(0);
    expect(engineMix(0.7, 0, false, 0.5).buffet).toBe(0);
  });
});

describe('Mega Ultra sempre, fluido em qualquer aparelho', () => {
  it('conteúdo completo ligado', () => {
    expect(MEGA.waves).toBe(8);
    expect(MEGA.fish).toBeGreaterThanOrEqual(1000);
    expect(MEGA.birds).toBeGreaterThanOrEqual(200);
  });
  it('só a densidade de pixels se acomoda: desce na janela inicial se faltar fluidez, depois só em emergência', () => {
    expect(flightResolution(4, 58, true, 0)).toBe(4);
    expect(flightResolution(4, 40, true, 0)).toBe(3);
    expect(flightResolution(1, 20, true, 0)).toBe(1);
    expect(flightResolution(3, 40, false, 0)).toBe(3); // depois de acomodado, não cai no meio do voo
    expect(flightResolution(3, 22, false, 2)).toBe(3);
    expect(flightResolution(3, 22, false, 4)).toBe(2); // emergência sustentada
  });
});
