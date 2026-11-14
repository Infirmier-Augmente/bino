import { expect, signIn, test } from './fixtures';

test.describe('Fiche patient et priorité', () => {
  test('la fiche de relève du Box 12 reprend l’exemple B du kit', async ({ page }) => {
    await signIn(page);
    await page.getByTestId('patient-12').click();
    await expect(page.getByText('Box 12 · M. Durand')).toBeVisible();
    const aRetenir = page.getByTestId('a-retenir');
    await expect(aRetenir.getByText(/Agitation/)).toBeVisible();
    await expect(aRetenir.getByText(/Sevrage ventilatoire/)).toBeVisible();
    await expect(page.getByText('Contact (BMR)', { exact: true }).last()).toBeVisible();
    await expect(page.getByText(/Bilan sanguin prévu à 6h/).first()).toBeVisible();
  });

  test('l’étoile ★ fait remonter un patient en tête de liste', async ({ page }) => {
    await signIn(page);
    await page.getByText('Service (4)').click();
    await page.getByTestId('patient-11').click();
    await page.getByRole('switch', { name: /Mettre une étoile/ }).click();
    await page.getByRole('button', { name: 'Retour' }).click();
    const rows = page.locator('[data-testid^="patient-"]');
    await expect(rows.first()).toHaveAttribute('data-testid', /patient-(10|11)/);
  });

  test('export vers le DPI simulé', async ({ page }) => {
    await signIn(page);
    await page.getByTestId('patient-12').click();
    await page.getByRole('button', { name: 'Exporter' }).click();
    await expect(page.getByText(/Envoyé au DPI/)).toBeVisible();
  });
});
