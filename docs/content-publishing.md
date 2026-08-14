# Publishing Whereabouts cases

Future cases remain private repository artifacts until a reviewed manifest entry publishes them on their release date. Generation uses AI only to prepare candidates; a person reviews and publishes every case.

## Generate and validate

Generate one case for a future date:

```sh
pnpm content:generate-range -- --from 2026-08-28 --days 1
pnpm content:validate
```

Generate a range and validate all content:

```sh
pnpm content:generate-range -- --from 2026-08-28 --days 7
pnpm content:validate
```

`WIKIMEDIA_USER_AGENT` is required for generation. Set it to a contactable product identifier before making Wikimedia requests, and retain the source URLs, titles, and retrieval dates recorded in every case. Follow Wikimedia's attribution and reuse requirements when presenting source material.

## Review before publication

Print an individual packet or create a packet set for reviewers:

```sh
pnpm content:review -- --date 2026-08-28 --revision 1
pnpm content:review-range -- --from 2026-08-28 --days 7 --out artifacts/review
```

For every case, confirm:

- Each factual statement is supported by the linked source and source retrieval is current enough for the claim.
- Clues are fair, progressively useful, and do not leak the target, city, country, or unearned answer.
- Temperature, weather, and time-sensitive language is appropriate for the publication date or omitted.
- Targets and distractors improve geographic and cultural variety without repeating recent material.
- Relationship tiers and contextual responses are accurate and do not create misleading associations.
- Tone is respectful, concise, accessible, and free of stereotypes or accidental ambiguity.

Do not merge a generated-case pull request until its packets have been reviewed. The weekly workflow uploads them as an artifact and opens a pull request; it never pushes generated content to `main`.

## Correct, revise, and publish

Case artifacts are immutable revisions. Never overwrite or delete `v1.json`: correct a case by creating the next revision (`v2.json`, then `v3.json`) with the same `publicationDate` and `caseNumber`, incremented `revision`, then re-run validation and review. Point the manifest entry at the approved revision:

```json
"2026-08-28": {
  "caseNumber": 123,
  "revision": 2,
  "file": "./cases/2026-08-28/v2.json"
}
```

The daily publication workflow adds only the release date's already-reviewed `v1.json` metadata to `packages/case-content/content/manifest.json`, preserving the artifact's `caseNumber` and `revision`. It validates with `PUBLICATION_CEILING` set to that UTC date, then commits only the manifest entry. It never calls a model.

To publish a manually approved revision, update that one manifest entry in a reviewed pull request and run:

```sh
PUBLICATION_CEILING=2026-08-28 pnpm content:validate
```

To withdraw a broken case immediately, remove only its date entry from `manifest.json` in a reviewed, expedited change. Keep every artifact and its sources intact for auditability; do not delete the revision files.

## Environment and AI boundary

Generation needs `OPENAI_API_KEY`, `WIKIMEDIA_USER_AGENT`, and optionally `WHEREABOUTS_MODEL` (the workflow defaults it to `gpt-5-mini`). AI is permitted only before human review, during candidate generation. It is not a reviewer, approver, or publisher.
