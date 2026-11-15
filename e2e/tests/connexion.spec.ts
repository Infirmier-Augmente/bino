import { expect, login, test } from './fixtures';

test.describe('« Qui es-tu ? » (connexion sans mot de passe)', () => {
  test('les soignants du service, un toucher → Patients ; reste connectée ; déconnexion', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Qui es-tu ?' })).toBeVisible();
    await expect(page.getByText('Touche ton prénom pour commencer.')).toBeVisible();
    for (const id of ['martine', 'sophie', 'karim']) {
      await expect(page.getByTestId(`soignant-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId('soignant-martine')).toContainText('Martine Dubois');
    await expect(page.getByTestId('soignant-martine')).toContainText('IDE · Chirurgie polyvalente');
    // Plus de mot de passe ni d'écran « Connexion réussie ».
    await expect(page.getByTestId('login-password')).toHaveCount(0);

    await page.getByTestId('soignant-martine').click();
    await expect(page.getByTestId('prenom')).toHaveText('Martine');
    await expect(page.getByText(/^Date : \d{2}\/\d{2}\/\d{4}$/)).toBeVisible();

    // Toujours connectée après un rechargement.
    await page.reload();
    await expect(page.getByTestId('prenom')).toHaveText('Martine');

    await page.getByRole('button', { name: 'Déconnexion' }).click();
    await expect(page.getByRole('heading', { name: 'Qui es-tu ?' })).toBeVisible();
    await page.goto('/patients');
    await expect(page.getByRole('heading', { name: 'Qui es-tu ?' })).toBeVisible();
  });

  test('un autre soignant voit son prénom et ses comptes rendus', async ({ page }) => {
    await login(page, 'karim');
    await expect(page.getByTestId('prenom')).toHaveText('Karim');
    await page.getByTestId('tab-transmissions').click();
    await expect(page.getByTestId('mes-cr').getByText('Mme Jeanne Keller')).toBeVisible();
  });
});
