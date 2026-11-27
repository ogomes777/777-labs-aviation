import { chromium } from 'playwright';
// custo (ms) dos trabalhos pesados de JavaScript na thread principal
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:7777/?qa=1&quality=balanced&lang=pt', { waitUntil: 'networkidle' });
await p.waitForTimeout(3000);
await p.evaluate(() => { const el = document.getElementById('frota'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 50); });
for (let i = 0; i < 60; i++) { await p.waitForTimeout(2000); const c = await p.evaluate(() => Object.keys(window.__777cost || {}).filter((k) => k.startsWith('buildTraffic')).length); if (c) break; }
await p.waitForTimeout(3000);
console.log(JSON.stringify(await p.evaluate(() => window.__777cost), null, 0));
await b.close();
