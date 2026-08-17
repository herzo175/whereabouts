import { describe, expect, it } from 'vitest';
import { bucketResults, writeCaseDraft } from './case-writer.js';
import { fixtureBoard, fixtureCaseDraft } from './fixtures.js';

describe('case writer', () => {
  it('writes and validates a complete board-aware draft', async () => {
    const draft = await writeCaseDraft({
      model: {
        generate: async () => ({
          rounds: fixtureCaseDraft.rounds.map((round) => ({
            ...round,
            results: round.results.map((result) => ({
              ...result,
              similarityScore:
                result.poiId === round.targetPoiId
                  ? 100
                  : result.similarityScore,
              evidencePoiIds:
                result.poiId === round.targetPoiId
                  ? [result.poiId]
                  : [result.poiId, round.targetPoiId],
            })),
          })),
        }),
      },
      theme: fixtureBoard.theme,
      board: fixtureBoard,
    });
    expect(draft.rounds).toHaveLength(5);
    expect(draft.rounds[0].results).toHaveLength(25);
  });

  it('uses deterministic score and ID tie ordering for hot/warm/cold buckets', () => {
    const results = fixtureBoard.candidates.map((candidate, index) => ({
      poiId: candidate.id,
      similarityScore: index === 0 ? 100 : 50,
      text: `Evidence for ${candidate.name} is documented here.`,
      evidencePoiIds: [candidate.id, fixtureBoard.targetPoiIds[0]],
    }));
    const bucketed = bucketResults(results, fixtureBoard.targetPoiIds[0]);
    expect(bucketed.filter((result) => result.tier === 'hot')).toHaveLength(4);
    expect(bucketed.filter((result) => result.tier === 'warm')).toHaveLength(8);
    expect(bucketed.filter((result) => result.tier === 'cold')).toHaveLength(
      12,
    );
    expect(bucketed[0]?.tier).toBe('correct');
  });
});
