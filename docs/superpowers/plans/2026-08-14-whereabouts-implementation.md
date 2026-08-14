# Whereabouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS: Use superpowers:subagent-driven-development and superpowers:dispatching-parallel-agents. Execute the foundation gates and parallel waves in this plan; do not execute tasks in simple numeric order. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first daily geography deduction game with a tappable 3D globe, browser-owned progress, dated cases, spoiler-free sharing, and a source-backed AI-assisted publishing pipeline.

**Architecture:** A pnpm workspace managed by Turborepo contains one TanStack Start app and four private, source-exporting packages: case content/schema, the pure game engine, browser state, and offline content tooling. The app serves revisioned case JSON through a server-function boundary and renders the Tailwind/shadcn briefing, globe/list selector, feedback, archive, and reveal. Only the content-tools package can access Wikimedia or the AI SDK; no application package depends on it.

**Tech Stack:** TypeScript, React 19, TanStack Start, pnpm workspaces, Turborepo, Biome, Tailwind CSS v4, shadcn/ui with Radix primitives, Zod, react-globe.gl/Three.js, Vitest, Testing Library, Playwright, AI SDK Core, and `@ai-sdk/openai`.

---

## Execution note

The coordinator executes each foundation gate in a dedicated Git worktree created from `main`, then creates one isolated worktree per parallel workstream from the named green checkpoint. Subagents edit only their assigned paths and return a commit hash, changed-file list, tests run, and unresolved assumptions. Only the coordinator may change root configuration, install dependencies, update `pnpm-lock.yaml`, cherry-pick workstream commits, resolve integration issues, or start the next wave.

## File map

### Application foundation

- `package.json` — private workspace scripts and pinned package manager
- `pnpm-workspace.yaml` — `apps/*` and `packages/*`, shared lockfile, cycle protection
- `turbo.json` — cached build/test/typecheck graph and uncached external/content tasks
- `biome.json` — repository-wide formatting, linting, and import organization
- `tsconfig.base.json` — shared strict TypeScript options for internal packages
- `apps/web/package.json` — TanStack Start application dependencies and scripts
- `apps/web/vite.config.ts` — TanStack Start and Tailwind build configuration
- `apps/web/vitest.config.ts` — jsdom test configuration
- `apps/web/playwright.config.ts` — desktop/mobile browser projects and local web server
- `apps/web/src/styles.css` — Tailwind import, intelligence-console theme tokens, global motion rules
- `apps/web/src/routes/__root.tsx` — document shell, metadata, and global error/not-found surfaces
- `apps/web/src/routes/index.tsx` — browser-local-date resolution and redirect
- `apps/web/src/routes/$date.tsx` — canonical daily/historical case route

### Case content

- `packages/case-content/package.json` — browser-safe schema export plus server-only loader export
- `packages/case-content/src/schema.ts` — Zod schemas and inferred case types
- `packages/case-content/src/loader.server.ts` — server-only manifest and revision loader
- `apps/web/src/features/cases/case-functions.ts` — validated TanStack server function
- `packages/case-content/content/manifest.json` — published date-to-revision mapping
- `packages/case-content/content/cases/YYYY-MM-DD/vN.json` — immutable case artifacts
- `packages/content-tools/catalog/pois.json` — curated POI catalog used by generation
- `packages/case-content/test/fixtures.ts` — complete deterministic case factory for tests

### Game domain and persistence

- `packages/game-engine/package.json` — pure rule package; depends only on case-content
- `packages/game-engine/src/engine.ts` — pure transition and derived-state functions
- `packages/game-engine/src/engine.test.ts` — game rule tests
- `packages/game-engine/src/progress-schema.ts` — persisted progress schema
- `packages/browser-state/package.json` — browser persistence/date package
- `packages/browser-state/src/storage.ts` — safe local-storage adapter and revision handling
- `packages/browser-state/src/storage.test.ts` — persistence, corruption, and revision tests
- `packages/browser-state/src/date.ts` — strict route-date and local-date helpers
- `packages/browser-state/src/date.test.ts` — date edge cases

### Player interface

- `apps/web/src/features/game/game-screen.tsx` — coordinates case data, browser progress, and modal state
- `apps/web/src/features/game/case-header.tsx` — brand, case number, attempt indicator, archive action
- `apps/web/src/features/game/clue-card.tsx` — current universal clue
- `apps/web/src/features/game/poi-picker.tsx` — globe/list mode and POI selection contract
- `apps/web/src/features/game/poi-search.tsx` — accessible searchable POI list
- `apps/web/src/features/game/poi-dossier.tsx` — shadcn Drawer confirmation surface
- `apps/web/src/features/game/feedback-panel.tsx` — wrong-guess relationship explanation
- `apps/web/src/features/game/result-panel.tsx` — win/loss reveal, citations, and sharing
- `apps/web/src/features/game/share.ts` — deterministic share text and Web Share/clipboard fallback
- `apps/web/src/features/game/share.test.ts` — spoiler-free output tests
- `apps/web/src/features/globe/globe-picker.tsx` — lazy client-only boundary and fallback
- `apps/web/src/features/globe/globe-canvas.client.tsx` — react-globe.gl adapter
- `apps/web/src/features/globe/webgl.ts` — WebGL capability probe
- `apps/web/src/features/globe/webgl.test.ts` — capability tests

### Content pipeline

- `packages/content-tools/package.json` — the only package with AI SDK and Wikimedia tooling
- `packages/content-tools/src/wikipedia.ts` — MediaWiki Action API client with attribution and user-agent policy
- `packages/content-tools/src/prompt.ts` — stable source-grounded generation prompt
- `packages/content-tools/src/generate-case.ts` — AI SDK structured generation command
- `packages/content-tools/src/generate-range.ts` — scheduled batch command
- `packages/content-tools/src/validate-case.ts` — deterministic publication validation
- `packages/content-tools/src/validate-all.ts` — manifest-wide checks and recent-repeat policy
- `packages/content-tools/src/review-case.ts` — prints a human-review packet
- `packages/content-tools/src/review-range.ts` — writes review packets for a date range
- `packages/content-tools/src/*.test.ts` — recorded-response and validation tests
- `.env.example` — publishing-only environment variables
- `docs/content-publishing.md` — generation, review, correction, and publication runbook
- `.github/workflows/quality.yml` — application and content checks
- `.github/workflows/generate-cases.yml` — scheduled generation pull request
- `.github/workflows/publish-case.yml` — publishes an already-reviewed case on its release date

### End-to-end coverage

- `apps/web/e2e/whereabouts.spec.ts` — win, loss, resume, routes, share, and list-only flows
- `apps/web/e2e/helpers.ts` — deterministic date, local-storage, and WebGL controls

## Parallel execution contract

### Package dependency rules

```text
@whereabouts/web ──────────┬─> @whereabouts/case-content
                           ├─> @whereabouts/game-engine
                           └─> @whereabouts/browser-state

@whereabouts/browser-state ──> @whereabouts/game-engine ──> @whereabouts/case-content

@whereabouts/content-tools ──> @whereabouts/case-content
```

Use `workspace:*` for every internal dependency. Never use cross-package relative imports. `@whereabouts/case-content` exposes browser-safe schema/types from its root export and the artifact loader only from `@whereabouts/case-content/server`. Nothing may depend on `@whereabouts/content-tools`.

### Foundation gates

These gates are sequential and coordinator-owned.

1. **F0 — Task 1:** Create the pnpm/Turbo/Biome workspace, scaffold `apps/web`, install every dependency needed by Tasks 1–14, generate shadcn components, and commit the lockfile. No later subagent may install packages.
2. **F1 — Task 2:** Establish the case schema, testing fixture, first complete case, manifest, and package exports. Every Wave 1 worktree branches from the exact F1 integration commit.

F1 checkpoint:

```bash
pnpm check:ci
pnpm --filter @whereabouts/case-content test
pnpm typecheck
git diff --check
```

### Wave 1 — Independent domain foundations

Dispatch four subagents concurrently from F1:

| Workstream | Scope | Exclusive ownership |
|---|---|---|
| Engine | Task 3 | `packages/game-engine/**` |
| Browser date utilities | Task 4 date half | `packages/browser-state/src/date*` and an index exporting only date APIs |
| Case loader | Task 5 except `case-functions.ts` | `packages/case-content/src/loader.server*` and server export changes |
| Publication validation | Task 12 | `packages/content-tools/src/validate-*`, validation tests, `packages/content-tools/catalog/**` |

Merge engine, browser date utilities, loader, then validation. Coordinator checkpoint:

```bash
pnpm check:ci
pnpm test
pnpm typecheck
pnpm content:validate
git diff --check
```

### Wave 2 — Independent player surfaces and generation

Dispatch six subagents concurrently from the Wave 1 integration commit:

| Workstream | Scope | Exclusive ownership |
|---|---|---|
| Browser persistence | Task 4 storage half | `packages/browser-state/src/storage*` and expansion of its index |
| Briefing UI | Task 7 | `apps/web/src/styles.css`, `case-header*`, `clue-card*`, `briefing-layout*` |
| POI selection | Task 8 | `poi-search*`, `poi-dossier*`, `poi-picker*` |
| Globe | Task 9 except its `poi-picker.tsx` integration | `apps/web/src/features/globe/**` |
| Share/archive core | Task 11 primitives only | `share*`, `archive-drawer*`; do not edit `case-header.tsx` or `result-panel.tsx` |
| Generation pipeline | Task 13 | all remaining `packages/content-tools/**` and `.env.example` |

The coordinator integrates the globe adapter into `poi-picker.tsx` after merging the POI and globe commits. Any genuine missing dependency is added by the coordinator in one lockfile commit after the wave. Checkpoint:

```bash
pnpm check:ci
pnpm test
pnpm typecheck
pnpm content:validate
pnpm build
git diff --check
```

### Gate I1 — Gameplay composition

Task 10 is sequential because it integrates the engine, browser state, briefing, POI picker, globe, feedback, persistence, and reveal. One integration owner exclusively controls `feedback-panel.tsx`, `result-panel.tsx`, `game-screen.tsx`, `game-screen.test.tsx`, and `briefing-layout.tsx`.

```bash
pnpm --filter @whereabouts/web test -- src/features/game/game-screen.test.tsx
pnpm quality
git diff --check
```

### Wave 3 — Routing, result wiring, and operations drafts

Dispatch three subagents concurrently from I1:

| Workstream | Scope | Exclusive ownership |
|---|---|---|
| Routing | Task 6 | `apps/web/src/routes/**`, `briefing-unavailable.tsx`, `route-state.test.tsx`, `case-functions.ts` |
| Sharing integration | Task 11 wiring | modifications only to `result-panel.tsx` and `case-header.tsx` |
| Operations drafts | Task 15 Steps 1–5 | `.github/workflows/**`, `docs/content-publishing.md`, `README.md` |

Task 6 is deliberately executed after Task 10 so its canonical route can import an existing `GameScreen` and pass type checking. Merge routing, sharing integration, then operations drafts.

### Gate I2 — Playwright and operational integration

Execute Task 14 after Wave 3. The E2E owner exclusively controls `apps/web/playwright.config.ts` and `apps/web/e2e/**` and may not edit manifests, workspace configuration, or the lockfile. After Playwright is green, the coordinator completes Task 15 verification.

```bash
pnpm --filter @whereabouts/web exec playwright install chromium
pnpm test:e2e
pnpm quality
git diff --check
```

### Gate L1 — Launch verification

Task 16 is sequential. Its owner may repair files implicated by measured accessibility or performance failures, so it cannot run beside another writer. Generate 29 cases beginning 2026-08-15 because Task 2 already owns the 2026-08-14 case:

```bash
pnpm content:generate-range -- --from 2026-08-15 --days 29
pnpm content:validate
pnpm content:review-range -- --from 2026-08-14 --days 30 --out artifacts/review
pnpm quality
pnpm test:e2e
git diff --check
git status --short
```

### Subagent handoff template

Every workstream prompt must name its checkpoint commit, exclusive file set, required tests, and forbidden shared files. Every result must report:

```text
Commit: report the actual commit SHA
Changed files: list every changed path
Verification: list each command and its observed outcome
Assumptions: write “none” or enumerate each unresolved assumption
```

Subagents never merge, rebase, broadly format the repository, modify another workstream's files, or change root/package manifests. The coordinator cherry-picks in the stated order and makes integration fixes in separate coordinator-only commits.

## Task 1: Scaffold the pnpm, Turborepo, Biome, TanStack Start, and shadcn foundation

**Files:**
- Create/modify: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `biome.json`
- Create: `tsconfig.base.json`
- Create: `packages/case-content/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/game-engine/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/browser-state/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/content-tools/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create/modify through shadcn: `apps/web/**`
- Modify: `.gitignore`

- [ ] **Step 1: Initialize the private root package and pin pnpm**

```bash
pnpm init
corepack enable
corepack use pnpm@latest
```

Expected: root `package.json` exists and contains an exact `packageManager` value. Set `private` to `true` in Step 2; `pnpm-lock.yaml` will become the workspace's only lockfile.

- [ ] **Step 2: Create the pnpm workspace contract**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"

sharedWorkspaceLockfile: true
disallowWorkspaceCycles: true
failIfNoMatch: true
```

Create the root `package.json` scripts while retaining the exact tool versions and package-manager pin written by pnpm:

```json
{
  "name": "whereabouts",
  "private": true,
  "scripts": {
    "dev": "turbo run dev --filter=@whereabouts/web",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:watch": "turbo run test:watch",
    "test:e2e": "turbo run test:e2e --filter=@whereabouts/web",
    "content:generate": "turbo run content:generate --filter=@whereabouts/content-tools",
    "content:generate-range": "turbo run content:generate-range --filter=@whereabouts/content-tools",
    "content:validate": "turbo run content:validate --filter=@whereabouts/content-tools",
    "content:review": "turbo run content:review --filter=@whereabouts/content-tools",
    "content:review-range": "turbo run content:review-range --filter=@whereabouts/content-tools",
    "format": "biome format --write .",
    "lint": "biome lint .",
    "check": "biome check .",
    "check:fix": "biome check --write .",
    "check:ci": "biome ci .",
    "quality": "turbo run check:ci typecheck test content:validate build"
  }
}
```

- [ ] **Step 3: Define the Turbo task graph**

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "//#check:ci": { "outputs": [] },
    "dev": {
      "cache": false,
      "persistent": true,
      "env": ["VITE_CANONICAL_ORIGIN"]
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".output/**"],
      "env": ["VITE_CANONICAL_ORIGIN"]
    },
    "typecheck": { "dependsOn": ["^typecheck"], "outputs": [] },
    "test": { "outputs": [] },
    "test:watch": { "cache": false, "persistent": true, "interactive": true },
    "test:e2e": { "cache": false },
    "content:validate": {
      "cache": false,
      "env": ["PUBLICATION_CEILING"]
    },
    "content:generate": {
      "cache": false,
      "passThroughEnv": ["OPENAI_API_KEY", "WIKIMEDIA_USER_AGENT", "WHEREABOUTS_MODEL"]
    },
    "content:generate-range": {
      "cache": false,
      "passThroughEnv": ["OPENAI_API_KEY", "WIKIMEDIA_USER_AGENT", "WHEREABOUTS_MODEL"]
    },
    "content:review": { "cache": false },
    "content:review-range": { "cache": false }
  }
}
```

Keep generation, review, E2E, and time-dependent publication validation uncached. After the first successful app build, remove either `dist/**` or `.output/**` if the selected TanStack deployment adapter does not emit it.

- [ ] **Step 4: Configure Biome once at the workspace root**

Create `biome.json`:

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main"
  },
  "files": {
    "ignoreUnknown": true,
    "includes": [
      "**",
      "!**/src/routeTree.gen.ts",
      "!!**/node_modules",
      "!!**/.turbo",
      "!!**/.output",
      "!!**/.vinxi",
      "!!**/.tanstack",
      "!!**/dist",
      "!!**/coverage",
      "!!**/playwright-report",
      "!!**/test-results",
      "!!**/artifacts"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": { "enabled": true, "rules": { "preset": "recommended" } },
  "assist": {
    "enabled": true,
    "actions": { "source": { "organizeImports": "on" } }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "jsxQuoteStyle": "double",
      "semicolons": "asNeeded",
      "trailingCommas": "all"
    }
  },
  "css": {
    "parser": { "tailwindDirectives": true },
    "formatter": { "enabled": true }
  }
}
```

Biome owns formatting, style/syntax linting, and import organization. TypeScript owns type correctness. Do not add ESLint, Prettier, import-sorting plugins, or a Tailwind Prettier plugin. Keep shadcn source in Biome scope.

- [ ] **Step 5: Scaffold the app and add the approved shadcn components**

```bash
pnpm add --workspace-root --save-dev --save-exact turbo @biomejs/biome
pnpm dlx shadcn@latest init -t start --base radix --no-monorepo --pointer -c apps/web
pnpm dlx shadcn@latest add button drawer command badge separator scroll-area -y -c apps/web
```

`--no-monorepo` controls shadcn's component layout inside `apps/web`; the surrounding repository remains a pnpm/Turbo workspace. Rename the generated app package to `@whereabouts/web` and keep shadcn components app-local.
Verify the scaffold did not create an `apps/web/pnpm-lock.yaml`; remove that generated nested lockfile if present and retain only the root lockfile. Remove any generated ESLint or Prettier configuration and their package dependencies before the first install; Biome is the sole formatter/linter.

- [ ] **Step 6: Create private package manifests and source exports**

Every internal package is `private`, uses `type: module`, and exposes TypeScript source for workspace consumption. Use these dependency edges:

```json
{
  "@whereabouts/case-content": {
    "exports": {
      ".": "./src/schema.ts",
      "./server": "./src/loader.server.ts",
      "./testing": "./test/fixtures.ts"
    }
  },
  "@whereabouts/game-engine": {
    "dependencies": { "@whereabouts/case-content": "workspace:*" },
    "exports": { ".": "./src/index.ts" }
  },
  "@whereabouts/browser-state": {
    "dependencies": {
      "@whereabouts/case-content": "workspace:*",
      "@whereabouts/game-engine": "workspace:*"
    },
    "exports": { ".": "./src/index.ts" }
  },
  "@whereabouts/content-tools": {
    "dependencies": { "@whereabouts/case-content": "workspace:*" },
    "private": true
  }
}
```

Each package defines `typecheck: tsc --noEmit`, `test: vitest run`, and `test:watch: vitest`. `content-tools` additionally defines:

```json
{
  "scripts": {
    "content:generate": "tsx src/generate-case.ts",
    "content:generate-range": "tsx src/generate-range.ts",
    "content:validate": "tsx src/validate-all.ts",
    "content:review": "tsx src/review-case.ts",
    "content:review-range": "tsx src/review-range.ts"
  }
}
```

`apps/web` defines `dev`, `build`, `typecheck`, `test`, `test:watch`, and `test:e2e`. No package imports another workspace through a relative path.

- [ ] **Step 7: Install dependencies into their owning packages**

```bash
pnpm --filter @whereabouts/case-content add zod
pnpm --filter @whereabouts/game-engine add "@whereabouts/case-content@workspace:*" zod
pnpm --filter @whereabouts/browser-state add "@whereabouts/case-content@workspace:*" "@whereabouts/game-engine@workspace:*"
pnpm --filter @whereabouts/web add "@whereabouts/case-content@workspace:*" "@whereabouts/game-engine@workspace:*" "@whereabouts/browser-state@workspace:*" zod react-globe.gl three
pnpm --filter @whereabouts/content-tools add "@whereabouts/case-content@workspace:*" ai @ai-sdk/openai zod
pnpm --filter @whereabouts/web add --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
pnpm --filter @whereabouts/case-content --filter @whereabouts/game-engine --filter @whereabouts/browser-state --filter @whereabouts/content-tools add --save-dev vitest typescript
pnpm --filter @whereabouts/browser-state add --save-dev jsdom
pnpm --filter @whereabouts/case-content add --save-dev vite
pnpm --filter @whereabouts/content-tools add --save-dev tsx @types/node
```

AI SDK packages and `tsx` belong only to content-tools. No later workstream may install a dependency or modify a package manifest without coordinator approval.

- [ ] **Step 8: Add shared TypeScript and app test configuration**

Create `tsconfig.base.json` with `strict: true`, `noEmit: true`, `module: ESNext`, `moduleResolution: Bundler`, `target: ES2022`, and `skipLibCheck: true`. Package configs extend it and include `src`, `test`, and their `vitest.config.ts`. Do not enable TypeScript `noUnusedLocals` or `noUnusedParameters`; Biome owns those diagnostics.

Configure `apps/web/vitest.config.ts` with jsdom, `@/*` resolving to `apps/web/src`, `apps/web/src/test/setup.ts`, and app-local `src/**/*.test.{ts,tsx}`. Case-content, game-engine, and content-tools Vitest configs use Node; browser-state uses jsdom for `Storage` tests. Create `src/index.ts` containing `export {}` in each internal package so the F0 typecheck has a valid module before the owning feature task replaces or expands that entrypoint.

- [ ] **Step 9: Write and run the foundation smoke test**

Create `apps/web/src/test/foundation.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { cn } from "@/lib/utils"

describe("application foundation", () => {
  it("merges Tailwind classes through the shadcn utility", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
})
```

Run the initial mutating Biome pass once, before feature branches exist:

```bash
pnpm check:fix
pnpm check:ci
pnpm --filter @whereabouts/web test -- src/test/foundation.test.ts
pnpm typecheck
pnpm build
git diff --check
```

- [ ] **Step 10: Ignore generated outputs and commit F0**

Ensure `.gitignore` contains:

```gitignore
.turbo/
artifacts/
playwright-report/
test-results/
coverage/
```

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json biome.json tsconfig.base.json apps packages .gitignore
git commit -m "chore: scaffold Whereabouts pnpm workspace"
```

## Task 2: Define the case contract, complete fixtures, and publication manifest

**Files:**
- Create: `packages/case-content/src/schema.ts`
- Create: `packages/case-content/src/schema.test.ts`
- Create: `packages/case-content/test/fixtures.ts`
- Create: `packages/case-content/content/manifest.json`
- Create: `packages/case-content/content/cases/2026-08-14/v1.json`

- [ ] **Step 1: Write schema tests before the schema**

Create `packages/case-content/src/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { dailyCaseSchema } from "./schema"
import { makeCase } from "@whereabouts/case-content/testing"

describe("dailyCaseSchema", () => {
  it("accepts one target, 24 distractors, six clues, and 24 responses", () => {
    expect(dailyCaseSchema.parse(makeCase()).pois).toHaveLength(25)
  })

  it("rejects duplicate POI ids", () => {
    const value = makeCase()
    value.pois[1].id = value.pois[0].id
    expect(() => dailyCaseSchema.parse(value)).toThrow(/unique/i)
  })

  it("rejects a contextual response for the target", () => {
    const value = makeCase()
    value.contextualResponses[0].poiId = value.target.poiId
    expect(() => dailyCaseSchema.parse(value)).toThrow(/distractor/i)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @whereabouts/case-content test -- src/schema.test.ts
```

Expected: FAIL because `schema.ts` and the fixture do not exist.

- [ ] **Step 3: Implement the exact case schema**

Create `packages/case-content/src/schema.ts` with these public types and invariants:

```ts
import { z } from "zod"

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const sourceIds = z.array(id).min(1)

export const poiSchema = z.object({
  id,
  name: z.string().min(2),
  city: z.string().min(1),
  country: z.string().min(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  wikipediaTitle: z.string().min(1),
  image: z.object({
    url: z.string().url(),
    alt: z.string().min(5),
    attribution: z.string().min(3),
    licenseUrl: z.string().url(),
  }).optional(),
})

export const sourceSchema = z.object({
  id,
  title: z.string().min(1),
  url: z.string().url(),
  retrievedAt: z.string().datetime(),
})

export const dailyCaseSchema = z.object({
  schemaVersion: z.literal(1),
  publicationDate: z.string().date(),
  revision: z.number().int().positive(),
  caseNumber: z.number().int().positive(),
  target: z.object({ poiId: id, destinationName: z.string().min(2) }),
  pois: z.array(poiSchema).length(25),
  clues: z.array(z.object({ id, text: z.string().min(20), sourceIds })).length(6),
  contextualResponses: z.array(z.object({
    poiId: id,
    tier: z.enum(["cold", "warm", "hot"]),
    text: z.string().min(30),
    sourceIds,
  })).length(24),
  reveal: z.object({
    title: z.string().min(2),
    summary: z.string().min(50),
    clueExplanation: z.string().min(50),
    sourceIds,
  }),
  sources: z.array(sourceSchema).min(1),
}).superRefine((value, context) => {
  const poiIds = value.pois.map((poi) => poi.id)
  if (new Set(poiIds).size !== poiIds.length) {
    context.addIssue({ code: "custom", path: ["pois"], message: "POI ids must be unique" })
  }
  if (!poiIds.includes(value.target.poiId)) {
    context.addIssue({ code: "custom", path: ["target"], message: "Target POI must be included" })
  }
  const distractors = poiIds.filter((id) => id !== value.target.poiId)
  const responseIds = value.contextualResponses.map((response) => response.poiId)
  if (new Set(responseIds).size !== 24 || distractors.some((id) => !responseIds.includes(id))) {
    context.addIssue({ code: "custom", path: ["contextualResponses"], message: "Responses must cover each distractor exactly once" })
  }
  const knownSources = new Set(value.sources.map((source) => source.id))
  const references = [
    ...value.clues.flatMap((clue) => clue.sourceIds),
    ...value.contextualResponses.flatMap((response) => response.sourceIds),
    ...value.reveal.sourceIds,
  ]
  if (references.some((sourceId) => !knownSources.has(sourceId))) {
    context.addIssue({ code: "custom", path: ["sources"], message: "Every source reference must resolve" })
  }
})

export type DailyCase = z.infer<typeof dailyCaseSchema>
export type Poi = z.infer<typeof poiSchema>
export type RelationshipTier = DailyCase["contextualResponses"][number]["tier"]
```

- [ ] **Step 4: Add a deterministic 25-POI fixture factory**

Create `packages/case-content/test/fixtures.ts`. Export `makeCase(overrides?: Partial<DailyCase>): DailyCase`; build 25 POIs with `Array.from`, make `poi-00` the target, create six source-backed clues, and create responses for `poi-01` through `poi-24`. Use valid URLs and fixed ISO timestamps. Return a deep mutable object so tests may alter it without cross-test leakage.

- [ ] **Step 5: Add one complete hand-authored development case and manifest**

Create `packages/case-content/content/cases/2026-08-14/v1.json` using the production schema. Use Istanbul as the target destination, Hagia Sophia as the target POI, and 24 globally distributed, recognizable distractors. Every pre-reveal statement must omit `Istanbul`, `Turkey`, and `Hagia Sophia`; every factual section must cite at least one source record.

Create `packages/case-content/content/manifest.json`:

```json
{
  "schemaVersion": 1,
  "cases": {
    "2026-08-14": {
      "caseNumber": 1,
      "revision": 1,
      "file": "./cases/2026-08-14/v1.json"
    }
  }
}
```

- [ ] **Step 6: Run schema tests and validate the development artifact**

```bash
pnpm --filter @whereabouts/case-content test
pnpm --filter @whereabouts/case-content typecheck
```

Expected: all schema tests pass and the one-off parser exits 0.

- [ ] **Step 7: Commit the case contract**

```bash
git add packages/case-content
git commit -m "feat: define revisioned daily case format"
```

## Task 3: Implement the pure game engine with TDD

**Files:**
- Create: `packages/game-engine/src/progress-schema.ts`
- Create: `packages/game-engine/src/engine.ts`
- Create: `packages/game-engine/src/engine.test.ts`
- Create: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Write the complete rule tests**

Cover these named cases in `engine.test.ts`:

```ts
it("starts with clue one and six attempts remaining")
it("adds a unique wrong guess and unlocks the next clue")
it("returns the authored response and relationship tier for a wrong guess")
it("wins immediately when the target POI is guessed")
it("loses after six wrong guesses")
it("rejects a duplicate guess without mutating progress")
it("rejects a seventh guess after the case ends")
it("builds cold, warm, hot, solved share tokens in guess order")
```

Use `makeCase()` and compare complete progress objects, not implementation details.

- [ ] **Step 2: Run the engine tests to verify failure**

```bash
pnpm --filter @whereabouts/game-engine test -- src/engine.test.ts
```

Expected: FAIL because progress and engine modules do not exist.

- [ ] **Step 3: Implement the progress schema and engine API**

`progress-schema.ts` must export:

```ts
export const gameProgressSchema = z.object({
  schemaVersion: z.literal(1),
  caseDate: z.string().date(),
  caseRevision: z.number().int().positive(),
  guessedPoiIds: z.array(z.string()),
  outcome: z.enum(["playing", "won", "lost"]),
  completedAt: z.string().datetime().optional(),
})
export type GameProgress = z.infer<typeof gameProgressSchema>
```

`engine.ts` must export exactly:

```ts
export class GameRuleError extends Error {}
export function createProgress(caseData: DailyCase): GameProgress
export function applyGuess(caseData: DailyCase, progress: GameProgress, poiId: string, now?: Date): GameProgress
export function getVisibleClues(caseData: DailyCase, progress: GameProgress): DailyCase["clues"]
export function getLatestFeedback(caseData: DailyCase, progress: GameProgress): DailyCase["contextualResponses"][number] | null
export function getAttemptsRemaining(progress: GameProgress): number
export function getShareTokens(caseData: DailyCase, progress: GameProgress): Array<"cold" | "warm" | "hot" | "solved">
```

Implement all functions as pure operations. `applyGuess` must return a new object, verify the POI exists, reject duplicates and ended games, win on the target, and lose only when the sixth wrong ID is appended.

Create `src/index.ts` to export only the progress schema/types and public engine API; do not export test helpers or package internals.

- [ ] **Step 4: Run engine tests and type checking**

```bash
pnpm --filter @whereabouts/game-engine test -- src/engine.test.ts
pnpm typecheck
```

Expected: eight passing engine tests and no TypeScript errors.

- [ ] **Step 5: Commit the game engine**

```bash
git add packages/game-engine/src
git commit -m "feat: add pure Whereabouts game engine"
```

## Task 4: Add safe browser persistence and date helpers

**Files:**
- Create: `packages/browser-state/src/storage.ts`
- Create: `packages/browser-state/src/storage.test.ts`
- Create: `packages/browser-state/src/date.ts`
- Create: `packages/browser-state/src/date.test.ts`
- Create: `packages/browser-state/src/index.ts`

- [ ] **Step 1: Write storage and date tests**

Test exact behavior:

```ts
expect(formatLocalDate(new Date(2026, 7, 4, 23, 59))).toBe("2026-08-04")
expect(parseCaseDate("2026-02-29")).toBeNull()
expect(parseCaseDate("2028-02-29")).toBe("2028-02-29")
```

For storage, use jsdom `localStorage` and assert that a valid matching revision resumes, malformed JSON resets, schema-invalid JSON resets, and a revision mismatch returns fresh progress without deleting unrelated dates.

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm --filter @whereabouts/browser-state test -- src/storage.test.ts src/date.test.ts
```

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement strict local date utilities**

`date.ts` must use local `getFullYear`, `getMonth`, and `getDate` for `formatLocalDate`. `parseCaseDate` must round-trip numeric year/month/day through a UTC `Date` to reject impossible calendar dates instead of relying only on a regular expression.

- [ ] **Step 4: Implement the storage adapter**

Use the key template ``whereabouts:case:${caseDate}``. Export:

```ts
export function loadProgress(caseData: DailyCase, storage: Storage = window.localStorage): GameProgress
export function saveProgress(progress: GameProgress, storage: Storage = window.localStorage): void
export function clearProgress(caseDate: string, storage: Storage = window.localStorage): void
```

`loadProgress` must parse with `gameProgressSchema.safeParse`, verify date and revision, and call `createProgress(caseData)` on any failure. It must never throw because of storage access; catch `SecurityError` and quota-related exceptions.

Create `src/index.ts` that exports the storage and date APIs. Keep DOM access inside function bodies so importing the package during server rendering is safe.

- [ ] **Step 5: Run focused tests**

```bash
pnpm --filter @whereabouts/browser-state test -- src/storage.test.ts src/date.test.ts
```

Expected: all persistence and calendar tests pass.

- [ ] **Step 6: Commit persistence**

```bash
git add packages/browser-state/src
git commit -m "feat: persist dated game progress in browser"
```

## Task 5: Load only published cases through a TanStack server boundary

**Files:**
- Create: `packages/case-content/src/loader.server.ts`
- Create: `packages/case-content/src/loader.server.test.ts`

- [ ] **Step 1: Write loader tests**

Test a pure injected loader before wiring it to Vite globals:

```ts
it("loads and validates the manifest-selected revision")
it("returns null for a syntactically valid unpublished date")
it("rejects a manifest entry whose artifact date or revision differs")
```

Use a fixture manifest and a map keyed by `../content/cases/2026-08-14/v1.json`.

- [ ] **Step 2: Run the loader tests to verify failure**

```bash
pnpm --filter @whereabouts/case-content test -- src/loader.server.test.ts
```

Expected: FAIL because the loader does not exist.

- [ ] **Step 3: Implement the injected loader and production sources**

`loader.server.ts` must use:

```ts
const caseModules = import.meta.glob("../content/cases/**/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>
```

Parse `packages/case-content/content/manifest.json` with a Zod manifest schema. Export `loadPublishedCase(date)` plus a dependency-injected `createCaseLoader(manifest, modules)` used by tests. Verify the artifact's date and revision match the manifest entry. Return `null` rather than throwing for a date absent from the public manifest; throw a typed `CaseContentError` for a corrupt published artifact. Future artifacts may exist privately in the repository, but they are unreachable until the publication workflow adds them to the manifest.

- [ ] **Step 4: Run loader tests and commit the Wave 1 package**

```bash
pnpm --filter @whereabouts/case-content test -- src/loader.server.test.ts
pnpm typecheck
git add packages/case-content/src/loader.server.ts packages/case-content/src/loader.server.test.ts packages/case-content/package.json
git commit -m "feat: load revisioned published cases"
```

## Task 6: Build canonical date routing and briefing-unavailable states

**Files:**
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/src/routes/index.tsx`
- Create: `apps/web/src/routes/$date.tsx`
- Create: `apps/web/src/features/cases/case-functions.ts`
- Create: `apps/web/src/features/game/briefing-unavailable.tsx`
- Create: `apps/web/src/features/game/route-state.test.tsx`

- [ ] **Step 1: Write route-level component tests**

Use a memory router or test the extracted route components. Assert that `/` renders a loading label before browser date resolution, then navigates to `/2026-08-14`; a valid unpublished date renders `Briefing unavailable`; and malformed dates render the not-found component.

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm --filter @whereabouts/web test -- src/features/game/route-state.test.tsx
```

- [ ] **Step 3: Expose case loading through validated server functions**

Create `case-functions.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { listPublishedCases, loadPublishedCase } from "@whereabouts/case-content/server"

export const getPublishedCase = createServerFn({ method: "GET" })
  .validator(z.object({ date: z.string().date() }))
  .handler(async ({ data }) => loadPublishedCase(data.date))

export const getPublishedCaseIndex = createServerFn({ method: "GET" }).handler(async () =>
  listPublishedCases(),
)
```

`listPublishedCases()` returns only `{ date, caseNumber }` records, newest first. The manifest is the publication boundary; Task 12 rejects future entries and Task 15 adds reviewed cases on release.

- [ ] **Step 4: Implement `/` as a client-local-date redirect**

`index.tsx` imports `formatLocalDate` from `@whereabouts/browser-state`, calls it with `new Date()` in an effect, and navigates with `replace: true` to `/$date`. During SSR and hydration it renders a compact `Preparing today’s briefing…` shell, preventing a server-timezone mismatch.

- [ ] **Step 5: Implement the canonical `$date` route**

Import `parseCaseDate` from `@whereabouts/browser-state`. Validate the parameter before calling `getPublishedCase` from the route loader. Return `{ caseData }`; render `BriefingUnavailable` for `null`; render `<GameScreen caseData={caseData} />` otherwise. Supply route metadata using the string template ``Whereabouts — ${date}`` without revealing the answer.

- [ ] **Step 6: Run route tests, type checking, and commit**

```bash
pnpm --filter @whereabouts/web test -- src/features/game/route-state.test.tsx
pnpm typecheck
git add apps/web/src/routes apps/web/src/features/cases/case-functions.ts apps/web/src/features/game/briefing-unavailable.tsx apps/web/src/features/game/route-state.test.tsx
git commit -m "feat: add canonical daily and historical routes"
```

## Task 7: Establish the Whereabouts Tailwind theme and static briefing components

**Files:**
- Modify: `apps/web/src/styles.css`
- Create: `apps/web/src/features/game/case-header.tsx`
- Create: `apps/web/src/features/game/clue-card.tsx`
- Create: `apps/web/src/features/game/briefing-layout.tsx`
- Create: `apps/web/src/features/game/briefing-layout.test.tsx`

- [ ] **Step 1: Write the briefing component test**

Render the static layout with fixture data and progress. Assert the accessible heading is `Whereabouts`, the case label is present, clue one is visible, clues two through six are absent, and `6 attempts remaining` is announced in text rather than by color alone.

- [ ] **Step 2: Run the test to verify failure**

```bash
pnpm --filter @whereabouts/web test -- src/features/game/briefing-layout.test.tsx
```

- [ ] **Step 3: Define the visual tokens in Tailwind CSS v4**

Add semantic variables to `apps/web/src/styles.css` using OKLCH:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

:root {
  --background: oklch(0.13 0.018 205);
  --foreground: oklch(0.93 0.015 120);
  --card: oklch(0.17 0.022 205);
  --card-foreground: var(--foreground);
  --popover: oklch(0.16 0.022 205);
  --popover-foreground: var(--foreground);
  --primary: oklch(0.76 0.09 92);
  --primary-foreground: oklch(0.16 0.02 205);
  --secondary: oklch(0.24 0.025 205);
  --secondary-foreground: var(--foreground);
  --muted: oklch(0.22 0.02 205);
  --muted-foreground: oklch(0.69 0.025 180);
  --accent: oklch(0.55 0.13 30);
  --accent-foreground: var(--foreground);
  --destructive: oklch(0.56 0.18 28);
  --border: oklch(0.32 0.028 195);
  --input: var(--border);
  --ring: var(--primary);
  --radius: 0.5rem;
}

body { min-width: 320px; background: var(--background); color: var(--foreground); }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 4: Implement the static briefing pieces**

Use Tailwind utilities and shadcn `Badge`/`Separator`; do not create a second styling abstraction. Keep each file below 120 lines. `ClueCard` takes one clue and renders a `CURRENT INTELLIGENCE` label plus readable serif clue copy. `CaseHeader` takes `caseNumber`, `attemptsRemaining`, and `onOpenArchive`.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @whereabouts/web test -- src/features/game/briefing-layout.test.tsx
pnpm typecheck
git add apps/web/src/styles.css apps/web/src/features/game
git commit -m "feat: add mobile intelligence briefing design"
```

## Task 8: Build the accessible POI search and confirmation dossier

**Files:**
- Create: `apps/web/src/features/game/poi-search.tsx`
- Create: `apps/web/src/features/game/poi-dossier.tsx`
- Create: `apps/web/src/features/game/poi-picker.tsx`
- Create: `apps/web/src/features/game/poi-picker.test.tsx`

- [ ] **Step 1: Write interaction tests**

With Testing Library and `userEvent`, assert that a user can search by POI, city, or country; select a result; review its full dossier; cancel without guessing; confirm once; and cannot select an already-guessed POI.

- [ ] **Step 2: Run the tests to verify failure**

```bash
pnpm --filter @whereabouts/web test -- src/features/game/poi-picker.test.tsx
```

- [ ] **Step 3: Implement `PoiSearch` with shadcn `Command`**

Expose this contract:

```ts
type PoiSearchProps = {
  pois: Poi[]
  disabledPoiIds: Set<string>
  onSelect: (poi: Poi) => void
}
```

Each command item must contain searchable name/city/country text, a visible eliminated state, and a disabled attribute when guessed.

- [ ] **Step 4: Implement `PoiDossier` with shadcn `Drawer`**

Expose `poi`, `open`, `onOpenChange`, and `onConfirm`. The image is optional and uses a neutral gradient fallback. The primary action reads `Submit this lead`; focus returns to the initiating control after closing.

- [ ] **Step 5: Implement `PoiPicker` state composition**

The picker owns only `selectedPoi`; it does not own game progress. Both globe and list call the same selection callback. Only dossier confirmation invokes `onGuess(poi.id)`.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @whereabouts/web test -- src/features/game/poi-picker.test.tsx
pnpm typecheck
git add apps/web/src/features/game/poi-search.tsx apps/web/src/features/game/poi-dossier.tsx apps/web/src/features/game/poi-picker.tsx apps/web/src/features/game/poi-picker.test.tsx
git commit -m "feat: add accessible POI selection flow"
```

## Task 9: Add the lazy 3D globe and dependable list-only fallback

**Files:**
- Create: `apps/web/src/features/globe/webgl.ts`
- Create: `apps/web/src/features/globe/webgl.test.ts`
- Create: `apps/web/src/features/globe/globe-picker.tsx`
- Create: `apps/web/src/features/globe/globe-canvas.client.tsx`
- Modify: `apps/web/src/features/game/poi-picker.tsx`

- [ ] **Step 1: Write WebGL and fallback tests**

Mock `HTMLCanvasElement.getContext` to return `null` and assert `supportsWebGl()` is false. Render `GlobePicker` with `supported={false}` and assert the searchable-list control remains present and an explanatory `Globe unavailable; use location list` status is announced.

- [ ] **Step 2: Run the tests to verify failure**

```bash
pnpm --filter @whereabouts/web test -- src/features/globe/webgl.test.ts
```

- [ ] **Step 3: Implement the capability probe**

```ts
export function supportsWebGl(documentValue: Document = document): boolean {
  try {
    const canvas = documentValue.createElement("canvas")
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"))
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Implement the react-globe.gl adapter**

`globe-canvas.client.tsx` must accept `pois`, `disabledPoiIds`, `selectedPoiId`, `onSelect`, and `reducedMotion`. Configure `pointsData`, `pointLat`, `pointLng`, `pointLabel`, `pointColor`, `pointRadius`, and `onPointClick`. Set `pointsMerge={false}` because click handlers require individual point objects. Disable auto-rotation; set transition duration to zero under reduced motion; size the canvas through a `ResizeObserver` rather than `window.innerWidth`.

- [ ] **Step 5: Implement the lazy client boundary**

Load `globe-canvas.client.tsx` with `React.lazy` only after mount and only when `supportsWebGl()` succeeds. Wrap it in an error boundary that switches permanently to list-only mode for the session if Three.js initialization throws.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @whereabouts/web test -- src/features/globe/webgl.test.ts src/features/game/poi-picker.test.tsx
pnpm typecheck
git add apps/web/src/features/globe apps/web/src/features/game/poi-picker.tsx
git commit -m "feat: add interactive globe with list fallback"
```

## Task 10: Compose gameplay, contextual feedback, and the final reveal

**Files:**
- Create: `apps/web/src/features/game/feedback-panel.tsx`
- Create: `apps/web/src/features/game/result-panel.tsx`
- Create: `apps/web/src/features/game/game-screen.tsx`
- Create: `apps/web/src/features/game/game-screen.test.tsx`
- Modify: `apps/web/src/features/game/briefing-layout.tsx`

- [ ] **Step 1: Write complete screen-flow tests**

Test one wrong guess followed by a correct guess. Assert: progress is saved after each confirmation; the wrong POI is eliminated; its authored feedback and `warm` label appear; clue two unlocks; the correct guess renders the reveal and source links; and input controls are disabled after completion. Add a six-wrong-guess loss test.

- [ ] **Step 2: Run the tests to verify failure**

```bash
pnpm --filter @whereabouts/web test -- src/features/game/game-screen.test.tsx
```

- [ ] **Step 3: Implement feedback and reveal components**

`FeedbackPanel` maps `cold`, `warm`, and `hot` to both text and theme colors. `ResultPanel` receives the case, progress, and `onShare`; it renders `Case closed` or `Trail lost`, target POI, destination, reveal summary, clue explanation, and only the referenced source links. When an image exists, render its alt text plus visible attribution and license links; otherwise render the neutral gradient fallback.

- [ ] **Step 4: Implement `GameScreen` as the orchestration boundary**

Import rules from `@whereabouts/game-engine` and persistence from `@whereabouts/browser-state`. Initialize with `loadProgress(caseData)` in a client-safe lazy state initializer. Derive clues, latest feedback, and remaining attempts through engine functions. On confirmation, call `applyGuess`, update React state, then `saveProgress`. Do not duplicate rule logic in JSX.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @whereabouts/web test -- src/features/game/game-screen.test.tsx
pnpm typecheck
git add apps/web/src/features/game
git commit -m "feat: connect daily case gameplay and reveal"
```

## Task 11: Add deterministic sharing and the historical archive

**Files:**
- Create: `apps/web/src/features/game/share.ts`
- Create: `apps/web/src/features/game/share.test.ts`
- Create: `apps/web/src/features/game/archive-drawer.tsx`
- Create: `apps/web/src/features/game/archive-drawer.test.tsx`
- Modify: `apps/web/src/features/game/result-panel.tsx`
- Modify: `apps/web/src/features/game/case-header.tsx`

- [ ] **Step 1: Write share and archive tests**

Assert exact share text:

```text
WHEREABOUTS 042  4/6
🔵 🟡 🟠 🟢
https://whereabouts.test/2026-08-14
```

Also assert a loss uses `X/6`, no POI/city/country names appear, `navigator.share` is preferred, clipboard is used after an unavailable or rejected native share, and archive links include only manifest-published dates.

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm --filter @whereabouts/web test -- src/features/game/share.test.ts src/features/game/archive-drawer.test.tsx
```

- [ ] **Step 3: Implement share text and platform fallback**

Export:

```ts
export function buildShareText(caseData: DailyCase, progress: GameProgress, origin: string): string
export async function shareResult(text: string, navigatorValue: Pick<Navigator, "share" | "clipboard">): Promise<"shared" | "copied">
```

Map tokens to `🔵`, `🟡`, `🟠`, and `🟢`. Treat `AbortError` as cancellation and do not copy; use clipboard for unsupported APIs and non-cancellation failures.

- [ ] **Step 4: Implement the secondary archive drawer as a data-in component**

Accept `publishedCases: Array<{ date: string; caseNumber: number }>` and `today: string` as props. Render newest first in a shadcn Drawer, mark today, and link with `to="/$date"` and `{ date }` params. Do not fetch inside this primitive and do not show target names. Wave 3 routing loads `getPublishedCaseIndex()` and passes the public records into the game shell.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @whereabouts/web test -- src/features/game/share.test.ts src/features/game/archive-drawer.test.tsx
pnpm typecheck
git add apps/web/src/features/game apps/web/src/features/cases
git commit -m "feat: add spoiler-free sharing and case archive"
```

## Task 12: Build deterministic content validation before AI generation

**Files:**
- Create: `packages/content-tools/src/validate-case.ts`
- Create: `packages/content-tools/src/validate-case.test.ts`
- Create: `packages/content-tools/src/validate-all.ts`
- Create: `packages/content-tools/src/paths.ts`
- Create: `packages/content-tools/catalog/pois.json`

- [ ] **Step 1: Write publication-validation tests**

Test valid content and separate failures for target-name leakage, city leakage, country leakage, duplicate coordinates, missing source references, target repetition within 30 cases, excessive distractor repetition, manifest/file mismatch, and a future public manifest entry.

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm --filter @whereabouts/content-tools test -- src/validate-case.test.ts
```

- [ ] **Step 3: Implement deterministic validation**

Export:

```ts
export type ValidationIssue = { path: string; message: string }
export function validateCaseForPublication(caseData: unknown): ValidationIssue[]
export function validateCollection(cases: DailyCase[], publicationCeiling: string): ValidationIssue[]
```

First parse with `dailyCaseSchema.safeParse`. Normalize pre-reveal text to lowercase without punctuation and scan for normalized target POI, destination, city, and country names. Treat coordinates rounded to four decimals as duplicates. Enforce no repeated target within the previous 30 cases and no distractor appearing in more than 40% of that window.

- [ ] **Step 4: Seed a curated POI catalog**

Create at least 75 globally distributed catalog entries with the exact `poiSchema` fields plus a `region` field used only by generation. Include Wikipedia titles and verified coordinates. This catalog is editorial input, not generated game output.

- [ ] **Step 5: Implement the manifest-wide CLI**

Create `paths.ts` with a module-relative, absolute `caseContentRoot` and a `resolveCaseArtifact(date, revision)` helper that validates the date/revision and rejects any resolved path outside that root:

```ts
export const caseContentRoot = fileURLToPath(
  new URL("../../case-content/content/", import.meta.url),
)
```

`validate-all.ts` uses this helper to load every artifact referenced by the manifest, rejects missing artifacts, rejects unreferenced artifacts whose publication date is at or before the ceiling, allows unreferenced future artifacts awaiting publication, calls collection validation with `PUBLICATION_CEILING` or today's UTC date, prints one issue per line, and exits 1 if any issue exists.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @whereabouts/content-tools test -- src/validate-case.test.ts
pnpm content:validate
git add packages/content-tools/src/validate-case.ts packages/content-tools/src/validate-case.test.ts packages/content-tools/src/validate-all.ts packages/content-tools/src/paths.ts packages/content-tools/catalog/pois.json
git commit -m "feat: enforce case publication safeguards"
```

## Task 13: Implement Wikipedia retrieval and AI SDK structured generation

**Files:**
- Create: `packages/content-tools/src/wikipedia.ts`
- Create: `packages/content-tools/src/wikipedia.test.ts`
- Create: `packages/content-tools/src/prompt.ts`
- Create: `packages/content-tools/src/generate-case.ts`
- Create: `packages/content-tools/src/generate-case.test.ts`
- Create: `packages/content-tools/src/generate-range.ts`
- Create: `packages/content-tools/src/review-case.ts`
- Create: `packages/content-tools/src/review-range.ts`
- Create: `packages/content-tools/src/fixtures/model-output.json`
- Create: `.env.example`

- [ ] **Step 1: Write recorded pipeline tests**

Mock `fetch` and the model call. Assert that Wikipedia requests use `https://en.wikipedia.org/w/api.php` with `action=query`, `prop=extracts|info`, `explaintext=1`, `inprop=url`, `redirects=1`, and a descriptive `Api-User-Agent`. Assert that recorded structured output is converted into a valid `DailyCase`, fails closed on unsupported source IDs, and never writes a file when publication validation reports issues.

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm --filter @whereabouts/content-tools test -- src/wikipedia.test.ts src/generate-case.test.ts
```

- [ ] **Step 3: Implement the policy-compliant Wikipedia client**

Fetch sequentially in small batches, honor `Retry-After` on 429/503 responses, and use:

```ts
const headers = {
  "Api-User-Agent": process.env.WIKIMEDIA_USER_AGENT ?? "Whereabouts/0.1 (local development)",
}
```

Production generation must reject the local-development value. Store canonical page URLs and retrieval timestamps with extracted plaintext; never call Wikipedia from the browser game.

- [ ] **Step 4: Implement the stable source-grounded prompt**

The prompt must provide only selected POI metadata and retrieved extracts, demand exactly six progressively specific clues and 24 distractor responses, restrict `sourceIds` to supplied IDs, define relationship tiers, forbid target/city/country names before reveal, and ask for concise intelligence-briefing prose. Keep the prompt in one versioned module and include `PROMPT_VERSION = 1` in generation logs.

- [ ] **Step 5: Generate structured output with the current AI SDK API**

Use schema-constrained output:

```ts
import { openai } from "@ai-sdk/openai"
import { generateText, Output } from "ai"

const result = await generateText({
  model: openai(process.env.WHEREABOUTS_MODEL ?? "gpt-5-mini"),
  output: Output.object({ schema: generatedCaseDraftSchema }),
  prompt,
})
const draft = result.output
```

Join trusted catalog metadata and source records into the draft rather than asking the model to reproduce coordinates or URLs. Import `resolveCaseArtifact` from `paths.ts`; never resolve output from the caller's working directory. Parse the final object with `dailyCaseSchema`, then call `validateCaseForPublication`. Write only to the validated artifact path when both pass. Refuse to overwrite an existing revision.

- [ ] **Step 6: Implement batch generation and review output**

`generate-range.ts` accepts `--from YYYY-MM-DD --days N`, selects targets that satisfy the recent-repeat rule, generates sequentially, and stops on the first failure. `review-case.ts --date YYYY-MM-DD` prints the target, all clues, every distractor tier/response, and sources in a readable Markdown review packet. `review-range.ts --from YYYY-MM-DD --days N --out artifacts/review` writes one packet per date and an index checklist.

- [ ] **Step 7: Document publishing environment variables**

Create `.env.example`:

```dotenv
OPENAI_API_KEY=
WHEREABOUTS_MODEL=gpt-5-mini
WIKIMEDIA_USER_AGENT=Whereabouts/1.0 (https://your-deployment.example/contact; contact@example.com)
PUBLICATION_CEILING=2026-08-14
```

The example communicates the required Wikimedia contact format; actual deployment values stay outside source control.

- [ ] **Step 8: Verify recorded tests and commit**

```bash
pnpm --filter @whereabouts/content-tools test -- src/wikipedia.test.ts src/generate-case.test.ts
pnpm content:validate
git add packages/content-tools .env.example
git commit -m "feat: generate source-backed cases with AI SDK"
```

## Task 14: Add Playwright end-to-end coverage for desktop and mobile

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/helpers.ts`
- Create: `apps/web/e2e/whereabouts.spec.ts`

- [ ] **Step 1: Install the Chromium browser used in local and CI tests**

```bash
pnpm --filter @whereabouts/web exec playwright install chromium
```

- [ ] **Step 2: Configure Playwright**

Create `apps/web/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000/2026-08-14",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

- [ ] **Step 3: Write deterministic E2E helpers**

`helpers.ts` must expose `setClock`, `seedProgress`, `readProgress`, and `disableWebGl`. `disableWebGl` uses `page.addInitScript` to replace canvas `getContext` for `webgl`/`webgl2` only. Use the fixed 2026-08-14 artifact and data-testid attributes only where role/name selectors cannot express the control.

- [ ] **Step 4: Write the approved E2E scenarios**

Implement separate tests for:

- Root local-date redirect
- Complete win with contextual feedback before the final guess
- Six-attempt loss
- Reload and resume
- Duplicate-guess prevention
- Historical dated route
- Invalid and unpublished dates
- Corrupt local-storage recovery
- Exact spoiler-free clipboard text
- Forced WebGL failure completed through the list
- Mobile viewport selection and dossier confirmation

- [ ] **Step 5: Run E2E tests**

```bash
pnpm test:e2e
```

Expected: all scenarios pass in desktop Chromium and the iPhone 13 emulation project.

- [ ] **Step 6: Commit Playwright coverage**

```bash
git add apps/web/playwright.config.ts apps/web/e2e
git commit -m "test: cover Whereabouts journeys with Playwright"
```

## Task 15: Add CI, scheduled generation, daily publication, and the editorial runbook

**Files:**
- Create: `.github/workflows/quality.yml`
- Create: `.github/workflows/generate-cases.yml`
- Create: `.github/workflows/publish-case.yml`
- Create: `docs/content-publishing.md`
- Modify: `README.md`

- [ ] **Step 1: Add the quality workflow**

On pull requests and pushes to `main`, use Node 22 and pnpm, run `pnpm install --frozen-lockfile`, `pnpm --filter @whereabouts/web exec playwright install --with-deps chromium`, `pnpm quality`, and `pnpm test:e2e`. Give the workflow read-only repository permissions. `pnpm quality` invokes Biome's read-only `ci` command through the Turbo root task.

- [ ] **Step 2: Add the minimum viable scheduled publisher**

Run weekly and by `workflow_dispatch`. Give only `contents: write` and `pull-requests: write`. Generate seven days beginning 14 days from the run date, validate all content, create human review packets as workflow artifacts, and open a pull request titled `content: add upcoming Whereabouts cases`. Never push directly to `main`.

The generation job must read `OPENAI_API_KEY` and `WIKIMEDIA_USER_AGENT` from repository secrets and set `WHEREABOUTS_MODEL` from a repository variable with `gpt-5-mini` as the fallback.

- [ ] **Step 3: Add the daily publication workflow**

Run daily and by `workflow_dispatch`. Compute the UTC calendar date, verify that `packages/case-content/content/cases/$DATE/v1.json` already exists on `main`, add only that reviewed artifact to `packages/case-content/content/manifest.json`, run `PUBLICATION_CEILING=$DATE pnpm content:validate`, commit with `content: publish Whereabouts case $DATE`, and push to `main`. If the artifact is absent or the date is already published, exit successfully without changing the repository. This workflow does not call a model and never publishes an unreviewed artifact.

- [ ] **Step 4: Write the editorial runbook**

Document exact commands for one case and a range, the checklist for factual support/clue fairness/temperature/geographic variety/tone, how to increment a revision without deleting the original artifact, how to update the manifest, and how to withdraw a broken manifest entry. Include Wikimedia attribution and user-agent requirements.

- [ ] **Step 5: Replace the generated README with project instructions**

Cover prerequisites, `pnpm install`, `pnpm dev`, all test commands, content commands, environment variables, architecture links, and the design/plan links. State clearly that AI is used only during publishing.

- [ ] **Step 6: Run the full quality gate**

```bash
pnpm quality
pnpm test:e2e
git diff --check
```

Expected: type checking, unit/component tests, content validation, production build, all Playwright projects, and whitespace checks pass.

- [ ] **Step 7: Commit operational automation**

```bash
git add .github README.md docs/content-publishing.md
git commit -m "ci: validate and publish upcoming cases"
```

## Task 16: Final accessibility, performance, and launch-content verification

**Files:**
- Modify only files implicated by measured failures
- Create: `docs/launch-checklist.md`

- [ ] **Step 1: Audit the mobile game manually at narrow widths**

Verify 320×568, 375×667, and 390×844 viewports; safe-area padding; 44-pixel interactive targets; one-handed dossier actions; no horizontal overflow; and readable clue copy at 200% zoom. Record each result in `docs/launch-checklist.md`.

- [ ] **Step 2: Verify keyboard, reduced-motion, and list-only completion**

Complete a case without a pointer, repeat with `prefers-reduced-motion: reduce`, and complete with WebGL disabled. Confirm visible focus, correct Drawer focus restoration, text equivalents for temperature, and no dependence on globe hover.

- [ ] **Step 3: Measure the production build**

```bash
pnpm build
```

Confirm the globe chunk is lazy-loaded, no AI SDK/provider code appears in the browser bundle, and archival images are lazy. Record bundle observations in the checklist; if the initial route includes Three.js, move the import behind the existing lazy client boundary before proceeding.

- [ ] **Step 4: Generate and review the 30-case launch set**

With publishing credentials configured:

```bash
pnpm content:generate-range -- --from 2026-08-15 --days 29
pnpm content:validate
pnpm content:review-range -- --from 2026-08-14 --days 30 --out artifacts/review
```

Review every packet listed in `artifacts/review/index.md` and check off factual support, clue fairness, relationship tier, target diversity, distractor diversity, and spoiler safety in the launch checklist. Do not publish a case whose review is incomplete.

- [ ] **Step 5: Run the final verification suite**

```bash
pnpm quality
pnpm test:e2e
git diff --check
git status --short
```

Expected: every automated check passes and status contains only the reviewed launch artifacts and checklist intended for the final commit.

- [ ] **Step 6: Commit the launch-ready build**

```bash
git add packages/case-content/content docs/launch-checklist.md
git commit -m "content: prepare Whereabouts launch cases"
```

## Reference documentation

- [TanStack Start getting started](https://tanstack.com/start/latest/docs/framework/react/getting-started)
- [pnpm workspaces and `workspace:*`](https://pnpm.io/workspaces)
- [Turborepo repository structure](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository)
- [Turborepo task configuration](https://turborepo.com/docs/crafting-your-repository/configuring-tasks)
- [Biome configuration](https://biomejs.dev/reference/configuration/)
- [Biome continuous integration](https://biomejs.dev/recipes/continuous-integration/)
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [TanStack Start execution model](https://tanstack.com/start/latest/docs/framework/react/guide/execution-model)
- [shadcn/ui for TanStack Start](https://ui.shadcn.com/docs/installation/tanstack)
- [shadcn/ui CLI](https://ui.shadcn.com/docs/cli)
- [AI SDK structured output](https://ai-sdk.dev/docs/reference/ai-sdk-core/output)
- [react-globe.gl point and interaction API](https://github.com/vasturiano/react-globe.gl)
- [Playwright web server configuration](https://playwright.dev/docs/test-webserver)
- [Playwright device emulation](https://playwright.dev/docs/emulation)
- [Wikimedia API usage guidelines](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines/en)
- [Wikimedia user-agent policy](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy/en)
