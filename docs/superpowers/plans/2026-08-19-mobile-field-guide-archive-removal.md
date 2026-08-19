# Mobile Field Guide and Archive Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the mobile five-round game, hide image attribution until completion, add an optional-Wikipedia field guide, and delete the archive interface while preserving direct dated routes.

**Architecture:** Make `wikipediaTitle` optional from model proposal through published case parsing, without introducing a verification gate. Replace the completed screen's generic browse picker with one focused native-disclosure field guide that owns ordering, optional links, and answer-photo attribution. Remove archive state and published-case indexing from the web/server boundary, then use a geometry-based mobile browser test to lock the dense first viewport.

**Tech Stack:** TypeScript, React 19, TanStack Start/Router, Tailwind CSS 4, Zod 4, Vitest, Testing Library, Playwright, pnpm/Turbo.

---

## File map

**Create**

- `apps/web/src/features/game/completed-field-guide.tsx` — answer-first ordering, optional Wikipedia URL construction, native disclosure, and final answer-photo attribution.
- `apps/web/src/features/game/completed-field-guide.test.tsx` — ordering, deduplication, optional-link, disclosure, and attribution coverage.

**Modify**

- `packages/case-content/src/schema.ts` — make published `Poi.wikipediaTitle` optional.
- `packages/case-content/src/schema.test.ts` — prove cases without Wikipedia metadata remain valid.
- `packages/content-tools/src/themed-case/contracts.ts` — make researched Wikipedia titles optional but keep hydrated target titles required.
- `packages/content-tools/src/themed-case/candidate-researcher.ts` — accept missing titles, deduplicate only present titles, and keep Wikimedia hydration as target enrichment.
- `packages/content-tools/src/themed-case/candidate-researcher.test.ts` — prove model candidates without titles survive research.
- `packages/content-tools/src/themed-case/live-research.ts` — skip the direct-title attempt when absent and fall back to identity search.
- `packages/content-tools/src/themed-case/live-research.test.ts` — prove missing-title hydration starts with search.
- `packages/content-tools/src/generate-case.ts` — omit `wikipediaTitle` from published POIs when absent.
- `apps/web/src/features/game/app-shell.tsx` — remove archive state/props and retain sharing only.
- `apps/web/src/features/game/briefing-unavailable.tsx` — remove archive copy, icon, callback, and button.
- `apps/web/src/features/game/route-state.test.tsx` — assert unavailable pages offer only today's case.
- `apps/web/src/features/cases/case-functions.ts` — remove the published-case-index server function.
- `apps/web/src/routes/$date.tsx` — load one case only and remove current-date/archive plumbing.
- `packages/case-content/src/loader.server.ts` — remove the UI-only published-case list.
- `packages/case-content/src/loader.server.test.ts` — retain manifest-selected loading coverage without list assertions.
- `apps/web/src/features/game/round-briefing.tsx` — remove active attribution and apply dense mobile styles.
- `apps/web/src/features/game/round-reveal.tsx` — keep image attribution hidden during intermediate reveals.
- `apps/web/src/features/game/theme-briefing.tsx` — compact mobile theme typography and spacing.
- `apps/web/src/features/game/five-round-game-screen.tsx` — compact shared layout and mount the completed field guide.
- `apps/web/src/features/game/five-round-game-screen.test.tsx` — prove attribution timing and field-guide integration.
- `apps/web/src/features/game/daily-score-panel.tsx` — make result rows wrap safely on phones.
- `apps/web/e2e/five-round-harness.tsx` — optionally enable the real globe for geometry testing.
- `apps/web/e2e/whereabouts.spec.ts` — verify mobile geometry, conditional links, attribution timing, no archive UI, and direct dated routes.

**Delete**

- `apps/web/src/features/game/archive-drawer.tsx`
- `apps/web/src/features/game/archive-drawer.test.tsx`

## Task 1: Make Wikipedia metadata genuinely optional

**Files:**

- Modify: `packages/case-content/src/schema.test.ts`
- Modify: `packages/case-content/src/schema.ts`
- Modify: `packages/content-tools/src/themed-case/candidate-researcher.test.ts`
- Modify: `packages/content-tools/src/themed-case/live-research.test.ts`
- Modify: `packages/content-tools/src/themed-case/contracts.ts`
- Modify: `packages/content-tools/src/themed-case/candidate-researcher.ts`
- Modify: `packages/content-tools/src/themed-case/live-research.ts`
- Modify: `packages/content-tools/src/generate-case.ts`

- [ ] **Step 1: Write a failing publication-schema test**

Add this case to `packages/case-content/src/schema.test.ts`:

```ts
it('accepts a candidate without Wikipedia metadata', () => {
  const value = makeFiveRoundCase();
  delete (value.pois[10] as { wikipediaTitle?: string }).wikipediaTitle;

  const parsed = dailyCaseSchema.parse(value);

  expect(parsed.pois[10]?.wikipediaTitle).toBeUndefined();
});
```

- [ ] **Step 2: Run the schema test and verify RED**

Run:

```bash
pnpm --filter @whereabouts/case-content exec vitest run src/schema.test.ts
```

Expected: FAIL because `parsePoi` requires `pois[10].wikipediaTitle` to be a string.

- [ ] **Step 3: Make the published field optional**

Change the `Poi` member in `packages/case-content/src/schema.ts`:

```ts
export type Poi = {
  id: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  wikipediaTitle?: string;
  blurb?: string;
  image?: {
    url: string;
    alt: string;
    attribution: string;
    licenseUrl: string;
  };
};
```

In `parsePoi`, replace the unconditional property with a conditional spread:

```ts
return {
  id: id(parsed.id, `${path}.id`),
  name: string(parsed.name, `${path}.name`, 2),
  city: string(parsed.city, `${path}.city`),
  country: string(parsed.country, `${path}.country`, 2),
  latitude: numberInRange(parsed.latitude, `${path}.latitude`, -90, 90),
  longitude: numberInRange(parsed.longitude, `${path}.longitude`, -180, 180),
  ...(parsed.wikipediaTitle === undefined
    ? {}
    : {
        wikipediaTitle: string(
          parsed.wikipediaTitle,
          `${path}.wikipediaTitle`,
          2,
        ),
      }),
  ...(parsed.blurb === undefined
    ? {}
    : { blurb: string(parsed.blurb, `${path}.blurb`, 20) }),
  ...(image === undefined ? {} : { image }),
};
```

- [ ] **Step 4: Run the schema test and verify GREEN**

Run:

```bash
pnpm --filter @whereabouts/case-content exec vitest run src/schema.test.ts
```

Expected: all schema tests PASS.

- [ ] **Step 5: Write failing generation tests for missing titles**

In `packages/content-tools/src/themed-case/candidate-researcher.test.ts`, add:

```ts
it('keeps model candidates that do not provide Wikipedia metadata', async () => {
  const candidates = Array.from({ length: 40 }, (_, index) => {
    const { wikipediaTitle: _title, ...candidate } = proposal(index);
    return candidate;
  });
  const pool = await researchCandidates({
    theme: fixtureTheme,
    model: {
      generate: async () => ({ theme: fixtureTheme, candidates }),
    },
  });

  expect(pool.candidates).toHaveLength(40);
  expect(pool.candidates.every((candidate) => !candidate.wikipediaTitle)).toBe(
    true,
  );
});
```

In `packages/content-tools/src/themed-case/live-research.test.ts`, add a test that deletes the title and proves search is used before hydration:

```ts
it('searches by identity when a candidate has no Wikipedia title', async () => {
  const calls: string[] = [];
  const research = createWikimediaResearch({
    fetch: async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('list=search'))
        return response({ query: { search: [] } });
      throw new Error(`unexpected URL ${url}`);
    },
    userAgent: 'test-agent',
  });
  const { wikipediaTitle: _title, ...candidateWithoutArticle } = candidate;

  await expect(research.hydrate(candidateWithoutArticle)).resolves.toBeNull();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('list=search');
});
```

- [ ] **Step 6: Run the focused content-tools tests and verify RED**

Run:

```bash
pnpm --filter @whereabouts/content-tools exec vitest run src/themed-case/candidate-researcher.test.ts src/themed-case/live-research.test.ts
```

Expected: FAIL because the candidate schemas and title utilities still require strings.

- [ ] **Step 7: Make research contracts optional without weakening hydrated targets**

In `packages/content-tools/src/themed-case/contracts.ts`, use optional titles for model/researched candidates and required titles for successfully hydrated targets:

```ts
const candidateIdentitySchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2),
  city: z.string().min(1),
  country: z.string().min(2),
  wikipediaTitle: z.string().min(2).optional(),
  themeClaim: z.string().min(20),
});

const uniqueBy = (
  items: Array<{ id: string; wikipediaTitle?: string }>,
) => {
  const titles = items.flatMap((item) =>
    item.wikipediaTitle ? [item.wikipediaTitle] : [],
  );
  return unique(items.map((item) => item.id)) && unique(titles);
};

export const hydratedCandidateSchema = candidateIdentitySchema
  .extend({ wikipediaTitle: z.string().min(2) })
  .merge(candidateEvidenceSchema);
```

Update the `hydrated` test helper in `candidate-researcher.test.ts` so its verified source title remains a string when the input has no article metadata:

```ts
source: {
  title: candidate.wikipediaTitle ?? candidate.name,
  url: `https://example.test/${index}`,
  retrievedAt: '2026-01-01T00:00:00.000Z',
  provenance: 'verified',
  extract: 'A'.repeat(120),
},
```

In `packages/content-tools/src/themed-case/candidate-researcher.ts`:

```ts
const modelCandidateSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2),
  city: z.string().min(1),
  country: z.string().min(2),
  wikipediaTitle: z.string().min(2).optional(),
  themeClaim: z.string().min(20),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  source: z.object({
    title: z.string().min(1),
    url: z.string().regex(/^https?:\/\/\S+$/),
    retrievedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/),
    provenance: z.enum(['model', 'verified']),
    extract: z.string().min(100),
  }),
});

const canonicalTitle = (title: string) =>
  title.trim().replaceAll('_', ' ').replace(/\s+/g, ' ').toLocaleLowerCase();

const canonicalId = (id: string) =>
  id
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
```

Update all `canonicalId` calls to pass only the required model `id`. In the research loop, deduplicate titles only when present:

```ts
const titleKey = value.wikipediaTitle
  ? canonicalTitle(value.wikipediaTitle)
  : undefined;
const coordinateKey = `${value.latitude.toFixed(4)},${value.longitude.toFixed(4)}`;
const candidateId = canonicalId(value.id);
if (
  (titleKey !== undefined && titles.has(titleKey)) ||
  coordinates.has(coordinateKey) ||
  ids.has(candidateId)
)
  continue;
if (titleKey !== undefined) titles.add(titleKey);
coordinates.add(coordinateKey);
ids.add(candidateId);
researched.push({ ...value, id: candidateId });
```

Change the research prompt to say:

```ts
'Include wikipediaTitle only when you know the specific English Wikipedia article title; otherwise omit it.',
```

Build `originalTitleOwners` from present titles only:

```ts
const originalTitleOwners = new Map(
  input.board.candidates.flatMap((candidate) =>
    candidate.wikipediaTitle
      ? [[canonicalTitle(candidate.wikipediaTitle), candidate.id] as const]
      : [],
  ),
);
```

In `packages/content-tools/src/themed-case/live-research.ts`, filter the optional identity and skip an absent direct title:

```ts
const identities = [candidate.name, candidate.wikipediaTitle]
  .filter((value): value is string => typeof value === 'string')
  .map(compact);

const direct = candidate.wikipediaTitle
  ? await tryTitle(candidate.wikipediaTitle)
  : null;
```

In `packages/content-tools/src/generate-case.ts`, omit absent metadata instead of serializing `undefined`:

```ts
const pois: ThemedPoi[] = input.board.candidates.map((candidate) => ({
  id: candidate.id,
  name: candidate.name,
  city: candidate.city,
  country: candidate.country,
  latitude: candidate.latitude,
  longitude: candidate.longitude,
  ...(candidate.wikipediaTitle
    ? { wikipediaTitle: candidate.wikipediaTitle }
    : {}),
  blurb: buildPoiBlurb(candidate.source.extract),
  image: candidate.image,
  themeConnection: {
    text: candidate.themeClaim,
    sourceIds: [sourceByPoiId.get(candidate.id) as string],
  },
}));
```

- [ ] **Step 8: Run all affected package tests and typechecks**

Run:

```bash
pnpm --filter @whereabouts/case-content test
pnpm --filter @whereabouts/content-tools test
pnpm --filter @whereabouts/case-content typecheck
pnpm --filter @whereabouts/content-tools typecheck
```

Expected: every command exits 0; missing Wikipedia metadata is accepted, while successful target hydration still produces a canonical title.

- [ ] **Step 9: Commit the optional metadata contract**

```bash
git add packages/case-content/src/schema.ts packages/case-content/src/schema.test.ts packages/content-tools/src/themed-case/contracts.ts packages/content-tools/src/themed-case/candidate-researcher.ts packages/content-tools/src/themed-case/candidate-researcher.test.ts packages/content-tools/src/themed-case/live-research.ts packages/content-tools/src/themed-case/live-research.test.ts packages/content-tools/src/generate-case.ts
git commit -m "feat: make wikipedia metadata optional"
```

## Task 2: Delete the archive subsystem

**Files:**

- Modify: `apps/web/src/features/game/route-state.test.tsx`
- Modify: `apps/web/src/features/game/app-shell.tsx`
- Modify: `apps/web/src/features/game/briefing-unavailable.tsx`
- Modify: `apps/web/src/features/cases/case-functions.ts`
- Modify: `apps/web/src/routes/$date.tsx`
- Modify: `packages/case-content/src/loader.server.test.ts`
- Modify: `packages/case-content/src/loader.server.ts`
- Delete: `apps/web/src/features/game/archive-drawer.tsx`
- Delete: `apps/web/src/features/game/archive-drawer.test.tsx`

- [ ] **Step 1: Change route-state coverage to require no archive UI**

Replace the first two cases in `apps/web/src/features/game/route-state.test.tsx` with:

```tsx
it('renders an active briefing without archive controls', () => {
  render(<AppShell caseData={makeFiveRoundCase()} date="2026-08-14" />);

  expect(
    screen.queryByRole('button', { name: /archive/i }),
  ).not.toBeInTheDocument();
});

it("offers only today's case when a dated briefing is unavailable", () => {
  render(<BriefingUnavailable date="2026-08-15" />);

  expect(
    screen.getByRole('heading', { name: /briefing unavailable/i }),
  ).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: /today's case/i }),
  ).toHaveAttribute('href', '/');
});
```

- [ ] **Step 2: Run the route-state test and verify RED**

Run:

```bash
pnpm --filter @whereabouts/web exec vitest run src/features/game/route-state.test.tsx
```

Expected: FAIL because `AppShell` still requires archive props and `BriefingUnavailable` still renders the archive button.

- [ ] **Step 3: Remove archive UI and props**

In `apps/web/src/features/game/app-shell.tsx`, delete the `ArchiveDrawer` import, archive state, `PublishedCase` type, `publishedCases`, and `today`. Keep this prop shape:

```ts
type AppShellProps = {
  caseData: FiveRoundDailyCase | null;
  date: string;
};
```

Render the unavailable view directly:

```tsx
{caseData ? (
  <FiveRoundGameScreen caseData={caseData} onShare={shareCase} />
) : (
  <BriefingUnavailable date={date} />
)}
```

In `apps/web/src/features/game/briefing-unavailable.tsx`, remove `Archive`, `onOpenArchive`, and the archive button. Use this copy:

```tsx
<p className="text-[0.68rem] font-bold tracking-[0.24em] text-brass uppercase">
  Field intelligence
</p>
<p className="mt-5 max-w-xl text-base leading-relaxed text-cyan">
  No published case is on file for <time dateTime={date}>{date}</time>.
  Return to today’s briefing.
</p>
```

Keep only the existing `Compass` link to `/`.

Delete both archive component files:

```bash
git rm apps/web/src/features/game/archive-drawer.tsx apps/web/src/features/game/archive-drawer.test.tsx
```

- [ ] **Step 4: Remove archive data loading**

Delete `getPublishedCaseIndex` from `apps/web/src/features/cases/case-functions.ts`.

In `apps/web/src/routes/$date.tsx`, remove `formatLocalDate`, React state/effects, and the parallel index request. The loader and component become:

```tsx
loader: async ({ params }) => ({
  caseData: await getPublishedCase({ data: { date: params.date } }),
}),

function CaseRoute() {
  const { caseData } = Route.useLoaderData();
  const { date } = Route.useParams();
  return <AppShell caseData={caseData} date={date} />;
}
```

In `packages/case-content/src/loader.server.ts`, remove `PublishedCaseIndex`, the precomputed `publishedCases`, `listPublishedCases`, and its export. Preserve `loadPublishedCase` and manifest-selected resolution.

Update `packages/case-content/src/loader.server.test.ts` by removing every `listPublishedCases()` assertion. Rename the final test to `loads v4 cases on both manifest dates` and retain both direct load assertions.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm --filter @whereabouts/web exec vitest run src/features/game/route-state.test.tsx
pnpm --filter @whereabouts/case-content exec vitest run src/loader.server.test.ts
pnpm --filter @whereabouts/web typecheck
pnpm --filter @whereabouts/case-content typecheck
```

Expected: all commands exit 0, with no archive imports or index API references.

- [ ] **Step 6: Confirm the archive subsystem has no references**

Run:

```bash
rg -n "ArchiveDrawer|Open case archive|getPublishedCaseIndex|listPublishedCases|PublishedCaseIndex|publishedCases|archiveOpen|onOpenArchive" apps packages
```

Expected: no output.

- [ ] **Step 7: Commit archive deletion**

```bash
git add -A apps/web/src/features/game apps/web/src/features/cases/case-functions.ts 'apps/web/src/routes/$date.tsx' packages/case-content/src/loader.server.ts packages/case-content/src/loader.server.test.ts
git commit -m "refactor: remove archive interface"
```

## Task 3: Build the completed field guide

**Files:**

- Create: `apps/web/src/features/game/completed-field-guide.test.tsx`
- Create: `apps/web/src/features/game/completed-field-guide.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `apps/web/src/features/game/completed-field-guide.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import { describe, expect, it } from 'vitest';

import {
  CompletedFieldGuide,
  wikipediaArticleUrl,
} from './completed-field-guide';

describe('wikipediaArticleUrl', () => {
  it('encodes a present article title and omits an absent one', () => {
    expect(wikipediaArticleUrl('Ascensor Concepción')).toBe(
      'https://en.wikipedia.org/wiki/Ascensor_Concepci%C3%B3n',
    );
    expect(wikipediaArticleUrl(undefined)).toBeUndefined();
    expect(wikipediaArticleUrl('   ')).toBeUndefined();
  });
});

describe('CompletedFieldGuide', () => {
  it('orders answers first, includes every candidate once, and links only available articles', async () => {
    const user = userEvent.setup();
    const caseData = makeFiveRoundCase();
    delete (caseData.pois[10] as { wikipediaTitle?: string }).wikipediaTitle;
    render(<CompletedFieldGuide pois={caseData.pois} rounds={caseData.rounds} />);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /field guide · 20 locations/i }),
    );

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(20);
    const answerNames = caseData.rounds.map(
      (round) =>
        caseData.pois.find((poi) => poi.id === round.targetPoiId)?.name ?? '',
    );
    const remainingNames = caseData.pois
      .filter((poi) => !caseData.rounds.some((round) => round.targetPoiId === poi.id))
      .map((poi) => poi.name)
      .sort((left, right) => left.localeCompare(right));
    expect(
      items.map((item) => item.querySelector('span')?.textContent),
    ).toEqual([...answerNames, ...remainingNames]);
    expect(
      screen.queryByRole('link', { name: /read place 10 on wikipedia/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /read target place on wikipedia/i }),
    ).toHaveAttribute(
      'href',
      'https://en.wikipedia.org/wiki/Place_0',
    );
    expect(screen.getAllByRole('link', { name: /photo license/i })).toHaveLength(
      5,
    );
  });

  it('keeps an available article link when the optional POI image is absent', async () => {
    const user = userEvent.setup();
    const caseData = makeFiveRoundCase();
    delete caseData.pois[0].image;
    render(<CompletedFieldGuide pois={caseData.pois} rounds={caseData.rounds} />);

    await user.click(
      screen.getByRole('button', { name: /field guide · 20 locations/i }),
    );
    expect(
      screen.getByRole('link', { name: /read target place on wikipedia/i }),
    ).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
pnpm --filter @whereabouts/web exec vitest run src/features/game/completed-field-guide.test.tsx
```

Expected: FAIL because `completed-field-guide.tsx` does not exist.

- [ ] **Step 3: Implement the URL helper and ordered disclosure**

Create `apps/web/src/features/game/completed-field-guide.tsx`:

```tsx
import type { DailyRound, Poi } from '@whereabouts/case-content';

export function wikipediaArticleUrl(title?: string): string | undefined {
  const normalized = title?.trim();
  if (!normalized) return undefined;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(
    normalized.replaceAll(' ', '_'),
  )}`;
}

type FieldGuideEntry = {
  poi: Poi;
  round?: DailyRound;
};

function orderedEntries(pois: Poi[], rounds: DailyRound[]): FieldGuideEntry[] {
  const poisById = new Map(pois.map((poi) => [poi.id, poi]));
  const answerIds = new Set(rounds.map((round) => round.targetPoiId));
  const answers = rounds.flatMap((round) => {
    const poi = poisById.get(round.targetPoiId);
    return poi ? [{ poi, round }] : [];
  });
  const remaining = pois
    .filter((poi) => !answerIds.has(poi.id))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((poi) => ({ poi }));
  return [...answers, ...remaining];
}

export function CompletedFieldGuide({
  pois,
  rounds,
}: {
  pois: Poi[];
  rounds: DailyRound[];
}) {
  const entries = orderedEntries(pois, rounds);
  return (
    <details className="border-y border-rule">
      <summary className="flex min-h-11 cursor-pointer items-center py-3 text-sm font-bold tracking-[0.12em] text-cyan uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
        Field guide · {entries.length} locations
      </summary>
      <ol className="divide-y divide-rule/60 border-t border-rule">
        {entries.map(({ poi, round }) => {
          const articleUrl = wikipediaArticleUrl(poi.wikipediaTitle);
          return (
            <li className="py-3" key={poi.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-semibold text-paper">{poi.name}</span>
                {articleUrl ? (
                  <a
                    aria-label={`Read ${poi.name} on Wikipedia`}
                    className="text-sm text-cyan underline decoration-brass underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                    href={articleUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Wikipedia
                  </a>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {poi.city}, {poi.country}
              </p>
              {round ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {round.image.attribution}{' '}
                  <a
                    aria-label={`${poi.name} photo license`}
                    className="text-cyan underline decoration-brass underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                    href={round.image.licenseUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Photo license
                  </a>
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
```

- [ ] **Step 4: Run the component test and verify GREEN**

Run:

```bash
pnpm --filter @whereabouts/web exec vitest run src/features/game/completed-field-guide.test.tsx
```

Expected: all field-guide tests PASS.

- [ ] **Step 5: Commit the isolated field guide**

```bash
git add apps/web/src/features/game/completed-field-guide.tsx apps/web/src/features/game/completed-field-guide.test.tsx
git commit -m "feat: add completed location field guide"
```

## Task 4: Hide attribution during play and integrate the field guide

**Files:**

- Modify: `apps/web/src/features/game/five-round-game-screen.test.tsx`
- Modify: `apps/web/src/features/game/round-briefing.tsx`
- Modify: `apps/web/src/features/game/round-reveal.tsx`
- Modify: `apps/web/src/features/game/five-round-game-screen.tsx`
- Modify: `apps/web/src/features/game/poi-picker.tsx`
- Modify: `apps/web/src/features/game/poi-picker.test.tsx`

- [ ] **Step 1: Write failing attribution-timing assertions**

In the existing neutral-briefing test in `five-round-game-screen.test.tsx`, immediately after the clue assertion add:

```ts
expect(
  screen.queryByText(caseData.rounds[0].image.attribution),
).not.toBeInTheDocument();
expect(
  screen.queryByRole('link', { name: /license/i }),
).not.toBeInTheDocument();
```

After submitting the first guess, add:

```ts
expect(
  screen.queryByText(caseData.rounds[0].image.attribution),
).not.toBeInTheDocument();
```

In the completed-game restoration test, replace the browse-list expectations with:

```ts
const disclosure = screen.getByText(/field guide · 20 locations/i);
expect(disclosure).toBeVisible();
await user.click(disclosure);
expect(
  screen.getAllByText(caseData.rounds[0].image.attribution).length,
).toBeGreaterThanOrEqual(1);
expect(
  screen.getByRole('link', { name: /read target place on wikipedia/i }),
).toBeVisible();
```

- [ ] **Step 2: Run the screen test and verify RED**

Run:

```bash
pnpm --filter @whereabouts/web exec vitest run src/features/game/five-round-game-screen.test.tsx
```

Expected: FAIL because active attribution remains visible and the completed field guide is not mounted.

- [ ] **Step 3: Remove all in-game attribution markup**

In `round-briefing.tsx`, replace the `<figure>` with the image alone:

```tsx
<figure className="overflow-hidden rounded-lg border border-rule">
  <img
    alt={`Round ${roundNumber} target photograph`}
    className="h-36 w-full object-cover sm:h-64"
    src={round.image.url}
  />
</figure>
```

In `round-reveal.tsx`, remove the `<figcaption>` from `FullDossier`; keep the image and its meaningful alt text. Do not render attribution, filenames, license URLs, or outbound image links in intermediate results.

- [ ] **Step 4: Replace completed browsing with the field guide**

Import `CompletedFieldGuide` into `five-round-game-screen.tsx`. Replace the completed screen's entire `Explore locations` section and browse-mode `PoiPicker` with:

```tsx
<CompletedFieldGuide pois={caseData.pois} rounds={caseData.rounds} />
```

Because browse mode then has no caller, simplify `PoiPickerProps` to guessing only:

```ts
type PoiPickerProps = {
  pois: Poi[];
  disabledPoiIds?: Set<string>;
  dossierDetail?: 'full' | 'identity';
  globe?: (selectPoi: (poi: Poi) => void, fallback: ReactNode) => ReactNode;
  onGuess: (poi: Poi) => void;
};
```

Remove `guessedPoiIds`, `mode`, the browse-only search rendering, and conditional `onConfirm`. Always pass `confirmSelection` to `PoiDossier`. Delete the browse-mode test from `poi-picker.test.tsx`; retain guess-mode search, dossier, focus restoration, and double-submit coverage.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm --filter @whereabouts/web exec vitest run src/features/game/five-round-game-screen.test.tsx src/features/game/completed-field-guide.test.tsx src/features/game/poi-picker.test.tsx
```

Expected: all focused web tests PASS, active/reveal screens contain no attribution, and completion exposes it only after expanding the field guide.

- [ ] **Step 6: Commit attribution timing and integration**

```bash
git add apps/web/src/features/game/five-round-game-screen.tsx apps/web/src/features/game/five-round-game-screen.test.tsx apps/web/src/features/game/round-briefing.tsx apps/web/src/features/game/round-reveal.tsx apps/web/src/features/game/poi-picker.tsx apps/web/src/features/game/poi-picker.test.tsx
git commit -m "feat: reveal image credits after completion"
```

## Task 5: Implement the dense mobile layout

**Files:**

- Modify: `apps/web/src/features/game/five-round-game-screen.tsx`
- Modify: `apps/web/src/features/game/theme-briefing.tsx`
- Modify: `apps/web/src/features/game/round-briefing.tsx`
- Modify: `apps/web/src/features/game/daily-score-panel.tsx`
- Modify: `apps/web/e2e/five-round-harness.tsx`
- Modify: `apps/web/e2e/whereabouts.spec.ts`

- [ ] **Step 1: Allow the browser harness to render the real globe**

In `apps/web/e2e/five-round-harness.tsx`, derive the prop from the query string:

```tsx
const globeSupported =
  new URLSearchParams(window.location.search).get('globe') === '1';

<FiveRoundGameScreen
  caseData={caseData}
  globeSupported={globeSupported}
  onShare={async (activeCase, progress) => {
    await shareResult(
      buildShareText(activeCase, progress, window.location.origin),
      navigator,
    );
  }}
/>
```

- [ ] **Step 2: Write a failing mobile geometry test**

Add a separate test to the mobile describe in `apps/web/e2e/whereabouts.spec.ts`. Do not install the WebGL-disabling init script for this test:

```ts
test('keeps the clue and most of the globe in the first mobile viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${E2E_HARNESS_PATH}?globe=1`);
  await expect(
    page.getByRole('img', { name: /round 1 target photograph/i }),
  ).toBeVisible();
  const globe = page.getByTestId('globe-canvas');
  await expect(globe).toBeVisible();

  const measurement = await globe.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      visibleGlobeHeight: Math.max(
        0,
        Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
      ),
      globeHeight: rect.height,
    };
  });

  expect(measurement.documentWidth).toBeLessThanOrEqual(
    measurement.viewportWidth,
  );
  expect(measurement.visibleGlobeHeight).toBeGreaterThanOrEqual(
    measurement.globeHeight * 0.6,
  );
});
```

Keep the complete mobile game test on the fallback path by opening the harness without `?globe=1`; the harness explicitly passes `false` in that case.

Replace the mobile describe's `beforeEach` with the following so it does not globally disable WebGL; fallback behavior is controlled by the harness prop:

```ts
test.beforeEach(async ({ page }) => {
  await setClock(page);
});
```

- [ ] **Step 3: Run the geometry test and verify RED**

Run:

```bash
pnpm --filter @whereabouts/web exec playwright test --project=mobile --grep "most of the globe"
```

Expected: FAIL because the globe begins below the 844px viewport.

- [ ] **Step 4: Apply the compact responsive classes**

In `FiveRoundHeader`:

```tsx
<header className="space-y-3 border-b border-rule pb-3 sm:space-y-5 sm:pb-6">
  <h1 className="font-serif text-3xl tracking-tight text-paper sm:text-5xl">
    Whereabouts
  </h1>
  <ol className="flex gap-3 sm:gap-4" aria-label="Daily round progress">
    {/* retain progress semantics; change each dot to size-6 sm:size-8 */}
  </ol>
</header>
```

For each `main`/container branch in `five-round-game-screen.tsx`, use:

```tsx
<main className="min-h-screen bg-background px-4 py-3 text-paper sm:px-6 sm:py-8">
  <div className="mx-auto max-w-2xl space-y-3 sm:space-y-6">
```

Change the active chooser divider from `pt-6` to `pt-3 sm:pt-6`.

In `theme-briefing.tsx`:

```tsx
<section
  aria-labelledby="daily-theme"
  className="space-y-1 border-b border-rule pb-3 sm:space-y-2 sm:pb-5"
>
  <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-cyan uppercase sm:text-xs">
    Today's theme
  </p>
  <h2 id="daily-theme" className="font-serif text-2xl leading-tight text-paper sm:text-3xl">
    {theme.title}
  </h2>
  <p className="text-sm leading-snug text-muted-foreground sm:text-base sm:leading-relaxed">
    {theme.introduction}
  </p>
</section>
```

In `round-briefing.tsx`, use `space-y-2 sm:space-y-4`, retain the `h-36 sm:h-64` image from Task 4, and compact the clue card:

```tsx
<article className="border border-rule bg-paper p-3 text-ink shadow-[4px_4px_0_oklch(0.18_0.024_224_/_0.35)] sm:px-7 sm:py-6 sm:shadow-[6px_6px_0_oklch(0.18_0.024_224_/_0.35)]">
  <p className="mb-2 text-xs font-extrabold tracking-[0.18em] text-ink uppercase sm:mb-5">
    Field clue
  </p>
  <p className="font-serif text-base leading-[1.4] tracking-[-0.012em] sm:text-2xl sm:leading-relaxed">
    {round.clue.text}
  </p>
</article>
```

This removes the prior 2.52:1 translucent clue-label contrast failure.

In `daily-score-panel.tsx`, replace the fixed five-column phone grid with:

```tsx
<ol
  className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-5 sm:gap-2"
  aria-label="Round results"
>
```

Allow names to wrap normally; do not add truncation.

- [ ] **Step 5: Run mobile geometry and focused component tests**

Run:

```bash
pnpm --filter @whereabouts/web exec playwright test --project=mobile --grep "most of the globe"
pnpm --filter @whereabouts/web exec vitest run src/features/game/five-round-game-screen.test.tsx src/features/game/theme-briefing.test.tsx src/features/game/daily-score-panel.test.tsx
```

Expected: geometry test PASS with at least 60% of the globe visible and no horizontal overflow; component tests PASS.

- [ ] **Step 6: Commit mobile density**

```bash
git add apps/web/src/features/game/five-round-game-screen.tsx apps/web/src/features/game/theme-briefing.tsx apps/web/src/features/game/round-briefing.tsx apps/web/src/features/game/daily-score-panel.tsx apps/web/e2e/five-round-harness.tsx apps/web/e2e/whereabouts.spec.ts
git commit -m "style: tighten the mobile game layout"
```

## Task 6: Extend end-to-end coverage and run the full gate

**Files:**

- Modify: `apps/web/e2e/whereabouts.spec.ts`

- [ ] **Step 1: Add completion and archive-removal browser assertions**

Add `type Locator` to the existing `@playwright/test` import. Add this helper near `submitLead`, then call it on both the selected location button and dossier submit button before clicking them. This checks the 44px minimum throughout desktop and mobile journeys:

```ts
async function expectMinimumTouchTarget(
  locator: Locator,
): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
}
```

Update the relevant portion of `submitLead`:

```ts
const location = page
  .getByRole('list', { name: 'Matching locations' })
  .getByRole('button', { name: new RegExp(name) });
await expectMinimumTouchTarget(location);
await location.click();
const dossier = page.getByRole('dialog');
await expect(dossier.getByRole('heading', { name })).toBeVisible();
const submit = dossier.getByRole('button', { name: 'Submit this lead' });
await expectMinimumTouchTarget(submit);
await submit.click();
```

In the desktop completed-progress test, remove assumptions about the old browse picker and expand the field guide:

```ts
await page
  .getByText(`Field guide · ${caseData.pois.length} locations`)
  .click();
await expect(page.getByRole('list')).toContainText(caseData.pois[0]?.name ?? '');
await expect(
  page.getByRole('link', {
    name: new RegExp(`read ${caseData.pois[0]?.name} on wikipedia`, 'i'),
  }),
).toBeVisible();
await expect(page.getByRole('link', { name: /photo license/i })).toHaveCount(5);
```

Add an unavailable-route assertion to the existing dated-route test:

```ts
await expect(
  page.getByRole('button', { name: /archive/i }),
).toHaveCount(0);
await expect(
  page.getByRole('link', { name: /today's case/i }),
).toHaveAttribute('href', '/');
```

Add a pre-completion assertion to the clue test:

```ts
await expect(page.getByText(firstRound.image.attribution)).toHaveCount(0);
await expect(page.getByRole('link', { name: /photo license/i })).toHaveCount(0);
```

- [ ] **Step 2: Run both Playwright projects**

Run:

```bash
pnpm --filter @whereabouts/web exec playwright test
```

Expected: desktop and mobile journeys PASS, including direct dated routes, attribution timing, field-guide links, and geometry.

- [ ] **Step 3: Run the repository quality gate**

Run:

```bash
pnpm quality
```

Expected: formatting, validation, all package tests, typechecks, and production builds exit 0.

- [ ] **Step 4: Inspect the final diff and forbidden archive references**

Run:

```bash
git diff --check
rg -n "ArchiveDrawer|Open case archive|getPublishedCaseIndex|listPublishedCases|PublishedCaseIndex|publishedCases|archiveOpen|onOpenArchive" apps packages
git status --short
```

Expected: `git diff --check` emits nothing; the archive search emits nothing; status lists only intentional changes if the previous task commits were not already made.

- [ ] **Step 5: Commit final browser coverage if it changed after Task 5**

```bash
git add apps/web/e2e/whereabouts.spec.ts
git commit -m "test: cover the completed mobile field guide"
```

- [ ] **Step 6: Record verification evidence in the handoff**

Report the exact passing counts from `pnpm quality` and Playwright, the measured mobile visible-globe ratio, the deleted archive files/APIs, and the fact that candidates without `wikipediaTitle` render without a link or publication error.
