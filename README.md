# Whereabouts

Whereabouts is a five-round daily geography game. Each round presents a sourced photograph and clue, then scores a location guess against authored similarity results. Runtime gameplay makes no model or network calls.

## Development

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Useful checks are `pnpm test`, `pnpm typecheck`, `pnpm build`, and `pnpm quality`.

## Staged content generation

Case generation is a reviewed, staged workflow. It researches live Wikimedia sources for each case, creates a narrow theme, curates 25 image-backed locations, writes five rounds, and runs an independent semantic critic. The output is not public until the manifest is updated.

To prepare a ten-day bootstrap or any explicit date range:

```sh
pnpm content:generate-range -- --from 2026-08-17 --days 10
```

To replenish only dates absent from the manifest:

```sh
pnpm content:prepare-buffer -- --from 2026-08-17 --days 10
```

Each prepared case includes immutable v3 JSON, semantic audit JSON, and a Markdown review packet. The batch also writes `content/reviews/index.md`, which links every packet and records that all semantic verdicts passed. Review the generated files and validation output before merging the staged change.

Use `--revision N` for a deliberate correction. Existing revisions are never overwritten; a corrected date points to the next immutable revision in the manifest. To withdraw a case, remove its manifest entry in a reviewed change and retain its artifacts for auditability.

## Environment

Copy `.env.example` to `.env` for local generation. CI uses repository secrets.

- `OPENROUTER_API_KEY` — required for model-assisted generation.
- `WHEREABOUTS_MODEL` — planner, researcher, curator, writer, and repair model.
- `WHEREABOUTS_CRITIC_MODEL` — optional independent critic model; falls back to `WHEREABOUTS_MODEL`.
- `WIKIMEDIA_USER_AGENT` — contact-bearing identifier required for Wikimedia requests.
- `PUBLICATION_CEILING` — optional UTC boundary used by content validation.

## Repository layout

- `apps/web` — web application and browser journeys.
- `packages/game-engine` — gameplay state and scoring.
- `packages/case-content` — schemas, immutable case artifacts, and manifest loading.
- `packages/content-tools` — generation, validation, audits, and review packet CLIs.

See [content publishing](docs/content-publishing.md) and the [launch checklist](docs/launch-checklist.md) before operating the publishing pipeline.
