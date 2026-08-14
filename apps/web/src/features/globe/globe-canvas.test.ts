import { describe, expect, it } from 'vitest';

import { POI_BEAM_RADIUS, POI_HIT_RADIUS } from './globe-canvas';

describe('globe point hit targets', () => {
  it('provides at least a 48px diameter touch target', () => {
    expect(POI_HIT_RADIUS * 2).toBeGreaterThanOrEqual(48);
  });

  it('keeps beam footprints narrow enough to read as beams', () => {
    expect(POI_BEAM_RADIUS * 2).toBeGreaterThanOrEqual(0.4);
    expect(POI_BEAM_RADIUS * 2).toBeLessThanOrEqual(0.6);
  });
});
