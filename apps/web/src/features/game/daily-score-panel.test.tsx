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
