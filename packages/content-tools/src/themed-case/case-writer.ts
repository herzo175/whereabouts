import { z } from 'zod';
import {
  type CaseDraft,
  type CuratedBoard,
  caseDraftSchema,
  validateCaseDraftAgainstBoard,
} from './contracts.js';
import type { StructuredModel } from './model.js';

const generatedSchema = z.object({
  rounds: z
    .array(
      z.object({
        targetPoiId: z.string(),
        clue: z.object({
          text: z.string().min(20),
          evidencePoiIds: z.array(z.string()).min(1),
        }),
        results: z
          .array(
            z.object({
              poiId: z.string(),
              similarityScore: z.number().min(0).max(100),
              text: z.string().min(10),
              evidencePoiIds: z.array(z.string()).min(1),
            }),
          )
          .length(25),
      }),
    )
    .length(5),
});
type Generated = z.infer<typeof generatedSchema>;

function validateDraft(
  raw: unknown,
  board: CuratedBoard,
  normalizeEvidence = true,
): CaseDraft {
  const parsed = caseDraftSchema.parse(raw);
  const normalized: CaseDraft = {
    rounds: parsed.rounds.map((round) => ({
      ...round,
      clue: {
        ...round.clue,
        evidencePoiIds: normalizeEvidence
          ? [...new Set([...round.clue.evidencePoiIds, round.targetPoiId])]
          : round.clue.evidencePoiIds,
      },
      results: round.results.map((result) => ({
        ...result,
        evidencePoiIds: normalizeEvidence
          ? [
              ...new Set([
                ...result.evidencePoiIds,
                round.targetPoiId,
                ...(result.poiId === round.targetPoiId ? [] : [result.poiId]),
              ]),
            ]
          : result.evidencePoiIds,
      })),
    })),
  };
  const checked = validateCaseDraftAgainstBoard(normalized, board);
  if (!checked.success)
    throw new Error(`case draft is invalid: ${checked.error.message}`);
  for (const round of normalized.rounds) {
    const target = round.targetPoiId;
    if (normalizeEvidence && !round.clue.evidencePoiIds.includes(target))
      throw new Error('clue evidence must include its target POI');
    const correct = round.results.filter((result) => result.poiId === target);
    if (correct.length !== 1 || correct[0].similarityScore !== 100)
      throw new Error('target result must score exactly 100');
    for (const result of round.results) {
      if (
        normalizeEvidence &&
        result.poiId !== target &&
        (!result.evidencePoiIds.includes(target) ||
          !result.evidencePoiIds.includes(result.poiId))
      )
        throw new Error(
          'relationship evidence must include target and guessed POI',
        );
    }
  }
  return normalized;
}

export async function writeCaseDraft({
  model,
  theme,
  board,
}: {
  model: StructuredModel;
  theme: CuratedBoard['theme'];
  board: CuratedBoard;
}): Promise<CaseDraft> {
  const prompt = `Write a five-round themed geography case for ${theme.title}. Board records and evidence are supplied below; use only their IDs. Explicit target order: ${board.targetPoiIds.join(', ')}. Return exactly five rounds, in that order, each with exactly 25 results covering every board ID exactly once. The target result must have similarityScore 100. Every non-target relationship result evidencePoiIds must include both its guessed POI ID and that round's target ID. Clue evidence and all result evidence must be board IDs.\n${board.candidates.map((candidate) => `${candidate.id}: ${candidate.name}; ${candidate.themeClaim}; source extract: ${candidate.source.extract}`).join('\n')}`;
  const raw = await model.generate({
    schema: generatedSchema,
    prompt,
    stage: 'write-case-draft',
  });
  return validateDraft(raw, board);
}

export type BucketedResult = {
  poiId: string;
  tier: 'correct' | 'hot' | 'warm' | 'cold';
  text: string;
  sourceIds: string[];
};
export function bucketResults(
  results: Generated['rounds'][number]['results'],
  targetPoiId: string,
): BucketedResult[] {
  if (results.filter((result) => result.poiId === targetPoiId).length !== 1)
    throw new Error('target must occur exactly once');
  const ranked = results
    .filter((result) => result.poiId !== targetPoiId)
    .sort(
      (a, b) =>
        b.similarityScore - a.similarityScore || a.poiId.localeCompare(b.poiId),
    );
  const tiers = new Map(
    ranked.map(
      (result, index) =>
        [
          result.poiId,
          index < 4 ? 'hot' : index < 12 ? 'warm' : 'cold',
        ] as const,
    ),
  );
  return results.map(
    ({ similarityScore: _score, evidencePoiIds, ...result }) => {
      const tier =
        result.poiId === targetPoiId ? 'correct' : tiers.get(result.poiId);
      if (!tier)
        throw new Error(`missing similarity bucket for ${result.poiId}`);
      return { ...result, tier, sourceIds: evidencePoiIds };
    },
  );
}

export async function repairCaseDraft({
  model,
  theme,
  board,
  draft,
  repairs,
}: {
  model: StructuredModel;
  theme: CuratedBoard['theme'];
  board: CuratedBoard;
  draft: CaseDraft;
  repairs: Array<{
    kind: 'clue' | 'relationship';
    roundId: string;
    poiId?: string;
    reason: string;
  }>;
}): Promise<CaseDraft> {
  const roundIndexes = [
    ...new Set(
      repairs.map((repair) => {
        if (repair.kind !== 'clue' && repair.kind !== 'relationship')
          throw new Error(`unsupported repair kind: ${repair.kind}`);
        const match = /^round-([1-5])$/.exec(repair.roundId);
        if (!match) throw new Error(`unrecognized round ID: ${repair.roundId}`);
        return Number(match[1]) - 1;
      }),
    ),
  ];
  if (!roundIndexes.length)
    throw new Error('repairs must identify round indexes');
  const replacementSchema = z.object({
    rounds: z
      .array(generatedSchema.shape.rounds.element)
      .length(roundIndexes.length),
  });
  const prompt = `Repair only these defective rounds: ${repairs.map((repair) => `${repair.roundId} (array index ${Number(/^round-([1-5])$/.exec(repair.roundId)?.[1] ?? 0) - 1}) ${repair.kind} ${repair.poiId ?? ''}: ${repair.reason}`).join('; ')}. Preserve all unaffected rounds exactly. Return replacement rounds in the same requested round order, with complete 25-result rounds, explicit target IDs, clue evidence including its target ID, and board-only evidence IDs. Theme: ${theme.title}. Board targets: ${board.targetPoiIds.join(', ')}.`;
  const replacements = replacementSchema.parse(
    await model.generate({
      schema: replacementSchema,
      prompt,
      stage: 'repair-case-draft',
    }),
  );
  const temporaryRounds = [...draft.rounds];
  roundIndexes.forEach((index, replacementIndex) => {
    temporaryRounds[index] = replacements.rounds[
      replacementIndex
    ] as CaseDraft['rounds'][number];
  });
  const normalizedTemporary = validateDraft({ rounds: temporaryRounds }, board);
  const rounds = [...draft.rounds];
  roundIndexes.forEach((index) => {
    rounds[index] = normalizedTemporary.rounds[index];
  });
  return validateDraft({ rounds }, board, false);
}
