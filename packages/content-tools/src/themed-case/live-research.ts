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
  sleep?: (milliseconds: number) => Promise<void>;
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
  sleep: (milliseconds: number) => Promise<void>,
): Promise<JsonRecord> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(url, {
      headers: { 'Api-User-Agent': userAgent, 'User-Agent': userAgent },
    });
    if (response.status !== 429 || attempt === 2) break;
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter >= 0
        ? retryAfter * 1_000
        : 1_000 * 2 ** attempt,
    );
  }
  if (!response) throw new Error(`${stage} request did not run`);
  if (!response.ok)
    throw new Error(`${stage} request failed with status ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${stage} response was not valid JSON`, { cause: error });
  }
}
export function createWikimediaResearch(deps: Dependencies = {}): LiveResearch {
  const rawFetch = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const fetch: ResearchFetch = (input, init) =>
    rawFetch(input, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
    });
  const now = deps.now ?? (() => new Date());
  const sleep =
    deps.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const userAgent =
    deps.userAgent ??
    process.env.WIKIMEDIA_USER_AGENT ??
    'Whereabouts/0.1 (local development)';
  const search = async (query: string, limit: number) => {
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
      sleep,
    )) as {
      query?: { search?: Array<{ title?: unknown; snippet?: unknown }> };
    };
    return (data.query?.search ?? []).flatMap((item) => {
      const title = typeof item.title === 'string' ? item.title : '';
      const snippet = typeof item.snippet === 'string' ? item.snippet : '';
      return title ? [{ title, snippet }] : [];
    });
  };
  const hydrateTitle = async (
    candidate: ResearchedCandidate,
    title: string,
  ): Promise<HydratedCandidate | null> => {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'extracts|info',
      explaintext: '1',
      inprop: 'url',
      redirects: '1',
      titles: title,
      format: 'json',
      formatversion: '2',
    });
    const data = (await json(
      fetch,
      `${API}?${params}`,
      userAgent,
      'MediaWiki hydration',
      sleep,
    )) as {
      query?: {
        pages?: Array<{
          title?: string;
          extract?: string;
          fullurl?: string;
        }>;
      };
    };
    const page = data.query?.pages?.[0];
    if (
      !page?.title ||
      !page.extract ||
      page.extract.length < 100 ||
      !page.fullurl
    )
      return null;
    const compact = (value: string) =>
      value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]/g, '');
    const resolvedTitle = compact(page.title);
    const identities = [candidate.name, candidate.wikipediaTitle]
      .filter((value): value is string => typeof value === 'string')
      .map(compact);
    if (
      !identities.some(
        (identity) =>
          identity.length >= 5 &&
          (resolvedTitle.includes(identity) ||
            identity.includes(resolvedTitle)),
      )
    )
      return null;
    const image = await fetchWikipediaImage(page.title, {
      fetch,
      now,
      userAgent,
    });
    if (!image) return null;
    return {
      ...candidate,
      wikipediaTitle: page.title,
      source: {
        title: page.title,
        url: page.fullurl,
        retrievedAt: now().toISOString(),
        provenance: 'verified',
        extract: page.extract,
      },
      image,
    };
  };
  return {
    search,
    async hydrate(candidate) {
      const attempted = new Set<string>();
      const canonical = (title: string) =>
        title
          .trim()
          .replaceAll('_', ' ')
          .replace(/\s+/g, ' ')
          .toLocaleLowerCase();
      const tryTitle = async (title: string) => {
        const key = canonical(title);
        if (!title || attempted.has(key)) return null;
        attempted.add(key);
        return hydrateTitle(candidate, title);
      };
      const direct = candidate.wikipediaTitle
        ? await tryTitle(candidate.wikipediaTitle)
        : null;
      if (direct) return direct;
      const query = `${candidate.name} ${candidate.city} ${candidate.country}`;
      const results = await search(query, 3);
      for (const result of results.slice(0, 3)) {
        const hydrated = await tryTitle(result.title);
        if (hydrated) return hydrated;
      }
      return null;
    },
  };
}
