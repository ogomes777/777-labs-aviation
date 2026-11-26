import type { PreviewItem } from '@/components/preview/usePreview';
import { PARTS, type PartId } from './site';
import { DETAILS } from './anatomy24';
import { FLEET, systemsFor, type FleetId, type SystemId } from './fleet';
import ptMessages, { type Messages } from '@/i18n/messages/pt';

// Catálogo de previews V6 (base: simfly-fleet-pack/data/preview-catalog.json).
// Mídia: renders originais da própria cena 3D (scripts/render-previews.mjs). Sem arquivo → fallback explícito.

const firstSentence = (t: string) => { const m = t.match(/^.*?([.!?](\s|$)|[。！？])/); return (m ? m[0] : t).trim(); };

export function anatomySystemPreview(id: PartId, m: Messages = ptMessages): PreviewItem {
  const lab = m.anatomy.parts[id].label, pv = m.fleet.preview;
  return { key: `anatomy:${id}`, kicker: lab, badge: pv.render, title: lab, text: m.anatomy.parts[id].fn, media: `/media/previews/anatomy/${id}.webp`, cta: pv.openIn3d.replace('{name}', lab.toLowerCase()) };
}
export function anatomyDetailPreview(detailId: string, m: Messages = ptMessages): PreviewItem | null {
  const d = DETAILS.find((x) => x.id === detailId); if (!d) return null;
  const t = m.anatomy.details[d.id as keyof Messages['anatomy']['details']] ?? { label: d.label, text: d.text };
  const pv = m.fleet.preview;
  return { key: `anatomy:${d.group}:${d.id}`, kicker: m.anatomy.parts[d.group].label, badge: d.schematic ? m.anatomy.schematic : pv.piece, title: t.label, text: firstSentence(t.text), media: `/media/previews/anatomy/${d.group}__${d.id}.webp`, cta: pv.isolate };
}
export function fleetSystemPreview(aircraft: FleetId, sys: SystemId, m: Messages = ptMessages): PreviewItem {
  const a = FLEET.find((x) => x.id === aircraft)!;
  const s = systemsFor(aircraft, m).find((x) => x.id === sys)!;
  return { key: `fleet:${aircraft}:${sys}`, kicker: `${a.make} ${a.name}`, badge: m.fleet.preview.badge, title: s.label, text: firstSentence(s.text), media: `/media/previews/fleet/${aircraft}/${sys}.webp`, cta: m.fleet.preview.cta.replace('{name}', s.label.toLowerCase()) };
}
