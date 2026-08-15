# Five-Round Daily Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a five-round daily similarity challenge.

**Architecture:** Use one five-round case and progress contract. Generation emits five distinct rounds over one 25-location board. Similarity tiers and explanations remain precomputed in source-controlled case artifacts, while scoring and progress are deterministic browser-side functions.

**Tech Stack:** TypeScript, TanStack Start, React, AI SDK 7 with OpenRouter, Zod, Vitest, Testing Library, Playwright, pnpm, Turbo, Biome.

---

### Task 1: Version the five-round case contract

**Files:**
- Modify: `packages/case-content/src/schema.ts`
- Modify: `packages/case-content/test/fixtures.ts`
- Modify: `packages/case-content/src/schema.test.ts`

- [ ] **Step 1: Write failing schema tests** for a schema-version-2 fixture with 25 POIs, five unique targets, one clue and image per round, and 25 result entries per round. Assert rejection for duplicate targets, missing candidates, invalid target tiers, and unknown sources.
- [ ] **Step 2: Run `pnpm --filter @whereabouts/case-content test`** and confirm the new fixture is rejected because schema version 2 is unsupported.
- [ ] **Step 3: Add `FiveRoundDailyCase`, `DailyRound`, and `RoundResult` types.** Make `DailyCase` the five-round contract and enforce exact board and relationship coverage.
- [ ] **Step 4: Run package tests and typecheck** with `pnpm --filter @whereabouts/case-content test && pnpm --filter @whereabouts/case-content typecheck` and expect all tests to pass.
- [ ] **Step 5: Commit** with `git commit -m "feat: define five-round case contract"`.

### Task 2: Add deterministic five-round progress and scoring

**Files:**
- Modify: `packages/game-engine/src/progress-schema.ts`
- Modify: `packages/game-engine/src/engine.ts`
- Modify: `packages/game-engine/src/index.ts`
- Modify: `packages/game-engine/src/engine.test.ts`
- Modify: `packages/browser-state/src/storage.ts`
- Modify: `packages/browser-state/src/storage.test.ts`

- [ ] **Step 1: Write failing engine tests** for `createFiveRoundProgress`, `submitRoundGuess`, `getCurrentRound`, `getRoundScore`, and `getTotalScore`. Cover `correct=100`, `hot=75`, `warm=50`, `cold=25`, one immutable guess per round, completion after five guesses, and rejection of previously revealed targets.
- [ ] **Step 2: Run the focused engine tests** and confirm failures for missing exports.
- [ ] **Step 3: Implement progress** as `{ schemaVersion: 2, caseDate, caseRevision, guesses: [{ roundId, poiId, tier, points }], completedAt? }` and the deterministic engine functions.
- [ ] **Step 4: Update browser persistence** to reset data whose case revision or schema is incompatible and retain the same date-scoped storage key.
- [ ] **Step 5: Run engine and browser-state tests/typechecks** and expect all to pass.
- [ ] **Step 6: Commit** with `git commit -m "feat: score five-round similarity guesses"`.

### Task 3: Generate and validate version-2 cases

**Files:**
- Modify: `packages/content-tools/src/prompt.ts`
- Modify: `packages/content-tools/src/prompt.test.ts`
- Modify: `packages/content-tools/src/generate-case.ts`
- Modify: `packages/content-tools/src/generate-case.test.ts`
- Modify: `packages/content-tools/src/validate-case.ts`
- Modify: `packages/content-tools/src/validate-case.test.ts`

- [ ] **Step 1: Write failing prompt and generation tests** requiring five rounds, five distinct target IDs, one concrete clue per target, and complete candidate results with authored explanations.
- [ ] **Step 2: Run the focused content-tools tests** and confirm the existing six-clue output fails the new expectations.
- [ ] **Step 3: Replace the generated draft contract** with `rounds: [{ id, targetPoiId, clue: { text, sourceIds }, results: [{ poiId, tier, text, sourceIds }] }]`. Use the first five deterministically selected POIs as targets, include their sourced images, and shuffle only display order.
- [ ] **Step 4: Rewrite the generation prompt** to request useful one-shot clues, prohibit answer/city/country leakage, define the tier rubric, and require complete per-target coverage. Increase the output-token ceiling to accommodate 120 authored non-target comparisons.
- [ ] **Step 5: Validate five targets, all 25 results per round, source resolution, images, and tier distributions.**
- [ ] **Step 6: Run content-tools tests and validation** and expect all to pass against the five-round fixture.
- [ ] **Step 7: Commit** with `git commit -m "feat: generate five-round daily cases"`.

### Task 4: Build the five-round game screen

**Files:**
- Create: `apps/web/src/features/game/five-round-game-screen.tsx`
- Create: `apps/web/src/features/game/round-briefing.tsx`
- Create: `apps/web/src/features/game/round-reveal.tsx`
- Create: `apps/web/src/features/game/five-round-game-screen.test.tsx`
- Modify: `apps/web/src/features/game/game-screen.tsx`
- Modify: `apps/web/src/features/game/poi-picker.tsx`
- Modify: `apps/web/src/features/game/poi-dossier.tsx`

- [ ] **Step 1: Write failing component tests** that show the target photograph and clue, hide candidate dossiers before confirmation, accept exactly one guess, reveal both dossiers and the relationship, award points, disable revealed targets, and advance through five rounds.
- [ ] **Step 2: Run the focused web test** and confirm failure because the new screen does not exist.
- [ ] **Step 3: Implement `GameScreen`** using the five-round engine and persisted progress.
- [ ] **Step 4: Add a compact picker mode** that exposes only candidate name, city, country, and map position before guessing. Render full candidate and target dossiers only in `RoundReveal`.
- [ ] **Step 5: Run web tests and typecheck** and expect all to pass.
- [ ] **Step 6: Commit** with `git commit -m "feat: add five-round daily gameplay"`.

### Task 5: Add final scoring and spoiler-free sharing

**Files:**
- Modify: `apps/web/src/features/game/share.ts`
- Modify: `apps/web/src/features/game/share.test.ts`
- Create: `apps/web/src/features/game/daily-score-panel.tsx`
- Modify: `apps/web/src/features/game/five-round-game-screen.tsx`

- [ ] **Step 1: Write failing share tests** expecting five tier symbols, `total / 500`, the dated URL, and no target or guessed location names.
- [ ] **Step 2: Run the focused share tests** and confirm the formatter is missing the five-round result.
- [ ] **Step 3: Add the five-round share formatter and score panel.**
- [ ] **Step 4: Run share, component, and typecheck suites** and expect all to pass.
- [ ] **Step 5: Commit** with `git commit -m "feat: share five-round daily scores"`.

### Task 6: Exercise the complete daily journey

**Files:**
- Modify: `apps/web/e2e/helpers.ts`
- Modify: `apps/web/e2e/whereabouts.spec.ts`
- Modify: `.github/workflows/generate-cases.yml`

- [ ] **Step 1: Update E2E fixtures** to derive the selected case schema, five targets, relationship entries, and expected score from the manifest-selected artifact.
- [ ] **Step 2: Add desktop and mobile five-round journeys** covering correct and incorrect guesses, reveal details, restoration, final score, and clipboard output.
- [ ] **Step 3: Ensure generation formatting and validation run before commit** and keep the workflow publishing today's newly generated revision directly to `main`.
- [ ] **Step 4: Run `pnpm quality`** and expect unit tests, typechecks, content validation, and production build to pass.
- [ ] **Step 5: Run `pnpm test:e2e`** with managed Chromium and expect all desktop/mobile scenarios to pass.
- [ ] **Step 6: Commit** with `git commit -m "test: cover five-round daily journey"`.

### Task 7: Generate the first five-round case

**Files:**
- Create: `packages/case-content/content/cases/2026-08-15/v1.json`
- Modify: `packages/case-content/content/manifest.json`

- [ ] **Step 1: Confirm revision 1 is unused** for the current publication date.
- [ ] **Step 2: Run generation** with `pnpm content:generate-range -- --from 2026-08-15 --days 1 --revision 1` using the configured OpenRouter environment.
- [ ] **Step 3: Format and validate the generated artifact**, update the manifest, and run `pnpm content:validate`.
- [ ] **Step 4: Run `pnpm quality` and the focused E2E journey** against the new manifest-selected case.
- [ ] **Step 5: Commit** with `git commit -m "content: publish five-round Whereabouts case 2026-08-15 v1"`.
