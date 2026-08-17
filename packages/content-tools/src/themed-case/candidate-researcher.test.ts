import { describe, expect, it } from 'vitest';
import {
  InsufficientCandidatePoolError,
  researchCandidates,
} from './candidate-researcher.js';
import type { HydratedCandidate, ResearchedCandidate } from './contracts.js';
import { fixtureTheme } from './fixtures.js';

const proposal = (index: number): ResearchedCandidate => ({
  id: `place-${index}`,
  name: `Place ${index}`,
  city: `City ${index}`,
  country: `Country ${index}`,
  wikipediaTitle: `Place ${index}`,
  themeClaim:
    'This place is a documented example that fits the narrow theme and its history.',
});
const hydrated = (
  candidate: ResearchedCandidate,
  index: number,
): HydratedCandidate => ({
  ...candidate,
  latitude: Number((index / 10).toFixed(4)),
  longitude: Number((index / 10 + 20).toFixed(4)),
  source: {
    title: candidate.wikipediaTitle,
    url: `https://example.test/${index}`,
    retrievedAt: '2026-01-01T00:00:00.000Z',
    extract: 'A'.repeat(120),
  },
  image: {
    url: `https://example.test/${index}.jpg`,
    alt: 'A documented place image',
    attribution: 'Contributor',
    licenseUrl: 'https://example.test/license',
  },
});

describe('researchCandidates', () => {
  it('runs queries, deduplicates search evidence, hydrates proposals, and returns a verified pool', async () => {
    const searches: string[] = [];
    const hydratedTitles: string[] = [];
    const candidates = Array.from({ length: 40 }, (_, index) =>
      proposal(index),
    );
    const pool = await researchCandidates({
      theme: fixtureTheme,
      model: {
        generate: async ({ prompt }) => {
          expect(prompt.match(/Place 0/g)?.length).toBe(1);
          return { theme: fixtureTheme, candidates };
        },
      },
      research: {
        search: async (query) => {
          searches.push(query);
          return [
            { title: 'Place 0', snippet: 'first' },
            { title: 'Place_0', snippet: 'duplicate' },
          ];
        },
        hydrate: async (candidate) => {
          hydratedTitles.push(candidate.wikipediaTitle);
          return hydrated(candidate, Number(candidate.id.split('-')[1]));
        },
      },
    });
    expect(searches).toEqual(fixtureTheme.searchQueries);
    expect(hydratedTitles).toHaveLength(40);
    expect(pool.candidates).toHaveLength(40);
  });

  it('drops null hydrations and duplicate four-decimal coordinates', async () => {
    const candidates = Array.from({ length: 40 }, (_, index) =>
      proposal(index),
    );
    await expect(
      researchCandidates({
        theme: fixtureTheme,
        model: { generate: async () => ({ theme: fixtureTheme, candidates }) },
        research: {
          search: async () => [],
          hydrate: async (candidate) =>
            candidate.id === 'place-0'
              ? null
              : hydrated(candidate, Number(candidate.id.split('-')[1]) % 34),
        },
      }),
    ).rejects.toBeInstanceOf(InsufficientCandidatePoolError);
  });
});
