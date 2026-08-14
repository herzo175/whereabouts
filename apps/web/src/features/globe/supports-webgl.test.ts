import { describe, expect, it } from 'vitest';

import { supportsWebGl } from './supports-webgl';

describe('supportsWebGl', () => {
  it('returns false when canvas contexts are unavailable', () => {
    const documentValue = {
      createElement: () => ({ getContext: () => null }),
    } as unknown as Document;

    expect(supportsWebGl(documentValue)).toBe(false);
  });

  it('returns false when a context probe throws', () => {
    const documentValue = {
      createElement: () => ({
        getContext: () => {
          throw new Error('WebGL denied');
        },
      }),
    } as unknown as Document;

    expect(supportsWebGl(documentValue)).toBe(false);
  });
});
