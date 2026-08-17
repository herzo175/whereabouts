import { generateCase, type PreparedCase } from '../generate-case.js';
import type { GenerationReview } from '../generation-review.js';
import { InsufficientCandidatePoolError } from './candidate-researcher.js';
import type {
  CandidatePool,
  CaseDraft,
  CuratedBoard,
  ResearchedCandidate,
  RepairRequest,
  ThemePlan,
} from './contracts.js';

export type OrchestratorStages = {
  planTheme(input: {
    recentThemes: Array<{ title: string; inclusionCriteria: string }>;
  }): Promise<ThemePlan>;
  researchCandidates(input: { theme: ThemePlan }): Promise<CandidatePool>;
  curateBoard(input: {
    theme: ThemePlan;
    candidates: ResearchedCandidate[];
    excludedTargetIds: ReadonlySet<string>;
  }): Promise<CuratedBoard>;
  hydrateBoardTargets?(input: {
    theme: ThemePlan;
    board: CuratedBoard;
  }): Promise<CuratedBoard>;
  writeCaseDraft(input: {
    theme: ThemePlan;
    board: CuratedBoard;
  }): Promise<CaseDraft>;
  repairCaseDraft(input: {
    theme: ThemePlan;
    board: CuratedBoard;
    draft: CaseDraft;
    repairs: Array<Extract<RepairRequest, { kind: 'clue' | 'relationship' }>>;
  }): Promise<CaseDraft>;
  critiqueCase(input: {
    theme: ThemePlan;
    board: CuratedBoard;
    draft: CaseDraft;
    publicationDate: string;
    revision: number;
  }): Promise<{ review: GenerationReview; repairs: RepairRequest[] }>;
};

export type OrchestrateThemedCaseInput = {
  date: string;
  revision: number;
  caseNumber: number;
  recentThemes: Array<{ title: string; inclusionCriteria: string }>;
  excludedTargetIds: ReadonlySet<string>;
  stages: OrchestratorStages;
};

function hasRepair(
  repairs: RepairRequest[],
  kind: RepairRequest['kind'],
): boolean {
  return repairs.some((repair) => repair.kind === kind);
}

function candidateRepairs(
  repairs: RepairRequest[],
): Array<Extract<RepairRequest, { kind: 'candidate' }>> {
  return repairs.filter(
    (repair): repair is Extract<RepairRequest, { kind: 'candidate' }> =>
      repair.kind === 'candidate',
  );
}

function draftRepairs(
  repairs: RepairRequest[],
): Array<Extract<RepairRequest, { kind: 'clue' | 'relationship' }>> {
  return repairs.filter(
    (
      repair,
    ): repair is Extract<RepairRequest, { kind: 'clue' | 'relationship' }> =>
      repair.kind === 'clue' || repair.kind === 'relationship',
  );
}

export async function orchestrateThemedCase(
  input: OrchestrateThemedCaseInput,
): Promise<PreparedCase> {
  let themeAttempts = 0;
  let repairCycles = 0;
  let lastFailure: unknown;

  themeLoop: while (themeAttempts < 3) {
    themeAttempts += 1;
    const theme = await input.stages.planTheme({
      recentThemes: input.recentThemes,
    });
    let pool: CandidatePool;
    try {
      pool = await input.stages.researchCandidates({ theme });
    } catch (error) {
      if (error instanceof InsufficientCandidatePoolError && themeAttempts < 3)
        continue;
      throw error;
    }
    let board = await input.stages.curateBoard({
      theme,
      candidates: pool.candidates,
      excludedTargetIds: input.excludedTargetIds,
    });
    if (input.stages.hydrateBoardTargets)
      board = await input.stages.hydrateBoardTargets({ theme, board });
    let draft = await input.stages.writeCaseDraft({ theme, board });
    let critique = await input.stages.critiqueCase({
      theme,
      board,
      draft,
      publicationDate: input.date,
      revision: input.revision,
    });

    while (true) {
      if (critique.repairs.length === 0)
        return generateCase({
          date: input.date,
          revision: input.revision,
          caseNumber: input.caseNumber,
          theme,
          board,
          draft,
          review: critique.review,
        });
      if (repairCycles >= 2)
        throw new Error('case critique failed after two repair cycles');
      repairCycles += 1;
      lastFailure = critique.repairs;
      if (hasRepair(critique.repairs, 'theme')) {
        if (themeAttempts >= 3) break themeLoop;
        continue themeLoop;
      }
      const rejected = new Set(
        candidateRepairs(critique.repairs).map((repair) => repair.poiId),
      );
      if (rejected.size) {
        let candidates = pool.candidates.filter(
          (candidate) => !rejected.has(candidate.id),
        );
        if (candidates.length < 25) {
          try {
            const replacementPool = await input.stages.researchCandidates({
              theme,
            });
            candidates = replacementPool.candidates.filter(
              (candidate) => !rejected.has(candidate.id),
            );
            pool = replacementPool;
          } catch (error) {
            if (
              error instanceof InsufficientCandidatePoolError &&
              themeAttempts < 3
            )
              continue themeLoop;
            throw error;
          }
        }
        board = await input.stages.curateBoard({
          theme,
          candidates,
          excludedTargetIds: input.excludedTargetIds,
        });
        if (input.stages.hydrateBoardTargets)
          board = await input.stages.hydrateBoardTargets({ theme, board });
        draft = await input.stages.writeCaseDraft({ theme, board });
      } else {
        draft = await input.stages.repairCaseDraft({
          theme,
          board,
          draft,
          repairs: draftRepairs(critique.repairs),
        });
      }
      critique = await input.stages.critiqueCase({
        theme,
        board,
        draft,
        publicationDate: input.date,
        revision: input.revision,
      });
    }
  }
  throw new Error(
    `themed case generation exhausted repair/theme attempts: ${String(lastFailure ?? 'no viable theme')}`,
  );
}
