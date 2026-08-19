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
  it("shows today's theme before a guess and the correct dossier connection after submission", async () => {
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
    const masthead = screen.getByRole('heading', {
      name: 'Whereabouts',
    }).parentElement;
    expect(masthead).toHaveClass('text-center', 'sm:text-left');
    expect(
      screen.getByRole('list', { name: /daily round progress/i }),
    ).toHaveClass('justify-center', 'sm:justify-start');
    expect(screen.getByText(caseData.theme.introduction)).toBeVisible();
    expect(screen.queryByText(guessedPoi.themeConnection.text)).toBeNull();

    const search = screen.getByRole('searchbox', { name: /search locations/i });
    await user.type(search, guessedPoi.name);
    await user.click(
      screen.getByRole('button', { name: new RegExp(guessedPoi.name, 'i') }),
    );
    await user.click(screen.getByRole('button', { name: /submit this lead/i }));

    expect(screen.getAllByText("Why it fits today's theme")).toHaveLength(1);
    expect(screen.queryByText(guessedPoi.themeConnection.text)).toBeNull();
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
    expect(screen.queryByText(caseData.rounds[0].image.attribution)).toBeNull();
    expect(screen.queryByRole('link', { name: /license/i })).toBeNull();
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

    const revealHeading = screen.getByRole('heading', {
      name: /not quite/i,
    });
    expect(revealHeading).toBeInTheDocument();
    expect(revealHeading.closest('header')).toHaveClass('text-center');
    expect(revealHeading.closest('header')).not.toHaveClass('sm:text-left');
    const revealMasthead = screen.getByRole('heading', {
      name: 'Whereabouts',
    }).parentElement;
    expect(revealMasthead).toHaveClass('text-center');
    expect(revealMasthead).not.toHaveClass('sm:text-left');
    const revealTheme = screen.getByRole('heading', {
      name: caseData.theme.title,
    });
    expect(revealTheme).toHaveClass('text-center');
    expect(revealTheme).not.toHaveClass('sm:text-left');
    expect(screen.getByText(/warm · 56 points/i)).toBeInTheDocument();
    expect(
      screen.getByText(caseData.rounds[0].results[10].text),
    ).toBeInTheDocument();
    expect(screen.queryByText(caseData.rounds[0].image.attribution)).toBeNull();
    expect(screen.queryByRole('link', { name: /license/i })).toBeNull();
    expect(screen.getByText('Target Place')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next round/i })).toHaveClass(
      'flex-1',
    );

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
    const fieldGuide = screen.getByText(/field guide/i);
    expect(fieldGuide.closest('details')).not.toHaveAttribute('open');
    expect(
      screen.queryByRole('list', { name: /candidate locations/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('link', {
        name: 'Photo license for Target Place',
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('link', {
        name: 'Wikipedia article for Target Place',
      }),
    ).toBeNull();
    await user.click(fieldGuide);
    await user.click(
      screen.getByRole('button', { name: 'Open Target Place dossier' }),
    );
    expect(
      screen.getByRole('link', { name: 'Target Place photo license' }),
    ).toHaveAttribute('href', caseData.rounds[0].image.licenseUrl);
    expect(
      screen.getByRole('link', { name: 'Read Target Place on Wikipedia' }),
    ).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Place_0');
    await user.click(screen.getByRole('button', { name: /^close$/i }));
    await user.click(screen.getByRole('button', { name: /copy result/i }));
    expect(onShare).toHaveBeenCalledWith(caseData, completed);
    expect(screen.getByRole('button', { name: /copied/i })).toBeVisible();

    const previousResultButton = screen.getByRole('button', {
      name: /back to previous result/i,
    });
    expect(previousResultButton).toHaveClass('w-full');
    await user.click(previousResultButton);
    expect(
      screen.getByRole('region', { name: /round 5 reveal/i }),
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
      await screen.findByRole('heading', { name: /not quite/i }),
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
    expect(
      screen.getByRole('button', { name: /view round 1 result/i }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /round 3/i })).toBeNull();
    await user.click(
      screen.getByRole('button', { name: /view round 1 result/i }),
    );
    expect(
      screen.getByRole('region', { name: /round 1 reveal/i }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /forward to round 2 result/i }),
    );
    await user.click(
      screen.getByRole('button', { name: /return to round 3/i }),
    );
    const previousResultButton = screen.getByRole('button', {
      name: /back to previous result/i,
    });
    expect(
      screen
        .getAllByRole('region', { name: /choose a location/i })
        .some((region) => region.contains(previousResultButton)),
    ).toBe(true);
    expect(previousResultButton).toHaveClass('w-full');
    expect(previousResultButton).not.toHaveClass('sm:w-auto');
    await user.click(previousResultButton);
    expect(
      screen.getByRole('region', { name: /round 2 reveal/i }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /back to round 1 result/i }),
    );
    expect(
      screen.getByRole('region', { name: /round 1 reveal/i }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /forward to round 2 result/i }),
    );
    expect(
      screen.getByRole('region', { name: /round 2 reveal/i }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /return to round 3/i }),
    );
    expect(screen.getByText('Round 3 / 5')).toBeVisible();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
