import type { Poi, ThemedDailyCase } from '../src/schema.js';

const timestamp = '2026-08-14T00:00:00Z';

export function makeFiveRoundCase(
  overrides: Partial<ThemedDailyCase> = {},
): ThemedDailyCase {
  const pois: Poi[] = Array.from({ length: 25 }, (_, index) => ({
    id: `poi-${String(index).padStart(2, '0')}`,
    name:
      index === 0 ? 'Target Place' : `Place ${String(index).padStart(2, '0')}`,
    city: `City ${index}`,
    country: 'Exampleland',
    latitude: index,
    longitude: index,
    wikipediaTitle: `Place ${index}`,
    image: {
      url: `https://example.com/poi-${String(index).padStart(2, '0')}.jpg`,
      alt: `Place ${index} fixture photograph`,
      attribution: 'Fixture photographer · CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
    },
  }));
  const rounds = pois.slice(0, 5).map((target, roundIndex) => ({
    id: `round-${roundIndex + 1}`,
    targetPoiId: target.id,
    image: {
      url: `https://example.com/${target.id}.jpg`,
      alt: `Round ${roundIndex + 1} evidence photograph`,
      attribution: 'Fixture photographer · CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
    },
    clue: {
      text: `Round ${roundIndex + 1} offers a concrete historical hint without naming its destination.`,
      sourceIds: ['source-01'],
    },
    results: pois.map((poi, index) => ({
      poiId: poi.id,
      tier:
        poi.id === target.id
          ? ('correct' as const)
          : index < 4
            ? ('hot' as const)
            : index < 12
              ? ('warm' as const)
              : ('cold' as const),
      text:
        poi.id === target.id
          ? 'Correct location.'
          : `${poi.name} has a sourced historical relationship to the target for this fixture round.`,
      sourceIds: ['source-01', 'source-02'],
    })),
  }));
  return {
    schemaVersion: 3,
    publicationDate: '2026-08-14',
    revision: 1,
    caseNumber: 1,
    rounds,
    sources: ['source-01', 'source-02'].map((id) => ({
      id,
      title: `Fixture source ${id}`,
      url: `https://example.com/${id}`,
      retrievedAt: timestamp,
      provenance: 'verified',
    })),
    theme: {
      title: 'Railway Hotels',
      introduction:
        'This case follows historic hotels built to serve travelers arriving by rail.',
      inclusionCriteria:
        'Include places whose history is directly connected to railway travel and lodging.',
    },
    pois: pois.map((poi) => ({
      ...poi,
      themeConnection: {
        text: `${poi.name} has a documented connection to railway hotels and their traveling guests.`,
        sourceIds: ['source-01'],
      },
    })),
    ...overrides,
  };
}
