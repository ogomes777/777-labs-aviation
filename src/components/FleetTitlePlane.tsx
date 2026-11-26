'use client';
import { useEffect, useRef, useState } from 'react';
import { frame, ui } from '@/experience/director';

/**
 * V6 — o jato SimFly (PNG aprovado da marca, mesmo do hero) cruza da esquerda para a direita ao entrar no hangar,
 * freia e fica flutuando atrás de "A frota.", com pulso de brilho azul. É o avião-narrativa da marca,
 * não uma das cinco aeronaves anunciadas. Reduz/para com prefers-reduced-motion.
 */
export default function FleetTitlePlane() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'out' | 'in'>('out');
  const inspect = ui.useStore((s) => s.inspect);
  useEffect(() => {
    // amarrado ao progresso do capítulo: entra exatamente quando "A frota." é revelada e sai com ela
    let raf = 0, last = '';
    const tick = () => {
      const p = frame.chapters[3];
      const sec = document.getElementById('frota');
      const inView = !!sec && sec.getBoundingClientRect().top <= 1 && sec.getBoundingClientRect().bottom >= innerHeight - 1;
      const next = (inView || (p > 0.012 && p < 0.985)) && p > 0.012 && p < 0.985 ? 'in' : 'out';
      if (next !== last) { last = next; setState(next as 'in' | 'out'); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div ref={ref} className="fleet__plane" data-state={state} data-inspecting={inspect ? 'true' : 'false'} aria-hidden="true">
      <div className="fleet__plane-fly"><img src="/media/simfly-plane-cutout.png" alt="" width={1400} height={426} decoding="async" loading="lazy" /></div>
    </div>
  );
}
