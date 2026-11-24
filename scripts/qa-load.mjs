// Tempo até o H1 visível e até o canvas 3D pronto, em telas comuns e 2K com escala (sem overrides de qualidade).
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:3777';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [name, vp, dsf] of [['1440x900@1', { width: 1440, height: 900 }, 1], ['2560x1440@1.5', { width: 2560, height: 1440 }, 1.5], ['390x844@3', { width: 390, height: 844 }, 3]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dsf });
  const p = await ctx.newPage();
  const t0 = Date.now();
  await p.goto(base + '/?quality=' + (process.argv[3] ?? 'auto'), { waitUntil: 'domcontentloaded' });
  await p.locator('#hero-title').waitFor({ state: 'visible' });
  const h1 = Date.now() - t0;
  let ready = -1;
  try { await p.waitForFunction(() => document.querySelector('.stage')?.dataset.ready === 'true', null, { timeout: 60000 }); ready = Date.now() - t0; } catch {}
  const info = await p.evaluate(() => { const c = document.querySelector('canvas'); return { canvas: c ? `${c.width}x${c.height}` : 'none', motion: document.documentElement.dataset.motion, caps: window.__777caps?.quality }; });
  console.log(name, JSON.stringify({ h1_ms: h1, canvas_ready_ms: ready, ...info }));
  await ctx.close();
}
await b.close();
