import { expect, signIn, test } from './fixtures';

test.describe('Vue relève sur le PC du poste de soins', () => {
  test('patients triés, fiche ouverte à côté, mode réunion et récap', async ({ page }) => {
    await signIn(page);
    await page.getByRole('tab', { name: 'Relève' }).click();
    const releve = page.getByTestId('releve');
    await expect(releve).toBeVisible();
    // ★ posée sur le Box 10 dans le scénario : il est en tête.
    await expect(releve.locator('[data-testid^="patient-"]').first()).toHaveAttribute(
      'data-testid',
      'patient-10',
    );

    await releve.getByTestId('patient-12').click();
    await expect(page.getByText('Box 12 · M. Durand').first()).toBeVisible();
    await expect(page.getByText('Transmissions ciblées (DAR)')).toBeVisible();

    await page.getByRole('button', { name: 'Mode réunion (grand écran)' }).click();
    await expect(page.getByRole('tab', { name: 'Patients' })).toBeHidden();
    await page.getByRole('button', { name: 'Quitter le mode réunion' }).click();

    await page.getByRole('button', { name: 'Récap court (SMS)' }).click();
    await expect(page.getByText(/Box 12 M\. Durand · /)).toBeVisible();
  });

  test('le simulateur rejoue une journée', async ({ page }) => {
    await signIn(page);
    await page.getByRole('tab', { name: 'Simulateur' }).click();
    await page.getByRole('button', { name: 'Partir du début' }).first().click();
    await expect(page.getByText(/Événement 0 \//)).toBeVisible();
    await page.getByRole('button', { name: 'Événement suivant' }).click();
    await expect(page.getByText(/Événement 1 \//)).toBeVisible();
  });
});
