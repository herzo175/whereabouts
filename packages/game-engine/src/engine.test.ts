import { describe, expect, it } from 'vitest';

import { makeFiveRoundCase } from '../../case-content/test/fixtures.js';
import {
  acknowledgeRoundReveal,
  createFiveRoundProgress,
  GameRuleError,
  getCurrentRound,
  getScoreBand,
  getTotalScore,
  submitRoundGuess,
} from './index.js';

describe('five-round engine', () => {
  it('scores one immutable guess per round and completes after round five', () => {
    const caseData = makeFiveRoundCase();
    let progress = createFiveRoundProgress(caseData);
    expect(getCurrentRound(caseData, progress)?.id).toBe('round-1');
    expect(getScoreBand(100)).toBe('correct');
    expect(getScoreBand(99)).toBe('hot');
    expect(getScoreBand(75)).toBe('hot');
    expect(getScoreBand(74)).toBe('warm');
    expect(getScoreBand(40)).toBe('warm');
    expect(getScoreBand(39)).toBe('cold');
    expect(getScoreBand(0)).toBe('cold');

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

  it('uses the exact authored candidate points instead of a fixed tier score', () => {
    const caseData = makeFiveRoundCase();
    const candidate = caseData.rounds[0].results[1];
    if (!candidate) throw new Error('fixture candidate missing');
    candidate.points = 87;

    const progress = submitRoundGuess(
      caseData,
      createFiveRoundProgress(caseData),
      candidate.poiId,
    );

    expect(progress.guesses[0]).toEqual({
      roundId: 'round-1',
      poiId: candidate.poiId,
      points: 87,
    });
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
        guesses: [{ ...progress.guesses[0], points: 99 }],
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
