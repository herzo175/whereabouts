import { describe, expect, it } from 'vitest';
import {
  compactSourceExtract,
  prohibitedAnswerMarkers,
  redactTargetMarkers,
} from './prompt.js';

const poi = {
  id: 'target-place',
  name: 'Target Place',
  city: 'Target City',
  country: 'Target Country',
  latitude: 0,
  longitude: 0,
  wikipediaTitle: 'Target Place',
};

describe('prompt helpers', () => {
  it('compacts long extracts while preserving their head and tail', () => {
    const compacted = compactSourceExtract(`${'head '.repeat(200)}TAIL`, 80);
    expect(compacted.length).toBeLessThanOrEqual(80);
    expect(compacted).toContain('head');
    expect(compacted).toContain('TAIL');
  });

  it('redacts target markers from model context', () => {
    const redacted = redactTargetMarkers(
      'Target Place is in Target City, Target Country.',
      poi,
    );
    expect(redacted).not.toContain('Target Place');
    expect(redacted).not.toContain('Target City');
    expect(redacted).not.toContain('Target Country');
    expect(redacted).toContain('[redacted]');
  });

  it('returns normalized prohibited answer markers', () => {
    expect(prohibitedAnswerMarkers(poi)).toEqual([
      'targetplace',
      'targetcity',
      'targetcountry',
    ]);
  });
});
