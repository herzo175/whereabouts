import { render, screen, within } from '@testing-library/react';
import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import { describe, expect, it } from 'vitest';

import { RoundReveal } from './round-reveal';

function getFixture() {
  const caseData = makeFiveRoundCase();
  const round = caseData.rounds[0];
  const correctPoi = caseData.pois.find((poi) => poi.id === round.targetPoiId);

  if (!correctPoi) throw new Error('Expected the first-round target POI');

  return { caseData, correctPoi, round };
}

describe('RoundReveal', () => {
  it('shows the correct location first without explanatory sections', () => {
    const { caseData, correctPoi } = getFixture();
    const guessedPoi = caseData.pois.find((poi) => poi.id !== correctPoi.id);

    if (!guessedPoi) throw new Error('Expected an incorrect candidate POI');

    render(
      <RoundReveal
        correctPoi={correctPoi}
        guessedPoi={guessedPoi}
        points={56}
        roundNumber={1}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Not quite' })).toBeVisible();
    expect(
      screen.getByText(`The correct location was ${correctPoi.name}.`),
    ).toBeVisible();
    expect(screen.queryByTestId('correct-confetti')).toBeNull();
    const dossiers = screen.getAllByRole('article', { name: /location:/i });
    expect(dossiers).toHaveLength(2);
    expect(dossiers[0]).toHaveAccessibleName(
      `Correct location: ${correctPoi.name}`,
    );
    expect(dossiers[1]).toHaveAccessibleName(
      `Your location: ${guessedPoi.name}`,
    );
    expect(dossiers[0]).toHaveClass('border-emerald-300/50');
    expect(dossiers[1]).toHaveClass('border-brass/40');
    expect(screen.queryByText("Why it fits today's theme")).toBeNull();
    expect(screen.queryByText('Authored relationship')).toBeNull();
  });

  it('shows one correct-location card when the guess is correct', () => {
    const { correctPoi } = getFixture();

    render(
      <RoundReveal
        correctPoi={correctPoi}
        guessedPoi={correctPoi}
        points={100}
        roundNumber={1}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Correct!' })).toBeVisible();
    expect(screen.getByText(`You found ${correctPoi.name}.`)).toBeVisible();
    expect(screen.getByTestId('correct-confetti')).toHaveClass(
      'motion-reduce:hidden',
    );
    const dossiers = screen.getAllByRole('article', { name: /location:/i });
    expect(dossiers).toHaveLength(1);
    expect(dossiers[0]).toHaveAccessibleName(
      `Correct location: ${correctPoi.name}`,
    );
    expect(dossiers[0].parentElement).not.toHaveClass('sm:grid-cols-2');
    expect(dossiers[0]).toHaveClass('sm:grid-cols-[minmax(14rem,2fr)_3fr]');
    expect(within(dossiers[0]).getByRole('img')).toHaveClass('sm:h-full');
    expect(screen.queryByText('Your location')).toBeNull();
    expect(screen.queryByText("Why it fits today's theme")).toBeNull();
    expect(screen.queryByText('Authored relationship')).toBeNull();
  });
});
