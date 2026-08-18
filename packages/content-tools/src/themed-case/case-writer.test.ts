import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  authorResults,
  repairCaseDraft,
  writeCaseDraft,
} from './case-writer.js';
import { fixtureBoard, fixtureCaseDraft } from './fixtures.js';

describe('case writer', () => {
  it('writes and validates a complete board-aware draft', async () => {
    const draft = await writeCaseDraft({
      model: {
        generate: async ({ schema }) => {
          const json = z.toJSONSchema(schema) as {
            properties?: {
              rounds?: {
                items?: {
                  properties?: {
                    results?: {
                      items?: { properties?: Record<string, unknown> };
                    };
                  };
                };
              };
            };
          };
          const resultProperties =
            json.properties?.rounds?.items?.properties?.results?.items
              ?.properties;
          expect(resultProperties).not.toHaveProperty('text');
          expect(resultProperties).not.toHaveProperty('evidencePoiIds');
          return {
            rounds: fixtureCaseDraft.rounds.map((round) => ({
              targetPoiId: round.targetPoiId,
              clue: { text: round.clue.text },
              results: round.results.map((result) => ({
                poiId: result.poiId,
                similarityScore: result.similarityScore,
              })),
            })),
          };
        },
      },
      theme: fixtureBoard.theme,
      board: fixtureBoard,
    });
    expect(draft.rounds).toHaveLength(5);
    expect(draft.rounds[0].results).toHaveLength(25);
  });

  it('preserves exact model-authored points for every candidate', () => {
    const results = fixtureBoard.candidates.map((candidate, index) => ({
      poiId: candidate.id,
      similarityScore: index === 0 ? 100 : 50,
      text: `Evidence for ${candidate.name} is documented here.`,
      evidencePoiIds: [candidate.id, fixtureBoard.targetPoiIds[0]],
    }));
    const bucketed = authorResults(results, fixtureBoard.targetPoiIds[0]);
    expect(bucketed.map((result) => result.points)).toEqual(
      results.map((result) => result.similarityScore),
    );
    expect(bucketed[0]?.points).toBe(100);
    expect(bucketed.every((result) => !('tier' in result))).toBe(true);
  });

  it('rejects a clue that cites an off-board evidence ID', async () => {
    const invalid = fixtureCaseDraft.rounds.map((round, index) => ({
      ...round,
      targetPoiId: index === 0 ? 'not-on-board' : round.targetPoiId,
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
    ).rejects.toThrow(/target|board/);
  });

  it('rejects fractional candidate scores from the model', async () => {
    const rounds = fixtureCaseDraft.rounds.map((round) => ({
      targetPoiId: round.targetPoiId,
      clue: { text: round.clue.text },
      results: round.results.map((result) => ({
        poiId: result.poiId,
        similarityScore: result.poiId === round.targetPoiId ? 100 : 74.5,
      })),
    }));

    await expect(
      writeCaseDraft({
        model: { generate: async () => ({ rounds }) },
        theme: fixtureBoard.theme,
        board: fixtureBoard,
      }),
    ).rejects.toThrow(/int|integer/i);
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

  it('normalizes duplicate result IDs back to the complete board', async () => {
    const rounds = fixtureCaseDraft.rounds.map((round, roundIndex) => ({
      ...round,
      results: round.results.map((result, resultIndex) => ({
        ...result,
        poiId:
          roundIndex === 0 && resultIndex === 24
            ? round.results[0].poiId
            : result.poiId,
        similarityScore:
          result.poiId === round.targetPoiId ? 100 : result.similarityScore,
      })),
    }));
    const result = await writeCaseDraft({
      model: { generate: async () => ({ rounds }) },
      theme: fixtureBoard.theme,
      board: fixtureBoard,
    });
    expect(result.rounds[0].results.map((item) => item.poiId)).toEqual(
      fixtureBoard.candidates.map((candidate) => candidate.id),
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
      model: {
        generate: async ({ prompt }) => {
          for (const candidate of fixtureBoard.candidates)
            expect(prompt).toContain(candidate.id);
          for (const candidate of fixtureBoard.candidates) {
            expect(prompt).toContain(candidate.name);
            expect(prompt).toContain(candidate.themeClaim);
          }
          expect(prompt).toContain(JSON.stringify(validDraft.rounds[0]));
          return { rounds: [repaired] };
        },
      },
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
    expect(result.rounds[0]?.targetPoiId).toBe(repaired.targetPoiId);
    expect(result.rounds[0]?.clue.text).toBe(repaired.clue.text);
    expect(
      result.rounds[0]?.results.map((item) => item.similarityScore),
    ).toEqual(repaired.results.map((item) => item.similarityScore));
    expect(result.rounds[0]?.results[0]?.text).toContain(
      fixtureBoard.candidates[0]?.name,
    );
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
