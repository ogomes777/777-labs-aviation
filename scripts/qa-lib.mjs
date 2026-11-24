// Utilitários de QA compartilhados (Playwright). Posiciona o scroll em um tempo global t do filme.
export async function gotoT(page, t, { settle = 1600 } = {}) {
  await page.evaluate(async (t) => {
    const ch = Math.min(8, Math.floor(t));
    const p = Math.min(1, t - ch);
    const el = document.querySelector(`[data-chapter="${ch}"]`);
    const top = el.getBoundingClientRect().top + scrollY;
    const range = ch === 8 ? el.offsetHeight : el.offsetHeight - innerHeight;
    const y = ch === 8 ? top - innerHeight + range * p : top + range * p;
    window.__777 && (window.__777.frame.freezeClock = true);
    window.scrollTo(0, Math.round(y));
  }, t);
  await page.waitForTimeout(settle);
}
export async function waitReady(page, timeout = 60000) {
  await page.waitForFunction(() => document.querySelector('.stage')?.dataset.ready === 'true', null, { timeout });
}
