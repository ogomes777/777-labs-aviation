import { chromium } from 'playwright';
// custo de CPU por quadro do loop 3D (ms, sem a GPU) em cada estado — alvo: < 4 ms no desktop
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:7777/?qa=1&quality=balanced&perf=lock&lang=pt', { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);
const sample = async (tag, act) => {
  await p.evaluate(() => { const f = window.__777frame; if (f) { f.cpuMax = 0; } });
  if (act) await act(); else await p.waitForTimeout(4000);
  const r = await p.evaluate(() => { const f = window.__777frame; return f ? { avg: +f.cpuMs.toFixed(2), max: +f.cpuMax.toFixed(1) } : null; });
  console.log(tag.padEnd(14), JSON.stringify(r));
};
const go = async (sel, k) => { await p.evaluate(([s, kk]) => { const el = document.querySelector(s); if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY + (el.offsetHeight - innerHeight) * kk); }, [sel, k]); await p.waitForTimeout(3500); };
await sample('hero');
await go('[data-chapter="1"]', 0.5); await sample('cap1');
await go('[data-chapter="4"]', 0.5); await sample('cap4');
await go('[data-chapter="6"]', 0.5); await sample('cabine');
await go('#frota', 0.06); await p.waitForTimeout(15000); await sample('frota');
await p.evaluate(() => document.querySelector('.fcard[data-active="true"] .fcard__cta')?.click()); await p.waitForTimeout(5000); await sample('inspect');
await sample('360-arrasto', async () => { for (let k = 0; k < 3; k++) { await p.mouse.move(700, 450); await p.mouse.down(); await p.mouse.move(300, 480, { steps: 10 }); await p.mouse.move(900, 420, { steps: 10 }); await p.mouse.up(); } });
await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((t) => /planta/i.test(t.textContent))?.click()); await sample('planta');
await p.keyboard.press('Escape'); await p.waitForTimeout(2000);
await go('#procuramos', 0.3); await sample('final');
await b.close();
