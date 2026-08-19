import { render, screen } from '@testing-library/react';
import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import type { FiveRoundProgress } from '@whereabouts/game-engine';
import { describe, expect, it, vi } from 'vitest';

import { AppShell, shareCurrentResult } from './app-shell';
import { BriefingUnavailable } from './briefing-unavailable';

const completedProgress: FiveRoundProgress = {
  schemaVersion: 3,
  caseDate: '2026-08-14',
  caseRevision: 1,
  guesses: [
    { roundId: 'round-1', poiId: 'poi-00', points: 100 },
    { roundId: 'round-2', poiId: 'poi-01', points: 100 },
    { roundId: 'round-3', poiId: 'poi-02', points: 100 },
    { roundId: 'round-4', poiId: 'poi-03', points: 100 },
    { roundId: 'round-5', poiId: 'poi-04', points: 100 },
  ],
  acknowledgedRoundCount: 5,
  completedAt: '2026-08-14T12:00:00.000Z',
};

describe('route state', () => {
  it('keeps retired controls out of the active briefing', () => {
    render(<AppShell caseData={makeFiveRoundCase()} date="2026-08-14" />);

    expect(screen.queryByRole('button', { name: /open case/i })).toBeNull();
  });

  it('presents an unpublished valid date as an unavailable briefing', () => {
    render(<BriefingUnavailable date="2026-08-15" />);

    expect(
      screen.getByRole('heading', { name: /briefing unavailable/i }),
    ).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: /today’s case/i })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('builds and copies the current route result using the browser origin', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const onStatus = vi.fn();

    await shareCurrentResult({
      caseData: makeFiveRoundCase(),
      date: '2026-08-14',
      navigatorValue: { clipboard: { writeText } },
      origin: 'https://whereabouts.test',
      progress: completedProgress,
      onStatus,
    });

    expect(writeText).toHaveBeenCalledWith(
      'WHEREABOUTS\nAugust 14, 2026\n🟢 🟢 🟢 🟢 🟢\n500 / 500\nhttps://whereabouts.test',
    );
    expect(onStatus).toHaveBeenCalledWith('copied');
  });
});
