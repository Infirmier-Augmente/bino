import { expect, type Page, test } from '@playwright/test';

const NOTE =
  'Repère bino 4815. Alors monsieur du box 12. Neuro, Glasgow 15, plus de sédation depuis ce matin. Respi, il a été extubé vers 10h. Par contre vers 16h il était agité.';

const SURGERY = ['Keller', 'Fontaine', 'Moreau'];

async function login(page: Page, matricule = '10482', password = 'bino') {
  await page.goto('/');
  await page.locator('#login-id').fill(matricule);
  await page.locator('#login-pw').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

async function enterWard(page: Page) {
  await login(page);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('Mme Bernard')).toBeVisible();
}

test('un mauvais mot de passe reste sur la connexion', async ({ page }) => {
  await login(page, '10482', 'autre');
  await expect(page.getByText('Matricule ou mot de passe incorrect.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
});

test('la liste est le service de réa, sans le service de chirurgie', async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      'bino-settings',
      JSON.stringify({ matricule: '10482', name: 'Martine Dubois · IDE' }),
    );
  });
  await page.route('**/api/bino/**', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByText('Chargement…')).toBeVisible();
  for (const name of SURGERY) await expect(page.getByText(name)).toHaveCount(0);
  release();
  await expect(page.getByText('Mme Bernard')).toBeVisible();
  await expect(page.getByText('M. Nguyen')).toBeVisible();
  await expect(page.getByText('M. Durand')).toBeVisible();
  await expect(page.getByText('Mme Lefèvre')).toBeVisible();
  await expect(page.locator('.count')).toHaveText('4');
  for (const name of SURGERY) await expect(page.getByText(name)).toHaveCount(0);
});

test('le dossier ne invente pas de constantes', async ({ page }) => {
  await enterWard(page);
  await page.getByRole('button', { name: /Mme Bernard/ }).click();
  await page.getByRole('button', { name: 'Dossier médical' }).click();
  await expect(page.getByText('Constantes non fournies par le service.')).toBeVisible();
});

test('Valider une fois range la dictée, un second clic ne la duplique pas', async ({ page }) => {
  await enterWard(page);
  await page.getByRole('button', { name: /M\. Durand/ }).click();
  await page.locator('#draft').fill(NOTE);
  const posts: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/bino/transmissions'))
      posts.push(req.url());
  });
  await page.evaluate(() => {
    const button = document.querySelector('[data-act="saveCr"]');
    if (button instanceof HTMLButtonElement) {
      button.click();
      button.click();
    }
  });
  await expect(page.getByText('Compte rendu fait')).toBeVisible();
  await expect.poll(() => posts.length).toBe(1);
  await page.getByRole('button', { name: 'Transmissions' }).click();
  await expect(page.getByText(/bino 4815/)).toHaveCount(1);

  const detail = await page.request.get('/api/bino/patients/rea-12');
  expect(detail.ok()).toBeTruthy();
  const body = (await detail.json()) as {
    transmissions: {
      dictation: { transcript: string };
      engine: { structuring: string; degraded: boolean };
    }[];
  };
  const saved = body.transmissions.find((t) => t.dictation.transcript.includes('bino 4815'));
  expect(saved?.engine.structuring).toBe('heuristic');
  expect(saved?.engine.degraded).toBe(false);
});

test('un autre navigateur ne voit pas la note', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const a = await first.newPage();
  const b = await second.newPage();
  await enterWard(a);
  await a.getByRole('button', { name: /Mme Lefèvre/ }).click();
  await a
    .locator('#draft')
    .fill('Box 14, madame Lefèvre a vomi vers 15h, je lui ai donné du Primpéran.');
  await a.getByRole('button', { name: 'Valider' }).click();
  await expect(a.getByText('Compte rendu fait')).toBeVisible();
  await a.getByRole('button', { name: 'Transmissions' }).click();
  await expect(a.getByText(/Primpéran/)).toBeVisible();

  await enterWard(b);
  await b.getByRole('button', { name: 'Transmissions' }).click();
  await expect(b.getByText(/Primpéran/)).toHaveCount(0);
  await first.close();
  await second.close();
});

test('sur ordinateur le micro envoie l’audio et écrit le texte', async ({ page }) => {
  await page.route('**/api/bino/transcriptions', (route) =>
    route.fulfill({
      json: { text: 'Le pansement est sec.', durationSec: 1, engine: 'test' },
    }),
  );
  await enterWard(page);
  await page.getByRole('button', { name: /M\. Nguyen/ }).click();
  await page.getByRole('button', { name: 'Dicter le compte rendu' }).click();
  await expect(page.getByText('Écoute…')).toBeVisible();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Arrêter la dictée' }).click();
  await expect(page.locator('#draft')).toHaveValue('Le pansement est sec.');
});

test('la recherche et la priorité restent sur le patient choisi', async ({ page }) => {
  await enterWard(page);
  await page.getByRole('button', { name: 'Transmissions' }).click();
  await page.getByRole('button', { name: 'Tous' }).click();
  await page.getByLabel('Rechercher un patient').fill('Bernard');
  await expect(page.getByText('Mme Bernard')).toBeVisible();
  await expect(page.getByText('M. Durand')).toHaveCount(0);
  await page.getByRole('button', { name: /Mme Bernard : Priorité/ }).click();
  await page.getByRole('button', { name: 'Priorité 1', exact: true }).click();
  await expect(page.getByRole('button', { name: /Mme Bernard : Priorité 1/ })).toBeVisible();
});

test('confirmer la relève affiche la validation', async ({ page }) => {
  await enterWard(page);
  await page.getByRole('button', { name: 'Transmissions' }).click();
  await page.getByRole('button', { name: 'Transmettre' }).click();
  await expect(page.getByText('Valider la transmission ?')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByText('Transmission validée.')).toBeVisible();
});
