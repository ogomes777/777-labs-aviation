'use client';
import { useEffect } from 'react';
import { ui } from '@/experience/director';

/**
 * Microrreação tipográfica.
 * Desktop: palavras próximas do cursor se erguem, inclinam em X e aquecem para champagne.
 * Toque: um toque no título dispara uma onda que percorre a frase.
 * Atua no invólucro `.w` (as revelações de scroll animam o `.wi` interno — sem conflito de propriedades).
 */
export default function TextReact() {
  const motion = ui.useStore((s) => s.motion);
  useEffect(() => {
    if (motion === 'reduced') return;
    const SEL = 'h1 .w, h2 .w, .portal__line .w, .hero__ascent .w';
    const fine = matchMedia('(pointer: fine)').matches;
    let x = -1e4, y = -1e4, raf = 0;
    const active = new Set<HTMLElement>();
    const tick = () => {
      raf = 0;
      const vh = innerHeight;
      document.querySelectorAll<HTMLElement>(SEL).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const dx = r.left + r.width / 2 - x, dy = r.top + r.height / 2 - y;
        const k = Math.max(0, 1 - Math.hypot(dx, dy * 1.4) / 150);
        if (k > 0.01) {
          el.style.transform = `translate3d(${(-dx * 0.02 * k).toFixed(2)}px, ${(-k * 7).toFixed(2)}px, 0) rotateX(${(k * 14).toFixed(1)}deg)`;
          el.style.color = k > 0.35 ? (el.closest('#engenharia') ? '#f3faff' : el.closest('#interior,#experiencia') ? '#74bfff' : 'var(--champagne)') : '';
          el.setAttribute('data-near', '');
          active.add(el);
        } else if (active.has(el)) {
          el.style.transform = ''; el.style.color = ''; el.removeAttribute('data-near'); active.delete(el);
        }
      });
    };
    const onMove = (e: PointerEvent) => { if (e.pointerType !== 'mouse') return; x = e.clientX; y = e.clientY; if (!raf) raf = requestAnimationFrame(tick); };
    const onScroll = () => { if (fine && !raf) raf = requestAnimationFrame(tick); };
    const onTap = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const host = (e.target as HTMLElement)?.closest?.('h1, h2, .portal__line, .hero__ascent');
      if (!host) return;
      host.querySelectorAll<HTMLElement>('.w').forEach((el, i) => {
        el.animate(
          [{ transform: 'translateY(0) rotateX(0)', color: '' }, { transform: 'translateY(-9px) rotateX(22deg)', color: el.closest('#engenharia') ? '#f3faff' : el.closest('#interior,#experiencia') ? '#74bfff' : 'var(--champagne)', offset: 0.4 }, { transform: 'translateY(0) rotateX(0)', color: '' }],
          { duration: 820, delay: i * 55, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
      });
    };
    if (fine) { window.addEventListener('pointermove', onMove, { passive: true }); window.addEventListener('scroll', onScroll, { passive: true }); }
    window.addEventListener('pointerdown', onTap, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('scroll', onScroll); window.removeEventListener('pointerdown', onTap);
      cancelAnimationFrame(raf); active.forEach((el) => { el.style.transform = ''; el.style.color = ''; });
    };
  }, [motion]);
  return null;
}
