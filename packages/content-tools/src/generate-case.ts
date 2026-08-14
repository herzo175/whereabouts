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
  clues: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        sourceIds: z.array(z.string()).min(1),
      }),
    )
    .length(6),
  contextualResponses: z
    .array(
      z.object({
        poiId: z.string(),
        tier: z.enum(['cold', 'warm', 'hot']),
        text: z.string(),
        sourceIds: z.array(z.string()).min(1),
      }),
    )
    .length(24),
  reveal: z.object({
    title: z.string(),
    summary: z.string(),
    clueExplanation: z.string(),
    sourceIds: z.array(z.string()).min(1),
  }),
});
export type GeneratedCaseDraft = z.infer<typeof generatedCaseDraftSchema>;

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
    model:
      environment.WHEREABOUTS_MODEL?.trim() ||
      'deepseek/deepseek-v4-flash-0731',
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
    output: Output.object({ schema: generatedCaseDraftSchema }),
    prompt: buildCasePrompt(pois, extracts),
  });
  return result.output;
}

function sourceId(index: number): string {
  return `source-${String(index + 1).padStart(2, '0')}`;
}
function assertSupportedSourceIds(
  draft: GeneratedCaseDraft,
  sources: Set<string>,
): void {
  const used = [
    ...draft.clues.flatMap((entry) => entry.sourceIds),
    ...draft.contextualResponses.flatMap((entry) => entry.sourceIds),
    ...draft.reveal.sourceIds,
  ];
  for (const id of used)
    if (!sources.has(id)) throw new Error(`unsupported source ID: ${id}`);
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
  const draft = generatedCaseDraftSchema.parse(rawDraft);
  const sources = input.extracts.map((extract, index) => ({
    id: sourceId(index),
    title: extract.title,
    url: extract.url,
    retrievedAt: extract.retrievedAt,
  }));
  assertSupportedSourceIds(draft, new Set(sources.map((source) => source.id)));
  const target = input.pois[0];
  if (!target) throw new Error('target POI is required');
  const caseData = dailyCaseSchema.parse({
    schemaVersion: 1,
    publicationDate: input.date,
    revision: input.revision,
    caseNumber: input.caseNumber,
    target: { poiId: target.id, destinationName: target.name },
    pois: orderPoisForDisplay(input.pois, {
      date: input.date,
      revision: input.revision,
      caseNumber: input.caseNumber,
    }),
    ...draft,
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
