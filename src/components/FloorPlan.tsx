'use client';
import type { FleetId } from '@/content/fleet';
import { FLEET_SPECS } from '@/three/fleet/specs';
import { FLEET } from '@/content/fleet';
import { fmt as tf, useM } from '@/i18n';
import { ui } from '@/experience/director';

/**
 * Planta técnica 2D (vista superior, nariz à esquerda), no estilo de planta arquitetônica.
 * Desenhada em metros a partir da MESMA especificação do modelo 3D. Configuração ilustrativa do modelo:
 * cotas só aparecem quando há fonte (envelope EASA/Embraer; largura de cabine Embraer 2,08 m).
 */
const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FloorPlan({ id }: { id: FleetId }) {
  const M = useM(); const P = M.fleet.plan2d;
  const seat = ui.useStore((st) => st.seat);
  const pickSeat = (i: number) => ui.set({ seat: seat === i ? null : i });
  const s = FLEET_SPECS[id];
  const name = FLEET.find((f) => f.id === id)?.name ?? id;
  const prop = s.nose === 'prop';
  const L = s.fusL ?? s.envelope.length - (prop ? 0.38 : 0);
  const R = s.R, Ln = s.Ln, Lt = s.Lt;
  // meia-largura externa da fuselagem ao longo do comprimento (mesma lógica de forma do 3D, simplificada)
  const w = (d: number) => {
    if (d < Ln) { const k = Math.max(0, d / Ln); return R * Math.pow(1 - Math.pow(1 - k, prop ? 1.6 : 2), prop ? 0.5 : 0.6) + (prop ? R * 0.42 * (1 - k) * 0.6 : 0); }
    if (d > L - Lt) { const k = Math.min(1, (d - (L - Lt)) / Lt); return R * (1 - 0.92 * Math.pow(k, 1.22)); }
    return R;
  };
  const N = 80;
  const top: string[] = [], bot: string[] = [];
  for (let i = 0; i <= N; i++) { const d = (L * i) / N; top.push(`${d.toFixed(3)},${(-w(d)).toFixed(3)}`); bot.push(`${d.toFixed(3)},${w(d).toFixed(3)}`); }
  const outline = `M${top.join(' L')} L${bot.reverse().join(' L')} Z`;
  const inner = (d: number) => Math.max(0, w(d) - 0.1);
  const c0 = s.cabin.start, c1 = s.cabin.end;
  const pad = 2.2;
  const vb = `${-pad} ${-R - pad} ${L + pad * 2} ${2 * R + pad * 2 + 1.6}`;
  // mesmas medidas do interior 3D (cabin.ts)
  const sc = prop ? 0.78 : s.R < 1 ? 0.9 : 1;
  const ledge = prop ? 0 : s.R < 1 ? 0.05 : 0.15;
  const seatW = 0.6 * sc;
  const crewD = prop ? s.cabin.start + 0.45 : s.cabin.start - 0.95;
  const pilotOff = prop ? 0.29 : s.R < 1 ? 0.36 : 0.44;
  const embraer = id === 'legacy-450' || id === 'praetor-500' || id === 'praetor-600';
  const cockpitEnd = prop ? s.cabin.start + 0.95 : s.cabin.start;
  return (
    <figure className="fplan" aria-label={tf(P.aria, { name })}>
      <svg viewBox={vb} role="img" aria-labelledby="fplan-cap">
        <defs>
          <pattern id="fplan-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0 L0 0 0 1" fill="none" stroke="currentColor" strokeWidth="0.01" opacity="0.18" /></pattern>
        </defs>
        <rect x={-pad} y={-R - pad} width={L + pad * 2} height={2 * R + pad * 2 + 1.6} fill="url(#fplan-grid)" />
        {/* casco */}
        <path d={outline} className="fplan__hull" />
        {/* piso da cabine */}
        <path d={`M${c0},${-inner(c0)} L${c1},${-inner(c1)} L${c1},${inner(c1)} L${c0},${inner(c0)} Z`} className="fplan__floor" />
        {/* divisória do cockpit */}
        <line x1={cockpitEnd} y1={-inner(cockpitEnd)} x2={cockpitEnd} y2={inner(cockpitEnd)} className="fplan__wall" />
        {!prop && <text x={crewD - 0.95} y={0.1} className="fplan__label fplan__label--sm">{P.cockpit}</text>}
        {/* janelas (ambos os lados) */}
        {Array.from({ length: s.windows.n }, (_, i) => { const d = s.windows.d0 + i * s.windows.pitch; return [-1, 1].map((sd) => <line key={`${i}${sd}`} x1={d - s.windows.w / 2} x2={d + s.windows.w / 2} y1={sd * w(d)} y2={sd * w(d)} className="fplan__win" />); })}
        {/* porta principal (lado esquerdo = base do desenho) */}
        <g className="fplan__door">
          <line x1={s.door.d - s.door.w / 2} x2={s.door.d + s.door.w / 2} y1={w(s.door.d)} y2={w(s.door.d)} />
          <path d={`M${s.door.d - s.door.w / 2},${w(s.door.d)} A${s.door.w},${s.door.w} 0 0 1 ${s.door.d + s.door.w / 2},${w(s.door.d) + s.door.w}`} />
          <text x={s.door.d} y={w(s.door.d) + s.door.w + 0.42} className="fplan__label fplan__label--sm">{P.door}</text>
        </g>
        {/* ambientes da planta de fábrica (galley, divã, mesas, armários, toalete, bagageiro) */}
        {s.cabin.zones.map((z, k) => {
          const dm = (z.d0 + z.d1) / 2, len = z.d1 - z.d0;
          if (z.kind === 'entry') return null;
          if (z.kind === 'exit') return <g key={k} className="fplan__exit"><line x1={z.d0} x2={z.d1} y1={-w(dm)} y2={-w(dm)} /><text x={dm} y={-w(dm) - 0.22} className="fplan__label fplan__label--xs">{P.exit}</text></g>;
          if (z.side === 0) {
            const iw = Math.min(inner(z.d0), inner(Math.min(z.d1, L - 0.4)));
            const out = z.kind === 'baggage';
            return <g key={k}><rect x={z.d0 + 0.03} y={-iw + 0.04} width={len - 0.06} height={iw * 2 - 0.08} rx={0.06} className={out ? 'fplan__room fplan__room--out' : 'fplan__room'} />
              <text x={dm} y={0} transform={`rotate(-90 ${dm} 0)`} dy={0.07} className="fplan__label fplan__label--xs">{z.kind === 'lav' ? (z.toilet ? P.toilet : P.lav) : P.baggage}</text></g>;
          }
          const depth = z.kind === 'table' ? 0.5 * sc : z.kind === 'credenza' ? 0.4 : z.kind === 'refresh' ? 0.34 : z.kind === 'divan' ? 0.62 * sc : 0.6;
          const wall = inner(dm);
          const off = z.kind === 'table' ? wall - ledge - 0.02 : wall;
          const y0 = -z.side * off, y1 = -z.side * (off - depth);
          const label = P[z.kind as 'galley' | 'wardrobe' | 'credenza' | 'table' | 'divan' | 'refresh'];
          return <g key={k}><rect x={z.d0} y={Math.min(y0, y1)} width={len} height={Math.abs(y1 - y0)} rx={z.kind === 'table' ? 0.08 : 0.04} className={`fplan__room fplan__room--${z.kind}`} />
            {z.kind !== 'table' && <text x={dm} y={(y0 + y1) / 2 + 0.07} className="fplan__label fplan__label--xs">{label}</text>}</g>;
        })}
        {/* poltronas (clicáveis → vista sentado). Nariz à esquerda: lado direito em cima, esquerdo (porta) embaixo */}
        {s.cabin.seats.map((st, i) => {
          const sw = seatW;
          const off = st.facing === 0 ? inner(st.d) - 0.34 * sc : inner(st.d) - ledge - 0.31 * sc;
          const y = -st.side * off;
          const back = st.facing === 1 ? <line x1={st.d + sw / 2 - 0.08} x2={st.d + sw / 2 - 0.08} y1={y - sw / 2 + 0.06} y2={y + sw / 2 - 0.06} className="fplan__back" />
            : st.facing === -1 ? <line x1={st.d - sw / 2 + 0.08} x2={st.d - sw / 2 + 0.08} y1={y - sw / 2 + 0.06} y2={y + sw / 2 - 0.06} className="fplan__back" />
            : <line x1={st.d - sw / 2 + 0.06} x2={st.d + sw / 2 - 0.06} y1={y - st.side * (sw / 2 - 0.08)} y2={y - st.side * (sw / 2 - 0.08)} className="fplan__back" />;
          return (
            <g key={i} className="fplan__seat" data-on={seat === i} role="button" tabIndex={0} aria-pressed={seat === i} aria-label={tf(P.seat, { n: i + 1 })}
              onClick={() => pickSeat(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickSeat(i); } }} style={{ ['--i' as string]: i } as React.CSSProperties}>
              <rect x={st.d - sw / 2} y={y - sw / 2} width={sw} height={sw} rx={0.1} />
              {back}
            </g>
          );
        })}
        {/* tripulação (cockpit) */}
        {[-1, 1].map((sd) => <rect key={sd} x={crewD - 0.27 * sc} y={-sd * pilotOff - 0.27 * sc} width={0.54 * sc} height={0.54 * sc} rx={0.08} className="fplan__crew" />)}
        {/* cotas verificadas */}
        <g className="fplan__dim">
          <line x1={0} x2={L} y1={R + 1.1} y2={R + 1.1} />
          <line x1={0} x2={0} y1={R + 0.85} y2={R + 1.35} /><line x1={L} x2={L} y1={R + 0.85} y2={R + 1.35} />
          <text x={L / 2} y={R + 1.6} className="fplan__label fplan__label--sm">{tf(P.length, { n: fmt(s.envelope.length) })}</text>
          {embraer && <><line x1={c0 + 0.32} x2={c0 + 0.32} y1={-1.04} y2={1.04} /><line x1={c0 + 0.2} x2={c0 + 0.44} y1={-1.04} y2={-1.04} /><line x1={c0 + 0.2} x2={c0 + 0.44} y1={1.04} y2={1.04} /><text x={(c0 + c1) / 2} y={-R - 0.45} className="fplan__label fplan__label--sm">{P.width}</text></>}
        </g>
      </svg>
      <figcaption id="fplan-cap">{seat !== null ? tf(M.flight.seatChosen, { n: String(seat + 1).padStart(2, '0') }) : M.flight.seatPick}<br />{tf(P.factory, { src: s.cabin.layoutSource.split(':')[0] })}</figcaption>
    </figure>
  );
}
