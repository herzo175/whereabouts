import { describe, expect, it } from 'vitest';
import {
  candidateSpacingViolations,
  distanceKm,
  MIN_CANDIDATE_DISTANCE_KM,
} from './candidate-spacing.js';

const origin = { id: 'origin', latitude: 0, longitude: 0 };
const latitudeForDistance = (kilometers: number) =>
  (kilometers / 6_371) * (180 / Math.PI);

describe('candidate spacing', () => {
  it('computes great-circle distance in kilometers', () => {
    expect(
      distanceKm(origin, {
        id: 'north',
        latitude: latitudeForDistance(25),
        longitude: 0,
      }),
    ).toBeCloseTo(25, 8);
  });

  it('rejects pairs below 10 km', () => {
    const near = {
      id: 'near',
      latitude: latitudeForDistance(9.9),
      longitude: 0,
    };

    expect(candidateSpacingViolations([origin, near])).toEqual([
      expect.objectContaining({ firstId: 'origin', secondId: 'near' }),
    ]);
  });

  it('accepts pairs at the 10 km boundary', () => {
    const boundary = {
      id: 'boundary',
      latitude: latitudeForDistance(MIN_CANDIDATE_DISTANCE_KM),
      longitude: 0,
    };

    expect(candidateSpacingViolations([origin, boundary])).toEqual([]);
  });
});
