'use client';
import { useMemo, useRef } from 'react';
import { DESTINATIONS, ORIGIN, REGIONS, greatCircleKm, type RegionId } from '@/content/destinations';
import { formBridge, frame, ui } from '@/experience/director';
import dots from '@/content/globe-dots.json';
import { navigate } from './navigation';
import { track } from '@/lib/analytics';

const fmt = new Intl.NumberFormat('pt-BR');

/** Mapa 2D equiretangular (fallback sem WebGL / modo leve). Pontos e destinos reais, mesma seleção. */
function FlatMap({ selected, visible }: { selected: string | null; visible: Set<string> }) {
  const W = 720, H = 360;
  const P = (lat: number, lon: number) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H] as const;
  const d = selected ? DESTINATIONS.find((x) => x.id === selected) : null;
  const [ox, oy] = P(ORIGIN.lat, ORIGIN.lon);
  return (
    <svg className="globe-fallback" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={d ? `Mapa: rota ilustrativa de ${ORIGIN.name} a ${d.name}` : 'Mapa-múndi com destinos de inspiração'}>
      <g fill="currentColor" opacity="0.5">
        {(dots as [number, number][]).filter((_, i) => i % 2 === 0).map(([la, lo], i) => { const [x, y] = P(la, lo); return <circle key={i} cx={x} cy={y} r={1.1} />; })}
      </g>
      {d && (() => { const [x, y] = P(d.lat, d.lon); const mx = (ox + x) / 2, my = Math.min(oy, y) - 40; return <path d={`M${ox},${oy} Q${mx},${my} ${x},${y}`} fill="none" stroke="#d8bf94" strokeWidth="1.6" />; })()}
      <circle cx={ox} cy={oy} r={4} fill="#d8bf94" />
      {DESTINATIONS.map((x) => { const [px, py] = P(x.lat, x.lon); return <circle key={x.id} cx={px} cy={py} r={x.id === selected ? 5 : 3} fill={x.id === selected ? '#d8bf94' : '#f4f6f8'} opacity={visible.has(x.id) ? 1 : 0.2} />; })}
    </svg>
  );
}

export default function DestinationsPanel() {
  const region = ui.useStore((s) => s.region);
  const selected = ui.useStore((s) => s.destination);
  const motion = ui.useStore((s) => s.motion);
  const live = motion === 'cinematic';
  const list = useMemo(() => DESTINATIONS.filter((d) => region === 'todos' || d.region === region), [region]);
  const visible = useMemo(() => new Set(list.map((d) => d.id)), [list]);
  const sel = DESTINATIONS.find((d) => d.id === selected) ?? null;
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);

  const pickRegion = (r: RegionId) => {
    ui.set({ region: r });
    if (selected && r !== 'todos' && DESTINATIONS.find((d) => d.id === selected)?.region !== r) ui.set({ destination: null });
    track('destinations_interact', { region: r });
  };
  const pick = (id: string) => { ui.set({ destination: id }); frame.globeYaw = 0; frame.globePitch = 0; track('destinations_interact', { destination: id }); };
  const use = () => {
    if (!sel) return;
    formBridge.set({ to: `${sel.name}, ${sel.country}`, toId: sel.id, stamp: Date.now() });
    track('destination_use', { destination: sel.id });
    navigate('#planejar');
  };

  return (
    <>
      <div className="dest-ui" data-in="0.42" data-y="30">
        <h2 id="destinos-title" data-focus-target>O destino começa <em>antes.</em></h2>
        <div className="chips" role="group" aria-label="Filtrar por região">
          {REGIONS.map((r) => <button key={r.id} type="button" className="chip" aria-pressed={region === r.id} onClick={() => pickRegion(r.id)}>{r.label}</button>)}
        </div>
        <ul className="dest-list" aria-label="Destinos de inspiração">
          {list.map((d) => (
            <li key={d.id}>
              <button type="button" className="dest-item" aria-pressed={selected === d.id} onClick={() => pick(d.id)}>
                <span>{d.name}</span><small>{d.country}</small>
              </button>
            </li>
          ))}
        </ul>
        <div className="dest-card" aria-live="polite">
          {sel ? (
            <>
              <span className="fcard__kind">{sel.country}</span>
              <h3>{sel.name}</h3>
              <p>{sel.mood}</p>
              <p><strong style={{ color: 'var(--fg)' }}>≈ {fmt.format(Math.round(greatCircleKm(ORIGIN, sel) / 10) * 10)} km</strong> em linha reta de {ORIGIN.name}.</p>
              <div><button type="button" className="btn btn--solid btn--small" onClick={use}>Usar como destino</button></div>
            </>
          ) : (
            <p>Escolha um destino.</p>
          )}
        </div>
        <p className="micro">Inspirações ilustrativas, distância em linha reta a partir de {ORIGIN.name}. Não indicam rotas operadas.</p>
      </div>
      <div
        className="globe-surface"
        aria-hidden="true"
        onPointerDown={(e) => { if (!live) return; drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; }}
        onPointerMove={(e) => {
          const d = drag.current; if (!d || d.id !== e.pointerId) return;
          frame.globeYaw += (e.clientX - d.x) * 0.006;
          if (e.pointerType === 'mouse') frame.globePitch += (e.clientY - d.y) * 0.004;
          d.x = e.clientX; d.y = e.clientY;
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        {!live && <FlatMap selected={selected} visible={visible} />}
      </div>
    </>
  );
}
