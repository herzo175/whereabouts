import { z } from 'zod';
import {
  type CandidatePool,
  candidatePoolSchema,
  type CuratedBoard,
  curatedBoardSchema,
  hydratedCandidateSchema,
  type HydratedCandidate,
  type ResearchedCandidate,
  researchedCandidateSchema,
  type ThemePlan,
} from './contracts.js';
import type { LiveResearch } from './live-research.js';
import type { StructuredModel } from './model.js';

const proposalResponseSchema = z.object({
  candidates: z.array(researchedCandidateSchema).min(35).max(50),
});

const canonicalTitle = (title: string) =>
  title.trim().replaceAll('_', ' ').replace(/\s+/g, ' ').toLocaleLowerCase();

const canonicalId = (id: string, title: string) => {
  const value = (id || title).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export class InsufficientCandidatePoolError extends Error {
  constructor(count: number) {
    super(
      `Insufficient candidate pool: ${count} candidates (need at least 35)`,
    );
    this.name = 'InsufficientCandidatePoolError';
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
    'Every proposal must be a distinct real location that independently satisfies every inclusion rule, and there must be at least 35 candidates.',
    'For every proposal include reliable coordinates, a source URL, and a source extract of at least 100 characters. These are model evidence for later human audit, not independently verified facts. Do not invent a source or claim certainty when you do not know it.',
    "Set each proposal source provenance to 'model'; the pipeline ignores any other value from the model.",
    'Do not include an image; target images are verified separately after curation.',
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
      id: canonicalId(parsed.data.id, parsed.data.wikipediaTitle),
    });
  }

  const researched: ResearchedCandidate[] = [];
  const titles = new Set<string>();
  const coordinates = new Set<string>();
  const ids = new Set<string>();
  for (const proposal of proposals) {
    const normalized = {
      ...proposal,
      id: canonicalId(proposal.id, proposal.wikipediaTitle),
      source: { ...proposal.source, provenance: 'model' as const },
    };
    const candidate = researchedCandidateSchema.safeParse(normalized);
    if (!candidate.success) continue;
    const value = candidate.data;
    const titleKey = canonicalTitle(value.wikipediaTitle);
    const coordinateKey = `${value.latitude.toFixed(4)},${value.longitude.toFixed(4)}`;
    const id = canonicalId(value.id, value.wikipediaTitle);
    if (titles.has(titleKey) || coordinates.has(coordinateKey) || ids.has(id))
      continue;
    titles.add(titleKey);
    coordinates.add(coordinateKey);
    ids.add(id);
    researched.push({ ...value, id });
    if (researched.length === 50) break;
  }
  if (researched.length < 35)
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
}): Promise<CuratedBoard> {
  const candidatesById = new Map(
    input.board.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const hydrated = await Promise.all(
    input.board.targetPoiIds.map(async (id) => {
      const candidate = candidatesById.get(id);
      if (!candidate) throw new Error(`target POI is absent from board: ${id}`);
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
  const hydratedById = new Map<string, HydratedCandidate>(
    hydrated.map((candidate) => [candidate.id, candidate]),
  );
  return curatedBoardSchema.parse({
    ...input.board,
    candidates: input.board.candidates.map(
      (candidate) => hydratedById.get(candidate.id) ?? candidate,
    ),
  });
}
