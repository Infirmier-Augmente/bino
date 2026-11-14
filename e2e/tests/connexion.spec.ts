import { expect, login, test } from './fixtures';

test.describe('Connexion', () => {
  test('champs vides, mauvais mot de passe, puis connexion réussie et déconnexion', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect(page.getByText('Démo · matricule 10482 · mot de passe bino')).toBeVisible();

    await page.getByTestId('login-submit').click();
    await expect(page.getByText('Indique le matricule et le mot de passe.')).toBeVisible();

    await page.getByTestId('login-matricule').fill('10482');
    await page.getByTestId('login-password').fill('mauvais');
    await page.getByTestId('login-submit').click();
    await expect(page.getByText('Matricule ou mot de passe incorrect.')).toBeVisible();

    // Mot de passe insensible à la casse ; Entrée valide le formulaire.
    await page.getByTestId('login-password').fill('BINO');
    await page.getByTestId('login-password').press('Enter');
    await expect(page.getByRole('heading', { name: 'Martine Dubois · IDE' })).toBeVisible();
    await expect(page.getByText('Connexion réussie')).toBeVisible();
    await page.getByTestId('continuer').click();

    await expect(page.getByTestId('prenom')).toHaveText('Martine');
    await expect(page.getByText(/^Date : \d{2}\/\d{2}\/\d{4}$/)).toBeVisible();

    // Toujours connectée après un rechargement.
    await page.reload();
    await expect(page.getByTestId('prenom')).toHaveText('Martine');

    await page.getByRole('button', { name: 'Déconnexion' }).click();
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await page.goto('/patients');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  });

  test('un autre soignant voit son prénom et ses comptes rendus', async ({ page }) => {
    await login(page, '10415');
    await expect(page.getByTestId('prenom')).toHaveText('Karim');
    await page.getByTestId('tab-transmissions').click();
    await expect(page.getByTestId('mes-cr').getByText('Mme Jeanne Keller')).toBeVisible();
  });
});
