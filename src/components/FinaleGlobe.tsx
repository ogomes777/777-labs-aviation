'use client';
import { useEffect } from 'react';
import { frame } from '@/experience/director';

/**
 * Globo do final: arraste em qualquer área livre do bloco final para girar (mouse: 2 eixos; toque: horizontal,
 * o vertical continua rolando a página). Ao descer, o globo volta sozinho para o lado das rotas (América do Sul).
 */
export default function FinaleGlobe() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.finale');
    if (!el) return;
    let drag: { x: number; y: number; id: number; touch: boolean } | null = null;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('a,button,input,select,textarea,dialog,[role="button"]')) return;
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse' };
      el.dataset.grab = 'true';
    };
    const move = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      frame.globeYaw += dx * 0.006;
      if (!drag.touch) frame.globePitch = Math.max(-0.7, Math.min(0.7, frame.globePitch + dy * 0.004));
    };
    const up = () => { drag = null; delete el.dataset.grab; };
    // ao rolar, o globo retorna suavemente ao lado das rotas
    let raf = 0;
    const settle = () => { raf = 0; if (drag) return; frame.globeYaw *= 0.9; frame.globePitch *= 0.9; if (Math.abs(frame.globeYaw) > 0.002 || Math.abs(frame.globePitch) > 0.002) raf = requestAnimationFrame(settle); };
    const onScroll = () => { if (!raf && !drag) raf = requestAnimationFrame(settle); };
    el.addEventListener('pointerdown', down);
    addEventListener('pointermove', move, { passive: true });
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
