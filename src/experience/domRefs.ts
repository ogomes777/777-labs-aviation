import type { PartId } from '@/content/site';

/** Elementos DOM atualizados diretamente pelo loop do canvas (sem estado React por frame). */
export const domRefs = {
  veil: null as HTMLElement | null,
  hotspotLayer: null as HTMLElement | null,
  hotspots: new Map<PartId, HTMLElement>(),
  route: null as SVGPathElement | null,
  seatLayer: null as HTMLElement | null,
  seats: [] as HTMLElement[],
};
