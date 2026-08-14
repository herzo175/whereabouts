import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BriefingLayout } from './briefing-layout';

const clues = Array.from({ length: 6 }, (_, index) => ({
  id: `clue-${index + 1}`,
  text: `Fixture clue ${index + 1} contains enough detail to be readable.`,
  sourceIds: ['source-01'],
}));

describe('BriefingLayout', () => {
  it('shows a quiet header, attempt bubbles, and one unlocked clue', () => {
    render(
      <BriefingLayout
        attempts={[
          { poiName: 'Place 01', tier: 'cold' },
          { poiName: 'Place 02', tier: 'hot' },
        ]}
        onSelectAttempt={vi.fn()}
        visibleClues={clues.slice(0, 1)}
      >
        <button type="button">Choose a location</button>
      </BriefingLayout>,
    );

    expect(screen.getByRole('heading', { name: 'Whereabouts' })).toBeDefined();
    expect(screen.getByText('Clue 1')).toBeDefined();
    expect(screen.getByText(/fixture clue 1/i)).toBeDefined();
    for (const clue of clues.slice(1)) {
      expect(screen.queryByText(clue.text)).toBeNull();
    }
    expect(screen.queryByText(/attempts remaining/i)).toBeNull();
    expect(screen.queryByText(/field intelligence/i)).toBeNull();
    expect(
      screen.queryByRole('button', { name: /open case archive/i }),
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: /attempt 1, cold, place 01/i,
      }),
    ).toBeDefined();
    expect(screen.getAllByTestId('empty-attempt')).toHaveLength(4);
  });
});
