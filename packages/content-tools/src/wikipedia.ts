export const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';
export const LOCAL_DEVELOPMENT_USER_AGENT =
  'Whereabouts/0.1 (local development)';

export function requireProductionUserAgent(
  userAgent = process.env.WIKIMEDIA_USER_AGENT,
): string {
  if (!userAgent || userAgent === LOCAL_DEVELOPMENT_USER_AGENT)
    throw new Error(
      'Production generation requires WIKIMEDIA_USER_AGENT with contact information',
    );
  return userAgent;
}

export type WikipediaExtract = {
  title: string;
  extract: string;
  url: string;
  retrievedAt: string;
};

type Dependencies = {
  fetch?: typeof globalThis.fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
  userAgent?: string;
};

function retryAfterMilliseconds(value: string | null): number {
  if (!value) return 1_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 1_000 : Math.max(0, date - Date.now());
}

/** Retrieves server-side source text only; callers must retain the returned URL and timestamp. */
export async function fetchWikipediaExtracts(
  titles: string[],
  dependencies: Dependencies = {},
): Promise<WikipediaExtract[]> {
  const request = dependencies.fetch ?? globalThis.fetch;
  const sleep =
    dependencies.sleep ??
    ((milliseconds) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const now = dependencies.now ?? (() => new Date());
  const userAgent =
    dependencies.userAgent ??
    process.env.WIKIMEDIA_USER_AGENT ??
    LOCAL_DEVELOPMENT_USER_AGENT;
  const results: WikipediaExtract[] = [];
  for (const title of titles) {
    const parameters = new URLSearchParams({
      action: 'query',
      prop: 'extracts|info',
      explaintext: '1',
      inprop: 'url',
      redirects: '1',
      titles: title,
      format: 'json',
      formatversion: '2',
    });
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await request(`${WIKIPEDIA_API_URL}?${parameters}`, {
        headers: { 'Api-User-Agent': userAgent },
      });
      if (response.status !== 429 && response.status !== 503) break;
      if (attempt === 2) break;
      await sleep(retryAfterMilliseconds(response.headers.get('Retry-After')));
    }
    if (!response?.ok)
      throw new Error(
        `Wikipedia request for ${title} failed with status ${response?.status ?? 'unknown'}`,
      );
    const data = (await response.json()) as {
      query?: {
        pages?: Array<{
          title?: string;
          extract?: string;
          fullurl?: string;
          missing?: boolean;
        }>;
      };
    };
    const page = data.query?.pages?.[0];
    if (!page?.title || !page.extract || !page.fullurl || page.missing)
      throw new Error(`Wikipedia did not return an extract for ${title}`);
    results.push({
      title: page.title,
      extract: page.extract,
      url: page.fullurl,
      retrievedAt: now().toISOString(),
    });
  }
  return results;
}
