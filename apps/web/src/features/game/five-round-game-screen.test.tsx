import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import {
  acknowledgeRoundReveal,
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
  it("shows today's theme before a guess and both dossier connections after submission", async () => {
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

    expect(
      await screen.findByRole('heading', { name: 'Railway Hotels' }),
    ).toBeVisible();
    expect(screen.getByText(caseData.theme.introduction)).toBeVisible();
    expect(screen.queryByText(guessedPoi.themeConnection.text)).toBeNull();

    const search = screen.getByRole('searchbox', { name: /search locations/i });
    await user.type(search, guessedPoi.name);
    await user.click(
      screen.getByRole('button', { name: new RegExp(guessedPoi.name, 'i') }),
    );
    await user.click(screen.getByRole('button', { name: /submit this lead/i }));

    expect(screen.getAllByText("Why it fits today's theme")).toHaveLength(2);
    expect(screen.getAllByText(guessedPoi.themeConnection.text)).toHaveLength(
      1,
    );
    const correctPoi = caseData.pois.find(
      (poi) => poi.id === caseData.rounds[0].targetPoiId,
    );
    expect(correctPoi).toBeDefined();
    if (!correctPoi) return;
    expect(screen.getByText(correctPoi.themeConnection.text)).toBeVisible();
  });

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
    expect(screen.getByText(/warm · 56 points/i)).toBeInTheDocument();
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
    expect(
      screen.getByRole('list', { name: /matching locations/i }),
    ).toBeVisible();
    expect(screen.getByText(/globe unavailable/i)).toBeVisible();

    await user.click(screen.getByRole('button', { name: /copy result/i }));
    expect(onShare).toHaveBeenCalledWith(caseData, completed);
    expect(screen.getByRole('button', { name: /copied/i })).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /back to previous result/i }),
    );
    expect(
      screen.getByRole('heading', { name: /round 5 revealed/i }),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: /return to daily summary/i }),
    );
    expect(screen.getByRole('heading', { name: /daily score/i })).toBeVisible();
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

  it('navigates backward and forward through previous results without changing progress', async () => {
    const user = userEvent.setup();
    const caseData = makeFiveRoundCase();
    const progress = caseData.rounds
      .slice(0, 2)
      .reduce(
        (current, round) =>
          acknowledgeRoundReveal(
            submitRoundGuess(caseData, current, round.targetPoiId),
          ),
        createFiveRoundProgress(caseData),
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

    expect(await screen.findByText('Round 3 / 5')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: /back to previous result/i }),
    );
    expect(
      screen.getByRole('heading', { name: /round 2 revealed/i }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /back to round 1 result/i }),
    );
    expect(
      screen.getByRole('heading', { name: /round 1 revealed/i }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /forward to round 2 result/i }),
    );
    expect(
      screen.getByRole('heading', { name: /round 2 revealed/i }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /return to round 3/i }),
    );
    expect(screen.getByText('Round 3 / 5')).toBeVisible();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
