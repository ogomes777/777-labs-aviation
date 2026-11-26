import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto('http://localhost:7777/?qa=1&quality=balanced&perf=lock&lang=pt', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.evaluate(() => { const el = document.getElementById('engenharia'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + (el.offsetHeight - innerHeight) * 0.5); });
await p.waitForTimeout(7000);
const ids = await p.$$eval('.anatomy24-hotspots .hotspot', (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { l: b.getAttribute('aria-label'), x: r.x + r.width / 2, y: r.y + r.height / 2, vis: getComputedStyle(b).display !== 'none' && r.width > 0, top: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.hotspot') === b }; }));
console.log(JSON.stringify(ids));
for (const h of ids) {
  if (!h.vis) continue;
  await p.mouse.move(h.x, h.y); await p.waitForTimeout(900);
  const card = await p.evaluate(() => { const c = document.querySelector('.hp-card'); if (!c) return null; const img = c.querySelector('img'); const r = c.getBoundingClientRect(); return { title: c.querySelector('.hp-card__title')?.textContent, img: img ? { src: img.getAttribute('src'), ok: img.complete && img.naturalWidth > 0 } : 'fallback', x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; });
  console.log(h.l, JSON.stringify(card));
  if (h.l === 'Empenagem') await p.screenshot({ path: '/tmp/claude-0/shots/tail.png' });
  await p.mouse.move(5, 450); await p.waitForTimeout(500);
}
await b.close();
