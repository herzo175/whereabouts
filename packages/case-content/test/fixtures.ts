import type { DailyCase, Poi } from '../src/schema.js';

const timestamp = '2026-08-14T00:00:00Z';

export function makeCase(overrides: Partial<DailyCase> = {}): DailyCase {
  const pois: Poi[] = Array.from({ length: 25 }, (_, index) => ({
    id: `poi-${String(index).padStart(2, '0')}`,
    name:
      index === 0 ? 'Target Place' : `Place ${String(index).padStart(2, '0')}`,
    city: `City ${index}`,
    country: 'Exampleland',
    latitude: index,
    longitude: index,
    wikipediaTitle: `Place ${index}`,
  }));
  const sourceIds = ['source-01', 'source-02'];
  const value: DailyCase = {
    schemaVersion: 1,
    publicationDate: '2026-08-14',
    revision: 1,
    caseNumber: 1,
    target: { poiId: 'poi-00', destinationName: 'Target Place' },
    pois,
    clues: Array.from({ length: 6 }, (_, index) => ({
      id: `clue-${index + 1}`,
      text: `This is fixture clue number ${index + 1}, with enough useful detail.`,
      sourceIds: ['source-01'],
    })),
    contextualResponses: pois
      .slice(1)
      .map((poi, index) => ({
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
    sources: sourceIds.map((id) => ({
      id,
      title: `Fixture source ${id}`,
      url: `https://example.com/${id}`,
      retrievedAt: timestamp,
    })),
  };
  return { ...value, ...overrides };
}
