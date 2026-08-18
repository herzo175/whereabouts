# Candidate Spacing Design

## Goal

Keep globe candidates visually distinct and individually clickable by requiring every pair of published candidates to be at least 10 km apart.

## Generation

The content tools will own a shared `MIN_CANDIDATE_DISTANCE_KM` constant and haversine-distance check. The curator prompt will request geographically distributed candidates. After the model selects candidates and all targets have been placed on the board, deterministic curation will reject any pair under 10 km. The existing correction attempt will identify the conflicting candidate IDs and distances so the model can replace them without restarting research.

## Publication safety

Publication validation will apply the same shared check to every case. A pair under 10 km will produce a validation issue naming both candidate IDs and the measured distance. A distance of exactly 10 km is valid.

## Existing content

The seven affected dates—2026-08-17, 2026-08-18, 2026-08-19, 2026-08-21, 2026-08-24, 2026-08-25, and 2026-08-26—will receive new immutable revisions. Existing targets will remain unchanged. Valid candidates will be retained where possible; clustered distractors will be replaced with qualifying, sourced candidates farther than 10 km from every other board location. Result scores and explanations, theme verdicts, review packets, and the manifest will be updated together. The three already-valid dates remain on revision 2.

## Testing

Tests will cover haversine boundary behavior, curator correction after a clustered selection, and publication rejection. Content validation will prove every manifested board has 20 candidates, includes every clue answer, and satisfies spacing and semantic review requirements.
