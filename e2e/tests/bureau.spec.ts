import { expect, login, test } from './fixtures';

test('sur grand écran, l’app reste une colonne centrée de 440 px avec les onglets en bas', async ({
  page,
}) => {
  await login(page);
  const row = await page.getByTestId('patient-12').boundingBox();
  const tab = await page.getByTestId('tab-transmissions').boundingBox();
  const viewport = page.viewportSize();
  expect(row && tab && viewport).toBeTruthy();
  if (!row || !tab || !viewport) return;
  expect(row.width).toBeLessThanOrEqual(440);
  // Centrée : même marge à gauche et à droite (à quelques pixels près).
  const left = row.x;
  const right = viewport.width - (row.x + row.width);
  expect(Math.abs(left - right)).toBeLessThan(4);
  expect(tab.y + tab.height).toBeGreaterThan(viewport.height - 4);
});
