# Case Buffer Workflow Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every daily case-buffer schedule execute and make candidate structured output valid for the configured Azure-backed model.

**Architecture:** Use one unconditional UTC schedule because buffer maintenance does not require DST-perfect midnight execution. Keep the application's optional Wikipedia metadata contract unchanged, but expose a required nullable field in the stricter model-facing schema and normalize `null` at that boundary.

**Tech Stack:** GitHub Actions YAML, TypeScript, Zod 4 JSON Schema, Vitest, pnpm/Turborepo

---

### Task 1: Make scheduled workflow execution unconditional

**Files:**
- Modify: `.github/workflows/generate-cases.yml`
- Test: `packages/content-tools/src/generate-workflow.test.ts`

- [ ] **Step 1: Write the failing workflow regression test**

Add a test that expects `cron: '0 5 * * *'`, rejects the dual `0 4,5` cron and `Check for midnight Eastern`, and rejects references to `steps.schedule.outputs.run`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter @whereabouts/content-tools test -- src/generate-workflow.test.ts`

Expected: FAIL because the current workflow contains the dual cron, guard step, and conditional steps.

- [ ] **Step 3: Implement the minimal workflow fix**

Change the scheduled trigger to `0 5 * * *`, delete the midnight guard, and remove each `if: github.event_name == 'workflow_dispatch' || steps.schedule.outputs.run == 'true'` line so both scheduled and manual invocations execute the same step chain.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter @whereabouts/content-tools test -- src/generate-workflow.test.ts`

Expected: PASS.

### Task 2: Make candidate output strict-schema compatible

**Files:**
- Modify: `packages/content-tools/src/themed-case/candidate-researcher.ts`
- Test: `packages/content-tools/src/themed-case/candidate-researcher.test.ts`

- [ ] **Step 1: Write the failing model-schema regression test**

In the existing model callback, inspect `z.toJSONSchema(schema)` and assert that `wikipediaTitle` occurs in the candidate object's `required` array and accepts both string and null. Add a behavior test whose model returns 40 candidates with `wikipediaTitle: null` and assert that all survive without internal Wikipedia metadata.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter @whereabouts/content-tools test -- src/themed-case/candidate-researcher.test.ts`

Expected: FAIL because `wikipediaTitle` is optional rather than required-nullable and null candidates are discarded.

- [ ] **Step 3: Implement the model-boundary normalization**

Change the model schema field to `z.string().min(2).nullable()`, update the prompt to require `null` for unknown titles, and omit the property when its generated value is null before parsing with `researchedCandidateSchema`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter @whereabouts/content-tools test -- src/themed-case/candidate-researcher.test.ts`

Expected: PASS.

### Task 3: Verify the complete fix

**Files:**
- Verify all modified files

- [ ] **Step 1: Run the content-tools test suite**

Run: `pnpm --filter @whereabouts/content-tools test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run the content-tools typecheck**

Run: `pnpm --filter @whereabouts/content-tools typecheck`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 3: Run repository quality verification**

Run: `pnpm quality`

Expected: formatting/lint checks, typechecks, tests, content validation, and builds all pass.

- [ ] **Step 4: Review the final diff and workflow syntax**

Run: `git diff --check && git diff -- .github/workflows/generate-cases.yml packages/content-tools/src/generate-workflow.test.ts packages/content-tools/src/themed-case/candidate-researcher.ts packages/content-tools/src/themed-case/candidate-researcher.test.ts`

Expected: no whitespace errors; the diff contains only the approved workflow, schema, prompt, normalization, and regression-test changes.
