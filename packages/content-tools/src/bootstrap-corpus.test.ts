import { describe, expect, it } from 'vitest';

import { classifyRegion, parseWikidataPoint } from './bootstrap-corpus.js';

describe('corpus bootstrap helpers', () => {
  it('parses Wikidata point coordinates in longitude-latitude order', () => {
    expect(parseWikidataPoint('Point(23.726111111 37.971666666)')).toEqual({
      latitude: 37.971666666,
      longitude: 23.726111111,
    });
  });

  it('classifies uncatalogued landmarks consistently', () => {
    expect(classifyRegion({ latitude: 35, longitude: 139 })).toBe('East Asia');
    expect(classifyRegion({ latitude: 13, longitude: 100 })).toBe(
      'Southeast Asia',
    );
    expect(classifyRegion({ latitude: 19, longitude: -99 })).toBe(
      'Central America',
    );
  });
});
