'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FLEET, quoteUrl, mailUrl, systemsFor, type FleetId, type SystemId } from '@/content/fleet';
import { fleetSystemPreview } from '@/content/previews';
import { FLEET_SPECS } from '@/three/fleet/specs';
import { frame, ui } from '@/experience/director';
import { domRefs } from '@/experience/domRefs';
import { track } from '@/lib/analytics';
import { usePreview } from './preview/usePreview';
import HotspotPreview from './preview/HotspotPreview';
import FloorPlan from './FloorPlan';
import { nav } from './navigation';
import { fmt as tf, useM } from '@/i18n';

const SYSTEM_ORDER: SystemId[] = ['fuselagem', 'asas', 'propulsao', 'empenagem', 'trem', 'cabine', 'portas'];

/**
 * Frota SimFly: galeria horizontal ligada ao scroll (desktop) ou swipe nativo (mobile), com as cinco
 * aeronaves anunciadas. Hotspots do exemplar ativo abrem PREVIEW antes da seleção; a seleção abre o atlas
 * (sistema isolado, raio-X, desmontagem, órbita 360° e planta ilustrativa).
 */
function startFlight(id: FleetId) { ui.set({ flight: id }); track('flight_start', { aircraft: id }); }

export default function FleetShowroom() {
  const m = useM(), F = m.fleet;
  const index = ui.useStore((s) => s.fleetIndex);
  const inspect = ui.useStore((s) => s.inspect);
  const assembled = ui.useStore((s) => s.assembled);
  const part = ui.useStore((s) => s.inspectPart);
  const mode = ui.useStore((s) => s.inspectMode);
  const seat = ui.useStore((s) => s.seat);
  const system = ui.useStore((s) => s.inspectSystem);
  const xray = ui.useStore((s) => s.fleetXray);
  const motion = ui.useStore((s) => s.motion);
  const webgl = ui.useStore((s) => s.webgl);
  const quality = ui.useStore((s) => s.quality);
  const live = motion === 'cinematic' && webgl && quality !== 'lite';
  const seatLayer = useRef<HTMLDivElement>(null);
  const hotLayer = useRef<HTMLDivElement>(null);
  const vp = useRef<HTMLDivElement>(null);
  const swipe = useRef(false);
  const programmatic = useRef(0);
  const timer = useRef<number | null>(null);
  const xrayTimer = useRef<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const [expanded, setExpanded] = useState<FleetId | null>(null);
  const preview = usePreview();

  useEffect(() => {
    domRefs.seatLayer = seatLayer.current;
    domRefs.seats = Array.from(seatLayer.current?.querySelectorAll<HTMLElement>('.seat-pin') ?? []);
    return () => { domRefs.seatLayer = null; domRefs.seats = []; };
  }, []);
  useEffect(() => { domRefs.fleetHotLayer = live ? hotLayer.current : null; return () => { domRefs.fleetHotLayer = null; }; }, [live]);

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

  const open = useCallback((id: FleetId, from: HTMLElement | null, sys: SystemId | null = null) => {
    opener.current = from;
    preview.close();
    frame.orbitYaw = 0; frame.orbitPitch = 0;
    // o avião aberto passa a ser o destacado (senão a regra 'trocar de avião pelo scroll fecha o atlas' fecharia na hora)
    const k = FLEET.findIndex((f) => f.id === id); if (k >= 0 && k !== ui.get().fleetIndex) ui.set({ fleetIndex: k });
    // raio-X automático de apresentação ao entrar; depois volta ao normal e a pessoa escolhe sistema/peça
    ui.set({ inspect: id, assembled: true, inspectPart: null, inspectMode: 'parts', seat: null, inspectSystem: sys, fleetXray: !sys && motion !== 'reduced', fleetPreview: null });
    if (xrayTimer.current) window.clearTimeout(xrayTimer.current);
    if (!sys && motion !== 'reduced') xrayTimer.current = window.setTimeout(() => { if (ui.get().inspect === id) ui.set({ fleetXray: false }); }, 2200);
    track('aircraft_explore_start', { inspect: id, system: sys ?? 'all' });
    if (timer.current) window.clearTimeout(timer.current);
    requestAnimationFrame(() => panel.current?.focus());
  }, [preview]);
  const close = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    preview.close();
    ui.set({ assembled: true, inspectPart: null, inspectMode: 'parts', seat: null, inspectSystem: null, fleetXray: false, fleetPreview: null });
    if (xrayTimer.current) window.clearTimeout(xrayTimer.current);
    timer.current = window.setTimeout(() => { frame.orbitYaw = 0; frame.orbitPitch = 0; ui.set({ inspect: null }); }, motion === 'reduced' ? 0 : 900);
    opener.current?.focus();
  }, [motion, preview]);
  // rolar/arrastar até outra aeronave fecha o atlas na hora e segue a experiência (o scroll é o motor)
  useEffect(() => {
    if (!inspect || FLEET[index]?.id === inspect) return;
    if (timer.current) window.clearTimeout(timer.current);
    if (xrayTimer.current) window.clearTimeout(xrayTimer.current);
    preview.close(); frame.orbitYaw = 0; frame.orbitPitch = 0;
    ui.set({ inspect: null, assembled: true, inspectPart: null, inspectMode: 'parts', seat: null, inspectSystem: null, fleetXray: false, fleetPreview: null });
  }, [index, inspect, preview]);
  useEffect(() => {
    if (!inspect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || preview.state.item) return;
      const s = ui.get();
      if (s.inspectPart) ui.set({ inspectPart: null });
      else if (s.inspectSystem) ui.set({ inspectSystem: null });
      else close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspect, close, preview.state.item]);

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
    const y = top + range * (0.1 + (t / (FLEET.length - 1)) * 0.76);
    ui.set({ fleetIndex: t }); // card e hotspots atualizam na hora; a câmera chega em seguida
    const lenis = nav.lenis;
    if (lenis) lenis.scrollTo(y, { duration: 0.75 }); else window.scrollTo({ top: y, behavior: motion === 'reduced' ? 'auto' : 'smooth' });
  };

  const active = FLEET[index] ?? FLEET[0];
  const hotAircraft: FleetId = inspect ?? active.id;
  const item = FLEET.find((f) => f.id === inspect);
  const systems = inspect ? systemsFor(inspect, m) : [];
  const selSys = systems.find((s) => s.id === system) ?? null;
  const selPart = selSys?.parts.find((p) => p.id === part) ?? null;
  const spec = inspect ? FLEET_SPECS[inspect] : null;
  const selectSystem = (sid: SystemId | null) => { preview.close(); frame.orbitYaw = 0; frame.orbitPitch = 0; ui.set({ inspectSystem: sid, inspectPart: null, fleetPreview: null }); if (sid) track('fleet_system', { inspect: inspect ?? undefined, system: sid }); };
  const seatCount = item ? FLEET_SPECS[item.id].cabin.seats.length + (FLEET_SPECS[item.id].cabin.zones.some((z) => z.toilet) ? 1 : 0) + (FLEET_SPECS[item.id].nose === 'prop' ? 2 : 0) : 0;

  // órbita 360°: arrastar (mouse/dedo) ou setas do teclado
  const orbitHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => { if (e.button !== 0) return; drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current; if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY;
      frame.orbitYaw += dx * 0.0085; frame.orbitPitch = Math.max(-0.18, Math.min(1.15, frame.orbitPitch - dy * 0.006));
    },
    onPointerUp: () => { drag.current = null; }, onPointerCancel: () => { drag.current = null; }, onLostPointerCapture: () => { drag.current = null; },
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      frame.orbitYaw += e.key === 'ArrowLeft' ? 0.18 : e.key === 'ArrowRight' ? -0.18 : 0; frame.orbitPitch = Math.max(-0.18, Math.min(1.15, frame.orbitPitch + (e.key === 'ArrowUp' ? 0.12 : e.key === 'ArrowDown' ? -0.12 : 0)));
    },
  };

  return (
    <>
      <div className="fleet__viewport" ref={vp} data-inspecting={inspect ? 'true' : 'false'} data-fleet-viewport role="region" aria-roledescription="carrossel" aria-label={F.region} tabIndex={0}
        onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1); } }}>
        <div className="fleet__track" data-fleet-track>
          {FLEET.map((f, i) => (
            <article key={f.id} className="fcard" data-active={i === index ? 'true' : 'false'} data-exclusive={f.exclusive ? 'true' : 'false'} data-expanded={expanded === f.id ? 'true' : 'false'} aria-label={`${f.make} ${f.name} ${f.year}, ${F.items[f.id].category}`}>
              <div className="fcard__top"><span className="fcard__kind">{f.make} · {f.type}</span><span className="fcard__year">{f.year}</span></div>
              <h3 className="fcard__name">{f.name}</h3>
              <p className="fcard__cat">{F.items[f.id].category} · {F.items[f.id].condition}</p>
              <ul className="fcard__facts">{(expanded === f.id ? [...F.items[f.id].facts, ...F.items[f.id].more] : F.items[f.id].facts).map((x) => <li key={x}>{x}</li>)}</ul>
              <p className="fcard__status"><i aria-hidden="true" />{F.items[f.id].status} · {F.availability}</p>
              <div className="fcard__actions">
                <button type="button" className="fcard__cta" data-cursor={F.open} onClick={(e) => open(f.id, e.currentTarget)} aria-haspopup="dialog">{F.inside}</button>
                <a className="fcard__quote" href={quoteUrl(f, undefined, m)} target="_blank" rel="noopener noreferrer" onClick={() => track('fleet_quote', { aircraft: f.id })}>{F.consult}</a>
                <button type="button" className="fcard__more" aria-expanded={expanded === f.id} onClick={() => setExpanded((x) => (x === f.id ? null : f.id))}>{expanded === f.id ? F.less : F.details}</button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="fleet__nav" data-inspecting={inspect ? 'true' : 'false'}>
        <button type="button" className="textbtn" onClick={() => goTo(index - 1)} disabled={index === 0}>{F.prev}</button>
        <span aria-live="polite">{String(index + 1).padStart(2, '0')} / {String(FLEET.length).padStart(2, '0')}</span>
        <button type="button" className="textbtn" onClick={() => goTo(index + 1)} disabled={index === FLEET.length - 1}>{F.next}</button>
      </div>

      {/* hotspots do exemplar ativo (projetados pelo canvas); preview antes da seleção */}
      {live && <div ref={hotLayer} className="fhots" data-visible="false" aria-label={tf(F.systemsOf, { name: FLEET.find((f) => f.id === hotAircraft)?.name ?? '' })} role="group">
        {SYSTEM_ORDER.map((sid) => {
          const pv = fleetSystemPreview(hotAircraft, sid, m);
          return (
            <button key={sid} type="button" className="fhot" data-cursor={F.open} aria-label={tf(F.previewOf, { name: pv.title })} aria-describedby={preview.state.item?.key === pv.key ? 'fleet-preview' : undefined}
              ref={(el) => { if (el) domRefs.fleetHotspots.set(sid, el); else domRefs.fleetHotspots.delete(sid); }}
              data-open={preview.state.item?.key === pv.key}
              {...preview.bind(pv, () => (inspect ? selectSystem(sid) : open(hotAircraft, null, sid)))}>
              <i /><span>{pv.title}</span>
            </button>
          );
        })}
      </div>}
      <HotspotPreview id="fleet-preview" state={preview.state} cardRef={preview.cardRef} onConfirm={preview.confirm} onEnter={preview.cancelClose} onLeave={preview.scheduleClose} />

      {live && inspect && mode === 'parts' && <div className="fleet-orbit" role="application" aria-label={F.orbitAria} tabIndex={0} {...orbitHandlers}><span aria-hidden="true">{F.orbit}</span></div>}

      {item && mode === 'plan' && <div className="fplan-wrap"><FloorPlan id={item.id} /></div>}
      <div ref={seatLayer} className="seats" data-visible="false" aria-hidden="true" hidden />

      <div ref={panel} className="inspect" role="dialog" aria-modal="false" aria-label={item ? tf(F.atlasOf, { name: `${item.make} ${item.name}` }) : F.atlas} data-open={inspect ? 'true' : 'false'} tabIndex={-1} hidden={!inspect}>
        {item && spec && (
          <>
            <nav className="inspect__crumbs" aria-label={F.crumbs}>
              <button type="button" onClick={close}>{F.fleet}</button><span aria-hidden="true">›</span>
              <button type="button" onClick={() => selectSystem(null)} aria-current={!selSys ? 'page' : undefined}>{item.name}</button>
              {selSys && <><span aria-hidden="true">›</span><button type="button" onClick={() => ui.set({ inspectPart: null })} aria-current={!selPart ? 'page' : undefined}>{selSys.label}</button></>}
              {selPart && <><span aria-hidden="true">›</span><span aria-current="page">{selPart.label}</span></>}
            </nav>
            <span className="fcard__kind">{item.make} · {item.type} · {item.year}</span>
            <h3 className="inspect__name">{item.name}</h3>
            <div className="inspect__tabs" role="tablist" aria-label={F.atlas}>
              <button type="button" role="tab" aria-selected={mode === 'parts'} className="textbtn" onClick={() => ui.set({ inspectMode: 'parts', seat: null })}>{F.atlas}</button>
              <button type="button" role="tab" aria-selected={mode !== 'parts'} className="textbtn" onClick={() => { preview.close(); ui.set({ inspectMode: 'plan', assembled: true, seat: null, fleetXray: false, inspectSystem: null, inspectPart: null }); }}>{F.plan}</button>
              <button type="button" className="textbtn inspect__close" onClick={close} aria-label={F.close}><span aria-hidden="true" className="inspect__x" /></button>
            </div>
            {mode === 'parts' ? (<>
              <div className="inspect__systems" role="group" aria-label={F.systems}>
                {systems.map((s) => <button key={s.id} type="button" className="pill" aria-pressed={system === s.id} onClick={() => selectSystem(system === s.id ? null : s.id)}>{s.label}</button>)}
              </div>
              {live && <div className="inspect__actions" role="group" aria-label={F.tools}>
                <button type="button" className="pill pill--tool" aria-pressed={xray} onClick={() => ui.set({ fleetXray: !xray })}>{F.xray}</button>
                <button type="button" className="pill pill--tool" aria-pressed={!assembled} onClick={() => ui.set({ assembled: !assembled })}>{assembled ? F.explode : F.assemble}</button>
                <button type="button" className="pill pill--tool" onClick={() => { frame.orbitYaw = 0; frame.orbitPitch = 0; preview.close(); ui.set({ inspectSystem: null, inspectPart: null, assembled: true, fleetXray: false }); }}>{F.reset}</button>
              </div>}
              {selSys && <ul className="inspect__parts">
                {selSys.parts.map((p) => (
                  <li key={p.id}><button type="button" aria-pressed={part === p.id} onClick={() => { frame.orbitYaw = 0; frame.orbitPitch = 0; ui.set({ inspectPart: part === p.id ? null : p.id }); }}>{p.label}</button></li>
                ))}
              </ul>}
              <p className="inspect__text" aria-live="polite">{selPart ? selPart.text : selSys ? selSys.text : `${F.items[item.id].category}. ${item.engine}. ${F.hint}`}</p>
            </>) : mode === 'plan' ? (
              <>
                <p className="inspect__text" aria-live="polite">{tf(F.planText, { n: seatCount })}</p>
                {live && <button type="button" className="sf-fly" onClick={() => startFlight(item.id)}><span className="sf-fly__glow" aria-hidden="true" />{F.fly}</button>}
              </>
            ) : null}
            <div className="inspect__cta">
              <a className="btn btn--solid btn--small" href={quoteUrl(item, undefined, m)} target="_blank" rel="noopener noreferrer" onClick={() => track('fleet_quote', { aircraft: item.id, from: 'atlas' })}>{F.quote}</a>
              <a className="textbtn" href={mailUrl(item, m)}>{F.email}</a>
            </div>
            <p className="micro inspect__micro">{F.micro}</p>
          </>
        )}
      </div>
    </>
  );
}
