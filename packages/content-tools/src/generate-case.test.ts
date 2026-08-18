import { describe, expect, it } from 'vitest';
import { generateCase } from './generate-case.js';
import type { GenerationReview } from './generation-review.js';
import {
  fixtureBoard,
  fixtureCaseDraft,
  fixtureTheme,
} from './themed-case/fixtures.js';

const review: GenerationReview = {
  schemaVersion: 1,
  publicationDate: '2026-08-17',
  revision: 1,
  themeVerdicts: fixtureBoard.candidates.map((candidate) => ({
    poiId: candidate.id,
    status: 'pass',
    explanation:
      'This candidate directly satisfies the theme inclusion criteria.',
    sourceIds: ['source-01'],
  })),
  clueVerdicts: fixtureBoard.targetPoiIds.map((targetPoiId, index) => ({
    roundId: `round-${index + 1}`,
    declaredTargetPoiId: targetPoiId,
    resolvedPoiId: targetPoiId,
    resolvedOffBoardAnswer: null,
    resolvableWithoutExactNumbers: true,
    status: 'pass',
    explanation:
      'The clue resolves independently to the declared board target.',
  })),
  repairs: [],
};

const publicationBoard = {
  ...fixtureBoard,
  candidates: fixtureBoard.candidates.map((candidate, index) => ({
    ...candidate,
    source: {
      ...candidate.source,
      provenance: index < 5 ? ('verified' as const) : ('model' as const),
    },
  })),
};

const input = {
  date: '2026-08-17',
  revision: 1,
  caseNumber: 1,
  theme: fixtureTheme,
  board: publicationBoard,
  draft: fixtureCaseDraft,
  review,
};

describe('generateCase', () => {
  it('assembles a validated themed v4 prepared case without writing files', async () => {
    const prepared = await generateCase(input);
    expect(prepared.caseData.schemaVersion).toBe(4);
    expect(prepared.caseData.theme.title).toBe(fixtureTheme.title);
    expect(prepared.caseData.pois).toHaveLength(20);
    expect(prepared.caseData.rounds.map((round) => round.targetPoiId)).toEqual(
      fixtureBoard.targetPoiIds,
    );
    expect(prepared.caseData.pois[0]).toHaveProperty('themeConnection');
    expect(prepared.caseData.pois[0]?.blurb).toContain('Market Square');
    expect(prepared.markdownReview).toContain('Whereabouts themed review');
  });

  it('uses stable source IDs and translates draft evidence candidate IDs', async () => {
    const prepared = await generateCase(input);
    expect(prepared.caseData.sources.map((source) => source.id)).toEqual(
      fixtureBoard.candidates.map(
        (_, index) => `source-${String(index + 1).padStart(2, '0')}`,
      ),
    );
    expect(prepared.caseData.rounds[0]?.clue.sourceIds).toEqual(['source-01']);
    expect(prepared.caseData.rounds[0]?.results[1]?.sourceIds).toEqual([
      'source-02',
    ]);
    expect(
      prepared.caseData.sources.filter(
        (source) => source.provenance === 'verified',
      ),
    ).toHaveLength(5);
    expect(
      prepared.caseData.sources.filter(
        (source) => source.provenance === 'model',
      ),
    ).toHaveLength(15);
    expect(prepared.markdownReview).toContain('provenance: verified');
    expect(prepared.markdownReview).toContain('provenance: model');
  });

  it('rejects missing targets, off-board clues, wrong clues, and unknown evidence', async () => {
    const missingTarget = {
      ...input,
      board: {
        ...fixtureBoard,
        targetPoiIds: ['missing', ...fixtureBoard.targetPoiIds.slice(1)],
      },
    };
    await expect(generateCase(missingTarget)).rejects.toThrow(/target/i);

    const offBoard = {
      ...input,
      review: {
        ...review,
        clueVerdicts: review.clueVerdicts.map((clue, index) =>
          index === 0
            ? {
                ...clue,
                resolvedPoiId: null,
                resolvedOffBoardAnswer: 'An off-board place',
                status: 'fail' as const,
              }
            : clue,
        ),
      },
    };
    await expect(generateCase(offBoard)).rejects.toThrow(
      /review|off-board|clue/i,
    );

    const wrong = {
      ...input,
      review: {
        ...review,
        clueVerdicts: review.clueVerdicts.map((clue, index) =>
          index === 0
            ? {
                ...clue,
                resolvedPoiId: fixtureBoard.candidates[7]?.id ?? 'unknown',
                status: 'fail' as const,
              }
            : clue,
        ),
      },
    };
    await expect(generateCase(wrong)).rejects.toThrow(/review|target|clue/i);

    const unknownEvidence = {
      ...input,
      draft: {
        ...fixtureCaseDraft,
        rounds: fixtureCaseDraft.rounds.map((round, index) =>
          index === 0
            ? { ...round, clue: { ...round.clue, evidencePoiIds: ['unknown'] } }
            : round,
        ),
      },
    };
    await expect(generateCase(unknownEvidence)).rejects.toThrow(
      /evidence|unknown/i,
    );
  });

  it('keeps display ordering deterministic for the same seed', async () => {
    const first = await generateCase(input);
    const second = await generateCase(input);
    expect(first.caseData.pois.map((poi) => poi.id)).toEqual(
      second.caseData.pois.map((poi) => poi.id),
    );
  });

  it('rejects a target whose candidate source is not verified', async () => {
    const unverifiedTarget = {
      ...input,
      board: {
        ...input.board,
        candidates: input.board.candidates.map((candidate, index) =>
          index === 0
            ? {
                ...candidate,
                source: { ...candidate.source, provenance: 'model' as const },
              }
            : candidate,
        ),
      },
    };
    await expect(generateCase(unverifiedTarget)).rejects.toThrow(
      /source is not verified/,
    );
  });
});
