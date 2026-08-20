import { describe, expect, it, vi } from 'vitest';

import { loadTodayCase } from './index';

describe('loadTodayCase', () => {
  it('loads the browser-local date without requiring a dated route', async () => {
    const caseData = { publicationDate: '2026-08-20' };
    const loadCase = vi.fn().mockResolvedValue(caseData);

    await expect(
      loadTodayCase(new Date('2026-08-20T12:00:00'), loadCase),
    ).resolves.toEqual({ caseData, date: '2026-08-20' });
    expect(loadCase).toHaveBeenCalledWith('2026-08-20');
  });
});
