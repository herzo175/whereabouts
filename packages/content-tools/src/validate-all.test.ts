import { describe, expect, it } from 'vitest';
import { shouldRejectUnreferencedArtifact } from './validate-all.js';

describe('shouldRejectUnreferencedArtifact', () => {
  const manifestDates = new Set(['2026-08-14']);

  it('retains superseded revisions for a manifest-published date', () => {
    expect(
      shouldRejectUnreferencedArtifact(
        '2026-08-14',
        '2026-08-14',
        manifestDates,
      ),
    ).toBe(false);
  });

  it('rejects an unmanifested artifact on or before the publication ceiling', () => {
    expect(
      shouldRejectUnreferencedArtifact(
        '2026-08-13',
        '2026-08-14',
        manifestDates,
      ),
    ).toBe(true);
  });

  it('allows future artifacts awaiting publication', () => {
    expect(
      shouldRejectUnreferencedArtifact(
        '2026-08-15',
        '2026-08-14',
        manifestDates,
      ),
    ).toBe(false);
  });
});
