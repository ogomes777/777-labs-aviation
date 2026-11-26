'use client';
import { useEffect, useRef } from 'react';
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
  const spd = useRef<HTMLSpanElement>(null), alt = useRef<HTMLSpanElement>(null), hdg = useRef<HTMLSpanElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const audio = useRef<FlightAudio | null>(null);
  const item = FLEET.find((f) => f.id === id)!;

  // entrada/saída: trava o scroll, esconde a página, áudio, orientação
  useEffect(() => {
    resetFlightInput();
    flightUi.set({ phase: 'start', view: 'chase', auto: false });
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
      a.update(TEL.spool, TEL.speed, flightUi.get().view === 'cockpit');
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
      if (k === ' ') { IN.takeoff = true; return; }
      if (k === 'l') { IN.land = true; return; }
      if (k === 'f') { flightUi.set({ auto: !flightUi.get().auto }); return; }
      if (k === 'c') { flightUi.set({ view: flightUi.get().view === 'chase' ? 'cockpit' : 'chase' }); return; }
      if (k === 'm') { flightUi.set({ sound: !flightUi.get().sound }); return; }
      held.add(k); apply();
    };
    const up = (e: KeyboardEvent) => { held.delete(e.key.toLowerCase()); apply(); };
    const blur = () => { held.clear(); apply(); };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // converte deltas de tela para o quadro girado (paisagem forçada)
  const local = (dx: number, dy: number) => (flightUi.get().rotate ? [dy, -dx] : [dx, dy]);

  // olhar 360° (mãozinha)
  const look = useRef<{ x: number; y: number; id: number } | null>(null);
  const onLookDown = (e: React.PointerEvent<HTMLDivElement>) => { if (e.button !== 0) return; look.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); audio.current?.resume(); };
  const onLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const l = look.current; if (!l || l.id !== e.pointerId) return;
    const [dx, dy] = local(e.clientX - l.x, e.clientY - l.y); l.x = e.clientX; l.y = e.clientY;
    IN.lookYaw -= dx * 0.006; IN.lookPitch = Math.max(-0.4, Math.min(1.0, IN.lookPitch + dy * 0.004)); IN.lookAt = performance.now();
  };
  const onLookUp = () => { look.current = null; };

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
      <div className="sf-flight__look" onPointerDown={onLookDown} onPointerMove={onLookMove} onPointerUp={onLookUp} onPointerCancel={onLookUp} onLostPointerCapture={onLookUp} />
      <div className="sf-flight__top">
        <button type="button" className="sf-flight__x" onClick={exit} aria-label={F.exit} title={F.exit}><i /><i /></button>
        <div className="sf-flight__name"><b>{item.name}</b><span>{F.title}</span></div>
        <div className="sf-flight__tools">
          {(phase === 'air' || phase === 'approach') && <button type="button" aria-pressed={auto} onClick={() => flightUi.set({ auto: !auto })}>{F.free}</button>}
          {phase === 'air' && <button type="button" onClick={() => { IN.land = true; }}>{F.land}</button>}
          <button type="button" aria-pressed={view === 'cockpit'} onClick={() => flightUi.set({ view: view === 'chase' ? 'cockpit' : 'chase' })} aria-label={F.view}>{view === 'chase' ? F.cockpit : F.chase}</button>
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
      <p className="sf-flight__hint"><span className="sf-flight__hint-k">{F.hintKeys}</span><span className="sf-flight__hint-t">{F.controlsTouch}</span></p>
      <div className="sf-flight__stick" onPointerDown={onStickDown} onPointerMove={onStickMove} onPointerUp={onStickUp} onPointerCancel={onStickUp} aria-label={F.stick} role="slider" aria-valuenow={0}>
        <span ref={knob} />
      </div>
      <p className="sf-flight__note">{F.note}</p>
    </div>
  );
}
