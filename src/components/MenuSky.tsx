'use client';
import { useEffect, useRef } from 'react';
import dots from '@/content/globe-dots.json';

/**
 * Fundo do menu: carta de navegação aérea viva — mapa-múndi em pontos (projeção equiretangular),
 * rotas de grande círculo acendendo a partir do Brasil e dos EUA, jatos minúsculos voando nelas e
 * uma varredura de radar. Canvas 2D único, só existe com o menu aberto; com movimento reduzido fica estático.
 */
const HUBS: [number, number][] = [[-23.55, -46.63], [25.79, -80.29]]; // São Paulo, Miami
const DEST: [number, number][] = [[40.71, -74.01], [38.72, -9.14], [48.86, 2.35], [25.2, 55.27], [-33.45, -70.67], [19.43, -99.13], [51.47, -0.45], [-22.9, -43.2], [4.71, -74.07], [35.68, 139.69], [33.94, -118.4], [41.9, 12.5]];
const rad = Math.PI / 180;
function gc(a: [number, number], b: [number, number], t: number): [number, number] {
  const [la1, lo1] = [a[0] * rad, a[1] * rad], [la2, lo2] = [b[0] * rad, b[1] * rad];
  const v1 = [Math.cos(la1) * Math.cos(lo1), Math.cos(la1) * Math.sin(lo1), Math.sin(la1)], v2 = [Math.cos(la2) * Math.cos(lo2), Math.cos(la2) * Math.sin(lo2), Math.sin(la2)];
  const d = Math.acos(Math.min(1, Math.max(-1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]))) || 1e-6;
  const A = Math.sin((1 - t) * d) / Math.sin(d), B = Math.sin(t * d) / Math.sin(d);
  const x = A * v1[0] + B * v2[0], y = A * v1[1] + B * v2[1], z = A * v1[2] + B * v2[2];
  return [Math.atan2(z, Math.hypot(x, y)) / rad, Math.atan2(y, x) / rad];
}

export default function MenuSky() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const accent = (getComputedStyle(document.documentElement).getPropertyValue('--sf-accent-rgb') || '76,168,255').trim();
    const routes = DEST.map((d, i) => ({ a: HUBS[i % 2], b: d, off: (i * 0.137) % 1, speed: 0.035 + (i % 5) * 0.006 }));
    let W = 0, H = 0, dpr = 1, raf = 0, land: HTMLCanvasElement | null = null;
    const proj = (lat: number, lon: number): [number, number] => {
      const s = Math.max(W / 360, H / 170) * 1.05;
      return [W / 2 + (lon + 20) * s, H * 0.5 - (lat - 8) * s];
    };
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 1.75); W = innerWidth; H = innerHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = `${W}px`; c.style.height = `${H}px`;
      // continentes pré-desenhados uma vez (o loop só desenha rotas e jatos)
      land = document.createElement('canvas'); land.width = c.width; land.height = c.height;
      const g = land.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = `rgba(${accent},0.42)`;
      for (const [la, lo] of dots as [number, number][]) { const [x, y] = proj(la, lo); g.beginPath(); g.arc(x, y, 1.05, 0, Math.PI * 2); g.fill(); }
      // meridianos e paralelos
      g.strokeStyle = 'rgba(255,255,255,0.045)'; g.lineWidth = 1;
      for (let lo = -180; lo <= 180; lo += 30) { const [x0, y0] = proj(80, lo), [x1, y1] = proj(-70, lo); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
      for (let la = -60; la <= 75; la += 15) { const [x0, y0] = proj(la, -180), [x1, y1] = proj(la, 180); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    };
    const draw = (now: number) => {
      const T = now / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
      if (land) ctx.drawImage(land, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const r of routes) {
        const p = reduced ? 0.6 : (T * r.speed + r.off) % 1;
        const N = 64; ctx.beginPath();
        for (let i = 0; i <= N; i++) { const [la, lo] = gc(r.a, r.b, i / N); const [x, y] = proj(la, lo); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = `rgba(${accent},0.16)`; ctx.lineWidth = 1; ctx.stroke();
        // rastro luminoso atrás do jato
        ctx.beginPath(); const tail = 0.22;
        for (let i = 0; i <= 24; i++) { const t = Math.max(0, p - tail + (tail * i) / 24); const [la, lo] = gc(r.a, r.b, t); const [x, y] = proj(la, lo); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        const [hx, hy] = proj(...gc(r.a, r.b, p)), [tx, ty] = proj(...gc(r.a, r.b, Math.max(0, p - tail)));
        const gr = ctx.createLinearGradient(tx, ty, hx, hy); gr.addColorStop(0, `rgba(${accent},0)`); gr.addColorStop(1, 'rgba(235,245,255,0.9)');
        ctx.strokeStyle = gr; ctx.lineWidth = 1.6; ctx.stroke();
        // jato (seta de asa delta) orientado pela rota
        const [nx, ny] = proj(...gc(r.a, r.b, Math.min(1, p + 0.004)));
        const ang = Math.atan2(ny - hy, nx - hx);
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang); ctx.fillStyle = '#f3f8ff'; ctx.shadowColor = `rgba(${accent},0.9)`; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4.2); ctx.lineTo(-1.6, 0); ctx.lineTo(-4, 4.2); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      // hubs pulsando
      for (const h of HUBS) { const [x, y] = proj(h[0], h[1]); const k = reduced ? 0.5 : (T * 0.6) % 1; ctx.beginPath(); ctx.arc(x, y, 3 + k * 16, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${accent},${0.6 * (1 - k)})`; ctx.lineWidth = 1.2; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    resize(); addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="sfm__sky" aria-hidden="true" />;
}
