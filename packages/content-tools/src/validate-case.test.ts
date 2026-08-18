import { describe, expect, it } from 'vitest';
import {
  validateCaseForPublication,
  validateCollection,
} from './validate-case.js';

function makeCase(overrides: Record<string, unknown> = {}) {
  const pois = Array.from({ length: 25 }, (_, index) => ({
    id: `poi-${String(index).padStart(2, '0')}`,
    name:
      index === 0 ? 'Target Place' : `Place ${String(index).padStart(2, '0')}`,
    city: `City ${index}`,
    country: 'Exampleland',
    latitude: index,
    longitude: index,
    wikipediaTitle: `Place ${index}`,
    image: {
      url: `https://example.com/poi-${index}.jpg`,
      alt: `Fixture image for Place ${index}`,
      attribution: 'Fixture photographer · CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
    },
  }));
  return {
    schemaVersion: 4,
    publicationDate: '2026-08-14',
    revision: 1,
    caseNumber: 1,
    theme: {
      title: 'Fixture theme',
      introduction: 'A sufficiently detailed fixture theme introduction.',
      inclusionCriteria: 'A sufficiently detailed fixture inclusion criterion.',
    },
    pois: pois.map((poi) => ({
      ...poi,
      themeConnection: {
        text: 'This place has a documented connection to the fixture theme.',
        sourceIds: ['source-01'],
      },
    })),
    sources: ['source-01', 'source-02'].map((id) => ({
      id,
      title: `Fixture source ${id}`,
      url: `https://example.com/${id}`,
      retrievedAt: '2026-08-14T00:00:00Z',
      provenance: 'verified',
    })),
    rounds: pois.slice(0, 5).map((target, roundIndex) => ({
      id: `round-${roundIndex + 1}`,
      targetPoiId: target.id,
      image: target.image,
      clue: {
        text: `A concrete fixture clue for round ${roundIndex + 1} avoids naming the answer.`,
        sourceIds: ['source-01'],
      },
      results: pois.map((poi, index) => ({
        poiId: poi.id,
        points: poi.id === target.id ? 100 : Math.max(0, 96 - index * 4),
        text:
          poi.id === target.id
            ? 'This candidate is correct.'
            : 'This candidate has a meaningful fixture relationship to the target.',
        sourceIds: ['source-01', 'source-02'],
      })),
    })),
    ...overrides,
  };
}

function messages(value: unknown): string[] {
  return validateCaseForPublication(value).map((issue) => issue.message);
}

describe('validateCaseForPublication', () => {
  it('accepts a schema-valid v4 case', () => {
    expect(validateCaseForPublication(makeCase())).toEqual([]);
  });

  it('rejects malformed values as malformed', () => {
    expect(validateCaseForPublication({ schemaVersion: 4 })[0]?.path).toBe(
      'schema',
    );
  });

  it('reports malformed cases without throwing', () => {
    expect(() => validateCaseForPublication({})).not.toThrow();
    expect(validateCaseForPublication({})[0]?.path).toBe('schema');
  });

  it.each([
    ['target POI name', 'The TARGET—PLACE is visible from here.'],
    ['target city', 'City 0 has a long history.'],
    ['target country', 'Exampleland is the destination.'],
  ])('reports %s in a round clue after normalization', (_label, text) => {
    const value = makeCase();
    value.rounds[0].clue.text = text;
    expect(messages(value)).toContain(
      'Pre-reveal text leaks target POI, destination, city, or country',
    );
  });

  it('allows clear post-reveal result reports', () => {
    const value = makeCase();
    value.rounds[1].results[0].text = 'City 1 reveals the target location.';
    expect(validateCaseForPublication(value)).toEqual([]);
  });

  it('does not match a short country code inside another word', () => {
    const value = makeCase();
    value.pois[0].country = 'US';
    value.rounds[0].clue.text =
      'This industrial landmark has a sufficiently specific historical clue.';
    expect(validateCaseForPublication(value)).toEqual([]);

    value.rounds[0].clue.text =
      'This landmark is in the US and therefore leaks its country.';
    expect(messages(value)).toContain(
      'Pre-reveal text leaks target POI, destination, city, or country',
    );
  });

  it('rejects a round without a useful spread of authored points', () => {
    const value = makeCase();
    value.rounds[0].results = value.rounds[0].results.map((result) =>
      result.points === 100 ? result : { ...result, points: 20 },
    );

    expect(validateCaseForPublication(value)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'rounds[0].results',
          message: expect.stringMatching(/hot.*warm.*cold.*variation/i),
        }),
      ]),
    );
  });

  it('reports POIs with duplicate coordinates rounded to four decimals', () => {
    const value = makeCase();
    value.pois[1].latitude = 0.00004;
    value.pois[1].longitude = 0.00004;
    expect(messages(value)).toContain(
      'POI coordinates duplicate another POI at four decimal places',
    );
  });
});

describe('validateCollection', () => {
  it('ignores unpublished cases after the publication ceiling', () => {
    const published = makeCase({ publicationDate: '2026-08-14' });
    const future = makeCase({ publicationDate: '2026-08-15', caseNumber: 2 });
    expect(validateCollection([published, future], '2026-08-14')).toEqual([
      expect.objectContaining({
        message: 'Case publication date is after the publication ceiling',
      }),
    ]);
  });

  it('reports a target repeated within the prior 30 published cases', () => {
    const first = makeCase({ publicationDate: '2026-07-15' });
    const repeat = makeCase({ publicationDate: '2026-08-14', caseNumber: 2 });
    expect(
      validateCollection([first, repeat], '2026-08-14').map(
        (issue) => issue.message,
      ),
    ).toContain('Target POI was used within the previous 30 published cases');
  });
});
