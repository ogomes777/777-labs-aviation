// Vistas de verificação (lateral/superior/frontal/3-4) de cada aeronave da frota, para comparação com referências.
// Uso: node scripts/render-views.mjs <saida> [id,...]
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const out = process.argv[2] ?? 'qa/v6/views'; const ids = (process.argv[3] ?? 'legacy-450,praetor-500,praetor-600,matrix,citation-cj2-plus').split(',');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 520 } });
fs.mkdirSync(out, { recursive: true });
for (const id of ids) {
  await page.goto(`http://localhost:7777/lab/preview?kind=fleet&id=${id}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof window.__preview === 'function' && document.querySelector('#lab canvas'), null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  for (const view of ['side', 'top', 'front', 'three4']) {
    await page.evaluate((r) => window.__preview(r), { kind: 'fleet', id, sys: 'fuselagem', view });
    const data = await page.evaluate(() => document.querySelector('#lab canvas').toDataURL('image/png'));
    fs.writeFileSync(path.join(out, `${id}-${view}.png`), Buffer.from(data.split(',')[1], 'base64'));
    console.log('ok', id, view);
  }
}
await browser.close();
