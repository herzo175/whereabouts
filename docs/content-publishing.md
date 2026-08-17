# Publishing Whereabouts cases

Publishing is staged: generation produces reviewable artifacts first, and the manifest is the final publication boundary. Runtime routes serve only cases present in that manifest.

## Generate a staged batch

Set `OPENROUTER_API_KEY`, `WIKIMEDIA_USER_AGENT`, and the model variables in the publishing environment. The Wikimedia user agent must identify a contactable product owner.

For a bootstrap batch, request exactly ten consecutive dates:

```sh
pnpm content:generate-range -- --from 2026-08-17 --days 10
```

For the recurring ten-day buffer, use the missing-only command. Manifested dates are skipped:

```sh
pnpm content:prepare-buffer -- --from 2026-08-17 --days 10
```

The generator loads the manifest and published v3 cases, supplies the previous 90 themes and previous 30 target IDs to each case, then stages the complete batch through one publication preflight. Every generated case receives a Unix-day case number and the next available revision unless `--revision N` is supplied.

## Audit and review

Every case writes three artifacts:

- `cases/YYYY-MM-DD/vN.json` — immutable v3 game content;
- `reviews/YYYY-MM-DD/vN.json` — semantic audit JSON, including theme and clue verdicts;
- `reviews/YYYY-MM-DD/vN.md` — a human-readable review packet.

The batch writes `reviews/index.md` after all per-case immutable files and before the manifest. It links every packet and states that all semantic verdicts passed. Review the index, audit JSON, Markdown packets, clues, images, attribution, and similarity relationships. Run:

```sh
PUBLICATION_CEILING=2026-08-26 pnpm content:validate
pnpm quality
```

Repair failed or unclear cases with a new revision. Never overwrite an existing `vN` artifact. A withdrawal removes the date from the manifest while preserving committed artifacts for auditability.

## Merge and release

Generation belongs in a reviewed pull request. The pull request should include only the staged cases, audits, review index, and manifest changes needed for the batch. Required checks must pass before merge; deployment follows the normal post-merge release workflow.
