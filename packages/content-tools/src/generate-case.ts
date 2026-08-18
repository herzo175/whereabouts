import { createHash } from 'node:crypto';
import {
  dailyCaseSchema,
  type Poi,
  type ThemedDailyCase,
  type ThemedPoi,
} from '@whereabouts/case-content';
import {
  type GenerationReview,
  generationReviewSchema,
  validateGenerationReview,
} from './generation-review.js';
import { reviewPacket } from './review-case.js';
import { authorResults } from './themed-case/case-writer.js';
import type { ThemePlan } from './themed-case/contracts.js';
import {
  type CaseDraft,
  type CuratedBoard,
  validateCaseDraftAgainstBoard,
} from './themed-case/contracts.js';
import { validateCaseForPublication } from './validate-case.js';

export type GenerateCaseInput = {
  date: string;
  revision: number;
  caseNumber: number;
  theme: ThemePlan;
  board: CuratedBoard;
  draft: CaseDraft;
  review: GenerationReview;
};

export type PreparedCase = {
  caseData: ThemedDailyCase;
  generationReview: GenerationReview;
  markdownReview: string;
};

export function resolveGenerationConfig(
  environment: Readonly<Record<string, string | undefined>>,
): { apiKey: string; model: string } {
  const apiKey = environment.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for generation');
  return {
    apiKey,
    model: environment.WHEREABOUTS_MODEL?.trim() || 'openai/gpt-5.6-luna',
  };
}

export function buildPoiBlurb(extract: string, maximumLength = 280): string {
  const normalized = extract.replace(/\s+/g, ' ').trim();
  if (!normalized) throw new Error('cannot build a POI blurb without context');
  if (normalized.length <= maximumLength) return normalized;
  const sentences = normalized.split(/(?<=[.!?])\s+/);
  let blurb = '';
  for (const sentence of sentences) {
    const candidate = blurb ? `${blurb} ${sentence}` : sentence;
    if (candidate.length > maximumLength) break;
    blurb = candidate;
    if (blurb.length >= 120) return blurb;
  }
  if (blurb) return blurb;
  const shortened = normalized.slice(0, maximumLength - 1);
  const finalSpace = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, finalSpace > 80 ? finalSpace : undefined)}…`;
}

function sourceId(index: number): string {
  return `source-${String(index + 1).padStart(2, '0')}`;
}

export function orderPoisForDisplay(
  pois: Poi[],
  seed: { date: string; revision: number; caseNumber: number },
): Poi[] {
  const prefix = `${seed.date}:${seed.revision}:${seed.caseNumber}`;
  return pois
    .map((poi) => ({
      poi,
      key: createHash('sha256').update(`${prefix}:${poi.id}`).digest('hex'),
    }))
    .sort((left, right) =>
      left.key === right.key
        ? left.poi.id.localeCompare(right.poi.id)
        : left.key.localeCompare(right.key),
    )
    .map(({ poi }) => poi);
}

function evidenceSources(
  ids: string[],
  sourceByPoiId: Map<string, string>,
): string[] {
  return [...new Set(ids)].map((id) => {
    const source = sourceByPoiId.get(id);
    if (!source) throw new Error(`unknown evidence POI ID: ${id}`);
    return source;
  });
}

function assertTargets(board: CuratedBoard, draft: CaseDraft): void {
  const boardIds = new Set(board.candidates.map((candidate) => candidate.id));
  if (
    board.targetPoiIds.length !== 5 ||
    board.targetPoiIds.some((id) => !boardIds.has(id))
  )
    throw new Error('target POI is absent from the board');
  if (
    draft.rounds.length !== 5 ||
    draft.rounds.some(
      (round, index) => round.targetPoiId !== board.targetPoiIds[index],
    )
  )
    throw new Error(
      'draft target order does not match the five explicit board targets',
    );
}

function translateDraft(
  draft: CaseDraft,
  sourceByPoiId: Map<string, string>,
): CaseDraft {
  return {
    rounds: draft.rounds.map((round) => ({
      ...round,
      clue: {
        ...round.clue,
        evidencePoiIds: evidenceSources(
          round.clue.evidencePoiIds,
          sourceByPoiId,
        ),
      },
      results: round.results.map((result) => ({
        ...result,
        evidencePoiIds: evidenceSources(result.evidencePoiIds, sourceByPoiId),
      })),
    })),
  };
}

export function authorRoundResults(
  results: CaseDraft['rounds'][number]['results'],
  targetPoiId: string,
): Array<{
  poiId: string;
  points: number;
  text: string;
  sourceIds: string[];
}> {
  return authorResults(results, targetPoiId);
}

export async function generateCase(
  input: GenerateCaseInput,
): Promise<PreparedCase> {
  const checkedDraft = validateCaseDraftAgainstBoard(input.draft, input.board);
  if (!checkedDraft.success)
    throw new Error(`case draft is invalid: ${checkedDraft.error.message}`);
  assertTargets(input.board, checkedDraft.data);
  const parsedReview = generationReviewSchema.parse(input.review);

  const sourceByPoiId = new Map<string, string>();
  for (const targetId of input.board.targetPoiIds) {
    const target = input.board.candidates.find(
      (candidate) => candidate.id === targetId,
    );
    if (target?.source.provenance !== 'verified')
      throw new Error(`target POI source is not verified: ${targetId}`);
  }
  const sources = input.board.candidates.map((candidate, index) => {
    const id = sourceId(index);
    sourceByPoiId.set(candidate.id, id);
    return {
      id,
      title: candidate.source.title,
      url: candidate.source.url,
      retrievedAt: candidate.source.retrievedAt,
      provenance: candidate.source.provenance,
    };
  });
  const pois: ThemedPoi[] = input.board.candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    city: candidate.city,
    country: candidate.country,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    wikipediaTitle: candidate.wikipediaTitle,
    blurb: buildPoiBlurb(candidate.source.extract),
    image: candidate.image,
    themeConnection: {
      text: candidate.themeClaim,
      sourceIds: [sourceByPoiId.get(candidate.id) as string],
    },
  }));
  const translated = translateDraft(checkedDraft.data, sourceByPoiId);
  const displayPois = orderPoisForDisplay(pois, input);
  const caseData = dailyCaseSchema.parse({
    schemaVersion: 4,
    publicationDate: input.date,
    revision: input.revision,
    caseNumber: input.caseNumber,
    theme: {
      title: input.theme.title,
      introduction: input.theme.introduction,
      inclusionCriteria: input.theme.inclusionCriteria,
    },
    pois: displayPois,
    rounds: translated.rounds.map((round, index) => {
      const target = pois.find((poi) => poi.id === round.targetPoiId);
      if (!target?.image)
        throw new Error(`target POI image is missing for round ${index + 1}`);
      return {
        id: `round-${index + 1}`,
        targetPoiId: round.targetPoiId,
        image: target.image,
        clue: { text: round.clue.text, sourceIds: round.clue.evidencePoiIds },
        results: authorRoundResults(
          checkedDraft.data.rounds[index]?.results ?? [],
          round.targetPoiId,
        ).map((result) => ({
          ...result,
          sourceIds: evidenceSources(result.sourceIds, sourceByPoiId),
        })),
      };
    }),
    sources,
  }) as ThemedDailyCase;
  const publicationIssues = validateCaseForPublication(caseData);
  if (publicationIssues.length)
    throw new Error(
      `publication validation failed: ${publicationIssues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`,
    );
  const reviewIssues = validateGenerationReview(caseData, parsedReview);
  if (reviewIssues.length)
    throw new Error(
      `generation review validation failed: ${reviewIssues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`,
    );
  return {
    caseData,
    generationReview: parsedReview,
    markdownReview: reviewPacket(caseData, parsedReview),
  };
}
