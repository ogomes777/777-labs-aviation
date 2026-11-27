'use client';
import { useEffect, useRef } from 'react';
import dots from '@/content/globe-dots.json';

// A restrained, illustrative flight chart. No arrow sprites or radar grid.
type Point = [number, number];
const ROUTES: [Point, Point][] = [
  [[-23.55, -46.63], [25.79, -80.29]],
  [[25.79, -80.29], [40.71, -74.01]],
  [[48.86, 2.35], [25.2, 55.27]],
];
const rad = Math.PI / 180;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
function gc(a: Point, b: Point, t: number): Point {
  const unit = ([lat, lon]: Point) => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
  const u = unit(a), v = unit(b);
  const d = Math.acos(Math.max(-1, Math.min(1, u.reduce((s, n, i) => s + n * v[i], 0)))) || 1e-6;
  const A = Math.sin((1 - t) * d) / Math.sin(d), B = Math.sin(t * d) / Math.sin(d);
  const [x, y, z] = u.map((n, i) => A * n + B * v[i]);
  return [Math.atan2(z, Math.hypot(x, y)) / rad, Math.atan2(y, x) / rad];
}

export default function MenuSky() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const root = document.documentElement;
    const accent = () => (getComputedStyle(root).getPropertyValue('--sf-accent-rgb') || '76,168,255').trim();
    let W = 1, H = 1, dpr = 1, raf = 0, last = -Infinity, tint = accent();
    let staticLayer: HTMLCanvasElement | null = null;
    let paths: Point[][] = [];
    const animated = () => !motion.matches && root.dataset.motion !== 'reduced' && root.dataset.motion !== 'lite';
    const proj = (lat: number, lon: number): Point => {
      const s = Math.max(W / 360, H / 180) * 1.015;
      return [W * .5 + lon * s, H * .49 - (lat - 7) * s];
    };
    // Softly reduce contrast behind navigation labels, not with a visible card.
    const prominence = (x: number, y: number) => {
      const dx = (x - W * .5) / (W * .25), dy = (y - H * .49) / (H * .40);
      return .20 + .80 * clamp((Math.hypot(dx, dy) - .4) / .95);
    };
    function paint(now: number) {
      if (!staticLayer) return;
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, c!.width, c!.height);
      ctx!.drawImage(staticLayer, 0, 0);
      if (!animated()) return;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.lineCap = 'round';
      // A short blue-white gradient travels directly along the cached route.
      // Stagger phases and fade both ends: no popping or detached light dots.
      paths.forEach((p, index) => {
        const phase = ((now / (12500 + index * 2400)) + index * .32) % 1;
        const head = phase * (p.length + 18);
        const endFade = clamp(phase * 12) * clamp((1 - phase) * 9);
        for (let i = Math.max(1, Math.floor(head - 18)); i < Math.min(p.length, Math.ceil(head)); i++) {
          const a = p[i - 1], b = p[i];
          const k = clamp(1 - (head - i) / 18) * endFade * prominence(b[0], b[1]);
          ctx!.beginPath(); ctx!.moveTo(...a); ctx!.lineTo(...b);
          ctx!.strokeStyle = 'rgba(184,224,255,' + (.65 * k) + ')';
          ctx!.lineWidth = 1.25; ctx!.stroke();
        }
      });
    }
    const resize = () => {
      const rect = c.parentElement?.getBoundingClientRect();
      W = Math.max(1, rect?.width || innerWidth); H = Math.max(1, rect?.height || innerHeight);
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      c.style.width = W + 'px'; c.style.height = H + 'px';
      tint = accent();
      staticLayer = document.createElement('canvas');
      staticLayer.width = c.width; staticLayer.height = c.height;
      const g = staticLayer.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = 'rgb(' + tint + ')';
      const radius = W < 600 ? .68 : .82;
      for (const [la, lo] of dots as Point[]) {
        const [x, y] = proj(la, lo);
        if (x < -2 || y < -2 || x > W + 2 || y > H + 2) continue;
        g.globalAlpha = .27 * prominence(x, y);
        g.beginPath(); g.arc(x, y, radius, 0, 2 * Math.PI); g.fill();
      }
      g.globalAlpha = 1;
      paths = ROUTES.map(([a, b]) => Array.from({ length: 97 }, (_, i) => proj(...gc(a, b, i / 96))));
      g.lineWidth = .85; g.lineCap = 'round';
      for (const p of paths) {
        for (let i = 1; i < p.length; i++) {
          const a = p[i - 1], b = p[i];
          g.strokeStyle = 'rgba(' + tint + ',' + (.21 * prominence(b[0], b[1])) + ')';
          g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke();
        }
      }
      paint(performance.now());
    };
    const tick = (now: number) => {
      raf = 0;
      if (!animated() || document.hidden) return;
      if (now - last >= 32) { last = now; paint(now); }
      raf = requestAnimationFrame(tick);
    };
    const refreshMotion = () => {
      cancelAnimationFrame(raf); raf = 0;
      paint(performance.now());
      if (animated() && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const observer = new MutationObserver(() => { resize(); refreshMotion(); });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-motion'] });
    resize(); refreshMotion();
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', refreshMotion);
    motion.addEventListener('change', refreshMotion);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', refreshMotion);
      motion.removeEventListener('change', refreshMotion);
    };
  }, []);
  return <canvas ref={ref} className="sfm__sky" aria-hidden="true" />;
}
