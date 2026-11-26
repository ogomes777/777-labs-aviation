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

  // intro de página: CSS puro (global.css) — a classe sai depois para liberar as revelações de scroll
  useEffect(() => {
    const html = document.documentElement;
    if (!mounted) return;
    const t = window.setTimeout(() => html.classList.remove('intro'), cinematic ? 2400 : 0);
    return () => window.clearTimeout(t);
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
            // V28: cabin timeline uses vertical scroll on every device.
            if (i === 3 && frame.fleetSwipe && p > 0 && p < 0.999) p = fleetProgressFor(frame.fleet);
            t += p;
          }
          // V21: trim six additional percentage points into the illuminated studio key.
          // Keep the legacy director's time coordinates for all following chapters.
          const editorial = t;
          t = editorial < 2 - 0.00001 ? editorial : editorial < 3 ? 3.37 + Math.max(0, editorial - 2) * 0.63 : editorial + 1;
          // The preceding opaque globe masks this edit; do not ease through deleted poses.
          if ((frame.t >= 3.37) !== (t >= 3.37)) frame.ts = t;
          frame.t = t;
          { const fp = frame.chapters[3]; const out = fp <= 0 ? 0 : Math.min(1, Math.max(0, (fp - 0.955) / 0.04)); document.documentElement.style.setProperty('--fleet-out', out.toFixed(3)); }
          const order = [0, 1, 2, 4, 5, 6, 3, 7, 8] as const;
          const slot = Math.min(8, Math.floor(t + 0.0001));
          const active = order[slot];
          if (active !== lastChapter) {
            lastChapter = active; ui.set({ activeChapter: active });
            if (active !== 3 && ui.get().inspect) ui.set({ inspect: null, assembled: true, inspectPart: null, inspectSystem: null, fleetXray: false, fleetYaw: 0, fleetPitch: 0, fleetPreview: null });
          }
          const formOver = document.documentElement.dataset.form === 'over';
          const scene = formOver ? 'light' : sceneFor(active + (t - Math.floor(t)));
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
              tl.fromTo(it, { autoAlpha: 0, y: dy, rotationX: 14, rotationY: -6, transformPerspective: 1100, transformOrigin: '50% 100%' }, { autoAlpha: 1, y: 0, rotationX: 0, rotationY: 0, duration: 0.08, ease: 'power2.out' }, a);
              if (split && words.length) tl.fromTo(words, { y: 0, yPercent: 118, rotationX: -78, '--c': 1, transformOrigin: '50% 100%' }, { y: 0, yPercent: 0, rotationX: 0, '--c': 0, duration: 0.07, stagger: 0.006, ease: 'power3.out' }, a + 0.005);
            } else gsap.set(it, { autoAlpha: 1, y: 0 });
            if (b <= 1) {
              if (split && words.length) tl.to(words, { yPercent: -118, rotationX: 70, '--c': 1, duration: 0.05, stagger: 0.004, ease: 'power2.in' }, b - 0.01);
              tl.to(it, { autoAlpha: 0, y: -dy * 0.7, rotationX: -10, transformPerspective: 1100, duration: 0.07, ease: 'power2.in' }, b);
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
          gsap.fromTo(el.querySelectorAll('.wi'), { yPercent: 118, rotationX: -78, '--c': 1, transformOrigin: '50% 100%' }, { yPercent: 0, rotationX: 0, '--c': 0, duration: 1.1, stagger: 0.05, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 75%', toggleActions: 'play none none reverse' } });
        });
        const galCh = document.querySelector<HTMLElement>('[data-chapter="6"]');
        if (gal && vp && galCh) {
          const galleryProgress = (p: number) => {
            const g = clamp((p - .13) / .73) * 3;
            frame.gallery = g;
            const idx = Math.round(g);
            if (idx !== ui.get().galleryIndex) { ui.set({ galleryIndex: idx }); track('gallery_card_view', { index: idx }); }
            galCh.style.setProperty('--sf24-card-alpha', String(1 - clamp((p - .90) / .075)));
            const positions=[.055,.19,.41,.64,.85];
            galCh.querySelectorAll<HTMLElement>('[data-sf27-copy]').forEach((line,i)=>{
              const start=i===0?0:(positions[i-1]+positions[i])/2;
              const end=i===4?.94:(positions[i]+positions[i+1])/2;
              const a=clamp((p-start)/.035)*clamp((end-p)/.035);
              line.style.setProperty('--sf27-alpha',String(a));
              line.style.setProperty('--sf27-y',String((1-clamp((p-start)/.035))*18-(1-clamp((end-p)/.035))*18)+'px');
              line.dataset.visible=a>.003?'true':'false';
            });
            gal.querySelectorAll<HTMLElement>('.card').forEach((card,i)=>{
              const delta=g-i, distance=Math.abs(delta);
              const a=1-clamp((distance-.27)/.46);
              card.style.setProperty('--sf25-alpha',String(a));
              card.style.setProperty('--sf25-y',String(-delta*24)+'px');
              card.style.setProperty('--sf25-scale',String(1-Math.min(.04,distance*.04)));
            });
          };
          ScrollTrigger.create({ trigger: galCh, start:'top top', end:'bottom bottom', onUpdate: self => galleryProgress(self.progress), onRefresh: self => galleryProgress(self.progress) });
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
