import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1200, height: 750 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto('http://localhost:7777/?qa=1&quality=balanced&perf=lock&lang=pt&flightx=6#frota', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.evaluate(() => { const el = document.getElementById('frota'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + (el.offsetHeight - innerHeight) * 0.5); });
for (let i = 0; i < 60; i++) { await p.waitForTimeout(1000); if (await p.evaluate(() => (window.__777fleet || []).some(c => c.id === 'praetor-600'))) break; }
await p.evaluate(() => window.__777.ui.set({ inspect: 'praetor-600', inspectMode: 'plan', seat: 1 }));
await p.waitForTimeout(3000);
await p.evaluate(() => window.__777.ui.set({ flight: 'praetor-600' }));
await p.waitForTimeout(6000);
await p.keyboard.press('v'); await p.keyboard.press('v'); // garante externa
const probe = async (tag) => { const r = await p.evaluate(() => { const c = window.__777fleet.find(x => x.id === 'praetor-600'); let skin = null; c.group.traverse(o => { if (!skin && o.isMesh && o.material && o.material.transparent !== undefined && o.name && /skin|fus/i.test(o.name)) skin = { name: o.name, op: o.material.opacity, tr: o.material.transparent, vis: o.visible, dw: o.material.depthWrite }; }); return JSON.stringify({ skin, view: document.querySelector('.sf-flight__tools button[aria-label]')?.textContent, inst: document.querySelector('.sf-flight__inst')?.textContent }); }); console.log(tag, r); await p.screenshot({ path: `/tmp/claude-0/shots/ff-${tag}.png` }); };
await probe('ground');
await p.keyboard.press('Space'); await p.waitForTimeout(9000);
await p.keyboard.down('Shift'); await p.waitForTimeout(8000); await p.keyboard.up('Shift');
await probe('fast');
await p.keyboard.down('w'); await p.waitForTimeout(2500); await p.keyboard.up('w'); await p.waitForTimeout(6000);
await probe('high');
await b.close();
