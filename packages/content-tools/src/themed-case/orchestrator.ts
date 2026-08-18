import { generateCase, type PreparedCase } from '../generate-case.js';
import type { GenerationReview } from '../generation-review.js';
import {
  InsufficientCandidatePoolError,
  TargetHydrationError,
} from './candidate-researcher.js';
import type {
  CandidatePool,
  CaseDraft,
  CuratedBoard,
  RepairRequest,
  ResearchedCandidate,
  ThemePlan,
} from './contracts.js';

export type OrchestratorStages = {
  planTheme(input: {
    recentThemes: Array<{ title: string; inclusionCriteria: string }>;
    requestedTheme?: string;
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
    excludedTargetIds: ReadonlySet<string>;
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
  requestedTheme?: string;
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

function reportRepairs(repairs: RepairRequest[]): void {
  if (!repairs.length) return;
  console.warn(
    `Critic requested ${repairs.length} repair(s): ${repairs
      .map((repair) => {
        const identity =
          repair.kind === 'candidate'
            ? repair.poiId
            : repair.kind === 'clue'
              ? repair.roundId
              : repair.kind === 'relationship'
                ? `${repair.roundId}/${repair.poiId}`
                : 'theme';
        return `${repair.kind}:${identity} — ${repair.reason}`;
      })
      .join(' | ')}`,
  );
}

export async function orchestrateThemedCase(
  input: OrchestrateThemedCaseInput,
): Promise<PreparedCase> {
  let themeAttempts = 0;
  let lastFailure: unknown;

  themeLoop: while (themeAttempts < 3) {
    themeAttempts += 1;
    let candidateRepairCycles = 0;
    let draftRepairCycles = 0;
    const rejectedCandidateIds = new Set<string>();
    const theme = await input.stages.planTheme({
      recentThemes: input.recentThemes,
      requestedTheme: input.requestedTheme,
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
    if (input.stages.hydrateBoardTargets) {
      try {
        board = await input.stages.hydrateBoardTargets({
          theme,
          board,
          excludedTargetIds: input.excludedTargetIds,
        });
      } catch (error) {
        if (error instanceof TargetHydrationError && themeAttempts < 3)
          continue;
        throw error;
      }
    }
    let draft = await input.stages.writeCaseDraft({ theme, board });
    let critique = await input.stages.critiqueCase({
      theme,
      board,
      draft,
      publicationDate: input.date,
      revision: input.revision,
    });
    reportRepairs(critique.repairs);

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
      lastFailure = critique.repairs;
      if (hasRepair(critique.repairs, 'theme')) {
        if (themeAttempts >= 3) break themeLoop;
        continue themeLoop;
      }
      const rejected = new Set(
        candidateRepairs(critique.repairs).map((repair) => repair.poiId),
      );
      if (rejected.size) {
        if (candidateRepairCycles >= 2) {
          if (themeAttempts < 3) continue themeLoop;
          throw new Error('case critique failed after two board repairs');
        }
        candidateRepairCycles += 1;
        for (const id of rejected) rejectedCandidateIds.add(id);
        let candidates = pool.candidates.filter(
          (candidate) => !rejectedCandidateIds.has(candidate.id),
        );
        if (candidates.length < 25) {
          try {
            const replacementPool = await input.stages.researchCandidates({
              theme,
            });
            candidates = replacementPool.candidates.filter(
              (candidate) => !rejectedCandidateIds.has(candidate.id),
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
        if (input.stages.hydrateBoardTargets) {
          try {
            board = await input.stages.hydrateBoardTargets({
              theme,
              board,
              excludedTargetIds: input.excludedTargetIds,
            });
          } catch (error) {
            if (error instanceof TargetHydrationError && themeAttempts < 3)
              continue themeLoop;
            throw error;
          }
        }
        draft = await input.stages.writeCaseDraft({ theme, board });
      } else {
        if (draftRepairCycles >= 3)
          throw new Error('case critique failed after three clue repairs');
        draftRepairCycles += 1;
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
      reportRepairs(critique.repairs);
    }
  }
  throw new Error(
    `themed case generation exhausted repair/theme attempts: ${String(lastFailure ?? 'no viable theme')}`,
  );
}
