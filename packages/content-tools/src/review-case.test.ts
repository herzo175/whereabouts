import { describe, expect, it } from 'vitest';
import { makeThemedCase } from '@whereabouts/case-content/testing';
import { reviewPacket } from './review-case.js';

describe('reviewPacket', () => {
  it('renders themed metadata, candidate citations, targets, and audit disposition', () => {
    const value = makeThemedCase();
    const review = {
      schemaVersion: 1 as const, publicationDate: value.publicationDate, revision: value.revision,
      themeVerdicts: value.pois.map((poi) => ({ poiId: poi.id, status: 'pass' as const, explanation: 'The candidate clearly satisfies the stated theme criteria.', sourceIds: ['source-01'] })),
      clueVerdicts: value.rounds.map((round) => ({ roundId: round.id, declaredTargetPoiId: round.targetPoiId, resolvedPoiId: round.targetPoiId, resolvedOffBoardAnswer: null, status: 'pass' as const, explanation: 'The clue evidence resolves directly to the declared board target.' })), repairs: [],
    };
    const packet = reviewPacket(value, review);
    expect(packet).toContain(value.theme.title); expect(packet).toContain('Inclusion criteria'); expect(packet).toContain('Final disposition'); expect(packet).toContain('PASS');
  });
});
