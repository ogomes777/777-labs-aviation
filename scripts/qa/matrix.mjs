import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:7777/?qa=1&quality=balanced&perf=lock&lang=pt#frota', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
await p.evaluate(() => { const el = document.getElementById('frota'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + (el.offsetHeight - innerHeight) * 0.06); });
await p.waitForTimeout(8000);
for (let i = 0; i < 3; i++) { await p.evaluate(() => document.querySelectorAll('.fleet__nav .textbtn')[1].click()); await p.waitForTimeout(3000); }
for (let i = 0; i < 30; i++) { await p.waitForTimeout(1500); const h = await p.evaluate(() => window.__777hot); if (h && h.hotStill > 0.5) break; }
await p.screenshot({ path: '/tmp/claude-0/shots/mx-hangar.png' });
await b.close();
