import { describe, expect, it } from 'vitest';
import {
  bufferDates,
  caseNumberForDate,
  missingBufferDates,
  nextRevision,
} from './publication-buffer.js';

describe('publication buffer helpers', () => {
  it('uses UTC date arithmetic across the DST boundary', () => {
    expect(bufferDates('2026-11-01')).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
    ]);
  });

  it('selects only unpublished dates from a buffer', () => {
    expect(
      missingBufferDates(['2026-11-01', '2026-11-02', '2026-11-03'], {
        '2026-11-02': {
          caseNumber: 1,
          revision: 1,
          file: './cases/2026-11-02/v1.json',
        },
      }),
    ).toEqual(['2026-11-01', '2026-11-03']);
  });

  it('preserves Unix-day case numbers and allocates the next revision', () => {
    expect(caseNumberForDate('2026-08-15')).toBe(20680);
    expect(
      nextRevision('2026-11-01', [
        '/content/cases/2026-11-01/v1.json',
        '/content/cases/2026-11-01/v3.json',
        '/content/reviews/2026-11-01/v2.md',
      ]),
    ).toBe(4);
  });

  it('rejects invalid dates and day counts', () => {
    expect(() => bufferDates('2026-02-30')).toThrow(/canonical/i);
    expect(() => bufferDates('2026-01-01', 0)).toThrow(/positive/i);
    expect(() => caseNumberForDate('2026-1-01')).toThrow(/canonical/i);
    expect(() =>
      nextRevision('2026-01-01', ['/cases/2026-01-01/not-a-revision.json']),
    ).toThrow(/revision/i);
  });
});
