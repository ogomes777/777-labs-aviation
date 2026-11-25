'use client';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { PreviewState } from './usePreview';

/**
 * Card glass de pré-visualização ancorado ao hotspot, com flip horizontal/vertical perto das bordas.
 * Segue o hotspot (que se move com a câmera) a cada quadro enquanto aberto. Em telas estreitas vira uma
 * placa na base da tela. A mídia é carregada só quando o card abre; erro de mídia → fallback explícito.
 */
export default function HotspotPreview({ state, cardRef, onConfirm, onEnter, onLeave, tone = 'dark', id }: {
  state: PreviewState; cardRef: RefObject<HTMLDivElement | null>; onConfirm: () => void; onEnter: () => void; onLeave: () => void; tone?: 'dark' | 'light'; id: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const raf = useRef(0);
  useEffect(() => setMounted(true), []);
  const item = state.item;

  useLayoutEffect(() => {
    const card = cardRef.current, anchor = state.anchor;
    if (!item || !card || !anchor) return;
    const place = () => {
      const narrow = innerWidth < 700;
      if (narrow) { card.style.transform = 'none'; card.dataset.dock = 'bottom'; }
      else {
        card.dataset.dock = 'anchor';
        const r = anchor.getBoundingClientRect();
        const w = card.offsetWidth, h = card.offsetHeight;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let x = cx + 22, side = 'right';
        if (x + w > innerWidth - 16) { x = cx - 22 - w; side = 'left'; }
        let y = cy - h * 0.42;
        y = Math.max(76, Math.min(innerHeight - h - 16, y));
        card.dataset.side = side;
        card.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      }
      raf.current = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf.current);
  }, [item, state.anchor, cardRef]);

  if (!mounted || !item) return null;
  const showMedia = item.media && failed !== item.media;
  return createPortal(
    <div ref={cardRef} id={id} className="hp-card" data-tone={tone} data-armed={state.armed} role={state.armed ? 'dialog' : 'tooltip'} aria-label={state.armed ? `Prévia: ${item.title}` : undefined}
      onPointerEnter={onEnter} onPointerLeave={(e) => { if (e.pointerType === 'mouse') onLeave(); }}>
      <div className="hp-card__media" data-fallback={!showMedia}>
        {showMedia ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={item.media} src={item.media} alt="" decoding="async" onError={() => setFailed(item.media ?? null)} />
        ) : (
          <div className="hp-card__fallback" aria-hidden="true">
            <svg viewBox="0 0 120 60"><path d="M6 33 L52 30 L70 10 L78 10 L68 30 L100 29 L112 22 L116 24 L110 33 L68 36 L78 54 L70 54 L52 37 L6 35 Z" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
            <span>Prévia visual pendente</span>
          </div>
        )}
      </div>
      <div className="hp-card__body">
        <span className="hp-card__kicker">{item.kicker}<b>{item.badge}</b></span>
        <strong className="hp-card__title">{item.title}</strong>
        <p className="hp-card__text">{item.text}</p>
        {state.armed ? (
          <button type="button" className="hp-card__cta" onClick={onConfirm}>{item.cta} <span aria-hidden="true">↗</span></button>
        ) : (
          <span className="hp-card__hint">Clique para abrir · Enter no teclado</span>
        )}
      </div>
    </div>,
    document.body,
  );
}
