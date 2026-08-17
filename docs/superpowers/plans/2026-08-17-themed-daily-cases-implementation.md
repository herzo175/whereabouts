# Themed Daily Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace corpus-selected daily boards with autonomously themed, live-researched five-round cases, published as immutable, audited artifacts through automatically checked pull requests.

**Architecture:** Preserve the static runtime, manifest loader, game engine, and scoring. Add a version 3 themed case contract and build a Python Pydantic AI generator under `agent/`, managed with `uv`. The agent plans a theme, uses model knowledge first, optionally calls provider-adaptive WebSearch/WebFetch tools for uncertain facts, curates a board, writes rounds, independently critiques theme fit and clue-answer alignment, repairs bounded defects, and hands a complete atomic batch to the TypeScript publisher. Store a machine-readable generation review beside each case so repository validation can prove that semantic checks ran.

**Tech Stack:** TypeScript 5.9, Zod 4, React 19, Vitest 4, Testing Library, Playwright, Python, Pydantic AI, Pydantic, uv, GitHub Actions, GitHub CLI, pnpm/Turbo, Biome.

---

## Parallel execution map

Use one worktree or branch per subagent. Do not run two tasks that own the same file at the same time. Integrate each wave before starting tasks that depend on it.

```text
Wave 0:  Task 1 (case contract foundation)
             |
Wave 1:  Task 2 (web UI) ───────────────┐
         Task 3 (agent contracts/data) ─┼─ independent after Task 1
         Task 4 (validation/reviews) ───┘
             |
Wave 2:  Task 5 (buffer/publication) ─────┐
         Task 6 (theme/research agents) ──┤
         Task 7 (curator/writer agents) ──┼─ independent after Wave 1
         Task 8 (critic/repair agent) ────┘
             |
Wave 3:  Task 9 (orchestrator integration; single owner)
             |
Wave 4:  Task 10 (CLI/corpus/docs cleanup) ─┐
         Task 11 (GitHub PR workflow) ──────┘
             |
Wave 5:  Task 12 (full verification and 10-case bootstrap)
```

Before dispatching a wave, give every subagent the exact commit produced by its dependencies. A subagent may change only the files listed under its task. The integration owner resolves any post-merge type drift; parallel workers must not make opportunistic edits in another task's files.

## Locked file structure

### Case contract and runtime

- `packages/case-content/src/schema.ts` — version 2 compatibility and version 3 themed contract.
- `packages/case-content/src/schema.test.ts` — parsing and target-membership regressions.
- `packages/case-content/test/fixtures.ts` — explicit version 2 and version 3 fixtures.
- `packages/case-content/src/index.ts` — public themed types.
- `packages/case-content/src/loader.server.test.ts` — mixed archive compatibility.

### Web experience

- `apps/web/src/features/game/theme-briefing.tsx` — persistent player-facing theme summary.
- `apps/web/src/features/game/theme-briefing.test.tsx` — theme summary behavior.
- `apps/web/src/features/game/five-round-game-screen.tsx` — place the summary in play, reveal, and completion states.
- `apps/web/src/features/game/five-round-game-screen.test.tsx` — version 3 theme visibility.
- `apps/web/src/features/game/round-reveal.tsx` — show cited theme connections after a guess.

### Agent contracts and stages

- `packages/content-tools/src/themed-case/contracts.ts` — every typed stage boundary.
- `packages/content-tools/src/themed-case/fixtures.ts` — shared content-tool test data.
- `packages/content-tools/src/themed-case/live-research.ts` — source search and hydration adapter.
- `packages/content-tools/src/themed-case/live-research.test.ts` — HTTP parsing and failure behavior.
- `packages/content-tools/src/themed-case/model.ts` — shared OpenRouter structured-output client.
- `packages/content-tools/src/themed-case/theme-planner.ts` — autonomous theme selection.
- `packages/content-tools/src/themed-case/theme-planner.test.ts` — novelty and viability behavior.
- `packages/content-tools/src/themed-case/candidate-researcher.ts` — query planning and candidate-pool construction.
- `packages/content-tools/src/themed-case/candidate-researcher.test.ts` — candidate verification and replacement.
- `packages/content-tools/src/themed-case/board-curator.ts` — strict 25-member board and five-target selection.
- `packages/content-tools/src/themed-case/board-curator.test.ts` — theme fit and target-history behavior.
- `packages/content-tools/src/themed-case/case-writer.ts` — clues, relationships, and deterministic tiers.
- `packages/content-tools/src/themed-case/case-writer.test.ts` — coverage, citations, and tier ordering.
- `packages/content-tools/src/themed-case/case-critic.ts` — independent semantic review and bounded repair decisions.
- `packages/content-tools/src/themed-case/case-critic.test.ts` — outsider and clue-answer regressions.
- `packages/content-tools/src/themed-case/orchestrator.ts` — stage sequencing and selective retries.
- `packages/content-tools/src/themed-case/orchestrator.test.ts` — end-to-end injected stage behavior.

### Validation, review, publication, and automation

- `packages/content-tools/src/generation-review.ts` — machine-readable semantic audit schema.
- `packages/content-tools/src/generation-review.test.ts` — audit completeness and identity matching.
- `packages/content-tools/src/validate-case.ts` — version-aware deterministic validation.
- `packages/content-tools/src/validate-case.test.ts` — version 3 and semantic-audit invariants.
- `packages/content-tools/src/validate-all.ts` — require a matching audit for every version 3 manifest entry.
- `packages/content-tools/src/validate-all.test.ts` — missing or mismatched audit failures.
- `packages/content-tools/src/review-case.ts` — themed Markdown review packets.
- `packages/content-tools/src/review-case.test.ts` — human review content.
- `packages/content-tools/src/paths.ts` — case, audit, and Markdown review paths.
- `packages/content-tools/src/publication-buffer.ts` — date-window and immutable-revision planning.
- `packages/content-tools/src/publication-buffer.test.ts` — Eastern-date buffer behavior.
- `packages/content-tools/src/publish-batch.ts` — validate complete batch before repository writes.
- `packages/content-tools/src/publish-batch.test.ts` — all-or-nothing preparation behavior.
- `packages/content-tools/src/generate-case.ts` — version 3 assembly entry point.
- `packages/content-tools/src/generate-case.test.ts` — orchestrated case output.
- `packages/content-tools/src/generate-range.ts` — bootstrap and buffer CLI.
- `packages/content-tools/src/generate-range.test.ts` — batch and missing-date behavior.
- `.github/workflows/generate-cases.yml` — branch, PR, checks, and auto-merge.

---

### Task 1: Add the version 3 themed case contract without breaking version 2 archives

**Depends on:** none

**Exclusive files:** `packages/case-content/src/schema.ts`, `packages/case-content/src/schema.test.ts`, `packages/case-content/test/fixtures.ts`, `packages/case-content/src/index.ts`, `packages/case-content/src/loader.server.test.ts`

- [ ] **Step 1: Write failing version 3 schema tests**

Add tests that accept a themed fixture, reject a missing theme connection, reject an unknown theme source, and retain version 2 parsing:

```ts
it('accepts a sourced version 3 themed case', () => {
  const parsed = dailyCaseSchema.parse(makeThemedCase());
  expect(parsed.schemaVersion).toBe(3);
  if (parsed.schemaVersion !== 3) throw new Error('expected version 3');
  expect(parsed.theme.title).toBe('Railway Hotels');
  expect(parsed.pois.every((poi) => poi.themeConnection.sourceIds.length > 0)).toBe(true);
});

it('rejects a version 3 target that is absent from the board', () => {
  const value = makeThemedCase();
  value.rounds[0].targetPoiId = 'off-board-hotel';
  expect(() => dailyCaseSchema.parse(value)).toThrow(/target.*board/i);
});

it('continues to parse version 2 archives', () => {
  expect(dailyCaseSchema.parse(makeFiveRoundCase()).schemaVersion).toBe(2);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `pnpm --filter @whereabouts/case-content test -- schema.test.ts loader.server.test.ts`

Expected: FAIL because `makeThemedCase` and schema version 3 do not exist.

- [ ] **Step 3: Add explicit union types and parsers**

Keep the existing version 2 type as `FiveRoundDailyCaseV2`; make the public `FiveRoundDailyCase` the playable union so game-engine and browser-state signatures remain source compatible:

```ts
export type DailyTheme = {
  title: string;
  introduction: string;
  inclusionCriteria: string;
};

export type ThemeConnection = { text: string; sourceIds: string[] };
export type ThemedPoi = Poi & { themeConnection: ThemeConnection };
export type FiveRoundDailyCaseV2 = {
  schemaVersion: 2;
  publicationDate: string;
  revision: number;
  caseNumber: number;
  pois: Poi[];
  rounds: DailyRound[];
  sources: Source[];
};
export type ThemedDailyCase = Omit<FiveRoundDailyCaseV2, 'schemaVersion' | 'pois'> & {
  schemaVersion: 3;
  theme: DailyTheme;
  pois: ThemedPoi[];
};
export type FiveRoundDailyCase = FiveRoundDailyCaseV2 | ThemedDailyCase;
export type DailyCase = FiveRoundDailyCase;
```

Parse common fields once. Route `schemaVersion === 2` through the legacy POI parser and `schemaVersion === 3` through `parseThemedPoi`. Require theme title length 3, introduction length 20, inclusion criteria length 20, theme-connection text length 20, and at least one known source ID. Preserve the existing exact board, round, result, target, image, and source invariants for both versions.

- [ ] **Step 4: Add deterministic fixtures**

Keep `makeFiveRoundCase()` returning version 2. Add:

```ts
export function makeThemedCase(
  overrides: Partial<ThemedDailyCase> = {},
): ThemedDailyCase {
  const legacy = makeFiveRoundCase();
  return {
    ...legacy,
    schemaVersion: 3,
    theme: {
      title: 'Railway Hotels',
      introduction: 'Twenty-five hotels shaped by the golden age of rail travel.',
      inclusionCriteria: 'Each candidate was built, owned, or formally operated as a railway hotel.',
    },
    pois: legacy.pois.map((poi) => ({
      ...poi,
      themeConnection: {
        text: `${poi.name} is documented as a hotel built or operated for railway travelers.`,
        sourceIds: ['source-01'],
      },
    })),
    ...overrides,
  };
}
```

- [ ] **Step 5: Export the new types and prove mixed archive loading**

Export `DailyTheme`, `ThemeConnection`, `ThemedPoi`, `ThemedDailyCase`, and `FiveRoundDailyCaseV2`. Add a loader test with one version 2 module and one version 3 module and assert both dates appear in reverse chronological order.

- [ ] **Step 6: Run contract tests and typecheck**

Run: `pnpm --filter @whereabouts/case-content test && pnpm --filter @whereabouts/case-content typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/case-content
git commit -m "feat(content): add themed case contract"
```

---

### Task 2: Show the theme throughout the player experience

**Depends on:** Task 1

**Exclusive files:** `apps/web/src/features/game/theme-briefing.tsx`, `apps/web/src/features/game/theme-briefing.test.tsx`, `apps/web/src/features/game/five-round-game-screen.tsx`, `apps/web/src/features/game/five-round-game-screen.test.tsx`, `apps/web/src/features/game/round-reveal.tsx`

- [ ] **Step 1: Write failing UI tests**

Use `makeThemedCase()` and assert the theme is visible before the first guess, while the theme connection is absent pre-guess and appears in the reveal:

```tsx
expect(screen.getByRole('heading', { name: 'Railway Hotels' })).toBeVisible();
expect(screen.getByText(/golden age of rail travel/i)).toBeVisible();
expect(screen.queryByText(/documented as a hotel built/i)).toBeNull();

const user = userEvent.setup();
await user.click(screen.getByRole('button', { name: /place 10/i }));
await user.click(screen.getByRole('button', { name: /submit this lead/i }));
expect(screen.getAllByText(/why it fits today's theme/i)).toHaveLength(2);
```

Add a version 2 test that asserts the game still renders and has no theme heading.

- [ ] **Step 2: Run the component test and verify failure**

Run: `pnpm --filter @whereabouts/web test -- five-round-game-screen.test.tsx theme-briefing.test.tsx`

Expected: FAIL because `ThemeBriefing` is missing.

- [ ] **Step 3: Create the theme briefing**

Implement a presentational component with this interface:

```tsx
type ThemeBriefingProps = { theme: DailyTheme };

export function ThemeBriefing({ theme }: ThemeBriefingProps) {
  return (
    <section aria-labelledby="daily-theme" className="border border-brass/40 bg-brass/10 p-5">
      <p className="text-xs font-semibold tracking-[0.18em] text-brass uppercase">Today's theme</p>
      <h2 className="mt-2 font-serif text-3xl text-paper" id="daily-theme">{theme.title}</h2>
      <p className="mt-2 leading-relaxed text-paper/85">{theme.introduction}</p>
    </section>
  );
}
```

Render it after `FiveRoundHeader` in the active-round, reveal, and completed-summary branches when `caseData.schemaVersion === 3`.

- [ ] **Step 4: Reveal theme evidence only in full dossiers**

Extend `FullDossier` in `round-reveal.tsx` with a version-safe property check:

```tsx
{'themeConnection' in poi ? (
  <section className="border-t border-foreground/10 pt-3">
    <p className="text-xs font-semibold tracking-[0.16em] uppercase">Why it fits today's theme</p>
    <p className="mt-2 text-sm leading-relaxed">{poi.themeConnection.text}</p>
  </section>
) : null}
```

Do not add the connection to `PoiPicker` or its identity-only dossier.

- [ ] **Step 5: Run component tests and accessibility-oriented queries**

Run: `pnpm --filter @whereabouts/web test -- five-round-game-screen.test.tsx theme-briefing.test.tsx`

Expected: PASS with the theme heading found by role and no pre-guess connection text.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/game
git commit -m "feat(web): present daily themes"
```

---

### Task 3: Lock the agent-stage contracts and live research adapter

**Depends on:** Task 1

**Exclusive files:** `packages/content-tools/src/themed-case/contracts.ts`, `packages/content-tools/src/themed-case/fixtures.ts`, `packages/content-tools/src/themed-case/live-research.ts`, `packages/content-tools/src/themed-case/live-research.test.ts`, `packages/content-tools/src/themed-case/model.ts`

- [ ] **Step 1: Write failing contract and source-adapter tests**

Test that proposal and hydrated candidate pools require 35–50 unique Wikipedia titles, curated boards require 25 unique IDs and five on-board targets, case drafts cover all candidates, and repair requests contain their required identifiers. Test Wikipedia search, coordinates, extracts, and missing images with injected `fetch`.

- [ ] **Step 2: Run the tests and verify failure**

Run: `pnpm --filter @whereabouts/content-tools test -- themed-case/live-research.test.ts`

Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Define complete Zod stage contracts**

Export these schemas and inferred types from `contracts.ts`:

```ts
export const themePlanSchema = z.object({
  title: z.string().min(3),
  introduction: z.string().min(20),
  inclusionCriteria: z.string().min(20),
  exclusions: z.array(z.string().min(10)).min(1),
  searchQueries: z.array(z.string().min(3)).min(3).max(12),
});

export const researchedCandidateSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2),
  city: z.string().min(1),
  country: z.string().min(2),
  wikipediaTitle: z.string().min(2),
  themeClaim: z.string().min(20),
});

export const candidateProposalPoolSchema = z.object({
  theme: themePlanSchema,
  candidates: z.array(researchedCandidateSchema).min(35).max(50),
});
```

Define the remaining stage schemas with these exact fields:

```ts
export const hydratedCandidateSchema = researchedCandidateSchema.extend({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  source: z.object({
    title: z.string().min(1),
    url: z.string().url(),
    retrievedAt: z.string().datetime(),
    extract: z.string().min(100),
  }),
  image: z.object({
    url: z.string().url(),
    alt: z.string().min(5),
    attribution: z.string().min(3),
    licenseUrl: z.string().url(),
  }),
});

export const candidatePoolSchema = z.object({
  theme: themePlanSchema,
  candidates: z.array(hydratedCandidateSchema).min(35).max(50),
});

export const curatedBoardSchema = z.object({
  theme: themePlanSchema,
  candidates: z.array(hydratedCandidateSchema).length(25),
  targetPoiIds: z.array(z.string()).length(5),
});

export const scoredResultSchema = z.object({
  poiId: z.string(),
  similarityScore: z.number().min(0).max(100),
  text: z.string().min(10),
  evidencePoiIds: z.array(z.string()).min(1),
});

export type ScoredResult = z.infer<typeof scoredResultSchema>;

export const caseDraftSchema = z.object({
  rounds: z.array(z.object({
    targetPoiId: z.string(),
    clue: z.object({ text: z.string().min(20), evidencePoiIds: z.array(z.string()).min(1) }),
    results: z.array(scoredResultSchema).length(25),
  })).length(5),
});

export const repairRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('theme'), reason: z.string().min(10) }),
  z.object({ kind: z.literal('candidate'), poiId: z.string(), reason: z.string().min(10) }),
  z.object({ kind: z.literal('clue'), roundId: z.string(), reason: z.string().min(10) }),
  z.object({ kind: z.literal('relationship'), roundId: z.string(), poiId: z.string(), reason: z.string().min(10) }),
]);

export type ThemePlan = z.infer<typeof themePlanSchema>;
export type ResearchedCandidate = z.infer<typeof researchedCandidateSchema>;
export type HydratedCandidate = z.infer<typeof hydratedCandidateSchema>;
export type CandidatePool = z.infer<typeof candidatePoolSchema>;
export type CuratedBoard = z.infer<typeof curatedBoardSchema>;
export type CaseDraft = z.infer<typeof caseDraftSchema>;
export type RepairRequest = z.infer<typeof repairRequestSchema>;
```

Add `superRefine` checks for unique candidate IDs and coordinates, unique target IDs drawn from the curated candidates, round targets matching the five selected targets in order, and exact result coverage of every candidate.

- [ ] **Step 4: Implement the source boundary**

Expose an injected interface:

```ts
export type LiveResearch = {
  search(query: string, limit: number): Promise<Array<{ title: string; snippet: string }>>;
  hydrate(candidate: ResearchedCandidate): Promise<HydratedCandidate | null>;
};

export function createWikimediaResearch(dependencies?: {
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  userAgent?: string;
}): LiveResearch;
```

Use MediaWiki `list=search` for discovery and `prop=extracts|info|pageprops` for canonical title, source text, URL, and the linked Wikidata entity ID. Resolve that entity through Wikidata `wbgetentities` with `claims|labels`, read coordinates from `P625`, country from `P17`, and administrative location from `P131`, and resolve the referenced English labels in one follow-up `wbgetentities` request. Reuse `fetchWikipediaImage` for attributed Wikimedia imagery. Return `null` for a missing Wikidata entity, coordinates, country, extract, or image/license data. Use the verified Wikidata labels for `city` and `country` rather than trusting model-authored labels. Do not write any cache file.

- [ ] **Step 5: Add a shared structured-output model client**

Expose:

```ts
export type StructuredModel = {
  generate<T>(input: { schema: z.ZodType<T>; prompt: string; stage: string }): Promise<T>;
};

export function createOpenRouterModel(environment: NodeJS.ProcessEnv): StructuredModel;
```

Require `OPENROUTER_API_KEY`, default `WHEREABOUTS_MODEL` to `openai/gpt-5.6-luna`, use a 180-second abort timeout, zero SDK retries, and stage-qualified error messages.

- [ ] **Step 6: Run tests and typecheck**

Run: `pnpm --filter @whereabouts/content-tools test -- themed-case/live-research.test.ts && pnpm --filter @whereabouts/content-tools typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/content-tools/src/themed-case
git commit -m "feat(content): define themed research contracts"
```

---

### Task 4: Make semantic audits durable and publication validation version-aware

**Depends on:** Task 1

**Exclusive files:** `packages/content-tools/src/generation-review.ts`, `packages/content-tools/src/generation-review.test.ts`, `packages/content-tools/src/validate-case.ts`, `packages/content-tools/src/validate-case.test.ts`, `packages/content-tools/src/validate-all.ts`, `packages/content-tools/src/validate-all.test.ts`, `packages/content-tools/src/review-case.ts`, `packages/content-tools/src/review-case.test.ts`, `packages/content-tools/src/paths.ts`

- [ ] **Step 1: Write failing audit regression tests**

Add fixtures for a valid audit and these failures:

```ts
it('rejects a clue whose verified answer is off the board', () => {
  const review = makeGenerationReview();
  review.clueVerdicts[0] = {
    roundId: 'round-1',
    declaredTargetPoiId: 'poi-00',
    resolvedPoiId: null,
    resolvedOffBoardAnswer: 'The Off-Board Hotel',
    status: 'fail',
    explanation: 'The clue facts describe a hotel absent from the board.',
  };
  expect(validateGenerationReview(makeThemedCase(), review)).toContainEqual(
    expect.objectContaining({ path: 'clueVerdicts[0]', message: expect.stringMatching(/off-board|target/i) }),
  );
});
```

Also reject `resolvedPoiId` pointing to a different board member, missing candidate verdicts, a failed theme verdict, and a review whose date or revision differs from its case.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm --filter @whereabouts/content-tools test -- generation-review.test.ts validate-case.test.ts validate-all.test.ts review-case.test.ts`

Expected: FAIL because generation-review support does not exist.

- [ ] **Step 3: Add the machine-readable review contract**

Implement and export:

```ts
export const generationReviewSchema = z.object({
  schemaVersion: z.literal(1),
  publicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  revision: z.number().int().positive(),
  themeVerdicts: z.array(z.object({
    poiId: z.string(),
    status: z.enum(['pass', 'fail']),
    explanation: z.string().min(20),
    sourceIds: z.array(z.string()).min(1),
  })).length(25),
  clueVerdicts: z.array(z.object({
    roundId: z.string(),
    declaredTargetPoiId: z.string(),
    resolvedPoiId: z.string().nullable(),
    resolvedOffBoardAnswer: z.string().nullable(),
    status: z.enum(['pass', 'fail']),
    explanation: z.string().min(20),
  })).length(5),
  repairs: z.array(z.object({ stage: z.string(), summary: z.string().min(10) })),
});
```

`validateGenerationReview(caseData, review)` must require exactly one passing theme verdict per POI, exactly one passing clue verdict per round, `resolvedPoiId === declaredTargetPoiId === round.targetPoiId`, no off-board answer, and only known source IDs.

- [ ] **Step 4: Add canonical review paths**

Add path-safe helpers:

```ts
generationReviewPath(date, revision) // content/reviews/YYYY-MM-DD/vN.json
reviewMarkdownPath(date, revision)   // content/reviews/YYYY-MM-DD/vN.md
```

Validate canonical dates and positive revisions exactly as `casePath` does.

- [ ] **Step 5: Update version-aware validators**

Keep all existing v2 validation. For v3, additionally validate nonempty theme fields, theme-connection sources, and a matching generation review. Change `validateAll` to load `vN.json` review files for every manifested v3 case and report a missing, malformed, failed, or mismatched review. Do not require review files for v2 artifacts.

- [ ] **Step 6: Generate themed Markdown review packets**

For v3, render the theme, criteria, every candidate connection and citation, target list, clue verdicts, results, images, repairs, and final pass state. Keep the current v2 packet branch for archives.

- [ ] **Step 7: Run validation tests**

Run: `pnpm --filter @whereabouts/content-tools test -- generation-review.test.ts validate-case.test.ts validate-all.test.ts review-case.test.ts`

Expected: PASS, including both off-board and wrong-board-member clue regressions.

- [ ] **Step 8: Commit**

```bash
git add packages/content-tools/src
git commit -m "feat(content): persist semantic publication audits"
```

---

### Task 5: Add pure forward-buffer and batch-publication primitives

**Depends on:** Tasks 1 and 4

**Exclusive files:** `packages/content-tools/src/publication-buffer.ts`, `packages/content-tools/src/publication-buffer.test.ts`, `packages/content-tools/src/publish-batch.ts`, `packages/content-tools/src/publish-batch.test.ts`

- [ ] **Step 1: Write failing date-window tests**

Cover today plus nine following Eastern dates, missing-date selection, daylight-saving boundaries, next immutable revisions, and stable case numbers:

```ts
expect(bufferDates('2026-11-01', 10)).toEqual([
  '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05',
  '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10',
]);
expect(missingBufferDates(bufferDates('2026-11-01', 10), new Set(['2026-11-01']))).toHaveLength(9);
```

- [ ] **Step 2: Write a failing no-partial-write test**

Inject `validate` and `writeFile` dependencies. Assert that one invalid case results in zero writes, and a valid two-case batch writes two cases, two audit JSON files, two Markdown packets, then the manifest.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `pnpm --filter @whereabouts/content-tools test -- publication-buffer.test.ts publish-batch.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement pure buffer planning**

Export:

```ts
export function bufferDates(from: string, days = 10): string[];
export function missingBufferDates(window: string[], published: ReadonlySet<string>): string[];
export function caseNumberForDate(date: string): number;
export function nextRevision(date: string, existingPaths: string[]): number;
```

Use UTC date arithmetic on canonical date strings; the workflow supplies the Eastern-local start date. `caseNumberForDate` retains the current Unix-day calculation.

- [ ] **Step 5: Implement complete-batch preparation**

Use this boundary:

```ts
export type PreparedCase = {
  caseData: ThemedDailyCase;
  generationReview: GenerationReview;
  markdownReview: string;
};

export async function publishBatch(input: {
  prepared: PreparedCase[];
  manifest: CaseManifest;
  writeFile?: (path: string, data: string) => Promise<void>;
  exists?: (path: string) => Promise<boolean>;
}): Promise<CaseManifest>;
```

Define `CaseManifest` locally as `{ schemaVersion: 2; cases: Record<string, { caseNumber: number; revision: number; file: string }> }` and parse it before use.

Parse every case and review, validate every pair, validate the assembled collection and manifest entries, and check every destination is unused before invoking `writeFile`. Write formatted case JSON, audit JSON, Markdown, and manifest only after the preflight completes. Reject duplicate dates or destinations.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm --filter @whereabouts/content-tools test -- publication-buffer.test.ts publish-batch.test.ts`

Expected: PASS.

```bash
git add packages/content-tools/src/publication-buffer* packages/content-tools/src/publish-batch*
git commit -m "feat(content): prepare atomic case batches"
```

---

### Task 6: Implement autonomous theme planning and verified candidate research

**Depends on:** Task 3

**Exclusive files:** `packages/content-tools/src/themed-case/theme-planner.ts`, `packages/content-tools/src/themed-case/theme-planner.test.ts`, `packages/content-tools/src/themed-case/candidate-researcher.ts`, `packages/content-tools/src/themed-case/candidate-researcher.test.ts`

- [ ] **Step 1: Write failing planner tests**

Inject `StructuredModel`. Assert the prompt includes the previous 90 titles and criteria and rejects a normalized title-and-criteria duplicate. Candidate-pool insufficiency is tested in the researcher and retried later by the orchestrator.

- [ ] **Step 2: Write failing researcher tests**

Assert search-query results are deduplicated by canonical Wikipedia title, proposed candidates are hydrated through `LiveResearch`, unsupported candidates are dropped, and the result contains 35–50 verified candidates without writing a corpus file.

- [ ] **Step 3: Run tests and verify failure**

Run: `pnpm --filter @whereabouts/content-tools test -- themed-case/theme-planner.test.ts themed-case/candidate-researcher.test.ts`

Expected: FAIL because the agents are missing.

- [ ] **Step 4: Implement theme planning**

Expose:

```ts
export async function planTheme(input: {
  model: StructuredModel;
  recentThemes: Array<{ title: string; inclusionCriteria: string }>;
}): Promise<ThemePlan>;
```

The prompt must demand one narrow, player-readable thread, hard inclusion and exclusion rules, 3–12 discovery queries, at least 35 plausible locations, and material difference from all 90 supplied themes. Parse with `themePlanSchema`.

- [ ] **Step 5: Implement verified pool construction**

Expose:

```ts
export async function researchCandidates(input: {
  model: StructuredModel;
  research: LiveResearch;
  theme: ThemePlan;
}): Promise<CandidatePool>;
```

Run every search query, pass search titles/snippets and theme rules to the model for structured proposals, canonicalize IDs, hydrate each proposal, deduplicate canonical titles and coordinates, and return only hydrated candidates. Throw `InsufficientCandidatePoolError` below 35 so the orchestrator can choose another theme.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm --filter @whereabouts/content-tools test -- themed-case/theme-planner.test.ts themed-case/candidate-researcher.test.ts`

Expected: PASS.

```bash
git add packages/content-tools/src/themed-case/theme-planner* packages/content-tools/src/themed-case/candidate-researcher*
git commit -m "feat(content): research autonomous daily themes"
```

---

### Task 7: Implement strict board curation and grounded case writing

**Depends on:** Task 3

**Exclusive files:** `packages/content-tools/src/themed-case/board-curator.ts`, `packages/content-tools/src/themed-case/board-curator.test.ts`, `packages/content-tools/src/themed-case/case-writer.ts`, `packages/content-tools/src/themed-case/case-writer.test.ts`

- [ ] **Step 1: Write failing curator tests**

Test exact board and target counts, duplicate-coordinate rejection, exclusion of targets used in the previous 30 cases, and a prompt that states the hard inclusion and exclusion criteria. Include a railway-hotel pool containing Hoover Dam, make the injected curator model omit it, and reserve semantic rejection of a model-selected outsider for Task 8's independent critic test.

- [ ] **Step 2: Write failing writer tests**

Test five rounds, every target on the board, every round covering all 25 candidate IDs, target score 100, both target and guessed-candidate sources on non-target relationships, and deterministic four/eight/twelve tier bucketing.

- [ ] **Step 3: Run tests and verify failure**

Run: `pnpm --filter @whereabouts/content-tools test -- themed-case/board-curator.test.ts themed-case/case-writer.test.ts`

Expected: FAIL because curator and writer modules are missing.

- [ ] **Step 4: Implement board curation**

Expose:

```ts
export async function curateBoard(input: {
  model: StructuredModel;
  theme: ThemePlan;
  candidates: HydratedCandidate[];
  excludedTargetIds: ReadonlySet<string>;
}): Promise<CuratedBoard>;
```

Require the model to return 25 IDs and five target IDs from the supplied pool only. Reconstruct full candidates from IDs, never from model-authored copies. Reject any ID outside the researched pool, duplicate, missing ID, excluded target, or coordinate collision. The prompt states that all 25 entries must independently satisfy the theme and that distractor difficulty comes from within-theme distinctions. The independent critic remains the fail-closed semantic gate.

- [ ] **Step 5: Implement grounded writing and deterministic tiers**

Expose:

```ts
export async function writeCaseDraft(input: {
  model: StructuredModel;
  theme: ThemePlan;
  board: CuratedBoard;
}): Promise<CaseDraft>;
export async function repairCaseDraft(input: {
  model: StructuredModel;
  theme: ThemePlan;
  board: CuratedBoard;
  draft: CaseDraft;
  repairs: Array<Extract<RepairRequest, { kind: 'clue' | 'relationship' }>>;
}): Promise<CaseDraft>;
export function bucketResults(results: ScoredResult[], targetPoiId: string): RoundResult[];
```

Give the writer explicit target IDs and evidence. Parse structured output, add required source IDs deterministically, require exactly one scored result per candidate, and bucket non-targets by descending score with POI-ID tie breaking. `repairCaseDraft` sends only defective round instructions to the model, then reconstructs a full draft by replacing those rounds and preserving every unaffected round byte-for-byte.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm --filter @whereabouts/content-tools test -- themed-case/board-curator.test.ts themed-case/case-writer.test.ts`

Expected: PASS.

```bash
git add packages/content-tools/src/themed-case/board-curator* packages/content-tools/src/themed-case/case-writer*
git commit -m "feat(content): curate and write themed boards"
```

---

### Task 8: Implement independent semantic critique and bounded repair decisions

**Depends on:** Tasks 3 and 4

**Exclusive files:** `packages/content-tools/src/themed-case/case-critic.ts`, `packages/content-tools/src/themed-case/case-critic.test.ts`

- [ ] **Step 1: Write failing adversarial critic tests**

Cover:

- Hoover Dam marked `fail` for Railway Hotels even when its prose mentions a railway;
- a clue describing an off-board hotel returning `resolvedPoiId: null` and a named off-board answer;
- a clue describing `poi-07` while declaring `poi-00` returning `fail`;
- 25 passing theme verdicts and five correctly aligned clue verdicts returning a publishable review;
- conversion of candidate defects to candidate repair requests and clue defects to round-scoped repair requests.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @whereabouts/content-tools test -- themed-case/case-critic.test.ts`

Expected: FAIL because the critic is missing.

- [ ] **Step 3: Implement independent review**

Expose:

```ts
export async function critiqueCase(input: {
  criticModel: StructuredModel;
  theme: ThemePlan;
  board: CuratedBoard;
  draft: CaseDraft;
  publicationDate: string;
  revision: number;
}): Promise<{ review: GenerationReview; repairs: RepairRequest[] }>;
```

The critic prompt must include exact criteria/exclusions, all board identities and evidence, each declared target, clues, and relationships. It must resolve each clue independently before comparing the answer to `targetPoiId`. Parse only structured verdicts; do not infer a pass from missing defects.

- [ ] **Step 4: Implement fail-closed repair classification**

Return candidate replacement requests for any failed theme verdict, round-scoped rewrite requests for clue mismatches or leakage, and relationship-scoped requests for unsupported comparisons. Any malformed, missing, duplicate, or non-pass verdict becomes a defect.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm --filter @whereabouts/content-tools test -- themed-case/case-critic.test.ts`

Expected: PASS.

```bash
git add packages/content-tools/src/themed-case/case-critic*
git commit -m "feat(content): critique theme fit and clue answers"
```

---

### Task 9: Integrate the staged orchestrator and version 3 case assembly

**Depends on:** Tasks 4, 5, 6, 7, and 8

**Exclusive files:** `packages/content-tools/src/themed-case/orchestrator.ts`, `packages/content-tools/src/themed-case/orchestrator.test.ts`, `packages/content-tools/src/generate-case.ts`, `packages/content-tools/src/generate-case.test.ts`, `packages/content-tools/src/prompt.ts`, `packages/content-tools/src/prompt.test.ts`

- [ ] **Step 1: Write a failing injected orchestration test**

Use spies for every stage. Assert the successful order is planner → researcher → curator → writer → critic → assembly and returns one version 3 case plus a passing generation review.

- [ ] **Step 2: Write failing selective-repair tests**

Assert a clue-only defect calls the writer's round repair but does not rerun theme planning, research, or curation. Assert a candidate defect reruns curation and all downstream stages. Assert a third failed critique rejects the case because only two repair cycles are allowed.

- [ ] **Step 3: Write failing assembly regressions**

Assert assembly refuses a target absent from the board, a clue verdict resolved to an off-board answer, a clue verdict resolved to another candidate, and a source ID absent from final sources.

- [ ] **Step 4: Run tests and verify failure**

Run: `pnpm --filter @whereabouts/content-tools test -- themed-case/orchestrator.test.ts generate-case.test.ts prompt.test.ts`

Expected: FAIL because orchestration is not integrated.

- [ ] **Step 5: Implement bounded orchestration**

Expose:

```ts
export async function orchestrateThemedCase(input: {
  date: string;
  revision: number;
  caseNumber: number;
  recentThemes: Array<{ title: string; inclusionCriteria: string }>;
  excludedTargetIds: ReadonlySet<string>;
  stages: OrchestratorStages;
}): Promise<PreparedCase>;
```

Define the injected boundary as:

```ts
export type OrchestratorStages = {
  planTheme(input: { recentThemes: Array<{ title: string; inclusionCriteria: string }> }): Promise<ThemePlan>;
  researchCandidates(input: { theme: ThemePlan }): Promise<CandidatePool>;
  curateBoard(input: { theme: ThemePlan; candidates: HydratedCandidate[]; excludedTargetIds: ReadonlySet<string> }): Promise<CuratedBoard>;
  writeCaseDraft(input: { theme: ThemePlan; board: CuratedBoard }): Promise<CaseDraft>;
  repairCaseDraft(input: { theme: ThemePlan; board: CuratedBoard; draft: CaseDraft; repairs: Array<Extract<RepairRequest, { kind: 'clue' | 'relationship' }>> }): Promise<CaseDraft>;
  critiqueCase(input: { theme: ThemePlan; board: CuratedBoard; draft: CaseDraft; publicationDate: string; revision: number }): Promise<{ review: GenerationReview; repairs: RepairRequest[] }>;
};
```

Permit three theme attempts when research cannot produce 35 hydrated candidates. Permit the initial draft plus two repair cycles. Preserve successful stage values in memory. After each repair, rerun the critic over the entire board and all five rounds.

- [ ] **Step 6: Assemble immutable version 3 artifacts**

Refactor `generateCase` into the final assembly boundary. Convert hydrated candidates to `ThemedPoi`, assign stable source IDs, preserve theme connections, shuffle display order with the existing date/revision/case-number hash, attach five target images, and parse through `dailyCaseSchema`. Validate the generation review before returning `PreparedCase`. Do not write files here.

- [ ] **Step 7: Remove the old monolithic case prompt**

Replace `buildCasePrompt` with stage-specific prompt builders colocated with their stage. Keep `prompt.ts` only for shared redaction, source compaction, and prohibited-answer-marker helpers; update its tests around those pure helpers.

- [ ] **Step 8: Run integrated content-tool tests**

Run: `pnpm --filter @whereabouts/content-tools test -- themed-case/orchestrator.test.ts generate-case.test.ts prompt.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/content-tools/src/themed-case/orchestrator* packages/content-tools/src/generate-case* packages/content-tools/src/prompt*
git commit -m "feat(content): orchestrate themed case generation"
```

---

### Task 10: Replace corpus range generation and remove obsolete catalog machinery

**Depends on:** Task 9

**Exclusive files:** `packages/content-tools/src/generate-range.ts`, `packages/content-tools/src/generate-range.test.ts`, `packages/content-tools/src/bootstrap-corpus.ts`, `packages/content-tools/src/bootstrap-corpus.test.ts`, `packages/content-tools/src/expand-catalog.ts`, `packages/content-tools/src/expand-catalog.test.ts`, `packages/content-tools/catalog/pois.json`, `packages/content-tools/catalog/knowledge.json`, `packages/content-tools/package.json`, `package.json`, `turbo.json`, `.env.example`, `README.md`, `docs/content-publishing.md`, `docs/launch-checklist.md`

- [ ] **Step 1: Write failing bootstrap and replenishment CLI tests**

Test argument parsing for:

```text
content:generate-range -- --from 2026-08-17 --days 10
content:prepare-buffer -- --from 2026-08-17 --days 10
```

Assert bootstrap requests exactly ten consecutive dates. Assert buffer mode skips manifested dates and generates every missing date in today-plus-nine. Assert neither mode reads catalog JSON.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @whereabouts/content-tools test -- generate-range.test.ts`

Expected: FAIL because range generation still imports the corpus.

- [ ] **Step 3: Replace range generation**

Load published history from the manifest and case artifacts. For each requested date, calculate its revision, previous 90 themes, and previous 30 target IDs; call `orchestrateThemedCase`; collect every `PreparedCase`; call `publishBatch` once after all cases pass. Add `--missing-only` for buffer mode. Keep all date arguments canonical and use `caseNumberForDate`.

- [ ] **Step 4: Update commands and environment documentation**

In both package manifests expose:

```json
{
  "content:generate-range": "tsx src/generate-range.ts",
  "content:prepare-buffer": "tsx src/generate-range.ts --missing-only"
}
```

Remove `content:bootstrap-corpus` and `content:expand-catalog` scripts and Turbo tasks. Keep `OPENROUTER_API_KEY`, `WHEREABOUTS_MODEL`, and `WIKIMEDIA_USER_AGENT`; add `WHEREABOUTS_CRITIC_MODEL` defaulting to `WHEREABOUTS_MODEL`.

- [ ] **Step 5: Delete obsolete corpus code and data**

Delete the four bootstrap/expand source and test files and both catalog JSON files. Confirm no imports remain:

Run: `rg -n "bootstrap-corpus|expand-catalog|catalog/pois|catalog/knowledge|corpus context" .`

Expected: no matches outside historical design/plan documents.

- [ ] **Step 6: Rewrite operating documentation**

Document staged generation, live-source requirements, semantic audit JSON, Markdown packets, bootstrap generation, 10-day buffer preparation, PR audit/repair, revisions, and withdrawal. Remove instructions to expand or cache a corpus and remove direct-to-main publication language.

- [ ] **Step 7: Run package tests and commit**

Run: `pnpm --filter @whereabouts/content-tools test && pnpm --filter @whereabouts/content-tools typecheck`

Expected: PASS.

```bash
git add -A packages/content-tools package.json turbo.json .env.example README.md docs/content-publishing.md docs/launch-checklist.md
git commit -m "refactor(content): remove persistent landmark corpus"
```

---

### Task 11: Publish generated buffers through checked, auto-merged pull requests

**Depends on:** Tasks 9 and 10

**Exclusive files:** `.github/workflows/generate-cases.yml`, `.github/workflows/quality.yml`

- [ ] **Step 1: Replace direct-main workflow permissions and concurrency**

Set:

```yaml
permissions:
  contents: write
  pull-requests: write

concurrency:
  group: generated-case-buffer
  cancel-in-progress: false
```

Keep the dual UTC cron and Eastern-midnight guard.

- [ ] **Step 2: Generate the complete buffer on a bot branch**

Checkout `main`, calculate `TZ=America/New_York date +%F`, run:

```bash
pnpm content:prepare-buffer -- --from "$START_DATE" --days 10
pnpm exec biome format --write packages/case-content/content
PUBLICATION_CEILING="$(date -u -d "$START_DATE + 9 days" +%F)" pnpm content:validate
pnpm quality
```

Before using shell dates, set `START_DATE` from the guarded workflow step and validate it with `^\d{4}-\d{2}-\d{2}$`. Use a branch named `content/generated-buffer-${GITHUB_RUN_ID}`. If git has no changes, exit successfully without a PR.

- [ ] **Step 3: Commit, push, and open the audit PR**

Commit cases, manifest, audit JSON, and Markdown packets. Push the bot branch and run:

```bash
gh pr create \
  --base main \
  --head "$CONTENT_BRANCH" \
  --title "content: replenish themed case buffer from ${START_DATE}" \
  --body-file packages/case-content/content/reviews/index.md
```

Generate `reviews/index.md` during batch publication with links to every packet in the batch and a statement that all semantic verdicts passed.

- [ ] **Step 4: Enable auto-merge after required checks**

Capture the PR URL from `gh pr create`, then run `gh pr merge --auto --squash "$PR_URL"`. Set `GH_TOKEN: ${{ github.token }}`. Do not invoke deployment from this workflow; the existing push-to-main deploy workflow runs only after the PR merges.

- [ ] **Step 5: Ensure quality validates future PR content**

In the quality workflow, calculate and validate the latest manifest date before running quality:

```bash
LATEST_DATE=$(node -e "const m=require('./packages/case-content/content/manifest.json'); process.stdout.write(Object.keys(m.cases).sort().at(-1) || '')")
if [[ ! "$LATEST_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "Manifest has no canonical latest date" >&2
  exit 1
fi
PUBLICATION_CEILING="$LATEST_DATE" pnpm quality
```

This validates all future cases included in the pull request rather than stopping at today's UTC date.

- [ ] **Step 6: Validate workflow syntax and commit**

Run: `ruby -e 'require "yaml"; ARGV.each { |path| YAML.load_file(path) }' .github/workflows/generate-cases.yml .github/workflows/quality.yml`

Expected: exit 0. Then run `git diff --check` and expect no output.

```bash
git add .github/workflows/generate-cases.yml .github/workflows/quality.yml
git commit -m "ci(content): publish generated cases through pull requests"
```

---

### Task 12: Integrate, verify, and generate the initial 10 cases

**Depends on:** Tasks 2, 4, 9, 10, and 11 integrated on one branch

**Exclusive files:** integration fixes only in files already owned by completed tasks; generated files under `packages/case-content/content/cases/2026-08-17` and `packages/case-content/content/reviews/2026-08-17` through `2026-08-26`; `packages/case-content/content/manifest.json`

- [ ] **Step 1: Run format and static verification**

Run: `pnpm check:write && pnpm typecheck`

Expected: PASS.

- [ ] **Step 2: Run all unit and component tests**

Run: `pnpm test`

Expected: PASS, including railway-hotel outsider rejection and both clue-answer regressions.

- [ ] **Step 3: Run publication validation and production build**

Run: `PUBLICATION_CEILING=2026-08-26 pnpm content:validate && pnpm build`

Expected: PASS before bootstrap content exists using the current manifest boundary; after generation, PASS for all ten new dates.

- [ ] **Step 4: Run browser journeys**

Run: `pnpm test:e2e`

Expected: PASS on desktop and mobile with the theme shown and progress restored.

- [ ] **Step 5: Commit code integration fixes**

```bash
git add -u
git commit -m "test: verify themed case pipeline"
```

Skip the commit if verification required no integration changes.

- [ ] **Step 6: Merge the code migration before generating content**

Open the code PR, wait for required checks, review the diff for removal of corpus files and absence of model code in the browser bundle, and merge it. The bootstrap must run from the merged code so the generated content PR contains only cases, reviews, and manifest changes.

- [ ] **Step 7: Generate the initial ten-case batch**

From a fresh branch based on updated `main`, with production `OPENROUTER_API_KEY`, `WIKIMEDIA_USER_AGENT`, `WHEREABOUTS_MODEL`, and optional `WHEREABOUTS_CRITIC_MODEL`, run:

```bash
pnpm content:generate-range -- --from 2026-08-17 --days 10
pnpm exec biome format --write packages/case-content/content
PUBLICATION_CEILING=2026-08-26 pnpm content:validate
pnpm quality
```

Expected: ten version 3 case JSON files, ten matching audit JSON files, ten Markdown review packets, an index packet, and manifest entries for 2026-08-17 through 2026-08-26.

- [ ] **Step 8: Perform deterministic spot checks before opening the content PR**

Run:

```bash
rg -l '"schemaVersion": 3' packages/case-content/content/cases/2026-08-{17,18,19,20,21,22,23,24,25,26}/v*.json
rg -l '"status": "fail"' packages/case-content/content/reviews/2026-08-{17,18,19,20,21,22,23,24,25,26}/v*.json
```

Expected: the first command lists ten files; the second lists none. Open every Markdown packet and confirm 25 theme connections and five clue verdicts are present.

- [ ] **Step 9: Commit and open the bootstrap content PR**

```bash
git add packages/case-content/content/cases packages/case-content/content/reviews packages/case-content/content/manifest.json
git commit -m "content: bootstrap ten themed daily cases"
git push -u origin content/bootstrap-themed-cases
gh pr create --base main --head content/bootstrap-themed-cases --title "content: bootstrap ten themed daily cases" --body-file packages/case-content/content/reviews/index.md
```

- [ ] **Step 10: Merge after checks and confirm production loading**

After required checks pass, enable auto-merge or merge manually. Confirm the deploy workflow runs for the merge commit and request `/2026-08-17` from production. Verify the response renders the theme title, 25 candidates, and round one without a model request.

---

## Final acceptance checklist

- [ ] Every new case exposes a theme before round one.
- [ ] Every one of the 25 candidates has a cited, passing theme-fit judgment.
- [ ] No `cold` result is a thematic outsider.
- [ ] Every declared target is exactly one board candidate.
- [ ] Every clue's independent verdict resolves to its declared on-board target.
- [ ] The off-board-answer and wrong-board-member regressions pass.
- [ ] Runtime gameplay performs no model or research calls.
- [ ] Version 2 archive cases remain loadable.
- [ ] The persistent POI and knowledge corpus and its commands are absent.
- [ ] Generated batches create PRs and auto-merge only after required checks.
- [ ] Today plus the following nine Eastern dates are manifested.
- [ ] The initial ten version 3 cases and their audits are committed through a content PR.
