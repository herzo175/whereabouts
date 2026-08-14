# Whereabouts: Product and Technical Design

Date: 2026-08-14

Status: Approved design awaiting written-spec review

## Summary

Whereabouts is a mobile-first daily geography deduction game. Each day presents one historical or cultural clue and 25 named points of interest on a touch-controlled globe. The player has six attempts to identify the target POI and its city-level destination. A wrong guess unlocks both a universal next clue and a pre-generated explanation of that guess's relationship to the target.

The product is a quick daily ritual first and a detective fantasy second. Its visual language borrows from a modern intelligence briefing without copying Carmen Sandiego or using the visual identity of any other project in this workspace.

## Product goals

- Create a short, fair daily puzzle that fits naturally into group-chat rituals.
- Reward geographic, historical, and cultural reasoning rather than coordinate proximity alone.
- Make each guess feel understood through contextual feedback.
- Give every player the same published case while avoiding live AI calls during play.
- Produce a compact, spoiler-free result that invites friends to play the exact same case.
- Remain fully playable on a phone and usable without the 3D globe.

## Non-goals for the first release

- Accounts, cloud saves, social graphs, comments, or multiplayer rooms
- Global leaderboards or cheat prevention
- Timed play
- Live AI generation during a game
- A database, CMS, or custom editorial interface
- Native mobile applications
- Elaborate serialized storytelling or recurring characters

## Core gameplay

### Daily case

The root route, `/`, resolves to the player's current local calendar date and loads that day's case. A canonical dated route, `/yyyy-mm-dd`, loads a specific published case. Dated routes make historical play and shared challenges stable after the day changes.

A case contains a target city-level destination represented by one target POI, plus 24 distractor POIs distributed around the world. The first universal clue is visible immediately.

### Guess loop

1. Read the current intelligence clue.
2. Spin the globe or search the equivalent POI list.
3. Tap a signal and review the POI dossier in a bottom sheet.
4. Confirm the selected POI as a guess.
5. If correct, end the case as a win.
6. If incorrect, mark the POI eliminated, show its contextual relationship response and temperature, then unlock the next universal clue.
7. End the case as a loss after six incorrect guesses.

The player cannot submit the same POI twice. There is no timer. If midnight passes during play, the loaded case remains active until the player leaves it.

### Clues and contextual responses

Every player receives the same sequence of six universal clues. Clues become progressively more specific while remaining answer-safe until the reveal.

Each of the 24 distractors has one pre-generated contextual response. The response explains why that guess was plausible or how it relates to the target through history, culture, institutions, people, movements, events, or geography. It then distinguishes the guess from the target without naming the target city, country, or POI.

This hybrid preserves a comparable daily puzzle while making different guess paths feel intelligently acknowledged.

### Relationship temperature

Each distractor has a precomputed relationship tier:

- `cold`: little meaningful overlap with the target
- `warm`: a broad shared era, theme, region, or cultural connection
- `hot`: a strong historical or cultural relationship

The tier is primarily semantic. Geographic proximity may inform the authored assessment but does not determine the result. A correct guess is represented as `solved` in the share trail.

### Win, loss, and reveal

After either outcome, the game reveals:

- The target POI and city-level destination
- A concise explanation connecting the universal clues to the answer
- The Wikipedia source list used to create the case
- The player's spoiler-free result and share action

The answer and source details are not displayed before the case ends.

## Sharing and archives

The result is deliberately compact. It contains the brand, case number, result, relationship-temperature trail, and canonical dated link:

```text
WHEREABOUTS 042  4/6
🔵 🟡 🟠 🟢
/2026-08-14
```

The production share prepends the configured canonical origin to the dated path. The symbols reveal performance without naming guesses or exposing clues. The app uses the Web Share API when available and falls back to copying the same text to the clipboard.

Today remains the default ritual. A secondary archive control exposes published historical dates without competing with the current case. Historical progress is stored separately for each date.

## Experience design

### Information hierarchy

The primary mobile screen is a vertical intelligence briefing:

1. Compact case header with case number and six-attempt indicator
2. Current clue card
3. Large interactive globe with 25 signals
4. Searchable POI-list fallback
5. Bottom-sheet dossier for a selected POI
6. Contextual response after a submitted wrong guess

The globe is the signature interaction, not decoration. Drag rotates it, pinch zooms it, and tapping a signal selects a POI. A signal selection never commits a guess immediately; confirmation happens from the dossier.

### Visual direction

Whereabouts resembles a contemporary intelligence operations room: near-black blue-green surfaces, restrained brass highlights, archival imagery, monospaced operational labels, and an editorial face for readable clue text. It should feel cinematic, precise, investigative, and calm. It should not resemble military simulation software, parchment adventure UI, or the Arcana aesthetic.

Motion is restrained to globe inertia, subtle signal pulses, bottom-sheet movement, and a brief intelligence-received transition. Reduced-motion mode disables inertia and decorative animation. Desktop retains the same hierarchy in a wider composition rather than becoming a separate dashboard.

### Accessibility and mobile behavior

- Signals receive touch targets larger than their visible dots.
- Every globe action has an equivalent searchable-list action.
- Keyboard users can search, select, confirm, and review guesses without the globe.
- Color is supplemented by text labels inside the game; the chat share remains intentionally compact.
- Focus moves predictably into and out of the POI bottom sheet.
- The clue and feedback text meet readable contrast and sizing requirements.
- Reduced-motion preferences are respected.
- The interface remains usable at common narrow-phone widths and safe-area insets.

## Architecture

The initial implementation uses TanStack Start and repository-native case files. It has four principal boundaries.

### `case-content`

Owns the `DailyCase` schema, dated case artifacts, publication manifest, and server-side loader. Published artifacts live at paths such as `content/cases/2026-08-14/v1.json`. A small manifest maps a date to its current published revision and case number.

The repository must remain private if it contains future cases. Future content is never included in publicly served manifests or application bundles before its publication date.

### `game-engine`

Owns framework-independent rules:

- Applying a guess
- Preventing duplicate guesses
- Unlocking clues
- Determining win and loss
- Building the temperature trail
- Producing share text
- Validating and migrating saved progress

The engine takes a case definition and current state and returns the next state. It has no UI, storage, network, model, or framework dependency.

### `browser-state`

Owns a versioned local-storage envelope keyed by case date. State includes the case revision, ordered guessed POI IDs, outcome, and completion timestamp. Derived values such as the visible clue count and share trail are recomputed by the game engine instead of duplicated in storage.

If stored data is invalid, the adapter attempts a known migration and otherwise resets only the affected dated case. There are no accounts or server-side game mutations.

### `game-ui`

Owns the briefing, globe, POI list, dossier bottom sheet, contextual feedback, reveal, archive, and share controls. The globe implementation sits behind a narrow adapter so the rest of the UI does not depend on a specific rendering library.

The complete playable case is available to the browser after loading. A determined player can inspect the payload to find the answer. That is an accepted trade-off for browser-owned state, offline rule evaluation, and a resilient casual game.

## Routing and date behavior

- `/` resolves the browser's local date, then loads that published case.
- `/yyyy-mm-dd` is the canonical case route and share target.
- Unsupported path formats return the normal not-found experience.
- A syntactically valid date with no published case shows `Briefing unavailable` and does not substitute another date.
- Historical routes use the same game engine and UI as today.
- A case loaded before local midnight remains pinned for that session.

## Daily case model

A case contains at least the following logical fields:

- Schema version, publication date, revision, and case number
- Target destination name and target POI ID
- Exactly 25 POIs with stable IDs, names, city/country labels, and coordinates
- Exactly six ordered universal clues
- One contextual response and `cold | warm | hot` tier for every distractor
- Reveal title, summary, and clue explanation
- Wikipedia source records with page title, canonical URL, and retrieval metadata

Runtime types and generation validation use the same schema. The schema is versioned so already-published cases remain readable when the format evolves.

## Content generation and publication

Content generation is a separate TypeScript command that uses the AI SDK as a publishing dependency.

```text
Wikipedia source material
        ↓
AI SDK structured generation
        ↓
DailyCase schema validation
        ↓
deterministic quality and spoiler checks
        ↓
dated, revisioned JSON artifact
        ↓
reviewed commit and deployment
```

The first release uses a curated set of 30–60 reviewed cases. The minimum viable automation is a scheduled CI job that generates upcoming cases, opens a pull request, and lets normal deployment publish approved artifacts. The job may generate several days ahead in the private repository, but only published dates appear in the served manifest.

After the editorial process is trusted, passing generation PRs can auto-merge. Moving case JSON to object storage later does not require changes to the game engine or UI because the loader boundary and schema remain stable.

### Publication checks

A case cannot publish unless deterministic validation confirms:

- Exactly 25 unique POIs and one included target
- Valid, non-duplicated coordinates
- Exactly six clues ordered from difficult to explicit
- No target POI, city, or country name in pre-reveal text
- One contextual response and relationship tier per distractor
- Valid source metadata for every factual section
- Valid date, case number, revision, schema version, and stable IDs
- No recently repeated target or excessive distractor repetition
- No public manifest entry before the case's publication date

Human review initially covers factual accuracy, source support, clue fairness, geographic and cultural variety, relationship tiers, tone, and accidental ambiguity. Model output cannot waive deterministic checks.

## Failure handling

- Missing or invalid dated case: show `Briefing unavailable`; do not silently substitute content.
- Corrupt or outdated browser state: migrate known versions or reset only that date.
- WebGL or globe initialization failure: activate the searchable list and preserve complete gameplay.
- Archival image failure: show a neutral placeholder while retaining the text dossier.
- Web Share API failure: copy the result and dated URL to the clipboard.
- Date rollover during play: retain the loaded date until navigation.
- Content correction: retain the original revision artifact, publish a new revision, and keep saved state associated with the revision it used.

## Testing strategy

### Unit tests

The game engine receives exhaustive tests for clue progression, duplicate-guess prevention, correct guesses, the six-miss loss condition, temperature trails, state restoration, migrations, and share output.

### Case and generator tests

Every committed case is loaded against the production schema and publication checks. Additional scans cover answer leakage, broken source records, duplicate coordinates, invalid dates, recent target repetition, and manifest publication rules.

Normal test runs use recorded structured model responses and do not spend model tokens. A separate opt-in integration suite exercises the live AI SDK and Wikipedia retrieval pipeline.

### Component tests

Component-level tests cover globe/list selection parity, dossier confirmation, contextual feedback, archive navigation, result rendering, sharing fallbacks, focus handling, and reduced motion.

### Playwright end-to-end tests

Playwright covers:

- A complete win
- A complete six-attempt loss
- Reload and local-state restoration
- Duplicate-guess prevention
- Canonical historical routes
- Root-route local-date resolution
- Corrupt-storage recovery
- Share and clipboard behavior
- A forced WebGL failure with list-only completion
- Mobile viewport and touch-oriented interaction

Tests use fixed case fixtures and a controlled clock so results do not depend on the real date or generated content.

## Performance and launch criteria

The initial clue and controls should render without waiting for archival imagery. The globe code may be deferred until after the briefing shell appears, and dossier images load lazily. Case JSON loads once with the briefing; guesses do not require progressive API calls.

Launch requires:

- A reviewed set of at least 30 cases
- Passing unit, schema, component, and Playwright suites
- Successful play at common narrow mobile widths
- Keyboard-complete and list-only gameplay
- Reduced-motion support
- Verified behavior on representative mobile Safari and Chromium browsers
- A documented generation and editorial checklist

## Approved decisions

- Public name: Whereabouts
- Six attempts with a real loss state
- City-level destination represented by one of 25 POIs
- Universal progressive clues plus guess-specific contextual responses
- Relationship-first temperatures rather than distance feedback
- Touch-controlled globe with a searchable-list fallback
- Mobile-first intelligence-agency visual direction with no timer
- Browser-owned game state and no accounts
- `/` for today and `/yyyy-mm-dd` for canonical historical cases
- Minimal colored-circle share trail with a dated link
- TanStack Start application and AI SDK publishing command
- Repository-native, revisioned case JSON in a private repository
- Curated initial case set followed by scheduled generation pull requests
- Playwright for end-to-end coverage
