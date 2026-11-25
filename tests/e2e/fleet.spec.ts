import { expect, test } from '@playwright/test';

// V6 — Frota SimFly: cinco aeronaves anunciadas, classificação corrigida, CTA real e atlas acessível.
test.describe('frota SimFly', () => {
  test('cinco cards reais, Matrix não é jato, CTA WhatsApp pré-preenchido', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('#frota .fcard');
    await expect(cards).toHaveCount(5);
    const names = await cards.locator('.fcard__name').allTextContents();
    expect(names).toEqual(['Legacy 450', 'Praetor 500', 'Praetor 600', 'Matrix', 'Citation CJ2+']);
    const matrix = cards.nth(3);
    await expect(matrix.locator('.fcard__cat')).toContainText('pistão');
    await expect(matrix.locator('.fcard__cat')).not.toContainText(/jato/i);
    for (let i = 0; i < 5; i++) {
      const href = await cards.nth(i).locator('.fcard__quote').getAttribute('href');
      expect(href).toMatch(/^https:\/\/wa\.me\/5534991386000\?text=/);
      expect(decodeURIComponent(href!.split('text=')[1])).toContain(names[i]);
    }
    await expect(page.locator('#frota')).not.toContainText(/Meridian|Solstice|Aurora|Horizon|Zenith/);
  });

  test('atlas abre pelo teclado, mostra aviso de ilustração e fecha com Escape', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#frota .fcard').first().getByRole('button', { name: 'Ver por dentro' });
    await btn.scrollIntoViewIfNeeded();
    await btn.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: /Atlas do Embraer Legacy 450/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Ilustração 3D paramétrica');
    await expect(dialog.getByRole('button', { name: 'Fuselagem' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Propulsão' }).click();
    await expect(dialog.getByRole('button', { name: 'Compressor' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5000 });
  });
});
