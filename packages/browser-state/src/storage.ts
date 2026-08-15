import type { FiveRoundDailyCase } from '@whereabouts/case-content';
import {
  createFiveRoundProgress,
  type FiveRoundProgress,
  fiveRoundProgressSchema,
  getCurrentRound,
} from '@whereabouts/game-engine';

type ProgressSchema<T> = {
  parse(value: unknown): T;
};

function storageKey(caseDate: string): string {
  return `whereabouts:case:${caseDate}`;
}

function parseProgress<T>(value: unknown, schema: ProgressSchema<T>): T | null {
  try {
    return schema.parse(value);
  } catch {
    return null;
  }
}

export function loadProgress(
  caseData: FiveRoundDailyCase,
  storage?: Storage,
): FiveRoundProgress;
export function loadProgress(
  caseData: FiveRoundDailyCase,
  storage: Storage = window.localStorage,
): FiveRoundProgress {
  const freshProgress = createFiveRoundProgress(caseData);
  try {
    const serialized = storage.getItem(storageKey(caseData.publicationDate));
    if (serialized === null) return freshProgress;

    const progress = parseProgress(
      JSON.parse(serialized),
      fiveRoundProgressSchema,
    );
    if (
      progress === null ||
      progress.caseDate !== caseData.publicationDate ||
      progress.caseRevision !== caseData.revision
    ) {
      return freshProgress;
    }
    getCurrentRound(caseData, progress);
    return progress;
  } catch {
    return freshProgress;
  }
}

export function saveProgress(
  progress: FiveRoundProgress,
  storage: Storage = window.localStorage,
): void {
  try {
    storage.setItem(storageKey(progress.caseDate), JSON.stringify(progress));
  } catch {}
}

export function clearProgress(
  caseDate: string,
  storage: Storage = window.localStorage,
): void {
  try {
    storage.removeItem(storageKey(caseDate));
  } catch {}
}
