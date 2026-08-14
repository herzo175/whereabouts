import {
  access,
  mkdir,
  writeFile as nodeWriteFile,
  rename,
} from 'node:fs/promises';
import { dirname } from 'node:path';
import { openai } from '@ai-sdk/openai';
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

async function defaultGenerate(
  pois: Poi[],
  extracts: WikipediaExtract[],
): Promise<unknown> {
  requireProductionUserAgent();
  // ai@5.0.x exposes the v5 structured-output option under this compatibility name.
  const result = await generateText({
    model: openai(process.env.WHEREABOUTS_MODEL ?? 'gpt-5-mini'),
    experimental_output: Output.object({ schema: generatedCaseDraftSchema }),
    prompt: buildCasePrompt(pois, extracts),
  });
  return result.experimental_output;
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
    pois: input.pois,
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
