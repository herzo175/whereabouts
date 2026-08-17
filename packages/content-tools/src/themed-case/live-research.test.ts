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
};
describe('Wikimedia research', () => {
  it('parses search results and hydrates a candidate from Wikipedia and Wikidata', async () => {
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
                pageprops: { wikibase_item: 'Q123' },
              },
            ],
          },
        });
      if (url.includes('wbgetentities'))
        return response({
          entities: {
            Q123: {
              labels: { en: { value: 'Old Town' } },
              claims: {
                P625: [
                  {
                    mainsnak: {
                      datavalue: {
                        value: { latitude: 50.087, longitude: 14.421 },
                      },
                    },
                  },
                ],
                P17: [{ mainsnak: { datavalue: { value: { id: 'Q213' } } } }],
                P131: [{ mainsnak: { datavalue: { value: { id: 'Q1085' } } } }],
              },
            },
            Q213: { labels: { en: { value: 'Czech Republic' } } },
            Q1085: { labels: { en: { value: 'Prague' } } },
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
    expect(await research.hydrate(candidate)).toMatchObject({
      latitude: 50.087,
      longitude: 14.421,
      city: 'Prague',
      country: 'Czech Republic',
      source: { retrievedAt: '2026-01-01T00:00:00.000Z' },
      image: { attribution: 'A. Author · CC BY-SA' },
    });
    expect(urls.some((url) => url.includes('wbgetentities'))).toBe(true);
  });
  it('returns null when coordinate, extract, or attributed image is missing', async () => {
    const fetch: ResearchFetch = async (input) => {
      const url = String(input);
      if (url.includes('extracts%7Cinfo'))
        return response({
          query: {
            pages: [
              {
                title: 'Place',
                extract: 'A'.repeat(120),
                fullurl: 'https://en.wikipedia.org/wiki/Place',
                pageprops: { wikibase_item: 'Q1' },
              },
            ],
          },
        });
      if (url.includes('wbgetentities'))
        return response({
          entities: {
            Q1: {
              claims: {
                P17: [{ mainsnak: { datavalue: { value: { id: 'Q2' } } } }],
              },
            },
            Q2: { labels: { en: { value: 'Country' } } },
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

  it('surfaces non-OK MediaWiki and Wikidata responses', async () => {
    const mediaWikiFailure = createWikimediaResearch({
      fetch: async () => new Response('down', { status: 503 }),
      userAgent: 'test-agent',
    });
    await expect(mediaWikiFailure.search('square', 1)).rejects.toThrow(
      'MediaWiki search request failed with status 503',
    );
    const wikidataFailure = createWikimediaResearch({
      fetch: async (input) =>
        String(input).includes('w/api.php') &&
        String(input).includes('extracts%7Cinfo')
          ? response({
              query: {
                pages: [
                  {
                    title: 'Place',
                    extract: 'A'.repeat(120),
                    fullurl: 'https://en.wikipedia.org/wiki/Place',
                    pageprops: { wikibase_item: 'Q1' },
                  },
                ],
              },
            })
          : new Response('down', { status: 502 }),
      userAgent: 'test-agent',
    });
    await expect(wikidataFailure.hydrate(candidate)).rejects.toThrow(
      'Wikidata entity request failed with status 502',
    );
    const labelFailure = createWikimediaResearch({
      fetch: async (input) => {
        const url = String(input);
        if (url.includes('extracts%7Cinfo'))
          return response({
            query: {
              pages: [
                {
                  title: 'Place',
                  extract: 'A'.repeat(120),
                  fullurl: 'https://en.wikipedia.org/wiki/Place',
                  pageprops: { wikibase_item: 'Q1' },
                },
              ],
            },
          });
        if (url.includes('props=claims%7Clabels'))
          return response({
            entities: {
              Q1: {
                claims: {
                  P625: [
                    {
                      mainsnak: {
                        datavalue: {
                          value: { latitude: 1, longitude: 2 },
                        },
                      },
                    },
                  ],
                  P17: [{ mainsnak: { datavalue: { value: { id: 'Q2' } } } }],
                  P131: [{ mainsnak: { datavalue: { value: { id: 'Q3' } } } }],
                },
              },
            },
          });
        return new Response('down', { status: 502 });
      },
      userAgent: 'test-agent',
    });
    await expect(labelFailure.hydrate(candidate)).rejects.toThrow(
      'Wikidata labels request failed with status 502',
    );
  });

  it('returns null for a short source extract before Wikidata or image requests', async () => {
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
                pageprops: { wikibase_item: 'Q1' },
              },
            ],
          },
        });
      },
      userAgent: 'test-agent',
    });
    await expect(research.hydrate(candidate)).resolves.toBeNull();
    expect(calls).toHaveLength(1);
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
