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
  }));
  return {
    schemaVersion: 1,
    publicationDate: '2026-08-14',
    revision: 1,
    caseNumber: 1,
    target: { poiId: 'poi-00', destinationName: 'Target Place' },
    pois,
    clues: Array.from({ length: 6 }, (_, index) => ({
      id: `clue-${index + 1}`,
      text: `This fixture clue number ${index + 1}, with enough useful detail.`,
      sourceIds: ['source-01'],
    })),
    contextualResponses: pois.slice(1).map((poi, index) => ({
      poiId: poi.id,
      tier: index < 8 ? 'cold' : index < 16 ? 'warm' : 'hot',
      text: `Fixture response for ${poi.name} explains a meaningful comparison.`,
      sourceIds: ['source-02'],
    })),
    reveal: {
      title: 'Fixture reveal',
      summary:
        'This fixture reveal gives enough detail to satisfy the minimum summary requirement.',
      clueExplanation:
        'This fixture clue explanation gives enough detail to satisfy the minimum explanation requirement.',
      sourceIds: ['source-01'],
    },
    sources: ['source-01', 'source-02'].map((id) => ({
      id,
      title: `Fixture source ${id}`,
      url: `https://example.com/${id}`,
      retrievedAt: '2026-08-14T00:00:00Z',
    })),
    ...overrides,
  };
}

function messages(value: unknown): string[] {
  return validateCaseForPublication(value).map((issue) => issue.message);
}

describe('validateCaseForPublication', () => {
  it('accepts a schema-valid case with no pre-reveal leaks', () => {
    expect(validateCaseForPublication(makeCase())).toEqual([]);
  });

  it('reports malformed cases without throwing', () => {
    expect(() => validateCaseForPublication({})).not.toThrow();
    expect(validateCaseForPublication({})[0]?.path).toBe('schema');
  });

  it.each([
    ['target POI name', 'The TARGET—PLACE is visible from here.'],
    ['destination', 'A historic route through Target Place was important.'],
    ['target city', 'City 0 has a long history.'],
    ['target country', 'Exampleland is the destination.'],
  ])('reports %s in a clue after normalization', (_label, text) => {
    const value = makeCase();
    value.clues[0].text = text;
    expect(messages(value)).toContain(
      'Pre-reveal text leaks target POI, destination, city, or country',
    );
  });

  it('reports target leakage in a contextual response', () => {
    const value = makeCase();
    value.contextualResponses[0].text =
      'Target Place has a notably different setting than this landmark.';
    expect(messages(value)).toContain(
      'Pre-reveal text leaks target POI, destination, city, or country',
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

  it('reports duplicate dates, case numbers, revisions, and ceiling mismatch', () => {
    const first = makeCase();
    const second = makeCase();
    expect(
      validateCollection([first, second], '2026-08-13').map(
        (issue) => issue.message,
      ),
    ).toEqual(
      expect.arrayContaining([
        'Case publication date is after the publication ceiling',
        'Duplicate publication date',
        'Duplicate case number',
        'Duplicate revision for publication date',
      ]),
    );
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

  it('reports distractors exceeding 40 percent of a rolling 30-case window', () => {
    const cases = Array.from({ length: 30 }, (_, index) =>
      makeCase({
        publicationDate: `2026-08-${String(index + 1).padStart(2, '0')}`,
        caseNumber: index + 1,
      }),
    );
    expect(
      validateCollection(cases, '2026-08-30').map((issue) => issue.message),
    ).toContain(
      'Distractor appears in more than 40% of the rolling 30-case window',
    );
  });
});
