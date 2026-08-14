import { render, screen } from '@testing-library/react';
import { makeCase } from '@whereabouts/case-content/testing';
import type { GameProgress } from '@whereabouts/game-engine';
import { describe, expect, it, vi } from 'vitest';

import { AppShell, shareCurrentResult } from './app-shell';
import { BriefingUnavailable } from './briefing-unavailable';

const completedProgress: GameProgress = {
  schemaVersion: 1,
  caseDate: '2026-08-14',
  caseRevision: 1,
  guessedPoiIds: ['poi-01', 'poi-00'],
  outcome: 'won',
  completedAt: '2026-08-14T12:00:00.000Z',
};

describe('route state', () => {
  it('keeps archive controls out of the active briefing', () => {
    render(
      <AppShell
        caseData={makeCase()}
        date="2026-08-14"
        publishedCases={[{ date: '2026-08-14', caseNumber: 1 }]}
        today="2026-08-14"
      />,
    );

    expect(
      screen.queryByRole('button', { name: /open case archive/i }),
    ).toBeNull();
  });

  it('presents an unpublished valid date as an unavailable briefing', () => {
    render(<BriefingUnavailable date="2026-08-15" onOpenArchive={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: /briefing unavailable/i }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /open case archive/i }),
    ).toBeVisible();
  });

  it('builds and shares the current route result using the browser origin', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const onStatus = vi.fn();

    await shareCurrentResult({
      caseData: makeCase(),
      date: '2026-08-14',
      navigatorValue: { share },
      origin: 'https://whereabouts.test',
      progress: completedProgress,
      onStatus,
    });

    expect(share).toHaveBeenCalledWith({
      text: 'WHEREABOUTS 2/6\n🔵 🟢\nhttps://whereabouts.test/2026-08-14',
    });
    expect(onStatus).toHaveBeenCalledWith('shared');
  });
});
