# Themed Daily Cases

## Goal

Every Whereabouts case has a visible daily theme. All 25 candidates must satisfy a narrow, predeclared interpretation of that theme, and the five rounds continue to score guesses by factual similarity to each target within the themed board.

The content workflow chooses themes autonomously, researches each case from live sources, generates and critiques the case, and preserves the final immutable artifact in a pull request. The runtime remains deterministic and makes no model calls.

## Product behavior

The game presents the theme title and a short introduction before round one. The theme remains visible throughout the five-round game. The shared board still contains exactly 25 candidates, the targets remain five distinct board members, and each round still awards 100, 75, 50, or 25 points for `correct`, `hot`, `warm`, or `cold` results.

Theme membership is a hard eligibility rule. It is not part of the relationship-tier scale. For a theme such as "Railway Hotels," every candidate must be a railway hotel, a former railway hotel, or satisfy another equally explicit inclusion criterion established before candidate discovery. An iconic location with a weak railway association is ineligible even if it would make an easy distractor. A `cold` candidate is less similar to the current target but remains an unquestionable member of the daily theme.

Each candidate has a cited explanation of its connection to the theme. That explanation is hidden with the dossier before guessing and becomes available during reveals.

## Architecture boundary

This change replaces the corpus-driven content pipeline rather than the working game.

The following boundaries remain:

- `packages/game-engine` owns immutable guesses, reveal progression, scoring, and totals.
- `packages/browser-state` owns revision-scoped local progress.
- `packages/case-content` owns case parsing, immutable artifacts, manifest loading, and archive discovery.
- `apps/web` owns the globe, candidate selection, theme briefing, reveals, scores, sharing, and navigation.
- `packages/content-tools` owns research orchestration, generation, validation, review packets, and publication preparation.

The persistent POI and knowledge corpus is removed. `packages/content-tools/catalog/pois.json`, `packages/content-tools/catalog/knowledge.json`, corpus bootstrap, catalog expansion, deterministic catalog selection, and cached-knowledge lookup no longer participate in generation.

Published cases remain the only durable content knowledge in the repository. The workflow may read recent published cases to avoid repeating themes and targets, but it must not treat them as a reusable candidate corpus. Research notes and intermediate model outputs live in a temporary run workspace or CI artifact and are not bundled into the application.

## Case contract

New cases use schema version 3:

```ts
type DailyTheme = {
  title: string;
  introduction: string;
  inclusionCriteria: string;
};

type ThemeConnection = {
  text: string;
  sourceIds: string[];
};

type ThemedPoi = Poi & {
  themeConnection: ThemeConnection;
};

type ThemedDailyCase = {
  schemaVersion: 3;
  publicationDate: string;
  revision: number;
  caseNumber: number;
  theme: DailyTheme;
  pois: ThemedPoi[];
  rounds: DailyRound[];
  sources: Source[];
};
```

`title` and `introduction` are player-facing. `inclusionCriteria` is the precise editorial rule used by research, curation, semantic review, and human review packets. Each `themeConnection` cites one or more entries in the case source list.

The manifest shape remains unchanged. The loader temporarily supports both version 2 and version 3 artifacts so existing archive links continue to work. All new generation emits version 3. Browser progress does not change because it already binds saved state to publication date and revision.

## Staged research and generation

The existing AI SDK and OpenRouter integration remain. A new orchestrator coordinates focused, typed stages rather than asking one model call to construct the entire case.

### 1. Theme planning

The planner returns a title, player introduction, narrow inclusion criteria, explicit exclusions, and candidate-search instructions. It consults the previous 90 published theme titles and criteria to avoid repetition. A proposed theme is rejected when it is too broad, too ambiguous, materially similar to any theme in that window, or unlikely to yield at least 25 verifiable, geographically locatable, image-backed candidates.

### 2. Candidate research

The researcher builds a pool of approximately 35 to 50 candidates using live Wikipedia, Wikidata, and Wikimedia data. Each candidate includes a canonical identity, city, country, coordinates, source URLs, and a factual claim showing why it satisfies the theme criteria. Proposed identities are resolved through the source adapters rather than accepted solely from model output.

### 3. Evidence hydration

The workflow fetches current text extracts, coordinates, and image attribution and license metadata. A candidate is removed if its identity cannot be resolved, its theme claim is unsupported, its coordinates are missing or duplicate another entry, or it lacks a usable attributed image. The fetched evidence is scoped to the generation run and is not appended to a persistent corpus.

### 4. Board curation

The curator selects exactly 25 candidates with strong theme fit, distinct locations, enough factual differentiation to support five rounds, and geographic variety where the theme permits it. It selects five distinct targets and excludes targets used within the previous 30 published cases, preserving the existing target-reuse rule.

Every selected candidate must pass the same theme threshold. The curator may not create easier choices by including thematic outsiders or candidates connected only through generic facts.

### 5. Case writing

For each target, the writer produces one useful clue and a result for every board candidate. Each result includes a similarity score and a factual relationship grounded in both the target and guessed candidate sources. The existing deterministic rank conversion maps the 24 non-target scores into four `hot`, eight `warm`, and twelve `cold` results; only the target becomes `correct`.

The target is a board member before clue generation begins. The writer receives the target identity and target evidence explicitly rather than inferring the intended answer from free-form prose.

### 6. Critique and repair

An independent critic reviews:

- all 25 candidates against the exact inclusion and exclusion criteria;
- every theme connection against its cited evidence;
- each clue for usefulness, leakage, and factual support from the declared target;
- clue-answer alignment, including whether the clue resolves to the declared board target rather than an off-board place or another candidate;
- all candidate-target relationships for factual grounding and sensible relative ranking;
- images, attribution, source coverage, and board-level coherence.

The critic returns structured defects. Candidate defects return to research or curation; clue and relationship defects regenerate only the affected round. The workflow permits at most two repair cycles after the initial draft. Exhausted retries fail the run without publishing.

### 7. Deterministic publication preparation

The publisher parses the final case through the version 3 schema, runs all collection and publication validators, writes an immutable revision, updates the manifest, and generates a Markdown review packet. No repository content is changed until the complete requested batch has passed.

## Publication workflow

Generated content is saved through pull requests instead of being pushed directly to `main`.

The migration includes a bootstrap command that generates 10 consecutive Eastern-calendar cases, beginning with the requested launch date, into a temporary workspace. The first content pull request contains all 10 immutable case artifacts, the corresponding manifest entries, and their review packets. It is created only after every case passes. This makes the new mechanic playable immediately after the bootstrap PR merges.

After launch, a scheduled workflow ensures that today and the following nine Eastern-calendar dates are present in the manifest. It generates every missing date in that window as one atomic batch. Generated pull requests enable auto-merge only after required schema, content, quality, and application checks pass. The merged PR, review packet, critic summary, and source metadata form the audit trail. Maintainers can disable auto-merge, close a suspect PR, withdraw a manifest entry, or publish a higher immutable revision to correct a case.

The workflow fails closed. A failed run preserves diagnostics as a CI artifact but does not update the manifest, open a partial pull request, or expose an incomplete date.

## Validation invariants

Deterministic validation enforces:

- exactly 25 unique candidates and five unique targets;
- every `targetPoiId` identifies exactly one candidate on the board;
- every round result covers every board candidate exactly once;
- the only `correct` result is the declared target;
- every theme connection, clue, and relationship references known sources;
- every candidate includes valid coordinates and an attributed, licensed image;
- coordinate uniqueness at the existing precision;
- prohibited answer markers do not appear in pre-reveal text;
- the required `hot`, `warm`, and `cold` distribution;
- target and theme repetition stay within their rolling-history limits;
- every candidate has a successful semantic theme-fit judgment;
- every clue has a successful semantic clue-answer alignment judgment.

Semantic clue-answer validation receives the clue, the declared target, all board identities, and grounded source evidence. It must explicitly identify the declared `targetPoiId` as the supported answer. A null result, an off-board answer, or a different board member fails publication. This complements the structural target-membership check and prevents a syntactically valid round whose prose describes a location absent from the board.

## Failure handling

Failures return to the narrowest responsible stage:

- A weak or undersized theme returns to theme planning.
- An unsupported candidate returns to candidate research.
- A source, coordinate, or image failure replaces that candidate.
- A board-coherence failure returns to curation.
- A clue leak, clue-answer mismatch, or unsupported relationship regenerates that round.
- A schema, collection, or publication failure blocks repository writes.

Stage outputs use explicit schemas and are saved in the temporary run workspace. Successful research does not need to be repeated when a later writing stage is retried. Logs identify the theme, stage, case date, attempt, and structured rejection reason without including secrets.

## Review experience

Each generated review packet includes:

- the theme title, introduction, inclusion criteria, and exclusions;
- all 25 candidates and their cited theme connections;
- the five declared targets;
- every clue and its clue-answer verification result;
- every tiered relationship and its citations;
- image attribution and license links;
- critic findings, repairs, and final disposition;
- deterministic validation results.

These packets are generated artifacts in the content pull request so a maintainer can audit a case without reconstructing transient agent state.

## Verification

Unit coverage includes:

- version 3 parsing and version 2 archive compatibility;
- theme metadata and theme-connection source resolution;
- typed contracts for every orchestration stage;
- theme novelty and target-history checks;
- strict theme-fit rejection, including a railway-hotel fixture containing Hoover Dam;
- replacement of unsupported candidates;
- target membership and result completeness;
- a regression fixture where a clue describes a location that is not a board candidate;
- a regression fixture where a clue describes a different candidate than its declared target;
- clue leakage, source grounding, image licensing, coordinate uniqueness, and tier distribution;
- retry limits, selective repair, atomic batch publication, revision allocation, and buffer calculation.

Component tests cover the pre-round theme briefing and revealed theme connections. Existing game-engine, browser-state, scoring, sharing, route, and five-round journey tests remain. End-to-end coverage completes a version 3 themed case on desktop and mobile and restores revision-scoped progress.

Workflow logic is extracted into testable scripts. Tests cover the 10-case bootstrap, scheduled buffer replenishment, manifest changes, review-packet inclusion, pull-request preparation, required-check gating, and the absence of partial publication after a failed case.

## Rollout

The migration proceeds in independently verifiable increments:

1. Add version 3 case parsing and temporary version 2 read compatibility.
2. Add the theme briefing and theme connections to the web experience.
3. Introduce typed research, curation, writing, critique, and repair stages behind injected dependencies.
4. Replace corpus-based range generation with live staged generation.
5. Add strict semantic and deterministic publication validation.
6. Replace direct-to-main generation with content pull requests and auto-merge gating.
7. Generate and validate the initial 10 cases.
8. Merge the code migration, then merge the bootstrap content pull request and enable scheduled replenishment.
9. Remove obsolete corpus files, commands, tests, and documentation once the new path is proven by the bootstrap run.

The production runtime continues to serve only manifest-published immutable artifacts throughout the rollout.
