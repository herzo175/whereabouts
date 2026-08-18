import { describe, expect, it, vi } from 'vitest';
import type { GenerationReview } from '../generation-review.js';
import {
  InsufficientCandidatePoolError,
  TargetHydrationError,
} from './candidate-researcher.js';
import type { RepairRequest } from './contracts.js';
import {
  fixtureBoard,
  fixtureCandidatePool,
  fixtureCaseDraft,
  fixtureTheme,
} from './fixtures.js';
import type { OrchestratorStages } from './orchestrator.js';
import { orchestrateThemedCase } from './orchestrator.js';

const review: GenerationReview = {
  schemaVersion: 1,
  publicationDate: '2026-08-17',
  revision: 1,
  themeVerdicts: fixtureBoard.candidates.map((candidate) => ({
    poiId: candidate.id,
    status: 'pass',
    explanation:
      'This candidate directly satisfies the theme inclusion criteria.',
    sourceIds: ['source-01'],
  })),
  clueVerdicts: fixtureBoard.targetPoiIds.map((targetPoiId, index) => ({
    roundId: `round-${index + 1}`,
    declaredTargetPoiId: targetPoiId,
    resolvedPoiId: targetPoiId,
    resolvedOffBoardAnswer: null,
    resolvableWithoutExactNumbers: true,
    status: 'pass',
    explanation:
      'The clue resolves independently to the declared board target.',
  })),
  repairs: [],
};

function makeStages(overrides: Partial<OrchestratorStages> = {}) {
  const order: string[] = [];
  const stages: OrchestratorStages = {
    planTheme: vi.fn(async () => {
      order.push('planner');
      return fixtureTheme;
    }),
    researchCandidates: vi.fn(async () => {
      order.push('researcher');
      return fixtureCandidatePool;
    }),
    curateBoard: vi.fn(async () => {
      order.push('curator');
      return fixtureBoard;
    }),
    writeCaseDraft: vi.fn(async () => {
      order.push('writer');
      return fixtureCaseDraft;
    }),
    repairCaseDraft: vi.fn(async ({ draft }) => {
      order.push('repairer');
      return draft;
    }),
    critiqueCase: vi.fn(async () => {
      order.push('critic');
      return { review, repairs: [] };
    }),
    ...overrides,
  };
  return { stages, order };
}

describe('orchestrateThemedCase', () => {
  it('runs planning, research, curation, writing, critique, and assembly in order', async () => {
    const { stages, order } = makeStages();
    const result = await orchestrateThemedCase({
      date: '2026-08-17',
      revision: 1,
      caseNumber: 1,
      recentThemes: [],
      excludedTargetIds: new Set(),
      requestedTheme: 'Railway hotels',
      stages,
    });
    expect(order).toEqual([
      'planner',
      'researcher',
      'curator',
      'writer',
      'critic',
    ]);
    expect(stages.planTheme).toHaveBeenCalledWith({
      recentThemes: [],
      requestedTheme: 'Railway hotels',
    });
    expect(result.caseData.schemaVersion).toBe(4);
    expect(result.generationReview).toEqual(review);
  });

  it('hydrates targets without recuration, preserving external exclusions', async () => {
    const { stages } = makeStages();
    stages.hydrateBoardTargets = vi.fn(async ({ board }) => board);
    const externalExcluded = new Set(['already-excluded']);
    await orchestrateThemedCase({
      date: '2026-08-17',
      revision: 1,
      caseNumber: 1,
      recentThemes: [],
      excludedTargetIds: externalExcluded,
      stages,
    });
    expect(stages.hydrateBoardTargets).toHaveBeenCalledTimes(1);
    expect(stages.curateBoard).toHaveBeenCalledTimes(1);
    expect(stages.hydrateBoardTargets).toHaveBeenCalledWith(
      expect.objectContaining({ excludedTargetIds: externalExcluded }),
    );
  });

  it('abandons a theme when its complete board cannot hydrate targets', async () => {
    const { stages } = makeStages();
    stages.hydrateBoardTargets = vi
      .fn()
      .mockRejectedValueOnce(new TargetHydrationError(['missing-target']))
      .mockImplementation(async ({ board }) => board);
    await orchestrateThemedCase({
      date: '2026-08-17',
      revision: 1,
      caseNumber: 1,
      recentThemes: [],
      excludedTargetIds: new Set(),
      stages,
    });
    expect(stages.planTheme).toHaveBeenCalledTimes(2);
    expect(stages.curateBoard).toHaveBeenCalledTimes(2);
    expect(stages.hydrateBoardTargets).toHaveBeenCalledTimes(2);
  });

  it('uses the draft repair stage for clue-only defects without restarting the board', async () => {
    const { order, stages } = makeStages();
    const repairs: RepairRequest[] = [
      {
        kind: 'clue',
        roundId: 'round-1',
        reason: 'The clue resolves ambiguously and needs a replacement.',
      },
    ];
    stages.critiqueCase = vi
      .fn()
      .mockImplementationOnce(async () => {
        order.push('critic');
        return { review, repairs };
      })
      .mockImplementationOnce(async () => {
        order.push('critic');
        return { review, repairs: [] };
      });

    await orchestrateThemedCase({
      date: '2026-08-17',
      revision: 1,
      caseNumber: 1,
      recentThemes: [],
      excludedTargetIds: new Set(),
      stages,
    });
    expect(order).toEqual([
      'planner',
      'researcher',
      'curator',
      'writer',
      'critic',
      'repairer',
      'critic',
    ]);
    expect(stages.planTheme).toHaveBeenCalledTimes(1);
    expect(stages.researchCandidates).toHaveBeenCalledTimes(1);
    expect(stages.curateBoard).toHaveBeenCalledTimes(1);
    expect(stages.repairCaseDraft).toHaveBeenCalledTimes(1);
  });

  it('reruns curation, writing, and critique for candidate repairs', async () => {
    const { order, stages } = makeStages();
    const rejected = fixtureBoard.candidates[0];
    const repairs: RepairRequest[] = [
      {
        kind: 'candidate',
        poiId: rejected.id,
        reason: 'This candidate fails the exact theme criteria.',
      },
    ];
    stages.critiqueCase = vi
      .fn()
      .mockImplementationOnce(async () => {
        order.push('critic');
        return { review, repairs };
      })
      .mockImplementationOnce(async () => {
        order.push('critic');
        return { review, repairs: [] };
      });
    stages.curateBoard = vi.fn(async () => {
      order.push('curator');
      return fixtureBoard;
    });

    await orchestrateThemedCase({
      date: '2026-08-17',
      revision: 1,
      caseNumber: 1,
      recentThemes: [],
      excludedTargetIds: new Set(),
      stages,
    });
    expect(order).toEqual([
      'planner',
      'researcher',
      'curator',
      'writer',
      'critic',
      'curator',
      'writer',
      'critic',
    ]);
    expect(stages.writeCaseDraft).toHaveBeenCalledTimes(2);
    expect(stages.curateBoard).toHaveBeenCalledTimes(2);
    expect(stages.researchCandidates).toHaveBeenCalledTimes(1);
    const secondCuration = (stages.curateBoard as ReturnType<typeof vi.fn>).mock
      .calls[1]?.[0];
    expect(secondCuration.candidates).not.toContain(rejected);
  });

  it('keeps candidate rejections cumulative within a theme', async () => {
    const { stages } = makeStages();
    const first = fixtureBoard.candidates[0];
    const second = fixtureBoard.candidates[1];
    stages.critiqueCase = vi
      .fn()
      .mockResolvedValueOnce({
        review,
        repairs: [
          {
            kind: 'candidate',
            poiId: first.id,
            reason: 'The first candidate fails the exact theme criteria.',
          },
        ],
      })
      .mockResolvedValueOnce({
        review,
        repairs: [
          {
            kind: 'candidate',
            poiId: second.id,
            reason: 'The second candidate fails the exact theme criteria.',
          },
        ],
      })
      .mockResolvedValueOnce({ review, repairs: [] });

    await orchestrateThemedCase({
      date: '2026-08-17',
      revision: 1,
      caseNumber: 1,
      recentThemes: [],
      excludedTargetIds: new Set(),
      stages,
    });

    const thirdCuration = (stages.curateBoard as ReturnType<typeof vi.fn>).mock
      .calls[2]?.[0];
    expect(thirdCuration.candidates).not.toContain(first);
    expect(thirdCuration.candidates).not.toContain(second);
  });

  it('rejects after the initial critique and three unsuccessful clue repairs', async () => {
    const { stages } = makeStages();
    const repairs: RepairRequest[] = [
      {
        kind: 'clue',
        roundId: 'round-1',
        reason: 'The clue still fails independent resolution.',
      },
    ];
    stages.critiqueCase = vi.fn(async () => ({ review, repairs }));

    await expect(
      orchestrateThemedCase({
        date: '2026-08-17',
        revision: 1,
        caseNumber: 1,
        recentThemes: [],
        excludedTargetIds: new Set(),
        stages,
      }),
    ).rejects.toThrow(/repair|critique/i);
    expect(stages.critiqueCase).toHaveBeenCalledTimes(4);
    expect(stages.repairCaseDraft).toHaveBeenCalledTimes(3);
  });

  it('abandons a theme after two unsuccessful candidate repair cycles', async () => {
    const { stages } = makeStages();
    const repairs: RepairRequest[] = [
      {
        kind: 'candidate',
        poiId: fixtureBoard.candidates[0].id,
        reason: 'The candidate still fails the exact theme criteria.',
      },
    ];
    stages.critiqueCase = vi
      .fn()
      .mockResolvedValueOnce({ review, repairs })
      .mockResolvedValueOnce({ review, repairs })
      .mockResolvedValueOnce({ review, repairs })
      .mockResolvedValueOnce({ review, repairs: [] });
    await orchestrateThemedCase({
      date: '2026-08-17',
      revision: 1,
      caseNumber: 1,
      recentThemes: [],
      excludedTargetIds: new Set(),
      stages,
    });
    expect(stages.planTheme).toHaveBeenCalledTimes(2);
    expect(stages.researchCandidates).toHaveBeenCalledTimes(2);
  });

  it('tries at most three replacement themes when research is insufficient', async () => {
    const { stages } = makeStages();
    stages.researchCandidates = vi.fn(async () => {
      throw new InsufficientCandidatePoolError(12);
    });
    await expect(
      orchestrateThemedCase({
        date: '2026-08-17',
        revision: 1,
        caseNumber: 1,
        recentThemes: [],
        excludedTargetIds: new Set(),
        stages,
      }),
    ).rejects.toBeInstanceOf(InsufficientCandidatePoolError);
    expect(stages.planTheme).toHaveBeenCalledTimes(3);
    expect(stages.researchCandidates).toHaveBeenCalledTimes(3);
    expect(stages.curateBoard).not.toHaveBeenCalled();
  });

  it('restarts planning for a theme repair while retaining the repair bound', async () => {
    const { stages } = makeStages();
    const repairs: RepairRequest[] = [
      {
        kind: 'theme',
        reason: 'The candidate set is not materially within the planned theme.',
      },
    ];
    stages.critiqueCase = vi
      .fn()
      .mockResolvedValueOnce({ review, repairs })
      .mockResolvedValueOnce({ review, repairs: [] });
    await orchestrateThemedCase({
      date: '2026-08-17',
      revision: 1,
      caseNumber: 1,
      recentThemes: [],
      excludedTargetIds: new Set(),
      stages,
    });
    expect(stages.planTheme).toHaveBeenCalledTimes(2);
    expect(stages.researchCandidates).toHaveBeenCalledTimes(2);
    expect(stages.curateBoard).toHaveBeenCalledTimes(2);
    expect(stages.writeCaseDraft).toHaveBeenCalledTimes(2);
  });
});
