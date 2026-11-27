// QA visual do mundo do test drive (mar cristalino, sopro na água, vida, céu e nuvens).
// uso: node scripts/qa/sea.mjs <pasta-saída> [m] [seed]   (servidor em http://localhost:7777)
import { chromium } from 'playwright';
const out = process.argv[2] || 'qa/screenshots/sea';
const mobile = process.argv[3] === 'm';
const seed = process.argv[4] || '424242';
const vp = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 300)); });
await p.goto(`http://localhost:7777/?qa=1&quality=high&perf=lock&lang=pt&seed=${seed}#frota`, { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.evaluate(() => { const el = document.getElementById('frota'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + (el.offsetHeight - innerHeight) * 0.5); });
for (let i = 0; i < 90; i++) { await p.waitForTimeout(1000); if (await p.evaluate(() => (window.__777fleet || []).some((c) => c.id === 'praetor-600'))) break; }
await p.evaluate(() => window.__777.ui.set({ flight: 'praetor-600' }));
for (let i = 0; i < 60; i++) { await p.waitForTimeout(1000); if (await p.evaluate(() => !!window.__777sim)) break; }
await p.waitForTimeout(4000);
await p.keyboard.press('Space');
await p.waitForTimeout(3000);
const place = (x, z, agl, yawDeg, V, look = 0) => p.evaluate(([x, z, agl, yawDeg, V, look]) => {
  const s = window.__777sim; const gy = window.__777fw.seaY + 0.8;
  s.setPhase('air'); s.gear = false; s.gearK = 0;
  s.pos.set(x, gy + s.axisH + agl, z); s.yaw = (yawDeg * Math.PI) / 180; s.pitch = 0; s.roll = 0; s.syncAttFromEuler();
  s.V = V; s.thr = 1; s.spool = 1; s.camInit = false;
  window.__777look = look;
}, [x, z, agl, yawDeg, V, look]);
const info = () => p.evaluate(() => {
  const g = window.__777env?.gl; const tel = document.querySelector('.sf-flight__inst')?.textContent;
  const fwc = (window.__777cost?.flightWorld || []).slice(-90); const fwMs = fwc.length ? (fwc.reduce((a, b) => a + b, 0) / fwc.length).toFixed(2) : null;
  return JSON.stringify({ fwMs, fwMax: fwc.length ? Math.max(...fwc) : null, calls: g?.info.render.calls, tris: g?.info.render.triangles, cpu: window.__777frame?.cpuMs?.toFixed(2), tel, fish: window.__777fw?.group.getObjectByName('life-fish')?.geometry.instanceCount, birds: window.__777fw?.group.getObjectByName('life-birds')?.geometry.instanceCount, dolph: window.__777fw?.group.getObjectByName('life-dolphins')?.geometry.instanceCount, spray: window.__777fw?.group.getObjectByName('flight-spray')?.geometry.instanceCount, rocks: window.__777fw?.group.getObjectByName('life-rocks')?.geometry.instanceCount });
});
const shot = async (name, wait = 2500) => { await p.waitForTimeout(wait); await p.screenshot({ path: `${out}-${name}.png` }); console.log(name, await info()); };
// 1) rasante sobre água rasa e cristalina: sopro das turbinas levanta a água
await place(-1100, -2420, 7, 0, 110);
await shot('1-rasante', 3500);
// 1b) o mesmo rasante visto de lado: o rastro de água levantada pelas turbinas
await p.mouse.move(vp.width * 0.7, vp.height / 2); await p.mouse.down(); await p.mouse.move(vp.width * 0.7 - 260, vp.height / 2, { steps: 6 }); await p.mouse.up();
await shot('1b-rasante-lado', 400);
// 2) vista de cima a 60 m (fundo, cardumes, rochas)
await place(-900, -2480, 60, 10, 80);
await p.mouse.move(vp.width / 2, vp.height / 2); await p.mouse.down(); await p.mouse.move(vp.width / 2, vp.height / 2 + 160, { steps: 6 }); await p.mouse.up();
await shot('2-de-cima', 2500);
// 3) cruzeiro a 1.500 m: nuvens, sombra das nuvens no mar, céu do dia sorteado
await place(-3000, -6000, 1500, 200, 200);
await shot('3-cruzeiro', 3500);
// 4) ilha: recife, laguna turquesa
await place(-10300, -120, 70, 0, 90);
await shot('4-ilha', 3500);
// 5) contra o sol: borda prateada das nuvens e trilha de brilho no mar
await p.evaluate(() => { const s = window.__777fw.U.uSun.value; const yaw = Math.atan2(-s.z, s.x) * 180 / Math.PI; window.__sunYaw = yaw; });
const sunYaw = await p.evaluate(() => window.__sunYaw);
await place(-2000, -7000, 420, sunYaw, 150);
await shot('5-contra-o-sol', 3500);
await b.close();
