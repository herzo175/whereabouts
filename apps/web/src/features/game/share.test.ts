import type { DailyCase, Poi } from '@whereabouts/case-content';
import type { GameProgress } from '@whereabouts/game-engine';
import { describe, expect, it, vi } from 'vitest';

import { buildShareText, shareResult } from './share';

function poi(id: string, name: string): Poi {
  return {
    id,
    name,
    city: 'Hidden city',
    country: 'Hidden country',
    latitude: 0,
    longitude: 0,
    wikipediaTitle: name,
  };
}

const caseData: DailyCase = {
  schemaVersion: 1,
  publicationDate: '2026-08-14',
  revision: 1,
  caseNumber: 42,
  target: { poiId: 'target', destinationName: 'Secret destination' },
  pois: [
    poi('cold', 'Cold POI'),
    poi('warm', 'Warm POI'),
    poi('hot', 'Hot POI'),
    poi('target', 'Target POI'),
    poi('extra-one', 'Extra one'),
    poi('extra-two', 'Extra two'),
    poi('extra-three', 'Extra three'),
  ],
  clues: [],
  contextualResponses: [
    { poiId: 'cold', tier: 'cold', text: 'Cold', sourceIds: [] },
    { poiId: 'warm', tier: 'warm', text: 'Warm', sourceIds: [] },
    { poiId: 'hot', tier: 'hot', text: 'Hot', sourceIds: [] },
    { poiId: 'extra-one', tier: 'cold', text: 'Cold', sourceIds: [] },
    { poiId: 'extra-two', tier: 'warm', text: 'Warm', sourceIds: [] },
    { poiId: 'extra-three', tier: 'hot', text: 'Hot', sourceIds: [] },
  ],
  reveal: {
    title: 'Target POI',
    summary: 'Hidden city',
    clueExplanation: 'Secret destination',
    sourceIds: [],
  },
  sources: [],
};

function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    schemaVersion: 1,
    caseDate: '2026-08-14',
    caseRevision: 1,
    guessedPoiIds: ['cold', 'warm', 'hot', 'target'],
    outcome: 'won',
    completedAt: '2026-08-14T12:00:00.000Z',
    ...overrides,
  };
}

describe('buildShareText', () => {
  it('builds a spoiler-free share result for a win', () => {
    const text = buildShareText(
      caseData,
      progress(),
      'https://whereabouts.test/',
    );

    expect(text).toBe(
      'WHEREABOUTS 4/6\n🔵 🟡 🟠 🟢\nhttps://whereabouts.test/2026-08-14',
    );
    expect(text).not.toContain('Target POI');
    expect(text).not.toContain('Hidden city');
    expect(text).not.toContain('Hidden country');
    expect(text).not.toContain('Secret destination');
  });

  it('uses X/6 for a loss', () => {
    expect(
      buildShareText(
        caseData,
        progress({
          guessedPoiIds: [
            'cold',
            'warm',
            'hot',
            'extra-one',
            'extra-two',
            'extra-three',
          ],
          outcome: 'lost',
        }),
        'https://whereabouts.test',
      ),
    ).toContain('WHEREABOUTS X/6');
  });

  it('refuses to share an unfinished game', () => {
    expect(() =>
      buildShareText(
        caseData,
        progress({
          guessedPoiIds: ['cold'],
          outcome: 'playing',
          completedAt: undefined,
        }),
        'https://whereabouts.test',
      ),
    ).toThrow(/completed/i);
  });
});

describe('shareResult', () => {
  it('uses native sharing when it is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();

    await expect(
      shareResult('result', { share, clipboard: { writeText } }),
    ).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'result' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies when native sharing is unsupported', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareResult('result', { clipboard: { writeText } }),
    ).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('result');
  });

  it('does not copy when native sharing is cancelled', async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    const writeText = vi.fn();

    await expect(
      shareResult('result', { share, clipboard: { writeText } }),
    ).resolves.toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('recognizes AbortError from browsers that do not expose DOMException', async () => {
    const share = vi.fn().mockRejectedValue({ name: 'AbortError' });
    const writeText = vi.fn();

    await expect(
      shareResult('result', { share, clipboard: { writeText } }),
    ).resolves.toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies after a native-share failure', async () => {
    const share = vi.fn().mockRejectedValue(new Error('Share failed'));
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareResult('result', { share, clipboard: { writeText } }),
    ).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('result');
  });

  it('throws a useful error if no sharing method works', async () => {
    await expect(shareResult('result', {})).rejects.toThrow(/share or copy/i);
  });
});
