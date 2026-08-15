import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import type { FiveRoundDailyCase, RoundTier } from '@whereabouts/case-content';
import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import type {
  FiveRoundGuess,
  FiveRoundProgress,
} from '@whereabouts/game-engine';

export const FIVE_ROUND_CASE = makeFiveRoundCase();
export const CASE_DATE = FIVE_ROUND_CASE.publicationDate;
export const CASE_REVISION = FIVE_ROUND_CASE.revision;
export const CASE_STORAGE_KEY = `whereabouts:case:${CASE_DATE}`;
export const E2E_HARNESS_PATH = `/@fs${fileURLToPath(
  new URL('./five-round-harness.html', import.meta.url),
)}`;

export const FIRST_ROUND = FIVE_ROUND_CASE.rounds[0] ?? null;
export const FIRST_ROUND_TARGET = FIRST_ROUND
  ? (FIVE_ROUND_CASE.pois.find((poi) => poi.id === FIRST_ROUND.targetPoiId) ??
    null)
  : null;
export const FIRST_GUESS_RESULT =
  FIRST_ROUND?.results.find((result) => result.tier !== 'correct') ?? null;
export const FIRST_GUESS = FIRST_GUESS_RESULT
  ? (FIVE_ROUND_CASE.pois.find((poi) => poi.id === FIRST_GUESS_RESULT.poiId) ??
    null)
  : null;

const scoreByTier: Record<RoundTier, 100 | 75 | 50 | 25> = {
  correct: 100,
  hot: 75,
  warm: 50,
  cold: 25,
};

export function expectedScore(tier: RoundTier): 100 | 75 | 50 | 25 {
  return scoreByTier[tier];
}

export function makeFiveRoundGuess(
  caseData: FiveRoundDailyCase,
  roundIndex: number,
  poiId: string,
): FiveRoundGuess {
  const round = caseData.rounds[roundIndex];
  const result = round?.results.find((candidate) => candidate.poiId === poiId);
  if (!round || !result) {
    throw new Error(
      `Missing authored result for round ${roundIndex + 1} and ${poiId}`,
    );
  }
  return {
    roundId: round.id,
    poiId,
    tier: result.tier,
    points: expectedScore(result.tier),
  };
}

export function makeCompletedFiveRoundProgress(
  caseData: FiveRoundDailyCase,
  completedAt = `${CASE_DATE}T12:00:00.000Z`,
): FiveRoundProgress {
  return {
    schemaVersion: 2,
    caseDate: caseData.publicationDate,
    caseRevision: caseData.revision,
    guesses: caseData.rounds.map((round, index) =>
      makeFiveRoundGuess(caseData, index, round.targetPoiId),
    ),
    acknowledgedRoundCount: caseData.rounds.length,
    completedAt,
  };
}

export async function setClock(
  page: Page,
  isoTime = `${CASE_DATE}T12:00:00.000Z`,
): Promise<void> {
  await page.clock.install({ time: new Date(isoTime) });
}

async function seedStoredProgress(
  page: Page,
  progress: FiveRoundProgress,
): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    },
    { key: CASE_STORAGE_KEY, value: progress },
  );
}

export async function seedFiveRoundProgress(
  page: Page,
  progress: Partial<FiveRoundProgress>,
): Promise<void> {
  await seedStoredProgress(page, {
    schemaVersion: 2,
    caseDate: CASE_DATE,
    caseRevision: CASE_REVISION,
    guesses: [],
    acknowledgedRoundCount: 0,
    ...progress,
  });
}

export async function readProgress(page: Page): Promise<unknown> {
  return page.evaluate((key) => {
    const serialized = localStorage.getItem(key);
    return serialized === null ? null : JSON.parse(serialized);
  }, CASE_STORAGE_KEY);
}

export async function disableWebGl(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.getContext = function getContext(
      contextId: string,
      ...args: unknown[]
    ) {
      if (contextId === 'webgl' || contextId === 'webgl2') return null;
      return Reflect.apply(nativeGetContext, this, [contextId, ...args]);
    } as HTMLCanvasElement['getContext'];
  });
}
