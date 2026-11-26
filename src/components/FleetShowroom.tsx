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

const SYSTEM_ORDER: SystemId[] = ['fuselagem', 'asas', 'propulsao', 'empenagem', 'trem', 'cabine', 'portas'];
const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Frota SimFly: galeria horizontal ligada ao scroll (desktop) ou swipe nativo (mobile), com as cinco
 * aeronaves anunciadas. Hotspots do exemplar ativo abrem PREVIEW antes da seleção; a seleção abre o atlas
 * (sistema isolado, raio-X, desmontagem, órbita 360° e planta ilustrativa).
 */
export default function FleetShowroom() {
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
    window.scrollTo({ top: top + range * (0.1 + (t / (FLEET.length - 1)) * 0.76), behavior: 'smooth' });
  };

  const active = FLEET[index] ?? FLEET[0];
  const hotAircraft: FleetId = inspect ?? active.id;
  const item = FLEET.find((f) => f.id === inspect);
  const systems = inspect ? systemsFor(inspect) : [];
  const selSys = systems.find((s) => s.id === system) ?? null;
  const selPart = selSys?.parts.find((p) => p.id === part) ?? null;
  const spec = inspect ? FLEET_SPECS[inspect] : null;
  const selectSystem = (sid: SystemId | null) => { preview.close(); frame.orbitYaw = 0; frame.orbitPitch = 0; ui.set({ inspectSystem: sid, inspectPart: null, fleetPreview: null }); if (sid) track('fleet_system', { inspect: inspect ?? undefined, system: sid }); };
  const seatCount = item ? FLEET_SPECS[item.id].cabin.seats.length : 0;

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
      <div className="fleet__viewport" ref={vp} data-inspecting={inspect ? 'true' : 'false'} data-fleet-viewport role="region" aria-roledescription="carrossel" aria-label="Frota SimFly — aeronaves anunciadas" tabIndex={0}
        onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1); } }}>
        <div className="fleet__track" data-fleet-track>
          {FLEET.map((f, i) => (
            <article key={f.id} className="fcard" data-active={i === index ? 'true' : 'false'} data-exclusive={f.exclusive ? 'true' : 'false'} data-expanded={expanded === f.id ? 'true' : 'false'} aria-label={`${f.make} ${f.name} ${f.year}, ${f.category}`}>
              <div className="fcard__top"><span className="fcard__kind">{f.make} · {f.type}</span><span className="fcard__year">{f.year}</span></div>
              <h3 className="fcard__name">{f.name}</h3>
              <p className="fcard__cat">{f.category} · {f.condition}</p>
              <ul className="fcard__facts">{(expanded === f.id ? [...f.facts, ...f.more] : f.facts).map((x) => <li key={x}>{x}</li>)}</ul>
              <p className="fcard__status"><i aria-hidden="true" />{f.status} · disponibilidade sob confirmação</p>
              <div className="fcard__actions">
                <button type="button" className="fcard__cta" data-cursor="Abrir" onClick={(e) => open(f.id, e.currentTarget)} aria-haspopup="dialog">Ver por dentro</button>
                <a className="fcard__quote" href={quoteUrl(f)} target="_blank" rel="noopener noreferrer" onClick={() => track('fleet_quote', { aircraft: f.id })}>Consultar <span aria-hidden="true">↗</span></a>
                <button type="button" className="fcard__more" aria-expanded={expanded === f.id} onClick={() => setExpanded((x) => (x === f.id ? null : f.id))}>{expanded === f.id ? 'Menos' : 'Detalhes'}</button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="fleet__nav" data-inspecting={inspect ? 'true' : 'false'}>
        <button type="button" className="textbtn" onClick={() => goTo(index - 1)} disabled={index === 0}>Anterior</button>
        <span aria-live="polite">{String(index + 1).padStart(2, '0')} / {String(FLEET.length).padStart(2, '0')}</span>
        <button type="button" className="textbtn" onClick={() => goTo(index + 1)} disabled={index === FLEET.length - 1}>Próxima</button>
      </div>

      {/* hotspots do exemplar ativo (projetados pelo canvas); preview antes da seleção */}
      {live && <div ref={hotLayer} className="fhots" data-visible="false" aria-label={`Sistemas do ${FLEET.find((f) => f.id === hotAircraft)?.name}`} role="group">
        {SYSTEM_ORDER.map((sid) => {
          const pv = fleetSystemPreview(hotAircraft, sid);
          return (
            <button key={sid} type="button" className="fhot" data-cursor="Ver" aria-label={`${pv.title} — prévia`} aria-describedby={preview.state.item?.key === pv.key ? 'fleet-preview' : undefined}
              ref={(el) => { if (el) domRefs.fleetHotspots.set(sid, el); else domRefs.fleetHotspots.delete(sid); }}
              data-open={preview.state.item?.key === pv.key}
              {...preview.bind(pv, () => (inspect ? selectSystem(sid) : open(hotAircraft, null, sid)))}>
              <i /><span>{pv.title}</span>
            </button>
          );
        })}
      </div>}
      <HotspotPreview id="fleet-preview" state={preview.state} cardRef={preview.cardRef} onConfirm={preview.confirm} onEnter={preview.cancelClose} onLeave={preview.scheduleClose} />

      {live && inspect && mode === 'parts' && <div className="fleet-orbit" role="application" aria-label="Arraste para girar a aeronave em 360°; teclado: setas" tabIndex={0} {...orbitHandlers}><span aria-hidden="true">Arraste · 360°</span></div>}

      {item && mode === 'plan' && <div className="fplan-wrap"><FloorPlan id={item.id} seat={seat} onSeat={(i) => ui.set({ inspectMode: 'seat', seat: i })} /></div>}
      <div ref={seatLayer} className="seats" data-visible="false" aria-hidden="true" hidden />

      <div ref={panel} className="inspect" role="dialog" aria-modal="false" aria-label={item ? `Atlas do ${item.make} ${item.name}` : 'Atlas'} data-open={inspect ? 'true' : 'false'} tabIndex={-1} hidden={!inspect}>
        {item && spec && (
          <>
            <nav className="inspect__crumbs" aria-label="Navegação do atlas">
              <button type="button" onClick={close}>Frota</button><span aria-hidden="true">›</span>
              <button type="button" onClick={() => selectSystem(null)} aria-current={!selSys ? 'page' : undefined}>{item.name}</button>
              {selSys && <><span aria-hidden="true">›</span><button type="button" onClick={() => ui.set({ inspectPart: null })} aria-current={!selPart ? 'page' : undefined}>{selSys.label}</button></>}
              {selPart && <><span aria-hidden="true">›</span><span aria-current="page">{selPart.label}</span></>}
            </nav>
            <span className="fcard__kind">{item.make} · {item.type} · {item.year}</span>
            <h3 className="inspect__name">{item.name}</h3>
            <div className="inspect__tabs" role="tablist" aria-label="Modo do atlas">
              <button type="button" role="tab" aria-selected={mode === 'parts'} className="textbtn" onClick={() => ui.set({ inspectMode: 'parts', seat: null })}>Atlas 3D</button>
              <button type="button" role="tab" aria-selected={mode !== 'parts'} className="textbtn" onClick={() => { preview.close(); ui.set({ inspectMode: 'plan', assembled: true, seat: null, fleetXray: false, inspectSystem: null, inspectPart: null }); }}>Planta</button>
              <button type="button" className="textbtn inspect__close" onClick={close}>Fechar</button>
            </div>
            {mode === 'parts' ? (<>
              <div className="inspect__systems" role="group" aria-label="Sistemas">
                {systems.map((s) => <button key={s.id} type="button" className="pill" aria-pressed={system === s.id} onClick={() => selectSystem(system === s.id ? null : s.id)}>{s.label}</button>)}
              </div>
              {live && <div className="inspect__actions" role="group" aria-label="Visualização">
                <button type="button" className="pill pill--tool" aria-pressed={xray} onClick={() => ui.set({ fleetXray: !xray })}>Raio-X</button>
                <button type="button" className="pill pill--tool" aria-pressed={!assembled} onClick={() => ui.set({ assembled: !assembled })}>{assembled ? 'Abrir em camadas' : 'Montar aeronave'}</button>
                <button type="button" className="pill pill--tool" onClick={() => { frame.orbitYaw = 0; frame.orbitPitch = 0; preview.close(); ui.set({ inspectSystem: null, inspectPart: null, assembled: true, fleetXray: false }); }}>Redefinir vista</button>
              </div>}
              {selSys && <ul className="inspect__parts">
                {selSys.parts.map((p) => (
                  <li key={p.id}><button type="button" aria-pressed={part === p.id} onClick={() => { frame.orbitYaw = 0; frame.orbitPitch = 0; ui.set({ inspectPart: part === p.id ? null : p.id }); }}>{p.label}</button></li>
                ))}
              </ul>}
              <p className="inspect__text" aria-live="polite">{selPart ? selPart.text : selSys ? selSys.text : `${item.category}. ${item.engine}. Passe pelos pontos da aeronave para pré-visualizar cada sistema; clique para isolar.`}</p>
            </>) : mode === 'plan' ? (
              <p className="inspect__text" aria-live="polite">Configuração ilustrativa com {seatCount} lugares anunciados{item.id === 'matrix' ? ' (inclui piloto e copiloto)' : ''}. Não é a planta do exemplar. Escolha uma poltrona para ver a vista sentado.</p>
            ) : (
              <>
                <p className="inspect__text" aria-live="polite">Poltrona {String((seat ?? 0) + 1).padStart(2, '0')}. Vista ilustrativa a partir deste lugar.</p>
                <button type="button" className="textbtn" onClick={() => ui.set({ inspectMode: 'plan', seat: null })}>Voltar à planta</button>
              </>
            )}
            <div className="inspect__cta">
              <a className="btn btn--solid btn--small" href={quoteUrl(item)} target="_blank" rel="noopener noreferrer" onClick={() => track('fleet_quote', { aircraft: item.id, from: 'atlas' })}>Consultar aeronave</a>
              <a className="textbtn" href={mailUrl(item)}>Por e-mail</a>
            </div>
            <p className="micro inspect__micro">
              Ilustração 3D paramétrica calibrada pelo envelope do tipo ({fmt(spec.envelope.length)} m × {fmt(spec.envelope.span)} m × {fmt(spec.envelope.height)} m; {spec.sources[0]}). Pintura, janelas, interior e estrutura interna são aproximados — não é o exemplar anunciado.{spec.envelopeNote ? ` ${spec.envelopeNote}` : ''}
            </p>
          </>
        )}
      </div>
    </>
  );
}
