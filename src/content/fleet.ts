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
    condition: 'Seminovo · nacionalizado', status: 'Anunciado para venda', pax: 9, x: -32,
    facts: ['3.340 nm de alcance anunciado', '466 kt de cruzeiro anunciado', '9 passageiros anunciados'],
    more: ['Redução ativa de turbulência', 'Programas ativos, segundo o anúncio', 'Evolução da família Legacy 450', 'Alcance do fabricante com 4 passageiros e reservas NBAA IFR'],
    engine: '2 × Honeywell HTF7500E', engineType: 'turbofan',
  },
  {
    id: 'praetor-600', make: 'Embraer', name: 'Praetor 600', year: 2024, category: 'Jato executivo supermédio', type: 'EMB-550',
    condition: 'Anunciado como novo · nacionalizado', status: 'Oportunidade exclusiva (anúncio)', pax: 12, x: -64, exclusive: true,
    facts: ['4.018 nm de alcance anunciado', '466 kt de cruzeiro anunciado', '12 passageiros anunciados'],
    more: ['Cabine executiva de piso plano', 'Versão 2024 — não é o Praetor 600E de 2026', '“Novo” é status do anúncio, não garantia atual'],
    engine: '2 × Honeywell HTF7500E', engineType: 'turbofan',
  },
  {
    id: 'matrix', make: 'Piper', name: 'Matrix', year: 2011, category: 'Monomotor a pistão turboalimentado', type: 'PA-46R-350T',
    condition: 'Seminovo', status: 'Anunciado para venda', pax: 6, x: -92,
    facts: ['Operacional, segundo o anúncio', 'Documentação completa, segundo o anúncio', 'Seis lugares no tipo, incluindo piloto'],
    more: ['Cabine não pressurizada', 'Motor a pistão com turbocompressor e hélice', 'Histórico de manutenção informado pelo vendedor'],
    engine: '1 × Lycoming TIO-540-AE2A, 350 hp', engineType: 'piston',
    audit: 'O anúncio original classifica o Matrix como “jato leve”; corrigido publicamente para monomotor a pistão (PA-46R-350T).',
  },
  {
    id: 'citation-cj2-plus', make: 'Cessna', name: 'Citation CJ2+', year: 2007, category: 'Jato executivo leve', type: '525A',
    condition: 'Seminovo', status: 'Anunciado para venda', pax: 6, x: -114,
    facts: ['1.613 nm de alcance anunciado', '6 passageiros anunciados', 'Perfil regional, eficiente e ágil'],
    more: ['Alcance depende de carga e condições', 'Não confundir com CJ2, CJ3 ou CJ4'],
    engine: '2 × Williams FJ44-3A-24', engineType: 'turbofan',
  },
];

/** Canal oficial (revalidar no site antes de publicar). Mensagem pré-preenchida, nunca enviada automaticamente. */
export const CONTACT = { whatsapp: '5534991386000', email: 'contato@simfly.com.br' };

export function quoteUrl(item: Pick<FleetItem, 'make' | 'name' | 'year'>, phone = CONTACT.whatsapp) {
  if (!/^\d{10,15}$/.test(phone)) throw new Error('Telefone inválido');
  const text = `Olá, tenho interesse no ${item.make} ${item.name} ${item.year} anunciado pela SimFly. Gostaria de confirmar disponibilidade e receber informações.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
export function mailUrl(item: Pick<FleetItem, 'make' | 'name' | 'year'>) {
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent(`Interesse: ${item.make} ${item.name} ${item.year}`)}`;
}

export interface Component { id: string; label: string; text: string }
export interface SystemInfo { id: SystemId; label: string; text: string; parts: Component[] }

/** Sistemas e peças por aeronave. Descrições funcionais gerais (catálogo educacional), não lista IPC. */
export function systemsFor(id: FleetId): SystemInfo[] {
  const piston = id === 'matrix';
  const winglets = id !== 'matrix' && id !== 'citation-cj2-plus';
  const f = FLEET.find((x) => x.id === id)!;
  return [
    { id: 'fuselagem', label: 'Fuselagem', text: piston ? 'Estrutura metálica que integra cockpit e cabine de seis lugares — não pressurizada (EASA IM.A.077).' : 'Estrutura principal pressurizada que integra cockpit, cabine e a união com asas e empenagem.',
      parts: [
        { id: 'skin', label: 'Revestimento', text: 'Casca externa que fecha o volume e distribui cargas junto com a estrutura interna.' },
        { id: 'windshield', label: 'Para-brisa', text: 'Painéis transparentes frontais do cockpit.' },
        { id: 'frames', label: 'Cavernas e longarinas', text: 'Estrutura interna ilustrativa: anéis e reforços longitudinais (posições não verificadas).' },
      ] },
    { id: 'asas', label: piston ? 'Asa baixa' : 'Asas', text: piston ? 'Asa baixa reta de monomotor; superfícies de controle no bordo de fuga.' : `Asa baixa${id === 'citation-cj2-plus' ? ' de enflechamento reduzido' : ' enflechada'}${winglets ? ' com winglets' : ''}; superfícies de controle no bordo de fuga.`,
      parts: [
        { id: 'wing', label: 'Asas esquerda e direita', text: 'Superfícies de sustentação principais.' },
        ...(winglets ? [{ id: 'winglet', label: 'Winglets', text: 'Pontas de asa que reduzem o arrasto induzido; formato ilustrativo até validação por foto.' }] : []),
        { id: 'aileron', label: 'Ailerons', text: 'Controle de rolagem.' },
        { id: 'flap', label: 'Flaps', text: 'Aumentam a sustentação em baixa velocidade.' },
        { id: 'spar', label: 'Longarina e nervuras', text: 'Estrutura interna ilustrativa da asa.' },
      ] },
    { id: 'propulsao', label: piston ? 'Motor e hélice' : 'Propulsão', text: f.engine + (piston ? ': motor a pistão turboalimentado acionando hélice frontal.' : ': turbofans montados na fuselagem traseira.'),
      parts: piston ? [
        { id: 'prop', label: 'Hélice', text: 'Converte a potência do motor em tração. Tipo: hélice Hartzell de 3 pás e 80 pol (EASA); confirmar no exemplar.' },
        { id: 'spinner', label: 'Spinner', text: 'Cone aerodinâmico do cubo da hélice.' },
        { id: 'cowling', label: 'Capô do motor', text: 'Carenagem do motor e das entradas de ar.' },
        { id: 'engine-core', label: 'Motor a pistão', text: 'Representação ilustrativa de cilindros opostos e turbocompressor — não é geometria do fabricante.' },
      ] : [
        { id: 'nacelle', label: 'Nacelas', text: 'Carenagens dos motores; organizam o escoamento de ar.' },
        { id: 'fan', label: 'Fan', text: 'Acelera o fluxo de ar que produz a maior parte do empuxo do turbofan.' },
        { id: 'engine-core', label: 'Núcleo do motor', text: 'Compressor, combustão e turbina em representação ilustrativa.' },
        { id: 'pylon', label: 'Pilones', text: 'Ligam os motores à fuselagem.' },
      ] },
    { id: 'empenagem', label: 'Empenagem', text: piston ? 'Cauda convencional: estabilizador horizontal na base da deriva.' : 'Cauda em T: estabilizador horizontal no topo da deriva.',
      parts: [
        { id: 'fin', label: 'Deriva e leme', text: 'Estabilidade e controle direcional.' },
        { id: 'stab', label: 'Estabilizador e profundores', text: 'Estabilidade longitudinal e controle de arfagem.' },
      ] },
    { id: 'trem', label: 'Trem de pouso', text: piston ? 'Trem triciclo retrátil, mostrado baixado em solo.' : 'Trem triciclo retrátil, mostrado baixado em solo.',
      parts: [
        { id: 'gear-nose', label: 'Trem dianteiro', text: 'Sustenta o nariz em solo e permite orientação no táxi.' },
        { id: 'gear-main', label: 'Trens principais', text: 'Recebem a maior parte das cargas de solo.' },
      ] },
    { id: 'cabine', label: 'Cabine', text: `Interior ilustrativo com ${f.pax} lugares anunciados${piston ? ' (inclui piloto), sem itens de cabine de jato' : ''}. Layout real do exemplar a confirmar.`,
      parts: [
        { id: 'seats', label: 'Poltronas', text: 'Disposição ilustrativa a partir da capacidade anunciada.' },
        { id: 'floor', label: 'Piso e revestimento', text: 'Piso e laterais internas em representação ilustrativa.' },
      ] },
    { id: 'portas', label: 'Portas e acessos', text: piston ? 'Porta com escada integrada (airstair) no tipo; lado e posição não verificados — representação ilustrativa até foto do exemplar.' : (id === 'citation-cj2-plus' ? 'Porta principal dianteira esquerda em representação ilustrativa; posição não verificada para o tipo.' : 'Porta principal dianteira esquerda, logo atrás do cockpit (ilustração Embraer); confirmar no exemplar.'),
      parts: [{ id: 'door', label: 'Porta principal', text: 'Posição e contorno ilustrativos.' }] },
  ];
}
/** compatibilidade com a lista de peças do inspetor (peças achatadas por sistema) */
export const partsFor = (id: FleetId) => systemsFor(id).flatMap((s) => s.parts.map((p) => ({ ...p, system: s.id })));
