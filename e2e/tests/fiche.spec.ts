import { expect, login, test } from './fixtures';

const CR = 'Chambre 12, M. Dupond. Douleur à 3 sur 10 après la morphine, il s’est rendormi.';

test.describe('Fiche « Nouveau compte rendu »', () => {
  test('dossier médical : NEWS2 par paramètre, constantes modifiées et score recalculé', async ({
    page,
  }) => {
    await login(page);
    await page.getByTestId('patient-12').click();
    const fiche = page.getByTestId('fiche');
    await expect(fiche.getByRole('heading', { name: 'Nouveau compte rendu' })).toBeVisible();
    await expect(fiche.getByText('M. Jean Dupond')).toBeVisible();
    await expect(fiche.getByText('Chambre 12 · 68 ans')).toBeVisible();

    await fiche.getByTestId('dossier').click();
    const dossier = page.getByTestId('dossier-medical');
    await expect(dossier.getByText('Total NEWS2')).toBeVisible();
    await expect(dossier.getByTestId('news2-total')).toHaveText('7');
    await expect(dossier.getByText('24 /min')).toBeVisible();
    await expect(dossier.getByText(/^Constantes de \d{1,2}h\d{2}$/)).toBeVisible();
    await expect(dossier.getByText('Pénicilline')).toBeVisible();
    await expect(dossier.getByText(/Drain abdominal \(J\d+\)/)).toBeVisible();

    await dossier.getByTestId('modifier-constantes').click();
    const sheet = page.getByTestId('feuille-constantes');
    await expect(sheet.getByRole('heading', { name: 'Constantes' })).toBeVisible();
    await expect(sheet.getByTestId('news2-apercu')).toHaveText('7');
    // FR 24 → 12 : 2 points de moins, recalcul en direct.
    await sheet.getByLabel('FR (/min)').fill('12');
    await expect(sheet.getByTestId('news2-apercu')).toHaveText('5');
    await sheet.getByLabel('FR (/min)').fill('');
    await expect(sheet.getByTestId('news2-apercu')).toHaveText('–');
    await sheet.getByTestId('enregistrer-constantes').click();
    await expect(page.getByText('Vérifie les valeurs saisies.')).toBeVisible();
    await sheet.getByLabel('FR (/min)').fill('12');
    await sheet.getByTestId('enregistrer-constantes').click();

    await expect(page.getByText('Constantes enregistrées · NEWS2 5.')).toBeVisible();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId('news2-total')).toHaveText('5');
    await expect(page.getByTestId('dossier-medical').getByText('12 /min')).toBeVisible();
  });

  test('écrire puis valider un compte rendu : popup, puis « Mes CR » en premier', async ({
    page,
  }) => {
    await login(page);
    await page.getByTestId('patient-12').click();
    await page.getByTestId('valider').click();
    await expect(page.getByText('Dicte ou écris d’abord le compte rendu.')).toBeVisible();

    // Le brouillon est gardé quand on ferme la fiche.
    await page.getByTestId('cr-texte').fill(CR);
    await page.getByTestId('fermer-fiche').click();
    await page.getByTestId('patient-12').click();
    await expect(page.getByTestId('cr-texte')).toHaveValue(CR);

    await page.getByTestId('valider').click();
    await expect(page.getByTestId('cr-fait').getByText('Compte rendu fait')).toBeVisible();
    await expect(page.getByTestId('cr-fait')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByTestId('patient-12')).toBeVisible();

    await page.getByTestId('tab-transmissions').click();
    const first = page.getByTestId('mes-cr').locator('[data-testid^="cr-"]').first();
    await expect(first).toContainText('M. Jean Dupond');
    await expect(first).toContainText(CR);

    // Le brouillon a été vidé après l'enregistrement.
    await page.getByTestId('tab-patients').click();
    await page.getByTestId('patient-12').click();
    await expect(page.getByTestId('cr-texte')).toHaveValue('');
  });

  test('l’exemple de dictée remplit la zone de texte', async ({ page }) => {
    await login(page);
    await page.getByTestId('patient-12').click();
    await page.getByTestId('exemple').click();
    await expect(page.getByTestId('cr-texte')).toHaveValue(/^Chambre 12, M\. Dupond\./);
    await page.getByTestId('fermer-fiche').click();
    await page.getByTestId('patient-10').click();
    await expect(page.getByTestId('exemple')).toContainText('Mme Berger');
  });
});
