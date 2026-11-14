import { expect, signIn, test } from './fixtures';

const DICTEE =
  'Box 14, madame Lefèvre. Elle a vomi vers 15h, je lui ai donné du Primpéran. Elle est allergique à l’iode.';

test.describe('Parcours infirmière : dicter → relire → valider', () => {
  test('la dictée est rattachée au bon patient et rangée en DAR, avec le R manquant en question', async ({
    page,
  }) => {
    await signIn(page);
    await page.getByTestId('dicter').click();
    await page.getByTestId('dictee-texte').fill(DICTEE);
    await page.getByTestId('envoyer').click();

    await expect(page.getByTestId('relecture')).toBeVisible();
    await expect(page.getByText('Box 14 · Mme Lefèvre')).toBeVisible();
    await expect(page.getByText('Nausées / vomissements', { exact: true })).toBeVisible();
    await expect(page.getByText('Non renseigné : à préciser')).toBeVisible();
    await expect(page.getByTestId('question-missing-result')).toBeVisible();

    // Chaque phrase renvoie à son extrait de dictée.
    await page.getByText('Elle a vomi vers 15h.').click();
    await expect(page.getByText('« Elle a vomi vers 15h »')).toBeVisible();

    // Compléter le R depuis la question.
    await page.getByLabel(/Réponse : Résultat non renseigné/).fill('Pas de récidive, bien toléré.');
    await page.getByRole('button', { name: 'Répondre' }).click();
    await expect(page.getByText('Pas de récidive, bien toléré.')).toBeVisible();
    await expect(page.getByText('Non renseigné : à préciser')).toHaveCount(0);

    await page.getByTestId('valider').click();
    await expect(page.getByText(/Validée · Box 14/)).toBeVisible();
  });

  test('sans patient identifiable, l’app demande de qui il s’agit avant de valider', async ({
    page,
  }) => {
    await signIn(page);
    await page.getByTestId('dicter').click();
    await page.getByTestId('dictee-texte').fill('Il a bien mangé à midi, transit repris.');
    await page.getByTestId('envoyer').click();

    await expect(page.getByTestId('choix-patient')).toBeVisible();
    await expect(page.getByTestId('valider')).toBeDisabled();
    await page.getByRole('button', { name: 'Box 12 · M. Durand' }).click();
    await expect(page.getByText('Box 12 · M. Durand').first()).toBeVisible();
    await expect(page.getByTestId('valider')).toBeEnabled();
  });

  test('« Plus tard » garde la transmission comme non relue', async ({ page }) => {
    await signIn(page);
    await page.getByTestId('dicter').click();
    await page
      .getByTestId('dictee-texte')
      .fill('Box 11, monsieur Nguyen, RAS, pansement refait propre.');
    await page.getByTestId('envoyer').click();
    await page.getByTestId('plus-tard').click();
    await expect(page.getByText('Gardée « non relue »')).toBeVisible();
  });

  test('mode démo : une dictée d’exemple se remplit sans micro', async ({ page }) => {
    await signIn(page);
    await page.getByTestId('dicter').click();
    await page.getByTestId('exemples').click();
    await page.getByText('Box 12 : exemple A du kit Foch').click();
    await expect(page.getByTestId('dictee-texte')).toHaveValue(/radio de contrôle est OK/, {
      timeout: 10_000,
    });
  });
});
