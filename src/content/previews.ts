import type { PreviewItem } from '@/components/preview/usePreview';
import { PARTS, type PartId } from './site';
import { DETAILS } from './anatomy24';
import { FLEET, systemsFor, type FleetId, type SystemId } from './fleet';

// Catálogo de previews V6 (base: simfly-fleet-pack/data/preview-catalog.json).
// Mídia: renders originais da própria cena 3D (scripts/render-previews.mjs). Sem arquivo → fallback explícito.

const ANATOMY_FN: Record<PartId, string> = {
  fuselagem: 'Estrutura principal que integra cabine, cockpit e a união com asas e empenagem.',
  asas: 'Geram sustentação e alojam superfícies de controle e, em muitos jatos, combustível.',
  motores: 'Sistema propulsivo que gera o empuxo para deslocar a aeronave.',
  empenagem: 'Conjunto de cauda que garante estabilidade direcional e longitudinal.',
  trem: 'Apoio, absorção de impacto e manobra em solo.',
  cabine: 'Ambiente interno de passageiros, com poltronas, mesas e sistemas de conforto.',
};
const firstSentence = (t: string) => { const m = t.match(/^.*?[.!?](\s|$)/); return (m ? m[0] : t).trim(); };

export function anatomySystemPreview(id: PartId): PreviewItem {
  const p = PARTS.find((x) => x.id === id)!;
  return { key: `anatomy:${id}`, kicker: `Sistema ${p.index}`, badge: 'Render do modelo conceitual', title: p.label, text: ANATOMY_FN[id], media: `/media/previews/anatomy/${id}.webp`, cta: `Abrir ${p.label.toLowerCase()} em 3D` };
}
export function anatomyDetailPreview(detailId: string): PreviewItem | null {
  const d = DETAILS.find((x) => x.id === detailId); if (!d) return null;
  const sys = PARTS.find((x) => x.id === d.group)!;
  return { key: `anatomy:${d.group}:${d.id}`, kicker: sys.label, badge: d.schematic ? '3D didático' : 'Peça do modelo', title: d.label, text: firstSentence(d.text), media: `/media/previews/anatomy/${d.group}__${d.id}.webp`, cta: 'Isolar peça em 3D' };
}
export function fleetSystemPreview(aircraft: FleetId, sys: SystemId): PreviewItem {
  const a = FLEET.find((x) => x.id === aircraft)!;
  const s = systemsFor(aircraft).find((x) => x.id === sys)!;
  return { key: `fleet:${aircraft}:${sys}`, kicker: `${a.make} ${a.name}`, badge: 'Ilustração paramétrica', title: s.label, text: firstSentence(s.text), media: `/media/previews/fleet/${aircraft}/${sys}.webp`, cta: `Explorar ${s.label.toLowerCase()}` };
}
