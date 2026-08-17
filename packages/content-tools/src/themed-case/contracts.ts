import { z } from 'zod';

const nonempty = z.string().min(1);
const unique = (values: string[]) => new Set(values).size === values.length;
const uniqueBy = (items: Array<{ id: string; wikipediaTitle: string }>) =>
  unique(items.map((x) => x.id)) && unique(items.map((x) => x.wikipediaTitle));

export const ThemePlan = z.object({
  title: z.string().min(3),
  introduction: z.string().min(20),
  inclusionCriteria: z.string().min(20),
  exclusions: z.array(z.string().min(10)).min(1),
  searchQueries: z.array(z.string().min(3)).min(3).max(12),
});
export type ThemePlan = z.infer<typeof ThemePlan>;
export const ResearchedCandidate = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2),
  city: z.string().min(1),
  country: z.string().min(2),
  wikipediaTitle: z.string().min(2),
  themeClaim: z.string().min(20),
});
export type ResearchedCandidate = z.infer<typeof ResearchedCandidate>;
export const CandidateProposalPool = z
  .object({
    theme: ThemePlan,
    candidates: z.array(ResearchedCandidate).min(35).max(50),
  })
  .superRefine((v, ctx) => {
    if (!uniqueBy(v.candidates))
      ctx.addIssue({
        code: 'custom',
        message: 'candidate IDs and titles must be unique',
      });
  });
export type CandidateProposalPool = z.infer<typeof CandidateProposalPool>;
export const HydratedCandidate = ResearchedCandidate.extend({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  source: z.object({
    title: nonempty,
    url: z.string().url(),
    retrievedAt: z.iso.datetime(),
    extract: z.string().min(100),
  }),
  image: z.object({
    url: z.string().url(),
    alt: z.string().min(5),
    attribution: z.string().min(3),
    licenseUrl: z.string().url(),
  }),
});
export type HydratedCandidate = z.infer<typeof HydratedCandidate>;
export const CandidatePool = z
  .object({
    theme: ThemePlan,
    candidates: z.array(HydratedCandidate).min(35).max(50),
  })
  .superRefine((v, ctx) => {
    if (!uniqueBy(v.candidates))
      ctx.addIssue({
        code: 'custom',
        message: 'candidate IDs and titles must be unique',
      });
  });
export type CandidatePool = z.infer<typeof CandidatePool>;
export const CuratedBoard = z
  .object({
    theme: ThemePlan,
    candidates: z.array(HydratedCandidate).length(25),
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
    const coords = v.candidates.map((x) => `${x.lat},${x.lon}`);
    if (!unique(coords))
      ctx.addIssue({ code: 'custom', message: 'coordinates must be unique' });
  });
export type CuratedBoard = z.infer<typeof CuratedBoard>;
export const ScoredResult = z.object({
  poiId: z.string().min(1),
  similarityScore: z.number().min(0).max(100),
  text: z.string().min(10),
  evidencePoiIds: z.array(z.string().min(1)).min(1),
});
export type ScoredResult = z.infer<typeof ScoredResult>;
export const CaseDraft = z
  .object({
    rounds: z
      .array(
        z.object({
          targetPoiId: z.string().min(1),
          clue: z.object({
            text: z.string().min(20),
            evidencePoiIds: z.array(z.string().min(1)).min(1),
          }),
          results: z.array(ScoredResult).length(25),
        }),
      )
      .length(5),
  })
  .superRefine((v, ctx) => {
    const ids = v.rounds.map((r) => r.targetPoiId);
    if (!unique(ids))
      ctx.addIssue({ code: 'custom', message: 'round targets must be unique' });
  });
export type CaseDraft = z.infer<typeof CaseDraft>;
export const RepairRequest = z.discriminatedUnion('kind', [
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
export type RepairRequest = z.infer<typeof RepairRequest>;
export function validateCaseDraftAgainstBoard(
  draft: CaseDraft,
  board: CuratedBoard,
): z.ZodSafeParseResult<CaseDraft> {
  const result = CaseDraft.safeParse(draft);
  if (!result.success) return result;
  const boardIds = new Set(board.candidates.map((x) => x.id));
  const targets = new Set(board.targetPoiIds);
  const issues: z.ZodIssue[] = [];
  for (const round of result.data.rounds) {
    if (!targets.has(round.targetPoiId))
      issues.push({
        code: 'custom',
        path: ['rounds'],
        message: `target not on board: ${round.targetPoiId}`,
      });
    for (const scored of round.results)
      if (!boardIds.has(scored.poiId))
        issues.push({
          code: 'custom',
          path: ['rounds'],
          message: `result not on board: ${scored.poiId}`,
        });
  }
  return issues.length
    ? { success: false, error: new z.ZodError(issues) as z.ZodError<CaseDraft> }
    : result;
}
