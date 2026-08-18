import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { critiqueCase } from './case-critic.js';
import type { StructuredModel } from './model.js';

const caseData = makeFiveRoundCase();
const board = {
  theme: {
    title: caseData.theme.title,
    introduction: caseData.theme.introduction,
    inclusionCriteria: caseData.theme.inclusionCriteria,
    exclusions: ['Exclude places with only a tangential association.'],
    searchQueries: [
      'railway hotels',
      'historic station hotels',
      'rail lodging',
    ],
  },
  candidates: caseData.pois.map((poi) => ({
    ...poi,
    themeClaim: poi.themeConnection.text,
    source: {
      title: 'Fixture source',
      url: 'https://example.com/source',
      retrievedAt: '2026-08-14T00:00:00Z',
      provenance: 'verified',
      extract: `${poi.name} is directly connected to railway lodging and travel, as documented by the source.`,
    },
  })),
  targetPoiIds: caseData.rounds.map((round) => round.targetPoiId),
};
const draft = {
  rounds: caseData.rounds.map((round) => ({
    targetPoiId: round.targetPoiId,
    clue: { text: round.clue.text, evidencePoiIds: [round.targetPoiId] },
    results: caseData.pois.map((poi, index) => ({
      poiId: poi.id,
      similarityScore: poi.id === round.targetPoiId ? 100 : index * 5,
      text: `${poi.name} has sourced evidence.`,
      evidencePoiIds: [poi.id],
    })),
  })),
};

function modelWith(output: unknown): StructuredModel {
  return { generate: async () => output };
}
function passingOutput() {
  return {
    themeVerdicts: caseData.pois.map((poi) => ({
      poiId: poi.id,
      status: 'pass',
      explanation: 'The evidence directly satisfies the inclusion criteria.',
      sourceIds: ['source-01'],
    })),
    clueVerdicts: caseData.rounds.map((round) => ({
      roundId: round.id,
      declaredTargetPoiId: round.targetPoiId,
      resolvedPoiId: round.targetPoiId,
      resolvedOffBoardAnswer: null,
      resolvableWithoutExactNumbers: true,
      status: 'pass',
      explanation: 'Resolving the clue independently identifies the target.',
    })),
    relationshipVerdicts: caseData.rounds.flatMap((round) =>
      caseData.pois.map((poi) => ({
        roundId: round.id,
        poiId: poi.id,
        status: 'pass',
        explanation: 'The supplied evidence supports this comparison.',
      })),
    ),
  };
}

describe('critiqueCase', () => {
  it('uses provider-compatible typed verdict schemas', async () => {
    let jsonSchema: ReturnType<typeof z.toJSONSchema> | undefined;
    let criticPrompt = '';
    await critiqueCase({
      criticModel: {
        generate: async ({ schema, prompt }) => {
          jsonSchema = z.toJSONSchema(schema);
          criticPrompt = prompt;
          return passingOutput();
        },
      },
      theme: board.theme,
      board,
      draft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });
    const properties = (
      jsonSchema as {
        properties: Record<
          string,
          { items?: { type?: string }; minItems?: number; maxItems?: number }
        >;
      }
    ).properties;
    expect(properties.themeVerdicts?.items?.type).toBe('object');
    expect(properties.clueVerdicts?.items?.type).toBe('object');
    expect(properties.themeVerdicts).toMatchObject({
      minItems: 20,
      maxItems: 20,
    });
    expect(properties.clueVerdicts).toMatchObject({ minItems: 5, maxItems: 5 });
    expect(properties.relationshipVerdicts).toBeUndefined();
    expect(criticPrompt).toContain(`round-1 -> ${board.targetPoiIds[0]}`);
  });

  it('publishes only when all 20 themes and five clues pass', async () => {
    const result = await critiqueCase({
      criticModel: modelWith(passingOutput()),
      theme: board.theme,
      board,
      draft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });
    expect(result.repairs).toEqual([]);
    expect(result.review.themeVerdicts).toHaveLength(20);
    expect(result.review.clueVerdicts).toHaveLength(5);
  });

  it('normalizes critic citations to the supplied board evidence source', async () => {
    const output = passingOutput();
    output.themeVerdicts = output.themeVerdicts.map((verdict) => ({
      ...verdict,
      sourceIds: ['invented-model-source'],
    }));
    const result = await critiqueCase({
      criticModel: modelWith(output),
      theme: board.theme,
      board,
      draft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });
    expect(result.repairs).toEqual([]);
    expect(
      result.review.themeVerdicts.every(
        (verdict) => verdict.sourceIds[0] === 'source-01',
      ),
    ).toBe(true);
  });

  it('repairs a failed theme and does not accept tangential prose', async () => {
    const output = passingOutput();
    output.themeVerdicts[0] = {
      ...output.themeVerdicts[0],
      status: 'fail',
      explanation:
        'Hoover Dam mentions railway history, but is not a railway hotel.',
    };
    const result = await critiqueCase({
      criticModel: modelWith(output),
      theme: board.theme,
      board,
      draft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });
    expect(result.repairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'candidate', poiId: 'poi-00' }),
      ]),
    );
  });

  it('repairs off-board, wrong-target, and malformed clue verdicts', async () => {
    const output = passingOutput();
    output.clueVerdicts[0] = {
      ...output.clueVerdicts[0],
      resolvedPoiId: null,
      resolvedOffBoardAnswer: 'A named off-board hotel',
      status: 'fail',
      explanation: 'The clue resolves to an answer absent from the board.',
    };
    output.clueVerdicts[1] = {
      ...output.clueVerdicts[1],
      resolvedPoiId: 'poi-07',
      status: 'fail',
      explanation: 'The clue resolves to another board location.',
    };
    output.clueVerdicts.pop();
    const result = await critiqueCase({
      criticModel: modelWith(output),
      theme: board.theme,
      board,
      draft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });
    expect(
      result.repairs.filter((repair) => repair.kind === 'clue'),
    ).toHaveLength(3);
  });

  it('repairs only a clue that depends on exact numeric recall', async () => {
    const output = passingOutput();
    output.clueVerdicts[0] = {
      ...output.clueVerdicts[0],
      resolvableWithoutExactNumbers: false,
      explanation:
        'The exact opening year is the only fact separating two candidates.',
    };
    const result = await critiqueCase({
      criticModel: modelWith(output),
      theme: board.theme,
      board,
      draft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });
    expect(result.repairs).toEqual([
      expect.objectContaining({ kind: 'clue', roundId: 'round-1' }),
    ]);
  });

  it('repairs rounds whose authored scores do not span every UI band', async () => {
    const invalidDraft = {
      ...draft,
      rounds: draft.rounds.map((round, index) =>
        index === 2
          ? {
              ...round,
              results: round.results.map((result) => ({
                ...result,
                similarityScore: result.poiId === round.targetPoiId ? 100 : 50,
              })),
            }
          : round,
      ),
    };

    const result = await critiqueCase({
      criticModel: modelWith(passingOutput()),
      theme: board.theme,
      board,
      draft: invalidDraft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });

    expect(result.repairs).toEqual([
      expect.objectContaining({ kind: 'clue', roundId: 'round-3' }),
    ]);
  });

  it('fails closed when required arrays are missing', async () => {
    const result = await critiqueCase({
      criticModel: modelWith({}),
      theme: board.theme,
      board,
      draft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });
    expect(result.repairs.length).toBeGreaterThan(0);
    expect(result.repairs.some((repair) => repair.kind === 'candidate')).toBe(
      true,
    );
    expect(result.repairs.some((repair) => repair.kind === 'clue')).toBe(true);
    expect(result.repairs.some((repair) => repair.kind === 'theme')).toBe(true);
  });

  it('leaves pairwise relationship prose for human audit', async () => {
    const output = passingOutput();
    output.relationshipVerdicts.pop();
    output.relationshipVerdicts[0] = { ...output.relationshipVerdicts[0] };
    output.relationshipVerdicts.push({ ...output.relationshipVerdicts[0] });
    const result = await critiqueCase({
      criticModel: modelWith(output),
      theme: board.theme,
      board,
      draft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });
    expect(
      result.repairs.filter((repair) => repair.kind === 'relationship'),
    ).toEqual([]);
  });

  it('keeps a resolvable clue defect scoped to the clue repair', async () => {
    const output = passingOutput();
    output.clueVerdicts[0].declaredTargetPoiId = 'poi-99';
    const result = await critiqueCase({
      criticModel: modelWith(output),
      theme: board.theme,
      board,
      draft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });
    expect(result.repairs).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'clue' })]),
    );
    expect(result.repairs.some((repair) => repair.kind === 'theme')).toBe(
      false,
    );
  });

  it('repairs clues that leak the target name, city, or country', async () => {
    const target = board.candidates.find(
      (candidate) => candidate.id === board.targetPoiIds[0],
    );
    if (!target) throw new Error('fixture target is missing from the board');
    const leakingDraft = {
      ...draft,
      rounds: draft.rounds.map((round, index) =>
        index === 0
          ? {
              ...round,
              clue: {
                ...round.clue,
                text: `${round.clue.text} It is in ${target.city}.`,
              },
            }
          : round,
      ),
    };
    const result = await critiqueCase({
      criticModel: modelWith(passingOutput()),
      theme: board.theme,
      board,
      draft: leakingDraft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });

    expect(result.repairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'clue', roundId: 'round-1' }),
      ]),
    );
  });

  it('does not treat a short country code embedded in another word as a leak', async () => {
    const targetId = board.targetPoiIds[0];
    const shortCountryBoard = {
      ...board,
      candidates: board.candidates.map((candidate) =>
        candidate.id === targetId ? { ...candidate, country: 'US' } : candidate,
      ),
    };
    const safeDraft = {
      ...draft,
      rounds: draft.rounds.map((round, index) =>
        index === 0
          ? {
              ...round,
              clue: {
                ...round.clue,
                text: 'This industrial landmark has two specific historical features.',
              },
            }
          : round,
      ),
    };
    const result = await critiqueCase({
      criticModel: modelWith(passingOutput()),
      theme: board.theme,
      board: shortCountryBoard,
      draft: safeDraft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });

    expect(result.repairs).toEqual([]);
  });
});
