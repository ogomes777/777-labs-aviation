'use client';
import { useEffect, useRef } from 'react';
import { CONTACT } from '@/content/fleet';
import { fmt, useM } from '@/i18n';
import { T } from '@/i18n/T';
import { track } from '@/lib/analytics';
import { skyWake } from './skyWake';

/** ordem dos cards = ordem de chegada: o jato cruza a tela inteira até o primeiro card */
const ORDER = ['sovereign', 'c90', 'r66'] as const;
type Key = (typeof ORDER)[number];
const IMG: Record<Key, string> = { sovereign: '/media/wanted-sovereign.webp', c90: '/media/wanted-c90.webp', r66: '/media/wanted-r66.webp' };
const ALT: Record<Key, string> = { sovereign: 'Citation Sovereign em voo', c90: 'King Air C90 GTX em voo', r66: 'Robinson R66 em voo' };

/**
 * "Aeronaves que buscamos" (V11): título dividido como em "Fly in / Luxury"; as três aeronaves entram
 * grandes, com rastro de vento, atravessam o céu mexendo as nuvens e pousam no topo do próprio card.
 * Trajetórias em curvas de Bézier calculadas a cada quadro a partir da posição real de cada card
 * (o pouso acompanha o layout em qualquer tela). Só transform/opacity (composição na GPU).
 */
export default function WantedFlight() {
  const m = useM();
  const sec = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = sec.current; if (!root) return;
    const section = root.closest<HTMLElement>('#procuramos')!;
    const stage = root.querySelector<HTMLElement>('.sf-wf__stage')!;
    const finale = root.closest<HTMLElement>('.finale');
    skyWake.planes = ORDER.map(() => ({ x: 0, y: 0, r: 0, on: 0, vx: 0, vy: 0 }));
    const planes = ORDER.map((k) => ({
      k,
      el: root.querySelector<HTMLElement>(`.sf-plane[data-k="${k}"]`)!,
      img: root.querySelector<HTMLImageElement>(`.sf-plane[data-k="${k}"] img`)!,
      trail: root.querySelector<HTMLElement>(`.sf-plane[data-k="${k}"] .sf-plane__trail`)!,
      slot: root.querySelector<HTMLElement>(`.sf-wcard[data-k="${k}"] .sf-wcard__slot`)!,
    }));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = (x: number) => Math.min(1, Math.max(0, x));
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
    const bez = (a: number, b: number, c: number, d: number, t: number) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
    const dbez = (a: number, b: number, c: number, d: number, t: number) => { const u = 1 - t; return 3 * u * u * (b - a) + 6 * u * t * (c - b) + 3 * t * t * (d - c); };
    // janelas de tempo (fração do percurso da seção) e trajetórias em frações da tela
    const plan: Record<Key, { t0: number; t1: number; w0: number; p: [number, number][] }> = {
      sovereign: { t0: 0.06, t1: 0.58, w0: 0.92, p: [[0.62, 1.35], [0.5, 0.42], [0.36, -0.12]] },
      c90: { t0: 0.2, t1: 0.68, w0: 0.62, p: [[1.3, 0.92], [0.92, 0.42], [0.64, 0.18]] },
      r66: { t0: 0.3, t1: 0.76, w0: 0.5, p: [[1.25, 0.08], [1.05, 0.22], [0.86, 0.38]] },
    };
    let raf = 0, visible = false;
    const draw = () => {
      raf = 0;
      const vh = innerHeight, r = section.getBoundingClientRect();
      const span = Math.max(1, r.height - vh);
      const p = reduced.matches ? 1 : clamp(-r.top / span);
      const sr = stage.getBoundingClientRect();
      const W = sr.width, H = sr.height;
      root.style.setProperty('--fp', p.toFixed(4));
      root.style.setProperty('--title-in', smooth(0, 0.2, p).toFixed(4));
      root.style.setProperty('--cards-in', smooth(0.46, 0.72, p).toFixed(4));
      let wakeX = 0, wake = 0;
      for (const pl of planes) {
        const cfg = plan[pl.k];
        const t = ease(clamp((p - cfg.t0) / (cfg.t1 - cfg.t0)));
        const sb = pl.slot.getBoundingClientRect();
        // pouso: a aeronave cabe no espaço acima do card (largura limitada pela altura) e assenta na base dele
        const arL = (pl.img.naturalHeight || 600) / (pl.img.naturalWidth || 1100);
        const ew = Math.min(sb.width * 0.9, sb.height / arL), ex = sb.left - sr.left + sb.width / 2, ey = sb.bottom - sr.top - (ew * arL) / 2 - 2;
        const xs = [cfg.p[0][0] * W, cfg.p[1][0] * W, cfg.p[2][0] * W, ex];
        const ys = [cfg.p[0][1] * H, cfg.p[1][1] * H, cfg.p[2][1] * H, ey];
        const x = bez(xs[0], xs[1], xs[2], xs[3], t), y = bez(ys[0], ys[1], ys[2], ys[3], t);
        const w = cfg.w0 * W + (ew - cfg.w0 * W) * smooth(0.25, 1, t);
        const dx = dbez(xs[0], xs[1], xs[2], xs[3], t), dy = dbez(ys[0], ys[1], ys[2], ys[3], t);
        const flying = t > 0 && t < 1 ? 1 - smooth(0.82, 1, t) : 0;
        const ang = Math.atan2(dy, dx);
        // inclinação sutil na direção do voo (as fotos são 3/4 — nada de girar a imagem demais)
        const tilt = Math.max(-10, Math.min(10, (dy / (Math.abs(dx) + Math.abs(dy) + 1)) * 9)) * flying;
        // tamanho fixo de 1000 px escalado por transform (sem relayout a cada quadro)
        const ar = (pl.img.naturalHeight || 600) / (pl.img.naturalWidth || 1100), hEl = 1000 * ar, sc = w / 1000;
        pl.el.style.transform = `translate3d(${(x - 500).toFixed(1)}px, ${(y - hEl / 2).toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
        pl.el.style.opacity = t <= 0 ? '0' : String(Math.min(1, t * 6));
        pl.el.dataset.landed = t >= 1 ? 'true' : 'false';
        // rastro de vento: atrás da aeronave, alinhado ao movimento, some ao pousar
        pl.trail.style.opacity = (flying * 0.9).toFixed(3);
        pl.trail.style.transform = `translateY(-50%) rotate(${(ang * 180 / Math.PI + 180 - tilt).toFixed(1)}deg)`;
        // o céu vivo lê isto: a aeronave empurra e abre as nuvens por onde passa
        const wk = skyWake.planes[ORDER.indexOf(pl.k)];
        wk.x = sr.left + x; wk.y = sr.top + y; wk.r = w * 0.17; wk.on = t > 0 && t < 1 ? Math.max(0.15, flying) : 0; wk.vx = dx; wk.vy = dy;
        wakeX += dx * flying * 0.00012 * (pl.k === 'sovereign' ? 1.6 : 1); wake = Math.max(wake, flying);
      }
      // as nuvens reagem à passagem das aeronaves
      if (finale) { finale.style.setProperty('--wake', wake.toFixed(3)); finale.style.setProperty('--wake-x', `${(wakeX * 40).toFixed(1)}px`); }
    };
    const queue = () => { if (!raf && visible) raf = requestAnimationFrame(draw); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) queue(); }, { rootMargin: '30% 0px' });
    io.observe(section);
    addEventListener('scroll', queue, { passive: true }); addEventListener('resize', queue);
    planes.forEach((pl) => { if (!pl.img.complete) pl.img.addEventListener('load', queue, { once: true }); });
    visible = true; draw();
    return () => { skyWake.planes = []; io.disconnect(); cancelAnimationFrame(raf); removeEventListener('scroll', queue); removeEventListener('resize', queue); };
  }, []);

  return (
    <div ref={sec} className="sf-wf">
      <div className="sf-wf__stage">
        {/* título editorial: "Aeronaves que" / [linha menor] "buscamos." */}
        <div className="sf-wf__head">
          <h2 id="procuramos-title" className="sf-wf__title" data-focus-target>
            <span className="sf-wf__l"><T k="wanted.t1" /></span>
            <span className="sf-wf__r"><T k="wanted.t2" /></span>
          </h2>
          <p className="sf-wf__lede"><T k="wanted.lede" /></p>
        </div>
        <ul className="sf-wf__cards">
          {ORDER.map((k) => {
            const it = m.wanted.items[k];
            const href = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(fmt(m.wanted.waText, { name: it.name }))}`;
            return (
              <li key={k} className="sf-wcard" data-k={k}>
                <span className="sf-wcard__slot" aria-hidden="true" />
                <span className="sf-wcard__kind">{it.kind}</span>
                <h3>{it.name}</h3>
                <p className="sf-wcard__line">{it.line}</p>
                <p className="sf-wcard__note">{it.note}</p>
                <a className="sf-glassbtn" href={href} target="_blank" rel="noopener noreferrer" onClick={() => track('wanted_click', { model: k })}>{m.wanted.cta}</a>
              </li>
            );
          })}
        </ul>
        {ORDER.map((k) => (
          <div key={k} className="sf-plane" data-k={k} aria-hidden="true">
            <span className="sf-plane__trail" />
            <span className="sf-plane__body"><img src={IMG[k]} alt={ALT[k]} decoding="async" loading="lazy" draggable={false} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}
