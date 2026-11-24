'use client';
import { useEffect, useRef } from 'react';
import { PARTS, type PartId } from '@/content/site';
import { ui } from '@/experience/director';
import { domRefs } from '@/experience/domRefs';
import { track } from '@/lib/analytics';
import stillAnchors from '@/content/anatomy-anchors.json';

/** Hotspots ligados às malhas (posição projetada a cada frame pelo canvas) + lista acessível. */
export function HotspotLayer() {
  const part = ui.useStore((s) => s.part);
  const motion = ui.useStore((s) => s.motion);
  const layer = useRef<HTMLDivElement>(null);
  const live = motion === 'cinematic';
  useEffect(() => {
    domRefs.hotspotLayer = live ? layer.current : null;
    return () => { domRefs.hotspotLayer = null; domRefs.hotspots.clear(); };
  }, [live]);
  const anchors = stillAnchors as unknown as Record<string, [number, number]>;
  return (
    <div ref={layer} className="hotspots" data-visible={live ? 'false' : 'true'} data-mode={live ? 'live' : 'still'}>
      {PARTS.map((p) => {
        const a = anchors[p.id];
        const style = !live && a ? { transform: 'none', left: `${a[0] * 100}%`, top: `${a[1] * 100}%` } : undefined;
        return (
          <button
            key={p.id}
            type="button"
            className="hotspot"
            style={style}
            ref={(el) => { if (el && live) domRefs.hotspots.set(p.id, el); else domRefs.hotspots.delete(p.id); }}
            aria-pressed={part === p.id}
            aria-label={`${p.label}: destacar sistema`}
            tabIndex={-1}
            onClick={() => { ui.set({ part: part === p.id ? null : p.id }); track('anatomy_part', { part: p.id }); }}
          >
            <i aria-hidden="true" /><span aria-hidden="true">{p.index} · {p.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function AnatomyPanel() {
  const part = ui.useStore((s) => s.part);
  const explode = ui.useStore((s) => s.explodeManual);
  const sel = PARTS.find((p) => p.id === part);
  const pick = (id: PartId) => { ui.set({ part: part === id ? null : id }); track('anatomy_part', { part: id }); };
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <p className="sr-only" id="parts-label">Sistemas</p>
        <div className="part-list" role="group" aria-labelledby="parts-label">
          {PARTS.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={part === p.id} onClick={() => pick(p.id)}>{p.label}</button>
          ))}
        </div>
      </div>
      <div className="part-card" aria-live="polite">
        {sel ? (<><h3>{sel.index} · {sel.label}</h3><p>{sel.text}</p></>) : (<><h3>Selecione um sistema</h3><p>Pontos sobre a aeronave ou a lista acima.</p></>)}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--ghost btn--small" aria-pressed={explode === 1} onClick={() => ui.set({ explodeManual: explode === 1 ? 0 : 1 })}>
          {explode === 1 ? 'Montar aeronave' : 'Abrir em camadas'}
        </button>
        {explode !== null && <button type="button" className="btn btn--ghost btn--small" onClick={() => ui.set({ explodeManual: null })}>Seguir o scroll</button>}
        <span className="micro">Conceitual, sem especificações.</span>
      </div>
    </div>
  );
}
