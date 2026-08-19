# Mobile Density and End-of-Game Field Guide

## Goal

Make Whereabouts substantially faster to scan and play on a phone while preserving its archival, Civilization-inspired identity. Remove spoiler-prone image attribution from active gameplay, then restore complete attribution and provide Wikipedia links for every candidate after the game ends.

## Visual direction

The mobile experience should use MapTap-level density without adopting MapTap's visual identity. Whereabouts retains its dark cartographic background, paper clue cards, brass rules, offset shadows, and serif clue typography.

On mobile:

- clue copy uses a 16px serif face with approximately 1.4 line height;
- clue cards use roughly 14px padding and a shorter gap between the label and clue;
- page, header, section, and component gaps shrink by approximately 35–45 percent;
- interactive controls remain at least 44px tall;
- at a 390 by 844 CSS-pixel viewport, the clue and at least 60 percent of the globe fit before the first scroll; and
- horizontal overflow is not permitted.

Tablet and desktop layouts may retain more breathing room, but should also remove spacing that does not improve hierarchy or comprehension.

## Gameplay image attribution

Image attribution, license text, filenames, and outbound image links must not be visibly rendered during active gameplay because they can reveal the answer. Clue images retain descriptive alt text for accessibility.

Attribution remains part of the case data and reappears after completion. The completed view shows attribution and a license link for each of the five answer locations.

## End-of-game field guide

The completed view includes a compact field guide containing all 25 candidate locations. Each entry contains the location name and a direct English Wikipedia link derived from the required `wikipediaTitle` field.

The five answer locations appear first in round order. All remaining candidates follow alphabetically by display name. Duplicate entries are not allowed.

The field guide is collapsed by default at every viewport size using a keyboard-accessible disclosure control. The summary communicates that it contains 25 locations. Expanding it reveals the complete list without navigating away from the result.

Existing factual sources remain a separate section. Wikipedia links supplement the source list rather than replacing it.

## Application boundaries

- A small URL helper converts a `wikipediaTitle` into an encoded `https://en.wikipedia.org/wiki/...` URL.
- A reusable field-guide component owns answer-first ordering, alphabetical ordering of the remainder, disclosure behavior, and link rendering.
- The completed-result component supplies candidate locations and the five ordered answer IDs. Active-game components do not render spoiler-sensitive attribution markup.
- The case schema does not change because every candidate already requires a non-empty `wikipediaTitle`, and image attribution is already retained in content.
- Responsive styling changes remain within the web presentation layer and do not change game progression, scoring, persistence, or content generation.

The implementation supports only the five-round game format. Remaining legacy types, artifacts, or legacy-shaped presentation code are migration remnants and do not define a compatibility requirement for this work.

## Accessibility and resilience

- All active and completed images retain meaningful alt text.
- Disclosure state is exposed through native semantics or equivalent accessible state.
- Wikipedia and license links have descriptive accessible names and visible keyboard focus styles.
- Touch targets remain at least 44 by 44 CSS pixels even as visual spacing becomes denser.
- Long location names and translated titles wrap without horizontal scrolling.
- Missing optional answer images omit attribution cleanly without hiding the Wikipedia entry.

## Verification

Component tests cover:

- generation and encoding of Wikipedia URLs;
- exactly one field-guide entry per candidate;
- answer-first ordering and alphabetical ordering of remaining candidates;
- collapsed disclosure behavior;
- absence of visible attribution during active gameplay;
- presence of answer attribution and license links after completion; and
- graceful behavior when an answer has no optional image.

The focused browser journey covers a narrow mobile viewport and verifies:

- no horizontal page overflow;
- primary controls retain accessible touch-target dimensions;
- the clue and most of the globe occupy the initial viewport at the approved dense scale; and
- the completed field guide can be expanded and contains all candidate Wikipedia links.

Before completion, run the relevant component tests, the focused mobile browser test, typecheck, and the production build.
