import { describe, expect, it } from 'vitest';
import {
  bucketResults,
  repairCaseDraft,
  writeCaseDraft,
} from './case-writer.js';
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

  it('rejects a clue that cites an off-board evidence ID', async () => {
    const invalid = fixtureCaseDraft.rounds.map((round, index) => ({
      ...round,
      clue:
        index === 0
          ? { ...round.clue, evidencePoiIds: ['not-on-board'] }
          : round.clue,
      results: round.results.map((result) => ({
        ...result,
        similarityScore:
          result.poiId === round.targetPoiId ? 100 : result.similarityScore,
        evidencePoiIds:
          result.poiId === round.targetPoiId
            ? [result.poiId]
            : [result.poiId, round.targetPoiId],
      })),
    }));
    await expect(
      writeCaseDraft({
        model: { generate: async () => ({ rounds: invalid }) },
        theme: fixtureBoard.theme,
        board: fixtureBoard,
      }),
    ).rejects.toThrow(/evidence not on board/);
  });

  it('normalizes omitted target and guessed-POI evidence IDs', async () => {
    const rounds = fixtureCaseDraft.rounds.map((round) => ({
      ...round,
      results: round.results.map((result) => ({
        ...result,
        similarityScore:
          result.poiId === round.targetPoiId ? 100 : result.similarityScore,
        evidencePoiIds: [result.poiId],
      })),
    }));
    const result = await writeCaseDraft({
      model: { generate: async () => ({ rounds }) },
      theme: fixtureBoard.theme,
      board: fixtureBoard,
    });
    const round = result.rounds[0];
    expect(round).toBeDefined();
    const nonTarget = round?.results.find(
      (item) => item.poiId !== round.targetPoiId,
    );
    expect(nonTarget).toBeDefined();
    expect(nonTarget?.evidencePoiIds).toEqual(
      expect.arrayContaining([nonTarget?.poiId, round?.targetPoiId]),
    );
  });

  it('repairs round-1 only and preserves the other rounds', async () => {
    const validDraft = {
      rounds: fixtureCaseDraft.rounds.map((round) => ({
        ...round,
        results: round.results.map((result) => ({
          ...result,
          similarityScore:
            result.poiId === round.targetPoiId ? 100 : result.similarityScore,
          evidencePoiIds:
            result.poiId === round.targetPoiId
              ? [result.poiId]
              : [result.poiId, round.targetPoiId],
        })),
      })),
    };
    const replacement = validDraft.rounds[0];
    const untouchedWithSupplementalEvidence = {
      ...validDraft.rounds[1],
      clue: {
        ...validDraft.rounds[1].clue,
        evidencePoiIds: [validDraft.rounds[1].targetPoiId],
      },
      results: validDraft.rounds[1].results.map((item) => ({
        ...item,
        evidencePoiIds: [item.poiId],
      })),
    };
    validDraft.rounds[1] = untouchedWithSupplementalEvidence;
    const repaired = {
      ...replacement,
      clue: {
        ...replacement.clue,
        text: 'A repaired clue with sufficiently long evidence wording.',
      },
      results: replacement.results.map((result) => ({
        ...result,
        similarityScore:
          result.poiId === replacement.targetPoiId
            ? 100
            : result.similarityScore,
        evidencePoiIds:
          result.poiId === replacement.targetPoiId
            ? [result.poiId]
            : [result.poiId, replacement.targetPoiId],
      })),
    };
    const result = await repairCaseDraft({
      model: { generate: async () => ({ rounds: [repaired] }) },
      theme: fixtureBoard.theme,
      board: fixtureBoard,
      draft: validDraft,
      repairs: [
        {
          kind: 'clue',
          roundId: 'round-1',
          reason: 'The clue needs stronger grounding.',
        },
      ],
    });
    expect(result.rounds[0]).toEqual(repaired);
    expect(result.rounds.slice(1)).toEqual(validDraft.rounds.slice(1));
  });

  it('rejects a mixed valid and invalid repair request', async () => {
    await expect(
      repairCaseDraft({
        model: { generate: async () => ({ rounds: [] }) },
        theme: fixtureBoard.theme,
        board: fixtureBoard,
        draft: fixtureCaseDraft,
        repairs: [
          { kind: 'clue', roundId: 'round-1', reason: 'Valid repair request.' },
          {
            kind: 'clue',
            roundId: 'round-99',
            reason: 'Invalid repair request.',
          },
        ],
      }),
    ).rejects.toThrow(/unrecognized round ID/);
  });
});
