'use client';
import type { FleetId } from '@/content/fleet';
import { FLEET_SPECS } from '@/three/fleet/specs';

/**
 * Planta técnica 2D (vista superior, nariz à esquerda), no estilo de planta arquitetônica.
 * Desenhada em metros a partir da MESMA especificação do modelo 3D. Configuração ilustrativa do modelo:
 * cotas só aparecem quando há fonte (envelope EASA/Embraer; largura de cabine Embraer 2,08 m).
 */
const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FloorPlan({ id, seat, onSeat }: { id: FleetId; seat: number | null; onSeat: (i: number) => void }) {
  const s = FLEET_SPECS[id];
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
  const seatW = prop ? 0.48 : 0.6;
  const embraer = id === 'legacy-450' || id === 'praetor-500' || id === 'praetor-600';
  const cockpitEnd = prop ? Ln + 0.9 : Ln * 1.05;
  return (
    <figure className="fplan" aria-label={`Planta ilustrativa da cabine do ${id}`}>
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
        <text x={(prop ? Ln * 0.55 : Ln * 0.62)} y={0.12} className="fplan__label">Cockpit</text>
        {/* janelas (ambos os lados) */}
        {Array.from({ length: s.windows.n }, (_, i) => { const d = s.windows.d0 + i * s.windows.pitch; return [-1, 1].map((sd) => <line key={`${i}${sd}`} x1={d - s.windows.w / 2} x2={d + s.windows.w / 2} y1={sd * w(d)} y2={sd * w(d)} className="fplan__win" />); })}
        {/* porta principal (lado esquerdo = base do desenho) */}
        <g className="fplan__door">
          <line x1={s.door.d - s.door.w / 2} x2={s.door.d + s.door.w / 2} y1={w(s.door.d)} y2={w(s.door.d)} />
          <path d={`M${s.door.d - s.door.w / 2},${w(s.door.d)} A${s.door.w},${s.door.w} 0 0 1 ${s.door.d + s.door.w / 2},${w(s.door.d) + s.door.w}`} />
          <text x={s.door.d} y={w(s.door.d) + s.door.w + 0.42} className="fplan__label fplan__label--sm">Porta</text>
        </g>
        {/* lavatório: somente onde o anúncio declara (Legacy 450) */}
        {id === 'legacy-450' && <g><rect x={c1 - 1.0} y={-inner(c1 - 1) + 0.05} width={0.95} height={inner(c1 - 1) * 2 - 0.1} className="fplan__room" /><text x={c1 - 0.52} y={0.1} className="fplan__label fplan__label--sm">Lav.</text></g>}
        {/* poltronas (clicáveis → vista sentado) */}
        {s.cabin.seats.map((st, i) => {
          const z = st.side * (prop ? R * 0.4 : R * 0.5);
          const on = seat === i;
          return (
            <g key={i} className="fplan__seat" data-on={on} role="button" tabIndex={0} aria-pressed={on} aria-label={`Poltrona ${i + 1}: ver deste lugar`}
              onClick={() => onSeat(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeat(i); } }}>
              <rect x={st.d - seatW / 2} y={z - seatW / 2} width={seatW} height={seatW} rx={0.1} />
              <line x1={st.d + (st.facing === 1 ? -1 : 1) * (seatW / 2 - 0.08)} x2={st.d + (st.facing === 1 ? -1 : 1) * (seatW / 2 - 0.08)} y1={z - seatW / 2 + 0.06} y2={z + seatW / 2 - 0.06} className="fplan__back" />
              <text x={st.d} y={z + 0.1} className="fplan__num">{String(i + 1).padStart(2, '0')}</text>
            </g>
          );
        })}
        {/* cotas verificadas */}
        <g className="fplan__dim">
          <line x1={0} x2={L} y1={R + 1.1} y2={R + 1.1} />
          <line x1={0} x2={0} y1={R + 0.85} y2={R + 1.35} /><line x1={L} x2={L} y1={R + 0.85} y2={R + 1.35} />
          <text x={L / 2} y={R + 1.6} className="fplan__label fplan__label--sm">{`Comprimento total do tipo: ${fmt(s.envelope.length)} m`}</text>
          {embraer && <><line x1={c0 + 0.32} x2={c0 + 0.32} y1={-1.04} y2={1.04} /><line x1={c0 + 0.2} x2={c0 + 0.44} y1={-1.04} y2={-1.04} /><line x1={c0 + 0.2} x2={c0 + 0.44} y1={1.04} y2={1.04} /><text x={(c0 + c1) / 2} y={-R - 0.45} className="fplan__label fplan__label--sm">Largura interna da cabine: 2,08 m (Embraer) · cota no início da cabine</text></>}
        </g>
      </svg>
      <figcaption id="fplan-cap">Configuração ilustrativa do modelo · {s.cabin.seats.length} lugares anunciados · não é a planta do exemplar. Toque numa poltrona para ver deste lugar.</figcaption>
    </figure>
  );
}
