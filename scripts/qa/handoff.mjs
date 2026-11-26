import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:7777/?qa=1&quality=balanced&perf=lock&lang=pt', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
const us = [0.98, 0.1, 0.22, 0.34, 0.5, 0.7];
for (let i = 0; i < us.length; i++) {
  await p.evaluate((u) => { const n = document.getElementById('engenharia'); const top = n.getBoundingClientRect().top + scrollY; scrollTo(0, u > 0.9 ? top - innerHeight * 1.6 : top - innerHeight * (1 - u)); }, us[i]);
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `/tmp/claude-0/shots/ho-${i}.png` });
}
await b.close();
