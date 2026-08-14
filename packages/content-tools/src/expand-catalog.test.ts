import { describe, expect, it } from 'vitest';

import { catalogId, mergeCatalogCandidates } from './expand-catalog.js';

const existing = [
  {
    id: 'existing-place',
    name: 'Existing Place',
    city: 'Existing City',
    country: 'Existing Country',
    latitude: 1,
    longitude: 2,
    wikipediaTitle: 'Existing Place',
    region: 'Existing Region',
  },
];

const newCandidate = {
  id: 'new-place',
  name: 'New Place',
  city: 'New City',
  country: 'New Country',
  latitude: 3,
  longitude: 4,
  wikipediaTitle: 'New Place',
  region: 'New Region',
};

describe('mergeCatalogCandidates', () => {
  it('derives stable kebab-case IDs from landmark names', () => {
    expect(catalogId('São Jorge Castle')).toBe('sao-jorge-castle');
  });

  it('appends verified, unique candidates', () => {
    expect(
      mergeCatalogCandidates(existing, [newCandidate], new Set(['New Place'])),
    ).toEqual([...existing, newCandidate]);
  });

  it('rejects IDs or Wikipedia pages already in the catalog', () => {
    expect(() =>
      mergeCatalogCandidates(
        existing,
        [{ ...newCandidate, id: 'existing-place' }],
        new Set(['New Place']),
      ),
    ).toThrow(/duplicate/i);
    expect(() =>
      mergeCatalogCandidates(
        existing,
        [{ ...newCandidate, wikipediaTitle: 'Existing Place' }],
        new Set(['Existing Place']),
      ),
    ).toThrow(/duplicate/i);
  });

  it('rejects candidates without a verified Wikipedia page', () => {
    expect(() =>
      mergeCatalogCandidates(existing, [newCandidate], new Set()),
    ).toThrow(/verified Wikipedia/i);
  });
});
