import ptMessages, { type Messages } from '@/i18n/messages/pt';
// Frota SimFly — cinco aeronaves ANUNCIADAS no portfólio (https://simfly.site/#portfolio, fonte S01).
// Dados comerciais vêm de simfly-fleet-pack/data/fleet.json. Status e fatos são do anúncio, não telemetria,
// e a disponibilidade precisa ser confirmada com a SimFly. Não há preço, matrícula nem número de série publicados.
// Os modelos 3D do hangar são ILUSTRAÇÕES PARAMÉTRICAS calibradas pelas dimensões públicas do tipo
// (ver src/three/fleet/specs.ts) — não são gêmeos digitais dos exemplares.

export type FleetId = 'legacy-450' | 'praetor-500' | 'praetor-600' | 'matrix' | 'citation-cj2-plus';
export type SystemId = 'fuselagem' | 'asas' | 'propulsao' | 'empenagem' | 'trem' | 'cabine' | 'portas';

export interface FleetItem {
  id: FleetId;
  make: string;
  name: string;
  year: number;
  /** classificação pública corrigida (Matrix NÃO é jato) */
  category: string;
  type: string;
  condition: string;
  status: string;
  /** destaque do anúncio (até 3 itens no card) */
  facts: string[];
  /** fatos adicionais na expansão */
  more: string[];
  engine: string;
  engineType: 'turbofan' | 'piston';
  /** passageiros anunciados (não é capacidade máxima certificada) */
  pax: number;
  /** posição do exemplar na fila do hangar (m, eixo x da cena) */
  x: number;
  exclusive?: boolean;
  /** nota de auditoria (exibida só no relatório, nunca como rótulo público) */
  audit?: string;
}

export const FLEET: FleetItem[] = [
  {
    id: 'legacy-450', make: 'Embraer', name: 'Legacy 450', year: 2018, category: 'Jato executivo médio', type: 'EMB-545',
    condition: 'Seminovo · nacionalizado', status: 'Anunciado para venda', pax: 8, x: 0,
    facts: ['1.160 h desde novo', '8 passageiros + lavatório', 'Histórico de hangaragem'],
    more: ['ATN 2000+, FANS 1/A, CPDLC, ACARS, Iridium, HF/SELCAL', 'Micro-ondas e cafeteira', 'Manutenções na Embraer Sorocaba, segundo o anúncio'],
    engine: '2 × Honeywell HTF7500E', engineType: 'turbofan',
  },
  {
    id: 'praetor-500', make: 'Embraer', name: 'Praetor 500', year: 2019, category: 'Jato executivo médio', type: 'EMB-545',
    condition: 'Seminovo · nacionalizado', status: 'Anunciado para venda', pax: 9, x: -24,
    facts: ['3.340 nm de alcance anunciado', '466 kt de cruzeiro anunciado', '9 passageiros anunciados'],
    more: ['Redução ativa de turbulência', 'Programas ativos, segundo o anúncio', 'Evolução da família Legacy 450', 'Alcance do fabricante com 4 passageiros e reservas NBAA IFR'],
    engine: '2 × Honeywell HTF7500E', engineType: 'turbofan',
  },
  {
    id: 'praetor-600', make: 'Embraer', name: 'Praetor 600', year: 2024, category: 'Jato executivo supermédio', type: 'EMB-550',
    condition: 'Anunciado como novo · nacionalizado', status: 'Oportunidade exclusiva (anúncio)', pax: 12, x: -48, exclusive: true,
    facts: ['4.018 nm de alcance anunciado', '466 kt de cruzeiro anunciado', '12 passageiros anunciados'],
    more: ['Cabine executiva de piso plano', 'Versão 2024 — não é o Praetor 600E de 2026', '“Novo” é status do anúncio, não garantia atual'],
    engine: '2 × Honeywell HTF7500E', engineType: 'turbofan',
  },
  {
    id: 'matrix', make: 'Piper', name: 'Matrix', year: 2011, category: 'Monomotor a pistão turboalimentado', type: 'PA-46R-350T',
    condition: 'Seminovo', status: 'Anunciado para venda', pax: 6, x: -70,
    facts: ['Operacional, segundo o anúncio', 'Documentação completa, segundo o anúncio', 'Seis lugares no tipo, incluindo piloto'],
    more: ['Cabine não pressurizada', 'Motor a pistão com turbocompressor e hélice', 'Histórico de manutenção informado pelo vendedor'],
    engine: '1 × Lycoming TIO-540-AE2A, 350 hp', engineType: 'piston',
    audit: 'O anúncio original classifica o Matrix como “jato leve”; corrigido publicamente para monomotor a pistão (PA-46R-350T).',
  },
  {
    id: 'citation-cj2-plus', make: 'Cessna', name: 'Citation CJ2+', year: 2007, category: 'Jato executivo leve', type: '525A',
    condition: 'Seminovo', status: 'Anunciado para venda', pax: 6, x: -88,
    facts: ['1.613 nm de alcance anunciado', '6 passageiros anunciados', 'Perfil regional, eficiente e ágil'],
    more: ['Alcance depende de carga e condições', 'Não confundir com CJ2, CJ3 ou CJ4'],
    engine: '2 × Williams FJ44-3A-24', engineType: 'turbofan',
  },
];

/** Canal oficial (revalidar no site antes de publicar). Mensagem pré-preenchida, nunca enviada automaticamente. */
export const CONTACT = { whatsapp: '5534991386000', email: 'contato@simfly.com.br' };

export function quoteUrl(item: Pick<FleetItem, 'make' | 'name' | 'year'>, phone = CONTACT.whatsapp, m: Messages = ptMessages) {
  if (!/^\d{10,15}$/.test(phone)) throw new Error('Telefone inválido');
  const text = m.fleet.quoteText.replace('{name}', `${item.make} ${item.name}`).replace('{year}', String(item.year));
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
export function mailUrl(item: Pick<FleetItem, 'make' | 'name' | 'year'>, m: Messages = ptMessages) {
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent(m.fleet.mailSubject.replace('{name}', `${item.make} ${item.name}`).replace('{year}', String(item.year)))}`;
}

export interface Component { id: string; label: string; text: string }
export interface SystemInfo { id: SystemId; label: string; text: string; parts: Component[] }

/** Sistemas e peças por aeronave, no idioma ativo. Descrições funcionais gerais (catálogo educacional), não lista IPC. */
export function systemsFor(id: FleetId, m: Messages = ptMessages): SystemInfo[] {
  const piston = id === 'matrix';
  const cj = id === 'citation-cj2-plus';
  const winglets = !piston && !cj;
  const f = FLEET.find((x) => x.id === id)!;
  const S = m.fleet.sys, P = m.fleet.parts;
  const part = (pid: keyof typeof P): Component => ({ id: pid, label: P[pid].label, text: P[pid].text });
  const v = (o: { jet: string; piston: string; cj?: string }) => (piston ? o.piston : cj && o.cj ? o.cj : o.jet);
  const vars = { engine: f.engine, n: f.pax };
  const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_, k) => String((vars as Record<string, string | number>)[k] ?? `{${k}}`));
  return [
    { id: 'fuselagem', label: S.fuselagem.label, text: v(S.fuselagem), parts: [part('skin'), part('windshield'), part('frames'), ...(piston ? [] : [part('radome')]), part('sensors')] },
    { id: 'asas', label: piston ? S.asas.labelPiston : S.asas.label, text: v(S.asas), parts: [part('wing'), ...(winglets ? [part('winglet')] : []), part('aileron'), part('flap'), part('spar'), part('fuel'), part('navlights')] },
    { id: 'propulsao', label: piston ? S.propulsao.labelPiston : S.propulsao.label, text: fill(v(S.propulsao)),
      parts: piston ? (['prop', 'spinner', 'cowling', 'crankcase', 'cylinders', 'turbo', 'intercooler'] as const).map(part) : (['nacelle', 'fan', 'compressor', 'combustor', 'turbine', 'shaft', 'accessory', 'pylon'] as const).map(part) },
    { id: 'empenagem', label: S.empenagem.label, text: v(S.empenagem), parts: [part('fin'), part('stab')] },
    { id: 'trem', label: S.trem.label, text: v(S.trem), parts: [part('gear-nose'), part('gear-main'), part('brakes')] },
    { id: 'cabine', label: S.cabine.label, text: fill(v(S.cabine)), parts: [part('seats'), part('floor'), part('cockpit'), ...(id === 'legacy-450' ? [part('lavatory')] : [])] },
    { id: 'portas', label: S.portas.label, text: v(S.portas), parts: [part('door')] },
  ];
}
/** compatibilidade com a lista de peças do inspetor (peças achatadas por sistema) */
export const partsFor = (id: FleetId, m: Messages = ptMessages) => systemsFor(id, m).flatMap((s) => s.parts.map((p) => ({ ...p, system: s.id })));
