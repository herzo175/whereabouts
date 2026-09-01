# Generated Content Approval Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove manual approval from generated-content pull requests and automatically deploy each merged generated case.

**Architecture:** Do not trigger redundant PR Quality checks when every changed file is generated content. After the generator's existing validation and merge, explicitly dispatch the reusable Fly deployment workflow for the validated merge SHA.

**Tech Stack:** GitHub Actions YAML, GitHub CLI, TypeScript, Vitest, pnpm

---

### Task 1: Encode the desired workflow contract

**Files:**
- Modify: `packages/content-tools/src/generate-workflow.test.ts`

- [ ] **Step 1: Add failing regression assertions**

Load `.github/workflows/quality.yml` and `.github/workflows/deploy-fly.yml` alongside the generator workflow. Assert that generated-content-only PRs are path-ignored, the generator has `actions: write`, the publication step resolves and validates `MERGE_SHA`, and it dispatches `deploy-fly.yml` with that SHA. Assert that `workflow_dispatch` declares the matching optional `ref` input.

- [ ] **Step 2: Verify the regression test fails**

Run: `pnpm exec vitest run src/generate-workflow.test.ts`

Expected: FAIL because none of the approval-removal or explicit-deployment wiring exists yet.

### Task 2: Remove the approval path and dispatch deployment

**Files:**
- Modify: `.github/workflows/quality.yml`
- Modify: `.github/workflows/generate-cases.yml`
- Modify: `.github/workflows/deploy-fly.yml`

- [ ] **Step 1: Exclude generated content from PR Quality**

Add `paths-ignore: ['packages/case-content/content/**']` beneath the Quality workflow's `pull_request` trigger while preserving its `push` trigger.

- [ ] **Step 2: Add exact-ref manual deployment input**

Declare an optional string `ref` input beneath `workflow_dispatch` in `deploy-fly.yml`. Preserve `ref: ${{ inputs.ref || github.sha }}` for both verification and deployment checkouts.

- [ ] **Step 3: Dispatch deployment after generated PR merge**

Grant `actions: write` in `generate-cases.yml`. After `gh pr merge`, query `.mergeCommit.oid`, reject any value that is not a 40-character lowercase hexadecimal SHA, and run `gh workflow run deploy-fly.yml --ref main -f ref="$MERGE_SHA"`.

- [ ] **Step 4: Verify the focused regression passes**

Run: `pnpm exec vitest run src/generate-workflow.test.ts`

Expected: all workflow regression tests pass.

### Task 3: Verify and publish

**Files:**
- Verify all changed files

- [ ] **Step 1: Parse all changed workflow YAML**

Run: `ruby -e 'require "yaml"; ARGV.each { |path| YAML.parse_file(path) }; puts "workflow YAML parsed"' .github/workflows/quality.yml .github/workflows/generate-cases.yml .github/workflows/deploy-fly.yml`

Expected: `workflow YAML parsed`.

- [ ] **Step 2: Run repository quality**

Run: `pnpm quality`

Expected: all checks, tests, typechecks, content validation, and builds pass.

- [ ] **Step 3: Review and publish**

Run: `git diff --check` and inspect the workflow diff. Commit only the approved workflow, test, spec, and plan changes; push a feature branch; merge after GitHub Quality passes.
