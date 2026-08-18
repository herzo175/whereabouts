import { DAILY_BOARD_SIZE } from '@whereabouts/case-content';
import { z } from 'zod';
import {
  candidateSpacingViolations,
  MIN_CANDIDATE_DISTANCE_KM,
} from '../candidate-spacing.js';
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
const MAX_CURATION_ATTEMPTS = 3;
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

function includeTargets(candidateIds: string[], targetPoiIds: string[]) {
  const included = [...candidateIds];
  const targets = new Set(targetPoiIds);
  for (const targetId of targetPoiIds) {
    if (included.includes(targetId)) continue;
    let replacementIndex = -1;
    for (let index = included.length - 1; index >= 0; index -= 1)
      if (!targets.has(included[index] as string)) {
        replacementIndex = index;
        break;
      }
    if (replacementIndex < 0)
      throw new Error('targets could not be placed on the board');
    included[replacementIndex] = targetId;
  }
  return included;
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
  const prompt = `You are curating a themed geography board. Theme: ${theme.title}\nIntroduction: ${theme.introduction}\nExact inclusion criteria: ${theme.inclusionCriteria}\nExact exclusions: ${theme.exclusions.join('; ')}\nCandidate evidence (id, name, claim, coordinates):\n${candidates.map((candidate) => `${candidate.id} | ${candidate.name} | ${candidate.themeClaim} | ${candidate.latitude},${candidate.longitude}`).join('\n')}\nExcluded target IDs (never select these as targets): ${[...excluded].join(', ') || '(none)'}\nReturn only JSON with exactly ${DAILY_BOARD_SIZE} candidateIds and exactly 5 targetPoiIds, all IDs from this pool. Every selected candidate must independently satisfy every inclusion criterion and no exclusion. Every pair of selected candidates must be at least ${MIN_CANDIDATE_DISTANCE_KM} km apart so globe markers remain distinct. Targets must be five distinct board IDs. Choose difficulty from meaningful within-theme distinctions, not arbitrary popularity. Do not copy or invent candidate records; IDs only.`;
  let selection: BoardSelection | undefined;
  let selectedCandidateIds: string[] | undefined;
  let correction = '';
  for (let attempt = 0; attempt < MAX_CURATION_ATTEMPTS; attempt += 1) {
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
    const finalCandidateIds =
      !unknown.length && !duplicated && !excludedTargets.length
        ? includeTargets(candidate.candidateIds, candidate.targetPoiIds)
        : [];
    const finalCandidates = finalCandidateIds.flatMap((id) => {
      const item = pool.get(id);
      return item ? [item] : [];
    });
    const spacingViolations = candidateSpacingViolations(finalCandidates);
    const coordinates = finalCandidates.map(
      (item) => `${item.latitude},${item.longitude}`,
    );
    const duplicateCoordinates =
      new Set(coordinates).size !== coordinates.length;
    if (
      !unknown.length &&
      !duplicated &&
      !excludedTargets.length &&
      !spacingViolations.length
    ) {
      selection = candidate;
      selectedCandidateIds = finalCandidateIds;
      break;
    }
    if (attempt === MAX_CURATION_ATTEMPTS - 1) {
      if (unknown.length)
        throw new Error('curation returned an unknown candidate ID');
      if (duplicated) throw new Error('curation returned duplicate IDs');
      if (excludedTargets.length)
        throw new Error('curation selected an excluded target');
      if (duplicateCoordinates)
        throw new Error('curation selected duplicate coordinates');
      throw new Error(
        `curation selected candidates less than ${MIN_CANDIDATE_DISTANCE_KM} km apart`,
      );
    }
    const spacing = spacingViolations
      .map(
        (violation) =>
          `${violation.firstId} and ${violation.secondId} (${violation.distanceKm.toFixed(1)} km)`,
      )
      .join(', ');
    correction = `\nYour previous selection was invalid. Unknown IDs: ${unknown.join(', ') || '(none)'}. Duplicate IDs: ${duplicated ? 'yes' : 'no'}. Excluded targets selected: ${excludedTargets.join(', ') || '(none)'}. Candidate pairs closer than ${MIN_CANDIDATE_DISTANCE_KM} km: ${spacing || '(none)'}. Correct the JSON using only the exact candidate IDs listed above.`;
  }
  if (!selection || !selectedCandidateIds)
    throw new Error('curation did not return a valid selection');
  const selected = selectedCandidateIds.flatMap((id) => {
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
