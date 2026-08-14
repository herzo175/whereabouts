import type { GameProgress } from './progress-schema.js';
import { gameProgressSchema } from './progress-schema.js';

type RelationshipTier = 'cold' | 'warm' | 'hot';

type DailyCase = {
  publicationDate: string;
  revision: number;
  target: { poiId: string };
  pois: Array<{ id: string }>;
  clues: Array<{ id: string; text: string; sourceIds: string[] }>;
  contextualResponses: Array<{
    poiId: string;
    tier: RelationshipTier;
    text: string;
    sourceIds: string[];
  }>;
};

const maximumAttempts = 6;

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}

function parseProgress(progress: GameProgress): GameProgress {
  try {
    return gameProgressSchema.parse(progress);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid progress';
    throw new GameRuleError(message);
  }
}

function validateForCase(
  caseData: DailyCase,
  progress: GameProgress,
): GameProgress {
  const parsed = parseProgress(progress);
  if (
    parsed.caseDate !== caseData.publicationDate ||
    parsed.caseRevision !== caseData.revision
  ) {
    throw new GameRuleError('Progress does not match this case revision');
  }
  if (parsed.guessedPoiIds.length > maximumAttempts) {
    throw new GameRuleError('Progress has too many guesses');
  }
  if (new Set(parsed.guessedPoiIds).size !== parsed.guessedPoiIds.length) {
    throw new GameRuleError('Progress contains duplicate guesses');
  }
  const knownPoiIds = new Set(caseData.pois.map((poi) => poi.id));
  if (parsed.guessedPoiIds.some((poiId) => !knownPoiIds.has(poiId))) {
    throw new GameRuleError('Progress contains an unknown POI');
  }

  const targetIndex = parsed.guessedPoiIds.indexOf(caseData.target.poiId);
  if (parsed.outcome === 'playing') {
    if (targetIndex !== -1 || parsed.guessedPoiIds.length === maximumAttempts) {
      throw new GameRuleError('Progress has an invalid playing outcome');
    }
  } else if (parsed.outcome === 'won') {
    if (targetIndex !== parsed.guessedPoiIds.length - 1) {
      throw new GameRuleError('Won progress must end with the target POI');
    }
  } else if (
    targetIndex !== -1 ||
    parsed.guessedPoiIds.length !== maximumAttempts
  ) {
    throw new GameRuleError('Lost progress must contain six wrong guesses');
  }
  return parsed;
}

export function createProgress(caseData: DailyCase): GameProgress {
  return {
    schemaVersion: 1,
    caseDate: caseData.publicationDate,
    caseRevision: caseData.revision,
    guessedPoiIds: [],
    outcome: 'playing',
  };
}

export function applyGuess(
  caseData: DailyCase,
  progress: GameProgress,
  poiId: string,
  now: Date = new Date(),
): GameProgress {
  const current = validateForCase(caseData, progress);
  if (current.outcome !== 'playing') {
    throw new GameRuleError('This case has already ended');
  }
  if (!caseData.pois.some((poi) => poi.id === poiId)) {
    throw new GameRuleError('Unknown POI');
  }
  if (current.guessedPoiIds.includes(poiId)) {
    throw new GameRuleError('This POI has already been guessed');
  }

  const guessedPoiIds = [...current.guessedPoiIds, poiId];
  const outcome =
    poiId === caseData.target.poiId
      ? 'won'
      : guessedPoiIds.length === maximumAttempts
        ? 'lost'
        : 'playing';
  if (outcome === 'playing') return { ...current, guessedPoiIds };

  let completedAt: string;
  try {
    completedAt = now.toISOString();
  } catch {
    throw new GameRuleError('Completion time must be valid');
  }
  return { ...current, guessedPoiIds, outcome, completedAt };
}

export function getVisibleClues(
  caseData: DailyCase,
  progress: GameProgress,
): DailyCase['clues'] {
  const current = validateForCase(caseData, progress);
  const wrongGuessCount = current.guessedPoiIds.includes(caseData.target.poiId)
    ? current.guessedPoiIds.length - 1
    : current.guessedPoiIds.length;
  return caseData.clues.slice(
    0,
    Math.min(wrongGuessCount + 1, maximumAttempts),
  );
}

export function getLatestFeedback(
  caseData: DailyCase,
  progress: GameProgress,
): DailyCase['contextualResponses'][number] | null {
  const current = validateForCase(caseData, progress);
  const latestPoiId = current.guessedPoiIds.at(-1);
  if (latestPoiId === undefined || latestPoiId === caseData.target.poiId) {
    return null;
  }
  return (
    caseData.contextualResponses.find(
      (response) => response.poiId === latestPoiId,
    ) ?? null
  );
}

export function getAttemptsRemaining(progress: GameProgress): number {
  const current = parseProgress(progress);
  if (current.guessedPoiIds.length > maximumAttempts) {
    throw new GameRuleError('Progress has too many guesses');
  }
  return maximumAttempts - current.guessedPoiIds.length;
}

export function getShareTokens(
  caseData: DailyCase,
  progress: GameProgress,
): Array<RelationshipTier | 'solved'> {
  const current = validateForCase(caseData, progress);
  return current.guessedPoiIds.map((poiId) => {
    if (poiId === caseData.target.poiId) return 'solved';
    const response = caseData.contextualResponses.find(
      (candidate) => candidate.poiId === poiId,
    );
    if (response === undefined) {
      throw new GameRuleError('Missing authored response for guessed POI');
    }
    return response.tier;
  });
}
