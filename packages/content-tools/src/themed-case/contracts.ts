import { z } from 'zod';

const nonempty = z.string().min(1);
const unique = (values: string[]) => new Set(values).size === values.length;
const uniqueBy = (items: Array<{ id: string; wikipediaTitle: string }>) =>
  unique(items.map((x) => x.id)) && unique(items.map((x) => x.wikipediaTitle));

export const themePlanSchema = z.object({
  title: z.string().min(3),
  introduction: z.string().min(20).max(160),
  inclusionCriteria: z.string().min(20),
  exclusions: z.array(z.string().min(10)).min(1),
  searchQueries: z.array(z.string().min(3)).min(3).max(12),
});
export type ThemePlan = z.infer<typeof themePlanSchema>;
const candidateIdentitySchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2),
  city: z.string().min(1),
  country: z.string().min(2),
  wikipediaTitle: z.string().min(2),
  themeClaim: z.string().min(20),
});
const candidateEvidenceSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  source: z.object({
    title: nonempty,
    url: z.string().url(),
    retrievedAt: z.iso.datetime(),
    provenance: z.enum(['model', 'verified']),
    extract: z.string().min(100),
  }),
  image: z.object({
    url: z.string().url(),
    alt: z.string().min(5),
    attribution: z.string().min(3),
    licenseUrl: z.string().url(),
  }),
});
/**
 * Candidate research is model-first. Coordinates and an auditable source
 * extract are part of the proposal contract; they are model evidence, not
 * verified facts. Images are added only for round targets by live research.
 */
export const researchedCandidateSchema = candidateIdentitySchema
  .merge(candidateEvidenceSchema.omit({ image: true }))
  .extend({
    image: candidateEvidenceSchema.shape.image.optional(),
  });
export type ResearchedCandidate = z.infer<typeof researchedCandidateSchema>;
export const candidateProposalPoolSchema = z
  .object({
    theme: themePlanSchema,
    candidates: z.array(researchedCandidateSchema).min(25).max(50),
  })
  .superRefine((v, ctx) => {
    if (!uniqueBy(v.candidates))
      ctx.addIssue({
        code: 'custom',
        message: 'candidate IDs and titles must be unique',
      });
  });
export type CandidateProposalPool = z.infer<typeof candidateProposalPoolSchema>;
export const hydratedCandidateSchema = candidateIdentitySchema.merge(
  candidateEvidenceSchema,
);
export type HydratedCandidate = z.infer<typeof hydratedCandidateSchema>;
export const candidatePoolSchema = z
  .object({
    theme: themePlanSchema,
    candidates: z.array(researchedCandidateSchema).min(25).max(50),
  })
  .superRefine((v, ctx) => {
    if (!uniqueBy(v.candidates))
      ctx.addIssue({
        code: 'custom',
        message: 'candidate IDs and titles must be unique',
      });
  });
export type CandidatePool = z.infer<typeof candidatePoolSchema>;
export const curatedBoardSchema = z
  .object({
    theme: themePlanSchema,
    candidates: z.array(researchedCandidateSchema).length(25),
    targetPoiIds: z.array(z.string()).length(5),
  })
  .superRefine((v, ctx) => {
    if (!uniqueBy(v.candidates))
      ctx.addIssue({
        code: 'custom',
        message: 'candidate IDs and titles must be unique',
      });
    if (!unique(v.targetPoiIds))
      ctx.addIssue({ code: 'custom', message: 'target IDs must be unique' });
    const ids = new Set(v.candidates.map((x) => x.id));
    if (v.targetPoiIds.some((id) => !ids.has(id)))
      ctx.addIssue({ code: 'custom', message: 'targets must exist on board' });
    const coords = v.candidates.map((x) => `${x.latitude},${x.longitude}`);
    if (!unique(coords))
      ctx.addIssue({ code: 'custom', message: 'coordinates must be unique' });
  });
export type CuratedBoard = z.infer<typeof curatedBoardSchema>;
export const scoredResultSchema = z.object({
  poiId: z.string().min(1),
  similarityScore: z.number().int().min(0).max(100),
  text: z.string().min(10),
  evidencePoiIds: z.array(z.string().min(1)).min(1),
});
export type ScoredResult = z.infer<typeof scoredResultSchema>;
export const caseDraftSchema = z
  .object({
    rounds: z
      .array(
        z.object({
          targetPoiId: z.string().min(1),
          clue: z.object({
            text: z.string().min(20),
            evidencePoiIds: z.array(z.string().min(1)).min(1),
          }),
          results: z.array(scoredResultSchema).length(25),
        }),
      )
      .length(5),
  })
  .superRefine((v, ctx) => {
    const ids = v.rounds.map((r) => r.targetPoiId);
    if (!unique(ids))
      ctx.addIssue({ code: 'custom', message: 'round targets must be unique' });
  });
export type CaseDraft = z.infer<typeof caseDraftSchema>;
export const repairRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('theme'), reason: z.string().min(10) }),
  z.object({
    kind: z.literal('candidate'),
    poiId: z.string().min(1),
    reason: z.string().min(10),
  }),
  z.object({
    kind: z.literal('clue'),
    roundId: z.string().min(1),
    reason: z.string().min(10),
  }),
  z.object({
    kind: z.literal('relationship'),
    roundId: z.string().min(1),
    poiId: z.string().min(1),
    reason: z.string().min(10),
  }),
]);
export type RepairRequest = z.infer<typeof repairRequestSchema>;
export function validateCaseDraftAgainstBoard(
  draft: CaseDraft,
  board: CuratedBoard,
): z.ZodSafeParseResult<CaseDraft> {
  const result = caseDraftSchema.safeParse(draft);
  if (!result.success) return result;
  const boardIds = new Set(board.candidates.map((x) => x.id));
  const issues: z.ZodIssue[] = [];
  const expectedResultIds = board.candidates.map((candidate) => candidate.id);
  for (const [roundIndex, round] of result.data.rounds.entries()) {
    if (round.targetPoiId !== board.targetPoiIds[roundIndex])
      issues.push({
        code: 'custom',
        path: ['rounds', roundIndex, 'targetPoiId'],
        message: 'round target order must match board targets',
      });
    const resultIds = round.results.map((scored) => scored.poiId);
    if (
      resultIds.length !== expectedResultIds.length ||
      new Set(resultIds).size !== resultIds.length ||
      resultIds.some((id) => !boardIds.has(id)) ||
      expectedResultIds.some((id) => !resultIds.includes(id))
    )
      issues.push({
        code: 'custom',
        path: ['rounds', roundIndex, 'results'],
        message: 'each round must cover every board candidate exactly once',
      });
    const evidenceIds = [
      ...round.clue.evidencePoiIds,
      ...round.results.flatMap((scored) => scored.evidencePoiIds),
    ];
    for (const evidenceId of evidenceIds)
      if (!boardIds.has(evidenceId))
        issues.push({
          code: 'custom',
          path: ['rounds', roundIndex],
          message: `evidence not on board: ${evidenceId}`,
        });
  }
  return issues.length
    ? { success: false, error: new z.ZodError(issues) as z.ZodError<CaseDraft> }
    : result;
}
