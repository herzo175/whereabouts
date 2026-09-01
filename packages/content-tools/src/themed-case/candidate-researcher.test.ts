import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  hydrateBoardTargets,
  InsufficientCandidatePoolError,
  researchCandidates,
  type TargetHydrationError,
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
    title: candidate.wikipediaTitle ?? candidate.name,
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
          expect(prompt).toContain('35 to 40');
          expect(prompt).toContain('unique coordinates');
          expect(prompt).not.toContain('Search evidence:');
          const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
          expect(jsonSchema).toContain('"items":{"type":"object"');
          expect(jsonSchema).toContain(
            '"extract":{"type":"string","minLength":100}',
          );
          expect(jsonSchema).toContain(
            '"wikipediaTitle":{"anyOf":[{"type":"string","minLength":2},{"type":"null"}]}',
          );
          expect(jsonSchema).toContain(
            '"required":["id","name","city","country","wikipediaTitle","themeClaim","latitude","longitude","source"]',
          );
          expect(jsonSchema).not.toContain('"format":"uri"');
          expect(jsonSchema).not.toContain('"format":"date-time"');
          return { theme: fixtureTheme, candidates };
        },
      },
    });
    expect(pool.candidates).toHaveLength(40);
  });

  it('normalizes null Wikipedia metadata out of model candidates', async () => {
    const candidates = Array.from({ length: 40 }, (_, index) => ({
      ...proposal(index),
      wikipediaTitle: null,
    }));
    const pool = await researchCandidates({
      theme: fixtureTheme,
      model: {
        generate: async () => ({ theme: fixtureTheme, candidates }),
      },
    });

    expect(pool.candidates).toHaveLength(40);
    expect(
      pool.candidates.every((candidate) => !candidate.wikipediaTitle),
    ).toBe(true);
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

  it('rejects a model pool with fewer than 25 unique coordinates', async () => {
    const candidates = Array.from({ length: 40 }, (_, index) =>
      proposal(index % 24),
    );
    await expect(
      researchCandidates({
        theme: fixtureTheme,
        model: { generate: async () => ({ theme: fixtureTheme, candidates }) },
      }),
    ).rejects.toBeInstanceOf(InsufficientCandidatePoolError);
  });

  it('keeps the board and replaces failed targets with verified on-board candidates', async () => {
    const board = {
      ...fixtureBoard,
      candidates: fixtureBoard.candidates.map(
        ({ image: _image, ...candidate }) => candidate,
      ),
    };
    const hydratedIds: string[] = [];
    const failedIds = new Set(fixtureBoard.targetPoiIds.slice(0, 2));
    const externallyExcluded = new Set([
      fixtureBoard.candidates[5]?.id ?? 'missing-candidate',
    ]);
    const result = await hydrateBoardTargets({
      board,
      excludedTargetIds: externallyExcluded,
      research: {
        search: async () => [],
        hydrate: async (candidate) => {
          hydratedIds.push(candidate.id);
          if (failedIds.has(candidate.id)) return null;
          return hydrated(candidate, Number(candidate.id.slice(-2)) - 1);
        },
      },
    });
    expect(hydratedIds).toHaveLength(10);
    expect(result.candidates).toHaveLength(20);
    expect(result.targetPoiIds).toHaveLength(5);
    expect(result.targetPoiIds).not.toContain(fixtureBoard.targetPoiIds[0]);
    expect(result.targetPoiIds).not.toContain(fixtureBoard.targetPoiIds[1]);
    expect(result.targetPoiIds).not.toContain(fixtureBoard.candidates[5]?.id);
    expect(
      result.targetPoiIds.every((id) =>
        fixtureBoard.candidates.some((candidate) => candidate.id === id),
      ),
    ).toBe(true);
    expect(
      result.candidates.filter((candidate) => candidate.image),
    ).toHaveLength(5);
    expect(
      result.candidates.filter((candidate) => !candidate.image),
    ).toHaveLength(15);
  });

  it('replaces a target when hydration resolves two candidates to the same page', async () => {
    const board = {
      ...fixtureBoard,
      candidates: fixtureBoard.candidates.map(
        ({ image: _image, ...candidate }) => candidate,
      ),
    };
    const duplicateIds = new Set(fixtureBoard.targetPoiIds.slice(0, 2));
    const result = await hydrateBoardTargets({
      board,
      research: {
        search: async () => [],
        hydrate: async (candidate) => {
          const value = hydrated(candidate, Number(candidate.id.slice(-2)) - 1);
          return duplicateIds.has(candidate.id)
            ? {
                ...value,
                wikipediaTitle: 'Shared canonical article',
                source: { ...value.source, title: 'Shared canonical article' },
              }
            : value;
        },
      },
    });

    expect(result.targetPoiIds).toHaveLength(5);
    const targetTitles = result.targetPoiIds.map(
      (id) =>
        result.candidates.find((candidate) => candidate.id === id)
          ?.wikipediaTitle,
    );
    expect(new Set(targetTitles).size).toBe(5);
  });

  it('reports all failed attempts when the board cannot yield five targets', async () => {
    await expect(
      hydrateBoardTargets({
        board: fixtureBoard,
        research: {
          search: async () => [],
          hydrate: async () => null,
        },
      }),
    ).rejects.toMatchObject({
      failedPoiIds: expect.arrayContaining(
        fixtureBoard.candidates.map((candidate) => candidate.id),
      ),
    } satisfies Partial<TargetHydrationError>);
  });
});
