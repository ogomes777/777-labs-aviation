import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FLEET, CONTACT, quoteUrl, mailUrl, systemsFor, partsFor } from '../../src/content/fleet';
import { FLEET_SPECS } from '../../src/three/fleet/specs';
import { fleetSystemPreview, anatomySystemPreview, anatomyDetailPreview } from '../../src/content/previews';
import { DETAILS } from '../../src/content/anatomy24';
import { PARTS } from '../../src/content/site';

const pack = JSON.parse(fs.readFileSync(path.resolve('simfly-fleet-pack/data/fleet.json'), 'utf8')) as { id: string; name: string; year: number; type: string; make: string }[];

describe('frota SimFly (dados de anúncio)', () => {
  it('tem exatamente as cinco aeronaves do pacote, na mesma ordem, ano, fabricante e tipo', () => {
    expect(FLEET.map((f) => f.id)).toEqual(pack.map((p) => p.id));
    for (const p of pack) {
      const f = FLEET.find((x) => x.id === p.id)!;
      expect([f.name, f.year, f.make, f.type]).toEqual([p.name, p.year, p.make, p.type]);
    }
  });
  it('não classifica o Matrix como jato e não o chama de pressurizado', () => {
    const m = FLEET.find((f) => f.id === 'matrix')!;
    expect(m.category.toLowerCase()).not.toContain('jato');
    expect(m.category).toContain('pistão');
    expect(m.engineType).toBe('piston');
    const text = JSON.stringify(systemsFor('matrix')).toLowerCase();
    expect(text).toContain('não pressurizada');
    expect(text).not.toMatch(/turbofan|galley/);
  });
  it('não publica preço, matrícula ou número de série inventados', () => {
    const blob = JSON.stringify(FLEET);
    expect(blob).not.toMatch(/R\$|US\$|USD|PR-[A-Z]{3}|N\d{2,5}[A-Z]{0,2}\b/);
    for (const f of FLEET) expect(f.status.toLowerCase()).toMatch(/anunciad|oportunidade/);
  });
  it('CTA abre WhatsApp oficial com mensagem codificada do modelo correto (sem envio automático)', () => {
    for (const f of FLEET) {
      const u = new URL(quoteUrl(f));
      expect(u.hostname).toBe('wa.me');
      expect(u.pathname).toBe(`/${CONTACT.whatsapp}`);
      const msg = u.searchParams.get('text')!;
      expect(msg).toContain(`${f.make} ${f.name} ${f.year}`);
      expect(mailUrl(f)).toContain(encodeURIComponent(f.name));
    }
    expect(() => quoteUrl(FLEET[0], '12ab')).toThrow();
  });
  it('cada aeronave expõe sete sistemas com peças descritas (nenhum hotspot vazio)', () => {
    for (const f of FLEET) {
      const s = systemsFor(f.id);
      expect(s.map((x) => x.id)).toEqual(['fuselagem', 'asas', 'propulsao', 'empenagem', 'trem', 'cabine', 'portas']);
      for (const sys of s) { expect(sys.text.length).toBeGreaterThan(20); expect(sys.parts.length).toBeGreaterThan(0); }
      expect(partsFor(f.id).every((p) => p.text.length > 10)).toBe(true);
    }
    // winglets só onde o tipo os possui
    expect(partsFor('matrix').some((p) => p.id === 'winglet')).toBe(false);
    expect(partsFor('citation-cj2-plus').some((p) => p.id === 'winglet')).toBe(false);
    expect(partsFor('praetor-500').some((p) => p.id === 'winglet')).toBe(true);
  });
});

describe('envelopes dimensionais (fontes EASA/Embraer)', () => {
  const exp: Record<string, [number, number, number]> = {
    'legacy-450': [19.68, 20.25, 6.43], 'praetor-500': [19.68, 21.5, 6.43], 'praetor-600': [20.74, 21.5, 6.44],
    matrix: [8.81, 13.11, 3.44], 'citation-cj2-plus': [14.53, 15.09, 4.32],
  };
  it('coincidem com os valores verificados e declaram fonte', () => {
    for (const [id, [l, s, h]] of Object.entries(exp)) {
      const e = FLEET_SPECS[id as keyof typeof FLEET_SPECS];
      expect([e.envelope.length, e.envelope.span, e.envelope.height]).toEqual([l, s, h]);
      expect(e.sources.length).toBeGreaterThan(0);
    }
    expect(FLEET_SPECS['legacy-450'].envelopeStatus).toBe('verified');
    expect(FLEET_SPECS['legacy-450'].envelopeNote).toContain('66 ft 5 in');
  });
  it('Matrix: hélice de 3 pás e 80 pol; cauda convencional; jatos com cauda em T', () => {
    expect(FLEET_SPECS.matrix.engine.blades).toBe(3);
    expect(FLEET_SPECS.matrix.engine.propR! * 2).toBeCloseTo(2.032, 2);
    expect(FLEET_SPECS.matrix.tail.kind).toBe('conventional');
    for (const id of ['legacy-450', 'praetor-500', 'praetor-600', 'citation-cj2-plus'] as const) expect(FLEET_SPECS[id].tail.kind).toBe('T');
  });
  it('lugares da planta de fábrica = passageiros anunciados', () => {
    for (const f of FLEET) {
      const c = FLEET_SPECS[f.id].cabin;
      const toilet = c.zones.some((z) => z.toilet) ? 1 : 0;
      const crew = FLEET_SPECS[f.id].nose === 'prop' ? 2 : 0; // Matrix: 6 lugares incluindo o piloto
      expect([c.seats.length + crew, c.seats.length + toilet]).toContain(f.pax);
    }
  });
});

describe('catálogo de previews V6', () => {
  it('todo hotspot tem título, função e CTA; mídia aponta para render existente', () => {
    const exists = (u?: string) => !!u && fs.existsSync(path.resolve('public' + u));
    for (const f of FLEET) for (const s of systemsFor(f.id)) {
      const p = fleetSystemPreview(f.id, s.id);
      expect(p.title && p.text && p.cta).toBeTruthy();
      expect(exists(p.media)).toBe(true);
    }
    for (const part of PARTS) { const p = anatomySystemPreview(part.id); expect(exists(p.media)).toBe(true); }
    for (const d of DETAILS) { const p = anatomyDetailPreview(d.id)!; expect(p.text.length).toBeGreaterThan(5); expect(exists(p.media)).toBe(true); }
  });
});
