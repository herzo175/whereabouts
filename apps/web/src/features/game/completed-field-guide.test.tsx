import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import { describe, expect, it } from 'vitest';

import {
  CompletedFieldGuide,
  wikipediaArticleUrl,
} from './completed-field-guide';

describe('wikipediaArticleUrl', () => {
  it('trims, encodes, and converts spaces in article titles', () => {
    expect(wikipediaArticleUrl('  São Paulo Museum  ')).toBe(
      'https://en.wikipedia.org/wiki/S%C3%A3o_Paulo_Museum',
    );
  });

  it('omits absent and blank titles', () => {
    expect(wikipediaArticleUrl()).toBeUndefined();
    expect(wikipediaArticleUrl('   ')).toBeUndefined();
  });
});

describe('CompletedFieldGuide', () => {
  it('is collapsed, reports the dynamic count, and orders answers before the alphabetical remainder once', async () => {
    const user = userEvent.setup();
    const caseData = makeFiveRoundCase();
    const answerIds = caseData.rounds.map((round) => round.targetPoiId);
    render(
      <CompletedFieldGuide
        answerIds={answerIds}
        candidates={caseData.pois}
        rounds={caseData.rounds}
      />,
    );

    const disclosure = screen.getByText('Field guide').closest('summary');
    expect(disclosure).not.toBeNull();
    expect(disclosure?.parentElement).not.toHaveAttribute('open');
    expect(disclosure).toHaveClass('min-h-11', 'w-full');
    expect(screen.getByText('20 candidate locations')).toBeVisible();
    expect(screen.getByText('Show locations')).toBeVisible();
    expect(disclosure?.querySelector('svg')).toHaveClass(
      'group-open:rotate-180',
    );
    expect(screen.queryByRole('list')).toBeNull();

    if (!disclosure) throw new Error('missing field-guide disclosure');
    await user.click(disclosure);
    expect(screen.getByText('Hide locations')).toBeVisible();
    const names = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('button > span > span')?.textContent);
    const answerNames = answerIds.map(
      (id) => caseData.pois.find((poi) => poi.id === id)?.name,
    );
    const remainder = caseData.pois
      .filter((poi) => !answerIds.includes(poi.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((poi) => poi.name);
    expect(names.slice(0, answerNames.length)).toEqual(answerNames);
    expect(names.slice(answerNames.length)).toEqual(remainder);
    expect(new Set(names).size).toBe(caseData.pois.length);
  });

  it('opens a full answer dossier and restores focus to its card', async () => {
    const user = userEvent.setup();
    const caseData = makeFiveRoundCase();
    const answerIds = caseData.rounds.map((round) => round.targetPoiId);
    const firstAnswer = caseData.pois.find((poi) => poi.id === answerIds[0]);
    if (!firstAnswer) throw new Error('missing fixture answer');
    const blurb = 'A concise account of this location and its history.';
    const candidates = caseData.pois.map((poi) =>
      poi.id === firstAnswer.id ? { ...poi, blurb, image: undefined } : poi,
    );
    render(
      <CompletedFieldGuide
        answerIds={answerIds}
        candidates={candidates}
        rounds={caseData.rounds}
      />,
    );
    await user.click(screen.getByText(/field guide/i));

    const entry = screen.getByRole('button', {
      name: `Open ${firstAnswer.name} dossier`,
    });
    expect(entry).toHaveClass('min-h-11');
    await user.click(entry);

    const dialog = screen.getByRole('dialog', { name: firstAnswer.name });
    expect(within(dialog).getByText(blurb)).toBeVisible();
    expect(
      within(dialog).getByRole('img', {
        name: caseData.rounds[0].image.alt,
      }),
    ).toHaveAttribute('src', caseData.rounds[0].image.url);
    expect(
      within(dialog).getByRole('link', {
        name: `Read ${firstAnswer.name} on Wikipedia`,
      }),
    ).toBeVisible();
    expect(
      within(dialog).getByText(caseData.rounds[0].image.attribution),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('link', {
        name: `${firstAnswer.name} photo license`,
      }),
    ).toHaveAttribute('href', caseData.rounds[0].image.licenseUrl);

    await user.click(within(dialog).getByRole('button', { name: /^close$/i }));
    expect(entry).toHaveFocus();
  });

  it('omits Wikipedia when an opened candidate has no article', async () => {
    const user = userEvent.setup();
    const caseData = makeFiveRoundCase();
    const answerIds = caseData.rounds.map((round) => round.targetPoiId);
    const candidateWithoutArticle = {
      ...caseData.pois[5],
      wikipediaTitle: undefined,
    };
    const candidates = caseData.pois.map((poi) =>
      poi.id === candidateWithoutArticle.id ? candidateWithoutArticle : poi,
    );
    render(
      <CompletedFieldGuide
        answerIds={answerIds}
        candidates={candidates}
        rounds={caseData.rounds}
      />,
    );
    await user.click(screen.getByText(/field guide/i));
    await user.click(
      screen.getByRole('button', {
        name: `Open ${candidateWithoutArticle.name} dossier`,
      }),
    );

    const dialog = screen.getByRole('dialog', {
      name: candidateWithoutArticle.name,
    });
    expect(
      within(dialog).queryByRole('link', { name: /wikipedia/i }),
    ).toBeNull();
  });
});
