import { makeThemedCase } from '@whereabouts/case-content/testing';
import { describe, expect, it } from 'vitest';
import { validateGenerationReview } from './generation-review.js';

function makeReview() {
  const value = makeThemedCase();
  return {
    schemaVersion: 1 as const,
    publicationDate: value.publicationDate,
    revision: value.revision,
    themeVerdicts: value.pois.map((poi) => ({
      poiId: poi.id,
      status: 'pass' as const,
      explanation: 'The candidate clearly satisfies the stated theme criteria.',
      sourceIds: ['source-01'],
    })),
    clueVerdicts: value.rounds.map((round) => ({
      roundId: round.id,
      declaredTargetPoiId: round.targetPoiId,
      resolvedPoiId: round.targetPoiId,
      resolvedOffBoardAnswer: null,
      status: 'pass' as const,
      explanation:
        'The clue evidence resolves directly to the declared board target.',
    })),
    repairs: [],
  };
}

describe('validateGenerationReview', () => {
  it('accepts a complete passing review', () =>
    expect(validateGenerationReview(makeThemedCase(), makeReview())).toEqual(
      [],
    ));
  it('rejects an off-board clue answer', () => {
    const review = makeReview();
    review.clueVerdicts[0] = {
      ...review.clueVerdicts[0],
      resolvedPoiId: null,
      resolvedOffBoardAnswer: 'The Off-Board Hotel',
      status: 'fail',
      explanation: 'The clue facts describe a hotel absent from the board.',
    };
    expect(
      validateGenerationReview(makeThemedCase(), review).some(
        (issue) => issue.path === 'clueVerdicts[0]',
      ),
    ).toBe(true);
  });
  it('rejects a clue resolving to another board member', () => {
    const review = makeReview();
    review.clueVerdicts[0] = {
      ...review.clueVerdicts[0],
      resolvedPoiId: 'poi-06',
    };
    expect(
      validateGenerationReview(makeThemedCase(), review).some(
        (issue) => issue.path === 'clueVerdicts[0]',
      ),
    ).toBe(true);
  });
  it('rejects failed and incomplete theme verdicts and identity mismatches', () => {
    const value = makeThemedCase();
    const review = makeReview();
    review.themeVerdicts[0] = { ...review.themeVerdicts[0], status: 'fail' };
    review.publicationDate = '2026-08-15';
    review.revision = 2;
    const issues = validateGenerationReview(value, review);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(['publicationDate', 'revision']),
    );
  });
});
