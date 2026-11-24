import { frame } from '@/experience/director';

type LenisLike = { scrollTo: (target: number | HTMLElement, opts?: { immediate?: boolean; duration?: number; force?: boolean }) => void } | null;
export const nav = { lenis: null as LenisLike, veil: null as HTMLElement | null, cinematic: false };

/**
 * Navegação por âncora. No modo cinematográfico faz um corte mascarado por véu pérola (sem voar por todo o filme);
 * nos demais modos rola normalmente. Sempre move o foco para o título do destino (acessibilidade).
 */
export function navigate(hash: string, opts: { focus?: boolean } = {}) {
  const id = hash.replace('#', '');
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY;
  const done = () => {
    history.replaceState(null, '', `#${id}`);
    if (opts.focus !== false) {
      const target = (el.querySelector('[data-focus-target]') as HTMLElement | null) ?? el;
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  };
  if (!nav.cinematic) {
    const reduce = document.documentElement.dataset.motion === 'reduced';
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    done();
    return;
  }
  const veil = nav.veil;
  veil?.setAttribute('data-on', 'true');
  window.setTimeout(() => {
    if (nav.lenis) nav.lenis.scrollTo(top, { immediate: true, force: true });
    else window.scrollTo({ top, behavior: 'auto' });
    window.setTimeout(() => {
      frame.ts = frame.t; // corta a câmera junto com o véu
      veil?.setAttribute('data-on', 'false');
      done();
    }, 90);
  }, 280);
}
