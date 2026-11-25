import type { PartId } from '@/content/site';
import type { SystemId } from '@/content/fleet';

/** Elementos DOM atualizados diretamente pelo loop do canvas (sem estado React por frame). */
export const domRefs = {
  veil: null as HTMLElement | null,
  hotspotLayer: null as HTMLElement | null,
  hotspots: new Map<PartId, HTMLElement>(),
  route: null as SVGPathElement | null,
  seatLayer: null as HTMLElement | null,
  seats: [] as HTMLElement[],
  /** V6: hotspots da aeronave ativa no hangar (projetados pelo loop do canvas) */
  fleetHotLayer: null as HTMLElement | null,
  fleetHotspots: new Map<SystemId, HTMLElement>(),
};
