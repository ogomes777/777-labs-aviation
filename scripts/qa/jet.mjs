import { chromium } from 'playwright';
// QA do contato + rodapé: turbina sobe, nuvem, giro, troca de cor, descida; nariz entra; rodapé
const out = process.argv[2] || '/tmp/claude-0/shots/jet';
const vp = process.argv[3] === 'm' ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 };
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://localhost:7777/?quality=balanced&perf=lock&lang=pt#procuramos', { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);
const s = await p.evaluate(() => { const e = document.getElementById('planejar'); return { top: e.getBoundingClientRect().top + scrollY, h: e.offsetHeight }; });
const H = vp.height;
for (const f of [0.1, 0.2, 0.28, 0.38, 0.48, 0.58, 0.66, 0.76, 0.86, 1]) {
  // p = (vh - top)/h  →  scrollY = s.top + p*h - vh
  await p.evaluate((yy) => { window.scrollTo(0, yy); window.dispatchEvent(new Event('scroll')); }, Math.max(0, s.top + f * s.h - H));
  await p.waitForTimeout(1300);
  await p.screenshot({ path: `${out}-${String(Math.round(f * 100)).padStart(3, '0')}.png` });
}
console.log('ok');
await b.close();
