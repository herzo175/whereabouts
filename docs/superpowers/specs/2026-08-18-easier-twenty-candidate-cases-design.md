# Easier Twenty-Candidate Cases Design

## Goal

Make daily cases easier to reason through without making them obvious. Each themed board will contain 20 candidates instead of 25, and every clue must be solvable from recognizable qualitative facts rather than requiring exact-year, measurement, or count recall.

## Player Experience

- A daily case still has one theme and five rounds.
- The same 20 candidates remain available across all five rounds.
- Exact dates, dimensions, and counts may appear as supporting detail, but they cannot be the decisive distinction between the target and another candidate.
- Every clue must include at least one useful non-numeric discriminator, such as architecture, setting, purpose, historical event, cultural association, or geography.
- The score remains an authored integer from 0 through 100, with the existing hot, warm, and cold UI bands.
- No progressive hints, penalties, or new controls are introduced.

## Content Model

The case schema and generation contracts will require exactly 20 POIs and exactly 20 results in every round. All five target POIs must be members of the board, and each result set must contain every board POI exactly once.

The score-distribution requirements remain unchanged: every round must contain incorrect candidates in the hot, warm, and cold bands and at least eight distinct incorrect scores. The smaller board therefore reduces scanning effort without flattening the scoring signal.

## Generation Workflow

Candidate research will continue gathering a pool larger than the published board. The curator will select the strongest 20 candidates and five distinct targets, prioritizing candidates that create meaningful qualitative distinctions within the theme.

The case writer will receive two additional clue rules:

1. Every clue must contain at least one recognizable non-numeric discriminator.
2. The target must remain uniquely resolvable if exact years, counts, and measurements are removed or generalized.

The model may still use a date or measurement for texture or confirmation. A clue fails when changing a year by roughly a decade, rounding a measurement, or omitting a count makes another board candidate equally plausible.

The critic will explicitly assess this counterfactual for each clue. A clue that depends on exact numeric recall will produce a clue-only repair request, reusing the existing board and bounded repair loop. Candidate or theme repairs remain unchanged.

## Existing Case Migration

Each of the ten existing cases will receive a manually curated revision 2 rather than rewriting its revision 1 audit artifact. Five non-target candidates will be removed from each board using these priorities:

1. Never remove a round target.
2. Prefer removing candidates that contribute the least useful qualitative discrimination across all five rounds.
3. Preserve geographic variety where it helps the theme.
4. Preserve hot, warm, and cold coverage and at least eight distinct incorrect scores in every round.

Every removed POI will also be removed from all five result arrays. The manifest will point each date to revision 2, and matching revision 2 review artifacts will document the retained board. Existing saved progress for revision 1 will reset through the current case-revision mismatch behavior.

## Validation and Failure Behavior

Deterministic validation will reject cases that do not contain exactly 20 unique POIs, do not provide exactly 20 results per round, omit a target from the board or its result set, or fail the existing score-distribution rules.

Semantic numeric-dependency evaluation remains the critic's responsibility because a deterministic count of numeric tokens would reject legitimate clues and would not establish whether a number is decisive. Missing, malformed, or failed critic judgments block publication and enter the existing bounded repair path.

## Testing

- Schema tests accept exactly 20 candidates and reject 19 or 21.
- Generator and curator tests require 20 selected IDs and 20 results per round.
- Existing tests continue proving every clue answer is a candidate and every target receives 100 points.
- Critic tests reject a clue whose identity depends on an exact year and accept a clue where a date only supports a recognizable qualitative discriminator.
- Validation tests retain all score-band and distinct-score guarantees on a 20-candidate board.
- All ten migrated cases pass whole-corpus validation.
- Web, engine, storage, sharing, and Playwright fixtures use 20-candidate cases and preserve existing five-round behavior.

## Non-Goals

- Adding progressive hints or score penalties.
- Changing the five-round format or score-band thresholds.
- Reducing the upstream research pool to 20 candidates.
- Banning all dates, measurements, or counts from clue prose.
