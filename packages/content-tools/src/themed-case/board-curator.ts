import { z } from 'zod';
import {
  type CuratedBoard,
  curatedBoardSchema,
  type HydratedCandidate,
  type ThemePlan,
} from './contracts.js';
import type { StructuredModel } from './model.js';

const selectionSchema = z.object({
  candidateIds: z.array(z.string()).length(25),
  targetPoiIds: z.array(z.string()).length(5),
});
export type BoardSelection = z.infer<typeof selectionSchema>;

export type CurateBoardInput = {
  model: StructuredModel;
  theme: ThemePlan;
  candidates: HydratedCandidate[];
  excludedTargetIds?: ReadonlySet<string> | string[];
};

function duplicate(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

export async function curateBoard({
  model,
  theme,
  candidates,
  excludedTargetIds = [],
}: CurateBoardInput): Promise<CuratedBoard> {
  const excluded = new Set(excludedTargetIds);
  if (candidates.length < 25)
    throw new Error('curation requires at least 25 candidates');
  const pool = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  const prompt = `You are curating a themed geography board. Theme: ${theme.title}\nIntroduction: ${theme.introduction}\nExact inclusion criteria: ${theme.inclusionCriteria}\nExact exclusions: ${theme.exclusions.join('; ')}\nCandidate evidence (id, name, claim, coordinates):\n${candidates.map((candidate) => `${candidate.id} | ${candidate.name} | ${candidate.themeClaim} | ${candidate.latitude},${candidate.longitude}`).join('\n')}\nExcluded target IDs (never select these as targets): ${[...excluded].join(', ') || '(none)'}\nReturn only JSON with exactly 25 candidateIds and exactly 5 targetPoiIds, all IDs from this pool. Every one of the 25 must independently satisfy every inclusion criterion and no exclusion. Targets must be five distinct board IDs. Choose difficulty from meaningful within-theme distinctions, not arbitrary popularity. Do not copy or invent candidate records; IDs only.`;
  const raw = await model.generate({
    schema: selectionSchema,
    prompt,
    stage: 'curate-board',
  });
  const selection = selectionSchema.parse(raw);
  if (duplicate(selection.candidateIds) || duplicate(selection.targetPoiIds))
    throw new Error('curation returned duplicate IDs');
  if (
    selection.candidateIds.some((id) => !pool.has(id)) ||
    selection.targetPoiIds.some((id) => !pool.has(id))
  )
    throw new Error('curation returned an unknown candidate ID');
  if (selection.targetPoiIds.some((id) => excluded.has(id)))
    throw new Error('curation selected an excluded target');
  if (selection.targetPoiIds.some((id) => !selection.candidateIds.includes(id)))
    throw new Error('targets must be on the board');
  const selected = selection.candidateIds.flatMap((id) => {
    const candidate = pool.get(id);
    return candidate ? [candidate] : [];
  });
  const result = curatedBoardSchema.safeParse({
    theme,
    candidates: selected,
    targetPoiIds: selection.targetPoiIds,
  });
  if (!result.success)
    throw new Error(`curated board is invalid: ${result.error.message}`);
  return result.data;
}
