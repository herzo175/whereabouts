import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { getScoreBand } from '@whereabouts/game-engine';

import {
  CASE_DATE,
  CASE_STORAGE_KEY,
  disableWebGl,
  E2E_HARNESS_PATH,
  FIRST_GUESS,
  FIRST_GUESS_RESULT,
  FIRST_ROUND,
  FIRST_ROUND_TARGET,
  FIVE_ROUND_CASE,
  makeCompletedFiveRoundProgress,
  makeFiveRoundGuess,
  readProgress,
  seedFiveRoundProgress,
  setClock,
} from './helpers';

const casePath = `/${CASE_DATE}`;
const completedAt = `${CASE_DATE}T12:00:00.000Z`;

function requireFiveRoundFixture() {
  if (
    !FIRST_ROUND ||
    !FIRST_ROUND_TARGET ||
    !FIRST_GUESS ||
    !FIRST_GUESS_RESULT
  ) {
    throw new Error('The E2E case is not a complete five-round fixture');
  }
  return {
    caseData: FIVE_ROUND_CASE,
    firstGuess: FIRST_GUESS,
    firstResult: FIRST_GUESS_RESULT,
    firstRound: FIRST_ROUND,
    firstTarget: FIRST_ROUND_TARGET,
  };
}

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

async function openGame(page: Page): Promise<void> {
  await page.goto(E2E_HARNESS_PATH);
  await expect(
    page.getByRole('heading', { name: 'Whereabouts' }),
  ).toBeVisible();
}

async function submitLead(page: Page, name: string): Promise<void> {
  await page.getByRole('searchbox', { name: 'Search locations' }).fill(name);
  await page
    .getByRole('list', { name: 'Matching locations' })
    .getByRole('button', { name: new RegExp(name) })
    .click();
  const dossier = page.getByRole('dialog');
  await expect(dossier.getByRole('heading', { name })).toBeVisible();
  await dossier.getByRole('button', { name: 'Submit this lead' }).click();
}

async function playPerfectDailyGame(page: Page): Promise<void> {
  const { caseData } = requireFiveRoundFixture();
  for (const [index, round] of caseData.rounds.entries()) {
    const target = caseData.pois.find((poi) => poi.id === round.targetPoiId);
    if (!target) throw new Error(`Missing target for round ${index + 1}`);
    await submitLead(page, target.name);
    await expect(
      page.getByRole('heading', { name: `Round ${index + 1} revealed` }),
    ).toBeVisible();
    await expect(page.getByText('Correct · 100 points')).toBeVisible();
    await page
      .getByRole('button', {
        name: index === 4 ? 'View daily summary' : 'Next round',
      })
      .click();
  }
  await expect(
    page.getByRole('heading', { name: 'Daily score' }),
  ).toBeVisible();
  await expect(page.getByText('500 / 500')).toBeVisible();
}

const emojiByTier = {
  correct: '🟢',
  hot: '🟠',
  warm: '🟡',
  cold: '🔵',
} as const;

test.describe('Whereabouts five-round desktop journeys', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop coverage only.');

  test.beforeEach(async ({ context, page }) => {
    await setClock(page);
    await mockClipboard(context, page);
  });

  test('redirects the root route to today and reports the empty publication', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveURL(new RegExp(`${casePath}$`));
    await expect(
      page.getByRole('heading', { name: 'Briefing unavailable' }),
    ).toBeVisible();
    await expect(page.getByText(CASE_DATE)).toBeVisible();
  });

  test('shows the photograph and clue without leaking the candidate dossier', async ({
    page,
  }) => {
    const { firstGuess, firstRound } = requireFiveRoundFixture();
    await openGame(page);

    await expect(page.getByText('Round 1 / 5')).toBeVisible();
    await expect(page.getByText(firstRound.clue.text)).toBeVisible();
    await expect(
      page.getByRole('img', { name: 'Round 1 target photograph' }),
    ).toHaveAttribute('src', firstRound.image.url);

    await page
      .getByRole('searchbox', { name: 'Search locations' })
      .fill(firstGuess.name);
    await page
      .getByRole('list', { name: 'Matching locations' })
      .getByRole('button', { name: new RegExp(firstGuess.name) })
      .click();
    const dossier = page.getByRole('dialog');
    await expect(
      dossier.getByRole('heading', { name: firstGuess.name }),
    ).toBeVisible();
    if (firstGuess.image) {
      await expect(
        dossier.getByRole('img', { name: firstGuess.image.alt }),
      ).toHaveCount(0);
    }
    if (firstGuess.blurb)
      await expect(dossier.getByText(firstGuess.blurb)).toHaveCount(0);
  });

  test('reveals the authored similarity and both dossiers after one guess', async ({
    page,
  }) => {
    const { firstGuess, firstResult, firstTarget } = requireFiveRoundFixture();
    await openGame(page);
    await submitLead(page, firstGuess.name);

    const tier = getScoreBand(firstResult.points);
    await expect(
      page.getByRole('heading', { name: 'Round 1 revealed' }),
    ).toBeVisible();
    await expect(
      page.getByText(new RegExp(`${tier} · ${firstResult.points} points`, 'i')),
    ).toBeVisible();
    await expect(page.getByText(firstResult.text)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: firstGuess.name }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: firstTarget.name }),
    ).toBeVisible();
  });

  test('resumes the next round and recovers from corrupt storage', async ({
    page,
  }) => {
    const { caseData, firstGuess } = requireFiveRoundFixture();
    const firstStoredGuess = makeFiveRoundGuess(caseData, 0, firstGuess.id);
    await seedFiveRoundProgress(page, {
      guesses: [firstStoredGuess],
      acknowledgedRoundCount: 1,
    });
    await openGame(page);

    await expect(page.getByText('Round 2 / 5')).toBeVisible();
    await expect(readProgress(page)).resolves.toMatchObject({
      schemaVersion: 3,
      guesses: [firstStoredGuess],
    });

    await page.reload();
    await expect(page.getByText('Round 2 / 5')).toBeVisible();
    await page.evaluate(
      (key) => localStorage.setItem(key, '{not json'),
      CASE_STORAGE_KEY,
    );
    await page.reload();
    await expect(page.getByText('Round 1 / 5')).toBeVisible();
  });

  test('disables targets revealed by earlier rounds', async ({ page }) => {
    const { firstGuess, firstTarget } = requireFiveRoundFixture();
    await openGame(page);
    await submitLead(page, firstGuess.name);
    await page.getByRole('button', { name: 'Next round' }).click();

    await page
      .getByRole('searchbox', { name: 'Search locations' })
      .fill(firstTarget.name);
    const target = page
      .getByRole('list', { name: 'Matching locations' })
      .getByRole('button', { name: new RegExp(firstTarget.name) });
    await expect(target).toBeDisabled();
    await expect(target).toContainText('Already eliminated');
  });

  test('restores a finished game and copies the derived spoiler-free score', async ({
    page,
  }) => {
    const { caseData } = requireFiveRoundFixture();
    const completed = makeCompletedFiveRoundProgress(caseData, completedAt);
    await seedFiveRoundProgress(page, completed);
    await openGame(page);

    const total = completed.guesses.reduce(
      (sum, guess) => sum + guess.points,
      0,
    );
    await expect(
      page.getByRole('heading', { name: 'Daily score' }),
    ).toBeVisible();
    await expect(page.getByText(`${total} / 500`)).toBeVisible();
    await page.getByRole('button', { name: 'Copy result' }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();

    const shareText = await page.evaluate(() => navigator.clipboard.readText());
    expect(shareText).toBe(
      [
        'WHEREABOUTS',
        completed.guesses
          .map((guess) => emojiByTier[getScoreBand(guess.points)])
          .join(' '),
        `${total} / 500`,
        `http://127.0.0.1:3000/${CASE_DATE}`,
      ].join('\n'),
    );
    for (const round of caseData.rounds) {
      const target = caseData.pois.find((poi) => poi.id === round.targetPoiId);
      if (target) expect(shareText).not.toContain(target.name);
    }
  });

  test('plays all five rounds and accumulates the final score', async ({
    page,
  }) => {
    await openGame(page);
    await playPerfectDailyGame(page);
  });

  test('handles unpublished and invalid date routes', async ({ page }) => {
    const unpublishedDate = '2999-12-31';
    await page.goto(`/${unpublishedDate}`);
    await expect(
      page.getByRole('heading', { name: 'Briefing unavailable' }),
    ).toBeVisible();
    await expect(page.getByText(unpublishedDate)).toBeVisible();

    await page.goto('/2026-02-30');
    await expect(
      page.getByRole('heading', { name: /not found/i }),
    ).toBeVisible();
  });

  test('falls back to the location list when WebGL is unavailable', async ({
    page,
  }) => {
    const { firstGuess } = requireFiveRoundFixture();
    await disableWebGl(page);
    await openGame(page);
    await expect(
      page.getByText('Globe unavailable; use location list'),
    ).toBeVisible();

    await submitLead(page, firstGuess.name);
    await expect(
      page.getByRole('heading', { name: 'Round 1 revealed' }),
    ).toBeVisible();
  });
});

test.describe('Whereabouts five-round mobile journey', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobile coverage only.');

  test.beforeEach(async ({ page }) => {
    await setClock(page);
    await disableWebGl(page);
  });

  test('plays the complete daily game on mobile', async ({ page }) => {
    await openGame(page);
    await playPerfectDailyGame(page);
  });
});
