import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { loadLocalEnvironment } from './environment.js';
import {
  type CatalogCandidate,
  catalogCandidateSchema,
  catalogId,
} from './expand-catalog.js';
import {
  fetchWikipediaExtracts,
  requireProductionUserAgent,
  type WikipediaExtract,
} from './wikipedia.js';

const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

type WikidataBinding = {
  item?: { value?: string };
  article?: { value?: string };
  coord?: { value?: string };
  countryLabel?: { value?: string };
  adminLabel?: { value?: string };
  continent?: { value?: string };
};

export type CorpusKnowledge = WikipediaExtract & { poiId: string };

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWikidata(
  url: string,
  headers: Record<string, string>,
  timeout = 30_000,
): Promise<Response> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(timeout),
    });
    if (response.status !== 429 && response.status !== 503) return response;
    if (attempt < 3) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      await delay(Number.isFinite(retryAfter) ? retryAfter * 1_000 : 2_000);
    }
  }
  if (!response) throw new Error('Wikidata did not return a response');
  return response;
}

function entityId(value: string | undefined): string | undefined {
  return value?.match(/\/([^/]+)$/)?.[1];
}

export function parseWikidataPoint(value: string): {
  latitude: number;
  longitude: number;
} {
  const match = /^Point\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$/.exec(value);
  if (!match) throw new Error(`unsupported Wikidata coordinate: ${value}`);
  return { longitude: Number(match[1]), latitude: Number(match[2]) };
}

export function classifyRegion(location: {
  latitude: number;
  longitude: number;
  continentId?: string;
}): string {
  const { latitude, longitude, continentId } = location;
  if (continentId === 'Q15') return 'Africa';
  if (continentId === 'Q18') return 'South America';
  if (continentId === 'Q538') return 'Oceania';
  if (continentId === 'Q51') return 'Antarctica';
  if (continentId === 'Q49')
    return latitude < 26 && longitude > -120
      ? 'Central America'
      : 'North America';
  if (continentId === 'Q46') {
    if (latitude >= 55) return 'Northern Europe';
    if (longitude >= 20) return 'Eastern Europe';
    if (longitude <= 5) return 'Western Europe';
    return 'Europe';
  }
  if (continentId === 'Q48') {
    if (longitude >= 105 && latitude >= 20) return 'East Asia';
    if (longitude >= 90 && latitude < 25) return 'Southeast Asia';
    if (longitude < 65) return 'Middle East';
    return 'South Asia';
  }
  if (longitude >= 105 && latitude >= 20) return 'East Asia';
  if (longitude >= 90 && latitude < 25) return 'Southeast Asia';
  if (longitude >= 35 && longitude < 65) return 'Middle East';
  if (latitude < 26 && longitude > -120 && longitude < -75)
    return 'Central America';
  if (longitude < -30) return latitude < 0 ? 'South America' : 'North America';
  if (latitude < -10 && longitude > 105) return 'Oceania';
  if (latitude < 38 && longitude < 55) return 'Africa';
  return 'Europe';
}

function positiveArgument(
  arguments_: string[],
  name: string,
  fallback: number,
) {
  const index = arguments_.indexOf(name);
  if (index === -1) return fallback;
  const value = arguments_[index + 1];
  if (!value || !/^\d+$/.test(value) || Number(value) < 25)
    throw new Error(`${name} must be an integer of at least 25`);
  return Number(value);
}

function articleTitle(articleUrl: string): string {
  const marker = '/wiki/';
  const index = articleUrl.indexOf(marker);
  if (index === -1) throw new Error(`unsupported Wikipedia URL: ${articleUrl}`);
  return decodeURIComponent(articleUrl.slice(index + marker.length)).replaceAll(
    '_',
    ' ',
  );
}

async function wikidataBindings(
  limit: number,
  userAgent: string,
): Promise<WikidataBinding[]> {
  const query = `SELECT DISTINCT ?item ?article ?coord ?countryLabel ?adminLabel ?continent WHERE {
  ?item wdt:P625 ?coord; wdt:P1435 ?designation; wdt:P17 ?country.
  ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>.
  ?country rdfs:label ?countryLabel. FILTER(LANG(?countryLabel) = "en")
  OPTIONAL {
    ?item wdt:P131 ?admin.
    ?admin rdfs:label ?adminLabel. FILTER(LANG(?adminLabel) = "en")
  }
  OPTIONAL { ?country wdt:P30 ?continent. }
} LIMIT ${limit}`;
  const parameters = new URLSearchParams({ query });
  const response = await fetchWikidata(
    `${WIKIDATA_SPARQL_URL}?${parameters}`,
    {
      Accept: 'application/sparql-results+json',
      'User-Agent': userAgent,
    },
    60_000,
  );
  if (!response.ok)
    throw new Error(`Wikidata query failed with status ${response.status}`);
  const data = (await response.json()) as {
    results?: { bindings?: WikidataBinding[] };
  };
  return data.results?.bindings ?? [];
}

function selectBalanced(
  existing: CatalogCandidate[],
  candidates: CatalogCandidate[],
  targetSize: number,
): CatalogCandidate[] {
  const ranked = [...candidates].sort((left, right) =>
    createHash('sha256')
      .update(`whereabouts-corpus-v1:${left.wikipediaTitle}`)
      .digest('hex')
      .localeCompare(
        createHash('sha256')
          .update(`whereabouts-corpus-v1:${right.wikipediaTitle}`)
          .digest('hex'),
      ),
  );
  const regions = new Set(
    [...existing, ...candidates].map((poi) => poi.region),
  );
  const perRegionLimit = Math.ceil(targetSize / regions.size) + 10;
  const counts = new Map<string, number>();
  for (const poi of existing)
    counts.set(poi.region, (counts.get(poi.region) ?? 0) + 1);
  const selected = [...existing];
  for (const candidate of ranked) {
    if ((counts.get(candidate.region) ?? 0) >= perRegionLimit) continue;
    selected.push(candidate);
    counts.set(candidate.region, (counts.get(candidate.region) ?? 0) + 1);
    if (selected.length === targetSize) return selected;
  }
  for (const candidate of ranked) {
    if (selected.some((poi) => poi.id === candidate.id)) continue;
    selected.push(candidate);
    if (selected.length === targetSize) return selected;
  }
  throw new Error(`Wikidata returned only ${selected.length} usable landmarks`);
}

export async function bootstrapCorpus(arguments_: string[]): Promise<void> {
  const targetSize = positiveArgument(arguments_, '--target-size', 500);
  const userAgent = requireProductionUserAgent();
  const catalogUrl = new URL('../catalog/pois.json', import.meta.url);
  const knowledgeUrl = new URL('../catalog/knowledge.json', import.meta.url);
  const existing = catalogCandidateSchema
    .array()
    .parse(JSON.parse(await readFile(catalogUrl, 'utf8')));
  console.log(
    `Fetching stable Wikidata candidates for ${targetSize} landmarks`,
  );
  const bindings = await wikidataBindings(
    Math.max(targetSize * 3, 1_500),
    userAgent,
  );
  console.log(`Discovered ${bindings.length} Wikidata landmark rows`);
  const knownCountries = new Map(
    existing.map((poi) => [poi.country, poi.region]),
  );
  const usedIds = new Set(existing.map((poi) => poi.id));
  const usedTitles = new Set(existing.map((poi) => poi.wikipediaTitle));
  const candidates: CatalogCandidate[] = [];
  for (const binding of bindings) {
    const article = binding.article?.value;
    const point = binding.coord?.value;
    const country = binding.countryLabel?.value;
    if (!article || !point || !country) continue;
    const wikipediaTitle = articleTitle(article);
    if (
      usedTitles.has(wikipediaTitle) ||
      /^(List of|National Register of Historic Places listings)/i.test(
        wikipediaTitle,
      )
    )
      continue;
    const id = catalogId(wikipediaTitle);
    if (!id || usedIds.has(id)) continue;
    const coordinates = parseWikidataPoint(point);
    const candidate = catalogCandidateSchema.parse({
      id,
      name: wikipediaTitle,
      city: binding.adminLabel?.value ?? country,
      country,
      ...coordinates,
      wikipediaTitle,
      region:
        knownCountries.get(country) ??
        classifyRegion({
          ...coordinates,
          continentId: entityId(binding.continent?.value),
        }),
    });
    usedIds.add(id);
    usedTitles.add(wikipediaTitle);
    candidates.push(candidate);
  }
  const catalog = selectBalanced(existing, candidates, targetSize);
  console.log(`Caching Wikipedia context for ${catalog.length} landmarks`);
  const extracts: WikipediaExtract[] = [];
  for (let offset = 0; offset < catalog.length; offset += 20) {
    const batch = catalog.slice(offset, offset + 20);
    extracts.push(
      ...(await fetchWikipediaExtracts(batch.map((poi) => poi.wikipediaTitle))),
    );
    console.log(
      `Cached Wikipedia context ${Math.min(offset + batch.length, catalog.length)}/${catalog.length}`,
    );
  }
  const knowledge: CorpusKnowledge[] = catalog.map((poi, index) => {
    const extract = extracts[index];
    if (!extract) throw new Error(`missing corpus extract for ${poi.id}`);
    return { poiId: poi.id, ...extract };
  });
  const catalogTemporary = new URL(
    `../catalog/pois.json.tmp-${process.pid}`,
    import.meta.url,
  );
  const knowledgeTemporary = new URL(
    `../catalog/knowledge.json.tmp-${process.pid}`,
    import.meta.url,
  );
  await Promise.all([
    writeFile(catalogTemporary, `${JSON.stringify(catalog, null, 2)}\n`),
    writeFile(knowledgeTemporary, `${JSON.stringify(knowledge, null, 2)}\n`),
  ]);
  await Promise.all([
    rename(fileURLToPath(catalogTemporary), fileURLToPath(catalogUrl)),
    rename(fileURLToPath(knowledgeTemporary), fileURLToPath(knowledgeUrl)),
  ]);
  console.log(`Corpus ready: ${catalog.length} landmarks with cached context`);
}

if (
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).href === import.meta.url
) {
  loadLocalEnvironment();
  bootstrapCorpus(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
