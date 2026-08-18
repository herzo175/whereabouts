import { DAILY_BOARD_SIZE } from '@whereabouts/case-content';
import { z } from 'zod';
import {
  type CaseDraft,
  type CuratedBoard,
  caseDraftSchema,
  validateCaseDraftAgainstBoard,
} from './contracts.js';
import type { StructuredModel } from './model.js';

const compactRoundSchema = z.object({
  targetPoiId: z.string(),
  clue: z.object({ text: z.string().min(20) }),
  results: z
    .array(
      z.object({
        poiId: z.string(),
        similarityScore: z.number().int().min(0).max(100),
      }),
    )
    .length(DAILY_BOARD_SIZE),
});
const generatedSchema = z.object({
  rounds: z.array(compactRoundSchema).length(5),
});
type CompactRound = z.infer<typeof compactRoundSchema>;

function validateDraft(
  raw: CaseDraft,
  board: CuratedBoard,
  normalizeEvidence = true,
): CaseDraft {
  const parsed = caseDraftSchema.parse(raw);
  const boardIds = new Set(board.candidates.map((candidate) => candidate.id));
  const normalized: CaseDraft = {
    rounds: parsed.rounds.map((round) => ({
      ...round,
      clue: {
        ...round.clue,
        evidencePoiIds: normalizeEvidence
          ? [...new Set([...round.clue.evidencePoiIds, round.targetPoiId])]
          : round.clue.evidencePoiIds,
      },
      results: normalizeEvidence
        ? (() => {
            const byId = new Map<
              string,
              CaseDraft['rounds'][number]['results'][number]
            >();
            for (const result of round.results)
              if (boardIds.has(result.poiId) && !byId.has(result.poiId))
                byId.set(result.poiId, result);
            return board.candidates.map((candidate) => {
              const result = byId.get(candidate.id) ?? {
                poiId: candidate.id,
                similarityScore: candidate.id === round.targetPoiId ? 100 : 0,
                text: `${candidate.name} is on the themed board, but the clue points to a different place.`,
                evidencePoiIds: [candidate.id, round.targetPoiId],
              };
              return {
                ...result,
                evidencePoiIds: [
                  ...new Set([
                    ...result.evidencePoiIds.filter((id) => boardIds.has(id)),
                    round.targetPoiId,
                    ...(result.poiId === round.targetPoiId
                      ? []
                      : [result.poiId]),
                  ]),
                ],
              };
            });
          })()
        : round.results,
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

function resultText(
  candidate: CuratedBoard['candidates'][number],
  targetPoiId: string,
): string {
  return candidate.id === targetPoiId
    ? `${candidate.name} is the round target: ${candidate.themeClaim}`
    : `${candidate.name} is a themed comparison candidate: ${candidate.themeClaim}`;
}

function assembleRounds(
  rounds: CompactRound[],
  board: CuratedBoard,
): CaseDraft['rounds'] {
  const boardIds = new Set(board.candidates.map((candidate) => candidate.id));
  return rounds.map((round) => {
    const scores = new Map<string, number>();
    for (const result of round.results)
      if (boardIds.has(result.poiId) && !scores.has(result.poiId))
        scores.set(result.poiId, result.similarityScore);
    return {
      targetPoiId: round.targetPoiId,
      clue: { text: round.clue.text, evidencePoiIds: [round.targetPoiId] },
      results: board.candidates.map((candidate) => ({
        poiId: candidate.id,
        similarityScore:
          candidate.id === round.targetPoiId
            ? 100
            : (scores.get(candidate.id) ?? 0),
        text: resultText(candidate, round.targetPoiId),
        evidencePoiIds:
          candidate.id === round.targetPoiId
            ? [candidate.id]
            : [candidate.id, round.targetPoiId],
      })),
    };
  });
}

function assembleDraft(raw: unknown, board: CuratedBoard): CaseDraft {
  const generated = generatedSchema.parse(raw);
  return validateDraft(
    { rounds: assembleRounds(generated.rounds, board) },
    board,
  );
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
  const prompt = `Write a five-round themed geography case for ${theme.title}. Board records and evidence are supplied below; use only their IDs. Explicit target order: ${board.targetPoiIds.join(', ')}. Return exactly five compact rounds, in that order. Each clue must uniquely resolve to its target among the ${DAILY_BOARD_SIZE} board candidates using at least two concrete facts from that target's evidence; do not merely restate the shared theme. Before reveal, never include the target's name, city, or country in the clue. Each round must contain its targetPoiId, a clue text, and exactly ${DAILY_BOARD_SIZE} {poiId, similarityScore} entries covering every board ID exactly once. Set the target to 100 and every other candidate to a custom integer from 0 through 99 based on how strongly that specific place fits the clue. Use the full useful range: hot is 75–99, warm is 40–74, and cold is 0–39; every round must include all three bands and at least eight distinct incorrect scores. Do not return per-result prose or evidence arrays; the pipeline assembles those deterministically from the board.\n${board.candidates.map((candidate) => `${candidate.id}: ${candidate.name}; ${candidate.themeClaim}; source extract: ${candidate.source.extract}`).join('\n')}`;
  const raw = await model.generate({
    schema: generatedSchema,
    prompt,
    stage: 'write-case-draft',
  });
  return assembleDraft(raw, board);
}

export type AuthoredResult = {
  poiId: string;
  points: number;
  text: string;
  sourceIds: string[];
};
export function authorResults(
  results: CaseDraft['rounds'][number]['results'],
  targetPoiId: string,
): AuthoredResult[] {
  if (results.filter((result) => result.poiId === targetPoiId).length !== 1)
    throw new Error('target must occur exactly once');
  const target = results.find((result) => result.poiId === targetPoiId);
  if (target?.similarityScore !== 100)
    throw new Error('target must score exactly 100');
  return results.map(({ similarityScore, evidencePoiIds, ...result }) => ({
    ...result,
    points: similarityScore,
    sourceIds: evidencePoiIds,
  }));
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
  const prompt = `Repair only these defective rounds: ${repairs.map((repair) => `${repair.roundId} (array index ${Number(/^round-([1-5])$/.exec(repair.roundId)?.[1] ?? 0) - 1}) ${repair.kind} ${repair.poiId ?? ''}: ${repair.reason}`).join('; ')}. Preserve all unaffected rounds exactly. Each repaired clue must uniquely resolve to its declared target among the ${DAILY_BOARD_SIZE} board candidates using at least two concrete facts from that target's evidence; do not merely restate the shared theme. Before reveal, never include the target's name, city, or country in the clue. Return replacement rounds in the same requested round order, each with a targetPoiId, clue text, and exactly ${DAILY_BOARD_SIZE} {poiId, similarityScore} entries. Set the target to 100 and every other candidate to a custom integer from 0 through 99. Include hot (75–99), warm (40–74), and cold (0–39) candidates with at least eight distinct incorrect scores per round. Do not return per-result prose or evidence arrays. Theme: ${theme.title}. Board evidence: ${board.candidates.map((candidate) => `${candidate.id}: ${candidate.name}; ${candidate.themeClaim}; ${candidate.source.extract}`).join('\n')}. Board candidate IDs (use each exactly once per replacement round): ${board.candidates.map((candidate) => candidate.id).join(', ')}. Board targets: ${board.targetPoiIds.join(', ')}. Current defective rounds: ${roundIndexes.map((index) => JSON.stringify(draft.rounds[index])).join('\n')}`;
  const replacements = replacementSchema.parse(
    await model.generate({
      schema: replacementSchema,
      prompt,
      stage: 'repair-case-draft',
    }),
  );
  const replacementRounds = assembleRounds(replacements.rounds, board);
  const temporaryRounds = [...draft.rounds];
  roundIndexes.forEach((index, replacementIndex) => {
    temporaryRounds[index] = replacementRounds[
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
