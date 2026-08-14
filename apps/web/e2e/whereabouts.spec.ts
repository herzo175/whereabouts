import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import {
  CASE_DATE,
  CASE_STORAGE_KEY,
  disableWebGl,
  readProgress,
  seedProgress,
  setClock,
} from './helpers';

const casePath = `/${CASE_DATE}`;
const completedAt = '2026-08-14T12:00:00.000Z';

async function mockClipboard(
  context: BrowserContext,
  page: Page,
): Promise<void> {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:3000',
  });
  await page.addInitScript(() => {
    let copiedText = '';
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: async () => copiedText,
        writeText: async (text: string) => {
          copiedText = text;
        },
      },
    });
  });
}

async function openCase(page: Page): Promise<void> {
  await page.goto(casePath);
  await expect(
    page.getByRole('heading', { name: 'Whereabouts' }),
  ).toBeVisible();
}

async function submitLead(page: Page, name: string): Promise<void> {
  await page.getByRole('searchbox', { name: 'Search locations' }).fill(name);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  const dossier = page.getByRole('dialog');
  await expect(dossier.getByRole('heading', { name })).toBeVisible();
  await dossier.getByRole('button', { name: 'Submit this lead' }).click();
}

test.describe('Whereabouts desktop journeys', () => {
  test.beforeEach(async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop coverage only.');
    await setClock(page);
    await mockClipboard(context, page);
  });

  test('redirects the root route to the fixed local date', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(new RegExp(`${casePath}$`));
    await expect(
      page.getByRole('heading', { name: 'Whereabouts' }),
    ).toBeVisible();
  });

  test('reveals contextual feedback and the next clue after a wrong lead', async ({
    page,
  }) => {
    await openCase(page);
    const intelligence = page.getByLabel('Case intelligence');
    await expect(intelligence.getByText('Current intelligence')).toHaveCount(1);

    await submitLead(page, 'Eiffel Tower');

    await expect(
      page.getByText(/nineteenth-century Parisian monument/i),
    ).toBeVisible();
    await expect(intelligence.getByText('Current intelligence')).toHaveCount(2);
    await expect(page.getByText('5 attempts remaining')).toBeVisible();
  });

  test('wins through the dossier and copies an exact spoiler-free share result', async ({
    page,
  }) => {
    await openCase(page);
    await submitLead(page, 'Hagia Sophia');

    await expect(
      page.getByRole('heading', { name: 'Case closed' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Share result' }).click();
    await expect(page.getByText('Result copied to clipboard.')).toBeVisible();

    const shareText = await page.evaluate(() => navigator.clipboard.readText());
    expect(shareText).toBe(
      `WHEREABOUTS 001  1/6\n🟢\nhttp://127.0.0.1:3000/${CASE_DATE}`,
    );
    expect(shareText).not.toContain('Hagia Sophia');
    expect(shareText).not.toContain('Istanbul');
  });

  test('shows a six-attempt loss from saved progress', async ({ page }) => {
    await seedProgress(page, {
      completedAt,
      guessedPoiIds: [
        'eiffel-tower',
        'colosseum',
        'great-wall',
        'taj-mahal',
        'christ-redeemer',
        'machu-picchu',
      ],
      outcome: 'lost',
    });
    await openCase(page);

    await expect(
      page.getByRole('heading', { name: 'Trail lost' }),
    ).toBeVisible();
    await expect(page.getByText('0 attempts remaining')).toBeVisible();
  });

  test('resumes saved progress and recovers from corrupt storage', async ({
    page,
  }) => {
    await seedProgress(page, { guessedPoiIds: ['eiffel-tower'] });
    await openCase(page);
    await expect(page.getByText('5 attempts remaining')).toBeVisible();
    await expect(readProgress(page)).resolves.toMatchObject({
      guessedPoiIds: ['eiffel-tower'],
      outcome: 'playing',
    });

    await page.reload();
    await expect(page.getByText('5 attempts remaining')).toBeVisible();
    await page.evaluate(
      (key) => localStorage.setItem(key, '{not json'),
      CASE_STORAGE_KEY,
    );
    await page.reload();

    await expect(page.getByText('6 attempts remaining')).toBeVisible();
  });

  test('disables locations that have already been guessed', async ({
    page,
  }) => {
    await seedProgress(page, { guessedPoiIds: ['eiffel-tower'] });
    await openCase(page);
    await page
      .getByRole('searchbox', { name: 'Search locations' })
      .fill('Eiffel Tower');

    const guess = page.getByRole('button', { name: /Eiffel Tower/ });
    await expect(guess).toBeDisabled();
    await expect(guess).toContainText('Already eliminated');
  });

  test('handles unpublished and invalid date routes', async ({ page }) => {
    await page.goto('/2026-08-15');
    await expect(
      page.getByRole('heading', { name: 'Briefing unavailable' }),
    ).toBeVisible();
    await expect(page.getByText('2026-08-15')).toBeVisible();

    await page.goto('/2026-02-30');
    await expect(
      page.getByRole('heading', { name: /not found/i }),
    ).toBeVisible();
  });

  test('falls back to the location list when WebGL is unavailable', async ({
    page,
  }) => {
    await disableWebGl(page);
    await openCase(page);
    await expect(
      page.getByText('Globe unavailable; use location list'),
    ).toBeVisible();

    await submitLead(page, 'Hagia Sophia');
    await expect(
      page.getByRole('heading', { name: 'Case closed' }),
    ).toBeVisible();
  });
});

test.describe('Whereabouts mobile journey', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile coverage only.');
    await setClock(page);
    await disableWebGl(page);
  });

  test('confirms a dossier from the mobile sheet', async ({ page }) => {
    await openCase(page);
    await page
      .getByRole('searchbox', { name: 'Search locations' })
      .fill('Colosseum');
    await page.getByRole('button', { name: /Colosseum/ }).click();

    const dossier = page.getByRole('dialog');
    await expect(
      dossier.getByRole('heading', { name: 'Colosseum' }),
    ).toBeVisible();
    await dossier.getByRole('button', { name: 'Submit this lead' }).click();
    await expect(
      page.getByText(/Roman amphitheater shares an imperial past/i),
    ).toBeVisible();
  });
});
