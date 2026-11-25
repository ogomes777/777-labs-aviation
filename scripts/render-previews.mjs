// Gera os previews de hover/toque (V6) a partir da PRÓPRIA cena 3D — assets originais, sem material de terceiros.
// Uso: servidor de desenvolvimento rodando (npx next dev -p 7777) e depois:
//   node scripts/render-previews.mjs [fleet|anatomy|all]
// Saída: public/media/previews/{fleet/<id>/<sistema>.png, anatomy/<parte>[__<detalhe>].png} (convertidos para WebP por scripts/png2webp.py)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const BASE = process.env.BASE_URL ?? 'http://localhost:7777';
const which = process.argv[2] ?? 'all';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const OUT = path.resolve('public/media/previews');
const FLEET = process.env.ONLY_IDS ? process.env.ONLY_IDS.split(',') : ['legacy-450', 'praetor-500', 'praetor-600', 'matrix', 'citation-cj2-plus'];
const SYSTEMS = ['fuselagem', 'asas', 'propulsao', 'empenagem', 'trem', 'cabine', 'portas'];
const PARTS = ['fuselagem', 'asas', 'motores', 'empenagem', 'trem', 'cabine'];
const src = fs.readFileSync('src/content/anatomy24.ts', 'utf8');
const DETAILS = [...src.matchAll(/\{id:'([^']+)',group:'([^']+)'/g)].map((m) => ({ id: m[1], group: m[2] }));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 720, height: 450 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
async function shot(file, req) {
  await page.evaluate((r) => window.__preview(r), req);
  const data = await page.evaluate(() => document.querySelector('#lab canvas').toDataURL('image/png'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  console.log('ok', path.relative(process.cwd(), file));
}
async function open(q) {
  await page.goto(`${BASE}/lab/preview?${q}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof window.__preview === 'function' && document.querySelector('#lab canvas'), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
}
if (which === 'all' || which === 'fleet') for (const id of FLEET) {
  await open(`kind=fleet&id=${id}`);
  for (const sys of SYSTEMS.filter((x) => !only || only.includes(x))) await shot(path.join(OUT, 'fleet', id, `${sys}.png`), { kind: 'fleet', id, sys });
}
if (which === 'all' || which === 'anatomy') {
  await open('kind=anatomy');
  for (const part of PARTS) await shot(path.join(OUT, 'anatomy', `${part}.png`), { kind: 'anatomy', part, detail: null });
  for (const d of DETAILS) await shot(path.join(OUT, 'anatomy', `${d.group}__${d.id}.png`), { kind: 'anatomy', part: d.group, detail: d.id });
}
await browser.close();
