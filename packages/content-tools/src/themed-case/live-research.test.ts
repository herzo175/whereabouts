import { describe, expect, it } from 'vitest';
import { validateCaseDraftAgainstBoard } from './contracts.js';
import { fixtureBoard, fixtureCaseDraft } from './fixtures.js';
import {
  createWikimediaResearch,
  type ResearchFetch,
} from './live-research.js';

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}
const candidate = {
  id: 'old-town',
  name: 'Old Town',
  city: 'Prague',
  country: 'Czech Republic',
  wikipediaTitle: 'Old Town (Prague)',
  themeClaim:
    'A historic district with a remarkably preserved medieval urban core.',
  latitude: 50.087,
  longitude: 14.421,
  source: {
    title: 'Old Town (Prague)',
    url: 'https://en.wikipedia.org/wiki/Old_Town_(Prague)',
    retrievedAt: '2026-01-01T00:00:00.000Z',
    provenance: 'model' as const,
    extract: 'A'.repeat(120),
  },
};
describe('Wikimedia research', () => {
  it('retries a rate-limited Wikimedia request with bounded backoff', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const research = createWikimediaResearch({
      fetch: async (_input, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        attempts += 1;
        if (attempts === 1)
          return new Response('rate limited', {
            status: 429,
            headers: { 'retry-after': '0' },
          });
        return response({
          query: { search: [{ title: 'Station Hotel', snippet: 'Historic' }] },
        });
      },
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
      userAgent: 'test-agent',
    });

    await expect(research.search('railway hotel', 1)).resolves.toHaveLength(1);
    expect(attempts).toBe(2);
    expect(delays).toEqual([0]);
  });

  it('parses search results and hydrates a candidate from Wikipedia only', async () => {
    const urls: string[] = [];
    const fetch: ResearchFetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('list=search'))
        return response({
          query: {
            search: [
              { title: 'Old Town (Prague)', snippet: 'A historic district' },
            ],
          },
        });
      if (url.includes('prop=extracts%7Cinfo'))
        return response({
          query: {
            pages: [
              {
                title: 'Old Town (Prague)',
                extract: 'A'.repeat(120),
                fullurl: 'https://en.wikipedia.org/wiki/Old_Town_(Prague)',
              },
            ],
          },
        });
      if (url.includes('pageimages'))
        return response({
          query: {
            pages: [{ title: 'Old Town (Prague)', pageimage: 'Old.jpg' }],
          },
        });
      if (url.includes('imageinfo'))
        return response({
          query: {
            pages: [
              {
                imageinfo: [
                  {
                    thumburl: 'https://img.test/old.jpg',
                    descriptionurl:
                      'https://commons.wikimedia.org/wiki/File:Old.jpg',
                    extmetadata: {
                      Artist: { value: 'A. Author' },
                      LicenseShortName: { value: 'CC BY-SA' },
                      LicenseUrl: {
                        value:
                          'https://creativecommons.org/licenses/by-sa/4.0/',
                      },
                    },
                  },
                ],
              },
            ],
          },
        });
      throw new Error(`unexpected URL ${url}`);
    };
    const research = createWikimediaResearch({
      fetch,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      userAgent: 'test-agent',
    });
    expect(await research.search('historic district', 1)).toEqual([
      { title: 'Old Town (Prague)', snippet: 'A historic district' },
    ]);
    urls.length = 0;
    expect(await research.hydrate(candidate)).toMatchObject({
      latitude: 50.087,
      longitude: 14.421,
      city: 'Prague',
      country: 'Czech Republic',
      source: {
        retrievedAt: '2026-01-01T00:00:00.000Z',
        provenance: 'verified',
      },
      image: { attribution: 'A. Author · CC BY-SA' },
    });
    expect(urls.some((url) => url.includes('wikidata.org'))).toBe(false);
    expect(urls).toHaveLength(3);
  });
  it('returns null when source extract or attributed image is missing', async () => {
    const fetch: ResearchFetch = async (input) => {
      const url = String(input);
      if (url.includes('list=search'))
        return response({ query: { search: [] } });
      if (url.includes('extracts%7Cinfo'))
        return response({
          query: {
            pages: [
              {
                title: 'Place',
                extract: 'A'.repeat(120),
                fullurl: 'https://en.wikipedia.org/wiki/Place',
              },
            ],
          },
        });
      if (url.includes('pageimages'))
        return response({ query: { pages: [{ title: 'Place' }] } });
      throw new Error(`unexpected URL ${url}`);
    };
    await expect(
      createWikimediaResearch({ fetch, userAgent: 'test-agent' }).hydrate(
        candidate,
      ),
    ).resolves.toBeNull();
  });

  it('surfaces non-OK MediaWiki and image responses', async () => {
    const mediaWikiFailure = createWikimediaResearch({
      fetch: async () => new Response('down', { status: 503 }),
      userAgent: 'test-agent',
    });
    await expect(mediaWikiFailure.search('square', 1)).rejects.toThrow(
      'MediaWiki search request failed with status 503',
    );
    const imageFailure = createWikimediaResearch({
      fetch: async (input) =>
        String(input).includes('w/api.php') &&
        String(input).includes('extracts%7Cinfo')
          ? response({
              query: {
                pages: [
                  {
                    title: candidate.wikipediaTitle,
                    extract: 'A'.repeat(120),
                    fullurl: 'https://en.wikipedia.org/wiki/Old_Town_(Prague)',
                  },
                ],
              },
            })
          : new Response('down', { status: 502 }),
      userAgent: 'test-agent',
    });
    await expect(imageFailure.hydrate(candidate)).rejects.toThrow(
      `Wikipedia image request for ${candidate.wikipediaTitle} failed with status 502`,
    );
  });

  it('returns null for a short source extract before image requests', async () => {
    const calls: string[] = [];
    const research = createWikimediaResearch({
      fetch: async (input) => {
        calls.push(String(input));
        return response({
          query: {
            pages: [
              {
                title: 'Place',
                extract: 'Too short',
                fullurl: 'https://en.wikipedia.org/wiki/Place',
              },
            ],
          },
        });
      },
      userAgent: 'test-agent',
    });
    await expect(research.hydrate(candidate)).resolves.toBeNull();
    expect(calls).toHaveLength(2);
  });

  it('falls back to a bounded name-and-city search for a non-canonical title', async () => {
    const calls: string[] = [];
    const fetch: ResearchFetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('list=search'))
        return response({
          query: {
            search: [
              { title: 'Canonical Place', snippet: 'match' },
              { title: 'Canonical Place', snippet: 'duplicate' },
            ],
          },
        });
      if (url.includes('extracts%7Cinfo'))
        return url.includes('Canonical+Place')
          ? response({
              query: {
                pages: [
                  {
                    title: 'Canonical Place',
                    extract: 'B'.repeat(120),
                    fullurl: 'https://en.wikipedia.org/wiki/Canonical_Place',
                  },
                ],
              },
            })
          : response({ query: { pages: [] } });
      if (url.includes('pageimages'))
        return response({
          query: {
            pages: [{ title: 'Canonical Place', pageimage: 'Place.jpg' }],
          },
        });
      if (url.includes('imageinfo'))
        return response({
          query: {
            pages: [
              {
                imageinfo: [
                  {
                    thumburl: 'https://img.test/place.jpg',
                    descriptionurl:
                      'https://commons.wikimedia.org/wiki/File:Place.jpg',
                  },
                ],
              },
            ],
          },
        });
      throw new Error(`unexpected URL ${url}`);
    };
    const result = await createWikimediaResearch({
      fetch,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      userAgent: 'test-agent',
    }).hydrate({ ...candidate, wikipediaTitle: 'Non-canonical place' });
    expect(result?.wikipediaTitle).toBe('Canonical Place');
    expect(result?.city).toBe(candidate.city);
    expect(result?.latitude).toBe(candidate.latitude);
    expect(calls).toHaveLength(5);
  });

  it('tries at most three distinct search titles after the direct title fails', async () => {
    const calls: string[] = [];
    const fetch: ResearchFetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('list=search'))
        return response({
          query: {
            search: Array.from({ length: 10 }, (_, index) => ({
              title: `Fallback ${index}`,
              snippet: 'candidate',
            })),
          },
        });
      if (url.includes('extracts%7Cinfo'))
        return response({ query: { pages: [] } });
      throw new Error(`unexpected URL ${url}`);
    };
    await expect(
      createWikimediaResearch({ fetch, userAgent: 'test-agent' }).hydrate({
        ...candidate,
        wikipediaTitle: 'Missing title',
      }),
    ).resolves.toBeNull();
    expect(calls.filter((url) => url.includes('extracts%7Cinfo'))).toHaveLength(
      4,
    );
    expect(calls.filter((url) => url.includes('list=search'))).toHaveLength(1);
  });

  it('rejects a nearby but different resolved article before trying search results', async () => {
    const calls: string[] = [];
    const fetch: ResearchFetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('list=search'))
        return response({
          query: {
            search: [{ title: 'Mercado do Bolhão', snippet: 'market hall' }],
          },
        });
      if (url.includes('extracts%7Cinfo'))
        return response({
          query: {
            pages: [
              url.includes('Mercado+do+Bolh%C3%A3o')
                ? {
                    title: 'Mercado do Bolhão',
                    extract: 'M'.repeat(120),
                    fullurl: 'https://en.wikipedia.org/wiki/Mercado_do_Bolhao',
                  }
                : {
                    title: 'Bolhão station',
                    extract: 'S'.repeat(120),
                    fullurl: 'https://en.wikipedia.org/wiki/Bolhao_station',
                  },
            ],
          },
        });
      if (url.includes('pageimages'))
        return response({
          query: {
            pages: [{ title: 'Mercado do Bolhão', pageimage: 'Market.jpg' }],
          },
        });
      if (url.includes('imageinfo'))
        return response({
          query: {
            pages: [
              {
                imageinfo: [
                  {
                    thumburl: 'https://img.test/market.jpg',
                    descriptionurl:
                      'https://commons.wikimedia.org/wiki/File:Market.jpg',
                  },
                ],
              },
            ],
          },
        });
      throw new Error(`unexpected URL ${url}`);
    };
    const result = await createWikimediaResearch({
      fetch,
      userAgent: 'test-agent',
    }).hydrate({
      ...candidate,
      name: 'Mercado do Bolhão',
      wikipediaTitle: 'Bolhao market',
    });

    expect(result?.wikipediaTitle).toBe('Mercado do Bolhão');
    expect(calls.filter((url) => url.includes('pageimages'))).toHaveLength(1);
  });
});
describe('contracts', () => {
  it('rejects short theme claims', async () => {
    const { researchedCandidateSchema } = await import('./contracts.js');
    expect(
      researchedCandidateSchema.safeParse({ ...candidate, themeClaim: 'short' })
        .success,
    ).toBe(false);
  });

  it('requires exact board result coverage, board evidence, and target order', () => {
    expect(
      validateCaseDraftAgainstBoard(fixtureCaseDraft, fixtureBoard).success,
    ).toBe(true);
    const duplicate = structuredClone(fixtureCaseDraft);
    duplicate.rounds[0].results[1].poiId = duplicate.rounds[0].results[0].poiId;
    expect(validateCaseDraftAgainstBoard(duplicate, fixtureBoard).success).toBe(
      false,
    );
    const unknown = structuredClone(fixtureCaseDraft);
    unknown.rounds[0].results[0].poiId = 'not-on-board';
    expect(validateCaseDraftAgainstBoard(unknown, fixtureBoard).success).toBe(
      false,
    );
    const evidence = structuredClone(fixtureCaseDraft);
    evidence.rounds[0].results[0].evidencePoiIds = ['not-on-board'];
    expect(validateCaseDraftAgainstBoard(evidence, fixtureBoard).success).toBe(
      false,
    );
    const reordered = structuredClone(fixtureCaseDraft);
    [reordered.rounds[0].targetPoiId, reordered.rounds[1].targetPoiId] = [
      reordered.rounds[1].targetPoiId,
      reordered.rounds[0].targetPoiId,
    ];
    expect(validateCaseDraftAgainstBoard(reordered, fixtureBoard).success).toBe(
      false,
    );
  });
});
