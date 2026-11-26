import { chromium } from 'playwright';
const theme = process.argv[2] || 'sky';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto(`http://localhost:7777/?qa=1&quality=balanced&perf=lock&lang=pt&theme=${theme}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(3000);
const fs = [0.002, 0.12, 0.2, 0.3, 0.45, 0.8];
for (let i = 0; i < fs.length; i++) { await p.evaluate((f) => scrollTo(0, document.documentElement.scrollHeight * f), fs[i]); await p.waitForTimeout(2600); await p.screenshot({ path: `/tmp/claude-0/shots/h2-${theme}-${i}.png`, clip: { x: 0, y: 0, width: 1440, height: 84 } }); }
await b.close();
