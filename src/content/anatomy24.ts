import type { PartId } from './site';
export type Detail = { id: string; group: PartId; label: string; text: string; modeled: boolean; schematic?: boolean };
export type SystemNote = { title: string; kicker: string; lead: string; cinematic: string };
// Educational catalogue; no claim of a certified aircraft or an OEM parts list.
export const DETAILS: Detail[] = [
  {id:'shell',group:'fuselagem',label:'Revestimento estrutural',text:'A casca exterior distribui cargas e fecha o volume pressurizado. No avião real, cavernas e longarinas reforçam o revestimento.',modeled:true},
  {id:'windshield',group:'fuselagem',label:'Para-brisa',text:'Painéis transparentes do cockpit. Em jatos pressurizados, a construção e o aquecimento dependem do modelo.',modeled:true},
  {id:'glass',group:'fuselagem',label:'Janelas',text:'Conjunto de vidros da cabine de passageiros; molduras e vedações fazem parte da instalação.',modeled:true,schematic:true},
  {id:'fairing',group:'fuselagem',label:'Carenagem',text:'Suaviza a junção asa-fuselagem e reduz interferências aerodinâmicas.',modeled:true},
  {id:'frames',group:'fuselagem',label:'Cavernas e longarinas',text:'Reforços internos distribuem esforços pela fuselagem. A visualização separa anéis estruturais, reforços longitudinais e fixações.',modeled:true,schematic:true},
  {id:'radome',group:'fuselagem',label:'Radome / aviônicos',text:'O radome pode abrigar antenas de radar meteorológico; computadores e sensores variam conforme a aeronave.',modeled:true,schematic:true},
  {id:'wing-port',group:'asas',label:'Asa esquerda',text:'Superfície que produz sustentação; o modelo integra a ponta de asa à mesma malha.',modeled:true},
  {id:'wing-starboard',group:'asas',label:'Asa direita',text:'Superfície de sustentação com geometria enflechada e ponta integrada neste conceito.',modeled:true},
  {id:'winglet',group:'asas',label:'Winglets',text:'Dispositivos de ponta que podem reduzir arrasto induzido. A vista didática mostra a ponta e sua base de fixação.',modeled:true,schematic:true},
  {id:'ailerons',group:'asas',label:'Ailerons',text:'Superfícies móveis que controlam principalmente a rolagem.',modeled:true,schematic:true},
  {id:'flaps',group:'asas',label:'Flaps e slats',text:'Dispositivos hipersustentadores; a configuração e a presença de slats variam por tipo de aeronave.',modeled:true,schematic:true},
  {id:'spoilers',group:'asas',label:'Spoilers',text:'Painéis que reduzem sustentação e aumentam arrasto quando acionados, conforme o projeto.',modeled:true,schematic:true},
  {id:'spar',group:'asas',label:'Longarinas e nervuras',text:'Estrutura interna que transmite os esforços da asa. A vista separa os principais elementos estruturais.',modeled:true,schematic:true},
  {id:'fuel',group:'asas',label:'Tanques de combustível',text:'Muitos jatos armazenam combustível nas asas. Localização e arquitetura dependem do projeto.',modeled:true,schematic:true},
  {id:'nacelle',group:'motores',label:'Nacelas',text:'Carenagens externas que envolvem os motores e organizam o escoamento de ar.',modeled:true},
  {id:'lip',group:'motores',label:'Lábio de admissão',text:'Borda da entrada de ar, desenhada para alimentar o motor com escoamento adequado.',modeled:true},
  {id:'duct',group:'motores',label:'Duto de admissão',text:'Passagem que conduz o ar admitido ao fan.',modeled:true},
  {id:'fan',group:'motores',label:'Fan e cone frontal',text:'O fan acelera ar para produzir empuxo e alimentar o núcleo do turbofan. O cone e as pás estão representados.',modeled:true},
  {id:'pylon',group:'motores',label:'Pilones',text:'Estruturas de ligação dos motores à aeronave; transmitem cargas do conjunto.',modeled:true},
  {id:'exhaust-duct',group:'motores',label:'Duto de escape',text:'Canal de saída do escoamento do conjunto propulsor.',modeled:true},
  {id:'exhaust-cone',group:'motores',label:'Cone de escape',text:'Elemento central que integra a geometria de saída do motor conceitual.',modeled:true},
  {id:'core',group:'motores',label:'Compressor, combustão e turbina',text:'O compressor eleva a pressão do ar; a combustão adiciona energia; as turbinas extraem parte dessa energia. A vista didática distingue estágios do compressor, câmaras de combustão e turbinas.',modeled:true,schematic:true},
  {id:'fin',group:'empenagem',label:'Deriva',text:'Superfície vertical que contribui para a estabilidade direcional.',modeled:true},
  {id:'stab',group:'empenagem',label:'Estabilizador horizontal',text:'Superfície da cauda que contribui para estabilidade longitudinal e controle de arfagem.',modeled:true},
  {id:'rudder',group:'empenagem',label:'Leme',text:'Superfície móvel de controle direcional, instalada na região posterior da deriva.',modeled:true,schematic:true},
  {id:'elevator',group:'empenagem',label:'Profundores',text:'Superfícies de comando de arfagem, cuja geometria varia entre aeronaves.',modeled:true,schematic:true},
  {id:'gear-nose',group:'trem',label:'Trem dianteiro',text:'Sustenta a região dianteira no solo; normalmente permite orientação durante o táxi.',modeled:true},
  {id:'gear-main',group:'trem',label:'Trens principais',text:'Recebem grande parte das cargas de solo e pouso.',modeled:true},
  {id:'strut',group:'trem',label:'Montantes',text:'Conjunto estrutural de sustentação e absorção de cargas; a geometria é simplificada neste conceito.',modeled:true},
  {id:'axle',group:'trem',label:'Eixos',text:'Suportam as rodas e transmitem cargas ao trem.',modeled:true},
  {id:'wheel',group:'trem',label:'Pneus e rodas',text:'Contato da aeronave com o solo; pneus, rodas e cubos são representados por malhas próprias.',modeled:true},
  {id:'brakes',group:'trem',label:'Freios e retração',text:'Freios dissipam energia e mecanismos recolhem o trem em voo. A vista distingue discos, eixo, roda e atuador de retração.',modeled:true,schematic:true},
  {id:'seat',group:'cabine',label:'Poltronas',text:'Assentos executivos com base, encosto, apoios, acabamento em couro e detalhes metálicos.',modeled:true},
  {id:'table',group:'cabine',label:'Mesas',text:'Superfícies de apoio e trabalho na cabine conceitual.',modeled:true,schematic:true},
  {id:'bezels',group:'cabine',label:'Molduras das janelas',text:'Acabamentos internos ao redor das aberturas, integrados ao revestimento da cabine.',modeled:true,schematic:true},
  {id:'reveals',group:'cabine',label:'Revelos das janelas',text:'Superfícies de transição entre a casca exterior e o revestimento interno.',modeled:true,schematic:true},
  {id:'systems',group:'cabine',label:'Pressurização, climatização e elétrica',text:'Sistemas de conforto, distribuição elétrica e controle ambiental variam por aeronave. A vista mostra módulos e conexões de forma esquemática.',modeled:true,schematic:true},
];

export const SYSTEM_NOTES: Record<PartId, SystemNote> = {
  fuselagem: {
    title: 'Fuselagem',
    kicker: 'Atlas estrutural',
    lead: 'Da casca externa ao radome, o estudo revela o volume pressurizado e seus reforços internos.',
    cinematic: 'Observe a peça isolada, explore as camadas e gire o conjunto para entender a lógica construtiva.'
  },
  asas: {
    title: 'Asas',
    kicker: 'Atlas aerodinâmico',
    lead: 'Superfícies, hipersustentação e estrutura interna aparecem como peças separadas, mantendo a leitura clean.',
    cinematic: 'A seleção destaca sustentação, controle e estrutura em uma navegação mais editorial.'
  },
  motores: {
    title: 'Motores',
    kicker: 'Atlas propulsivo',
    lead: 'Da nacela ao núcleo, o motor é apresentado como um conjunto progressivo, com foco nas partes essenciais.',
    cinematic: 'As peças isoladas ganham leitura técnica sem perder o tom cinematográfico da experiência.'
  },
  empenagem: {
    title: 'Empenagem',
    kicker: 'Atlas de estabilidade',
    lead: 'Deriva, estabilizador, leme e profundores aparecem como família de controle e equilíbrio da aeronave.',
    cinematic: 'A visualização privilegia silhueta, movimento e função de cada superfície.'
  },
  trem: {
    title: 'Trem de pouso',
    kicker: 'Atlas de solo',
    lead: 'A mecânica do apoio em pista é dividida entre conjuntos estruturais, rodas, freios e retração.',
    cinematic: 'O estudo busca deixar visível o que normalmente fica escondido sob a fuselagem.'
  },
  cabine: {
    title: 'Cabine',
    kicker: 'Atlas de experiência',
    lead: 'Layout executivo, poltronas, mesas e sistemas internos aparecem como peças de atmosfera e conforto.',
    cinematic: 'A leitura da cabine conversa com a experiência premium da seção seguinte.'
  }
};

export const detailById = (id: string | null) => DETAILS.find(x => x.id === id) ?? null;
export const detailCounts = Object.fromEntries(Object.keys(SYSTEM_NOTES).map(id => [id, DETAILS.filter(x => x.group === id).length])) as Record<PartId, number>;
export const detailHotspots = new Map<string, HTMLButtonElement>();
