import { z } from 'zod';
import {
  type CandidatePool,
  type CuratedBoard,
  candidatePoolSchema,
  curatedBoardSchema,
  type HydratedCandidate,
  hydratedCandidateSchema,
  type ResearchedCandidate,
  researchedCandidateSchema,
  type ThemePlan,
} from './contracts.js';
import type { LiveResearch } from './live-research.js';
import type { StructuredModel } from './model.js';

// OpenAI-compatible structured-output providers reject JSON Schema's `uri`
// format. Keep the provider contract format-free, then apply the stricter
// publication schema after generation.
const modelCandidateSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2),
  city: z.string().min(1),
  country: z.string().min(2),
  wikipediaTitle: z.string().min(2).optional(),
  themeClaim: z.string().min(20),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  source: z.object({
    title: z.string().min(1),
    url: z.string().regex(/^https?:\/\/\S+$/),
    retrievedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/),
    provenance: z.enum(['model', 'verified']),
    extract: z.string().min(100),
  }),
});
const proposalResponseSchema = z.object({
  candidates: z.array(modelCandidateSchema).min(35).max(40),
});

const canonicalTitle = (title: string) =>
  title.trim().replaceAll('_', ' ').replace(/\s+/g, ' ').toLocaleLowerCase();

const canonicalId = (id: string) => {
  const value = id.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export class InsufficientCandidatePoolError extends Error {
  constructor(count: number) {
    super(
      `Insufficient candidate pool: ${count} candidates (need at least 25)`,
    );
    this.name = 'InsufficientCandidatePoolError';
  }
}

export class TargetHydrationError extends Error {
  constructor(readonly failedPoiIds: readonly string[]) {
    super(`Target hydration failed: ${failedPoiIds.join(', ')}`);
    this.name = 'TargetHydrationError';
  }
}

export async function researchCandidates(input: {
  model: StructuredModel;
  theme: ThemePlan;
}): Promise<CandidatePool> {
  const prompt = [
    'Propose plausible locations for this theme from your general knowledge first.',
    `Theme: ${input.theme.title}`,
    `Inclusion rules: ${input.theme.inclusionCriteria}`,
    `Exclusion rules: ${input.theme.exclusions.join('; ')}`,
    'Return 35 to 40 distinct real locations. Every proposal must independently satisfy every inclusion rule and must use unique coordinates accurate to that specific location (not a reused city center).',
    'For every proposal include reliable coordinates, a source URL, and a source extract of at least 100 characters. These are model evidence for later human audit, not independently verified facts. Do not invent a source or claim certainty when you do not know it.',
    "Set each proposal source provenance to 'model'; the pipeline ignores any other value from the model.",
    'Do not include an image; target images are verified separately after curation.',
    'Include wikipediaTitle only when you know the specific English Wikipedia article title; otherwise omit it.',
    'Keep all candidates tightly within the theme. Do not add generic famous places as easy distractors.',
  ].join('\n');
  const generated = await input.model.generate({
    schema: proposalResponseSchema,
    prompt,
    stage: 'candidate research',
  });
  const proposals: ResearchedCandidate[] = [];
  for (const value of generated.candidates) {
    const parsed = researchedCandidateSchema.safeParse(value);
    if (!parsed.success) continue;
    proposals.push({
      ...parsed.data,
      id: canonicalId(parsed.data.id),
    });
  }

  const researched: ResearchedCandidate[] = [];
  const titles = new Set<string>();
  const coordinates = new Set<string>();
  const ids = new Set<string>();
  for (const proposal of proposals) {
    const normalized = {
      ...proposal,
      id: canonicalId(proposal.id),
      source: { ...proposal.source, provenance: 'model' as const },
    };
    const candidate = researchedCandidateSchema.safeParse(normalized);
    if (!candidate.success) continue;
    const value = candidate.data;
    const titleKey = value.wikipediaTitle
      ? canonicalTitle(value.wikipediaTitle)
      : undefined;
    const coordinateKey = `${value.latitude.toFixed(4)},${value.longitude.toFixed(4)}`;
    const id = canonicalId(value.id);
    if (
      (titleKey !== undefined && titles.has(titleKey)) ||
      coordinates.has(coordinateKey) ||
      ids.has(id)
    )
      continue;
    if (titleKey !== undefined) titles.add(titleKey);
    coordinates.add(coordinateKey);
    ids.add(id);
    researched.push({ ...value, id });
    if (researched.length === 50) break;
  }
  if (researched.length < 25)
    throw new InsufficientCandidatePoolError(researched.length);
  return candidatePoolSchema.parse({
    theme: input.theme,
    candidates: researched,
  });
}

/**
 * Verify only the five selected round targets. The model-provided pool and
 * board evidence remains explicitly auditable model evidence; Wikimedia is
 * used here for the images and verified source material required by rounds.
 */
export async function hydrateBoardTargets(input: {
  board: CuratedBoard;
  research: LiveResearch;
  excludedTargetIds?: ReadonlySet<string>;
}): Promise<CuratedBoard> {
  const candidatesById = new Map(
    input.board.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const excluded = input.excludedTargetIds ?? new Set<string>();
  const attempted = new Set<string>();
  const hydratedById = new Map<string, HydratedCandidate>();
  const failedPoiIds: string[] = [];
  const canonicalTitle = (title: string) =>
    title.trim().replaceAll('_', ' ').replace(/\s+/g, ' ').toLocaleLowerCase();
  const originalTitleOwners = new Map(
    input.board.candidates.flatMap((candidate) =>
      candidate.wikipediaTitle
        ? [[canonicalTitle(candidate.wikipediaTitle), candidate.id] as const]
        : [],
    ),
  );
  const hydratedPageOwners = new Map<string, string>();

  const hydrateBatch = async (ids: string[]) => {
    for (const id of ids) attempted.add(id);
    const attempts = await Promise.allSettled(
      ids.map(async (id) => {
        const candidate = candidatesById.get(id);
        if (!candidate)
          throw new Error(`target POI is absent from board: ${id}`);
        const result = await input.research.hydrate(candidate);
        if (!result)
          throw new Error(
            `target POI could not be researched: ${candidate.name}`,
          );
        const parsed = hydratedCandidateSchema.safeParse(result);
        if (!parsed.success)
          throw new Error(
            `target POI research was incomplete for ${candidate.name}: ${parsed.error.message}`,
          );
        return parsed.data;
      }),
    );
    attempts.forEach((attempt, index) => {
      const id = ids[index];
      if (!id) return;
      if (attempt.status === 'fulfilled') {
        const titleKey = canonicalTitle(attempt.value.wikipediaTitle);
        const originalOwner = originalTitleOwners.get(titleKey);
        const hydratedOwner = hydratedPageOwners.get(titleKey);
        if (
          (originalOwner && originalOwner !== id) ||
          (hydratedOwner && hydratedOwner !== id)
        ) {
          failedPoiIds.push(id);
          return;
        }
        hydratedPageOwners.set(titleKey, id);
        hydratedById.set(id, { ...attempt.value, id });
      } else failedPoiIds.push(id);
    });
  };

  const preferred = input.board.targetPoiIds.filter((id) => !excluded.has(id));
  await hydrateBatch(preferred);
  const fallbackCandidates = input.board.candidates.filter(
    (candidate) => !attempted.has(candidate.id) && !excluded.has(candidate.id),
  );
  for (
    let offset = 0;
    hydratedById.size < 5 && offset < fallbackCandidates.length;
    offset += 5
  )
    await hydrateBatch(
      fallbackCandidates
        .slice(offset, offset + 5)
        .map((candidate) => candidate.id),
    );
  if (hydratedById.size < 5)
    throw new TargetHydrationError([...new Set(failedPoiIds)]);

  const targetPoiIds = [
    ...preferred.filter((id) => hydratedById.has(id)),
    ...fallbackCandidates
      .map((candidate) => candidate.id)
      .filter((id) => hydratedById.has(id)),
  ].slice(0, 5);
  return curatedBoardSchema.parse({
    ...input.board,
    targetPoiIds,
    candidates: input.board.candidates.map((candidate) =>
      targetPoiIds.includes(candidate.id)
        ? (hydratedById.get(candidate.id) ?? candidate)
        : candidate,
    ),
  });
}
