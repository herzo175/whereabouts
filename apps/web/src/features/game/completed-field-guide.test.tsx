import { render, screen } from '@testing-library/react';
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

    const disclosure = screen.getByText(/field guide/i);
    expect(disclosure.parentElement).not.toHaveAttribute('open');
    expect(screen.getByText(/20 candidate locations/i)).toBeVisible();
    expect(screen.queryByRole('list')).toBeNull();

    await user.click(disclosure);
    const names = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('span')?.textContent);
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

  it('shows optional Wikipedia links and answer photo attribution without requiring a POI image', async () => {
    const user = userEvent.setup();
    const caseData = makeFiveRoundCase();
    const answerIds = caseData.rounds.map((round) => round.targetPoiId);
    const firstAnswer = caseData.pois.find((poi) => poi.id === answerIds[0]);
    if (!firstAnswer) throw new Error('missing fixture answer');
    const candidates = caseData.pois.map((poi, index) =>
      index === 0
        ? { ...poi, wikipediaTitle: undefined, image: undefined }
        : poi,
    );
    render(
      <CompletedFieldGuide
        answerIds={answerIds}
        candidates={candidates}
        rounds={caseData.rounds}
      />,
    );
    await user.click(screen.getByText(/field guide/i));

    expect(
      screen.queryByRole('link', {
        name: `Wikipedia article for ${firstAnswer.name}`,
      }),
    ).toBeNull();
    const photoLicense = screen.getByRole('link', {
      name: `Photo license for ${firstAnswer.name}`,
    });
    expect(photoLicense).toHaveAttribute(
      'href',
      caseData.rounds[0].image.licenseUrl,
    );
    expect(photoLicense).toHaveClass('inline-flex', 'min-h-11', 'items-center');
    expect(
      screen.getAllByText(caseData.rounds[0].image.attribution),
    ).toHaveLength(5);
  });
});
