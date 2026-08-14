# Whereabouts

Whereabouts is a daily geography deduction game: read progressively revealing clues, locate the destination on the map, then compare your guess with the answer. Each published case is source-grounded and spoiler-safe until the player reveals it.

## Prerequisites

- Node.js 22 or later
- Corepack (to use the repository-pinned pnpm 10.30.0)
- A Chromium browser dependency set for end-to-end tests

## Start here

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The web application runs from `@whereabouts/web`. The daily route loads only the case selected by the publication manifest: future or unmanifested artifacts are not served. Archive routes likewise expose only manifest-published dates.

## Commands

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
pnpm content:generate-range -- --from 2026-08-28 --days 1
pnpm content:generate-range -- --from 2026-08-28 --days 7
pnpm content:validate
pnpm content:review -- --date 2026-08-28 --revision 1
pnpm content:review-range -- --from 2026-08-28 --days 7 --out artifacts/review
```

Install Chromium before the browser suite when necessary:

```sh
pnpm --filter @whereabouts/web exec playwright install chromium
```

## Environment variables

Copy `.env.example` to `.env` for local case generation. The generation CLI loads that root file when present; CI continues to use repository secrets.

- `OPENROUTER_API_KEY` — required only to generate candidate cases through OpenRouter.
- `WIKIMEDIA_USER_AGENT` — required for generation; use a contactable product identifier for Wikimedia requests.
- `WHEREABOUTS_MODEL` — optional OpenRouter model identifier; CI defaults to `deepseek/deepseek-v4-flash-0731`.
- `PUBLICATION_CEILING` — optional UTC ISO date used by content validation to enforce the public manifest boundary.

AI is used only during pre-generation of candidate content. Human review approves facts, fairness, variety, and tone; publication is a manifest change and never calls a model.

## Deployment

The production app runs on Fly.io at `whereabouts-herzo175.fly.dev`. A push to
`main` runs the quality suite and deploys the Docker image through
`.github/workflows/deploy-fly.yml`.

The GitHub repository needs an app-scoped `FLY_API_TOKEN` Actions secret. Create
one with `flyctl tokens create deploy -a whereabouts-herzo175`, then add it with
`gh secret set FLY_API_TOKEN --repo herzo175/whereabouts`.

Deploy manually from the repository root with:

```sh
flyctl deploy --remote-only
```

## Monorepo

- `apps/web` — TanStack web application, game routes, and browser tests.
- `packages/game-engine` — game state, scoring, and clue progression.
- `packages/browser-state` — client-side persistence and sharing state.
- `packages/case-content` — case schema, immutable date/revision artifacts, and the publication manifest loader.
- `packages/content-tools` — source-aware generation, validation, and human review packet CLIs.

Read the [product design](docs/superpowers/specs/2026-08-14-whereabouts-design.md), [implementation plan](docs/superpowers/plans/2026-08-14-whereabouts-implementation.md), and [content publishing runbook](docs/content-publishing.md) before operating the content pipeline.
