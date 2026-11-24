// Mede LCP, CLS, INP aproximado (Event Timing) e long tasks em 1440×900 e 390×844, nos modos cinemático e leve.
// Ambiente de medição: Chromium headless + SwiftShader (GPU emulada em CPU) — números de GPU NÃO representam hardware real.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:3777';
const runs = [
  { name: 'desktop-cinematic', vp: { width: 1440, height: 900 }, q: '?quality=high&perf=lock' },
  { name: 'desktop-lite', vp: { width: 1440, height: 900 }, q: '?webgl=0' },
  { name: 'mobile-cinematic', vp: { width: 390, height: 844 }, q: '?quality=balanced', mobile: true },
  { name: 'mobile-reduced', vp: { width: 390, height: 844 }, q: '?motion=reduced', mobile: true },
];
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const out = {};
for (const r of runs) {
  const ctx = await b.newContext({ viewport: r.vp, ...(r.mobile ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    window.__v = { lcp: 0, cls: 0, inp: 0, long: 0, longMax: 0 };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__v.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__v.inp = Math.max(window.__v.inp, e.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__v.long += 1; window.__v.longMax = Math.max(window.__v.longMax, e.duration); } }).observe({ type: 'longtask', buffered: true });
  });
  const t0 = Date.now();
  await p.goto(base + '/' + r.q, { waitUntil: 'load' });
  await p.waitForTimeout(4000);
  // interação real: abre e fecha preferências / navega para contato
  await p.locator('#f-from').scrollIntoViewIfNeeded().catch(() => {});
  await p.locator('#f-from').click().catch(() => {});
  await p.keyboard.type('São Paulo');
  await p.waitForTimeout(800);
  const v = await p.evaluate(() => window.__v);
  const ttfb = await p.evaluate(() => performance.getEntriesByType('navigation')[0].responseStart);
  out[r.name] = { lcp_ms: Math.round(v.lcp), cls: Number(v.cls.toFixed(4)), inp_approx_ms: Math.round(v.inp), long_tasks: v.long, long_task_max_ms: Math.round(v.longMax), ttfb_ms: Math.round(ttfb), wall_ms: Date.now() - t0 };
  console.log(r.name, out[r.name]);
  await ctx.close();
}
mkdirSync('qa/performance', { recursive: true });
writeFileSync('qa/performance/vitals.json', JSON.stringify({ measuredAt: new Date().toISOString(), environment: 'Chromium headless + SwiftShader (software GL), localhost next start', results: out }, null, 2));
await b.close();
