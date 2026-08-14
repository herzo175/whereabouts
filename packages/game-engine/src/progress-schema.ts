export type GameProgress = {
  schemaVersion: 1;
  caseDate: string;
  caseRevision: number;
  guessedPoiIds: string[];
  outcome: 'playing' | 'won' | 'lost';
  completedAt?: string;
};

type Schema<T> = { parse(value: unknown): T };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const datetimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('game progress', 'must be an object');
  }
  return value as Record<string, unknown>;
}

function date(value: unknown): string {
  if (typeof value !== 'string' || !datePattern.test(value)) {
    fail('caseDate', 'must be an ISO date');
  }
  return value;
}

function positiveInteger(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    fail('caseRevision', 'must be a positive integer');
  }
  return value as number;
}

function guessedPoiIds(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.some((poiId) => typeof poiId !== 'string')
  ) {
    fail('guessedPoiIds', 'must be an array of strings');
  }
  return [...value] as string[];
}

function outcome(value: unknown): GameProgress['outcome'] {
  if (value !== 'playing' && value !== 'won' && value !== 'lost') {
    fail('outcome', 'must be playing, won, or lost');
  }
  return value;
}

function completedAt(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !datetimePattern.test(value)) {
    fail('completedAt', 'must be an ISO datetime');
  }
  return value;
}

export const gameProgressSchema: Schema<GameProgress> = {
  parse(value) {
    const parsed = record(value);
    if (parsed.schemaVersion !== 1) fail('schemaVersion', 'must equal 1');
    const parsedOutcome = outcome(parsed.outcome);
    const parsedCompletedAt = completedAt(parsed.completedAt);
    if (parsedOutcome === 'playing' && parsedCompletedAt !== undefined) {
      fail('completedAt', 'is only allowed after the case ends');
    }

    return {
      schemaVersion: 1,
      caseDate: date(parsed.caseDate),
      caseRevision: positiveInteger(parsed.caseRevision),
      guessedPoiIds: guessedPoiIds(parsed.guessedPoiIds),
      outcome: parsedOutcome,
      ...(parsedCompletedAt === undefined
        ? {}
        : { completedAt: parsedCompletedAt }),
    };
  },
};
