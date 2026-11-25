import { frame } from '@/experience/director';

type LenisLike = { scrollTo: (target: number | HTMLElement, opts?: { immediate?: boolean; duration?: number; force?: boolean }) => void } | null;
export const nav = { lenis: null as LenisLike, veil: null as HTMLElement | null, cinematic: false };

/**
 * Navegação por âncora. No modo cinematográfico faz um corte mascarado por véu pérola (sem voar por todo o filme);
 * nos demais modos rola normalmente. Sempre move o foco para o título do destino (acessibilidade).
 */
export function navigate(hash: string, opts: { focus?: boolean } = {}) {
  const id = hash.replace('#', '');
  const el = document.getElementById(id === 'aeronave' ? 'engenharia' : id);
  if (!el) return;
  // capítulos com revelação por scroll: entra 14% adiante, quando o conteúdo já está visível
  const isChapter = el.classList.contains('chapter') && document.documentElement.dataset.motion === 'cinematic';
  const range = el.offsetHeight - window.innerHeight;
  const top = el.getBoundingClientRect().top + window.scrollY + (isChapter && el.id !== 'top' ? Math.max(0, range * 0.14) : 0);
  const done = () => {
    history.replaceState(null, '', `#${id}`);
    if (opts.focus !== false) {
      const target = (el.querySelector('[data-focus-target]') as HTMLElement | null) ?? el;
      const focusIt = (tries = 0) => {
        const visible = (target as HTMLElement & { checkVisibility?: (o?: object) => boolean }).checkVisibility?.({ visibilityProperty: true, opacityProperty: false }) ?? true;
        if (!visible && tries < 12) { window.setTimeout(() => focusIt(tries + 1), 120); return; }
        const t = visible ? target : el;
        t.setAttribute('tabindex', '-1');
        t.focus({ preventScroll: true });
      };
      focusIt();
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
