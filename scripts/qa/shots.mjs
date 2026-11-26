import { chromium } from 'playwright';
const [,, url, out, ...fr] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
p.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text().slice(0,200)); });
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
const H = await p.evaluate(() => document.documentElement.scrollHeight);
console.log('H', H);
for (const f of fr) {
  const y = Math.round(H * parseFloat(f));
  await p.evaluate(y => window.scrollTo(0, y), y);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${out}-${f}.png` });
}
await b.close();
