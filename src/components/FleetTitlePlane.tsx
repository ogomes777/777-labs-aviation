'use client';
import { useEffect, useRef, useState } from 'react';
import { ui } from '@/experience/director';

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
    const sec = document.getElementById('frota'); if (!sec) return;
    const io = new IntersectionObserver(([e]) => {
      const r = e.boundingClientRect;
      // dentro do capítulo: topo já passou da metade da tela e o fim ainda não saiu
      setState(r.top < innerHeight * 0.35 && r.bottom > innerHeight * 0.6 ? 'in' : 'out');
    }, { threshold: Array.from({ length: 41 }, (_, i) => i / 40) });
    io.observe(sec);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="fleet__plane" data-state={state} data-inspecting={inspect ? 'true' : 'false'} aria-hidden="true">
      <div className="fleet__plane-fly"><img src="/media/simfly-plane-cutout.png" alt="" width={1400} height={426} decoding="async" loading="lazy" /></div>
    </div>
  );
}
