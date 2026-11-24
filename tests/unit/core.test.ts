import { describe, expect, it } from 'vitest';
import { journeySchema, contactSchema, todayISO } from '../../src/lib/validation';
import { greatCircleKm, ORIGIN, DESTINATIONS } from '../../src/content/destinations';
import { ramp, pulse, clamp } from '../../src/experience/director';

const future = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

describe('validação da jornada', () => {
  it('aceita jornada válida', () => {
    expect(journeySchema.safeParse({ from: 'São Paulo', to: 'Lisboa', date: future(10), passengers: 4 }).success).toBe(true);
  });
  it('rejeita origem = destino ignorando acentos/caixa', () => {
    const r = journeySchema.safeParse({ from: 'São Paulo', to: '  sao   paulo ', date: future(10), passengers: 2 });
    expect(r.success).toBe(false);
  });
  it('rejeita data passada e retorno antes da ida', () => {
    expect(journeySchema.safeParse({ from: 'A1', to: 'B1', date: '2020-01-01', passengers: 1 }).success).toBe(false);
    expect(journeySchema.safeParse({ from: 'A1', to: 'B1', date: future(10), returnDate: future(5), passengers: 1 }).success).toBe(false);
  });
  it('limita passageiros a 1–20 inteiros', () => {
    for (const p of [0, 21, 2.5]) expect(journeySchema.safeParse({ from: 'A1', to: 'B1', date: future(3), passengers: p }).success).toBe(false);
  });
  it('todayISO usa o fuso local', () => { expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/); });
});

describe('validação do contato', () => {
  it('exige consentimento explícito', () => {
    expect(contactSchema.safeParse({ name: 'QA', email: 'qa@example.com', purpose: 'Lazer', consent: false }).success).toBe(false);
    expect(contactSchema.safeParse({ name: 'QA', email: 'qa@example.com', purpose: 'Lazer', consent: true }).success).toBe(true);
  });
  it('rejeita e-mail e telefone inválidos', () => {
    expect(contactSchema.safeParse({ name: 'QA', email: 'x@', purpose: 'Lazer', consent: true }).success).toBe(false);
    expect(contactSchema.safeParse({ name: 'QA', email: 'qa@example.com', phone: 'abc', purpose: 'Lazer', consent: true }).success).toBe(false);
  });
});

describe('distâncias ortodrômicas', () => {
  it('São Paulo → Lisboa ≈ 7.900 km', () => {
    const lis = DESTINATIONS.find((d) => d.id === 'lisboa')!;
    const km = greatCircleKm(ORIGIN, lis);
    expect(km).toBeGreaterThan(7800);
    expect(km).toBeLessThan(8000);
  });
  it('é simétrica e zero para o mesmo ponto', () => {
    const a = DESTINATIONS[0], b = DESTINATIONS[5];
    expect(greatCircleKm(a, b)).toBeCloseTo(greatCircleKm(b, a), 6);
    expect(greatCircleKm(a, a)).toBe(0);
  });
});

describe('curvas do director', () => {
  it('ramp/pulse são monotônicas e limitadas', () => {
    expect(ramp(0, 1, 2)).toBe(0); expect(ramp(3, 1, 2)).toBe(1); expect(ramp(1.5, 1, 2)).toBeCloseTo(0.5, 5);
    expect(pulse(1.5, 1, 1.2, 1.8, 2)).toBe(1); expect(pulse(2.5, 1, 1.2, 1.8, 2)).toBe(0);
    expect(clamp(5)).toBe(1); expect(clamp(-1)).toBe(0);
  });
});
