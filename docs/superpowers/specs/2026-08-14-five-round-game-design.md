# Whereabouts Five-Round Daily Game

## Goal

Replace the six-attempt single-location investigation with a faster five-round daily game. Each round gives the player a photograph and one useful historical clue, asks for one committed guess, and scores that guess by its authored historical or cultural similarity to the answer. The design should make every guess informative, avoid unwinnable states, and produce a concise daily result worth sharing.

## Daily content

Each published case contains one shared board of exactly 25 sourced locations and exactly five rounds. The five target locations are distinct members of the board. The board remains unchanged through the entire game so players become more familiar with it instead of repeatedly scanning new candidate sets.

Each location includes its name, city, country, coordinates, short dossier, image with attribution, and source references. Each round includes:

- a target location ID;
- a target photograph whose visible metadata does not reveal the answer;
- one concrete, historically grounded clue;
- one precomputed result for every location on the board, containing a tier and a short relationship explanation.

The target receives the `correct` tier. Every other result is `hot`, `warm`, or `cold`. As a quality target, each round should normally contain about three hot alternatives, six to eight warm alternatives, and the remaining candidates as cold. Validation should reject missing relationships, duplicate targets, invalid images, source leakage, and malformed tier distributions.

## Player loop

At the beginning of each round, the interface shows the round number, target photograph, clue, globe, and searchable list of all 25 locations. Before guessing, location controls expose only name, city, country, and map position. Candidate images and full dossiers remain concealed so the player cannot match the clue photograph directly to a candidate thumbnail.

The player selects a location, reviews the lightweight selection, and confirms one guess. The guess cannot be changed. The game then reveals:

- the correct location;
- the guessed location's dossier;
- the correct location's dossier;
- the authored relationship explanation;
- the round's temperature and points.

The player advances explicitly to the next round. Previously revealed answers remain visible as declassified locations but are disabled because no answer repeats within the daily game. This gently narrows the board from 25 to 21 possible answers over five rounds without introducing a new candidate set. After round five, the game shows the complete score and share action.

## Scoring

Scoring uses fixed tiers rather than an AI-generated percentage:

| Result | Points |
| --- | ---: |
| Correct | 100 |
| Hot | 75 |
| Warm | 50 |
| Cold | 25 |

The maximum daily score is 500. A completed result records five guesses, five tiers, five point values, the total, and a completion timestamp. Browser state remains local and is scoped to both publication date and case revision.

## Sharing

The share payload contains no location names or answer spoilers. Its compact form is:

```text
WHEREABOUTS
🟢 🟠 🟡 🔵 🟢
375 / 500
https://whereabouts.game/2026-08-14
```

The exact colors must remain distinguishable through accessible text labels in the application; the clipboard output may use colored symbols as shorthand.

## Content generation

The generation pipeline selects a geographically and culturally varied board, then chooses five distinct targets that produce varied rounds. For each target, the model receives sourced knowledge for all board locations and generates one clue plus 24 grounded relationship reports. The target result is deterministic and not generated as a relationship.

The clue should offer multiple usable facts without naming the location or encoding an answer through image metadata. Because every round permits only one guess, the clue should be substantially more concrete than the previous escalating-clue format. Quality validation should ensure that the clue is consistent with the target, supported by cited material, and does not directly contain the answer, city, country, or an equivalent unique identifier.

All generated content is formatted, validated, committed, and published as a revisioned daily artifact. Runtime gameplay makes no model calls.

## Application boundaries

The case-content package owns the five-round schema and parsing. Content-tools owns generation and publication validation. The game engine owns round progression, immutable guesses, tier scoring, totals, and share tokens. Browser-state owns revision-scoped persistence. The web application owns presentation, selection, reveal, and navigation between rounds.

Existing historical case artifacts remain immutable. The new schema version can coexist with the old format while the loader and game screen migrate; only manifest-selected cases need to be playable.

## Failure handling

The generator must fail before publication when a round lacks a relationship for any candidate, contains duplicate targets, leaks an answer, lacks image attribution, or violates the scoring schema. The browser treats corrupt or mismatched saved state as a new game. Missing images use an explicit unavailable state without blocking a round. A failed clipboard operation leaves the result visible and offers manually selectable share text.

## Verification

Unit tests cover schema parsing, relationship completeness, target uniqueness, scoring, progression, persistence, and spoiler-free sharing. Component tests cover one-guess locking, dossier reveal, round advancement, and completion. Playwright covers a full five-round desktop journey, a mobile journey, saved-game restoration, incorrect and correct scoring, and clipboard sharing derived from the currently published fixture rather than hard-coded landmark names.
