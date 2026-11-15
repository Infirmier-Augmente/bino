import { expect, login, roomsInOrder, test } from './fixtures';

test.describe('Transmissions › Tous', () => {
  test('une carte par patient, puces sourcées avec auteurs et heures', async ({ page }) => {
    await login(page);
    await page.getByTestId('tab-transmissions').click();
    await expect(page.getByRole('heading', { name: 'Transmissions' })).toBeVisible();
    await expect(page.getByTestId('mes-cr').getByText('Mme Odile Perrin')).toBeVisible();

    await page.getByTestId('portee-all').click();
    const dupond = page.getByTestId('resume-12');
    await expect(dupond).toContainText('M. Jean Dupond');
    await expect(dupond.getByText(/^Douleur : /)).toBeVisible();
    await expect(dupond.getByText('Karim 14h05 · Sophie 8h10')).toBeVisible();
    // 7 puces : les 6 plus récentes, la dernière se déplie (rien n'est perdu).
    const plus = page.getByTestId('plus-de-puces-12');
    await expect(plus).toHaveText('Voir l’autre puce');
    const visibles = await dupond.getByText(/^[^:]+ : /).count();
    await plus.click();
    await expect(plus).toHaveText('Afficher moins');
    expect(await dupond.getByText(/^[^:]+ : /).count()).toBe(visibles + 1);
    await expect(
      page.getByTestId('resume-10').getByText('Aucun compte rendu aujourd’hui.'),
    ).toBeVisible();
    await expect(page.getByText(/chacune vient d’un compte rendu/)).toBeVisible();

    // Tri « Priorité » par défaut : M. Dupond (Priorité 1, NEWS2 7) en tête.
    expect((await roomsInOrder(page, 'resume'))[0]).toBe('12');
    await expect(page.getByTestId('priorite-12')).toHaveText(/Priorité 1/);
    await expect(page.getByTestId('priorite-12')).toHaveAttribute('aria-label', /NEWS2 7/);

    await page.getByTestId('tri-tous').click();
    await page.getByRole('button', { name: 'Chambre' }).click();
    expect((await roomsInOrder(page, 'resume')).slice(0, 3)).toEqual(['3', '7', '9']);
  });

  test('choisir la priorité : toast, libellé et re-tri immédiat', async ({ page }) => {
    await login(page);
    await page.getByTestId('tab-transmissions').click();
    await page.getByTestId('portee-all').click();

    await page.getByTestId('priorite-14').click();
    await page.getByTestId('priorite-14-1').click();
    await expect(page.getByText('Priorité 1 enregistrée.')).toBeVisible();
    await expect(page.getByTestId('priorite-14')).toHaveText(/Priorité 1/);
    await expect(page.getByTestId('priorite-14')).toHaveAttribute(
      'aria-label',
      /choisie par un soignant/,
    );
    await expect(page.getByTestId('priorite-14-1')).toHaveCount(0);

    // Mme Berger (dernière, sans compte rendu) passe en Priorité 1 : elle remonte.
    const before = (await roomsInOrder(page, 'resume')).indexOf('10');
    await page.getByTestId('priorite-10').click();
    await page.getByTestId('priorite-10-1').click();
    await expect(page.getByText('Priorité 1 enregistrée.')).toBeVisible();
    await expect
      .poll(async () => (await roomsInOrder(page, 'resume')).indexOf('10'))
      .toBeLessThan(before);
    expect((await roomsInOrder(page, 'resume')).slice(0, 3)).toEqual(['12', '14', '10']);

    await page.getByRole('button', { name: 'Déconnexion' }).click();
    await expect(page.getByRole('heading', { name: 'Qui es-tu ?' })).toBeVisible();
  });
});
