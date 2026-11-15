import { createApiClient } from '@infirmier/domain';
import { test as base, expect, type Page } from '@playwright/test';

export const API_URL = 'http://localhost:8788';
export const api = createApiClient({ baseUrl: API_URL });

/** Chaque test repart de la journée de Chirurgie « Bino » rejouée jusqu'au bout (état déterministe). */
export const test = base.extend<{ resetHospital: void }>({
  resetHospital: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright exige une déstructuration en 1er argument.
    async ({}, use) => {
      await api.loadScenario({ body: { scenarioId: 'chir-bino', until: 'end' } });
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/** « Qui es-tu ? » : un toucher sur le soignant (Martine par défaut) → Patients. */
export async function login(page: Page, nurseId = 'martine') {
  await page.goto('/');
  await page.getByTestId(`soignant-${nurseId}`).click();
  await expect(page.getByTestId('patient-12')).toBeVisible();
}

/** Ordre des cartes affichées, par numéro de chambre (testID `<prefixe>-<chambre>`). */
export async function roomsInOrder(page: Page, prefix: 'patient' | 'resume'): Promise<string[]> {
  const ids = await page
    .locator(`[data-testid^="${prefix}-"]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));
  return ids.map((id) => id.slice(prefix.length + 1));
}
