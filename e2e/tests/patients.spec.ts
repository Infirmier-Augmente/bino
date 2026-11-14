import { expect, login, roomsInOrder, test } from './fixtures';

test.describe('Patients', () => {
  test('les 11 patients, triés par chambre puis par nom (choix mémorisé)', async ({ page }) => {
    await login(page);
    await expect(page.getByLabel('11 patients')).toBeVisible();
    await expect(page.getByTestId('tri-patients')).toHaveText(/Trier : Chambre/);
    expect(await roomsInOrder(page, 'patient')).toEqual([
      '3',
      '7',
      '9',
      '10',
      '12',
      '14',
      '15',
      '16',
      '18',
      '19',
      '21',
    ]);
    await expect(page.getByTestId('patient-12')).toContainText('M. Jean Dupond');
    await expect(page.getByTestId('patient-12')).toContainText('68 ans');
    await expect(page.getByTestId('patient-12')).toContainText('CHAMB 12');

    await page.getByTestId('tri-patients').click();
    await page.getByRole('button', { name: 'Nom' }).click();
    await expect(page.getByTestId('tri-patients')).toHaveText(/Trier : Nom/);
    // Benali, Berger, Dupond, Fontaine, Garnier, Keller, Lambert, Laurent, Moreau, Perrin, Petit.
    expect(await roomsInOrder(page, 'patient')).toEqual([
      '9',
      '10',
      '12',
      '16',
      '14',
      '3',
      '18',
      '15',
      '7',
      '21',
      '19',
    ]);

    await page.reload();
    await expect(page.getByTestId('tri-patients')).toHaveText(/Trier : Nom/);
  });
});
