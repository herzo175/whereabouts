# Easier Twenty-Candidate Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish 20-candidate daily boards whose clues remain solvable without exact numeric recall, including revision-2 migrations of all ten existing cases.

**Architecture:** Export one board-size constant from case-content and apply it at the schema, generation, review, and fixture boundaries while leaving the larger research pool unchanged. Extend clue verdicts with an explicit numeric-independence judgment so the existing critic and clue-only repair loop enforce qualitative solvability. Migrate published content as immutable revision-2 artifacts selected by a deterministic curation audit, then regenerate reviews and the manifest.

**Tech Stack:** TypeScript, Zod, Vitest, pnpm/Turborepo, JSON content artifacts, Playwright.

---

### Task 1: Make 20 the published board-size contract

**Files:**
- Modify: `packages/case-content/src/schema.ts`
- Modify: `packages/case-content/src/schema.test.ts`
- Modify: `packages/case-content/test/fixtures.ts`
- Modify: `packages/content-tools/src/themed-case/contracts.ts`
- Modify: `packages/content-tools/src/themed-case/fixtures.ts`
- Modify: `packages/content-tools/src/themed-case/board-curator.ts`
- Modify: `packages/content-tools/src/themed-case/board-curator.test.ts`
- Modify: `packages/content-tools/src/themed-case/case-writer.ts`
- Modify: `packages/content-tools/src/themed-case/case-writer.test.ts`
- Modify: `packages/content-tools/src/themed-case/orchestrator.ts`
- Modify: `packages/content-tools/src/generation-review.ts`
- Modify: `packages/content-tools/src/validate-case.test.ts`
- Modify: `packages/content-tools/src/generate-case.test.ts`

- [ ] **Step 1: Write failing board-size tests**

Change fixture expectations to 20 and add schema cases proving 19 and 21 candidates fail. Keep candidate research pools at a minimum of 25; only `CuratedBoard`, `CaseDraft`, published case POIs, theme verdicts, and per-round results become 20.

- [ ] **Step 2: Run focused tests and verify the 20-candidate assertions fail**

Run: `pnpm --filter @whereabouts/case-content test && pnpm --filter @whereabouts/content-tools test -- src/themed-case/board-curator.test.ts src/themed-case/case-writer.test.ts src/generate-case.test.ts`

Expected: failures report the current 25-candidate lengths.

- [ ] **Step 3: Implement the shared board-size contract**

Export `DAILY_BOARD_SIZE = 20` from `packages/case-content/src/schema.ts`. Replace published-board magic lengths and prompt prose with that constant. Do not change `candidateProposalPoolSchema`, `candidatePoolSchema`, `candidate-researcher.ts`, or their minimum-25 tests because upstream research must retain surplus candidates.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run the Task 1 Step 2 command.

Expected: all selected tests pass.

- [ ] **Step 5: Commit the board-size contract**

```bash
git add packages/case-content packages/content-tools/src
git commit -m "feat(content): reduce daily boards to twenty candidates"
```

### Task 2: Enforce clues that do not depend on exact numbers

**Files:**
- Modify: `packages/content-tools/src/generation-review.ts`
- Modify: `packages/content-tools/src/generation-review.test.ts`
- Modify: `packages/content-tools/src/themed-case/case-critic.ts`
- Modify: `packages/content-tools/src/themed-case/case-critic.test.ts`
- Modify: `packages/content-tools/src/themed-case/case-writer.ts`
- Modify: `packages/content-tools/src/themed-case/case-writer.test.ts`
- Modify: all review fixtures that construct `clueVerdicts`

- [ ] **Step 1: Write failing numeric-independence tests**

Extend fixture clue verdicts with `resolvableWithoutExactNumbers: true`. Add one critic test where an otherwise passing verdict sets the field false and assert a clue-only repair for that round. Add one validation test proving a false value blocks publication.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `pnpm --filter @whereabouts/content-tools test -- src/generation-review.test.ts src/themed-case/case-critic.test.ts src/themed-case/case-writer.test.ts`

Expected: the new verdict field is absent from the schema and no repair is requested.

- [ ] **Step 3: Implement the critic contract and prompts**

Add required boolean `resolvableWithoutExactNumbers` to each clue verdict. Treat false as a failed clue in `validateGenerationReview` and as a clue-only repair in `critiqueCase`. Update writer, repair, and critic prompts to require a recognizable non-numeric discriminator and ask whether the same target remains uniquely resolvable after exact years, counts, and measurements are removed or generalized.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run the Task 2 Step 2 command.

Expected: all selected tests pass, including false-verdict repair coverage.

- [ ] **Step 5: Commit numeric-independent clue enforcement**

```bash
git add packages/content-tools/src
git commit -m "feat(content): reject clues dependent on exact numbers"
```

### Task 3: Migrate the ten published boards to revision 2

**Files:**
- Create: `packages/case-content/content/cases/2026-08-17/v2.json` through `2026-08-26/v2.json`
- Create: `packages/case-content/content/reviews/2026-08-17/v2.json` through `2026-08-26/v2.json`
- Create: `packages/case-content/content/reviews/2026-08-17/v2.md` through `2026-08-26/v2.md`
- Modify: `packages/case-content/content/manifest.json`
- Modify: `packages/case-content/content/reviews/index.md`

- [ ] **Step 1: Audit candidate usefulness for every board**

For each date, retain all five targets. Rank non-target candidates by their best and average authored score across the five rounds, theme distinctiveness, and geographic contribution. Select five low-value candidates for removal while checking that every remaining round still has hot, warm, and cold incorrect candidates and at least eight distinct incorrect scores.

- [ ] **Step 2: Create revision-2 case and review artifacts**

Copy revision 1 to revision 2, set `revision` to 2, remove the same five POIs from the board and every result array, and keep all targets. Create matching review JSON with 20 theme verdicts and `resolvableWithoutExactNumbers: true` only after manually checking each existing clue against the approved counterfactual. Regenerate review Markdown from the updated case and review JSON.

- [ ] **Step 3: Point the manifest to revision 2**

Set every manifest entry to `revision: 2` and `file: ./cases/<date>/v2.json`. Regenerate the review index from the revision-2 packets. Leave revision-1 artifacts untouched for audit history.

- [ ] **Step 4: Validate the complete migrated corpus**

Run: `PUBLICATION_CEILING=2026-08-26 pnpm content:validate`

Expected: exit 0 with all ten manifest cases resolving to valid revision-2 artifacts.

- [ ] **Step 5: Commit migrated cases**

```bash
git add packages/case-content/content
git commit -m "content: migrate daily boards to twenty candidates"
```

### Task 4: Update remaining gameplay fixtures and verify end to end

**Files:**
- Modify: `apps/web/e2e/helpers.ts`
- Modify: any remaining test fixture found by `rg -n "25|exactly 25|length\\(25\\)" packages apps`

- [ ] **Step 1: Update remaining test fixtures to the shared 20-candidate contract**

Replace only published-board assumptions. Preserve unrelated numeric values such as CSS sizes, zoom levels, dates, and the minimum-25 upstream research pool.

- [ ] **Step 2: Run stale-assumption and diff checks**

Run: `rg -n "25-location|25 candidate|25 candidates|exactly 25|length\\(25\\)" packages apps --glob '!**/content/cases/**' --glob '!**/content/reviews/**'`

Expected: no published-board assumptions remain; research-pool references may remain where explicitly intended.

- [ ] **Step 3: Run the full repository quality gate**

Run: `PUBLICATION_CEILING=2026-08-26 pnpm quality`

Expected: formatting, typechecking, 186-or-more tests, content validation, and builds pass.

- [ ] **Step 4: Run browser journeys**

Run: `pnpm test:e2e`

Expected: all applicable desktop and mobile journeys pass; project-specific skips remain intentional.

- [ ] **Step 5: Commit any final fixture adjustments**

```bash
git add apps packages
git commit -m "test: cover twenty-candidate daily cases"
```

### Task 5: Publish for review

**Files:**
- Modify: none

- [ ] **Step 1: Confirm the final branch scope**

Run: `git status -sb && git diff --check && git log --oneline origin/main..HEAD`

Expected: clean worktree, no whitespace errors, and only the approved design plus implementation commits.

- [ ] **Step 2: Push the branch**

Run: `git push -u origin agent/easier-twenty-candidate-cases`

- [ ] **Step 3: Open a draft PR against main**

The PR body must summarize the 20-candidate contract, qualitative clue gate, revision-2 migration, saved-progress reset, and exact verification commands.

- [ ] **Step 4: Monitor GitHub Actions**

Run: `gh pr checks <number> --watch --interval 10`

Expected: Quality completes successfully.
