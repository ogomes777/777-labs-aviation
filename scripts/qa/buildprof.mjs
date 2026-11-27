import { chromium } from 'playwright';
// perfil (tempo inclusivo) das funções durante a construção da frota
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await p.context().newCDPSession(p);
await p.goto('http://localhost:7777/?qa=1&quality=balanced&lang=pt', { waitUntil: 'networkidle' });
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
await p.evaluate(() => { const el = document.getElementById('frota'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 50); });
for (let i = 0; i < 60; i++) { await p.waitForTimeout(2000); const c = await p.evaluate(() => Object.keys(window.__777cost || {}).filter((k) => k.startsWith('buildFleet')).length); if (c >= 5) break; }
const { profile } = await cdp.send('Profiler.stop');
const nodes = new Map(profile.nodes.map((n) => [n.id, n])); const parent = new Map();
for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const incl = new Map(); let i = 0;
for (const id of profile.samples) { const d = (profile.timeDeltas[i++] || 0) / 1000; const seen = new Set(); let cur = id; while (cur !== undefined) { const n = nodes.get(cur); const k = n.callFrame.functionName || '(anon)'; const key = k + ' :' + n.callFrame.lineNumber; if (!seen.has(key)) { incl.set(key, (incl.get(key) || 0) + d); seen.add(key); } cur = parent.get(cur); } }
const b0 = [...incl.entries()].find(([k]) => k.startsWith('buildFleetCraft'));
console.log('buildFleetCraft total', b0);
[...incl.entries()].filter(([k]) => !/^\(|^(anon)/.test(k)).sort((a, c) => c[1] - a[1]).slice(0, 45).forEach(([k, v]) => console.log(v.toFixed(0).padStart(6), k));
await b.close();
