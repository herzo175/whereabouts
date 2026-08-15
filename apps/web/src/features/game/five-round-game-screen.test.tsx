import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import {
  createFiveRoundProgress,
  submitRoundGuess,
} from '@whereabouts/game-engine';
import { describe, expect, it, vi } from 'vitest';

import { FiveRoundGameScreen } from './five-round-game-screen';

function makeStorage(initial?: Record<string, string>): Storage {
  const values = new Map<string, string>();
  for (const [key, value] of Object.entries(initial ?? {}))
    values.set(key, value);

  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
}

describe('FiveRoundGameScreen', () => {
  it('shows a neutral briefing, then reveals the scored relationship before the next round', async () => {
    const user = userEvent.setup();
    const caseData = makeFiveRoundCase();
    const guessedPoi = caseData.pois[10];

    render(
      <FiveRoundGameScreen
        caseData={caseData}
        globeSupported={false}
        storage={makeStorage()}
      />,
    );

    expect(await screen.findByText('Round 1 / 5')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /round 1 target photograph/i }),
    ).toHaveAttribute('src', caseData.rounds[0].image.url);
    expect(screen.getByText(caseData.rounds[0].clue.text)).toBeInTheDocument();

    const search = screen.getByRole('searchbox', { name: /search locations/i });
    await user.clear(search);
    await user.type(search, guessedPoi.name);
    await user.click(
      screen.getByRole('button', { name: new RegExp(guessedPoi.name, 'i') }),
    );

    expect(screen.getByRole('dialog', { name: guessedPoi.name })).toBeVisible();
    expect(screen.queryByRole('img', { name: /place 10/i })).toBeNull();
    if (guessedPoi.blurb) {
      expect(screen.queryByText(guessedPoi.blurb)).toBeNull();
    }

    await user.click(screen.getByRole('button', { name: /submit this lead/i }));

    expect(
      screen.getByRole('heading', { name: /round 1 revealed/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/warm · 50 points/i)).toBeInTheDocument();
    expect(
      screen.getByText(caseData.rounds[0].results[10].text),
    ).toBeInTheDocument();
    expect(screen.getByText('Target Place')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next round/i })).toBeVisible();

    await user.click(screen.getByRole('button', { name: /next round/i }));

    expect(screen.getByText('Round 2 / 5')).toBeInTheDocument();
    await user.clear(
      screen.getByRole('searchbox', { name: /search locations/i }),
    );
    await user.type(
      screen.getByRole('searchbox', { name: /search locations/i }),
      'Target Place',
    );
    expect(
      screen.getByRole('button', { name: /target place/i }),
    ).toBeDisabled();
  });

  it('restores a finished game and copies its spoiler-free daily score', async () => {
    const user = userEvent.setup();
    const caseData = makeFiveRoundCase();
    const completed = caseData.rounds.reduce(
      (progress, round) => ({
        ...submitRoundGuess(caseData, progress, round.targetPoiId),
        acknowledgedRoundCount: progress.acknowledgedRoundCount + 1,
      }),
      createFiveRoundProgress(caseData),
    );
    const onShare = vi.fn();
    const storage = makeStorage({
      [`whereabouts:case:${caseData.publicationDate}`]:
        JSON.stringify(completed),
    });

    render(
      <FiveRoundGameScreen
        caseData={caseData}
        globeSupported={false}
        onShare={onShare}
        storage={storage}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: /daily score/i }),
    ).toBeVisible();
    expect(screen.getByText('500 / 500')).toBeVisible();
    expect(screen.getAllByText(/^correct$/i)).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: /copy result/i }));
    expect(onShare).toHaveBeenCalledWith(caseData, completed);
    expect(screen.getByRole('button', { name: /copied/i })).toBeVisible();
  });

  it('restores an unacknowledged reveal instead of skipping to the next round', async () => {
    const caseData = makeFiveRoundCase();
    const progress = submitRoundGuess(
      caseData,
      createFiveRoundProgress(caseData),
      caseData.pois[10].id,
    );
    const storage = makeStorage({
      [`whereabouts:case:${caseData.publicationDate}`]:
        JSON.stringify(progress),
    });

    render(
      <FiveRoundGameScreen
        caseData={caseData}
        globeSupported={false}
        storage={storage}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: /round 1 revealed/i }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: /next round/i })).toBeVisible();
  });
});
