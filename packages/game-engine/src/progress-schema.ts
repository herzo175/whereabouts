export type FiveRoundGuess = {
  roundId: string;
  poiId: string;
  points: number;
};

export type FiveRoundProgress = {
  schemaVersion: 3;
  caseDate: string;
  caseRevision: number;
  guesses: FiveRoundGuess[];
  acknowledgedRoundCount: number;
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

function completedAt(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !datetimePattern.test(value)) {
    fail('completedAt', 'must be an ISO datetime');
  }
  return value;
}

export const fiveRoundProgressSchema: Schema<FiveRoundProgress> = {
  parse(value) {
    const parsed = record(value);
    if (parsed.schemaVersion !== 3) fail('schemaVersion', 'must equal 3');
    if (!Array.isArray(parsed.guesses)) fail('guesses', 'must be an array');
    const guesses = parsed.guesses.map((value, index) => {
      const guess = record(value);
      if (
        !Number.isInteger(guess.points) ||
        (guess.points as number) < 0 ||
        (guess.points as number) > 100
      )
        fail(`guesses[${index}].points`, 'must be an integer from 0 to 100');
      if (typeof guess.roundId !== 'string' || !guess.roundId)
        fail(`guesses[${index}].roundId`, 'must be a string');
      if (typeof guess.poiId !== 'string' || !guess.poiId)
        fail(`guesses[${index}].poiId`, 'must be a string');
      return {
        roundId: guess.roundId,
        poiId: guess.poiId,
        points: guess.points as number,
      };
    });
    if (guesses.length > 5)
      fail('guesses', 'must contain at most five guesses');
    if (
      !Number.isInteger(parsed.acknowledgedRoundCount) ||
      (parsed.acknowledgedRoundCount as number) < 0 ||
      (parsed.acknowledgedRoundCount as number) > guesses.length ||
      guesses.length - (parsed.acknowledgedRoundCount as number) > 1
    ) {
      fail(
        'acknowledgedRoundCount',
        'must leave at most one submitted round awaiting reveal',
      );
    }
    const parsedCompletedAt = completedAt(parsed.completedAt);
    if (guesses.length === 5 && parsedCompletedAt === undefined)
      fail('completedAt', 'is required after round five');
    if (guesses.length < 5 && parsedCompletedAt !== undefined)
      fail('completedAt', 'is only allowed after round five');
    return {
      schemaVersion: 3,
      caseDate: date(parsed.caseDate),
      caseRevision: positiveInteger(parsed.caseRevision),
      guesses,
      acknowledgedRoundCount: parsed.acknowledgedRoundCount as number,
      ...(parsedCompletedAt ? { completedAt: parsedCompletedAt } : {}),
    };
  },
};
