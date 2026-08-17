import { makeThemedCase } from '@whereabouts/case-content/testing';
import { describe, expect, it } from 'vitest';
import { reviewPacket } from './review-case.js';

describe('reviewPacket', () => {
  it('renders themed metadata, candidate citations, targets, and audit disposition', () => {
    const value = makeThemedCase();
    const review = {
      schemaVersion: 1 as const,
      publicationDate: value.publicationDate,
      revision: value.revision,
      themeVerdicts: value.pois.map((poi) => ({
        poiId: poi.id,
        status: 'pass' as const,
        explanation:
          'The candidate clearly satisfies the stated theme criteria.',
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
    const packet = reviewPacket(value, review);
    expect(packet).toContain(value.theme.title);
    expect(packet).toContain('Inclusion criteria');
    expect(packet).toContain('Theme verdicts');
    expect(packet).toContain('**poi-00** — pass:');
    expect(packet).toContain('Deterministic validation');
    expect(packet).toContain('PASS');
  });

  it('renders FAIL when semantic review validation fails', () => {
    const value = makeThemedCase();
    const review = {
      schemaVersion: 1 as const,
      publicationDate: value.publicationDate,
      revision: value.revision,
      themeVerdicts: value.pois.map((poi) => ({
        poiId: poi.id,
        status: 'pass' as const,
        explanation:
          'The candidate clearly satisfies the stated theme criteria.',
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
    review.clueVerdicts[0] = {
      ...review.clueVerdicts[0],
      resolvedPoiId: null,
      resolvedOffBoardAnswer: 'Off Board Place',
    };
    const packet = reviewPacket(value, review);
    expect(packet).toContain('## Final disposition\n\nFAIL');
  });
});
