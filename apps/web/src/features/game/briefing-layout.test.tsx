import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BriefingLayout } from './briefing-layout';

const clues = Array.from({ length: 6 }, (_, index) => ({
  id: `clue-${index + 1}`,
  text: `Fixture clue ${index + 1} contains enough detail to be readable.`,
  sourceIds: ['source-01'],
}));

describe('BriefingLayout', () => {
  it('shows the current case, one unlocked clue, and the attempts remaining', () => {
    render(
      <BriefingLayout
        attemptsRemaining={6}
        caseNumber={14}
        onOpenArchive={vi.fn()}
        visibleClues={clues.slice(0, 1)}
      >
        <button type="button">Choose a location</button>
      </BriefingLayout>,
    );

    expect(screen.getByRole('heading', { name: 'Whereabouts' })).toBeDefined();
    expect(screen.getByText('Case 14')).toBeDefined();
    expect(screen.getByText(/fixture clue 1/i)).toBeDefined();
    for (const clue of clues.slice(1)) {
      expect(screen.queryByText(clue.text)).toBeNull();
    }
    expect(screen.getByText('6 attempts remaining')).toBeDefined();
    expect(
      screen.getByRole('button', { name: /open case archive/i }),
    ).toBeDefined();
  });
});
