import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import type { FiveRoundProgress } from '@whereabouts/game-engine';
import { describe, expect, it, vi } from 'vitest';

import { buildShareText, shareResult } from './share';

const fiveRoundCase = makeFiveRoundCase({ caseNumber: 42 });

function fiveRoundProgress(
  overrides: Partial<FiveRoundProgress> = {},
): FiveRoundProgress {
  return {
    schemaVersion: 2,
    caseDate: '2026-08-14',
    caseRevision: 1,
    guesses: [
      {
        roundId: 'round-1',
        poiId: 'known-place',
        tier: 'correct',
        points: 100,
      },
      { roundId: 'round-2', poiId: 'known-place', tier: 'hot', points: 75 },
      { roundId: 'round-3', poiId: 'known-place', tier: 'warm', points: 50 },
      { roundId: 'round-4', poiId: 'known-place', tier: 'cold', points: 25 },
      {
        roundId: 'round-5',
        poiId: 'known-place',
        tier: 'correct',
        points: 100,
      },
    ],
    acknowledgedRoundCount: 5,
    completedAt: '2026-08-14T12:00:00.000Z',
    ...overrides,
  };
}

describe('buildShareText', () => {
  it('builds a spoiler-free themed five-round share result', () => {
    const text = buildShareText(
      fiveRoundCase,
      fiveRoundProgress(),
      'https://whereabouts.test/',
    );

    expect(text).toBe(
      'WHEREABOUTS\n🟢 🟠 🟡 🔵 🟢\n350 / 500\nhttps://whereabouts.test',
    );
    expect(text).not.toContain(fiveRoundCase.publicationDate);
    expect(text).not.toContain('Known place');
    expect(text).not.toContain('Evidence photograph');
    expect(text).not.toContain('A revealing clue');
  });

  it('refuses to share an incomplete themed five-round game', () => {
    expect(() =>
      buildShareText(
        fiveRoundCase,
        fiveRoundProgress({
          guesses: fiveRoundProgress().guesses.slice(0, 4),
          completedAt: undefined,
        }),
        'https://whereabouts.test',
      ),
    ).toThrow(/completed/i);
  });

  it('refuses to share until the final reveal is acknowledged', () => {
    expect(() =>
      buildShareText(
        fiveRoundCase,
        fiveRoundProgress({ acknowledgedRoundCount: 4 }),
        'https://whereabouts.test',
      ),
    ).toThrow(/revealed/i);
  });
});

describe('shareResult', () => {
  it('copies plain text even when native sharing is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareResult('result', { share, clipboard: { writeText } }),
    ).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('result');
    expect(share).not.toHaveBeenCalled();
  });

  it('copies when native sharing is unsupported', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareResult('result', { clipboard: { writeText } }),
    ).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('result');
  });

  it('throws a useful error if no sharing method works', async () => {
    await expect(shareResult('result', {})).rejects.toThrow(/copy/i);
  });
});
