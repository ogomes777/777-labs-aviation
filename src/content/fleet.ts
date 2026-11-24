// Frota CONCEITUAL do showroom. Nomes e geometrias originais — nenhuma aeronave real, certificada ou à venda.
// Componentes descritos são genéricos da aviação (função geral), não especificações de modelo.
export type FleetId = 'XR' | 'M' | 'L' | 'TP' | 'H';
export interface FleetItem { id: FleetId; name: string; kind: string; line: string; x: number }

export const FLEET: FleetItem[] = [
  { id: 'XR', name: 'Meridian', kind: 'Jato', line: 'Cabine longa com suíte', x: 0 },
  { id: 'M', name: 'Solstice', kind: 'Jato', line: 'Cabine média', x: -46 },
  { id: 'L', name: 'Aurora', kind: 'Jato', line: 'Cabine compacta', x: -84 },
  { id: 'TP', name: 'Horizon', kind: 'Turboélice', line: 'Asa alta, hélices de cinco pás', x: -118 },
  { id: 'H', name: 'Zenith', kind: 'Helicóptero', line: 'Rotor principal de cinco pás', x: -150 },
];

export interface Component { id: string; label: string; text: string }

export const JET_PARTS: Component[] = [
  { id: 'cabine', label: 'Módulo de cabine', text: 'Assentos, revestimentos e iluminação, montados como um volume único.' },
  { id: 'para-brisa', label: 'Para-brisa', text: 'Painéis transparentes da cabine de comando.' },
  { id: 'asas', label: 'Asas e winglets', text: 'Geram sustentação; o winglet reduz o arrasto induzido na ponta.' },
  { id: 'carenagem', label: 'Carenagem asa-fuselagem', text: 'Suaviza a junção entre asa e fuselagem.' },
  { id: 'fan', label: 'Fan', text: 'Acelera o grande fluxo de ar que produz a maior parte do empuxo de um turbofan.' },
  { id: 'entrada', label: 'Entrada de ar', text: 'Conduz o ar até o fan com o mínimo de perdas.' },
  { id: 'escape', label: 'Cone de escape', text: 'Organiza a saída dos gases do núcleo do motor.' },
  { id: 'pilone', label: 'Pilones', text: 'Fixam os motores à estrutura e conduzem combustível e sistemas.' },
  { id: 'deriva', label: 'Deriva', text: 'Estabilidade direcional; abriga o leme.' },
  { id: 'estabilizador', label: 'Estabilizador horizontal', text: 'Estabilidade longitudinal; abriga os profundores.' },
  { id: 'trem', label: 'Trem de pouso', text: 'Absorve o impacto do pouso e sustenta a aeronave em solo.' },
];
export const TP_PARTS: Component[] = [
  { id: 'cabine', label: 'Módulo de cabine', text: 'Interior montado como um volume único.' },
  { id: 'helice', label: 'Hélices', text: 'Convertem a potência da turbina em tração.' },
  { id: 'nacela', label: 'Naceles', text: 'Carenagens dos motores turboélice sob a asa.' },
  { id: 'asas', label: 'Asa alta', text: 'Montada sobre a fuselagem, mantém as hélices longe do solo.' },
  { id: 'deriva', label: 'Deriva', text: 'Estabilidade direcional; abriga o leme.' },
  { id: 'estabilizador', label: 'Estabilizador horizontal', text: 'Estabilidade longitudinal; abriga os profundores.' },
  { id: 'trem', label: 'Trem de pouso', text: 'Recolhe para carenagens na fuselagem.' },
];
export const HELI_PARTS: Component[] = [
  { id: 'rotor', label: 'Rotor principal', text: 'Gera sustentação e controle: as pás mudam de passo ao longo de cada volta.' },
  { id: 'mastro', label: 'Mastro', text: 'Transmite a potência da transmissão ao rotor.' },
  { id: 'carenagem', label: 'Carenagem do motor', text: 'Protege turbinas e transmissão.' },
  { id: 'rotor-cauda', label: 'Rotor de cauda', text: 'Compensa o torque do rotor principal.' },
  { id: 'empenagem', label: 'Empenagem', text: 'Deriva e estabilizador dão estabilidade em voo de cruzeiro.' },
  { id: 'esquis', label: 'Esquis', text: 'Trem de pouso fixo para superfícies variadas.' },
  { id: 'para-brisa', label: 'Para-brisa envolvente', text: 'Ampla área envidraçada para visibilidade.' },
];
export const partsFor = (id: FleetId) => (id === 'H' ? HELI_PARTS : id === 'TP' ? TP_PARTS : JET_PARTS);
