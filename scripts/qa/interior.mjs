import { chromium } from 'playwright';
// QA V9: planta real, poltrona escolhida → voo → trem recolhendo, vista da poltrona e cockpit
const out = process.argv[2] || '/tmp/claude-0/shots/i';
const card = Number(process.argv[3] || 0);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await p.goto('http://localhost:7777/?qa=1&quality=balanced&perf=lock&lang=pt&flightx=12#frota', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
await p.evaluate(() => { const el = document.getElementById('frota'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY + (el.offsetHeight - innerHeight) * 0.06); });
await p.waitForTimeout(8000);
for (let i = 0; i < card; i++) { await p.evaluate(() => document.querySelectorAll('.fleet__nav .textbtn')[1].click()); await p.waitForTimeout(2500); }
await p.evaluate(() => document.querySelector('.fcard[data-active="true"] .fcard__cta').click());
await p.waitForTimeout(2500);
await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.includes('Planta')).click());
await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelectorAll('.fplan__seat')[2].dispatchEvent(new MouseEvent('click', { bubbles: true })));
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}-0plan.png` });
await p.evaluate(() => document.querySelector('.sf-fly').click());
await p.waitForTimeout(6000);
await p.screenshot({ path: `${out}-1seatground.png` });
await p.mouse.move(720, 450); await p.mouse.down(); await p.mouse.move(300, 470, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}-1b360.png` });
await p.keyboard.press('g'); await p.waitForTimeout(800);
await p.keyboard.down('w'); await p.waitForTimeout(2500); await p.keyboard.up('w'); await p.waitForTimeout(800);
await p.screenshot({ path: `${out}-1cwalk.png` });
await p.mouse.move(720, 450); await p.mouse.down(); await p.mouse.move(1300, 450, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}-1dwalk2.png` });
await p.keyboard.press('x'); // vista externa
await p.keyboard.press('Space');
const tel = () => p.evaluate(() => document.querySelector('.sf-flight__inst')?.textContent);
for (let i = 0; i < 12; i++) { await p.waitForTimeout(3000); const t = await tel(); console.log('t', t); if (/ALTITUDE\s*([2-9]\d\d|\d{4})/i.test(t || '')) break; }
await p.screenshot({ path: `${out}-2gear.png` });
await p.waitForTimeout(4000);
await p.screenshot({ path: `${out}-2gear2.png` });
await p.keyboard.press('c'); await p.waitForTimeout(3000);
await p.screenshot({ path: `${out}-3cockpit.png` });
await p.keyboard.press('c'); await p.waitForTimeout(3000);
await p.screenshot({ path: `${out}-4seat.png` });
const box = { x: 720, y: 450 };
await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.mouse.move(box.x - 380, box.y + 40, { steps: 8 }); await p.mouse.up();
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}-5seat360.png` });
await b.close();
