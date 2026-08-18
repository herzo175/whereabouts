import {
  dailyCaseSchema,
  type ThemedDailyCase,
} from '@whereabouts/case-content';
import { z } from 'zod';
import {
  type GenerationReview,
  generationReviewSchema,
  validateGenerationReview,
} from '../generation-review.js';
import type {
  CaseDraft,
  CuratedBoard,
  RepairRequest,
  ThemePlan,
} from './contracts.js';
import type { StructuredModel } from './model.js';

const criticOutputSchema = z.object({
  themeVerdicts: z.array(generationReviewSchema.shape.themeVerdicts.element),
  clueVerdicts: z.array(generationReviewSchema.shape.clueVerdicts.element),
});
const criticProviderSchema = z.object({
  themeVerdicts: criticOutputSchema.shape.themeVerdicts.length(25),
  clueVerdicts: criticOutputSchema.shape.clueVerdicts.length(5),
});
type CritiqueInput = {
  criticModel: StructuredModel;
  theme: ThemePlan;
  board: CuratedBoard;
  draft: CaseDraft;
  publicationDate: string;
  revision: number;
};
const fallback = (what: string) =>
  `The critic did not provide a complete independent assessment for ${what}.`;
const normalizeLeakText = (value: string) =>
  value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const leaksIdentity = (text: string, identity: string) => {
  const term = normalizeLeakText(identity);
  if (!term) return false;
  if (term.length >= 4) return normalizeLeakText(text).includes(term);
  return (text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .map(normalizeLeakText)
    .includes(term);
};

function assembleCase(input: CritiqueInput): ThemedDailyCase {
  const sourceIds = ['source-01'];
  const pois = input.board.candidates.map((candidate) => ({
    ...candidate,
    themeConnection: { text: candidate.themeClaim, sourceIds },
  }));
  const rounds = input.draft.rounds.map((round, index) => {
    const target =
      pois.find((poi) => poi.id === round.targetPoiId) ?? pois[index];
    return {
      id: `round-${index + 1}`,
      targetPoiId: round.targetPoiId,
      image: target?.image,
      clue: { text: round.clue.text, sourceIds },
      results: round.results.map((result, resultIndex) => ({
        poiId: result.poiId,
        tier:
          result.poiId === round.targetPoiId
            ? ('correct' as const)
            : resultIndex < 4
              ? ('hot' as const)
              : resultIndex < 12
                ? ('warm' as const)
                : ('cold' as const),
        text: result.text,
        sourceIds,
      })),
    };
  });
  return dailyCaseSchema.parse({
    schemaVersion: 3,
    publicationDate: input.publicationDate,
    revision: input.revision,
    caseNumber: 1,
    theme: {
      title: input.theme.title,
      introduction: input.theme.introduction,
      inclusionCriteria: input.theme.inclusionCriteria,
    },
    pois,
    rounds,
    sources: [
      {
        id: 'source-01',
        title: 'Board evidence',
        url: 'https://example.com/board-evidence',
        retrievedAt: '2026-01-01T00:00:00Z',
        provenance: 'model',
      },
    ],
  }) as ThemedDailyCase;
}

function prompt(input: CritiqueInput): string {
  return `You are the final adversarial critic for a themed geography case.
Theme (including exact criteria and exclusions): ${JSON.stringify(input.theme)}
Assess every candidate independently against every inclusion criterion and exclusion; tangential association is a failure. Resolve each clue independently from its text and evidence BEFORE comparing the answer to targetPoiId. A related place that is not the target fails. Never infer pass from missing, duplicate, malformed, or unsupported verdicts.
Return exactly 25 themeVerdicts (one per board identity) and exactly five clueVerdicts (one per round). Off-board answers use resolvedPoiId=null and resolvedOffBoardAnswer, and fail. Pairwise similarity prose remains available for human audit but is not part of this publication gate.
Board identities and evidence: ${JSON.stringify(input.board.candidates)}
Targets: ${JSON.stringify(input.board.targetPoiIds)}
Round identities: ${input.draft.rounds.map((round, index) => `round-${index + 1} -> ${round.targetPoiId}; clue: ${round.clue.text}`).join('\n')}
Draft clues, relationships, and result evidence: ${JSON.stringify(input.draft)}`;
}

function repairKey(repair: RepairRequest): string {
  if (repair.kind === 'candidate') return `${repair.kind}:${repair.poiId}`;
  if (repair.kind === 'clue') return `${repair.kind}:${repair.roundId}`;
  if (repair.kind === 'relationship')
    return `${repair.kind}:${repair.roundId}:${repair.poiId}`;
  return repair.kind;
}
function dedupe(repairs: RepairRequest[]): RepairRequest[] {
  const values = new Map<string, RepairRequest>();
  for (const repair of repairs)
    if (!values.has(repairKey(repair))) values.set(repairKey(repair), repair);
  return [...values.values()].sort((a, b) =>
    repairKey(a).localeCompare(repairKey(b)),
  );
}

export async function critiqueCase(
  input: CritiqueInput,
): Promise<{ review: GenerationReview; repairs: RepairRequest[] }> {
  const caseData = assembleCase(input);
  let raw: unknown;
  try {
    raw = await input.criticModel.generate({
      schema: criticProviderSchema,
      prompt: prompt(input),
      stage: 'themed-case-critique',
    });
  } catch {
    raw = {};
  }
  const parsedOutput = criticOutputSchema.safeParse(raw);
  const output = parsedOutput.success ? parsedOutput.data : null;
  const repairs: RepairRequest[] = [];
  if (
    !output ||
    output.themeVerdicts.length !== 25 ||
    output.clueVerdicts.length !== 5
  )
    repairs.push({
      kind: 'theme',
      reason:
        'The critic did not provide exactly 25 unique theme and five unique clue verdicts.',
    });
  const themeByPoi = new Map<string, unknown>();
  const duplicateThemes = new Set<string>();
  for (const value of output?.themeVerdicts ?? [])
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { poiId?: unknown }).poiId === 'string'
    ) {
      const poiId = (value as { poiId: string }).poiId;
      if (themeByPoi.has(poiId)) duplicateThemes.add(poiId);
      themeByPoi.set(poiId, value);
    }
  const themeVerdicts = input.board.candidates.map((candidate) => {
    const parsed = generationReviewSchema.shape.themeVerdicts.element.safeParse(
      themeByPoi.get(candidate.id),
    );
    if (
      duplicateThemes.has(candidate.id) ||
      !parsed.success ||
      parsed.data.poiId !== candidate.id
    ) {
      repairs.push({
        kind: 'candidate',
        poiId: candidate.id,
        reason: duplicateThemes.has(candidate.id)
          ? 'The critic supplied duplicate theme verdicts for this candidate.'
          : fallback(candidate.name),
      });
      return {
        poiId: candidate.id,
        status: 'fail' as const,
        explanation: fallback(candidate.name),
        sourceIds: ['source-01'],
      };
    }
    if (parsed.data.status === 'fail')
      repairs.push({
        kind: 'candidate',
        poiId: candidate.id,
        reason: parsed.data.explanation,
      });
    return { ...parsed.data, sourceIds: ['source-01'] };
  });
  if (themeByPoi.size !== 25)
    repairs.push({
      kind: 'theme',
      reason:
        'The critic did not provide exactly one theme verdict for every board identity.',
    });
  const clueByRound = new Map<string, unknown>();
  const duplicateClues = new Set<string>();
  for (const value of output?.clueVerdicts ?? [])
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { roundId?: unknown }).roundId === 'string'
    ) {
      const roundId = (value as { roundId: string }).roundId;
      if (clueByRound.has(roundId)) duplicateClues.add(roundId);
      clueByRound.set(roundId, value);
    }
  const clueVerdicts = caseData.rounds.map((round) => {
    const parsed = generationReviewSchema.shape.clueVerdicts.element.safeParse(
      clueByRound.get(round.id),
    );
    const verdict = parsed.success
      ? parsed.data
      : {
          roundId: round.id,
          declaredTargetPoiId: round.targetPoiId,
          resolvedPoiId: null,
          resolvedOffBoardAnswer: null,
          status: 'fail' as const,
          explanation: fallback(round.id),
        };
    if (
      duplicateClues.has(round.id) ||
      !parsed.success ||
      verdict.status === 'fail' ||
      verdict.resolvedOffBoardAnswer !== null ||
      verdict.resolvedPoiId !== round.targetPoiId ||
      verdict.declaredTargetPoiId !== round.targetPoiId
    )
      repairs.push({
        kind: 'clue',
        roundId: round.id,
        reason: duplicateClues.has(round.id)
          ? 'The critic supplied duplicate clue verdicts for this round.'
          : parsed.success
            ? verdict.explanation
            : fallback(round.id),
      });
    const target = input.board.candidates.find(
      (candidate) => candidate.id === round.targetPoiId,
    );
    if (
      target &&
      [target.name, target.city, target.country].some((term) =>
        leaksIdentity(round.clue.text, term),
      )
    )
      repairs.push({
        kind: 'clue',
        roundId: round.id,
        reason:
          'The clue leaks the target name, destination, city, or country before reveal.',
      });
    return verdict;
  });
  if (clueByRound.size !== 5)
    repairs.push({
      kind: 'theme',
      reason:
        'The critic did not provide exactly one clue verdict for every round.',
    });
  const draftReview = {
    schemaVersion: 1,
    publicationDate: input.publicationDate,
    revision: input.revision,
    themeVerdicts,
    clueVerdicts,
    repairs: [],
  };
  if (
    repairs.length === 0 &&
    validateGenerationReview(caseData, draftReview).length
  )
    repairs.push({
      kind: 'theme',
      reason:
        'The complete review failed deterministic validation and cannot be published.',
    });
  const finalRepairs = dedupe(repairs);
  const review = generationReviewSchema.parse({
    ...draftReview,
    repairs: finalRepairs.map((repair) => ({
      stage: repair.kind,
      summary: repair.reason,
    })),
  });
  return { review, repairs: finalRepairs };
}
