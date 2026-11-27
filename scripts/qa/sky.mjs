import { chromium } from 'playwright';
// QA do final em céu: transição do hangar, abertura das nuvens, voo das aeronaves e pouso nos cards
const out = process.argv[2] || '/tmp/claude-0/shots/sky';
const vp = process.argv[3] === 'm' ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 };
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://localhost:7777/?quality=balanced&perf=lock&lang=pt#frota', { waitUntil: 'networkidle' });
await p.waitForTimeout(5000);
const fin = await p.evaluate(() => document.querySelector('.finale').getBoundingClientRect().top + scrollY);
const wanted = await p.evaluate(() => { const s = document.getElementById('procuramos'); return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight }; });
const H = vp.height;
const shots = [['0hangar-end', fin - H * 1.0], ['1bank', fin - H * 0.55], ['2cover', fin - H * 0.1], ['3open', fin + H * 0.5]];
for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.95]) shots.push([`4fly-${Math.round(f * 100)}`, wanted.top + (wanted.h - H) * f]);
shots.push(['5contact', wanted.top + wanted.h - H * 0.2]);
for (const [n, y] of shots) {
  await p.evaluate((yy) => { window.scrollTo(0, yy); window.dispatchEvent(new Event('scroll')); }, Math.max(0, y));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}-${n}.png` });
}
console.log('ok');
await b.close();
