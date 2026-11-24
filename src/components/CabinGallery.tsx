'use client';
import { useCallback, useEffect, useRef } from 'react';
import { GALLERY } from '@/content/site';
import { frame, ui } from '@/experience/director';
import { nav } from './navigation';
import { track } from '@/lib/analytics';

/**
 * Galeria horizontal da cabine.
 * Desktop cinemático: a faixa acompanha o progresso do capítulo (sticky) e os botões/teclado rolam a página até o card.
 * Mobile / leve / reduzido: rolagem horizontal nativa com scroll-snap (sem sequestro do scroll vertical).
 */
export default function CabinGallery() {
  const index = ui.useStore((s) => s.galleryIndex);
  const motion = ui.useStore((s) => s.motion);
  const vp = useRef<HTMLDivElement>(null);
  const n = GALLERY.length;
  const swipe = useRef(false);

  useEffect(() => {
    const decide = () => {
      swipe.current = motion !== 'cinematic' || matchMedia('(max-width: 760px)').matches;
      frame.gallerySwipe = motion === 'cinematic' && swipe.current;
    };
    decide();
    window.addEventListener('resize', decide);
    return () => window.removeEventListener('resize', decide);
  }, [motion]);

  // modo swipe: índice contínuo a partir do scrollLeft
  useEffect(() => {
    const el = vp.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (!swipe.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const cards = Array.from(el.querySelectorAll<HTMLElement>('.card'));
        const center = el.scrollLeft + el.clientWidth / 2;
        let best = 0, bestD = Infinity, cont = 0;
        cards.forEach((c, i) => { const cc = c.offsetLeft + c.offsetWidth / 2; const d = Math.abs(cc - center); if (d < bestD) { bestD = d; best = i; } });
        const first = cards[0], last = cards[cards.length - 1];
        if (first && last) { const a = first.offsetLeft + first.offsetWidth / 2, b = last.offsetLeft + last.offsetWidth / 2; cont = Math.max(0, Math.min(1, (center - a) / (b - a))) * (n - 1); }
        frame.gallery = cont;
        (window as unknown as { __777recompute?: () => void }).__777recompute?.();
        if (best !== ui.get().galleryIndex) { ui.set({ galleryIndex: best }); track('gallery_card_view', { index: best }); }
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [n]);

  const goTo = useCallback((i: number) => {
    const target = Math.max(0, Math.min(n - 1, i));
    if (swipe.current) {
      const el = vp.current;
      const card = el?.querySelectorAll<HTMLElement>('.card')[target];
      if (el && card) el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: motion === 'reduced' ? 'auto' : 'smooth' });
      ui.set({ galleryIndex: target });
      return;
    }
    const ch = document.querySelector<HTMLElement>('[data-chapter="6"]');
    if (!ch) return;
    const top = ch.getBoundingClientRect().top + window.scrollY;
    const range = ch.offsetHeight - window.innerHeight;
    const y = top + range * (target / (n - 1)) + (target === 0 ? 2 : 0);
    if (nav.lenis) nav.lenis.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  }, [n, motion]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1); }
    if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    if (e.key === 'End') { e.preventDefault(); goTo(n - 1); }
  };

  return (
    <div className="gallery-wrap" style={{ display: 'contents' }}>
      <div className="gallery__viewport" ref={vp} data-gallery-viewport tabIndex={0} role="region" aria-roledescription="carrossel" aria-label="Galeria da cabine — use as setas esquerda e direita" onKeyDown={onKey}>
        <div className="gallery__track" data-gallery-track>
          {GALLERY.map((g, i) => (
            <article key={g.id} className="card" data-active={i === index ? 'true' : 'false'} aria-roledescription="slide" aria-label={`${i + 1} de ${n}: ${g.kicker}`}>
              <div className="card__media">
                <img src={`/media/cabin-${g.id}.webp`} alt={`Render da cabine conceitual: ${g.kicker.toLowerCase()}`} width={880} height={550} loading="lazy" decoding="async" />
              </div>
              <div className="card__body">
                <span className="card__kicker">{g.kicker}</span>
                <h3>{g.title}</h3>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="gallery__controls">
        <button type="button" className="textbtn" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Microcena anterior">Anterior</button>
        <span aria-live="polite" className="counter">{String(index + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
        <button type="button" className="textbtn" onClick={() => goTo(index + 1)} disabled={index === n - 1} aria-label="Próxima microcena">Próxima</button>
      </div>
    </div>
  );
}
