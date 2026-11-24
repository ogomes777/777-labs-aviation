'use client';
import { useCallback, useEffect, useRef } from 'react';
import { FLEET, partsFor } from '@/content/fleet';
import { frame, ui } from '@/experience/director';
import { domRefs } from '@/experience/domRefs';
import { navigate } from './navigation';
import { track } from '@/lib/analytics';

/**
 * Frota em galeria horizontal ligada ao scroll (desktop) ou swipe nativo (mobile).
 * "Ver por dentro" abre a inspeção: a aeronave 3D se desmonta peça por peça e volta a montar.
 */
export default function FleetShowroom() {
  const index = ui.useStore((s) => s.fleetIndex);
  const inspect = ui.useStore((s) => s.inspect);
  const assembled = ui.useStore((s) => s.assembled);
  const part = ui.useStore((s) => s.inspectPart);
  const mode = ui.useStore((s) => s.inspectMode);
  const seat = ui.useStore((s) => s.seat);
  const seatLayer = useRef<HTMLDivElement>(null);
  useEffect(() => { domRefs.seatLayer = seatLayer.current; return () => { domRefs.seatLayer = null; }; }, []);
  const motion = ui.useStore((s) => s.motion);
  const vp = useRef<HTMLDivElement>(null);
  const swipe = useRef(false);
  const programmatic = useRef(0);
  const timer = useRef<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const decide = () => { swipe.current = motion !== 'cinematic' || matchMedia('(max-width: 760px)').matches; frame.fleetSwipe = motion === 'cinematic' && swipe.current; };
    decide(); window.addEventListener('resize', decide);
    return () => window.removeEventListener('resize', decide);
  }, [motion]);

  useEffect(() => {
    const el = vp.current; if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (!swipe.current || performance.now() < programmatic.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const n = el.querySelectorAll('.fcard').length;
        const max = el.scrollWidth - el.clientWidth;
        const cont = max > 0 ? Math.max(0, Math.min(1, el.scrollLeft / max)) * (n - 1) : 0;
        frame.fleet = cont;
        (window as unknown as { __777recompute?: () => void }).__777recompute?.();
        const r = Math.round(cont);
        if (r !== ui.get().fleetIndex) ui.set({ fleetIndex: r });
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  const open = (id: (typeof FLEET)[number]['id'], btn: HTMLButtonElement) => {
    opener.current = btn;
    ui.set({ inspect: id, assembled: true, inspectPart: null, inspectMode: 'parts', seat: null });
    track('aircraft_explore_start', { inspect: id });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => ui.set({ assembled: false }), motion === 'reduced' ? 0 : 1100);
    requestAnimationFrame(() => panel.current?.focus());
  };
  const close = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    ui.set({ assembled: true, inspectPart: null, inspectMode: 'parts', seat: null });
    timer.current = window.setTimeout(() => ui.set({ inspect: null }), motion === 'reduced' ? 0 : 1300);
    opener.current?.focus();
  }, [motion]);
  useEffect(() => {
    if (!inspect) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspect, close]);

  const goTo = (i: number) => {
    const t = Math.max(0, Math.min(FLEET.length - 1, i));
    if (swipe.current) {
      const el = vp.current;
      programmatic.current = performance.now() + 900;
      if (el) el.scrollTo({ left: ((el.scrollWidth - el.clientWidth) * t) / (FLEET.length - 1), behavior: motion === 'reduced' ? 'auto' : 'smooth' });
      frame.fleet = t;
      ui.set({ fleetIndex: t });
      return;
    }
    const ch = document.querySelector<HTMLElement>('[data-chapter="3"]'); if (!ch) return;
    const top = ch.getBoundingClientRect().top + scrollY, range = ch.offsetHeight - innerHeight;
    window.scrollTo({ top: top + range * (0.1 + (t / (FLEET.length - 1)) * 0.76), behavior: 'smooth' });
  };

  const item = FLEET.find((f) => f.id === inspect);
  const parts = inspect ? partsFor(inspect) : [];
  const sel = parts.find((p) => p.id === part);

  return (
    <>
      <div className="fleet__viewport" ref={vp} data-inspecting={inspect ? 'true' : 'false'} data-fleet-viewport role="region" aria-roledescription="carrossel" aria-label="Frota conceitual" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1); } }}>
        <div className="fleet__track" data-fleet-track>
          {FLEET.map((f, i) => (
            <article key={f.id} className="fcard" data-active={i === index ? 'true' : 'false'} aria-label={`${f.name}, ${f.kind}`}>
              <span className="fcard__kind">{f.kind}</span>
              <h3 className="fcard__name">{f.name}</h3>
              <p className="fcard__line">{f.line}</p>
              <button type="button" className="btn btn--ghost btn--small fcard__cta" data-cursor="Abrir" onClick={(e) => open(f.id, e.currentTarget)} aria-haspopup="dialog">Ver por dentro</button>
            </article>
          ))}
        </div>
      </div>
      <div className="fleet__nav" data-inspecting={inspect ? 'true' : 'false'}>
        <button type="button" className="textbtn" onClick={() => goTo(index - 1)} disabled={index === 0}>Anterior</button>
        <span aria-live="polite">{String(index + 1).padStart(2, '0')} / {String(FLEET.length).padStart(2, '0')}</span>
        <button type="button" className="textbtn" onClick={() => goTo(index + 1)} disabled={index === FLEET.length - 1}>Próxima</button>
      </div>
      <div ref={seatLayer} className="seats" data-visible="false" aria-hidden={mode !== 'plan'}>
        {Array.from({ length: 10 }, (_, i) => (
          <button key={i} type="button" className="seat-pin" data-cursor="Sentar" aria-label={`Sentar na poltrona ${i + 1}`} aria-pressed={seat === i} tabIndex={mode === 'plan' ? 0 : -1}
            onClick={() => ui.set({ inspectMode: 'seat', seat: i })}><span>{String(i + 1).padStart(2, '0')}</span></button>
        ))}
      </div>
      <div ref={panel} className="inspect" role="dialog" aria-modal="false" aria-label={item ? `Componentes de ${item.name}` : 'Inspeção'} data-open={inspect ? 'true' : 'false'} tabIndex={-1} hidden={!inspect}>
        {item && (
          <>
            <span className="fcard__kind">{item.kind}</span>
            <h3 className="inspect__name">{item.name}</h3>
            <div className="inspect__tabs" role="tablist" aria-label="Modo de inspeção">
              <button type="button" role="tab" aria-selected={mode === 'parts'} className="textbtn" onClick={() => ui.set({ inspectMode: 'parts', seat: null })}>Peças</button>
              {inspect !== 'H' && <button type="button" role="tab" aria-selected={mode !== 'parts'} className="textbtn" onClick={() => { if (timer.current) window.clearTimeout(timer.current); ui.set({ inspectMode: 'plan', assembled: true, seat: null }); }}>Planta</button>}
              <button type="button" className="textbtn inspect__close" onClick={close}>Fechar</button>
            </div>
            {mode === 'parts' ? (<>
            <button type="button" className="btn btn--solid btn--small" aria-pressed={!assembled} onClick={() => ui.set({ assembled: !assembled })}>{assembled ? 'Desmontar' : 'Montar'}</button>
            <ul className="inspect__parts">
              {parts.map((p) => (
                <li key={p.id}>
                  <button type="button" aria-pressed={part === p.id} onMouseEnter={() => ui.set({ inspectPart: p.id })} onFocus={() => ui.set({ inspectPart: p.id })} onClick={() => ui.set({ inspectPart: p.id })}>{p.label}</button>
                </li>
              ))}
            </ul>
            <p className="inspect__text" aria-live="polite">{sel ? sel.text : 'Passe o cursor por um componente.'}</p>
            </>) : mode === 'plan' ? (
              <p className="inspect__text" aria-live="polite">Escolha uma poltrona na planta para sentar.</p>
            ) : (
              <>
                <p className="inspect__text" aria-live="polite">Poltrona {String((seat ?? 0) + 1).padStart(2, '0')}. Esta é a sua vista.</p>
                <button type="button" className="textbtn" onClick={() => ui.set({ inspectMode: 'plan', seat: null })}>Voltar à planta</button>
              </>
            )}
            <button type="button" className="textbtn" onClick={() => { close(); navigate('#planejar'); }}>Solicitar apresentação</button>
            <p className="micro">Conceito original. Componentes genéricos, sem especificações de modelo.</p>
          </>
        )}
      </div>
    </>
  );
}
