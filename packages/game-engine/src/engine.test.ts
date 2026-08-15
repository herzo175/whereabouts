import { describe, expect, it } from 'vitest';

import { makeFiveRoundCase } from '../../case-content/test/fixtures.js';
import {
  acknowledgeRoundReveal,
  createFiveRoundProgress,
  GameRuleError,
  getCurrentRound,
  getRoundScore,
  getTotalScore,
  submitRoundGuess,
} from './index.js';

describe('five-round engine', () => {
  it('scores one immutable guess per round and completes after round five', () => {
    const caseData = makeFiveRoundCase();
    let progress = createFiveRoundProgress(caseData);
    expect(getCurrentRound(caseData, progress)?.id).toBe('round-1');
    expect(getRoundScore('correct')).toBe(100);
    expect(getRoundScore('hot')).toBe(75);
    expect(getRoundScore('warm')).toBe(50);
    expect(getRoundScore('cold')).toBe(25);

    for (let index = 0; index < 5; index += 1) {
      progress = submitRoundGuess(
        caseData,
        progress,
        caseData.rounds[index].targetPoiId,
        new Date('2026-08-14T12:34:56.000Z'),
      );
      expect(progress.acknowledgedRoundCount).toBe(index);
      progress = acknowledgeRoundReveal(progress);
    }
    expect(progress.guesses).toHaveLength(5);
    expect(progress.completedAt).toBe('2026-08-14T12:34:56.000Z');
    expect(getTotalScore(progress)).toBe(500);
    expect(getCurrentRound(caseData, progress)).toBeNull();
  });

  it('allows exactly one pending reveal to be acknowledged', () => {
    const caseData = makeFiveRoundCase();
    const guessed = submitRoundGuess(
      caseData,
      createFiveRoundProgress(caseData),
      caseData.pois[10].id,
    );

    expect(guessed.acknowledgedRoundCount).toBe(0);
    expect(acknowledgeRoundReveal(guessed).acknowledgedRoundCount).toBe(1);
    expect(() =>
      acknowledgeRoundReveal(acknowledgeRoundReveal(guessed)),
    ).toThrow(GameRuleError);
  });

  it('rejects a second-round guess while the prior reveal is unacknowledged', () => {
    const caseData = makeFiveRoundCase();
    const progress = submitRoundGuess(
      caseData,
      createFiveRoundProgress(caseData),
      caseData.pois[10].id,
    );

    expect(() =>
      submitRoundGuess(caseData, progress, caseData.pois[11].id),
    ).toThrow(GameRuleError);
  });

  it('rejects a previously revealed target in a later round', () => {
    const caseData = makeFiveRoundCase();
    const progress = submitRoundGuess(
      caseData,
      createFiveRoundProgress(caseData),
      caseData.rounds[0].targetPoiId,
    );
    expect(() =>
      submitRoundGuess(caseData, progress, caseData.rounds[0].targetPoiId),
    ).toThrow(GameRuleError);
  });

  it('rejects a persisted guess whose round result or completion state was changed', () => {
    const caseData = makeFiveRoundCase();
    const progress = submitRoundGuess(
      caseData,
      createFiveRoundProgress(caseData),
      caseData.rounds[0].targetPoiId,
    );

    expect(() =>
      getCurrentRound(caseData, {
        ...progress,
        guesses: [{ ...progress.guesses[0], points: 25 }],
      }),
    ).toThrow(GameRuleError);
    expect(() =>
      getCurrentRound(caseData, {
        ...progress,
        guesses: [{ ...progress.guesses[0], tier: 'hot', points: 75 }],
      }),
    ).toThrow(GameRuleError);
    expect(() =>
      getCurrentRound(caseData, {
        ...progress,
        completedAt: '2026-08-14T12:34:56.000Z',
      }),
    ).toThrow(GameRuleError);
  });
});
