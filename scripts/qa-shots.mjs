// Captura screenshots do filme em tempos-chave. Uso: node scripts/qa-shots.mjs <baseURL> <outDir> [t1,t2,...] [viewports]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { gotoT, waitReady } from './qa-lib.mjs';
const base = process.argv[2] ?? 'http://localhost:3777';
const out = process.argv[3] ?? 'qa/screenshots';
const ts = (process.argv[4] ?? '0,0.5,0.95,1.25,1.5,2.0,2.7,3.6,4.2,4.6,5.0,5.33,5.66,6.0,6.6,7.5').split(',').map(Number);
const vps = (process.argv[5] ?? 'desktop,mobile').split(',');
const VIEW = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const vp of vps) {
  mkdirSync(`${out}/${vp}`, { recursive: true });
  const ctx = await browser.newContext({ viewport: VIEW[vp], deviceScaleFactor: 1, ...(vp === 'mobile' ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/?qa=1&perf=lock&quality=high`, { waitUntil: 'networkidle' });
  await waitReady(page);
  for (const t of ts) {
    await gotoT(page, t);
    await page.screenshot({ path: `${out}/${vp}/t${t.toFixed(2)}.png` });
    process.stdout.write(`${vp} t=${t} ✓\n`);
  }
  if (errors.length) console.log(`${vp} console errors:\n` + errors.slice(0, 10).join('\n'));
  await ctx.close();
}
await browser.close();
