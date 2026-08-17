import { describe, expect, it } from 'vitest';
import { curateBoard } from './board-curator.js';
import { fixtureCandidates, fixtureTheme } from './fixtures.js';

describe('curateBoard', () => {
  it('reconstructs a 25-record board from model IDs and preserves target order', async () => {
    const ids = fixtureCandidates.slice(0, 25).map((candidate) => candidate.id);
    const model = {
      generate: async () => ({
        candidateIds: ids,
        targetPoiIds: ids.slice(0, 5),
      }),
    };
    const board = await curateBoard({
      model,
      theme: fixtureTheme,
      candidates: fixtureCandidates,
    });
    expect(board.candidates.map((candidate) => candidate.id)).toEqual(ids);
    expect(board.targetPoiIds).toEqual(ids.slice(0, 5));
  });

  it('rejects duplicate coordinates through the board contract', async () => {
    const candidates = fixtureCandidates.map((candidate, index) =>
      index === 1
        ? {
            ...candidate,
            latitude: fixtureCandidates[0].latitude,
            longitude: fixtureCandidates[0].longitude,
          }
        : candidate,
    );
    const ids = candidates.slice(0, 25).map((candidate) => candidate.id);
    await expect(
      curateBoard({
        model: {
          generate: async () => ({
            candidateIds: ids,
            targetPoiIds: ids.slice(0, 5),
          }),
        },
        theme: fixtureTheme,
        candidates,
      }),
    ).rejects.toThrow(/coordinates/);
  });

  it('does not apply semantic keyword heuristics beyond model selection', async () => {
    const candidates = fixtureCandidates.map((candidate, index) =>
      index === 0
        ? {
            ...candidate,
            themeClaim: 'Task 8 unrelated marker, but supplied as a candidate.',
          }
        : candidate,
    );
    const ids = candidates.slice(0, 25).map((candidate) => candidate.id);
    const board = await curateBoard({
      model: {
        generate: async () => ({
          candidateIds: ids,
          targetPoiIds: ids.slice(0, 5),
        }),
      },
      theme: fixtureTheme,
      candidates,
    });
    expect(board.candidates[0]?.id).toBe(ids[0]);
  });
});
