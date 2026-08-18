export const MIN_CANDIDATE_DISTANCE_KM = 10;

type LocatedCandidate = {
  id: string;
  latitude: number;
  longitude: number;
};

export type CandidateSpacingViolation = {
  firstId: string;
  secondId: string;
  distanceKm: number;
};

const EARTH_RADIUS_KM = 6_371;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceKm(
  first: LocatedCandidate,
  second: LocatedCandidate,
): number {
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const latitudeDelta = secondLatitude - firstLatitude;
  const longitudeDelta = radians(second.longitude - first.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function candidateSpacingViolations(
  candidates: LocatedCandidate[],
): CandidateSpacingViolation[] {
  const violations: CandidateSpacingViolation[] = [];
  for (let firstIndex = 0; firstIndex < candidates.length; firstIndex += 1) {
    const first = candidates[firstIndex];
    if (!first) continue;
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < candidates.length;
      secondIndex += 1
    ) {
      const second = candidates[secondIndex];
      if (!second) continue;
      const separation = distanceKm(first, second);
      if (separation < MIN_CANDIDATE_DISTANCE_KM)
        violations.push({
          firstId: first.id,
          secondId: second.id,
          distanceKm: separation,
        });
    }
  }
  return violations;
}
