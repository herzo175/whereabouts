import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import { loadLocalEnvironment } from './environment.js';
import { resolveGenerationConfig } from './generate-case.js';
import { caseContentRoot } from './paths.js';
import {
  fetchWikipediaExtracts,
  requireProductionUserAgent,
} from './wikipedia.js';

export const catalogCandidateSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2),
  city: z.string().min(1),
  country: z.string().min(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  wikipediaTitle: z.string().min(2),
  region: z.string().min(2),
});

const generatedCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  country: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  wikipediaTitle: z.string(),
  region: z.string(),
});

export type CatalogCandidate = z.infer<typeof catalogCandidateSchema>;

function normalized(value: string): string {
  return value.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, '');
}

export function catalogId(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function mergeCatalogCandidates(
  existing: CatalogCandidate[],
  candidates: CatalogCandidate[],
  verifiedWikipediaTitles: Set<string>,
): CatalogCandidate[] {
  const ids = new Set(existing.map((poi) => poi.id));
  const names = new Set(existing.map((poi) => normalized(poi.name)));
  const titles = new Set(existing.map((poi) => normalized(poi.wikipediaTitle)));
  const verified = new Set(
    [...verifiedWikipediaTitles].map((title) => normalized(title)),
  );
  const merged = [...existing];

  for (const rawCandidate of candidates) {
    const candidate = catalogCandidateSchema.parse(rawCandidate);
    if (!verified.has(normalized(candidate.wikipediaTitle))) {
      throw new Error(
        `${candidate.id} does not have a verified Wikipedia page`,
      );
    }
    if (
      ids.has(candidate.id) ||
      names.has(normalized(candidate.name)) ||
      titles.has(normalized(candidate.wikipediaTitle))
    ) {
      throw new Error(`duplicate catalog candidate: ${candidate.id}`);
    }
    ids.add(candidate.id);
    names.add(normalized(candidate.name));
    titles.add(normalized(candidate.wikipediaTitle));
    merged.push(candidate);
  }
  return merged;
}

function positiveArgument(
  arguments_: string[],
  name: string,
  fallback: number,
): number {
  const index = arguments_.indexOf(name);
  if (index === -1) return fallback;
  const value = arguments_[index + 1];
  if (!value || !/^\d+$/.test(value) || Number(value) < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return Number(value);
}

async function recentTargetIds(): Promise<string[]> {
  const casesRoot = new URL('cases/', `file://${caseContentRoot}`);
  const files = (await readdir(casesRoot, { recursive: true }))
    .filter((path) => path.endsWith('.json'))
    .sort()
    .slice(-30);
  const targets = await Promise.all(
    files.map(async (path) => {
      const data = JSON.parse(
        await readFile(new URL(path, casesRoot), 'utf8'),
      ) as { target?: { poiId?: string } };
      return data.target?.poiId;
    }),
  );
  return targets.filter((id): id is string => Boolean(id));
}

async function generateBatch(
  existing: CatalogCandidate[],
  recentTargets: string[],
  count: number,
): Promise<CatalogCandidate[]> {
  const { apiKey, model: caseModel } = resolveGenerationConfig(process.env);
  const model = process.env.WHEREABOUTS_CATALOG_MODEL?.trim() || caseModel;
  const openrouter = createOpenRouter({ apiKey, appName: 'Whereabouts' });
  const regions = [...new Set(existing.map((poi) => poi.region))];
  const result = await generateText({
    model: openrouter.chat(model),
    maxOutputTokens: 6_000,
    providerOptions: {
      openrouter: { reasoning: { effort: 'low' } },
    },
    output: Output.object({
      schema: z.object({
        candidates: z.array(generatedCandidateSchema).max(count),
      }),
    }),
    prompt: `You are expanding the persistent landmark catalog for Whereabouts, a difficult daily geography game.

Propose exactly ${count} real, independently recognizable points of interest. They must have substantial English Wikipedia articles. Return accurate coordinates for the landmark itself, not merely its city.

VARIETY REQUIREMENTS
- Spread candidates across these established regions: ${regions.join(', ')}.
- Balance ancient, medieval, early-modern, industrial, modern, natural, religious, civic, scientific, archaeological, and engineering landmarks.
- Include globally meaningful but less overexposed places alongside famous anchors.
- Avoid clusters of visually or historically interchangeable landmarks.
- Do not propose countries, cities, neighborhoods, oceans, or broad geographic areas.
- Use an existing region label exactly as supplied above.
- Use lowercase kebab-case IDs and the exact English Wikipedia article title.

EXCLUSIONS
- Never repeat or rename anything in the existing catalog.
- Avoid recent answers when choosing close analogues: ${recentTargets.join(', ') || 'none'}.

EXISTING CATALOG
${JSON.stringify(existing)}`,
  });
  return z
    .array(catalogCandidateSchema)
    .length(count)
    .parse(
      result.output.candidates
        .slice(0, count)
        .map((candidate) => ({ ...candidate, id: catalogId(candidate.name) })),
    );
}

export async function expandCatalog(arguments_: string[]): Promise<void> {
  requireProductionUserAgent();
  const targetSize = positiveArgument(arguments_, '--target-size', 500);
  const batchSize = Math.min(
    100,
    positiveArgument(arguments_, '--batch-size', 50),
  );
  const catalogUrl = new URL('../catalog/pois.json', import.meta.url);
  let catalog = JSON.parse(
    await readFile(catalogUrl, 'utf8'),
  ) as CatalogCandidate[];
  const targets = await recentTargetIds();
  const allowedRegions = new Set(catalog.map((poi) => poi.region));

  while (catalog.length < targetSize) {
    const count = Math.min(batchSize, targetSize - catalog.length);
    const candidates = await generateBatch(catalog, targets, count);
    for (const candidate of candidates) {
      if (!allowedRegions.has(candidate.region)) {
        throw new Error(`unsupported region: ${candidate.region}`);
      }
    }
    await fetchWikipediaExtracts(
      candidates.map((candidate) => candidate.wikipediaTitle),
    );
    catalog = mergeCatalogCandidates(
      catalog,
      candidates,
      new Set(candidates.map((candidate) => candidate.wikipediaTitle)),
    );
    const temporaryUrl = new URL(
      `../catalog/pois.json.tmp-${process.pid}`,
      import.meta.url,
    );
    await writeFile(temporaryUrl, `${JSON.stringify(catalog, null, 2)}\n`);
    await rename(fileURLToPath(temporaryUrl), fileURLToPath(catalogUrl));
    console.log(`Catalog expanded to ${catalog.length}/${targetSize}`);
  }
}

if (
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).href === import.meta.url
) {
  loadLocalEnvironment();
  expandCatalog(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
