import { DAILY_BOARD_SIZE } from '@whereabouts/case-content';
import { z } from 'zod';
import {
  type CuratedBoard,
  curatedBoardSchema,
  type ResearchedCandidate,
  type ThemePlan,
} from './contracts.js';
import type { StructuredModel } from './model.js';

const selectionSchema = z.object({
  candidateIds: z.array(z.string()).length(DAILY_BOARD_SIZE),
  targetPoiIds: z.array(z.string()).length(5),
});
export type BoardSelection = z.infer<typeof selectionSchema>;

export type CurateBoardInput = {
  model: StructuredModel;
  theme: ThemePlan;
  candidates: ResearchedCandidate[];
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
  if (candidates.length < DAILY_BOARD_SIZE)
    throw new Error(
      `curation requires at least ${DAILY_BOARD_SIZE} candidates`,
    );
  const pool = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  const prompt = `You are curating a themed geography board. Theme: ${theme.title}\nIntroduction: ${theme.introduction}\nExact inclusion criteria: ${theme.inclusionCriteria}\nExact exclusions: ${theme.exclusions.join('; ')}\nCandidate evidence (id, name, claim, coordinates):\n${candidates.map((candidate) => `${candidate.id} | ${candidate.name} | ${candidate.themeClaim} | ${candidate.latitude},${candidate.longitude}`).join('\n')}\nExcluded target IDs (never select these as targets): ${[...excluded].join(', ') || '(none)'}\nReturn only JSON with exactly ${DAILY_BOARD_SIZE} candidateIds and exactly 5 targetPoiIds, all IDs from this pool. Every selected candidate must independently satisfy every inclusion criterion and no exclusion. Targets must be five distinct board IDs. Choose difficulty from meaningful within-theme distinctions, not arbitrary popularity. Do not copy or invent candidate records; IDs only.`;
  let selection: BoardSelection | undefined;
  let correction = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await model.generate({
      schema: selectionSchema,
      prompt: `${prompt}${correction}`,
      stage: 'curate-board',
    });
    const candidate = selectionSchema.parse(raw);
    const unknown = [
      ...candidate.candidateIds,
      ...candidate.targetPoiIds,
    ].filter((id) => !pool.has(id));
    const duplicated =
      duplicate(candidate.candidateIds) || duplicate(candidate.targetPoiIds);
    const excludedTargets = candidate.targetPoiIds.filter((id) =>
      excluded.has(id),
    );
    if (!unknown.length && !duplicated && !excludedTargets.length) {
      selection = candidate;
      break;
    }
    if (attempt === 1) {
      if (unknown.length)
        throw new Error('curation returned an unknown candidate ID');
      if (duplicated) throw new Error('curation returned duplicate IDs');
      throw new Error('curation selected an excluded target');
    }
    correction = `\nYour previous selection was invalid. Unknown IDs: ${unknown.join(', ') || '(none)'}. Duplicate IDs: ${duplicated ? 'yes' : 'no'}. Excluded targets selected: ${excludedTargets.join(', ') || '(none)'}. Correct the JSON using only the exact candidate IDs listed above.`;
  }
  if (!selection) throw new Error('curation did not return a valid selection');
  const candidateIds = [...selection.candidateIds];
  const targets = new Set(selection.targetPoiIds);
  for (const targetId of selection.targetPoiIds) {
    if (candidateIds.includes(targetId)) continue;
    let replacementIndex = -1;
    for (let index = candidateIds.length - 1; index >= 0; index -= 1)
      if (!targets.has(candidateIds[index] as string)) {
        replacementIndex = index;
        break;
      }
    if (replacementIndex < 0)
      throw new Error('targets could not be placed on the board');
    candidateIds[replacementIndex] = targetId;
  }
  const selected = candidateIds.flatMap((id) => {
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
