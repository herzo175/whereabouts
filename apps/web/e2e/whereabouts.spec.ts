import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import {
  CASE_DATE,
  CASE_STORAGE_KEY,
  DISTRACTORS,
  disableWebGl,
  FIRST_DISTRACTOR,
  FIRST_RESPONSE,
  readProgress,
  seedProgress,
  setClock,
  TARGET,
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
    await expect(intelligence.getByText('Clue 1')).toHaveCount(1);

    await submitLead(page, FIRST_DISTRACTOR.name);

    await expect(page.getByText(FIRST_RESPONSE.text)).toBeVisible();
    await expect(intelligence.getByText('Clue 2')).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: /Attempt 1,/ }),
    ).toBeVisible();
  });

  test('wins through the dossier and copies an exact spoiler-free share result', async ({
    page,
  }) => {
    await openCase(page);
    await submitLead(page, TARGET.destinationName);

    await expect(
      page.getByRole('heading', { name: 'Case closed' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Copy result' }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();

    const shareText = await page.evaluate(() => navigator.clipboard.readText());
    expect(shareText).toBe(
      `WHEREABOUTS 1/6\n🟢\nhttp://127.0.0.1:3000/${CASE_DATE}`,
    );
    expect(shareText).not.toContain(TARGET.destinationName);
  });

  test('shows a six-attempt loss from saved progress', async ({ page }) => {
    await seedProgress(page, {
      completedAt,
      guessedPoiIds: DISTRACTORS.slice(0, 6).map((poi) => poi.id),
      outcome: 'lost',
    });
    await openCase(page);

    await expect(
      page.getByRole('heading', { name: 'Trail lost' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Attempt 6,/ }),
    ).toBeVisible();
  });

  test('resumes saved progress and recovers from corrupt storage', async ({
    page,
  }) => {
    await seedProgress(page, { guessedPoiIds: [FIRST_DISTRACTOR.id] });
    await openCase(page);
    await expect(
      page.getByRole('button', { name: /Attempt 1,/ }),
    ).toBeVisible();
    await expect(readProgress(page)).resolves.toMatchObject({
      guessedPoiIds: [FIRST_DISTRACTOR.id],
      outcome: 'playing',
    });

    await page.reload();
    await expect(
      page.getByRole('button', { name: /Attempt 1,/ }),
    ).toBeVisible();
    await page.evaluate(
      (key) => localStorage.setItem(key, '{not json'),
      CASE_STORAGE_KEY,
    );
    await page.reload();

    await expect(page.getByTestId('empty-attempt')).toHaveCount(6);
  });

  test('disables locations that have already been guessed', async ({
    page,
  }) => {
    await seedProgress(page, { guessedPoiIds: [FIRST_DISTRACTOR.id] });
    await openCase(page);
    await page
      .getByRole('searchbox', { name: 'Search locations' })
      .fill(FIRST_DISTRACTOR.name);

    const guess = page
      .getByRole('list', { name: 'Matching locations' })
      .getByRole('button', { name: FIRST_DISTRACTOR.name });
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

    await submitLead(page, TARGET.destinationName);
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
      .fill(FIRST_DISTRACTOR.name);
    await page.getByRole('button', { name: FIRST_DISTRACTOR.name }).click();

    const dossier = page.getByRole('dialog');
    await expect(
      dossier.getByRole('heading', { name: FIRST_DISTRACTOR.name }),
    ).toBeVisible();
    await dossier.getByRole('button', { name: 'Submit this lead' }).click();
    await expect(page.getByText(FIRST_RESPONSE.text)).toBeVisible();
  });
});
