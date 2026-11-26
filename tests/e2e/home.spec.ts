import { test, expect, type Page } from '@playwright/test';

const consoleErrors = (page: Page) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource.*404/.test(m.text())) errs.push(m.text()); });
  return errs;
};
const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe('carga e estrutura', () => {
  test('carrega sem erros de console e sem scroll horizontal (cinemático)', async ({ page }) => {
    const errs = consoleErrors(page);
    await page.goto('/?qa=1&quality=balanced');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForFunction(() => document.querySelector('.stage')?.getAttribute('data-ready') === 'true', null, { timeout: 60_000 });
    expect(await noHScroll(page)).toBe(true);
    expect(errs).toEqual([]);
  });

  test('tier alto (todos os efeitos) renderiza sem erros', async ({ page, isMobile }) => {
    test.skip(isMobile, 'tier alto é desktop');
    const errs = consoleErrors(page);
    await page.goto('/?qa=1&quality=high&perf=lock');
    await page.waitForFunction(() => document.querySelector('.stage')?.getAttribute('data-ready') === 'true', null, { timeout: 80_000 });
    await page.waitForTimeout(2000);
    expect(errs).toEqual([]);
  });

  test('H1 e CTA aparecem antes do WebGL ficar pronto', async ({ page }) => {
    await page.goto('/?qa=1&quality=balanced', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.sfh__brand')).toBeVisible();
  });

  test('estrutura semântica: landmarks, h1 único, skip link', async ({ page }) => {
    await page.goto('/?motion=reduced');
    await expect(page.locator('main#main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  });
});

test.describe('navegação', () => {
  test('Explorar a aeronave leva à seção (cinemático)', async ({ page }) => {
    await page.goto('/?qa=1&quality=balanced');
    await page.getByRole('link', { name: 'Explorar', exact: true }).click();
    await expect(page).toHaveURL(/#aeronave/);
    await expect(page.locator('#aeronave-title')).toBeFocused();
    // entra no capítulo com o conteúdo já revelado (14% adiante do início)
    const top = await page.evaluate(() => document.getElementById('aeronave')!.getBoundingClientRect().top);
    expect(top).toBeLessThanOrEqual(1);
    await expect(page.locator('#aeronave-title')).toBeVisible();
  });

  test('Explorar a aeronave leva à seção (movimento reduzido)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('link', { name: 'Explorar', exact: true }).click();
    await expect(page).toHaveURL(/#aeronave/);
    await expect(page.locator('#aeronave-title')).toBeFocused();
  });

  test('menu abre/fecha com mouse, Enter e Escape e devolve o foco', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'menu modal existe apenas abaixo de 1024px');
    await page.goto('/?motion=reduced');
    const btn = page.getByRole('button', { name: 'Menu' });
    await btn.click();
    const dlg = page.getByRole('dialog', { name: 'Menu' });
    await expect(dlg).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    await expect(btn).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dlg).toBeVisible();
    await dlg.getByRole('link', { name: 'Portfólio' }).click();
    await expect(dlg).toBeHidden();
    await expect(page).toHaveURL(/#portfolio/);
  });

  test('scroll reverso rápido não congela e o tempo do filme volta', async ({ page }) => {
    const errs = consoleErrors(page);
    await page.goto('/?qa=1&quality=balanced');
    await page.waitForFunction(() => document.querySelector('.stage')?.getAttribute('data-ready') === 'true', null, { timeout: 60_000 });
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (const y of [h * 0.5, h * 0.1, h * 0.35, h * 0.02]) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(400); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    const t = await page.evaluate(() => (window as unknown as { __777: { frame: { t: number } } }).__777.frame.t);
    expect(t).toBeLessThan(0.05);
    expect(errs).toEqual([]);
  });
});

test.describe('interações reais', () => {
  test('galeria: botões e teclado percorrem 1→4 e voltam', async ({ page }) => {
    await page.goto('/?motion=reduced');
    await page.locator('#experiencia').scrollIntoViewIfNeeded();
    const status = page.locator('.gallery__controls [aria-live]');
    await expect(status).toHaveText(/01/);
    const next = page.getByRole('button', { name: 'Próxima microcena' });
    for (const n of ['02', '03', '04']) { await next.click(); await expect(status).toHaveText(new RegExp(n)); }
    await expect(next).toBeDisabled();
    const region = page.getByRole('region', { name: /Galeria da cabine/ });
    await region.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(status).toHaveText(/03/);
    await page.keyboard.press('Home');
    await expect(status).toHaveText(/01/);
  });

  test('galeria mobile: swipe nativo sem sequestrar o scroll vertical', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'apenas mobile');
    await page.goto('/?qa=1&quality=balanced');
    await page.locator('#experiencia').scrollIntoViewIfNeeded();
    const vp = page.locator('[data-gallery-viewport]');
    const ov = await vp.evaluate((el) => getComputedStyle(el).overflowX);
    expect(ov).toBe('auto');
    await vp.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'auto' }));
    await expect(page.locator('.gallery__controls [aria-live]')).toHaveText(/04/);
  });

  test('perspectivas e proporções da aeronave reagem ao input', async ({ page }) => {
    await page.goto('/?qa=1&quality=balanced');
    await page.getByRole('link', { name: 'Explorar', exact: true }).click();
    const det = page.getByRole('button', { name: 'Detalhes' });
    await det.click();
    await expect(det).toHaveAttribute('aria-pressed', 'true');
    const v = await page.evaluate(() => (window as unknown as { __777: { ui: { get: () => { view: string } } } }).__777.ui.get());
    expect(v.view).toBe('detalhes');
  });

  test('anatomia: seleção de sistema e vista explodida', async ({ page }) => {
    await page.goto('/?motion=reduced');
    await page.locator('#engenharia').scrollIntoViewIfNeeded();
    await page.getByRole('group', { name: 'Sistemas' }).getByRole('button', { name: 'Motores' }).click();
    await expect(page.locator('.part-card h3')).toHaveText(/Motores/);
    const ex = page.getByRole('button', { name: 'Abrir em camadas' });
    await ex.click();
    await expect(page.getByRole('button', { name: 'Montar aeronave' })).toHaveAttribute('aria-pressed', 'true');
  });

});

test.describe('frota', () => {
  test('carrossel da frota e inspeção: sistemas e planta', async ({ page }) => {
    await page.goto('/?motion=reduced');
    await page.locator('#frota').scrollIntoViewIfNeeded();
    await expect(page.locator('.fcard')).toHaveCount(5);
    await page.getByRole('button', { name: 'Próxima', exact: true }).first().click();
    await expect(page.locator('.fcard[data-active="true"]')).toHaveCount(1);
    await page.locator('.fcard').first().getByRole('button', { name: 'Ver por dentro' }).click();
    // V6: frota real; o atlas substitui a lista conceitual (Meridian…)
    const dlg = page.getByRole('dialog', { name: /Atlas do Embraer Legacy 450/ });
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'Propulsão' }).click();
    await dlg.getByRole('button', { name: 'Fan' }).click();
    await expect(dlg.locator('.inspect__text')).toContainText('empuxo');
    await dlg.getByRole('tab', { name: 'Planta' }).click();
    await expect(dlg.locator('.inspect__text')).toContainText('lugares');
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
  });
});

test.describe('formulário', () => {


  test('API: 422 para payload inválido, demo para válido', async ({ request }) => {
    const bad = await request.post('/api/inquiries', { data: { journey: { from: 'A', to: 'A' } } });
    expect(bad.status()).toBe(422);
    const ok = await request.post('/api/inquiries', { data: {
      journey: { from: 'São Paulo', to: 'Lisboa', date: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10), passengers: 2 },
      contact: { name: 'QA', email: 'qa@example.com', purpose: 'Lazer', consent: true }, website: '', elapsedMs: 5000 } });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).mode).toBe('demo');
  });
});

test.describe('resiliência', () => {
  test('prefers-reduced-motion: sem canvas, sem pin, conteúdo e CTA íntegros', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await expect(page.locator('canvas')).toHaveCount(0);
    const h = await page.locator('[data-chapter="2"]').evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBeLessThan(2000);
    for (const id of ['aeronave-title', 'engenharia-title', 'interior-title', 'experiencia-title', 'planejar-title']) await expect(page.locator(`#${id}`)).toBeAttached();
    expect(await noHScroll(page)).toBe(true);
  });

  test('WebGL indisponível: imagem estática e CTA utilizável', async ({ page }) => {
    await page.goto('/?webgl=0');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'lite');
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('#aeronave .still img')).toBeVisible();
    await page.getByRole('link', { name: 'Planejar jornada', exact: true }).last().click();
    await expect(page).toHaveURL(/#planejar/);
    await expect(page.locator('#f-from')).toBeVisible();
  });

  test('preferência de movimento persiste e troca o modo', async ({ page, isMobile }) => {
    test.skip(isMobile, 'controle compacto testado no desktop');
    await page.goto('/?qa=1&quality=balanced');
    await page.getByRole('button', { name: /Movimento/ }).click();
    await Promise.all([page.waitForEvent('load'), page.getByRole('radio', { name: /Movimento reduzido/ }).click({ noWaitAfter: true })]);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await page.evaluate(() => localStorage.removeItem('777:motion'));
  });
});
