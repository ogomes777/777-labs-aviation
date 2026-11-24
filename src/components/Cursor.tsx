'use client';
import { useEffect, useRef } from 'react';
import { ui } from '@/experience/director';

/**
 * Cursor de acompanhamento (o cursor nativo permanece): ponto + anel com inércia, anel cresce e mostra
 * um rótulo contextual sobre elementos interativos; botões têm leve magnetismo.
 */
export default function Cursor() {
  const motion = ui.useStore((s) => s.motion);
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (motion === 'reduced' || !matchMedia('(pointer: fine)').matches) return;
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf = 0;
    let mag: HTMLElement | null = null;
    const loop = () => {
      rx += (x - rx) * 0.16; ry += (y - ry) * 0.16;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      const t = (e.target as HTMLElement)?.closest?.('a, button, [data-cursor], [role="region"], .globe-surface') as HTMLElement | null;
      const r = ring.current;
      if (r) {
        r.dataset.active = t ? 'true' : 'false';
        const lbl = t?.dataset.cursor ?? (t?.classList.contains('globe-surface') ? 'Arraste' : t?.getAttribute('role') === 'region' ? 'Deslize' : '');
        if (label.current) label.current.textContent = lbl;
        r.dataset.label = lbl ? 'true' : 'false';
      }
      const g = (e.target as HTMLElement)?.closest?.('.fcard, .card, .dest-card, .inspect, .form') as HTMLElement | null;
      if (g) { const b = g.getBoundingClientRect(); g.style.setProperty('--gx', `${(((x - b.left) / b.width) * 100).toFixed(0)}%`); }
      const m = (e.target as HTMLElement)?.closest?.('.btn') as HTMLElement | null;
      if (mag && mag !== m) { mag.style.transform = ''; mag = null; }
      if (m) {
        const b = m.getBoundingClientRect();
        m.style.transform = `translate(${((x - (b.left + b.width / 2)) * 0.18).toFixed(1)}px, ${((y - (b.top + b.height / 2)) * 0.28).toFixed(1)}px)`;
        mag = m;
      }
    };
    document.documentElement.dataset.cursor = 'on';
    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); delete document.documentElement.dataset.cursor; if (mag) mag.style.transform = ''; };
  }, [motion]);
  if (motion === 'reduced') return null;
  return (
    <div className="cursor" aria-hidden="true">
      <div ref={ring} className="cursor__ring"><span ref={label} /></div>
      <div ref={dot} className="cursor__dot" />
    </div>
  );
}
