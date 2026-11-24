// Custo de CPU por quadro do loop de direção (exclui o desenho da GPU) ao percorrer o filme inteiro.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { gotoT, waitReady } from './qa-lib.mjs';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const out = {};
for (const [name, vp, q] of [['desktop-high', { width: 1440, height: 900 }, 'high'], ['mobile-balanced', { width: 390, height: 844 }, 'balanced']]) {
  const p = await b.newPage({ viewport: vp });
  await p.goto(`http://localhost:3777/?qa=1&perf=lock&quality=${q}`); await waitReady(p);
  const samples = [];
  for (const t of [0.3, 1.4, 2.4, 3.4, 4.6, 5.3, 6.4, 7.6, 8.5]) {
    await gotoT(p, t, { settle: 2500 });
    await p.evaluate(() => { window.__777.frame.freezeClock = false; window.__777.frame.cpuMax = 0; });
    await p.waitForTimeout(2500);
    samples.push(await p.evaluate((t) => ({ t, avg: +window.__777.frame.cpuMs.toFixed(2), max: +window.__777.frame.cpuMax.toFixed(2) }), t));
  }
  out[name] = samples; console.log(name, JSON.stringify(samples));
  await p.close();
}
writeFileSync('qa/performance/cpu-per-frame.json', JSON.stringify({ note: 'ms de CPU por quadro do loop de direção (useFrame), sem o tempo de GPU', results: out }, null, 2));
await b.close();
