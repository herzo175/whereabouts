import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  hydrateBoardTargets,
  InsufficientCandidatePoolError,
  researchCandidates,
} from './candidate-researcher.js';
import type { HydratedCandidate, ResearchedCandidate } from './contracts.js';
import { fixtureBoard, fixtureTheme } from './fixtures.js';

const proposal = (index: number): ResearchedCandidate => ({
  id: `place-${index}`,
  name: `Place ${index}`,
  city: `City ${index}`,
  country: `Country ${index}`,
  wikipediaTitle: `Place ${index}`,
  themeClaim:
    'This place is a documented example that fits the narrow theme and its history.',
  latitude: Number((index / 10).toFixed(4)),
  longitude: Number((index / 10 + 20).toFixed(4)),
  source: {
    title: `Place ${index}`,
    url: `https://example.test/${index}`,
    retrievedAt: '2026-01-01T00:00:00.000Z',
    provenance: 'model',
    extract: 'A'.repeat(120),
  },
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
    provenance: 'verified',
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
  it('uses complete model knowledge without live research', async () => {
    const candidates = Array.from({ length: 40 }, (_, index) =>
      proposal(index),
    );
    const pool = await researchCandidates({
      theme: fixtureTheme,
      model: {
        generate: async ({ prompt, schema }) => {
          expect(prompt).toContain('general knowledge first');
          expect(prompt).not.toContain('Search evidence:');
          expect(JSON.stringify(z.toJSONSchema(schema))).toContain(
            '"items":{"type":"object"',
          );
          return { theme: fixtureTheme, candidates };
        },
      },
    });
    expect(pool.candidates).toHaveLength(40);
  });

  it('forces model provenance even when the model claims verification', async () => {
    const candidates = Array.from({ length: 40 }, (_, index) =>
      proposal(index),
    );
    const pool = await researchCandidates({
      theme: fixtureTheme,
      model: {
        generate: async () => ({
          theme: fixtureTheme,
          candidates: candidates.map((candidate) => ({
            ...candidate,
            source: { ...candidate.source, provenance: 'verified' },
          })),
        }),
      },
    });
    expect(pool.candidates).toHaveLength(40);
    expect(
      pool.candidates.every(
        (candidate) => candidate.source.provenance === 'model',
      ),
    ).toBe(true);
  });

  it('rejects a model pool with fewer than 35 unique coordinates', async () => {
    const candidates = Array.from({ length: 40 }, (_, index) =>
      proposal(index % 34),
    );
    await expect(
      researchCandidates({
        theme: fixtureTheme,
        model: { generate: async () => ({ theme: fixtureTheme, candidates }) },
      }),
    ).rejects.toBeInstanceOf(InsufficientCandidatePoolError);
  });

  it('hydrates only the five targets and permits missing non-target images', async () => {
    const board = {
      ...fixtureBoard,
      candidates: fixtureBoard.candidates.map(
        ({ image: _image, ...candidate }) => candidate,
      ),
    };
    const hydratedIds: string[] = [];
    const result = await hydrateBoardTargets({
      board,
      research: {
        search: async () => [],
        hydrate: async (candidate) => {
          hydratedIds.push(candidate.id);
          return hydrated(candidate, Number(candidate.id.slice(-2)) - 1);
        },
      },
    });
    expect(hydratedIds).toHaveLength(5);
    expect(new Set(hydratedIds)).toEqual(new Set(fixtureBoard.targetPoiIds));
    expect(
      result.candidates.filter((candidate) => candidate.image),
    ).toHaveLength(5);
    expect(
      result.candidates.filter((candidate) => !candidate.image),
    ).toHaveLength(20);
  });
});
