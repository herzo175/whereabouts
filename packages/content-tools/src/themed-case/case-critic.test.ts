import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import { describe, expect, it } from 'vitest';
import type { StructuredModel } from './model.js';
import { critiqueCase } from './case-critic.js';

const caseData = makeFiveRoundCase();
const board = {
  theme: {
    title: caseData.theme.title,
    introduction: caseData.theme.introduction,
    inclusionCriteria: caseData.theme.inclusionCriteria,
    exclusions: ['Exclude places with only a tangential association.'],
    searchQueries: ['railway hotels', 'historic station hotels', 'rail lodging'],
  },
  candidates: caseData.pois.map((poi) => ({
    ...poi,
    themeClaim: poi.themeConnection.text,
    source: {
      title: 'Fixture source',
      url: 'https://example.com/source',
      retrievedAt: '2026-08-14T00:00:00Z',
      extract: `${poi.name} is directly connected to railway lodging and travel, as documented by the source.`,
    },
  })),
  targetPoiIds: caseData.rounds.map((round) => round.targetPoiId),
};
const draft = {
  rounds: caseData.rounds.map((round) => ({
    targetPoiId: round.targetPoiId,
    clue: { text: round.clue.text, evidencePoiIds: [round.targetPoiId] },
    results: caseData.pois.map((poi) => ({
      poiId: poi.id,
      similarityScore: poi.id === round.targetPoiId ? 100 : 50,
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
  it('publishes only when all 25 themes and five clues pass', async () => {
    const result = await critiqueCase({
      criticModel: modelWith(passingOutput()),
      theme: board.theme,
      board,
      draft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });
    expect(result.repairs).toEqual([]);
    expect(result.review.themeVerdicts).toHaveLength(25);
    expect(result.review.clueVerdicts).toHaveLength(5);
  });

  it('repairs a failed theme and does not accept tangential prose', async () => {
    const output = passingOutput();
    output.themeVerdicts[0] = {
      ...output.themeVerdicts[0],
      status: 'fail',
      explanation: 'Hoover Dam mentions railway history, but is not a railway hotel.',
    };
    const result = await critiqueCase({
      criticModel: modelWith(output),
      theme: board.theme,
      board,
      draft,
      publicationDate: caseData.publicationDate,
      revision: caseData.revision,
    });
    expect(result.repairs).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'candidate', poiId: 'poi-00' }),
    ]));
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
    expect(result.repairs.filter((repair) => repair.kind === 'clue')).toHaveLength(3);
  });

  it('fails closed when required arrays are missing', async () => {
    const result = await critiqueCase({
      criticModel: modelWith({}), theme: board.theme, board, draft,
      publicationDate: caseData.publicationDate, revision: caseData.revision,
    });
    expect(result.repairs.length).toBeGreaterThan(0);
    expect(result.repairs.some((repair) => repair.kind === 'candidate')).toBe(true);
    expect(result.repairs.some((repair) => repair.kind === 'clue')).toBe(true);
    expect(result.repairs.some((repair) => repair.kind === 'relationship')).toBe(true);
  });

  it('repairs missing and duplicate relationship verdicts', async () => {
    const output = passingOutput();
    output.relationshipVerdicts.pop();
    output.relationshipVerdicts[0] = { ...output.relationshipVerdicts[0] };
    output.relationshipVerdicts.push({ ...output.relationshipVerdicts[0] });
    const result = await critiqueCase({
      criticModel: modelWith(output), theme: board.theme, board, draft,
      publicationDate: caseData.publicationDate, revision: caseData.revision,
    });
    expect(result.repairs.filter((repair) => repair.kind === 'relationship').length).toBeGreaterThan(1);
  });

  it('adds validation repair even when a clue repair already exists', async () => {
    const output = passingOutput();
    output.clueVerdicts[0].declaredTargetPoiId = 'poi-99';
    const result = await critiqueCase({
      criticModel: modelWith(output), theme: board.theme, board, draft,
      publicationDate: caseData.publicationDate, revision: caseData.revision,
    });
    expect(result.repairs).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'clue' }),
      expect.objectContaining({ kind: 'theme' }),
    ]));
  });
});
