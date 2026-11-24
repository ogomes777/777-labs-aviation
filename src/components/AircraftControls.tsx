'use client';
import { VARIANTS, VIEWS, type VariantId, type ViewId } from '@/content/site';
import { frame, ui } from '@/experience/director';
import { navigate } from './navigation';
import { track } from '@/lib/analytics';

export default function AircraftControls() {
  const view = ui.useStore((s) => s.view);
  const variant = ui.useStore((s) => s.variant);
  const motion = ui.useStore((s) => s.motion);
  const live = motion === 'cinematic';
  const ensureHangar = () => { if (live && (frame.t < 2.02 || frame.t > 2.98)) navigate('#aeronave', { focus: false }); };
  void pickVariantSafe;
  const pickView = (v: ViewId) => {
    ensureHangar();
    ui.set({ view: view === v ? null : v });
    track('aircraft_explore_start', { view: v });
  };
  const pickVariant = (v: VariantId) => { ui.set({ variant: v }); track('aircraft_variant', { variant: v }); };
  function pickVariantSafe() { return pickVariant; }
  const vText = VARIANTS.find((v) => v.id === variant)?.text;
  return (
    <div className="aircraft-controls" style={{ display: 'grid', gap: 18 }}>
      <div>
        <p className="sr-only" id="views-label">Perspectiva</p>
        <div className="chips" role="group" aria-labelledby="views-label">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" className="chip" aria-pressed={view === v.id} onClick={() => pickView(v.id)}>{v.label}</button>
          ))}
        </div>
        {!live && view && <p className="note" style={{ marginTop: 8 }}>Vista: {VIEWS.find((x) => x.id === view)?.label}</p>}
      </div>
      <div hidden>
        <p className="group-label" id="variant-label">Proporção do conceito</p>
        <div className="chips" role="group" aria-labelledby="variant-label">
          {VARIANTS.map((v) => (
            <button key={v.id} type="button" className="chip" aria-pressed={variant === v.id} onClick={() => pickVariant(v.id)}>{v.id} · {v.label}</button>
          ))}
        </div>
        <p className="note" style={{ marginTop: 10 }} aria-live="polite">{vText} Variações geométricas de um mesmo conceito — não representam modelos certificados, capacidade ou alcance.</p>
      </div>
    </div>
  );
}
