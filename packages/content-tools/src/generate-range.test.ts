import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import { describe, expect, it, vi } from 'vitest';

import {
  generateRange,
  parseRangeArguments,
  type RangeHistory,
} from './generate-range.js';
import type { PreparedCase } from './publish-batch.js';

function prepared(
  date: string,
  revision = 1,
  themeTitle = `Theme ${date}`,
): PreparedCase {
  const caseData = makeFiveRoundCase({
    publicationDate: date,
    revision,
    caseNumber: Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000),
  });
  caseData.theme = {
    title: themeTitle,
    introduction: 'A useful introduction to this geography theme.',
    inclusionCriteria: 'Places that satisfy this exact geography criterion.',
  };
  return {
    caseData,
    generationReview: {
      schemaVersion: 1,
      publicationDate: date,
      revision,
      themeVerdicts: caseData.pois.map((poi) => ({
        poiId: poi.id,
        status: 'pass',
        explanation: 'This candidate clearly satisfies the theme criteria.',
        sourceIds: ['source-01'],
      })),
      clueVerdicts: caseData.rounds.map((round) => ({
        roundId: round.id,
        declaredTargetPoiId: round.targetPoiId,
        resolvedPoiId: round.targetPoiId,
        resolvedOffBoardAnswer: null,
        status: 'pass',
        explanation: 'The clue resolves directly to the declared target.',
      })),
      repairs: [],
    },
    markdownReview: `# ${date}\n`,
  };
}

function history(cases: PreparedCase[] = []): RangeHistory {
  return {
    manifest: {
      schemaVersion: 2,
      cases: Object.fromEntries(
        cases.map(({ caseData }) => [
          caseData.publicationDate,
          {
            caseNumber: caseData.caseNumber,
            revision: caseData.revision,
            file: `./cases/${caseData.publicationDate}/v${caseData.revision}.json`,
          },
        ]),
      ),
    },
    cases: cases.map(({ caseData }) => caseData),
  };
}

describe('parseRangeArguments', () => {
  it('parses canonical generation and missing-only buffer arguments', () => {
    expect(
      parseRangeArguments(['--from', '2026-08-17', '--days', '10']),
    ).toEqual({
      from: '2026-08-17',
      days: 10,
      revision: undefined,
      missingOnly: false,
    });
    expect(
      parseRangeArguments([
        '--from',
        '2026-08-17',
        '--days',
        '10',
        '--missing-only',
        '--revision',
        '2',
      ]),
    ).toEqual({ from: '2026-08-17', days: 10, revision: 2, missingOnly: true });
  });

  it('rejects non-canonical dates and invalid day counts', () => {
    expect(() =>
      parseRangeArguments(['--from', '2026-2-17', '--days', '10']),
    ).toThrow(/date/i);
    expect(() =>
      parseRangeArguments(['--from', '2026-02-30', '--days', '10']),
    ).toThrow(/date/i);
    expect(() =>
      parseRangeArguments(['--from', '2026-08-17', '--days', '0']),
    ).toThrow(/days/i);
  });
});

describe('generateRange', () => {
  it('requests exactly ten consecutive dates and publishes once as one batch', async () => {
    const requested: Array<{ date: string; revision: number }> = [];
    const publish = vi.fn(async () => history());
    await generateRange(['--from', '2026-08-17', '--days', '10'], {
      history: async () => history(),
      orchestrate: async (input) => {
        requested.push({ date: input.date, revision: input.revision });
        return prepared(input.date, input.revision);
      },
      publishBatch: publish,
    });

    expect(requested).toEqual(
      Array.from({ length: 10 }, (_, index) => {
        const date = new Date(Date.UTC(2026, 7, 17 + index))
          .toISOString()
          .slice(0, 10);
        return { date, revision: 1 };
      }),
    );
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0]?.[0].prepared).toHaveLength(10);
  });

  it('skips manifested dates in missing-only mode', async () => {
    const existing = prepared('2026-08-18');
    const requested: string[] = [];
    const publish = vi.fn(async () => history([existing]));
    await generateRange(
      ['--from', '2026-08-17', '--days', '3', '--missing-only'],
      {
        history: async () => history([existing]),
        orchestrate: async (input) => {
          requested.push(input.date);
          return prepared(input.date, input.revision);
        },
        publishBatch: publish,
      },
    );

    expect(requested).toEqual(['2026-08-17', '2026-08-19']);
    expect(
      publish.mock.calls[0]?.[0].prepared.map(
        (item) => item.caseData.publicationDate,
      ),
    ).toEqual(['2026-08-17', '2026-08-19']);
  });

  it('passes rolling 90 themes and 30 target IDs into each consecutive case', async () => {
    const prior = prepared('2026-08-16', 3, 'Prior theme');
    const seen: Array<{ date: string; themes: string[]; excluded: string[] }> =
      [];
    await generateRange(['--from', '2026-08-17', '--days', '2'], {
      history: async () => history([prior]),
      orchestrate: async (input) => {
        seen.push({
          date: input.date,
          themes: input.recentThemes.map((theme) => theme.title),
          excluded: [...input.excludedTargetIds].sort(),
        });
        return prepared(input.date, input.revision, `Generated ${input.date}`);
      },
      publishBatch: async () => history([prior]),
    });

    const priorTargets = prior.caseData.rounds
      .map((round) => round.targetPoiId)
      .sort();
    expect(seen[0]).toEqual({
      date: '2026-08-17',
      themes: ['Prior theme'],
      excluded: priorTargets,
    });
    expect(seen[1]?.themes).toEqual(['Prior theme', 'Generated 2026-08-17']);
    expect(seen[1]?.excluded).toEqual(priorTargets);
  });

  it('uses the requested revision, otherwise allocates the next manifest revision', async () => {
    const existing = prepared('2026-08-17', 3);
    const revisions: number[] = [];
    const publish = vi.fn(async () => history([existing]));
    await generateRange(
      ['--from', '2026-08-17', '--days', '1', '--revision', '7'],
      {
        history: async () => history([existing]),
        orchestrate: async (input) => {
          revisions.push(input.revision);
          return prepared(input.date, input.revision);
        },
        publishBatch: publish,
      },
    );
    expect(revisions).toEqual([7]);
    expect(publish.mock.calls[0]?.[0].existingCases).toEqual([]);
  });

  it('allocates after withdrawn immutable artifacts that are absent from the manifest', async () => {
    const revisions: number[] = [];
    await generateRange(['--from', '2026-08-17', '--days', '1'], {
      history: async () => history(),
      listExistingCasePaths: async () => [
        '/content/cases/2026-08-17/v1.json',
        '/content/cases/2026-08-17/v3.json',
      ],
      orchestrate: async (input) => {
        revisions.push(input.revision);
        return prepared(input.date, input.revision);
      },
      publishBatch: async () => history(),
    });

    expect(revisions).toEqual([4]);
  });

  it('rejects an explicit revision at or below existing history before orchestration', async () => {
    const orchestrate = vi.fn(async (input) =>
      prepared(input.date, input.revision),
    );
    const publish = vi.fn(async () => history());
    const existing = prepared('2026-08-17', 3);
    for (const revision of [2, 3]) {
      await expect(
        generateRange(
          [
            '--from',
            '2026-08-17',
            '--days',
            '1',
            '--revision',
            String(revision),
          ],
          {
            history: async () => history([existing]),
            listExistingCasePaths: async () => [
              '/content/cases/2026-08-17/v3.json',
            ],
            orchestrate,
            publishBatch: publish,
          },
        ),
      ).rejects.toThrow(/revision/i);
    }
    expect(orchestrate).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('accepts an explicit revision above all existing history', async () => {
    const revisions: number[] = [];
    await generateRange(
      ['--from', '2026-08-17', '--days', '1', '--revision', '4'],
      {
        history: async () => history([prepared('2026-08-17', 3)]),
        listExistingCasePaths: async () => [
          '/content/cases/2026-08-17/v3.json',
        ],
        orchestrate: async (input) => {
          revisions.push(input.revision);
          return prepared(input.date, input.revision);
        },
        publishBatch: async () => history(),
      },
    );
    expect(revisions).toEqual([4]);
  });
});
