import { chromium } from 'playwright';
import fs from 'node:fs';
// Auditoria de travadas: long tasks (>50 ms) por etapa + perfil de CPU (funções mais caras)
const out = process.argv[2] || '/tmp/claude-0/shots/perf';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.addInitScript(() => {
  window.__lt = []; window.__phase = 'load';
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ ph: window.__phase, d: Math.round(e.duration), t: Math.round(e.startTime) }); }).observe({ type: 'longtask', buffered: true });
});
const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
await cdp.send('Profiler.start');
await p.goto('http://localhost:7777/?quality=balanced&lang=pt', { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);
const phase = (n) => p.evaluate((x) => { window.__phase = x; }, n);
const H = await p.evaluate(() => document.documentElement.scrollHeight);
const fro = await p.evaluate(() => { const el = document.getElementById('frota'); return el.getBoundingClientRect().top + scrollY; });
await phase('scroll');
for (let y = 0; y < fro - 900; y += 450) { await p.mouse.wheel(0, 450); await p.waitForTimeout(260); }
await phase('enter-fleet');
for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(400); }
await p.waitForTimeout(6000);
await phase('next-craft');
for (let i = 0; i < 2; i++) { await p.evaluate(() => document.querySelectorAll('.fleet__nav .textbtn')[1]?.click()); await p.waitForTimeout(2500); }
await phase('inspect');
await p.evaluate(() => document.querySelector('.fcard[data-active="true"] .fcard__cta')?.click());
await p.waitForTimeout(5000);
await phase('360');
for (let k = 0; k < 3; k++) { await p.mouse.move(700, 450); await p.mouse.down(); await p.mouse.move(300, 480, { steps: 12 }); await p.mouse.move(900, 420, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(800); }
await phase('xray');
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /raio/i.test(x.textContent))?.click());
await p.waitForTimeout(3000);
await phase('plan');
await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((t) => /planta/i.test(t.textContent))?.click());
await p.waitForTimeout(3000);
await phase('close');
await p.keyboard.press('Escape'); await p.waitForTimeout(2500);
await phase('rest');
for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, 500); await p.waitForTimeout(250); }
await p.waitForTimeout(2000);
const { profile } = await cdp.send('Profiler.stop');
const lt = await p.evaluate(() => window.__lt);
const byPh = {};
for (const e of lt) { (byPh[e.ph] ??= []).push(e.d); }
console.log('LONG TASKS por etapa (ms):');
for (const [k, v] of Object.entries(byPh)) console.log(k.padEnd(12), 'n=' + v.length, 'max=' + Math.max(...v), 'soma=' + v.reduce((a, c) => a + c, 0), v.sort((a, c) => c - a).slice(0, 8).join(','));
// funções com mais tempo próprio
const self = new Map(); const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas; let i = 0;
for (const id of profile.samples) { const n = nodes.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + (dt[i++] || 0) / 1000); }
console.log('\nTOP funções (tempo próprio ms):');
[...self.entries()].filter(([k]) => !/\(idle\)|\(program\)|\(garbage/.test(k)).sort((a, c) => c[1] - a[1]).slice(0, 30).forEach(([k, v]) => console.log(v.toFixed(0).padStart(7), k));
fs.writeFileSync(out + '.cpuprofile', JSON.stringify(profile));
await b.close();
