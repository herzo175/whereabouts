import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import {
  acknowledgeRoundReveal,
  createFiveRoundProgress,
  submitRoundGuess,
} from '@whereabouts/game-engine';
import { describe, expect, it, vi } from 'vitest';

import { DailyScorePanel } from './daily-score-panel';

describe('DailyScorePanel', () => {
  it('offers selectable share text when clipboard copying fails', async () => {
    const user = userEvent.setup();
    const caseData = makeFiveRoundCase();
    caseData.pois[0] = {
      ...caseData.pois[0],
      blurb: 'A concise account of the first location.',
    };
    const progress = caseData.rounds.reduce(
      (current, round) =>
        acknowledgeRoundReveal(
          submitRoundGuess(caseData, current, round.targetPoiId),
        ),
      createFiveRoundProgress(caseData),
    );

    render(
      <DailyScorePanel
        caseData={caseData}
        onShare={vi.fn().mockRejectedValue(new Error('clipboard denied'))}
        progress={progress}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /daily score/i }).closest('header'),
    ).toHaveClass('text-center', 'sm:text-left');

    for (const round of caseData.rounds) {
      const place = caseData.pois.find((poi) => poi.id === round.targetPoiId);
      expect(place).toBeDefined();
      if (place) expect(screen.getByText(place.name)).toBeVisible();
    }

    const firstRound = caseData.rounds[0];
    const firstPlace = caseData.pois.find(
      (poi) => poi.id === firstRound.targetPoiId,
    );
    expect(firstPlace).toBeDefined();
    if (!firstPlace) return;

    await user.click(
      screen.getByRole('button', {
        name: `Open round 1 location dossier: ${firstPlace.name}`,
      }),
    );
    expect(screen.getByRole('dialog', { name: firstPlace.name })).toBeVisible();
    expect(
      screen.getByText('A concise account of the first location.'),
    ).toBeVisible();
    expect(
      screen.getByRole('img', { name: firstRound.image.alt }),
    ).toHaveAttribute('src', firstRound.image.url);
    expect(
      screen.getByRole('link', {
        name: `Read ${firstPlace.name} on Wikipedia`,
      }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: /^close$/i }));

    await user.click(screen.getByRole('button', { name: /copy result/i }));

    const fallback = screen.getByRole('textbox', {
      name: /copy this result manually/i,
    });
    expect((fallback as HTMLTextAreaElement).value).toContain('WHEREABOUTS');
    expect((fallback as HTMLTextAreaElement).value).not.toContain(
      'Target Place',
    );
  });
});
