# Mobile Density and End-of-Game Field Guide

## Goal

Make Whereabouts substantially faster to scan and play on a phone while preserving its archival, Civilization-inspired identity. Remove spoiler-prone image attribution from active gameplay, then restore complete attribution and provide available Wikipedia links after the game ends. Remove the archive interface; dated URLs remain the sole way to open previous games.

## Visual direction

The mobile experience should use MapTap-level density without adopting MapTap's visual identity. Whereabouts retains its dark cartographic background, paper clue cards, brass rules, offset shadows, and serif clue typography.

On mobile:

- clue copy uses a 16px serif face with approximately 1.4 line height;
- clue cards use roughly 14px padding and a shorter gap between the label and clue;
- page, header, section, and component gaps shrink by approximately 35–45 percent;
- interactive controls remain at least 44px tall;
- at a 390 by 844 CSS-pixel viewport, the clue and at least 60 percent of the globe fit before the first scroll; and
- horizontal overflow is not permitted.

Mobile alignment should vary with the job of the content instead of defaulting
every section to the same left edge. Presentation-oriented blocks—the game
masthead and progress dots, theme label and title, round-reveal headline, and
final score headline—are centered below the small-screen breakpoint. Dense or
sequential content—clues, authored relationships, dossiers, result navigation,
field-guide entries, and long-form copy—remains left-aligned. At the existing
`sm` breakpoint, the presentation blocks return to their current left-aligned
desktop composition.

Tablet and desktop layouts may retain more breathing room, but should also remove spacing that does not improve hierarchy or comprehension.

## Gameplay image attribution

Image attribution, license text, filenames, and outbound image links must not be visibly rendered during active gameplay because they can reveal the answer. Clue images retain descriptive alt text for accessibility.

Attribution remains part of the case data and reappears after completion. The completed view shows attribution and a license link for each of the five answer locations.

## End-of-game field guide

The completed view includes a compact field guide containing every candidate location in the current case. Each entry is a keyboard-accessible, minimum-44-pixel dossier trigger containing the location name and geographic identity. Selecting an entry opens a modal dossier with the location image when available, its blurb, and a direct English Wikipedia link when the candidate has a non-empty `wikipediaTitle`. Candidates without Wikipedia metadata retain a complete dossier without a link.

The five answer locations appear first in round order. All remaining candidates follow alphabetically by display name. Duplicate entries are not allowed.

The field guide is collapsed by default at every viewport size using a keyboard-accessible disclosure control. The full-width summary row contains the field-guide label and dynamic candidate count, explicit `Show locations`/`Hide locations` state copy, and a chevron that rotates when open. The icon is decorative because native disclosure semantics already expose state to assistive technology. Expanding the guide reveals the complete list without navigating away from the result. Opening a dossier does not navigate away or expand the list item inline; closing it restores focus to the selected entry.

Existing factual sources remain a separate section. Wikipedia links supplement the source list rather than replacing it.

## Application boundaries

- A small URL helper converts a present, non-empty `wikipediaTitle` into an encoded `https://en.wikipedia.org/wiki/...` URL. It returns no link when the field is absent.
- A reusable field-guide component owns answer-first ordering, alphabetical ordering of the remainder, disclosure behavior, selection state, and dossier presentation.
- The existing POI dossier supports a completed-game full-detail mode. Full detail renders an answer's round image when supplied, otherwise the candidate image, followed by the blurb, optional Wikipedia link, and image attribution/license. The identity-only gameplay mode continues to omit all spoiler-sensitive detail.
- The completed-result component supplies candidate locations and the five ordered answer IDs. Active-game components do not render spoiler-sensitive attribution markup.
- The case schema and generation contracts make `wikipediaTitle` optional. Publication does not require or verify a Wikipedia article.
- Responsive styling changes remain within the web presentation layer and do not change game progression, scoring, persistence, or content generation.

## Archive removal

The archive drawer, archive buttons, archive-open state, published-case props, and UI-specific archive tests are removed. No replacement navigation is added. Existing dated routes continue to load published cases directly, so a previous game remains accessible when its URL is known or shared.

Server APIs used only to populate the archive are removed when they have no remaining callers. The manifest continues to resolve dated routes and publication data; this cleanup does not delete case artifacts or change route semantics.

The implementation supports only the five-round game format. Remaining legacy types, artifacts, or legacy-shaped presentation code are migration remnants and do not define a compatibility requirement for this work.

## Accessibility and resilience

- All active and completed images retain meaningful alt text.
- Disclosure state is exposed through native semantics or equivalent accessible state.
- The entire field-guide summary row is a minimum-44-pixel touch target with a
  visible open/closed affordance that does not rely on color alone.
- Field-guide entries, available Wikipedia links, and all license links have descriptive accessible names and visible keyboard focus styles.
- Touch targets remain at least 44 by 44 CSS pixels even as visual spacing becomes denser.
- Long location names and translated titles wrap without horizontal scrolling.
- Missing optional answer images omit attribution cleanly without hiding an available Wikipedia link.

## Verification

Component tests cover:

- generation and encoding of Wikipedia URLs when metadata is present;
- omission of the Wikipedia link when metadata is absent while preserving the dossier;
- exactly one field-guide entry per candidate;
- answer-first ordering and alphabetical ordering of remaining candidates;
- collapsed disclosure behavior;
- explicit open/closed field-guide copy and chevron state;
- selective mobile centering with desktop left-alignment preserved;
- opening a full dossier from every entry and restoring focus when it closes;
- image, blurb, optional Wikipedia link, and photo-credit rendering in the completed dossier;
- graceful full-dossier behavior when the optional image or blurb is absent;
- absence of visible attribution during active gameplay;
- presence of answer attribution and license links after completion; and
- graceful behavior when an answer has no optional image.

The focused browser journey covers a narrow mobile viewport and verifies:

- no horizontal page overflow;
- primary controls retain accessible touch-target dimensions;
- the clue and most of the globe occupy the initial viewport at the approved dense scale;
- the completed field guide can be expanded, contains every candidate, and links only candidates with Wikipedia metadata;
- no archive control appears on available or unavailable game screens; and
- dated routes continue to load directly.

Before completion, run the relevant component tests, the focused mobile browser test, typecheck, and the production build.
