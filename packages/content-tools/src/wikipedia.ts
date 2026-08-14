import { request as httpsRequest } from 'node:https';

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

function nodeHttpsFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      String(input),
      {
        headers: init.headers as Record<string, string> | undefined,
        method: init.method ?? 'GET',
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode ?? 500,
              headers: response.headers as Record<string, string>,
            }),
          );
        });
      },
    );
    const abort = () => request.destroy(new Error('Wikipedia request aborted'));
    init.signal?.addEventListener('abort', abort, { once: true });
    request.once('error', reject);
    request.once('close', () =>
      init.signal?.removeEventListener('abort', abort),
    );
    request.end();
  });
}

export type WikipediaImage = {
  url: string;
  alt: string;
  attribution: string;
  licenseUrl: string;
};

function retryAfterMilliseconds(value: string | null): number {
  if (!value) return 1_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 1_000 : Math.max(0, date - Date.now());
}

async function requestWithRetry(
  request: typeof globalThis.fetch,
  url: string,
  headers: Record<string, string>,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<Response> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await request(url, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status !== 429 && response.status !== 503) break;
    if (attempt < 2)
      await sleep(retryAfterMilliseconds(response.headers.get('Retry-After')));
  }
  if (!response) throw new Error('request did not return a response');
  return response;
}

function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .trim();
}

export async function fetchWikipediaImage(
  title: string,
  dependencies: Dependencies = {},
): Promise<WikipediaImage | undefined> {
  const request = dependencies.fetch ?? nodeHttpsFetch;
  const userAgent =
    dependencies.userAgent ??
    process.env.WIKIMEDIA_USER_AGENT ??
    LOCAL_DEVELOPMENT_USER_AGENT;
  const headers = {
    'Api-User-Agent': userAgent,
    'User-Agent': userAgent,
  };
  const sleep =
    dependencies.sleep ??
    ((milliseconds) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const pageParameters = new URLSearchParams({
    action: 'query',
    prop: 'pageimages',
    piprop: 'name',
    redirects: '1',
    titles: title,
    format: 'json',
    formatversion: '2',
  });
  const pageResponse = await requestWithRetry(
    request,
    `${WIKIPEDIA_API_URL}?${pageParameters}`,
    headers,
    sleep,
  );
  if (!pageResponse.ok)
    throw new Error(
      `Wikipedia image request for ${title} failed with status ${pageResponse.status}`,
    );
  const pageData = (await pageResponse.json()) as {
    query?: { pages?: Array<{ title?: string; pageimage?: string }> };
  };
  const page = pageData.query?.pages?.[0];
  if (!page?.pageimage) return undefined;

  const imageParameters = new URLSearchParams({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1200',
    titles: `File:${page.pageimage}`,
    format: 'json',
    formatversion: '2',
  });
  const imageResponse = await requestWithRetry(
    request,
    `${WIKIPEDIA_API_URL}?${imageParameters}`,
    headers,
    sleep,
  );
  if (!imageResponse.ok)
    throw new Error(
      `Wikimedia metadata request for ${title} failed with status ${imageResponse.status}`,
    );
  const imageData = (await imageResponse.json()) as {
    query?: {
      pages?: Array<{
        imageinfo?: Array<{
          thumburl?: string;
          url?: string;
          descriptionurl?: string;
          extmetadata?: Record<string, { value?: string }>;
        }>;
      }>;
    };
  };
  const info = imageData.query?.pages?.[0]?.imageinfo?.[0];
  const url = info?.thumburl ?? info?.url;
  if (!url) return undefined;
  const artist = plainText(
    info?.extmetadata?.Artist?.value ?? 'Wikimedia Commons contributor',
  );
  const license = plainText(
    info?.extmetadata?.LicenseShortName?.value ?? 'Wikimedia Commons',
  );
  const licenseUrl =
    info?.extmetadata?.LicenseUrl?.value ?? info?.descriptionurl;
  if (!licenseUrl) return undefined;
  return {
    url,
    alt: page.title ?? title,
    attribution: `${artist} · ${license}`,
    licenseUrl,
  };
}

/** Retrieves server-side source text only; callers must retain the returned URL and timestamp. */
export async function fetchWikipediaExtracts(
  titles: string[],
  dependencies: Dependencies = {},
): Promise<WikipediaExtract[]> {
  const request = dependencies.fetch ?? nodeHttpsFetch;
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
  for (let offset = 0; offset < titles.length; offset += 1) {
    const batch = titles.slice(offset, offset + 1);
    const parameters = new URLSearchParams({
      action: 'query',
      prop: 'extracts|info',
      explaintext: '1',
      inprop: 'url',
      redirects: '1',
      titles: batch.join('|'),
      format: 'json',
      formatversion: '2',
    });
    const response = await requestWithRetry(
      request,
      `${WIKIPEDIA_API_URL}?${parameters}`,
      { 'Api-User-Agent': userAgent, 'User-Agent': userAgent },
      sleep,
    );
    if (!response.ok)
      throw new Error(
        `Wikipedia request for ${batch.join(', ')} failed with status ${response.status}`,
      );
    const data = (await response.json()) as {
      query?: {
        redirects?: Array<{ from?: string; to?: string }>;
        pages?: Array<{
          title?: string;
          extract?: string;
          fullurl?: string;
          missing?: boolean;
        }>;
      };
    };
    const redirects = new Map(
      (data.query?.redirects ?? []).flatMap((redirect) =>
        redirect.from && redirect.to ? [[redirect.from, redirect.to]] : [],
      ),
    );
    const pages = new Map(
      (data.query?.pages ?? []).flatMap((page) =>
        page.title ? [[page.title, page]] : [],
      ),
    );
    for (const title of batch) {
      const page = pages.get(redirects.get(title) ?? title);
      if (!page?.title || !page.extract || !page.fullurl || page.missing)
        throw new Error(
          `Wikipedia did not return an extract for ${title}; received: ${[...pages.keys()].join(', ') || 'no pages'}`,
        );
      results.push({
        title: page.title,
        extract: page.extract,
        url: page.fullurl,
        retrievedAt: now().toISOString(),
      });
    }
  }
  return results;
}
