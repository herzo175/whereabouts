import { createHash } from 'node:crypto';
import {
  access,
  mkdir,
  writeFile as nodeWriteFile,
  rename,
} from 'node:fs/promises';
import { dirname } from 'node:path';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  type DailyCase,
  dailyCaseSchema,
  type Poi,
} from '@whereabouts/case-content';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { casePath } from './paths.js';
import { buildCasePrompt, PROMPT_VERSION } from './prompt.js';
import { validateCaseForPublication } from './validate-case.js';
import {
  requireProductionUserAgent,
  type WikipediaExtract,
} from './wikipedia.js';

export const generatedCaseDraftSchema = z.object({
  rounds: z
    .array(
      z.object({
        clue: z.object({
          text: z.string(),
          sourceIds: z.array(z.string()).min(1),
        }),
        results: z
          .array(
            z.object({
              poiId: z.string(),
              similarityScore: z.number().finite().min(0).max(100),
              text: z.string(),
              sourceIds: z.array(z.string()).min(1),
            }),
          )
          .length(25),
      }),
    )
    .length(5),
});
export type GeneratedCaseDraft = z.infer<typeof generatedCaseDraftSchema>;

export function buildPoiBlurb(extract: string, maximumLength = 280): string {
  const normalized = extract.replace(/\s+/g, ' ').trim();
  if (!normalized) throw new Error('cannot build a POI blurb without context');
  if (normalized.length <= maximumLength) return normalized;

  const sentences = normalized.split(/(?<=[.!?])\s+/);
  let blurb = '';
  for (const sentence of sentences) {
    const candidate = blurb ? `${blurb} ${sentence}` : sentence;
    if (candidate.length > maximumLength) break;
    blurb = candidate;
    if (blurb.length >= 120) return blurb;
  }
  if (blurb) return blurb;

  const shortened = normalized.slice(0, maximumLength - 1);
  const finalSpace = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, finalSpace > 80 ? finalSpace : undefined)}…`;
}

const modelCaseDraftSchema = z.object({
  rounds: z.array(
    z.object({
      clue: z.object({
        text: z.string(),
        sourceIds: z.array(z.string()),
      }),
      results: z.array(
        z.object({
          poiId: z.string(),
          similarityScore: z.number().finite().min(0).max(100),
          text: z.string(),
          sourceIds: z.array(z.string()),
        }),
      ),
    }),
  ),
});

function orderPoisForDisplay(
  pois: Poi[],
  seed: { date: string; revision: number; caseNumber: number },
): Poi[] {
  const prefix = `${seed.date}:${seed.revision}:${seed.caseNumber}`;
  return pois
    .map((poi) => ({
      poi,
      key: createHash('sha256').update(`${prefix}:${poi.id}`).digest('hex'),
    }))
    .sort((left, right) =>
      left.key === right.key
        ? left.poi.id.localeCompare(right.poi.id)
        : left.key.localeCompare(right.key),
    )
    .map(({ poi }) => poi);
}

type GenerateDependencies = {
  date: string;
  revision: number;
  caseNumber: number;
  pois: Poi[];
  extracts: WikipediaExtract[];
  generate?: () => Promise<unknown>;
  write?: boolean;
  exists?: (path: string) => Promise<boolean>;
  writeFile?: (path: string, data: string) => Promise<void>;
};

type GenerationEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveGenerationConfig(environment: GenerationEnvironment): {
  apiKey: string;
  model: string;
} {
  const apiKey = environment.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for generation');
  return {
    apiKey,
    model: environment.WHEREABOUTS_MODEL?.trim() || 'openai/gpt-5.6-luna',
  };
}

async function defaultGenerate(
  pois: Poi[],
  extracts: WikipediaExtract[],
): Promise<unknown> {
  requireProductionUserAgent();
  const config = resolveGenerationConfig(process.env);
  const openrouter = createOpenRouter({
    apiKey: config.apiKey,
    appName: 'Whereabouts',
  });
  const result = await generateText({
    model: openrouter.chat(config.model),
    abortSignal: AbortSignal.timeout(180_000),
    maxRetries: 0,
    maxOutputTokens: 24_000,
    providerOptions: {
      openrouter: { reasoning: { effort: 'low' } },
    },
    output: Output.object({ schema: modelCaseDraftSchema }),
    prompt: buildCasePrompt(pois, extracts),
  });
  return result.output;
}

function sourceId(index: number): string {
  return `source-${String(index + 1).padStart(2, '0')}`;
}

function canonicalizeRoundPoiIds(
  draft: GeneratedCaseDraft,
  pois: Poi[],
): GeneratedCaseDraft {
  const idsByCompactForm = new Map<string, string[]>();
  for (const poi of pois) {
    const compact = poi.id.replaceAll('-', '');
    idsByCompactForm.set(compact, [
      ...(idsByCompactForm.get(compact) ?? []),
      poi.id,
    ]);
  }
  return {
    rounds: draft.rounds.map((round) => ({
      ...round,
      results: round.results.map((result) => {
        const matches = idsByCompactForm.get(result.poiId.replaceAll('-', ''));
        return matches?.length === 1
          ? { ...result, poiId: matches[0] as string }
          : result;
      }),
    })),
  };
}

function assertSupportedSourceIds(
  draft: GeneratedCaseDraft,
  sources: Set<string>,
): void {
  const used = [
    ...draft.rounds.flatMap((round) => [
      ...round.clue.sourceIds,
      ...round.results.flatMap((result) => result.sourceIds),
    ]),
  ];
  for (const id of used)
    if (!sources.has(id)) throw new Error(`unsupported source ID: ${id}`);
}

function assertRoundSourceGrounding(
  draft: GeneratedCaseDraft,
  pois: Poi[],
): void {
  const sourceByPoiId = new Map(
    pois.map((poi, index) => [poi.id, sourceId(index)]),
  );
  for (const [roundIndex, round] of draft.rounds.entries()) {
    const targetSourceId = sourceId(roundIndex);
    const targetPoiId = pois[roundIndex]?.id;
    if (!targetPoiId)
      throw new Error(`round ${roundIndex + 1} target is missing`);
    if (!round.clue.sourceIds.includes(targetSourceId)) {
      throw new Error(
        `round ${roundIndex + 1} clue must cite its target source`,
      );
    }
    for (const result of round.results) {
      const guessedSourceId = sourceByPoiId.get(result.poiId);
      if (!result.sourceIds.includes(targetSourceId)) {
        throw new Error(
          `round ${roundIndex + 1} result for ${result.poiId} must cite its target source`,
        );
      }
      if (
        result.poiId !== targetPoiId &&
        (!guessedSourceId || !result.sourceIds.includes(guessedSourceId))
      ) {
        throw new Error(
          `round ${roundIndex + 1} result for ${result.poiId} must cite its guessed POI source`,
        );
      }
    }
  }
}

function normalizeRoundSources(
  draft: GeneratedCaseDraft,
  pois: Poi[],
): GeneratedCaseDraft {
  const sourceByPoiId = new Map(
    pois.map((poi, index) => [poi.id, sourceId(index)]),
  );
  return {
    rounds: draft.rounds.map((round, roundIndex) => {
      const targetPoiId = pois[roundIndex]?.id;
      const targetSourceId = sourceId(roundIndex);
      return {
        ...round,
        clue: {
          ...round.clue,
          sourceIds: [...new Set([...round.clue.sourceIds, targetSourceId])],
        },
        results: round.results.map((result) => {
          const guessedSourceId = sourceByPoiId.get(result.poiId);
          const required =
            result.poiId === targetPoiId || !guessedSourceId
              ? [targetSourceId]
              : [targetSourceId, guessedSourceId];
          return {
            ...result,
            sourceIds: [...new Set([...result.sourceIds, ...required])],
          };
        }),
      };
    }),
  };
}

function bucketRoundResults(
  results: GeneratedCaseDraft['rounds'][number]['results'],
  targetPoiId: string,
): Array<{
  poiId: string;
  tier: 'correct' | 'hot' | 'warm' | 'cold';
  text: string;
  sourceIds: string[];
}> {
  const ranked = results
    .filter((result) => result.poiId !== targetPoiId)
    .sort(
      (left, right) =>
        right.similarityScore - left.similarityScore ||
        left.poiId.localeCompare(right.poiId),
    );
  const tiers = new Map<string, 'hot' | 'warm' | 'cold'>();
  for (const [index, result] of ranked.entries()) {
    tiers.set(result.poiId, index < 4 ? 'hot' : index < 12 ? 'warm' : 'cold');
  }
  return results.map(({ similarityScore: _similarityScore, ...result }) => {
    if (result.poiId === targetPoiId) return { ...result, tier: 'correct' };
    const tier = tiers.get(result.poiId);
    if (!tier) throw new Error(`missing similarity bucket for ${result.poiId}`);
    return { ...result, tier };
  });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function generateCase(
  input: GenerateDependencies,
): Promise<{ caseData: DailyCase; path: string; promptVersion: number }> {
  if (input.pois.length !== 25 || input.extracts.length !== 25)
    throw new Error('generation requires exactly 25 POIs and extracts');
  const rawDraft = await (
    input.generate ?? (() => defaultGenerate(input.pois, input.extracts))
  )();
  const parsedDraft = canonicalizeRoundPoiIds(
    generatedCaseDraftSchema.parse(rawDraft),
    input.pois,
  );
  const sources = input.extracts.map((extract, index) => ({
    id: sourceId(index),
    title: extract.title,
    url: extract.url,
    retrievedAt: extract.retrievedAt,
  }));
  assertSupportedSourceIds(
    parsedDraft,
    new Set(sources.map((source) => source.id)),
  );
  const draft = normalizeRoundSources(parsedDraft, input.pois);
  assertRoundSourceGrounding(draft, input.pois);
  const poisWithBlurbs = input.pois.map((poi, index) => ({
    ...poi,
    blurb: buildPoiBlurb(input.extracts[index]?.extract ?? ''),
  }));
  if (poisWithBlurbs.some((poi) => !poi.image)) {
    throw new Error('generation requires images for all 25 POIs');
  }
  const targets = poisWithBlurbs.slice(0, 5);
  if (targets.length !== 5 || targets.some((target) => !target?.image))
    throw new Error(
      'generation requires images for the first five target POIs',
    );
  const caseData = dailyCaseSchema.parse({
    schemaVersion: 2,
    publicationDate: input.date,
    revision: input.revision,
    caseNumber: input.caseNumber,
    pois: orderPoisForDisplay(poisWithBlurbs, {
      date: input.date,
      revision: input.revision,
      caseNumber: input.caseNumber,
    }),
    rounds: draft.rounds.map((round, index) => {
      const target = targets[index];
      if (!target?.image) throw new Error('target POI image is required');
      return {
        id: `round-${index + 1}`,
        targetPoiId: target.id,
        image: target.image,
        ...round,
        results: bucketRoundResults(round.results, target.id),
      };
    }),
    sources,
  });
  const issues = validateCaseForPublication(caseData);
  if (issues.length)
    throw new Error(
      `publication validation failed: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`,
    );
  const path = casePath(input.date, input.revision);
  if (input.write !== false) {
    if (await (input.exists ?? pathExists)(path))
      throw new Error(`refusing to overwrite existing case: ${path}`);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${process.pid}`;
    const write =
      input.writeFile ?? ((file, data) => nodeWriteFile(file, data));
    await write(temporary, `${JSON.stringify(caseData, null, 2)}\n`);
    await rename(temporary, path);
  }
  return { caseData, path, promptVersion: PROMPT_VERSION };
}
