import { z } from 'zod';
import {
  type CandidatePool,
  candidatePoolSchema,
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
      `Insufficient candidate pool: ${count} verified candidates (need at least 35)`,
    );
    this.name = 'InsufficientCandidatePoolError';
  }
}

export async function researchCandidates(input: {
  model: StructuredModel;
  research: LiveResearch;
  theme: ThemePlan;
}): Promise<CandidatePool> {
  const evidence = new Map<string, { title: string; snippet: string }>();
  for (const query of input.theme.searchQueries) {
    const results = await input.research.search(query, 50);
    for (const result of results) {
      const title = result.title.trim();
      if (title && !evidence.has(canonicalTitle(title)))
        evidence.set(canonicalTitle(title), { title, snippet: result.snippet });
    }
  }
  const prompt = [
    'Propose plausible locations for this theme using the live search evidence.',
    `Theme: ${input.theme.title}`,
    `Inclusion rules: ${input.theme.inclusionCriteria}`,
    `Exclusion rules: ${input.theme.exclusions.join('; ')}`,
    'Every proposal must be a distinct real location supported by the evidence, and should include at least 35 candidates.',
    'Search evidence:',
    ...[...evidence.values()].map((item) => `- ${item.title}: ${item.snippet}`),
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

  const hydrated: HydratedCandidate[] = [];
  const titles = new Set<string>();
  const coordinates = new Set<string>();
  const ids = new Set<string>();
  for (const proposal of proposals) {
    const candidate = await input.research.hydrate(proposal);
    if (!candidate) continue;
    const titleKey = canonicalTitle(candidate.wikipediaTitle);
    const coordinateKey = `${candidate.latitude.toFixed(4)},${candidate.longitude.toFixed(4)}`;
    const id = canonicalId(candidate.id, candidate.wikipediaTitle);
    if (titles.has(titleKey) || coordinates.has(coordinateKey) || ids.has(id))
      continue;
    titles.add(titleKey);
    coordinates.add(coordinateKey);
    ids.add(id);
    hydrated.push({ ...candidate, id });
    if (hydrated.length === 50) break;
  }
  if (hydrated.length < 35)
    throw new InsufficientCandidatePoolError(hydrated.length);
  return candidatePoolSchema.parse({
    theme: input.theme,
    candidates: hydrated,
  });
}
