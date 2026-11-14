import { createApiClient } from '@infirmier/domain';
import { test as base, expect, type Page } from '@playwright/test';

export const API_URL = 'http://localhost:8788';
export const api = createApiClient({ baseUrl: API_URL });

/** Chaque test repart d'une journée Réa rejouée (état déterministe). */
export const test = base.extend<{ resetHospital: void }>({
  resetHospital: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright exige une déstructuration en 1er argument.
    async ({}, use) => {
      await api.loadScenario({ body: { scenarioId: 'rea-box12', until: 'end' } });
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/** Prise de poste : Martine, Réanimation. */
export async function signIn(page: Page, nurse = 'martine') {
  await page.goto('/');
  await page.getByTestId(`soignant-${nurse}`).click();
  await page.getByRole('button', { name: 'Prendre mon poste' }).click();
  await expect(page.getByText('Mes patients')).toBeVisible();
}
