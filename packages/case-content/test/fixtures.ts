import type {
  FiveRoundDailyCase,
  LegacyDailyCase,
  Poi,
} from '../src/schema.js';

const timestamp = '2026-08-14T00:00:00Z';

export function makeCase(
  overrides: Partial<LegacyDailyCase> = {},
): LegacyDailyCase {
  const pois: Poi[] = Array.from({ length: 25 }, (_, index) => ({
    id: `poi-${String(index).padStart(2, '0')}`,
    name:
      index === 0 ? 'Target Place' : `Place ${String(index).padStart(2, '0')}`,
    city: `City ${index}`,
    country: 'Exampleland',
    latitude: index,
    longitude: index,
    wikipediaTitle: `Place ${index}`,
    blurb: `Place ${index} is a notable site in Exampleland with a documented history used for fixture testing.`,
  }));
  const sourceIds = ['source-01', 'source-02'];
  const value: LegacyDailyCase = {
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
    sources: sourceIds.map((id) => ({
      id,
      title: `Fixture source ${id}`,
      url: `https://example.com/${id}`,
      retrievedAt: timestamp,
    })),
  };
  return { ...value, ...overrides };
}

export function makeFiveRoundCase(
  overrides: Partial<FiveRoundDailyCase> = {},
): FiveRoundDailyCase {
  const legacy = makeCase();
  const rounds = legacy.pois.slice(0, 5).map((target, roundIndex) => ({
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
    results: legacy.pois.map((poi, index) => ({
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
    schemaVersion: 2,
    publicationDate: legacy.publicationDate,
    revision: legacy.revision,
    caseNumber: legacy.caseNumber,
    pois: legacy.pois,
    rounds,
    sources: legacy.sources,
    ...overrides,
  };
}
