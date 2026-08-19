# Mobile Alignment and Field Guide Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the mobile result flow more varied, intentional alignment and make the completed field guide visibly expandable.

**Architecture:** Apply responsive alignment classes directly to the four presentation-oriented component headers, preserving left alignment from `sm` upward. Keep the native `details` disclosure and enrich its summary with explicit state copy and a decorative rotating Lucide chevron.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Lucide React, Vitest, Testing Library, Playwright.

---

### Task 1: Make presentation blocks responsive

**Files:**
- Modify: `apps/web/src/features/game/five-round-game-screen.tsx`
- Modify: `apps/web/src/features/game/theme-briefing.tsx`
- Modify: `apps/web/src/features/game/round-reveal.tsx`
- Modify: `apps/web/src/features/game/daily-score-panel.tsx`
- Test: `apps/web/src/features/game/theme-briefing.test.tsx`
- Test: `apps/web/src/features/game/daily-score-panel.test.tsx`
- Test: `apps/web/src/features/game/five-round-game-screen.test.tsx`

- [ ] **Step 1: Write failing responsive-class tests**

Assert that the theme section and score header use `text-center sm:text-left`, and that the masthead progress list uses `justify-center sm:justify-start`. In the reveal integration test, assert the reveal header also uses `text-center sm:text-left`.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @whereabouts/web exec vitest run src/features/game/theme-briefing.test.tsx src/features/game/daily-score-panel.test.tsx src/features/game/five-round-game-screen.test.tsx
```

Expected: FAIL because the responsive alignment classes are absent.

- [ ] **Step 3: Add minimal responsive classes**

Use `text-center sm:text-left` only on the game masthead, theme section, reveal header, and score header. Use `justify-center sm:justify-start` on the round-progress list. Do not center clues, prose cards, dossiers, navigation, or field-guide entries.

- [ ] **Step 4: Verify GREEN**

Run the focused Vitest command from Step 2. Expected: PASS.

### Task 2: Clarify the field-guide disclosure

**Files:**
- Modify: `apps/web/src/features/game/completed-field-guide.tsx`
- Modify: `apps/web/src/features/game/completed-field-guide.test.tsx`
- Modify: `apps/web/e2e/whereabouts.spec.ts`

- [ ] **Step 1: Write a failing disclosure test**

Assert the collapsed summary contains `Field guide`, the dynamic candidate count, `Show locations`, and a decorative chevron with `group-open:rotate-180`. After activation, assert the state copy changes to `Hide locations` while the candidate list appears.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @whereabouts/web exec vitest run src/features/game/completed-field-guide.test.tsx
```

Expected: FAIL because state copy and the chevron do not exist.

- [ ] **Step 3: Implement the summary row**

Import `ChevronDown` from `lucide-react`. Make the summary a full-width, minimum-44-pixel flex row. Group the title and count on the left, render `Show locations` or `Hide locations` from `isOpen`, and add an `aria-hidden` chevron with `transition-transform group-open:rotate-180`.

- [ ] **Step 4: Update browser selectors and verify**

Use the summary's accessible text rather than the former single text node in Playwright. Run:

```bash
pnpm --filter @whereabouts/web exec playwright test
pnpm quality
```

Expected: 12 applicable Playwright tests PASS, 12 project-gated tests SKIP, and all 16 quality tasks PASS.

- [ ] **Step 5: Commit and integrate**

Commit the implementation and fast-forward local `main` after the worktree is clean.
