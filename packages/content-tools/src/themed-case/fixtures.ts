import type {
  CandidatePool,
  CaseDraft,
  CuratedBoard,
  HydratedCandidate,
  ThemePlan,
} from './contracts.js';

export const fixtureTheme: ThemePlan = {
  title: 'Historic market squares',
  introduction:
    'Explore public squares whose markets and civic life shaped the surrounding city over centuries.',
  inclusionCriteria:
    'Include named urban squares with documented market or civic significance and a clear geographic identity.',
  exclusions: [
    'Exclude modern shopping malls without a historic public square identity.',
  ],
  searchQueries: [
    'historic market square',
    'medieval city market',
    'civic plaza historic',
  ],
};
export const fixtureCandidates: HydratedCandidate[] = Array.from(
  { length: 40 },
  (_, index) => {
    const n = String(index + 1).padStart(2, '0');
    return {
      id: `market-square-${n}`,
      name: `Market Square ${n}`,
      city: `City ${n}`,
      country: `Country ${n}`,
      wikipediaTitle: `Market Square ${n}`,
      themeClaim: `This historic market square supported trade and civic gatherings in its city for generations.`,
      lat: index - 20,
      lon: index * 3 - 60,
      source: {
        title: `Market Square ${n}`,
        url: `https://en.wikipedia.org/wiki/Market_Square_${n}`,
        retrievedAt: '2026-01-01T00:00:00.000Z',
        extract: `Market Square ${n} is a documented historic public place where markets and civic life brought residents together across many generations.`,
      },
      image: {
        url: `https://images.example.test/market-square-${n}.jpg`,
        alt: `View of Market Square ${n}`,
        attribution: 'Wikimedia Commons contributor',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      },
    };
  },
);
export const fixtureCandidatePool: CandidatePool = {
  theme: fixtureTheme,
  candidates: fixtureCandidates,
};
export const fixtureBoard: CuratedBoard = {
  theme: fixtureTheme,
  candidates: fixtureCandidates.slice(0, 25),
  targetPoiIds: fixtureCandidates.slice(0, 5).map((candidate) => candidate.id),
};
export function buildFixtureCaseDraft(
  board: CuratedBoard = fixtureBoard,
): CaseDraft {
  return {
    rounds: board.targetPoiIds.map((targetPoiId, roundIndex) => ({
      targetPoiId,
      clue: {
        text: `Round ${roundIndex + 1} identifies a market square through its history, setting, and civic role.`,
        evidencePoiIds: [targetPoiId],
      },
      results: board.candidates.map((candidate, index) => ({
        poiId: candidate.id,
        similarityScore: 100 - index,
        text: `Evidence about ${candidate.name} and its historic public-market role.`,
        evidencePoiIds: [candidate.id],
      })),
    })),
  };
}
export const fixtureCaseDraft = buildFixtureCaseDraft();
