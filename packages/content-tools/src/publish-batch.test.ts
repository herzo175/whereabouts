import { makeThemedCase } from '@whereabouts/case-content/testing';
import { describe, expect, it, vi } from 'vitest';
import { type PreparedCase, publishBatch } from './publish-batch.js';

function reviewFor(caseData: ReturnType<typeof makeThemedCase>) {
  return {
    schemaVersion: 1 as const,
    publicationDate: caseData.publicationDate,
    revision: caseData.revision,
    themeVerdicts: caseData.pois.map((poi) => ({
      poiId: poi.id,
      status: 'pass' as const,
      explanation: 'The candidate clearly satisfies the stated theme criteria.',
      sourceIds: ['source-01'],
    })),
    clueVerdicts: caseData.rounds.map((round) => ({
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

function prepared(
  date: string,
  revision: number,
  targetOffset = 0,
): PreparedCase {
  const caseData = makeThemedCase({
    publicationDate: date,
    revision,
    caseNumber: Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000),
  });
  if (targetOffset) {
    for (const [index, round] of caseData.rounds.entries()) {
      round.targetPoiId = `poi-${String(index + targetOffset).padStart(2, '0')}`;
      for (const [resultIndex, result] of round.results.entries())
        result.tier =
          result.poiId === round.targetPoiId
            ? 'correct'
            : resultIndex < 4
              ? 'hot'
              : resultIndex < 12
                ? 'warm'
                : 'cold';
    }
  }
  return {
    caseData,
    generationReview: reviewFor(caseData),
    markdownReview: `# ${date}\n`,
  };
}

const manifest = { schemaVersion: 2 as const, cases: {} };

describe('publishBatch', () => {
  it('preflights every member and performs zero writes on an invalid member', async () => {
    const writes: string[] = [];
    const invalid = prepared('2026-11-02', 1);
    invalid.generationReview = { ...invalid.generationReview, revision: 2 };
    await expect(
      publishBatch({
        prepared: [prepared('2026-11-01', 1), invalid],
        manifest,
        writeFile: async (path) => {
          writes.push(path);
        },
        exists: async () => false,
      }),
    ).rejects.toThrow(/review|revision/i);
    expect(writes).toEqual([]);
  });

  it('writes all artifacts before the final manifest and returns exact manifest results', async () => {
    const writes: string[] = [];
    const result = await publishBatch({
      prepared: [prepared('2026-11-01', 1), prepared('2026-11-02', 1, 5)],
      manifest,
      writeFile: async (path) => {
        writes.push(path);
      },
      exists: async () => false,
    });
    expect(writes).toHaveLength(7);
    expect(writes.at(-1)).toMatch(/manifest\.json$/);
    expect(result).toEqual({
      schemaVersion: 2,
      cases: {
        '2026-11-01': {
          caseNumber: 20758,
          revision: 1,
          file: './cases/2026-11-01/v1.json',
        },
        '2026-11-02': {
          caseNumber: 20759,
          revision: 1,
          file: './cases/2026-11-02/v1.json',
        },
      },
    });
  });

  it('rejects an existing artifact destination before writing', async () => {
    const writeFile = vi.fn(async () => undefined);
    await expect(
      publishBatch({
        prepared: [prepared('2026-11-01', 1)],
        manifest,
        writeFile,
        exists: async (path) => path.endsWith('/v1.json'),
      }),
    ).rejects.toThrow(/exist/i);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('rejects malformed manifest entries before any writes', async () => {
    const writes: string[] = [];
    await expect(
      publishBatch({
        prepared: [prepared('2026-11-01', 1)],
        manifest: {
          schemaVersion: 2,
          cases: {
            '2026-10-01': {
              caseNumber: 1,
              revision: 1,
              file: './cases/2026-10-01/v1.json',
            },
          },
        },
        writeFile: async (path) => {
          writes.push(path);
        },
        exists: async () => false,
      }),
    ).rejects.toThrow(/manifest/i);
    expect(writes).toEqual([]);
  });

  it('preflights cross-case collection invariants before any writes', async () => {
    const writes: string[] = [];
    await expect(
      publishBatch({
        prepared: [prepared('2026-11-01', 1), prepared('2026-11-02', 1)],
        manifest,
        writeFile: async (path) => {
          writes.push(path);
        },
        exists: async () => false,
      }),
    ).rejects.toThrow(/collection/i);
    expect(writes).toEqual([]);
  });

  it('validates collection invariants against supplied prior case history', async () => {
    const writes: string[] = [];
    await expect(
      publishBatch({
        prepared: [prepared('2026-11-01', 1)],
        existingCases: [prepared('2026-10-01', 1).caseData],
        manifest,
        writeFile: async (path) => {
          writes.push(path);
        },
        exists: async () => false,
      }),
    ).rejects.toThrow(/collection/i);
    expect(writes).toEqual([]);
  });
});
