import type { FiveRoundDailyCase, RoundTier } from '@whereabouts/case-content';
import {
  type FiveRoundProgress,
  fiveRoundProgressSchema,
} from './progress-schema.js';

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}

export function createFiveRoundProgress(
  caseData: FiveRoundDailyCase,
): FiveRoundProgress {
  return {
    schemaVersion: 3,
    caseDate: caseData.publicationDate,
    caseRevision: caseData.revision,
    guesses: [],
    acknowledgedRoundCount: 0,
  };
}

export function acknowledgeRoundReveal(
  progress: FiveRoundProgress,
): FiveRoundProgress {
  const current = fiveRoundProgressSchema.parse(progress);
  if (current.acknowledgedRoundCount === current.guesses.length) {
    throw new GameRuleError('There is no pending round reveal');
  }
  return {
    ...current,
    acknowledgedRoundCount: current.acknowledgedRoundCount + 1,
  };
}

export function getScoreBand(points: number): RoundTier {
  if (points === 100) return 'correct';
  if (points >= 75) return 'hot';
  if (points >= 40) return 'warm';
  return 'cold';
}

function parseFiveRoundProgress(
  caseData: FiveRoundDailyCase,
  progress: FiveRoundProgress,
): FiveRoundProgress {
  let parsed: FiveRoundProgress;
  try {
    parsed = fiveRoundProgressSchema.parse(progress);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid progress';
    throw new GameRuleError(message);
  }
  if (
    parsed.caseDate !== caseData.publicationDate ||
    parsed.caseRevision !== caseData.revision
  )
    throw new GameRuleError('Progress does not match this case revision');
  const revealedTargets = new Set<string>();
  for (const [index, guess] of parsed.guesses.entries()) {
    const round = caseData.rounds[index];
    if (!round || round.id !== guess.roundId) {
      throw new GameRuleError('Progress does not match the round order');
    }
    if (revealedTargets.has(guess.poiId)) {
      throw new GameRuleError('Progress guesses a declassified location');
    }
    const result = round.results.find(
      (candidate) => candidate.poiId === guess.poiId,
    );
    if (!result || result.points !== guess.points) {
      throw new GameRuleError(
        'Progress does not match an authored round result',
      );
    }
    revealedTargets.add(round.targetPoiId);
  }
  return parsed;
}

export function getCurrentRound(
  caseData: FiveRoundDailyCase,
  progress: FiveRoundProgress,
): FiveRoundDailyCase['rounds'][number] | null {
  const current = parseFiveRoundProgress(caseData, progress);
  return caseData.rounds[current.guesses.length] ?? null;
}

export function submitRoundGuess(
  caseData: FiveRoundDailyCase,
  progress: FiveRoundProgress,
  poiId: string,
  now: Date = new Date(),
): FiveRoundProgress {
  const current = parseFiveRoundProgress(caseData, progress);
  if (current.acknowledgedRoundCount < current.guesses.length) {
    throw new GameRuleError(
      'The previous round reveal must be acknowledged before another guess',
    );
  }
  const round = caseData.rounds[current.guesses.length];
  if (!round) throw new GameRuleError('This daily case is complete');
  if (!caseData.pois.some((poi) => poi.id === poiId))
    throw new GameRuleError('Unknown POI');
  const revealedTargets = new Set(
    caseData.rounds
      .slice(0, current.guesses.length)
      .map((candidate) => candidate.targetPoiId),
  );
  if (revealedTargets.has(poiId))
    throw new GameRuleError('This location has already been declassified');
  const result = round.results.find((candidate) => candidate.poiId === poiId);
  if (!result) throw new GameRuleError('Missing authored round result');
  const guesses = [
    ...current.guesses,
    {
      roundId: round.id,
      poiId,
      points: result.points,
    },
  ];
  if (guesses.length < caseData.rounds.length) return { ...current, guesses };
  return { ...current, guesses, completedAt: now.toISOString() };
}

export function getTotalScore(progress: FiveRoundProgress): number {
  return fiveRoundProgressSchema
    .parse(progress)
    .guesses.reduce((total, guess) => total + guess.points, 0);
}
