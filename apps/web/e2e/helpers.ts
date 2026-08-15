import { readFileSync } from 'node:fs';

import type { Page } from '@playwright/test';

export const CASE_DATE = '2026-08-14';
export const CASE_STORAGE_KEY = `whereabouts:case:${CASE_DATE}`;

type CaseFixture = {
  contextualResponses: Array<{ poiId: string; text: string }>;
  pois: Array<{ id: string; name: string }>;
  revision: number;
  target: { poiId: string; destinationName: string };
};

const manifestPath = new URL(
  '../../../packages/case-content/content/manifest.json',
  import.meta.url,
);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  cases: Record<string, { file: string; revision: number }>;
};
const manifestEntry = manifest.cases[CASE_DATE];
if (!manifestEntry) throw new Error(`Missing fixture case for ${CASE_DATE}`);

const casePath = new URL(
  `../../../packages/case-content/content/cases/${CASE_DATE}/v${manifestEntry.revision}.json`,
  import.meta.url,
);
const caseFixture = JSON.parse(readFileSync(casePath, 'utf8')) as CaseFixture;
export const CASE_REVISION = caseFixture.revision;
export const TARGET = caseFixture.target;
export const DISTRACTORS = caseFixture.pois.filter(
  (poi) => poi.id !== TARGET.poiId,
);
export const FIRST_DISTRACTOR = DISTRACTORS[0];
export const FIRST_RESPONSE = caseFixture.contextualResponses.find(
  (response) => response.poiId === FIRST_DISTRACTOR.id,
);

if (!FIRST_RESPONSE) {
  throw new Error(`Missing contextual response for ${FIRST_DISTRACTOR.name}`);
}

type Outcome = 'playing' | 'won' | 'lost';

export type StoredProgress = {
  schemaVersion: 1;
  caseDate: typeof CASE_DATE;
  caseRevision: number;
  guessedPoiIds: string[];
  outcome: Outcome;
  completedAt?: string;
};

export async function setClock(
  page: Page,
  isoTime = '2026-08-14T12:00:00.000Z',
): Promise<void> {
  await page.clock.install({ time: new Date(isoTime) });
}

export async function seedProgress(
  page: Page,
  progress: Partial<StoredProgress>,
): Promise<void> {
  const storedProgress: StoredProgress = {
    schemaVersion: 1,
    caseDate: CASE_DATE,
    caseRevision: CASE_REVISION,
    guessedPoiIds: [],
    outcome: 'playing',
    ...progress,
  };

  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    },
    { key: CASE_STORAGE_KEY, value: storedProgress },
  );
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
