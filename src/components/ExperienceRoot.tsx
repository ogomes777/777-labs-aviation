'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { frame, ui, clamp, formBridge, fleetDwell, fleetProgressFor } from '@/experience/director';
import { detectCapabilities } from '@/experience/quality';
import { domRefs } from '@/experience/domRefs';
import { nav } from './navigation';
import { track } from '@/lib/analytics';

const Experience = dynamic(() => import('@/three/Experience'), { ssr: false });

/** Tema do header/cor do texto por posição do filme. */
function sceneFor(t: number): 'light' | 'dark' {
  if (t < 1.68) return 'light';
  if (t < 4.0) return 'dark';
  if (t < 5.58) return 'light';
  if (t < 8.0) return 'dark';
  return 'light';
}

export default function ExperienceRoot() {
  const quality = ui.useStore((s) => s.quality);
  const motion = ui.useStore((s) => s.motion);
  const webgl = ui.useStore((s) => s.webgl);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const navVeilRef = useRef<HTMLDivElement>(null);

  // capacidades
  useEffect(() => {
    const caps = detectCapabilities();
    ui.set({ quality: caps.quality, motion: caps.motion, webgl: caps.webgl });
    document.documentElement.dataset.motion = caps.motion;
    document.documentElement.dataset.quality = caps.quality;
    (window as unknown as { __777caps: unknown }).__777caps = caps;
    if (new URLSearchParams(location.search).has('qa')) (window as unknown as { __777: unknown }).__777 = { frame, ui, formBridge };
    setMounted(true);
    track('hero_view', { quality: caps.quality, motion: caps.motion });
  }, []);
  useEffect(() => { document.documentElement.dataset.motion = motion; }, [motion]);

  const cinematic = mounted && motion === 'cinematic' && webgl && quality !== 'lite';
  useEffect(() => { nav.cinematic = cinematic; nav.veil = navVeilRef.current; domRefs.veil = veilRef.current; domRefs.route = document.getElementById('route-path') as SVGPathElement | null; }, [cinematic]);

  // intro de página: título sobe palavra a palavra, CTAs e header entram em seguida
  useEffect(() => {
    const html = document.documentElement;
    if (!mounted) return;
    if (!cinematic) { html.classList.remove('intro'); return; }
    let killed = false;
    import('gsap').then(({ gsap }) => {
      if (killed) return;
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, onComplete: () => html.classList.remove('intro') });
      tl.fromTo('[data-intro] .wi', { y: 0, yPercent: 115, rotate: 3 }, { y: 0, yPercent: 0, rotate: 0, duration: 1.3, stagger: 0.06 }, 0.15)
        .fromTo('[data-intro-fade]', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.12 }, 0.7)
        .fromTo('.site-header', { autoAlpha: 0, y: -16 }, { autoAlpha: 1, y: 0, duration: 1 }, 0.5);
      html.classList.add('intro-running');
    });
    return () => { killed = true; };
  }, [mounted, cinematic]);

  // ponteiro (parallax sutil)
  useEffect(() => {
    if (!cinematic) return;
    const onMove = (e: PointerEvent) => { if (e.pointerType !== 'mouse') return; frame.px = (e.clientX / innerWidth) * 2 - 1; frame.py = -((e.clientY / innerHeight) * 2 - 1); };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [cinematic]);

  // ScrollDirector: GSAP ScrollTrigger (+ Lenis opcional sincronizado ao ticker)
  useEffect(() => {
    if (!cinematic) return;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const [{ gsap }, { ScrollTrigger }, LenisMod] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('lenis')]);
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });
      const fine = matchMedia('(pointer: fine)').matches && innerWidth > 1024;
      let lenis: InstanceType<typeof LenisMod.default> | null = null;
      const tick = (time: number) => lenis?.raf(time * 1000);
      if (fine) {
        lenis = new LenisMod.default({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 0.9 });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        nav.lenis = lenis as unknown as typeof nav.lenis;
      }
      const ctx = gsap.context(() => {
        const chapters = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter]'));
        let lastScene = '';
        let lastChapter = -1;
        const recompute = () => {
          let t = 0;
          for (let i = 0; i < 9; i++) {
            let p = frame.chapters[i];
            if (i === 6 && frame.gallerySwipe && p > 0 && p < 0.999) p = clamp(frame.gallery / 3);
            if (i === 3 && frame.fleetSwipe && p > 0 && p < 0.999) p = fleetProgressFor(frame.fleet);
            t += p;
          }
          frame.t = t;
          const active = Math.min(8, Math.floor(t + 0.0001));
          if (active !== lastChapter) {
            lastChapter = active; ui.set({ activeChapter: active });
            if (active !== 3 && ui.get().inspect) ui.set({ inspect: null, assembled: true, inspectPart: null });
          }
          const formOver = document.documentElement.dataset.form === 'over';
          const scene = formOver ? 'light' : sceneFor(t);
          if (scene !== lastScene) { lastScene = scene; document.documentElement.dataset.scene = scene; }
        };
        (window as unknown as { __777recompute: () => void }).__777recompute = recompute;
        chapters.forEach((el) => {
          const i = Number(el.dataset.chapter);
          const start = i === 8 ? 'top bottom' : 'top top';
          ScrollTrigger.create({ trigger: el, start, end: 'bottom bottom', onUpdate: (s) => { frame.chapters[i] = s.progress; recompute(); }, onRefresh: (s) => { frame.chapters[i] = s.progress; recompute(); } });
          // revelações de texto ligadas ao mesmo progresso (reversíveis)
          const items = Array.from(el.querySelectorAll<HTMLElement>('[data-in], [data-out]'));
          if (!items.length) return;
          const tl = gsap.timeline({ scrollTrigger: { trigger: el, start, end: 'bottom bottom', scrub: 0.6 } });
          items.forEach((it) => {
            const a = it.dataset.in !== undefined ? Number(it.dataset.in) : -1;
            const b = it.dataset.out !== undefined ? Number(it.dataset.out) : 2;
            const dy = Number(it.dataset.y ?? 36);
            const words = it.querySelectorAll('[data-split] .wi, .wi');
            const split = !it.hasAttribute('data-intro') && (it.hasAttribute('data-split') || it.querySelector('[data-split]'));
            if (a > 0) {
              tl.fromTo(it, { autoAlpha: 0, y: dy }, { autoAlpha: 1, y: 0, duration: 0.07, ease: 'power2.out' }, a);
              if (split && words.length) tl.fromTo(words, { y: 0, yPercent: 118, rotate: 4 }, { y: 0, yPercent: 0, rotate: 0, duration: 0.06, stagger: 0.006, ease: 'power3.out' }, a + 0.005);
            } else gsap.set(it, { autoAlpha: 1, y: 0 });
            if (b <= 1) {
              if (split && words.length) tl.to(words, { yPercent: -118, duration: 0.05, stagger: 0.004, ease: 'power2.in' }, b - 0.01);
              tl.to(it, { autoAlpha: 0, y: -dy * 0.7, duration: 0.07, ease: 'power2.in' }, b);
            }
          });
          tl.set({}, {}, 1);
        });
        // galeria horizontal (desktop): faixa ligada ao progresso do capítulo
        const gal = document.querySelector<HTMLElement>('[data-gallery-track]');
        const vp = document.querySelector<HTMLElement>('[data-gallery-viewport]');
        // frota horizontal (desktop): faixa sincronizada com a mesma permanência da câmera
        const fTrack = document.querySelector<HTMLElement>('[data-fleet-track]');
        const fCh = document.querySelector<HTMLElement>('[data-chapter="3"]');
        if (fTrack && fCh && !frame.fleetSwipe) {
          ScrollTrigger.create({ trigger: fCh, start: 'top top', end: 'bottom bottom', onUpdate: (s) => {
            const idx = fleetDwell(s.progress);
            const card = fTrack.querySelector<HTMLElement>('.fcard');
            const step = card ? card.offsetWidth + parseFloat(getComputedStyle(fTrack).columnGap || '24') : 380;
            gsap.set(fTrack, { x: -idx * step });
            const r = Math.round(idx);
            if (r !== ui.get().fleetIndex) ui.set({ fleetIndex: r });
          } });
        }
        // contato: revelação por entrada (sem scrub)
        document.querySelectorAll<HTMLElement>('.reveal-soft').forEach((el) => {
          gsap.fromTo(el.querySelectorAll('.wi'), { yPercent: 118 }, { yPercent: 0, duration: 1.1, stagger: 0.05, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 75%', toggleActions: 'play none none reverse' } });
        });
        const galCh = document.querySelector<HTMLElement>('[data-chapter="6"]');
        if (gal && vp && galCh && !frame.gallerySwipe) {
          gsap.to(gal, {
            x: () => -(gal.scrollWidth - vp.clientWidth + parseFloat(getComputedStyle(vp).paddingLeft) * 2),
            ease: 'none',
            scrollTrigger: { trigger: galCh, start: 'top top', end: 'bottom bottom', scrub: 0.5, invalidateOnRefresh: true,
              onUpdate: (s) => { frame.gallery = s.progress * 3; const idx = Math.round(s.progress * 3); if (idx !== ui.get().galleryIndex) { ui.set({ galleryIndex: idx }); track('gallery_card_view', { index: idx }); } } },
          });
        }
        recompute();
      });
      const onLoad = () => ScrollTrigger.refresh();
      document.fonts?.ready.then(onLoad);
      window.addEventListener('load', onLoad);
      // retorno do navegador / recarga no meio da página
      requestAnimationFrame(() => { ScrollTrigger.refresh(); frame.ts = frame.t; });
      cleanup = () => {
        window.removeEventListener('load', onLoad);
        ctx.revert();
        if (lenis) { gsap.ticker.remove(tick); lenis.destroy(); nav.lenis = null; }
      };
    })();
    return () => { disposed = true; cleanup(); };
  }, [cinematic]);

  // formulário cobrindo o header → tema claro; pausa o canvas quando totalmente coberto
  useEffect(() => {
    const form = document.getElementById('planejar');
    if (!form) return;
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        const r = e.boundingClientRect;
        const over = r.top < 70 && r.bottom > 70;
        document.documentElement.dataset.form = over ? 'over' : 'off';
        if (over) document.documentElement.dataset.scene = 'light';
        frame.hidden = r.top <= 0 && r.bottom >= innerHeight;
        (window as unknown as { __777recompute?: () => void }).__777recompute?.();
      }
    }, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) });
    io.observe(form);
    return () => io.disconnect();
  }, []);

  const onReady = useCallback(() => { setReady(true); ui.set({ canvasReady: true }); }, []);

  return (
    <>
      <div ref={stageRef} className="stage" data-ready={ready ? 'true' : 'false'} aria-hidden="true">
        <picture className="stage__poster">
          <source media="(max-aspect-ratio: 4/5)" srcSet="/media/poster-mobile.avif" type="image/avif" />
          <source media="(max-aspect-ratio: 4/5)" srcSet="/media/poster-mobile.webp" type="image/webp" />
          <source srcSet="/media/poster-desktop.avif" type="image/avif" />
          <img src="/media/poster-desktop.webp" alt="" fetchPriority="high" decoding="async" />
        </picture>
        {cinematic && <Experience quality={quality === 'high' ? 'high' : 'balanced'} onReady={onReady} />}
        <div ref={veilRef} className="stage__veil" />
        <div className="stage__vignette" />
        <div className="stage__grain" />
      </div>
      <div ref={navVeilRef} className="nav-veil" aria-hidden="true" />
    </>
  );
}
