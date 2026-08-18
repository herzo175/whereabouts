import {
  dailyCaseSchema,
  type ThemedDailyCase,
} from '@whereabouts/case-content';
import { z } from 'zod';
import type { ValidationIssue } from './validate-case.js';

export const generationReviewSchema = z.object({
  schemaVersion: z.literal(1),
  publicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  revision: z.number().int().positive(),
  themeVerdicts: z
    .array(
      z.object({
        poiId: z.string(),
        status: z.enum(['pass', 'fail']),
        explanation: z.string().min(20),
        sourceIds: z.array(z.string()).min(1),
      }),
    )
    .length(25),
  clueVerdicts: z
    .array(
      z.object({
        roundId: z.string(),
        declaredTargetPoiId: z.string(),
        resolvedPoiId: z.string().nullable(),
        resolvedOffBoardAnswer: z.string().nullable(),
        status: z.enum(['pass', 'fail']),
        explanation: z.string().min(20),
      }),
    )
    .length(5),
  repairs: z.array(
    z.object({ stage: z.string(), summary: z.string().min(10) }),
  ),
});

export type GenerationReview = z.infer<typeof generationReviewSchema>;

export function validateGenerationReview(
  caseData: unknown,
  review: unknown,
): ValidationIssue[] {
  let dailyCase: ThemedDailyCase;
  let parsed: GenerationReview;
  try {
    dailyCase = dailyCaseSchema.parse(caseData) as ThemedDailyCase;
    parsed = generationReviewSchema.parse(review);
  } catch {
    return [
      {
        path: 'schema',
        message: 'Generation review does not satisfy its schema',
      },
    ];
  }
  if (dailyCase.schemaVersion !== 3)
    return [
      {
        path: 'case.schemaVersion',
        message: 'Generation reviews require a themed v3 case',
      },
    ];
  const issues: ValidationIssue[] = [];
  if (parsed.publicationDate !== dailyCase.publicationDate)
    issues.push({
      path: 'publicationDate',
      message: 'Review publication date does not match case',
    });
  if (parsed.revision !== dailyCase.revision)
    issues.push({
      path: 'revision',
      message: 'Review revision does not match case',
    });
  const poiIds = new Set(dailyCase.pois.map((poi) => poi.id));
  const sourceIds = new Set(dailyCase.sources.map((source) => source.id));
  const passingThemes = new Set<string>();
  for (const [index, verdict] of parsed.themeVerdicts.entries()) {
    if (!poiIds.has(verdict.poiId))
      issues.push({
        path: `themeVerdicts[${index}]`,
        message: 'Theme verdict references an unknown POI',
      });
    if (verdict.sourceIds.some((id) => !sourceIds.has(id)))
      issues.push({
        path: `themeVerdicts[${index}].sourceIds`,
        message: 'Theme verdict references an unknown source',
      });
    if (verdict.status === 'pass') passingThemes.add(verdict.poiId);
    if (verdict.status === 'fail')
      issues.push({
        path: `themeVerdicts[${index}]`,
        message: 'Theme verdict failed',
      });
  }
  for (const poiId of poiIds)
    if (!passingThemes.has(poiId))
      issues.push({
        path: 'themeVerdicts',
        message: `Missing passing theme verdict for ${poiId}`,
      });

  const passingRounds = new Set<string>();
  for (const [index, verdict] of parsed.clueVerdicts.entries()) {
    const round = dailyCase.rounds.find(
      (candidate) => candidate.id === verdict.roundId,
    );
    if (!round) {
      issues.push({
        path: `clueVerdicts[${index}]`,
        message: 'Clue verdict references an unknown round',
      });
      continue;
    }
    if (verdict.status !== 'pass')
      issues.push({
        path: `clueVerdicts[${index}]`,
        message: 'Clue verdict failed',
      });
    if (verdict.resolvedOffBoardAnswer !== null)
      issues.push({
        path: `clueVerdicts[${index}]`,
        message: 'Clue verdict contains an off-board answer',
      });
    if (
      verdict.resolvedPoiId === null ||
      verdict.resolvedPoiId !== verdict.declaredTargetPoiId ||
      verdict.declaredTargetPoiId !== round.targetPoiId
    )
      issues.push({
        path: `clueVerdicts[${index}]`,
        message: 'Clue verdict target does not match the declared round target',
      });
    if (
      verdict.status === 'pass' &&
      verdict.resolvedPoiId === round.targetPoiId &&
      verdict.resolvedOffBoardAnswer === null
    )
      passingRounds.add(round.id);
  }
  for (const round of dailyCase.rounds)
    if (!passingRounds.has(round.id))
      issues.push({
        path: 'clueVerdicts',
        message: `Missing passing clue verdict for ${round.id}`,
      });
  return issues;
}
