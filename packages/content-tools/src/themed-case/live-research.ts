import { fetchWikipediaImage } from '../wikipedia.js';
import type { HydratedCandidate, ResearchedCandidate } from './contracts.js';

const API = 'https://en.wikipedia.org/w/api.php';
export type ResearchFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
type Dependencies = {
  fetch?: ResearchFetch;
  now?: () => Date;
  userAgent?: string;
};
export interface LiveResearch {
  search(
    query: string,
    limit: number,
  ): Promise<Array<{ title: string; snippet: string }>>;
  hydrate(candidate: ResearchedCandidate): Promise<HydratedCandidate | null>;
}
type JsonRecord = Record<string, unknown>;
async function json(
  fetch: ResearchFetch,
  url: string,
  userAgent: string,
  stage: string,
): Promise<JsonRecord> {
  const response = await fetch(url, {
    headers: { 'Api-User-Agent': userAgent, 'User-Agent': userAgent },
  });
  if (!response.ok)
    throw new Error(`${stage} request failed with status ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${stage} response was not valid JSON`, { cause: error });
  }
}
export function createWikimediaResearch(deps: Dependencies = {}): LiveResearch {
  const fetch = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const now = deps.now ?? (() => new Date());
  const userAgent =
    deps.userAgent ??
    process.env.WIKIMEDIA_USER_AGENT ??
    'Whereabouts/0.1 (local development)';
  return {
    async search(query, limit) {
      const params = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: String(Math.max(1, limit)),
        format: 'json',
        formatversion: '2',
      });
      const data = (await json(
        fetch,
        `${API}?${params}`,
        userAgent,
        'MediaWiki search',
      )) as {
        query?: { search?: Array<{ title?: unknown; snippet?: unknown }> };
      };
      return (data.query?.search ?? []).flatMap((item) => {
        const title = typeof item.title === 'string' ? item.title : '';
        const snippet = typeof item.snippet === 'string' ? item.snippet : '';
        return title ? [{ title, snippet }] : [];
      });
    },
    async hydrate(candidate) {
      {
        const params = new URLSearchParams({
          action: 'query',
          prop: 'extracts|info|pageprops',
          explaintext: '1',
          inprop: 'url',
          redirects: '1',
          titles: candidate.wikipediaTitle,
          format: 'json',
          formatversion: '2',
        });
        const data = (await json(
          fetch,
          `${API}?${params}`,
          userAgent,
          'MediaWiki hydration',
        )) as {
          query?: {
            pages?: Array<{
              title?: string;
              extract?: string;
              fullurl?: string;
              pageprops?: { wikibase_item?: string };
            }>;
          };
        };
        const page = data.query?.pages?.[0];
        const entityId = page?.pageprops?.wikibase_item;
        if (
          !page?.title ||
          !page.extract ||
          page.extract.length < 100 ||
          !page.fullurl ||
          !entityId
        )
          return null;
        const entitiesParams = new URLSearchParams({
          action: 'wbgetentities',
          ids: entityId,
          props: 'claims|labels',
          languages: 'en',
          languagefallback: '1',
          format: 'json',
          formatversion: '2',
        });
        const entities = (await json(
          fetch,
          `https://www.wikidata.org/w/api.php?${entitiesParams}`,
          userAgent,
          'Wikidata entity',
        )) as {
          entities?: Record<
            string,
            {
              claims?: Record<
                string,
                Array<{
                  mainsnak?: {
                    datavalue?: {
                      value?: {
                        id?: string;
                        latitude?: number;
                        longitude?: number;
                      };
                    };
                  };
                }>
              >;
            }
          >;
        };
        const entity = entities.entities?.[entityId];
        const coordinate =
          entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
        const countryId =
          entity?.claims?.P17?.[0]?.mainsnak?.datavalue?.value?.id;
        const cityId =
          entity?.claims?.P131?.[0]?.mainsnak?.datavalue?.value?.id;
        if (
          !coordinate ||
          typeof coordinate.latitude !== 'number' ||
          typeof coordinate.longitude !== 'number' ||
          !countryId ||
          !cityId
        )
          return null;
        const ids = [countryId, cityId].join('|');
        const labelsData = (await json(
          fetch,
          `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', ids, props: 'labels', languages: 'en', languagefallback: '1', format: 'json', formatversion: '2' })}`,
          userAgent,
          'Wikidata labels',
        )) as {
          entities?: Record<string, { labels?: { en?: { value?: string } } }>;
        };
        const country = labelsData.entities?.[countryId]?.labels?.en?.value;
        const city = labelsData.entities?.[cityId]?.labels?.en?.value;
        if (typeof country !== 'string' || typeof city !== 'string')
          return null;
        const image = await fetchWikipediaImage(page.title, {
          fetch,
          now,
          userAgent,
        });
        if (!image) return null;
        return {
          ...candidate,
          city,
          country,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          source: {
            title: page.title,
            url: page.fullurl,
            retrievedAt: now().toISOString(),
            extract: page.extract,
          },
          image,
        };
      }
    },
  };
}
