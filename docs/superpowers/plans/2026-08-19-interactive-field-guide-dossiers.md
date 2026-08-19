# Interactive Field Guide Dossiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each completed field-guide row into a tappable card that opens a full location dossier with its image, blurb, optional Wikipedia link, and photo credit.

**Architecture:** Keep the field guide collapsed and compact, but let it own one selected POI. Reuse `PoiDossier`: gameplay continues to pass `detail="identity"`, while completed-game full detail receives an optional round-image override and Wikipedia URL. This preserves spoiler safety and uses the existing focus trap/restoration behavior.

**Tech Stack:** TypeScript, React 19, Tailwind CSS 4, Vitest, Testing Library, Playwright.

---

### Task 1: Extend the full POI dossier

**Files:**
- Create: `apps/web/src/features/game/poi-dossier.test.tsx`
- Modify: `apps/web/src/features/game/poi-dossier.tsx`

- [ ] **Step 1: Write the failing full-detail tests**

Create `poi-dossier.test.tsx` with a fixture POI and assert that `detail="full"` renders the supplied image override, blurb, Wikipedia link, image attribution, and photo-license link, while `detail="identity"` renders none of them. Add a second full-detail case with no image, blurb, or Wikipedia URL and assert the unavailable-image fallback appears without either outbound link.

```tsx
const poi: Poi = {
  id: 'target-place',
  name: 'Target Place',
  city: 'Target City',
  country: 'Exampleland',
  latitude: 1,
  longitude: 2,
  wikipediaTitle: 'Target Place',
  blurb: 'A documented location with enough historical context for a complete dossier.',
};

const image: NonNullable<Poi['image']> = {
  url: 'https://example.test/round.jpg',
  alt: 'Round evidence photograph',
  attribution: 'Example photographer · CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

render(
  <PoiDossier
    detail="full"
    imageOverride={image}
    onOpenChange={vi.fn()}
    open
    poi={poi}
    wikipediaUrl="https://en.wikipedia.org/wiki/Target_Place"
  />,
);
expect(screen.getByRole('img', { name: image.alt })).toHaveAttribute('src', image.url);
expect(screen.getByText(poi.blurb ?? '')).toBeVisible();
expect(screen.getByRole('link', { name: /target place on wikipedia/i })).toBeVisible();
expect(screen.getByText(image.attribution)).toBeVisible();
expect(screen.getByRole('link', { name: /target place photo license/i })).toBeVisible();
```

- [ ] **Step 2: Run the test and verify RED**

```bash
pnpm --filter @whereabouts/web exec vitest run src/features/game/poi-dossier.test.tsx
```

Expected: FAIL because `imageOverride` and `wikipediaUrl` are not accepted or rendered.

- [ ] **Step 3: Implement minimal full-detail sources**

Add these props:

```ts
imageOverride?: Poi['image'];
wikipediaUrl?: string;
```

Inside the component use:

```ts
const image = imageOverride ?? poi?.image;
```

For full detail with an image, render a figure containing the image and a caption with attribution plus a descriptive, minimum-44px photo-license link. In the content area render the existing blurb and this optional link:

```tsx
{detail === 'full' && wikipediaUrl ? (
  <a
    aria-label={`Read ${poi.name} on Wikipedia`}
    className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan underline decoration-brass underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
    href={wikipediaUrl}
    rel="noreferrer"
    target="_blank"
  >
    Wikipedia
  </a>
) : null}
```

Identity mode must not inspect or render `imageOverride`, blurb, Wikipedia, attribution, or licenses.

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
pnpm --filter @whereabouts/web exec vitest run src/features/game/poi-dossier.test.tsx src/features/game/poi-picker.test.tsx
pnpm --filter @whereabouts/web typecheck
```

Expected: all tests and typecheck PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/game/poi-dossier.tsx apps/web/src/features/game/poi-dossier.test.tsx
git commit -m "feat: enrich completed location dossiers"
```

### Task 2: Make field-guide rows open dossiers

**Files:**
- Modify: `apps/web/src/features/game/completed-field-guide.test.tsx`
- Modify: `apps/web/src/features/game/completed-field-guide.tsx`

- [ ] **Step 1: Write failing interaction tests**

Replace inline-link expectations with card behavior: expand the guide, assert one minimum-44px button per candidate, click the first answer, and assert the full dialog uses that round's image, blurb, Wikipedia, attribution, and license. Close it and assert focus returns to the clicked card. Click a candidate without `wikipediaTitle` and assert its dialog contains no Wikipedia link.

```tsx
const entry = screen.getByRole('button', { name: /open target place dossier/i });
expect(entry).toHaveClass('min-h-11');
await user.click(entry);
const dialog = screen.getByRole('dialog', { name: 'Target Place' });
expect(within(dialog).getByText(caseData.pois[0].blurb ?? '')).toBeVisible();
expect(within(dialog).getByRole('link', { name: /wikipedia/i })).toBeVisible();
expect(within(dialog).getByRole('img', { name: caseData.rounds[0].image.alt })).toBeVisible();
await user.click(within(dialog).getByRole('button', { name: /^close$/i }));
expect(entry).toHaveFocus();
```

- [ ] **Step 2: Run the test and verify RED**

```bash
pnpm --filter @whereabouts/web exec vitest run src/features/game/completed-field-guide.test.tsx
```

Expected: FAIL because entries are not buttons and no dossier opens.

- [ ] **Step 3: Implement selection and card triggers**

Store `selectedPoi` in `CompletedFieldGuide`. Replace each entry's inline Wikipedia/credit markup with one full-width button:

```tsx
<button
  aria-label={`Open ${poi.name} dossier`}
  className="flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
  onClick={() => setSelectedPoi(poi)}
  type="button"
>
  <span className="min-w-0">
    <span className="block wrap-break-word font-serif text-lg text-paper">{poi.name}</span>
    <span className="block text-sm text-paper/65">{poi.city}, {poi.country}</span>
  </span>
  <span aria-hidden="true" className="shrink-0 text-sm text-cyan">View</span>
</button>
```

Find the selected answer round and mount one `PoiDossier` after the list:

```tsx
const selectedRound = selectedPoi
  ? roundByPoiId.get(selectedPoi.id)
  : undefined;

<PoiDossier
  detail="full"
  imageOverride={selectedRound?.image}
  onOpenChange={(open) => {
    if (!open) setSelectedPoi(null);
  }}
  open={selectedPoi !== null}
  poi={selectedPoi}
  wikipediaUrl={wikipediaArticleUrl(selectedPoi?.wikipediaTitle)}
/>
```

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
pnpm --filter @whereabouts/web exec vitest run src/features/game/completed-field-guide.test.tsx src/features/game/poi-dossier.test.tsx src/features/game/five-round-game-screen.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/game/completed-field-guide.tsx apps/web/src/features/game/completed-field-guide.test.tsx
git commit -m "feat: open field guide location dossiers"
```

### Task 3: Update browser coverage and verify

**Files:**
- Modify: `apps/web/e2e/whereabouts.spec.ts`

- [ ] **Step 1: Update the completed-guide browser assertions**

Replace the inline-link portion of `assertCompletedFieldGuide` with card and dialog assertions. Run the same shared assertion from desktop and mobile completion paths:

```ts
for (const candidate of caseData.pois) {
  await expect(
    candidates.getByRole('button', {
      name: `Open ${candidate.name} dossier`,
    }),
  ).toBeVisible();
}

const firstRound = caseData.rounds[0];
const firstAnswer = caseData.pois.find(
  (candidate) => candidate.id === firstRound?.targetPoiId,
);
if (!firstRound || !firstAnswer) throw new Error('Missing first answer');
await candidates
  .getByRole('button', { name: `Open ${firstAnswer.name} dossier` })
  .click();
let dialog = page.getByRole('dialog', { name: firstAnswer.name });
await expect(
  dialog.getByRole('img', { name: firstRound.image.alt }),
).toBeVisible();
if (firstAnswer.blurb) await expect(dialog.getByText(firstAnswer.blurb)).toBeVisible();
await expect(
  dialog.getByRole('link', { name: `Read ${firstAnswer.name} on Wikipedia` }),
).toBeVisible();
await expect(dialog.getByText(firstRound.image.attribution)).toBeVisible();
await expect(
  dialog.getByRole('link', { name: `${firstAnswer.name} photo license` }),
).toHaveAttribute('href', firstRound.image.licenseUrl);
await dialog.getByRole('button', { name: /^close$/i }).click();

const withoutArticle = caseData.pois.find(
  (candidate) => !candidate.wikipediaTitle,
);
if (!withoutArticle) throw new Error('Missing title-less candidate');
await candidates
  .getByRole('button', { name: `Open ${withoutArticle.name} dossier` })
  .click();
dialog = page.getByRole('dialog', { name: withoutArticle.name });
await expect(dialog.getByRole('link', { name: /wikipedia/i })).toHaveCount(0);
await dialog.getByRole('button', { name: /^close$/i }).click();
```

- [ ] **Step 2: Run Playwright and the quality gate**

```bash
pnpm --filter @whereabouts/web exec playwright test
pnpm quality
```

Expected: 12 applicable Playwright tests PASS, project-gated tests SKIP, and all 16 quality tasks PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/whereabouts.spec.ts
git commit -m "test: cover interactive field guide dossiers"
```
