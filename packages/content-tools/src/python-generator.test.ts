import { describe, expect, it, vi } from 'vitest';

import { createPythonGenerator } from './python-generator.js';

describe('createPythonGenerator', () => {
  it('sends a generation request to the Python CLI and parses its envelope', async () => {
    const spawn = vi.fn(async () => ({
      stdout: JSON.stringify({
        theme: { title: 'Theme' },
        board: {},
        draft: {},
        review: {},
      }),
      stderr: 'researched 25 candidates\n',
    }));
    const assemble = vi.fn(async (input) => input as never);
    const generator = createPythonGenerator({ spawn, generateCase: assemble });

    const result = await generator({
      date: '2026-08-17',
      revision: 1,
      caseNumber: 42,
      recentThemes: [{ title: 'Previous', inclusionCriteria: 'criterion' }],
      excludedTargetIds: new Set(['poi-1']),
    });

    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          date: '2026-08-17',
          revision: 1,
          caseNumber: 42,
          recentThemes: [{ title: 'Previous', inclusionCriteria: 'criterion' }],
          excludedTargetIds: ['poi-1'],
        }),
      }),
    );
    expect(result.theme).toEqual({ title: 'Theme' });
    expect(assemble).toHaveBeenCalledOnce();
  });

  it('includes stderr and a timeout in failures', async () => {
    const generator = createPythonGenerator({
      timeoutMs: 250,
      spawn: vi.fn(async () => {
        throw new Error('timed out');
      }),
    });

    await expect(
      generator({
        date: '2026-08-17',
        revision: 1,
        caseNumber: 42,
        recentThemes: [],
        excludedTargetIds: new Set(),
      }),
    ).rejects.toThrow(/timed out|250ms/i);
  });
});
