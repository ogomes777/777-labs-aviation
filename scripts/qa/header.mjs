import { chromium } from 'playwright';
const theme = process.argv[2] || 'sky';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto(`http://localhost:7777/?qa=1&quality=balanced&perf=lock&lang=pt&theme=${theme}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(3000);
for (const [i, f] of [[0, 0.002], [1, 0.3]]) { await p.evaluate((f) => scrollTo(0, document.documentElement.scrollHeight * f), f); await p.waitForTimeout(2500); await p.screenshot({ path: `/tmp/claude-0/shots/hd-${theme}-${i}.png`, clip: { x: 80, y: 0, width: 1280, height: 90 } }); }
await p.getByRole('button', { name: 'Menu' }).click(); await p.waitForTimeout(1200);
await p.locator('.sfm__nav a').nth(1).hover(); await p.waitForTimeout(900);
await p.screenshot({ path: `/tmp/claude-0/shots/menu-${theme}.png`, scale: 'css' });
await b.close();
