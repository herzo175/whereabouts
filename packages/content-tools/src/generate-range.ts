import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { loadLocalEnvironment } from './environment.js';
import { generateCase } from './generate-case.js';
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

export function selectPoisForDate(
  catalog: CatalogPoi[],
  date: string,
): CatalogPoi[] {
  if (catalog.length < 25)
    throw new Error('catalog must contain at least 25 POIs');

  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const targetOrder = [...catalog].sort((left, right) =>
    hashOrder('whereabouts-target-v2', left).localeCompare(
      hashOrder('whereabouts-target-v2', right),
    ),
  );
  const target =
    targetOrder[((day % catalog.length) + catalog.length) % catalog.length];
  if (!target) throw new Error('target POI is required');

  const regionCount = new Map<string, number>([[target.region, 1]]);
  const regionLimit = Math.ceil(
    25 / new Set(catalog.map((poi) => poi.region)).size,
  );
  const ranked = catalog
    .filter((poi) => poi.id !== target.id)
    .sort((left, right) =>
      hashOrder(`whereabouts-candidates-v2:${date}`, left).localeCompare(
        hashOrder(`whereabouts-candidates-v2:${date}`, right),
      ),
    );
  const selected = [target];
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
  for (let offset = 0; offset < days; offset++) {
    const date = dateAfter(from, offset);
    const pois = selectPoisForDate(catalog, date);
    const extracts = pois.map((poi) => {
      const entry = knowledgeByPoi.get(poi.id);
      if (!entry) throw new Error(`corpus context missing for ${poi.id}`);
      return entry;
    });
    const targetImage = await fetchWikipediaImage(
      pois[0]?.wikipediaTitle ?? '',
    );
    const sourcedPois = pois.map((poi, index) =>
      index === 0 && targetImage ? { ...poi, image: targetImage } : poi,
    );
    await generateCase({
      date,
      revision,
      caseNumber: Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000),
      pois: sourcedPois,
      extracts,
    });
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
