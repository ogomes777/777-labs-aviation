'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Máquina de estados da camada de preview (V6, baseada em simfly-fleet-pack/starter/preview-state.ts).
 * Desktop: hover/focus abre, clique confirma. Toque/caneta: 1º toque abre e ARMA; 2º toque no mesmo
 * hotspot (ou o CTA do card) confirma. Toque fora, Escape ou blur fecham. Fechamento com atraso curto (sem flicker).
 */
export interface PreviewItem {
  key: string;
  kicker: string;
  title: string;
  text: string;
  /** imagem (PNG/WebP transparente) do sistema/peça; ausente ou com erro → fallback explícito */
  media?: string;
  badge: string;
  cta: string;
}
export interface PreviewState { item: PreviewItem | null; anchor: HTMLElement | null; armed: boolean }

const CLOSE_DELAY = 120;
const OPEN_DELAY = 40;

export function usePreview() {
  const [state, setState] = useState<PreviewState>({ item: null, anchor: null, armed: false });
  const st = useRef(state); st.current = state;
  const closeT = useRef<number | null>(null);
  const openT = useRef<number | null>(null);
  const pointerType = useRef<string>('mouse');
  const confirmRef = useRef<(() => void) | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const clearTimers = () => { if (closeT.current) window.clearTimeout(closeT.current); if (openT.current) window.clearTimeout(openT.current); closeT.current = openT.current = null; };
  const close = useCallback(() => { clearTimers(); confirmRef.current = null; setState({ item: null, anchor: null, armed: false }); }, []);
  const scheduleClose = useCallback(() => { if (closeT.current) window.clearTimeout(closeT.current); closeT.current = window.setTimeout(close, CLOSE_DELAY); }, [close]);
  const cancelClose = useCallback(() => { if (closeT.current) window.clearTimeout(closeT.current); closeT.current = null; }, []);
  const open = useCallback((item: PreviewItem, anchor: HTMLElement, armed: boolean, onConfirm: () => void, delay = 0) => {
    clearTimers();
    const go = () => { confirmRef.current = onConfirm; setState({ item, anchor, armed }); };
    if (delay > 0) openT.current = window.setTimeout(go, delay); else go();
  }, []);
  const confirm = useCallback(() => { const fn = confirmRef.current; close(); fn?.(); }, [close]);

  // toque fora / Escape
  useEffect(() => {
    if (!state.item) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (cardRef.current?.contains(t) || st.current.anchor?.contains(t)) return;
      if ((t as HTMLElement).closest?.('[data-preview-hotspot]')) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { const a = st.current.anchor; close(); a?.focus(); } };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey); };
  }, [state.item, close]);
  useEffect(() => () => clearTimers(), []);

  /** Handlers para um botão de hotspot. `onConfirm` executa a seleção real (atlas 3D). */
  const bind = useCallback((item: PreviewItem, onConfirm: () => void) => ({
    'data-preview-hotspot': item.key,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => { pointerType.current = e.pointerType || 'mouse'; },
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => { if (e.pointerType === 'mouse') open(item, e.currentTarget, false, onConfirm, OPEN_DELAY); },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => { if (e.pointerType === 'mouse') { if (openT.current) window.clearTimeout(openT.current); scheduleClose(); } },
    onFocus: (e: React.FocusEvent<HTMLElement>) => { if (pointerType.current === 'mouse' || pointerType.current === 'keyboard') open(item, e.currentTarget, false, onConfirm); },
    onBlur: () => { if (!st.current.armed) scheduleClose(); },
    onKeyDown: () => { pointerType.current = 'keyboard'; },
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      const touch = pointerType.current === 'touch' || pointerType.current === 'pen';
      if (touch) {
        const s = st.current;
        if (s.item?.key === item.key && s.armed) { confirm(); return; }
        open(item, e.currentTarget, true, onConfirm);
        return;
      }
      pointerType.current = 'mouse';
      confirmRef.current = onConfirm; confirm();
    },
  }), [open, scheduleClose, confirm]);

  return { state, bind, close, confirm, cancelClose, scheduleClose, cardRef };
}
