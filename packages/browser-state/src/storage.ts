import {
  createProgress,
  type GameProgress,
  gameProgressSchema,
} from '@whereabouts/game-engine';

type CaseData = Parameters<typeof createProgress>[0];
type ProgressSchema = typeof gameProgressSchema & {
  safeParse?: (
    value: unknown,
  ) => { success: true; data: GameProgress } | { success: false };
};

function storageKey(caseDate: string): string {
  return `whereabouts:case:${caseDate}`;
}

function parseProgress(value: unknown): GameProgress | null {
  const schema = gameProgressSchema as ProgressSchema;
  if (schema.safeParse !== undefined) {
    const result = schema.safeParse(value);
    return result.success ? result.data : null;
  }

  try {
    return schema.parse(value);
  } catch {
    return null;
  }
}

export function loadProgress(
  caseData: CaseData,
  storage: Storage = window.localStorage,
): GameProgress {
  try {
    const serialized = storage.getItem(storageKey(caseData.publicationDate));
    if (serialized === null) return createProgress(caseData);

    const progress = parseProgress(JSON.parse(serialized));
    if (
      progress === null ||
      progress.caseDate !== caseData.publicationDate ||
      progress.caseRevision !== caseData.revision
    ) {
      return createProgress(caseData);
    }
    return progress;
  } catch {
    return createProgress(caseData);
  }
}

export function saveProgress(
  progress: GameProgress,
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
