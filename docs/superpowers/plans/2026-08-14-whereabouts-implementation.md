# Whereabouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first daily geography deduction game with a tappable 3D globe, browser-owned progress, dated cases, spoiler-free sharing, and a source-backed AI-assisted publishing pipeline.

**Architecture:** TanStack Start serves repository-native, revisioned case JSON through a server-function boundary. A pure TypeScript game engine owns all rules, a local-storage adapter owns progress, and React components built with Tailwind CSS and shadcn/ui render the briefing, globe/list selector, feedback, archive, and reveal. A separate TypeScript command uses Wikimedia source material and AI SDK structured output to produce case artifacts that must pass deterministic publication checks.

**Tech Stack:** TypeScript, React 19, TanStack Start, Tailwind CSS v4, shadcn/ui with Radix primitives, Zod, react-globe.gl/Three.js, Vitest, Testing Library, Playwright, AI SDK Core, `@ai-sdk/openai`, and pnpm.

---

## Execution note

Execute this plan in a dedicated Git worktree created from `main`. Do not implement directly in the brainstorming worktree. The repository currently contains only the approved design, `.gitignore`, and this plan.

## File map

### Application foundation

- `package.json` — scripts and dependencies
- `vite.config.ts` — TanStack Start and Tailwind build configuration
- `vitest.config.ts` — jsdom test configuration
- `playwright.config.ts` — desktop/mobile browser projects and local web server
- `src/styles.css` — Tailwind import, intelligence-console theme tokens, global motion rules
- `src/routes/__root.tsx` — document shell, metadata, and global error/not-found surfaces
- `src/routes/index.tsx` — browser-local-date resolution and redirect
- `src/routes/$date.tsx` — canonical daily/historical case route

### Case content

- `src/features/cases/schema.ts` — Zod schemas and inferred case types
- `src/features/cases/case-loader.server.ts` — server-only manifest and revision loader
- `src/features/cases/case-functions.ts` — validated TanStack server function
- `content/manifest.json` — published date-to-revision mapping
- `content/cases/YYYY-MM-DD/vN.json` — immutable case artifacts
- `content/catalog/pois.json` — curated POI catalog used by generation
- `src/test/fixtures/case.ts` — complete deterministic case factory for tests

### Game domain and persistence

- `src/features/game/engine.ts` — pure transition and derived-state functions
- `src/features/game/engine.test.ts` — game rule tests
- `src/features/game/progress-schema.ts` — persisted progress schema
- `src/features/game/storage.ts` — safe local-storage adapter and revision handling
- `src/features/game/storage.test.ts` — persistence, corruption, and revision tests
- `src/features/game/date.ts` — strict route-date and local-date helpers
- `src/features/game/date.test.ts` — date edge cases

### Player interface

- `src/features/game/game-screen.tsx` — coordinates case data, browser progress, and modal state
- `src/features/game/case-header.tsx` — brand, case number, attempt indicator, archive action
- `src/features/game/clue-card.tsx` — current universal clue
- `src/features/game/poi-picker.tsx` — globe/list mode and POI selection contract
- `src/features/game/poi-search.tsx` — accessible searchable POI list
- `src/features/game/poi-dossier.tsx` — shadcn Drawer confirmation surface
- `src/features/game/feedback-panel.tsx` — wrong-guess relationship explanation
- `src/features/game/result-panel.tsx` — win/loss reveal, citations, and sharing
- `src/features/game/share.ts` — deterministic share text and Web Share/clipboard fallback
- `src/features/game/share.test.ts` — spoiler-free output tests
- `src/features/globe/globe-picker.tsx` — lazy client-only boundary and fallback
- `src/features/globe/globe-canvas.client.tsx` — react-globe.gl adapter
- `src/features/globe/webgl.ts` — WebGL capability probe
- `src/features/globe/webgl.test.ts` — capability tests

### Content pipeline

- `scripts/content/wikipedia.ts` — MediaWiki Action API client with attribution and user-agent policy
- `scripts/content/prompt.ts` — stable source-grounded generation prompt
- `scripts/content/generate-case.ts` — AI SDK structured generation command
- `scripts/content/generate-range.ts` — scheduled batch command
- `scripts/content/validate-case.ts` — deterministic publication validation
- `scripts/content/validate-all.ts` — manifest-wide checks and recent-repeat policy
- `scripts/content/review-case.ts` — prints a human-review packet
- `scripts/content/review-range.ts` — writes review packets for a date range
- `scripts/content/*.test.ts` — recorded-response and validation tests
- `.env.example` — publishing-only environment variables
- `docs/content-publishing.md` — generation, review, correction, and publication runbook
- `.github/workflows/quality.yml` — application and content checks
- `.github/workflows/generate-cases.yml` — scheduled generation pull request
- `.github/workflows/publish-case.yml` — publishes an already-reviewed case on its release date

### End-to-end coverage

- `e2e/whereabouts.spec.ts` — win, loss, resume, routes, share, and list-only flows
- `e2e/helpers.ts` — deterministic date, local-storage, and WebGL controls

## Task 1: Scaffold TanStack Start, shadcn/ui, Tailwind, and the test harness

**Files:**
- Create/modify: `package.json`
- Create/modify: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/foundation.test.ts`
- Create/modify: `src/styles.css`
- Create: `components.json`
- Modify: `.gitignore`
- Create via shadcn: `src/components/ui/button.tsx`, `drawer.tsx`, `command.tsx`, `badge.tsx`, `separator.tsx`, `scroll-area.tsx`

- [ ] **Step 1: Scaffold the current directory with the official TanStack Start shadcn template**

Run from the repository root:

```bash
pnpm dlx shadcn@latest init -t start --base radix --no-monorepo --pointer -c .
```

Expected: a TanStack Start app using React, TypeScript, Tailwind CSS v4, the `@/*` alias, and shadcn configuration. Preserve the existing `docs/` directory and `.gitignore` entries.

- [ ] **Step 2: Add only the shadcn components required by the approved flow**

```bash
pnpm dlx shadcn@latest add button drawer command badge separator scroll-area -y
```

Expected: component source files under `src/components/ui/`; do not add a general component library or all shadcn components.

- [ ] **Step 3: Install runtime and test dependencies**

```bash
pnpm add zod react-globe.gl three ai @ai-sdk/openai
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test tsx
```

Expected: dependencies recorded in `package.json` and a current `pnpm-lock.yaml`.

- [ ] **Step 4: Ignore generated test and editorial artifacts**

Append these exact entries to `.gitignore`:

```gitignore
artifacts/
playwright-report/
test-results/
coverage/
```

- [ ] **Step 5: Add explicit scripts to `package.json`**

Merge these commands into the generated scripts:

```json
{
  "scripts": {
    "dev": "vite dev --port 3000",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "content:generate": "tsx scripts/content/generate-case.ts",
    "content:generate-range": "tsx scripts/content/generate-range.ts",
    "content:validate": "tsx scripts/content/validate-all.ts",
    "content:review": "tsx scripts/content/review-case.ts",
    "content:review-range": "tsx scripts/content/review-range.ts",
    "quality": "pnpm typecheck && pnpm test && pnpm content:validate && pnpm build"
  }
}
```

- [ ] **Step 6: Write the failing foundation test**

Create `src/test/foundation.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { cn } from "@/lib/utils"

describe("application foundation", () => {
  it("merges Tailwind classes through the shadcn utility", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
})
```

- [ ] **Step 7: Configure Vitest and run the foundation test**

Create `vitest.config.ts`:

```ts
import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
})
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest"
```

Run:

```bash
pnpm test -- src/test/foundation.test.ts
pnpm typecheck
```

Expected: one passing test and no TypeScript errors.

- [ ] **Step 8: Commit the foundation**

```bash
git add package.json pnpm-lock.yaml components.json vite.config.ts vitest.config.ts src
git commit -m "chore: scaffold Whereabouts application"
```

## Task 2: Define the case contract, complete fixtures, and publication manifest

**Files:**
- Create: `src/features/cases/schema.ts`
- Create: `src/features/cases/schema.test.ts`
- Create: `src/test/fixtures/case.ts`
- Create: `content/manifest.json`
- Create: `content/cases/2026-08-14/v1.json`

- [ ] **Step 1: Write schema tests before the schema**

Create `src/features/cases/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { dailyCaseSchema } from "./schema"
import { makeCase } from "@/test/fixtures/case"

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
pnpm test -- src/features/cases/schema.test.ts
```

Expected: FAIL because `schema.ts` and the fixture do not exist.

- [ ] **Step 3: Implement the exact case schema**

Create `src/features/cases/schema.ts` with these public types and invariants:

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

Create `src/test/fixtures/case.ts`. Export `makeCase(overrides?: Partial<DailyCase>): DailyCase`; build 25 POIs with `Array.from`, make `poi-00` the target, create six source-backed clues, and create responses for `poi-01` through `poi-24`. Use valid URLs and fixed ISO timestamps. Return a deep mutable object so tests may alter it without cross-test leakage.

- [ ] **Step 5: Add one complete hand-authored development case and manifest**

Create `content/cases/2026-08-14/v1.json` using the production schema. Use Istanbul as the target destination, Hagia Sophia as the target POI, and 24 globally distributed, recognizable distractors. Every pre-reveal statement must omit `Istanbul`, `Turkey`, and `Hagia Sophia`; every factual section must cite at least one source record.

Create `content/manifest.json`:

```json
{
  "schemaVersion": 1,
  "cases": {
    "2026-08-14": {
      "caseNumber": 1,
      "revision": 1,
      "file": "/content/cases/2026-08-14/v1.json"
    }
  }
}
```

- [ ] **Step 6: Run schema tests and validate the development artifact**

```bash
pnpm test -- src/features/cases/schema.test.ts
pnpm exec tsx -e "import c from './content/cases/2026-08-14/v1.json' with { type: 'json' }; import { dailyCaseSchema } from './src/features/cases/schema.ts'; dailyCaseSchema.parse(c)"
```

Expected: all schema tests pass and the one-off parser exits 0.

- [ ] **Step 7: Commit the case contract**

```bash
git add src/features/cases src/test/fixtures content
git commit -m "feat: define revisioned daily case format"
```

## Task 3: Implement the pure game engine with TDD

**Files:**
- Create: `src/features/game/progress-schema.ts`
- Create: `src/features/game/engine.ts`
- Create: `src/features/game/engine.test.ts`

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
pnpm test -- src/features/game/engine.test.ts
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

- [ ] **Step 4: Run engine tests and type checking**

```bash
pnpm test -- src/features/game/engine.test.ts
pnpm typecheck
```

Expected: eight passing engine tests and no TypeScript errors.

- [ ] **Step 5: Commit the game engine**

```bash
git add src/features/game/progress-schema.ts src/features/game/engine.ts src/features/game/engine.test.ts
git commit -m "feat: add pure Whereabouts game engine"
```

## Task 4: Add safe browser persistence and date helpers

**Files:**
- Create: `src/features/game/storage.ts`
- Create: `src/features/game/storage.test.ts`
- Create: `src/features/game/date.ts`
- Create: `src/features/game/date.test.ts`

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
pnpm test -- src/features/game/storage.test.ts src/features/game/date.test.ts
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

- [ ] **Step 5: Run focused tests**

```bash
pnpm test -- src/features/game/storage.test.ts src/features/game/date.test.ts
```

Expected: all persistence and calendar tests pass.

- [ ] **Step 6: Commit persistence**

```bash
git add src/features/game/storage.ts src/features/game/storage.test.ts src/features/game/date.ts src/features/game/date.test.ts
git commit -m "feat: persist dated game progress in browser"
```

## Task 5: Load only published cases through a TanStack server boundary

**Files:**
- Create: `src/features/cases/case-loader.server.ts`
- Create: `src/features/cases/case-loader.server.test.ts`
- Create: `src/features/cases/case-functions.ts`

- [ ] **Step 1: Write loader tests**

Test a pure injected loader before wiring it to Vite globals:

```ts
it("loads and validates the manifest-selected revision")
it("returns null for a syntactically valid unpublished date")
it("rejects a manifest entry whose artifact date or revision differs")
```

Use a fixture manifest and a map keyed by `/content/cases/2026-08-14/v1.json`.

- [ ] **Step 2: Run the loader tests to verify failure**

```bash
pnpm test -- src/features/cases/case-loader.server.test.ts
```

Expected: FAIL because the loader does not exist.

- [ ] **Step 3: Implement the injected loader and production sources**

`case-loader.server.ts` must use:

```ts
const caseModules = import.meta.glob("/content/cases/**/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>
```

Parse `content/manifest.json` with a Zod manifest schema. Export `loadPublishedCase(date)` plus a dependency-injected `createCaseLoader(manifest, modules)` used by tests. Verify the artifact's date and revision match the manifest entry. Return `null` rather than throwing for a date absent from the public manifest; throw a typed `CaseContentError` for a corrupt published artifact. Future artifacts may exist privately in the repository, but they are unreachable until the publication workflow adds them to the manifest.

- [ ] **Step 4: Expose the loader with a validated server function**

Create `case-functions.ts`:

```ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { listPublishedCases, loadPublishedCase } from "./case-loader.server"

export const getPublishedCase = createServerFn({ method: "GET" })
  .validator(z.object({ date: z.string().date() }))
  .handler(async ({ data }) => loadPublishedCase(data.date))

export const getPublishedCaseIndex = createServerFn({ method: "GET" })
  .handler(async () => listPublishedCases())
```

`listPublishedCases()` returns only `{ date, caseNumber }` records, newest first. The manifest is the publication boundary. Task 12 validates that it contains no date later than the configured publication ceiling, and Task 15 adds reviewed entries only when their release date arrives.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm test -- src/features/cases/case-loader.server.test.ts
pnpm typecheck
git add src/features/cases
git commit -m "feat: load published cases through server functions"
```

## Task 6: Build canonical date routing and briefing-unavailable states

**Files:**
- Modify: `src/routes/__root.tsx`
- Modify: `src/routes/index.tsx`
- Create: `src/routes/$date.tsx`
- Create: `src/features/game/briefing-unavailable.tsx`
- Create: `src/features/game/route-state.test.tsx`

- [ ] **Step 1: Write route-level component tests**

Use a memory router or test the extracted route components. Assert that `/` renders a loading label before browser date resolution, then navigates to `/2026-08-14`; a valid unpublished date renders `Briefing unavailable`; and malformed dates render the not-found component.

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test -- src/features/game/route-state.test.tsx
```

- [ ] **Step 3: Implement `/` as a client-local-date redirect**

`index.tsx` should call `formatLocalDate(new Date())` in an effect and navigate with `replace: true` to `/$date`. During SSR and hydration it renders a compact `Preparing today’s briefing…` shell, preventing a server-timezone mismatch.

- [ ] **Step 4: Implement the canonical `$date` route**

Validate the parameter with `parseCaseDate` before calling `getPublishedCase` from the route loader. Return `{ caseData }`; render `BriefingUnavailable` for `null`; render `<GameScreen caseData={caseData} />` otherwise. Supply route metadata using the string template ``Whereabouts — ${date}`` without revealing the answer.

- [ ] **Step 5: Run route tests, type checking, and commit**

```bash
pnpm test -- src/features/game/route-state.test.tsx
pnpm typecheck
git add src/routes src/features/game/briefing-unavailable.tsx src/features/game/route-state.test.tsx
git commit -m "feat: add canonical daily and historical routes"
```

## Task 7: Establish the Whereabouts Tailwind theme and static briefing components

**Files:**
- Modify: `src/styles.css`
- Create: `src/features/game/case-header.tsx`
- Create: `src/features/game/clue-card.tsx`
- Create: `src/features/game/briefing-layout.tsx`
- Create: `src/features/game/briefing-layout.test.tsx`

- [ ] **Step 1: Write the briefing component test**

Render the static layout with fixture data and progress. Assert the accessible heading is `Whereabouts`, the case label is present, clue one is visible, clues two through six are absent, and `6 attempts remaining` is announced in text rather than by color alone.

- [ ] **Step 2: Run the test to verify failure**

```bash
pnpm test -- src/features/game/briefing-layout.test.tsx
```

- [ ] **Step 3: Define the visual tokens in Tailwind CSS v4**

Add semantic variables to `src/styles.css` using OKLCH:

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
pnpm test -- src/features/game/briefing-layout.test.tsx
pnpm typecheck
git add src/styles.css src/features/game
git commit -m "feat: add mobile intelligence briefing design"
```

## Task 8: Build the accessible POI search and confirmation dossier

**Files:**
- Create: `src/features/game/poi-search.tsx`
- Create: `src/features/game/poi-dossier.tsx`
- Create: `src/features/game/poi-picker.tsx`
- Create: `src/features/game/poi-picker.test.tsx`

- [ ] **Step 1: Write interaction tests**

With Testing Library and `userEvent`, assert that a user can search by POI, city, or country; select a result; review its full dossier; cancel without guessing; confirm once; and cannot select an already-guessed POI.

- [ ] **Step 2: Run the tests to verify failure**

```bash
pnpm test -- src/features/game/poi-picker.test.tsx
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
pnpm test -- src/features/game/poi-picker.test.tsx
pnpm typecheck
git add src/features/game/poi-search.tsx src/features/game/poi-dossier.tsx src/features/game/poi-picker.tsx src/features/game/poi-picker.test.tsx
git commit -m "feat: add accessible POI selection flow"
```

## Task 9: Add the lazy 3D globe and dependable list-only fallback

**Files:**
- Create: `src/features/globe/webgl.ts`
- Create: `src/features/globe/webgl.test.ts`
- Create: `src/features/globe/globe-picker.tsx`
- Create: `src/features/globe/globe-canvas.client.tsx`
- Modify: `src/features/game/poi-picker.tsx`

- [ ] **Step 1: Write WebGL and fallback tests**

Mock `HTMLCanvasElement.getContext` to return `null` and assert `supportsWebGl()` is false. Render `GlobePicker` with `supported={false}` and assert the searchable-list control remains present and an explanatory `Globe unavailable; use location list` status is announced.

- [ ] **Step 2: Run the tests to verify failure**

```bash
pnpm test -- src/features/globe/webgl.test.ts
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
pnpm test -- src/features/globe/webgl.test.ts src/features/game/poi-picker.test.tsx
pnpm typecheck
git add src/features/globe src/features/game/poi-picker.tsx
git commit -m "feat: add interactive globe with list fallback"
```

## Task 10: Compose gameplay, contextual feedback, and the final reveal

**Files:**
- Create: `src/features/game/feedback-panel.tsx`
- Create: `src/features/game/result-panel.tsx`
- Create: `src/features/game/game-screen.tsx`
- Create: `src/features/game/game-screen.test.tsx`
- Modify: `src/features/game/briefing-layout.tsx`

- [ ] **Step 1: Write complete screen-flow tests**

Test one wrong guess followed by a correct guess. Assert: progress is saved after each confirmation; the wrong POI is eliminated; its authored feedback and `warm` label appear; clue two unlocks; the correct guess renders the reveal and source links; and input controls are disabled after completion. Add a six-wrong-guess loss test.

- [ ] **Step 2: Run the tests to verify failure**

```bash
pnpm test -- src/features/game/game-screen.test.tsx
```

- [ ] **Step 3: Implement feedback and reveal components**

`FeedbackPanel` maps `cold`, `warm`, and `hot` to both text and theme colors. `ResultPanel` receives the case, progress, and `onShare`; it renders `Case closed` or `Trail lost`, target POI, destination, reveal summary, clue explanation, and only the referenced source links. When an image exists, render its alt text plus visible attribution and license links; otherwise render the neutral gradient fallback.

- [ ] **Step 4: Implement `GameScreen` as the orchestration boundary**

Initialize with `loadProgress(caseData)` in a client-safe lazy state initializer. Derive clues, latest feedback, and remaining attempts through engine functions. On confirmation, call `applyGuess`, update React state, then `saveProgress`. Do not duplicate rule logic in JSX.

- [ ] **Step 5: Verify and commit**

```bash
pnpm test -- src/features/game/game-screen.test.tsx
pnpm typecheck
git add src/features/game
git commit -m "feat: connect daily case gameplay and reveal"
```

## Task 11: Add deterministic sharing and the historical archive

**Files:**
- Create: `src/features/game/share.ts`
- Create: `src/features/game/share.test.ts`
- Create: `src/features/game/archive-drawer.tsx`
- Create: `src/features/game/archive-drawer.test.tsx`
- Modify: `src/features/game/result-panel.tsx`
- Modify: `src/features/game/case-header.tsx`

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
pnpm test -- src/features/game/share.test.ts src/features/game/archive-drawer.test.tsx
```

- [ ] **Step 3: Implement share text and platform fallback**

Export:

```ts
export function buildShareText(caseData: DailyCase, progress: GameProgress, origin: string): string
export async function shareResult(text: string, navigatorValue: Pick<Navigator, "share" | "clipboard">): Promise<"shared" | "copied">
```

Map tokens to `🔵`, `🟡`, `🟠`, and `🟢`. Treat `AbortError` as cancellation and do not copy; use clipboard for unsupported APIs and non-cancellation failures.

- [ ] **Step 4: Implement the secondary archive drawer**

Call `getPublishedCaseIndex()` through the existing case server boundary. Render newest first in a shadcn Drawer, mark today, and link with `to="/$date"` and `{ date }` params. Do not show target names or future cases.

- [ ] **Step 5: Verify and commit**

```bash
pnpm test -- src/features/game/share.test.ts src/features/game/archive-drawer.test.tsx
pnpm typecheck
git add src/features/game src/features/cases
git commit -m "feat: add spoiler-free sharing and case archive"
```

## Task 12: Build deterministic content validation before AI generation

**Files:**
- Create: `scripts/content/validate-case.ts`
- Create: `scripts/content/validate-case.test.ts`
- Create: `scripts/content/validate-all.ts`
- Create: `content/catalog/pois.json`

- [ ] **Step 1: Write publication-validation tests**

Test valid content and separate failures for target-name leakage, city leakage, country leakage, duplicate coordinates, missing source references, target repetition within 30 cases, excessive distractor repetition, manifest/file mismatch, and a future public manifest entry.

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test -- scripts/content/validate-case.test.ts
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

`validate-all.ts` loads every artifact referenced by the manifest, rejects missing artifacts, rejects unreferenced artifacts whose publication date is at or before the ceiling, allows unreferenced future artifacts awaiting publication, calls collection validation with `PUBLICATION_CEILING` or today's UTC date, prints one issue per line, and exits 1 if any issue exists.

- [ ] **Step 6: Verify and commit**

```bash
pnpm test -- scripts/content/validate-case.test.ts
pnpm content:validate
git add scripts/content/validate-case.ts scripts/content/validate-case.test.ts scripts/content/validate-all.ts content/catalog/pois.json
git commit -m "feat: enforce case publication safeguards"
```

## Task 13: Implement Wikipedia retrieval and AI SDK structured generation

**Files:**
- Create: `scripts/content/wikipedia.ts`
- Create: `scripts/content/wikipedia.test.ts`
- Create: `scripts/content/prompt.ts`
- Create: `scripts/content/generate-case.ts`
- Create: `scripts/content/generate-case.test.ts`
- Create: `scripts/content/generate-range.ts`
- Create: `scripts/content/review-case.ts`
- Create: `scripts/content/fixtures/model-output.json`
- Create: `.env.example`

- [ ] **Step 1: Write recorded pipeline tests**

Mock `fetch` and the model call. Assert that Wikipedia requests use `https://en.wikipedia.org/w/api.php` with `action=query`, `prop=extracts|info`, `explaintext=1`, `inprop=url`, `redirects=1`, and a descriptive `Api-User-Agent`. Assert that recorded structured output is converted into a valid `DailyCase`, fails closed on unsupported source IDs, and never writes a file when publication validation reports issues.

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test -- scripts/content/wikipedia.test.ts scripts/content/generate-case.test.ts
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

Join trusted catalog metadata and source records into the draft rather than asking the model to reproduce coordinates or URLs. Parse the final object with `dailyCaseSchema`, then call `validateCaseForPublication`. Write to the interpolated path ``content/cases/${date}/v1.json`` only when both pass. Refuse to overwrite an existing revision.

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
pnpm test -- scripts/content/wikipedia.test.ts scripts/content/generate-case.test.ts
pnpm content:validate
git add scripts/content .env.example package.json
git commit -m "feat: generate source-backed cases with AI SDK"
```

## Task 14: Add Playwright end-to-end coverage for desktop and mobile

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/helpers.ts`
- Create: `e2e/whereabouts.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Install the Chromium browser used in local and CI tests**

```bash
pnpm exec playwright install chromium
```

- [ ] **Step 2: Configure Playwright**

Create `playwright.config.ts`:

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
git add playwright.config.ts e2e package.json pnpm-lock.yaml
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

On pull requests and pushes to `main`, use Node 22 and pnpm, run `pnpm install --frozen-lockfile`, `pnpm exec playwright install --with-deps chromium`, `pnpm quality`, and `pnpm test:e2e`. Give the workflow read-only repository permissions.

- [ ] **Step 2: Add the minimum viable scheduled publisher**

Run weekly and by `workflow_dispatch`. Give only `contents: write` and `pull-requests: write`. Generate seven days beginning 14 days from the run date, validate all content, create human review packets as workflow artifacts, and open a pull request titled `content: add upcoming Whereabouts cases`. Never push directly to `main`.

The generation job must read `OPENAI_API_KEY` and `WIKIMEDIA_USER_AGENT` from repository secrets and set `WHEREABOUTS_MODEL` from a repository variable with `gpt-5-mini` as the fallback.

- [ ] **Step 3: Add the daily publication workflow**

Run daily and by `workflow_dispatch`. Compute the UTC calendar date, verify that `content/cases/$DATE/v1.json` already exists on `main`, add only that reviewed artifact to `content/manifest.json`, run `PUBLICATION_CEILING=$DATE pnpm content:validate`, commit with `content: publish Whereabouts case $DATE`, and push to `main`. If the artifact is absent or the date is already published, exit successfully without changing the repository. This workflow does not call a model and never publishes an unreviewed artifact.

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
pnpm content:generate-range -- --from 2026-08-14 --days 30
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
git add content docs/launch-checklist.md
git commit -m "content: prepare Whereabouts launch cases"
```

## Reference documentation

- [TanStack Start getting started](https://tanstack.com/start/latest/docs/framework/react/getting-started)
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
