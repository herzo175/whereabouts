# Candidate Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce a 10 km minimum between globe candidates and repair every affected published case.

**Architecture:** A pure content-tools spacing module computes haversine distance and close pairs. Board curation and publication validation consume the same module so model output and immutable content obey one rule. Existing content is repaired through new revisions rather than rewriting audit history.

**Tech Stack:** TypeScript, Zod, Vitest, Pydantic-backed structured generation, JSON content artifacts

---

### Task 1: Shared distance rule

**Files:**
- Create: `packages/content-tools/src/candidate-spacing.ts`
- Create: `packages/content-tools/src/candidate-spacing.test.ts`

- [ ] **Step 1: Write failing boundary tests**

Test a point approximately 9.9 km north of an origin and another approximately 10 km north. Assert `candidateSpacingViolations` returns the first pair and not the boundary pair.

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @whereabouts/content-tools exec vitest run src/candidate-spacing.test.ts`

Expected: FAIL because `candidate-spacing.ts` does not exist.

- [ ] **Step 3: Implement the pure distance module**

Export `MIN_CANDIDATE_DISTANCE_KM = 10`, `distanceKm(a, b)`, and `candidateSpacingViolations(candidates)`. Use Earth radius 6,371 km and the haversine formula. Treat only distances strictly below 10 km as violations.

- [ ] **Step 4: Verify the tests pass**

Run: `pnpm --filter @whereabouts/content-tools exec vitest run src/candidate-spacing.test.ts`

Expected: PASS.

### Task 2: Curator and publication enforcement

**Files:**
- Modify: `packages/content-tools/src/themed-case/board-curator.ts`
- Modify: `packages/content-tools/src/themed-case/board-curator.test.ts`
- Modify: `packages/content-tools/src/validate-case.ts`
- Modify: `packages/content-tools/src/validate-case.test.ts`

- [ ] **Step 1: Write failing integration tests**

Add a curator test whose first 20-ID selection contains a sub-10-km pair and whose corrected selection replaces the conflicting ID. Assert the second prompt names the conflict and curation succeeds after two model calls. Add a publication test that moves two fixture POIs within 10 km and expects a spacing issue naming both IDs.

- [ ] **Step 2: Verify the integration tests fail**

Run: `pnpm --filter @whereabouts/content-tools exec vitest run src/themed-case/board-curator.test.ts src/validate-case.test.ts`

Expected: FAIL because neither boundary enforces candidate spacing.

- [ ] **Step 3: Enforce spacing after target placement**

Update the curator prompt to require every selected pair to be at least 10 km apart. Construct the final candidate ID list, including target swaps, before accepting a selection. Feed conflicting ID pairs and distances into the existing correction prompt; throw a clear error after the final invalid attempt.

- [ ] **Step 4: Enforce spacing at publication**

Call `candidateSpacingViolations(dailyCase.pois)` in `validateCaseForPublication` and emit one issue per close pair with path `pois` and both IDs in the message.

- [ ] **Step 5: Verify focused tests pass**

Run: `pnpm --filter @whereabouts/content-tools exec vitest run src/candidate-spacing.test.ts src/themed-case/board-curator.test.ts src/validate-case.test.ts`

Expected: PASS.

### Task 3: Repair immutable published cases

**Files:**
- Create: `packages/case-content/content/cases/<affected-date>/v3.json`
- Create: `packages/case-content/content/reviews/<affected-date>/v3.json`
- Create: `packages/case-content/content/reviews/<affected-date>/v3.md`
- Modify: `packages/case-content/content/manifest.json`
- Modify: `packages/case-content/content/reviews/index.md`

- [ ] **Step 1: Select replacements**

For each affected date, retain all five targets and choose 15 distractors that satisfy the theme and the 10 km pairwise rule. Reuse previously researched candidates when valid; research only the missing replacements.

- [ ] **Step 2: Author complete revisions**

Create revision-3 case and semantic-review artifacts. Every new candidate must have verified coordinates, theme evidence, licensed imagery, five authored result explanations, and a theme verdict. Preserve score-band spread and custom per-candidate points.

- [ ] **Step 3: Regenerate review Markdown and update indexes**

Run `pnpm --filter @whereabouts/content-tools content:review -- --date <affected-date> --revision 3` for each repaired date, then point the manifest and review index to the new revisions.

- [ ] **Step 4: Validate all content**

Run: `PUBLICATION_CEILING=2026-08-26 pnpm content:validate`

Expected: PASS with all manifested boards containing 20 candidates and no spacing issues.

### Task 4: Verification and publication

**Files:**
- Verify all files changed above

- [ ] **Step 1: Run full verification**

Run: `PUBLICATION_CEILING=2026-08-26 pnpm quality`

Expected: 16 successful tasks.

- [ ] **Step 2: Commit and push**

Commit the spacing code/tests and content revisions in focused commits, then push `agent/easier-twenty-candidate-cases` to update pull request #8.

