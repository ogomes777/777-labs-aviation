// Captura rápida de quadros do canvas (UI oculta opcional) para direção de fotografia.
// Uso: node scripts/qa-frame.mjs <outPrefix> <t1,t2,...> [w] [h] [ui=0|1] [extraQuery]
import { chromium } from 'playwright';
import { gotoT, waitReady } from './qa-lib.mjs';
const [prefix, tsArg, w = '1440', h = '900', ui = '0', extra = ''] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const mobile = Number(w) < 600;
const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) }, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto(`http://localhost:3777/?qa=1&perf=lock&quality=high${extra}`, { waitUntil: 'networkidle' });
await waitReady(p);
if (ui === '0') await p.addStyleTag({ content: 'main,header,.rail,.stage__grain,.stage__vignette{visibility:hidden!important}' });
for (const t of tsArg.split(',').map(Number)) {
  await gotoT(p, t, { settle: 2200 });
  await p.screenshot({ path: `${prefix}-t${t.toFixed(2)}.png` });
  console.log('shot', t);
}
await b.close();
