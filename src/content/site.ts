// Conteúdo editorial original. Nenhuma especificação de aeronave, rota operada, tarifa ou credencial é declarada.
export type ChapterId = 'top' | 'portal' | 'aeronave' | 'frota' | 'engenharia' | 'interior' | 'experiencia' | 'destinos' | 'planejar';

/** Capítulos do filme: cada um vale 1 unidade de tempo global (t). */
export const CHAPTERS: { id: ChapterId; label: string; t0: number }[] = [
  { id: 'top', label: 'Atmosfera', t0: 0 },
  { id: 'portal', label: 'Limiar', t0: 1 },
  { id: 'aeronave', label: 'Aeronave', t0: 2 },
  { id: 'frota', label: 'Frota', t0: 3 },
  { id: 'engenharia', label: 'Anatomia', t0: 4 },
  { id: 'interior', label: 'Interior', t0: 5 },
  { id: 'experiencia', label: 'Cabine', t0: 6 },
  { id: 'destinos', label: 'Destinos', t0: 7 },
  { id: 'planejar', label: 'Contato', t0: 8 },
];

export type PartId = 'fuselagem' | 'asas' | 'motores' | 'empenagem' | 'trem' | 'cabine';

export const PARTS: { id: PartId; label: string; index: string; text: string }[] = [
  { id: 'fuselagem', index: '01', label: 'Fuselagem', text: 'Seção elíptica contínua. A mesma curva que desenha o perfil exterior define o volume da cabine.' },
  { id: 'asas', index: '02', label: 'Asas', text: 'Enflechamento e winglets desenhados para que a aeronave transmita velocidade mesmo em repouso.' },
  { id: 'motores', index: '03', label: 'Motores', text: 'Nacelas montadas na traseira, arranjo clássico de jatos executivos, aqui posicionadas longe da área de estar.' },
  { id: 'empenagem', index: '04', label: 'Empenagem', text: 'Cauda em T: o estabilizador horizontal no topo da deriva é a assinatura de perfil do conceito.' },
  { id: 'trem', index: '05', label: 'Trem de pouso', text: 'Em solo, define a postura da aeronave; em voo, desaparece no contorno da fuselagem e das asas.' },
  { id: 'cabine', index: '06', label: 'Cabine', text: 'Volume habitável modelado em escala real dentro da mesma geometria. É para lá que a câmera segue.' },
];

export type VariantId = 'L' | 'M' | 'XR';
export const VARIANTS: { id: VariantId; label: string; text: string }[] = [
  { id: 'L', label: 'Compacta', text: 'Fuselagem curta, quatro janelas por lado.' },
  { id: 'M', label: 'Média', text: 'Proporção equilibrada, seis janelas por lado.' },
  { id: 'XR', label: 'Alongada', text: 'Fuselagem longa, nove janelas por lado e suíte.' },
];

export type ViewId = 'exterior' | 'cabine' | 'detalhes';
export const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'exterior', label: 'Exterior' },
  { id: 'cabine', label: 'Cabine' },
  { id: 'detalhes', label: 'Detalhes' },
];

export const GALLERY = [
  { id: 'lounge', index: '01', kicker: 'Lounge', title: 'Conversa sem pressa.', text: 'Poltronas frente a frente, mesa ao alcance da mão e luz indireta, baixa e quente.' },
  { id: 'mesa', index: '02', kicker: 'Mesa', title: 'Decidir no ar.', text: 'Uma mesa para quatro: reunião, refeição ou simplesmente o mapa aberto sobre a madeira.' },
  { id: 'suite', index: '03', kicker: 'Suíte', title: 'Chegar descansado.', text: 'Uma porta que se fecha no fim do corredor. Cama, tecido macio e silêncio.' },
  { id: 'janela', index: '04', kicker: 'Janela', title: 'O mundo, enquadrado.', text: 'Janelas amplas trazem o céu para dentro — e é por uma delas que a viagem continua.' },
] as const;
export type GalleryId = (typeof GALLERY)[number]['id'];
