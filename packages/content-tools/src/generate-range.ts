import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { dailyCaseSchema } from '@whereabouts/case-content';

import { loadLocalEnvironment } from './environment.js';
import { generateCase } from './generate-case.js';
import { caseContentRoot } from './paths.js';
import {
  fetchWikipediaImage,
  requireProductionUserAgent,
} from './wikipedia.js';

type CatalogPoi = Parameters<typeof generateCase>[0]['pois'][number] & {
  region: string;
};

function usage(): never {
  throw new Error(
    'Usage: content:generate-range -- --from YYYY-MM-DD --days N [--revision N]',
  );
}
function parse(arguments_: string[]): {
  from: string;
  days: number;
  revision: number;
} {
  const from = arguments_[arguments_.indexOf('--from') + 1];
  const daysText = arguments_[arguments_.indexOf('--days') + 1];
  const revisionIndex = arguments_.indexOf('--revision');
  const revisionText =
    revisionIndex === -1 ? '1' : arguments_[revisionIndex + 1];
  if (
    !from ||
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !daysText ||
    !/^\d+$/.test(daysText) ||
    Number(daysText) < 1 ||
    !revisionText ||
    !/^\d+$/.test(revisionText) ||
    Number(revisionText) < 1
  )
    usage();
  return {
    from,
    days: Number(daysText),
    revision: Number(revisionText),
  };
}
function dateAfter(from: string, offset: number): string {
  const date = new Date(`${from}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function hashOrder(seed: string, poi: CatalogPoi): string {
  return createHash('sha256').update(`${seed}:${poi.id}`).digest('hex');
}

type TargetHistory = ReadonlyMap<string, Iterable<string>>;

export function targetExclusionsForDate(
  history: TargetHistory,
  date: string,
): Set<string> {
  const previousDates = [...history.keys()]
    .filter((candidate) => candidate < date)
    .sort((left, right) => right.localeCompare(left))
    .slice(0, 30);
  return new Set(
    previousDates.flatMap((previousDate) => [
      ...(history.get(previousDate) ?? []),
    ]),
  );
}

async function publishedTargetHistory(): Promise<Map<string, string[]>> {
  const manifest = JSON.parse(
    await readFile(resolve(caseContentRoot, 'manifest.json'), 'utf8'),
  ) as { cases?: Record<string, { file?: string }> };
  const history = new Map<string, string[]>();
  for (const [date, entry] of Object.entries(manifest.cases ?? {})) {
    if (!entry.file) throw new Error(`manifest case ${date} has no file`);
    const caseData = dailyCaseSchema.parse(
      JSON.parse(await readFile(resolve(caseContentRoot, entry.file), 'utf8')),
    );
    history.set(
      date,
      caseData.rounds.map((round) => round.targetPoiId),
    );
  }
  return history;
}

export function selectPoisForDate(
  catalog: CatalogPoi[],
  date: string,
  excludedTargetIds: ReadonlySet<string> = new Set(),
): CatalogPoi[] {
  if (catalog.length < 25)
    throw new Error('catalog must contain at least 25 POIs');

  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const targetOrder = [...catalog].sort((left, right) =>
    hashOrder('whereabouts-target-v2', left).localeCompare(
      hashOrder('whereabouts-target-v2', right),
    ),
  );
  const targetCandidates = targetOrder.filter(
    (poi) => !excludedTargetIds.has(poi.id),
  );
  if (targetCandidates.length < 5)
    throw new Error('catalog must contain five eligible targets');
  const targetStart =
    ((day % targetCandidates.length) + targetCandidates.length) %
    targetCandidates.length;
  const targets = Array.from(
    { length: 5 },
    (_, index) =>
      targetCandidates[(targetStart + index) % targetCandidates.length],
  );
  if (targets.some((target) => !target))
    throw new Error('five target POIs are required');

  const regionCount = new Map<string, number>();
  for (const target of targets) {
    if (!target) continue;
    regionCount.set(target.region, (regionCount.get(target.region) ?? 0) + 1);
  }
  const regionLimit = Math.ceil(
    25 / new Set(catalog.map((poi) => poi.region)).size,
  );
  const ranked = catalog
    .filter((poi) => !targets.some((target) => target?.id === poi.id))
    .sort((left, right) =>
      hashOrder(`whereabouts-candidates-v2:${date}`, left).localeCompare(
        hashOrder(`whereabouts-candidates-v2:${date}`, right),
      ),
    );
  const selected = targets.filter((target): target is CatalogPoi =>
    Boolean(target),
  );
  for (const poi of ranked) {
    if ((regionCount.get(poi.region) ?? 0) >= regionLimit) continue;
    selected.push(poi);
    regionCount.set(poi.region, (regionCount.get(poi.region) ?? 0) + 1);
    if (selected.length === 25) return selected;
  }
  for (const poi of ranked) {
    if (selected.some((candidate) => candidate.id === poi.id)) continue;
    selected.push(poi);
    if (selected.length === 25) return selected;
  }
  throw new Error('catalog could not produce 25 unique POIs');
}

export async function attachWikipediaImages(
  pois: CatalogPoi[],
  fetchImage: typeof fetchWikipediaImage = fetchWikipediaImage,
): Promise<CatalogPoi[]> {
  const sourcedPois: CatalogPoi[] = [];
  for (let offset = 0; offset < pois.length; offset += 5) {
    const batch = pois.slice(offset, offset + 5);
    const images = await Promise.all(
      batch.map((poi) => fetchImage(poi.wikipediaTitle)),
    );
    for (const [index, poi] of batch.entries()) {
      const image = images[index];
      sourcedPois.push(image ? { ...poi, image } : poi);
    }
  }
  return sourcedPois;
}

export async function ensureImageBackedPois(
  selected: CatalogPoi[],
  catalog: CatalogPoi[],
  date: string,
  fetchImage: typeof fetchWikipediaImage = fetchWikipediaImage,
  excludedTargetIds: ReadonlySet<string> = new Set(),
): Promise<CatalogPoi[]> {
  const targetSize = selected.length;
  const enriched = await attachWikipediaImages(selected, fetchImage);
  const usedIds = new Set(selected.map((poi) => poi.id));
  const replacements = catalog
    .filter((poi) => !usedIds.has(poi.id) && !excludedTargetIds.has(poi.id))
    .sort((left, right) =>
      hashOrder(`whereabouts-image-replacement-v1:${date}`, left).localeCompare(
        hashOrder(`whereabouts-image-replacement-v1:${date}`, right),
      ),
    );

  const imageBackedReplacements: CatalogPoi[] = [];
  for (let offset = 0; offset < replacements.length; offset += 5) {
    if (imageBackedReplacements.length >= targetSize) break;
    const batch = await attachWikipediaImages(
      replacements.slice(offset, offset + 5),
      fetchImage,
    );
    for (const poi of batch) {
      if (!poi.image) continue;
      imageBackedReplacements.push(poi);
      if (imageBackedReplacements.length === targetSize) break;
    }
  }
  const sourced = enriched.map((poi) =>
    poi.image ? poi : imageBackedReplacements.shift(),
  );
  if (sourced.some((poi) => !poi) || sourced.length !== targetSize) {
    throw new Error(
      `catalog could not produce ${targetSize} image-backed POIs`,
    );
  }
  return sourced as CatalogPoi[];
}

function isDeterministicGenerationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return [
    'catalog ',
    'corpus context missing',
    'generation requires ',
    'OPENROUTER_API_KEY',
    'manifest case ',
    'cannot build a POI blurb',
  ].some((fragment) => message.includes(fragment));
}

export async function generateWithRetries<T>(
  generate: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await generate();
    } catch (error) {
      if (isDeterministicGenerationError(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

export async function generateRange(arguments_: string[]): Promise<void> {
  const { from, days, revision } = parse(arguments_);
  requireProductionUserAgent();
  const catalog = (
    await import('../catalog/pois.json', { with: { type: 'json' } })
  ).default as CatalogPoi[];
  const knowledge = JSON.parse(
    await readFile(
      new URL('../catalog/knowledge.json', import.meta.url),
      'utf8',
    ),
  ) as Array<{
    poiId: string;
    title: string;
    extract: string;
    url: string;
    retrievedAt: string;
  }>;
  const knowledgeByPoi = new Map(
    knowledge.map((entry) => [entry.poiId, entry]),
  );
  if (catalog.length < 25)
    throw new Error('catalog must contain at least 25 POIs');
  const history = await publishedTargetHistory();
  for (let offset = 0; offset < days; offset++) {
    const date = dateAfter(from, offset);
    const excludedTargetIds = targetExclusionsForDate(history, date);
    const pois = selectPoisForDate(catalog, date, excludedTargetIds);
    const sourcedPois = await ensureImageBackedPois(
      pois,
      catalog,
      date,
      fetchWikipediaImage,
      excludedTargetIds,
    );
    const extracts = sourcedPois.map((poi) => {
      const entry = knowledgeByPoi.get(poi.id);
      if (!entry) throw new Error(`corpus context missing for ${poi.id}`);
      return entry;
    });
    await generateWithRetries(() =>
      generateCase({
        date,
        revision,
        caseNumber: Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000),
        pois: sourcedPois,
        extracts,
      }),
    );
    history.set(
      date,
      sourcedPois.slice(0, 5).map((poi) => poi.id),
    );
  }
}

if (
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).href === import.meta.url
) {
  loadLocalEnvironment();
  generateRange(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
