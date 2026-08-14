import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCase } from '@whereabouts/case-content/testing';
import { describe, expect, it, vi } from 'vitest';

import { GameScreen } from './game-screen';

function makeStorage(): Storage {
  const values = new Map<string, string>();

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

async function guess(user: ReturnType<typeof userEvent.setup>, name: string) {
  const search = screen.getByRole('searchbox', { name: /search locations/i });
  await user.clear(search);
  await user.type(search, name);
  await user.click(screen.getByRole('button', { name: new RegExp(name, 'i') }));
  await user.click(screen.getByRole('button', { name: /submit this lead/i }));
}

describe('GameScreen', () => {
  it('saves each lead, unlocks the next clue, and reveals a completed case', async () => {
    const user = userEvent.setup();
    const storage = makeStorage();
    const onShare = vi.fn();
    const caseData = makeCase();

    render(
      <GameScreen
        caseData={caseData}
        globeSupported={false}
        onShare={onShare}
        storage={storage}
      />,
    );

    await guess(user, 'Place 10');

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: /place 10/i })).toBeVisible();
    expect(screen.getByText(/^warm$/i)).toBeInTheDocument();
    expect(screen.queryByText(/relationship/i)).toBeNull();
    expect(
      screen.getByText(caseData.contextualResponses[9].text),
    ).toBeInTheDocument();
    expect(screen.getByText('Clue 2')).toBeInTheDocument();
    expect(screen.getByText(caseData.clues[1].text)).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('button', { name: /place 10/i })
        .some((button) => button.hasAttribute('disabled')),
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: /close report/i }));
    await user.click(
      screen.getByRole('button', {
        name: /attempt 1, warm, place 10/i,
      }),
    );
    expect(screen.getByRole('dialog', { name: /place 10/i })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /close report/i }));

    await guess(user, 'Target Place');

    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole('heading', { name: /case closed/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/target place/i)).toBeInTheDocument();
    expect(screen.getByText(caseData.reveal.summary)).toBeInTheDocument();
    expect(
      screen.getByText(caseData.reveal.clueExplanation),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /attempt 2, case solved, target place/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /fixture source source-01/i }),
    ).toHaveAttribute('href', 'https://example.com/source-01');
    expect(screen.queryByRole('link', { name: /source-02/i })).toBeNull();
    expect(
      screen.queryByRole('searchbox', { name: /search locations/i }),
    ).toBeNull();

    await user.click(screen.getByRole('button', { name: /share result/i }));
    expect(onShare).toHaveBeenCalledWith(
      caseData,
      expect.objectContaining({
        outcome: 'won',
        guessedPoiIds: ['poi-10', 'poi-00'],
      }),
    );
  });

  it('closes the trail after six wrong leads', async () => {
    const user = userEvent.setup();
    const storage = makeStorage();

    render(
      <GameScreen
        caseData={makeCase()}
        globeSupported={false}
        storage={storage}
      />,
    );

    for (const index of ['01', '02', '03', '04', '05', '06']) {
      await guess(user, `Place ${index}`);
    }

    expect(storage.setItem).toHaveBeenCalledTimes(6);
    expect(
      screen.getByRole('heading', { name: /trail lost/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('searchbox', { name: /search locations/i }),
    ).toBeNull();
  });
});
