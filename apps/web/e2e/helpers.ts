import type { Page } from '@playwright/test';

export const CASE_DATE = '2026-08-14';
export const CASE_STORAGE_KEY = `whereabouts:case:${CASE_DATE}`;

type Outcome = 'playing' | 'won' | 'lost';

export type StoredProgress = {
  schemaVersion: 1;
  caseDate: typeof CASE_DATE;
  caseRevision: 1;
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
    caseRevision: 1,
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
