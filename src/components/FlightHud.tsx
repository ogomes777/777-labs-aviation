'use client';
import { useEffect, useRef, useState } from 'react';
import { ui } from '@/experience/director';
import { flightInput as IN, flightTel as TEL, flightUi, resetFlightInput } from '@/experience/flight';
import { FlightAudio } from '@/experience/flightAudio';
import { nav } from './navigation';
import { track } from '@/lib/analytics';
import { FLEET } from '@/content/fleet';
import { useM } from '@/i18n';

type LenisCtl = { stop?: () => void; start?: () => void };

/**
 * Interface mínima do test drive. Teclado (WASD/setas, Shift/Ctrl potência, Espaço decola, L pousa, F voo livre,
 * C câmera, M som, Esc sai), arraste com a mãozinha = olhar 360°, manche virtual no toque.
 * No celular em pé, a cena gira sozinha para paisagem (sem travar orientação e sem botão).
 */
export default function FlightHud() {
  const flight = ui.useStore((s) => s.flight);
  if (!flight) return null;
  return <Hud id={flight} />;
}

function Hud({ id }: { id: NonNullable<ReturnType<typeof ui.get>['flight']> }) {
  const m = useM(), F = m.flight;
  const phase = flightUi.useStore((s) => s.phase);
  const view = flightUi.useStore((s) => s.view);
  const auto = flightUi.useStore((s) => s.auto);
  const sound = flightUi.useStore((s) => s.sound);
  const rotate = flightUi.useStore((s) => s.rotate);
  const crash = flightUi.useStore((s) => s.crash);
  const landing = flightUi.useStore((s) => s.landing);
  const seat = ui.useStore((s) => s.seat);
  const [toast, setToast] = useState(false);
  useEffect(() => { if (!landing) return; setToast(true); const t = window.setTimeout(() => setToast(false), 4200); return () => window.clearTimeout(t); }, [landing]);
  const spd = useRef<HTMLSpanElement>(null), alt = useRef<HTMLSpanElement>(null), hdg = useRef<HTMLSpanElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const audio = useRef<FlightAudio | null>(null);
  const item = FLEET.find((f) => f.id === id)!;

  // entrada/saída: trava o scroll, esconde a página, áudio, orientação
  useEffect(() => {
    resetFlightInput();
    flightUi.set({ phase: 'start', view: ui.get().seat !== null ? 'seat' : 'chase', auto: false, crash: null, landing: null });
    const d = document.documentElement;
    d.dataset.flight = 'true';
    const lenis = nav.lenis as unknown as LenisCtl | null;
    lenis?.stop?.();
    const prevOverflow = d.style.overflow; d.style.overflow = 'hidden';
    const a = new FlightAudio(); audio.current = a; a.start(item.id === 'matrix');
    if (!flightUi.get().sound) a.setMuted(true);
    const touch = matchMedia('(pointer: coarse)').matches;
    const orient = () => { const r = touch && innerHeight > innerWidth; flightUi.set({ rotate: r }); d.dataset.flightRotate = r ? 'true' : 'false'; };
    orient();
    addEventListener('resize', orient);
    let raf = 0;
    const loop = () => {
      const kt = TEL.speed * 1.94384, ft = TEL.alt * 3.28084;
      if (spd.current) spd.current.textContent = String(Math.round(kt));
      if (alt.current) alt.current.textContent = String(Math.round(ft / 10) * 10);
      if (hdg.current) hdg.current.textContent = String(Math.round(TEL.hdg) % 360).padStart(3, '0');
      a.update(TEL.spool, TEL.speed, flightUi.get().view !== 'chase');
      // inércia do olhar 360° depois de soltar
      if (!look.current && (Math.abs(IN.lookVx) > 0.01 || Math.abs(IN.lookVy) > 0.01)) { IN.lookYaw += IN.lookVx / 60; IN.lookPitch = Math.max(-0.45, Math.min(1.25, IN.lookPitch + IN.lookVy / 60)); IN.lookVx *= 0.93; IN.lookVy *= 0.93; IN.lookAt = performance.now(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); removeEventListener('resize', orient);
      a.dispose(); audio.current = null;
      delete d.dataset.flight; delete d.dataset.flightRotate;
      d.style.overflow = prevOverflow; lenis?.start?.();
      resetFlightInput();
    };
  }, [item.id]);
  useEffect(() => { audio.current?.setMuted(!sound); }, [sound]);

  const exit = () => { track('flight_exit', { aircraft: id }); ui.set({ flight: null }); };
  const cycleView = () => {
    const order = (ui.get().seat !== null ? ['chase', 'cockpit', 'seat'] : ['chase', 'cockpit']) as ('chase' | 'cockpit' | 'seat')[];
    const cur = flightUi.get().view; flightUi.set({ view: order[(order.indexOf(cur) + 1) % order.length] });
  };
  const hold = (dir: 1 | -1 | 0) => () => { IN.throttle = dir; };
  const brakeOn = () => { IN.brake = true; }, brakeOff = () => { IN.brake = false; };

  // teclado
  useEffect(() => {
    const held = new Set<string>();
    const apply = () => {
      const up = held.has('w') || held.has('arrowup'), dn = held.has('s') || held.has('arrowdown');
      const lf = held.has('a') || held.has('arrowleft'), rt = held.has('d') || held.has('arrowright');
      IN.pitch = (up ? 1 : 0) - (dn ? 1 : 0);
      IN.roll = (rt ? 1 : 0) - (lf ? 1 : 0);
      IN.throttle = (held.has('shift') || held.has('e') ? 1 : 0) - (held.has('control') || held.has('q') ? 1 : 0);
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'control', ' '].includes(k)) e.preventDefault();
      audio.current?.resume();
      if (k === 'escape') { exit(); return; }
      if (k === ' ') { if (flightUi.get().phase === 'air' || flightUi.get().phase === 'approach') { IN.brake = true; } else IN.takeoff = true; return; }
      if (k === 'l') { IN.land = true; return; }
      if (k === 'f') { flightUi.set({ auto: !flightUi.get().auto }); return; }
      if (k === 'c' || k === 'v') { cycleView(); return; }
      if (k === 'r' && flightUi.get().crash) { IN.restart = true; return; }
      if (k === 'm') { flightUi.set({ sound: !flightUi.get().sound }); return; }
      held.add(k); apply();
    };
    const up = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (k === ' ') IN.brake = false; held.delete(k); apply(); };
    const blur = () => { held.clear(); apply(); };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // converte deltas de tela para o quadro girado (paisagem forçada)
  const local = (dx: number, dy: number) => (flightUi.get().rotate ? [dy, -dx] : [dx, dy]);

  // olhar 360° (mãozinha)
  const look = useRef<{ x: number; y: number; id: number; t: number } | null>(null);
  const pinch = useRef(new Map<number, { x: number; y: number }>());
  const pinchD = useRef(0);
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => { IN.zoom = Math.max(0.5, Math.min(2.6, IN.zoom * (1 + e.deltaY * 0.0012))); IN.lookAt = performance.now(); };
  const onLookDown = (e: React.PointerEvent<HTMLDivElement>) => { if (e.button !== 0) return; pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pinch.current.size === 2) { const [a, b] = [...pinch.current.values()]; pinchD.current = Math.hypot(a.x - b.x, a.y - b.y); look.current = null; return; } look.current = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() }; IN.lookVx = 0; IN.lookVy = 0; e.currentTarget.setPointerCapture(e.pointerId); audio.current?.resume(); };
  const onLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pinch.current.has(e.pointerId)) pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current.size === 2) { const [a, b] = [...pinch.current.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinchD.current > 0) IN.zoom = Math.max(0.5, Math.min(2.6, IN.zoom * (pinchD.current / d))); pinchD.current = d; IN.lookAt = performance.now(); return; }
    const l = look.current; if (!l || l.id !== e.pointerId) return;
    const now = performance.now(), dtm = Math.max(1, now - l.t);
    const [dx, dy] = local(e.clientX - l.x, e.clientY - l.y); l.x = e.clientX; l.y = e.clientY; l.t = now;
    IN.lookYaw -= dx * 0.006; IN.lookPitch = Math.max(-0.45, Math.min(1.25, IN.lookPitch + dy * 0.004)); IN.lookAt = now;
    IN.lookVx = (-dx * 0.006) / dtm * 1000; IN.lookVy = (dy * 0.004) / dtm * 1000;
  };
  const onLookUp = (e?: React.PointerEvent<HTMLDivElement>) => { if (e) pinch.current.delete(e.pointerId); if (pinch.current.size < 2) pinchD.current = 0; look.current = null; };

  // manche virtual
  const stick = useRef<{ x: number; y: number; id: number } | null>(null);
  const onStickDown = (e: React.PointerEvent<HTMLDivElement>) => { e.stopPropagation(); stick.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); audio.current?.resume(); };
  const onStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stick.current; if (!s || s.id !== e.pointerId) return;
    const [dx, dy] = local(e.clientX - s.x, e.clientY - s.y);
    const R = 46, l = Math.min(R, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    const x = Math.cos(a) * l, y = Math.sin(a) * l;
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
    IN.roll = x / R; IN.pitch = -y / R; // puxar para baixo = cabrar, como manche
  };
  const onStickUp = () => { stick.current = null; IN.roll = 0; IN.pitch = 0; if (knob.current) knob.current.style.transform = ''; };

  const status = phase === 'start' ? F.starting : phase === 'approach' ? F.landing : phase === 'parked' ? F.landed : null;

  return (
    <div className="sf-flight" data-rotate={rotate} role="application" aria-label={F.region.replace('{name}', item.name)}>
      <div className="sf-flight__look" onWheel={onWheel} onPointerDown={onLookDown} onPointerMove={onLookMove} onPointerUp={onLookUp} onPointerCancel={onLookUp} onLostPointerCapture={onLookUp} />
      <div className="sf-flight__top">
        <button type="button" className="sf-flight__x" onClick={exit} aria-label={F.exit} title={F.exit}><i /><i /></button>
        <div className="sf-flight__name"><b>{item.name}</b><span>{F.title}</span></div>
        <div className="sf-flight__tools">
          {(phase === 'air' || phase === 'approach') && <button type="button" aria-pressed={auto} onClick={() => flightUi.set({ auto: !auto })}>{F.free}</button>}
          {phase === 'air' && <button type="button" onClick={() => { IN.land = true; }}>{F.land}</button>}
          <button type="button" aria-pressed={view !== 'chase'} onClick={cycleView} aria-label={F.view}>{view === 'chase' ? F.cockpit : view === 'cockpit' && seat !== null ? F.seatView : F.chase}</button>
          <button type="button" className="sf-flight__snd" aria-pressed={sound} onClick={() => flightUi.set({ sound: !sound })} aria-label={sound ? F.soundOff : F.soundOn}><span data-on={sound} /></button>
        </div>
      </div>
      {status && <p className="sf-flight__status" aria-live="polite">{status}</p>}
      {(phase === 'ready' || phase === 'parked') && (
        <button type="button" className="sf-flight__go" onClick={() => { IN.takeoff = true; audio.current?.resume(); }}>{phase === 'parked' ? F.again : F.takeoff}</button>
      )}
      <div className="sf-flight__inst" aria-hidden="true">
        <span><small>{F.spd}</small><b ref={spd}>0</b><i>kt</i></span>
        <span><small>{F.alt}</small><b ref={alt}>0</b><i>ft</i></span>
        <span><small>{F.hdg}</small><b ref={hdg}>270</b><i>°</i></span>
      </div>
      <p className="sf-flight__hint"><span className="sf-flight__hint-k">{F.hintKeys2}</span><span className="sf-flight__hint-t">{F.controlsTouch}</span></p>
      {(phase === 'air' || phase === 'approach') && (
        <div className="sf-flight__pad" aria-label={F.faster}>
          <button type="button" aria-label={F.faster} onPointerDown={hold(1)} onPointerUp={hold(0)} onPointerLeave={hold(0)} onPointerCancel={hold(0)}>+</button>
          <button type="button" aria-label={F.slower} onPointerDown={hold(-1)} onPointerUp={hold(0)} onPointerLeave={hold(0)} onPointerCancel={hold(0)}>−</button>
          <button type="button" className="sf-flight__brake" aria-label={F.brake} onPointerDown={brakeOn} onPointerUp={brakeOff} onPointerLeave={brakeOff} onPointerCancel={brakeOff}>{F.brake}</button>
        </div>
      )}
      {toast && landing && (
        <div className="sf-flight__toast" role="status"><b>{F[landing.grade]}</b><span>{F.fpm.replace('{n}', String(landing.fpm))}</span></div>
      )}
      {crash && (
        <div className="sf-flight__crash" role="alertdialog" aria-label={crash === 'water' ? F.crashWater : F.crashGround}>
          <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6c-12.7 0-22 8.9-22 21.2 0 7.4 3.5 12.5 8.2 15.4V50c0 2.2 1.8 4 4 4h3.2v-5h3.6v5h6v-5h3.6v5H42c2.2 0 4-1.8 4-4v-7.4c4.7-2.9 8-8 8-15.4C54 14.9 44.7 6 32 6Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="23.5" cy="28" r="5.2" fill="currentColor"/><circle cx="40.5" cy="28" r="5.2" fill="currentColor"/><path d="M32 35.5l-3.2 5.4h6.4z" fill="currentColor"/></svg>
          <strong>{crash === 'water' ? F.crashWater : F.crashGround}</strong>
          <div><button type="button" onClick={() => { IN.restart = true; }}>{F.retry}</button><button type="button" onClick={exit}>{F.exit}</button></div>
        </div>
      )}
      <div className="sf-flight__stick" onPointerDown={onStickDown} onPointerMove={onStickMove} onPointerUp={onStickUp} onPointerCancel={onStickUp} aria-label={F.stick} role="slider" aria-valuenow={0}>
        <span ref={knob} />
      </div>
      <p className="sf-flight__note">{F.note}</p>
    </div>
  );
}
