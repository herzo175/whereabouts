# Publishing Whereabouts cases

Whereabouts publishes one generated five-round case per Eastern calendar day. A case contains 25 image-backed locations, five distinct targets, five clues, and a precomputed similarity result for every round/location pair. Runtime gameplay never calls a model.

## Automated daily publication

`.github/workflows/generate-cases.yml` runs at midnight Eastern, including daylight-saving-time changes. It:

1. allocates the next revision for the Eastern publication date;
2. generates the case through OpenRouter with `WHEREABOUTS_MODEL`;
3. formats the JSON artifact;
4. updates the publication manifest;
5. validates the entire publication boundary;
6. commits and pushes the artifact directly to `main`;
7. invokes the reusable Fly deployment workflow for that exact commit.

The generator retries a model or publication-validation failure up to three total attempts. Corpus, image, manifest, or configuration errors fail immediately.

Required GitHub configuration:

- `OPENROUTER_API_KEY` Actions secret;
- `FLY_API_TOKEN` Actions secret;
- optional `WIKIMEDIA_USER_AGENT` Actions secret;
- optional `WHEREABOUTS_MODEL` Actions variable, defaulting to `openai/gpt-5.6-luna`.

## Local generation

Copy `.env.example` to `.env`, set `OPENROUTER_API_KEY` and a contact-bearing `WIKIMEDIA_USER_AGENT`, then run:

```sh
pnpm content:generate-range -- --from 2026-08-15 --days 1 --revision 1
pnpm exec biome format --write packages/case-content/content/cases/2026-08-15/v1.json
```

Add the generated artifact to `packages/case-content/content/manifest.json`, then verify it:

```sh
PUBLICATION_CEILING=2026-08-15 pnpm content:validate
pnpm content:review -- --date 2026-08-15 --revision 1
pnpm quality
```

Review every clue for usefulness without answer leakage, every similarity tier for factual accuracy, every relationship report for source support, and every image for attribution and license metadata.

## Revisions

Published case files are immutable. To correct a published date, generate the next unused revision, validate it, and point that date's manifest entry at the new file. Never overwrite an already committed revision.

To withdraw a broken case immediately, remove its manifest entry in a reviewed change. Keep committed artifacts for auditability.
